/**
 * FileNodeCard — blue uploaded-file card with filename + size and an
 * emoji icon for the MIME type. Actual analysis lives in the
 * DetailPanel; this renderer is read-only preview.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice
 * 4a (18.04.2026 audit A5-H7). The `fileIcon()` helper was
 * only used here so it moved with the card.
 */

"use client";

import React from "react";
import { FILE_NODE_W } from "../constants";
import { formatFileSize } from "../utils";
import type { CardBaseProps, FileNode } from "../types";

interface FileNodeCardProps extends CardBaseProps {
  node: FileNode;
  onAnalyze: (query: string, parentId: string) => void;
}

function fileIcon(fileType: string, fileName: string): string {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType === "application/pdf") return "📄";
  if (fileType.includes("spreadsheet") || fileName.endsWith(".csv") || fileName.endsWith(".xlsx")) return "📊";
  if (fileType.includes("word") || fileName.endsWith(".docx")) return "📝";
  if (fileType.includes("presentation") || fileName.endsWith(".pptx")) return "📑";
  if (fileType.startsWith("video/")) return "🎬";
  if (fileType.startsWith("audio/")) return "🎵";
  if (fileType.includes("zip") || fileType.includes("archive")) return "🗜️";
  if (fileType.startsWith("text/") || fileName.endsWith(".md") || fileName.endsWith(".txt")) return "📃";
  if (fileType.includes("json") || fileName.endsWith(".json")) return "⚙️";
  return "📎";
}

export function FileNodeCard({
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
  onAnalyze: _onAnalyze,
}: FileNodeCardProps) {
  const icon = fileIcon(node.fileType, node.fileName);

  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 24, overflow: "hidden", background: "var(--pastel-blue)",
          border: `1px solid ${selected ? "#0A0A0A" : "var(--color-border, rgba(0,0,0,0.08))"}`,
          borderRadius: 6,
          userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, padding: "0 7px",
          opacity: dimmed ? 0.18 : node.loading ? 0.6 : 1, transition: "opacity 0.2s",
        }}
      >
        <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.fileName}</span>
      </div>
    );
  }

  const fileColor = "#4A6CF7";
  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: node.customHeight ?? FILE_NODE_W, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : node.loading ? 0.6 : 1, transition: "opacity 0.2s" }}
    >
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Datei analysieren / Folgefrage"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${fileColor}`, boxShadow: `0 0 8px ${fileColor}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${fileColor}99, 0 0 0 3px ${fileColor}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${fileColor}66`; }}
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
          style={{ height: 44, padding: "0 14px", cursor: "grab", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.12)", borderTopLeftRadius: 11, borderTopRightRadius: 11 }}
        >
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: fileColor, background: `${fileColor}18`, border: `1px solid ${fileColor}40`, borderRadius: 5, padding: "2px 7px", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>DATEI</span>
          <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={node.fileName}>{node.fileName}</div>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 1 }}>
              {formatFileSize(node.fileSize)}{node.loading ? " · hochladen…" : ""}
            </div>
          </div>
        </div>
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? FILE_NODE_W, "both"); }}
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
