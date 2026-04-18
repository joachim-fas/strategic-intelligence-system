/**
 * DimensionsNodeCard — derived card that plots a mini DimensionRadar
 * alongside the four STEEP-V dimension dots. Read-only; clicking
 * opens the full dimension analysis in the DetailPanel.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice
 * 4b (18.04.2026 audit A5-H7).
 */

"use client";

import React from "react";
import { DIMENSIONS_CARD_H } from "../constants";
import { DimensionRadar } from "../DetailPanel";
import type { CardBaseProps, DerivedNode } from "../types";

type DimensionsNodeCardProps = Omit<CardBaseProps, "zoom"> & {
  node: DerivedNode;
};

export function DimensionsNodeCard({
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
}: DimensionsNodeCardProps) {
  const cardH = node.customHeight ?? DIMENSIONS_CARD_H;
  const dimData = node.dimensionData ?? [];
  const accentColor = "#3b82f6";

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
        title="→ Dimensionen vertiefen"
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
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}40`, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>DIMENSIONEN</span>
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dimData.filter(d => d.trends.length > 0).length} aktiv</span>
        </div>
        {/* Mini radar + dimension dots */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "4px 8px", gap: 8 }}>
          <div style={{ flexShrink: 0 }}>
            <DimensionRadar dimData={dimData} size={cardH - 52} mini />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            {dimData.map(dim => {
              const inactive = dim.trends.length === 0;
              const arrow = dim.direction === "up" ? "↑" : dim.direction === "down" ? "↓" : "→";
              return (
                <div key={dim.key} style={{ display: "flex", alignItems: "center", gap: 4, opacity: inactive ? 0.35 : 1 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: dim.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 8.5, color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dim.label.split(" & ")[0]}</span>
                  <span style={{ fontSize: 9, color: dim.color, fontWeight: 700 }}>{arrow} {Math.round(dim.avgConfidence * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, cardH, "both"); }}
          style={{ position: "absolute", right: 3, bottom: 3, width: 14, height: 14, cursor: "nwse-resize", zIndex: 11, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 2 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
            <path d="M2 9 L9 2 M5 9 L9 5 M8 9 L9 8" stroke="rgba(0,0,0,0.30)" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
