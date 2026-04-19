/**
 * sse-client — shared SSE-stream reader (API-09).
 *
 * Consolidates the three near-identical SSE parsers SIS used to
 * ship (src/app/canvas/streamQuery.ts, src/app/canvas/page.tsx,
 * src/lib/use-framework-analysis.ts). Each had its own subtle bugs:
 *   - streamQuery + page.tsx split on "\n" (single newline), which
 *     over-splits when an SSE block contains an extra blank line
 *     between fields.
 *   - use-framework-analysis split on "\n\n" (per spec) but had
 *     its own bespoke error handling that other callers lacked.
 *   - None handled "\r\n" line endings (fine on our server today
 *     but fragile against proxies).
 *
 * This module does the SSE protocol once:
 *   - Decodes the ReadableStream with TextDecoder(stream:true).
 *   - Splits on "\n\n" (with "\r\n\r\n" tolerated), keeps the
 *     trailing partial block buffered.
 *   - Emits one parsed JSON event per `data: …` line, trimming
 *     whitespace and skipping empty lines.
 *   - Skips non-parseable JSON lines silently (matches the
 *     "try {} catch {}" pattern every caller had).
 *   - Honours an optional AbortSignal — abort mid-stream exits
 *     cleanly without calling the error callback.
 *
 * The shared client is deliberately callback-based rather than
 * yielding an AsyncIterable: the three callers already use callback
 * state (acc buffers, flags) so turning the call-site inside-out
 * would be a bigger rewrite than it's worth.
 */

export interface SseEvent {
  /** Every SSE message our backend sends carries a `type` field
   *  (delta / complete / error / status / ...). Callers dispatch on
   *  it. Other fields flow through unchanged. */
  type?: string;
  [key: string]: unknown;
}

export interface ConsumeSseOptions<T extends SseEvent = SseEvent> {
  /** Called for each parsed JSON event. Callers decide what to do
   *  based on `event.type`. */
  onEvent: (event: T) => void;
  /** Optional — cancel the read loop. We exit cleanly (no error
   *  callback fired) when the signal trips. */
  signal?: AbortSignal;
}

export interface ConsumeSseResult {
  /** True when we saw at least one byte. Useful for distinguishing
   *  "never connected" from "mid-stream drop" in error handling. */
  gotAnyData: boolean;
  /** True when the signal was aborted. Callers may want to stay
   *  silent in that case. */
  aborted: boolean;
}

/**
 * Consume an SSE response body. Throws on network / abort-with-
 * callback-error; gracefully returns when the stream ends or the
 * abort signal trips.
 *
 * The caller owns the Response — we don't close it. Callers that
 * want to release the underlying reader early should `signal.abort()`.
 */
export async function consumeSSE<T extends SseEvent = SseEvent>(
  response: Response,
  opts: ConsumeSseOptions<T>,
): Promise<ConsumeSseResult> {
  if (!response.body) {
    throw new Error("Response has no body — cannot parse SSE");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotAnyData = false;

  try {
    while (true) {
      if (opts.signal?.aborted) {
        return { gotAnyData, aborted: true };
      }
      const { done, value } = await reader.read();
      if (done) break;
      gotAnyData = true;
      buffer += decoder.decode(value, { stream: true });

      // SSE boundaries are blank lines. Split on "\n\n" (modern
      // servers) with a fallback to "\r\n\r\n" (HTTP/1.1 proxies
      // may normalise). The remainder stays in the buffer for the
      // next chunk.
      const normalised = buffer.replace(/\r\n/g, "\n");
      const blocks = normalised.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const event = parseSseBlock<T>(block);
        if (event !== null) opts.onEvent(event);
      }
    }

    // Flush any trailing non-boundary-terminated block. Most of our
    // servers end with a newline, but a terminating `data: …`
    // without the blank line is still valid per spec.
    if (buffer.trim().length > 0) {
      const event = parseSseBlock<T>(buffer);
      if (event !== null) opts.onEvent(event);
    }

    return { gotAnyData, aborted: false };
  } catch (err) {
    if (opts.signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return { gotAnyData, aborted: true };
    }
    throw err;
  }
}

/**
 * Parse a single SSE block (everything between two blank lines).
 * Returns the first parseable `data: …` line's JSON, or null if
 * the block has no parseable data.
 *
 * The SSE spec allows multiple `data:` lines per event (their
 * contents should be concatenated with newlines). Our backend
 * doesn't use that shape — every event is a single line of JSON —
 * but we handle it for spec-correctness so callers don't need to
 * worry about it.
 */
function parseSseBlock<T extends SseEvent>(block: string): T | null {
  const lines = block.split("\n");
  const dataParts: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    // `data:<content>` or `data: <content>` both valid; strip one
    // leading space if present.
    const rest = line.slice(5);
    dataParts.push(rest.startsWith(" ") ? rest.slice(1) : rest);
  }
  if (dataParts.length === 0) return null;
  const payload = dataParts.join("\n").trim();
  if (!payload) return null;

  // SSE `[DONE]` sentinel (used by OpenAI-compatible endpoints)
  // doesn't parse as JSON. Callers that want to handle it should
  // check `event.type` after parsing — we return null here so the
  // stream loop continues.
  if (payload === "[DONE]") return null;

  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
