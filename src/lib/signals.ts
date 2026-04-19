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
 * ALG-22: Source-topic incoherence filter.
 * Certain sources produce signals whose topic fields are ambiguous.
 * A Polymarket signal tagged "Mobility & Autonomous Transport" might actually
 * be about football match betting if the topic-matcher caught a stray keyword.
 */
const NOISE_SOURCE_TOPICS: Record<string, Set<string>> = {
  polymarket: new Set([
    "sports", "betting", "football", "soccer", "basketball", "baseball",
    "nfl", "nba", "mlb", "nhl", "ufc", "tennis", "boxing", "cricket",
    "f1", "formula 1", "premier league", "champions league", "bundesliga",
    "serie a", "la liga", "world cup",
  ]),
  kalshi: new Set([
    "sports", "betting", "football", "soccer", "basketball", "baseball",
    "nfl", "nba", "mlb", "nhl", "ufc", "tennis",
  ]),
  manifold: new Set([
    "sports", "betting", "football", "soccer", "basketball",
  ]),
};

/**
 * Globale Noise-Patterns — Tokens die in JEDER Source als Noise gelten,
 * es sei denn die User-Query geht exakt über dieses Thema.
 *
 * Critical-Fix-Plan (P0-1, Notion 2026-04-20): News/GDELT-Connectors
 * können unabhängig vom Polymarket-Pfad Celebrity- oder Sport-Stories
 * als strategische Signale reinschleusen (z.B. ein GDELT-Tone-Event
 * zu "Hollywood Strike" tagged unter "economy"). Prediction-Markets
 * werden schon über NOISE_SOURCE_TOPICS gefiltert; hier fangen wir
 * die Restmenge ab.
 *
 * Konservativ gewählt: nur Marken/Entitäten die EINDEUTIG Unterhaltung/
 * Sport sind. Mehrdeutige Begriffe (fashion, food, travel) bewusst NICHT
 * drin — die können strategisch relevant sein ("fashion industry layoffs",
 * "food supply chain", "travel regulation").
 */
const GLOBAL_NOISE_PATTERNS: RegExp[] = [
  // Marken-Sportligen
  /\b(nfl|nba|mlb|nhl|ufc|premier league|champions league|bundesliga|serie a|la liga|world cup|formula\s*1|\bf1\b|wimbledon|super bowl)\b/i,
  // Entertainment-Industrie-Events
  /\b(oscars?|grammy|golden globe|cannes film|venice film|bafta|emmy)\b/i,
  // Celebrity-Leitmarken (eindeutig Personality-Clickbait)
  /\b(kardashian|kim kardashian|taylor swift.{0,40}(concert|tour|album|boyfriend|dating)|justin bieber|brad pitt|leonardo dicaprio)\b/i,
  // Gaming / E-Sports (Plattform-Level, nicht Industry-Level)
  /\b(twitch streamer|esports tournament|league of legends tournament|fortnite event)\b/i,
];

/**
 * Prüft ob der User absichtlich über Sport/Entertainment fragt. In dem
 * Fall darf der Noise-Filter nicht greifen — sonst verliert der User
 * genau die Signale, die er sucht.
 */
function queryIsAboutNoiseTopic(queryKeywords: string[]): boolean {
  const noiseQueryTerms = new Set([
    "sport", "sports", "fußball", "football", "soccer", "basketball",
    "tennis", "betting", "wetten", "bundesliga", "nfl", "nba",
    "entertainment", "celebrity", "hollywood", "music industry", "gaming industry",
  ]);
  return queryKeywords.some((kw) => noiseQueryTerms.has(kw));
}

function isNoiseSignal(
  signal: LiveSignal & { relevance_score: number },
  queryKeywords: string[]
): boolean {
  // Wenn der User selbst über Sport/Entertainment fragt: kein Filter.
  if (queryIsAboutNoiseTopic(queryKeywords)) return false;

  const signalText = [
    signal.title, signal.topic, signal.tags, signal.content?.slice(0, 500),
  ].filter(Boolean).join(" ").toLowerCase();

  // Schicht 1: Source-spezifische Prediction-Market-Blocklist (wie bisher).
  const sourceNoise = NOISE_SOURCE_TOPICS[signal.source];
  if (sourceNoise) {
    for (const noiseWord of sourceNoise) {
      if (signalText.includes(noiseWord)) return true;
    }
  }

  // Schicht 2: Globale Noise-Pattern. Wirkt auf ALLE Sources, fängt
  // News/GDELT/Social-Media-Leaks von Entertainment-Content.
  for (const pattern of GLOBAL_NOISE_PATTERNS) {
    if (pattern.test(signalText)) return true;
  }

  return false;
}

/**
 * Finds live signals relevant to a query using keyword + phrase matching
 * with post-retrieval coherence filtering.
 *
 * ALG-22 improvements:
 *  1. Bigram phrase matching — adjacent keywords form 2-word phrases
 *     that score higher than single-word matches
 *  2. Raised SQL threshold to >= 3 (single keyword match not enough)
 *  3. Source-topic coherence filter removes prediction-market noise
 *  4. Keyword overlap ratio check (30% minimum)
 *  5. Over-fetches 3x from SQL then post-filters to requested limit
 */
/**
 * Synchron-Variante für Legacy-Aufrufer. Der Notion-Plan P1-1 (#13)
 * führt später eine semantische Ebene ein (`getRelevantSignalsAsync`)
 * mit sqlite-vec + Embeddings. Bis dahin rufen alle Call-Sites das
 * bestehende Keyword-basierte getRelevantSignals().
 */
export function getRelevantSignals(query: string, limit = 12): LiveSignal[] {
  const d = db();

  // ALG-21: Cross-language alias map for common DE<>EN term pairs.
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
    "mobilität": ["mobility", "transport", "transportation", "verkehr"],
    "nachhaltigkeit": ["sustainability", "sustainable"],
    "digitalisierung": ["digitalization", "digital transformation"],
  };

  const aliasLookup = new Map<string, string[]>();
  for (const [key, aliases] of Object.entries(CROSS_LANG_ALIASES)) {
    const group = [key, ...aliases];
    for (const term of group) {
      aliasLookup.set(term, group);
    }
  }

  // Extract meaningful keywords from query (skip short/common words)
  const stopWords = new Set([
    // DE question words
    "wie", "was", "wo", "wer", "wann", "warum", "welche", "welcher", "welches",
    // DE articles & pronouns
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer",
    "sich", "ich", "du", "er", "sie", "es", "wir", "ihr", "mein", "dein", "sein",
    "diese", "dieser", "dieses", "diesen", "diesem", "jede", "jeder", "jedes",
    // DE common verbs & auxiliaries
    "ist", "sind", "hat", "haben", "wird", "werden", "kann", "können",
    "sein", "war", "waren", "wurde", "würde", "soll", "sollen", "muss", "müssen",
    "gibt", "geben", "macht", "machen", "geht", "gehen", "kommt", "kommen",
    // DE prepositions & conjunctions
    "für", "von", "mit", "bei", "auf", "an", "in", "zu", "über", "unter",
    "und", "oder", "aber", "also", "noch", "schon", "sehr", "nach", "vor",
    "nicht", "kein", "keine", "nur", "mehr", "dass", "wenn", "weil", "dann",
    "dort", "hier", "alle", "viel", "viele", "etwa", "erst", "bereits",
    "im", "am", "zum", "zur", "als",
    // EN question words
    "the", "how", "what", "where", "when", "why", "which", "who",
    // EN common
    "is", "are", "has", "have", "will", "can", "for", "with", "from",
    "and", "but", "not", "this", "that", "these", "those", "been", "does",
    "into", "than", "then", "some", "such", "also", "most", "much", "many",
  ]);

  const importantShortTerms = new Set([
    "ki", "ai", "eu", "un", "us", "uk", "it", "ml", "ar", "vr", "xr",
    "5g", "6g", "iot", "llm", "rag", "api", "b2b", "b2c", "esg", "gdp",
  ]);

  const baseKeywords = query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, " ")
    .split(/\s+/)
    .filter((w) => !stopWords.has(w) && (w.length >= 4 || importantShortTerms.has(w)));

  // ALG-22: Extract bigrams for phrase matching
  const bigrams: string[] = [];
  for (let i = 0; i < baseKeywords.length - 1; i++) {
    bigrams.push(`${baseKeywords[i]} ${baseKeywords[i + 1]}`);
  }

  // ALG-21: Expand keywords with cross-language aliases
  const expandedSet = new Set(baseKeywords);
  const lowerQuery = query.toLowerCase().replace(/[^\w\säöüß]/g, " ");
  for (const [aliasKey, group] of aliasLookup) {
    if (lowerQuery.includes(aliasKey) || baseKeywords.includes(aliasKey)) {
      for (const alias of group) {
        expandedSet.add(alias);
      }
    }
  }
  const keywords = Array.from(expandedSet).slice(0, 14);

  if (keywords.length === 0) {
    d.close();
    return [];
  }

  // ── Build SQL scoring expression ──────────────────────────────────────
  // Single-word: title=2, topic=3, content=1
  // Bigram phrase: title=5, topic=4, content=2
  const singleCaseParts = keywords.map(() =>
    `(CASE WHEN lower(title)   LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN lower(topic)   LIKE ? THEN 3 ELSE 0 END +
      CASE WHEN lower(content) LIKE ? THEN 1 ELSE 0 END)`
  );
  const bigramCaseParts = bigrams.map(() =>
    `(CASE WHEN lower(title)   LIKE ? THEN 5 ELSE 0 END +
      CASE WHEN lower(topic)   LIKE ? THEN 4 ELSE 0 END +
      CASE WHEN lower(content) LIKE ? THEN 2 ELSE 0 END)`
  );
  const scoreExpr = [...singleCaseParts, ...bigramCaseParts].join(" + ");

  const singleParams = keywords.flatMap(kw => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);
  const bigramParams = bigrams.flatMap(bg => [`%${bg}%`, `%${bg}%`, `%${bg}%`]);
  const likeParams = [...singleParams, ...bigramParams];

  // Over-fetch 3x to leave room for post-filtering
  const sqlLimit = limit * 3;

  const rows = d.prepare(`
    SELECT *,
      (${scoreExpr}) as relevance_score
    FROM live_signals
    WHERE fetched_at > datetime('now', '-336 hours')
      AND (${scoreExpr}) >= 3
    ORDER BY relevance_score DESC, strength DESC, fetched_at DESC
    LIMIT ?
  `).all([...likeParams, ...likeParams, sqlLimit]) as (LiveSignal & { relevance_score: number })[];

  d.close();

  // ── Post-SQL filtering ────────────────────────────────────────────────

  // Filter 1: Remove prediction market sports/betting noise
  let filtered = rows.filter((row) => !isNoiseSignal(row, baseKeywords));

  // Filter 2: Keyword overlap ratio — require 30% of keywords to appear
  const minOverlapCount = Math.max(1, Math.ceil(baseKeywords.length * 0.3));
  filtered = filtered.filter((row) => {
    const signalText = [row.title, row.topic, row.content?.slice(0, 1000), row.tags]
      .filter(Boolean).join(" ").toLowerCase();
    let matchedCount = 0;
    for (const kw of baseKeywords) {
      if (signalText.includes(kw)) matchedCount++;
    }
    return matchedCount >= minOverlapCount;
  });

  return filtered.slice(0, limit);
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
