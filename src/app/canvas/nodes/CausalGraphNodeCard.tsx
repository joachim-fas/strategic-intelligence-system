/**
 * CausalGraphNodeCard — derived card that plots a mini ring of
 * trend nodes with colored causal edges. Local hover-state
 * highlights the edges connected to the pointed-at trend.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice
 * 4b (18.04.2026 audit A5-H7).
 */

"use client";

import React, { useState } from "react";
import { CAUSAL_GRAPH_CARD_H } from "../constants";
import type { CardBaseProps, DerivedNode } from "../types";

type CausalGraphNodeCardProps = Omit<CardBaseProps, "zoom"> & {
  node: DerivedNode;
};

export function CausalGraphNodeCard({
  node,
  selected,
  onSelect,
  onDragStart,
  onDelete: _onDelete,
  onResizeStart,
  onIterate: _onIterate,
  onPortDragStart,
  nodeW,
  dimmed,
}: CausalGraphNodeCardProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const cardH = node.customHeight ?? CAUSAL_GRAPH_CARD_H;
  const edges = node.causalEdges ?? [];
  const nameMap = node.causalTrendNames ?? {};
  const accentColor = "#1A9E5A";

  // Build unique trend node list (max 8)
  const trendIds = Array.from(new Set(edges.flatMap(e => [e.from, e.to]))).slice(0, 8);

  const GRAPH_W = nodeW - 24;
  const GRAPH_H = cardH - 72;
  const cx = GRAPH_W / 2;
  const cy = GRAPH_H / 2;
  const radius = Math.min(cx, cy) - 22;

  const trendPositions = trendIds.map((id, i) => {
    const angle = (i / trendIds.length) * 2 * Math.PI - Math.PI / 2;
    return { id, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
  const posMap = new Map(trendPositions.map(p => [p.id, p]));

  const edgeTypeColor: Record<string, string> = {
    drives: "#1A9E5A", amplifies: "#2563EB", dampens: "#E8402A", correlates: "#9CA3AF",
  };
  const visibleEdges = edges.filter(e => trendIds.includes(e.from) && trendIds.includes(e.to));

  const connectedTo = hoveredNodeId ? new Set(
    visibleEdges
      .filter(e => e.from === hoveredNodeId || e.to === hoveredNodeId)
      .flatMap(e => [e.from, e.to])
  ) : null;

  const truncate = (s: string, n = 10) => s.length > n ? s.slice(0, n) + "…" : s;
  const getName = (id: string) => nameMap[id] || id.replace(/mega-|macro-|micro-/, "").replace(/-/g, " ");

  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: cardH, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      {/* Left input port */}
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      {/* Right output port */}
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Kausaltreiber vertiefen"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${accentColor}`, boxShadow: `0 0 8px ${accentColor}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${accentColor}99, 0 0 0 3px ${accentColor}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${accentColor}66`; }}
      />
      {/* Card body */}
      <div style={{
        position: "relative", width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: "var(--color-surface)",
        border: `1.5px solid ${selected ? "#0A0A0A" : "var(--color-border, #E8E8E8)"}`,
        borderRadius: 12, overflow: "hidden",
        boxShadow: selected ? `inset 3px 0 0 ${accentColor}, 0 0 0 3px rgba(228,255,151,0.65), 0 4px 20px rgba(0,0,0,0.1)` : `inset 3px 0 0 ${accentColor}, 0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)`,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}>
        {/* Header */}
        <div
          onPointerDown={e => { e.stopPropagation(); onDragStart(e, node.id); }}
          style={{ height: 38, padding: "0 12px", cursor: "grab", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: `${accentColor}08`, borderBottom: "1px solid var(--color-border, rgba(0,0,0,0.08))" }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}40`, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>KAUSALNETZ</span>
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1 }}>{trendIds.length} Trends · {visibleEdges.length} Kanten</span>
        </div>
        {/* SVG graph */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <svg width={GRAPH_W} height={GRAPH_H} style={{ display: "block", margin: "0 auto" }}>
            {/* Edges */}
            {visibleEdges.map((e, i) => {
              const from = posMap.get(e.from);
              const to = posMap.get(e.to);
              if (!from || !to) return null;
              const isHighlighted = connectedTo ? (connectedTo.has(e.from) && connectedTo.has(e.to)) : true;
              const color = edgeTypeColor[e.type] ?? "#9CA3AF";
              return (
                <line key={i}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={color}
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                  strokeOpacity={isHighlighted ? 0.7 : 0.15}
                  strokeDasharray={e.type === "correlates" ? "3 3" : undefined}
                />
              );
            })}
            {/* Trend nodes */}
            {trendPositions.map(({ id, x, y }) => {
              const isHovered = hoveredNodeId === id;
              const isConnected = connectedTo ? connectedTo.has(id) : false;
              const dimmed2 = connectedTo ? !isConnected : false;
              return (
                <g key={id}
                  onMouseEnter={() => setHoveredNodeId(id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={x} cy={y} r={isHovered ? 7 : 5}
                    fill={isHovered ? accentColor : "var(--color-surface)"}
                    stroke={accentColor}
                    strokeWidth={isHovered ? 2 : 1.5}
                    opacity={dimmed2 ? 0.2 : 1}
                  />
                  <text x={x} y={y + 14} textAnchor="middle" fontSize={7}
                    fill={dimmed2 ? "rgba(0,0,0,0.2)" : "var(--color-text-muted)"}
                    fontFamily="inherit"
                  >{truncate(getName(id))}</text>
                </g>
              );
            })}
          </svg>
          {/* Edge type legend */}
          <div style={{ position: "absolute", bottom: 4, left: 10, display: "flex", gap: 8 }}>
            {Object.entries(edgeTypeColor).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 7, color: "var(--color-text-muted)" }}>{type}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, cardH, "both"); }}
          style={{ position: "absolute", right: 3, bottom: 3, width: 14, height: 14, cursor: "nwse-resize", zIndex: 11, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 2 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
            <path d="M2 9 L9 2 M5 9 L9 5 M8 9 L9 8" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
