"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  HelpCircle, Radio, TrendingUp, GitBranch, Lightbulb, GitFork,
  CheckCircle2, ChevronRight, ChevronDown, X, ExternalLink,
} from "lucide-react";
import type { UsedSignal, MatchedTrend, MatchedEdge, QueryResult } from "@/types";

/* ═══════════════════════════════════════════════════════════════════════════
   OrbitDerivationView — 7-stage left-to-right derivation chain.

   Answers "where did this come from?" by laying queries → signals → trends →
   causal edges → insights → scenarios → decisions out as columns. Every node
   inherits a chain-relevance computed as the product of upstream strengths
   from the focused terminal node. Low-relevance debris (e.g. off-topic
   signals) is filtered by a user-controlled threshold (default 0.20).

   Data model (client-only, MVP): relevance per trend is approximated as
   `trend.relevance × trend.confidence`. If Phase B lands a per-match score
   on the API, the spine will prefer `matchedTrend.queryRelevance` when
   present — see `chainRelevanceForTrend`.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Input shape (matches CanvasNode surface needed here) ────────────────────

export interface DerivCanvasNode {
  id: string;
  nodeType: string;
  createdAt: number;
  parentId?: string;
  query?: string;
  result?: QueryResult | null;
  content?: string;
  label?: string;
  causalEdges?: MatchedEdge[];
  causalTrendNames?: Record<string, string>;
}

// ─── Stage model ─────────────────────────────────────────────────────────────

type Stage = "question" | "signals" | "trends" | "edges" | "insights" | "scenarios" | "decisions";

const STAGE_ORDER: Stage[] = ["question", "signals", "trends", "edges", "insights", "scenarios", "decisions"];

const STAGE_META: Record<Stage, { labelDe: string; labelEn: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  question:  { labelDe: "Frage",      labelEn: "Question",  Icon: HelpCircle    },
  signals:   { labelDe: "Signale",    labelEn: "Signals",   Icon: Radio         },
  trends:    { labelDe: "Trends",     labelEn: "Trends",    Icon: TrendingUp    },
  edges:     { labelDe: "Kausal",     labelEn: "Causal",    Icon: GitBranch     },
  insights:  { labelDe: "Erkenntnis", labelEn: "Insight",   Icon: Lightbulb     },
  scenarios: { labelDe: "Szenario",   labelEn: "Scenario",  Icon: GitFork       },
  decisions: { labelDe: "Empfehlung", labelEn: "Decision",  Icon: CheckCircle2  },
};

// ─── Spine node shape ────────────────────────────────────────────────────────

interface SpineNode {
  id: string;
  stage: Stage;
  label: string;
  sublabel?: string;
  chainRel: number;           // 0..1 — chain-relevance from focus
  canvasId?: string;          // canvas node id if navigable
  anchors: {                  // parent spine-node ids feeding this one
    sources: string[];
  };
  // stage-specific payload
  signal?: UsedSignal;
  trend?: MatchedTrend;
  edge?: MatchedEdge;
}

interface SpineBucket {
  id: string;                 // "bucket-<source>"
  stage: "signals";
  source: string;
  items: SpineNode[];
  chainRel: number;           // max of items
}

interface Spine {
  columns: Record<Stage, SpineNode[]>;
  signalBuckets: SpineBucket[];
  focusId: string;
  focusStage: Stage;
  // Adjacency list (spine-node id -> downstream spine-node ids)
  edges: Map<string, string[]>;
}

// ─── Chain-relevance helpers ─────────────────────────────────────────────────

/** Per-query relevance for a matched trend. Prefers API-supplied queryRelevance
 *  when present (Phase B), falls back to `relevance × confidence` proxy. */
function trendQueryRelevance(t: MatchedTrend): number {
  const apiScore = t.queryRelevance;
  if (typeof apiScore === "number" && apiScore >= 0 && apiScore <= 1) return apiScore;
  return clamp01(t.relevance * t.confidence);
}

function edgeQueryRelevance(e: MatchedEdge): number {
  const apiScore = e.queryRelevance;
  if (typeof apiScore === "number" && apiScore >= 0 && apiScore <= 1) return apiScore;
  return clamp01(e.strength);
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

// ─── Spine builder ───────────────────────────────────────────────────────────

function buildSpine(focusId: string, allNodes: DerivCanvasNode[]): Spine | null {
  const focus = allNodes.find(n => n.id === focusId);
  if (!focus) return null;

  // Resolve the originating query for this focus (walk up parentId)
  const query = resolveQuery(focus, allNodes);
  if (!query) return null;

  const qr: QueryResult | null = query.result ?? null;
  const matchedTrends = qr?.matchedTrends ?? [];
  const matchedEdges = qr?.matchedEdges ?? focus.causalEdges ?? [];
  const usedSignals = qr?.usedSignals ?? [];

  // Focus stage
  const focusStage = nodeTypeToStage(focus.nodeType);

  const columns: Record<Stage, SpineNode[]> = {
    question: [], signals: [], trends: [], edges: [], insights: [], scenarios: [], decisions: [],
  };
  const edges = new Map<string, string[]>();
  const addEdge = (from: string, to: string) => {
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from)!.push(to);
  };

  // ── Stage 1: Question ─────────────────────────────────────────────────────
  const qNode: SpineNode = {
    id: `q:${query.id}`,
    stage: "question",
    label: (query.query ?? "Analyse").slice(0, 120),
    chainRel: 1.0,
    canvasId: query.id,
    anchors: { sources: [] },
  };
  columns.question.push(qNode);

  // Aggregate trend-relevance for the query (mean of per-trend relevances)
  // used as a base multiplier for signals that have no per-trend link.
  const avgTrendRel = matchedTrends.length > 0
    ? matchedTrends.reduce((s, t) => s + trendQueryRelevance(t), 0) / matchedTrends.length
    : 0.5;

  // ── Stage 3: Trends ───────────────────────────────────────────────────────
  const trendById = new Map<string, SpineNode>();
  matchedTrends.forEach(t => {
    const rel = trendQueryRelevance(t);
    const spineId = `t:${t.id}`;
    const node: SpineNode = {
      id: spineId,
      stage: "trends",
      label: t.name || t.id,
      sublabel: `${t.category} · ${Math.round(rel * 100)}%`,
      chainRel: rel,
      trend: t,
      anchors: { sources: [qNode.id] },
    };
    columns.trends.push(node);
    trendById.set(t.id, node);
    addEdge(qNode.id, spineId);
  });

  // Sort trends by chain-rel desc
  columns.trends.sort((a, b) => b.chainRel - a.chainRel);

  // ── Stage 4: Causal edges ────────────────────────────────────────────────
  matchedEdges.forEach((e, i) => {
    const fromT = trendById.get(e.from);
    const toT = trendById.get(e.to);
    if (!fromT || !toT) return;
    const rel = clamp01(edgeQueryRelevance(e) * Math.min(fromT.chainRel, toT.chainRel));
    const spineId = `e:${i}:${e.from}:${e.to}`;
    const fromName = fromT.label;
    const toName = toT.label;
    const node: SpineNode = {
      id: spineId,
      stage: "edges",
      label: `${truncate(fromName, 14)} → ${truncate(toName, 14)}`,
      sublabel: `${e.type} · ${Math.round(e.strength * 100)}%`,
      chainRel: rel,
      edge: e,
      anchors: { sources: [fromT.id, toT.id] },
    };
    columns.edges.push(node);
    addEdge(fromT.id, spineId);
    addEdge(toT.id, spineId);
  });
  columns.edges.sort((a, b) => b.chainRel - a.chainRel);

  // ── Stage 2: Signals ──────────────────────────────────────────────────────
  // Each signal inherits from query via avgTrendRel (MVP proxy). When a signal
  // carries a `trendIds` field from the API (future), we'd multiply by the max
  // of those trends' relevances instead.
  usedSignals.forEach((s, i) => {
    const base = s.strength ?? 0.5;
    const rel = clamp01(base * avgTrendRel);
    const spineId = `s:${i}`;
    const node: SpineNode = {
      id: spineId,
      stage: "signals",
      label: (s.title || s.source).slice(0, 60),
      sublabel: [s.source, s.date].filter(Boolean).join(" · "),
      chainRel: rel,
      signal: s,
      anchors: { sources: [qNode.id] },
    };
    columns.signals.push(node);
    addEdge(qNode.id, spineId);
    // signals feed ALL trends of this query (chain is signals → query → trends)
    columns.trends.forEach(tn => addEdge(spineId, tn.id));
  });
  columns.signals.sort((a, b) => b.chainRel - a.chainRel);

  // Build signal buckets (by source)
  const bySource = new Map<string, SpineNode[]>();
  columns.signals.forEach(n => {
    const src = n.signal?.source ?? "—";
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src)!.push(n);
  });
  const signalBuckets: SpineBucket[] = Array.from(bySource.entries())
    .map(([source, items]) => ({
      id: `bucket:${source}`,
      stage: "signals" as const,
      source,
      items,
      chainRel: items.length ? Math.max(...items.map(it => it.chainRel)) : 0,
    }))
    .sort((a, b) => b.chainRel - a.chainRel);

  // ── Stages 5/6/7: Derived children of the query ──────────────────────────
  const derivedChildren = allNodes.filter(n => n.parentId === query.id);
  const STAGE_BY_TYPE: Record<string, Stage | null> = {
    insight: "insights",
    scenario: "scenarios",
    decision: "decisions",
    followup: "decisions", // followups live in the decisions column
    causalgraph: null,      // absorbed in edges stage
    dimensions: null,
  };

  derivedChildren.forEach(d => {
    const stage = STAGE_BY_TYPE[d.nodeType] ?? null;
    if (!stage) return;
    // Chain-relevance for a derived node: use parent query's strongest trend
    const topTrendRel = columns.trends.length > 0 ? columns.trends[0].chainRel : avgTrendRel;
    const spineId = `d:${d.id}`;
    const node: SpineNode = {
      id: spineId,
      stage,
      label: (d.label ?? d.content?.slice(0, 80) ?? d.nodeType).trim(),
      sublabel: d.nodeType === "followup" ? "Folgefrage" : undefined,
      chainRel: clamp01(topTrendRel),
      canvasId: d.id,
      anchors: { sources: [qNode.id] },
    };
    columns[stage].push(node);
    // Wire derived chains: question → insights → scenarios → decisions
    addEdge(qNode.id, spineId);
  });

  columns.insights.sort((a, b) => b.chainRel - a.chainRel);
  columns.scenarios.sort((a, b) => b.chainRel - a.chainRel);
  columns.decisions.sort((a, b) => b.chainRel - a.chainRel);

  // Link derived stages forward visually (insights → scenarios → decisions)
  columns.insights.forEach(i => {
    columns.scenarios.forEach(s => addEdge(i.id, s.id));
  });
  columns.scenarios.forEach(s => {
    columns.decisions.forEach(d => addEdge(s.id, d.id));
  });

  return { columns, signalBuckets, focusId, focusStage, edges };
}

function resolveQuery(focus: DerivCanvasNode, all: DerivCanvasNode[]): DerivCanvasNode | null {
  if (focus.nodeType === "query") return focus;
  if (!focus.parentId) return null;
  const p = all.find(n => n.id === focus.parentId);
  if (!p) return null;
  return resolveQuery(p, all);
}

function nodeTypeToStage(nt: string): Stage {
  switch (nt) {
    case "query": return "question";
    case "insight": return "insights";
    case "scenario": return "scenarios";
    case "decision":
    case "followup": return "decisions";
    case "causalgraph": return "edges";
    default: return "question";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ─── Focus picker ────────────────────────────────────────────────────────────

interface FocusPickerProps {
  nodes: DerivCanvasNode[];
  onPick: (id: string) => void;
  de: boolean;
}

function FocusPicker({ nodes, onPick, de }: FocusPickerProps) {
  const groups: Array<{ stage: Stage; types: string[] }> = [
    { stage: "decisions",  types: ["decision", "followup"] },
    { stage: "scenarios",  types: ["scenario"] },
    { stage: "insights",   types: ["insight"] },
    { stage: "question",   types: ["query"] },
  ];

  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 40, overflowY: "auto",
    }}>
      <div style={{ maxWidth: 620, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            color: "var(--color-text-muted)", textTransform: "uppercase",
            marginBottom: 10,
          }}>
            <GitBranch size={14} strokeWidth={1.5} />
            {de ? "Ableitungs-Ansicht" : "Derivation view"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-heading)", marginBottom: 6 }}>
            {de ? "Woher kommt das Ergebnis?" : "Where does this come from?"}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
            {de
              ? "Wähle eine Empfehlung, ein Szenario oder eine Erkenntnis, um die Ableitungskette rückwärts bis zu Signalen und Trends zu verfolgen."
              : "Pick a decision, scenario or insight to trace the derivation chain back to signals and trends."}
          </div>
        </div>

        {groups.map(g => {
          const items = nodes.filter(n => g.types.includes(n.nodeType));
          if (items.length === 0) return null;
          const meta = STAGE_META[g.stage];
          const Icon = meta.Icon;
          return (
            <div key={g.stage} style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--color-text-muted)",
                marginBottom: 8, display: "flex", alignItems: "center", gap: 7,
              }}>
                <Icon size={12} strokeWidth={1.5} />
                {de ? meta.labelDe : meta.labelEn} ({items.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.slice(0, 20).map(n => (
                  <button key={n.id}
                    onClick={() => onPick(n.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", textAlign: "left",
                      fontSize: 12.5, padding: "8px 12px",
                      borderRadius: 8, border: "1px solid var(--color-border)",
                      background: "transparent",
                      color: "var(--color-text-secondary)",
                      cursor: "pointer", transition: "background 0.12s, border-color 0.12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--color-surface, #F5F5F5)"; e.currentTarget.style.borderColor = "#E4FF97"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                  >
                    <span style={{
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {n.nodeType === "query"
                        ? (n.query ?? "—")
                        : (n.label ?? n.content?.slice(0, 100) ?? n.nodeType)}
                    </span>
                    <ChevronRight size={14} strokeWidth={1.5} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  </button>
                ))}
                {items.length > 20 && (
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", padding: "4px 12px" }}>
                    +{items.length - 20} {de ? "weitere" : "more"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface OrbitDerivationViewProps {
  nodes: DerivCanvasNode[];
  selectedNodeId?: string | null;
  de: boolean;
  onNavigateToNode?: (nodeId: string) => void;
}

const STAGE_PAD_Y = 52;     // top-of-column pad for header
const COL_WIDTH = 220;
const COL_GAP = 56;
const NODE_ROW_H = 44;
const BUCKET_ROW_H = 32;
const BUCKET_ITEM_H = 36;

export function OrbitDerivationView({
  nodes,
  selectedNodeId,
  de,
  onNavigateToNode,
}: OrbitDerivationViewProps) {
  // Default focus: passed-in selection if eligible, else first decision, else first query
  const initialFocus = useMemo(() => {
    if (selectedNodeId) {
      const n = nodes.find(n => n.id === selectedNodeId);
      if (n && ["decision", "scenario", "insight", "followup", "query"].includes(n.nodeType)) return selectedNodeId;
    }
    const firstDecision = nodes.find(n => n.nodeType === "decision" || n.nodeType === "followup");
    if (firstDecision) return firstDecision.id;
    const firstScenario = nodes.find(n => n.nodeType === "scenario");
    if (firstScenario) return firstScenario.id;
    const firstInsight = nodes.find(n => n.nodeType === "insight");
    if (firstInsight) return firstInsight.id;
    const firstQuery = nodes.find(n => n.nodeType === "query");
    return firstQuery?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [focusId, setFocusId] = useState<string | null>(initialFocus);
  const [threshold, setThreshold] = useState(0.20);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1200, h: 700 });

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spine = useMemo(() => {
    if (!focusId) return null;
    return buildSpine(focusId, nodes);
  }, [focusId, nodes]);

  const focusNode = focusId ? (nodes.find(n => n.id === focusId) ?? null) : null;

  // If no data available at all → empty state
  if (nodes.filter(n => ["query", "insight", "scenario", "decision", "followup"].includes(n.nodeType)).length === 0) {
    return (
      <div ref={containerRef} style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-text-muted)", fontSize: 14,
      }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <GitBranch size={32} strokeWidth={1} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <div>{de ? "Noch keine Ableitungen vorhanden" : "No derivations yet"}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7, lineHeight: 1.5 }}>
            {de ? "Starte eine Analyse im Canvas — die Ableitungs-Ansicht zeigt dann, aus welchen Signalen und Trends deine Erkenntnisse entstanden sind."
                : "Run an analysis in Canvas — this view shows which signals and trends led to your insights."}
          </div>
        </div>
      </div>
    );
  }

  // ── Picker ──
  if (!focusId || !spine) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <FocusPicker nodes={nodes} onPick={setFocusId} de={de} />
      </div>
    );
  }

  // ── Filter columns by threshold (but always keep focus node visible) ──
  const passesThreshold = (n: SpineNode) => n.chainRel >= threshold || n.canvasId === focusId;
  const filtered: Record<Stage, SpineNode[]> = {
    question:  spine.columns.question.filter(passesThreshold),
    signals:   spine.columns.signals.filter(passesThreshold),
    trends:    spine.columns.trends.filter(passesThreshold),
    edges:     spine.columns.edges.filter(passesThreshold),
    insights:  spine.columns.insights.filter(passesThreshold),
    scenarios: spine.columns.scenarios.filter(passesThreshold),
    decisions: spine.columns.decisions.filter(passesThreshold),
  };
  const filteredBuckets = spine.signalBuckets
    .map(b => ({ ...b, items: b.items.filter(passesThreshold) }))
    .filter(b => b.items.length > 0);

  const totalVisible =
    filtered.question.length + filtered.trends.length + filtered.edges.length +
    filtered.insights.length + filtered.scenarios.length + filtered.decisions.length +
    filteredBuckets.reduce((s, b) => s + b.items.length, 0);
  const totalUnfiltered =
    spine.columns.question.length + spine.columns.signals.length + spine.columns.trends.length +
    spine.columns.edges.length + spine.columns.insights.length +
    spine.columns.scenarios.length + spine.columns.decisions.length;

  // ── Layout math: column positions and node coordinates ──
  // Use absolute positioning inside a wide scrollable area.
  const colX = (stage: Stage) => {
    const i = STAGE_ORDER.indexOf(stage);
    return i * (COL_WIDTH + COL_GAP) + 24;
  };

  // Precompute Y positions for each node in each column
  const nodePos = new Map<string, { x: number; y: number; stage: Stage }>();
  const bucketPos = new Map<string, { x: number; y: number; expanded: boolean }>();

  STAGE_ORDER.forEach(stage => {
    let y = STAGE_PAD_Y;
    if (stage === "signals") {
      filteredBuckets.forEach(b => {
        const isExp = expandedBuckets.has(b.id);
        bucketPos.set(b.id, { x: colX(stage), y, expanded: isExp });
        y += BUCKET_ROW_H + 4;
        if (isExp) {
          b.items.forEach(it => {
            nodePos.set(it.id, { x: colX(stage), y, stage });
            y += BUCKET_ITEM_H + 4;
          });
          y += 8;
        }
      });
    } else {
      filtered[stage].forEach(n => {
        nodePos.set(n.id, { x: colX(stage), y, stage });
        y += NODE_ROW_H + 6;
      });
    }
  });

  const totalW = colX("decisions") + COL_WIDTH + 24;
  // Find max y across all columns for height
  let maxY = STAGE_PAD_Y;
  nodePos.forEach(p => { maxY = Math.max(maxY, p.y + NODE_ROW_H); });
  bucketPos.forEach(p => {
    maxY = Math.max(maxY, p.y + BUCKET_ROW_H);
  });
  const totalH = Math.max(maxY + 40, dims.h - 64);

  // Hovered chain: set of spine-node ids connected to hoveredId (upstream OR downstream)
  const chainSet = useMemo(() => {
    if (!hoveredId) return null;
    const s = new Set<string>([hoveredId]);
    // Walk backward
    const back = (id: string) => {
      const node = findSpineNode(spine, id);
      if (!node) return;
      node.anchors.sources.forEach(src => {
        if (!s.has(src)) { s.add(src); back(src); }
      });
    };
    // Walk forward
    const fwd = (id: string) => {
      const outs = spine.edges.get(id) ?? [];
      outs.forEach(o => {
        if (!s.has(o)) { s.add(o); fwd(o); }
      });
    };
    back(hoveredId);
    fwd(hoveredId);
    return s;
  }, [hoveredId, spine]);

  // ── Render ──
  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <TopBar
        de={de}
        focusNode={focusNode}
        threshold={threshold}
        onThresholdChange={setThreshold}
        onClearFocus={() => setFocusId(null)}
        visible={totalVisible}
        total={totalUnfiltered}
      />

      {/* Scrollable spine surface */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{ position: "relative", width: totalW, height: totalH }}>
          {/* SVG edge layer */}
          <svg
            width={totalW} height={totalH}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <defs>
              <marker id="deriv-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#0A0A0A" fillOpacity={0.35} />
              </marker>
              <marker id="deriv-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B7A00" />
              </marker>
            </defs>
            <DerivationEdges
              spine={spine}
              nodePos={nodePos}
              bucketPos={bucketPos}
              filteredSet={buildFilteredSet(filtered, filteredBuckets, expandedBuckets)}
              chainSet={chainSet}
              threshold={threshold}
            />
          </svg>

          {/* Columns: headers + nodes */}
          {STAGE_ORDER.map(stage => {
            const meta = STAGE_META[stage];
            const Icon = meta.Icon;
            const list = filtered[stage];
            const showCount = stage === "signals"
              ? filteredBuckets.reduce((s, b) => s + b.items.length, 0)
              : list.length;
            return (
              <div key={stage} style={{
                position: "absolute", left: colX(stage), top: 0, width: COL_WIDTH,
              }}>
                {/* Column header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--color-text-muted)",
                  padding: "14px 2px 8px",
                  borderBottom: "1px solid var(--color-border)",
                }}>
                  <Icon size={12} strokeWidth={1.5} />
                  <span style={{ flex: 1 }}>{de ? meta.labelDe : meta.labelEn}</span>
                  <span style={{
                    background: "var(--color-surface, #F5F5F5)",
                    color: "var(--color-text-secondary)",
                    borderRadius: 4, padding: "1px 5px",
                    fontSize: 9, fontWeight: 600, letterSpacing: 0,
                  }}>{showCount}</span>
                </div>
              </div>
            );
          })}

          {/* Signal buckets (stage 2) */}
          {filteredBuckets.map(b => {
            const pos = bucketPos.get(b.id);
            if (!pos) return null;
            const isExp = pos.expanded;
            return (
              <React.Fragment key={b.id}>
                <button
                  onClick={() => setExpandedBuckets(prev => {
                    const nxt = new Set(prev);
                    if (nxt.has(b.id)) nxt.delete(b.id); else nxt.add(b.id);
                    return nxt;
                  })}
                  style={{
                    position: "absolute", left: pos.x, top: pos.y,
                    width: COL_WIDTH, height: BUCKET_ROW_H,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 10px", fontSize: 11.5,
                    borderRadius: 6, border: "1px solid var(--color-border)",
                    background: "var(--color-surface-alt, #FAFAFA)",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.12s, background 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#E4FF97"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
                >
                  {isExp ? <ChevronDown size={11} strokeWidth={1.8} /> : <ChevronRight size={11} strokeWidth={1.8} />}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                    {b.source || "—"}
                  </span>
                  <span style={{
                    fontSize: 9.5, background: "var(--color-surface, #FFFFFF)",
                    borderRadius: 4, padding: "1px 5px", color: "var(--color-text-muted)",
                  }}>{b.items.length}</span>
                </button>
                {isExp && b.items.map(it => {
                  const p = nodePos.get(it.id);
                  if (!p) return null;
                  return (
                    <NodeChip
                      key={it.id}
                      node={it}
                      x={p.x + 14} y={p.y}
                      w={COL_WIDTH - 14} h={BUCKET_ITEM_H}
                      chainSet={chainSet}
                      onHover={setHoveredId}
                      onClick={() => {
                        if (it.canvasId) onNavigateToNode?.(it.canvasId);
                      }}
                      small
                    />
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* All other-stage nodes */}
          {(["question", "trends", "edges", "insights", "scenarios", "decisions"] as Stage[]).map(stage => (
            <React.Fragment key={`render:${stage}`}>
              {filtered[stage].map(n => {
                const p = nodePos.get(n.id);
                if (!p) return null;
                return (
                  <NodeChip
                    key={n.id}
                    node={n}
                    x={p.x} y={p.y}
                    w={COL_WIDTH} h={NODE_ROW_H}
                    chainSet={chainSet}
                    onHover={setHoveredId}
                    onClick={() => {
                      if (n.canvasId && n.canvasId !== focusId) {
                        // Clicking a different canvas-linked node re-focuses the spine
                        setFocusId(n.canvasId);
                      } else if (n.canvasId) {
                        onNavigateToNode?.(n.canvasId);
                      }
                    }}
                    isFocus={n.canvasId === focusId}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Empty-filter hint */}
      {totalVisible === 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)",
          border: "1px solid var(--color-border)", borderRadius: 10,
          padding: "14px 18px", fontSize: 12, color: "var(--color-text-muted)",
          textAlign: "center", maxWidth: 360,
        }}>
          {de
            ? `Alle ${totalUnfiltered} Knoten vom Filter ausgeblendet. Schwelle senken (aktuell ${threshold.toFixed(2)})`
            : `All ${totalUnfiltered} nodes filtered out. Lower threshold (currently ${threshold.toFixed(2)})`}
        </div>
      )}
    </div>
  );
}

// ─── NodeChip ────────────────────────────────────────────────────────────────

function NodeChip({
  node, x, y, w, h, chainSet, onHover, onClick, isFocus, small,
}: {
  node: SpineNode;
  x: number; y: number; w: number; h: number;
  chainSet: Set<string> | null;
  onHover: (id: string | null) => void;
  onClick: () => void;
  isFocus?: boolean;
  small?: boolean;
}) {
  const dim = chainSet && !chainSet.has(node.id) ? 0.25 : 1;
  const inChain = chainSet && chainSet.has(node.id);
  const relPct = Math.round(node.chainRel * 100);
  // Relevance as a small left-edge bar (1px..4px depending on strength)
  const barWidth = 2 + node.chainRel * 3;

  return (
    <div
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        position: "absolute", left: x, top: y, width: w, height: h,
        display: "flex", alignItems: "center", gap: 8,
        padding: small ? "0 8px 0 10px" : "0 10px",
        borderRadius: 8,
        border: `1px solid ${isFocus ? "#6B7A00" : inChain ? "#E4FF97" : "var(--color-border)"}`,
        background: isFocus ? "#E4FF97" : inChain ? "#FAFFE5" : "var(--color-surface, #FFFFFF)",
        color: "var(--color-text-secondary)",
        cursor: node.canvasId ? "pointer" : "default",
        opacity: dim,
        transition: "opacity 0.15s, border-color 0.12s, background 0.12s",
        boxShadow: isFocus ? "0 0 0 2px #6B7A0022" : "none",
        overflow: "hidden",
      }}
    >
      {/* Relevance bar (left edge) */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: barWidth, background: isFocus ? "#6B7A00" : "#6B7A00AA",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: small ? 11 : 12.5,
          fontWeight: isFocus ? 700 : 600,
          color: "var(--color-text-heading)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.25,
        }}>{node.label}</div>
        {node.sublabel && (
          <div style={{
            fontSize: 10, color: "var(--color-text-muted)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginTop: 2,
          }}>{node.sublabel}</div>
        )}
      </div>
      <div style={{
        fontSize: 9, fontWeight: 700,
        color: "var(--color-text-muted)",
        fontFamily: "var(--font-mono, monospace)",
        flexShrink: 0,
      }}>{relPct}%</div>
      {node.canvasId && node.canvasId !== undefined && !isFocus && (
        <ExternalLink size={10} strokeWidth={1.8}
          style={{ color: "var(--color-text-muted)", opacity: 0.6, flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function TopBar({
  de, focusNode, threshold, onThresholdChange, onClearFocus, visible, total,
}: {
  de: boolean;
  focusNode: DerivCanvasNode | null;
  threshold: number;
  onThresholdChange: (v: number) => void;
  onClearFocus: () => void;
  visible: number;
  total: number;
}) {
  const focusLabel = focusNode
    ? (focusNode.nodeType === "query"
        ? focusNode.query
        : (focusNode.label ?? focusNode.content?.slice(0, 80) ?? focusNode.nodeType))
    : "";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "10px 16px 10px 20px",
      borderBottom: "1px solid var(--color-border)",
      background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)",
      flexShrink: 0,
    }}>
      {/* Breadcrumb: current focus */}
      <button
        onClick={onClearFocus}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, padding: "4px 9px",
          borderRadius: 6, border: "1px solid var(--color-border)",
          background: "transparent", color: "var(--color-text-muted)",
          cursor: "pointer",
        }}
      >
        <X size={11} strokeWidth={1.8} />
        {de ? "Anderen Knoten wählen" : "Pick another"}
      </button>
      <div style={{
        flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-text-heading)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        <span style={{ fontWeight: 600, letterSpacing: 0.2 }}>
          {focusNode && STAGE_META[nodeTypeToStage(focusNode.nodeType)][de ? "labelDe" : "labelEn"]}:
        </span>{" "}
        {focusLabel}
      </div>

      {/* Counts */}
      <div style={{
        fontSize: 11, color: "var(--color-text-muted)",
        fontFamily: "var(--font-mono, monospace)", flexShrink: 0,
      }}>
        {visible}/{total}
      </div>

      {/* Threshold slider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: "var(--color-text-muted)", textTransform: "uppercase",
        }}>{de ? "Schwelle" : "Threshold"}</span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={threshold}
          onChange={e => onThresholdChange(parseFloat(e.target.value))}
          style={{ width: 120, accentColor: "#6B7A00" }}
        />
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono, monospace)",
          color: "var(--color-text-heading)", fontWeight: 600, minWidth: 36, textAlign: "right",
        }}>{threshold.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── Edge rendering ──────────────────────────────────────────────────────────

function DerivationEdges({
  spine, nodePos, bucketPos, filteredSet, chainSet, threshold,
}: {
  spine: Spine;
  nodePos: Map<string, { x: number; y: number; stage: Stage }>;
  bucketPos: Map<string, { x: number; y: number; expanded: boolean }>;
  filteredSet: Set<string>;
  chainSet: Set<string> | null;
  threshold: number;
}) {
  const paths: React.ReactElement[] = [];
  let pathKey = 0;

  // For each adjacency, draw a spline from source node's right edge to target's left edge
  spine.edges.forEach((tos, fromId) => {
    tos.forEach(toId => {
      if (!filteredSet.has(fromId) || !filteredSet.has(toId)) return;

      const fromXY = coordsFor(fromId, nodePos, bucketPos);
      const toXY = coordsFor(toId, nodePos, bucketPos);
      if (!fromXY || !toXY) return;

      const x1 = fromXY.x + fromXY.w;
      const y1 = fromXY.y + fromXY.h / 2;
      const x2 = toXY.x;
      const y2 = toXY.y + toXY.h / 2;
      const midX = (x1 + x2) / 2;

      const hot = chainSet && chainSet.has(fromId) && chainSet.has(toId);
      const rel = Math.min(
        findSpineNodeChainRel(spine, fromId) ?? 1,
        findSpineNodeChainRel(spine, toId) ?? 1,
      );
      // Hide edges whose minimum chain-relevance is below threshold
      if (rel < threshold && !hot) return;

      paths.push(
        <path
          key={`edge-${pathKey++}`}
          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
          fill="none"
          stroke={hot ? "#6B7A00" : "#0A0A0A"}
          strokeOpacity={hot ? 0.9 : 0.12 + rel * 0.18}
          strokeWidth={hot ? 1.8 : 0.8 + rel * 0.6}
          markerEnd={`url(#${hot ? "deriv-arrow-hot" : "deriv-arrow"})`}
        />
      );
    });
  });

  return <>{paths}</>;
}

function coordsFor(
  id: string,
  nodePos: Map<string, { x: number; y: number; stage: Stage }>,
  bucketPos: Map<string, { x: number; y: number; expanded: boolean }>,
): { x: number; y: number; w: number; h: number } | null {
  const np = nodePos.get(id);
  if (np) {
    // For expanded-bucket items the chip is offset by 14px (see render above)
    const isBucketItem = id.startsWith("s:") && np.stage === "signals";
    const xOffset = isBucketItem ? 14 : 0;
    return {
      x: np.x + xOffset,
      y: np.y,
      w: COL_WIDTH - xOffset,
      h: isBucketItem ? BUCKET_ITEM_H : NODE_ROW_H,
    };
  }
  const bp = bucketPos.get(id);
  if (bp) {
    return { x: bp.x, y: bp.y, w: COL_WIDTH, h: BUCKET_ROW_H };
  }
  return null;
}

function buildFilteredSet(
  filtered: Record<Stage, SpineNode[]>,
  filteredBuckets: SpineBucket[],
  expandedBuckets: Set<string>,
): Set<string> {
  const s = new Set<string>();
  (Object.values(filtered) as SpineNode[][]).forEach(arr => arr.forEach(n => s.add(n.id)));
  filteredBuckets.forEach(b => {
    s.add(b.id);
    if (expandedBuckets.has(b.id)) {
      b.items.forEach(it => s.add(it.id));
    }
  });
  return s;
}

function findSpineNode(spine: Spine, id: string): SpineNode | null {
  for (const stage of STAGE_ORDER) {
    const n = spine.columns[stage].find(x => x.id === id);
    if (n) return n;
  }
  for (const b of spine.signalBuckets) {
    const it = b.items.find(x => x.id === id);
    if (it) return it;
  }
  return null;
}

function findSpineNodeChainRel(spine: Spine, id: string): number | null {
  const n = findSpineNode(spine, id);
  if (n) return n.chainRel;
  const b = spine.signalBuckets.find(b => b.id === id);
  return b?.chainRel ?? null;
}
