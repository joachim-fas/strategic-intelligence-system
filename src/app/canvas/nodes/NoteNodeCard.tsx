/**
 * NoteNodeCard — free-form yellow note card. Editing lives in the
 * DetailPanel; this renderer is a read-only presentation of the
 * current content plus the right-side port-drag handle.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice
 * 4a (18.04.2026 audit A5-H7).
 */

"use client";

import React from "react";
import type { CardBaseProps, NoteNode } from "../types";

interface NoteNodeCardProps extends CardBaseProps {
  node: NoteNode;
  onUpdate: (id: string, content: string) => void;
  onPromote: (query: string) => void;
}

export function NoteNodeCard({
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
  zoom: cardZoom,
  onUpdate: _onUpdate,
  onPromote: _onPromote,
}: NoteNodeCardProps) {
  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 24, overflow: "hidden", background: "var(--pastel-butter)",
          border: `1px solid ${selected ? "#0A0A0A" : "var(--color-border, rgba(0,0,0,0.08))"}`,
          borderRadius: 6,
          userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, padding: "0 7px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: "#F9A825", flexShrink: 0 }}>✎</span>
        <span style={{ fontSize: 9, color: "#3E2723", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.content.slice(0, 60) || "Notiz"}</span>
      </div>
    );
  }
  const noteColor = "#F9A825";
  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: node.customHeight ?? 280, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Als Analysekontext verwenden"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${noteColor}`, boxShadow: `0 0 8px ${noteColor}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${noteColor}99, 0 0 0 3px ${noteColor}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${noteColor}66`; }}
      />
      <div style={{
        position: "relative", width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: "var(--color-surface)",
        border: `1.5px solid ${selected ? "#0A0A0A" : "var(--color-border, #E8E8E8)"}`,
        borderRadius: 12, overflow: "hidden",
        boxShadow: selected ? "0 0 0 3px rgba(228,255,151,0.65), 0 4px 20px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}>
        <div onPointerDown={e => { e.stopPropagation(); onDragStart(e, node.id); }}
          style={{ height: 44, padding: "0 14px", cursor: "grab", flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.12)", borderTopLeftRadius: 11, borderTopRightRadius: 11 }}
        >
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: noteColor, background: `${noteColor}18`, border: `1px solid ${noteColor}40`, borderRadius: 5, padding: "2px 7px", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>NOTIZ</span>
        </div>
        <div style={{ padding: "10px 14px 12px", flex: 1, overflow: "hidden" }}>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: node.content ? "var(--color-text-secondary)" : "rgba(0,0,0,0.3)", margin: 0, overflow: "hidden", wordBreak: "break-word" }}>
            {node.content || "Notiz hinzufügen…"}
          </p>
        </div>
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? 280, "both"); }}
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
