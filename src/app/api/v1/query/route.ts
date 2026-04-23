import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { TrendDot } from "@/types";
import { requireAuth } from "@/lib/auth-guard";

// ── Input sanitization ──────────────────────────────────────────────────────
// SECURITY: Prevent prompt injection attacks by sanitizing user input before
// it reaches the LLM. Strips patterns that could manipulate the prompt structure.

/** Maximum allowed query length in characters */
const MAX_QUERY_LENGTH = 2000;

/**
 * Patterns that indicate prompt injection attempts.
 * SECURITY: These patterns match common prompt injection techniques:
 * - System/role directives that try to override the system prompt
 * - XML-like tags that could manipulate structured prompt formats
 * - Instruction override attempts
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Role/instruction overrides (case-insensitive)
  /\b(?:system|assistant|human)\s*:/gi,
  /\byou are\b/gi,
  /\bignore (?:all |the )?(?:previous |above )?instructions?\b/gi,
  /\bforget (?:all |the )?(?:previous |above )?instructions?\b/gi,
  /\bdisregard (?:all |the )?(?:previous |above )?instructions?\b/gi,
  /\boverride (?:all |the )?(?:previous |above )?instructions?\b/gi,
  /\bnew instructions?\s*:/gi,
  /\bact as\b/gi,
  /\bpretend (?:to be|you are)\b/gi,
];

/**
 * XML-like tag pattern — matches opening and self-closing tags that could
 * manipulate prompt structure (e.g., <system>, <instructions>, </user>).
 */
const XML_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9_-]*(?:\s[^>]*)?\s*\/?>/g;

/**
 * Sanitize user query input to mitigate prompt injection.
 * SECURITY: This is defense-in-depth — the system prompt should also be
 * robust against injection, but sanitizing input reduces attack surface.
 *
 * Returns the sanitized string, or null if the input is invalid.
 */
function sanitizeQuery(raw: string): string | null {
  if (typeof raw !== "string") return null;

  let sanitized = raw.trim();

  // Length check
  if (sanitized.length === 0) return null;
  if (sanitized.length > MAX_QUERY_LENGTH) return null;

  // Strip XML-like tags that could manipulate prompt structure
  sanitized = sanitized.replace(XML_TAG_PATTERN, "");

  // Neutralize prompt injection patterns by replacing with harmless text
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[filtered]");
  }

  // Final trim after sanitization
  sanitized = sanitized.trim();
  if (sanitized.length === 0) return null;

  return sanitized;
}

// M2-FIX: Use canonical resolveEnv from env.ts instead of duplicated copy
import { resolveEnv } from "@/lib/env";
import { emitActivity } from "@/lib/activity-bus";

function loadTrendsFromDB(): TrendDot[] {
  try {
    const dbPath = path.join(process.cwd(), "local.db");
    const db = new Database(dbPath, { readonly: true });
    db.pragma("journal_mode = WAL");
    const rows = db.prepare("SELECT * FROM trends WHERE status != 'archived'").all() as any[];
    db.close();

    return rows.map((row) => {
      const tags = row.tags ? JSON.parse(row.tags) : [];
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      return {
        id: row.id, name: row.name, description: row.description || "",
        category: row.category, tags,
        relevance: row.agg_relevance ?? 0.5, confidence: row.agg_confidence ?? 0.5,
        impact: row.agg_impact ?? 0.5, timeHorizon: row.time_horizon || "mid",
        ring: meta.ring || "assess", quadrant: meta.quadrant ?? 0,
        signalCount: meta.signalCount ?? 0, topSources: meta.topSources ?? [],
        velocity: meta.velocity || "stable", userOverride: false,
      };
    });
  } catch {
    const { megaTrends } = require("@/lib/mega-trends");
    return megaTrends;
  }
}

// ── JSON extraction helpers ───────────────────────────────────────────────────

/**
 * Attempt to repair truncated JSON by closing all open structures.
 * Handles common truncation patterns from LLM streaming.
 */
function tryRepairJSON(text: string): any | null {
  // Strategy: try progressively shorter substrings until JSON.parse succeeds
  // after closing open structures. This handles mid-value truncation.

  let depth = 0;
  let inString = false;
  let escape = false;
  const closers: string[] = [];

  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { depth++; closers.push("}"); }
    else if (ch === "[") { depth++; closers.push("]"); }
    else if (ch === "}" || ch === "]") { depth--; if (closers.length) closers.pop(); }
  }

  if (depth <= 0) return null;

  // Attempt 1: close at current position
  let repaired = text.trimEnd();
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, "");
  const suffix = closers.reverse().join("");
  try { return JSON.parse(repaired + suffix); } catch {}

  // Attempt 2: backtrack to last complete key-value pair
  // Find last complete string value (ends with ")
  // Then truncate there and close
  for (let i = repaired.length - 1; i > repaired.length - 500 && i > 0; i--) {
    if (repaired[i] === '"' && repaired[i - 1] !== '\\') {
      const candidate = repaired.slice(0, i + 1);
      // Re-count depth from scratch for this substring
      let d = 0; let inS = false; let esc = false;
      const cl: string[] = [];
      for (const ch of candidate) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inS = !inS; continue; }
        if (inS) continue;
        if (ch === "{") { d++; cl.push("}"); }
        else if (ch === "[") { d++; cl.push("]"); }
        else if (ch === "}" || ch === "]") { d--; if (cl.length) cl.pop(); }
      }
      if (d > 0) {
        let fixed = candidate.replace(/,\s*$/, "");
        fixed += cl.reverse().join("");
        try { return JSON.parse(fixed); } catch { continue; }
      }
    }
  }

  return null;
}

/**
 * Required fields in a valid briefing result.
 * API-03: Used to validate repaired JSON has the minimum structure.
 */
const REQUIRED_RESULT_FIELDS = ["synthesis"] as const;

/**
 * Extract and parse a JSON object from LLM output.
 * Handles markdown code fences, leading text, and truncated output.
 * API-03: Returns { data, repaired } so callers can flag repaired results.
 */
function extractJSON(text: string): { data: any; repaired: boolean } | null {
  // Strip markdown fences (closed or open/truncated)
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Find the first '{' — everything before is garbage
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  cleaned = cleaned.slice(start);

  // 1. Direct parse (happy path — complete JSON)
  try { return { data: JSON.parse(cleaned), repaired: false }; } catch {}

  // 2. Find last '}' and try substring (handles trailing text after JSON)
  const end = cleaned.lastIndexOf("}");
  if (end > 0) {
    try { return { data: JSON.parse(cleaned.slice(0, end + 1)), repaired: false }; } catch {}
  }

  // 3. Repair truncated JSON (streaming cut off mid-response)
  const repaired = tryRepairJSON(cleaned);
  if (!repaired) return null;

  // API-03: Validate that repaired JSON has required structure
  for (const field of REQUIRED_RESULT_FIELDS) {
    if (!(field in repaired)) {
      console.warn(`[query] Repaired JSON missing required field: ${field}`);
      return null;
    }
  }

  return { data: repaired, repaired: true };
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory sliding window: 20 requests per IP per hour.
// Resets on server restart; good enough to prevent casual abuse.

const _rl = new Map<string, { count: number; windowStart: number }>();
const RL_MAX = 100;
const RL_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // M4-FIX: Prune expired entries every 50 calls to prevent unbounded map growth
  if (_rl.size > 50) {
    for (const [key, entry] of _rl) {
      if (now - entry.windowStart > RL_WINDOW_MS) _rl.delete(key);
    }
  }
  const entry = _rl.get(ip);
  if (!entry || now - entry.windowStart > RL_WINDOW_MS) {
    _rl.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RL_MAX) return false;
  entry.count++;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Authentication (defense-in-depth) ──────────────────────────────────
  // SECURITY: Middleware already validates auth, but route-level check
  // protects against middleware bypass (misconfigured matcher, etc.)
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  // Rate limit by IP
  const forwarded = (req as any).headers?.get?.("x-forwarded-for") ?? "";
  const ip = (forwarded ? forwarded.split(",")[0] : "unknown").trim();
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const body = await req.json();
  const { query: rawQuery, locale, contextProfile, previousContext, mode } = body;
  // previousContext: { query: string, synthesis: string } — from the preceding briefing
  // mode: "quick" (default) | "deep" — deep runs the meta-pipeline (contradiction
  //       detection + assumption extraction) as a second pass against Haiku.
  //       Adds ~3-6s to the response but surfaces hallucinations and implicit
  //       assumptions the user can challenge.
  const queryMode: "quick" | "deep" = mode === "deep" ? "deep" : "quick";

  // ── Input validation ───────────────────────────────────────────────────
  if (!rawQuery || typeof rawQuery !== "string") {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  // SECURITY: Enforce maximum input length to prevent abuse
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` },
      { status: 422 }
    );
  }

  // SECURITY: Sanitize input to mitigate prompt injection
  const query = sanitizeQuery(rawQuery);
  if (!query) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    // SECURITY: Do not disclose which specific configuration is missing
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }

  const { buildSystemPrompt } = await import("@/lib/llm");
  const {
    getRelevantSignals,
    formatSignalsForPrompt,
    getSignalAge,
    extractQueryKeywords,
    computeKeywordStats,
    classifySource,
  } = await import("@/lib/signals");
  const { buildContextProfilePrefix } = await import("@/lib/context-profiles");

  const trends = loadTrendsFromDB();

  // Auto-refresh signals if stale — fire-and-forget
  const age = getSignalAge();
  if (age.count === 0 || age.newestHours > 6) {
    const base = process.env.NEXTAUTH_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      ?? "http://localhost:3001";
    fetch(`${base}/api/v1/pipeline`, { method: "POST" }).catch(() => {});
  }

  // SEC-09: Validate locale — only "de" and "en" are accepted
  const validLocale = locale === "en" ? "en" : "de";

  emitActivity({ type: "query", phase: "start", message: `Abfrage: "${query.slice(0, 80)}${query.length > 80 ? "…" : ""}"`, meta: { queryLength: query.length, locale: validLocale } });

  let relevantSignals = getRelevantSignals(query, 16);
  const preFilterCount = relevantSignals.length;

  // 2026-04-23 Iteration-Loop Pass 2a: LLM-based semantic relevance
  // filtering BEFORE synthesis. The mechanical multi-evidence-gate in
  // `getRelevantSignals` admits signals that pass keyword heuristics but
  // may be off-topic (e.g. a heat-pump article admitted to a Rundfunk
  // query because both contain "Deutschland"). This pass asks Haiku to
  // rate each candidate 0-10 against the actual question and drops
  // anything ≤4. The synthesis Sonnet then only sees signals that an
  // LLM has confirmed are topically relevant.
  //
  // Failure-safe: if Haiku returns null (no API key, HTTP error, malformed
  // JSON) the original mechanical-only set is used. No regression.
  //
  // See `src/lib/signal-relevance-llm.ts` for the full design rationale.
  const { batchScoreSignalRelevance, applyRelevanceFilter, MIN_RELEVANCE_SCORE } =
    await import("@/lib/signal-relevance-llm");
  const relevanceResult = await batchScoreSignalRelevance(query, relevantSignals);
  if (relevanceResult) {
    relevantSignals = applyRelevanceFilter(relevantSignals, relevanceResult.judgments);
    console.log(
      `[query:relevance-pass-1] ` +
      `in=${relevanceResult.stats.inputCount} ` +
      `out=${relevantSignals.length} ` +
      `dropped=${preFilterCount - relevantSignals.length} ` +
      `mean=${relevanceResult.stats.meanScore} ` +
      `coverage=${relevanceResult.fullCoverage} ` +
      `model=${relevanceResult.modelUsed} ` +
      `duration_ms=${relevanceResult.callDurationMs} ` +
      `tokens_in=${relevanceResult.inputTokens} ` +
      `tokens_out=${relevanceResult.outputTokens}`,
    );
  } else {
    console.warn(
      `[query:relevance-pass-1] skipped — LLM unavailable or failed; ` +
      `using mechanical-only set (${relevantSignals.length} signals)`,
    );
  }

  const liveSignalsContext = formatSignalsForPrompt(relevantSignals);
  const uniqueSources = new Set(relevantSignals.map((s: any) => s.source)).size;

  emitActivity({
    type: "query",
    phase: "signals",
    message: relevanceResult
      ? `${relevantSignals.length} Signale aus ${uniqueSources} Quellen (LLM-relevanz-gefiltert: ${preFilterCount}→${relevantSignals.length}, Mittel-Score ${relevanceResult.stats.meanScore})`
      : `${relevantSignals.length} Signale aus ${uniqueSources} Quellen geladen`,
    meta: {
      signals: relevantSignals.length,
      sources: uniqueSources,
      llmFiltered: relevanceResult ? true : false,
      llmFilterDropped: relevanceResult ? preFilterCount - relevantSignals.length : 0,
      llmMeanScore: relevanceResult?.stats.meanScore,
      llmMinThreshold: MIN_RELEVANCE_SCORE,
    },
  });

  // 2026-04-23 Iteration-Loop Pass 3: Coverage-Critique on the
  // Pass-2-filtered signal set. Asks Haiku to evaluate the SET
  // COLLECTIVELY (Pass 2 evaluated each signal individually) — what
  // aspects of the query have no signal support? what's overrepresented?
  // what's the appropriate confidence ceiling for the synthesis?
  //
  // The output is injected as a structured <coverage_analysis> block
  // into the synthesis system prompt, forcing Sonnet to honor the
  // ceiling and explicitly flag gaps with [LLM-KNOWLEDGE] tags.
  //
  // Failure-safe: if Haiku returns null (no API key, HTTP error,
  // malformed JSON), the coverage block is empty and synthesis runs
  // normally without explicit coverage awareness — pre-Pass-3 baseline.
  // No regression possible from a Pass-3 failure.
  //
  // See `src/lib/signal-coverage-critique.ts` for the full design.
  const { analyzeCoverage, formatCoverageBlock } =
    await import("@/lib/signal-coverage-critique");
  const coverageReport = await analyzeCoverage(query, relevantSignals);
  if (coverageReport) {
    console.log(
      `[query:coverage-critique] ` +
      `signals=${relevantSignals.length} ` +
      `gaps=${coverageReport.coverageGaps.length} ` +
      `biases=${coverageReport.representationBiases.length} ` +
      `ceiling=${coverageReport.confidenceCeiling.toFixed(2)} ` +
      `model=${coverageReport.modelUsed} ` +
      `duration_ms=${coverageReport.callDurationMs} ` +
      `tokens_in=${coverageReport.inputTokens} ` +
      `tokens_out=${coverageReport.outputTokens}`,
    );
    emitActivity({
      type: "query",
      phase: "coverage",
      message: coverageReport.coverageGaps.length > 0
        ? `Coverage-Critique: ${coverageReport.coverageGaps.length} Lücken erkannt, Confidence-Ceiling ${(coverageReport.confidenceCeiling * 100).toFixed(0)}%`
        : `Coverage-Critique: keine signifikanten Lücken, Ceiling ${(coverageReport.confidenceCeiling * 100).toFixed(0)}%`,
      meta: {
        gaps: coverageReport.coverageGaps.length,
        biases: coverageReport.representationBiases.length,
        ceiling: coverageReport.confidenceCeiling,
        refinementQueries: coverageReport.refinementQueries,
      },
    });
  } else {
    console.warn(`[query:coverage-critique] skipped — LLM unavailable or failed`);
  }
  const coverageBlock = formatCoverageBlock(coverageReport, validLocale);

  // Pilot-Eval-Fix 2026-04-22 (A EN lieferte DE-Antwort):
  // `query` als 4. Argument durchreichen. Der Prompt-Builder
  // detected damit die tatsächliche Sprache der Frage und
  // überschreibt den UI-locale für den Response-Language-Hint.
  // 2026-04-23 Pass 3: optional coverage block prepended to liveSignalsContext.
  // The block is empty string when coverage is fine OR when Pass 3 failed —
  // either way, no prompt change in those cases.
  const enrichedSignalsContext = coverageBlock
    ? `${coverageBlock}\n\n${liveSignalsContext || ""}`.trim()
    : liveSignalsContext;
  let systemPrompt = buildSystemPrompt(trends, validLocale, enrichedSignalsContext || undefined, query);

  // SEC-08: Sanitize contextProfile fields — prevent prompt injection via role/industry/region
  const sanitizeField = (v: unknown): string => {
    if (typeof v !== "string") return "";
    return v.slice(0, 100).replace(/[\n\r]/g, " ").replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\b(system|assistant|human)\s*:/gi, "").trim();
  };

  let userMessage = query;
  if (contextProfile) {
    const role = sanitizeField(contextProfile.role);
    const industry = sanitizeField(contextProfile.industry);
    const region = sanitizeField(contextProfile.region);
    const orgSize = sanitizeField((contextProfile as { orgSize?: unknown }).orgSize);
    // Notion v0.2 Section 7: prepend the full context profile prefix to the
    // system prompt so language, recommendations, and regulatory focus are
    // calibrated from the very first token. The short [Kontext: …] tag on
    // the user message stays as a reinforcement — the model sees the
    // profile twice, which strengthens the recalibration without costing
    // much token budget.
    if (role || industry || region) {
      const profilePrefix = buildContextProfilePrefix({
        role: role || undefined,
        industry: industry || undefined,
        region: region || undefined,
        orgSize: orgSize || undefined,
        trendWeights: (contextProfile as { trendWeights?: Record<string, number> }).trendWeights,
      } as any);
      systemPrompt = `${profilePrefix}\n\n${systemPrompt}`;
      userMessage += `\n\n[Kontext: ${role} / ${industry} / ${region}]`;
    }
  }

  const encoder = new TextEncoder();

  // API-10: Keepalive + idle timeout state (shared between stream & cleanup)
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  let idleTimeout: ReturnType<typeof setTimeout> | null = null;
  const KEEPALIVE_MS = 15_000; // ping every 15s
  const IDLE_TIMEOUT_MS = 60_000; // close after 60s of inactivity

  // Track whether the controller has been closed so send/enqueue paths
  // can bail out cleanly instead of throwing ERR_INVALID_STATE. The
  // idle timeout, the client-disconnect cancel callback, and the
  // final controller.close() at end-of-stream all set this.
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Dev-server buffer flush (mirrors /api/v1/monitor/stream and
      // /api/v1/canvas/[id]/summary). Without this, the first small
      // status event can stall until more data accumulates — visible
      // to the user as "nothing happens" for several seconds after
      // submitting a query on Home.
      try {
        controller.enqueue(encoder.encode(":" + " ".repeat(2048) + "\n\n"));
      } catch { /* stream already closed */ }

      /** Reset the idle timeout — called on every data write. */
      const resetIdleTimeout = () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
          console.warn("[query] SSE idle timeout — closing stream after 60s of inactivity");
          cleanup();
          if (!closed) {
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
          }
        }, IDLE_TIMEOUT_MS);
      };

      /** Tear down keepalive + idle timers. */
      const cleanup = () => {
        if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
        if (idleTimeout) { clearTimeout(idleTimeout); idleTimeout = null; }
      };

      // Start the 15s keepalive ping
      keepaliveInterval = setInterval(() => {
        if (closed) { cleanup(); return; }
        try {
          controller.enqueue(encoder.encode(":ping\n\n"));
        } catch {
          // Stream already closed — clean up
          closed = true;
          cleanup();
        }
      }, KEEPALIVE_MS);

      // Start the initial idle timeout
      resetIdleTimeout();

      // Resilient send: previously every enqueue could throw
      // ERR_INVALID_STATE if the client disconnected or the idle
      // timeout fired mid-post-processing. That threw up into the
      // outer try/catch which then attempted ANOTHER send (to deliver
      // an "error" event), throwing again and burying the real error.
      // Symptom: briefing never reached the client, syncToCanvasDb
      // never ran, project stayed empty.
      // Now: guard every send behind the `closed` flag and swallow
      // late enqueue errors. Post-processing runs to completion
      // regardless of the wire state.
      const send = (obj: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          resetIdleTimeout(); // data was sent — reset idle clock
        } catch {
          // Controller was closed between the guard and the enqueue
          // (e.g. client tab closed). Treat as permanent close.
          closed = true;
          cleanup();
        }
      };

      try {
        // SEC-10: Sanitize previousContext to prevent prompt injection.
        // The client can pass arbitrary text as previousContext.synthesis,
        // which gets injected as an assistant message — a potent injection vector.
        let messages: Array<{ role: string; content: string }>;
        if (previousContext?.synthesis && typeof previousContext.synthesis === "string") {
          const prevQuery = sanitizeQuery(
            typeof previousContext.query === "string" ? previousContext.query : ""
          ) || "";
          // Truncate synthesis to prevent abuse and strip injection patterns
          const prevSynthesis = previousContext.synthesis
            .slice(0, 6000)
            .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
            .replace(/\b(system|user|assistant|human)\s*:/gi, "");
          messages = [
            { role: "user", content: prevQuery },
            { role: "assistant", content: prevSynthesis },
            { role: "user", content: userMessage },
          ];
        } else {
          messages = [{ role: "user", content: userMessage }];
        }

        emitActivity({ type: "query", phase: "llm-call", message: "Claude API-Aufruf gestartet…" });

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            // 2026-04-22 Pilot-Eval: 12000 → 16000 angehoben. Bei
            // strategischen Queries mit reicher synthesis-Prosa konnte
            // das alte Limit mitten im structured-JSON-Teil treffen,
            // sodass scenarios/keyInsights/references abgeschnitten
            // wurden (synthesis-only-Collapse-Pattern). 16000 gibt
            // ~30% Headroom ohne nennenswerte Kosten-Eskalation.
            max_tokens: 16000,
            system: systemPrompt,
            messages,
            stream: true,
          }),
        });

        if (!anthropicRes.ok) {
          // SECURITY: Log the full error server-side for debugging,
          // but never expose API error details (may contain API keys,
          // internal URLs, or infrastructure details) to the client.
          const errText = await anthropicRes.text();
          console.error(`[query] Anthropic API error ${anthropicRes.status}:`, errText);

          // Pilot-Eval-Fix 2026-04-22: differenziertes Mapping via
          // mapAnthropicError() — trennt credit-balance / auth / rate-
          // limit-Fehler von generic „bad request", damit der User im
          // UI die richtige Ursache sieht (vorher: alles wurde generic
          // gemappt, im Frontend kam dann „Anfrage zu kurz" für einen
          // Billing-Fehler).
          const { mapAnthropicError } = await import("@/lib/error-mapping");
          const mapped = mapAnthropicError(anthropicRes.status, errText);
          const clientError = mapped[validLocale];
          send({ type: "error", error: clientError });
          cleanup();
          if (!closed) { closed = true; try { controller.close(); } catch {} }
          return;
        }

        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let lineBuffer = "";
        // 2026-04-22 P2-Token-Audit: capture stop_reason + usage from the
        // SSE stream so we can log per-request token telemetry. Without
        // this we have no way to know whether max_tokens=16000 is being
        // hit (truncation) or whether the LLM stops naturally far below it
        // (headroom waste). Anthropic streams these in `message_start`
        // (input usage) and `message_delta` (output usage + stop_reason).
        const callStartedAt = Date.now();
        let stopReason: string | null = null;
        let inputTokens: number | null = null;
        let outputTokens: number | null = null;

        const processAnthropicLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") return;
          try {
            const event = JSON.parse(jsonStr);
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta" &&
              event.delta.text
            ) {
              fullText += event.delta.text;
              send({ type: "delta", text: event.delta.text });
            } else if (event.type === "message_start" && event.message?.usage?.input_tokens) {
              inputTokens = event.message.usage.input_tokens;
            } else if (event.type === "message_delta") {
              if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
              if (event.usage?.output_tokens) outputTokens = event.usage.output_tokens;
            }
          } catch {
            // ignore malformed SSE lines
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) processAnthropicLine(line);
        }

        // Process any remaining buffered content (last line without trailing \n)
        if (lineBuffer.trim()) processAnthropicLine(lineBuffer.trim());

        const callDurationMs = Date.now() - callStartedAt;
        // Single-line audit log: greppable, parsable, never PII.
        // stop_reason values to watch: "end_turn" (good — natural stop),
        // "max_tokens" (BAD — output truncated, raise the cap), "stop_sequence"
        // (rare — stop string fired). Token counts let us see whether 16000
        // ceiling is wasteful headroom vs. tight fit for typical responses.
        console.log(
          `[query:llm-1] stop_reason=${stopReason} input_tokens=${inputTokens} output_tokens=${outputTokens} duration_ms=${callDurationMs}`,
        );

        // Parse complete JSON and send structured result
        // API-03: extractJSON now returns { data, repaired } to flag repaired results.
        const extracted = extractJSON(fullText);
        let result = extracted?.data ?? null;
        const wasRepaired = extracted?.repaired ?? false;

        // ── Synthesis-only-Collapse: Post-Validator + Retry (2026-04-22) ──
        // Pilot-Eval zeigte: Claude Sonnet 4.5 folgt dem Zero-Signal-
        // Fallback-Guard nicht deterministisch. Wenn wir erkennen, dass
        // die Response reich an synthesis-Prosa, aber leer in den
        // strukturierten Feldern ist, triggern wir genau EINEN Retry mit
        // einer verstärkten User-Message, die das Problem explizit
        // benennt. Bei Erfolg: wir nutzen das Retry-Ergebnis. Bei
        // Misserfolg: wir behalten das erste Ergebnis (kein Endlos-Loop).
        if (result) {
          const { detectSynthesisOnlyCollapse, buildCollapseRetryMessage } =
            await import("@/lib/collapse-detection");
          const detection = detectSynthesisOnlyCollapse(result);
          if (detection.collapsed) {
            console.warn(
              `[query] synthesis-only-Collapse detected — missing: ${detection.missingFields.join(", ")}. Triggering retry…`,
            );
            emitActivity({
              type: "query",
              phase: "retry",
              message: "Strukturelle Felder leer — automatischer Retry mit Verstärkung…",
            });

            const assistantResponse = fullText
              .replace(/^```json\s*/i, "")
              .replace(/```\s*$/, "")
              .trim();
            const retryMessage = buildCollapseRetryMessage(
              detection.missingFields,
              validLocale,
            );
            const retryMessages = [
              ...messages,
              { role: "assistant", content: assistantResponse },
              { role: "user", content: retryMessage },
            ];

            try {
              // 2026-04-22 P2-Token-Audit: retry max_tokens 16000 → 8000.
              // The retry only needs to fill structured fields (scenarios,
              // keyInsights, references, decisionFramework, causalChain) —
              // the original synthesis prose is kept via the merge below.
              // Typical structured-field JSON is ~2-4k tokens; 8000 leaves
              // 2× headroom but cuts retry latency from up to ~200s to
              // ~100s if the model uses the budget.
              const retryStartedAt = Date.now();
              const retryRes = await fetch(
                "https://api.anthropic.com/v1/messages",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-sonnet-4-6",
                    max_tokens: 8000,
                    system: systemPrompt,
                    messages: retryMessages,
                    stream: false,
                  }),
                },
              );
              if (retryRes.ok) {
                const retryJson = (await retryRes.json()) as {
                  content?: Array<{ type: string; text?: string }>;
                  stop_reason?: string;
                  usage?: { input_tokens?: number; output_tokens?: number };
                };
                // P2-Token-Audit: log retry telemetry alongside first-call.
                console.log(
                  `[query:llm-2-retry] stop_reason=${retryJson.stop_reason ?? null} input_tokens=${retryJson.usage?.input_tokens ?? null} output_tokens=${retryJson.usage?.output_tokens ?? null} duration_ms=${Date.now() - retryStartedAt}`,
                );
                const retryText =
                  retryJson.content
                    ?.filter((b) => b.type === "text" && b.text)
                    .map((b) => b.text!)
                    .join("") ?? "";
                const retryExtracted = extractJSON(retryText);
                if (retryExtracted?.data) {
                  // Merge-Strategie: synthesis aus dem ersten Call
                  // behalten (der War gut), alles andere aus dem Retry
                  // übernehmen. So bleibt der narrative Faden stabil,
                  // aber die strukturierten Felder sind gefüllt.
                  const firstSynthesis =
                    typeof (result as { synthesis?: unknown }).synthesis === "string"
                      ? (result as { synthesis: string }).synthesis
                      : "";
                  const retrySynthesis =
                    typeof (retryExtracted.data as { synthesis?: unknown }).synthesis === "string"
                      ? (retryExtracted.data as { synthesis: string }).synthesis
                      : "";
                  result = {
                    ...retryExtracted.data,
                    synthesis:
                      firstSynthesis.length > retrySynthesis.length
                        ? firstSynthesis
                        : retrySynthesis,
                  };
                  console.log(
                    "[query] retry succeeded — structured fields now populated",
                  );
                  emitActivity({
                    type: "query",
                    phase: "retry-done",
                    message: "Retry erfolgreich — strukturierte Felder gefüllt",
                  });
                } else {
                  console.warn(
                    "[query] retry returned unparseable JSON — keeping original",
                  );
                }
              } else {
                const errText = await retryRes.text();
                console.warn(
                  `[query] retry HTTP ${retryRes.status}: ${errText.slice(0, 200)}`,
                );
              }
            } catch (retryErr) {
              console.warn(
                "[query] retry fetch failed — keeping original result:",
                retryErr,
              );
            }
          }
        }

        if (!result) {
          // Fallback: the LLM responded with prose instead of JSON.
          // Use the full streamed text as synthesis so the user sees something.
          const rawText = fullText
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/, "")
            .trim();

          result = {
            synthesis: rawText.length > 30 ? rawText.slice(0, 6000) : "Analyse konnte nicht strukturiert werden. Bitte erneut versuchen.",
            keyInsights: [],
            scenarios: [],
            causalChain: [],
            regulatoryContext: [],
            reasoningChains: [],
            followUpQuestions: [],
            confidence: rawText.length > 200 ? 0.4 : 0.1,
            matchedTrendIds: [],
          };
        }

        try {
          // ── VAL-01: Validate & normalize LLM output via Zod schema ─────
          const { validateLLMResponse, computeBlendedConfidence } = await import("@/lib/validation");
          const validTrendIds = new Set(trends.map((t: TrendDot) => t.id));
          const { data: validated, warnings } = validateLLMResponse(result, validTrendIds);

          // Log validation warnings server-side for monitoring
          if (warnings.length > 0) {
            console.warn("[query] LLM output validation warnings:", warnings);
          }

          // ── Defensive salvage: when ALL LLM-returned trendIds were dropped
          // as hallucinated AND the original output looks slug-like, try to
          // recover by fuzzy name-matching. This catches the "LLM copied the
          // slug example from the prompt" failure mode where e.g. it emitted
          // "mega-ai-transformation" instead of the DB UUID. The prompt fix
          // prevents this going forward, but this salvage gives us a safety
          // net for cached prompts / edge cases.
          const rawIds: unknown = (result as any)?.matchedTrendIds;
          if (
            validated.matchedTrendIds.length === 0 &&
            Array.isArray(rawIds) &&
            rawIds.length > 0
          ) {
            const originalIds = (rawIds as unknown[]).filter((x): x is string => typeof x === "string");
            const slugify = (s: string) =>
              s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            const trendIndex = trends.map((t: TrendDot) => ({
              id: t.id,
              words: new Set(slugify(t.name).split("-").filter(Boolean)),
            }));
            const salvaged: string[] = [];
            for (const origId of originalIds) {
              const stripped = origId.toLowerCase().replace(/^(mega-|macro-|micro-|trend-)/, "");
              const origWords = new Set(stripped.split("-").filter((w) => w && w.length >= 3));
              if (origWords.size === 0) continue;
              let best: { id: string; score: number; overlap: number } | null = null;
              for (const ti of trendIndex) {
                const overlap = [...origWords].filter((w) => ti.words.has(w)).length;
                if (overlap < 2) continue; // require at least two shared meaningful words
                const union = new Set([...origWords, ...ti.words]).size;
                const score = union > 0 ? overlap / union : 0;
                if (score >= 0.4 && (!best || score > best.score)) {
                  best = { id: ti.id, score, overlap };
                }
              }
              if (best && !salvaged.includes(best.id)) salvaged.push(best.id);
            }
            if (salvaged.length > 0) {
              console.warn(
                `[query] Salvaged ${salvaged.length}/${originalIds.length} trend IDs by name match: ` +
                `${originalIds.slice(0, 3).join(", ")} → ${salvaged.slice(0, 3).join(", ")}`
              );
              validated.matchedTrendIds = salvaged;
              emitActivity({
                type: "query", phase: "validation",
                message: `${salvaged.length} Trend-Zuordnungen \u00fcber Name-Matching wiederhergestellt`,
                meta: { salvaged: salvaged.length, sampleOriginal: originalIds.slice(0, 3), sampleSalvaged: salvaged.slice(0, 3) },
              });
            }
          }

          // VAL-03: Compute evidence-based blended confidence score
          const uniqueSourcesVal = new Set(relevantSignals.map((s: any) => s.source)).size;
          validated.confidence = computeBlendedConfidence(
            validated.confidence,
            validated.matchedTrendIds.length,
            relevantSignals.length,
            uniqueSourcesVal,
            validated.references.length > 0
          );

          emitActivity({
            type: "query", phase: "validation",
            message: `Validierung: ${warnings.length} Hinweise, Konfidenz ${(validated.confidence * 100).toFixed(0)}%`,
            meta: { warnings: warnings.length, confidence: validated.confidence, matchedTrends: validated.matchedTrendIds.length },
          });

          // Data quality warnings
          const qualityWarnings: string[] = [];
          if (relevantSignals.length === 0) {
            qualityWarnings.push("Keine thematisch relevanten Live-Signale gefunden. Analyse basiert auf Trend-Daten und LLM-Wissen.");
          }
          if (warnings.some(w => w.includes("hallucinated matchedTrendIds"))) {
            qualityWarnings.push("Einige Trend-Zuordnungen konnten nicht verifiziert werden.");
          }
          if (warnings.some(w => w.includes("probability"))) {
            qualityWarnings.push("Szenario-Wahrscheinlichkeiten wurden normalisiert.");
          }
          if (warnings.some(w => w.includes("Missing scenarios") || w.includes("Normalized"))) {
            qualityWarnings.push("Szenarien-Satz wurde auf exakt 3 (opt./basis/pess.) normalisiert — fehlende wurden als Platzhalter markiert.");
          }

          // Backlog-Task 1.5 (2026-04-21): Quellenangaben-Pflicht.
          //
          // Jede faktische Aussage MUSS inline getaggt sein — [SIGNAL: …],
          // [TREND: …], [REG: …], [EDGE: …] oder zumindest [LLM-KNOWLEDGE].
          // Wenn die Synthese lang ist aber keinen einzigen Provenance-Tag
          // trägt, ist das eine Regressionsform, die wir aktiv benennen statt
          // still durchgehen zu lassen. Bisher sanktionierte die Pipeline das
          // nicht — die UI zeigte nur einen kleinen Italic-Hinweis, wenn
          // references leer war. Jetzt surft das als sichtbare
          // Datenqualitäts-Warnung auf der Briefing-Karte auf.
          const synthesisText = validated.synthesis ?? "";
          const provenanceTagCount =
            (synthesisText.match(/\[\s*SIGNAL[^\]]*\]/gi) || []).length +
            (synthesisText.match(/\[\s*TREND[^\]]*\]/gi)  || []).length +
            (synthesisText.match(/\[\s*REG[^\]]*\]/gi)    || []).length +
            (synthesisText.match(/\[\s*EDGE[^\]]*\]/gi)   || []).length +
            (synthesisText.match(/\[\s*LLM[-\s]?(KNOWLEDGE|Einsch[äa]tzung|Einschaetzung|Assessment)[^\]]*\]/gi) || []).length;
          if (synthesisText.length > 300 && provenanceTagCount === 0) {
            qualityWarnings.push("Die Synthese enthält keine Quellen-Tags — Aussagen sind nicht provenance-markiert. Kritisch prüfen.");
          }
          const hasReferences = Array.isArray(validated.references) && validated.references.length > 0;
          if (!hasReferences && provenanceTagCount === 0 && synthesisText.length > 200) {
            qualityWarnings.push("Antwort ohne externe Referenzen und ohne Inline-Tags — reine LLM-Einschätzung ohne belegte Evidenz.");
          }

          // Augment: matched trend details for radar + demographics
          const matchedIds: string[] = validated.matchedTrendIds || [];
          const matchedIdSet = new Set(matchedIds);
          const relevanceMap: Record<string, number> = validated.matchedTrendRelevance ?? {};
          const matchedTrends = matchedIds
            .map((id: string) => trends.find((t: TrendDot) => t.id === id))
            .filter(Boolean)
            .map((t: any) => {
              const qr = relevanceMap[t.id];
              return {
                id: t.id, name: t.name, category: t.category,
                tags: t.tags || [],
                relevance: t.relevance, confidence: t.confidence,
                impact: t.impact, velocity: t.velocity, ring: t.ring,
                signalCount: t.signalCount || 0,
                ...(typeof qr === "number" ? { queryRelevance: qr } : {}),
              };
            });

          // Zweiter Signal-Pass — angereichert durch Matched-Trend-Namen.
          //
          // **Warum:** Die erste Signal-Suche oben (`getRelevantSignals(query)`)
          // matcht nur auf Keywords aus der Original-Frage. Bei nischigen
          // Fragen („öffentlich-rechtlicher Rundfunk qualitativ beleben")
          // liefert das oft 0 Treffer, obwohl die LLM-Analyse 9 strategisch
          // relevante Trends identifiziert hat — und zu **jedem** dieser
          // Trends existieren Signale in der DB.
          //
          // **Fix:** Nach der Trend-Identifikation ein zweites
          // `getRelevantSignals` mit den Trend-Namen als Query. Die Ergebnisse
          // werden mit dem ersten Pass dedupliziert und in `usedSignals`
          // gemergt, damit das Frontend (Orbit, Card-Stream) eine aussagekräftige
          // Signal-Basis sieht. **Keine** Auswirkung auf die LLM-Antwort selbst
          // — die ist zum Zeitpunkt des zweiten Passes schon fertig; dies ist
          // reine Output-Anreicherung.
          type EnrichedSignal = typeof relevantSignals[number];
          const enriched = new Map<string, EnrichedSignal>();
          const signalKey = (s: any) => s.url || `${s.source}|${s.title}`;
          for (const s of relevantSignals) enriched.set(signalKey(s), s);

          if (matchedTrends.length > 0) {
            try {
              // Über-Sampling, damit wir nach Dedup noch genug übrig haben.
              // 8 Signale pro Trend, Cap insgesamt auf ~32, damit der Response
              // kompakt bleibt.
              const perTrend = Math.max(2, Math.floor(24 / matchedTrends.length));
              for (const t of matchedTrends) {
                if (!t?.name) continue;
                const hits = getRelevantSignals(t.name, perTrend);
                for (const s of hits) {
                  const k = signalKey(s);
                  if (!enriched.has(k)) enriched.set(k, s);
                }
                if (enriched.size >= 32) break;
              }
            } catch (e) {
              // Nicht fatal — im Zweifel bleibt der erste Pass die Quelle.
              console.warn("[query] trend-based signal enrichment failed:", e);
            }
          }

          let mergedSignals = Array.from(enriched.values()).slice(0, 32);

          // 2026-04-23 Iteration-Loop Pass 2b: LLM-relevance filter on
          // the AUGMENTED signal set. The trend-name re-fetch (above) can
          // pull in signals that are related to a matched trend but not
          // to the original question — e.g. a Climate-Change-trend match
          // can drag in a USGS earthquake signal because earthquakes are
          // in the climate/environmental cluster. Pass 2a only filtered
          // the first-pass set; Pass 2b filters the augmented set so the
          // UI never displays trend-pulled noise either.
          //
          // Reuses any judgments from Pass 2a where the same signal was
          // already scored — but the augmented set has different IDs
          // (s1..sN over the merged set, not the first-pass set), so in
          // practice this is a fresh LLM call. Cost: ~$0.008 additional
          // per query. Worth it for UI honesty.
          //
          // Same null-safe contract as Pass 2a: failure = use unfiltered set.
          const preMergedFilterCount = mergedSignals.length;
          const mergedRelevanceResult = await batchScoreSignalRelevance(query, mergedSignals);
          if (mergedRelevanceResult) {
            mergedSignals = applyRelevanceFilter(mergedSignals, mergedRelevanceResult.judgments) as typeof mergedSignals;
            console.log(
              `[query:relevance-pass-2] ` +
              `in=${mergedRelevanceResult.stats.inputCount} ` +
              `out=${mergedSignals.length} ` +
              `dropped=${preMergedFilterCount - mergedSignals.length} ` +
              `mean=${mergedRelevanceResult.stats.meanScore} ` +
              `coverage=${mergedRelevanceResult.fullCoverage} ` +
              `duration_ms=${mergedRelevanceResult.callDurationMs} ` +
              `tokens_in=${mergedRelevanceResult.inputTokens} ` +
              `tokens_out=${mergedRelevanceResult.outputTokens}`,
            );
          } else {
            console.warn(
              `[query:relevance-pass-2] skipped — using mechanical-merged set (${mergedSignals.length} signals)`,
            );
          }

          // Join LLM-supplied per-signal relevance with the retrieved pool.
          // The LLM copied source+title verbatim from the prompt's
          // <live_signals> block (per-prompt instruction), so we can key
          // the lookup on `source|title`. Signals the LLM did not score
          // keep `queryRelevance` undefined — the UI/Orbit then fall
          // back to `keywordOverlap` as the topical-fit proxy.
          const llmRefs = Array.isArray((validated as any).usedSignalRefs)
            ? ((validated as any).usedSignalRefs as Array<{ source: string; title: string; queryRelevance: number }>)
            : [];
          const refLookup = new Map<string, number>();
          const refKey = (source: string, title: string) =>
            `${source.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
          for (const r of llmRefs) {
            if (typeof r.queryRelevance === "number" && r.source && r.title) {
              refLookup.set(refKey(r.source, r.title), r.queryRelevance);
            }
          }

          // Recompute keyword overlap against the ORIGINAL query for
          // every merged signal. The second retrieval pass (by trend
          // name) decorates signals with overlap relative to the TREND
          // name, which is misleading in the UI — the user sees the
          // number next to their original question, not the trend. By
          // recomputing here, every signal displayed to the user carries
          // a topic-fit number that is honestly relative to the question
          // they asked. Generic, applies to any query.
          const queryKeywords = extractQueryKeywords(query);
          const signalsMeta = mergedSignals.map((s: any) => {
            const signalText = [s.title, s.topic, s.content?.slice(0, 1000), s.tags]
              .filter(Boolean).join(" ");
            const stats = computeKeywordStats(queryKeywords, signalText);
            // Backlog-Task 1.6 (2026-04-21): Snippet-Feld bis in die UI durchreichen.
            // Der pipeline extrahiert content aus dem connector-rawData und
            // persistiert es in live_signals.content. Hier geben wir die ersten
            // ~220 Zeichen als snippet mit, damit die Briefing-UI Preview-Text
            // unter dem Titel anzeigen kann — das ist der sichtbare Gegenpart
            // der verbesserten Connector-Content-Extraktion.
            const rawContent = typeof s.content === "string" ? s.content.trim() : "";
            const snippet = rawContent.length > 0
              ? (rawContent.length > 220 ? rawContent.slice(0, 217) + "…" : rawContent)
              : undefined;
            return {
              source: s.source,
              title: s.title,
              url: s.url,
              strength: s.strength,
              date: s.fetched_at.slice(0, 10),
              snippet,
              keywordOverlap: stats.weightedOverlap,
              sourceTier: s.sourceTier ?? classifySource(s.source),
              queryRelevance: refLookup.get(refKey(s.source, s.title)),
              // 2026-04-23 Layered-Filter-Architecture-Fix: propagate the
              // canonical relevance score + pass-reason that the retrieval
              // layer computed. Without this, downstream UI (Orbit, Live-
              // Signale tile) would have to re-derive these from raw
              // overlap and would miss anchor-bypass signals.
              passReason: s.passReason,
              displayScore: s.displayScore,
              // 2026-04-23 Iteration-Loop Pass 2: propagate LLM-judged
              // relevance score + reason so the UI can show WHY each
              // signal was kept/dropped (transparent quality assurance).
              llmRelevanceScore: s.llmRelevanceScore,
              llmRelevanceReason: s.llmRelevanceReason,
            };
          });

          // Augment: causal edges between matched trends.
          //
          // **Historischer Bug (19.04.2026):** Der alte Code nutzte
          // `getEdgesForTrend(id)` mit `matchedIds`. Problem: die DB führt
          // Trends unter UUIDs, der kuratierte Causal-Graph in
          // `src/lib/causal-graph.ts` arbeitet aber mit Slug-IDs wie
          // `mega-ai-transformation`. Die beiden ID-Systeme matchten nie,
          // also blieb `matchedEdges` konstant leer — selbst für klassische
          // Fälle wie „AI × Future of Work" mit kuratierten Kanten.
          //
          // **Fix:** Name-basiertes Matching via
          // `getEdgesBetweenTrendNames`. Die Funktion mappt Trend-Namen
          // (in beiden Welten identisch) auf Slugs, zieht die Edges aus
          // dem Curated-Graph und gibt sie mit eingebetteten Namen zurück.
          // Wir mappen die Namen hier wieder auf die UUIDs aus
          // `matchedTrends`, damit das Frontend (das mit UUIDs arbeitet)
          // die Edges an die Trend-Karten anschließen kann.
          const { getEdgesBetweenTrendNames } = await import("@/lib/causal-graph");
          const norm = (s: string) => s.toLowerCase().trim();
          const nameToUuid = new Map<string, string>();
          for (const t of matchedTrends) {
            if (t?.name) nameToUuid.set(norm(t.name), t.id);
          }
          const edgesByName = getEdgesBetweenTrendNames(
            matchedTrends.map((t: any) => t.name).filter(Boolean),
          );
          const seen = new Set<string>();
          const matchedEdges = edgesByName
            .map((e) => {
              const fromUuid = nameToUuid.get(norm(e.fromName));
              const toUuid = nameToUuid.get(norm(e.toName));
              if (!fromUuid || !toUuid) return null;
              return {
                from: fromUuid,
                to: toUuid,
                type: e.type,
                strength: e.strength,
                description: e.description,
              };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null)
            .filter((e) => {
              const key = `${e.from}→${e.to}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

          // ═════════════════════════════════════════════════════════════
          // Notion v0.2 — Backend-verified augmentation
          //
          // What follows replaces the LLM's self-reported dataQuality
          // and confidence with values measured against real signal +
          // edge-graph coverage. Three blocks, in this order because
          // they depend on each other:
          //
          //   (A) dataQuality — computed from the signal set we just
          //       passed to the model. The LLM CANNOT lie about
          //       signalCount, newestSignalAge, or dominantSourceType;
          //       those are observed server-side.
          //
          //   (B) Calibrated confidence — the Notion v0.2 weighted
          //       formula (signalCoverage 30 / signalRecency 25 /
          //       signalStrength 20 / sourceVerification 15 /
          //       causalCoverage 10). Replaces the LLM's guess with a
          //       deterministic composite and reports the three limiting
          //       factors so users know WHY confidence dropped.
          //
          //   (C) Meta-pipeline — scenario-divergence validator always;
          //       contradiction check + assumption extraction only in
          //       mode:'deep' because they add 3-6s per second-pass.
          // ═════════════════════════════════════════════════════════════

          const { computeCalibratedConfidence, recencyFromHours } = await import("@/lib/scoring");
          const { checkScenarioDivergence } = await import("@/lib/meta-prompts");

          // (A) Backend-verified dataQuality ─────────────────────────
          const newestSignalHours = relevantSignals.length > 0
            ? Math.min(
                ...relevantSignals
                  .map((s: any) => (Date.now() - new Date(s.fetched_at).getTime()) / (1000 * 3600))
                  .filter((h) => Number.isFinite(h) && h >= 0),
              )
            : null;

          const newestSignalAge = newestSignalHours == null
            ? (validLocale === "de" ? "keine Signale" : "no signals")
            : newestSignalHours < 1 ? `${Math.round(newestSignalHours * 60)}m`
              : newestSignalHours < 48 ? `${Math.round(newestSignalHours)}h`
              : `${Math.round(newestSignalHours / 24)}d`;

          // Count provenance tags in synthesis to measure how much of the
          // answer is actually sourced vs. how much is LLM self-narration.
          const tagRegex = {
            signal: /\[SIGNAL:/gi,
            trend: /\[TREND:/gi,
            reg: /\[REG:/gi,
            edge: /\[EDGE:/gi,
            llm: /\[LLM-(KNOWLEDGE|Einsch\u00e4tzung|Einschaetzung|Assessment)\]/gi,
          };
          const tagCounts = {
            signal: (validated.synthesis.match(tagRegex.signal) || []).length,
            trend: (validated.synthesis.match(tagRegex.trend) || []).length,
            reg: (validated.synthesis.match(tagRegex.reg) || []).length,
            edge: (validated.synthesis.match(tagRegex.edge) || []).length,
            llm: (validated.synthesis.match(tagRegex.llm) || []).length,
          };
          const verifiableTags = tagCounts.signal + tagCounts.trend + tagCounts.reg + tagCounts.edge;
          const totalTags = verifiableTags + tagCounts.llm;
          const sourceVerification = totalTags === 0
            ? 0.3  // LLM ignored tagging — treat as mostly unverified
            : verifiableTags / totalTags;

          const dominantSourceType: "signals" | "trends" | "llm-knowledge" | "mixed" =
            tagCounts.signal >= Math.max(tagCounts.trend, tagCounts.reg, tagCounts.llm) && tagCounts.signal > 0
              ? "signals"
              : tagCounts.trend >= Math.max(tagCounts.reg, tagCounts.llm) && tagCounts.trend > 0
                ? "trends"
                : tagCounts.llm > verifiableTags
                  ? "llm-knowledge"
                  : "mixed";

          // (B) Calibrated confidence ─────────────────────────────────
          // Load the number of active connectors so signalCoverage is not
          // hardcoded. Falls back to 10 on connector-loading failure.
          let activeConnectorCount = 10;
          try {
            const { connectors } = await import("@/connectors/index");
            activeConnectorCount = Array.isArray(connectors) && connectors.length > 0 ? connectors.length : 10;
          } catch {/* keep 10 */}

          const signalCoverage = Math.min(1, uniqueSourcesVal / activeConnectorCount);
          const signalRecency = recencyFromHours(newestSignalHours ?? undefined);
          const signalStrength = relevantSignals.length > 0
            ? relevantSignals.reduce((acc: number, s: any) => acc + (typeof s.strength === "number" ? s.strength : 0.5), 0) / relevantSignals.length
            : 0;
          // causalCoverage: how much of the theoretically possible
          // "pairs of matched trends" is covered by explicit edges?
          // With N matched trends, there are N*(N-1)/2 possible pairs.
          // If the edge graph covers most of them the analysis is more
          // likely grounded in known causal structure, not ad-hoc.
          const possiblePairs = Math.max(1, (matchedTrends.length * (matchedTrends.length - 1)) / 2);
          const causalCoverage = Math.min(1, matchedEdges.length / possiblePairs);

          // Critical-Fix-Plan P3-1: Anteil Referenzen auf autoritativen
          // Domains (KNOWN_DOMAINS-Allowlist in validation.ts). Der
          // Validator hat das `verified`-Flag bereits gesetzt (P1-2).
          // Ohne Referenzen: neutral-Wert 0.5 — weder Bonus noch Abzug.
          const refs = validated.references || [];
          const refsWithUrl = refs.filter((r) => r.url && r.url.length > 0);
          const verifiedRefs = refsWithUrl.filter((r) => (r as any).verified === true);
          const refVerification = refsWithUrl.length > 0
            ? verifiedRefs.length / refsWithUrl.length
            : 0.5;

          const calibrated = computeCalibratedConfidence({
            signalCoverage,
            signalRecency,
            signalStrength,
            sourceVerification,
            causalCoverage,
            refVerification,
          });

          // Overwrite the LLM's self-assessed confidence with the
          // calibrated score. The old computeBlendedConfidence path above
          // already wrote a value — we intentionally overwrite because
          // the calibrated formula is the one described in Notion v0.2
          // and in the system prompt itself, so the UI's "Konfidenz X%"
          // badge must match what the prompt told the model to compute.
          validated.confidence = calibrated.score / 100;

          // Translate the three limiting factors into user-visible gap
          // descriptions. These replace whatever the LLM put in
          // `dataQuality.coverageGaps` — we want the server's view, not
          // the model's guess.
          const GAP_LABELS: Record<string, { de: string; en: string }> = {
            signalCoverage: {
              de: "Signal-Abdeckung dünn (wenige Connectors lieferten Treffer)",
              en: "Thin signal coverage (few connectors matched this query)",
            },
            signalRecency: {
              de: "Signale sind älter als 24h",
              en: "Signals older than 24h",
            },
            signalStrength: {
              de: "Durchschnittliche Signal-Stärke niedrig",
              en: "Low average signal strength",
            },
            sourceVerification: {
              de: "Wenige Behauptungen mit verifizierbarem Quellen-Tag",
              en: "Few claims carry verifiable source tags",
            },
            causalCoverage: {
              de: "Kausal-Graph deckt die Trend-Konstellation dünn ab",
              en: "Causal graph sparsely covers the trend pairs",
            },
            refVerification: {
              de: "Referenzen stammen mehrheitlich von nicht-verifizierten Domains",
              en: "References are mostly from unverified domains",
            },
          };
          const backendCoverageGaps = calibrated.limitingFactors
            .filter((f) => f.missing > 0.05)
            .map((f) => (GAP_LABELS[f.factor]?.[validLocale as "de" | "en"]) || f.factor);

          const backendDataQuality = {
            signalCount: relevantSignals.length,
            newestSignalAge,
            coverageGaps: backendCoverageGaps,
            dominantSourceType,
          };

          // (C) Meta-pipeline ─────────────────────────────────────────
          const scenarioDivergence = checkScenarioDivergence(
            (validated.scenarios || []).map((s: any) => ({
              type: s.type,
              title: s.title || s.name,
              name: s.name,
              description: s.description,
              probability: s.probability,
              horizon: s.horizon,
              keyAssumptions: s.keyAssumptions,
              earlyIndicators: s.earlyIndicators,
              keyDrivers: s.keyDrivers,
            })),
          );

          // Critical-Fix-Plan P0-2: Bei major_issues-Verdict (z.B.
          // Default-Template-Match 20/55/25) die Konfidenz deutlich
          // drücken. Der LLM hat sich auf ein Schema-Placeholder
          // zurückgezogen statt die Datenlage zu reflektieren — das
          // soll im User-sichtbaren Confidence-Score kosten.
          //
          // Im Gegensatz zum Reject-Retry-Pfad aus dem Notion-Plan
          // vermeidet das einen zweiten LLM-Call: der User sieht das
          // Briefing sofort, bekommt aber einen kalibrierten Vertrauens-
          // Abschlag + die Diagnose-Findings in `_scenarioDivergence`.
          if (scenarioDivergence.verdict === "has_major_issues") {
            validated.confidence = Math.max(0.05, validated.confidence - 0.15);
          } else if (scenarioDivergence.verdict === "has_minor_issues") {
            validated.confidence = Math.max(0.05, validated.confidence - 0.05);
          }

          // Optional deep-mode: Haiku-second-pass for contradictions +
          // a Sonnet call for assumption extraction. Run in parallel to
          // minimise latency. Errors are swallowed — the base briefing
          // always comes back even if the meta-calls fail.
          let contradictionReport: any = null;
          let assumptionReport: any = null;
          if (queryMode === "deep") {
            emitActivity({ type: "query", phase: "meta", message: "Deep-Mode: Widerspruchs-Check + Annahmen-Extraktion laufen…" });
            // NB: runX lebt in der Server-only `meta-prompts-runtime` —
            // siehe Kommentar in `meta-prompts.ts`. Die Registry-Client-
            // Seite würde sonst Node's `fs` aus env.ts ins Bundle ziehen.
            const { runContradictionCheck, runAssumptionExtraction } = await import("@/lib/meta-prompts-runtime");
            const trendsMatchedText = matchedTrends.map((t: any) => `${t.name} (${t.id})`).join(", ") || "(none)";
            const synthesisSnapshot = JSON.stringify({
              synthesis: validated.synthesis,
              keyInsights: validated.keyInsights,
              scenarios: validated.scenarios,
              causalAnalysis: validated.causalAnalysis,
              confidence: validated.confidence,
            });
            const worldModelHint = matchedTrends
              .map((t: any) => `- ${t.name} [${t.category}] rel=${(t.relevance * 100).toFixed(0)}%`)
              .join("\n");
            const [cr, ar] = await Promise.all([
              runContradictionCheck({
                query,
                signalsUsed: liveSignalsContext || "(none)",
                trendsMatched: trendsMatchedText,
                synthesisOutput: synthesisSnapshot,
                locale: validLocale,
              }).catch((e) => { console.warn("[query] contradiction check failed:", e); return null; }),
              runAssumptionExtraction({
                synthesis: validated.synthesis,
                worldModelContext: worldModelHint,
                locale: validLocale,
              }).catch((e) => { console.warn("[query] assumption extraction failed:", e); return null; }),
            ]);
            contradictionReport = cr;
            assumptionReport = ar;

            // Apply confidence penalty when contradictions flagged.
            if (cr && typeof cr.confidenceAdjustment === "number" && cr.confidenceAdjustment > 0) {
              const penalty = Math.min(cr.confidenceAdjustment, 40) / 100;
              validated.confidence = Math.max(0.05, validated.confidence - penalty);
            }
          }

          // 2026-04-23 Iteration-Loop Pass 3 — Confidence-Clamp:
          // Sonnet CAN ignore the injected <coverage_analysis> ceiling
          // instruction and still claim higher confidence than the
          // Pass-3 evidence justifies. Hard-clamp here enforces the
          // ceiling as an upper bound. Conservative LLM confidence
          // (below ceiling) is untouched; only over-confidence gets
          // capped. See `clampConfidenceToCeiling` in
          // src/lib/signal-coverage-critique.ts for the pure-function
          // logic + tests.
          let coverageCeilingClamp: { original: number; ceiling: number } | null = null;
          if (coverageReport) {
            const { clampConfidenceToCeiling } =
              await import("@/lib/signal-coverage-critique");
            const clampResult = clampConfidenceToCeiling(
              validated.confidence,
              coverageReport.confidenceCeiling,
            );
            if (clampResult.clamped) {
              console.warn(
                `[query:coverage-clamp] LLM confidence ${(clampResult.clamped.original * 100).toFixed(0)}% > ceiling ${(clampResult.clamped.ceiling * 100).toFixed(0)}%, clamping`,
              );
              validated.confidence = clampResult.confidence;
              coverageCeilingClamp = clampResult.clamped;
              emitActivity({
                type: "query",
                phase: "coverage-clamp",
                message: `Confidence-Clamp: ${(coverageCeilingClamp.original * 100).toFixed(0)}% → ${(coverageCeilingClamp.ceiling * 100).toFixed(0)}% (Coverage-Ceiling)`,
                meta: {
                  original: coverageCeilingClamp.original,
                  ceiling: coverageCeilingClamp.ceiling,
                  clamped: clampResult.confidence,
                },
              });
            }
          }

          // API-03 + VAL-01 + v0.2: Final result with full meta metadata
          const finalResult = {
            ...validated,
            // v0.2: backend-verified dataQuality overrides whatever the LLM guessed
            dataQuality: backendDataQuality,
            usedSignals: signalsMeta,
            matchedTrends,
            matchedEdges,
            _confidenceCalibration: {
              score: calibrated.score,
              band: calibrated.band,
              limitingFactors: calibrated.limitingFactors,
              inputs: { signalCoverage, signalRecency, signalStrength, sourceVerification, causalCoverage },
            },
            _scenarioDivergence: scenarioDivergence,
            _mode: queryMode,
            ...(contradictionReport ? { _contradictionReport: contradictionReport } : {}),
            ...(assumptionReport ? { _assumptionReport: assumptionReport } : {}),
            ...(wasRepaired ? { _repaired: true } : {}),
            ...(qualityWarnings.length > 0 ? { _dataQualityWarnings: qualityWarnings } : {}),
            ...(warnings.length > 0 ? { _validationWarnings: warnings } : {}),
            // 2026-04-23 Pass 3: surface coverage report + clamp metadata
            // in the response payload so future UI work can render a
            // "Coverage-Health" indicator. The report is non-PII (just
            // gaps + biases + ceiling) and useful for stakeholder
            // transparency about how the system arrived at its confidence.
            ...(coverageReport ? { _coverageReport: {
              coverageGaps: coverageReport.coverageGaps,
              representationBiases: coverageReport.representationBiases,
              confidenceCeiling: coverageReport.confidenceCeiling,
              refinementQueries: coverageReport.refinementQueries,
              synthesis: coverageReport.synthesis,
            } } : {}),
            ...(coverageCeilingClamp ? { _coverageCeilingClamp: coverageCeilingClamp } : {}),
          };
          send({ type: "complete", result: finalResult });
          emitActivity({
            type: "query", phase: "complete",
            message: `Abfrage abgeschlossen — ${calibrated.score}% Konfidenz (${calibrated.band}), ${matchedTrends.length} Trends${queryMode === "deep" ? ", Deep-Mode" : ""}`,
            meta: { confidence: validated.confidence, band: calibrated.band, trends: matchedTrends.length, signals: relevantSignals.length, repaired: wasRepaired, mode: queryMode },
          });
        } catch (parseErr) {
          console.error("[query] Post-processing error:", parseErr);
          emitActivity({ type: "query", phase: "error", message: "Post-Processing fehlgeschlagen" });
          send({ type: "error", error: "Ergebnis konnte nicht verarbeitet werden. Bitte erneut versuchen." });
        }

        cleanup();
        if (!closed) { closed = true; try { controller.close(); } catch {} }
      } catch (err) {
        // SECURITY: Log full error server-side, send generic message to client.
        // String(err) may contain API keys, file paths, or stack traces.
        console.error("[query] Stream processing error:", err);
        emitActivity({ type: "query", phase: "error", message: "Stream-Fehler aufgetreten" });
        send({ type: "error", error: "An unexpected error occurred. Please try again." });
        cleanup();
        if (!closed) { closed = true; try { controller.close(); } catch {} }
      }
    },
    cancel() {
      // Client disconnected — flag closed so any in-flight send() in
      // post-processing bails out silently instead of throwing.
      closed = true;
      if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
      if (idleTimeout) { clearTimeout(idleTimeout); idleTimeout = null; }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
