/**
 * DetailPanel — the full-screen card inspector that opens when a
 * user clicks any canvas node (in Canvas, Board, Timeline, or Orbit
 * view). Renders a type-specific header / body / footer triplet and
 * delegates all mutations via props; the component itself owns only
 * local draft state for the note/idea/list editors.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice 3
 * (18.04.2026 audit A5-H7). This file also carries the six helper
 * components that were exclusively used by the DetailPanel:
 * ConfidenceBadge, SourceChips, CollapsibleSection, RadarChart,
 * CausalGraphSVG, ScenarioComparisonChart. Keeping them co-located
 * matches how `git blame` reads the history and avoids one-consumer
 * modules.
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  RefreshCw,
  ArrowDown,
  ArrowRight,
  ShieldAlert,
  Compass,
  Search,
  GitBranch,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { GraphLightbox } from "@/components/ui/GraphLightbox";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { StatusIcon } from "./StatusIcon";
import { FormattedText } from "./FormattedText";
import { TagInlineInput } from "./TagInlineInput";
import { NODE_STATUS_META, SCEN } from "./constants";
import { formatFileSize, formatNodeTime, nodeAge } from "./utils";
import type {
  CanvasNode,
  DerivedNode,
  FileNode,
  IdeaNode,
  ListNode,
  NodeStatus,
  NoteNode,
  QueryNode,
} from "./types";
import type {
  DimensionEntry,
  MatchedEdge,
  MatchedTrend,
  UsedSignal,
} from "@/types";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";

// ── ConfidenceBadge ───────────────────────────────────────────────────────
// Moved to src/components/ui/ConfidenceBadge.tsx (Welle A Item 2 —
// reusable across DetailPanel, VoltTrendCard, BriefingResult). Imports
// the shared component; the tier thresholds + CSS classes are
// unchanged, so there's no visual regression.

// ── SourceChips ───────────────────────────────────────────────────────────

function SourceChips({ sources, de }: { sources: UsedSignal[]; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!sources.length) return null;
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}
    >
      <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 2 }}>
        {tl("detail.basis")}
      </span>
      {sources.map((s, i) => {
        const tipContent = (
          <div style={{ maxWidth: 220 }}>
            <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 11 }}>{s.source}</div>
            <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.4 }}>{s.title}</div>
            {s.date && <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>{s.date}</div>}
          </div>
        );
        return s.url ? (
          <Tooltip key={i} content={tipContent} placement="top" delay={200}>
            <a href={s.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: 9, padding: "1px 7px", borderRadius: 20,
                background: "var(--color-page-bg)", border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)", fontWeight: 500,
                fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                textDecoration: "none", whiteSpace: "nowrap",
                display: "inline-block", transition: "all 0.12s",
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border-strong)"; el.style.color = "var(--color-text-secondary)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border)"; el.style.color = "var(--color-text-muted)"; }}
            >{s.source}</a>
          </Tooltip>
        ) : (
          <Tooltip key={i} content={tipContent} placement="top" delay={200}>
            <span
              style={{
                fontSize: 9, padding: "1px 7px", borderRadius: 20,
                background: "var(--color-page-bg)", border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)", fontWeight: 500, whiteSpace: "nowrap",
                fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                display: "inline-block",
              }}
            >{s.source}</span>
          </Tooltip>
        );
      })}
    </div>
  );
}
// ── Collapsible Section ───────────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = true, accent }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 18 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "0 0 6px", width: "100%", textAlign: "left" }}
      >
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: accent ?? "var(--color-text-muted)", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: "var(--color-border)", marginLeft: 4 }} />
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", transition: "transform 0.15s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block" }}>▾</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
// ── Radar Chart (pure SVG, no D3) ────────────────────────────────────────

function RadarChart({ trends, de }: { trends: MatchedTrend[]; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!trends || trends.length === 0) return null;

  const SIZE = 160;
  const cx = SIZE / 2, cy = SIZE / 2, r = 58;
  const axes = [
    { key: "relevance", label: tl("detail.relevance") },
    { key: "confidence", label: tl("detail.confidenceCap") },
    { key: "impact", label: tl("detail.impact") },
    { key: "momentum", label: tl("detail.momentum") },
    { key: "density", label: tl("detail.signalDensity") },
  ];
  const n = axes.length;

  const avg = (key: string) => {
    if (key === "momentum") {
      const rising = trends.filter(t => t.velocity === "rising").length;
      return rising / Math.max(trends.length, 1);
    }
    if (key === "density") {
      const avgSig = trends.reduce((s, t) => s + (t.signalCount || 0), 0) / Math.max(trends.length, 1);
      return Math.min(avgSig / 40, 1);
    }
    return trends.reduce((s, t) => s + ((t as any)[key] ?? 0), 0) / Math.max(trends.length, 1);
  };

  const vals = axes.map(ax => avg(ax.key));

  const pt = (axIdx: number, value: number) => {
    const angle = (axIdx / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) };
  };

  const labelPt = (axIdx: number) => {
    const angle = (axIdx / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + (r + 18) * Math.cos(angle), y: cy + (r + 18) * Math.sin(angle) };
  };

  const polyPath = (vArr: number[]) =>
    vArr.map((v, i) => { const p = pt(i, v); return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(" ") + " Z";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={SIZE + 40} height={SIZE + 32} viewBox={`-20 -16 ${SIZE + 40} ${SIZE + 32}`} style={{ overflow: "visible" }}>
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1.0].map(lv => (
          <path key={lv} d={polyPath(Array(n).fill(lv))} fill={lv === 1 ? "none" : "none"} stroke="var(--color-border)" strokeWidth={lv === 1 ? 1 : 0.7} strokeDasharray={lv < 1 ? "2,3" : undefined} />
        ))}
        {/* Axis lines */}
        {axes.map((_, i) => { const p = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--color-border)" strokeWidth={0.8} />; })}
        {/* Data polygon */}
        <path d={polyPath(vals)} fill="#1A9E5A1A" stroke="#1A9E5A" strokeWidth={1.8} />
        {/* Data points */}
        {vals.map((v, i) => { const p = pt(i, v); return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#1A9E5A" />; })}
        {/* Axis labels */}
        {axes.map((ax, i) => {
          const p = labelPt(i);
          const anchor = p.x < cx - 4 ? "end" : p.x > cx + 4 ? "start" : "middle";
          return <text key={i} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fontSize={8} fill="var(--color-text-muted)" fontFamily="inherit">{ax.label}</text>;
        })}
        {/* Value labels */}
        {vals.map((v, i) => { const p = pt(i, v); return <text key={i} x={p.x + 4} y={p.y - 4} fontSize={7} fill="#1A9E5A" fontFamily="inherit" fontWeight={600}>{Math.round(v * 100)}</text>; })}
      </svg>
      {/* Legend: matched trend count */}
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>
        {trends.length} {tl("detail.trendsAnalyzed")} · Ø {Math.round(vals[0] * 100)}% {tl("detail.relevanceShort")}
      </div>
    </div>
  );
}

// ── DimensionRadar — spider chart for 4 strategic dimensions ─────────────
// Exported: also used by the DimensionsNodeCard in page.tsx.

export function DimensionRadar({ dimData, size = 200, mini = false }: {
  dimData: DimensionEntry[];
  size?: number;
  mini?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (!dimData || dimData.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - (mini ? 12 : 30);

  // 4 axes: top=Tech, right=Gesellschaft, bottom=Wirtschaft, left=Geopolitik
  const axes = dimData.map((d, i) => {
    const angle = (i / dimData.length) * 2 * Math.PI - Math.PI / 2;
    return { ...d, angle, ax: cx + maxR * Math.cos(angle), ay: cy + maxR * Math.sin(angle) };
  });

  // Polygon points from confidence values
  const polyPoints = axes.map(a => {
    const r = a.avgConfidence * maxR;
    return `${cx + r * Math.cos(a.angle)},${cy + r * Math.sin(a.angle)}`;
  }).join(" ");

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = mini ? [0.5, 1] : [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      {/* Grid rings */}
      {rings.map(r => (
        <polygon key={r}
          points={axes.map(a => `${cx + maxR * r * Math.cos(a.angle)},${cy + maxR * r * Math.sin(a.angle)}`).join(" ")}
          fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {axes.map(a => (
        <line key={a.key} x1={cx} y1={cy} x2={a.ax} y2={a.ay}
          stroke={hovered === a.key ? a.color : "rgba(0,0,0,0.1)"} strokeWidth={hovered === a.key ? 1.5 : 1} />
      ))}
      {/* Filled polygon */}
      <polygon points={polyPoints}
        fill={hovered
          ? (axes.find(a => a.key === hovered)?.color ?? "#3b82f6") + "30"
          : "rgba(59,130,246,0.15)"}
        stroke={hovered ? axes.find(a => a.key === hovered)?.color ?? "#3b82f6" : "#3b82f6"}
        strokeWidth={1.5}
      />
      {/* Data points on axes */}
      {axes.map(a => {
        const r = a.avgConfidence * maxR;
        const px = cx + r * Math.cos(a.angle);
        const py = cy + r * Math.sin(a.angle);
        const isH = hovered === a.key;
        return (
          <g key={a.key}
            onMouseEnter={() => setHovered(a.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: mini ? "default" : "pointer" }}
          >
            {/* Hit area on axis */}
            <line x1={cx} y1={cy} x2={a.ax} y2={a.ay} stroke="transparent" strokeWidth={12} />
            <circle cx={px} cy={py} r={isH ? 5 : 3.5}
              fill={a.color} strokeWidth={isH ? 2 : 0}
              stroke="white"
              opacity={a.trends.length === 0 ? 0.3 : 1}
            />
            {!mini && (
              <>
                {/* Axis label */}
                <text
                  x={a.ax + Math.cos(a.angle) * 8}
                  y={a.ay + Math.sin(a.angle) * 8 + (Math.sin(a.angle) > 0 ? 10 : Math.sin(a.angle) < -0.1 ? -4 : 4)}
                  textAnchor={Math.cos(a.angle) > 0.2 ? "start" : Math.cos(a.angle) < -0.2 ? "end" : "middle"}
                  fontSize={isH ? 11 : 10} fontWeight={isH ? 700 : 400}
                  fill={isH ? a.color : "var(--color-text-secondary)"}
                  fontFamily="inherit"
                >
                  {a.label.split(" & ")[0]}
                </text>
                {/* Confidence % label */}
                {isH && a.trends.length > 0 && (
                  <text x={px + 8} y={py - 6} fontSize={10} fontWeight={700} fill={a.color} fontFamily="inherit">
                    {Math.round(a.avgConfidence * 100)}%
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill="rgba(0,0,0,0.2)" />
    </svg>
  );
}

// ── Causal Edge List ──────────────────────────────────────────────────────

function CausalEdgeList({ edges, trendNames, de }: {
  edges: MatchedEdge[]; trendNames: Map<string, string>; de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!edges || edges.length === 0) return null;
  const typeColor: Record<string, string> = {
    drives: "#1A9E5A", amplifies: "#2563EB", dampens: "#E8402A", correlates: "#8B5CF6",
  };
  const typeLabel: Record<string, string> = {
    drives: tl("detail.drives"),
    amplifies: tl("detail.amplifies"),
    dampens: tl("detail.dampens"),
    correlates: tl("detail.correlates"),
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {edges.map((e, i) => {
        const fromName = trendNames.get(e.from) || e.from.replace("mega-", "").replace("macro-", "");
        const toName = trendNames.get(e.to) || e.to.replace("mega-", "").replace("macro-", "");
        const color = typeColor[e.type] ?? "#888";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ flex: 1, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }} title={fromName}>{fromName}</span>
            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color, padding: "1px 6px", borderRadius: 10, background: `${color}18`, border: `1px solid ${color}44` }}>
              {typeLabel[e.type] ?? e.type} {Math.round(e.strength * 100)}%
            </span>
            <span style={{ flex: 1, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130, textAlign: "right" }} title={toName}>{toName}</span>
          </div>
        );
      })}
    </div>
  );
}
// ── CausalGraphSVG — standalone graph for DetailPanel ────────────────────

function CausalGraphSVG({ edges, nameMap, width = 700, height = 320 }: {
  edges: MatchedEdge[];
  nameMap: Record<string, string>;
  width?: number;
  height?: number;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ edge: MatchedEdge; mx: number; my: number } | null>(null);
  const edgeTypeColor: Record<string, string> = {
    drives: "#1A9E5A", amplifies: "#2563EB", dampens: "#E8402A", correlates: "#9CA3AF",
  };
  const edgeTypeLabel: Record<string, string> = {
    drives: "treibt", amplifies: "verstärkt", dampens: "dämpft", correlates: "korreliert",
  };

  const trendIds = Array.from(new Set(edges.flatMap(e => [e.from, e.to]))).slice(0, 8);
  if (trendIds.length === 0) return null;

  // Hub sizing: nodes with more connections get a bigger radius
  const edgeCount = new Map<string, number>();
  edges.forEach(e => {
    edgeCount.set(e.from, (edgeCount.get(e.from) ?? 0) + 1);
    edgeCount.set(e.to, (edgeCount.get(e.to) ?? 0) + 1);
  });
  const maxEdges = Math.max(...Array.from(edgeCount.values()), 1);
  const nodeR = (id: string) => 7 + ((edgeCount.get(id) ?? 0) / maxEdges) * 5; // 7–12px

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 44;
  const trendPositions = trendIds.map((id, i) => {
    const angle = (i / trendIds.length) * 2 * Math.PI - Math.PI / 2;
    return { id, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
  const posMap = new Map(trendPositions.map(p => [p.id, p]));
  const visibleEdges = edges.filter(e => trendIds.includes(e.from) && trendIds.includes(e.to));

  const connectedEdges = hoveredNodeId
    ? new Set(visibleEdges.filter(e => e.from === hoveredNodeId || e.to === hoveredNodeId).map((_, i) => i))
    : null;
  const connectedTo = hoveredNodeId ? new Set(
    visibleEdges.filter(e => e.from === hoveredNodeId || e.to === hoveredNodeId).flatMap(e => [e.from, e.to])
  ) : null;

  const getName = (id: string) => {
    const n = nameMap[id] || id.replace(/mega-|macro-|micro-/, "").replace(/-/g, " ");
    return n.length > 16 ? n.slice(0, 16) + "…" : n;
  };

  // Build curved path: offset endpoints to node border + slight perpendicular curve
  const edgePath = (from: { x: number; y: number }, to: { x: number; y: number }, fromR: number, toR: number, idx: number) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    // Offset start/end by node radius + arrow margin
    const x1 = from.x + ux * (fromR + 3);
    const y1 = from.y + uy * (fromR + 3);
    const x2 = to.x - ux * (toR + 7); // extra margin for arrowhead
    const y2 = to.y - uy * (toR + 7);
    // Perpendicular curve offset (alternates direction per edge index)
    const perp = (idx % 2 === 0 ? 1 : -1) * Math.min(dist * 0.18, 28);
    const qx = (x1 + x2) / 2 - uy * perp;
    const qy = (y1 + y2) / 2 + ux * perp;
    return `M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`;
  };

  // Label position: push outward from center
  const labelPos = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = 16;
    return { lx: x + (dx / dist) * push, ly: y + (dy / dist) * push };
  };

  // Unique arrow marker ids per color
  const markerIds = Object.entries(edgeTypeColor).map(([type, color]) => ({ type, color, id: `arrow-${type}` }));

  return (
    <div style={{ position: "relative", background: "rgba(26,158,90,0.025)", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          {markerIds.map(({ id, color }) => (
            <marker key={id} id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={color} fillOpacity="0.85" />
            </marker>
          ))}
        </defs>

        {/* Edges */}
        {visibleEdges.map((e, i) => {
          const from = posMap.get(e.from);
          const to = posMap.get(e.to);
          if (!from || !to) return null;
          const isHighlighted = connectedEdges ? connectedEdges.has(i) : true;
          const color = edgeTypeColor[e.type] ?? "#9CA3AF";
          const sw = 1 + e.strength * 2.5; // 1–3.5px based on strength
          const markerId = `arrow-${e.type}`;
          return (
            <path key={i}
              d={edgePath(from, to, nodeR(e.from), nodeR(e.to), i)}
              stroke={color}
              strokeWidth={isHighlighted ? sw : 0.8}
              strokeOpacity={isHighlighted ? 0.8 : 0.1}
              strokeDasharray={e.type === "correlates" ? "5 3" : undefined}
              fill="none"
              markerEnd={isHighlighted || !connectedEdges ? `url(#${markerId})` : undefined}
              style={{ cursor: "pointer" }}
              onMouseEnter={ev => setHoveredEdge({ edge: e, mx: ev.clientX, my: ev.clientY })}
              onMouseMove={ev => setHoveredEdge(h => h ? { ...h, mx: ev.clientX, my: ev.clientY } : null)}
              onMouseLeave={() => setHoveredEdge(null)}
            />
          );
        })}

        {/* Nodes */}
        {trendPositions.map(({ id, x, y }) => {
          const isHovered = hoveredNodeId === id;
          const dimmed2 = connectedTo ? !connectedTo.has(id) : false;
          const r = nodeR(id);
          const { lx, ly } = labelPos(x, y);
          const isAbove = ly < y;
          return (
            <g key={id}
              onMouseEnter={() => setHoveredNodeId(id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Glow ring on hover */}
              {isHovered && <circle cx={x} cy={y} r={r + 5} fill="#1A9E5A" fillOpacity={0.15} />}
              <circle cx={x} cy={y} r={isHovered ? r + 2 : r}
                fill={isHovered ? "#1A9E5A" : "white"}
                stroke={isHovered ? "#1A9E5A" : "#1A9E5A"}
                strokeWidth={isHovered ? 2 : 1.5}
                opacity={dimmed2 ? 0.2 : 1}
                style={{ filter: isHovered ? "drop-shadow(0 0 4px #1A9E5A88)" : undefined }}
              />
              {/* Label with subtle background */}
              <text x={lx} y={isAbove ? ly - 2 : ly + 12} textAnchor="middle" fontSize={10}
                fill={dimmed2 ? "rgba(0,0,0,0.2)" : "#111"}
                fontFamily="inherit" fontWeight={isHovered ? "600" : "400"}
              >{getName(id)}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "6px 14px 10px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
        {markerIds.map(({ type, color }) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={20} height={8} style={{ flexShrink: 0 }}>
              <line x1={1} y1={4} x2={14} y2={4} stroke={color} strokeWidth={2}
                strokeDasharray={type === "correlates" ? "3 2" : undefined} />
              <polygon points="13,1 13,7 20,4" fill={color} />
            </svg>
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{edgeTypeLabel[type] ?? type}</span>
          </div>
        ))}
      </div>

      {/* Edge descriptions (shown when a node is hovered) */}
      {hoveredNodeId && (() => {
        const relevant = visibleEdges.filter(e => e.from === hoveredNodeId || e.to === hoveredNodeId);
        if (relevant.length === 0) return null;
        return (
          <div style={{ padding: "8px 14px 12px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>Kausalketten</div>
            {relevant.map((e, i) => {
              const color = edgeTypeColor[e.type] ?? "#9CA3AF";
              const fromName = getName(e.from);
              const toName = getName(e.to);
              const pct = Math.round(e.strength * 100);
              return (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#333", fontWeight: e.from === hoveredNodeId ? 600 : 400 }}>{fromName}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>{edgeTypeLabel[e.type] ?? e.type} {pct}%</span>
                  <span style={{ color: "#333", fontWeight: e.to === hoveredNodeId ? 600 : 400 }}>{toName}</span>
                  {e.description && <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1 }}>— {e.description}</span>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Edge tooltip on hover */}
      {hoveredEdge && (() => {
        const { edge: e, mx, my } = hoveredEdge;
        const color = edgeTypeColor[e.type] ?? "#9CA3AF";
        const fromName = getName(e.from);
        const toName = getName(e.to);
        const pct = Math.round(e.strength * 100);
        return (
          <div style={{
            position: "fixed", left: mx + 12, top: my - 10, zIndex: 9999,
            background: "white", border: `1.5px solid ${color}55`,
            borderRadius: 8, padding: "6px 10px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            pointerEvents: "none", maxWidth: 260,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#111", marginBottom: 2 }}>
              {fromName} → {toName}
            </div>
            <div style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color, fontWeight: 700, background: `${color}18`, borderRadius: 5, padding: "1px 6px" }}>{edgeTypeLabel[e.type] ?? e.type}</span>
              <span style={{ color: "var(--color-text-muted)" }}>Stärke: {pct}%</span>
            </div>
            {e.description && <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 3 }}>{e.description}</div>}
          </div>
        );
      })()}
    </div>
  );
}

// ── DimensionsDetailBody ─────────────────────────────────────────────────

function DimensionsDetailBody({ dimData, createdAt }: { dimData: DimensionEntry[]; createdAt?: string }) {
  const [activeDim, setActiveDim] = useState<string | null>(null);
  const active = activeDim ? dimData.find(d => d.key === activeDim) : null;

  return (
    <div style={{ padding: "8px 40px 28px", flex: 1, overflowY: "auto" }}>
      {/* Radar centered, full width */}
      <GraphLightbox title="Dimensionen-Radar" style={{ borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "center", background: "rgba(59,130,246,0.025)", border: "1px solid rgba(0,0,0,0.06)", padding: "20px 0 12px" }}
          onMouseLeave={() => setActiveDim(null)}>
          <DimensionRadarInteractive dimData={dimData} size={340} onHover={setActiveDim} />
        </div>
      </GraphLightbox>
      {/* Dimension summary bars — 2×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {dimData.map(dim => {
          const pct = Math.round(dim.avgConfidence * 100);
          const arrow = dim.direction === "up" ? "↑" : dim.direction === "down" ? "↓" : "→";
          const isActive = activeDim === dim.key;
          return (
            <div key={dim.key}
              onMouseEnter={() => setActiveDim(dim.key)}
              onMouseLeave={() => setActiveDim(null)}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${isActive ? dim.color + "66" : "rgba(0,0,0,0.07)"}`, background: isActive ? `${dim.color}08` : "white", transition: "all 0.15s" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: dim.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-heading)", flex: 1, lineHeight: 1.2 }}>{dim.label}</span>
                <span style={{ fontSize: 13, color: dim.color, fontWeight: 800 }}>{arrow} {pct}%</span>
              </div>
              <div style={{ height: 5, background: "rgba(0,0,0,0.07)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: dim.color, borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>
                {dim.trends.length === 0 ? "Keine Trends" : `${dim.trends.length} Trend${dim.trends.length > 1 ? "s" : ""}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trends for active or all dimensions */}
      {(active ? [active] : dimData.filter(d => d.trends.length > 0)).map(dim => (
        <div key={dim.key} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dim.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: dim.color }}>{dim.label}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {(dim.trends as MatchedTrend[]).map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, background: `${dim.color}08`, border: `1px solid ${dim.color}20` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)" }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 1 }}>
                    {/* FIXED: EDGE-15 — Clamp relevance/confidence to [0,1] */}
                    {t.ring} · {t.velocity === "rising" ? "↑ steigend" : t.velocity === "falling" ? "↓ fallend" : "→ stabil"} · {Math.round(Math.max(0, Math.min(1, t.relevance)) * 100)}% Relevanz
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <div style={{ width: 52, height: 4, background: "rgba(0,0,0,0.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, t.confidence)) * 100}%`, background: dim.color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9, color: dim.color, fontWeight: 600 }}>{Math.round(Math.max(0, Math.min(1, t.confidence)) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {createdAt && <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 8 }}>{new Date(createdAt).toLocaleString("de-DE")}</div>}
    </div>
  );
}

function DimensionRadarInteractive({ dimData, size, onHover }: {
  dimData: DimensionEntry[]; size: number; onHover: (key: string | null) => void;
}) {
  const [localHover, setLocalHover] = useState<string | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 36;
  const axes = dimData.map((d, i) => {
    const angle = (i / dimData.length) * 2 * Math.PI - Math.PI / 2;
    return { ...d, angle, ax: cx + maxR * Math.cos(angle), ay: cy + maxR * Math.sin(angle) };
  });
  const polyPoints = axes.map(a => {
    const r = a.avgConfidence * maxR;
    return `${cx + r * Math.cos(a.angle)},${cy + r * Math.sin(a.angle)}`;
  }).join(" ");
  const hovered = localHover;
  return (
    <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map(r => (
        <polygon key={r}
          points={axes.map(a => `${cx + maxR * r * Math.cos(a.angle)},${cy + maxR * r * Math.sin(a.angle)}`).join(" ")}
          fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={1}
        />
      ))}
      {axes.map(a => (
        <line key={a.key} x1={cx} y1={cy} x2={a.ax} y2={a.ay}
          stroke={hovered === a.key ? a.color : "rgba(0,0,0,0.1)"} strokeWidth={hovered === a.key ? 2 : 1} />
      ))}
      <polygon points={polyPoints}
        fill={hovered ? (axes.find(a => a.key === hovered)?.color ?? "#3b82f6") + "22" : "rgba(59,130,246,0.15)"}
        stroke={hovered ? (axes.find(a => a.key === hovered)?.color ?? "#3b82f6") : "#3b82f6"}
        strokeWidth={2}
        style={{ transition: "fill 0.2s, stroke 0.2s" }}
      />
      {axes.map(a => {
        const r = a.avgConfidence * maxR;
        const px = cx + r * Math.cos(a.angle);
        const py = cy + r * Math.sin(a.angle);
        const isH = hovered === a.key;
        const cos = Math.cos(a.angle);
        const sin = Math.sin(a.angle);
        return (
          <g key={a.key}
            onMouseEnter={() => { setLocalHover(a.key); onHover(a.key); }}
            onMouseLeave={() => { setLocalHover(null); onHover(null); }}
            style={{ cursor: "pointer" }}
          >
            <line x1={cx} y1={cy} x2={a.ax} y2={a.ay} stroke="transparent" strokeWidth={14} />
            <circle cx={px} cy={py} r={isH ? 6 : 4}
              fill={a.color} stroke="white" strokeWidth={isH ? 2 : 1}
              opacity={a.trends.length === 0 ? 0.3 : 1}
            />
            <text
              x={a.ax + cos * 10}
              y={a.ay + sin * 10 + (sin > 0.1 ? 11 : sin < -0.1 ? -5 : 4)}
              textAnchor={cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle"}
              fontSize={isH ? 11 : 10} fontWeight={isH ? 700 : 500}
              fill={isH ? a.color : "var(--color-text-secondary)"}
              fontFamily="inherit"
            >{a.label.split(" & ")[0]}</text>
            {isH && a.trends.length > 0 && (
              <text x={px + (cos > 0 ? 10 : -10)} y={py - 6}
                textAnchor={cos > 0 ? "start" : "end"}
                fontSize={11} fontWeight={700} fill={a.color} fontFamily="inherit">
                {Math.round(a.avgConfidence * 100)}%
              </text>
            )}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={2.5} fill="rgba(0,0,0,0.25)" />
    </svg>
  );
}
// ── ScenarioComparisonChart ───────────────────────────────────────────────

function ScenarioComparisonChart({ scenarios, currentId, de }: {
  scenarios: DerivedNode[]; currentId: string; de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (scenarios.length < 2) return null;
  const sorted = [...scenarios].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  return (
    <div style={{ marginBottom: 24, padding: "16px 18px 18px", background: "rgba(0,0,0,0.025)", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 14 }}>
        {tl("detail.scenarioComparison")}
      </div>
      {sorted.map(s => {
        // FIXED: EDGE-15 — Clamp probability to [0,1]
        const pct = Math.round(Math.max(0, Math.min(1, s.probability ?? 0)) * 100);
        const isCurrent = s.id === currentId;
        const cfg = s.colorKey ? SCEN[s.colorKey] ?? SCEN.baseline : SCEN.baseline;
        return (
          <div key={s.id} style={{ marginBottom: 13 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: isCurrent ? 13 : 12, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? cfg.color : "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isCurrent && "▶ "}{s.label || s.content.slice(0, 48)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, flexShrink: 0, minWidth: 36, textAlign: "right" }}>{pct}%</span>
            </div>
            <div style={{ height: isCurrent ? 10 : 7, background: "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`, borderRadius: 4,
                background: cfg.color,
                opacity: isCurrent ? 1 : 0.38,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ── DetailPanel ───────────────────────────────────────────────────────────

export interface DetailPanelProps {
  node: CanvasNode;
  de: boolean;
  allQueryNodes: QueryNode[];
  onClose: () => void;
  onFollowUp: (id: string, prefill?: string) => void;
  onRefresh: (id: string) => void;
  onExplore: (id: string, queryText: string) => void;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, content: string) => void;
  onUpdateIdea: (id: string, title: string, content: string) => void;
  onUpdateList: (id: string, title: string, items: string[]) => void;
  onPromoteNote: (query: string) => void;
  onPromoteIdea: (query: string) => void;
  onAnalyzeFile: (query: string, parentId: string) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  siblingScenarios?: DerivedNode[];
}

export function DetailPanel({
  node, de, allQueryNodes, onClose, onFollowUp, onRefresh, onExplore, onDelete,
  onUpdateNote, onUpdateIdea, onUpdateList, onPromoteNote, onPromoteIdea,
  onAnalyzeFile, onIterate, onSetStatus, onUpdateTags, siblingScenarios,
}: DetailPanelProps) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  const [noteDraft, setNoteDraft] = useState(() =>
    node.nodeType === "note" ? (node as NoteNode).content || "" : ""
  );
  const [ideaTitle, setIdeaTitle] = useState(() =>
    node.nodeType === "idea" ? (node as IdeaNode).title || "" : ""
  );
  const [ideaContent, setIdeaContent] = useState(() =>
    node.nodeType === "idea" ? (node as IdeaNode).content || "" : ""
  );
  const [listTitle, setListTitle] = useState(() =>
    node.nodeType === "list" ? (node as ListNode).title || "" : ""
  );
  const [listItems, setListItems] = useState<string[]>(() =>
    node.nodeType === "list" ? (node as ListNode).items || [""] : [""]
  );
  const [editingListIdx, setEditingListIdx] = useState<number | null>(null);
  const [listDraftItem, setListDraftItem] = useState("");
  const listItemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [copied, setCopied] = useState(false);

  // Sync state when node switches
  useEffect(() => {
    if (node.nodeType === "note") setNoteDraft((node as NoteNode).content || "");
    if (node.nodeType === "idea") {
      setIdeaTitle((node as IdeaNode).title || "");
      setIdeaContent((node as IdeaNode).content || "");
    }
    if (node.nodeType === "list") {
      setListTitle((node as ListNode).title || "");
      setListItems((node as ListNode).items || [""]);
      setEditingListIdx(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // ── Auto-save handlers ────────────────────────────────────────────────────
  const handleNoteChange = (val: string) => {
    setNoteDraft(val);
    onUpdateNote(node.id, val);
  };
  const handleIdeaTitleChange = (val: string) => {
    setIdeaTitle(val);
    onUpdateIdea(node.id, val, ideaContent);
  };
  const handleIdeaContentChange = (val: string) => {
    setIdeaContent(val);
    onUpdateIdea(node.id, ideaTitle, val);
  };
  const handleListTitleChange = (val: string) => {
    setListTitle(val);
    onUpdateList(node.id, val, listItems);
  };
  const commitListItem = (i: number, val: string) => {
    const updated = listItems.map((it, idx) => idx === i ? val : it)
      .filter((it, idx) => it.trim() !== "" || idx === listItems.length - 1);
    const final = updated.length > 0 ? updated : [""];
    setListItems(final);
    setEditingListIdx(null);
    onUpdateList(node.id, listTitle, final);
  };
  const addListItem = () => {
    const items = [...listItems, ""];
    setListItems(items);
    setTimeout(() => {
      const i = items.length - 1;
      setEditingListIdx(i); setListDraftItem("");
      listItemRefs.current[i]?.focus();
    }, 30);
  };
  const removeListItem = (i: number) => {
    const items = listItems.filter((_, idx) => idx !== i);
    const final = items.length > 0 ? items : [""];
    setListItems(final);
    onUpdateList(node.id, listTitle, final);
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const renderHeader = () => {
    if (node.nodeType === "query") {
      const qNode = node as QueryNode;
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0A0A0A", background: "#E4FF97", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{tl("detail.yourQuery")}</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "var(--font-heading, 'Bricolage Grotesque'), sans-serif", color: "var(--color-text-heading)", lineHeight: 1.3, letterSpacing: "-0.025em" }}>{qNode.query}</h2>
        </div>
      );
    }
    if (node.nodeType === "note") return (
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#F9A825", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>NOTIZ</div>
    );
    if (node.nodeType === "idea") return (
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF9800", marginBottom: 6, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>IDEE</div>
        <input
          value={ideaTitle}
          onChange={e => handleIdeaTitleChange(e.target.value)}
          placeholder={tl("detail.ideaPlaceholder")}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: "var(--color-text-heading)", fontFamily: "inherit", padding: 0, boxSizing: "border-box" }}
        />
      </div>
    );
    if (node.nodeType === "list") return (
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2E7D32", marginBottom: 6, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>LISTE</div>
        <input
          value={listTitle}
          onChange={e => handleListTitleChange(e.target.value)}
          placeholder={tl("detail.listPlaceholder")}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: "var(--color-text-heading)", fontFamily: "inherit", padding: 0, boxSizing: "border-box" }}
        />
      </div>
    );
    if (node.nodeType === "file") {
      const fNode = node as FileNode;
      return (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A6CF7", marginBottom: 5, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>DATEI</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-heading)" }}>{fNode.fileName}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{formatFileSize(fNode.fileSize)}</div>
        </div>
      );
    }
    // Derived
    const dNode = node as DerivedNode;
    const type = dNode.nodeType;
    if (type === "dimensions") {
      return (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 5, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>DIMENSIONEN</div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-heading)", lineHeight: 1.3 }}>Strategische Dimensionsanalyse</h2>
        </div>
      );
    }
    if (type === "causalgraph") {
      return (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1A9E5A", marginBottom: 5, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>KAUSALNETZ</div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-heading)", lineHeight: 1.3 }}>Kausal-Beziehungen</h2>
        </div>
      );
    }
    const badge = type === "insight" ? tl("detail.badgeInsight")
      : type === "decision" ? tl("detail.badgeDecision")
      : type === "followup" ? tl("detail.badgeFollowup")
      : (() => { const s = SCEN[dNode.colorKey ?? "baseline"] ?? SCEN.baseline; return de ? s.label.toUpperCase() : s.labelEn.toUpperCase(); })();
    const accentColor = type === "insight" ? "#6B7A00"
      : type === "decision" ? "#1A9E5A"
      : type === "scenario" ? (SCEN[dNode.colorKey ?? "baseline"]?.color ?? "#1D4ED8")
      : "#6B7280";
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: accentColor, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{badge}</span>
          <span style={{ fontSize: 7, fontWeight: 600, padding: "0px 4px", borderRadius: 3, background: "rgba(0,0,0,0.05)", color: "var(--color-text-muted)", fontFamily: "var(--font-code, monospace)", letterSpacing: "0.05em" }}>KI</span>
        </div>
        {type === "scenario" && dNode.label && (
          <h2 style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: SCEN[dNode.colorKey ?? "baseline"]?.color ?? "#1D4ED8", lineHeight: 1.4 }}>{dNode.label}</h2>
        )}
        {(type === "insight" || type === "decision") && dNode.content && (
          <h2 style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: "var(--color-text-heading)", lineHeight: 1.4 }}>
            {dNode.content.length > 80 ? dNode.content.slice(0, 80) + "…" : dNode.content}
          </h2>
        )}
      </div>
    );
  };

  // ── Body ──────────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (node.nodeType === "query") {
      const qNode = node as QueryNode;
      const r = qNode.result;
      const age = nodeAge(qNode.createdAt);
      const isLoading = qNode.status === "loading" || qNode.status === "streaming";

      // Coherence: find overlapping matched trends with other query nodes
      const myIds = new Set(r?.matchedTrendIds ?? []);
      const coherences = myIds.size > 0
        ? allQueryNodes
            .filter(n => n.id !== qNode.id && n.status === "done" && (n.result?.matchedTrendIds?.length ?? 0) > 0)
            .map(n => {
              const shared = (n.result!.matchedTrendIds ?? []).filter(id => myIds.has(id));
              return { nodeId: n.id, query: n.query, overlap: shared.length };
            })
            .filter(c => c.overlap >= 2)
            .sort((a, b) => b.overlap - a.overlap)
            .slice(0, 3)
        : [];

      // Demographics: trends tagged with demographic/society categories
      const demographicTrends = (r?.matchedTrends ?? []).filter(t =>
        t.tags?.some(tag => ["demographics", "society", "aging", "population", "migration", "work", "education", "health"].includes(tag)) ||
        t.id?.includes("demographic") || t.category === "society"
      );

      // Trend name lookup
      const trendNames = new Map((r?.matchedTrends ?? []).map(t => [t.id, t.name]));

      return (
        <div style={{ padding: "8px 40px 28px", flex: 1, overflowY: "auto" }}>

          {/* ── Streaming progress ───────────────────────────────── */}
          {isLoading && (
            <div style={{ marginBottom: 14, padding: "10px 12px", background: "var(--pastel-peach)", borderRadius: 8, border: "1px solid #F5A62330" }}>
              {(() => {
                const phases = de
                  ? ["Signale lesen…", "Synthese…", "Kausalketten…", "Szenarien…", "Erkenntnisse…", "Abschliessen…"]
                  : ["Reading signals…", "Synthesis…", "Causal chains…", "Scenarios…", "Insights…", "Finishing…"];
                const phase = qNode.streamingPhase ?? 0;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#F5A623" }}>{phases[phase]}</span>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{Math.round((phase / 5) * 100)}%</span>
                    </div>
                    <div style={{ height: 3, background: "var(--color-border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(phase / 5) * 100}%`, background: "linear-gradient(90deg, #F5A623, #E4FF97)", borderRadius: 2, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      {phases.map((p, i) => (
                        <span key={i} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: i <= phase ? "#F5A62320" : "transparent", border: `1px solid ${i <= phase ? "#F5A623" : "var(--color-border)"}`, color: i <= phase ? "#F5A623" : "var(--color-text-muted)", transition: "all 0.3s" }}>{p.replace("…","")}</span>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── Error ────────────────────────────────────────────── */}
          {qNode.status === "error" && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FCA5A5" }}>
              <p style={{ fontSize: 13, color: "#E8402A", margin: 0 }}>{qNode.errorMsg || "Fehler bei der Analyse"}</p>
            </div>
          )}

          {/* ── Aktueller Kontext ─────────────────────────────────── */}
          {(r?.newsContext || (r?.usedSignals && r.usedSignals.length > 0)) && (
            <CollapsibleSection title={`${tl("detail.liveSignalsContext")}${r?.usedSignals?.length ? ` (${r.usedSignals.length})` : ""}`} accent="#2563EB">
              {r?.newsContext && (
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--color-text-secondary)", margin: "0 0 12px", padding: "8px 12px", background: "#EFF6FF", borderRadius: 7 }}>
                  {r.newsContext}
                </p>
              )}
              {r?.usedSignals && r.usedSignals.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {r.usedSignals.slice(0, 10).map((s, i) => {
                    // Age badge: green < 24h, yellow < 72h, red > 72h
                    const signalDate = s.date ? new Date(s.date) : null;
                    const hoursAgo = signalDate ? (Date.now() - signalDate.getTime()) / 3600000 : null;
                    const ageBg = hoursAgo == null ? "#9CA3AF" : hoursAgo < 24 ? "#1A9E5A" : hoursAgo < 72 ? "#F5A623" : "#E8402A";
                    const ageLabel = hoursAgo == null ? "?" : hoursAgo < 1 ? "<1h" : hoursAgo < 24 ? `${Math.round(hoursAgo)}h` : `${Math.round(hoursAgo / 24)}d`;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                        background: "var(--color-page-bg)", borderRadius: 7,
                        border: "1px solid var(--color-border)", transition: "background 0.12s",
                      }}>
                        {/* Age badge */}
                        <Tooltip content={signalDate ? signalDate.toLocaleString("de-DE") : tl("detail.unknown")} placement="top">
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                            background: `${ageBg}18`, color: ageBg, border: `1px solid ${ageBg}33`,
                            flexShrink: 0, letterSpacing: "0.03em",
                          }}>{ageLabel}</span>
                        </Tooltip>
                        {/* Source badge */}
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                          background: "#2563EB10", color: "#2563EB", border: "1px solid #2563EB25",
                          flexShrink: 0, fontFamily: "var(--font-code, monospace)",
                        }}>{s.source}</span>
                        {/* Title (link if URL exists) */}
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ color: "inherit", textDecoration: "none" }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#2563EB"}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"}
                            >{s.title}</a>
                          ) : s.title}
                        </span>
                        {/* Strength indicator */}
                        {s.strength != null && s.strength > 0 && (
                          <span style={{ fontSize: 8, color: "var(--color-text-muted)", flexShrink: 0 }}>
                            {"●".repeat(Math.min(3, Math.ceil(s.strength * 3)))}{"○".repeat(3 - Math.min(3, Math.ceil(s.strength * 3)))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* ── Synthese ──────────────────────────────────────────── */}
          {(qNode.synthesis || isLoading) && (
            <CollapsibleSection title={tl("detail.synthesisHeading")}>
              {r?.confidence != null && r.confidence > 0 && (
                <div style={{ marginBottom: 8 }}><ConfidenceBadge value={r.confidence} /></div>
              )}
              <div style={{ marginBottom: 4 }}>
                <FormattedText text={qNode.synthesis ?? ""} fontSize={14} lineHeight={1.78} color="var(--color-text-primary)" />
                {qNode.status === "streaming" && (
                  <span style={{ display: "inline-block", width: 2, height: "0.9em", background: "#0A0A0A", marginLeft: 2, animation: "cur-blink 0.8s steps(1) infinite", verticalAlign: "text-bottom" }} />
                )}
                {qNode.status === "loading" && <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{tl("detail.analyzing")}</span>}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Radar ─────────────────────────────────────────────── */}
          {r?.matchedTrends && r.matchedTrends.length > 0 && (
            <CollapsibleSection title={tl("detail.radarHeading")} defaultOpen={false}>
              <RadarChart trends={r.matchedTrends} de={de} />
              {/* Category distribution */}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Object.entries(
                  r.matchedTrends.reduce<Record<string, number>>((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + 1; return acc; }, {})
                ).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
                  <span key={cat} style={{ fontSize: 9, padding: "1px 8px", borderRadius: 20, background: "var(--color-page-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                    {cat} ×{cnt}
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Kohärenzen ────────────────────────────────────────── */}
          {coherences.length > 0 && (
            <CollapsibleSection title={tl("detail.coherences")} accent="#8B5CF6" defaultOpen={false}>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                {tl("detail.coherencesBody")}
              </p>
              {coherences.map(c => (
                <div key={c.nodeId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#F5F3FF", borderRadius: 7, border: "1px solid #E5E0FF" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#8B5CF6", background: "#EDE9FE", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>{c.overlap}</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.query}</span>
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Kausalnetz ────────────────────────────────────────── */}
          {r?.matchedEdges && r.matchedEdges.length > 0 && (
            <CollapsibleSection title={tl("detail.causalNetworkHeading")} accent="#1A9E5A" defaultOpen={false}>
              <CausalEdgeList edges={r.matchedEdges} trendNames={trendNames} de={de} />
              {r?.causalAnalysis && r.causalAnalysis.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {r.causalAnalysis.map((chain, i) => (
                    <div key={i} style={{ marginBottom: 5, paddingLeft: 8 }}>
                      <FormattedText text={chain} fontSize={12} lineHeight={1.55} />
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* ── Kernerkenntnisse ──────────────────────────────────── */}
          {r?.keyInsights && r.keyInsights.length > 0 && (
            <CollapsibleSection title={tl("detail.keyInsightsHeading")}>
              {r.keyInsights.map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#0F6038", marginTop: 3 }}>◉</span>
                  <FormattedText text={ins} fontSize={13} lineHeight={1.6} />
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Szenarien ─────────────────────────────────────────── */}
          {r?.scenarios && r.scenarios.length > 0 && (
            <CollapsibleSection title={tl("detail.scenariosHeading")}>
              {r.scenarios.map((s, i) => {
                const sc = SCEN[s.type ?? "baseline"] ?? SCEN.baseline;
                return (
                  <div key={i} style={{ marginBottom: 8, padding: "10px 12px", background: sc.bg, borderRadius: 8, border: `1px solid ${sc.color}30` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sc.color, letterSpacing: "0.05em" }}>{de ? sc.label.toUpperCase() : sc.labelEn.toUpperCase()}</span>
                      {s.timeframe && <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{s.timeframe}</span>}
                      {s.probability != null && <span style={{ fontSize: 12, fontWeight: 700, color: sc.color, marginLeft: "auto" }}>{Math.round(Math.max(0, Math.min(1, s.probability)) * 100)}%</span>}
                    </div>
                    {/* Probability bar */}
                    {s.probability != null && (
                      <div style={{ height: 2, background: "rgba(255,255,255,0.5)", borderRadius: 1, marginBottom: 6 }}>
                        {/* FIXED: EDGE-15 — Clamp probability to [0,1] */}
                        <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, s.probability)) * 100}%`, background: sc.color, borderRadius: 1 }} />
                      </div>
                    )}
                    {s.name && <div style={{ fontSize: 12, fontWeight: 600, color: sc.color, marginBottom: 4 }}>{s.name}</div>}
                    <FormattedText text={s.description} fontSize={12} lineHeight={1.55} />
                    {s.keyDrivers && s.keyDrivers.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.keyDrivers.map((d, j) => (
                          <span key={j} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "rgba(255,255,255,0.6)", border: `1px solid ${sc.border}`, color: sc.color }}>{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CollapsibleSection>
          )}

          {/* ── Demographics ──────────────────────────────────────── */}
          {demographicTrends.length > 0 && (
            <CollapsibleSection title={tl("detail.demoContextHeading")} accent="#0369A1" defaultOpen={false}>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                {tl("detail.demoContextBody")}
              </p>
              {demographicTrends.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#F0F9FF", borderRadius: 7, border: "1px solid #BAE6FD" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)" }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>{t.category} · {t.velocity === "rising" ? "↑" : t.velocity === "falling" ? "↓" : "→"} {t.ring}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <div style={{ width: 48, height: 3, background: "var(--color-border)", borderRadius: 1, overflow: "hidden" }}>
                      {/* FIXED: EDGE-15 — Clamp relevance to [0,1] */}
                      <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, t.relevance)) * 100}%`, background: "#0369A1", borderRadius: 1 }} />
                    </div>
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{Math.round(Math.max(0, Math.min(1, t.relevance)) * 100)}% {tl("detail.relShort")}</span>
                  </div>
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Strategische Interpretation ───────────────────────── */}
          {r?.interpretation && (
            <CollapsibleSection title={tl("detail.strategicInterpretation")} accent="#0A3A20">
              <div style={{ padding: "10px 14px", background: "#F4FBF7", borderRadius: 8 }}>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-secondary)", margin: 0 }}>{r.interpretation}</p>
              </div>
            </CollapsibleSection>
          )}

          {/* ── Entscheidungshilfe ────────────────────────────────── */}
          {r?.decisionFramework && (
            <CollapsibleSection title={tl("detail.decisionFramework")} accent="#1D4ED8">
              <div style={{ padding: "10px 14px", background: "#EFF6FF", borderRadius: 8 }}>
                {r.decisionFramework.replace(/\.\s+(?=\d+\.)/g, ".\n").split("\n").filter(Boolean).map((step, i, arr) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < arr.length - 1 ? 8 : 0 }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", background: "#2563EB", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                    <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--color-text-secondary)", margin: 0 }}>{step.replace(/^\d+\.\s*/, "")}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Regulierung ───────────────────────────────────────── */}
          {r?.regulatoryContext && r.regulatoryContext.length > 0 && (
            <CollapsibleSection title={tl("detail.regulatoryContext")} defaultOpen={false}>
              {r.regulatoryContext.map((reg, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.55, color: "var(--color-text-secondary)", marginBottom: 5, paddingLeft: 8 }}>{reg}</div>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Folgefragen ───────────────────────────────────────── */}
          {r?.followUpQuestions && r.followUpQuestions.length > 0 && (
            <CollapsibleSection title={tl("detail.followUpHeading")} defaultOpen={false}>
              {r.followUpQuestions.map((q, i) => (
                <button key={i} onClick={() => onFollowUp(node.id, q)}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4, fontSize: 12, fontStyle: "italic", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", lineHeight: 1.4, transition: "all 0.1s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--color-page-bg)"; el.style.borderColor = "rgba(0,0,0,0.2)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.borderColor = "var(--color-border)"; }}
                >→ {q}</button>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Quellen ───────────────────────────────────────────── */}
          {r?.references && r.references.length > 0 && (
            <CollapsibleSection title={tl("detail.referencesHeading")} defaultOpen={false}>
              {r.references.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-brand)", textDecoration: "none", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = "underline"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = "none"}
                ><ExternalLink size={11} style={{ flexShrink: 0 }} /> {ref.title}</a>
              ))}
            </CollapsibleSection>
          )}

          {/* Tags used to live here as a CollapsibleSection, but the
               DetailPanel frame below (between body and footer) renders
               an always-visible Tags pill row with quick-add input —
               the two widgets duplicated each other and the user
               reported it as visually redundant. Single source of
               truth is now the inline bar; this block is intentionally
               left as a comment so the history is clear. */}

          {/* ── System-Prompt (read-only) ─────────────────────────── */}
          <CollapsibleSection title={tl("detail.analysisParameters")} accent="#6B7280" defaultOpen={false}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Query</span>
                <span style={{ flex: 1 }}>{qNode.query}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Locale</span>
                <span>{qNode.locale === "de" ? "Deutsch" : "English"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Modell</span>
                <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 11 }}>Claude (Anthropic)</span>
              </div>
              {r?.matchedTrends && (
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Trends</span>
                  <span>{r.matchedTrends.length} {tl("detail.matched")}</span>
                </div>
              )}
              {r?.usedSignals && (
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Signale</span>
                  <span>{r.usedSignals.length} {tl("detail.processed")}</span>
                </div>
              )}
              {r?.confidence != null && (
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Konfidenz</span>
                  <span>{Math.round(r.confidence * 100)}%</span>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Timestamp */}
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>
            {formatNodeTime(qNode.createdAt)}
            {age !== "fresh" && <span style={{ marginLeft: 8, color: age === "stale" ? "#F5A623" : "rgba(245,166,35,0.6)" }}>{age === "stale" ? tl("detail.staleMark") : tl("detail.agingMark")}</span>}
          </div>
        </div>
      );
    }

    if (node.nodeType === "note") return (
      <div style={{ padding: "8px 40px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
        <textarea
          value={noteDraft}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder={tl("detail.notePlaceholder")}
          style={{ flex: 1, minHeight: 200, background: "var(--pastel-butter)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, padding: "12px 14px", fontSize: 14, lineHeight: 1.65, color: "#3E2723", fontFamily: "inherit", resize: "none", outline: "none" }}
        />
        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 8 }}>{formatNodeTime(node.createdAt)}</div>
      </div>
    );

    if (node.nodeType === "idea") return (
      <div style={{ padding: "8px 40px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
        <textarea
          value={ideaContent}
          onChange={e => handleIdeaContentChange(e.target.value)}
          placeholder={tl("detail.descriptionPlaceholder")}
          style={{ flex: 1, minHeight: 200, background: "var(--pastel-peach)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, padding: "12px 14px", fontSize: 14, lineHeight: 1.65, color: "#0A0A0A", fontFamily: "inherit", resize: "none", outline: "none" }}
        />
        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 8 }}>{formatNodeTime(node.createdAt)}</div>
      </div>
    );

    if (node.nodeType === "list") return (
      <div style={{ padding: "8px 40px 28px", flex: 1, overflowY: "auto" }}>
        {listItems.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
            <span style={{ color: "#2E7D32", fontSize: 12, marginTop: 4, flexShrink: 0 }}>•</span>
            {editingListIdx === i ? (
              <input
                ref={el => { listItemRefs.current[i] = el; }}
                value={listDraftItem}
                onChange={e => setListDraftItem(e.target.value)}
                onBlur={() => commitListItem(i, listDraftItem)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); commitListItem(i, listDraftItem); addListItem(); }
                  if (e.key === "Escape") setEditingListIdx(null);
                }}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit", lineHeight: 1.5 }}
              />
            ) : (
              <span
                onClick={() => { setEditingListIdx(i); setListDraftItem(item); setTimeout(() => listItemRefs.current[i]?.focus(), 0); }}
                style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: item ? "#0A0A0A" : "rgba(0,0,0,0.3)", cursor: "text", minHeight: 22 }}
              >{item || tl("detail.listItemPlaceholder")}</span>
            )}
            {listItems.length > 1 && (
              <button onClick={() => removeListItem(i)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 3px", color: "rgba(0,0,0,0.2)", fontSize: 11, borderRadius: 3, lineHeight: 1, marginTop: 4 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#E8402A"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.2)"}
              >✕</button>
            )}
          </div>
        ))}
        <button onClick={addListItem}
          style={{ marginTop: 6, fontSize: 12, color: "#2E7D32", background: "none", border: "none", cursor: "pointer", padding: "2px 0", display: "flex", alignItems: "center", gap: 4, opacity: 0.7 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
        >+ {tl("detail.listItemAdd")}</button>
        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 12 }}>{formatNodeTime(node.createdAt)}</div>
      </div>
    );

    if (node.nodeType === "file") {
      const fNode = node as FileNode;
      const isImage = fNode.fileType.startsWith("image/");
      return (
        <div style={{ padding: "8px 40px 28px", flex: 1, overflowY: "auto" }}>
          {isImage && fNode.fileUrl && (
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fNode.fileUrl} alt={fNode.fileName} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, objectFit: "contain" }} />
            </div>
          )}
          {!isImage && fNode.textContent && (
            <div style={{ padding: "12px 14px", background: "#F8F9FC", borderRadius: 8, border: "1px solid var(--color-border)", marginBottom: 12 }}>
              <pre style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(0,0,0,0.65)", margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", overflowWrap: "break-word" }}>
                {fNode.textContent.slice(0, 3000)}{fNode.textContent.length > 3000 && "\n…"}
              </pre>
            </div>
          )}
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{formatNodeTime(fNode.createdAt)}</div>
        </div>
      );
    }

    // Dimensions body
    const dNodeCheck = node as DerivedNode;
    if (dNodeCheck.nodeType === "dimensions") {
      const dimData = dNodeCheck.dimensionData ?? [];
      return (
        <DimensionsDetailBody dimData={dimData} createdAt={dNodeCheck.createdAt ? String(dNodeCheck.createdAt) : undefined} />
      );
    }

    // Causal graph body
    if (dNodeCheck.nodeType === "causalgraph") {
      const edges = dNodeCheck.causalEdges ?? [];
      const trendNames = new Map(Object.entries(dNodeCheck.causalTrendNames ?? {}));
      const nameMapObj = dNodeCheck.causalTrendNames ?? {};
      return (
        <div style={{ padding: "8px 40px 28px", flex: 1, overflowY: "auto" }}>
          {edges.length > 0 && (
            <div style={{ marginBottom: 20, padding: "12px 0" }}>
              <GraphLightbox title={tl("detail.causalFullscreenTitle")} style={{ borderRadius: 8, overflow: "hidden" }}>
                <CausalGraphSVG edges={edges} nameMap={nameMapObj} width={760} height={380} />
              </GraphLightbox>
            </div>
          )}
          <CausalEdgeList edges={edges} trendNames={trendNames} de={de} />
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 12 }}>{formatNodeTime(dNodeCheck.createdAt)}</div>
        </div>
      );
    }

    // Derived node body
    const dNode = node as DerivedNode;
    const type = dNode.nodeType;
    const isScenario = type === "scenario";
    const scenCfg = isScenario && dNode.colorKey ? SCEN[dNode.colorKey] ?? SCEN.baseline : null;
    return (
      <div style={{ padding: "8px 40px 28px", flex: 1, overflowY: "auto" }}>
        {isScenario && siblingScenarios && siblingScenarios.length > 1 && (
          <ScenarioComparisonChart scenarios={siblingScenarios} currentId={dNode.id} de={de} />
        )}
        {isScenario && dNode.probability != null && !siblingScenarios?.length && scenCfg && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: 5 }}>
              <div style={{ height: 4, width: `${dNode.probability * 100}%`, borderRadius: 2, background: scenCfg?.color ?? "#1D4ED8" }} />
            </div>
            <span style={{ fontSize: 11, color: scenCfg?.color ?? "#1D4ED8", fontWeight: 600 }}>{Math.round(dNode.probability * 100)}% {tl("detail.probabilityShort")}</span>
          </div>
        )}
        <div style={{ marginBottom: 14, fontStyle: type === "followup" ? "italic" : "normal" }}>
          <FormattedText text={type === "followup" ? `→ ${dNode.content}` : dNode.content} fontSize={14} lineHeight={1.78} color={isScenario ? (scenCfg?.color ?? "var(--color-text-secondary)") : "var(--color-text-secondary)"} />
        </div>
        {dNode.sources && dNode.sources.length > 0 && (
          <div style={{ marginBottom: 12 }}><SourceChips sources={dNode.sources} de={de} /></div>
        )}
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{formatNodeTime(dNode.createdAt)}</div>
      </div>
    );
  };

  // ── Status selector ──────────────────────────────────────────────────────
  const statusTips: Record<NodeStatus, { de: string; en: string }> = {
    open: { de: "Noch nicht bearbeitet", en: "Not yet processed" },
    active: { de: "Wird aktuell bearbeitet oder verfolgt", en: "Currently being worked on or tracked" },
    decided: { de: "Analyse abgeschlossen, Entscheidung getroffen", en: "Analysis complete, decision made" },
    pinned: { de: "Wichtig — bleibt sichtbar bei Filterung", en: "Important — stays visible when filtering" },
  };
  const renderStatusSelector = () => {
    const current = (node as QueryNode & { nodeStatus?: NodeStatus }).nodeStatus ?? "open";
    // Resolve meta.color to a concrete color for valid alpha-compositing.
    // "open" uses a CSS variable, which cannot be suffixed with "18" to form a
    // hex-alpha string — so the old `${meta.color}18` produced invalid CSS.
    const tintForStatus: Record<NodeStatus, { bg: string; fg: string; border: string }> = {
      open:    { bg: "rgba(107,107,107,0.08)", fg: "var(--color-text-primary)", border: "rgba(107,107,107,0.35)" },
      active:  { bg: "rgba(37,99,235,0.10)",   fg: "#2563EB",                    border: "rgba(37,99,235,0.45)"  },
      decided: { bg: "rgba(26,158,90,0.10)",   fg: "#1A9E5A",                    border: "rgba(26,158,90,0.45)"  },
      pinned:  { bg: "rgba(245,166,35,0.12)",  fg: "#C97A00",                    border: "rgba(245,166,35,0.55)" },
    };
    return (
      <div
        role="radiogroup"
        aria-label={tl("detail.statusLabel")}
        style={{
          display: "inline-flex",
          margin: "0 40px 10px",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          background: "var(--color-surface, #F7F7F7)",
          overflow: "hidden",
          fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        }}
      >
        {(["open","active","decided","pinned"] as NodeStatus[]).map((s, i) => {
          const meta = NODE_STATUS_META[s];
          const active = current === s;
          const tint = tintForStatus[s];
          return (
            <Tooltip key={s} content={de ? statusTips[s].de : statusTips[s].en} placement="bottom">
              <button
                onClick={() => onSetStatus(node.id, s)}
                role="radio"
                aria-checked={active}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 28, padding: "0 12px",
                  fontSize: 11, fontWeight: active ? 600 : 500, letterSpacing: "0.01em",
                  border: "none",
                  borderLeft: i === 0 ? "none" : "1px solid var(--color-border)",
                  background: active ? tint.bg : "transparent",
                  color: active ? tint.fg : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "background-color 120ms ease, color 120ms ease",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <StatusIcon status={s} size={12} />
                <span>{meta.label}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  // ── Footer ────────────────────────────────────────────────────────────────
  const renderFooter = () => {
    const btnBase: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 20, cursor: "pointer" };
    const btnMuted: React.CSSProperties = { fontSize: 12, padding: "6px 10px", borderRadius: 20, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" };
    const btnDelete: React.CSSProperties = { marginLeft: "auto", ...btnMuted };

    if (node.nodeType === "query") {
      const qNode = node as QueryNode;
      const age = nodeAge(qNode.createdAt);
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Tooltip content={tl("detail.followUpTip")} placement="top">
              <button onClick={() => onFollowUp(node.id)} style={{ ...btnBase, border: "1px solid rgba(0,0,0,0.12)", background: "#E4FF97", color: "#0A0A0A" }}>{tl("detail.followUpCta")}</button>
            </Tooltip>
            {qNode.status === "done" && (
              <Tooltip content={tl("detail.refreshTip")} placement="top">
                <button onClick={() => onRefresh(node.id)}
                  style={{ ...btnBase, display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${age === "stale" ? "rgba(245,166,35,0.4)" : "var(--color-border)"}`, background: "transparent", color: age === "stale" ? "#F5A623" : "var(--color-text-muted)" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(245,166,35,0.1)"; el.style.color = "#F5A623"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = age === "stale" ? "#F5A623" : "var(--color-text-muted)"; }}
                ><RefreshCw size={12} /> {tl("detail.refreshCta")}</button>
              </Tooltip>
            )}
            {qNode.status === "error" && (
              <Tooltip content={tl("detail.retryTip")} placement="top">
                <button onClick={() => onRefresh(node.id)} style={{ ...btnBase, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#E8402A" }}><RotateCcw size={12} /> {tl("detail.retryCta")}</button>
              </Tooltip>
            )}
            {qNode.synthesis && (
              <Tooltip content={tl("detail.copySynthesisTip")} placement="top">
                <button onClick={() => copyText(qNode.synthesis)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              </Tooltip>
            )}
            <Tooltip content={tl("detail.deleteCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }
    if (node.nodeType === "note") {
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Tooltip content={tl("detail.noteToQueryTip")} placement="top">
              <button onClick={() => onPromoteNote(noteDraft)} disabled={!noteDraft.trim()}
                style={{ ...btnBase, border: "1px solid rgba(249,168,37,0.3)", background: "rgba(249,168,37,0.1)", color: "#B45309", opacity: noteDraft.trim() ? 1 : 0.4 }}
              >{tl("detail.asQueryCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.reworkTip")} placement="top">
              <button onClick={() => onIterate(node.id, noteDraft)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 5 }}><RotateCcw size={11} /> {tl("detail.reworkCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.removeCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }
    if (node.nodeType === "idea") {
      const ideaText = [ideaTitle, ideaContent].filter(Boolean).join(" — ");
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Tooltip content={tl("detail.ideaToQueryTip")} placement="top">
              <button onClick={() => onPromoteIdea(ideaText)} disabled={!ideaText.trim()}
                style={{ ...btnBase, border: "1px solid rgba(255,152,0,0.3)", background: "rgba(255,152,0,0.08)", color: "#E65100", opacity: ideaText.trim() ? 1 : 0.4 }}
              >{tl("detail.asQueryCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.reworkTip")} placement="top">
              <button onClick={() => onIterate(node.id, ideaText)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 5 }}><RotateCcw size={11} /> {tl("detail.reworkCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.removeCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }
    if (node.nodeType === "list") {
      const listText = [listTitle, ...listItems.filter(Boolean)].join(" · ");
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Tooltip content={tl("detail.reworkTip")} placement="top">
              <button onClick={() => onIterate(node.id, listText)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 5 }}><RotateCcw size={11} /> {tl("detail.reworkCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.removeCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }
    if (node.nodeType === "file") {
      const fNode = node as FileNode;
      const isImage = fNode.fileType.startsWith("image/");
      const analyzeText = fNode.textContent
        ? `Analysiere diesen Dateiinhalt ("${fNode.fileName}"):\n\n${fNode.textContent.slice(0, 3000)}`
        : `Was kannst du über diese Datei sagen: ${fNode.fileName} (${fNode.fileType})`;
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
            {fNode.fileUrl && (
              <Tooltip content={tl("detail.openFileTip")} placement="top">
                <a href={fNode.fileUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(74,108,247,0.25)", background: "transparent", color: "rgba(74,108,247,0.8)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                ><ExternalLink size={12} /> {tl("detail.openFileCta")}</a>
              </Tooltip>
            )}
            {(fNode.textContent || isImage) && (
              <Tooltip content={tl("detail.analyzeFileTip")} placement="top">
                <button onClick={() => onAnalyzeFile(analyzeText, node.id)}
                  style={{ ...btnBase, border: "1px solid rgba(74,108,247,0.3)", background: "rgba(74,108,247,0.08)", color: "#4A6CF7" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(74,108,247,0.18)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(74,108,247,0.08)"}
                >{tl("detail.analyzeFileCta")}</button>
              </Tooltip>
            )}
            <Tooltip content={tl("detail.removeCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }
    // Derived
    const dNode = node as DerivedNode;
    const type = dNode.nodeType;

    // ── Scenario: 4 action modes ──────────────────────────────────────────
    if (type === "scenario") {
      const scenName = dNode.label || dNode.content.slice(0, 60);
      const firstDriver = dNode.keyDrivers?.[0] ?? scenName;
      const actionButtons = [
        { label: tl("detail.deepenLabel"), icon: <Search size={12} />, tip: tl("detail.deepenTip"), prefill: `Vertiefen: ${scenName} — detaillierte Analyse der Treiber und Implikationen`, color: "#1A9E5A" },
        { label: tl("detail.whatIfLabel"), icon: <GitBranch size={12} />, tip: tl("detail.whatIfTip"),       prefill: `Was wenn: ${firstDriver} wegfällt — wie verändert sich das Szenario?`,       color: "#2563EB" },
        { label: tl("detail.challengeLabel"), icon: <ShieldAlert size={12} />, tip: tl("detail.challengeTip"),             prefill: `Kritisch: Welche Annahmen in '${scenName}' könnten falsch sein?`,             color: "#E8402A" },
        { label: tl("detail.strategyLabel"), icon: <Compass size={12} />, tip: tl("detail.strategyTip"),               prefill: `Spielplan: Gegeben '${scenName}' — konkrete Handlungsoptionen`,               color: "#8B5CF6" },
      ];
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
            {actionButtons.map(({ label, icon, tip, prefill, color }) => (
              <Tooltip key={label} content={tip} placement="top">
                <button
                  onClick={() => onIterate(node.id, prefill)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, cursor: "pointer", border: `1px solid ${color}44`, background: `${color}12`, color, letterSpacing: "0.02em", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}22`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}12`; }}
                >{label} {icon}</button>
              </Tooltip>
            ))}
            <Tooltip content={tl("detail.removeScenarioTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }

    // ── Dimensions: single deepen button ──────────────────────────────────
    if (type === "dimensions") {
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Tooltip content={tl("detail.deepenDimensionsTip")} placement="top">
              <button onClick={() => onIterate(node.id, dNode.queryText)}
                style={{ ...btnBase, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#3b82f6" }}
              >{tl("detail.deepenDimensionsCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.removeCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }

    // ── Causal graph: explore drivers ──────────────────────────────────────
    if (type === "causalgraph") {
      return (
        <>
          {renderStatusSelector()}
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Tooltip content={tl("detail.exploreCausalTip")} placement="top">
              <button onClick={() => onIterate(node.id, dNode.queryText)}
                style={{ ...btnBase, border: "1px solid rgba(26,158,90,0.3)", background: "rgba(26,158,90,0.08)", color: "#1A9E5A" }}
              >{tl("detail.exploreCausalCta")}</button>
            </Tooltip>
            <Tooltip content={tl("detail.removeCardTip")} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{tl("detail.deleteCta")}</button>
            </Tooltip>
          </div>
        </>
      );
    }

    const btnLabel = type === "followup" ? tl("detail.followupBtnLabel")
      : type === "decision" ? tl("detail.decisionBtnLabel")
      : tl("detail.defaultBtnLabel");
    const btnTip = type === "followup" ? tl("detail.followupBtnTip")
      : type === "decision" ? tl("detail.decisionBtnTip")
      : tl("detail.defaultBtnTip");
    return (
      <>
        {renderStatusSelector()}
        <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Tooltip content={btnTip} placement="top">
            <button onClick={() => onExplore(node.id, dNode.queryText)}
              style={{ ...btnBase, border: "1px solid rgba(0,0,0,0.1)", background: "#E4FF97", color: "#0A0A0A" }}
            >{btnLabel}</button>
          </Tooltip>
          <Tooltip content={tl("detail.reworkTip")} placement="top">
            <button onClick={() => onIterate(node.id, dNode.queryText)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 5 }}><RotateCcw size={11} /> {tl("detail.reworkCta")}</button>
          </Tooltip>
          <Tooltip content={tl("detail.removeCardTip")} placement="top">
            <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
            >{tl("detail.deleteCta")}</button>
          </Tooltip>
        </div>
      </>
    );
  };

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={tl("detail.panelAria")}
      style={{
        // Zentriertes Modal 2026-04-21 (User-Feedback: "die Karte, die
        // jetzt rechts angezeigt wird, soll wieder zentriert angezeigt
        // werden. Das gilt für alle Karten in der Canvas Ansicht und
        // ausschließlich für die Canvas Ansicht. Die weiteren Ansichten
        // bearbeiten wir danach.")
        //
        // Der kurzzeitige Side-Drawer-Versuch ist rückgängig gemacht.
        // Canvas-DetailPanel liegt wieder zentriert mit großer Breite
        // über dem Canvas. Andere Views (Orbit) haben ihr eigenes
        // Detail-Panel (OrbitDerivationView rechts) — nicht betroffen.
        position: "fixed",
        left: "50%", top: 72,
        transform: "translateX(-50%)",
        // 1200 px matched die vorherige Breite — gibt Briefing-Content
        // (Synthese-Absätze, Scenarios, Insights) Luft auf typischen
        // Laptop- und Desktop-Viewports; die calc(100vw - 48px)-Clamp
        // hält das Panel auch auf kleinen Screens im Viewport.
        width: "min(1200px, calc(100vw - 48px))",
        maxHeight: "calc(100vh - 96px)",
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 16,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
        zIndex: 910,
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ padding: "18px 32px 14px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{renderHeader()}</div>
        <button onClick={onClose}
          title={tl("detail.closeTip")}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "1px solid var(--color-border, #E8E8E8)", cursor: "pointer", padding: 0, color: "var(--color-text-muted)", borderRadius: 8, background: "var(--color-page-bg, #F5F5F5)", transition: "all 0.15s" }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-border, #E8E8E8)"; el.style.borderColor = "rgba(0,0,0,0.2)"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.background = "var(--color-page-bg, #F5F5F5)"; el.style.borderColor = "var(--color-border, #E8E8E8)"; }}
        ><X className="w-4 h-4" /></button>
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {renderBody()}
      </div>
      {/* Tags */}
      <div style={{ flexShrink: 0, padding: "6px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 2 }}>Tags</span>
        {(node.tags ?? []).map((tag, i) => {
          const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
          return (
            <span key={i} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 10, background: `hsl(${hue}, 55%, 94%)`, border: `1px solid hsl(${hue}, 45%, 80%)`, color: `hsl(${hue}, 55%, 35%)`, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 3 }}>
              {tag}
              <button onClick={() => onUpdateTags(node.id, (node.tags ?? []).filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: `hsl(${hue}, 40%, 55%)`, padding: 0, lineHeight: 1 }}
              >✕</button>
            </span>
          );
        })}
        <input
          placeholder="+ Tag"
          style={{ fontSize: 9, width: 60, border: "none", outline: "none", background: "transparent", color: "var(--color-text-secondary)", padding: "2px 4px" }}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
              const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
              const existing = node.tags ?? [];
              if (!existing.includes(val)) onUpdateTags(node.id, [...existing, val]);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>
      {/* Footer */}
      <div style={{ flexShrink: 0 }}>
        {renderFooter()}
      </div>
    </div>
  );
}

// ── Minimap ────────────────────────────────────────────────────────────────

