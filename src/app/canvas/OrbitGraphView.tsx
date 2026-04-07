"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

// ─── Types (duplicated from page.tsx to keep file standalone) ─────────────────

interface MatchedEdge {
  from: string;
  to: string;
  type: "drives" | "amplifies" | "dampens" | "correlates" | string;
  strength: number;
  description?: string;
}

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

const NODE_MIN_R = 10;
const NODE_MAX_R = 28;
const REPULSION = 3500;
const ATTRACTION = 0.006;
const GRAVITY = 0.012;
const DAMPING = 0.88;
const SIM_STEPS = 200; // run offline simulation steps on mount

// ─── OrbitGraphView ──────────────────────────────────────────────────────────

interface OrbitGraphViewProps {
  /** All canvas nodes (we extract causal data from causalgraph nodes) */
  allEdges: MatchedEdge[];
  allTrendNames: Record<string, string>;
  /** Map: trendId → array of parent query node IDs */
  trendQueryMap: Record<string, string[]>;
  de: boolean;
  onSelectQuery?: (queryId: string) => void;
}

export function OrbitGraphView({
  allEdges,
  allTrendNames,
  trendQueryMap,
  de,
  onSelectQuery,
}: OrbitGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // ── Deduplicate edges and build node list ──────────────────────────────────

  const { nodes, edges, maxEdgeCount } = useMemo(() => {
    // Deduplicate edges by from→to key (keep strongest)
    const edgeMap = new Map<string, MatchedEdge>();
    for (const e of allEdges) {
      const key = `${e.from}→${e.to}`;
      const existing = edgeMap.get(key);
      if (!existing || e.strength > existing.strength) edgeMap.set(key, e);
    }
    const dedupedEdges = Array.from(edgeMap.values());

    // Collect trend IDs
    const trendIds = new Set<string>();
    dedupedEdges.forEach(e => { trendIds.add(e.from); trendIds.add(e.to); });

    // Edge count per node
    const edgeCounts = new Map<string, number>();
    dedupedEdges.forEach(e => {
      edgeCounts.set(e.from, (edgeCounts.get(e.from) ?? 0) + 1);
      edgeCounts.set(e.to, (edgeCounts.get(e.to) ?? 0) + 1);
    });
    const maxEc = Math.max(...Array.from(edgeCounts.values()), 1);

    // Initial positions: circle layout
    const arr = Array.from(trendIds);
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const initR = Math.min(cx, cy) * 0.6;
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
  }, [allEdges, allTrendNames, trendQueryMap]);

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
          let dx = sim[j].x - sim[i].x;
          let dy = sim[j].y - sim[i].y;
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

      // Gravity (pull toward center)
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
        // Constrain to viewport
        n.x = Math.max(40, Math.min(dims.w - 40, n.x));
        n.y = Math.max(40, Math.min(dims.h - 40, n.y));
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
  const selectedPos = selectedId ? positions.get(selectedId) : null;

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, position: "relative", overflow: "hidden", cursor: panStart.current ? "grabbing" : "grab" }}
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
        {/* Defs: arrow markers */}
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

          // Offset to node border
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

          // Slight curve
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
              strokeOpacity={isDim ? 0.08 : isHighlighted ? 0.9 : 0.35}
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

          return (
            <g
              key={n.id}
              data-orbit-node
              style={{ cursor: "pointer", transition: "opacity 0.2s" }}
              opacity={isDim ? 0.15 : 1}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelectedId(prev => prev === n.id ? null : n.id)}
            >
              {/* Glow ring on hover */}
              {(isActive || isConnected) && (
                <circle cx={pos.x} cy={pos.y} r={r + 5}
                  fill="none" stroke={isActive ? "#E4FF97" : "#3B82F620"}
                  strokeWidth={isActive ? 3 : 1.5}
                  style={{ transition: "r 0.2s" }}
                />
              )}
              {/* Node circle */}
              <circle cx={pos.x} cy={pos.y} r={r}
                fill={isActive ? "#E4FF97" : isConnected ? "#E4FF9740" : "var(--color-surface, #fff)"}
                stroke={isActive ? "#6B7A00" : "var(--color-border, #ddd)"}
                strokeWidth={isActive ? 2 : 1}
              />
              {/* Edge count */}
              <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={r > 16 ? 10 : 8} fontWeight={700}
                fill={isActive ? "#0A0A0A" : "var(--color-text-secondary, #555)"}
              >{n.edgeCount}</text>
              {/* Label outside */}
              {(r >= 14 || isActive || isConnected) && (() => {
                // Push label outward from center
                const cx = dims.w / 2 - pan.x;
                const cy = dims.h / 2 - pan.y;
                const dx = pos.x - cx;
                const dy = pos.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const labelX = pos.x + (dx / dist) * (r + 8);
                const labelY = pos.y + (dy / dist) * (r + 8);
                const anchor = dx > 0 ? "start" : "end";
                const displayLabel = n.label.length > 20 ? n.label.slice(0, 20) + "…" : n.label;
                return (
                  <text x={labelX} y={labelY} textAnchor={anchor} dominantBaseline="middle"
                    fontSize={isActive ? 12 : 10} fontWeight={isActive ? 700 : 500}
                    fill={isActive ? "var(--color-text-heading, #111)" : "var(--color-text-secondary, #666)"}
                    style={{ pointerEvents: "none", transition: "font-size 0.15s" }}
                  >{displayLabel}</text>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {/* ── Legend (top-left) ──────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 12, left: 16, display: "flex", gap: 12, alignItems: "center", fontSize: 10, color: "var(--color-text-muted)", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px", border: "1px solid var(--color-border)" }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>ORBIT</span>
        <span style={{ color: "var(--color-border)" }}>|</span>
        {Object.entries(EDGE_COLOR).map(([type, color]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 14, height: 2, background: color, borderRadius: 1, display: "inline-block", borderStyle: type === "correlates" || type === "dampens" ? "dashed" : "solid" }} />
            <span>{EDGE_LABEL[type]}</span>
          </span>
        ))}
        <span style={{ color: "var(--color-border)" }}>|</span>
        <span>{nodes.length} Trends · {edges.length} {de ? "Verbindungen" : "edges"}</span>
      </div>

      {/* ── Zoom indicator (bottom-right) ──────────────────────────────────── */}
      <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 10, color: "var(--color-text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}
        >⊙</button>
      </div>

      {/* ── Detail sidebar (right) when node is selected ──────────────────── */}
      {selectedNode && selectedPos && (
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 12,
            width: 280,
            maxHeight: "calc(100% - 96px)",
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(16px)",
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            padding: 16,
            overflowY: "auto",
            fontSize: 12,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)", lineHeight: 1.3 }}>{selectedNode.label}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 3 }}>{selectedNode.edgeCount} {de ? "Verbindungen" : "connections"} · {selectedNode.queryIds.length} {de ? "Analysen" : "queries"}</div>
            </div>
            <button onClick={() => setSelectedId(null)}
              style={{ background: "none", border: "none", fontSize: 16, color: "var(--color-text-muted)", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
            >✕</button>
          </div>

          {/* Connected edges */}
          {activeEdges && activeEdges.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase" }}>{de ? "Kausale Verbindungen" : "Causal connections"}</div>
              {activeEdges.map((e, i) => {
                const isFrom = e.from === selectedId;
                const otherId = isFrom ? e.to : e.from;
                const otherName = allTrendNames[otherId] ?? otherId;
                const color = EDGE_COLOR[e.type] ?? "#9CA3AF";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, padding: "4px 6px", borderRadius: 6, background: `${color}08`, border: `1px solid ${color}20` }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, borderRadius: 4, padding: "1px 5px" }}>
                      {isFrom ? "→" : "←"} {EDGE_LABEL[e.type] ?? e.type}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{otherName}</span>
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{Math.round(e.strength * 100)}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Query references */}
          {selectedNode.queryIds.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase" }}>{de ? "Referenziert in" : "Referenced in"}</div>
              {selectedNode.queryIds.map(qId => (
                <button key={qId}
                  onClick={() => onSelectQuery?.(qId)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", fontSize: 11, padding: "5px 8px",
                    borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent",
                    color: "var(--color-text-secondary)", cursor: "pointer", marginBottom: 4,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  🔍 Query {qId.slice(0, 8)}…
                </button>
              ))}
            </div>
          )}

          {/* Deepen action */}
          <div style={{ marginTop: 14, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
            <Tooltip content={de ? "Neue Analyse mit diesem Trend als Fokus starten" : "Start new analysis focused on this trend"} placement="left">
              <button
                onClick={() => {
                  // Navigate back to canvas and trigger query
                  onSelectQuery?.(`__orbit_deepen__${selectedNode.label}`);
                }}
                style={{
                  width: "100%", fontSize: 11, fontWeight: 600, padding: "7px 12px",
                  borderRadius: 8, border: "1px solid #1A9E5A44",
                  background: "#1A9E5A12", color: "#1A9E5A", cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1A9E5A22"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#1A9E5A12"; }}
              >↓ {de ? "Trend vertiefen" : "Deepen trend"}</button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
