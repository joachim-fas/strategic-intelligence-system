/**
 * Signal Persistence & Retrieval (RAG Layer)
 *
 * Bridges connector output → SQLite → LLM prompt.
 * Enables SIS to answer with current, verifiable data
 * rather than relying solely on LLM training knowledge.
 */

import Database from "better-sqlite3";
import path from "path";

export interface LiveSignal {
  id: string;
  source: string;
  title: string;
  content: string | null;
  url: string | null;
  topic: string | null;
  tags: string | null;
  signal_type: string | null;
  strength: number | null;
  raw_data: string | null;
  fetched_at: string;
}

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

// ─── Store signals from a connector run ──────────────────────────────────────

export function storeSignals(
  source: string,
  signals: Array<{
    title: string;
    content?: string;
    url?: string;
    topic?: string;
    tags?: string[];
    signalType?: string;
    strength?: number;
    rawData?: Record<string, unknown>;
  }>
): void {
  const d = db();
  const insert = d.prepare(`
    INSERT INTO live_signals (id, source, title, content, url, topic, tags, signal_type, strength, raw_data, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = d.transaction((items: typeof signals) => {
    for (const s of items) {
      insert.run(
        crypto.randomUUID(),
        source,
        s.title,
        s.content ?? null,
        s.url ?? null,
        s.topic ?? null,
        s.tags ? JSON.stringify(s.tags) : null,
        s.signalType ?? null,
        s.strength ?? null,
        s.rawData ? JSON.stringify(s.rawData) : null
      );
    }
  });

  insertMany(signals);
  d.close();
}

// ─── Clear stale signals (older than N hours) ─────────────────────────────────

// Default matches the 14-day exponential decay window in scoring.ts
export function pruneOldSignals(maxAgeHours = 336): void {
  const d = db();
  d.prepare(
    `DELETE FROM live_signals WHERE fetched_at < datetime('now', ? || ' hours')`
  ).run(`-${Math.floor(maxAgeHours)}`);
  d.close();
}

// ─── Get age of most recent signals ──────────────────────────────────────────

export function getSignalAge(): { count: number; oldestHours: number; newestHours: number } {
  const d = db();
  const row = d.prepare(`
    SELECT
      COUNT(*) as count,
      ROUND((julianday('now') - julianday(MIN(fetched_at))) * 24, 1) as oldest_hours,
      ROUND((julianday('now') - julianday(MAX(fetched_at))) * 24, 1) as newest_hours
    FROM live_signals
  `).get() as any;
  d.close();
  return {
    count: row?.count ?? 0,
    oldestHours: row?.oldest_hours ?? 999,
    newestHours: row?.newest_hours ?? 999,
  };
}

// ─── Retrieve relevant signals for a query ───────────────────────────────────

/**
 * Finds live signals relevant to a query using keyword matching.
 * Returns top N signals, ordered by strength DESC then recency.
 */
export function getRelevantSignals(query: string, limit = 12): LiveSignal[] {
  const d = db();

  // ALG-21: Cross-language alias map for common DE<>EN term pairs.
  // When a keyword matches any alias group, all aliases in that group
  // are added to the keyword list so "Cybersicherheit" also matches
  // signals tagged with "cybersecurity" and vice versa.
  const CROSS_LANG_ALIASES: Record<string, string[]> = {
    "ki": ["ai", "artificial intelligence", "künstliche intelligenz"],
    "klimawandel": ["climate change", "global warming"],
    "cybersicherheit": ["cybersecurity", "cyber security"],
    "energiewende": ["energy transition"],
    "lieferkette": ["supply chain"],
    "gesundheit": ["health", "public health"],
    "migration": ["immigration", "refugees"],
    "geopolitik": ["geopolitics"],
    "kryptowährung": ["cryptocurrency", "crypto"],
  };

  // Build a reverse lookup: any alias term -> all terms in its group
  const aliasLookup = new Map<string, string[]>();
  for (const [key, aliases] of Object.entries(CROSS_LANG_ALIASES)) {
    const group = [key, ...aliases];
    for (const term of group) {
      aliasLookup.set(term, group);
    }
  }

  // Extract meaningful keywords from query (skip short/common words)
  const stopWords = new Set([
    "wie", "was", "wo", "wer", "wann", "warum", "welche", "welcher", "welches",
    "ist", "sind", "hat", "haben", "wird", "werden", "kann", "können",
    "für", "von", "mit", "bei", "auf", "an", "in", "zu", "über", "unter",
    "the", "how", "what", "where", "when", "why", "which", "who",
    "is", "are", "has", "have", "will", "can", "for", "with", "from",
    "und", "oder", "aber", "und", "also", "noch", "schon", "sehr",
  ]);

  // Important short terms that must bypass the minimum-length filter
  const importantShortTerms = new Set([
    "ki", "ai", "eu", "un", "us", "uk", "it", "ml", "ar", "vr", "xr",
    "5g", "6g", "iot", "llm", "rag", "api", "b2b", "b2c", "esg", "gdp",
  ]);

  const baseKeywords = query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, " ")
    .split(/\s+/)
    .filter((w) => !stopWords.has(w) && (w.length >= 2 || importantShortTerms.has(w)));

  // ALG-21: Expand keywords with cross-language aliases
  const expandedSet = new Set(baseKeywords);
  // Also check multi-word phrases from the query against alias keys
  const lowerQuery = query.toLowerCase().replace(/[^\w\säöüß]/g, " ");
  for (const [aliasKey, group] of aliasLookup) {
    if (lowerQuery.includes(aliasKey) || baseKeywords.includes(aliasKey)) {
      for (const alias of group) {
        expandedSet.add(alias);
      }
    }
  }
  const keywords = Array.from(expandedSet).slice(0, 12); // Allow more keywords after expansion

  if (keywords.length === 0) {
    // No meaningful keywords extracted — return empty instead of
    // irrelevant noise (FIX: previously returned top signals by strength
    // regardless of topic, causing e.g. football bets for mobility queries)
    d.close();
    return [];
  }

  // Score each signal using parameterized LIKE queries (no string interpolation).
  // Each keyword generates three CASE clauses (title, topic, content).
  const caseParts = keywords.map(() =>
    `(CASE WHEN lower(title)   LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN lower(topic)   LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN lower(content) LIKE ? THEN 1 ELSE 0 END)`
  );
  const scoreExpr = caseParts.join(" + ");
  // Bind each keyword as a `%keyword%` pattern for title, topic, and content
  const likeParams = keywords.flatMap(kw => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);

  // M1-FIX: Add HAVING clause so the DB filters zero-score rows instead of
  // fetching LIMIT rows and filtering in JS. Also require score >= 2 to avoid
  // noise from single content-only matches.
  const rows = d.prepare(`
    SELECT *,
      (${scoreExpr}) as relevance_score
    FROM live_signals
    WHERE fetched_at > datetime('now', '-336 hours')
      AND (${scoreExpr}) >= 2
    ORDER BY relevance_score DESC, strength DESC, fetched_at DESC
    LIMIT ?
  `).all([...likeParams, ...likeParams, limit]) as (LiveSignal & { relevance_score: number })[];

  d.close();

  return rows;
}

// ─── Format signals for LLM prompt injection ─────────────────────────────────

/**
 * SEC-07: Sanitize signal text before embedding in LLM prompts.
 * Strips control characters, XML-like tags, and role markers that
 * could be used for prompt injection via crafted signal data.
 */
function sanitizeSignalText(input: string): string {
  if (!input) return "";
  return input
    // Strip control characters (except newline/tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Strip XML-style tags that could hijack prompt structure
    .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
    // Strip role markers used in chat prompts
    .replace(/\b(system|user|assistant|human)\s*:/gi, "")
    .trim();
}

export function formatSignalsForPrompt(signals: LiveSignal[]): string {
  if (signals.length === 0) return "";

  const lines = signals.map((s) => {
    const date = s.fetched_at.slice(0, 10);
    const strength = s.strength != null ? ` [Stärke: ${(s.strength * 100).toFixed(0)}%]` : "";
    const url = s.url ? ` → ${s.url}` : "";
    const title = sanitizeSignalText(s.title);
    const content = s.content ? `\n    ${sanitizeSignalText(s.content.slice(0, 200))}` : "";
    return `• [${sanitizeSignalText(s.source).toUpperCase()}, ${date}]${strength} ${title}${url}${content}`;
  });

  return `AKTUELLE BELEGTE SIGNALE (letzte 14 Tage, aus ${new Set(signals.map((s) => s.source)).size} Quellen):
${lines.join("\n")}`;
}
