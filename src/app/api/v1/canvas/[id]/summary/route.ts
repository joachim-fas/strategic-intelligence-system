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
import type { Database as DatabaseType } from "better-sqlite3";
import { getSqliteHandle } from "@/db";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { resolveEnv } from "@/lib/env";
import { requireTenantContext } from "@/lib/api-helpers";

// Single shared DB handle — previously this file opened a fresh
// `new Database(...)` per request, which bypassed the migration and
// pragma chain everything else in the codebase routes through. That
// also meant no `foreign_keys = ON`, no dev-user materialisation, and
// no tenant-schema guarantees on the connection.
function db(): DatabaseType {
  return getSqliteHandle();
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

interface SummaryQuery {
  query: string;
  synthesis: string;
  keyInsights: string[];
  scenarios: Array<{ name: string; description: string; probability?: number }>;
  interpretation?: string;
  decisionFramework?: string;
  timestamp?: number;
  source: "canvas" | "project";
  // Extra fields surfaced to the client for the linear "read all briefings"
  // view. Kept optional so the LLM meta-synthesis prompt builder (which
  // cares only about the fields above) is unaffected.
  regulatoryContext?: string[] | Array<{ title?: string; description?: string; framework?: string }>;
  references?: Array<{ title?: string; url?: string; source?: string }>;
  followUpQuestions?: string[];
  confidence?: number;
  createdAt?: string;
}

/**
 * Normalize one result-shaped blob (from either a canvas query node's
 * `.result` or a `project_queries.result_json`) into the summary input
 * format. Extracted so canvas + project_queries stay in lock-step.
 */
function queryFromResult(
  queryText: string,
  result: Record<string, unknown> | null | undefined,
  synthesisRaw: string,
  timestamp: number | undefined,
  source: "canvas" | "project",
  createdAt?: string,
): SummaryQuery {
  const r = (result ?? {}) as Record<string, unknown>;
  const insights = Array.isArray(r.keyInsights) ? (r.keyInsights as unknown[]) : [];
  const scenarios = Array.isArray(r.scenarios) ? (r.scenarios as unknown[]) : [];
  const regulatory = Array.isArray(r.regulatoryContext) ? (r.regulatoryContext as unknown[]) : [];
  const refs = Array.isArray(r.references) ? (r.references as unknown[]) : [];
  const followUps = Array.isArray(r.followUpQuestions) ? (r.followUpQuestions as unknown[]) : [];
  return {
    query: sanitizeForPrompt(queryText),
    synthesis: sanitizeForPrompt((synthesisRaw || (r.synthesis as string) || "").slice(0, 1500)),
    keyInsights: insights.slice(0, 5).map((i) => sanitizeForPrompt(String(i))),
    scenarios: scenarios.slice(0, 3).map((s) => {
      const sc = (s ?? {}) as Record<string, unknown>;
      return {
        name: sanitizeForPrompt(String(sc.name ?? sc.title ?? "")),
        description: sanitizeForPrompt(String(sc.description ?? "").slice(0, 200)),
        probability: typeof sc.probability === "number" ? sc.probability : undefined,
      };
    }),
    interpretation: sanitizeForPrompt(String(r.interpretation ?? "").slice(0, 400)),
    decisionFramework: sanitizeForPrompt(String(r.decisionFramework ?? "").slice(0, 400)),
    timestamp,
    source,
    // Pass-through for the linear-read view. Not sanitized for prompt
    // use (prompt builder doesn't read these fields); rendering on the
    // client handles escape.
    regulatoryContext: regulatory.map((x) => {
      if (typeof x === "string") return x;
      const obj = (x ?? {}) as Record<string, unknown>;
      return {
        title: typeof obj.title === "string" ? obj.title : undefined,
        description: typeof obj.description === "string" ? obj.description : undefined,
        framework: typeof obj.framework === "string" ? obj.framework : undefined,
      };
    }) as SummaryQuery["regulatoryContext"],
    references: refs.map((x) => {
      const obj = (x ?? {}) as Record<string, unknown>;
      return {
        title: typeof obj.title === "string" ? obj.title : undefined,
        url: typeof obj.url === "string" ? obj.url : undefined,
        source: typeof obj.source === "string" ? obj.source : undefined,
      };
    }),
    followUpQuestions: followUps.slice(0, 6).map((x) => String(x)),
    confidence: typeof r.confidence === "number" ? r.confidence : undefined,
    createdAt,
  };
}

/**
 * Extract all query-like nodes from a canvas state and return their
 * synthesis, insights, scenarios for the meta-synthesis input.
 */
function extractQueriesFromCanvas(canvasState: any): SummaryQuery[] {
  if (!canvasState?.nodes) return [];
  const queries: SummaryQuery[] = [];
  for (const node of canvasState.nodes) {
    if (node.nodeType !== "query") continue;
    if (!node.query) continue;
    const ts = typeof node.createdAt === "number" ? node.createdAt : undefined;
    queries.push(
      queryFromResult(
        node.query,
        node.result ?? null,
        node.synthesis ?? "",
        ts,
        "canvas",
        ts ? new Date(ts).toISOString() : undefined,
      ),
    );
  }
  queries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return queries;
}

/**
 * Pull queries that were saved to this project through the "Add to
 * Project" flow on the briefing page. These live in `project_queries`
 * with a `result_json` column and are invisible to the canvas-only
 * extractor above — yet they contain the same synthesis shape and
 * absolutely belong in the Zusammenfassung. Without this the
 * Zusammenfassung looked empty for users who worked primarily from
 * the home-page briefing flow (reported as "funktioniert nicht
 * ordentlich").
 *
 * We dedupe against canvas queries by normalized query text: if the
 * same question appears on both sides, the canvas copy wins because
 * it tends to carry richer session metadata.
 */
function extractQueriesFromProject(
  db: DatabaseType,
  radarId: string,
  existing: SummaryQuery[],
): SummaryQuery[] {
  const seen = new Set(existing.map((q) => q.query.trim().toLowerCase()));
  const rows = db
    .prepare(
      `SELECT query, result_json, created_at
       FROM project_queries
       WHERE radar_id = ?
       ORDER BY created_at ASC`,
    )
    .all(radarId) as Array<{ query: string; result_json: string | null; created_at: string }>;

  const out: SummaryQuery[] = [];
  for (const row of rows) {
    const key = (row.query ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = row.result_json ? (JSON.parse(row.result_json) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }
    // created_at is ISO-ish ("2026-04-16 07:44:53"), convert to epoch ms for sorting.
    const ts = row.created_at ? Date.parse(row.created_at.replace(" ", "T")) : undefined;
    out.push(
      queryFromResult(
        row.query,
        parsed,
        (parsed?.synthesis as string) ?? "",
        Number.isFinite(ts) ? (ts as number) : undefined,
        "project",
        row.created_at ? row.created_at.replace(" ", "T") : undefined,
      ),
    );
  }
  return out;
}

/**
 * Canonical query list for a project: canvas nodes + project_queries,
 * deduped and sorted chronologically so the LLM sees the real order.
 */
function collectProjectQueries(
  db: DatabaseType,
  radarId: string,
  canvasState: unknown,
): SummaryQuery[] {
  const canvasQueries = extractQueriesFromCanvas(canvasState);
  const projectQueries = extractQueriesFromProject(db, radarId, canvasQueries);
  const merged = [...canvasQueries, ...projectQueries];
  merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return merged;
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
 * Degraded single-query prompt — same JSON output schema so the client
 * doesn't need a second renderer. Instead of "cross-query patterns" we
 * ask for structural themes inside the single analysis; instead of
 * "tensions between queries" we surface trade-offs named in the
 * briefing; instead of "cross-query refs" we point at the single query
 * (index 0). The schema contract is preserved.
 */
function buildSingleQueryReviewPrompt(
  query: { query: string; synthesis: string; keyInsights: string[]; scenarios: Array<{ name: string; description: string; probability?: number }>; interpretation?: string; decisionFramework?: string },
  locale: string,
): { system: string; user: string } {
  const de = locale === "de";
  const system = de
    ? `Du bist ein Senior-Stratege im SIS. Dieses Projekt enthaelt bisher GENAU EINE Analyse. Deine Aufgabe: keinen zweiten Briefing-Durchlauf schreiben — sondern die bestehende Analyse als strategischer Sparring-Partner auseinandernehmen.

Liefere in EXAKT dem Schema unten:

- sessionTitle: knappe Benennung der Frage (4-6 Woerter).
- realQuestion: die eigentliche strategische Frage hinter der Formulierung (1 Satz, scharf).
- redThread: 2-4 Saetze. Der implizite gedankliche Rahmen der Analyse.
- crossQueryPatterns: 3-5 STRUKTURELLE Themen/Muster, die in der einen Analyse quer liegen. queryRefs ist immer [0].
- tensions: 2-4 Trade-offs, Spannungen oder Widersprueche, die in der Analyse bereits angelegt sind. between ist immer [0].
- metaDecisionFramework: 3-5 nicht-verhandelbare Handlungsmaximen aus der Analyse.
- openFlanks: 2-4 konkrete Folgefragen, die der User jetzt stellen sollte.
- confidence: 0..1, realistisch eingeschaetzt.
- critique: 1-2 Saetze, ehrlich zur Tiefe und Belastbarkeit dieser einen Analyse.

Antworte ausschliesslich als valides JSON — kein Markdown, kein Vorwort. Sprache: Deutsch.`
    : `You are a Senior Strategist in SIS. This project contains EXACTLY ONE analysis so far. Your job: do not rewrite the briefing — take it apart as a strategic sparring partner.

Deliver EXACTLY this schema:

- sessionTitle: concise framing of the question (4-6 words).
- realQuestion: the real strategic question behind the framing (1 sharp sentence).
- redThread: 2-4 sentences. The implicit frame of the analysis.
- crossQueryPatterns: 3-5 STRUCTURAL themes inside this single analysis. queryRefs is always [0].
- tensions: 2-4 trade-offs / contradictions already present in the analysis. between is always [0].
- metaDecisionFramework: 3-5 non-negotiable principles from the analysis.
- openFlanks: 2-4 concrete follow-up questions the user should now ask.
- confidence: realistic 0..1.
- critique: 1-2 honest sentences on the depth / reliability of this single analysis.

Respond only as valid JSON — no markdown, no preamble. Language: English.`;

  const bodyParts: string[] = [`<query index="0">`, `  <question>${query.query}</question>`];
  if (query.synthesis) bodyParts.push(`  <synthesis>${query.synthesis}</synthesis>`);
  if (query.keyInsights.length > 0) {
    bodyParts.push(`  <insights>`);
    query.keyInsights.forEach((ins: string) => bodyParts.push(`    - ${ins}`));
    bodyParts.push(`  </insights>`);
  }
  if (query.scenarios.length > 0) {
    bodyParts.push(`  <scenarios>`);
    query.scenarios.forEach((s) => bodyParts.push(`    - ${s.name}: ${s.description}${s.probability ? ` (${Math.round(s.probability * 100)}%)` : ""}`));
    bodyParts.push(`  </scenarios>`);
  }
  if (query.interpretation) bodyParts.push(`  <interpretation>${query.interpretation}</interpretation>`);
  if (query.decisionFramework) bodyParts.push(`  <decisionFramework>${query.decisionFramework}</decisionFramework>`);
  bodyParts.push(`</query>`);

  const user = de
    ? `Hier ist die einzelne Analyse in diesem Projekt. Zieh sie auseinander: roter Faden, strukturelle Themen, Trade-offs, Prinzipien, offene Flanken.

<sessions>
${bodyParts.join("\n")}
</sessions>`
    : `Here is the single analysis in this project. Take it apart: red thread, structural themes, trade-offs, principles, open flanks.

<sessions>
${bodyParts.join("\n")}
</sessions>`;

  return { system, user };
}

/**
 * The meta-synthesis system prompt. This is where brilliance is earned or lost.
 *
 * With ≥2 queries we do the classic cross-query meta-synthesis (red
 * thread + patterns + tensions + open flanks). With exactly 1 query
 * there's no "cross-query" signal, so we degrade to a single-query
 * deep-dive review that keeps the same output schema — the UI renders
 * the same cards either way.
 */
function buildMetaSynthesisPrompt(queries: Array<any>, locale: string): {
  system: string;
  user: string;
} {
  const de = locale === "de";

  if (queries.length === 1) {
    return buildSingleQueryReviewPrompt(queries[0], locale);
  }

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // SEC audit 2026-04: Was previously unauthenticated + unscoped —
  // any caller with a radar UUID could read another tenant's canvas
  // summary + project_queries. Now gated by tenant context and the
  // SELECT is tenant-filtered.
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const d = db();
  const row = d
    .prepare("SELECT canvas_state FROM radars WHERE id = ? AND tenant_id = ?")
    .get(id, ctx.tenantId) as { canvas_state: string | null } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let state: any = null;
  try { state = row.canvas_state ? JSON.parse(row.canvas_state) : null; } catch {}
  const queries = collectProjectQueries(d, id, state);
  const currentHash = hashSession(queries);

  const cached = state?.summary;
  // `briefings` is the new linear-read payload. Same data that the
  // prompt builder sees, but unsanitized fields (regulatoryContext,
  // references, followUpQuestions) included for rendering. The LLM
  // meta-synthesis (cached.data) is kept for backwards compatibility
  // — a future release can drop it once no client reads it.
  const briefings = queries.map((q) => ({
    query: q.query,
    synthesis: q.synthesis,
    keyInsights: q.keyInsights,
    scenarios: q.scenarios,
    interpretation: q.interpretation || undefined,
    decisionFramework: q.decisionFramework || undefined,
    regulatoryContext: q.regulatoryContext ?? [],
    references: q.references ?? [],
    followUpQuestions: q.followUpQuestions ?? [],
    confidence: q.confidence,
    createdAt: q.createdAt,
    source: q.source,
  }));

  if (cached && cached.hash === currentHash) {
    return NextResponse.json({
      summary: cached.data,
      cached: true,
      queryCount: queries.length,
      briefings,
    });
  }

  return NextResponse.json({
    summary: null,
    cached: false,
    queryCount: queries.length,
    // A single query with rich analysis is still worth synthesizing —
    // we re-frame the prompt for the 1-query case. Only count=0
    // genuinely has nothing to work with.
    canGenerate: queries.length >= 1,
    briefings,
  });
}

// ─── POST: generate or regenerate the meta-synthesis ───

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // SEC audit 2026-04: previously unauthenticated + unscoped — see GET.
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  // Viewers read-only; regenerating a summary mutates canvas_state.summary.
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Viewers cannot generate summaries" },
      { status: 403 },
    );
  }

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
  const row = d
    .prepare("SELECT canvas_state FROM radars WHERE id = ? AND tenant_id = ?")
    .get(id, ctx.tenantId) as { canvas_state: string | null } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let state: any = null;
  try { state = row.canvas_state ? JSON.parse(row.canvas_state) : null; } catch {}
  // Merge canvas + project_queries so briefings saved outside the canvas
  // also feed the Zusammenfassung.
  const queries = collectProjectQueries(d, id, state);

  if (queries.length < 1) {
    return NextResponse.json(
      { error: locale === "de" ? "Dieses Projekt enthält noch keine Analysen." : "This project contains no analyses yet." },
      { status: 400 }
    );
  }

  const { system, user } = buildMetaSynthesisPrompt(queries, locale);

  const encoder = new TextEncoder();
  // Guard flag — ReadableStream `cancel()` fires on client disconnect
  // and flips this to true. Every send/close checks it so late
  // post-processing (after the Anthropic stream drains) cannot throw
  // ERR_INVALID_STATE and swallow the final "complete" event.
  // Same hardening as /api/v1/query/route.ts.
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      // Dev-server buffer flush — same mitigation as /api/v1/monitor/stream.
      // Without ~2 KB of padding the first small SSE write can stall until
      // more data accumulates, which shows up as "stuck spinner" in the UI.
      try {
        controller.enqueue(encoder.encode(":" + " ".repeat(2048) + "\n\n"));
      } catch { /* stream already closed before we started */ }

      const send = (obj: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
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
            // NOTE: `d` is the shared singleton handle — do NOT close.
            safeClose();
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
        controller.close();
        return;
      }

      const result = extractJSON(fullText);
      if (!result || !result.redThread) {
        send({ type: "error", error: "Meta-Synthese konnte nicht geparst werden. Bitte erneut versuchen." });
        controller.close();
        return;
      }

      // TODO: DAT-10 — Race condition: concurrent save from Canvas page can overwrite summary. Fix: use separate summary column or row-level locking.
      // Cache it in canvas_state.summary. Tenant filter on UPDATE prevents
      // a stale handle / wrong-id from clobbering another tenant's canvas.
      try {
        const updatedState = { ...(state || {}), summary: { hash: hashSession(queries), data: result, generatedAt: Date.now(), modelUsed } };
        d.prepare("UPDATE radars SET canvas_state = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
          .run(JSON.stringify(updatedState), id, ctx.tenantId);
      } catch {
        // Non-fatal — just don't cache.
      }
      // NOTE: `d` is the shared singleton handle — do NOT close.

      send({ type: "complete", result, modelUsed, queryCount: queries.length });
      safeClose();
    },
    cancel() {
      // Browser aborted the fetch — flag closed so any in-flight send()
      // from post-processing bails out silently.
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
