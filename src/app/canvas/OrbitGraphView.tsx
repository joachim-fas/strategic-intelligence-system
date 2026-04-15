"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { ChevronLeft, ChevronRight, X, Filter, ArrowDownToLine } from "lucide-react";
import type { MatchedEdge } from "@/types";

interface OrbitNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  edgeCount: number;
  /** Which canvas query IDs referenced this trend */
  queryIds: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EDGE_COLOR: Record<string, string> = {
  drives: "#1A9E5A",
  amplifies: "#2563EB",
  dampens: "#E8402A",
  correlates: "#9CA3AF",
};

const EDGE_LABEL: Record<string, string> = {
  drives: "treibt",
  amplifies: "verstärkt",
  dampens: "dämpft",
  correlates: "korreliert",
};

const NODE_MIN_R = 11;
const NODE_MAX_R = 30;
const REPULSION = 4200;
const ATTRACTION = 0.0055;
const GRAVITY = 0.010;
const DAMPING = 0.88;
const SIM_STEPS = 240; // run offline simulation steps on mount
const SIDEBAR_W = 300;

// ─── OrbitGraphView ──────────────────────────────────────────────────────────

interface OrbitGraphViewProps {
  /** All canvas nodes (we extract causal data from causalgraph nodes) */
  allEdges: MatchedEdge[];
  allTrendNames: Record<string, string>;
  /** Map: trendId → array of parent query node IDs */
  trendQueryMap: Record<string, string[]>;
  /** Map: queryId → query text label (optional, falls back to id) */
  queryLabels?: Record<string, string>;
  de: boolean;
  onSelectQuery?: (queryId: string) => void;
}

export function OrbitGraphView({
  allEdges,
  allTrendNames,
  trendQueryMap,
  queryLabels,
  de,
  onSelectQuery,
}: OrbitGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [queryFilter, setQueryFilter] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // ── Query list for filter dropdown ──────────────────────────────────────────

  const queryList = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(trendQueryMap).forEach(qIds => {
      qIds.forEach(qid => counts.set(qid, (counts.get(qid) ?? 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count, label: queryLabels?.[id] ?? id.slice(0, 8) }));
  }, [trendQueryMap, queryLabels]);

  // ── Deduplicate edges and build node list ──────────────────────────────────

  const { nodes, edges, maxEdgeCount } = useMemo(() => {
    // Deduplicate edges by from→to key (keep strongest)
    const edgeMap = new Map<string, MatchedEdge>();
    for (const e of allEdges) {
      const key = `${e.from}→${e.to}`;
      const existing = edgeMap.get(key);
      if (!existing || e.strength > existing.strength) edgeMap.set(key, e);
    }
    let dedupedEdges = Array.from(edgeMap.values());

    // Apply query filter: keep only edges where BOTH endpoints are referenced by the filter query
    if (queryFilter) {
      dedupedEdges = dedupedEdges.filter(e => {
        const fromQueries = trendQueryMap[e.from] ?? [];
        const toQueries = trendQueryMap[e.to] ?? [];
        return fromQueries.includes(queryFilter) && toQueries.includes(queryFilter);
      });
    }

    // Collect trend IDs
    const trendIds = new Set<string>();
    dedupedEdges.forEach(e => { trendIds.add(e.from); trendIds.add(e.to); });

    // Edge count per node (within the filtered set)
    const edgeCounts = new Map<string, number>();
    dedupedEdges.forEach(e => {
      edgeCounts.set(e.from, (edgeCounts.get(e.from) ?? 0) + 1);
      edgeCounts.set(e.to, (edgeCounts.get(e.to) ?? 0) + 1);
    });
    const maxEc = Math.max(...Array.from(edgeCounts.values()), 1);

    // Initial positions: circle layout — container ref measures graph area only
    const arr = Array.from(trendIds);
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const initR = Math.min(cx, cy) * 0.78;
    const nodeList: OrbitNode[] = arr.map((id, i) => {
      const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
      return {
        id,
        label: allTrendNames[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "),
        x: cx + initR * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + initR * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        edgeCount: edgeCounts.get(id) ?? 0,
        queryIds: trendQueryMap[id] ?? [],
      };
    });

    return { nodes: nodeList, edges: dedupedEdges, maxEdgeCount: maxEc };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEdges, allTrendNames, trendQueryMap, queryFilter]);

  // ── Force simulation (offline, runs once on mount) ─────────────────────────

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (nodes.length === 0) return;

    // Clone nodes for simulation
    const sim = nodes.map(n => ({ ...n }));
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const edgeSet = new Map<string, Set<string>>();
    edges.forEach(e => {
      if (!edgeSet.has(e.from)) edgeSet.set(e.from, new Set());
      edgeSet.get(e.from)!.add(e.to);
    });

    for (let step = 0; step < SIM_STEPS; step++) {
      const temp = 1 - step / SIM_STEPS; // temperature decreases

      // Repulsion (all pairs)
      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const dx = sim[j].x - sim[i].x;
          const dy = sim[j].y - sim[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force * temp;
          const fy = (dy / dist) * force * temp;
          sim[i].vx -= fx;
          sim[i].vy -= fy;
          sim[j].vx += fx;
          sim[j].vy += fy;
        }
      }

      // Attraction (connected edges)
      const nodeIndex = new Map(sim.map((n, i) => [n.id, i]));
      for (const e of edges) {
        const fi = nodeIndex.get(e.from);
        const ti = nodeIndex.get(e.to);
        if (fi === undefined || ti === undefined) continue;
        const dx = sim[ti].x - sim[fi].x;
        const dy = sim[ti].y - sim[fi].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = ATTRACTION * dist * e.strength * temp;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        sim[fi].vx += fx;
        sim[fi].vy += fy;
        sim[ti].vx -= fx;
        sim[ti].vy -= fy;
      }

      // Gravity (pull toward center) — weaker so nodes spread further
      for (const n of sim) {
        n.vx += (cx - n.x) * GRAVITY * temp;
        n.vy += (cy - n.y) * GRAVITY * temp;
      }

      // Apply velocity + damping
      for (const n of sim) {
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // Constrain to graph area viewport
        n.x = Math.max(50, Math.min(dims.w - 50, n.x));
        n.y = Math.max(50, Math.min(dims.h - 50, n.y));
      }
    }

    setPositions(new Map(sim.map(n => [n.id, { x: n.x, y: n.y }])));
  }, [nodes, edges, dims.w, dims.h]);

  // ── Node radius ────────────────────────────────────────────────────────────

  const nodeR = useCallback((edgeCount: number) => {
    return NODE_MIN_R + (edgeCount / (maxEdgeCount || 1)) * (NODE_MAX_R - NODE_MIN_R);
  }, [maxEdgeCount]);

  // ── Hover/selection state ──────────────────────────────────────────────────

  const activeId = hoveredId ?? selectedId;
  const connectedIds = useMemo(() => {
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    edges.forEach(e => {
      if (e.from === activeId) set.add(e.to);
      if (e.to === activeId) set.add(e.from);
    });
    return set;
  }, [activeId, edges]);

  const activeEdges = useMemo(() => {
    if (!activeId) return null;
    return edges.filter(e => e.from === activeId || e.to === activeId);
  }, [activeId, edges]);

  // ── Overview aggregates (for sidebar) ──────────────────────────────────────

  const topTrends = useMemo(() => {
    return [...nodes].sort((a, b) => b.edgeCount - a.edgeCount).slice(0, 6);
  }, [nodes]);

  const topEdges = useMemo(() => {
    return [...edges].sort((a, b) => b.strength - a.strength).slice(0, 6);
  }, [edges]);

  const edgeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { drives: 0, amplifies: 0, dampens: 0, correlates: 0 };
    edges.forEach(e => {
      const key = e.type in counts ? e.type : "correlates";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [edges]);

  // ── Pan handlers ───────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-orbit-node]")) return;
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

  // ── Empty state ────────────────────────────────────────────────────────────

  if (nodes.length === 0) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>⬡</div>
          <div>{de ? "Noch keine Kausalnetze vorhanden" : "No causal networks yet"}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>{de ? "Starte eine Analyse im Canvas, um das Orbit zu füllen" : "Run an analysis in Canvas to populate the Orbit"}</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden", minWidth: 0 }}>
      {/* ── Graph area ─────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0, cursor: panStart.current ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg
          width={dims.w}
          height={dims.h}
          style={{ position: "absolute", inset: 0 }}
          viewBox={`${-pan.x} ${-pan.y} ${dims.w / zoom} ${dims.h / zoom}`}
        >
          <defs>
            {Object.entries(EDGE_COLOR).map(([type, color]) => (
              <marker key={type} id={`orbit-arrow-${type}`} viewBox="0 0 10 10" refX="10" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse" fill={color}>
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            ))}
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const from = positions.get(e.from);
            const to = positions.get(e.to);
            if (!from || !to) return null;
            const color = EDGE_COLOR[e.type] ?? "#9CA3AF";
            const isDim = activeId && !(e.from === activeId || e.to === activeId);
            const isHighlighted = activeId && (e.from === activeId || e.to === activeId);

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const fromNode = nodes.find(n => n.id === e.from);
            const toNode = nodes.find(n => n.id === e.to);
            const r1 = nodeR(fromNode?.edgeCount ?? 0);
            const r2 = nodeR(toNode?.edgeCount ?? 0);
            const x1 = from.x + (dx / dist) * r1;
            const y1 = from.y + (dy / dist) * r1;
            const x2 = to.x - (dx / dist) * (r2 + 6);
            const y2 = to.y - (dy / dist) * (r2 + 6);

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const perp = { x: -(y2 - y1) / dist, y: (x2 - x1) / dist };
            const curveAmount = 12 + (i % 3) * 8;
            const cpx = mx + perp.x * curveAmount * (i % 2 === 0 ? 1 : -1);
            const cpy = my + perp.y * curveAmount * (i % 2 === 0 ? 1 : -1);

            return (
              <path
                key={`${e.from}-${e.to}-${i}`}
                d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={isHighlighted ? 2.5 : 1.2}
                strokeOpacity={isDim ? 0.08 : isHighlighted ? 0.9 : 0.4}
                strokeDasharray={e.type === "correlates" || e.type === "dampens" ? "4,3" : "none"}
                markerEnd={`url(#orbit-arrow-${e.type in EDGE_COLOR ? e.type : "correlates"})`}
                style={{ transition: "stroke-opacity 0.2s, stroke-width 0.2s" }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const pos = positions.get(n.id);
            if (!pos) return null;
            const r = nodeR(n.edgeCount);
            const isDim = activeId && !connectedIds?.has(n.id);
            const isActive = n.id === activeId;
            const isConnected = connectedIds?.has(n.id) && !isActive;
            const isSelected = n.id === selectedId;

            // Label always visible — position outward from graph center
            const gcx = dims.w / 2;
            const gcy = dims.h / 2;
            const ldx = pos.x - gcx;
            const ldy = pos.y - gcy;
            const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
            const labelOffset = r + 7;
            const labelX = pos.x + (ldx / ldist) * labelOffset;
            const labelY = pos.y + (ldy / ldist) * labelOffset;
            const anchor = ldx > 0 ? "start" : "end";
            const displayLabel = n.label.length > 22 ? n.label.slice(0, 22) + "…" : n.label;

            return (
              <g
                key={n.id}
                data-orbit-node
                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                opacity={isDim ? 0.18 : 1}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedId(prev => prev === n.id ? null : n.id)}
              >
                {(isActive || isConnected || isSelected) && (
                  <circle cx={pos.x} cy={pos.y} r={r + 5}
                    fill="none" stroke={isSelected ? "#6B7A00" : isActive ? "#E4FF97" : "#3B82F620"}
                    strokeWidth={isSelected ? 3 : isActive ? 3 : 1.5}
                  />
                )}
                <circle cx={pos.x} cy={pos.y} r={r}
                  fill={isSelected ? "#FFF7B8" : isActive ? "#E4FF97" : isConnected ? "#E4FF9740" : "var(--color-surface, #fff)"}
                  stroke={isSelected ? "#6B7A00" : isActive ? "#6B7A00" : "var(--color-border, #ddd)"}
                  strokeWidth={isSelected || isActive ? 2 : 1}
                />
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={r > 16 ? 10 : 8} fontWeight={700}
                  fill={isActive || isSelected ? "#0A0A0A" : "var(--color-text-secondary, #555)"}
                  style={{ pointerEvents: "none" }}
                >{n.edgeCount}</text>

                {/* Label with subtle background pill for legibility */}
                <g style={{ pointerEvents: "none" }}>
                  <text x={labelX} y={labelY} textAnchor={anchor} dominantBaseline="middle"
                    fontSize={isActive || isSelected ? 12 : 10}
                    fontWeight={isActive || isSelected ? 700 : 500}
                    fill={isActive || isSelected ? "var(--color-text-heading, #111)" : "var(--color-text-secondary, #555)"}
                    paintOrder="stroke"
                    stroke="rgba(255,255,255,0.88)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    style={{ transition: "font-size 0.15s" }}
                  >{displayLabel}</text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* ── Legend (top-left) ───────────────────────────────────────────── */}
        <div style={{ position: "absolute", top: 52, left: 16, display: "flex", gap: 10, alignItems: "center", fontSize: 10, color: "var(--color-text-muted)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px", border: "1px solid var(--color-border)", flexWrap: "wrap", maxWidth: "calc(100% - 32px)" }}>
          <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>ORBIT</span>
          <span style={{ color: "var(--color-border)" }}>|</span>
          {Object.entries(EDGE_COLOR).map(([type, color]) => (
            <span key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 14, height: 2, background: color, borderRadius: 1, display: "inline-block", borderStyle: type === "correlates" || type === "dampens" ? "dashed" : "solid" }} />
              <span>{EDGE_LABEL[type]} <span style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>({edgeTypeCounts[type] ?? 0})</span></span>
            </span>
          ))}
        </div>

        {/* ── Filter indicator (top-center) when query filter is active ──── */}
        {queryFilter && (
          <div style={{
            position: "absolute", top: 52, left: "50%", transform: "translateX(-50%)",
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11,
            background: "#EEF4FF", color: "#1E40AF",
            border: "1px solid #2563EB55",
            borderRadius: 20, padding: "4px 6px 4px 12px",
          }}>
            <Filter size={11} strokeWidth={1.8} />
            <span style={{
              maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
              title={queryLabels?.[queryFilter] ?? queryFilter}
            >
              {de ? "Gefiltert: " : "Filtered: "}
              {(queryLabels?.[queryFilter] ?? queryFilter).slice(0, 40)}
              {((queryLabels?.[queryFilter] ?? queryFilter).length > 40) ? "…" : ""}
            </span>
            <button onClick={() => setQueryFilter(null)}
              title={de ? "Filter aufheben" : "Clear filter"}
              style={{
                background: "rgba(37,99,235,0.12)", border: "none", borderRadius: "50%",
                width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#1E40AF", padding: 0,
              }}
            >
              <X size={10} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* ── Zoom indicator (bottom-right) ─────────────────────────────── */}
        <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 10, color: "var(--color-text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title={de ? "Zoom & Ansicht zurücksetzen" : "Reset zoom & view"}
            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.9)", color: "var(--color-text-muted)", cursor: "pointer" }}
          >⊙</button>
        </div>

        {/* ── Collapse sidebar button (top-right of graph area when sidebar open) ─── */}
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            title={de ? "Seitenleiste einklappen" : "Collapse sidebar"}
            style={{
              position: "absolute", top: 12, right: 12,
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, padding: "4px 7px", borderRadius: 6,
              border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.88)",
              backdropFilter: "blur(8px)", color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={12} strokeWidth={1.8} />
          </button>
        )}

        {/* ── Expand sidebar button (top-right of graph area when sidebar collapsed) ─── */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title={de ? "Seitenleiste öffnen" : "Show sidebar"}
            style={{
              position: "absolute", top: 12, right: 12,
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, padding: "5px 9px", borderRadius: 6,
              border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(8px)", color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={12} strokeWidth={1.8} />
            {de ? "Übersicht" : "Overview"}
          </button>
        )}
      </div>

      {/* ── Right sidebar ──────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside
          style={{
            width: SIDEBAR_W,
            flex: `0 0 ${SIDEBAR_W}px`,
            borderLeft: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.96)",
            display: "flex", flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Sidebar header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderBottom: "1px solid var(--color-border)",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--color-text-muted)",
          }}>
            {selectedNode ? (
              <>
                <button
                  onClick={() => setSelectedId(null)}
                  title={de ? "Zurück zur Übersicht" : "Back to overview"}
                  style={{
                    background: "none", border: "none", padding: 0,
                    color: "var(--color-text-muted)", cursor: "pointer",
                    display: "inline-flex", alignItems: "center",
                  }}
                >
                  <ChevronLeft size={14} strokeWidth={1.8} />
                </button>
                <span>{de ? "Detail" : "Detail"}</span>
              </>
            ) : (
              <span>{de ? "Übersicht" : "Overview"}</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontWeight: 500, fontSize: 10, textTransform: "none", letterSpacing: 0 }}>
              {nodes.length} · {edges.length}
            </span>
          </div>

          {/* Sidebar body (scrollable) */}
          <div style={{ flex: 1, overflow: "auto", padding: "14px 14px 20px" }}>
            {selectedNode ? (
              <DetailPanel
                de={de}
                node={selectedNode}
                edges={activeEdges ?? []}
                allTrendNames={allTrendNames}
                queryLabels={queryLabels}
                onSelectQuery={onSelectQuery}
                onSelectNode={id => setSelectedId(id)}
              />
            ) : (
              <OverviewPanel
                de={de}
                topTrends={topTrends}
                topEdges={topEdges}
                allTrendNames={allTrendNames}
                edgeTypeCounts={edgeTypeCounts}
                queryList={queryList}
                queryFilter={queryFilter}
                setQueryFilter={setQueryFilter}
                onSelectNode={id => setSelectedId(id)}
              />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

// ─── Sidebar: Overview ───────────────────────────────────────────────────────

function OverviewPanel({
  de, topTrends, topEdges, allTrendNames, edgeTypeCounts, queryList, queryFilter, setQueryFilter, onSelectNode,
}: {
  de: boolean;
  topTrends: OrbitNode[];
  topEdges: MatchedEdge[];
  allTrendNames: Record<string, string>;
  edgeTypeCounts: Record<string, number>;
  queryList: { id: string; count: number; label: string }[];
  queryFilter: string | null;
  setQueryFilter: (id: string | null) => void;
  onSelectNode: (id: string) => void;
}) {
  return (
    <>
      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
        {(Object.keys(EDGE_COLOR) as (keyof typeof EDGE_COLOR)[]).map(type => (
          <div key={type} style={{
            padding: "8px 6px", borderRadius: 6,
            background: `${EDGE_COLOR[type]}0E`,
            border: `1px solid ${EDGE_COLOR[type]}22`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: EDGE_COLOR[type], lineHeight: 1 }}>
              {edgeTypeCounts[type] ?? 0}
            </div>
            <div style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 3, letterSpacing: "0.05em" }}>
              {EDGE_LABEL[type]}
            </div>
          </div>
        ))}
      </div>

      {/* Top trends */}
      <SectionLabel>{de ? "Zentrale Trends" : "Central trends"}</SectionLabel>
      <div style={{ marginBottom: 18 }}>
        {topTrends.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {de ? "Keine Trends im aktuellen Filter." : "No trends in current filter."}
          </div>
        )}
        {topTrends.map((t, i) => (
          <button key={t.id}
            onClick={() => onSelectNode(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              fontSize: 11.5, padding: "6px 8px",
              borderRadius: 6, border: "1px solid transparent", background: "transparent",
              color: "var(--color-text-heading)", cursor: "pointer", marginBottom: 2,
              transition: "background 0.12s",
              textAlign: "left",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface, #F7F7F2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: "50%",
              background: i < 3 ? "#E4FF97" : "var(--color-surface)",
              color: "var(--color-text-secondary)",
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>{i + 1}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
              {t.edgeCount}
            </span>
          </button>
        ))}
      </div>

      {/* Top edges */}
      <SectionLabel>{de ? "Stärkste Beziehungen" : "Strongest relations"}</SectionLabel>
      <div style={{ marginBottom: 18 }}>
        {topEdges.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {de ? "Keine Kanten im aktuellen Filter." : "No edges in current filter."}
          </div>
        )}
        {topEdges.map((e, i) => {
          const color = EDGE_COLOR[e.type] ?? "#9CA3AF";
          const fromName = allTrendNames[e.from] ?? e.from;
          const toName = allTrendNames[e.to] ?? e.to;
          return (
            <div key={`${e.from}-${e.to}-${i}`}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", marginBottom: 3,
                borderRadius: 6, background: `${color}08`, border: `1px solid ${color}1A`,
                fontSize: 11, lineHeight: 1.3,
              }}
            >
              <button onClick={() => onSelectNode(e.from)}
                title={fromName}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-text-heading)", maxWidth: "38%",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "left",
                }}
              >{fromName}</button>
              <span style={{ color, fontSize: 10, fontWeight: 600 }}>
                {EDGE_LABEL[e.type] ?? e.type}
              </span>
              <button onClick={() => onSelectNode(e.to)}
                title={toName}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-text-heading)", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "left",
                }}
              >{toName}</button>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
                {Math.round(e.strength * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Query filter */}
      {queryList.length > 1 && (
        <>
          <SectionLabel>{de ? "Nach Analyse filtern" : "Filter by query"}</SectionLabel>
          <div>
            <button
              onClick={() => setQueryFilter(null)}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%",
                fontSize: 11, padding: "5px 8px", borderRadius: 6,
                border: `1px solid ${queryFilter === null ? "#6B7A0088" : "transparent"}`,
                background: queryFilter === null ? "#FAFFE5" : "transparent",
                color: queryFilter === null ? "#445300" : "var(--color-text-secondary)",
                cursor: "pointer", marginBottom: 2,
                textAlign: "left",
                fontWeight: queryFilter === null ? 600 : 500,
              }}
            >
              <span style={{ flex: 1 }}>{de ? "Alle Analysen" : "All queries"}</span>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
                {queryList.length}
              </span>
            </button>
            {queryList.map(q => {
              const active = queryFilter === q.id;
              return (
                <button key={q.id}
                  onClick={() => setQueryFilter(q.id)}
                  title={q.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, width: "100%",
                    fontSize: 11, padding: "5px 8px", borderRadius: 6,
                    border: `1px solid ${active ? "#6B7A0088" : "transparent"}`,
                    background: active ? "#FAFFE5" : "transparent",
                    color: active ? "#445300" : "var(--color-text-secondary)",
                    cursor: "pointer", marginBottom: 2,
                    textAlign: "left", lineHeight: 1.3,
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--color-surface, #F7F7F2)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.label.length > 32 ? q.label.slice(0, 32) + "…" : q.label}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
                    {q.count}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ─── Sidebar: Detail ─────────────────────────────────────────────────────────

function DetailPanel({
  de, node, edges, allTrendNames, queryLabels, onSelectQuery, onSelectNode,
}: {
  de: boolean;
  node: OrbitNode;
  edges: MatchedEdge[];
  allTrendNames: Record<string, string>;
  queryLabels?: Record<string, string>;
  onSelectQuery?: (id: string) => void;
  onSelectNode: (id: string) => void;
}) {
  // Trends stage color (matches STAGE_META.trends.color in OrbitDerivationView)
  const typeColor = "#1A9E5A";

  return (
    <div style={{
      // Card shell — mirrors the Canvas DerivedNodeCard visual language
      background: "var(--color-surface)",
      border: "1.5px solid var(--color-border, #E8E8E8)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: `inset 3px 0 0 ${typeColor}, 0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Header — Trend badge pill + counts */}
      <div style={{
        minHeight: 36, padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 6,
        background: `${typeColor}0C`,
        borderBottom: `1px solid ${typeColor}22`,
      }}>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
          color: typeColor, background: `${typeColor}14`, border: `1px solid ${typeColor}30`,
          borderRadius: 6, padding: "4px 10px",
        }}>
          {de ? "Trend" : "Trend"}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {node.edgeCount} · {node.queryIds.length}
        </span>
      </div>

      {/* Title + meta */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)",
          lineHeight: 1.3, wordBreak: "break-word",
        }}>
          {node.label}
        </div>
        <div style={{
          fontSize: 10, color: "var(--color-text-muted)", marginTop: 6,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <span>
            <strong style={{ color: typeColor, fontWeight: 700 }}>{node.edgeCount}</strong>{" "}
            {de ? "Verbindungen" : "connections"}
          </span>
          <span style={{ color: "var(--color-border)" }}>·</span>
          <span>
            <strong style={{ color: "var(--color-text-secondary)", fontWeight: 700 }}>{node.queryIds.length}</strong>{" "}
            {de ? "Analysen" : "queries"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 12px" }}>
        {/* Connected edges */}
        {edges.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>{de ? "Kausale Verbindungen" : "Causal connections"}</SectionLabel>
            {edges.map((e, i) => {
              const isFrom = e.from === node.id;
              const otherId = isFrom ? e.to : e.from;
              const otherName = allTrendNames[otherId] ?? otherId;
              const color = EDGE_COLOR[e.type] ?? "#9CA3AF";
              return (
                <button key={i}
                  onClick={() => onSelectNode(otherId)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, width: "100%",
                    marginBottom: 4, padding: "4px 6px", borderRadius: 6,
                    background: `${color}08`, border: `1px solid ${color}22`,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}15`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}08`; }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}20`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                    {isFrom ? "→" : "←"} {EDGE_LABEL[e.type] ?? e.type}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-heading)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {otherName}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)", flexShrink: 0 }}>
                    {Math.round(e.strength * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Query references */}
        {node.queryIds.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <SectionLabel>{de ? "Referenziert in" : "Referenced in"}</SectionLabel>
            {node.queryIds.map(qId => {
              const label = queryLabels?.[qId];
              const display = label && label.length > 60 ? label.slice(0, 60) + "…" : label ?? `Query ${qId.slice(0, 8)}…`;
              return (
                <button key={qId}
                  onClick={() => onSelectQuery?.(qId)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    width: "100%", fontSize: 11, padding: "6px 8px",
                    borderRadius: 6, border: "1px solid var(--color-border)",
                    background: "transparent", color: "var(--color-text-secondary)",
                    cursor: "pointer", marginBottom: 3,
                    transition: "background 0.12s", lineHeight: 1.4,
                    textAlign: "left",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  title={label}
                >
                  <span style={{ color: typeColor, fontWeight: 600, flexShrink: 0 }}>›</span>
                  <span style={{ flex: 1 }}>{display}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div style={{
        padding: "10px 12px", borderTop: "1px solid var(--color-border)",
        background: "rgba(0,0,0,0.02)",
      }}>
        <Tooltip content={de ? "Neue Analyse mit diesem Trend als Fokus starten" : "Start new analysis focused on this trend"} placement="left">
          <button
            onClick={() => onSelectQuery?.(`__orbit_deepen__${node.label}`)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
              width: "100%", fontSize: 11, fontWeight: 600, padding: "7px 12px",
              borderRadius: 6, border: `1px solid ${typeColor}66`,
              background: `${typeColor}12`, color: typeColor, cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${typeColor}22`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${typeColor}12`; }}
          >
            <ArrowDownToLine size={12} strokeWidth={2} />
            {de ? "Trend vertiefen" : "Deepen trend"}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
      color: "var(--color-text-muted)", marginBottom: 6,
      textTransform: "uppercase",
    }}>{children}</div>
  );
}
