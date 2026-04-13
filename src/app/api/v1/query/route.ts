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
  const { query: rawQuery, locale, contextProfile, previousContext } = body;
  // previousContext: { query: string, synthesis: string } — from the preceding briefing

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
  const { getRelevantSignals, formatSignalsForPrompt, getSignalAge } = await import("@/lib/signals");

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

  const relevantSignals = getRelevantSignals(query, 16);
  const liveSignalsContext = formatSignalsForPrompt(relevantSignals);
  const uniqueSources = new Set(relevantSignals.map((s: any) => s.source)).size;

  emitActivity({ type: "query", phase: "signals", message: `${relevantSignals.length} Signale aus ${uniqueSources} Quellen geladen`, meta: { signals: relevantSignals.length, sources: uniqueSources } });

  const systemPrompt = buildSystemPrompt(trends, validLocale, liveSignalsContext || undefined);

  // SEC-08: Sanitize contextProfile fields — prevent prompt injection via role/industry/region
  let userMessage = query;
  if (contextProfile) {
    const sanitizeField = (v: unknown): string => {
      if (typeof v !== "string") return "";
      return v.slice(0, 100).replace(/[\n\r]/g, " ").replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\b(system|assistant|human)\s*:/gi, "").trim();
    };
    const role = sanitizeField(contextProfile.role);
    const industry = sanitizeField(contextProfile.industry);
    const region = sanitizeField(contextProfile.region);
    if (role || industry || region) {
      userMessage += `\n\n[Kontext: ${role} / ${industry} / ${region}]`;
    }
  }

  const encoder = new TextEncoder();

  // API-10: Keepalive + idle timeout state (shared between stream & cleanup)
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  let idleTimeout: ReturnType<typeof setTimeout> | null = null;
  const KEEPALIVE_MS = 15_000; // ping every 15s
  const IDLE_TIMEOUT_MS = 60_000; // close after 60s of inactivity

  const stream = new ReadableStream({
    async start(controller) {
      /** Reset the idle timeout — called on every data write. */
      const resetIdleTimeout = () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
          console.warn("[query] SSE idle timeout — closing stream after 60s of inactivity");
          cleanup();
          try { controller.close(); } catch { /* already closed */ }
        }, IDLE_TIMEOUT_MS);
      };

      /** Tear down keepalive + idle timers. */
      const cleanup = () => {
        if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
        if (idleTimeout) { clearTimeout(idleTimeout); idleTimeout = null; }
      };

      // Start the 15s keepalive ping
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":ping\n\n"));
        } catch {
          // Stream already closed — clean up
          cleanup();
        }
      }, KEEPALIVE_MS);

      // Start the initial idle timeout
      resetIdleTimeout();

      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        resetIdleTimeout(); // data was sent — reset idle clock
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
            max_tokens: 12000,
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

          // Map to generic client-facing error messages
          const status = anthropicRes.status;
          const clientError =
            status === 429
              ? "AI service is temporarily overloaded. Please try again in a moment."
              : status >= 500
                ? "AI service is temporarily unavailable."
                : "Unable to process your request. Please try again.";
          send({ type: "error", error: clientError });
          cleanup();
          controller.close();
          return;
        }

        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let lineBuffer = "";

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

        // Parse complete JSON and send structured result
        // API-03: extractJSON now returns { data, repaired } to flag repaired results.
        const extracted = extractJSON(fullText);
        let result = extracted?.data ?? null;
        const wasRepaired = extracted?.repaired ?? false;
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

          const signalsMeta = relevantSignals.map((s: any) => ({
            source: s.source,
            title: s.title,
            url: s.url,
            strength: s.strength,
            date: s.fetched_at.slice(0, 10),
          }));

          // Augment: matched trend details for radar + demographics
          const matchedIds: string[] = validated.matchedTrendIds || [];
          const matchedIdSet = new Set(matchedIds);
          const matchedTrends = matchedIds
            .map((id: string) => trends.find((t: TrendDot) => t.id === id))
            .filter(Boolean)
            .map((t: any) => ({
              id: t.id, name: t.name, category: t.category,
              tags: t.tags || [],
              relevance: t.relevance, confidence: t.confidence,
              impact: t.impact, velocity: t.velocity, ring: t.ring,
              signalCount: t.signalCount || 0,
            }));

          // Augment: causal edges between matched trends
          const { getEdgesForTrend } = await import("@/lib/causal-graph");
          const seen = new Set<string>();
          const matchedEdges = matchedIds
            .flatMap((id: string) => getEdgesForTrend(id))
            .filter((e: any) => {
              const key = `${e.from}→${e.to}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return matchedIdSet.has(e.from) && matchedIdSet.has(e.to);
            })
            .map((e: any) => ({
              from: e.from, to: e.to, type: e.type,
              strength: e.strength, description: e.description,
            }));

          // API-03 + VAL-01: Final result with validation metadata
          const finalResult = {
            ...validated,
            usedSignals: signalsMeta,
            matchedTrends,
            matchedEdges,
            ...(wasRepaired ? { _repaired: true } : {}),
            ...(qualityWarnings.length > 0 ? { _dataQualityWarnings: qualityWarnings } : {}),
            ...(warnings.length > 0 ? { _validationWarnings: warnings } : {}),
          };
          send({ type: "complete", result: finalResult });
          emitActivity({
            type: "query", phase: "complete",
            message: `Abfrage abgeschlossen — ${(validated.confidence * 100).toFixed(0)}% Konfidenz, ${matchedTrends.length} Trends`,
            meta: { confidence: validated.confidence, trends: matchedTrends.length, signals: relevantSignals.length, repaired: wasRepaired },
          });
        } catch (parseErr) {
          console.error("[query] Post-processing error:", parseErr);
          emitActivity({ type: "query", phase: "error", message: "Post-Processing fehlgeschlagen" });
          send({ type: "error", error: "Ergebnis konnte nicht verarbeitet werden. Bitte erneut versuchen." });
        }

        cleanup();
        controller.close();
      } catch (err) {
        // SECURITY: Log full error server-side, send generic message to client.
        // String(err) may contain API keys, file paths, or stack traces.
        console.error("[query] Stream processing error:", err);
        emitActivity({ type: "query", phase: "error", message: "Stream-Fehler aufgetreten" });
        send({ type: "error", error: "An unexpected error occurred. Please try again." });
        cleanup();
        controller.close();
      }
    },
    cancel() {
      // Client disconnected — clean up timers
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
