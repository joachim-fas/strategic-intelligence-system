/**
 * Streaming — SSE helpers for the /api/v1/query endpoint.
 *
 *   - `extractSynthesisDelta(acc, sent)` walks raw streaming JSON and
 *     returns whatever new synthesis text has arrived since the last
 *     pull. Handles escape sequences inline so rendering can keep
 *     up without waiting for valid JSON.
 *   - `detectStreamingPhase(acc)` maps the streaming accumulator to a
 *     coarse phase (0–5) for the phase indicator in QueryNodeCard.
 *   - `streamQuery(query, locale, ...callbacks)` is the one-call entry
 *     point used by CanvasPage: it POSTs the query, parses the SSE
 *     stream, calls `onChunk` for each synthesis delta, `onPhase` as
 *     the accumulator crosses phase boundaries, and finally
 *     `onComplete(result)` once the server emits the "complete" event.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work.
 */

"use client";

import type { QueryResult } from "@/types";

export function extractSynthesisDelta(acc: string, sent: number): string {
  const keyIdx = acc.indexOf('"synthesis"');
  if (keyIdx === -1) return "";
  const after = acc.slice(keyIdx + 11);
  const colon = after.indexOf(":");
  if (colon === -1) return "";
  const rest = after.slice(colon + 1).trimStart();
  if (!rest.startsWith('"')) return "";
  let result = "";
  let i = 1;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === "\\") {
      if (i + 1 >= rest.length) break;
      const nx = rest[i + 1];
      if (nx === "u") {
        if (i + 5 >= rest.length) break;
        const hex = rest.slice(i + 2, i + 6);
        result += String.fromCharCode(parseInt(hex, 16));
        i += 6;
      } else {
        result += nx === "n" ? "\n"
               : nx === "t" ? "\t"
               : nx === "r" ? "\r"
               : nx === "b" ? "\b"
               : nx === "f" ? "\f"
               : nx === '"' ? '"'
               : nx === "\\" ? "\\"
               : nx === "/" ? "/"
               : nx;
        i += 2;
      }
    } else if (ch === '"') break;
    else { result += ch; i++; }
  }
  return result.length > sent ? result.slice(sent) : "";
}

export function detectStreamingPhase(acc: string): number {
  if (acc.includes('"confidence"')) return 5;
  if (acc.includes('"keyInsights"')) return 4;
  if (acc.includes('"scenarios"')) return 3;
  if (acc.includes('"reasoningChains"')) return 2;
  if (acc.includes('"synthesis"')) return 1;
  return 0;
}

// TODO: EDGE-17 — Add auto-reconnect with exponential backoff on SSE stream failures.
// Show user notification: "Verbindung unterbrochen, reconnecting..."
// Current implementation has no retry logic — if the stream fails, the user must re-submit.
export async function streamQuery(
  query: string, locale: string,
  onChunk: (c: string) => void,
  onComplete: (r: QueryResult) => void,
  onError: (m: string) => void,
  onPhase?: (phase: number) => void,
  signal?: AbortSignal,
) {
  try {
    const res = await fetch("/api/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, locale }),
      signal,
    });
    if (!res.ok || !res.body) { onError(`HTTP ${res.status}`); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", acc = "", sent = 0;
    let final: QueryResult | null = null;
    let lastPhase = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json) continue;
        try {
          const evt = JSON.parse(json);
          if (evt.type === "delta" && evt.text) {
            acc += evt.text;
            const delta = extractSynthesisDelta(acc, sent);
            if (delta) { sent += delta.length; onChunk(delta); }
            if (onPhase) {
              const phase = detectStreamingPhase(acc);
              if (phase !== lastPhase) { lastPhase = phase; onPhase(phase); }
            }
          } else if (evt.type === "complete" && evt.result) {
            final = evt.result;
          } else if (evt.type === "error") { onError(evt.error || "Fehler"); return; }
        } catch {}
      }
    }
    if (final) onComplete(final);
    else onError("Keine Antwort erhalten");
  } catch (e) { onError(String(e)); }
}
