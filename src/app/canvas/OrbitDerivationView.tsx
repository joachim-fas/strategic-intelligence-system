"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  HelpCircle, Radio, TrendingUp, GitBranch, Lightbulb, GitFork,
  CheckCircle2, ChevronRight, ChevronDown, X, ExternalLink,
  Link as LinkIcon, Target, ArrowUpRight, Info,
} from "lucide-react";
import type { UsedSignal, MatchedTrend, MatchedEdge, QueryResult } from "@/types";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { ORBIT_STAGE_COLORS, ORBIT_STATE_COLORS, stageColor } from "./orbit-colors";
// 2026-04-23 (Hygiene-Pass): topic-fit-Logik dedupliziert in
// src/lib/signal-topic-fit.ts. Sieh dort für die volle Resolution-Chain
// (LLM-judged > queryRelevance > displayScore > keywordOverlap > default).
import { signalTopicalFit } from "@/lib/signal-topic-fit";

/* ═══════════════════════════════════════════════════════════════════════════
   OrbitDerivationView — 7-stage left-to-right derivation chain.

   Answers "where did this come from?" by laying queries → signals → trends →
   causal edges → insights → scenarios → decisions out as columns. Every node
   inherits a chain-relevance computed as the product of upstream strengths
   from the focused terminal node. Low-relevance debris (e.g. off-topic
   signals) is filtered by a user-controlled threshold (default 0.05 since
   2026-04-22 — was 0.20, but post-retrieval-reform that hid signals which
   were correctly retrieved via the long-domain-anchor / bigram bypass).

   Scoring (post 2026-04-21 Signal-Kettenbezug fix):
   - Trends:  queryRelevance (LLM) → fallback relevance × confidence
   - Edges:   queryRelevance (LLM) → fallback strength
   - Signals: strength × topic × avgTrendRel, where `topic` =
              queryRelevance (LLM) → keywordOverlap (retrieval) → 0.3 default.
              Social-tier signals with topic < 0.5 are hidden entirely.
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

// Farben kommen aus `orbit-colors.ts` (Single Source of Truth). STAGE_META
// trägt nur noch Labels + Icons; `color` ist ein Proxy, damit bestehende
// Call-Sites (STAGE_META[s].color) unverändert weiter funktionieren.
const STAGE_META: Record<Stage, { labelDe: string; labelEn: string; color: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  question:  { labelDe: "Frage",      labelEn: "Question",  color: stageColor("question"),  Icon: HelpCircle    },
  signals:   { labelDe: "Signale",    labelEn: "Signals",   color: stageColor("signals"),   Icon: Radio         },
  trends:    { labelDe: "Trends",     labelEn: "Trends",    color: stageColor("trends"),    Icon: TrendingUp    },
  edges:     { labelDe: "Kausal",     labelEn: "Causal",    color: stageColor("edges"),     Icon: GitBranch     },
  insights:  { labelDe: "Erkenntnis", labelEn: "Insight",   color: stageColor("insights"),  Icon: Lightbulb     },
  scenarios: { labelDe: "Szenario",   labelEn: "Scenario",  color: stageColor("scenarios"), Icon: GitFork       },
  decisions: { labelDe: "Empfehlung", labelEn: "Decision",  color: stageColor("decisions"), Icon: CheckCircle2  },
};
// Silence "unused import" linter for ORBIT_STAGE_COLORS — used by SpineRow below.
void ORBIT_STAGE_COLORS;

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

// (signalTopicalFit imported from @/lib/signal-topic-fit at the top
// of this file — see header comment for the resolution priority chain.)

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

// ─── Spine builder ───────────────────────────────────────────────────────────

function buildSpine(focusId: string, allNodes: DerivCanvasNode[]): Spine | null {
  const focus = allNodes.find(n => n.id === focusId);
  if (!focus) return null;

  // Resolve the originating query for this focus (walk up parentId)
  const query = resolveQuery(focus, allNodes);
  if (!query) return null;

  const qr: QueryResult | null = query.result ?? null;

  // Fallback 1 — some older canvases (pre-flattening-transfer) persisted only
  // a `causalgraph` child node with its edges, but never populated the query's
  // `result.matchedTrends / matchedEdges`. Find that child and read from it
  // directly so the Orbit Stage-3 (Trends) and Stage-4 (Edges) columns don't
  // stay at 0 even when the data is visibly present elsewhere on the canvas.
  const causalChild = allNodes.find(
    n => n.parentId === query.id && n.nodeType === "causalgraph",
  );
  const childEdges = causalChild?.causalEdges ?? [];
  const childNameMap = causalChild?.causalTrendNames ?? {};

  // Synthesize minimal MatchedTrend entries from the causal child when the
  // query's matchedTrends is missing. We only have (id, name) from the name
  // map + edges, so the rest is filled with neutral defaults. This is enough
  // for the spine to light up correctly; the user can still open the trend
  // detail for full data.
  const fallbackTrends: MatchedTrend[] = Object.entries(childNameMap).map(
    ([id, name]) => ({
      id,
      name: name || id,
      category: "other",
      tags: [],
      relevance: 0.5,
      confidence: 0.5,
      impact: 0.5,
      velocity: "stable",
      ring: "assess",
      signalCount: 0,
    }),
  );

  const matchedTrends =
    (qr?.matchedTrends && qr.matchedTrends.length > 0)
      ? qr.matchedTrends
      : fallbackTrends;

  const matchedEdges =
    (qr?.matchedEdges && qr.matchedEdges.length > 0)
      ? qr.matchedEdges
      : (childEdges.length > 0 ? childEdges : (focus.causalEdges ?? []));

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
  // Fix 2026-04-21 (Signal-Kettenbezug): drei-Faktor-Formel statt der alten
  // zweifaktorigen `strength × avgTrendRel`. Die bisherige Formel hatte KEINE
  // Komponente, die Signal↔Frage-Passung misst — Folge: ein UN-Fertilitäts-
  // Artikel bei „Welcher Bezirk in Wien…" wurde mit 45% Kettenbezug angezeigt,
  // obwohl inhaltlich null Verbindung zu Wien-Bezirken bestand.
  //
  // Neu: rel = strength × topic × avgTrendRel, wobei `topic` die topische
  // Nähe zur Frage aus drei Quellen zieht (LLM queryRelevance → keyword
  // overlap → pessimistischer Default). Social-Tier-Signale mit niedriger
  // Topic-Nähe werden ganz aus der Darstellung genommen, damit Bluesky-
  // Personal-Posts nicht als „Evidence" für strategische Queries erscheinen.
  usedSignals.forEach((s, i) => {
    const base = s.strength ?? 0.5;
    const topic = signalTopicalFit(s);

    // Social-Signale mit schwacher topischer Passung ganz ausblenden — der
    // `getRelevantSignals`-Filter ist zwar per-Tier strenger, aber der
    // zweite Trend-Namen-basierte Retrieval-Pass in der API kann nochmal
    // soziale Signale reinschleusen. Harte Schwelle hier schützt das UI.
    if (s.sourceTier === "social" && topic < 0.5) return;

    const rel = clamp01(base * topic * avgTrendRel);
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
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
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
            {tl("orbit.viewTitle")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-heading)", marginBottom: 6 }}>
            {tl("orbit.viewSubtitle")}
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
                    +{items.length - 20} {tl("orbit.moreSuffix")}
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
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
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
  const [detailSpineId, setDetailSpineId] = useState<string | null>(null); // spine-node id for right-hand context panel
  const [panelPinned, setPanelPinned] = useState(true);                     // show panel by default once focused
  // 2026-04-22 P3-Display-Sync: default threshold lowered from 0.20 → 0.05.
  // Same root cause as the BriefingResult Live-Signale fix (80288e2): the
  // smart retrieval layer (alias-aware anchor + long-domain-anchor + bigram
  // bypass) admits domain-relevant signals even when their raw weighted-
  // overlap is low (short news titles match 1-2 of 19+ expanded keywords).
  // For C-DE Wärmepumpen signals, chainRel = strength(0.5) × topic(0.07)
  // × avgTrendRel(~0.5) ≈ 0.018 — far below the old 0.20 cutoff. They were
  // cited by the LLM in the synthesis but invisible in the Orbit derivation
  // chain. The user-facing slider still works for tightening the view; the
  // default just no longer hides correctly-retrieved signals.
  const [threshold, setThreshold] = useState(0.05);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1200, h: 700 });

  // Reset detail selection when focus changes (panel will default to focus node)
  useEffect(() => {
    setDetailSpineId(null);
  }, [focusId]);

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
          <div>{tl("orbit.emptyHeading")}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7, lineHeight: 1.5 }}>
            {tl("orbit.emptyBody")}
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

  // ── Context panel: resolve active detail spine-node ──
  // Default to the focus node's own spine id (query or derived terminal) so
  // the panel opens pre-populated with the focus's context.
  const focusSpineId = (() => {
    if (!focusNode) return null;
    if (focusNode.nodeType === "query") return `q:${focusNode.id}`;
    return `d:${focusNode.id}`;
  })();
  const activeDetailId = detailSpineId ?? focusSpineId;
  const activeDetailNode = activeDetailId ? findSpineNode(spine, activeDetailId) : null;
  const panelOpen = panelPinned && !!activeDetailNode;

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
        onOpenInCanvas={focusNode && onNavigateToNode ? () => onNavigateToNode(focusNode.id) : undefined}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelPinned(p => !p)}
      />

      {/* Body: spine + optional right-hand context panel */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

      {/* Scrollable spine surface */}
      <div style={{ flex: 1, overflow: "auto", position: "relative", minWidth: 0 }}>
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
                {/* Hot-Arrow: Slate-Anker statt der alten question-Grünfarbe —
                    der Pfeil signalisiert State (aktive Chain), nicht Stage. */}
                <path d="M 0 0 L 10 5 L 0 10 z" fill={ORBIT_STATE_COLORS.selectedBorder} />
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
                      isSelected={detailSpineId === it.id}
                      onHover={setHoveredId}
                      onClick={() => {
                        // Signals never navigate — show detail in-panel
                        setDetailSpineId(it.id);
                        setPanelPinned(true);
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
                    isSelected={detailSpineId === n.id}
                    onHover={setHoveredId}
                    onClick={() => {
                      // Always open the in-Orbit context panel — that's
                      // the nachgelagerte Trend-/Stammdaten-Schicht.
                      setDetailSpineId(n.id);
                      setPanelPinned(true);

                      // For canvas-linked "result" nodes (the Frage /
                      // Erkenntnis / Szenario / Empfehlung rails) ALSO
                      // open the full DetailPanel that the Canvas view
                      // uses. Previously Orbit showed only the trend-
                      // shaped sidebar and never surfaced the briefing
                      // content — user report: "bei Ergebnissen nicht
                      // wie in der Canvas-Ansicht". Trends / causal
                      // edges have no canvas node, so they stay
                      // sidebar-only.
                      if (
                        n.canvasId &&
                        (n.stage === "question" ||
                          n.stage === "insights" ||
                          n.stage === "scenarios" ||
                          n.stage === "decisions")
                      ) {
                        if (n.canvasId !== focusId) setFocusId(n.canvasId);
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

      {/* Context panel (right-hand) */}
      {panelOpen && activeDetailNode && (
        <ContextPanel
          de={de}
          spine={spine}
          detailNode={activeDetailNode}
          allNodes={nodes}
          focusNode={focusNode}
          onClose={() => setPanelPinned(false)}
          onNavigateToNode={onNavigateToNode}
          onFocusNode={canvasId => setFocusId(canvasId)}
        />
      )}

      </div>{/* /Body */}

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
  node, x, y, w, h, chainSet, onHover, onClick, isFocus, isSelected, small,
}: {
  node: SpineNode;
  x: number; y: number; w: number; h: number;
  chainSet: Set<string> | null;
  onHover: (id: string | null) => void;
  onClick: () => void;
  isFocus?: boolean;
  isSelected?: boolean;
  small?: boolean;
}) {
  const dim = chainSet && !chainSet.has(node.id) ? ORBIT_STATE_COLORS.dimmedOpacity : 1;
  const inChain = chainSet && chainSet.has(node.id);
  const relPct = Math.round(node.chainRel * 100);
  // Relevance as a small left-edge bar (1px..4px depending on strength)
  const barWidth = 2 + node.chainRel * 3;

  // Orbit-Farbrefactor 2026-04-21:
  // - State-Farben (Focus / Selected / In-Chain) sind orthogonal zu Stage-Farben.
  //   Vorher kollidierten Focus = "#6B7A00" (Oliv-grün) und Selected = "#2563EB" (blau)
  //   mit den Stage-Farben für `question` bzw. `edges`/`scenarios`. Jetzt benutzt
  //   State die ORBIT_STATE_COLORS, Stage die ORBIT_STAGE_COLORS — keine Kollision.
  // - Relevance-Bar am linken Rand ist nun stage-spezifisch eingefärbt, nicht mehr
  //   pauschal Question-grün. Damit sieht der User auf einen Blick, welche
  //   Kategorie die Node ist, UND wie stark ihr Kettenbezug ist.
  const stageAccent = stageColor(node.stage);
  const borderColor = isFocus
    ? ORBIT_STATE_COLORS.focusBorder
    : isSelected
    ? ORBIT_STATE_COLORS.selectedBorder
    : inChain
    ? ORBIT_STATE_COLORS.inChainBorder
    : "var(--color-border)";
  const bgColor = isFocus
    ? ORBIT_STATE_COLORS.focusBg
    : isSelected
    ? ORBIT_STATE_COLORS.selectedBg
    : inChain
    ? ORBIT_STATE_COLORS.inChainBg
    : "var(--color-surface, #FFFFFF)";

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
        border: `1px solid ${borderColor}`,
        background: bgColor,
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        opacity: dim,
        transition: "opacity 0.15s, border-color 0.12s, background 0.12s",
        boxShadow: isFocus
          ? `0 0 0 2px ${ORBIT_STATE_COLORS.focusRingShadow}`
          : isSelected
          ? `0 0 0 2px ${ORBIT_STATE_COLORS.selectedRingShadow}`
          : "none",
        overflow: "hidden",
      }}
    >
      {/* Relevance bar (left edge) — colored by stage, saturated on focus,
          slightly translucent otherwise. */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: barWidth,
        background: isFocus ? stageAccent : `${stageAccent}AA`,
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
  onOpenInCanvas, panelOpen, onTogglePanel,
}: {
  de: boolean;
  focusNode: DerivCanvasNode | null;
  threshold: number;
  onThresholdChange: (v: number) => void;
  onClearFocus: () => void;
  visible: number;
  total: number;
  onOpenInCanvas?: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  const focusStage = focusNode ? nodeTypeToStage(focusNode.nodeType) : null;
  const focusLabel = focusNode
    ? (focusNode.nodeType === "query"
        ? focusNode.query
        : (focusNode.label ?? focusNode.content?.slice(0, 80) ?? focusNode.nodeType))
    : "";
  const truncatedFocusLabel = focusLabel && focusLabel.length > 38
    ? focusLabel.slice(0, 38) + "…"
    : focusLabel;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px 10px 16px",
      borderBottom: "1px solid var(--color-border)",
      background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)",
      flexShrink: 0,
      minHeight: 52,
    }}>
      {/* LEFT — breadcrumb + compact focus pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0 }}>
        <button
          onClick={onClearFocus}
          title={tl("orbit.pickFocusTitle")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, padding: "4px 8px",
            borderRadius: 6, border: "1px solid var(--color-border)",
            background: "transparent", color: "var(--color-text-muted)",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <X size={11} strokeWidth={1.8} />
          {tl("orbit.changeFocus")}
        </button>
        {focusNode && focusStage && (
          <div
            title={focusLabel}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, padding: "3px 8px",
              borderRadius: 5,
              border: `1px solid ${STAGE_META[focusStage].color}55`,
              background: `${STAGE_META[focusStage].color}10`,
              color: STAGE_META[focusStage].color,
              minWidth: 0, maxWidth: 240,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flexShrink: 1,
            }}
          >
            <span style={{ fontWeight: 700, letterSpacing: 0.3, fontSize: 9, textTransform: "uppercase", opacity: 0.9 }}>
              {STAGE_META[focusStage][de ? "labelDe" : "labelEn"]}
            </span>
            <span style={{
              fontWeight: 500, color: "var(--color-text-heading)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {truncatedFocusLabel}
            </span>
          </div>
        )}
      </div>

      {/* CENTER — spacer reserving room for floating sub-mode pill */}
      <div style={{ flex: 1, minWidth: 180 }} />

      {/* RIGHT — counts, threshold, toggles */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{
          fontSize: 11, color: "var(--color-text-muted)",
          fontFamily: "var(--font-mono, monospace)",
        }}
          title={tl("orbit.visibleVsTotalTip")}
        >
          {visible}/{total}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            color: "var(--color-text-muted)", textTransform: "uppercase",
          }}
            title={tl("orbit.thresholdTip")}
          >{tl("orbit.thresholdAbbrev")}</span>
          <input
            type="range" min={0} max={1} step={0.05}
            value={threshold}
            onChange={e => onThresholdChange(parseFloat(e.target.value))}
            style={{ width: 86, accentColor: "#6B7A00" }}
          />
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono, monospace)",
            color: "var(--color-text-heading)", fontWeight: 600, minWidth: 32, textAlign: "right",
          }}>{threshold.toFixed(2)}</span>
        </div>

        <button
          onClick={onTogglePanel}
          title={panelOpen ? tl("orbit.hideContext") : tl("orbit.showContext")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, padding: "4px 9px",
            borderRadius: 6,
            border: `1px solid ${panelOpen ? "#2563EB" : "var(--color-border)"}`,
            background: panelOpen ? "#EEF4FF" : "transparent",
            color: panelOpen ? "#1E40AF" : "var(--color-text-muted)",
            cursor: "pointer",
            transition: "all 0.12s",
          }}
        >
          <Info size={11} strokeWidth={1.8} />
          {tl("orbit.contextHeading")}
        </button>

        {onOpenInCanvas && (
          <button
            onClick={onOpenInCanvas}
            title={tl("orbit.openInCanvasTip")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, padding: "4px 9px",
              borderRadius: 6, border: "1px solid #6B7A0088",
              background: "#FAFFE5", color: "#445300",
              cursor: "pointer", fontWeight: 600,
              transition: "all 0.12s",
            }}
          >
            <ArrowUpRight size={11} strokeWidth={2} />
            {tl("orbit.openInCanvas")}
          </button>
        )}
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
  // ── 1. Kanten einsammeln (mit allen Infos, die wir zum Rendern brauchen) ──
  //
  // Wichtig: pro Ziel-Knoten bündeln wir alle eingehenden Kanten in einem
  // Array, damit wir sie im zweiten Pass gestaffelt anordnen können. Ohne
  // Staffelung laufen alle Linien in denselben Mittelpunkt der linken Kante
  // des Ziels — das erzeugt das Ballungsproblem bei stark referenzierten
  // Karten (z.B. „Artificial Intelligence & Automation" mit 9 Sources).
  type EdgeHit = {
    fromId: string;
    toId: string;
    fromXY: { x: number; y: number; w: number; h: number };
    toXY:   { x: number; y: number; w: number; h: number };
    hot: boolean;
    rel: number;
  };
  const byTarget = new Map<string, EdgeHit[]>();

  spine.edges.forEach((tos, fromId) => {
    tos.forEach(toId => {
      if (!filteredSet.has(fromId) || !filteredSet.has(toId)) return;

      const fromXY = coordsFor(fromId, nodePos, bucketPos);
      const toXY = coordsFor(toId, nodePos, bucketPos);
      if (!fromXY || !toXY) return;

      const hot = !!(chainSet && chainSet.has(fromId) && chainSet.has(toId));
      const rel = Math.min(
        findSpineNodeChainRel(spine, fromId) ?? 1,
        findSpineNodeChainRel(spine, toId) ?? 1,
      );
      // Kanten unter Threshold ausblenden (außer sie sind im Hot-Chain)
      if (rel < threshold && !hot) return;

      const arr = byTarget.get(toId) ?? [];
      arr.push({ fromId, toId, fromXY, toXY, hot, rel });
      byTarget.set(toId, arr);
    });
  });

  // ── 2. Rendering mit vertikaler Staffelung am Ziel-Knoten ──
  //
  // Für jedes Ziel sortieren wir die einlaufenden Kanten nach der Y-Position
  // ihrer Source — dann bekommen sie in derselben Reihenfolge Y-Offsets am
  // Ziel zugewiesen. Das sorgt dafür, dass sich die Linien NICHT kreuzen und
  // die obere Source auch oben einläuft.
  //
  // Die Auftreffpunkte werden gleichmäßig zwischen 25 % und 75 % der Ziel-
  // Höhe verteilt — enges Band, damit Pfeile sichtbar in die Karte zeigen,
  // aber weit genug gespreizt, dass sich die Arrowheads nicht überlagern.
  const paths: React.ReactElement[] = [];
  let pathKey = 0;

  byTarget.forEach((hits) => {
    // Sortiere nach Source-Mittelpunkt-Y — obere Sources ziehen oben ein.
    hits.sort((a, b) =>
      (a.fromXY.y + a.fromXY.h / 2) - (b.fromXY.y + b.fromXY.h / 2)
    );

    const n = hits.length;
    hits.forEach((hit, idx) => {
      const { fromXY, toXY, hot, rel } = hit;

      const x1 = fromXY.x + fromXY.w;
      const y1 = fromXY.y + fromXY.h / 2;

      // Zielpunkt: eine Linie → Mittelpunkt. Mehrere → gestaffelt im
      // mittleren 50 %-Band der Karte.
      const targetBandStart = toXY.y + toXY.h * 0.25;
      const targetBandEnd   = toXY.y + toXY.h * 0.75;
      const targetY = n === 1
        ? toXY.y + toXY.h / 2
        : targetBandStart + ((targetBandEnd - targetBandStart) * idx) / (n - 1);

      const x2 = toXY.x;
      const y2 = targetY;
      const midX = (x1 + x2) / 2;

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

// ─── Context panel ───────────────────────────────────────────────────────────

function ContextPanel({
  de, spine, detailNode, allNodes, focusNode, onClose, onNavigateToNode, onFocusNode,
}: {
  de: boolean;
  spine: Spine;
  detailNode: SpineNode;
  allNodes: DerivCanvasNode[];
  focusNode: DerivCanvasNode | null;
  onClose: () => void;
  onNavigateToNode?: (canvasId: string) => void;
  onFocusNode: (canvasId: string) => void;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  // Resolve upstream chain: walk back through anchors to the focus
  const upstream = useMemo(() => {
    const chain: SpineNode[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const n = findSpineNode(spine, id);
      if (!n) return;
      chain.push(n);
      n.anchors.sources.forEach(src => walk(src));
    };
    detailNode.anchors.sources.forEach(src => walk(src));
    return chain;
  }, [detailNode, spine]);

  const stageMeta = STAGE_META[detailNode.stage];
  const StageIcon = stageMeta.Icon;
  const stageColor = stageMeta.color;
  const canvasNode = detailNode.canvasId ? allNodes.find(n => n.id === detailNode.canvasId) : null;
  const isFocused = detailNode.canvasId === focusNode?.id;
  const canRefocus = detailNode.canvasId
    && !isFocused
    && (detailNode.stage === "question" ||
        detailNode.stage === "insights" ||
        detailNode.stage === "scenarios" ||
        detailNode.stage === "decisions");

  return (
    <div style={{
      // Panel breiter als zuvor (340 → 420), damit längere Headlines und
      // mehrzeiliger Text atmen können. Max-width deckelt ihn bei 520, falls
      // der Container sehr breit wird; flexShrink erlaubt Schrumpfen auf engen
      // Viewports bis auf 320.
      width: "clamp(320px, 32vw, 520px)", flexShrink: 1, flexBasis: 420,
      minWidth: 320, maxWidth: 520,
      height: "100%",
      borderLeft: "1px solid var(--color-border)",
      background: "rgba(248,248,248,0.94)", backdropFilter: "blur(10px)",
      padding: 12,
      display: "flex", flexDirection: "column",
      fontSize: 12, color: "var(--color-text-secondary)",
    }}>
      {/* Card shell — mirrors the Canvas DerivedNodeCard visual language */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "flex", flexDirection: "column",
        background: "var(--color-surface)",
        border: `1.5px solid ${isFocused ? "#0A0A0A" : "var(--color-border, #E8E8E8)"}`,
        borderRadius: 12, overflow: "hidden",
        // Fix 2026-04-21 (User-Feedback "gelber glow"): der pastel-lime Ring
        // (0 0 0 3px rgba(228,255,151,0.55)) mischte sich mit dem inset
        // Stage-Farbstreifen und wirkte auf goldenen/amber Stage-Karten
        // als gelb-orange Aureole rund um das Panel. Jetzt: kein äußerer
        // Ring mehr, Fokus wird nur durch den dunklen 1.5px-Border +
        // den farbigen inset-Streifen + einen dezenten Lift-Schatten
        // signalisiert.
        boxShadow: isFocused
          ? `inset 3px 0 0 ${stageColor}, 0 4px 18px rgba(0,0,0,0.08)`
          : `inset 3px 0 0 ${stageColor}, 0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)`,
      }}>
        {/* Header — stage badge pill + optional FOKUS + close */}
        <div style={{
          minHeight: 36, padding: "8px 12px", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          background: `${stageColor}0C`,
          borderBottom: `1px solid ${stageColor}22`,
        }}>
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
            color: stageColor, background: `${stageColor}14`, border: `1px solid ${stageColor}30`,
            borderRadius: 6, padding: "4px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <StageIcon size={11} strokeWidth={2} />
            {de ? stageMeta.labelDe : stageMeta.labelEn}
          </span>
          {isFocused && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px",
              borderRadius: 4, background: "#6B7A00", color: "#fff",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              {tl("orbit.focusLabel")}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            title={tl("orbit.closeContextTip")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-muted)", padding: 2, lineHeight: 0,
              display: "inline-flex", alignItems: "center",
            }}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {/* Title + chain-rel block */}
        <div style={{
          padding: "12px 14px 10px", flexShrink: 0,
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)",
            lineHeight: 1.3, marginBottom: 6, wordBreak: "break-word",
          }}>
            {detailNode.label}
          </div>
          {detailNode.sublabel && (
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8, lineHeight: 1.4 }}>
              {detailNode.sublabel}
            </div>
          )}
          {/* Chain-relevance meter */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 4,
            fontSize: 10, color: "var(--color-text-muted)",
          }}>
            <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {tl("orbit.chainRelLabel")}
            </span>
            <div style={{
              flex: 1, height: 4, background: "var(--color-border)",
              borderRadius: 2, overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.round(detailNode.chainRel * 100)}%`, height: "100%",
                background: stageColor,
              }} />
            </div>
            <span style={{
              fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
              color: stageColor, minWidth: 32, textAlign: "right",
            }}>{Math.round(detailNode.chainRel * 100)}%</span>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 14px 14px", minHeight: 0 }}>
          {/* Upstream chain */}
          {upstream.length > 0 && (
            <ContextSection title={tl("orbit.derivedFrom")} icon={<GitBranch size={12} strokeWidth={1.8} />}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {upstream.slice(0, 8).map(u => {
                  const meta = STAGE_META[u.stage];
                  const Ico = meta.Icon;
                  return (
                    <div key={u.id} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 11, padding: "4px 8px",
                      borderRadius: 6,
                      background: `${meta.color}08`,
                      border: `1px solid ${meta.color}22`,
                    }}>
                      <span style={{ color: meta.color, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                        <Ico size={10} strokeWidth={2} />
                      </span>
                      <span style={{ fontSize: 9, color: meta.color, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>
                        {de ? meta.labelDe : meta.labelEn}
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-secondary)" }}>
                        {u.label}
                      </span>
                      <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        {Math.round(u.chainRel * 100)}%
                      </span>
                    </div>
                  );
                })}
                {upstream.length > 8 && (
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", padding: "2px 4px" }}>
                    +{upstream.length - 8} {tl("orbit.moreSuffix")}
                  </div>
                )}
              </div>
            </ContextSection>
          )}

          {/* Stage-specific content */}
          {detailNode.stage === "question" && canvasNode && (
            <QuestionContent node={canvasNode} de={de} />
          )}
          {detailNode.stage === "signals" && detailNode.signal && (
            <SignalContent signal={detailNode.signal} de={de} />
          )}
          {detailNode.stage === "trends" && detailNode.trend && (
            <TrendContent trend={detailNode.trend} de={de} />
          )}
          {detailNode.stage === "edges" && detailNode.edge && (
            <EdgeContent edge={detailNode.edge} spine={spine} de={de} />
          )}
          {(detailNode.stage === "insights" ||
            detailNode.stage === "scenarios" ||
            detailNode.stage === "decisions") && canvasNode && (
            <DerivedContent node={canvasNode} de={de} />
          )}
        </div>

        {/* Actions footer */}
        {(canRefocus || detailNode.canvasId) && (
          <div style={{
            padding: "10px 12px", borderTop: "1px solid var(--color-border)",
            display: "flex", gap: 6, background: "rgba(0,0,0,0.02)",
            flexShrink: 0,
          }}>
            {canRefocus && detailNode.canvasId && (
              <button
                onClick={() => onFocusNode(detailNode.canvasId!)}
                title={tl("orbit.focusSpineTip")}
                style={{
                  flex: 1, fontSize: 11, fontWeight: 600, padding: "6px 10px",
                  borderRadius: 6, border: `1px solid ${stageColor}66`,
                  background: `${stageColor}12`, color: stageColor, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${stageColor}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${stageColor}12`; }}
              >
                <Target size={11} strokeWidth={2} />
                {tl("orbit.focusSpine")}
              </button>
            )}
            {detailNode.canvasId && onNavigateToNode && (
              <button
                onClick={() => onNavigateToNode(detailNode.canvasId!)}
                title={tl("orbit.openNodeTip")}
                style={{
                  flex: 1, fontSize: 11, fontWeight: 600, padding: "6px 10px",
                  borderRadius: 6, border: "1px solid var(--color-border)",
                  background: "var(--color-surface)", color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
              >
                <ArrowUpRight size={11} strokeWidth={2} />
                {tl("orbit.openInCanvas")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContextSection({
  title, icon, children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--color-text-muted)",
        marginBottom: 6,
      }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function QuestionContent({ node, de }: { node: DerivCanvasNode; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const r = node.result;
  return (
    <>
      {node.query && (
        <ContextSection title={tl("orbit.questionLabel")} icon={<HelpCircle size={12} strokeWidth={1.8} />}>
          <div style={{
            fontSize: 12, lineHeight: 1.5, color: "var(--color-text-heading)",
            padding: "8px 10px", background: "var(--color-surface, #F5F5F5)",
            borderRadius: 6, border: "1px solid var(--color-border)",
          }}>
            {node.query}
          </div>
        </ContextSection>
      )}
      {r?.synthesis && (
        <ContextSection title={tl("orbit.synthesisLabel")} icon={<Lightbulb size={12} strokeWidth={1.8} />}>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--color-text-secondary)", whiteSpace: "pre-wrap" }}>
            {r.synthesis}
          </div>
        </ContextSection>
      )}
      {r?.keyInsights && r.keyInsights.length > 0 && (
        <ContextSection title={tl("orbit.keyInsightsLabel")} icon={<Lightbulb size={12} strokeWidth={1.8} />}>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, lineHeight: 1.5 }}>
            {r.keyInsights.slice(0, 6).map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </ContextSection>
      )}
      {r?.matchedTrends && r.matchedTrends.length > 0 && (
        <ContextSection title={tl("orbit.matchedTrendsLabel")} icon={<TrendingUp size={12} strokeWidth={1.8} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {r.matchedTrends.slice(0, 8).map(t => {
              const rel = typeof t.queryRelevance === "number" ? t.queryRelevance : t.relevance * t.confidence;
              return (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 11, padding: "3px 8px",
                  borderRadius: 5, background: "var(--color-surface, #F5F5F5)",
                }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name}
                  </span>
                  <span style={{
                    fontSize: 9, fontFamily: "var(--font-mono, monospace)",
                    color: rel >= 0.6 ? "#445300" : rel >= 0.3 ? "var(--color-text-secondary)" : "var(--color-text-muted)",
                    fontWeight: 600,
                  }}>
                    {Math.round(rel * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </ContextSection>
      )}
      {r?.references && r.references.length > 0 && (
        <ContextSection title={tl("orbit.referencesLabel")} icon={<LinkIcon size={12} strokeWidth={1.8} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {r.references.slice(0, 10).map((ref, i) => (
              <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, padding: "5px 8px",
                  borderRadius: 6, background: "var(--color-surface, #F5F5F5)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                <ExternalLink size={10} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ref.title || ref.url}
                </span>
              </a>
            ))}
          </div>
        </ContextSection>
      )}
    </>
  );
}

function SignalContent({ signal, de }: { signal: UsedSignal; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  return (
    <ContextSection title={tl("orbit.signalLabel")} icon={<Radio size={12} strokeWidth={1.8} />}>
      <div style={{
        padding: "10px 12px", borderRadius: 8,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface, #F5F5F5)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", lineHeight: 1.4, marginBottom: 5 }}>
          {signal.title}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10, color: "var(--color-text-muted)", marginBottom: signal.url ? 6 : 0 }}>
          <span style={{
            fontFamily: "var(--font-mono, monospace)", fontWeight: 600,
            color: "var(--color-text-secondary)",
          }}>
            {signal.source}
          </span>
          {signal.date && <><span>·</span><span>{signal.date}</span></>}
          {typeof signal.strength === "number" && <><span>·</span><span>{tl("orbit.strengthLabel")} {Math.round(signal.strength * 100)}%</span></>}
        </div>
        {signal.url && (
          <a href={signal.url} target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 10.5, color: "#2563EB", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "100%",
            }}>
            <ExternalLink size={9} strokeWidth={1.8} />
            {signal.url.length > 46 ? signal.url.slice(0, 46) + "…" : signal.url}
          </a>
        )}
      </div>
    </ContextSection>
  );
}

function TrendContent({ trend, de }: { trend: MatchedTrend; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const qr = typeof trend.queryRelevance === "number" ? trend.queryRelevance : null;
  return (
    <ContextSection title={tl("orbit.trendLabel")} icon={<TrendingUp size={12} strokeWidth={1.8} />}>
      <div style={{
        padding: "10px 12px", borderRadius: 8,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface, #F5F5F5)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", lineHeight: 1.3, marginBottom: 6 }}>
          {trend.name}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {trend.category}
        </div>
        <MetricGrid items={[
          ...(qr !== null ? [{ label: tl("orbit.queryRelLabel"), value: `${Math.round(qr * 100)}%`, emphasis: qr >= 0.6 }] : []),
          { label: tl("orbit.relevanceLabel"), value: `${Math.round(trend.relevance * 100)}%` },
          { label: tl("orbit.confidenceLabel"), value: `${Math.round(trend.confidence * 100)}%` },
          { label: tl("orbit.impactLabel"), value: `${Math.round(trend.impact * 100)}%` },
          { label: tl("orbit.ringLabel"), value: trend.ring },
          { label: tl("orbit.signalsLabel"), value: String(trend.signalCount) },
          { label: tl("orbit.velocityLabel"), value: trend.velocity },
        ]} />
      </div>
    </ContextSection>
  );
}

function EdgeContent({ edge, spine, de }: { edge: MatchedEdge; spine: Spine; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const fromName = spine.columns.trends.find(t => t.trend?.id === edge.from)?.label ?? edge.from;
  const toName = spine.columns.trends.find(t => t.trend?.id === edge.to)?.label ?? edge.to;
  const typeColor: Record<string, string> = {
    drives: "#1A9E5A", amplifies: "#2563EB", dampens: "#E8402A", correlates: "#9CA3AF",
  };
  const c = typeColor[edge.type] ?? "#6B7A00";
  const typeLabel: Record<string, { de: string; en: string }> = {
    drives: { de: "treibt", en: "drives" },
    amplifies: { de: "verstärkt", en: "amplifies" },
    dampens: { de: "dämpft", en: "dampens" },
    correlates: { de: "korreliert", en: "correlates" },
  };
  const tlabel = typeLabel[edge.type] ?? { de: edge.type, en: edge.type };
  return (
    <ContextSection title={tl("orbit.causalEdgeLabel")} icon={<GitBranch size={12} strokeWidth={1.8} />}>
      <div style={{
        padding: "10px 12px", borderRadius: 8,
        border: `1px solid ${c}44`, background: `${c}08`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11.5, lineHeight: 1.4 }}>
          <span style={{ flex: 1, fontWeight: 600, color: "var(--color-text-heading)" }}>{fromName}</span>
        </div>
        <div style={{
          display: "inline-block", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
          padding: "2px 8px", borderRadius: 4, background: c, color: "#fff", marginBottom: 8,
        }}>
          {de ? tlabel.de : tlabel.en}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-text-heading)", lineHeight: 1.4, marginBottom: 8 }}>
          {toName}
        </div>
        <MetricGrid items={[
          { label: tl("orbit.strengthLabel"), value: `${Math.round(edge.strength * 100)}%` },
          ...(typeof edge.queryRelevance === "number"
            ? [{ label: tl("orbit.queryRelLabel"), value: `${Math.round(edge.queryRelevance * 100)}%`, emphasis: edge.queryRelevance >= 0.6 }]
            : []),
        ]} />
        {edge.description && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {edge.description}
          </div>
        )}
      </div>
    </ContextSection>
  );
}

function DerivedContent({ node, de }: { node: DerivCanvasNode; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  return (
    <>
      {node.content && (
        <ContextSection title={tl("orbit.contentLabel")} icon={<Lightbulb size={12} strokeWidth={1.8} />}>
          <div style={{
            fontSize: 12, lineHeight: 1.55, color: "var(--color-text-secondary)",
            whiteSpace: "pre-wrap",
            padding: "8px 10px", background: "var(--color-surface, #F5F5F5)",
            borderRadius: 6, border: "1px solid var(--color-border)",
          }}>
            {node.content}
          </div>
        </ContextSection>
      )}
    </>
  );
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string; emphasis?: boolean }> }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
      fontSize: 10.5,
    }}>
      {items.map((m, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          padding: "3px 6px", borderRadius: 4,
          background: m.emphasis ? "#6B7A0014" : "rgba(0,0,0,0.025)",
        }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 600 }}>
            {m.label}
          </span>
          <span style={{
            fontFamily: "var(--font-mono, monospace)", fontWeight: 600,
            color: m.emphasis ? "#445300" : "var(--color-text-heading)",
          }}>
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}
