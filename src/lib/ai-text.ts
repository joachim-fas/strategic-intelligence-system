/**
 * ai-text — minimal single-shot text completion with provider fallback.
 *
 * Abstracts the "give me a sentence" LLM call that's needed in a
 * handful of places (cluster diff, briefing-diff-on-rerun, possibly
 * notification summaries) without pulling them all through the big
 * `queryLLM()` in llm.ts that's shaped for structured JSON briefings.
 *
 * Provider chain (Welle C Item 1 — Worldmonitor-inspired fallback):
 *   1. Anthropic (primary, always used if ANTHROPIC_API_KEY is set).
 *   2. OpenRouter (fallback, activates if OPENROUTER_API_KEY is set
 *      AND Anthropic returned a recoverable failure — 5xx, timeout,
 *      or missing key. 4xx from Anthropic does NOT trigger fallback
 *      because it means the request was malformed; retrying won't
 *      help).
 *   3. null (every provider exhausted or nothing configured).
 *
 * No Transformers.js tier. Worldmonitor uses that for browser-side
 * inference; SIS runs server-side where adding a 60 MB ONNX model
 * just to cover a sub-1% availability gap isn't worth the weight.
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
  /** Override the Anthropic model (default: Claude Haiku for cheap
   *  side-channel work; override to a stronger model for user-
   *  visible output). */
  model?: string;
  /** Override the OpenRouter model when the fallback activates.
   *  Default is `anthropic/claude-haiku` — same vendor-weights but
   *  routed through OpenRouter's gateway. */
  fallbackModel?: string;
  /** Hard timeout in ms per provider. Defaults to 15 s — we're
   *  usually called from a pipeline hot loop where a hang would
   *  block the whole run. Both providers share the same budget. */
  timeoutMs?: number;
}

/** Default Anthropic model — cheap + fast, appropriate for background diffs. */
const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_FALLBACK_MODEL = "anthropic/claude-haiku";
const DEFAULT_MAX_TOKENS = 300;
const DEFAULT_TIMEOUT_MS = 15_000;

export async function completeText(
  params: CompleteTextParams,
): Promise<string | null> {
  if (!params.system || !params.user) return null;

  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // ── Primary: Anthropic ────────────────────────────────────────────
  const anthropicKey = resolveEnv("ANTHROPIC_API_KEY");
  const anthropicResult = anthropicKey
    ? await callAnthropic({
        apiKey: anthropicKey,
        model: params.model ?? DEFAULT_MODEL,
        system: params.system,
        user: params.user,
        maxTokens,
        timeoutMs,
      })
    : { text: null, recoverable: true };

  if (anthropicResult.text != null) return normalise(anthropicResult.text);

  // Anthropic returned a non-recoverable failure (4xx) — no point
  // retrying at OpenRouter with the same payload.
  if (!anthropicResult.recoverable) return null;

  // ── Fallback: OpenRouter ─────────────────────────────────────────
  const openRouterKey = resolveEnv("OPENROUTER_API_KEY");
  if (!openRouterKey) return null;

  const openRouterResult = await callOpenRouter({
    apiKey: openRouterKey,
    model: params.fallbackModel ?? DEFAULT_FALLBACK_MODEL,
    system: params.system,
    user: params.user,
    maxTokens,
    timeoutMs,
  });

  if (openRouterResult.text != null) {
    console.info("[ai-text] served via OpenRouter fallback");
    return normalise(openRouterResult.text);
  }

  return null;
}

interface ProviderResult {
  text: string | null;
  /** True when the failure looks transient (5xx, timeout, missing key).
   *  False when the request was malformed (4xx) — retrying at a
   *  different provider with the same payload won't help. */
  recoverable: boolean;
}

interface CallParams {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
}

async function callAnthropic(p: CallParams): Promise<ProviderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), p.timeoutMs);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: p.maxTokens,
        system: p.system,
        messages: [{ role: "user", content: p.user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[ai-text] Anthropic returned HTTP ${res.status}`);
      // 5xx (server) or 429 (rate limit) are recoverable — worth
      // trying the fallback provider. 4xx (except 429) is a client
      // error that won't change with a different host.
      const recoverable = res.status >= 500 || res.status === 429;
      return { text: null, recoverable };
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? null;
    return { text, recoverable: true };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[ai-text] Anthropic request timed out");
    } else {
      console.warn("[ai-text] Anthropic request failed:", err);
    }
    // Network / timeout / DNS — all recoverable by definition.
    return { text: null, recoverable: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenRouter uses the OpenAI chat-completions wire format, not the
 * Anthropic messages format — parameter names differ. See
 * https://openrouter.ai/docs/api-reference/chat-completions.
 */
async function callOpenRouter(p: CallParams): Promise<ProviderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), p.timeoutMs);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
        // OpenRouter's recommended etiquette headers — help them
        // route the traffic and show up on the dashboard.
        "HTTP-Referer": "https://sis.local",
        "X-Title": "Strategic Intelligence System",
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: p.maxTokens,
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[ai-text] OpenRouter returned HTTP ${res.status}`);
      // We never chain further, so the recoverable flag is only
      // meaningful for symmetry — set it false so callers know
      // there's no further fallback to try.
      return { text: null, recoverable: false };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? null;
    return { text, recoverable: true };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[ai-text] OpenRouter request timed out");
    } else {
      console.warn("[ai-text] OpenRouter request failed:", err);
    }
    return { text: null, recoverable: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trim + collapse internal whitespace to single spaces for the
 * typical one-line output. Callers wanting multi-line output can
 * re-split after — we never grow here.
 */
function normalise(text: string): string {
  return text.trim().replace(/\s+/g, " ").trim();
}
