/**
 * Signal Persistence & Retrieval (RAG Layer)
 *
 * Bridges connector output → SQLite → LLM prompt.
 * Enables SIS to answer with current, verifiable data
 * rather than relying solely on LLM training knowledge.
 */

import Database from "better-sqlite3";
import path from "path";
import type { SourceTier } from "@/types";

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
  /**
   * Topical-relevance metadata attached by `getRelevantSignals`.
   * Downstream code (orbit scoring, briefing UI) consumes these instead
   * of guessing — see the 2026-04-21 Signal-Relevance fix plan.
   */
  keywordOverlap?: number;
  sourceTier?: SourceTier;
}

// ─── Source tiering ─────────────────────────────────────────────────────────

/**
 * Map connector source identifiers to authority tiers. Unknown sources
 * default to "media" — middle of the road, neither privileged nor
 * penalised. Extend this map as new connectors are added in
 * src/connectors/.
 */
const SOURCE_TIER_MAP: Record<string, SourceTier> = {
  // Authoritative — intergovernmental, government, policy bodies
  un_sdg: "authoritative",
  un_news_rss: "authoritative",
  un_data: "authoritative",
  who_gho: "authoritative",
  ilo: "authoritative",
  imf: "authoritative",
  oecd: "authoritative",
  worldbank: "authoritative",
  eurostat: "authoritative",
  destatis: "authoritative",
  fred: "authoritative",
  bls: "authoritative",
  ecfr_rss: "authoritative",
  ucdp: "authoritative",
  acled: "authoritative",
  nasa_eonet: "authoritative",
  owid: "authoritative",
  vdem: "authoritative",
  patentsview: "authoritative",

  // Academic — peer-reviewed & preprint
  arxiv: "academic",
  arxiv_qbio_rss: "academic",
  crossref: "academic",
  semantic_scholar: "academic",
  openalex: "academic",
  nature_rss: "academic",

  // Media — edited news (strength-weighted, not privileged)
  guardian: "media",
  nyt: "media",
  newsdata: "media",
  news_sentiment: "media",
  media_cloud: "media",
  spiegel_rss: "media",
  aljazeera_rss: "media",
  gdelt: "media",

  // Social — personal/unedited, needs high topic-match to count
  bluesky: "social",
  mastodon_api: "social",
  mastodon_sentiment: "social",
  reddit: "social",
  youtube_sentiment: "social",

  // Proxy — aggregate indicators, not content-as-evidence
  polymarket: "proxy",
  kalshi: "proxy",
  manifold: "proxy",
  metaculus: "proxy",
  "google-ngram": "proxy",
  google_trends: "proxy",
  hackernews: "proxy",
  github: "proxy",
  producthunt: "proxy",
  stackoverflow: "proxy",
  npm_pypi: "proxy",
  docker_hub: "proxy",
  finnhub: "proxy",
  open_exchange: "proxy",
  sentiment: "proxy",
  worldmonitor: "proxy",
  wikipedia: "proxy",
  open_meteo: "proxy",
};

export function classifySource(source: string): SourceTier {
  const key = source.toLowerCase();
  if (SOURCE_TIER_MAP[key]) return SOURCE_TIER_MAP[key];
  // Heuristic fallbacks for unmapped sources
  if (key.includes("rss") || key.includes("news")) return "media";
  if (key.includes("sdg") || key.includes("gov") || key.endsWith("_data")) return "authoritative";
  if (key.includes("ngram") || key.includes("trends") || key.includes("sentiment")) return "proxy";
  return "media";
}

/**
 * Minimum keyword-overlap per tier. The more authoritative the source,
 * the looser the topical-match requirement: UN/IPCC content is editorial
 * and focused, so even a single matching keyword signals engagement with
 * the topic. Social content is noisy — we demand substantial keyword
 * density before we let it through.
 *
 * These override the global 30% overlap floor in getRelevantSignals.
 */
const TIER_MIN_OVERLAP: Record<SourceTier, number> = {
  authoritative: 0.25,
  academic: 0.30,
  media: 0.30,
  proxy: 0.40,
  social: 0.60,  // Bluesky etc. — needs to really be on-topic
};

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
 * Personal-/lifestyle-noise patterns. Fix 2026-04-21 (Wintersport-Fall):
 * Bluesky and Mastodon posts about babysitters, pets, baby-weight
 * updates, sunrise photos, cooking etc. were passing the keyword filter
 * via stray topic-tag matches and appearing as "Live-Signale" in
 * strategic-intelligence queries. These patterns apply ONLY to
 * social-tier sources — we do not want to strip "baby boom" demographic
 * news from an authoritative connector.
 */
const SOCIAL_PERSONAL_NOISE_PATTERNS: RegExp[] = [
  // Childcare / baby / pets
  /\b(babysitter|babysitting|windel|diaper|stroller|kinderwagen|wackelkandidat)\b/i,
  /\b(mein kleiner|meine kleine|unser baby|our baby)\b/i,
  /\b(best\s+(babysitter|dog|cat|pet))\b/i,
  // Lifestyle photo updates
  /\b(sunrise this morning|good morning from|coffee this morning|this morning here in)\b/i,
  /\b(guten morgen aus|heute morgen|frühstück|breakfast vibes)\b/i,
  // Pet weight / feeding
  /\b\d+[.,]?\d*\s*kg\b.*\b(baby|baby['´]s|katze|hund|puppy|kitten)\b/i,
  /\b(baby|baby['´]s|katze|hund|puppy|kitten)\b.*\b\d+[.,]?\d*\s*kg\b/i,
  // Generic personal greetings / emoji-heavy
  /^[^\w]*(best|love|❤️|♥|😍|🥰)\b.{0,40}[❤️♥😍🥰]/i,
];

function isSocialPersonalNoise(signal: LiveSignal): boolean {
  const text = [signal.title, signal.content?.slice(0, 400)]
    .filter(Boolean).join(" ").toLowerCase();
  for (const p of SOCIAL_PERSONAL_NOISE_PATTERNS) {
    if (p.test(text)) return true;
  }
  return false;
}

/**
 * Polymarket-spezifische Match-/Wett-Patterns. Fix 2026-04-21:
 * Polymarket-Feed taggt Sportwetten (WM-Spiele, IPL, Esports-Matches,
 * Spread-Wetten) fälschlich mit strategischen Topics wie "Mobility &
 * Autonomous Transport" — der User sah in Demo-Queries "Will Switzerland
 * win on 2026-06-18?" als Mobility-Signal. Keine klassischen Sport-
 * Keywords in den Titeln, nur strukturelle Wett-Form. Diese Patterns
 * matchen die Struktur. Wirken AUSSCHLIESSLICH bei source === "polymarket".
 */
const POLYMARKET_MATCH_NOISE: RegExp[] = [
  // "Will X win|lose on <date>?"
  /^\s*will\s+[^?]{2,60}\s+(win|lose)\b/i,
  // vs-Match / draw / "match between"
  /\b(end\s+in\s+a\s+draw|\bvs\b|match\s+between)/i,
  // Spread-Wetten: "Spread: Team (-1.5)"
  /^\s*spread\s*:/i,
  // Cricket-Toss
  /\bwho\s+wins\s+the\s+toss\b/i,
  // Sport-Team-Präfixe (AFC/FC/AC/SV/...) gefolgt von Großbuchstaben-Team
  /\b(afc|fc|ac|sv|bv|vfb|vfl|tsv|fsv|sc)\s+[A-ZÄÖÜ][a-zäöü]/,
  // Roster-Moves (Esports + traditional sports)
  /\broster\s+(change|move|update)\b/i,
  // Liga- / Turnier-Phasen
  /\b(premier\s+league|cup\s+final|grand\s+final|season\s+(opener|finale)|group\s+stage|knockout\s+round|quarter[-\s]?final|semi[-\s]?final)\b/i,
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

  // Schicht 1b: Polymarket-spezifische Sport-Match-Patterns. Fängt die
  // 850+ falsch getaggten WM-/IPL-/Esports-Wetten, die bisher in
  // Mobility- und Wirtschafts-Queries als relevante Signale durchschlugen.
  if (signal.source === "polymarket") {
    const titleAndTags = [signal.title, signal.tags].filter(Boolean).join(" ");
    for (const pattern of POLYMARKET_MATCH_NOISE) {
      if (pattern.test(titleAndTags)) return true;
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

  // Filter 2: Per-tier keyword overlap ratio.
  //
  // Previously a flat 30% overlap floor applied to every source. Result:
  // a Bluesky personal post ("Sunrise this morning here in Glastonbury")
  // could sneak into a "Welche Regionen in Europa…" query just by
  // coincidence of stopword-adjacent matches. Now each tier gets its
  // own threshold (TIER_MIN_OVERLAP) — social content must actually
  // engage with the query, not just brush against it.
  //
  // Each surviving signal also carries its keywordOverlap and sourceTier
  // forward, so the UI + Orbit scoring can use them as deterministic
  // fallbacks when the LLM does not supply queryRelevance.
  const keywordCount = Math.max(1, baseKeywords.length);
  const enriched: (LiveSignal & { relevance_score: number; keywordOverlap: number; sourceTier: SourceTier })[] = [];
  for (const row of filtered) {
    const signalText = [row.title, row.topic, row.content?.slice(0, 1000), row.tags]
      .filter(Boolean).join(" ").toLowerCase();
    let matchedCount = 0;
    for (const kw of baseKeywords) {
      if (signalText.includes(kw)) matchedCount++;
    }
    const overlap = matchedCount / keywordCount;
    const tier = classifySource(row.source);

    // Social-tier signals must clear a personal-noise check too — stops
    // Bluesky babysitter / sunrise / pet-weight posts even when they
    // somehow pass the keyword overlap. We skip this for sport/entertainment
    // queries that the user explicitly asked about (same contract as
    // queryIsAboutNoiseTopic above).
    if (tier === "social" && !queryIsAboutNoiseTopic(baseKeywords) && isSocialPersonalNoise(row)) {
      continue;
    }

    const minOverlap = TIER_MIN_OVERLAP[tier];
    if (overlap < minOverlap) continue;

    enriched.push({ ...row, keywordOverlap: overlap, sourceTier: tier });
  }

  return enriched.slice(0, limit);
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
