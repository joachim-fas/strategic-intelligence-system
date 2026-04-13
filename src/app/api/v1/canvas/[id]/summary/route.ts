/**
 * POST /api/v1/canvas/[id]/summary — generate meta-synthesis of all queries in a session
 * GET  /api/v1/canvas/[id]/summary — return cached summary if exists
 *
 * The Zusammenfassung (Meta-Synthesis) is the brilliant killer feature:
 * it takes ALL queries in a session and identifies cross-query patterns,
 * contradictions, and gaps — insights that no single query could surface.
 *
 * Caching strategy: summary is stored in canvas_state.summary with a hash of
 * the current query-node IDs. If the hash matches on read, return cached.
 * Otherwise regenerate.
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { resolveEnv } from "@/lib/env";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

function extractJSON(text: string): any | null {
  if (!text || text.trim().length === 0) return null;
  let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  cleaned = cleaned.slice(start);
  try { return JSON.parse(cleaned); } catch {}
  const end = cleaned.lastIndexOf("}");
  if (end > 0) { try { return JSON.parse(cleaned.slice(0, end + 1)); } catch {} }
  return null;
}

/**
 * SEC-05: Sanitize user-provided content before interpolating into LLM prompts.
 * Strips XML-like tags and role markers that could hijack the prompt.
 */
function sanitizeForPrompt(input: string): string {
  if (!input) return "";
  return input
    // Strip XML-style tags (e.g. <system>, </user>, <|im_start|>)
    .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
    // Strip role markers used in chat prompts
    .replace(/\b(system|user|assistant|human)\s*:/gi, "")
    // Strip control characters (except newline/tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

/**
 * Extract all query-like nodes from a canvas state and return their
 * synthesis, insights, scenarios for the meta-synthesis input.
 */
function extractQueriesFromCanvas(canvasState: any): Array<{
  query: string;
  synthesis: string;
  keyInsights: string[];
  scenarios: Array<{ name: string; description: string; probability?: number }>;
  interpretation?: string;
  decisionFramework?: string;
  timestamp?: number;
}> {
  if (!canvasState?.nodes) return [];
  const queries: any[] = [];
  for (const node of canvasState.nodes) {
    if (node.nodeType !== "query") continue;
    if (!node.query) continue;
    const result = node.result || {};
    queries.push({
      query: sanitizeForPrompt(node.query),
      synthesis: sanitizeForPrompt((node.synthesis || result.synthesis || "").slice(0, 1500)),
      keyInsights: Array.isArray(result.keyInsights)
        ? result.keyInsights.slice(0, 5).map((i: string) => sanitizeForPrompt(i))
        : [],
      scenarios: Array.isArray(result.scenarios)
        ? result.scenarios.slice(0, 3).map((s: any) => ({
            name: sanitizeForPrompt(s.name || s.title || ""),
            description: sanitizeForPrompt((s.description || "").slice(0, 200)),
            probability: s.probability,
          }))
        : [],
      interpretation: sanitizeForPrompt((result.interpretation || "").slice(0, 400)),
      decisionFramework: sanitizeForPrompt((result.decisionFramework || "").slice(0, 400)),
      timestamp: node.createdAt,
    });
  }
  queries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return queries;
}

/**
 * Hash the query node IDs + their synthesis content so we can detect
 * whether the session has meaningfully changed since the last summary.
 *
 * DAT-17: Previously used synthesis.length for hashing, which could cause
 * false cache hits when different content had the same length.
 * Now hashes the actual content.
 */
function hashSession(queries: any[]): string {
  // DAT-17: Hash actual content instead of just length
  const str = queries.map(q => `${q.query}|${q.synthesis}`).join("::");
  const hash = Array.from(str).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  return String(hash);
}

/**
 * The meta-synthesis system prompt. This is where brilliance is earned or lost.
 */
function buildMetaSynthesisPrompt(queries: Array<any>, locale: string): {
  system: string;
  user: string;
} {
  const de = locale === "de";

  const system = de
    ? `Du bist ein Senior-Stratege im Strategic Intelligence System (SIS).

Deine Aufgabe ist NICHT, die einzelnen Queries nochmal zusammenzufassen — das ist bereits geschehen. Deine Aufgabe ist METHODISCH UND SCHWIERIGER: Du musst den ROTEN FADEN zwischen den Queries finden und herausarbeiten, was der User durch das Stellen GERADE DIESER Fragen (in GERADE DIESER Reihenfolge) implizit sucht — und was er zwischen den Zeilen bereits an Antworten hat, ohne es zu merken.

Eine brilliante Meta-Synthese liefert fünf Dinge, die keine einzelne Query liefern kann:

1. **Roter Faden**: Der implizite, übergreifende Sinn der Fragen. Was ist die WIRKLICHE Frage hinter den einzelnen Fragen? (2-4 Sätze, aussagestark, nicht beschreibend)

2. **Cross-Query-Muster**: Welche Beobachtungen tauchen in MEHREREN Briefings auf? Diese sind überzufällig wichtig — sie sind die strukturellen Kräfte, die der User unbewusst umkreist. (3-5 Muster, jedes mit Referenz auf die betroffenen Queries)

3. **Widersprüche & Spannungen**: Wo widersprechen sich die Briefings oder deuten auf Trade-offs hin? Das ist oft der wertvollste Fund, weil er zeigt, wo naive Lösungen scheitern. (2-4 Spannungen, explizit benennen)

4. **Meta-Entscheidungsrahmen**: Wenn man ALLE Analysen zusammen als Grundlage für strategisches Handeln betrachtet — was sind die 3-5 nicht-verhandelbaren Handlungsmaximen? (Nicht: individuelle To-dos. Sondern: Strategische Prinzipien die aus dem Muster folgen.)

5. **Offene Flanken**: Welche Query hat der User NICHT gestellt, die er hätte stellen müssen? Das ist der schärfste Erkenntnisschnitt — der kluge Berater zeigt, wo der blinde Fleck ist. (2-4 konkrete, spezifische Fragen mit kurzer Begründung warum)

Sei schonungslos intellektuell ehrlich. Wenn die Queries dünn sind, sage es. Wenn sie redundant sind, sage es. Wenn zwischen Query 2 und Query 4 ein Denkfehler liegt, benenne ihn. Du bist kein Diener, sondern ein strategischer Sparring-Partner.

Antworte AUSSCHLIESSLICH als valides JSON in EXAKT diesem Schema — kein Markdown, kein Prosa-Vorwort:

{
  "sessionTitle": "Präziser Session-Titel (4-6 Wörter, substantiell)",
  "realQuestion": "Die WIRKLICHE Frage hinter allen Fragen (1 Satz, scharf)",
  "redThread": "2-4 Sätze zum roten Faden. Konkret, nicht beschreibend. Zeigt das implizite System hinter den Queries.",
  "crossQueryPatterns": [
    {
      "pattern": "Das Muster in 1 Satz",
      "explanation": "Warum es wichtig ist (1-2 Sätze)",
      "queryRefs": [0, 2, 3]
    }
  ],
  "tensions": [
    {
      "tension": "Die Spannung in 1 Satz",
      "between": [0, 2],
      "implication": "Was daraus folgt (1-2 Sätze)"
    }
  ],
  "metaDecisionFramework": [
    {
      "principle": "Nicht-verhandelbare Handlungsmaxime (1 Satz)",
      "rationale": "Warum das aus dem Muster folgt (1-2 Sätze)"
    }
  ],
  "openFlanks": [
    {
      "question": "Die Query, die fehlt (konkret formuliert)",
      "why": "Warum sie kritisch ist (1 Satz)"
    }
  ],
  "confidence": 0.75,
  "critique": "1-2 Sätze ehrliche Einschätzung der Qualität dieser Session (darf unbequem sein)"
}

queryRefs und between verweisen auf Query-Indizes (0-basiert in der Reihenfolge wie in <sessions> unten).
Mindestens 3 Cross-Query-Patterns, mindestens 2 Tensions (oder leer wenn wirklich keine existieren), mindestens 3 Decision-Principles, mindestens 2 Open Flanks.
Sprache: Deutsch.`
    : `You are a Senior Strategist in the Strategic Intelligence System (SIS).

Your task is NOT to re-summarize the individual queries — that is already done. Your task is HARDER and more methodical: find the RED THREAD between the queries, surface what the user is implicitly searching for by asking THESE SPECIFIC questions in THIS SPECIFIC order, and reveal answers that are hidden between the lines.

A brilliant meta-synthesis delivers five things no single query can:

1. **Red Thread**: The implicit, overarching meaning of the questions. What is the REAL question behind the individual questions? (2-4 sentences, sharp, not descriptive)

2. **Cross-Query Patterns**: What observations appear in MULTIPLE briefings? These are structurally important — they're the forces the user is unconsciously circling. (3-5 patterns, each with references to affected queries)

3. **Tensions & Contradictions**: Where do briefings contradict each other or point to trade-offs? This is often the most valuable finding because it shows where naive solutions fail. (2-4 tensions, explicitly named)

4. **Meta-Decision Framework**: When ALL analyses are considered together as foundation for strategic action — what are the 3-5 non-negotiable principles? (Not individual to-dos. Strategic principles emerging from the pattern.)

5. **Open Flanks**: Which query did the user NOT ask, that they should have? This is the sharpest cut — a good advisor shows where the blind spot is. (2-4 concrete, specific questions with brief justification)

Be ruthlessly intellectually honest. If the queries are thin, say so. If they're redundant, say so. If there's a thinking error between Query 2 and Query 4, name it. You are not a servant, you are a strategic sparring partner.

Respond EXCLUSIVELY as valid JSON in EXACTLY this schema — no markdown, no prose preamble:

{
  "sessionTitle": "Precise session title (4-6 words, substantive)",
  "realQuestion": "The REAL question behind all questions (1 sentence, sharp)",
  "redThread": "2-4 sentences. Concrete, not descriptive. Shows the implicit system behind the queries.",
  "crossQueryPatterns": [
    { "pattern": "...", "explanation": "...", "queryRefs": [0, 2, 3] }
  ],
  "tensions": [
    { "tension": "...", "between": [0, 2], "implication": "..." }
  ],
  "metaDecisionFramework": [
    { "principle": "...", "rationale": "..." }
  ],
  "openFlanks": [
    { "question": "...", "why": "..." }
  ],
  "confidence": 0.75,
  "critique": "1-2 sentences of honest assessment of this session's quality (may be uncomfortable)"
}

queryRefs and between reference query indices (0-based in the order shown in <sessions> below).
At least 3 cross-query patterns, at least 2 tensions (or empty if truly none exist), at least 3 decision principles, at least 2 open flanks.
Language: English.`;

  // Build user message with all queries
  const sessionBlock = queries.map((q, i) => {
    const parts = [`<query index="${i}">`];
    parts.push(`  <question>${q.query}</question>`);
    if (q.synthesis) parts.push(`  <synthesis>${q.synthesis}</synthesis>`);
    if (q.keyInsights.length > 0) {
      parts.push(`  <insights>`);
      q.keyInsights.forEach((ins: string) => parts.push(`    - ${ins}`));
      parts.push(`  </insights>`);
    }
    if (q.scenarios.length > 0) {
      parts.push(`  <scenarios>`);
      q.scenarios.forEach((s: any) => parts.push(`    - ${s.name}: ${s.description}${s.probability ? ` (${Math.round(s.probability * 100)}%)` : ""}`));
      parts.push(`  </scenarios>`);
    }
    if (q.interpretation) parts.push(`  <interpretation>${q.interpretation}</interpretation>`);
    if (q.decisionFramework) parts.push(`  <decisionFramework>${q.decisionFramework}</decisionFramework>`);
    parts.push(`</query>`);
    return parts.join("\n");
  }).join("\n\n");

  const user = de
    ? `Hier ist die Session mit ${queries.length} Queries. Analysiere sie als strategischer Sparring-Partner und liefere die Meta-Synthese.

<sessions>
${sessionBlock}
</sessions>

Finde den roten Faden. Benenne die Muster. Decke die Widersprüche auf. Zeige die offenen Flanken. Sei ehrlich, auch wenn es unbequem ist.`
    : `Here is the session with ${queries.length} queries. Analyze them as a strategic sparring partner and deliver the meta-synthesis.

<sessions>
${sessionBlock}
</sessions>

Find the red thread. Name the patterns. Uncover the contradictions. Show the open flanks. Be honest, even if uncomfortable.`;

  return { system, user };
}

// ─── GET: return cached summary if it matches current session state ───

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // DAT-13: Ensure DB handle is always closed
  const d = db();
  let row: { canvas_state: string | null } | undefined;
  try {
    row = d.prepare("SELECT canvas_state FROM radars WHERE id = ?").get(id) as { canvas_state: string | null } | undefined;
  } finally {
    d.close();
  }
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let state: any = null;
  try { state = row.canvas_state ? JSON.parse(row.canvas_state) : null; } catch {}
  const queries = extractQueriesFromCanvas(state);
  const currentHash = hashSession(queries);

  const cached = state?.summary;
  if (cached && cached.hash === currentHash) {
    return NextResponse.json({
      summary: cached.data,
      cached: true,
      queryCount: queries.length,
    });
  }

  return NextResponse.json({
    summary: null,
    cached: false,
    queryCount: queries.length,
    canGenerate: queries.length >= 2,
  });
}

// ─── POST: generate or regenerate the meta-synthesis ───

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // SEC-11: Rate limit LLM endpoints — 20 requests per IP per hour
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`canvas-summary:${clientIp}`, 20, 3_600_000)) {
    return tooManyRequests("Rate limit exceeded for summary endpoint. Try again later.");
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const locale = body.locale || "de";

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const d = db();
  const row = d.prepare("SELECT canvas_state FROM radars WHERE id = ?").get(id) as { canvas_state: string | null } | undefined;
  if (!row) { d.close(); return NextResponse.json({ error: "Not found" }, { status: 404 }); }

  let state: any = null;
  try { state = row.canvas_state ? JSON.parse(row.canvas_state) : null; } catch {}
  const queries = extractQueriesFromCanvas(state);

  if (queries.length < 2) {
    d.close();
    return NextResponse.json(
      { error: locale === "de" ? "Mindestens 2 Analysen für eine Meta-Synthese erforderlich." : "At least 2 analyses required for meta-synthesis." },
      { status: 400 }
    );
  }

  const { system, user } = buildMetaSynthesisPrompt(queries, locale);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // Model fallback chain — same strategy as framework-analyze
      const models = ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-sonnet-4-6"];
      let fullText = "";
      let modelUsed: string | undefined;

      for (const model of models) {
        send({ type: "status", message: `Using ${model}…` });
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 6000,
              system,
              messages: [{ role: "user", content: user }],
              stream: true,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            if (errText.includes("overloaded")) {
              send({ type: "status", message: `${model} overloaded, trying fallback…` });
              continue;
            }
            send({ type: "error", error: `API error ${res.status}: ${errText.slice(0, 200)}` });
            d.close();
            controller.close();
            return;
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let lineBuffer = "";
          let streamError = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  fullText += event.delta.text;
                  send({ type: "delta", text: event.delta.text });
                } else if (event.type === "error") {
                  streamError = true;
                  send({ type: "status", message: `Stream error on ${model}, trying fallback…` });
                }
              } catch {}
            }
          }

          if (streamError && !fullText) continue;
          modelUsed = model;
          break;
        } catch (err: any) {
          send({ type: "status", message: `${model} failed: ${err.message}` });
          continue;
        }
      }

      if (!modelUsed || !fullText) {
        send({ type: "error", error: "Alle Modelle fehlgeschlagen. Bitte später erneut versuchen." });
        d.close();
        controller.close();
        return;
      }

      const result = extractJSON(fullText);
      if (!result || !result.redThread) {
        send({ type: "error", error: "Meta-Synthese konnte nicht geparst werden. Bitte erneut versuchen." });
        d.close();
        controller.close();
        return;
      }

      // TODO: DAT-10 — Race condition: concurrent save from Canvas page can overwrite summary. Fix: use separate summary column or row-level locking.
      // Cache it in canvas_state.summary
      try {
        const updatedState = { ...(state || {}), summary: { hash: hashSession(queries), data: result, generatedAt: Date.now(), modelUsed } };
        d.prepare("UPDATE radars SET canvas_state = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(updatedState), id);
      } catch (e) {
        // Non-fatal — just don't cache
      }
      d.close();

      send({ type: "complete", result, modelUsed, queryCount: queries.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
