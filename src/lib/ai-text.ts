/**
 * ai-text — minimal single-shot text completion helper.
 *
 * Abstracts the "give me a sentence" LLM call that's needed in a
 * handful of places (cluster diff, briefing-diff-on-rerun, possibly
 * notification summaries) without pulling them all through the big
 * `queryLLM()` in llm.ts that's shaped for structured JSON briefings.
 *
 * Deliberately thin. The full AI-Fallback-Router (Welle C Item 1,
 * Worldmonitor-style Anthropic→OpenRouter→Transformers.js) is a
 * separate future-work piece; this helper is the first primitive it
 * will compose. Today it only talks to Anthropic directly — when the
 * router lands, this file gets a one-line rename and the router
 * plugs in as the implementation.
 *
 * Contract
 * ────────
 *   completeText({ system, user, maxTokens, locale? })
 *     → string   on success (stripped, whitespace-collapsed)
 *     → null     on missing API key, HTTP error, or timeout
 *
 * Callers MUST tolerate null — we never throw from here. The caller
 * controls whether "missing copy" is a hard error or a graceful-
 * degradation path (e.g. cluster-diff just keeps changelog null).
 */

import { resolveEnv } from "./env";

export interface CompleteTextParams {
  /** System instructions. Short and concrete. */
  system: string;
  /** User message. Usually the thing-to-analyse. */
  user: string;
  /** Cap on output tokens. Defaults to 300 (≈ 225 words — fine for
   *  a one-line diff, adjust upward for longer summaries). */
  maxTokens?: number;
  /** Model to call. Defaults to Claude Haiku for cheap side-channel
   *  work; override to a stronger model for user-visible output. */
  model?: string;
  /** Hard timeout in ms. Defaults to 15s — we're usually called from
   *  a pipeline hot loop where a hang would block the whole run. */
  timeoutMs?: number;
}

/** Default model — cheap + fast, appropriate for background diffs. */
const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 300;
const DEFAULT_TIMEOUT_MS = 15_000;

export async function completeText(
  params: CompleteTextParams,
): Promise<string | null> {
  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  if (!params.system || !params.user) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model ?? DEFAULT_MODEL,
        max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Don't log the body — could contain partial outputs or rate-
      // limit messages that are noisy. Status code is enough for
      // operational triage; structured error payloads belong in the
      // future AI-router's telemetry layer.
      console.warn(`[ai-text] Anthropic returned HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text;
    if (!text) return null;

    // Normalize: trim, collapse internal newlines to single spaces for
    // the typical one-line output. Callers that want multi-line output
    // can re-split after — we never grow here.
    return text
      .trim()
      .replace(/\s+/g, " ")
      .trim();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[ai-text] Anthropic request timed out");
    } else {
      console.warn("[ai-text] Anthropic request failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
