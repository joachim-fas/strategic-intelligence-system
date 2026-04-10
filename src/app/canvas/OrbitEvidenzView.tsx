"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   OrbitEvidenzView — Evidence constellation for Canvas orbit mode

   Radial "evidence map" centered on a selected canvas node.
   Three concentric rings show where a conclusion came from:

     Ring 0 (center): the focused node (query, insight, scenario, etc.)
     Ring 1: direct evidence — signals, reasoning chains, parent query
     Ring 2: trend context — matched trends, causal edges
     Ring 3: derived outputs — sibling nodes, references

   Users can "walk" the evidence chain by clicking ring nodes that link
   back to other canvas nodes, making them the new center.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types (subset of canvas page types) ────────────────────────────────────

interface EvSignal {
  source: string;
  title: string;
  url?: string;
  strength?: number;
  date?: string;
}

interface EvTrend {
  id: string;
  name: string;
  category: string;
  relevance: number;
  confidence: number;
  impact: number;
}

interface EvEdge {
  from: string;
  to: string;
  type: string;
  strength: number;
  description?: string;
}

interface EvResult {
  synthesis?: string;
  reasoningChains?: string[];
  keyInsights?: string[];
  scenarios?: Array<{
    name: string;
    description: string;
    probability: number;
    keyDrivers?: string[];
  }>;
  decisionFramework?: string;
  references?: Array<{ title: string; url: string; relevance?: string }>;
  followUpQuestions?: string[];
  usedSignals?: EvSignal[];
  matchedTrends?: EvTrend[];
  matchedEdges?: EvEdge[];
  causalAnalysis?: string[];
}

/** Minimal canvas-node shape consumed by this component. */
export interface EvCanvasNode {
  id: string;
  nodeType: string;
  createdAt: number;
  query?: string;
  result?: EvResult | null;
  content?: string;
  label?: string;
  title?: string;
  parentId?: string;
  sources?: EvSignal[];
  causalEdges?: EvEdge[];
  causalTrendNames?: Record<string, string>;
  keyDrivers?: string[];
}

// ─── Ring node model ────────────────────────────────────────────────────────

type RingNodeType =
  | "center" | "signal" | "reasoning" | "trend" | "causal"
  | "insight" | "scenario" | "decision" | "reference"
  | "followup" | "query-parent";

interface RingNode {
  id: string;
  type: RingNodeType;
  label: string;
  detail?: string;
  ring: number;
  angle: number;
  fg: string;
  bg: string;
  r: number;
  strength?: number;
  canvasId?: string;
}

interface RingLink {
  from: string;
  to: string;
  color: string;
  opacity: number;
  dashed?: boolean;
}

// ─── Style constants ────────────────────────────────────────────────────────

// Ring radii are computed dynamically from viewport in the component.
// These fractions define the proportion of available radius for each ring.
const RING_FRAC = [0, 0.37, 0.66, 0.93];

const RING_LABEL = {
  de: ["", "Direkte Evidenz", "Trend-Kontext", "Abgeleitete Ergebnisse"],
  en: ["", "Direct Evidence", "Trend Context", "Derived Results"],
};

const TYPE_STYLE: Record<RingNodeType, {
  fg: string; bg: string; icon: string; de: string; en: string;
}> = {
  center:         { fg: "#0A0A0A", bg: "#E4FF97", icon: "\u25C9", de: "Fokus",      en: "Focus" },
  signal:         { fg: "#1E40AF", bg: "#DBEAFE", icon: "S",      de: "Signal",     en: "Signal" },
  reasoning:      { fg: "#92400E", bg: "#FEF3C7", icon: "R",      de: "Kette",      en: "Chain" },
  trend:          { fg: "#5B21B6", bg: "#EDE9FE", icon: "T",      de: "Trend",      en: "Trend" },
  causal:         { fg: "#065F46", bg: "#D1FAE5", icon: "\u21C4", de: "Kausal",     en: "Causal" },
  insight:        { fg: "#1E3A5F", bg: "#DBEAFE", icon: "I",      de: "Erkenntnis", en: "Insight" },
  scenario:       { fg: "#9A3412", bg: "#FFEDD5", icon: "Sc",     de: "Szenario",   en: "Scenario" },
  decision:       { fg: "#065F46", bg: "#D1FAE5", icon: "E",      de: "Empfehlung", en: "Decision" },
  reference:      { fg: "#374151", bg: "#F3F4F6", icon: "\u2197", de: "Referenz",   en: "Reference" },
  followup:       { fg: "#5B21B6", bg: "#EDE9FE", icon: "?",      de: "Folgefrage", en: "Follow-up" },
  "query-parent": { fg: "#0A0A0A", bg: "#F3F4F6", icon: "Q",      de: "Analyse",    en: "Query" },
};

const CENTERABLE = new Set([
  "query", "insight", "scenario", "decision",
  "causalgraph", "dimensions", "followup",
]);

// ─── Graph builder ──────────────────────────────────────────────────────────

function buildEvidenzGraph(
  centerId: string,
  allNodes: EvCanvasNode[],
): { ringNodes: RingNode[]; links: RingLink[] } {
  const cn = allNodes.find(n => n.id === centerId);
  if (!cn) return { ringNodes: [], links: [] };

  const ringNodes: RingNode[] = [];
  const links: RingLink[] = [];
  let seq = 0;
  const nextId = () => `ev-${seq++}`;

  // Resolve query result — either this node (if query) or its parent
  let qr: EvResult | null = null;
  let parentQuery: EvCanvasNode | null = null;

  if (cn.nodeType === "query") {
    qr = cn.result ?? null;
  } else if (cn.parentId) {
    parentQuery = allNodes.find(n => n.id === cn.parentId) ?? null;
    if (parentQuery?.nodeType === "query") {
      qr = parentQuery.result ?? null;
    }
  }

  // ── Center node ──────────────────────────────────────────────────────
  const centerLabel = cn.nodeType === "query"
    ? (cn.query ?? "Analyse")
    : (cn.label ?? cn.content?.slice(0, 60) ?? cn.nodeType);

  ringNodes.push({
    id: "c0", type: "center",
    label: centerLabel.slice(0, 50),
    ring: 0, angle: 0,
    fg: TYPE_STYLE.center.fg, bg: TYPE_STYLE.center.bg,
    r: 38, canvasId: centerId,
  });

  // ── Helper: distribute items evenly on a ring ────────────────────────
  function addRing(
    items: Array<Omit<RingNode, "angle">>,
    linkOpacity: number,
    dashFn?: (t: RingNodeType) => boolean,
  ) {
    items.forEach((item, i) => {
      const angle = items.length === 1
        ? -Math.PI / 2
        : (i / items.length) * 2 * Math.PI - Math.PI / 2;
      ringNodes.push({ ...item, angle } as RingNode);
      links.push({
        from: "c0", to: item.id,
        color: item.fg, opacity: linkOpacity,
        dashed: dashFn?.(item.type) ?? false,
      });
    });
  }

  // ── Ring 1: Direct evidence ──────────────────────────────────────────
  const ring1: Omit<RingNode, "angle">[] = [];

  // Signals from query result or node sources
  const signals = qr?.usedSignals ?? cn.sources ?? [];
  signals.slice(0, 12).forEach(s => {
    ring1.push({
      id: nextId(), type: "signal",
      label: (s.title || s.source).slice(0, 28),
      detail: [s.source, s.date, s.url].filter(Boolean).join(" \u00B7 "),
      ring: 1, fg: TYPE_STYLE.signal.fg, bg: TYPE_STYLE.signal.bg,
      r: 15 + (s.strength ?? 0.5) * 7,
      strength: s.strength,
    });
  });

  // Reasoning chains
  (qr?.reasoningChains ?? []).slice(0, 4).forEach(chain => {
    ring1.push({
      id: nextId(), type: "reasoning",
      label: chain.length > 30 ? chain.slice(0, 30) + "\u2026" : chain,
      detail: chain,
      ring: 1, fg: TYPE_STYLE.reasoning.fg, bg: TYPE_STYLE.reasoning.bg,
      r: 15,
    });
  });

  // Causal analysis strings
  (qr?.causalAnalysis ?? []).slice(0, 3).forEach(ca => {
    ring1.push({
      id: nextId(), type: "reasoning",
      label: ca.length > 30 ? ca.slice(0, 30) + "\u2026" : ca,
      detail: ca,
      ring: 1, fg: TYPE_STYLE.reasoning.fg, bg: TYPE_STYLE.reasoning.bg,
      r: 13,
    });
  });

  // Parent query (if center is a derived node)
  if (parentQuery) {
    ring1.push({
      id: nextId(), type: "query-parent",
      label: (parentQuery.query ?? "Analyse").slice(0, 26),
      detail: parentQuery.query,
      ring: 1, fg: TYPE_STYLE["query-parent"].fg, bg: TYPE_STYLE["query-parent"].bg,
      r: 22, canvasId: parentQuery.id,
    });
  }

  addRing(ring1, 0.2);

  // ── Ring 2: Trend context ────────────────────────────────────────────
  const ring2: Omit<RingNode, "angle">[] = [];

  // Matched trends
  (qr?.matchedTrends ?? []).slice(0, 10).forEach(t => {
    ring2.push({
      id: nextId(), type: "trend",
      label: (t.name || t.id).slice(0, 24),
      detail: `${t.category} \u00B7 Rel. ${Math.round(t.relevance * 100)}% \u00B7 Konf. ${Math.round(t.confidence * 100)}%`,
      ring: 2, fg: TYPE_STYLE.trend.fg, bg: TYPE_STYLE.trend.bg,
      r: 12 + t.relevance * 8,
      strength: t.relevance,
    });
  });

  // Causal edges
  const trendNames = cn.causalTrendNames ?? {};
  const matchedTrends = qr?.matchedTrends ?? [];
  (qr?.matchedEdges ?? cn.causalEdges ?? []).slice(0, 8).forEach(e => {
    const fromName = trendNames[e.from]
      || matchedTrends.find(t => t.id === e.from)?.name
      || e.from.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " ");
    const toName = trendNames[e.to]
      || matchedTrends.find(t => t.id === e.to)?.name
      || e.to.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " ");
    ring2.push({
      id: nextId(), type: "causal",
      label: `${fromName.slice(0, 11)} \u2192 ${toName.slice(0, 11)}`,
      detail: `${fromName} ${e.type} ${toName}${e.description ? `\n${e.description}` : ""}\n${Math.round(e.strength * 100)}%`,
      ring: 2, fg: TYPE_STYLE.causal.fg, bg: TYPE_STYLE.causal.bg,
      r: 12 + e.strength * 6,
      strength: e.strength,
    });
  });

  addRing(ring2, 0.13, type => type === "causal");

  // ── Ring 3: Derived results / siblings / references ──────────────────
  const ring3: Omit<RingNode, "angle">[] = [];
  const derivedTypes = ["insight", "scenario", "decision", "followup"];

  if (cn.nodeType === "query") {
    // Center is a query: show its derived children
    allNodes
      .filter(n => n.parentId === centerId && derivedTypes.includes(n.nodeType))
      .slice(0, 12)
      .forEach(d => {
        const st = TYPE_STYLE[d.nodeType as RingNodeType] ?? TYPE_STYLE.insight;
        ring3.push({
          id: nextId(), type: d.nodeType as RingNodeType,
          label: (d.label ?? d.content?.slice(0, 26) ?? d.nodeType).slice(0, 26),
          detail: d.content,
          ring: 3, fg: st.fg, bg: st.bg, r: 13,
          canvasId: d.id,
        });
      });
  } else if (cn.parentId) {
    // Center is a derived node: show siblings
    allNodes
      .filter(n => n.parentId === cn.parentId && n.id !== centerId && derivedTypes.includes(n.nodeType))
      .slice(0, 10)
      .forEach(d => {
        const st = TYPE_STYLE[d.nodeType as RingNodeType] ?? TYPE_STYLE.insight;
        ring3.push({
          id: nextId(), type: d.nodeType as RingNodeType,
          label: (d.label ?? d.content?.slice(0, 26) ?? d.nodeType).slice(0, 26),
          detail: d.content,
          ring: 3, fg: st.fg, bg: st.bg, r: 12,
          canvasId: d.id,
        });
      });
  }

  // References
  (qr?.references ?? []).slice(0, 5).forEach(ref => {
    ring3.push({
      id: nextId(), type: "reference",
      label: (ref.title || "Referenz").slice(0, 24),
      detail: `${ref.title}\n${ref.url}${ref.relevance ? `\n${ref.relevance}` : ""}`,
      ring: 3, fg: TYPE_STYLE.reference.fg, bg: TYPE_STYLE.reference.bg, r: 11,
    });
  });

  addRing(ring3, 0.08, () => true);

  return { ringNodes, links };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface OrbitEvidenzViewProps {
  nodes: EvCanvasNode[];
  selectedNodeId?: string | null;
  de: boolean;
  onNavigateToNode?: (nodeId: string) => void;
}

export function OrbitEvidenzView({
  nodes,
  selectedNodeId,
  de,
  onNavigateToNode,
}: OrbitEvidenzViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });

  // Determine initial center node
  const initialCenter = useMemo(() => {
    if (selectedNodeId) {
      const n = nodes.find(n => n.id === selectedNodeId);
      if (n && CENTERABLE.has(n.nodeType)) return selectedNodeId;
    }
    // Auto-select first query node
    const first = nodes.find(n => n.nodeType === "query");
    return first?.id ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [centerId, setCenterId] = useState<string | null>(initialCenter);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

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

  // Build evidence graph
  const { ringNodes, links } = useMemo(() => {
    if (!centerId) return { ringNodes: [], links: [] };
    return buildEvidenzGraph(centerId, nodes);
  }, [centerId, nodes]);

  // Dynamic ring radii: scale to fit viewport
  const ringRadii = useMemo(() => {
    const maxR = Math.min(dims.w, dims.h) / 2 * 0.88;
    return RING_FRAC.map(f => f * maxR);
  }, [dims]);

  // Compute deterministic radial positions
  const positions = useMemo(() => {
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    return new Map(
      ringNodes.map(n => [
        n.id,
        {
          x: cx + ringRadii[n.ring] * Math.cos(n.angle),
          y: cy + ringRadii[n.ring] * Math.sin(n.angle),
        },
      ])
    );
  }, [ringNodes, dims, ringRadii]);

  // Active node (hovered takes precedence over selected)
  const activeId = hoveredId ?? selectedRingId;
  const activeNode = activeId ? ringNodes.find(n => n.id === activeId) : null;

  // ── Pan/zoom handlers ─────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ev-node]")) return;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!panStart.current) return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x) / zoom,
      y: panStart.current.py + (e.clientY - panStart.current.y) / zoom,
    });
  }, [zoom]);

  const handlePointerUp = useCallback(() => { panStart.current = null; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.3, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, []);

  // Navigate to a canvas node as new center
  const focusNode = useCallback((canvasId: string) => {
    setCenterId(canvasId);
    setSelectedRingId(null);
    setHoveredId(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // ── Node picker (when no center selected) ─────────────────────────────

  if (!centerId || ringNodes.length === 0) {
    const pickerGroups: Array<{ types: string[]; label: string; icon: string }> = [
      { types: ["query"],       label: de ? "Analysen"      : "Queries",     icon: "Q" },
      { types: ["insight"],     label: de ? "Erkenntnisse"  : "Insights",    icon: "I" },
      { types: ["scenario"],    label: de ? "Szenarien"     : "Scenarios",   icon: "Sc" },
      { types: ["decision"],    label: de ? "Empfehlungen"  : "Decisions",   icon: "E" },
      { types: ["causalgraph"], label: de ? "Kausalnetze"   : "Causal Nets", icon: "\u21C4" },
      { types: ["followup"],    label: de ? "Folgefragen"   : "Follow-ups",  icon: "?" },
    ];

    const eligible = nodes.filter(n => CENTERABLE.has(n.nodeType));

    if (eligible.length === 0) {
      return (
        <div ref={containerRef} style={{
          height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-muted)", fontSize: 14,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>{"\u25C9"}</div>
            <div>{de ? "Noch keine Analyseergebnisse vorhanden" : "No analysis results yet"}</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>
              {de
                ? "Starte eine Analyse im Canvas, um die Evidenz-Ansicht zu nutzen"
                : "Run an analysis in Canvas to use the Evidence view"}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div ref={containerRef} style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40, overflowY: "auto",
      }}>
        <div style={{ maxWidth: 520, width: "100%" }}>
          {/* Picker header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.25 }}>{"\u25C9"}</div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: "var(--color-text-heading)",
            }}>
              {de ? "Evidenz-Ansicht" : "Evidence View"}
            </div>
            <div style={{
              fontSize: 12, color: "var(--color-text-muted)",
              marginTop: 6, lineHeight: 1.5,
            }}>
              {de
                ? "Signale, Trends und Ableitungen als konzentrische Ringe um einen Fokus-Knoten."
                : "Signals, trends and derivations as concentric rings around a focus node."}
            </div>
          </div>

          {/* Node groups */}
          {pickerGroups.map(group => {
            const items = eligible.filter(n => group.types.includes(n.nodeType));
            if (items.length === 0) return null;
            const st = TYPE_STYLE[group.types[0] as RingNodeType] ?? TYPE_STYLE.insight;
            return (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  color: "var(--color-text-muted)",
                  marginBottom: 6, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: st.bg, color: st.fg,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700,
                  }}>
                    {group.icon}
                  </span>
                  {group.label} ({items.length})
                </div>
                {items.map(n => (
                  <button
                    key={n.id}
                    onClick={() => focusNode(n.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left" as const,
                      fontSize: 12, padding: "8px 12px", marginBottom: 3,
                      borderRadius: 8, border: "1px solid var(--color-border)",
                      background: "transparent",
                      color: "var(--color-text-secondary)",
                      cursor: "pointer", transition: "background 0.12s",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--color-surface, #F5F5F5)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {n.nodeType === "query"
                      ? n.query?.slice(0, 80)
                      : (n.label ?? n.content?.slice(0, 80) ?? n.nodeType)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Radial visualization ──────────────────────────────────────────────

  const cx = dims.w / 2;
  const cy = dims.h / 2;
  const ringLabels = de ? RING_LABEL.de : RING_LABEL.en;

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%", position: "relative", overflow: "hidden",
        cursor: panStart.current ? "grabbing" : "grab",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      <svg
        width={dims.w} height={dims.h}
        style={{ position: "absolute", inset: 0 }}
        viewBox={`${-pan.x} ${-pan.y} ${dims.w / zoom} ${dims.h / zoom}`}
      >
        {/* ── Concentric ring circles ───────────────────────────────── */}
        {[1, 2, 3].map(i => (
          <React.Fragment key={`ring-${i}`}>
            <circle
              cx={cx} cy={cy} r={ringRadii[i]}
              fill="none"
              stroke="var(--color-border, #E0E0E0)"
              strokeWidth={0.8}
              strokeDasharray="6,4"
              strokeOpacity={0.5 - i * 0.1}
            />
            {/* Ring label at top of each ring */}
            <text
              x={cx} y={cy - ringRadii[i] - 8}
              textAnchor="middle" fontSize={9} fontWeight={700}
              fill="var(--color-text-muted, #999)"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "0.06em",
              }}
              opacity={0.55}
            >
              {ringLabels[i]}
            </text>
          </React.Fragment>
        ))}

        {/* ── Links from center to ring nodes ───────────────────────── */}
        {links.map((lk, i) => {
          const from = positions.get(lk.from);
          const to = positions.get(lk.to);
          if (!from || !to) return null;
          const isHighlighted = activeId === lk.to || activeId === lk.from;
          return (
            <line
              key={`lk-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={lk.color}
              strokeWidth={isHighlighted ? 1.8 : 0.8}
              strokeOpacity={isHighlighted ? 0.45 : lk.opacity}
              strokeDasharray={lk.dashed ? "4,3" : "none"}
              style={{ transition: "stroke-opacity 0.2s, stroke-width 0.2s" }}
            />
          );
        })}

        {/* ── Ring nodes ─────────────────────────────────────────────── */}
        {ringNodes.map(n => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const isActive = n.id === activeId;
          const isCenter = n.ring === 0;
          const hasLink = !!n.canvasId && n.canvasId !== centerId;

          // Label positioning: push outward from center
          const dx = pos.x - cx;
          const dy = pos.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const labelX = isCenter ? pos.x : pos.x + (dx / dist) * (n.r + 10);
          const labelY = isCenter ? pos.y + n.r + 16 : pos.y + (dy / dist) * (n.r + 10);
          const anchor = isCenter ? "middle" : dx > 0 ? "start" : "end";
          const displayLabel = n.label.length > 22 && !isCenter
            ? n.label.slice(0, 22) + "\u2026"
            : n.label;

          return (
            <g
              key={n.id}
              data-ev-node
              style={{ cursor: hasLink ? "pointer" : "default", transition: "opacity 0.2s" }}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                if (hasLink) {
                  focusNode(n.canvasId!);
                } else {
                  setSelectedRingId(prev => prev === n.id ? null : n.id);
                }
              }}
            >
              {/* Glow ring on hover */}
              {isActive && (
                <circle
                  cx={pos.x} cy={pos.y} r={n.r + 5}
                  fill="none"
                  stroke={isCenter ? "#6B7A00" : `${n.fg}40`}
                  strokeWidth={2}
                />
              )}
              {/* Main circle */}
              <circle
                cx={pos.x} cy={pos.y} r={n.r}
                fill={isActive && !isCenter ? `${n.bg}CC` : n.bg}
                stroke={isActive ? n.fg : `${n.fg}40`}
                strokeWidth={isCenter ? 2.5 : isActive ? 1.8 : 1}
              />
              {/* Type icon inside circle */}
              <text
                x={pos.x} y={pos.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={isCenter ? 14 : n.r > 14 ? 10 : 8}
                fontWeight={700}
                fill={n.fg}
                style={{ pointerEvents: "none" }}
              >
                {TYPE_STYLE[n.type].icon}
              </text>
              {/* Label outside circle */}
              {(n.r >= 12 || isActive || isCenter) && (
                <text
                  x={labelX} y={labelY}
                  textAnchor={anchor} dominantBaseline="middle"
                  fontSize={isCenter ? 13 : isActive ? 11 : 10}
                  fontWeight={isCenter ? 700 : isActive ? 600 : 500}
                  fill={isCenter
                    ? "var(--color-text-heading, #111)"
                    : isActive ? n.fg : "var(--color-text-secondary, #666)"}
                  style={{ pointerEvents: "none", transition: "font-size 0.15s" }}
                >
                  {displayLabel}
                </text>
              )}
              {/* Navigable indicator for nodes with canvas link */}
              {hasLink && isActive && (
                <text
                  x={pos.x + n.r + 3} y={pos.y - n.r + 3}
                  fontSize={8} fill={n.fg} fontWeight={700}
                  style={{ pointerEvents: "none" }}
                >
                  {"\u21BB"}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Legend (top-left) ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 12, left: 16,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
        fontSize: 10, color: "var(--color-text-muted)",
        background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)",
        borderRadius: 8, padding: "5px 10px",
        border: "1px solid var(--color-border)",
        maxWidth: 420,
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>EVIDENZ</span>
        <span style={{ color: "var(--color-border)" }}>|</span>
        {(["signal", "reasoning", "trend", "causal", "insight", "scenario", "reference"] as RingNodeType[]).map(type => {
          const st = TYPE_STYLE[type];
          const count = ringNodes.filter(n => n.type === type).length;
          if (count === 0) return null;
          return (
            <span key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{
                width: 12, height: 12, borderRadius: 3,
                background: st.bg, border: `1px solid ${st.fg}30`,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 7, fontWeight: 700, color: st.fg,
              }}>
                {st.icon}
              </span>
              <span>{count}</span>
            </span>
          );
        })}
        <span style={{ color: "var(--color-border)" }}>|</span>
        <span>{ringNodes.length - 1} {de ? "Evidenzpunkte" : "evidence points"}</span>
      </div>

      {/* ── Zoom indicator (bottom-right) ─────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 12, right: 16,
        fontSize: 10, color: "var(--color-text-muted)",
        display: "flex", gap: 6, alignItems: "center",
      }}>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 4,
            border: "1px solid var(--color-border)",
            background: "transparent", color: "var(--color-text-muted)",
            cursor: "pointer",
          }}
        >{"\u2299"}</button>
      </div>

      {/* ── Center controls (bottom-left) ─────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 12, left: 16,
        display: "flex", gap: 6,
      }}>
        <button
          onClick={() => { setCenterId(null); setSelectedRingId(null); }}
          style={{
            fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
            color: "var(--color-text-secondary)", cursor: "pointer",
          }}
        >
          {"\u25C9"} {de ? "Zentrum wechseln" : "Change center"}
        </button>
        {onNavigateToNode && centerId && (
          <button
            onClick={() => onNavigateToNode(centerId)}
            style={{
              fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
              border: "1px solid #1A9E5A44", background: "#1A9E5A12",
              color: "#1A9E5A", cursor: "pointer",
            }}
          >
            {"\u2192"} Canvas
          </button>
        )}
      </div>

      {/* ── Detail sidebar (right, when ring node active) ─────────────── */}
      {activeNode && activeNode.ring > 0 && (
        <div style={{
          position: "absolute", top: 48, right: 12,
          width: 260, maxHeight: "calc(100% - 96px)",
          background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
          borderRadius: 12, border: "1px solid var(--color-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          padding: 14, overflowY: "auto", fontSize: 12,
        }}>
          {/* Type badge + label */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "start", marginBottom: 10,
          }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase" as const, color: activeNode.fg,
                background: activeNode.bg, borderRadius: 4,
                padding: "2px 6px", marginBottom: 6,
              }}>
                {TYPE_STYLE[activeNode.type].icon}{" "}
                {de ? TYPE_STYLE[activeNode.type].de : TYPE_STYLE[activeNode.type].en}
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: "var(--color-text-heading)",
                lineHeight: 1.35,
              }}>
                {activeNode.label}
              </div>
            </div>
            <button
              onClick={() => { setSelectedRingId(null); setHoveredId(null); }}
              style={{
                background: "none", border: "none", fontSize: 14,
                color: "var(--color-text-muted)", cursor: "pointer",
                padding: "0 4px", lineHeight: 1,
              }}
            >{"\u2715"}</button>
          </div>

          {/* Detail text */}
          {activeNode.detail && (
            <div style={{
              fontSize: 11, color: "var(--color-text-secondary)",
              lineHeight: 1.5, marginBottom: 10,
              whiteSpace: "pre-wrap", wordBreak: "break-word" as const,
            }}>
              {activeNode.detail.length > 300
                ? activeNode.detail.slice(0, 300) + "\u2026"
                : activeNode.detail}
            </div>
          )}

          {/* Strength bar */}
          {activeNode.strength !== undefined && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
            }}>
              <div style={{
                flex: 1, height: 4, borderRadius: 2,
                background: "var(--color-border)",
              }}>
                <div style={{
                  width: `${Math.round(activeNode.strength * 100)}%`,
                  height: "100%", borderRadius: 2,
                  background: activeNode.fg,
                }} />
              </div>
              <span style={{
                fontSize: 10, color: "var(--color-text-muted)", fontWeight: 600,
              }}>
                {Math.round(activeNode.strength * 100)}%
              </span>
            </div>
          )}

          {/* Action buttons for navigable nodes */}
          {activeNode.canvasId && activeNode.canvasId !== centerId && (
            <div style={{
              borderTop: "1px solid var(--color-border)",
              paddingTop: 10, display: "flex", gap: 6,
            }}>
              <button
                onClick={() => focusNode(activeNode.canvasId!)}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 600, padding: "6px 10px",
                  borderRadius: 6, border: `1px solid ${activeNode.fg}44`,
                  background: `${activeNode.fg}12`, color: activeNode.fg,
                  cursor: "pointer", transition: "background 0.12s",
                }}
              >
                {"\u25C9"} {de ? "Als Zentrum" : "Set center"}
              </button>
              {onNavigateToNode && (
                <button
                  onClick={() => onNavigateToNode(activeNode.canvasId!)}
                  style={{
                    flex: 1, fontSize: 10, fontWeight: 600, padding: "6px 10px",
                    borderRadius: 6, border: "1px solid var(--color-border)",
                    background: "transparent",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer", transition: "background 0.12s",
                  }}
                >
                  {"\u2192"} Canvas
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Interaction hint (bottom center) ──────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
        fontSize: 10, color: "var(--color-text-muted)", opacity: 0.5,
        background: "rgba(255,255,255,0.6)", borderRadius: 4, padding: "2px 8px",
        whiteSpace: "nowrap",
      }}>
        {de
          ? "Hover = Details \u00B7 Klick auf \u21BB = neues Zentrum \u00B7 Ziehen = Verschieben"
          : "Hover = Details \u00B7 Click \u21BB = new center \u00B7 Drag = Pan"}
      </div>
    </div>
  );
}
