import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { readFileSync } from "fs";
import { TrendDot } from "@/types";

// Fallback: read .env.local directly if Next.js failed to inject it
// (happens when project path contains spaces, e.g. "Meine Ablage")
function resolveEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const line = raw.split("\n").find(l => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch { return undefined; }
}

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
 * Extract and parse a JSON object from LLM output.
 * Handles markdown code fences, leading text, and truncated output.
 */
function extractJSON(text: string): any | null {
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
  try { return JSON.parse(cleaned); } catch {}

  // 2. Find last '}' and try substring (handles trailing text after JSON)
  const end = cleaned.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(cleaned.slice(0, end + 1)); } catch {}
  }

  // 3. Repair truncated JSON (streaming cut off mid-response)
  return tryRepairJSON(cleaned);
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory sliding window: 20 requests per IP per hour.
// Resets on server restart; good enough to prevent casual abuse.

const _rl = new Map<string, { count: number; windowStart: number }>();
const RL_MAX = 100;
const RL_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
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
  const { query, locale, contextProfile, previousContext } = body;
  // previousContext: { query: string, synthesis: string } — from the preceding briefing

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
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

  const relevantSignals = getRelevantSignals(query, 12);
  const liveSignalsContext = formatSignalsForPrompt(relevantSignals);

  const systemPrompt = buildSystemPrompt(trends, locale || "de", liveSignalsContext || undefined);

  let userMessage = query;
  if (contextProfile) {
    userMessage += `\n\n[Kontext: ${contextProfile.role} / ${contextProfile.industry} / ${contextProfile.region}]`;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
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
            messages: previousContext?.synthesis
              ? [
                  { role: "user", content: previousContext.query },
                  { role: "assistant", content: previousContext.synthesis },
                  { role: "user", content: userMessage },
                ]
              : [{ role: "user", content: userMessage }],
            stream: true,
          }),
        });

        if (!anthropicRes.ok) {
          const errText = await anthropicRes.text();
          send({ type: "error", error: `Anthropic API error ${anthropicRes.status}: ${errText}` });
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
        let result = extractJSON(fullText);
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
          const signalsMeta = relevantSignals.map((s: any) => ({
            source: s.source,
            title: s.title,
            url: s.url,
            strength: s.strength,
            date: s.fetched_at.slice(0, 10),
          }));

          // Augment: matched trend details for radar + demographics
          const matchedIds: string[] = result.matchedTrendIds || [];
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

          send({ type: "complete", result: { ...result, usedSignals: signalsMeta, matchedTrends, matchedEdges } });
        } catch {
          send({ type: "error", error: "JSON parse failed" });
        }

        controller.close();
      } catch (err) {
        send({ type: "error", error: String(err) });
        controller.close();
      }
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
