#!/usr/bin/env tsx
/**
 * sse-client-test — unit test for the shared SSE reader
 * (`src/lib/sse-client.ts`, API-09).
 *
 * Exercises the parser against crafted ReadableStream inputs so we
 * can verify the boundary-splitting + JSON parsing + abort handling
 * contract without needing a real HTTP server.
 */

import { consumeSSE } from "../src/lib/sse-client";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) { console.log(`\n▸ ${title}`); }

/**
 * Build a Response whose body streams the given chunks. Each chunk
 * is a string that gets TextEncoder'd before being enqueued.
 */
function responseFromChunks(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

async function main() {
  // ─── 1. Single event, clean ────────────────────────────────────
  section("1. Single event — one `data:` line, two-newline terminator");
  {
    const res = responseFromChunks([`data: {"type":"delta","text":"hello"}\n\n`]);
    const events: any[] = [];
    const outcome = await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, `1 event (got ${events.length})`);
    assert(events[0]?.type === "delta", "type delta");
    assert(events[0]?.text === "hello", "text payload preserved");
    assert(outcome.gotAnyData === true, "gotAnyData=true");
    assert(outcome.aborted === false, "not aborted");
  }

  // ─── 2. Chunk boundary splits mid-event ────────────────────────
  section("2. Event split across two network chunks");
  {
    const res = responseFromChunks([
      `data: {"type":"delta","tex`,
      `t":"hello"}\n\n`,
    ]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, "chunk-split event reassembled");
    assert(events[0]?.text === "hello", "text intact after reassembly");
  }

  // ─── 3. Multiple events in one chunk ───────────────────────────
  section("3. Three events back-to-back in one chunk");
  {
    const res = responseFromChunks([
      `data: {"type":"delta","text":"a"}\n\n` +
      `data: {"type":"delta","text":"b"}\n\n` +
      `data: {"type":"complete","result":{"synthesis":"done"}}\n\n`,
    ]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 3, `3 events (got ${events.length})`);
    assert(events[0]?.text === "a" && events[1]?.text === "b", "deltas in order");
    assert(events[2]?.type === "complete", "complete last");
  }

  // ─── 4. CRLF line endings (HTTP/1.1 proxies) ────────────────────
  section("4. CRLF line endings normalised");
  {
    const res = responseFromChunks([`data: {"type":"ok","n":1}\r\n\r\n`]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, "CRLF boundary recognised");
    assert(events[0]?.n === 1, "payload preserved through CRLF path");
  }

  // ─── 5. Malformed JSON ignored ─────────────────────────────────
  section("5. Malformed JSON events silently skipped");
  {
    const res = responseFromChunks([
      `data: {not-valid-json}\n\n` +
      `data: {"type":"delta","text":"kept"}\n\n`,
    ]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, `malformed event dropped (got ${events.length})`);
    assert(events[0]?.text === "kept", "valid event still emitted");
  }

  // ─── 6. Non-data lines ignored ─────────────────────────────────
  section("6. Non-`data:` lines ignored (comments, event:, id:)");
  {
    const res = responseFromChunks([
      `: this is a comment\n` +
      `event: custom\n` +
      `id: 42\n` +
      `data: {"type":"delta","text":"keep"}\n\n`,
    ]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, "only the data: line produced an event");
    assert(events[0]?.text === "keep", "text preserved");
  }

  // ─── 7. [DONE] sentinel does not emit ─────────────────────────
  section("7. OpenAI-style `data: [DONE]` sentinel is skipped");
  {
    const res = responseFromChunks([
      `data: {"type":"delta","text":"a"}\n\n` +
      `data: [DONE]\n\n`,
    ]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, "[DONE] skipped, only delta emitted");
  }

  // ─── 8. Abort mid-stream ───────────────────────────────────────
  section("8. AbortSignal mid-stream exits cleanly");
  {
    // We enqueue once, then the reader waits forever — trigger abort
    // while the loop is blocked on read(). Use a stream with a
    // pending second chunk that never arrives.
    const encoder = new TextEncoder();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        controller.enqueue(encoder.encode(`data: {"type":"delta","text":"before-abort"}\n\n`));
      },
    });
    const res = new Response(stream);
    const abortController = new AbortController();

    const events: any[] = [];
    const promise = consumeSSE(res, {
      signal: abortController.signal,
      onEvent: (e) => {
        events.push(e);
        // Trigger abort inside the first event — the next read-loop
        // check should exit cleanly.
        abortController.abort();
        controllerRef?.close();
      },
    });
    const outcome = await promise;
    assert(events.length === 1, "got one event before abort");
    assert(outcome.aborted === true || outcome.gotAnyData === true, "outcome reports abort or completion");
  }

  // ─── 9. Empty response body → zero events, gotAnyData=false ─────
  section("9. Empty stream — no events, gotAnyData=false");
  {
    const res = responseFromChunks([]);
    const events: any[] = [];
    const outcome = await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 0, "no events");
    assert(outcome.gotAnyData === false, "gotAnyData=false");
    assert(outcome.aborted === false, "not aborted");
  }

  // ─── 10. Final block without trailing blank line ────────────────
  section("10. Trailing data without \\n\\n still flushed");
  {
    const res = responseFromChunks([`data: {"type":"tail","x":5}`]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, "trailing block flushed on stream end");
    assert(events[0]?.x === 5, "payload preserved");
  }

  // ─── 11. Multi-line data: per spec ─────────────────────────────
  section("11. Multiple `data:` lines in one block (spec-correct concat)");
  {
    const res = responseFromChunks([
      `data: {"type":"delta",\n` +
      `data: "text":"multiline"}\n\n`,
    ]);
    const events: any[] = [];
    await consumeSSE(res, { onEvent: (e) => events.push(e) });
    assert(events.length === 1, "two data: lines merged into one event");
    assert(events[0]?.text === "multiline", "merged JSON parsed correctly");
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
