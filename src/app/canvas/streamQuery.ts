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
 *     **Retry behaviour (EDGE-17, 2026-04-18):** the initial POST is
 *     retried up to three times with exponential backoff (500 ms, 1.5 s,
 *     4.5 s) on network errors and 5xx responses. An optional
 *     `onReconnecting(attempt)` callback is fired before each retry so
 *     the caller can surface "Verbindung unterbrochen — Versuch 2 …" to
 *     the user. 4xx responses (client-side problem) and mid-stream drops
 *     are **not** retried: mid-stream drops would let a re-POST restart
 *     the LLM and overwrite partial synthesis the user already sees.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work.
 */

"use client";

import type { QueryResult } from "@/types";
import { consumeSSE } from "@/lib/sse-client";

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

// Exponential backoff for initial-connection retries. Three attempts total
// beyond the first try; total patience ≈ 6.5 s before surfacing to the user.
const RECONNECT_BACKOFFS_MS = [500, 1500, 4500] as const;

// Small locale-aware string helper. `streamQuery` takes `locale` as a bare
// string (not the i18n `Locale` type) so that the stream layer stays
// independent of the dictionary — it only needs to pass locale through to the
// API and pick between DE/EN for the three error surfaces below.
function errMsg(locale: string, key: "timeout" | "failed" | "httpStatus" | "midStream" | "incomplete" | "noResponse", detail?: string | number): string {
  const de = locale === "de";
  switch (key) {
    case "timeout":    return de ? "Verbindung fehlgeschlagen — Zeit überschritten" : "Connection failed — timed out";
    case "failed":     return de ? `Verbindung fehlgeschlagen: ${detail}` : `Connection failed: ${detail}`;
    case "httpStatus": return `HTTP ${detail}`;
    case "midStream":  return de ? "Verbindung während der Antwort unterbrochen" : "Connection dropped mid-response";
    case "incomplete": return de ? "Antwort unvollständig — Server beendete den Stream ohne Abschluss" : "Response incomplete — server ended stream without a final event";
    case "noResponse": return de ? "Keine Antwort erhalten" : "No response received";
  }
}

// Sleep that honours AbortSignal so we don't keep retrying after the user cancelled.
async function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function streamQuery(
  query: string, locale: string,
  onChunk: (c: string) => void,
  onComplete: (r: QueryResult) => void,
  onError: (m: string) => void,
  onPhase?: (phase: number) => void,
  signal?: AbortSignal,
  /** Optional: notifies the caller when a connection retry is about to
   *  happen. `attempt` is 1-based (1 = first retry, 2 = second, …). Use
   *  this to show "reconnecting" copy to the user. */
  onReconnecting?: (attempt: number) => void,
) {
  // ── Phase 1: establish the connection, retrying on transient failures.
  // Once the connection is up we switch to Phase 2 (mid-stream), which does
  // NOT retry — see the class comment for the reasoning.
  let res: Response | null = null;
  for (let attempt = 0; attempt <= RECONNECT_BACKOFFS_MS.length; attempt++) {
    if (signal?.aborted) return;

    if (attempt > 0) {
      onReconnecting?.(attempt);
      try {
        await sleepAbortable(RECONNECT_BACKOFFS_MS[attempt - 1], signal);
      } catch {
        return; // aborted during backoff
      }
    }

    try {
      const r = await fetch("/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, locale }),
        signal,
      });
      if (!r.ok || !r.body) {
        // 5xx → retry (probably transient). 4xx → give up (client bug / auth).
        if (r.status >= 500 && attempt < RECONNECT_BACKOFFS_MS.length) continue;
        onError(errMsg(locale, "httpStatus", r.status));
        return;
      }
      res = r;
      break;
    } catch (e) {
      if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) return;
      if (attempt < RECONNECT_BACKOFFS_MS.length) continue;
      onError(errMsg(locale, "failed", String(e)));
      return;
    }
  }
  if (!res) {
    onError(errMsg(locale, "timeout"));
    return;
  }

  // ── Phase 2: read the stream. Mid-stream errors do NOT retry — we'd
  // overwrite partial synthesis the user already sees.
  // Shared SSE client — see src/lib/sse-client.ts (API-09).
  let acc = "", sent = 0;
  let final: QueryResult | null = null;
  let lastPhase = 0;
  let errored = false;

  try {
    const outcome = await consumeSSE(res, {
      signal,
      onEvent(evt) {
        if (errored) return;
        if (evt.type === "delta" && typeof evt.text === "string") {
          acc += evt.text;
          const delta = extractSynthesisDelta(acc, sent);
          if (delta) { sent += delta.length; onChunk(delta); }
          if (onPhase) {
            const phase = detectStreamingPhase(acc);
            if (phase !== lastPhase) { lastPhase = phase; onPhase(phase); }
          }
        } else if (evt.type === "complete" && evt.result) {
          final = evt.result as QueryResult;
        } else if (evt.type === "error") {
          errored = true;
          onError((typeof evt.error === "string" ? evt.error : null) ?? (locale === "de" ? "Fehler" : "Error"));
        }
      },
    });
    if (errored) return;
    if (outcome.aborted) return;

    if (final) onComplete(final);
    else onError(outcome.gotAnyData ? errMsg(locale, "incomplete") : errMsg(locale, "noResponse"));
  } catch (e) {
    if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) return;
    // Mid-stream drop. Don't retry — see class comment. Surface a clear
    // message so the QueryNodeCard can show the right error state.
    // `consumeSSE` returns `gotAnyData` on success but when it throws we
    // don't have that information — err on the safe side and report
    // the mid-stream message (user sees partial content either way).
    onError(errMsg(locale, "midStream"));
    return;
  }
}
