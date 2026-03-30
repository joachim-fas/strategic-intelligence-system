import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { TrendDot } from "@/types";

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
    const { dummyTrends } = require("@/lib/dummy-data");
    return dummyTrends;
  }
}

// ── JSON extraction helpers ───────────────────────────────────────────────────

/**
 * Attempt to repair truncated JSON by closing all open structures.
 * Handles common truncation patterns from LLM streaming.
 */
function tryRepairJSON(text: string): any | null {
  // Count open brackets to determine what needs closing
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
    else if (ch === "}" || ch === "]") { depth--; closers.pop(); }
  }

  if (depth <= 0) return null; // Not truncated, plain parse failed for another reason

  // Close any open string, then close all structures
  let repaired = text.trimEnd();
  if (inString) repaired += '"';
  // Remove trailing comma before closing
  repaired = repaired.replace(/,\s*$/, "");
  repaired += closers.reverse().join("");

  try { return JSON.parse(repaired); } catch { return null; }
}

/**
 * Extract and parse a JSON object from LLM output.
 * Handles markdown code fences, leading text, and truncated output.
 */
function extractJSON(text: string): any | null {
  // 1. Handle ```json ... ``` code fences
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }

  // 2. Find the first '{' and try to parse from there
  const start = text.indexOf("{");
  if (start === -1) return null;

  const jsonText = text.slice(start);

  // 3. Direct parse (happy path — complete JSON)
  try { return JSON.parse(jsonText); } catch {}

  // 4. Find last '}' and try substring (handles trailing non-JSON text)
  const end = jsonText.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(jsonText.slice(0, end + 1)); } catch {}
  }

  // 5. Repair truncated JSON (streaming cut off mid-response)
  return tryRepairJSON(jsonText);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json();
  const { query, locale, contextProfile } = body;

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
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
    const base = process.env.NEXTAUTH_URL || "http://localhost:3001";
    fetch(`${base}/api/v1/signals`, { method: "POST" }).catch(() => {});
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
            messages: [{ role: "user", content: userMessage }],
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
        const result = extractJSON(fullText);
        if (!result) {
          send({ type: "error", error: "No valid JSON in LLM response" });
          controller.close();
          return;
        }

        try {
          const signalsMeta = relevantSignals.map((s: any) => ({
            source: s.source,
            title: s.title,
            url: s.url,
            strength: s.strength,
            date: s.fetched_at.slice(0, 10),
          }));
          send({ type: "complete", result: { ...result, usedSignals: signalsMeta } });
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
