#!/usr/bin/env tsx
/**
 * stream-query-retry-test — unit test for the `streamQuery` retry logic
 * added under EDGE-17 (2026-04-18).
 *
 * Covers the four behaviours that regressions would most likely break:
 *
 *   1. 4xx responses — NO retry (client error).
 *   2. 5xx responses — retry up to 3 times with backoff, then error out.
 *   3. fetch() throws  — retry as for 5xx.
 *   4. AbortSignal     — cancels the backoff wait and exits cleanly.
 *
 * Implementation approach: temporarily replace the global `fetch` with a
 * programmable mock, import `streamQuery`, run each scenario, restore the
 * real `fetch`. Zero external deps.
 *
 * Run: `tsx scripts/stream-query-retry-test.ts` (or `npm run test:stream`).
 */

import { streamQuery } from "../src/app/canvas/streamQuery";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// Monkey-patch global fetch with a programmable queue. Each call pops the
// next response/error from the queue.
type MockEntry =
  | { kind: "status"; status: number; body?: string }
  | { kind: "throw"; error: Error };

function installFetchMock(queue: MockEntry[]): { callCount: () => number; restore: () => void } {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_url: unknown, _init?: unknown) => {
    calls += 1;
    const entry = queue.shift();
    if (!entry) throw new Error(`mock queue exhausted at call #${calls}`);
    if (entry.kind === "throw") throw entry.error;
    // status mode — return a mock Response-like object with an empty SSE body
    // so if the test accidentally reaches Phase 2, it ends cleanly.
    const body = entry.body ?? "";
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (body) controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    return new Response(entry.status === 200 ? stream : null, {
      status: entry.status,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;
  return {
    callCount: () => calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

async function runTests() {
  // ── 1. 4xx — no retry ───────────────────────────────────────────────────
  section("1. 4xx response does NOT retry");
  {
    const mock = installFetchMock([
      { kind: "status", status: 401 },
    ]);
    let errorMsg = "";
    let reconnectCalls = 0;
    await streamQuery(
      "test", "de",
      () => {}, () => {},
      (m) => { errorMsg = m; },
      undefined, undefined,
      () => { reconnectCalls += 1; },
    );
    mock.restore();
    assert(mock.callCount() === 1, `exactly 1 fetch call (got ${mock.callCount()})`);
    assert(errorMsg === "HTTP 401", `error = "HTTP 401" (got "${errorMsg}")`);
    assert(reconnectCalls === 0, `onReconnecting NOT called (got ${reconnectCalls})`);
  }

  // ── 2. 5xx — retry then error ───────────────────────────────────────────
  section("2. 5xx response retries, then errors on exhaustion");
  {
    const mock = installFetchMock([
      { kind: "status", status: 503 },
      { kind: "status", status: 503 },
      { kind: "status", status: 503 },
      { kind: "status", status: 503 },
    ]);
    let errorMsg = "";
    let reconnectAttempts: number[] = [];
    const t0 = Date.now();
    await streamQuery(
      "test", "de",
      () => {}, () => {},
      (m) => { errorMsg = m; },
      undefined, undefined,
      (attempt) => { reconnectAttempts.push(attempt); },
    );
    const elapsed = Date.now() - t0;
    mock.restore();
    assert(mock.callCount() === 4, `4 fetch calls = 1 initial + 3 retries (got ${mock.callCount()})`);
    assert(errorMsg === "HTTP 503", `final error = "HTTP 503" (got "${errorMsg}")`);
    assert(
      JSON.stringify(reconnectAttempts) === "[1,2,3]",
      `onReconnecting fired with [1,2,3] (got ${JSON.stringify(reconnectAttempts)})`,
    );
    // Backoffs are 500 + 1500 + 4500 = 6500 ms. Allow some slack either way.
    assert(elapsed >= 6000, `elapsed ≥ 6000ms honouring backoffs (got ${elapsed}ms)`);
  }

  // ── 3. fetch throws — same retry behaviour as 5xx ───────────────────────
  section("3. Network error retries, then errors on exhaustion");
  {
    const mock = installFetchMock([
      { kind: "throw", error: new TypeError("fetch failed") },
      { kind: "throw", error: new TypeError("fetch failed") },
      { kind: "throw", error: new TypeError("fetch failed") },
      { kind: "throw", error: new TypeError("fetch failed") },
    ]);
    let errorMsg = "";
    await streamQuery(
      "test", "en",
      () => {}, () => {},
      (m) => { errorMsg = m; },
    );
    mock.restore();
    assert(mock.callCount() === 4, `4 fetch calls (got ${mock.callCount()})`);
    assert(
      errorMsg.startsWith("Connection failed"),
      `EN error starts with "Connection failed" (got "${errorMsg}")`,
    );
  }

  // ── 4. AbortSignal cancels retry backoff ────────────────────────────────
  section("4. AbortSignal cancels the retry cleanly");
  {
    const mock = installFetchMock([
      { kind: "status", status: 503 }, // 1st call → will schedule 500ms backoff
      { kind: "status", status: 503 }, // never reached
    ]);
    let errorMsg = "";
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 150); // abort during the 500ms backoff
    await streamQuery(
      "test", "de",
      () => {}, () => {},
      (m) => { errorMsg = m; },
      undefined, ctrl.signal,
    );
    mock.restore();
    assert(mock.callCount() === 1, `exactly 1 fetch call (abort before retry) (got ${mock.callCount()})`);
    assert(errorMsg === "", `no error surfaced on abort (got "${errorMsg}")`);
  }

  console.log(`\n${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test harness failed:", e);
  process.exit(1);
});
