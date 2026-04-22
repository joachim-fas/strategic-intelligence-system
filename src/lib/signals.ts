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
  google_news_wp_de: "media",   // Google News RSS — Wärmepumpe (DE)

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
 * Minimum weighted-keyword-overlap per tier. The more authoritative the
 * source, the looser the topical-match requirement: UN/IPCC content is
 * editorial and focused, so even a moderate overlap signals engagement
 * with the topic. Social content is noisy — we demand high keyword
 * density before we let it through.
 *
 * 2026-04-22 Pilot-Eval-A Re-Kalibrierung: Schwellen halbiert. Grund:
 * seit der Alias-Expansion (CROSS_LANG_ALIASES, DE↔EN) hat eine
 * typische Query ~20 expanded Keywords statt ~10. Weighted-Overlap
 * skaliert umgekehrt proportional zur Keyword-Menge — ein Signal, das
 * 3 von 10 ursprünglichen Begriffen trifft, lag bei ~40% Overlap; mit
 * 20 expanded Keywords liegt derselbe tatsächliche Match bei ~15-20%.
 * Die ALTEN Schwellen (30-40%) waren daher effektiv zu streng und
 * schlossen thematisch passende Signale aus. Der Anchor-Match-Gate
 * (≥5-Zeichen-Keyword muss erscheinen) bleibt als Schutz gegen
 * inhaltlichen Off-Topic-Müll bestehen.
 */
const TIER_MIN_OVERLAP: Record<SourceTier, number> = {
  authoritative: 0.10,
  academic: 0.15,
  media: 0.15,
  proxy: 0.20,
  social: 0.35,  // Bluesky etc. — needs to really be on-topic
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
    INSERT OR IGNORE INTO live_signals (id, source, title, content, url, topic, tags, signal_type, strength, raw_data, fetched_at)
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
 * Strukturelle Noise-Heuristiken für social-tier Signale.
 *
 * Der erste Versuch hatte eine Liste verbatim aus Screenshots übernommener
 * Wörter („wackelkandidat", „babysitter", „sunrise this morning"). Das ist
 * überangepasst — funktioniert nur für den einen Fall, den wir gesehen haben,
 * nicht für die tausend anderen Personal-Post-Varianten (andere Sprachen,
 * andere Themen, Cooking-Posts, Marathon-Trainings-Updates, Pet-Updates
 * in beliebigen Varianten, …).
 *
 * Generische strukturelle Eigenschaften eines personal/lifestyle-Posts:
 *  1. Sehr kurzer Text (< 80 Zeichen) mit wenig informationsdichter Substanz
 *  2. Emoji-Dichte hoch relativ zur Textlänge
 *  3. Reine Gewichts-/Maßangabe neben Baby/Haustier-Wort (strukturelle Form,
 *     nicht konkrete Tier-/Wort-Liste)
 *
 * Diese Checks wirken NUR auf social-tier Sources und NUR wenn die Query
 * nicht explizit über Social/Lifestyle-Themen geht. Für jede andere
 * Tier ist es zu invasiv (ein UN-Bericht könnte kurzen Pressetext haben).
 */
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

function isSocialStructuralNoise(signal: LiveSignal): boolean {
  const text = [signal.title, signal.content?.slice(0, 400)]
    .filter(Boolean).join(" ").trim();
  if (text.length === 0) return true;

  // (1) Sehr kurzer Text ohne erkennbaren Content-Anker — unter 60 Zeichen
  //     ist es statistisch extrem selten, dass ein Post strategische
  //     Substanz trägt. Pressetexte von Authoritative-Sources wären nie
  //     so kurz; social-tier Threshold darf hier hart sein.
  if (text.length < 60) return true;

  // (2) Emoji-Dichte: wenn > 10% der Zeichen Emoji sind, ist das ein
  //     Personal-/Greeting-Post, kein Intelligence-Signal.
  const emojiCount = (text.match(EMOJI_REGEX) || []).length;
  if (emojiCount > 0 && emojiCount / text.length > 0.10) return true;

  // (3) Struktur „<Gewicht/Maß> <Lebewesen>" oder umgekehrt — greift
  //     Baby-/Haustier-Weight-Updates OHNE harte Wort-Liste. „1,2 kg"
  //     oder „3kg" neben einer zoologisch/familial-Kategorie wie baby/
  //     kid/infant/pet/puppy/kitten/katze/hund/welpe in beliebiger
  //     Reihenfolge, innerhalb 60 Zeichen.
  const WEIGHT_NEAR_BEING = /\b\d+[.,]?\d*\s*(kg|lbs|oz|pound|pfund|gramm?)\b[^.]{0,60}\b(baby|babies|infant|kid|kids|kiddo|child|kleinen?|puppy|kitten|pup|welpe|welpen|kätzchen|hundie|hundchen|cat|dog|pet|haustier)\b|\b(baby|babies|infant|kid|kids|kiddo|child|kleinen?|puppy|kitten|pup|welpe|welpen|kätzchen|cat|dog|pet|haustier)\b[^.]{0,60}\b\d+[.,]?\d*\s*(kg|lbs|oz|pound|pfund|gramm?)\b/i;
  if (WEIGHT_NEAR_BEING.test(text)) return true;

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

// ─── Query-keyword extraction & topic-score helpers ────────────────────────
//
// Extracted from `getRelevantSignals` so the same logic can be reused in
// the API route to recompute topic-fit against the ORIGINAL query after
// trend-based enrichment. Without this reuse, the second retrieval pass
// (by trend name) produced signals whose `keywordOverlap` was relative to
// the TREND name, not the user's question — misleading in the UI.

const STOP_WORDS = new Set([
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

const IMPORTANT_SHORT_TERMS = new Set([
  "ki", "ai", "eu", "un", "us", "uk", "it", "ml", "ar", "vr", "xr",
  "5g", "6g", "iot", "llm", "rag", "api", "b2b", "b2c", "esg", "gdp",
]);

/**
 * Extract the query's content-bearing keywords — stopword-free, lower-case,
 * no alias expansion. This is the "canonical" keyword set the UI should use
 * to measure a signal's topic fit.
 */
export function extractQueryKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .filter((w) => !STOP_WORDS.has(w) && (w.length >= 4 || IMPORTANT_SHORT_TERMS.has(w)));
}

/**
 * Measure how topically a signal engages with a query's keywords.
 *
 * Returns three complementary metrics:
 *
 *  - `overlap`: fraction of query keywords that appear somewhere in the
 *    signal text. Legacy metric, kept for backward compatibility.
 *
 *  - `weightedOverlap`: length-weighted overlap. A matching 10-character
 *    word counts more than a matching 4-character word, on the intuition
 *    that longer words are typically more content-bearing and less likely
 *    to be incidental stopword-like matches. Formula: sum of matched
 *    keyword.length / sum of all keyword.length. This is a cheap, local
 *    TF-IDF approximation — no corpus needed.
 *
 *  - `anchorMatched`: did at least one "anchor" keyword appear? Anchors
 *    are keywords of length ≥ 5 — if the query has no ≥5 keyword we fall
 *    back to "any keyword". The anchor rule prevents a signal that only
 *    matched a short generic word (e.g. only "eu" from "eu mobility
 *    policy") from being treated as topical evidence.
 *
 * 2026-04-22 Pilot-Eval-Fix: `aliasGroups` ist ein optionales zweites
 * Argument. Jede Gruppe ist eine Menge synonymer Varianten eines
 * Base-Keywords (z.B. `["wintersport", "winter sports"]` oder
 * `["lieferketten", "supply chain", "supply chains"]`). Wenn irgendeine
 * Variante einer Gruppe im Signal vorkommt, gilt das Base-Keyword als
 * matched. Nenner bleibt aber die Base-Keyword-Menge — der Overlap
 * zeigt also immer, wie viele Konzepte der Original-Frage adressiert
 * sind, nicht wie viele Alias-Varianten im Text auftauchen. Ohne
 * aliasGroups (Legacy-Aufruf) verhält sich die Funktion wie vorher.
 */
export function computeKeywordStats(
  baseKeywords: string[],
  signalText: string,
  aliasGroups?: Record<string, string[]>,
): { matched: number; overlap: number; weightedOverlap: number; anchorMatched: boolean } {
  if (baseKeywords.length === 0) {
    return { matched: 0, overlap: 0, weightedOverlap: 0, anchorMatched: false };
  }
  const text = signalText.toLowerCase();

  let matched = 0;
  let matchedWeight = 0;
  let totalWeight = 0;

  // 2026-04-22 Pilot-Eval-Fix: Anchor-Mechanik strenger.
  //
  // Frühere Regel „irgendein Keyword ≥5 Zeichen matcht" war unter Alias-
  // Expansion zu großzügig: bei einer Wintersport-Query triggerte schon
  // „region" oder „europa" im ECFR-EU-Hungary-Paper den Anchor, obwohl
  // „wintersport" (das eigentliche Kernwort) nirgends auftaucht.
  //
  // Regel: die TOP-3 längsten Base-Keywords sind Strict-Anchors plus
  // die ERSTEN-5 Base-Keywords (User formuliert die Kernbegriffe
  // typischerweise früh in der Query — vor Sub-Fragen).
  //
  // 2026-04-22 Abend-Fix (Nach B-DE-Pilot-Re-Run): reine Top-3-Länge
  // ist zu restriktiv bei sub-fragen-reichen Queries. Bei
  //   „Wie verändert sich der europäische Arbeitsmarkt durch autonome
  //    KI-Agenten bis 2028? Welche Branchen sind am exponiertesten,
  //    welche strukturellen Interventionen (Regulierung, Bildung,
  //    Sozialsysteme) wirken — und wo droht die größte Kluft zwischen
  //    politischem Willen und Realität?"
  // picks das Top-3-Längste „sozialsysteme, interventionen,
  // exponiertesten" — Wörter, die in echten RSS-Feed-Titeln praktisch
  // nie auftauchen. Gleichzeitig bleibt „arbeitsmarkt" (12 Zeichen,
  // 12 Titel-Treffer in der DB) aus dem Anchor-Set raus und IAB-
  // Arbeitsmarkt-Artikel werden als „anchor-miss" verworfen.
  //
  // Union aus TOP-3-längste + ERSTEN-5 Base-Keywords korrigiert das:
  // „arbeitsmarkt", „europäische", „autonome", „agenten", „ki" kommen
  // ins Anchor-Set. Kernbegriffe der Frage bleiben strict geschützt,
  // aber typische RSS-Titel-Begriffe können den Filter passieren.
  const sortedByLength = [...baseKeywords].sort((a, b) => b.length - a.length);
  const topByLength = sortedByLength.slice(0, Math.min(3, sortedByLength.length));
  // Top-5-by-Position ergänzend, aber unter Beibehaltung der 5-Zeichen-
  // Mindestlänge: „wien" (4) o.ä. short-term-Wörter bleiben vom Anchor-
  // Schutz exkludiert, weil sie zu promiscuous matchen (verletzt sonst
  // `signals-relevance-test.ts`-Assertion „short-match: no anchor").
  const topByPosition = baseKeywords
    .slice(0, Math.min(5, baseKeywords.length))
    .filter((kw) => kw.length >= 5);
  const strictAnchorSet = new Set<string>([...topByLength, ...topByPosition]);
  let anchorMatched = false;

  for (const kw of baseKeywords) {
    totalWeight += kw.length;
    const variants = aliasGroups && aliasGroups[kw] ? [kw, ...aliasGroups[kw]] : [kw];
    const hit = variants.some((v) => text.includes(v));
    if (hit) {
      matched += 1;
      matchedWeight += kw.length;
      if (strictAnchorSet.has(kw)) anchorMatched = true;
    }
  }

  return {
    matched,
    overlap: matched / baseKeywords.length,
    weightedOverlap: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    anchorMatched,
  };
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
 *
 * 2026-04-21 update (generalisation pass):
 *  - Length-weighted keyword overlap (cheap TF-IDF) replaces flat 30% rule.
 *  - Anchor-keyword requirement: at least one ≥5-char query keyword must
 *    appear in the signal, otherwise it is discarded regardless of score.
 *  - Social-tier signals face structural noise checks (text length, emoji
 *    density, weight-near-being pattern) instead of a verbatim word list.
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
  //
  // 2026-04-22 Pilot-Eval-Erweiterung: DE-Strategie-Queries liefen
  // häufig gegen 0 Live-Signale, weil die News-Connectors überwiegend
  // englischsprachig sind (Guardian/NYT/NewsData/Al Jazeera) und die
  // Original-DE-Keywords nicht matchen. Die Lücken-Familie „Supply
  // Chain / Fragmentation / Standort / EU-Ländernamen" ist jetzt
  // zweisprachig bi-direktional alias-verknüpft, damit eine DE-Frage
  // EN-Content findet und umgekehrt.
  const CROSS_LANG_ALIASES: Record<string, string[]> = {
    "ki": ["ai", "artificial intelligence", "künstliche intelligenz", "llm", "large language model", "machine learning", "ml"],
    "klimawandel": ["climate change", "global warming"],
    "cybersicherheit": ["cybersecurity", "cyber security"],
    "energiewende": ["energy transition"],
    "lieferkette": ["supply chain", "lieferketten"],
    "lieferketten": ["supply chain", "supply chains", "lieferkette"],
    "gesundheit": ["health", "public health"],
    "migration": ["immigration", "refugees"],
    "geopolitik": ["geopolitics", "geopolitical"],
    "kryptowährung": ["cryptocurrency", "crypto"],
    "mobilität": ["mobility", "transport", "transportation", "verkehr"],
    "nachhaltigkeit": ["sustainability", "sustainable"],
    "digitalisierung": ["digitalization", "digital transformation"],
    // 2026-04-22: Strategie-Vokabular
    "fragmentierung": ["fragmentation"],
    "wirtschaft": ["economy", "economic"],
    "wirtschaftlich": ["economic", "economy"],
    "industrie": ["industry", "industrial"],
    "industriell": ["industrial", "industry"],
    "industrielles": ["industrial", "industry"],
    "deutschland": ["germany", "german"],
    "deutsche": ["german", "germany"],
    "europa": ["europe", "european", "eu"],
    "europäisch": ["european", "europe", "eu"],
    "europäische": ["european", "europe", "eu"],
    "regulierung": ["regulation", "regulatory"],
    "arbeitsmarkt": ["labor market", "labour market", "employment"],
    "gesellschaft": ["society", "social"],
    "gesellschaftlich": ["social", "society"],
    "wohlstand": ["prosperity", "wealth"],
    "sicherheit": ["security", "safety"],
    "resilienz": ["resilience", "resilient"],
    "verteidigung": ["defense", "defence"],
    "bildung": ["education", "educational"],
    "forschung": ["research", "r&d"],
    "innovation": ["innovation", "innovative"],
    "automatisierung": ["automation", "automated", "autonomous"],
    "arbeit": ["work", "labor", "labour"],
    // Wärmepumpen / Gebäudeenergie (C-Pilot)
    "wärmepumpe": ["heat pump", "heat pump system", "hp"],
    "wärmepumpen": ["heat pumps", "heat pump"],
    "heizung": ["heating", "heating system", "boiler"],
    "heizungstausch": ["boiler replacement", "heating replacement", "heat pump adoption"],
    "sanierung": ["renovation", "retrofit", "energy retrofit", "deep renovation"],
    "gebäudesanierung": ["building renovation", "building retrofit", "deep renovation"],
    "energieeffizienz": ["energy efficiency", "efficient buildings"],
    "dämmung": ["insulation", "thermal insulation", "building insulation"],
    "fernwärme": ["district heating", "heat network", "heating grid"],
    "wärmenetz": ["heat network", "district heating"],
    "förderprogramm": ["subsidy program", "incentive scheme", "public funding", "bafa"],
    "gebäudeenergiegesetz": ["building energy act", "geg", "energy standards"],
    "wärmepumpenmarkt": ["heat pump market", "heat pump industry"],
    "gebäude": ["building", "buildings"],
    "dach": ["dach region", "germany austria switzerland"],
    "china": ["china", "chinese", "prc"],
    "russland": ["russia", "russian"],
    "österreich": ["austria", "austrian"],
    "schweiz": ["switzerland", "swiss"],
    "frankreich": ["france", "french"],
    "italien": ["italy", "italian"],
    "spanien": ["spain", "spanish"],
    "polen": ["poland", "polish"],
    "tschechien": ["czech", "czechia", "czech republic"],
    "slowakei": ["slovakia", "slovak"],
    "ungarn": ["hungary", "hungarian"],
    "rumänien": ["romania", "romanian"],
    // 2026-04-22 Pilot-Eval P2-Erweiterung: KI-Agent-Terminologie.
    // B-DE-Query „autonome KI-Agenten" fand 0 Treffer in 215 arxiv-
    // Einträgen und 309 HN-Einträgen, weil nur „ki" als Alias gemappt
    // war. Jetzt explizite Mappings für agent-basierte Konzepte.
    "agent": ["autonomous agent", "ai agent", "llm agent", "agents"],
    "agenten": ["autonomous agents", "llm agents", "agentic ai", "ai agents", "agents"],
    "autonom": ["autonomous", "automated"],
    "autonome": ["autonomous", "automated"],
    "autonomer": ["autonomous", "automated"],
    "autonomes": ["autonomous", "automated"],
    "sprachmodell": ["language model", "llm", "foundation model"],
    "sprachmodelle": ["language models", "llms", "foundation models"],
    "generativ": ["generative", "generative ai", "genai"],
    "generative": ["generative", "generative ai", "genai"],
    "assistent": ["assistant", "copilot", "ai assistant"],
    "assistenten": ["assistants", "copilots", "ai assistants"],
    // Arbeitsmarkt-Ökosystem für B-Themen
    "arbeitsplatz": ["job", "workplace", "employment"],
    "arbeitsplätze": ["jobs", "employment", "workforce"],
    "beschäftigung": ["employment", "employed", "workforce"],
    "fachkräfte": ["skilled workers", "labor force", "workforce"],
    "fachkräftemangel": ["skills shortage", "labor shortage", "skills gap"],
    "umschulung": ["retraining", "reskilling"],
    "weiterbildung": ["upskilling", "continuing education", "professional development"],
    "produktivität": ["productivity"],
    "wettbewerb": ["competition", "competitive"],
    // 2026-04-22 Pilot-Eval P0-A-Follow-Up: Handels- und EU-Policy-
    // Vokabular, das nach dem 6-Connector-Sprint (Bruegel/Politico/IAB/
    // ECIPE/OSW/Clingendael) die Brücke zu den englischsprachigen
    // Artikel-Titeln schlägt. Ohne diese Mappings finden deutsche
    // Strategie-Queries die neuen EU-Policy-Signale nicht, weil
    // „Industriepolitik" als Ein-Wort-Token eben nicht „industrial
    // policy" matcht.
    "industriepolitik": ["industrial policy", "industrial strategy", "industrial accelerator"],
    "handelspolitik": ["trade policy", "trade relations", "trade agreement"],
    "wettbewerbsfähigkeit": ["competitiveness", "competitive", "single market competitiveness"],
    "wettbewerbsrecht": ["competition law", "antitrust", "dma", "dsa"],
    "autonomie": ["autonomy", "sovereignty", "strategic autonomy"],
    "souveränität": ["sovereignty", "strategic autonomy", "digital sovereignty"],
    "abhängigkeit": ["dependency", "dependencies", "trade dependency"],
    "abhängigkeiten": ["dependencies", "dependency", "trade dependencies"],
    "sanktionen": ["sanctions", "restrictive measures", "export controls"],
    "zölle": ["tariff", "tariffs", "customs duties", "duty"],
    "zoll": ["tariff", "customs", "duty"],
    "binnenmarkt": ["single market", "internal market", "eu single market"],
    "dekarbonisierung": ["decarbonization", "decarbonisation", "net zero", "net-zero"],
    "rohstoffe": ["raw materials", "critical raw materials", "critical minerals"],
    "rohstoff": ["raw material", "critical raw material", "mineral"],
    "halbleiter": ["semiconductor", "semiconductors", "chips", "chip act"],
    "kritische": ["critical"],
    "kritischen": ["critical"],
    "kritischer": ["critical"],
    "kritisch": ["critical"],
    "resilient": ["resilient", "resilience"],
    "strategisch": ["strategic"],
    "strategische": ["strategic"],
    "strategischer": ["strategic"],
    "strategisches": ["strategic"],
    // EU-Institutions
    "kommission": ["european commission", "commission", "ec"],
    "parlament": ["european parliament", "europarl"],
    "rat": ["european council", "council of the eu"],
    "zentralbank": ["central bank", "ecb", "european central bank"],
    "ezb": ["ecb", "european central bank"],
    // Geopolitik-Akteure + EU-Inhalte
    "ukraine": ["ukraine", "ukrainian"],
    "nato": ["nato"],
    "verteidigungspolitik": ["defense policy", "defence policy", "security policy"],
    "cybersicherheit_eu": ["eu cyber", "nis2", "cybersecurity act"],
  };

  const aliasLookup = new Map<string, string[]>();
  for (const [key, aliases] of Object.entries(CROSS_LANG_ALIASES)) {
    const group = [key, ...aliases];
    for (const term of group) {
      aliasLookup.set(term, group);
    }
  }

  const baseKeywords = extractQueryKeywords(query);

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
  // 2026-04-22: Cap auf 24 erhöht (war 14). DE-Queries mit erweitertem
  // Alias-Set produzieren leicht 20+ Terms — mit der alten Cap wurden
  // englische Varianten weggeschnitten, was DE-Queries trotz korrekter
  // Aliase 0 Treffer gegen den englischsprachig-dominierten Content-
  // Pool lieferte (Pilot-Eval-A Root-Cause). 24 ist konservativ genug,
  // um den SQL-Score-Compute nicht explodieren zu lassen.
  const keywords = Array.from(expandedSet).slice(0, 24);

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
  const filtered = rows.filter((row) => !isNoiseSignal(row, baseKeywords));

  // Filter 2: Anchor-match + weighted overlap + per-tier threshold.
  //
  // 2026-04-21 generalisation pass. The earlier heuristic stack was a
  // flat 30% overlap (too permissive for short-form content) plus a
  // verbatim word-list filter for social posts (overfit to the one
  // screenshot we had). Both are replaced here by structural rules
  // that apply to any query in any domain:
  //
  //   A) ANCHOR-MATCH — the signal must contain at least one ≥5-char
  //      query keyword (or, if no such keyword exists, at least one
  //      keyword). Short accidental matches on "eu" / "ai" / "us" no
  //      longer qualify as topical fit.
  //
  //   B) WEIGHTED OVERLAP — matched-keyword length sum / total-keyword
  //      length sum. A cheap TF-IDF approximation that weighs rare
  //      (longer) words more. `TIER_MIN_OVERLAP` is evaluated against
  //      this, not the unweighted count.
  //
  //   C) SOCIAL STRUCTURAL NOISE — social-tier signals additionally
  //      must pass `isSocialStructuralNoise`: too short / emoji-heavy /
  //      weight-near-being patterns get dropped. No word list — pattern
  //      captures shape, not specific vocabulary.
  //
  // Each surviving signal carries `keywordOverlap` (= weighted overlap
  // against the query) and `sourceTier` forward, so downstream UI +
  // Orbit scoring can use them as deterministic fallbacks when the LLM
  // has not supplied per-signal queryRelevance.
  // Alias-Gruppen pro Base-Keyword für die Overlap-Berechnung. Jedes
  // Base-Keyword bekommt nur seine eigenen Aliase zugeordnet, damit die
  // Overlap-Metrik base-relativ bleibt (nicht durch alias-Expansion
  // verwässert). Der zweimal aufgerufene Lookup oben hat nur als
  // Source-zu-Alias-Gruppe gedient, hier bauen wir die exakte Map.
  const aliasMap: Record<string, string[]> = {};
  for (const bk of baseKeywords) {
    const group = aliasLookup.get(bk);
    if (group) aliasMap[bk] = group.filter(x => x !== bk);
  }

  const enriched: (LiveSignal & { relevance_score: number; keywordOverlap: number; sourceTier: SourceTier })[] = [];
  for (const row of filtered) {
    // 2026-04-22 Pilot-Eval-Regressions-Fix: Source-Branding-Präfix
    // aus signalText strippen, bevor overlap berechnet wird. Sonst
    // triggert z.B. „ECFR (European Council on Foreign Relations):"
    // den europa→european-Alias unabhängig vom tatsächlichen Paper-
    // Inhalt, und Feeds wie „EU Observer" / „Bloomberg Europe" werden
    // systematisch überbewertet. Die Convention der RSS-Feeds ist
    // `<Quelle-Branding>: <echter Titel>` (Konvention aus rss-feeds.ts).
    const strippedTitle = typeof row.title === "string"
      ? row.title.replace(/^[^:]{1,120}:\s*/, "")
      : row.title;
    const signalText = [strippedTitle, row.topic, row.content?.slice(0, 1000), row.tags]
      .filter(Boolean).join(" ");
    // 2026-04-22 Pilot-Eval-Fix: Overlap gegen BASE-Keywords rechnen,
    // aber Aliase als gültige Match-Varianten pro Base-Keyword
    // zulassen (dritter Parameter). Dadurch bleibt der Nenner stabil
    // bei der Original-Fragenkomplexität — ein „supply chain"-Match
    // zählt als „lieferketten matched", nicht als zusätzlicher Treffer
    // neben „lieferketten". So werden Wintersport-Queries NICHT mehr
    // durch ECFR-EU-Papers noise-gematcht (weil „wintersport" dort
    // fehlt), während Lieferketten-Queries sehr wohl englisch-
    // sprachige Signale finden.
    const stats = computeKeywordStats(baseKeywords, signalText, aliasMap);
    const tier = classifySource(row.source);

    // (A) Anchor-match — skipped when the user explicitly asked about a
    // noise topic (sports, entertainment) so the strict filter does not
    // swallow the signals they actually want.
    if (!stats.anchorMatched && !queryIsAboutNoiseTopic(baseKeywords)) continue;

    // (C) Social-tier structural noise check.
    if (tier === "social" && !queryIsAboutNoiseTopic(baseKeywords) && isSocialStructuralNoise(row)) {
      continue;
    }

    // (B) Weighted overlap against per-tier threshold.
    // Exception: for academic and authoritative sources, anchor-match
    // alone is a sufficient quality gate. Peer-reviewed papers and
    // institutional reports don't produce off-topic content — if an
    // anchor keyword (≥5 chars) appears in the title, the paper is
    // on-topic regardless of the overlap fraction. This prevents complex
    // multi-part queries (many keywords → diluted overlap) from
    // suppressing relevant arxiv / Eurostat / ECFR papers.
    const minOverlap = TIER_MIN_OVERLAP[tier];
    const anchorIsSufficient =
      stats.anchorMatched && (tier === "academic" || tier === "authoritative");
    if (!anchorIsSufficient && stats.weightedOverlap < minOverlap) continue;

    enriched.push({ ...row, keywordOverlap: stats.weightedOverlap, sourceTier: tier });
  }

  // 2026-04-22 Pilot-Eval-Fix P1-Dedup: Signal-Deduplizierung gegen
  // (source, title)-Duplikate aus Multi-Tenant-Pipeline-Polls. Ohne
  // diesen Pass liefert ein Connector wie ecfr_rss leicht 5 Kopien
  // desselben Artikels (weil die RSS-Poll-Logik idempotenz-frei pro
  // Tenant einträgt), die dann 5 Slots der Top-N verbrauchen und den
  // LLM mit 1-2 unique Titles abspeisen. Post-Filter, Pre-Slice —
  // damit die `limit`-Zahl echte unique Signale liefert.
  const deduped = dedupSignalsBySourceTitle(enriched);

  return deduped.slice(0, limit);
}

/**
 * Deduplicates signals by the `(source, normalized-title)` tuple.
 *
 * Two rows with the same source + title are treated as the same signal
 * (the second occurrence is dropped, the first is kept — so combine this
 * with a pre-sort by relevance if you want the highest-scoring variant
 * to survive). Different sources carrying the same title are KEPT as
 * distinct entries — co-reported stories have independent value.
 *
 * Normalisation: whitespace-collapsed + lowercased, so minor formatting
 * variations (trailing newline, double space) still collapse to one.
 *
 * Exported so `scripts/signal-dedup-test.ts` can assert on the logic
 * without going through the full SQL pipeline.
 */
export function dedupSignalsBySourceTitle<T extends { source: string; title: string }>(
  signals: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of signals) {
    const title = typeof row.title === "string" ? row.title : "";
    const normTitle = title.trim().toLowerCase().replace(/\s+/g, " ");
    const key = `${row.source}::${normTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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
