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
const TOTAL_ACTIVE_SOURCES = 10;

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
  return Math.exp(-TIME_DECAY_LAMBDA * daysSince);
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

function normalizeTopic(topic: string): string {
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

  const lower = topic.toLowerCase().trim();
  return aliases[lower] || topic;
}

/**
 * Score a group of signals into a TrendDot
 */
export function scoreTrend(
  group: SignalGroup,
  sourceWeights: SourceWeights = DEFAULT_SOURCE_WEIGHTS,
  _dimensionWeights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS
): TrendDot {
  const { topic, signals } = group;
  const meta = TOPIC_METADATA[topic] || { category: "Other", quadrant: 0 };

  // Relevance: weighted sum of signal strengths with time decay
  const totalWeight = Object.values(sourceWeights).reduce((a, b) => a + b, 0);
  let relevanceSum = 0;
  for (const signal of signals) {
    const weight = sourceWeights[signal.sourceType] ?? 0.5;
    const decay = timeDecay(signal.detectedAt);
    relevanceSum += signal.rawStrength * weight * decay;
  }
  const relevance = Math.min(1, relevanceSum / totalWeight);

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

  // Ring: based on weighted score
  const weightedScore =
    relevance * DEFAULT_DIMENSION_WEIGHTS.relevance +
    confidence * DEFAULT_DIMENSION_WEIGHTS.confidence +
    impact * DEFAULT_DIMENSION_WEIGHTS.impact;

  const ring: Ring =
    weightedScore >= 0.6
      ? "adopt"
      : weightedScore >= 0.4
      ? "trial"
      : weightedScore >= 0.2
      ? "assess"
      : "hold";

  // Velocity: compare recent vs older signals
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
    recentAvg > olderAvg * 1.2
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
