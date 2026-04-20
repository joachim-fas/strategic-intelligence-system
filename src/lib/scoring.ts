import { RawSignal } from "@/connectors/types";
import { TrendDot, Ring, TimeHorizon, SourceType } from "@/types";

interface SignalGroup {
  topic: string;
  signals: RawSignal[];
}

interface SourceWeights {
  [key: string]: number;
}

interface DimensionWeights {
  relevance: number;
  confidence: number;
  impact: number;
  recency: number;
}

const DEFAULT_SOURCE_WEIGHTS: SourceWeights = {
  google_trends: 1.0,
  hackernews: 1.0,
  github: 1.0,
  arxiv: 0.7,
  news: 0.9,
  reddit: 0.8,
  stackoverflow: 0.7,
  npm_pypi: 0.6,
  producthunt: 0.5,
  wikipedia: 0.4,
};

const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  relevance: 0.35,
  confidence: 0.25,
  impact: 0.25,
  recency: 0.15,
};

const TIME_DECAY_LAMBDA = 0.05; // half-life ~14 days

// H4-FIX: Compute active source count dynamically from connector registry
// instead of hardcoded 54 which deflates all confidence scores.
function getActiveSourceCount(): number {
  try {
    const { connectors } = require("@/connectors/index");
    return connectors?.length || 10; // fallback to conservative estimate
  } catch {
    return 10; // If connectors can't load, use realistic fallback
  }
}
const TOTAL_ACTIVE_SOURCES = getActiveSourceCount();

// Map topics to categories and quadrants
const TOPIC_METADATA: Record<string, { category: string; quadrant: number }> = {
  AI: { category: "AI/ML", quadrant: 0 },
  LLM: { category: "AI/ML", quadrant: 0 },
  "Machine Learning": { category: "AI/ML", quadrant: 0 },
  RAG: { category: "AI/ML", quadrant: 0 },
  Embeddings: { category: "AI/ML", quadrant: 0 },
  "Vector Database": { category: "Data", quadrant: 3 },
  Rust: { category: "Languages", quadrant: 2 },
  Go: { category: "Languages", quadrant: 2 },
  Python: { category: "Languages", quadrant: 2 },
  TypeScript: { category: "Languages", quadrant: 2 },
  JavaScript: { category: "Languages", quadrant: 2 },
  React: { category: "Frontend", quadrant: 2 },
  "Next.js": { category: "Frontend", quadrant: 2 },
  Svelte: { category: "Frontend", quadrant: 2 },
  WebAssembly: { category: "Runtime", quadrant: 3 },
  Kubernetes: { category: "Infrastructure", quadrant: 3 },
  Docker: { category: "Infrastructure", quadrant: 3 },
  "Edge Computing": { category: "Infrastructure", quadrant: 3 },
  Security: { category: "Security", quadrant: 0 },
  Privacy: { category: "Security", quadrant: 0 },
  Blockchain: { category: "Distributed Systems", quadrant: 0 },
  "Quantum Computing": { category: "Emerging", quadrant: 3 },
  Robotics: { category: "Emerging", quadrant: 1 },
  IoT: { category: "Infrastructure", quadrant: 3 },
  "Green Tech": { category: "Sustainability", quadrant: 1 },
  Fintech: { category: "Finance", quadrant: 1 },
  Biotech: { category: "Life Sciences", quadrant: 1 },
};

function timeDecay(detectedAt: Date): number {
  const daysSince = (Date.now() - detectedAt.getTime()) / (1000 * 60 * 60 * 24);
  // Clamp to [0, 1]: future signals must not amplify (daysSince < 0 => decay > 1)
  return Math.min(1.0, Math.max(0, Math.exp(-TIME_DECAY_LAMBDA * daysSince)));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Group raw signals by topic using fuzzy matching
 */
export function groupSignalsByTopic(signals: RawSignal[]): SignalGroup[] {
  const groups = new Map<string, RawSignal[]>();

  for (const signal of signals) {
    const normalizedTopic = normalizeTopic(signal.topic);
    const existing = groups.get(normalizedTopic);
    if (existing) {
      existing.push(signal);
    } else {
      groups.set(normalizedTopic, [signal]);
    }
  }

  return Array.from(groups.entries()).map(([topic, signals]) => ({
    topic,
    signals,
  }));
}

export function normalizeTopic(topic: string): string {
  // Normalize common variations
  const aliases: Record<string, string> = {
    "artificial intelligence": "AI",
    ai: "AI",
    llm: "LLM",
    "large language model": "LLM",
    "large language models": "LLM",
    ml: "Machine Learning",
    "machine learning": "Machine Learning",
    rust: "Rust",
    golang: "Go",
    go: "Go",
    python: "Python",
    typescript: "TypeScript",
    javascript: "JavaScript",
    react: "React",
    "next.js": "Next.js",
    nextjs: "Next.js",
    svelte: "Svelte",
    wasm: "WebAssembly",
    webassembly: "WebAssembly",
    k8s: "Kubernetes",
    kubernetes: "Kubernetes",
    docker: "Docker",
    blockchain: "Blockchain",
    crypto: "Blockchain",
    "quantum computing": "Quantum Computing",
    quantum: "Quantum Computing",
    "edge computing": "Edge Computing",
    security: "Security",
    cybersecurity: "Security",
    privacy: "Privacy",
    robotics: "Robotics",
    iot: "IoT",
    fintech: "Fintech",
    biotech: "Biotech",
    "green tech": "Green Tech",
    sustainability: "Green Tech",
    rag: "RAG",
    embedding: "Embeddings",
    embeddings: "Embeddings",
    "vector database": "Vector Database",
    vectordb: "Vector Database",
  };

  // Canonical normalization: lowercase, trim, collapse whitespace
  const lower = topic.toLowerCase().trim().replace(/\s+/g, " ");
  // Return alias if known, otherwise the normalized form for consistent grouping
  return aliases[lower] || lower;
}

/**
 * Score a group of signals into a TrendDot
 */
export function scoreTrend(
  group: SignalGroup,
  sourceWeights: SourceWeights = DEFAULT_SOURCE_WEIGHTS,
  dimensionWeights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS
): TrendDot {
  const { topic, signals } = group;
  const meta = TOPIC_METADATA[topic] || { category: "Other", quadrant: 0 };

  // ALG-08: Relevance uses average weighted strength * coverage factor.
  // Dividing by signal count prevents volume from dominating quality.
  // The coverage factor (0.6 base + 0.4 * min(1, count/10)) rewards breadth sub-linearly.
  const totalWeight = Object.values(sourceWeights).reduce((a, b) => a + b, 0);
  let relevanceSum = 0;
  for (const signal of signals) {
    const weight = sourceWeights[signal.sourceType] ?? 0.5;
    const decay = timeDecay(signal.detectedAt);
    relevanceSum += signal.rawStrength * weight * decay;
  }
  const avgRelevance = signals.length > 0 ? relevanceSum / signals.length : 0;
  const coverageFactor = Math.min(1, signals.length / 10);
  const relevance = Math.min(1, (avgRelevance / totalWeight) * (0.6 + 0.4 * coverageFactor));

  // Confidence: number of distinct sources / total
  const distinctSources = new Set(signals.map((s) => s.sourceType)).size;
  const confidence = Math.min(1, distinctSources / TOTAL_ACTIVE_SOURCES);

  // Impact: combination of magnitude and breadth
  const avgStrength =
    signals.reduce((sum, s) => sum + s.rawStrength, 0) / signals.length;
  const breadth = distinctSources / TOTAL_ACTIVE_SOURCES;
  const impact = Math.min(1, avgStrength * 0.6 + breadth * 0.4);

  // Time horizon: based on signal composition
  const timeHorizon = determineTimeHorizon(signals);

  // Recency: best (most recent) signal's time decay
  const recency = signals.length
    ? Math.max(...signals.map((s) => timeDecay(s.detectedAt)))
    : 0;

  // ALG-23: Ring uses caller-supplied dimension weights (defaults to DEFAULT_DIMENSION_WEIGHTS).
  const weightedScore =
    relevance * dimensionWeights.relevance +
    confidence * dimensionWeights.confidence +
    impact * dimensionWeights.impact +
    recency * dimensionWeights.recency;

  const ring: Ring = calculateRing(weightedScore);

  // Velocity: compare recent vs older signals
  // ALG-09: Require minimum 3 signals in each half to avoid deterministic
  // artifacts from sparse data. With fewer signals, default to "stable".
  const now = Date.now();
  const midpoint = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
  const recentSignals = signals.filter((s) => s.detectedAt.getTime() > midpoint);
  const olderSignals = signals.filter((s) => s.detectedAt.getTime() <= midpoint);
  const recentAvg = recentSignals.length
    ? recentSignals.reduce((s, sig) => s + sig.rawStrength, 0) / recentSignals.length
    : 0;
  const olderAvg = olderSignals.length
    ? olderSignals.reduce((s, sig) => s + sig.rawStrength, 0) / olderSignals.length
    : 0;
  const velocity: "rising" | "stable" | "falling" =
    recentSignals.length < 3 || olderSignals.length < 3
      ? "stable"
      : recentAvg > olderAvg * 1.2
        ? "rising"
        : recentAvg < olderAvg * 0.8
          ? "falling"
          : "stable";

  // Top sources by signal count
  const sourceCounts = new Map<string, number>();
  for (const s of signals) {
    sourceCounts.set(s.sourceType, (sourceCounts.get(s.sourceType) || 0) + 1);
  }
  const topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return {
    id: slugify(topic),
    name: topic,
    category: meta.category,
    tags: [meta.category.toLowerCase(), ...signals.flatMap((s) => [s.sourceType])].filter(
      (v, i, a) => a.indexOf(v) === i
    ).slice(0, 5),
    relevance,
    confidence,
    impact,
    timeHorizon,
    ring,
    quadrant: meta.quadrant,
    signalCount: signals.length,
    topSources,
    velocity,
    userOverride: false,
  };
}

/**
 * Shared ring classification from a pre-computed weighted score.
 * Thresholds are identical to scenarios.ts — keep in sync.
 */
export function calculateRing(score: number): Ring {
  if (score >= 0.6) return "adopt";
  if (score >= 0.4) return "trial";
  if (score >= 0.2) return "assess";
  return "hold";
}

function determineTimeHorizon(signals: RawSignal[]): TimeHorizon {
  // Reactive sources = short-term indicators
  const reactive = ["hackernews", "news", "reddit", "producthunt"];
  // Leading sources = long-term indicators
  const leading = ["arxiv", "github"];

  let reactiveCount = 0;
  let leadingCount = 0;

  for (const s of signals) {
    if (reactive.includes(s.sourceType)) reactiveCount++;
    if (leading.includes(s.sourceType)) leadingCount++;
  }

  const total = signals.length || 1;
  if (reactiveCount / total > 0.6) return "short";
  if (leadingCount / total > 0.5) return "long";
  return "mid";
}

/**
 * Process all raw signals into scored TrendDots
 * Requires minimum 2 signals for a trend to appear (reduces noise)
 */
export function processSignals(
  signals: RawSignal[],
  sourceWeights?: SourceWeights,
  dimensionWeights?: DimensionWeights,
  minSignals: number = 2
): TrendDot[] {
  const groups = groupSignalsByTopic(signals);
  return groups
    .filter((g) => g.signals.length >= minSignals)
    .map((g) => scoreTrend(g, sourceWeights, dimensionWeights))
    .sort((a, b) => b.relevance - a.relevance);
}

// ═════════════════════════════════════════════════════════════════════
// Notion v0.2 — Calibrated Confidence Formula
//
// Replaces the LLM-self-reported confidence with a deterministic, weighted
// composite of five measurable factors. Matches the spec from
// https://www.notion.so/SIS-Prompt-Bibliothek-76a86ccd7e92443f952e75f4a1159370
// (section 2.5 Confidence Calibration):
//
//   confidence = (
//     signalCoverage    * 0.30 +
//     signalRecency     * 0.25 +
//     signalStrength    * 0.20 +
//     sourceVerification* 0.15 +
//     causalCoverage    * 0.10
//   ) * 100
//
// Each input is a [0, 1] score. The output is 0-100 (not 0-1) to match
// the Notion interpretation bands (80-100 high / 60-79 medium / 40-59 low).
// Callers that need 0-1 divide by 100. The companion band() helper returns
// the human label.
// ═════════════════════════════════════════════════════════════════════

export interface ConfidenceCalibrationInputs {
  /** Fraction of relevant signal types covered. [0, 1]. */
  signalCoverage: number;
  /** Newest signal age: < 24h = 1.0, < 48h = 0.7, < 72h = 0.4, older = 0.1. */
  signalRecency: number;
  /** Average rawScore of used signals, normalized. [0, 1]. */
  signalStrength: number;
  /** Fraction of claims attributable to non-LLM sources. [0, 1]. */
  sourceVerification: number;
  /** Fraction of causal links present in the edge graph. [0, 1]. */
  causalCoverage: number;
  /**
   * Critical-Fix-Plan P3-1 (Notion 2026-04-20): Anteil Referenzen auf
   * verifizierten Domains (KNOWN_DOMAINS-Allowlist aus validation.ts).
   * Optional — wenn der Caller es nicht setzt, fällt die Berechnung auf
   * 0.5 (neutral) zurück, damit alte Pfade keinen Confidence-Verlust
   * erleben. [0, 1].
   */
  refVerification?: number;
}

export interface CalibratedConfidence {
  score: number;           // 0-100
  band: "high" | "medium" | "low" | "very_low";
  /** The three highest-weight factors that LIMITED confidence, in descending order. */
  limitingFactors: Array<{ factor: keyof ConfidenceCalibrationInputs; contribution: number; missing: number }>;
}

/**
 * Notion v0.2 (28/22/18/14/8) plus Critical-Fix-Plan P3-1 (+10%
 * refVerification). Die Summe der 6 Gewichte = 1.00.
 *
 * Designprinzip: die Prompt-Anweisungen im System-Prompt spiegeln
 * die v0.2-Formel wider (signalCoverage 30% etc.). Bei der Migration
 * auf 6 Faktoren wurden alle v0.2-Gewichte proportional um 7% gekürzt
 * und refVerification mit 10% dazugegeben. Der LLM-seitige "self-score"-
 * Vergleich stimmt weiter grob, und die neue Dimension (Anteil
 * verifizierter Refs gegen KNOWN_DOMAINS-Allowlist) belohnt Queries
 * mit Zitaten auf autoritativen Quellen.
 */
const CONFIDENCE_WEIGHTS: Record<keyof ConfidenceCalibrationInputs, number> = {
  signalCoverage: 0.28,
  signalRecency: 0.22,
  signalStrength: 0.18,
  sourceVerification: 0.14,
  causalCoverage: 0.08,
  refVerification: 0.10,
};

export function computeCalibratedConfidence(
  inputs: ConfidenceCalibrationInputs,
): CalibratedConfidence {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
  const norm: Required<ConfidenceCalibrationInputs> = {
    signalCoverage: clamp01(inputs.signalCoverage),
    signalRecency: clamp01(inputs.signalRecency),
    signalStrength: clamp01(inputs.signalStrength),
    sourceVerification: clamp01(inputs.sourceVerification),
    causalCoverage: clamp01(inputs.causalCoverage),
    // Wenn der Caller refVerification nicht setzt (z.B. alte Pfade
    // ohne KNOWN_DOMAINS-Check), nutzen wir 0.5 als neutralen Wert —
    // halber Bonus, halber Abschlag, beeinflusst die Summe also nur
    // marginal.
    refVerification: clamp01(inputs.refVerification ?? 0.5),
  };

  const rawScore =
    norm.signalCoverage    * CONFIDENCE_WEIGHTS.signalCoverage +
    norm.signalRecency     * CONFIDENCE_WEIGHTS.signalRecency +
    norm.signalStrength    * CONFIDENCE_WEIGHTS.signalStrength +
    norm.sourceVerification* CONFIDENCE_WEIGHTS.sourceVerification +
    norm.causalCoverage    * CONFIDENCE_WEIGHTS.causalCoverage +
    norm.refVerification   * CONFIDENCE_WEIGHTS.refVerification;

  const score = Math.round(rawScore * 100);

  // Which factors LIMITED the score most? For each factor: its "missing"
  // contribution is (1 - factor) * weight. The top 3 of those tell us
  // what to report in dataQuality.coverageGaps.
  const limitingFactors = (Object.entries(norm) as Array<[keyof ConfidenceCalibrationInputs, number]>)
    .map(([factor, value]) => ({
      factor,
      contribution: value * CONFIDENCE_WEIGHTS[factor],
      missing: (1 - value) * CONFIDENCE_WEIGHTS[factor],
    }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 3);

  const band: CalibratedConfidence["band"] =
    score >= 80 ? "high" :
    score >= 60 ? "medium" :
    score >= 40 ? "low" :
                  "very_low";

  return { score, band, limitingFactors };
}

/**
 * Helper: map a "newest signal age" (in hours) to the Notion v0.2 recency curve.
 * < 24h = 1.0, < 48h = 0.7, < 72h = 0.4, older = 0.1.
 */
export function recencyFromHours(hours: number | null | undefined): number {
  if (hours == null || !Number.isFinite(hours)) return 0.1;
  if (hours < 24) return 1.0;
  if (hours < 48) return 0.7;
  if (hours < 72) return 0.4;
  return 0.1;
}

/**
 * Notion v0.2 confidence decay for stored analyses: 3% per day
 * (exponential). 30-day-old analysis ≈ 40% reduction. Useful for the
 * history view, where older briefings should carry visible weathering.
 */
export function decayStoredConfidence(
  originalScore: number,
  daysElapsed: number,
): number {
  const decayed = originalScore * Math.exp(-0.03 * Math.max(0, daysElapsed));
  return Math.round(decayed * 100) / 100;
}
