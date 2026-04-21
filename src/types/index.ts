export type Ring = "adopt" | "trial" | "assess" | "hold";
export type TimeHorizon = "short" | "mid" | "long";

export type SourceType =
  | "google_trends"
  | "hackernews"
  | "github"
  | "arxiv"
  | "news"
  | "reddit"
  | "stackoverflow"
  | "npm_pypi"
  | "producthunt"
  | "wikipedia"
  | "eurostat"
  | "destatis"
  | "fred"
  | "oecd"
  | "worldbank"
  | "openalex"
  | "owid"
  | "polymarket"
  | "manifold"
  | "nasa_eonet"
  | "worldmonitor"
  | "sentiment"
  | "guardian"
  | "acled"
  | "finnhub"
  | "metaculus"
  | "who_gho"
  | "ilo"
  | "ucdp"
  | "crossref"
  | "semantic_scholar"
  | "un_data"
  | "un_sdg"
  | "imf"
  | "nyt"
  | "newsdata"
  | "open_meteo"
  | "bls"
  | "open_exchange"
  | "media_cloud"
  | "bluesky"
  | "mastodon_api"
  | "docker_hub"
  | "vdem"
  | "patentsview"
  | "kalshi"
  | "youtube_sentiment"
  | "mastodon_sentiment"
  | "news_sentiment";

// ─── Klassifizierung nach Dauer und Reichweite ──────────────────
export type TrendDuration = "hype" | "trend" | "megatrend";

// ─── Klassifizierung nach Art der Veraenderung ──────────────────
export type TrendDirection = "rising" | "stable" | "falling" | "cyclical";

// ─── Klassifizierung nach Fokus (Inhalt) ────────────────────────
export type TrendFocus =
  | "technology"    // Technologische Trends
  | "market"        // Markttrends
  | "society"       // Gesellschaftliche Trends
  | "environment"   // Oekologische Trends
  | "political"     // Politische/regulatorische Trends
  | "economic";     // Wirtschaftliche Trends

export interface TrendClassification {
  // 1. Dauer und Reichweite
  duration: TrendDuration;
  durationYears: string;        // z.B. "0-2", "3-10", "30+"

  // 2. Art der Veraenderung
  direction: TrendDirection;
  momentum: number;             // -1 bis +1, Staerke der Veraenderung

  // 3. Fokus/Inhalt (kann mehrere haben)
  focus: TrendFocus[];

  // 4. Analyse-Methode
  analysisMethod: ("quantitative" | "qualitative" | "visual")[];
}

export interface TrendDot {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  relevance: number;
  confidence: number;
  impact: number;
  timeHorizon: TimeHorizon;
  ring: Ring;
  quadrant: number;
  signalCount: number;
  topSources: string[];
  velocity: "rising" | "stable" | "falling";
  userOverride: boolean;
  // New: structured classification
  classification?: TrendClassification;

  // ── Live signal overlay (filled by Radar/Netzwerk views from /api/v1/feed) ──
  /** Number of live signals matched to this trend in the last 72 hours. */
  signalCount72h?: number;
  /** Average raw signal strength (0-1) for matched signals in the last 72h. */
  avgStrength?: number;
  /** Per-day signal counts for the last 7 days, oldest first. Length = 7. */
  sparkline?: number[];
}

export interface RadarConfig {
  id: string;
  name: string;
  description?: string;
  quadrants: string[];
  sourceWeights: Record<SourceType, number>;
  dimensionWeights: {
    relevance: number;
    confidence: number;
    impact: number;
    recency: number;
  };
}

export const RING_COLORS: Record<Ring, string> = {
  adopt: "#6DDBA0",  // Volt Mint
  trial: "#7AB8F5",  // Volt Sky
  assess: "#F5C87A", // Volt Amber
  hold: "#9CA3AF",   // Neutral
};

export const TIME_HORIZON_COLORS: Record<TimeHorizon, string> = {
  short: "#F4A0B5",  // Volt Rose
  mid: "#7AB8F5",    // Volt Sky
  long: "#D98AE8",   // Volt Orchid
};

export const DURATION_CONFIG: Record<TrendDuration, { label: { de: string; en: string }; color: string; icon: string }> = {
  hype: { label: { de: "Hype / Mode", en: "Hype / Fad" }, color: "#f97316", icon: "⚡" },
  trend: { label: { de: "Trend", en: "Trend" }, color: "#3b82f6", icon: "📈" },
  megatrend: { label: { de: "Megatrend", en: "Megatrend" }, color: "#8b5cf6", icon: "🌊" },
};

export const DIRECTION_CONFIG: Record<TrendDirection, { label: { de: string; en: string }; color: string; icon: string }> = {
  rising: { label: { de: "Aufwärtstrend", en: "Uptrend" }, color: "#22c55e", icon: "↗" },
  stable: { label: { de: "Seitwärtstrend", en: "Sideways" }, color: "#6b7280", icon: "→" },
  falling: { label: { de: "Abwärtstrend", en: "Downtrend" }, color: "#ef4444", icon: "↘" },
  cyclical: { label: { de: "Zyklustrend", en: "Cyclical" }, color: "#f59e0b", icon: "↻" },
};

export const FOCUS_CONFIG: Record<TrendFocus, { label: { de: string; en: string }; color: string; icon: string }> = {
  technology: { label: { de: "Technologisch", en: "Technology" }, color: "#3b82f6", icon: "💻" },
  market: { label: { de: "Markt", en: "Market" }, color: "#22c55e", icon: "📊" },
  society: { label: { de: "Gesellschaft", en: "Society" }, color: "#f59e0b", icon: "👥" },
  environment: { label: { de: "Ökologie", en: "Environment" }, color: "#10b981", icon: "🌿" },
  political: { label: { de: "Politik/Regulierung", en: "Political" }, color: "#6366f1", icon: "⚖️" },
  economic: { label: { de: "Wirtschaft", en: "Economic" }, color: "#ec4899", icon: "💰" },
};

export const DEFAULT_QUADRANTS = [
  "Technology & AI",
  "Business & Society",
  "Development & Engineering",
  "Data & Infrastructure",
];

// ─── Shared Canvas / Analysis Types ─────────────────────────

/**
 * Source authority classification — drives UI weighting, relevance
 * thresholds in the retrieval filter, and the evidence-vs-noise
 * decision in the BriefingResult Live-Signale section.
 *
 * Motivated by the 2026-04-21 Wintersport-Bug: a Bluesky personal post
 * ("Best babysitter ❤️") passed both the keyword-overlap filter and
 * the source-topic coherence filter, appeared in the Live-Signale
 * section of a strategic-intelligence query as if it were evidence.
 * Tiering lets us apply topic thresholds commensurate with the source's
 * editorial authority.
 *
 *  - "authoritative": UN, IPCC, ECFR, EUR-Lex, government publications
 *  - "media":         edited news outlets (Spiegel, Al Jazeera, Guardian)
 *  - "academic":      peer-reviewed / preprint (arxiv, nature, crossref)
 *  - "social":        Bluesky, Mastodon, Reddit — personal/unedited
 *  - "proxy":         prediction markets, ngram corpora — aggregate
 *                     signals, not content-as-evidence
 */
export type SourceTier = "authoritative" | "media" | "academic" | "social" | "proxy";

export interface UsedSignal {
  source: string;
  title: string;
  url?: string;
  strength?: number;
  date?: string;
  /**
   * First ~220 characters of the signal's content field (article snippet,
   * abstract, lead paragraph). Provided by `query/route.ts` after
   * reading from `live_signals.content`. Serves the Briefing UI as
   * preview text below the signal title so users can judge relevance
   * without leaving the page. Absent when the source did not deliver
   * a usable content/snippet field.
   */
  snippet?: string;
  /**
   * Fraction of query keywords matched in this signal's text [0, 1].
   * Set by `getRelevantSignals` during retrieval. Serves as the
   * deterministic fallback for topical relevance when the LLM has not
   * supplied `queryRelevance`.
   */
  keywordOverlap?: number;
  /**
   * Source authority class — drives per-tier relevance thresholds in
   * the Orbit and Briefing UIs. See `SourceTier` for the taxonomy.
   */
  sourceTier?: SourceTier;
  /**
   * Per-query topical relevance [0, 1] optionally supplied by the LLM.
   * Preferred over `keywordOverlap` by consumers. Absent when the LLM
   * did not score this signal or did not include it in its output.
   */
  queryRelevance?: number;
}

export interface Scenario {
  type?: "optimistic" | "baseline" | "pessimistic" | "wildcard" | string;
  name: string;
  description: string;
  probability: number;
  timeframe?: string;
  keyDrivers?: string[];
}

export interface Reference {
  title: string;
  url: string;
  relevance?: string;
}

export interface MatchedTrend {
  id: string;
  name: string;
  category: string;
  tags: string[];
  relevance: number;
  confidence: number;
  impact: number;
  velocity: string;
  ring: string;
  signalCount: number;
  /**
   * Per-query relevance of this trend to the specific question — in [0, 1].
   * Supplied by the LLM match step when it judges how load-bearing this trend
   * is for THIS query (not the trend's global relevance). Consumed by the
   * Orbit derivation spine to filter off-topic matches. Optional for
   * backward compatibility — consumers fall back to
   * `relevance × confidence` when absent.
   */
  queryRelevance?: number;
}

export interface MatchedEdge {
  from: string;
  to: string;
  type: "drives" | "amplifies" | "dampens" | "correlates" | string;
  strength: number;
  description?: string;
  /**
   * Per-query relevance of this causal edge to the specific question — in [0, 1].
   * Supplied by the LLM; optional for backward compatibility.
   */
  queryRelevance?: number;
}

export interface DimensionEntry {
  label: string;
  key: "technology" | "society" | "market_economic" | "political_environment";
  trends: MatchedTrend[];
  avgConfidence: number;
  direction: "up" | "down" | "neutral";
  color: string;
}

export interface QueryResult {
  synthesis?: string;
  reasoningChains?: string[];
  matchedTrendIds?: string[];
  keyInsights?: string[];
  scenarios?: Scenario[];
  decisionFramework?: string;
  references?: Reference[];
  followUpQuestions?: string[];
  confidence?: number;
  interpretation?: string;
  newsContext?: string;
  regulatoryContext?: string[];
  causalAnalysis?: string[];
  usedSignals?: UsedSignal[];
  matchedTrends?: MatchedTrend[];
  matchedEdges?: MatchedEdge[];
}
