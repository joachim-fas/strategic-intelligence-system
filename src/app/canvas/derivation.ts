/**
 * Canvas derivation — deterministic transforms from a `QueryResult`
 * into the derived card cluster that hangs off a main query node.
 *
 * Layout
 * ──────
 *    [MAIN NODE]──► Col A: ERKENNTNISSE (stacked)  │  Col B: SZENARIEN (stacked)  │  Col C: DIMENSIONEN / KAUSALNETZ
 *                           EMPFEHLUNG              │                               │
 *                   ────────────────────────────────────────────────────────────────────
 *                   FOLGEFRAGEN  (horizontal row, full width)
 *
 *   - `computeDerivedNodes(parentId, px, py, result)` produces the
 *     whole cluster with fixed placement so positions are stable.
 *   - `buildDimensionData(matchedTrends)` groups the matched trends
 *     into the four STEEP-ish buckets used by the dimensions card.
 *   - `uid()` — the shared id generator for every new canvas node.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work.
 */

"use client";

import {
  DERIVED_COL_GAP,
  DERIVED_COL_GAP_X,
  DERIVED_ROW_GAP,
  DERIVED_W,
  DIMENSIONS_CARD_H,
  QUERY_NODE_W,
} from "./constants";
import { estimateCardHeight } from "./utils";
import type { DerivedNode } from "./types";
import type { DimensionEntry, MatchedTrend, QueryResult } from "@/types";

const DIMENSION_CONFIG: Array<{
  key: DimensionEntry["key"];
  label: string;
  color: string;
  match: string[];
}> = [
  { key: "technology",           label: "Technologie & Innovation", color: "#3b82f6", match: ["technology", "ai", "digital", "tech", "innovation"] },
  { key: "society",              label: "Gesellschaft & Arbeit",    color: "#f59e0b", match: ["society", "work", "demographics", "education", "health", "labor"] },
  { key: "market_economic",      label: "Wirtschaft & Märkte",      color: "#22c55e", match: ["market", "economic", "business", "finance", "trade", "energy"] },
  { key: "political_environment",label: "Geopolitik & Regulierung", color: "#6366f1", match: ["political", "environment", "regulation", "geopolitics", "governance", "climate"] },
];

export function buildDimensionData(matchedTrends: MatchedTrend[]): DimensionEntry[] {
  // Assign each trend to exactly one dimension (first match wins, priority order
  // defined by DIMENSION_CONFIG: technology → society → market_economic → political_environment).
  const buckets = new Map<DimensionEntry["key"], MatchedTrend[]>(
    DIMENSION_CONFIG.map(cfg => [cfg.key, []])
  );
  for (const trend of matchedTrends) {
    const haystack = [trend.category, ...trend.tags].map(s => s.toLowerCase());
    const matched = DIMENSION_CONFIG.find(cfg =>
      cfg.match.some(m => haystack.some(h => h.includes(m)))
    );
    if (matched) buckets.get(matched.key)!.push(trend);
  }
  return DIMENSION_CONFIG.map(cfg => {
    const trends = buckets.get(cfg.key)!;
    const avgConfidence = trends.length > 0
      ? trends.reduce((s, t) => s + t.confidence, 0) / trends.length
      : 0;
    const rising = trends.filter(t => t.velocity === "rising").length;
    const falling = trends.filter(t => t.velocity === "falling").length;
    const direction: DimensionEntry["direction"] = rising > falling ? "up" : falling > rising ? "down" : "neutral";
    return { label: cfg.label, key: cfg.key, trends, avgConfidence, direction, color: cfg.color };
  });
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback with better entropy
  return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function computeDerivedNodes(parentId: string, px: number, py: number, result: QueryResult): DerivedNode[] {
  const derived: DerivedNode[] = [];
  const now = Date.now();
  const topSources = (result.usedSignals ?? []).slice(0, 3);
  const hasSources = topSources.length > 0;

  const colA_X = px + QUERY_NODE_W + DERIVED_COL_GAP_X;
  const colB_X = colA_X + DERIVED_W + DERIVED_COL_GAP;
  const colC_X = colB_X + DERIVED_W + DERIVED_COL_GAP;

  let colA_Y = py;
  let colB_Y = py;

  // ── Col A: Key Insights ───────────────────────────────────────────────────
  (result.keyInsights ?? []).slice(0, 5).forEach(insight => {
    const h = estimateCardHeight("insight", insight, undefined, hasSources);
    derived.push({
      id: uid(), nodeType: "insight",
      x: colA_X, y: colA_Y,
      parentId, content: insight, queryText: insight,
      sources: topSources,
      createdAt: now,
    });
    colA_Y += h + DERIVED_ROW_GAP;
  });

  // ── Col A: Decision Framework ─────────────────────────────────────────────
  if (result.decisionFramework) {
    const sep = derived.some(n => n.nodeType === "insight") ? 10 : 0;
    colA_Y += sep;
    const h = estimateCardHeight("decision", result.decisionFramework, undefined, hasSources);
    derived.push({
      id: uid(), nodeType: "decision",
      x: colA_X, y: colA_Y,
      parentId,
      content: result.decisionFramework,
      queryText: `Wie lässt sich das konkret umsetzen: ${result.decisionFramework.slice(0, 100)}`,
      sources: topSources,
      createdAt: now,
    });
    colA_Y += h + DERIVED_ROW_GAP;
  }

  // ── Col B: Scenarios (stacked) ────────────────────────────────────────────
  (result.scenarios ?? []).slice(0, 4).forEach(s => {
    const h = estimateCardHeight("scenario", s.description, s.name, hasSources);
    derived.push({
      id: uid(), nodeType: "scenario",
      x: colB_X, y: colB_Y,
      parentId,
      content: s.description,
      label: s.name,
      colorKey: s.type ?? "baseline",
      probability: s.probability,
      keyDrivers: s.keyDrivers ?? [],
      queryText: `Analysiere dieses Szenario tiefer: ${s.name} — ${s.description.slice(0, 100)}`,
      sources: topSources,
      createdAt: now,
    });
    colB_Y += h + DERIVED_ROW_GAP;
  });

  // ── Col C: Dimensions + Causal Graph ──────────────────────────────────────
  let colC_Y = py;
  const matchedTrends = result.matchedTrends ?? [];
  const matchedEdges  = result.matchedEdges  ?? [];

  if (matchedTrends.length >= 3) {
    const dimData = buildDimensionData(matchedTrends);
    derived.push({
      id: uid(), nodeType: "dimensions",
      x: colC_X, y: colC_Y,
      parentId, content: "Trend-Dimensionen", label: "DIMENSIONEN",
      queryText: "Vertiefen: Dimensionsanalyse — welche Bereiche sind am stärksten betroffen?",
      dimensionData: dimData,
      createdAt: now,
    });
    colC_Y += DIMENSIONS_CARD_H + DERIVED_ROW_GAP;
  }

  if (matchedEdges.length >= 2) {
    const trendNameMap: Record<string, string> = {};
    matchedTrends.forEach(t => { trendNameMap[t.id] = t.name; });
    derived.push({
      id: uid(), nodeType: "causalgraph",
      x: colC_X, y: colC_Y,
      parentId, content: "Kausalnetz", label: "KAUSALNETZ",
      queryText: "Vertiefen: Kausalnetz — welche Treiber sind am wirkungsmächtigsten?",
      causalEdges: matchedEdges,
      causalTrendNames: trendNameMap,
      createdAt: now,
    });
  }

  // ── Row below both columns: Follow-up questions ──────────────────────────
  const rowY = Math.max(colA_Y, colB_Y) + 20;
  (result.followUpQuestions ?? []).slice(0, 4).forEach((q, i) => {
    derived.push({
      id: uid(), nodeType: "followup",
      x: colA_X + i * (DERIVED_W + DERIVED_COL_GAP),
      y: rowY,
      parentId, content: q, queryText: q,
      createdAt: now,
    });
  });

  return derived;
}
