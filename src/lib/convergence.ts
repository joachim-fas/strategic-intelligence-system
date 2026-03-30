/**
 * Signal Convergence Engine
 *
 * The most powerful pattern in intelligence analysis:
 * When UNRELATED sources independently point in the same direction,
 * something real is happening.
 *
 * A single HN post about "chip shortage" = noise.
 * HN post + World Monitor conflict data in Taiwan Strait + commodity price spike
 * for rare earths + EU regulation on semiconductor sovereignty
 * = CONVERGENCE EVENT.
 *
 * This is exponentially more valuable than the sum of individual signals.
 */

import { TrendDot } from "@/types";
import { RawSignal } from "@/connectors/types";

export interface ConvergenceEvent {
  id: string;
  trendId: string;
  trendName: string;
  severity: "low" | "medium" | "high" | "critical";
  sourceCount: number;
  sources: ConvergenceSource[];
  detectedAt: Date;
  description: string;
  confidenceBoost: number; // how much to increase the trend's confidence
  relevanceBoost: number;
}

interface ConvergenceSource {
  sourceType: string;
  domain: string; // "tech", "geopolitical", "economic", "climate", "social"
  signalCount: number;
  avgStrength: number;
  latestSignal: Date;
}

// Sources grouped by domain — convergence requires signals from DIFFERENT domains
const SOURCE_DOMAINS: Record<string, string> = {
  hackernews: "tech",
  github: "tech",
  arxiv: "tech",
  stackoverflow: "tech",
  npm_pypi: "tech",
  producthunt: "tech",
  reddit: "social",
  wikipedia: "social",
  news: "media",
  worldmonitor: "geopolitical", // WM spans multiple but primary is geopolitical
  polymarket: "prediction",
  // Authoritative sources by nature
  google_trends: "search",
};

// Higher severity thresholds
const SEVERITY_THRESHOLDS = {
  low: { domains: 2, avgStrength: 0.3 },
  medium: { domains: 3, avgStrength: 0.4 },
  high: { domains: 4, avgStrength: 0.5 },
  critical: { domains: 5, avgStrength: 0.6 },
};

/**
 * Detect convergence events from raw signals
 */
export function detectConvergence(
  signals: RawSignal[],
  existingTrends: TrendDot[],
  windowHours: number = 72 // look at last 72 hours
): ConvergenceEvent[] {
  const events: ConvergenceEvent[] = [];
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Group recent signals by topic
  const topicSignals = new Map<string, RawSignal[]>();
  for (const signal of signals) {
    if (signal.detectedAt < cutoff) continue;
    const topic = signal.topic;
    if (!topicSignals.has(topic)) topicSignals.set(topic, []);
    topicSignals.get(topic)!.push(signal);
  }

  // For each topic, check if signals come from multiple DOMAINS
  for (const [topic, topicSigs] of topicSignals) {
    const domainMap = new Map<string, RawSignal[]>();

    for (const sig of topicSigs) {
      const domain = SOURCE_DOMAINS[sig.sourceType] || "other";
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push(sig);
    }

    const domainCount = domainMap.size;
    if (domainCount < 2) continue; // Need at least 2 different domains

    // Calculate average strength across domains
    const avgStrength = topicSigs.reduce((sum, s) => sum + s.rawStrength, 0) / topicSigs.length;

    // Determine severity
    let severity: ConvergenceEvent["severity"] = "low";
    if (domainCount >= SEVERITY_THRESHOLDS.critical.domains && avgStrength >= SEVERITY_THRESHOLDS.critical.avgStrength) {
      severity = "critical";
    } else if (domainCount >= SEVERITY_THRESHOLDS.high.domains && avgStrength >= SEVERITY_THRESHOLDS.high.avgStrength) {
      severity = "high";
    } else if (domainCount >= SEVERITY_THRESHOLDS.medium.domains && avgStrength >= SEVERITY_THRESHOLDS.medium.avgStrength) {
      severity = "medium";
    }

    // Find matching trend
    const matchedTrend = existingTrends.find(
      (t) => t.name.toLowerCase().includes(topic.toLowerCase()) ||
             t.tags.some((tag) => tag.toLowerCase() === topic.toLowerCase())
    );

    const sources: ConvergenceSource[] = [];
    for (const [domain, domainSigs] of domainMap) {
      sources.push({
        sourceType: domainSigs[0].sourceType,
        domain,
        signalCount: domainSigs.length,
        avgStrength: domainSigs.reduce((s, sig) => s + sig.rawStrength, 0) / domainSigs.length,
        latestSignal: new Date(Math.max(...domainSigs.map((s) => s.detectedAt.getTime()))),
      });
    }

    // Sort sources by average strength descending
    sources.sort((a, b) => b.avgStrength - a.avgStrength);

    const confidenceBoost = Math.min(0.3, domainCount * 0.05 + avgStrength * 0.1);
    const relevanceBoost = Math.min(0.2, (domainCount - 1) * 0.05);

    events.push({
      id: `conv-${topic.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      trendId: matchedTrend?.id || topic.toLowerCase().replace(/\s+/g, "-"),
      trendName: matchedTrend?.name || topic,
      severity,
      sourceCount: domainCount,
      sources,
      detectedAt: new Date(),
      description: buildDescription(topic, sources, severity),
      confidenceBoost,
      relevanceBoost,
    });
  }

  // Sort by severity (critical first) then by source count
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return events.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity] || b.sourceCount - a.sourceCount
  );
}

function buildDescription(topic: string, sources: ConvergenceSource[], severity: string): string {
  const domainNames = sources.map((s) => s.domain);
  return `Signal convergence for "${topic}": ${sources.length} independent domains ` +
    `(${domainNames.join(", ")}) showing correlated activity. ` +
    `Severity: ${severity}. Total signals: ${sources.reduce((s, src) => s + src.signalCount, 0)}.`;
}

/**
 * Apply convergence boosts to trend scores
 */
export function applyConvergenceBoosts(
  trends: TrendDot[],
  events: ConvergenceEvent[]
): TrendDot[] {
  const boostMap = new Map<string, { confidence: number; relevance: number }>();

  for (const event of events) {
    const existing = boostMap.get(event.trendId);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, event.confidenceBoost);
      existing.relevance = Math.max(existing.relevance, event.relevanceBoost);
    } else {
      boostMap.set(event.trendId, {
        confidence: event.confidenceBoost,
        relevance: event.relevanceBoost,
      });
    }
  }

  return trends.map((t) => {
    const boost = boostMap.get(t.id);
    if (!boost) return t;
    return {
      ...t,
      confidence: Math.min(1, t.confidence + boost.confidence),
      relevance: Math.min(1, t.relevance + boost.relevance),
    };
  });
}

/**
 * Format convergence events for the Intelligence Bar
 */
export function formatConvergenceForDisplay(
  events: ConvergenceEvent[],
  locale: "de" | "en"
): string[] {
  return events.map((e) => {
    const severityEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵" }[e.severity];
    const domainList = e.sources.map((s) => s.domain).join(", ");

    if (locale === "de") {
      return `${severityEmoji} KONVERGENZ: "${e.trendName}" — ${e.sourceCount} unabhängige Domänen (${domainList}) zeigen korrelierte Aktivität. Confidence +${(e.confidenceBoost * 100).toFixed(0)}%`;
    }
    return `${severityEmoji} CONVERGENCE: "${e.trendName}" — ${e.sourceCount} independent domains (${domainList}) showing correlated activity. Confidence +${(e.confidenceBoost * 100).toFixed(0)}%`;
  });
}
