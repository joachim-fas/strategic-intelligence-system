import { TrendDot, Ring } from "@/types";
import { TREND_EDGES, calculateCascadeDepth } from "./causal-graph";

/**
 * Scenario System
 *
 * A scenario is a "What-If" question:
 * "What happens to the radar if Event X occurs?"
 *
 * The system uses:
 * 1. Prediction market probabilities (Polymarket) as base likelihood
 * 2. Causal graph edges to propagate impact through connected trends
 * 3. User-defined impact assumptions
 */

export interface Scenario {
  id: string;
  name: string;
  description: string;
  probability: number; // 0-1, from prediction market or user estimate
  // Which trends are directly affected and by how much
  directImpacts: {
    trendId: string;
    relevanceShift: number;  // -0.5 to +0.5
    confidenceShift: number; // -0.3 to +0.3
    impactShift: number;     // -0.3 to +0.3
  }[];
  // Source of the scenario
  source?: "polymarket" | "user" | "worldmonitor";
  sourceUrl?: string;
}

export interface ScenarioResult {
  scenario: Scenario;
  affectedTrends: {
    trendId: string;
    trendName: string;
    originalRing: Ring;
    newRing: Ring;
    relevanceBefore: number;
    relevanceAfter: number;
    confidenceBefore: number;
    confidenceAfter: number;
    impactType: "direct" | "cascade";
    cascadeDepth: number;
  }[];
  totalAffected: number;
  ringChanges: number;
}

/**
 * Pre-built scenario templates based on common geopolitical/tech events
 */
export const SCENARIO_TEMPLATES: Omit<Scenario, "id">[] = [
  {
    name: "AI Regulation (EU AI Act enforcement)",
    description: "EU begins strict enforcement of AI Act, requiring compliance from all AI providers",
    probability: 0.75,
    directImpacts: [
      { trendId: "mega-ai-transformation", relevanceShift: -0.05, confidenceShift: 0.1, impactShift: 0 },
      { trendId: "macro-generative-ai", relevanceShift: -0.1, confidenceShift: 0.05, impactShift: -0.05 },
      { trendId: "macro-ai-agents", relevanceShift: -0.15, confidenceShift: 0, impactShift: -0.1 },
      { trendId: "mega-security-trust", relevanceShift: 0.1, confidenceShift: 0.1, impactShift: 0.05 },
      { trendId: "macro-data-economy", relevanceShift: 0.1, confidenceShift: 0.05, impactShift: 0.05 },
    ],
    source: "polymarket",
  },
  {
    name: "Taiwan Strait Crisis",
    description: "Major escalation in Taiwan Strait tensions disrupting global semiconductor supply",
    probability: 0.12,
    directImpacts: [
      { trendId: "mega-geopolitical-fracturing", relevanceShift: 0.3, confidenceShift: 0.2, impactShift: 0.2 },
      { trendId: "mega-technological-disruption", relevanceShift: 0.2, confidenceShift: 0, impactShift: 0.15 },
      { trendId: "mega-security-trust", relevanceShift: 0.2, confidenceShift: 0.1, impactShift: 0.15 },
      { trendId: "macro-cybersecurity", relevanceShift: 0.25, confidenceShift: 0.1, impactShift: 0.2 },
      { trendId: "mega-connectivity", relevanceShift: -0.2, confidenceShift: -0.1, impactShift: 0.1 },
    ],
    source: "polymarket",
  },
  {
    name: "AGI Breakthrough",
    description: "A major lab demonstrates general-purpose AI capabilities surpassing human performance",
    probability: 0.08,
    directImpacts: [
      { trendId: "mega-ai-transformation", relevanceShift: 0.5, confidenceShift: 0.3, impactShift: 0.5 },
      { trendId: "macro-generative-ai", relevanceShift: 0.4, confidenceShift: 0.3, impactShift: 0.4 },
      { trendId: "macro-ai-agents", relevanceShift: 0.4, confidenceShift: 0.3, impactShift: 0.4 },
      { trendId: "mega-future-of-work", relevanceShift: 0.3, confidenceShift: 0.2, impactShift: 0.3 },
      { trendId: "mega-security-trust", relevanceShift: 0.2, confidenceShift: 0, impactShift: 0.2 },
      { trendId: "mega-social-instability", relevanceShift: 0.2, confidenceShift: 0, impactShift: 0.15 },
    ],
    source: "user",
  },
  {
    name: "Global Recession 2026-2027",
    description: "Synchronized global recession with GDP contraction in US, EU, and China",
    probability: 0.22,
    directImpacts: [
      { trendId: "mega-social-instability", relevanceShift: 0.3, confidenceShift: 0.15, impactShift: 0.2 },
      { trendId: "mega-geopolitical-fracturing", relevanceShift: 0.15, confidenceShift: 0.05, impactShift: 0.1 },
      { trendId: "mega-energy-transition", relevanceShift: -0.15, confidenceShift: -0.1, impactShift: 0 },
      { trendId: "macro-green-energy", relevanceShift: -0.2, confidenceShift: -0.1, impactShift: 0 },
      { trendId: "macro-circular-economy", relevanceShift: -0.1, confidenceShift: -0.05, impactShift: 0 },
    ],
    source: "polymarket",
  },
  {
    name: "Breakthrough in Fusion Energy",
    description: "Commercial fusion energy achieves net positive energy output at scale",
    probability: 0.03,
    directImpacts: [
      { trendId: "mega-energy-transition", relevanceShift: 0.4, confidenceShift: 0.3, impactShift: 0.5 },
      { trendId: "macro-green-energy", relevanceShift: 0.5, confidenceShift: 0.3, impactShift: 0.5 },
      { trendId: "mega-climate-sustainability", relevanceShift: 0.2, confidenceShift: 0.15, impactShift: 0.1 },
      { trendId: "mega-geopolitical-fracturing", relevanceShift: -0.2, confidenceShift: 0, impactShift: -0.1 },
    ],
    source: "user",
  },
  {
    name: "Major Cyber Attack on Critical Infrastructure",
    description: "State-sponsored cyber attack takes down power grid or financial system in a major economy",
    probability: 0.18,
    directImpacts: [
      { trendId: "mega-security-trust", relevanceShift: 0.3, confidenceShift: 0.2, impactShift: 0.3 },
      { trendId: "macro-cybersecurity", relevanceShift: 0.4, confidenceShift: 0.2, impactShift: 0.3 },
      { trendId: "mega-geopolitical-fracturing", relevanceShift: 0.15, confidenceShift: 0.1, impactShift: 0.1 },
      { trendId: "mega-connectivity", relevanceShift: -0.1, confidenceShift: -0.05, impactShift: 0.1 },
      { trendId: "macro-data-economy", relevanceShift: 0.15, confidenceShift: 0.1, impactShift: 0.1 },
    ],
    source: "worldmonitor",
  },
];

/**
 * Apply a scenario to a set of trends and calculate the full cascade effect
 */
export function applyScenario(
  trends: TrendDot[],
  scenario: Scenario
): ScenarioResult {
  const trendMap = new Map(trends.map((t) => [t.id, { ...t }]));
  const affectedTrends: ScenarioResult["affectedTrends"] = [];

  // Step 1: Apply direct impacts
  for (const impact of scenario.directImpacts) {
    const trend = trendMap.get(impact.trendId);
    if (!trend) continue;

    const originalRing = trend.ring;
    trend.relevance = clamp(trend.relevance + impact.relevanceShift);
    trend.confidence = clamp(trend.confidence + impact.confidenceShift);
    trend.impact = clamp(trend.impact + impact.impactShift);
    trend.ring = calculateRing(trend.relevance, trend.confidence, trend.impact);

    affectedTrends.push({
      trendId: trend.id,
      trendName: trend.name,
      originalRing,
      newRing: trend.ring,
      relevanceBefore: trend.relevance - impact.relevanceShift,
      relevanceAfter: trend.relevance,
      confidenceBefore: trend.confidence - impact.confidenceShift,
      confidenceAfter: trend.confidence,
      impactType: "direct",
      cascadeDepth: 0,
    });
  }

  // Step 2: Propagate cascade effects through the causal graph
  const directIds = new Set(scenario.directImpacts.map((i) => i.trendId));

  for (const impact of scenario.directImpacts) {
    const cascadeTargets = calculateCascadeDepth(impact.trendId, 2);

    for (const targetId of cascadeTargets) {
      if (directIds.has(targetId)) continue; // Already handled directly
      const trend = trendMap.get(targetId);
      if (!trend) continue;

      // Find the edge connecting the impacted trend to this target
      const edge = TREND_EDGES.find(
        (e) => (e.from === impact.trendId && e.to === targetId) ||
               (e.to === impact.trendId && e.from === targetId && e.bidirectional)
      );
      if (!edge) continue;

      // Cascade effect is dampened by edge strength and distance
      const damping = edge.strength * 0.4; // 40% of edge strength
      const cascadeShift = impact.relevanceShift * damping;

      const originalRing = trend.ring;
      const sign = edge.type === "dampens" ? -1 : 1;
      trend.relevance = clamp(trend.relevance + cascadeShift * sign);
      trend.ring = calculateRing(trend.relevance, trend.confidence, trend.impact);

      if (Math.abs(cascadeShift) > 0.01) {
        affectedTrends.push({
          trendId: trend.id,
          trendName: trend.name,
          originalRing,
          newRing: trend.ring,
          relevanceBefore: trend.relevance - cascadeShift * sign,
          relevanceAfter: trend.relevance,
          confidenceBefore: trend.confidence,
          confidenceAfter: trend.confidence,
          impactType: "cascade",
          cascadeDepth: 1,
        });
      }
    }
  }

  const ringChanges = affectedTrends.filter((t) => t.originalRing !== t.newRing).length;

  return {
    scenario,
    affectedTrends: affectedTrends.sort((a, b) =>
      Math.abs(b.relevanceAfter - b.relevanceBefore) - Math.abs(a.relevanceAfter - a.relevanceBefore)
    ),
    totalAffected: affectedTrends.length,
    ringChanges,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function calculateRing(relevance: number, confidence: number, impact: number): Ring {
  const score = relevance * 0.35 + confidence * 0.25 + impact * 0.25 + 0.15 * relevance;
  if (score >= 0.6) return "adopt";
  if (score >= 0.4) return "trial";
  if (score >= 0.2) return "assess";
  return "hold";
}
