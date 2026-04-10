import { buildDeclarativeConnector } from "./framework";

/**
 * Google Books Ngram Viewer — Long-range cultural Makro-Trends.
 *
 * Google's Ngram Viewer measures how often phrases appear in a ~8-million-
 * book corpus spanning 1800–2019. Unlike Google Trends (which is limited
 * to the last ~20 years and is noisy), Ngrams reveal multi-decade shifts
 * in what cultures think, write, and publish about — the closest thing
 * we have to a "paper trail of civilization".
 *
 * For SIS we track a curated seed list of 30 strategically-relevant phrases
 * and use the most-recent 5-year delta as the signal. A phrase with a
 * strongly-rising 5-year trajectory is a macro-adoption signal; a phrase
 * in free-fall is a fading concept.
 *
 * Important caveat about the corpus: Google stopped updating Ngrams past
 * 2019 (the 2020 re-release added a few years but coverage for very recent
 * terms is spotty). We therefore query a window up to the last reliable
 * year (2019) — this is a LAGGING indicator by design. The value is in
 * detecting decade-scale baseline shifts that real-time signals miss, not
 * in chasing hot news.
 *
 * Endpoint: https://books.google.com/ngrams/json?content=...&year_start=...
 *
 * Response shape (already array-friendly, no transformResponse needed):
 *   [
 *     { "ngram": "AI", "parent": "", "type": "NGRAM", "timeseries": [...] },
 *     { "ngram": "quantum computing", "type": "NGRAM", "timeseries": [...] },
 *     ...
 *   ]
 *
 * No auth, no rate limit documented, one call per pipeline run.
 */

// ── Seed list ───────────────────────────────────────────────────────────────
//
// 30 ngrams chosen to map cleanly onto existing SIS trend topics. The keys
// must come from the DB (see `trends.name`). Phrases are lowercase-safe for
// the Google endpoint; mixed case works too but we keep them flat for
// stability.
//
// Picking rules:
//   - Prefer multi-word phrases — they disambiguate ("AI" alone is noisy,
//     "artificial intelligence" is cleaner)
//   - Avoid phrases that shift meaning across decades (e.g. "cloud")
//   - Include one phrase per distinct trend so no trend dominates
const NGRAM_SEEDS: ReadonlyArray<{ phrase: string; topic: string }> = [
  { phrase: "artificial intelligence",    topic: "Artificial Intelligence & Automation" },
  { phrase: "machine learning",           topic: "Generative AI & Foundation Models" },
  { phrase: "neural network",             topic: "Generative AI & Foundation Models" },
  { phrase: "autonomous systems",         topic: "AI Agents & Autonomous Systems" },
  { phrase: "human-machine interaction",  topic: "Human-Machine Collaboration" },
  { phrase: "climate change",             topic: "Climate Change & Sustainability" },
  { phrase: "renewable energy",           topic: "Renewable Energy & Green Tech" },
  { phrase: "circular economy",           topic: "Circular Economy" },
  { phrase: "energy transition",          topic: "Energy Transition & Decarbonization" },
  { phrase: "quantum computing",          topic: "Quantum Computing" },
  { phrase: "cybersecurity",              topic: "Cybersecurity & Zero Trust" },
  { phrase: "data sovereignty",           topic: "Data Economy & Data Sovereignty" },
  { phrase: "edge computing",             topic: "Edge Computing & IoT" },
  { phrase: "cloud native",               topic: "Cloud Native & Multi-Cloud" },
  { phrase: "digital health",             topic: "Digital Health & Telemedicine" },
  { phrase: "personalized medicine",      topic: "Genomics & Personalized Medicine" },
  { phrase: "longevity",                  topic: "Health, Biotech & Longevity" },
  { phrase: "aging population",           topic: "Demographic Shifts & Aging" },
  { phrase: "future of work",             topic: "Future of Work" },
  { phrase: "remote work",                topic: "Remote & Hybrid Work" },
  { phrase: "upskilling",                 topic: "Skills Gap & Upskilling" },
  { phrase: "lifelong learning",          topic: "Knowledge Culture & Lifelong Learning" },
  { phrase: "platform economy",           topic: "Platform Economy & Ecosystems" },
  { phrase: "creator economy",            topic: "Attention Economy & Creator Platforms" },
  { phrase: "smart city",                 topic: "Urbanization & Smart Cities" },
  { phrase: "geopolitical risk",          topic: "Geopolitical Fragmentation" },
  { phrase: "migration",                  topic: "Migration & Displacement" },
  { phrase: "social inequality",          topic: "Social Instability & Inequality" },
  { phrase: "blockchain",                 topic: "Web3 & Decentralization" },
  { phrase: "augmented reality",          topic: "Spatial Computing & XR" },
];

// Ngram Viewer caps URL length — keep the query compact by batching all
// phrases into a single comma-separated `content` parameter. The API
// happily returns one entry per phrase in one response.
const TOPIC_MAP = new Map(NGRAM_SEEDS.map((s) => [s.phrase.toLowerCase(), s.topic]));
const PHRASE_LIST = NGRAM_SEEDS.map((s) => s.phrase).join(",");
// NOTE: CON-22 — Google Ngram Viewer data extends only to 2019. This is a
// data source limitation, not a bug. Use for historical trend analysis only.

// 2015–2019 is the last 5 years with reliable coverage in the 2020 corpus.
const YEAR_START = 2015;
const YEAR_END = 2019;

interface NgramRow {
  ngram: string;
  parent: string;
  type: string;
  timeseries: number[];
}

export const googleNgramConnector = buildDeclarativeConnector<NgramRow>({
  name: "google-ngram",
  displayName: "Google Books Ngram (Cultural Macro)",
  endpoint:
    "https://books.google.com/ngrams/json" +
    `?content=${encodeURIComponent(PHRASE_LIST)}` +
    `&year_start=${YEAR_START}&year_end=${YEAR_END}` +
    "&corpus=en&smoothing=3",
  defaultTopic: "Knowledge Culture & Lifelong Learning", // fallback only
  defaultSignalType: "mention",
  // The seed list is curated — no reason to drop any row with a valid
  // timeseries. We set a low threshold so all 30 phrases flow through.
  minStrength: 0.05,
  limit: 60, // plenty of headroom — seed list is 30, API never returns more
  map: (row) => {
    if (!row.ngram || !Array.isArray(row.timeseries) || row.timeseries.length < 2) return null;
    const ts = row.timeseries;
    const first = ts[0];
    const last = ts[ts.length - 1];
    if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null;
    const ratio = last / first; // 1.2 = 20% growth over the window
    // Strength: convert the 5y ratio into [0..1].
    //   - doubling (×2.0) saturates to 1.0
    //   - halving (÷2.0) saturates to 1.0
    //   - flat (×1.0) lands at 0
    // We use log2 of the ratio because ngrams are multiplicatively distributed.
    const logRatio = Math.log2(ratio);
    const strength = Math.min(1, Math.abs(logRatio));
    if (!Number.isFinite(strength) || strength <= 0) return null;
    const topic = TOPIC_MAP.get(row.ngram.toLowerCase()) ?? "Knowledge Culture & Lifelong Learning";
    // Format the trajectory as a human-readable string.
    const pct = ((ratio - 1) * 100).toFixed(0);
    const direction = ratio > 1.05 ? "↗" : ratio < 0.95 ? "↘" : "→";
    return {
      sourceUrl:
        `https://books.google.com/ngrams/graph?content=${encodeURIComponent(row.ngram)}` +
        `&year_start=${YEAR_START}&year_end=${YEAR_END}&corpus=en&smoothing=3`,
      sourceTitle: `"${row.ngram}" ${direction} ${pct}% (${YEAR_START}–${YEAR_END} corpus frequency)`,
      topic,
      rawStrength: strength,
      rawData: {
        ngram: row.ngram,
        firstYearValue: first,
        lastYearValue: last,
        ratio,
        logRatio,
        yearStart: YEAR_START,
        yearEnd: YEAR_END,
        timeseries: ts,
      },
    };
  },
});
