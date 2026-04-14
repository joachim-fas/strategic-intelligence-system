"use client";

// TODO: ARC-01 / FE-14 — CANVAS GOD-FILE DECOMPOSITION
// This file is ~7100 lines with 40+ useState hooks, 20+ useEffect, 20 internal components,
// 500+ inline styles, and 200+ hardcoded colors. Every change recompiles the entire file.
// FIX: Split into feature modules:
//   - hooks/useCanvasState.ts (nodes, connections, selection, undo/redo)
//   - hooks/useCanvasStreaming.ts (LLM streaming, abort controllers)
//   - hooks/useCanvasKeyboard.ts (keyboard shortcuts, slash commands)
//   - hooks/useCanvasPersistence.ts (DB save, localStorage, BroadcastChannel)
//   - components/canvas/NodeRenderer.tsx (node cards by type)
//   - components/canvas/CanvasToolbar.tsx (toolbar, view mode switcher)
//   - components/canvas/CanvasModals.tsx (delete confirm, project switcher)
//   - components/canvas/DetailPanel.tsx (right-side detail panel)
//   - components/canvas/MiniMap.tsx (minimap component)
//   - lib/canvas-utils.ts (uid, layout, snap-to-grid)

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { GraphLightbox } from "@/components/ui/GraphLightbox";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TEMPLATES, FRAMEWORKS, type TemplateResult } from "@/lib/canvas-templates";
import { BOARD_COLUMNS, NODE_COLORS, EDGE_STYLE } from "@/lib/colors";
import { AppHeader } from "@/components/AppHeader";
import { WorkflowPanel, type WorkflowState, type WorkflowStep } from "@/components/canvas/WorkflowPanel";
import { OrbitGraphView } from "./OrbitGraphView";
import { OrbitDerivationView, type DerivCanvasNode } from "./OrbitDerivationView";
import { VoltIconBox } from "@/components/verstehen/VoltPrimitives";
import {
  VoltDropdownMenu,
  VoltDropdownMenuTrigger,
  VoltDropdownMenuContent,
  VoltDropdownMenuItem,
  VoltDropdownMenuSeparator,
  VoltDropdownMenuLabel,
} from "@/components/volt/VoltDropdownMenu";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useLocale } from "@/lib/locale-context";
import {
  GitBranch, LayoutGrid, Columns3, Clock, Hexagon,
  TreePine, Tag, Layers, X, Group, MoreHorizontal, Trash2, RefreshCw, MessageSquarePlus, TagIcon, Pin, CheckCircle2, Circle, Zap,
  ArrowDown, ArrowRight, ShieldAlert, Compass, ExternalLink, Copy, Check, Search, RotateCcw,
} from "lucide-react";
import type {
  UsedSignal, Scenario, Reference, MatchedTrend,
  MatchedEdge, DimensionEntry, QueryResult,
} from "@/types";

// ── Node Status ────────────────────────────────────────────────────────────

type NodeStatus = "open" | "active" | "decided" | "pinned";
const NODE_STATUS_META: Record<NodeStatus, { color: string; label: string }> = {
  open:    { color: "var(--color-text-muted)", label: "Offen" },
  active:  { color: "#2563EB", label: "Aktiv" },
  decided: { color: "#1A9E5A", label: "Entschieden" },
  pinned:  { color: "#F5A623", label: "Gepinnt" },
};

function StatusIcon({ status, size = 12 }: { status: NodeStatus; size?: number }) {
  const color = NODE_STATUS_META[status].color;
  const s: React.CSSProperties = { color, flexShrink: 0 };
  switch (status) {
    case "open":    return <Circle size={size} style={s} />;
    case "active":  return <Zap size={size} style={s} />;
    case "decided": return <CheckCircle2 size={size} style={s} />;
    case "pinned":  return <Pin size={size} style={s} />;
  }
}

// ── Layer types ────────────────────────────────────────────────────────────

type CanvasLayer = "analyse" | "karte" | "datei";
const NODE_LAYER: Record<string, CanvasLayer> = {
  query: "analyse", insight: "analyse", scenario: "analyse", decision: "analyse", followup: "analyse",
  dimensions: "analyse", causalgraph: "analyse",
  note: "karte", idea: "karte", list: "karte", file: "datei",
};
const LAYER_LABELS: Record<CanvasLayer, { de: string; color: string }> = {
  analyse: { de: "Analyse", color: "#1A9E5A" },
  karte:   { de: "Karten",  color: "#F97316" },
  datei:   { de: "Dateien", color: "#4A6CF7" },
};

// ── View Mode ──────────────────────────────────────────────────────────────

type ViewMode = "canvas" | "board" | "timeline" | "orbit";
type SortMode = "tree" | "time" | "type" | "status";

// ── Canvas Group ───────────────────────────────────────────────────────────

interface CanvasGroup {
  id: string;
  nodeIds: string[];
  label: string;
  color: string;
  bounds: { x: number; y: number; w: number; h: number };
}

// ── Node types ─────────────────────────────────────────────────────────────

interface QueryNode {
  id: string;
  nodeType: "query";
  x: number;
  y: number;
  query: string;
  locale: string;
  status: "loading" | "streaming" | "done" | "error";
  synthesis: string;
  result: QueryResult | null;
  collapsed: boolean;
  parentId?: string;
  errorMsg?: string;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  streamingPhase?: number; // 0=loading 1=synthesis 2=reasoning 3=scenarios 4=insights 5=done
  nodeStatus?: NodeStatus;
  tags?: string[];
}

type DerivedType = "insight" | "scenario" | "decision" | "followup" | "dimensions" | "causalgraph";

interface DerivedNode {
  id: string;
  nodeType: DerivedType;
  x: number;
  y: number;
  parentId: string;
  content: string;
  label?: string;
  colorKey?: string;
  probability?: number;
  queryText: string;
  sources?: UsedSignal[];   // top signals from parent query
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  nodeStatus?: NodeStatus;
  // Enriched fields (all optional — backwards-compatible)
  keyDrivers?: string[];                       // für Szenario-Karten
  dimensionData?: DimensionEntry[];            // für Dimensions-Karten
  causalEdges?: MatchedEdge[];                 // für Kausalnetz-Karten
  causalTrendNames?: Record<string, string>;   // id→name lookup
  tags?: string[];
}

// ── Additional node types ─────────────────────────────────────────────────

interface NoteNode {
  id: string;
  nodeType: "note";
  x: number;
  y: number;
  content: string;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

interface IdeaNode {
  id: string;
  nodeType: "idea";
  x: number;
  y: number;
  title: string;
  content: string;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

interface ListNode {
  id: string;
  nodeType: "list";
  x: number;
  y: number;
  title: string;
  items: string[];
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

interface FileNode {
  id: string;
  nodeType: "file";
  x: number;
  y: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  textContent?: string;
  loading?: boolean;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

type CanvasNode = QueryNode | DerivedNode | NoteNode | IdeaNode | ListNode | FileNode;

type ConnectionType = "derived" | "builds-on" | "contradicts" | "validates" | "refreshed";

interface Connection {
  from: string;
  to: string;
  derived?: boolean;
  refreshed?: boolean; // temporal chain: re-run of same query
  connectionType?: ConnectionType;
  note?: string;       // optional edge annotation
}

interface CanvasProject {
  id: string;
  name: string;
  hasState: boolean;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const QUERY_NODE_W       = 420;
const QUERY_NODE_H       = QUERY_NODE_W;  // square base
const DERIVED_W          = 300;
const LIST_NODE_W        = 280;
const FILE_NODE_W        = 300;
const FILE_NODE_H        = 300; // default height matches width for square-ish file cards
const DERIVED_COL_GAP_X  = 64;
const DERIVED_COL_GAP    = 32;
const DERIVED_ROW_GAP    = 36;
const DIMENSIONS_CARD_H  = 192;
const CAUSAL_GRAPH_CARD_H = 222;

// ── Time helpers ──────────────────────────────────────────────────────────

function formatNodeTime(ms: number): string {
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function nodeAge(ms: number): "fresh" | "aging" | "stale" {
  const d = Date.now() - ms;
  if (d < 2 * 86400000) return "fresh";  // < 2 days
  if (d < 7 * 86400000) return "aging";  // 2–7 days
  return "stale";                         // > 7 days
}

// ── Height estimation ──────────────────────────────────────────────────────

function estimateCardHeight(
  type: DerivedType, content: string, label?: string, hasSources = false
): number {
  if (type === "dimensions") return DIMENSIONS_CARD_H;
  if (type === "causalgraph") return CAUSAL_GRAPH_CARD_H;
  const CHARS_PER_LINE = 32;
  const LINE_H   = 20;
  // Cards render all content without truncation via FormattedText — no cap on lines
  const contentLines = Math.max(1, Math.ceil(content.length / CHARS_PER_LINE));
  const labelLines   = label ? Math.min(3, Math.ceil(label.length / CHARS_PER_LINE)) : 0;

  const HEADER    = 44;
  const FOOTER    = 44;
  const PAD       = 20;
  const SOURCES   = hasSources ? 26 : 0;
  const TIMESTAMP = 18;
  const BUFFER    = 28;

  let h: number;
  if (type === "scenario") {
    h = HEADER + PAD + 42 + labelLines * LINE_H + contentLines * LINE_H + SOURCES + TIMESTAMP + FOOTER + BUFFER;
  } else if (type === "decision") {
    // Decision cards contain multi-step frameworks — add ~20% extra height vs insight
    h = Math.ceil((HEADER + PAD + contentLines * LINE_H + SOURCES + TIMESTAMP + FOOTER + BUFFER) * 1.2);
  } else {
    h = HEADER + PAD + contentLines * LINE_H + SOURCES + TIMESTAMP + FOOTER + BUFFER;
  }
  // Cards render with minimum height = DERIVED_W; never estimate less than that
  return Math.max(DERIVED_W, h);
}

// ── Universal node dimension helpers (used by layout algorithms) ───────────

function getNodeWidth(n: CanvasNode): number {
  if (n.customWidth) return n.customWidth;
  if (n.nodeType === "query") return QUERY_NODE_W;
  if (n.nodeType === "list") return LIST_NODE_W;
  if (n.nodeType === "note") return 280;
  if (n.nodeType === "idea") return 300;
  if (n.nodeType === "file") return FILE_NODE_W;
  return DERIVED_W;
}

// Content-aware query-card height. Without this all QUERY cards would share
// the 420px square default, which looks uniform/boxy at scale and wastes
// vertical space for queries with short or empty synthesis. We cap at
// QUERY_NODE_H so cards never grow taller than the square base — taller
// than square is unreadable in the canvas.
function estimateQueryHeight(n: QueryNode): number {
  const synthesis = n.synthesis ?? "";
  const HEADER = 44;
  const PAD_Y = 24;
  const EXTRAS = 60;      // fingerprint / signals / tags / fade area
  const CHARS_PER_LINE = 44;
  const LINE_H = 20;
  if (!synthesis) {
    // No synthesis yet — either loading or a placeholder card.
    // Give just enough room for the compact derivation summary block.
    return 180;
  }
  const lines = Math.min(14, Math.ceil(synthesis.length / CHARS_PER_LINE));
  const h = HEADER + PAD_Y + lines * LINE_H + EXTRAS;
  return Math.max(220, Math.min(QUERY_NODE_H, h));
}

function getNodeHeight(n: CanvasNode): number {
  if (n.customHeight) return n.customHeight;
  if (n.nodeType === "query") return estimateQueryHeight(n as QueryNode);
  if (n.nodeType === "dimensions") return DIMENSIONS_CARD_H;
  if (n.nodeType === "causalgraph") return CAUSAL_GRAPH_CARD_H;
  if (n.nodeType === "list") return 200;
  if (n.nodeType === "note") return 160;
  if (n.nodeType === "idea") return 300;
  if (n.nodeType === "file") return FILE_NODE_H;
  // Derived nodes: use content-based estimation
  const dn = n as DerivedNode;
  const hasSrc = (dn.sources?.length ?? 0) > 0;
  return estimateCardHeight(dn.nodeType as DerivedType, dn.content || "", dn.label, hasSrc);
}

const STORAGE_KEY = "sis-canvas-v2";

// FIXED: EDGE-08 — Schema version for canvas state migration
const CANVAS_SCHEMA_VERSION = 1;

// ── Scenario colours ──────────────────────────────────────────────────────

const SCEN: Record<string, { color: string; bg: string; border: string; label: string; labelEn: string }> = {
  optimistic:  { color: "var(--pastel-mint-text)",   bg: "var(--signal-positive-light)", border: "var(--signal-positive-border)", label: "Optimistisch", labelEn: "Optimistic" },
  baseline:    { color: "var(--pastel-blue-text)",   bg: "var(--pastel-blue)",            border: "var(--pastel-blue-border)",     label: "Basisfall",    labelEn: "Baseline"   },
  pessimistic: { color: "var(--signal-negative-text)", bg: "var(--signal-negative-light)", border: "var(--signal-negative-border)", label: "Pessimistisch",labelEn: "Pessimistic" },
  wildcard:    { color: "var(--pastel-butter-text)", bg: "var(--pastel-butter)",           border: "var(--pastel-butter-border)",   label: "Wildcard",     labelEn: "Wildcard"   },
};

// ── Persistence (localStorage) ────────────────────────────────────────────

function saveToStorage(nodes: CanvasNode[], conns: Connection[], pan: { x: number; y: number }, zoom: number) {
  try {
    const saveable = nodes.filter(n =>
      n.nodeType !== "query" || (n.status === "done" || n.status === "error")
    );
    const value = JSON.stringify({ nodes: saveable, conns, pan, zoom, v: 2 });
    localStorage.setItem(STORAGE_KEY, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old data');
      try { localStorage.removeItem('sis-canvas-history'); localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, conns, pan, zoom, v: 2 })); } catch {}
    }
  }
}

function loadFromStorage(): { nodes: CanvasNode[]; conns: Connection[]; pan: { x: number; y: number }; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== 2) return null;
    return { nodes: d.nodes, conns: d.conns ?? [], pan: d.pan, zoom: d.zoom };
  } catch { return null; }
}

// ── Streaming ─────────────────────────────────────────────────────────────

function extractSynthesisDelta(acc: string, sent: number): string {
  const keyIdx = acc.indexOf('"synthesis"');
  if (keyIdx === -1) return "";
  const after = acc.slice(keyIdx + 11);
  const colon = after.indexOf(":");
  if (colon === -1) return "";
  const rest = after.slice(colon + 1).trimStart();
  if (!rest.startsWith('"')) return "";
  let result = "";
  let i = 1;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === "\\") {
      if (i + 1 >= rest.length) break;
      const nx = rest[i + 1];
      if (nx === "u") {
        if (i + 5 >= rest.length) break;
        const hex = rest.slice(i + 2, i + 6);
        result += String.fromCharCode(parseInt(hex, 16));
        i += 6;
      } else {
        result += nx === "n" ? "\n"
               : nx === "t" ? "\t"
               : nx === "r" ? "\r"
               : nx === "b" ? "\b"
               : nx === "f" ? "\f"
               : nx === '"' ? '"'
               : nx === "\\" ? "\\"
               : nx === "/" ? "/"
               : nx;
        i += 2;
      }
    } else if (ch === '"') break;
    else { result += ch; i++; }
  }
  return result.length > sent ? result.slice(sent) : "";
}

function detectStreamingPhase(acc: string): number {
  if (acc.includes('"confidence"')) return 5;
  if (acc.includes('"keyInsights"')) return 4;
  if (acc.includes('"scenarios"')) return 3;
  if (acc.includes('"reasoningChains"')) return 2;
  if (acc.includes('"synthesis"')) return 1;
  return 0;
}

// TODO: EDGE-17 — Add auto-reconnect with exponential backoff on SSE stream failures.
// Show user notification: "Verbindung unterbrochen, reconnecting..."
// Current implementation has no retry logic — if the stream fails, the user must re-submit.
async function streamQuery(
  query: string, locale: string,
  onChunk: (c: string) => void,
  onComplete: (r: QueryResult) => void,
  onError: (m: string) => void,
  onPhase?: (phase: number) => void,
  signal?: AbortSignal,
) {
  try {
    const res = await fetch("/api/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, locale }),
      signal,
    });
    if (!res.ok || !res.body) { onError(`HTTP ${res.status}`); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", acc = "", sent = 0;
    let final: QueryResult | null = null;
    let lastPhase = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json) continue;
        try {
          const evt = JSON.parse(json);
          if (evt.type === "delta" && evt.text) {
            acc += evt.text;
            const delta = extractSynthesisDelta(acc, sent);
            if (delta) { sent += delta.length; onChunk(delta); }
            if (onPhase) {
              const phase = detectStreamingPhase(acc);
              if (phase !== lastPhase) { lastPhase = phase; onPhase(phase); }
            }
          } else if (evt.type === "complete" && evt.result) {
            final = evt.result;
          } else if (evt.type === "error") { onError(evt.error || "Fehler"); return; }
        } catch {}
      }
    }
    if (final) onComplete(final);
    else onError("Keine Antwort erhalten");
  } catch (e) { onError(String(e)); }
}

// ── Layout: derived card cluster ──────────────────────────────────────────
//
//   [MAIN NODE]──► Col A: ERKENNTNISSE (stacked)   │  Col B: SZENARIEN (stacked)  │  Col C: DIMENSIONEN / KAUSALNETZ
//                          EMPFEHLUNG               │                               │
//                  ─────────────────────────────────────────────────────────────────────────
//                  FOLGEFRAGEN  (horizontal row, full width)

// ── buildDimensionData — groups matchedTrends by 4 strategic dimensions ──

const DIMENSION_CONFIG: Array<{
  key: DimensionEntry["key"];
  label: string;
  color: string;
  match: string[];
}> = [
  { key: "technology",           label: "Technologie & Innovation", color: "#3b82f6", match: ["technology", "ai", "digital", "tech", "innovation"] },
  { key: "society",              label: "Gesellschaft & Arbeit",    color: "#f59e0b", match: ["society", "work", "demographics", "education", "health", "labor"] },
  { key: "market_economic",      label: "Wirtschaft & Märkte",      color: "#22c55e", match: ["market", "economic", "business", "finance", "trade", "energy"] },
  { key: "political_environment",label: "Geopolitik & Regulierung", color: "#6366f1", match: ["political", "environment", "regulation", "geopolitics", "governance", "climate"] },
];

function buildDimensionData(matchedTrends: MatchedTrend[]): DimensionEntry[] {
  // Assign each trend to exactly one dimension (first match wins, priority order
  // defined by DIMENSION_CONFIG: technology → society → market_economic → political_environment).
  const buckets = new Map<DimensionEntry["key"], MatchedTrend[]>(
    DIMENSION_CONFIG.map(cfg => [cfg.key, []])
  );
  for (const trend of matchedTrends) {
    const haystack = [trend.category, ...trend.tags].map(s => s.toLowerCase());
    const matched = DIMENSION_CONFIG.find(cfg =>
      cfg.match.some(m => haystack.some(h => h.includes(m)))
    );
    if (matched) buckets.get(matched.key)!.push(trend);
  }
  return DIMENSION_CONFIG.map(cfg => {
    const trends = buckets.get(cfg.key)!;
    const avgConfidence = trends.length > 0
      ? trends.reduce((s, t) => s + t.confidence, 0) / trends.length
      : 0;
    const rising = trends.filter(t => t.velocity === "rising").length;
    const falling = trends.filter(t => t.velocity === "falling").length;
    const direction: DimensionEntry["direction"] = rising > falling ? "up" : falling > rising ? "down" : "neutral";
    return { label: cfg.label, key: cfg.key, trends, avgConfidence, direction, color: cfg.color };
  });
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback with better entropy
  return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function computeDerivedNodes(parentId: string, px: number, py: number, result: QueryResult): DerivedNode[] {
  const derived: DerivedNode[] = [];
  const now = Date.now();
  const topSources = (result.usedSignals ?? []).slice(0, 3);
  const hasSources = topSources.length > 0;

  const colA_X = px + QUERY_NODE_W + DERIVED_COL_GAP_X;
  const colB_X = colA_X + DERIVED_W + DERIVED_COL_GAP;
  const colC_X = colB_X + DERIVED_W + DERIVED_COL_GAP;

  let colA_Y = py;
  let colB_Y = py;

  // ── Col A: Key Insights ───────────────────────────────────────────────────
  (result.keyInsights ?? []).slice(0, 5).forEach(insight => {
    const h = estimateCardHeight("insight", insight, undefined, hasSources);
    derived.push({
      id: uid(), nodeType: "insight",
      x: colA_X, y: colA_Y,
      parentId, content: insight, queryText: insight,
      sources: topSources,
      createdAt: now,
    });
    colA_Y += h + DERIVED_ROW_GAP;
  });

  // ── Col A: Decision Framework ─────────────────────────────────────────────
  if (result.decisionFramework) {
    const sep = derived.some(n => n.nodeType === "insight") ? 10 : 0;
    colA_Y += sep;
    const h = estimateCardHeight("decision", result.decisionFramework, undefined, hasSources);
    derived.push({
      id: uid(), nodeType: "decision",
      x: colA_X, y: colA_Y,
      parentId,
      content: result.decisionFramework,
      queryText: `Wie lässt sich das konkret umsetzen: ${result.decisionFramework.slice(0, 100)}`,
      sources: topSources,
      createdAt: now,
    });
    colA_Y += h + DERIVED_ROW_GAP;
  }

  // ── Col B: Scenarios (stacked) ────────────────────────────────────────────
  (result.scenarios ?? []).slice(0, 4).forEach(s => {
    const h = estimateCardHeight("scenario", s.description, s.name, hasSources);
    derived.push({
      id: uid(), nodeType: "scenario",
      x: colB_X, y: colB_Y,
      parentId,
      content: s.description,
      label: s.name,
      colorKey: s.type ?? "baseline",
      probability: s.probability,
      keyDrivers: s.keyDrivers ?? [],
      queryText: `Analysiere dieses Szenario tiefer: ${s.name} — ${s.description.slice(0, 100)}`,
      sources: topSources,
      createdAt: now,
    });
    colB_Y += h + DERIVED_ROW_GAP;
  });

  // ── Col C: Dimensions + Causal Graph ──────────────────────────────────────
  let colC_Y = py;
  const matchedTrends = result.matchedTrends ?? [];
  const matchedEdges  = result.matchedEdges  ?? [];

  if (matchedTrends.length >= 3) {
    const dimData = buildDimensionData(matchedTrends);
    derived.push({
      id: uid(), nodeType: "dimensions",
      x: colC_X, y: colC_Y,
      parentId, content: "Trend-Dimensionen", label: "DIMENSIONEN",
      queryText: "Vertiefen: Dimensionsanalyse — welche Bereiche sind am stärksten betroffen?",
      dimensionData: dimData,
      createdAt: now,
    });
    colC_Y += DIMENSIONS_CARD_H + DERIVED_ROW_GAP;
  }

  if (matchedEdges.length >= 2) {
    const trendNameMap: Record<string, string> = {};
    matchedTrends.forEach(t => { trendNameMap[t.id] = t.name; });
    derived.push({
      id: uid(), nodeType: "causalgraph",
      x: colC_X, y: colC_Y,
      parentId, content: "Kausalnetz", label: "KAUSALNETZ",
      queryText: "Vertiefen: Kausalnetz — welche Treiber sind am wirkungsmächtigsten?",
      causalEdges: matchedEdges,
      causalTrendNames: trendNameMap,
      createdAt: now,
    });
  }

  // ── Row below both columns: Follow-up questions ──────────────────────────
  const rowY = Math.max(colA_Y, colB_Y) + 20;
  (result.followUpQuestions ?? []).slice(0, 4).forEach((q, i) => {
    derived.push({
      id: uid(), nodeType: "followup",
      x: colA_X + i * (DERIVED_W + DERIVED_COL_GAP),
      y: rowY,
      parentId, content: q, queryText: q,
      createdAt: now,
    });
  });

  return derived;
}

// ── Test Dataset ──────────────────────────────────────────────────────────
//
// Aufruf: Einfach "test" in die Command-Line eingeben.
// Erzeugt einen vollständigen Beispiel-Datensatz mit allen Kartentypen,
// zwei verbundenen Abfrage-Bäumen und annotierten Karten die erklären
// was jeder Kartentyp ist und warum er existiert.
//
function buildTestDataset(): { nodes: CanvasNode[]; conns: Connection[] } {
  const now = Date.now();

  // Feste IDs damit der Datensatz reproduzierbar bleibt
  const Q1 = "test-q1", Q2 = "test-q2";
  const I1 = "test-i1", I2 = "test-i2";
  const DEC1 = "test-dec1";
  const FQ1 = "test-fq1";
  const S_OPT = "test-s-opt", S_BASE = "test-s-base", S_PESS = "test-s-pess", S_WILD = "test-s-wild";
  const I3 = "test-i3", DEC2 = "test-dec2", S2 = "test-s2", FQ2 = "test-fq2";
  const NOTE1 = "test-note1", IDEA1 = "test-idea1", LIST1 = "test-list1";

  // Layout: Q1 oben-links, Q2 darunter (gleiche X-Spalte, vertieft)
  // Derived-Karten rechts davon in zwei Spalten (wie computeDerivedNodes)
  const Q1X = 80,  Q1Y = 80;
  const Q2X = 80,  Q2Y = 700;
  const CAX = Q1X + QUERY_NODE_W + DERIVED_COL_GAP_X; // = 572
  const CBX = CAX + DERIVED_W + DERIVED_COL_GAP;       // = 844

  const nodes: CanvasNode[] = [

    // ══════════════════════════════════════════════════════════════════════
    // ABFRAGE 1 — Haupt-Query
    // Erklärt: Was ist eine Abfrage-Karte? Wie sieht eine fertige Analyse aus?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: Q1, nodeType: "query",
      x: Q1X, y: Q1Y,
      query: "KI-Automatisierung: Wie verändert sich die Arbeitswelt bis 2030?",
      locale: "de", status: "done", collapsed: false,
      synthesis:
        "ABFRAGE-KARTE — Status: ✓ Abgeschlossen. " +
        "Diese Karte ist der Startpunkt einer vollständigen KI-Analyse. " +
        "Der grüne Balken oben zeigt: Analyse fertig. " +
        "Klicken → Detail-Panel öffnet sich rechts. " +
        "'+' Button → Iteration / Folgefrage starten. " +
        "Die Kinder-Karten rechts (Erkenntnisse, Szenarien, Empfehlung, Folgefragen) " +
        "wurden automatisch aus dem Analyse-Ergebnis generiert.",
      result: {
        synthesis:
          "KI wird bis 2030 ca. 30–40% aller Routinetätigkeiten automatisieren. " +
          "Gleichzeitig entstehen neue Berufsfelder rund um KI-Koordination, Ethikprüfung und Mensch-Maschine-Kollaboration. " +
          "Der Nettoeffekt hängt entscheidend von der Geschwindigkeit der Umschulungssysteme ab.",
        confidence: 0.82,
        keyInsights: [
          "30–40% aller Bürotätigkeiten bis 2030 automatisierbar",
          "Neue Berufe: KI-Trainer, Ethik-Prüfer, Human-AI-Koordinatoren",
          "Umschulungsgeschwindigkeit ist der kritische Engpass",
        ],
      },
      createdAt: now - 3_600_000,
    },

    // ══════════════════════════════════════════════════════════════════════
    // ERKENNTNIS-KARTEN (linke Spalte / ColA) — generiert aus Q1
    // Erklärt: Was ist eine Erkenntnis? Wo erscheint sie? Wie nutzt man sie?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: I1, nodeType: "insight",
      x: CAX, y: Q1Y,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      content:
        "ERKENNTNIS-KARTE — Extrahiert eine Kernaussage aus der Analyse. " +
        "Erscheint immer in der linken Spalte direkt rechts neben der Abfrage. " +
        "→ 30–40% aller Bürotätigkeiten (Buchhaltung, Datenerfassung, einfache Texterstellung) " +
        "sind bis 2030 durch LLMs + Robotik ersetzbar. " +
        "Betroffen: mittlere Qualifikationsstufen ohne Spezialisierung.",
      createdAt: now - 3_590_000,
    } as DerivedNode,

    {
      id: I2, nodeType: "insight",
      x: CAX, y: Q1Y + 100,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      content:
        "ERKENNTNIS-KARTE (zweite) — Eine Abfrage erzeugt typisch 2–4 Erkenntnisse, " +
        "die vertikal gestapelt erscheinen. " +
        "→ Gleichzeitig entstehen 12–18M neue Jobs bis 2030 in KI-nahen Bereichen. " +
        "Netto-Jobeffekt in DE: -800K bis +300K je nach Szenario (McKinsey 2024).",
      createdAt: now - 3_589_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // EMPFEHLUNG (linke Spalte, unter Erkenntnissen) — generiert aus Q1
    // Erklärt: Wozu dient eine Empfehlungs-Karte?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: DEC1, nodeType: "decision",
      x: CAX, y: Q1Y + 212,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      content:
        "EMPFEHLUNG-KARTE — Leitet konkrete Handlungsschritte aus der Analyse ab. " +
        "Erscheint nach den Erkenntnissen in der linken Spalte. " +
        "→ Sofortmaßnahmen: (1) Weiterbildungsbudget um 40% erhöhen, " +
        "(2) Interne KI-Champions in allen Abteilungen benennen, " +
        "(3) Pilotprojekt für KI-Assistenz in Sachbearbeitung starten. Zeithorizont: 12 Monate.",
      createdAt: now - 3_588_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // FOLGEFRAGE (linke Spalte, unterste) — generiert aus Q1
    // Erklärt: Wie funktioniert die Folgefrage → neue Abfrage?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: FQ1, nodeType: "followup",
      x: CAX, y: Q1Y + 324,
      parentId: Q1, queryText: "Welche Berufe und Branchen verschwinden bis 2030?",
      content:
        "FOLGEFRAGE-KARTE — KI schlägt die nächste logische Vertiefung vor. " +
        "'+' klicken → neue Abfrage mit diesem Text vorausfüllen. " +
        "→ Welche Berufe und Branchen verschwinden bis 2030? " +
        "(Diese Frage wurde bereits vertieft — siehe Abfrage 2 unten!)",
      createdAt: now - 3_587_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // SZENARIEN (rechte Spalte / ColB) — generiert aus Q1
    // Erklärt: Vier Szenario-Typen mit Farben und Wahrscheinlichkeiten
    // ══════════════════════════════════════════════════════════════════════
    {
      id: S_OPT, nodeType: "scenario", colorKey: "optimistic",
      x: CBX, y: Q1Y,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.25,
      label: "Soft Landing",
      content:
        "OPTIMISTISCH-SZENARIO (25%) — Grün, beste realistische Entwicklung. " +
        "→ Weiterbildungssysteme skalieren rechtzeitig. Neue Jobs entstehen schneller als alte wegfallen. " +
        "Reallöhne steigen durch Produktivitätsgewinne. Europa führt bei KI-Ethikstandards.",
      createdAt: now - 3_586_000,
    } as DerivedNode,

    {
      id: S_BASE, nodeType: "scenario", colorKey: "baseline",
      x: CBX, y: Q1Y + 100,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.45,
      label: "Graduelle Transformation",
      content:
        "BASISFALL-SZENARIO (45%) — Blau, wahrscheinlichstes Outcome. " +
        "→ Langsame, ungleichmäßige Anpassung über 8–12 Jahre. " +
        "Fachkräftemangel in KI-Berufen parallel zu Überangebot in Routinetätigkeiten. " +
        "Staat muss aktiv mit Umschulungsprogrammen moderieren.",
      createdAt: now - 3_585_000,
    } as DerivedNode,

    {
      id: S_PESS, nodeType: "scenario", colorKey: "pessimistic",
      x: CBX, y: Q1Y + 212,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.22,
      label: "Strukturkrise",
      content:
        "PESSIMISTISCH-SZENARIO (22%) — Rot, ungünstigste realistische Entwicklung. " +
        "→ Automatisierungsgeschwindigkeit überholt Anpassungsfähigkeit. " +
        "Strukturelle Arbeitslosigkeit bei 45–60-Jährigen ohne MINT-Hintergrund. " +
        "Soziale Spannungen steigen, politischer Backlash gegen KI.",
      createdAt: now - 3_584_000,
    } as DerivedNode,

    {
      id: S_WILD, nodeType: "scenario", colorKey: "wildcard",
      x: CBX, y: Q1Y + 324,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.08,
      label: "EU-Regulierungsschock",
      content:
        "WILDCARD-SZENARIO (8%) — Gelb, unwahrscheinlich aber wirkungsmächtig. " +
        "→ EU verabschiedet nach KI-Skandal strikte Verbote für KI in Entscheidungsprozessen. " +
        "Temporäre Job-Stabilisierung, aber massiver Wettbewerbsnachteil gegenüber USA und Asien.",
      createdAt: now - 3_583_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // ABFRAGE 2 — Kind-Abfrage (Vertiefung von Q1)
    // Erklärt: Wie sieht eine verknüpfte Folge-Abfrage aus?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: Q2, nodeType: "query",
      x: Q2X, y: Q2Y,
      parentId: Q1,
      query: "Welche Berufe und Branchen verschwinden konkret bis 2030?",
      locale: "de", status: "done", collapsed: false,
      synthesis:
        "ABFRAGE-KARTE (Kind-Abfrage) — Diese Analyse wurde durch die Folgefrage aus Abfrage 1 angestoßen. " +
        "Die gestrichelte Verbindungslinie zeigt die Eltern-Kind-Beziehung. " +
        "Vertiefungen ermöglichen mehrschichtige Analyse (bis zu 5+ Ebenen möglich). " +
        "'+' klicken → weitere Vertiefung starten.",
      result: {
        synthesis:
          "Besonders gefährdet: Sachbearbeitung (70% Automatisierungsgrad), Transport/Logistik (autonome Fahrzeuge), " +
          "Kassierer & Lagerarbeiter (Robotik), Einstiegs-Juristentätigkeiten und Diagnoseassistenz. " +
          "Weniger gefährdet: Sozialberufe, Handwerk, kreative Tätigkeiten.",
        confidence: 0.79,
      },
      createdAt: now - 1_800_000,
    },

    // Q2 Derived nodes
    {
      id: I3, nodeType: "insight",
      x: CAX, y: Q2Y,
      parentId: Q2, queryText: "Berufe und KI 2030",
      content:
        "ERKENNTNIS zu Kind-Abfrage — Jede Abfrage hat eigene Kinder-Karten. " +
        "Erkenntnisse beider Abfragen erscheinen in denselben Spalten, aber bei unterschiedlicher Y-Position. " +
        "→ Top-3 gefährdete Berufsgruppen: Sachbearbeitung (-45%), Logistik (-38%), Finanzdienstleistungen (-31%). " +
        "Wachstum: Pflege (+22%), Handwerk (+14%), KI-Ops (+67%).",
      createdAt: now - 1_790_000,
    } as DerivedNode,

    {
      id: DEC2, nodeType: "decision",
      x: CAX, y: Q2Y + 100,
      parentId: Q2, queryText: "Berufe und KI 2030",
      content:
        "EMPFEHLUNG zu Kind-Abfrage — Jede Analyseebene erzeugt eigene Handlungsempfehlungen. " +
        "Konkreter und spezifischer als die Empfehlung der Eltern-Abfrage. " +
        "→ Sofortprogramm für Sachbearbeiter: 18-monatige Umschulung zu 'KI-Koordinatoren'. " +
        "Priorisierung: 45+ Jahrgang. Fördervolumen: €50M/Jahr.",
      createdAt: now - 1_788_000,
    } as DerivedNode,

    {
      id: S2, nodeType: "scenario", colorKey: "baseline",
      x: CBX, y: Q2Y,
      parentId: Q2, queryText: "Berufe und KI 2030",
      probability: 0.55,
      label: "Sektoraler Umbau",
      content:
        "SZENARIO zu Kind-Abfrage — Auch Vertiefungsabfragen generieren Szenarien in der rechten Spalte. " +
        "→ Sektorialer Jobverlust wird durch Wachstum in Pflege, Handwerk und KI-nahen Berufen ausgeglichen — " +
        "aber mit 5–10 Jahren Verzögerung und signifikanter regionaler Ungleichverteilung.",
      createdAt: now - 1_789_000,
    } as DerivedNode,

    {
      id: FQ2, nodeType: "followup",
      x: CBX, y: Q2Y + 100,
      parentId: Q2, queryText: "Wie kann die Politik KI-Arbeitslosigkeit abfedern?",
      content:
        "FOLGEFRAGE zu Kind-Abfrage — Öffnet eine weitere Analyseebene (Ebene 3). " +
        "'+' klicken um diese Frage als neue Abfrage zu starten. " +
        "→ Wie kann die Politik konkret KI-bedingte Arbeitslosigkeit abfedern? " +
        "(Hier könntest du den Test-Canvas weiter vertiefen!)",
      createdAt: now - 1_787_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // MANUELLE KARTEN — Note, Idea, List
    // Erklärt: Selbst erstellte Karten ohne KI-Analyse
    // ══════════════════════════════════════════════════════════════════════
    {
      id: NOTE1, nodeType: "note",
      x: 80, y: 1060,
      content:
        "NOTIZ-KARTE — Selbst erstellt, kein KI-Output. " +
        "Ideal für eigene Beobachtungen, Quellen und Kontext-Infos. " +
        "Erstellen: '+' auf einer Karte → Notiz wählen. Oder: Leeres Canvas → '+Hinzufügen'. " +
        "Bearbeiten: Karte anklicken → Detail-Panel → Text direkt bearbeiten. " +
        "Löschen: Karte anklicken (Rahmen erscheint) → Backspace → Enter.",
      customWidth: 340, customHeight: 110,
      createdAt: now - 900_000,
    },

    {
      id: IDEA1, nodeType: "idea",
      x: 470, y: 1060,
      title: "Weiterbildungsplattform für KI-Betroffene",
      content:
        "IDEE-KARTE — Für eigene Hypothesen und Konzepte. " +
        "Hat einen Titel (Kurzform, sichtbar beim Zoom-Out) und eine Beschreibung. " +
        "'+' klicken → Idee als Basis für KI-Analyse verwenden. " +
        "→ Staatliche Plattform die KI-gefährdete Berufsgruppen mit Umschulungsangeboten vernetzt. " +
        "Geschätztes Potenzial: 800K Betroffene bis 2027.",
      customWidth: 300, customHeight: 130,
      createdAt: now - 890_000,
    },

    {
      id: LIST1, nodeType: "list",
      x: 820, y: 1060,
      title: "Alle Canvas-Kartentypen",
      items: [
        "⌕ Abfrage — KI-Vollanalyse (blauer Rand = aktiv)",
        "◉ Erkenntnis — Kernaussage (linke Spalte, Grün)",
        "◆ Empfehlung — Handlungsrahmen (linke Spalte, Mint)",
        "◈ Szenario — Opt. / Basis / Pess. / Wildcard (rechts)",
        "◎ Folgefrage — Nächste Ebene (gestrichelt, rechts)",
        "✎ Notiz — Eigener Freitext (Butter-Gelb)",
        "◇ Idee — Hypothese oder These (Peach-Orange)",
        "≡ Liste — Strukturierte Aufzählung (Mint-Grün)",
        "📎 Datei — Dokument hochladen & analysieren (Blau)",
      ],
      customWidth: 320, customHeight: 210,
      createdAt: now - 880_000,
    },
  ];

  const conns: Connection[] = [
    // Q1 → alle abgeleiteten Karten
    { from: Q1, to: I1,    derived: true },
    { from: Q1, to: I2,    derived: true },
    { from: Q1, to: DEC1,  derived: true },
    { from: Q1, to: FQ1,   derived: true },
    { from: Q1, to: S_OPT, derived: true },
    { from: Q1, to: S_BASE,derived: true },
    { from: Q1, to: S_PESS,derived: true },
    { from: Q1, to: S_WILD,derived: true },
    // Q1 → Q2 (Vertiefungskette)
    { from: Q1, to: Q2,    derived: false },
    // Q2 → abgeleitete Karten
    { from: Q2, to: I3,    derived: true },
    { from: Q2, to: DEC2,  derived: true },
    { from: Q2, to: S2,    derived: true },
    { from: Q2, to: FQ2,   derived: true },
    // Manuelle Karten mit Q2 verknüpft
    { from: Q2, to: NOTE1, derived: true },
    { from: Q2, to: IDEA1, derived: true },
  ];

  return { nodes, conns };
}

// ── Demo Project (Onboarding) ──────────────────────────────────────────────

function buildDemoProject(): { nodes: CanvasNode[]; conns: Connection[] } {
  const now = Date.now();
  // IDs
  const W = "demo-welcome", B = "demo-bedienung", T = "demo-tipps";
  const Q = "demo-query";
  const I1 = "demo-insight-1", I2 = "demo-insight-2";
  const SC1 = "demo-sc-opt", SC2 = "demo-sc-base", SC3 = "demo-sc-pess";
  const DEC = "demo-decision", FQ = "demo-followup";
  const DIM = "demo-dimensions", CG = "demo-causalgraph";

  // Layout constants
  const NX = 60;     // Notes column X
  const QX = 480;    // Query column X
  const DX = 1020;   // Derived column X
  const D2X = 1350;  // Second derived column (scenarios)
  const D3X = 1020;  // Third column (analysis cards)

  // Demo signals for sparkline
  const demoSignals: UsedSignal[] = [
    { source: "hackernews", title: "GPT-5 training costs exceed $1B — scaling laws plateau", date: new Date(now - 6 * 3600000).toISOString(), strength: 0.9 },
    { source: "arxiv", title: "EU AI Act compliance costs for SMEs: first empirical study", date: new Date(now - 18 * 3600000).toISOString(), strength: 0.7 },
    { source: "news", title: "Volkswagen nutzt KI-Copiloten in der Produktion — 2000 Stellen umgeschichtet", date: new Date(now - 30 * 3600000).toISOString(), strength: 0.8 },
    { source: "reddit", title: "r/cscareerquestions: Junior dev jobs disappearing in EU?", date: new Date(now - 48 * 3600000).toISOString(), strength: 0.5 },
    { source: "github", title: "Trending: open-source AI governance toolkit for EU compliance", date: new Date(now - 60 * 3600000).toISOString(), strength: 0.6 },
  ];

  // Demo causal edges for CausalGraph + Orbit
  const causalEdges: MatchedEdge[] = [
    { from: "mega-ai", to: "mega-future-of-work", type: "drives", strength: 0.95, description: "KI-Automatisierung verändert Jobprofile und Qualifikationsanforderungen" },
    { from: "mega-ai", to: "mega-digital-transformation", type: "amplifies", strength: 0.88, description: "KI beschleunigt digitale Transformation in allen Sektoren" },
    { from: "mega-geopolitics", to: "mega-ai", type: "dampens", strength: 0.65, description: "Tech-Exportkontrollen bremsen KI-Fortschritt" },
    { from: "mega-future-of-work", to: "mega-demographics", type: "correlates", strength: 0.55, description: "Arbeitsmarktveränderungen verstärken demografische Trends" },
    { from: "mega-digital-transformation", to: "mega-cybersecurity", type: "drives", strength: 0.78, description: "Mehr Digitalisierung erhöht Angriffsfläche" },
    { from: "mega-regulation", to: "mega-ai", type: "dampens", strength: 0.72, description: "EU AI Act verlangsamt Innovation, erhöht aber Vertrauen" },
  ];
  const causalTrendNames: Record<string, string> = {
    "mega-ai": "Künstliche Intelligenz",
    "mega-future-of-work": "Zukunft der Arbeit",
    "mega-digital-transformation": "Digitale Transformation",
    "mega-geopolitics": "Geopolitik & Konflikte",
    "mega-demographics": "Demografie & Alterung",
    "mega-cybersecurity": "Cybersicherheit",
    "mega-regulation": "Regulierung & Governance",
  };

  // Demo dimension data
  const dimData: DimensionEntry[] = [
    { label: "Technologie & Innovation", key: "technology", trends: [], avgConfidence: 0.82, direction: "up", color: "#3b82f6" },
    { label: "Gesellschaft & Arbeit", key: "society", trends: [], avgConfidence: 0.61, direction: "down", color: "#f59e0b" },
    { label: "Wirtschaft & Märkte", key: "market_economic", trends: [], avgConfidence: 0.54, direction: "neutral", color: "#22c55e" },
    { label: "Geopolitik & Regulierung", key: "political_environment", trends: [], avgConfidence: 0.73, direction: "up", color: "#6366f1" },
  ];

  const nodes: CanvasNode[] = [
    // ── Erklärungs-Notizen (links) ──
    {
      id: W, nodeType: "note", x: NX, y: 60, createdAt: now,
      customWidth: 320, customHeight: 260,
      content:
        "WILLKOMMEN IM SIS CANVAS\n\n" +
        "Das Strategic Intelligence System analysiert Trends, Signale und Zusammenhänge — und verwandelt sie in strategische Erkenntnisse.\n\n" +
        "DIESER CANVAS ZEIGT DIR, WIE ALLES FUNKTIONIERT:\n\n" +
        "→ Klicke auf eine Karte um Details zu sehen\n" +
        "→ Ziehe am rechten Punkt um Verbindungen zu erstellen\n" +
        "→ Nutze die Toolbar oben für Views, Export und mehr\n" +
        "→ Tippe in die Command-Line unten um Analysen zu starten",
      tags: ["onboarding", "start"],
    } as NoteNode,
    {
      id: B, nodeType: "note", x: NX, y: 360, createdAt: now,
      customWidth: 320, customHeight: 280,
      content:
        "CANVAS-BEDIENUNG\n\n" +
        "KARTEN BEWEGEN: Header anfassen und ziehen\n" +
        "VERBINDEN: Am rechten Port ziehen → zu einer anderen Karte\n" +
        "ZOOM: Mausrad oder Toolbar (⊙ = Reset)\n" +
        "VIEWS: Canvas | Board | Zeitlinie | Orbit\n" +
        "LÖSCHEN: Karte auswählen → Delete → Enter\n" +
        "TAGS: Karte anklicken → unten Tags eingeben → Enter\n" +
        "EXPORT: ⬇ .md oder ⬇ .json in der Toolbar\n" +
        "VOLLBILD: ⤢ Icon auf Grafiken klicken → Lightbox",
      tags: ["onboarding"],
    } as NoteNode,
    {
      id: T, nodeType: "note", x: NX, y: 680, createdAt: now,
      customWidth: 320, customHeight: 240,
      content:
        "FUNKTIONEN ENTDECKEN\n\n" +
        "⬡ ORBIT: Alle Trends als Kausal-Netzwerk\n" +
        "📄 BRIEFING: Strategisches Memo generieren\n" +
        "🔍 TOOLTIPS: Maus über jeden Button halten\n" +
        "PROJEKTE: Dropdown oben → Neues Projekt\n" +
        "VERBINDUNGEN: Grün = bestätigt, Rot = Widerspruch\n" +
        "SPARKLINE: Mini-Zeitreihe der Signale auf Query-Karten",
      tags: ["onboarding"],
    } as NoteNode,

    // ── Beispiel-Query (Mitte) ──
    {
      id: Q, nodeType: "query", x: QX, y: 80, createdAt: now,
      query: "Wie verändert KI die Arbeitswelt in Europa bis 2030?",
      locale: "de",
      status: "done",
      synthesis:
        "Künstliche Intelligenz transformiert die europäische Arbeitswelt tiefgreifend: Bis 2030 werden laut McKinsey 30% aller Arbeitsstunden in der EU automatisierbar sein. " +
        "Der Effekt ist asymmetrisch — administrative und analytische Berufe sind stärker betroffen als handwerkliche. " +
        "Gleichzeitig entstehen neue Berufsfelder in KI-Governance, Prompt Engineering und Human-AI-Collaboration. " +
        "Die EU AI Act setzt einen globalen Regulierungsstandard, der sowohl Innovation bremst als auch Vertrauen schafft.",
      result: {
        synthesis: "KI transformiert die EU-Arbeitswelt: 30% Automatisierungspotenzial bis 2030, asymmetrisch nach Qualifikation.",
        keyInsights: [
          "30% der EU-Arbeitsstunden automatisierbar — Augmentation vor Substitution",
          "EU AI Act schafft Dreiklassen-Markt für KI-Anwendungen",
        ],
        scenarios: [
          { type: "optimistic", name: "KI-Augmentations-Boom", description: "Co-Pilot-Modelle steigern Produktivität um 40%+", probability: 0.25, keyDrivers: ["Weiterbildungsinvestition", "AI Act Klarheit"] },
          { type: "baseline", name: "Duale Arbeitswelt 2030", description: "Hochqualifizierte KI-Wissensarbeiter neben wachsendem Care-Sektor", probability: 0.45, keyDrivers: ["AI Act Regulierung", "Fachkräftemangel", "Remote-Work"] },
          { type: "pessimistic", name: "Verdrängungskrise", description: "Schnelle Automatisierung ohne ausreichende Umschulung", probability: 0.22, keyDrivers: ["Kostendruck", "Mangelnde Regulierung"] },
        ],
        decisionFramework: "1. KI-Kompetenzoffensive starten. 2. Human-AI-Collaboration pilotieren. 3. EU AI Act Compliance sicherstellen. 4. Change-Management aufsetzen.",
        followUpQuestions: ["Welche Branchen profitieren am stärksten?", "Wie wirkt sich der AI Act auf Startups aus?", "Welche Umschulungsprogramme funktionieren?"],
        confidence: 0.72,
        usedSignals: demoSignals,
        matchedTrends: [],
        matchedEdges: causalEdges,
        reasoningChains: ["KI-Automatisierung → Jobverlagerung → Qualifikationslücke → Weiterbildungsbedarf"],
        causalChain: ["Hohe Automatisierbarkeit → Produktivitätsgewinne → Arbeitskräfteverschiebung → Sozialpolitischer Anpassungsbedarf"],
        regulatoryContext: ["EU AI Act (2026)", "DSGVO-Erweiterung für KI-Entscheidungen"],
        newsContext: "Aktuelle Signale zeigen beschleunigte KI-Adoption in der EU bei gleichzeitig steigenden Compliance-Anforderungen.",
      } as unknown as QueryResult,
      collapsed: false,
      customWidth: 440,
    } as QueryNode,

    // ── Insights (rechts oben) ──
    { id: I1, nodeType: "insight", x: DX, y: 80, parentId: Q, createdAt: now, content: "30% der EU-Arbeitsstunden sind bis 2030 automatisierbar — aber Augmentation dominiert vor Substitution. KI-Co-Piloten steigern Produktivität um 40% (BCG 2025).", queryText: "Automatisierungspotenzial", sources: demoSignals.slice(0, 2), tags: ["ki-arbeit"] } as DerivedNode,
    { id: I2, nodeType: "insight", x: DX, y: 260, parentId: Q, createdAt: now, content: "Der EU AI Act schafft einen Dreiklassen-Markt: Hochrisiko-KI mit Zertifizierung, General-Purpose AI mit Transparenz, Low-Risk ohne Auflagen.", queryText: "EU AI Act Impact", sources: demoSignals.slice(1, 3), tags: ["regulierung"] } as DerivedNode,

    // ── Szenarien (rechts Mitte) ──
    { id: SC1, nodeType: "scenario", x: D2X, y: 80, parentId: Q, createdAt: now, label: "KI-Augmentations-Boom", content: "Co-Pilot-Modelle dominieren. Produktivitätssprung von 40%+. Neue Berufsfelder überwiegen Jobverluste.", queryText: "Optimistisches KI-Szenario", colorKey: "optimistic", probability: 0.25, keyDrivers: ["Weiterbildung", "AI Act Klarheit"], tags: ["szenario"] } as DerivedNode,
    { id: SC2, nodeType: "scenario", x: D2X, y: 300, parentId: Q, createdAt: now, label: "Duale Arbeitswelt 2030", content: "Hochqualifizierte KI-Wissensarbeiter koexistieren mit wachsendem Care-Sektor. Die Mitte schrumpft.", queryText: "Basis-Szenario", colorKey: "baseline", probability: 0.45, keyDrivers: ["AI Act", "Fachkräftemangel", "Remote-Work"], tags: ["szenario"] } as DerivedNode,
    { id: SC3, nodeType: "scenario", x: D2X, y: 520, parentId: Q, createdAt: now, label: "Verdrängungskrise", content: "Schnelle Automatisierung ohne Umschulung führt zu struktureller Arbeitslosigkeit in Büroberufen.", queryText: "Pessimistisches KI-Szenario", colorKey: "pessimistic", probability: 0.22, keyDrivers: ["Kostendruck", "Regulierungslücke"], tags: ["szenario", "risiko"] } as DerivedNode,

    // ── Decision + FollowUp ──
    { id: DEC, nodeType: "decision", x: DX, y: 440, parentId: Q, createdAt: now, content: "1. KI-Kompetenzoffensive starten (Budget ×2). 2. Human-AI-Collaboration in 2-3 Prozessen pilotieren. 3. EU AI Act Audit durchführen. 4. Change-Management für betroffene Abteilungen.", queryText: "KI-Transformations-Maßnahmen", tags: ["massnahme", "ki-arbeit"] } as DerivedNode,
    { id: FQ, nodeType: "followup", x: DX, y: 630, parentId: Q, createdAt: now, content: "Welche europäischen Branchen profitieren am stärksten von KI-Augmentation — und welche verlieren am meisten?", queryText: "Branchen-Analyse" } as DerivedNode,

    // ── Dimensions Card ──
    { id: DIM, nodeType: "dimensions", x: D3X, y: 800, parentId: Q, createdAt: now, content: "Strategische Dimensionen", queryText: "Dimensionen", dimensionData: dimData } as DerivedNode,

    // ── CausalGraph Card ──
    { id: CG, nodeType: "causalgraph", x: D2X, y: 740, parentId: Q, createdAt: now, content: "Kausalnetz", queryText: "Kausalanalyse", causalEdges, causalTrendNames } as DerivedNode,
  ];

  const conns: Connection[] = [
    { from: W, to: Q, connectionType: "builds-on" },
    { from: Q, to: I1, derived: true, connectionType: "derived" },
    { from: Q, to: I2, derived: true, connectionType: "derived" },
    { from: Q, to: SC1, derived: true, connectionType: "derived" },
    { from: Q, to: SC2, derived: true, connectionType: "derived" },
    { from: Q, to: SC3, derived: true, connectionType: "derived" },
    { from: Q, to: DEC, derived: true, connectionType: "derived" },
    { from: Q, to: FQ, derived: true, connectionType: "derived" },
    { from: Q, to: DIM, derived: true, connectionType: "derived" },
    { from: Q, to: CG, derived: true, connectionType: "derived" },
    { from: I1, to: DEC, connectionType: "validates" },
    { from: SC3, to: DEC, connectionType: "contradicts" },
  ];

  return { nodes, conns };
}

// ── ConfidenceBadge ───────────────────────────────────────────────────────

function ConfidenceBadge({ value, de }: { value: number; de: boolean }) {
  const safe = Number.isNaN(value) || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value));
  const pct = Math.round(safe * 100);
  const cls = safe > 0.7 ? "signal-positive-badge" : safe > 0.4 ? "signal-neutral-badge" : "signal-negative-badge";
  return (
    <span className={cls} style={{ fontSize: 10 }}>
      {pct}% {de ? "Konfidenz" : "confidence"}
    </span>
  );
}

// ── ConfidenceGauge (mini half-circle SVG) ────────────────────────────────

function ConfidenceGauge({ value, size = 44 }: { value: number; size?: number }) {
  const safe = Number.isNaN(value) || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value));
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.58;
  const circumHalf = Math.PI * r;
  const offset = circumHalf * (1 - safe);
  const color = safe > 0.7 ? "#1A9E5A" : safe > 0.4 ? "#F5A623" : "#E8402A";
  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={3} strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={`${circumHalf}`} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.2} fontWeight={700}
        fill={color}>{Math.round(safe * 100)}%</text>
    </svg>
  );
}

// ── SignalSparkline (mini timeline from signal dates) ──────────────────────

function SignalSparkline({ signals, width = 80, height = 20 }: { signals: UsedSignal[]; width?: number; height?: number }) {
  const dated = signals.filter(s => s.date).map(s => new Date(s.date!).getTime()).sort();
  if (dated.length < 2) return null;
  const min = dated[0];
  const max = dated[dated.length - 1];
  const range = max - min || 1;
  // Bin into 8 buckets
  const bins = new Array(8).fill(0);
  dated.forEach(d => { const idx = Math.min(7, Math.floor(((d - min) / range) * 8)); bins[idx]++; });
  const maxBin = Math.max(...bins, 1);
  const barW = (width - 2) / 8;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bins.map((v, i) => {
        const h = (v / maxBin) * (height - 2);
        return (
          <rect key={i} x={1 + i * barW} y={height - 1 - h} width={barW - 1} height={h}
            rx={1} fill="#2563EB" fillOpacity={0.15 + (v / maxBin) * 0.55} />
        );
      })}
    </svg>
  );
}

// ── SourceChips ───────────────────────────────────────────────────────────

function SourceChips({ sources, de }: { sources: UsedSignal[]; de: boolean }) {
  if (!sources.length) return null;
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}
    >
      <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 2 }}>
        {de ? "Basis" : "Via"}
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

// ── DimensionsNodeCard ────────────────────────────────────────────────────

function DimensionsNodeCard({
  node, selected, onSelect, onDragStart, onDelete: _onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed,
}: {
  node: DerivedNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  nodeW: number;
  dimmed?: boolean;
}) {
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
            <path d="M2 9 L9 2 M5 9 L9 5 M8 9 L9 8" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── CausalGraphNodeCard ───────────────────────────────────────────────────

function CausalGraphNodeCard({
  node, selected, onSelect, onDragStart, onDelete: _onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed,
}: {
  node: DerivedNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  nodeW: number;
  dimmed?: boolean;
}) {
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

// ── CommandLine ───────────────────────────────────────────────────────────

function CommandLine({
  onSubmit, onClose, locale, prefill, contextLabel,
}: {
  onSubmit: (q: string) => void;
  onClose: () => void;
  locale: "de" | "en";
  prefill?: string;
  contextLabel?: string;
}) {
  const [value, setValue] = useState(prefill ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const de = locale === "de";

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  useEffect(() => { setValue(prefill ?? ""); }, [prefill]);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setValue("");
  };

  const SLASH_COMMANDS = [
    { cmd: '/trend', desc: de ? 'Trend analysieren' : 'Analyze trend' },
    { cmd: '/scenario', desc: de ? 'Szenarien entwickeln' : 'Develop scenarios' },
    { cmd: '/signal', desc: de ? 'Schwache Signale finden' : 'Find weak signals' },
    { cmd: '/clear', desc: de ? 'Canvas leeren' : 'Clear canvas' },
    { cmd: '/export', desc: de ? 'Als Markdown exportieren' : 'Export as Markdown' },
  ];
  const showSlashHints = value.startsWith('/') && value.length < 12;
  const filteredSlash = showSlashHints
    ? SLASH_COMMANDS.filter(c => c.cmd.startsWith(value.toLowerCase().split(' ')[0]))
    : [];

  return (
    <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {contextLabel && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 20, padding: "3px 12px", maxWidth: 460, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ↳ {de ? "Folge-Analyse:" : "Follow-up on:"} <em>{contextLabel}</em>
        </div>
      )}
      <div style={{ position: "relative", width: 520, maxWidth: "90vw" }}>
        {showSlashHints && filteredSlash.length > 0 && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, background: 'var(--color-surface, rgba(255,255,255,0.98))', border: '1px solid var(--color-border, #ddd)', borderRadius: 10, padding: '8px 10px', fontSize: 12, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{de ? 'Befehle' : 'Commands'}:</div>
            {filteredSlash.map(c => (
              <div key={c.cmd}
                onClick={() => { setValue(c.cmd + ' '); inputRef.current?.focus(); }}
                style={{ padding: '3px 4px', color: 'var(--color-text-secondary)', cursor: 'pointer', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-page-bg, #f5f5f5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontWeight: 700, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", color: 'var(--color-text-heading)' }}>{c.cmd}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{c.desc}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "2px solid #0A0A0A", borderRadius: 14, padding: "8px 10px 8px 14px", boxShadow: "0 12px 48px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)" }}>
          <span style={{ fontSize: 15, color: "var(--color-text-muted)", flexShrink: 0 }}>⌕</span>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
            placeholder={de ? "Frage, Thema oder /befehl…" : "Question, topic or /command…"}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, color: "var(--color-text-primary)", fontFamily: "inherit" }}
          />
          <button onClick={submit} style={{ flexShrink: 0, padding: "6px 16px", borderRadius: 8, background: "#E4FF97", border: "1px solid rgba(0,0,0,0.1)", color: "#0A0A0A", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {de ? "Analysieren" : "Analyze"} ↵
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
        Esc {de ? "schließen" : "to close"} · ↵ {de ? "ausführen" : "to run"} · / {de ? "Befehle" : "commands"}
      </div>
    </div>
  );
}

// ── ConnectionsSVG ────────────────────────────────────────────────────────

function ConnectionsSVG({ nodes, connections, pipelineChain, selectedId: selId, zoom, activeTagFilter, nodeTagMap, nodeGroupMap, connVisMode, de }: {
  nodes: CanvasNode[]; connections: Connection[]; pipelineChain?: Set<string>; selectedId?: string | null;
  zoom: number; activeTagFilter: string | null; nodeTagMap: Map<string, string[]>; nodeGroupMap: Map<string, string>; connVisMode: "auto" | "show" | "hide"; de: boolean;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Pre-compute direct edges from selected node (once, before map loop)
  const directEdges = useMemo(() => {
    const set = new Set<string>();
    if (selId) {
      connections.forEach(c => {
        if (c.from === selId || c.to === selId) set.add(`${c.from}-${c.to}`);
      });
    }
    return set;
  }, [selId, connections]);

  // Density-adaptive base opacity — few connections stay clearly readable,
  // large meshes (50+) fade to background so cards dominate.
  const density = connections.length <= 20 ? "low"
    : connections.length <= 50 ? "med"
    : "high";

  // Zoom-adaptive dampening factor — keep floor at 0.55 so lines stay readable
  // at typical zoom (50–70%). Only very zoomed-out views fade further.
  const zoomFactor = zoom >= 0.8 ? 1.0
    : zoom >= 0.5 ? 0.75 + (zoom - 0.5) / 0.3 * 0.25
    : zoom >= 0.3 ? 0.55 + (zoom - 0.3) / 0.2 * 0.20
    : 0.3;

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <marker id="arr-q" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#64748B" />
        </marker>
        <marker id="arr-d" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#64748B" />
        </marker>
        <marker id="arr-r" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#F5A62388" />
        </marker>
        <marker id="arr-builds" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#1A9E5A" />
        </marker>
        <marker id="arr-contradicts" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#E8402A" />
        </marker>
        <marker id="arr-validates" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#2563EB" />
        </marker>
      </defs>
      {connections.map(c => {
        const from = nodeMap.get(c.from);
        const to = nodeMap.get(c.to);
        if (!from || !to) return null;

        const x1 = from.x + getNodeWidth(from);
        const y1 = from.y + getNodeHeight(from) / 2;
        const x2 = to.x;
        const y2 = to.y + getNodeHeight(to) / 2;
        const cp = Math.min(Math.abs(x2 - x1) * 0.45, 120);

        // Density-adaptive base opacity — high density needs lower baseline
        // so 70+ connections don't turn the canvas into moiré. Low density
        // (this project has 10) keeps lines clearly readable by default.
        const baseByDensity = density === "high"
          ? { direct: 1.0, chain: 0.55, orphan: 0.08, sameGroup: 0.30, crossGroup: 0.18 }
          : density === "med"
          ? { direct: 1.0, chain: 0.65, orphan: 0.15, sameGroup: 0.50, crossGroup: 0.35 }
          : { direct: 1.0, chain: 0.75, orphan: 0.30, sameGroup: 0.70, crossGroup: 0.55 };

        // 4-tier opacity: direct edge (strongest), pipeline-chain, orphan, default by group
        let baseOpacity: number;
        if (selId) {
          const isDirect = directEdges.has(`${c.from}-${c.to}`);
          const inChain = pipelineChain?.has(c.from) || pipelineChain?.has(c.to);
          baseOpacity = isDirect ? baseByDensity.direct : inChain ? baseByDensity.chain : baseByDensity.orphan;
        } else if (pipelineChain && (pipelineChain.has(c.from) || pipelineChain.has(c.to))) {
          // Pipeline chain is highlighted even without selection — derivation flow stays visible
          baseOpacity = baseByDensity.chain;
        } else {
          const sameGroup = nodeGroupMap.get(c.from) && nodeGroupMap.get(c.from) === nodeGroupMap.get(c.to);
          baseOpacity = sameGroup ? baseByDensity.sameGroup : baseByDensity.crossGroup;
        }

        // Tag-filter propagation to connections
        if (activeTagFilter) {
          const fromOk = (nodeTagMap.get(c.from) ?? []).includes(activeTagFilter);
          const toOk = (nodeTagMap.get(c.to) ?? []).includes(activeTagFilter);
          if (!fromOk && !toOk) baseOpacity = 0;
          else if (!fromOk || !toOk) baseOpacity = 0.06;
        }

        // Apply zoom dampening + visibility mode
        const finalOpacity = connVisMode === "hide" ? 0
          : connVisMode === "show" ? Math.max(baseOpacity, 0.65)
          : baseOpacity * zoomFactor;

        if (finalOpacity <= 0.02) return null;

        // Connection type colors — coherent semantic palette:
        //   derived  → slate (neutral flow, the most common type, stays calm)
        //   refreshed → amber (temporal re-run)
        //   builds-on → emerald (positive support)
        //   contradicts → red (conflict)
        //   validates → blue (confirmation)
        const ct = c.connectionType;
        const CONN_STYLES: Record<string, { stroke: string; dash: string; width: number; marker: string; label: string; labelColor: string }> = {
          "derived":      { stroke: "#64748B", dash: "",    width: 1.4, marker: "url(#arr-d)",          label: "",                             labelColor: "" },
          "refreshed":    { stroke: "#F5A623", dash: "6 4", width: 1.2, marker: "url(#arr-r)",          label: "↻",                            labelColor: "#F5A623" },
          "builds-on":    { stroke: "#1A9E5A", dash: "",    width: 2.0, marker: "url(#arr-builds)",     label: de ? "baut auf" : "builds on",  labelColor: "#1A9E5A" },
          "contradicts":  { stroke: "#E8402A", dash: "3 2", width: 1.8, marker: "url(#arr-contradicts)",label: de ? "widerspricht" : "contradicts", labelColor: "#E8402A" },
          "validates":    { stroke: "#2563EB", dash: "",    width: 1.8, marker: "url(#arr-validates)",  label: de ? "bestätigt" : "validates", labelColor: "#2563EB" },
        };

        const cStyle = ct ? CONN_STYLES[ct] ?? CONN_STYLES.derived
          : c.refreshed ? CONN_STYLES.refreshed
          : c.derived   ? CONN_STYLES.derived
          : { stroke: "#64748B", dash: "", width: 1.4, marker: "url(#arr-q)", label: "", labelColor: "" };

        // Semantic (non-derived) connections get higher minimum opacity — they carry argumentative weight
        const isSemanticType = ct && ct !== "derived";
        // Parent→child derivation edges (QUERY → insights/scenarios/decisions/causalgraph/…)
        // are the backbone of the derivation tree. Even in dense canvases they must
        // stay readable, otherwise the "where did this come from" story is lost.
        const isQueryChildEdge = from.nodeType === "query" && to.parentId === from.id;
        let effectiveOpacity = isSemanticType ? Math.max(finalOpacity, 0.5) : finalOpacity;
        if (isQueryChildEdge && connVisMode !== "hide") {
          effectiveOpacity = Math.max(effectiveOpacity, 0.38);
        }

        // Midpoint for label positioning (on the Bézier curve at t=0.5)
        const mx = 0.125 * x1 + 0.375 * (x1 + cp) + 0.375 * (x2 - cp) + 0.125 * x2;
        const my = 0.125 * y1 + 0.375 * y1 + 0.375 * y2 + 0.125 * y2;
        const showLabel = cStyle.label && effectiveOpacity > 0.2 && zoom >= 0.5;

        return (
          <g key={`${c.from}-${c.to}`}>
            <path
              d={`M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`}
              fill="none" stroke={cStyle.stroke} strokeWidth={cStyle.width} strokeLinecap="round"
              strokeDasharray={cStyle.dash || "none"}
              markerEnd={cStyle.marker} opacity={effectiveOpacity}
              style={{ transition: "opacity 0.2s" }}
            />
            {showLabel && (
              <text x={mx} y={my - 6} textAnchor="middle" fill={cStyle.labelColor} opacity={Math.min(effectiveOpacity + 0.2, 1)} fontSize={9} fontWeight={600} fontFamily="var(--font-code, 'JetBrains Mono'), monospace" style={{ pointerEvents: "none" }}>
                {cStyle.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── TagInlineInput (reusable inline tag adder for detail panels) ─────────

function TagInlineInput({ nodeId, de, onAddTag }: { nodeId: string; de: boolean; onAddTag: (id: string, tag: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && value.trim()) {
            onAddTag(nodeId, value);
            setValue("");
          }
        }}
        placeholder={de ? "Neuen Tag eingeben…" : "Add new tag…"}
        style={{
          flex: 1, fontSize: 12, padding: "4px 10px",
          border: "1px solid var(--color-border)", borderRadius: 8,
          background: "var(--color-surface)", color: "var(--color-text-primary)",
          outline: "none",
        }}
      />
      <button
        onClick={() => { if (value.trim()) { onAddTag(nodeId, value); setValue(""); } }}
        disabled={!value.trim()}
        style={{
          fontSize: 11, padding: "4px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)", background: value.trim() ? "#E4FF97" : "transparent",
          color: value.trim() ? "#0A0A0A" : "var(--color-text-muted)", cursor: value.trim() ? "pointer" : "default",
          fontWeight: 600,
        }}
      >{de ? "Hinzufügen" : "Add"}</button>
    </div>
  );
}

// ── CardActionsMenu (shared action dropdown for all node cards) ──────────

function CardActionsMenu({ nodeId, nodeType, de, onDelete, onSetStatus, onAddTag, onFollowUp, currentStatus }: {
  nodeId: string;
  nodeType: string;
  de: boolean;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onAddTag: (id: string, tag: string) => void;
  onFollowUp?: (id: string, prefill?: string) => void;
  currentStatus?: NodeStatus;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  return (
    <VoltDropdownMenu>
      <VoltDropdownMenuTrigger asChild>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, border: "none", background: "transparent", cursor: "pointer",
            color: "var(--color-text-muted)", flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.06)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <MoreHorizontal size={14} />
        </button>
      </VoltDropdownMenuTrigger>
      <VoltDropdownMenuContent align="end" side="bottom" className="min-w-[180px]">
        <VoltDropdownMenuLabel>{de ? "Aktionen" : "Actions"}</VoltDropdownMenuLabel>
        {onFollowUp && (
          <VoltDropdownMenuItem onClick={() => onFollowUp(nodeId)}>
            <MessageSquarePlus size={14} />
            {de ? "Folgefrage stellen" : "Ask follow-up"}
          </VoltDropdownMenuItem>
        )}
        <VoltDropdownMenuSeparator />
        <VoltDropdownMenuLabel>{de ? "Status" : "Status"}</VoltDropdownMenuLabel>
        {(["open", "active", "decided", "pinned"] as NodeStatus[]).map(s => (
          <VoltDropdownMenuItem key={s} onClick={() => onSetStatus(nodeId, s)}>
            <StatusIcon status={s} size={14} />
            <span style={{ flex: 1 }}>{NODE_STATUS_META[s].label}</span>
            {currentStatus === s && <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>●</span>}
          </VoltDropdownMenuItem>
        ))}
        <VoltDropdownMenuSeparator />
        {!showTagInput ? (
          <VoltDropdownMenuItem onClick={(e) => { e.preventDefault(); setShowTagInput(true); }}>
            <TagIcon size={14} />
            {de ? "Tag hinzufügen" : "Add tag"}
          </VoltDropdownMenuItem>
        ) : (
          <div style={{ padding: "4px 8px" }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            <input
              autoFocus
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && tagInput.trim()) {
                  onAddTag(nodeId, tagInput);
                  setTagInput("");
                  setShowTagInput(false);
                }
                if (e.key === "Escape") setShowTagInput(false);
              }}
              placeholder={de ? "Tag eingeben…" : "Enter tag…"}
              style={{
                width: "100%", fontSize: 12, padding: "4px 8px",
                border: "1px solid var(--color-border)", borderRadius: 6,
                background: "var(--color-surface)", color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
        )}
        <VoltDropdownMenuSeparator />
        <VoltDropdownMenuItem variant="destructive" onClick={() => onDelete(nodeId)}>
          <Trash2 size={14} />
          {de ? "Löschen" : "Delete"}
        </VoltDropdownMenuItem>
      </VoltDropdownMenuContent>
    </VoltDropdownMenu>
  );
}

// ── FormattedText — structured text rendering with paragraphs & provenance ──

function FormattedText({ text, fontSize = 13, lineHeight = 1.65, color = "var(--color-text-secondary)", maxLines, compact }: {
  text: string; fontSize?: number; lineHeight?: number; color?: string; maxLines?: number; compact?: boolean;
}) {
  if (!text) return null;

  // Smart paragraph splitting: if text has no \n\n but is long, insert breaks at sentence boundaries
  const ensureParagraphs = (raw: string): string => {
    // Already has paragraph breaks → use as-is
    if (raw.includes("\n\n")) return raw;
    // Short text → no splitting needed
    if (raw.length < 300) return raw;
    // Split at sentence boundaries (period/! /? followed by space + uppercase)
    const sentences = raw.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
    if (sentences.length <= 3) return raw;
    // Group into paragraphs of ~3 sentences each
    const paras: string[] = [];
    let current: string[] = [];
    for (const s of sentences) {
      current.push(s);
      if (current.length >= 3 || current.join(" ").length > 400) {
        paras.push(current.join(" "));
        current = [];
      }
    }
    if (current.length > 0) paras.push(current.join(" "));
    return paras.join("\n\n");
  };
  const processedText = ensureParagraphs(text);

  // Parse inline provenance tags and bold markers into React elements
  const renderInline = (line: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    // Match [SIGNAL: ...], [TREND: ...], [LLM-Einschätzung], [Source, Date], and **bold**
    const regex = /(\[SIGNAL:\s*[^\]]+\]|\[TREND:\s*[^\]]+\]|\[LLM-Einschätzung\]|\[[A-Za-zÄÖÜäöüß][^\]]{1,40},\s*\d{2,4}[^\]]*\]|\*\*[^*]+\*\*)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(line.slice(lastIdx, match.index));
      }
      const m = match[0];
      if (m.startsWith("[SIGNAL:")) {
        parts.push(<span key={`${keyPrefix}-${i}`} style={{ fontSize: compact ? 7 : 9, fontWeight: 600, padding: "0px 4px", borderRadius: 4, background: "#2563EB10", color: "#2563EB", border: "1px solid #2563EB20", fontFamily: "var(--font-code, monospace)", whiteSpace: "nowrap" }}>{m.slice(1, -1)}</span>);
      } else if (m.startsWith("[TREND:")) {
        parts.push(<span key={`${keyPrefix}-${i}`} style={{ fontSize: compact ? 7 : 9, fontWeight: 600, padding: "0px 4px", borderRadius: 4, background: "#1A9E5A10", color: "#1A9E5A", border: "1px solid #1A9E5A20", fontFamily: "var(--font-code, monospace)", whiteSpace: "nowrap" }}>{m.slice(1, -1)}</span>);
      } else if (m === "[LLM-Einschätzung]") {
        parts.push(<span key={`${keyPrefix}-${i}`} style={{ fontSize: compact ? 7 : 9, fontWeight: 600, padding: "0px 4px", borderRadius: 4, background: "#F5A62310", color: "#F5A623", border: "1px solid #F5A62320", fontFamily: "var(--font-code, monospace)", whiteSpace: "nowrap" }}>LLM</span>);
      } else if (m.startsWith("[") && m.endsWith("]")) {
        // Citation: [Source, Date]
        parts.push(<span key={`${keyPrefix}-${i}`} style={{ fontSize: compact ? 7 : 9, fontWeight: 500, padding: "0px 3px", borderRadius: 3, background: "var(--color-page-bg)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", whiteSpace: "nowrap" }}>{m.slice(1, -1)}</span>);
      } else if (m.startsWith("**") && m.endsWith("**")) {
        parts.push(<strong key={`${keyPrefix}-${i}`} style={{ fontWeight: 700, color: "var(--color-text-heading)" }}>{m.slice(2, -2)}</strong>);
      }
      lastIdx = match.index + m.length;
      i++;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    return parts;
  };

  // Split into paragraphs by double newline
  const paragraphs = processedText.split(/\n\n+/).filter(p => p.trim());

  // For compact mode (card previews), render as single clamped block
  if (compact && maxLines) {
    return (
      <p style={{ fontSize, lineHeight, color, margin: 0, overflow: "hidden", wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: maxLines, WebkitBoxOrient: "vertical" as const }}>
        {renderInline(processedText.replace(/\n\n+/g, " — ").replace(/\n/g, " "), "c")}
      </p>
    );
  }

  return (
    <div style={{ fontSize, lineHeight, color }}>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim();
        // Check for heading-like lines (short, no period, possibly bold)
        const isHeading = trimmed.length < 80 && !trimmed.endsWith(".") && !trimmed.endsWith(":") && !trimmed.includes("[") && pi > 0;
        if (isHeading && !compact) {
          return <div key={pi} style={{ fontWeight: 700, fontSize: fontSize + 1, color: "var(--color-text-heading)", marginTop: pi > 0 ? 14 : 0, marginBottom: 4 }}>{renderInline(trimmed, `h${pi}`)}</div>;
        }
        // Split by single newlines within paragraph for soft line breaks
        const lines = trimmed.split(/\n/);
        return (
          <p key={pi} style={{ margin: pi > 0 ? "10px 0 0" : 0 }}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, `p${pi}l${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ── DerivedNodeCard (compact) ─────────────────────────────────────────────

function DerivedNodeCard({
  node, de, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom,
  onExplore: _onExplore, // kept for API compatibility, actions live in DetailPanel
  onAddTag, onSetStatus,
}: {
  node: DerivedNode; de: boolean; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onExplore: (id: string, queryText: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
}) {
  const type = node.nodeType;
  const isScenario = type === "scenario";
  const isFollowup = type === "followup";
  const scenCfg = isScenario && node.colorKey ? SCEN[node.colorKey] ?? SCEN.baseline : null;

  const cfg = useMemo(() => {
    if (type === "insight")  return { accent: "#6B7A00", accentText: "#6B7A00", bg: "var(--color-lime-light)", badge: de ? "ERKENNTNIS" : "INSIGHT", badgeTip: de ? "Erkenntnis: Wichtige Schlussfolgerung aus der Analyse" : "Insight: Key finding derived from the analysis" };
    if (type === "decision") return { accent: "#1A9E5A", accentText: "#1A9E5A", bg: "var(--signal-positive-light)", badge: de ? "EMPFEHLUNG" : "DECISION", badgeTip: de ? "Empfehlung: Konkrete Handlungsoption mit Entscheidungsrahmen" : "Decision: Concrete action option with decision framework" };
    if (type === "followup") return { accent: "rgba(0,0,0,0.10)", accentText: "var(--color-text-muted)", bg: "var(--color-surface)", badge: de ? "FOLGEFRAGE" : "FOLLOW-UP", badgeTip: de ? "Folgefrage: Weiterführende Analyse auf Basis dieser Ergebnisse" : "Follow-up: Further analysis building on these results" };
    const scen = SCEN[node.colorKey ?? "baseline"] ?? SCEN.baseline;
    const scenTips: Record<string, string> = {
      optimistic: de ? "Optimistisches Szenario: Beste realistische Entwicklung" : "Optimistic scenario: Best realistic outcome",
      baseline:   de ? "Basisszenario: Wahrscheinlichstes Outcome" : "Baseline scenario: Most likely outcome",
      pessimistic: de ? "Pessimistisches Szenario: Ungünstigste realistische Entwicklung" : "Pessimistic scenario: Worst realistic outcome",
      wildcard:   de ? "Wildcard-Szenario: Unwahrscheinlich, aber wirkungsmächtig" : "Wildcard scenario: Unlikely but high-impact possibility",
    };
    return { accent: scen.color, accentText: scen.color, bg: scen.bg, badge: de ? scen.label.toUpperCase() : scen.labelEn.toUpperCase(), badgeTip: scenTips[node.colorKey ?? "baseline"] ?? "" };
  }, [type, node.colorKey, de]);

  const accentColorForStatus = node.nodeStatus && node.nodeStatus !== "open" ? NODE_STATUS_META[node.nodeStatus].color : null;

  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 24, overflow: "hidden",
          background: isScenario ? (scenCfg?.bg ?? "var(--color-surface)") : cfg.bg,
          border: `1px solid ${selected ? "#0A0A0A" : "var(--color-border, rgba(0,0,0,0.08))"}`,
          borderRadius: 6,
          boxShadow: `inset 3px 0 0 ${isScenario ? (scenCfg?.color ?? "#1D4ED8") : isFollowup ? "var(--color-border)" : cfg.accent}`,
          userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4, padding: "0 6px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <Tooltip content={cfg.badgeTip} placement="top" delay={400}>
          <span style={{ fontSize: 7, fontWeight: 800, color: isScenario ? (scenCfg?.color ?? "#1D4ED8") : cfg.accentText, flexShrink: 0, textTransform: "uppercase", cursor: "help" }}>{cfg.badge}</span>
        </Tooltip>
        <span style={{ fontSize: 9, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.label || node.content}</span>
        {accentColorForStatus && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} />}
      </div>
    );
  }

  const typeColorHex = isScenario
    ? (node.colorKey === "optimistic" ? "#1A9E5A" : node.colorKey === "pessimistic" ? "#E8402A" : node.colorKey === "wildcard" ? "#D4A017" : "#3B82F6")
    : type === "insight" ? "#6B7A00" : type === "decision" ? "#1A9E5A" : "#6B7280";
  const cardH = node.customHeight ?? getNodeHeight(node as CanvasNode);

  return (
    // Wrapper: positioning + ports (overflow:visible)
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: cardH, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      {/* Left input port */}
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      {/* Right output port */}
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Weiterführende Analyse"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${typeColorHex}`, boxShadow: `0 0 8px ${typeColorHex}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${typeColorHex}99, 0 0 0 3px ${typeColorHex}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${typeColorHex}66`; }}
      />
      {/* Card body */}
      <div className="nc-derived" style={{
        position: "relative", width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: "var(--color-surface)",
        border: `1.5px ${isFollowup ? "dashed" : "solid"} ${selected ? "#0A0A0A" : "var(--color-border, #E8E8E8)"}`,
        borderRadius: 12, overflow: "hidden",
        boxShadow: selected
          ? `${!isFollowup ? `inset 3px 0 0 ${typeColorHex}, ` : ""}0 0 0 3px rgba(228,255,151,0.65), 0 4px 20px rgba(0,0,0,0.1)`
          : `${!isFollowup ? `inset 3px 0 0 ${typeColorHex}, ` : ""}0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)`,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}>
        {/* Probability bar (scenario only) */}
        {isScenario && node.probability != null && (
          <div style={{ height: 3, background: `${typeColorHex}28`, flexShrink: 0 }}>
            {/* FIXED: EDGE-15 — Clamp probability to [0,1] */}
            <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, node.probability!)) * 100}%`, background: typeColorHex, transition: "width 0.3s" }} />
          </div>
        )}
        {/* Header */}
        <div
          onPointerDown={e => { e.stopPropagation(); onDragStart(e, node.id); }}
          style={{ height: 36, padding: "0 12px", cursor: "grab", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: `${typeColorHex}0C`, borderBottom: `1px solid ${typeColorHex}22`, borderTopLeftRadius: isScenario ? 0 : 11, borderTopRightRadius: 11 }}
        >
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
            color: typeColorHex, background: `${typeColorHex}14`, border: `1px solid ${typeColorHex}30`,
            borderRadius: 6, padding: "4px 10px",
          }}>{cfg.badge}</span>
          {isScenario && node.probability != null && (
            <span style={{ fontSize: 12, fontWeight: 700, color: typeColorHex, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(Math.max(0, Math.min(1, node.probability!)) * 100)}%
            </span>
          )}
          <div style={{ flex: 1 }} />
          {accentColorForStatus && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} title={NODE_STATUS_META[node.nodeStatus!].label} />}
          {(cardZoom === undefined || cardZoom >= 0.6) && (
            <CardActionsMenu nodeId={node.id} nodeType={node.nodeType} de={de} onDelete={onDelete} onSetStatus={onSetStatus} onAddTag={onAddTag} currentStatus={node.nodeStatus} />
          )}
        </div>
        {/* Content */}
        <div style={{ padding: "10px 12px 0", flex: 1, overflow: "hidden", position: "relative" }}>
          {isScenario && node.label && (
            <div style={{ fontSize: 12, fontWeight: 700, color: typeColorHex, marginBottom: 5, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {node.label}
            </div>
          )}
          <FormattedText
            text={isFollowup ? `→ ${node.content}` : node.content}
            fontSize={12} lineHeight={1.6} compact
            maxLines={Math.max(4, Math.floor((cardH - 80) / 19))}
          />
          {/* Driver pills (scenario only, max 2) */}
          {isScenario && node.keyDrivers && node.keyDrivers.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 7 }}>
              {node.keyDrivers.slice(0, 2).map((d, i) => (
                <span key={i} style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 20,
                  background: `${typeColorHex}12`, border: `1px solid ${typeColorHex}35`,
                  color: typeColorHex, fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110,
                }}>{d}</span>
              ))}
            </div>
          )}
          {/* Tag pills on card surface */}
          {node.tags && node.tags.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
              {node.tags.slice(0, 3).map((tag, i) => {
                const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                return (
                  <span key={i} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 10, background: `hsl(${hue}, 55%, 94%)`, border: `1px solid hsl(${hue}, 45%, 82%)`, color: `hsl(${hue}, 55%, 38%)`, fontWeight: 500, whiteSpace: "nowrap" }}>
                    {tag.length > 12 ? tag.slice(0, 12) + "…" : tag}
                  </span>
                );
              })}
              {node.tags.length > 3 && <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 500, alignSelf: "center" }}>+{node.tags.length - 3}</span>}
            </div>
          )}
          {/* Fade gradient */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 32, background: "linear-gradient(to bottom, transparent, var(--color-surface))", pointerEvents: "none" }} />
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? DERIVED_W, "both"); }}
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

// ── QueryNodeCard (compact) ───────────────────────────────────────────────

function QueryNodeCard({
  node, de, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom, causalFingerprint, childCounts, duplicateIndex,
  // unused in compact view (handled by DetailPanel) — kept for API compatibility:
  onFollowUp: _onFollowUp, onFollowUpQ: _onFollowUpQ, onToggleCollapse: _onToggleCollapse, onRefresh: _onRefresh,
  onAddTag, onSetStatus,
}: {
  node: QueryNode; de: boolean; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onFollowUp: (id: string, prefill?: string) => void;
  onFollowUpQ: (id: string, q: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onRefresh: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
  causalFingerprint?: string[];
  // Counts of derived children, used as fallback when synthesis is empty or zoom
  // is too low for the full body — lets the card still say "something happened"
  // rather than rendering an empty 420×420 box.
  childCounts?: { insights: number; scenarios: number; decisions: number; followups: number; causal: number };
  // If this query shares its text with siblings, `duplicateIndex` is 1,2,3…
  // (createdAt order). 0/undefined means the title is unique and no badge shows.
  duplicateIndex?: number;
}) {
  const isLoading = node.status === "loading" || node.status === "streaming";
  const age = nodeAge(node.createdAt);
  const staleAccent = age === "stale" ? "#F5A623" : age === "aging" ? "rgba(245,166,35,0.5)" : null;
  const accentColorForStatus = node.nodeStatus && node.nodeStatus !== "open" ? NODE_STATUS_META[node.nodeStatus].color : null;

  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 28, overflow: "hidden", background: "var(--color-surface)",
          border: `1px solid ${selected ? "#0A0A0A" : staleAccent ?? "var(--color-border)"}`,
          borderRadius: 8, userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: node.status === "done" ? "#1A9E5A" : node.status === "error" ? "#E8402A" : "#F5A623" }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.query}</span>
        {accentColorForStatus && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} />}
      </div>
    );
  }

  const queryTypeColor = "#E4FF97";
  const statusCls = !selected && (node.status === "streaming" || node.status === "loading") ? "nc-run"
    : !selected && node.status === "done" ? "nc-success"
    : !selected && node.status === "error" ? "nc-error"
    : "";
  const cardH = node.customHeight ?? estimateQueryHeight(node);

  return (
    // Wrapper: positioning + ports
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: cardH, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      {/* Left input port */}
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      {/* Right output port */}
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Folgefrage / Vertiefung"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: "2.5px solid #E4FF97", boxShadow: "0 0 8px rgba(228,255,151,0.6)", zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 14px rgba(228,255,151,0.9), 0 0 0 3px rgba(228,255,151,0.3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 8px rgba(228,255,151,0.6)"; }}
      />
      {/* Card body */}
      <div
        className={statusCls}
        style={{
          position: "relative", width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          background: "var(--color-surface)",
          border: `1.5px solid ${selected ? "#0A0A0A" : staleAccent ?? "var(--color-border, #E8E8E8)"}`,
          borderRadius: 12, overflow: "hidden",
          ...(selected ? { boxShadow: "0 0 0 3px rgba(228,255,151,0.65), 0 4px 20px rgba(0,0,0,0.1)" } :
            (!isLoading && node.status !== "done" && node.status !== "error") ? { boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)" } : {}),
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      >
        {/* Header */}
        <div
          onPointerDown={e => { e.stopPropagation(); onDragStart(e, node.id); }}
          style={{
            height: 44, padding: "0 14px", cursor: "grab", flexShrink: 0,
            background: isLoading ? "linear-gradient(90deg, rgba(228,255,151,0.10) 0%, rgba(0,0,0,0.04) 100%)" : "rgba(0,0,0,0.04)",
            borderBottom: "1px solid rgba(0,0,0,0.12)",
            borderTopLeftRadius: 11, borderTopRightRadius: 11,
            display: "flex", alignItems: "center", gap: 7,
          }}
        >
          <span style={{
            flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
            color: "#0A0A0A", background: queryTypeColor, border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 5, padding: "2px 7px",
          }}>QUERY</span>
          <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif", color: "var(--color-text-heading)", lineHeight: 1.3, letterSpacing: "-0.02em", display: "-webkit-box", WebkitLineClamp: cardZoom !== undefined && cardZoom < 0.6 ? 1 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {node.query}
          </p>
          {duplicateIndex !== undefined && duplicateIndex > 0 && (
            <span
              title={de ? `Wiederholung #${duplicateIndex} dieser Frage` : `Duplicate #${duplicateIndex} of this query`}
              style={{
                flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.02em",
                fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                color: "rgba(0,0,0,0.65)", background: "rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.12)", borderRadius: 5, padding: "2px 6px",
              }}
            >#{duplicateIndex}</span>
          )}
          {accentColorForStatus && <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} title={NODE_STATUS_META[node.nodeStatus!].label} />}
          {(cardZoom === undefined || cardZoom >= 0.6) && (
            <CardActionsMenu nodeId={node.id} nodeType="query" de={de} onDelete={onDelete} onSetStatus={onSetStatus} onAddTag={onAddTag} onFollowUp={_onFollowUp} currentStatus={node.nodeStatus} />
          )}
        </div>
        {/* Content */}
        <div style={{ padding: "12px 14px 0", flex: 1, overflow: "hidden", position: "relative" }}>
          {/* Full-body content — shown at zoom ≥ 0.6. Below that, the compact
              derivation summary takes over (see block below). The progressive
              collapse is: <0.45 strip · 0.45–0.6 derivation summary ·
              ≥0.6 full synthesis + signals + fingerprint + tags. */}
          {node.synthesis && (cardZoom === undefined || cardZoom >= 0.6) && (
            <>
              {/* Source attribution badges */}
              {node.result?.usedSignals && node.result.usedSignals.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }}>
                  {[...new Set(node.result.usedSignals.map(s => s.source))].slice(0, 5).map((src, i) => (
                    <span key={i} style={{
                      fontSize: 8, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                      background: "#2563EB08", border: "1px solid #2563EB20", color: "#2563EB",
                      fontFamily: "var(--font-code, monospace)", whiteSpace: "nowrap",
                    }}>{src}</span>
                  ))}
                  <span style={{ fontSize: 8, color: "var(--color-text-muted)", alignSelf: "center" }}>
                    {node.result.usedSignals.length} {de ? "Signale" : "signals"}
                  </span>
                </div>
              )}
              <FormattedText text={node.synthesis ?? ""} fontSize={12.5} lineHeight={1.65} compact maxLines={Math.max(4, Math.floor(((node.customHeight ?? estimateQueryHeight(node)) - 140) / 20))} />
              {/* Causal fingerprint pills */}
              {causalFingerprint && causalFingerprint.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 8 }}>
                  <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.06em", marginRight: 2, alignSelf: "center" }}>⬡</span>
                  {causalFingerprint.map((t, i) => (
                    <span key={i} style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: "#1A9E5A10", border: "1px solid #1A9E5A30", color: "#1A9E5A", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {t.length > 18 ? t.slice(0, 18) + "…" : t}
                    </span>
                  ))}
                </div>
              )}
              {/* Signal sparkline — timeline of used signals */}
              {node.result?.usedSignals && node.result.usedSignals.length >= 2 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 7, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.06em" }}>SIGNALE</span>
                  <SignalSparkline signals={node.result.usedSignals} width={80} height={16} />
                </div>
              )}
              {/* Tag pills on card surface */}
              {node.tags && node.tags.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
                  {node.tags.slice(0, 3).map((tag, i) => {
                    const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                    return (
                      <span key={i} style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: `hsl(${hue}, 55%, 94%)`, border: `1px solid hsl(${hue}, 45%, 82%)`, color: `hsl(${hue}, 55%, 38%)`, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {tag.length > 14 ? tag.slice(0, 14) + "…" : tag}
                      </span>
                    );
                  })}
                  {node.tags.length > 3 && <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 500, alignSelf: "center" }}>+{node.tags.length - 3}</span>}
                </div>
              )}
              {/* Fade gradient at bottom to signal more content */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: "linear-gradient(to bottom, transparent, var(--color-surface))", pointerEvents: "none" }} />
            </>
          )}
          {/* Fallback derivation summary — shown when synthesis is empty/missing
              (so the card doesn't render as an empty 420×420 box). Covers two
              cases: (a) query has children but no saved synthesis yet; (b) zoom
              is below the synthesis threshold (≥0.6). */}
          {(!node.synthesis || (cardZoom !== undefined && cardZoom < 0.6)) && !isLoading && node.status !== "error" && childCounts && (childCounts.insights + childCounts.scenarios + childCounts.decisions + childCounts.followups + childCounts.causal) > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                {de ? "Abgeleitet" : "Derived"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {childCounts.insights > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(26,158,90,0.08)", color: "#1A9E5A", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.insights} {de ? "Erkenntnisse" : "Insights"}
                  </span>
                )}
                {childCounts.scenarios > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(37,99,235,0.08)", color: "#2563EB", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.scenarios} {de ? "Szenarien" : "Scenarios"}
                  </span>
                )}
                {childCounts.decisions > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(124,26,158,0.08)", color: "#7C1A9E", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.decisions} {de ? "Empfehlungen" : "Decisions"}
                  </span>
                )}
                {childCounts.followups > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(245,166,35,0.10)", color: "#955A20", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.followups} {de ? "Folgefragen" : "Follow-ups"}
                  </span>
                )}
                {childCounts.causal > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(26,158,90,0.12)", color: "#1A9E5A", fontWeight: 600, whiteSpace: "nowrap", border: "1px solid rgba(26,158,90,0.25)" }}>
                    {de ? "Kausalnetz" : "Causal graph"}
                  </span>
                )}
              </div>
              {causalFingerprint && causalFingerprint.length > 0 && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.06em", marginRight: 2, alignSelf: "center" }}>⬡</span>
                  {causalFingerprint.map((t, i) => (
                    <span key={i} style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: "#1A9E5A10", border: "1px solid #1A9E5A30", color: "#1A9E5A", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {t.length > 18 ? t.slice(0, 18) + "…" : t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {isLoading && !node.synthesis && (() => {
            const phases = de
              ? ["Signale lesen…", "Synthese…", "Kausalketten…", "Szenarien…", "Erkenntnisse…", "Abschliessen…"]
              : ["Reading signals…", "Synthesis…", "Causal chains…", "Scenarios…", "Insights…", "Finishing…"];
            const phase = node.streamingPhase ?? 0;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#F5A623", fontWeight: 500 }}>{phases[phase]}</span>
                <div style={{ flex: 1, height: 2, background: "var(--color-border)", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(phase / 5) * 100}%`, background: "#F5A623", borderRadius: 1, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })()}
          {node.status === "error" && <span style={{ fontSize: 11, color: "#E8402A" }}>⚠ {node.errorMsg?.slice(0, 60) ?? "Fehler"}</span>}
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? QUERY_NODE_W, "both"); }}
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

// ── NodePicker ────────────────────────────────────────────────────────────

type NewNodeType =
  | "query"
  | "insights" | "scenarios" | "decision" | "followups"
  | "note" | "idea" | "list" | "file";

interface NodePickerOption {
  type: NewNodeType;
  icon: string;
  label: string;
  desc: string;
  bg: string;
  color: string;
  section: "analyse" | "karte";
}

const NODE_PICKER_OPTIONS: NodePickerOption[] = [
  // ── KI-Analyse ──────────────────────────────────────────────────────────
  { type: "query",    icon: "⌕", label: "Abfrage",       desc: "Vollständige KI-Analyse starten",        bg: "var(--color-lime)",       color: "var(--color-text-heading)",  section: "analyse" },
  { type: "insights", icon: "◉", label: "Erkenntnisse",  desc: "Kernaussagen & Muster extrahieren",       bg: "var(--pastel-mint)",       color: "var(--pastel-mint-text)",   section: "analyse" },
  { type: "scenarios",icon: "◈", label: "Szenarien",     desc: "Optimist. / wahrsch. / pessim. Zukunft",  bg: "var(--pastel-orchid)",     color: "var(--pastel-orchid-text)", section: "analyse" },
  { type: "decision", icon: "◆", label: "Empfehlung",    desc: "Konkreten Handlungsrahmen ableiten",      bg: "var(--pastel-aqua)",       color: "var(--pastel-aqua-text)",   section: "analyse" },
  { type: "followups",icon: "◎", label: "Folgefragen",   desc: "Offene Fragen & nächste Schritte",        bg: "var(--pastel-butter)",     color: "var(--pastel-butter-text)", section: "analyse" },
  // ── Karten ──────────────────────────────────────────────────────────────
  { type: "note",  icon: "✎", label: "Notiz",   desc: "Freitext, Beobachtung, Quelle",       bg: "var(--pastel-butter)",  color: "var(--pastel-butter-text)",  section: "karte" },
  { type: "idea",  icon: "◇", label: "Idee",    desc: "Hypothese, Ansatz, These",            bg: "var(--pastel-peach)",   color: "var(--pastel-peach-text)",   section: "karte" },
  { type: "list",  icon: "≡", label: "Liste",   desc: "Strukturierte Aufzählung",            bg: "var(--pastel-mint)",    color: "var(--pastel-mint-text)",    section: "karte" },
  { type: "file",  icon: "📎", label: "Datei",   desc: "Dokument, Bild oder Text hochladen", bg: "var(--pastel-blue)",    color: "var(--pastel-blue-text)",    section: "karte" },
];

const SECTION_LABELS: Record<"analyse" | "karte", string> = {
  analyse: "KI-Analyse",
  karte:   "Karte",
};

function NodePicker({ onSelect, onClose, hasContext }: {
  onSelect: (t: NewNodeType) => void;
  onClose: () => void;
  hasContext?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allOptions = NODE_PICKER_OPTIONS;
  const filtered = search.trim()
    ? allOptions.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.desc.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  useEffect(() => { setCursor(0); }, [search]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && filtered[cursor]) { onSelect(filtered[cursor].type); }
    if (e.key === "Escape") onClose();
  };

  // Group by section (only when not filtering)
  const sections = search.trim()
    ? null
    : (["analyse", "karte"] as const).map(sec => ({
        key: sec,
        label: SECTION_LABELS[sec],
        items: filtered.filter(o => o.section === sec),
      })).filter(s => s.items.length > 0);

  // Flat index mapping for cursor (sections view)
  const flatItems = sections ? sections.flatMap(s => s.items) : filtered;

  const renderItem = (item: NodePickerOption, flatIdx: number) => (
    <div key={item.type}
      onClick={() => onSelect(item.type)}
      onMouseEnter={() => setCursor(flatIdx)}
      title={item.desc}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8,
        cursor: "pointer", transition: "background 0.1s",
        background: cursor === flatIdx ? "var(--color-page-bg)" : "transparent",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 7, flexShrink: 0,
        background: item.bg, border: "1px solid rgba(0,0,0,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, color: item.color, fontWeight: 700,
      }}>
        {item.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)" }}>{item.label}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
      </div>
      {item.section === "analyse" && (
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", color: item.color, background: item.bg, border: `1px solid ${item.color}33`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>KI</span>
      )}
    </div>
  );

  return (
    <div onPointerDown={e => e.stopPropagation()}
      style={{ width: 340, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ padding: "10px 14px 9px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>⌕</span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKey}
            placeholder={hasContext ? "Iteration auswählen…" : "Typ auswählen…"}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--color-text-primary)", fontFamily: "inherit" }}
          />
        </div>
        {hasContext && (
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 5, paddingLeft: 21 }}>
            KI-Typen verwenden den Kontext der Eltern-Karte als Ausgangspunkt
          </div>
        )}
      </div>

      {/* Items — sectioned or flat */}
      <div style={{ padding: "6px 6px 4px", maxHeight: 380, overflowY: "auto" }}>
        {sections ? (
          sections.map(sec => (
            <div key={sec.key}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", padding: "6px 10px 3px", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>
                {sec.label}
              </div>
              {sec.items.map(item => renderItem(item, flatItems.indexOf(item)))}
            </div>
          ))
        ) : (
          filtered.length > 0
            ? filtered.map((item, i) => renderItem(item, i))
            : <div style={{ padding: "16px 10px", textAlign: "center", fontSize: 12, color: "var(--color-text-muted)" }}>Keine Ergebnisse</div>
        )}
      </div>

      {/* Hints */}
      <div style={{ padding: "7px 14px 9px", borderTop: "1px solid var(--color-border)", display: "flex", gap: 14 }}>
        {[["↑↓", "Navigieren"], ["↩", "Einfügen"], ["Esc", "Schließen"]].map(([k, l]) => (
          <span key={k} style={{ fontSize: 10, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "var(--color-page-bg)", border: "1px solid var(--color-border)", fontFamily: "inherit" }}>{k}</kbd>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── NoteNodeCard (compact) ────────────────────────────────────────────────

function NoteNodeCard({ node, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom,
  onUpdate: _onUpdate, onPromote: _onPromote, // editing lives in DetailPanel
}: {
  node: NoteNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onUpdate: (id: string, content: string) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  onPromote: (query: string) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
}) {
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
            <path d="M2 9 L9 2 M5 9 L9 5 M8 9 L9 8" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── IdeaNodeCard (compact) ────────────────────────────────────────────────

function IdeaNodeCard({ node, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom,
  onUpdate: _onUpdate, onPromote: _onPromote, // editing lives in DetailPanel
}: {
  node: IdeaNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onPromote: (query: string) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
}) {
  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 24, overflow: "hidden", background: "var(--pastel-peach)",
          border: `1px solid ${selected ? "#0A0A0A" : "var(--color-border, rgba(0,0,0,0.08))"}`,
          borderRadius: 6,
          userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, padding: "0 7px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <span style={{ fontSize: 9, flexShrink: 0 }}>💡</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.title || node.content.slice(0, 50) || "Idee"}</span>
      </div>
    );
  }
  const ideaColor = "#FF9800";
  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: node.customHeight ?? 300, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Idee weiterentwickeln"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${ideaColor}`, boxShadow: `0 0 8px ${ideaColor}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${ideaColor}99, 0 0 0 3px ${ideaColor}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${ideaColor}66`; }}
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
          style={{ height: 44, padding: "0 14px", cursor: "grab", flexShrink: 0, display: "flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.12)", borderTopLeftRadius: 11, borderTopRightRadius: 11 }}
        >
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: ideaColor, background: `${ideaColor}18`, border: `1px solid ${ideaColor}40`, borderRadius: 5, padding: "2px 7px", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>IDEE</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: node.title ? "var(--color-text-heading)" : "rgba(0,0,0,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.title || "Idee oder Hypothese…"}
          </span>
        </div>
        <div style={{ padding: "10px 14px 12px", flex: 1, overflow: "hidden" }}>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: node.content ? "var(--color-text-secondary)" : "rgba(0,0,0,0.3)", margin: 0, overflow: "hidden", wordBreak: "break-word" }}>
            {node.content || "Beschreibung…"}
          </p>
        </div>
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? 300, "both"); }}
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

// ── ListNodeCard (compact) ────────────────────────────────────────────────

function ListNodeCard({ node, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom,
  onUpdate: _onUpdate, // editing lives in DetailPanel
}: {
  node: ListNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onUpdate: (id: string, title: string, items: string[]) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
}) {
  const prefill = [node.title, ...node.items.filter(Boolean)].join(" · ");
  const previewItems = node.items.filter(Boolean).slice(0, 3);

  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 24, overflow: "hidden", background: "var(--pastel-mint)",
          border: `1px solid ${selected ? "#0A0A0A" : "var(--color-border, rgba(0,0,0,0.08))"}`,
          borderRadius: 6,
          userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, padding: "0 7px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <span style={{ fontSize: 10, color: "#2E7D32", fontWeight: 700, flexShrink: 0 }}>≡</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.title || "Liste"}</span>
      </div>
    );
  }

  const listColor = "#2E7D32";
  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: node.customHeight ?? LIST_NODE_W, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Als Analysekontext verwenden"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${listColor}`, boxShadow: `0 0 8px ${listColor}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${listColor}99, 0 0 0 3px ${listColor}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${listColor}66`; }}
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
          style={{ height: 44, padding: "0 14px", cursor: "grab", flexShrink: 0, display: "flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.12)", borderTopLeftRadius: 11, borderTopRightRadius: 11 }}
        >
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: listColor, background: `${listColor}18`, border: `1px solid ${listColor}40`, borderRadius: 5, padding: "2px 7px", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>LISTE</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: node.title ? "var(--color-text-heading)" : "rgba(0,0,0,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.title || "Liste…"}
          </span>
        </div>
        <div style={{ padding: "10px 14px 12px", flex: 1, overflow: "hidden" }}>
          {node.items.filter(Boolean).length > 0
            ? node.items.filter(Boolean).map((item, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.55, color: "var(--color-text-secondary)", overflow: "hidden", wordBreak: "break-word" }}>• {item}</div>
              ))
            : <span style={{ fontSize: 12, color: "rgba(0,0,0,0.3)" }}>Keine Einträge</span>
          }
        </div>
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? LIST_NODE_W, "both"); }}
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

// ── FileNodeCard ──────────────────────────────────────────────────────────

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── FileNodeCard (compact) ────────────────────────────────────────────────

function FileNodeCard({
  node, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom,
  onAnalyze: _onAnalyze, // action lives in DetailPanel
}: {
  node: FileNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v" | "both") => void;
  onAnalyze: (query: string, parentId: string) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
}) {
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
            <path d="M2 9 L9 2 M5 9 L9 5 M8 9 L9 8" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
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
  if (!trends || trends.length === 0) return null;

  const SIZE = 160;
  const cx = SIZE / 2, cy = SIZE / 2, r = 58;
  const axes = [
    { key: "relevance", label: de ? "Relevanz" : "Relevance" },
    { key: "confidence", label: de ? "Konfidenz" : "Confidence" },
    { key: "impact", label: de ? "Impact" : "Impact" },
    { key: "momentum", label: de ? "Momentum" : "Momentum" },
    { key: "density", label: de ? "Signaldichte" : "Signal Density" },
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
        {trends.length} {de ? "Trends analysiert" : "trends analyzed"} · Ø {Math.round(vals[0] * 100)}% {de ? "Relevanz" : "relevance"}
      </div>
    </div>
  );
}

// ── DimensionRadar — spider chart for 4 strategic dimensions ─────────────

function DimensionRadar({ dimData, size = 200, mini = false }: {
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
  if (!edges || edges.length === 0) return null;
  const typeColor: Record<string, string> = {
    drives: "#1A9E5A", amplifies: "#2563EB", dampens: "#E8402A", correlates: "#8B5CF6",
  };
  const typeLabel: Record<string, string> = {
    drives: de ? "treibt" : "drives",
    amplifies: de ? "verstärkt" : "amplifies",
    dampens: de ? "dämpft" : "dampens",
    correlates: de ? "korreliert" : "correlates",
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
            {dim.trends.map(t => (
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
  if (scenarios.length < 2) return null;
  const sorted = [...scenarios].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  return (
    <div style={{ marginBottom: 24, padding: "16px 18px 18px", background: "rgba(0,0,0,0.025)", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 14 }}>
        {de ? "Szenario-Vergleich" : "Scenario Comparison"}
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

interface DetailPanelProps {
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

function DetailPanel({
  node, de, allQueryNodes, onClose, onFollowUp, onRefresh, onExplore, onDelete,
  onUpdateNote, onUpdateIdea, onUpdateList, onPromoteNote, onPromoteIdea,
  onAnalyzeFile, onIterate, onSetStatus, onUpdateTags, siblingScenarios,
}: DetailPanelProps) {
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
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0A0A0A", background: "#E4FF97", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{de ? "IHRE FRAGE" : "YOUR QUERY"}</span>
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
          placeholder={de ? "Idee oder Hypothese…" : "Idea or hypothesis…"}
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
          placeholder={de ? "Listen-Titel…" : "List title…"}
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
    const badge = type === "insight" ? (de ? "ERKENNTNIS" : "INSIGHT")
      : type === "decision" ? (de ? "EMPFEHLUNG" : "DECISION")
      : type === "followup" ? (de ? "FOLGEFRAGE" : "FOLLOW-UP")
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
            <CollapsibleSection title={`${de ? "Live-Signale & Kontext" : "Live Signals & Context"}${r?.usedSignals?.length ? ` (${r.usedSignals.length})` : ""}`} accent="#2563EB">
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
                        <Tooltip content={signalDate ? signalDate.toLocaleString("de-DE") : (de ? "Unbekannt" : "Unknown")} placement="top">
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
            <CollapsibleSection title={de ? "Synthese — KI-Analyse" : "Synthesis — AI Analysis"}>
              {r?.confidence != null && r.confidence > 0 && (
                <div style={{ marginBottom: 8 }}><ConfidenceBadge value={r.confidence} de={de} /></div>
              )}
              <div style={{ marginBottom: 4 }}>
                <FormattedText text={qNode.synthesis ?? ""} fontSize={14} lineHeight={1.78} color="var(--color-text-primary)" />
                {qNode.status === "streaming" && (
                  <span style={{ display: "inline-block", width: 2, height: "0.9em", background: "#0A0A0A", marginLeft: 2, animation: "cur-blink 0.8s steps(1) infinite", verticalAlign: "text-bottom" }} />
                )}
                {qNode.status === "loading" && <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{de ? "Analysiere…" : "Analyzing…"}</span>}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Radar ─────────────────────────────────────────────── */}
          {r?.matchedTrends && r.matchedTrends.length > 0 && (
            <CollapsibleSection title={de ? "Radar — Analyseprofil" : "Radar — Analysis Profile"} defaultOpen={false}>
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
            <CollapsibleSection title={de ? "Kohärenzen" : "Coherences"} accent="#8B5CF6" defaultOpen={false}>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                {de ? "Geteilte Trends mit anderen Analysen auf diesem Canvas:" : "Shared trends with other analyses on this canvas:"}
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
            <CollapsibleSection title={de ? "Kausalnetz" : "Causal Network"} accent="#1A9E5A" defaultOpen={false}>
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
            <CollapsibleSection title={de ? "Kernerkenntnisse" : "Key Insights"}>
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
            <CollapsibleSection title={de ? "Szenarien" : "Scenarios"}>
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
            <CollapsibleSection title={de ? "Demografischer Kontext" : "Demographic Context"} accent="#0369A1" defaultOpen={false}>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                {de ? "Demographisch relevante Trends dieser Analyse:" : "Demographically relevant trends in this analysis:"}
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
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{Math.round(Math.max(0, Math.min(1, t.relevance)) * 100)}% {de ? "Rel." : "rel."}</span>
                  </div>
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Strategische Interpretation ───────────────────────── */}
          {r?.interpretation && (
            <CollapsibleSection title={de ? "Strategische Interpretation" : "Strategic Interpretation"} accent="#0A3A20">
              <div style={{ padding: "10px 14px", background: "#F4FBF7", borderRadius: 8 }}>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-secondary)", margin: 0 }}>{r.interpretation}</p>
              </div>
            </CollapsibleSection>
          )}

          {/* ── Entscheidungshilfe ────────────────────────────────── */}
          {r?.decisionFramework && (
            <CollapsibleSection title={de ? "Entscheidungshilfe" : "Decision Framework"} accent="#1D4ED8">
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
            <CollapsibleSection title={de ? "Regulierung" : "Regulatory Context"} defaultOpen={false}>
              {r.regulatoryContext.map((reg, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.55, color: "var(--color-text-secondary)", marginBottom: 5, paddingLeft: 8 }}>{reg}</div>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Folgefragen ───────────────────────────────────────── */}
          {r?.followUpQuestions && r.followUpQuestions.length > 0 && (
            <CollapsibleSection title={de ? "Folgefragen" : "Follow-up Questions"} defaultOpen={false}>
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
            <CollapsibleSection title={de ? "Quellen" : "References"} defaultOpen={false}>
              {r.references.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-brand)", textDecoration: "none", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = "underline"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = "none"}
                ><ExternalLink size={11} style={{ flexShrink: 0 }} /> {ref.title}</a>
              ))}
            </CollapsibleSection>
          )}

          {/* ── Tags (editable) ─────────────────────────────────── */}
          <CollapsibleSection title={`Tags${qNode.tags?.length ? ` (${qNode.tags.length})` : ""}`} accent="#8B5CF6" defaultOpen={!!(qNode.tags && qNode.tags.length > 0)}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {(qNode.tags ?? []).map((tag, i) => {
                const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                return (
                  <span key={i} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 12,
                    background: `hsl(${hue}, 55%, 94%)`, border: `1px solid hsl(${hue}, 45%, 82%)`,
                    color: `hsl(${hue}, 55%, 38%)`, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {tag}
                    <button onClick={() => onUpdateTags(qNode.id, (qNode.tags ?? []).filter(t => t !== tag))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 12, color: `hsl(${hue}, 55%, 50%)`, lineHeight: 1 }}>×</button>
                  </span>
                );
              })}
            </div>
            <TagInlineInput nodeId={qNode.id} de={de} onAddTag={(id, tag) => {
              const trimmed = tag.trim().toLowerCase();
              if (!trimmed) return;
              const existing = qNode.tags ?? [];
              if (!existing.includes(trimmed)) onUpdateTags(id, [...existing, trimmed]);
            }} />
          </CollapsibleSection>

          {/* ── System-Prompt (read-only) ─────────────────────────── */}
          <CollapsibleSection title={de ? "Analyse-Parameter" : "Analysis Parameters"} accent="#6B7280" defaultOpen={false}>
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
                  <span>{r.matchedTrends.length} {de ? "abgeglichen" : "matched"}</span>
                </div>
              )}
              {r?.usedSignals && (
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", width: 60 }}>Signale</span>
                  <span>{r.usedSignals.length} {de ? "verarbeitet" : "processed"}</span>
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
            {age !== "fresh" && <span style={{ marginLeft: 8, color: age === "stale" ? "#F5A623" : "rgba(245,166,35,0.6)" }}>{age === "stale" ? (de ? "· Veraltet" : "· Stale") : (de ? "· Altert" : "· Aging")}</span>}
          </div>
        </div>
      );
    }

    if (node.nodeType === "note") return (
      <div style={{ padding: "8px 40px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
        <textarea
          value={noteDraft}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder={de ? "Notiz hinzufügen…" : "Add note…"}
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
          placeholder={de ? "Beschreibung, Begründung oder nächste Schritte…" : "Description, rationale or next steps…"}
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
              >{item || (de ? "Eintrag…" : "Item…")}</span>
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
        >+ {de ? "Eintrag" : "Item"}</button>
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
              <GraphLightbox title={de ? "Kausalnetz — Vollbild" : "Causal Graph — Fullscreen"} style={{ borderRadius: 8, overflow: "hidden" }}>
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
            <span style={{ fontSize: 11, color: scenCfg?.color ?? "#1D4ED8", fontWeight: 600 }}>{Math.round(dNode.probability * 100)}% {de ? "Wahrscheinlichkeit" : "probability"}</span>
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
        aria-label={de ? "Status" : "Status"}
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
            <Tooltip content={de ? "Folgefrage generieren und Analyse vertiefen" : "Generate follow-up question to deepen analysis"} placement="top">
              <button onClick={() => onFollowUp(node.id)} style={{ ...btnBase, border: "1px solid rgba(0,0,0,0.12)", background: "#E4FF97", color: "#0A0A0A" }}>{de ? "Weiterdenken" : "Follow up"}</button>
            </Tooltip>
            {qNode.status === "done" && (
              <Tooltip content={de ? "Analyse mit aktuellen Daten neu berechnen" : "Re-run analysis with latest data"} placement="top">
                <button onClick={() => onRefresh(node.id)}
                  style={{ ...btnBase, display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${age === "stale" ? "rgba(245,166,35,0.4)" : "var(--color-border)"}`, background: "transparent", color: age === "stale" ? "#F5A623" : "var(--color-text-muted)" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(245,166,35,0.1)"; el.style.color = "#F5A623"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = age === "stale" ? "#F5A623" : "var(--color-text-muted)"; }}
                ><RefreshCw size={12} /> {de ? "Aktualisieren" : "Refresh"}</button>
              </Tooltip>
            )}
            {qNode.status === "error" && (
              <Tooltip content={de ? "Fehlgeschlagene Analyse erneut versuchen" : "Retry failed analysis"} placement="top">
                <button onClick={() => onRefresh(node.id)} style={{ ...btnBase, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#E8402A" }}><RotateCcw size={12} /> Retry</button>
              </Tooltip>
            )}
            {qNode.synthesis && (
              <Tooltip content={de ? "Synthese in Zwischenablage kopieren" : "Copy synthesis to clipboard"} placement="top">
                <button onClick={() => copyText(qNode.synthesis)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              </Tooltip>
            )}
            <Tooltip content={de ? "Karte und alle Ableitungen entfernen" : "Remove card and all derived nodes"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
            <Tooltip content={de ? "Notiz als strategische Abfrage weiterverarbeiten" : "Convert note into strategic query"} placement="top">
              <button onClick={() => onPromoteNote(noteDraft)} disabled={!noteDraft.trim()}
                style={{ ...btnBase, border: "1px solid rgba(249,168,37,0.3)", background: "rgba(249,168,37,0.1)", color: "#B45309", opacity: noteDraft.trim() ? 1 : 0.4 }}
              >{de ? "Als Abfrage" : "As Query"}</button>
            </Tooltip>
            <Tooltip content={de ? "Inhalt überarbeiten und neu formulieren" : "Rework and reformulate content"} placement="top">
              <button onClick={() => onIterate(node.id, noteDraft)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 4 }}><RotateCcw size={11} /> rethink</button>
            </Tooltip>
            <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
            <Tooltip content={de ? "Idee als strategische Abfrage weiterverarbeiten" : "Convert idea into strategic query"} placement="top">
              <button onClick={() => onPromoteIdea(ideaText)} disabled={!ideaText.trim()}
                style={{ ...btnBase, border: "1px solid rgba(255,152,0,0.3)", background: "rgba(255,152,0,0.08)", color: "#E65100", opacity: ideaText.trim() ? 1 : 0.4 }}
              >{de ? "Als Abfrage" : "As Query"}</button>
            </Tooltip>
            <Tooltip content={de ? "Inhalt überarbeiten und neu formulieren" : "Rework and reformulate content"} placement="top">
              <button onClick={() => onIterate(node.id, ideaText)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 4 }}><RotateCcw size={11} /> rethink</button>
            </Tooltip>
            <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
            <Tooltip content={de ? "Inhalt überarbeiten und neu formulieren" : "Rework and reformulate content"} placement="top">
              <button onClick={() => onIterate(node.id, listText)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 4 }}><RotateCcw size={11} /> rethink</button>
            </Tooltip>
            <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
              <Tooltip content={de ? "Datei in neuem Tab öffnen" : "Open file in new tab"} placement="top">
                <a href={fNode.fileUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(74,108,247,0.25)", background: "transparent", color: "rgba(74,108,247,0.8)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                ><ExternalLink size={12} /> {de ? "Öffnen" : "Open"}</a>
              </Tooltip>
            )}
            {(fNode.textContent || isImage) && (
              <Tooltip content={de ? "Dateiinhalt mit KI analysieren" : "Analyze file content with AI"} placement="top">
                <button onClick={() => onAnalyzeFile(analyzeText, node.id)}
                  style={{ ...btnBase, border: "1px solid rgba(74,108,247,0.3)", background: "rgba(74,108,247,0.08)", color: "#4A6CF7" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(74,108,247,0.18)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(74,108,247,0.08)"}
                >{de ? "Analysieren" : "Analyze"}</button>
              </Tooltip>
            )}
            <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
        { label: de ? "VERTIEFEN" : "DEEPEN", icon: <Search size={12} />, tip: de ? "Tiefenanalyse: Treiber und Implikationen dieses Szenarios genauer untersuchen" : "Deep-dive: Analyze drivers and implications of this scenario", prefill: `Vertiefen: ${scenName} — detaillierte Analyse der Treiber und Implikationen`, color: "#1A9E5A" },
        { label: de ? "WAS WENN" : "WHAT IF", icon: <GitBranch size={12} />, tip: de ? "Sensitivitätstest: Was passiert wenn ein Schlüsseltreiber wegfällt?" : "Sensitivity test: What happens if a key driver disappears?",       prefill: `Was wenn: ${firstDriver} wegfällt — wie verändert sich das Szenario?`,       color: "#2563EB" },
        { label: de ? "ANGREIFEN" : "CHALLENGE", icon: <ShieldAlert size={12} />, tip: de ? "Kritische Prüfung: Welche Annahmen könnten falsch sein?" : "Critical review: Which assumptions could be wrong?",             prefill: `Kritisch: Welche Annahmen in '${scenName}' könnten falsch sein?`,             color: "#E8402A" },
        { label: de ? "STRATEGIE" : "STRATEGY", icon: <Compass size={12} />, tip: de ? "Handlungsoptionen: Konkrete Maßnahmen für dieses Szenario ableiten" : "Strategy: Derive concrete actions for this scenario",               prefill: `Spielplan: Gegeben '${scenName}' — konkrete Handlungsoptionen`,               color: "#8B5CF6" },
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
            <Tooltip content={de ? "Szenario-Karte entfernen" : "Remove scenario card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
            <Tooltip content={de ? "STEEP+V-Dimensionen weiter analysieren" : "Further analyze STEEP+V dimensions"} placement="top">
              <button onClick={() => onIterate(node.id, dNode.queryText)}
                style={{ ...btnBase, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#3b82f6" }}
              >{de ? "Dimensionen vertiefen" : "Deepen dimensions"}</button>
            </Tooltip>
            <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
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
            <Tooltip content={de ? "Kausale Zusammenhänge und Treiber tiefer untersuchen" : "Deep-dive into causal relationships and drivers"} placement="top">
              <button onClick={() => onIterate(node.id, dNode.queryText)}
                style={{ ...btnBase, border: "1px solid rgba(26,158,90,0.3)", background: "rgba(26,158,90,0.08)", color: "#1A9E5A" }}
              >{de ? "Kausaltreiber vertiefen" : "Explore causal drivers"}</button>
            </Tooltip>
            <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
              <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{de ? "Löschen" : "Delete"}</button>
            </Tooltip>
          </div>
        </>
      );
    }

    const btnLabel = type === "followup" ? (de ? "Vertiefen" : "Explore")
      : type === "decision" ? (de ? "Umsetzen" : "Implement")
      : (de ? "Analysieren" : "Analyze");
    const btnTip = type === "followup" ? (de ? "Erkenntnis als neue Abfrage weiterverfolgen" : "Follow up on this insight with a new query")
      : type === "decision" ? (de ? "Handlungsempfehlung als Abfrage konkretisieren" : "Concretize recommendation as query")
      : (de ? "Inhalt als neue Analyse weiterverarbeiten" : "Process content as new analysis");
    return (
      <>
        {renderStatusSelector()}
        <div style={{ padding: "12px 40px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Tooltip content={btnTip} placement="top">
            <button onClick={() => onExplore(node.id, dNode.queryText)}
              style={{ ...btnBase, border: "1px solid rgba(0,0,0,0.1)", background: "#E4FF97", color: "#0A0A0A" }}
            >{btnLabel}</button>
          </Tooltip>
          <Tooltip content={de ? "Inhalt überarbeiten und neu formulieren" : "Rework and reformulate content"} placement="top">
            <button onClick={() => onIterate(node.id, dNode.queryText)} style={{ ...btnMuted, display: "inline-flex", alignItems: "center", gap: 4 }}><RotateCcw size={11} /> rethink</button>
          </Tooltip>
          <Tooltip content={de ? "Karte entfernen" : "Remove card"} placement="top">
            <button onClick={() => { onDelete(node.id); onClose(); }} style={btnDelete}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#E8402A"; el.style.borderColor = "#FCA5A5"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
            >{de ? "Löschen" : "Delete"}</button>
          </Tooltip>
        </div>
      </>
    );
  };

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{
        position: "fixed",
        left: "50%", top: 72,
        transform: "translateX(-50%)",
        width: "min(880px, calc(100vw - 48px))",
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
          title={de ? "Schließen (Esc)" : "Close (Esc)"}
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

const MINIMAP_W = 160;
const MINIMAP_H = 90;
// Node colors from central colors.ts — used in minimap, timeline, orbit
const NODE_MINIMAP_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_COLORS).map(([k, v]) => [k, v.color])
);

function Minimap({ nodes, panX, panY, zoom, viewportW, viewportH, onNavigate, rightOffset }: {
  nodes: CanvasNode[];
  panX: number; panY: number; zoom: number;
  viewportW: number; viewportH: number;
  onNavigate: (panX: number, panY: number) => void;
  rightOffset: number;
}) {
  if (nodes.length === 0) return null;

  const PAD = 200;
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const maxX = Math.max(...xs) + PAD;
  const maxY = Math.max(...ys) + PAD;
  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);

  const scaleX = MINIMAP_W / contentW;
  const scaleY = MINIMAP_H / contentH;
  const scale = Math.min(scaleX, scaleY);

  const toMX = (cx: number) => (cx - minX) * scale;
  const toMY = (cy: number) => (cy - minY) * scale;

  const vpLeft = (-panX / zoom - minX) * scale;
  const vpTop = (-panY / zoom - minY) * scale;
  const vpW = (viewportW / zoom) * scale;
  const vpH = (viewportH / zoom) * scale;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasX = mx / scale + minX;
    const canvasY = my / scale + minY;
    onNavigate(-(canvasX - viewportW / zoom / 2) * zoom, -(canvasY - viewportH / zoom / 2) * zoom);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "absolute", bottom: 16, right: rightOffset,
        width: MINIMAP_W, height: MINIMAP_H,
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px) saturate(160%)",
        WebkitBackdropFilter: "blur(12px) saturate(160%)",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        zIndex: 40,
        cursor: "crosshair",
      }}
    >
      {nodes.map(n => (
        <div key={n.id} style={{
          position: "absolute",
          left: toMX(n.x), top: toMY(n.y),
          width: 4, height: 4,
          borderRadius: "50%",
          background: NODE_MINIMAP_COLOR[n.nodeType] ?? "#888",
        }} />
      ))}
      <div style={{
        position: "absolute",
        left: vpLeft, top: vpTop,
        width: Math.max(vpW, 8), height: Math.max(vpH, 8),
        border: "1.5px solid rgba(255,255,255,0.9)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
        borderRadius: 2,
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CanvasPage() {
  // Check URL params for embedded mode — must be in useEffect to avoid hydration mismatch
  const [embedded, setEmbedded] = useState(false);
  const [hydrated, setHydrated] = useState(false); // prevents flash of empty-state before embedded check
  const [initialView, setInitialView] = useState<"canvas" | "board">("canvas");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embedded") === "1") setEmbedded(true);
    if (params.get("view") === "board") {
      setInitialView("board");
      setViewMode("board");
    }
    setHydrated(true);
  }, []);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const { locale } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orbitSubMode, setOrbitSubMode] = useState<"ableitung" | "netzwerk">("ableitung");
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cmdVisible, setCmdVisible] = useState(false);
  const [cmdParentId, setCmdParentId] = useState<string | null>(null);
  const [cmdPrefill, setCmdPrefill] = useState("");
  const [nodePickerVisible, setNodePickerVisible] = useState(false);
  const [iterateCtx, setIterateCtx] = useState<{ parentId: string; prefill: string } | null>(null);
  const iterateCtxRef = useRef<{ parentId: string; prefill: string } | null>(null);

  // ── Template picker + Workflow ───────────────────────────────────────────
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateTopic, setTemplateTopic] = useState("");
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowState | null>(null);

  // ── Project state ─────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectOp, setProjectOp] = useState<"creating" | "deleting" | "loading" | null>(null);

  const [hiddenLayers, setHiddenLayers] = useState<Set<CanvasLayer>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(initialView ?? "canvas");
  const [viewportSize, setViewportSize] = useState({ w: 1200, h: 800 });
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingText, setBriefingText] = useState("");
  const [briefingLoading, setBriefingLoading] = useState(false);

  // FIXED: DAT-08 / EDGE-09 — Concurrent tab detection via BroadcastChannel
  const [concurrentTabWarning, setConcurrentTabWarning] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return; // SSR / unsupported browser guard
    const channel = new BroadcastChannel("sis-canvas");
    const tabId = Date.now();
    channel.postMessage({ type: "tab-active", tabId });
    channel.onmessage = (e) => {
      if (e.data?.type === "tab-active" && e.data.tabId !== tabId) {
        setConcurrentTabWarning(true);
      }
    };
    return () => channel.close();
  }, []);

  // UX-11: Snap-to-grid toggle
  const [snapToGrid, setSnapToGrid] = useState(false);

  // UX-12: Copy/paste clipboard for nodes
  const clipboardRef = useRef<CanvasNode[]>([]);

  // Feature: Sort/Arrange dropdown
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Feature: Manual groups + multi-select
  const [userGroups, setUserGroups] = useState<CanvasGroup[]>([]);
  const userGroupsRef = useRef(userGroups);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const shiftHeldRef = useRef(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Feature: Tag filter
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [connVisMode, setConnVisMode] = useState<"auto" | "show" | "hide">("auto");

  const de = locale === "de";
  const queryNodes = useMemo(() => nodes.filter((n): n is QueryNode => n.nodeType === "query"), [nodes]);
  const isEmpty = nodes.length === 0;

  // Refs for pointer events and DB save
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const nodesRef = useRef(nodes);
  const isDirtyRef = useRef(false);
  const connectionsRef = useRef(connections);
  const projectIdRef = useRef(projectId);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; panYRef.current = panY; }, [panX, panY]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { iterateCtxRef.current = iterateCtx; }, [iterateCtx]);
  useEffect(() => { userGroupsRef.current = userGroups; }, [userGroups]);
  // UX-11: Snap-to-grid ref for pointer handler closure
  const snapToGridRef = useRef(snapToGrid);
  useEffect(() => { snapToGridRef.current = snapToGrid; }, [snapToGrid]);

  // ── Per-view-mode pan/zoom transforms ────────────────────────────────────
  const viewTransformsRef = useRef<Record<string, { x: number; y: number; z: number }>>({});

  const draggingRef  = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizingRef  = useRef<{ id: string; dir: "h" | "v" | "both"; startX: number; startW: number; startY: number; startH: number } | null>(null);
  const panningRef   = useRef<{ sx: number; sy: number; opx: number; opy: number } | null>(null);
  const viewportRef  = useRef<HTMLDivElement>(null);
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Auto-naming: track whether session has been auto-renamed after first query ──
  const hasAutoNamedRef = useRef(false);

  // ── Active stream abort controllers (keyed by node ID) ────────────────────
  const activeStreamsRef = useRef<Map<string, AbortController>>(new Map());

  // ── File upload refs ──────────────────────────────────────────────────────
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const fileUploadPosRef = useRef<{ x: number; y: number } | null>(null);
  const fileUploadParentRef = useRef<string | null>(null);

  // ── Port drag refs ─────────────────────────────────────────────────────────
  const portDragRef = useRef<{
    nodeId: string;
    prefill: string;
    sourceCanvasX: number;
    sourceCanvasY: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const [portDragPreview, setPortDragPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const portDropCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const [nodePickerPos, setNodePickerPos] = useState<{ x: number; y: number } | null>(null); // viewport coords
  const nextQueryPosOverrideRef = useRef<{ x: number; y: number } | null>(null);

  // ── Undo / Redo history ─────────────────────────────────────────────────
  const historyRef = useRef<{ nodes: CanvasNode[]; connections: Connection[] }[]>([]);
  const historyIndexRef = useRef(-1);
  const MAX_HISTORY = 50;

  const pushHistory = useCallback(() => {
    const snapshot = { nodes: [...nodesRef.current], connections: [...connectionsRef.current] };
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    isDirtyRef.current = true;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const snapshot = historyRef.current[historyIndexRef.current];
      setNodes(snapshot.nodes);
      setConnections(snapshot.connections);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const snapshot = historyRef.current[historyIndexRef.current];
      setNodes(snapshot.nodes);
      setConnections(snapshot.connections);
    }
  }, []);

  // ── Project API functions ─────────────────────────────────────────────────

  const showProjectError = useCallback((msg: string) => {
    setProjectError(msg);
    console.error("[SIS Canvas]", msg);
    setTimeout(() => setProjectError(null), 6000);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetchWithTimeout("/api/v1/canvas");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProjects((json.data ?? json).canvases ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        showProjectError(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        showProjectError(de ? `Projekte laden fehlgeschlagen: ${(e as Error).message}` : `Failed to load projects: ${(e as Error).message}`);
      }
    }
  }, [de, showProjectError]);

  const saveCanvasToDb = useCallback(async (id: string) => {
    setSaveStatus("saving");
    try {
      const state = {
        nodes: nodesRef.current.filter(n =>
          n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error"
        ),
        conns: connectionsRef.current,
        pan: { x: panXRef.current, y: panYRef.current },
        zoom: zoomRef.current,
        v: 2,
        _schemaVersion: CANVAS_SCHEMA_VERSION, // FIXED: EDGE-08 — Include schema version in saved state
        userGroups: userGroupsRef.current.length > 0 ? userGroupsRef.current : undefined,
      };
      await fetchWithTimeout(`/api/v1/canvas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: state }),
      });
      setSaveStatus("saved");
      isDirtyRef.current = false;
      // Refresh project list to update updated_at
      setProjects(prev => prev.map(p =>
        p.id === id ? { ...p, updated_at: new Date().toISOString(), hasState: true } : p
      ));
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 4000);
    }
  }, []);

  const createNewProject = useCallback(async () => {
    const name = window.prompt(de ? "Projektname:" : "Project name:", de ? "Neues Projekt" : "New project");
    if (!name?.trim()) return;
    setProjectOp("creating");
    try {
      const res = await fetchWithTimeout("/api/v1/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const newCanvas = (json.data ?? json).canvas;
      if (!newCanvas?.id) throw new Error("API returned no canvas ID");
      setProjectId(newCanvas.id);
      setProjectName(name.trim());
      setNodes([]); setConnections([]);
      setPanX(0); setPanY(0); setZoom(1);
      setSelectedId(null); setCmdVisible(false);
      setSaveStatus(null);
      hasAutoNamedRef.current = false;
      try { localStorage.setItem("sis-active-canvas", newCanvas.id); } catch {}
      try { window.history.replaceState(null, "", `/canvas?project=${newCanvas.id}`); } catch {}
      await loadProjects();
      // Show template picker for the new project
      setShowTemplatePicker(true);
      setTemplateTopic("");
    } catch (e) {
      showProjectError(de ? `Projekt erstellen fehlgeschlagen: ${(e as Error).message}` : `Failed to create project: ${(e as Error).message}`);
    } finally {
      setProjectOp(null);
    }
  }, [de, loadProjects, showProjectError]);

  const loadProject = useCallback(async (id: string) => {
    // FIXED: DAT-07 — Check for unsaved changes before switching projects
    if (dbSaveTimerRef.current && projectIdRef.current && projectIdRef.current !== id) {
      const confirmSwitch = window.confirm(
        de ? "Ungespeicherte Änderungen. Trotzdem wechseln?" : "Unsaved changes. Switch anyway?"
      );
      if (!confirmSwitch) return;
      // FIXED: DAT-06 — Flush pending save before project switch
      clearTimeout(dbSaveTimerRef.current);
      dbSaveTimerRef.current = undefined;
      // Save old project immediately before switching
      await saveCanvasToDb(projectIdRef.current);
    }
    setProjectOp("loading");
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`);
      if (res.status === 404) {
        // Project was deleted — clear stale references
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        try { localStorage.removeItem("sis-active-canvas"); } catch {}
        try { localStorage.removeItem("sis-history-v2"); } catch {}
        setProjectId(null); setProjectName(""); setSaveStatus(null);
        setNodes([]); setConnections([]);
        setPanX(0); setPanY(0); setZoom(1);
        setProjects(prev => prev.filter(p => p.id !== id));
        // Clear stale ?project= from URL so reload doesn't retry a dead ID
        try { window.history.replaceState(null, "", "/canvas"); } catch {}
        showProjectError(de ? "Projekt existiert nicht mehr." : "Project no longer exists.");
        setProjectOp(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const canvas = (json.data ?? json).canvas;
      if (!canvas) throw new Error("Canvas not found");
      setProjectId(id);
      setProjectName(canvas.name);
      setSaveStatus(null);
      // Reset auto-naming flag so the next first-query can rename this session
      hasAutoNamedRef.current = false;
      try { localStorage.setItem("sis-active-canvas", id); } catch {}
      // Keep URL in sync so bookmarks / refresh / back-button all work
      try { window.history.replaceState(null, "", `/canvas?project=${id}`); } catch {}
      const canvasState = canvas.canvas_state;
      if (!canvasState || canvasState === 'null' || canvasState === '{}' || canvasState.trim() === '') {
        setNodes([]); setConnections([]);
        setPanX(0); setPanY(0); setZoom(1);
      } else {
        try {
          const state = JSON.parse(canvasState);
          if (!state || typeof state !== "object") throw new Error("Invalid canvas state structure");
          if (state.v !== 2) {
            setNodes([]); setConnections([]);
            setPanX(0); setPanY(0); setZoom(1);
          } else {
            // FIXED: EDGE-08 — Schema version mismatch check
            if (state._schemaVersion !== undefined && state._schemaVersion !== CANVAS_SCHEMA_VERSION) {
              console.warn("[SIS Canvas] Schema version mismatch:", state._schemaVersion, "->", CANVAS_SCHEMA_VERSION);
              // TODO: EDGE-08 — Add migration functions for schema version upgrades
            }
            if (Array.isArray(state.nodes)) setNodes(state.nodes); else setNodes([]);
            if (Array.isArray(state.conns)) setConnections(state.conns); else setConnections([]);
            if (state.pan) { setPanX(state.pan.x); setPanY(state.pan.y); }
            if (state.zoom) setZoom(state.zoom);
            if (Array.isArray(state.userGroups)) setUserGroups(state.userGroups); else setUserGroups([]);
          }
        } catch (parseErr) {
          console.error("[SIS Canvas] Failed to parse canvas_state:", parseErr);
          setNodes([]); setConnections([]);
          setPanX(0); setPanY(0); setZoom(1);
        }
      }
      setProjectDropdownOpen(false);
    } catch (e) {
      showProjectError(de ? `Projekt laden fehlgeschlagen: ${(e as Error).message}` : `Failed to load project: ${(e as Error).message}`);
    } finally {
      setProjectOp(null);
    }
  }, [de, showProjectError]);

  const saveProjectName = useCallback(async () => {
    setEditingName(false);
    if (!projectId || !projectName.trim()) return;
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: projectName.trim() } : p));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        showProjectError(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        showProjectError(de ? `Umbenennen fehlgeschlagen: ${(e as Error).message}` : `Rename failed: ${(e as Error).message}`);
      }
    }
  }, [projectId, projectName, de, showProjectError]);

  const deleteProject = useCallback(async (id: string) => {
    if (!window.confirm(de ? "Projekt unwiderruflich löschen?" : "Delete project permanently?")) return;
    setProjectOp("deleting");
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (projectId === id) {
        setProjectId(null); setProjectName(""); setSaveStatus(null);
        setNodes([]); setConnections([]);
        try { localStorage.removeItem("sis-active-canvas"); } catch {}
        // Clear ?project= from URL so refresh shows empty state, not a dead ID
        try { window.history.replaceState(null, "", "/canvas"); } catch {}
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        showProjectError(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        showProjectError(de ? `Löschen fehlgeschlagen: ${(e as Error).message}` : `Delete failed: ${(e as Error).message}`);
      }
    } finally {
      setProjectOp(null);
    }
  }, [de, projectId, showProjectError]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    // locale is fixed to "de" for now

    loadProjects();

    // Check if transferring an analysis from main page
    const transferRaw = (() => { try { const v = localStorage.getItem("sis-transfer-to-canvas"); localStorage.removeItem("sis-transfer-to-canvas"); return v; } catch { return null; } })();
    if (transferRaw) {
      try {
        const { query, result } = JSON.parse(transferRaw);
        if (query && result) {
          const id = `transfer-${Date.now()}`;
          const qNode: QueryNode = {
            id, nodeType: "query", x: 80, y: 80,
            query, locale: "de", status: "done",
            synthesis: result.synthesis ?? "",
            result, collapsed: false, createdAt: Date.now(),
          };
          const derived = computeDerivedNodes(id, 80, 80, result);
          const conns: Connection[] = derived.map(d => ({ from: id, to: d.id, derived: true }));
          setNodes([qNode, ...derived]);
          setConnections(conns);
          setZoom(0.7);
          return; // skip all other init paths
        }
      } catch { /* ignore malformed transfer data */ }
    }

    // Resolve which project to load: URL param > one-shot localStorage > persisted active canvas
    const urlProjectId = (() => { try { return new URLSearchParams(window.location.search).get("project"); } catch { return null; } })();
    const fromProjects = (() => { try { const v = localStorage.getItem("sis-canvas-project"); localStorage.removeItem("sis-canvas-project"); return v; } catch { return null; } })();
    const activeId = urlProjectId ?? fromProjects ?? (() => { try { return localStorage.getItem("sis-active-canvas"); } catch { return null; } })();

    if (activeId) {
      // Persist immediately so localStorage is in sync with the URL param
      try { localStorage.setItem("sis-active-canvas", activeId); } catch {}
      // Use the proper loadProject function which handles schema versions,
      // error states, 404 cleanup, and localStorage persistence correctly.
      loadProject(activeId);
    } else {
      // No project to load — try localStorage node cache or show empty state
      const saved = loadFromStorage();
      if (saved && saved.nodes.length > 0) {
        setNodes(saved.nodes); setConnections(saved.conns);
        setPanX(saved.pan.x); setPanY(saved.pan.y); setZoom(saved.zoom);
      } else {
        setNodes([]);
        setConnections([]);
        setZoom(1);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed the undo history with the initial state once nodes are loaded
  const historySeededRef = useRef(false);
  useEffect(() => {
    if (!historySeededRef.current && nodesRef.current.length > 0) {
      historySeededRef.current = true;
      pushHistory();
    }
  }, [nodes, pushHistory]);

  // Viewport size tracking (for Minimap)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(() => {
      setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleLayer = useCallback((layer: CanvasLayer) => {
    setHiddenLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer); else next.add(layer);
      return next;
    });
  }, []);

  const handleSetNodeStatus = useCallback((id: string, status: NodeStatus) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, nodeStatus: status } : n));
  }, []);

  const handleSetTags = useCallback((id: string, tags: string[]) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, tags } : n));
  }, []);

  const handleAddTag = useCallback((id: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const existing = (n as CanvasNode & { tags?: string[] }).tags ?? [];
      if (existing.includes(trimmed)) return n;
      return { ...n, tags: [...existing, trimmed] };
    }));
  }, []);

  const handleRemoveTag = useCallback((id: string, tag: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const existing = (n as CanvasNode & { tags?: string[] }).tags ?? [];
      return { ...n, tags: existing.filter(t => t !== tag) };
    }));
  }, []);

  const pipelineChain = useMemo<Set<string>>(() => {
    if (!selectedId) return new Set();
    const visited = new Set<string>();
    const queue = [selectedId];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      connections.forEach(c => {
        if (c.from === id && !visited.has(c.to)) queue.push(c.to);
        if (c.to === id && !visited.has(c.from)) queue.push(c.from);
      });
    }
    return visited;
  }, [selectedId, connections]);

  const visibleNodes = useMemo(() =>
    nodes.filter(n => !hiddenLayers.has(NODE_LAYER[n.nodeType] ?? "karte")),
  [nodes, hiddenLayers]);

  // Collect all unique tags across all nodes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach(n => { (n.tags ?? []).forEach(t => tagSet.add(t)); });
    return Array.from(tagSet).sort();
  }, [nodes]);

  const canvasGroups = useMemo<CanvasGroup[]>(() => {
    const doneQueries = queryNodes.filter(n => n.status === "done" && (n.result?.matchedTrendIds?.length ?? 0) > 0);
    if (doneQueries.length < 2) return [];

    const groups: Set<string>[] = [];
    doneQueries.forEach(q => {
      const myIds = new Set(q.result!.matchedTrendIds!);
      let merged = false;
      for (const g of groups) {
        const gNodes = [...g].map(id => doneQueries.find(n => n.id === id)!).filter(Boolean);
        const gIds = new Set(gNodes.flatMap(n => n.result!.matchedTrendIds!));
        const shared = [...myIds].filter(id => gIds.has(id)).length;
        if (shared >= 2) { g.add(q.id); merged = true; break; }
      }
      if (!merged) groups.push(new Set([q.id]));
    });

    const colors = ["#1A9E5A", "#2563EB", "#8B5CF6", "#F97316", "#0369A1"];
    return groups.filter(g => g.size >= 2).map((g, i) => {
      const gNodeIds = [...g];
      // Bounds must cover the queries AND every descendant (insights,
      // scenarios, decisions, causalgraph, …). Otherwise the group outline
      // ends at the query row while the actual derived cards sit outside.
      // `nodeIds` stays query-only (used for tag dimming / membership checks),
      // but `boundsNodeIds` includes transitive children.
      const boundsNodeIds = new Set<string>(gNodeIds);
      let added = true;
      while (added) {
        added = false;
        for (const n of nodes) {
          if (n.parentId && boundsNodeIds.has(n.parentId) && !boundsNodeIds.has(n.id)) {
            boundsNodeIds.add(n.id);
            added = true;
          }
        }
      }
      const gNodes = Array.from(boundsNodeIds).map(id => nodes.find(n => n.id === id)!).filter(Boolean);
      const xs = gNodes.map(n => n.x);
      const ys = gNodes.map(n => n.y);
      const PAD = 40;
      const bounds = {
        x: Math.min(...xs) - PAD,
        y: Math.min(...ys) - PAD,
        w: Math.max(...gNodes.map(n => n.x + getNodeWidth(n))) - Math.min(...xs) + PAD * 2,
        h: Math.max(...gNodes.map(n => n.y + getNodeHeight(n))) - Math.min(...ys) + PAD * 2,
      };
      const allIds = gNodeIds.flatMap(id => {
        const q = doneQueries.find(n => n.id === id);
        return q?.result?.matchedTrendIds ?? [];
      });
      const freq: Record<string, number> = {};
      allIds.forEach(id => { freq[id] = (freq[id] ?? 0) + 1; });
      const topTrend = Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "";
      const label = topTrend.replace("mega-","").replace("macro-","").replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()).slice(0,24);
      return { id: `group-${i}`, nodeIds: gNodeIds, label, color: colors[i % colors.length], bounds };
    });
  }, [queryNodes, nodes]);

  // Merged group lookup: nodeId → group color (auto + user groups)
  const nodeGroupColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of canvasGroups) { for (const id of g.nodeIds) map.set(id, g.color); }
    // User groups override auto groups
    for (const g of userGroups) { for (const id of g.nodeIds) map.set(id, g.color); }
    return map;
  }, [canvasGroups, userGroups]);

  // Tag + group membership maps for ConnectionsSVG and group dimming
  const nodeTagMap = useMemo(() => {
    const m = new Map<string, string[]>();
    nodes.forEach(n => m.set(n.id, n.tags ?? []));
    return m;
  }, [nodes]);

  const nodeGroupMap = useMemo(() => {
    const m = new Map<string, string>();
    [...canvasGroups, ...userGroups].forEach(g => {
      g.nodeIds.forEach(id => m.set(id, g.id));
    });
    return m;
  }, [canvasGroups, userGroups]);

  // Duplicate query-title index: if two queries share the same text
  // (common when iterating or re-running), assign each a small "#N" suffix
  // (1,2,3…) ordered by createdAt so headers stay distinguishable.
  // Unique queries get 0 (rendered as nothing).
  const queryDupIndex = useMemo(() => {
    const m = new Map<string, number>();
    const buckets = new Map<string, QueryNode[]>();
    nodes.forEach(n => {
      if (n.nodeType !== "query") return;
      const q = n as QueryNode;
      const key = (q.query ?? "").trim().toLowerCase();
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(q);
    });
    buckets.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => a.createdAt - b.createdAt);
      list.forEach((q, i) => m.set(q.id, i + 1));
    });
    return m;
  }, [nodes]);

  // ── Canvas Export ────────────────────────────────────────────────────────

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const exportCanvas = useCallback((format: "markdown" | "json" | "pdf") => {
    setExportMenuOpen(false);
    if (format === "json") {
      const state = { nodes, conns: connections, pan: { x: panX, y: panY }, zoom, v: 2 };
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sis-canvas-${projectName || "export"}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    // Markdown export
    const doneQs = nodes.filter(n => n.nodeType === "query" && (n as QueryNode).synthesis) as QueryNode[];
    const lines: string[] = [
      `# SIS Canvas Export`,
      `_${new Date().toLocaleString("de-DE")} · ${projectName || "Canvas"} · ${doneQs.length} ${de ? "Analysen" : "analyses"}_`,
      "", "---", "",
    ];
    doneQs.forEach((q, idx) => {
      lines.push(`## ${idx + 1}. ${q.query}`, "");
      if (q.synthesis) lines.push(q.synthesis, "");
      // Insights
      const insights = nodes.filter(n => n.parentId === q.id && n.nodeType === "insight") as DerivedNode[];
      if (insights.length) {
        lines.push(`### ${de ? "Erkenntnisse" : "Insights"}`, "");
        insights.forEach(ins => lines.push(`- ${ins.content}`, ""));
      }
      // Scenarios
      const scenarios = nodes.filter(n => n.parentId === q.id && n.nodeType === "scenario") as DerivedNode[];
      if (scenarios.length) {
        lines.push(`### ${de ? "Szenarien" : "Scenarios"}`, "");
        scenarios.forEach(sc => {
          const prob = sc.probability != null ? ` (${Math.round(sc.probability * 100)}%)` : "";
          lines.push(`- **${sc.label || sc.content.slice(0, 60)}**${prob}: ${sc.content}`, "");
        });
      }
      // Decisions
      const decisions = nodes.filter(n => n.parentId === q.id && n.nodeType === "decision") as DerivedNode[];
      if (decisions.length) {
        lines.push(`### ${de ? "Empfehlungen" : "Decisions"}`, "");
        decisions.forEach(dec => lines.push(`- ${dec.content}`, ""));
      }
      lines.push("---", "");
    });
    const md = lines.join("\n");

    if (format === "pdf") {
      // PDF export: render markdown as styled HTML, open print dialog
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>SIS Export</title><style>
          body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; font-size: 13px; }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 16px; font-weight: 700; margin-top: 28px; border-bottom: 1px solid #E8E8E8; padding-bottom: 6px; }
          h3 { font-size: 13px; font-weight: 700; margin-top: 16px; color: #555; }
          hr { border: none; border-top: 1px solid #E8E8E8; margin: 20px 0; }
          ul { padding-left: 20px; }
          li { margin-bottom: 6px; }
          em { color: #777; font-size: 11px; }
          @media print { body { margin: 0; } }
        </style></head><body>${md
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/^---$/gm, "<hr>")
          .replace(/^_(.+)_$/gm, "<p><em>$1</em></p>")
          .replace(/^- \*\*(.+?)\*\*(.*)$/gm, "<li><strong>$1</strong>$2</li>")
          .replace(/^- (.+)$/gm, "<li>$1</li>")
          .replace(/\n\n/g, "</p><p>")
        }</body></html>`);
        printWin.document.close();
        setTimeout(() => printWin.print(), 400);
      }
      return;
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sis-canvas-${projectName || "export"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [nodes, connections, panX, panY, zoom, projectName, de]);

  const generateBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingOpen(true);
    setBriefingText("");

    const qNodes = queryNodes.filter(n => n.status === "done");
    const chain = qNodes.map(q => {
      const insights = nodes.filter(n => n.nodeType === "insight" && (n as DerivedNode).parentId === q.id) as DerivedNode[];
      const decisions = nodes.filter(n => n.nodeType === "decision" && (n as DerivedNode).parentId === q.id) as DerivedNode[];
      return `FRAGE: ${q.query}\nSYNTHESE: ${q.synthesis?.slice(0,400) ?? ""}\nERKENNTNISSE: ${insights.map(i => i.content).join("; ")}\nEMPFEHLUNG: ${decisions.map(d => d.content).join("; ")}`;
    }).join("\n\n---\n\n");

    try {
      const res = await fetch("/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Erstelle ein prägnantes strategisches Briefing-Memo (max 500 Wörter) aus folgendem Canvas-Kontext. Struktur: Executive Summary (2-3 Sätze), Kernerkenntnisse (3-5 Bullet Points), Handlungsempfehlungen (3 konkrete Schritte), Kritische Unsicherheiten (2-3 Punkte).\n\nCanvas-Kontext:\n${chain}`,
          locale,
        }),
      });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6).trim());
            if (evt.type === "complete" && evt.result?.synthesis) {
              setBriefingText(evt.result.synthesis);
            }
          } catch {}
        }
      }
    } catch (e) {
      setBriefingText(String(e));
    } finally {
      setBriefingLoading(false);
    }
  }, [queryNodes, nodes, locale]);

  // Debounced localStorage persist
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const doneNodes = nodes.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
      if (doneNodes.length > 0) saveToStorage(doneNodes, connections, { x: panX, y: panY }, zoom);
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, connections, panX, panY, zoom]);

  // FIXED: DAT-06 — Flush pending save before project switch to prevent saving old nodes to new project
  const prevProjectIdRef = useRef<string | null>(projectId);
  useEffect(() => {
    if (prevProjectIdRef.current && prevProjectIdRef.current !== projectId) {
      // Project changed — flush any pending DB save for the OLD project immediately
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
        dbSaveTimerRef.current = undefined;
        // Note: we do NOT call saveCanvasToDb here because nodes/connections
        // state may already be reset to the new project's data. The loadProject
        // function handles this (see DAT-07 below).
      }
    }
    prevProjectIdRef.current = projectId;
  }, [projectId]);

  // Debounced DB persist (only when a project is active)
  useEffect(() => {
    if (!projectId) return;
    if (nodesRef.current.length === 0) return; // don't save empty canvas
    clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(() => {
      saveCanvasToDb(projectId);
    }, 2000);
    return () => clearTimeout(dbSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, connections, panX, panY, zoom, projectId, userGroups]);

  // Flush pending DB save immediately (used by unload, visibility, and unmount handlers)
  const flushPendingSave = useCallback(() => {
    const pid = projectIdRef.current;
    if (!pid || nodesRef.current.length === 0) return;
    if (dbSaveTimerRef.current) {
      clearTimeout(dbSaveTimerRef.current);
      dbSaveTimerRef.current = undefined;
    }
    const doneNodes = nodesRef.current.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
    if (doneNodes.length === 0) return;
    // Synchronous localStorage save as last resort
    saveToStorage(doneNodes, connectionsRef.current, { x: panXRef.current, y: panYRef.current }, zoomRef.current);
    // Best-effort DB save via sendBeacon (works even during unload)
    const state = { nodes: doneNodes, conns: connectionsRef.current, pan: { x: panXRef.current, y: panYRef.current }, zoom: zoomRef.current, v: 2, userGroups: userGroupsRef.current.length > 0 ? userGroupsRef.current : undefined };
    try { navigator.sendBeacon(`/api/v1/canvas/${pid}`, new Blob([JSON.stringify({ canvasState: state })], { type: "application/json" })); } catch {}
  }, []);

  // Save on browser close / tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
      flushPendingSave();
    };
    // Save when tab becomes hidden (covers Alt+Tab, switching tabs, mobile backgrounding)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSave();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingSave]);

  // Flush pending save on component unmount (Next.js client-side navigation)
  useEffect(() => {
    return () => {
      // On unmount, flush any pending debounced save so SPA navigation doesn't lose data
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
        dbSaveTimerRef.current = undefined;
        const pid = projectIdRef.current;
        if (pid && nodesRef.current.length > 0) {
          const doneNodes = nodesRef.current.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
          if (doneNodes.length > 0) {
            const state = { nodes: doneNodes, conns: connectionsRef.current, pan: { x: panXRef.current, y: panYRef.current }, zoom: zoomRef.current, v: 2 };
            try { navigator.sendBeacon(`/api/v1/canvas/${pid}`, new Blob([JSON.stringify({ canvasState: state })], { type: "application/json" })); } catch {}
          }
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global pointer events ─────────────────────────────────────────────────
  // TODO: EDGE-18 — Pointer/drag callbacks capture stale React state in closures.
  // Currently mitigated by using refs (zoomRef, panXRef, panYRef, nodesRef, snapToGridRef)
  // instead of state directly. If adding new state to these handlers, always use refs.

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (draggingRef.current) {
        const { id, sx, sy, ox, oy } = draggingRef.current;
        const dx = (e.clientX - sx) / zoomRef.current;
        const dy = (e.clientY - sy) / zoomRef.current;
        // FIXED: UX-11 — Optional snap-to-grid (20px grid)
        const rawX = ox + dx;
        const rawY = oy + dy;
        const finalX = snapToGridRef.current ? Math.round(rawX / 20) * 20 : rawX;
        const finalY = snapToGridRef.current ? Math.round(rawY / 20) * 20 : rawY;
        setNodes(prev => prev.map(n => n.id === id ? { ...n, x: finalX, y: finalY } : n));
      } else if (resizingRef.current) {
        const { id, dir, startX, startW, startY, startH } = resizingRef.current;
        if (dir === "h" || dir === "both") {
          const dx = (e.clientX - startX) / zoomRef.current;
          const newW = Math.max(200, Math.min(900, Math.round(startW + dx)));
          setNodes(prev => prev.map(n => n.id === id ? { ...n, customWidth: newW } : n));
        }
        if (dir === "v" || dir === "both") {
          const dy = (e.clientY - startY) / zoomRef.current;
          const newH = Math.max(60, Math.min(1400, Math.round(startH + dy)));
          setNodes(prev => prev.map(n => n.id === id ? { ...n, customHeight: newH } : n));
        }
      } else if (panningRef.current) {
        const { sx, sy, opx, opy } = panningRef.current;
        setPanX(opx + e.clientX - sx);
        setPanY(opy + e.clientY - sy);
      } else if (portDragRef.current) {
        const rect2 = viewportRef.current?.getBoundingClientRect();
        if (rect2) {
          const cx = (e.clientX - rect2.left - panXRef.current) / zoomRef.current;
          const cy = (e.clientY - rect2.top - panYRef.current) / zoomRef.current;
          setPortDragPreview({
            x1: portDragRef.current.sourceCanvasX,
            y1: portDragRef.current.sourceCanvasY,
            x2: cx, y2: cy,
          });
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (draggingRef.current || resizingRef.current) pushHistory();
      draggingRef.current = null; resizingRef.current = null; panningRef.current = null;
      if (portDragRef.current) {
        const { nodeId, prefill, startClientX, startClientY } = portDragRef.current;
        const didDrag = Math.abs(e.clientX - startClientX) > 12 || Math.abs(e.clientY - startClientY) > 12;
        portDragRef.current = null;
        setPortDragPreview(null);
        const rect2 = viewportRef.current?.getBoundingClientRect();
        if (didDrag && rect2) {
          const dropCanvasX = (e.clientX - rect2.left - panXRef.current) / zoomRef.current;
          const dropCanvasY = (e.clientY - rect2.top - panYRef.current) / zoomRef.current;
          portDropCanvasPosRef.current = { x: dropCanvasX, y: dropCanvasY };
          setNodePickerPos({ x: e.clientX - rect2.left, y: e.clientY - rect2.top });
        } else {
          portDropCanvasPosRef.current = null;
          setNodePickerPos(null);
        }
        setIterateCtx({ parentId: nodeId, prefill });
        setNodePickerVisible(true);
        setSelectedId(nodeId);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  // Ref for deleteNode to avoid block-scoping issue in keyboard handler
  const deleteNodeRef = useRef<(id: string) => void>(() => {});

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCmdVisible(false); setCmdPrefill(""); setProjectDropdownOpen(false); setNodePickerVisible(false); setIterateCtx(null); setDetailNodeId(null); setDeleteConfirmId(null); setNodePickerPos(null); portDropCanvasPosRef.current = null; portDragRef.current = null; setPortDragPreview(null); setSortMenuOpen(false); setMultiSelectedIds(new Set()); setEditingGroupId(null); setActiveTagFilter(null);
        // Also abort any active streams on Escape
        activeStreamsRef.current.forEach(ctrl => ctrl.abort());
        activeStreamsRef.current.clear();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !cmdVisible) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        setDeleteConfirmId(selectedId);
      }
      if (e.key === "Enter" && deleteConfirmId) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        deleteNodeRef.current(deleteConfirmId);
        setDeleteConfirmId(null);
      }
      // Undo: Ctrl/Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault(); undo();
      }
      // Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault(); redo();
      }
      // FIXED: UX-12 — Copy/paste for canvas nodes
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedId) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        const selected = nodesRef.current.filter(n => n.id === selectedId);
        if (selected.length > 0) {
          clipboardRef.current = selected.map(n => ({ ...n }));
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboardRef.current.length > 0) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        pushHistory();
        const pasted = clipboardRef.current.map(n => ({
          ...n,
          id: uid(),
          x: n.x + 40,
          y: n.y + 40,
          createdAt: Date.now(),
        }));
        setNodes(prev => [...prev, ...pasted]);
      }
    };
    const trackShiftDown = (e: KeyboardEvent) => { if (e.key === "Shift") shiftHeldRef.current = true; };
    const trackShiftUp = (e: KeyboardEvent) => { if (e.key === "Shift") shiftHeldRef.current = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keydown", trackShiftDown);
    window.addEventListener("keyup", trackShiftUp);
    window.addEventListener("blur", () => { shiftHeldRef.current = false; });
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keydown", trackShiftDown); window.removeEventListener("keyup", trackShiftUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, cmdVisible, deleteConfirmId, undo, redo, pushHistory]);

  // ── Positioning ───────────────────────────────────────────────────────────

  const getNextQueryPos = useCallback((parentId?: string): { x: number; y: number } => {
    if (nextQueryPosOverrideRef.current) {
      const p = nextQueryPosOverrideRef.current;
      nextQueryPosOverrideRef.current = null;
      return p;
    }
    if (parentId) {
      const parent = nodesRef.current.find(n => n.id === parentId);
      if (parent) {
        const parentW = parent.customWidth ?? (
          parent.nodeType === "query" ? QUERY_NODE_W :
          parent.nodeType === "list"  ? LIST_NODE_W  :
          parent.nodeType === "file"  ? FILE_NODE_W  : DERIVED_W
        );
        const siblings = nodesRef.current.filter(n => n.parentId === parentId && n.nodeType === "query");
        return { x: parent.x + parentW + 80, y: parent.y + siblings.length * (QUERY_NODE_H + 40) };
      }
    }
    if (nodesRef.current.length === 0) {
      const vp = viewportRef.current?.getBoundingClientRect();
      if (vp) return { x: (vp.width / 2 - QUERY_NODE_W / 2 - panXRef.current) / zoomRef.current, y: (vp.height / 2 - 150 - panYRef.current) / zoomRef.current };
      return { x: 80, y: 80 };
    }
    const last = [...nodesRef.current].filter(n => n.nodeType === "query").sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!last) return { x: 80, y: 80 };
    return { x: last.x, y: last.y + getNodeHeight(last) + 60 };
  }, []);

  // ── Query submission ──────────────────────────────────────────────────────

  const submitQuery = useCallback((query: string, parentId?: string, opts?: { refreshed?: boolean }) => {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    // ── Slash commands ───────────────────────────────────────────────────
    if (lower === "/clear") {
      if (!window.confirm(de ? 'Gesamtes Canvas löschen? Diese Aktion kann nicht rückgängig gemacht werden.' : 'Clear entire canvas? This action cannot be undone.')) {
        setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
        return;
      }
      pushHistory();
      setNodes([]); setConnections([]);
      setPanX(0); setPanY(0); setZoom(1);
      setSelectedId(null); setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      if (projectIdRef.current) {
        fetchWithTimeout(`/api/v1/canvas/${projectIdRef.current}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canvasState: null }),
        }).catch(() => {});
      }
      return;
    }
    if (lower === "/export") {
      exportCanvas("markdown");
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      return;
    }
    if (lower.startsWith("/trend ") || lower === "/trend") {
      const topic = trimmed.slice(6).trim();
      const q = topic
        ? `Analysiere den Trend: ${topic} — Entwicklung, Treiber, Auswirkungen und Zeithorizont.`
        : "Welche Megatrends prägen die strategische Landschaft aktuell?";
      // Fall through to normal query with the generated query text
      pushHistory();
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      const id2 = uid();
      const pos2 = getNextQueryPos(parentId);
      const qNode2: QueryNode = {
        id: id2, nodeType: "query", x: pos2.x, y: pos2.y, query: q, locale,
        status: "loading", synthesis: "", result: null, collapsed: false,
        parentId, createdAt: Date.now(),
      };
      setNodes(prev => [...prev, qNode2]);
      if (parentId) setConnections(prev => [...prev, { from: parentId, to: id2, derived: false }]);
      setSelectedId(id2);
      const abortCtrl2 = new AbortController();
      activeStreamsRef.current.set(id2, abortCtrl2);
      streamQuery(q, locale,
        (chunk) => setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
        (result) => {
          activeStreamsRef.current.delete(id2);
          setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, status: "done", synthesis: result.synthesis || (n as QueryNode).synthesis, result } as QueryNode : n));
          const derived = computeDerivedNodes(id2, pos2.x, pos2.y, result);
          derived.forEach((d, i) => { setTimeout(() => { setNodes(prev => [...prev, d]); setConnections(prev => [...prev, { from: id2, to: d.id, derived: true }]); }, 200 + i * 90); });
        },
        (msg) => { activeStreamsRef.current.delete(id2); setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n)); },
        (phase) => setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
        abortCtrl2.signal,
      );
      return;
    }
    if (lower.startsWith("/scenario") || lower.startsWith("/signal")) {
      const isScenario = lower.startsWith("/scenario");
      const topic = trimmed.slice(isScenario ? 9 : 7).trim();
      const q = isScenario
        ? (topic
          ? `Entwickle optimistische, wahrscheinliche und pessimistische Szenarien für: ${topic}`
          : "Entwickle Szenarien für die wichtigsten strategischen Unsicherheiten.")
        : (topic
          ? `Identifiziere schwache Signale und Frühwarnzeichen für: ${topic}`
          : "Welche schwachen Signale und Frühwarnzeichen gibt es aktuell?");
      pushHistory();
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      const id3 = uid();
      const pos3 = getNextQueryPos(parentId);
      const qNode3: QueryNode = {
        id: id3, nodeType: "query", x: pos3.x, y: pos3.y, query: q, locale,
        status: "loading", synthesis: "", result: null, collapsed: false,
        parentId, createdAt: Date.now(),
      };
      setNodes(prev => [...prev, qNode3]);
      if (parentId) setConnections(prev => [...prev, { from: parentId, to: id3, derived: false }]);
      setSelectedId(id3);
      const abortCtrl3 = new AbortController();
      activeStreamsRef.current.set(id3, abortCtrl3);
      streamQuery(q, locale,
        (chunk) => setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
        (result) => {
          activeStreamsRef.current.delete(id3);
          setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, status: "done", synthesis: result.synthesis || (n as QueryNode).synthesis, result } as QueryNode : n));
          const derived = computeDerivedNodes(id3, pos3.x, pos3.y, result);
          derived.forEach((d, i) => { setTimeout(() => { setNodes(prev => [...prev, d]); setConnections(prev => [...prev, { from: id3, to: d.id, derived: true }]); }, 200 + i * 90); });
        },
        (msg) => { activeStreamsRef.current.delete(id3); setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n)); },
        (phase) => setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
        abortCtrl3.signal,
      );
      return;
    }

    // ── Test-Modus: "test" in Command-Line eingeben ───────────────────────
    if (lower === "test" && !parentId) {
      pushHistory();
      const { nodes: testNodes, conns: testConns } = buildTestDataset();
      setNodes(testNodes);
      setConnections(testConns);
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      setPanX(0); setPanY(0); setZoom(0.72);
      setSelectedId(null);
      return;
    }

    pushHistory();
    const id = uid();
    const pos = getNextQueryPos(parentId);
    const qNode: QueryNode = {
      id, nodeType: "query", x: pos.x, y: pos.y, query, locale,
      status: "loading", synthesis: "", result: null, collapsed: false,
      parentId, createdAt: Date.now(),
    };
    setNodes(prev => [...prev, qNode]);
    if (parentId) setConnections(prev => [...prev, { from: parentId, to: id, derived: false, refreshed: opts?.refreshed }]);
    setSelectedId(id);
    setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);

    // ── Context passing: include parent synthesis so follow-up steps can build on previous results
    let queryWithContext = query;
    if (parentId) {
      const parentNode = nodesRef.current.find(n => n.id === parentId);
      if (parentNode) {
        const parentText = parentNode.nodeType === "query"
          ? (parentNode as QueryNode).synthesis
          : (parentNode as DerivedNode).content;
        if (parentText && parentText.length > 20) {
          queryWithContext = `KONTEXT AUS VORHERIGEM ANALYSESCHRITT:\n${parentText.slice(0, 2000)}\n\n---\n\n${query}`;
        }
      }
    }

    // Create an AbortController for this stream so it can be cancelled
    const abortController = new AbortController();
    activeStreamsRef.current.set(id, abortController);

    streamQuery(
      queryWithContext, locale,
      (chunk) => setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
      (result) => {
        activeStreamsRef.current.delete(id);
        setNodes(prev => prev.map(n =>
          n.id === id && n.nodeType === "query"
            ? { ...n, status: "done", synthesis: result.synthesis || (n as QueryNode).synthesis, result } as QueryNode
            : n
        ));
        const derived = computeDerivedNodes(id, pos.x, pos.y, result);
        derived.forEach((d, i) => {
          setTimeout(() => {
            setNodes(prev => [...prev, d]);
            setConnections(prev => [...prev, { from: id, to: d.id, derived: true }]);
          }, 200 + i * 90);
        });

        // Auto-rename session after first successful query if still has default name
        const pid = projectIdRef.current;
        if (pid && !hasAutoNamedRef.current) {
          const DEFAULT_NAMES = ["Aktuelle Session", "Neue Session", "Neues Projekt", "New project"];
          // Use a function updater pattern: read current name from state
          setProjectName(prevName => {
            if (DEFAULT_NAMES.includes(prevName) || !prevName.trim()) {
              hasAutoNamedRef.current = true;
              const autoName = query.substring(0, 60);
              // Fire-and-forget rename API call
              fetchWithTimeout(`/api/v1/canvas/${pid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: autoName }),
              }).catch(() => {});
              // Update project list too
              setProjects(prev => prev.map(p => p.id === pid ? { ...p, name: autoName } : p));
              return autoName;
            }
            // Name was already customized — mark as done and don't rename
            hasAutoNamedRef.current = true;
            return prevName;
          });
        }
      },
      (msg) => {
        activeStreamsRef.current.delete(id);
        setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n));
      },
      (phase) => setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
      abortController.signal,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, getNextQueryPos, setPanX, setPanY, setZoom, pushHistory, de, exportCanvas]);

  // ── Node actions ──────────────────────────────────────────────────────────

  const DERIVED_TYPES = new Set(["insight","scenario","decision","followup","dimensions","causalgraph"]);
  const deleteNode = useCallback((id: string) => {
    pushHistory();
    // Cancel any active stream writing to this node before deleting
    const streamController = activeStreamsRef.current.get(id);
    if (streamController) {
      streamController.abort();
      activeStreamsRef.current.delete(id);
    }
    // Only cascade-delete auto-generated derived children; preserve user-created nodes (note/idea/list/file/query)
    setNodes(prev => prev.filter(n => n.id !== id && !(n.parentId === id && DERIVED_TYPES.has(n.nodeType))));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    setSelectedId(prev => prev === id ? null : prev);
    setDetailNodeId(prev => prev === id ? null : prev);
  }, [pushHistory]);
  deleteNodeRef.current = deleteNode;

  const handleSelectNode = useCallback((id: string) => {
    if (shiftHeldRef.current) {
      // Multi-select mode
      setMultiSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }
    // Normal select — clear multi-select
    setMultiSelectedIds(new Set());
    setSelectedId(id);
    setDetailNodeId(id);
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, collapsed: !n.collapsed } as QueryNode : n));
  }, []);

  const handleFollowUp = useCallback((nodeId: string, prefill?: string) => {
    setCmdParentId(nodeId); setCmdPrefill(prefill ?? ""); setCmdVisible(true); setSelectedId(nodeId);
  }, []);

  const handleExplore = useCallback((nodeId: string, queryText: string) => {
    const n = nodesRef.current.find(x => x.id === nodeId);
    if (!n || n.nodeType === "query") return;
    const dNode = n as DerivedNode;
    const derivedType = dNode.nodeType;
    if (derivedType === "followup") {
      handleFollowUp(nodeId, queryText);
    } else if (derivedType === "dimensions" || derivedType === "causalgraph") {
      // Use the owning query as parentId so the new query attaches to the
      // correct level of the tree, not to the derived card itself.
      submitQuery(queryText, dNode.parentId);
    } else {
      submitQuery(queryText, nodeId);
    }
  }, [handleFollowUp, submitQuery]);

  const handleRefresh = useCallback((nodeId: string) => {
    const n = nodesRef.current.find(x => x.id === nodeId);
    if (!n || n.nodeType !== "query") return;
    submitQuery((n as QueryNode).query, nodeId, { refreshed: true });
  }, [submitQuery]);

  const handleUpdateNote = useCallback((id: string, content: string) => {
    pushHistory();
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "note" ? { ...n, content } : n));
  }, [pushHistory]);

  const handleUpdateIdea = useCallback((id: string, title: string, content: string) => {
    pushHistory();
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "idea" ? { ...n, title, content } : n));
  }, [pushHistory]);

  const handlePromoteIdea = useCallback((query: string) => {
    submitQuery(query);
  }, [submitQuery]);

  const handleUpdateList = useCallback((id: string, title: string, items: string[]) => {
    pushHistory();
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "list" ? { ...n, title, items } : n));
  }, [pushHistory]);

  const handlePromoteNote = useCallback((query: string) => {
    submitQuery(query);
  }, [submitQuery]);

  // ── View mode switching with per-view transform save/restore ──────────────
  const switchViewMode = useCallback((nextMode: ViewMode) => {
    // Save current transform for the active view
    viewTransformsRef.current[viewMode] = { x: panX, y: panY, z: zoom };
    // Restore transform for the target view (or reset)
    const saved = viewTransformsRef.current[nextMode];
    if (saved) {
      setPanX(saved.x); setPanY(saved.y); setZoom(saved.z);
    } else {
      setPanX(0); setPanY(0); setZoom(1);
    }
    // FIXED: EDGE-13 — Preserve selectedId and detailNodeId across view transitions
    // (Previously these would be implicitly cleared; now we intentionally keep them)
    setViewMode(nextMode);
  }, [viewMode, panX, panY, zoom]);

  // ── File upload ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, pos: { x: number; y: number }, parentId?: string) => {
    const id = uid();
    const placeholderNode: FileNode = {
      id, nodeType: "file", x: pos.x, y: pos.y,
      fileName: file.name, fileSize: file.size, fileType: file.type || "application/octet-stream",
      fileUrl: "", loading: true, createdAt: Date.now(), parentId,
    };
    setNodes(prev => [...prev, placeholderNode]);
    if (parentId) setConnections(prev => [...prev, { from: parentId, to: id, derived: true }]);
    setSelectedId(id);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetchWithTimeout("/api/v1/canvas/upload", { method: "POST", body: formData }, 60_000);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setNodes(prev => prev.map(n =>
        n.id === id && n.nodeType === "file"
          ? { ...n, fileUrl: json.fileUrl, textContent: json.textContent, loading: false }
          : n
      ));
    } catch {
      setNodes(prev => prev.filter(n => n.id !== id));
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    const pos = fileUploadPosRef.current ?? getNextQueryPos();
    const parentId = fileUploadParentRef.current ?? undefined;
    fileUploadPosRef.current = null;
    fileUploadParentRef.current = null;
    uploadFile(file, pos, parentId);
  }, [uploadFile, getNextQueryPos]);

  const triggerFileUpload = useCallback((pos: { x: number; y: number }, parentId?: string) => {
    fileUploadPosRef.current = pos;
    fileUploadParentRef.current = parentId ?? null;
    fileInputRef.current?.click();
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - panXRef.current) / zoomRef.current;
    const y = (e.clientY - rect.top - panYRef.current) / zoomRef.current;
    uploadFile(file, { x, y });
  }, [uploadFile]);

  const handleIterateFromNode = useCallback((nodeId: string, prefill: string) => {
    setIterateCtx({ parentId: nodeId, prefill });
    setNodePickerVisible(true);
    setSelectedId(nodeId);
  }, []);

  const handleNodeTypeSelect = useCallback((type: NewNodeType) => {
    setNodePickerVisible(false);
    const ctx = iterateCtxRef.current;
    setIterateCtx(null);

    // ── KI-Analyse types: open CommandBox with focused prefill ──────────────
    const ANALYSIS_PREFIXES: Partial<Record<NewNodeType, string>> = {
      query:     "",
      insights:  "Extrahiere die wichtigsten Erkenntnisse und Muster zu: ",
      scenarios: "Entwickle optimistische, wahrscheinliche und pessimistische Szenarien für: ",
      decision:  "Leite einen konkreten Handlungsrahmen und Empfehlungen ab für: ",
      followups: "Welche offenen Fragen und nächsten Schritte ergeben sich aus: ",
    };

    if (type in ANALYSIS_PREFIXES) {
      const prefix = ANALYSIS_PREFIXES[type] ?? "";
      const prefill = ctx ? `${prefix}${ctx.prefill}` : "";
      const parentId = ctx?.parentId ?? null;
      if (portDropCanvasPosRef.current) {
        nextQueryPosOverrideRef.current = {
          x: portDropCanvasPosRef.current.x - QUERY_NODE_W / 2,
          y: portDropCanvasPosRef.current.y - QUERY_NODE_H / 2,
        };
        portDropCanvasPosRef.current = null;
      }
      setCmdParentId(parentId); setCmdPrefill(prefill); setCmdVisible(true);
      setNodePickerPos(null);
      return;
    }

    // Position near parent if we have context — stack siblings vertically
    const getCtxPos = () => {
      if (portDropCanvasPosRef.current) {
        const p = portDropCanvasPosRef.current;
        portDropCanvasPosRef.current = null;
        return { x: p.x - DERIVED_W / 2, y: p.y - 60 };
      }
      if (!ctx) return getNextQueryPos();
      const parent = nodesRef.current.find(n => n.id === ctx.parentId);
      if (!parent) return getNextQueryPos();
      const parentW = parent.nodeType === "query"
        ? ((parent as QueryNode).customWidth ?? QUERY_NODE_W)
        : parent.nodeType === "list"
        ? ((parent as ListNode).customWidth ?? LIST_NODE_W)
        : parent.nodeType === "file"
        ? ((parent as FileNode).customWidth ?? FILE_NODE_W)
        : ((parent as DerivedNode | NoteNode | IdeaNode).customWidth ?? DERIVED_W);
      // Count existing non-query siblings to stack vertically with 30px gap
      const siblings = nodesRef.current.filter(n => n.parentId === ctx.parentId && n.nodeType !== "query");
      let yOffset = 0;
      for (const sib of siblings) {
        yOffset += getNodeHeight(sib) + 30;
      }
      return { x: parent.x + parentW + 64, y: parent.y + yOffset };
    };

    const pos = getCtxPos();
    const id = uid();
    pushHistory();

    if (type === "note") {
      const node: NoteNode = {
        id, nodeType: "note", x: pos.x, y: pos.y,
        content: ctx?.prefill ?? "", createdAt: Date.now(),
        parentId: ctx?.parentId,
      };
      setNodes(prev => [...prev, node]);
      if (ctx?.parentId) setConnections(prev => [...prev, { from: ctx.parentId, to: id, derived: true }]);
    } else if (type === "idea") {
      const node: IdeaNode = {
        id, nodeType: "idea", x: pos.x, y: pos.y,
        title: ctx?.prefill ? ctx.prefill.slice(0, 80) : "",
        content: "", createdAt: Date.now(),
        parentId: ctx?.parentId,
      };
      setNodes(prev => [...prev, node]);
      if (ctx?.parentId) setConnections(prev => [...prev, { from: ctx.parentId, to: id, derived: true }]);
    } else if (type === "list") {
      const node: ListNode = {
        id, nodeType: "list", x: pos.x, y: pos.y,
        title: ctx?.prefill ? ctx.prefill.slice(0, 80) : "",
        items: [""],
        createdAt: Date.now(),
        parentId: ctx?.parentId,
      };
      setNodes(prev => [...prev, node]);
      if (ctx?.parentId) setConnections(prev => [...prev, { from: ctx.parentId, to: id, derived: true }]);
    } else if (type === "file") {
      // Open file picker — upload will create the node
      triggerFileUpload(pos, ctx?.parentId);
      return; // node creation happens asynchronously in handleFileInputChange
    }
    setSelectedId(id);
    setNodePickerPos(null);
  }, [getNextQueryPos, triggerFileUpload]);

  const clearCanvas = useCallback(() => {
    if (!window.confirm(de ? "Gesamtes Canvas löschen? Diese Aktion kann nicht rückgängig gemacht werden." : "Clear entire canvas? This action cannot be undone.")) return;
    pushHistory();
    setNodes([]); setConnections([]);
    setPanX(0); setPanY(0); setZoom(1);
    setSelectedId(null); setCmdVisible(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    if (projectIdRef.current) {
      fetchWithTimeout(`/api/v1/canvas/${projectIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: null }),
      }).catch(() => {});
    }
  }, [de, pushHistory]);

  // ── Auto-reorganize layout ────────────────────────────────────────────────

  const reorganizeCanvas = useCallback((mode: SortMode = "tree") => {
    const ns = nodesRef.current;
    const conns = connectionsRef.current;
    if (ns.length === 0) return;

    // ── Time-based layout ──
    if (mode === "time") {
      // Group-aware: keep grouped nodes adjacent, then sort by time
      const allGroups = [...(canvasGroups ?? []), ...userGroupsRef.current];
      const nodeToGroupIdx = new Map<string, number>();
      allGroups.forEach((g, i) => { g.nodeIds.forEach(id => nodeToGroupIdx.set(id, i)); });
      const sorted = [...ns].sort((a, b) => {
        const gA = nodeToGroupIdx.get(a.id) ?? 999;
        const gB = nodeToGroupIdx.get(b.id) ?? 999;
        if (gA !== gB) return gA - gB;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });
      const COL_W = 460;
      const ROW_GAP = 30;
      const GROUP_GAP = 40;
      const COLS = Math.max(3, Math.ceil(Math.sqrt(sorted.length)));
      const colYs = Array(COLS).fill(80);
      const newPos = new Map<string, { x: number; y: number }>();
      let prevGroupIdx = -1;
      for (const n of sorted) {
        const curGroupIdx = nodeToGroupIdx.get(n.id) ?? -1;
        let bestCol = 0;
        for (let c = 1; c < COLS; c++) { if (colYs[c] < colYs[bestCol]) bestCol = c; }
        if (prevGroupIdx >= 0 && curGroupIdx !== prevGroupIdx && curGroupIdx >= 0) {
          colYs[bestCol] += GROUP_GAP;
        }
        newPos.set(n.id, { x: 80 + bestCol * COL_W, y: colYs[bestCol] });
        colYs[bestCol] += getNodeHeight(n) + ROW_GAP;
        prevGroupIdx = curGroupIdx;
      }
      setNodes(prev => prev.map(n => { const p = newPos.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
      setPanX(20); setPanY(20);
      setZoom(Math.min(0.85, window.innerWidth / (COLS * COL_W + 160)));
      return;
    }

    // ── Type-based layout (columns by nodeType) ──
    if (mode === "type") {
      const TYPE_ORDER: string[] = ["query", "insight", "decision", "scenario", "followup", "dimensions", "causalgraph", "note", "idea", "list", "file"];
      const groups = new Map<string, CanvasNode[]>();
      for (const n of ns) {
        const t = n.nodeType;
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t)!.push(n);
      }
      const ROW_GAP = 30;
      const COL_GAP = 40;
      let colX = 80;
      const newPos = new Map<string, { x: number; y: number }>();
      for (const t of TYPE_ORDER) {
        const items = groups.get(t);
        if (!items || items.length === 0) continue;
        // Group-aware sort: grouped nodes stay together within each column
        const allGrps = [...(canvasGroups ?? []), ...userGroupsRef.current];
        const toGIdx = new Map<string, number>();
        allGrps.forEach((g, i) => { g.nodeIds.forEach(id => toGIdx.set(id, i)); });
        items.sort((a, b) => {
          const gA = toGIdx.get(a.id) ?? 999;
          const gB = toGIdx.get(b.id) ?? 999;
          if (gA !== gB) return gA - gB;
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        });
        const colW = Math.max(...items.map(n => getNodeWidth(n)));
        let y = 80;
        let prevGIdx = -1;
        for (const n of items) {
          const gIdx = toGIdx.get(n.id) ?? -1;
          if (prevGIdx >= 0 && gIdx !== prevGIdx && gIdx >= 0) y += 40;
          newPos.set(n.id, { x: colX, y });
          y += getNodeHeight(n) + ROW_GAP;
          prevGIdx = gIdx;
        }
        colX += colW + COL_GAP;
      }
      setNodes(prev => prev.map(n => { const p = newPos.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
      setPanX(20); setPanY(20);
      setZoom(Math.min(0.85, window.innerWidth / (colX + 80)));
      return;
    }

    // ── Status-based layout (columns by nodeStatus) ──
    if (mode === "status") {
      const STATUS_ORDER: NodeStatus[] = ["active", "open", "decided", "pinned"];
      const ROW_GAP = 30;
      const COL_GAP = 40;
      const allGrps = [...(canvasGroups ?? []), ...userGroupsRef.current];
      const toGIdx = new Map<string, number>();
      allGrps.forEach((g, i) => { g.nodeIds.forEach(id => toGIdx.set(id, i)); });
      let colX = 80;
      const newPos = new Map<string, { x: number; y: number }>();
      for (const status of STATUS_ORDER) {
        const items = ns.filter(n => (n.nodeStatus ?? "open") === status);
        if (items.length === 0) continue;
        items.sort((a, b) => {
          const gA = toGIdx.get(a.id) ?? 999;
          const gB = toGIdx.get(b.id) ?? 999;
          if (gA !== gB) return gA - gB;
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        });
        const colW = Math.max(...items.map(n => getNodeWidth(n)));
        let y = 80;
        let prevGIdx = -1;
        for (const n of items) {
          const gIdx = toGIdx.get(n.id) ?? -1;
          if (prevGIdx >= 0 && gIdx !== prevGIdx && gIdx >= 0) y += 40;
          newPos.set(n.id, { x: colX, y });
          y += getNodeHeight(n) + ROW_GAP;
          prevGIdx = gIdx;
        }
        colX += colW + COL_GAP;
      }
      setNodes(prev => prev.map(n => { const p = newPos.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
      setPanX(20); setPanY(20);
      setZoom(Math.min(0.85, window.innerWidth / (colX + 80)));
      return;
    }

    // ── Tree layout (default, original code) ──

    const nodeMap = new Map(ns.map(n => [n.id, n]));
    const allIds  = new Set(ns.map(n => n.id));

    // Build: parentId → [childId]
    const childMap = new Map<string, string[]>();
    for (const c of conns) {
      if (!childMap.has(c.from)) childMap.set(c.from, []);
      childMap.get(c.from)!.push(c.to);
    }

    // Root query nodes = query nodes with no parent in canvas
    const rootQNodes = ns
      .filter((n): n is QueryNode => n.nodeType === "query" && (!n.parentId || !allIds.has(n.parentId)))
      .sort((a, b) => a.createdAt - b.createdAt);

    const MARGIN_X   = 80;
    const TREE_GAP_Y = 80;
    const curQW      = QUERY_NODE_W;
    const curDW      = DERIVED_W;

    const newPos = new Map<string, { x: number; y: number }>();
    let globalY = 80;

    function layoutTree(rootId: string, startX: number, startY: number): number {
      const root = nodeMap.get(rootId);
      if (!root) return startY + 200;
      newPos.set(rootId, { x: startX, y: startY });

      const children = (childMap.get(rootId) ?? [])
        .map(id => nodeMap.get(id)).filter(Boolean) as CanvasNode[];

      const derived     = children.filter(n => n.nodeType !== "query") as DerivedNode[];
      const childQNodes = children.filter((n): n is QueryNode => n.nodeType === "query")
        .sort((a, b) => a.createdAt - b.createdAt);

      const insights   = derived.filter(n => n.nodeType === "insight");
      const decisions  = derived.filter(n => n.nodeType === "decision");
      const scenarios  = derived.filter(n => n.nodeType === "scenario");
      const followups  = derived.filter(n => n.nodeType === "followup");
      const dimensions = derived.filter(n => n.nodeType === "dimensions");
      const causalgraphs = derived.filter(n => n.nodeType === "causalgraph");
      const hasSrc     = derived.some(n => (n as DerivedNode).sources?.length);

      const colA_X = startX + curQW + DERIVED_COL_GAP_X;
      const colB_X = colA_X + curDW + DERIVED_COL_GAP;
      const colC_X = colB_X + curDW + DERIVED_COL_GAP;
      let colA_Y   = startY;
      let colB_Y   = startY;
      let colC_Y   = startY;

      for (const n of insights) {
        newPos.set(n.id, { x: colA_X, y: colA_Y });
        colA_Y += estimateCardHeight("insight", n.content, undefined, hasSrc) + DERIVED_ROW_GAP;
      }
      if (insights.length > 0) colA_Y += 10;
      for (const n of decisions) {
        newPos.set(n.id, { x: colA_X, y: colA_Y });
        colA_Y += estimateCardHeight("decision", n.content, undefined, hasSrc) + DERIVED_ROW_GAP;
      }
      for (const n of scenarios) {
        newPos.set(n.id, { x: colB_X, y: colB_Y });
        colB_Y += estimateCardHeight("scenario", n.content, n.label, hasSrc) + DERIVED_ROW_GAP;
      }
      for (const n of dimensions) {
        newPos.set(n.id, { x: colC_X, y: colC_Y });
        colC_Y += DIMENSIONS_CARD_H + DERIVED_ROW_GAP;
      }
      for (const n of causalgraphs) {
        newPos.set(n.id, { x: colC_X, y: colC_Y });
        colC_Y += CAUSAL_GRAPH_CARD_H + DERIVED_ROW_GAP;
      }
      const rowY = Math.max(colA_Y, colB_Y, colC_Y) + 20;
      followups.forEach((n, i) => {
        newPos.set(n.id, { x: colA_X + i * (curDW + DERIVED_COL_GAP), y: rowY });
      });

      let clusterBottom = Math.max(
        startY + 160,
        colA_Y, colB_Y, colC_Y,
        followups.length > 0 ? rowY + 130 : 0
      );

      // Lay out child query nodes below this cluster (slightly indented)
      if (childQNodes.length > 0) {
        let childY = clusterBottom + TREE_GAP_Y;
        const childX = startX + 60;
        for (const cq of childQNodes) {
          const bottom = layoutTree(cq.id, childX, childY);
          childY = bottom + TREE_GAP_Y;
        }
        clusterBottom = childY - TREE_GAP_Y;
      }

      return clusterBottom;
    }

    for (const root of rootQNodes) {
      const bottom = layoutTree(root.id, MARGIN_X, globalY);
      globalY = bottom + TREE_GAP_Y;
    }

    // Orphaned nodes (no position assigned yet) — use actual heights
    const orphans = ns.filter(n => !newPos.has(n.id));
    const ORPHAN_COLS = 3;
    const orphanColYs = Array(ORPHAN_COLS).fill(globalY);
    orphans.forEach(n => {
      let bestCol = 0;
      for (let c = 1; c < ORPHAN_COLS; c++) { if (orphanColYs[c] < orphanColYs[bestCol]) bestCol = c; }
      newPos.set(n.id, { x: MARGIN_X + bestCol * (curQW + 60), y: orphanColYs[bestCol] });
      orphanColYs[bestCol] += getNodeHeight(n) + DERIVED_ROW_GAP;
    });

    // Apply positions
    setNodes(prev => prev.map(n => {
      const p = newPos.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    }));

    // Fit: show everything from origin
    setPanX(20);
    setPanY(20);
    setZoom(Math.min(0.85, window.innerWidth / (curQW + curDW * 2 + DERIVED_COL_GAP_X + DERIVED_COL_GAP + 200)));
  }, [canvasGroups]);

  // ── Drag / pan / zoom ────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.PointerEvent, id: string) => {
    const n = nodesRef.current.find(x => x.id === id);
    if (!n) return;
    draggingRef.current = { id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, id: string, currentW: number, currentH: number, dir: "h" | "v" | "both" = "both") => {
    e.stopPropagation();
    resizingRef.current = { id, dir, startX: e.clientX, startW: currentW, startY: e.clientY, startH: currentH };
  }, []);

  const handlePortDragStart = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const nw = node.nodeType === "query" ? ((node as QueryNode).customWidth ?? QUERY_NODE_W) :
      node.nodeType === "list" ? ((node as ListNode).customWidth ?? LIST_NODE_W) :
      node.nodeType === "file" ? ((node as FileNode).customWidth ?? FILE_NODE_W) :
      ((node as DerivedNode | NoteNode | IdeaNode).customWidth ?? DERIVED_W);
    const nh = node.nodeType === "query" ? ((node as QueryNode).customHeight ?? QUERY_NODE_H) :
      node.nodeType === "dimensions" ? DIMENSIONS_CARD_H :
      node.nodeType === "causalgraph" ? CAUSAL_GRAPH_CARD_H :
      ((node as DerivedNode | NoteNode | IdeaNode).customHeight ?? DERIVED_W);
    const prefill = node.nodeType === "query" ? (node as QueryNode).query :
      "queryText" in node ? (node as DerivedNode).queryText :
      node.nodeType === "note" ? (node as NoteNode).content :
      node.nodeType === "idea" ? (node as IdeaNode).title :
      node.nodeType === "list" ? (node as ListNode).title :
      node.nodeType === "file" ? (node as FileNode).fileName : "";
    const sourceCanvasX = node.x + nw;
    const sourceCanvasY = node.y + nh / 2;
    portDragRef.current = { nodeId, prefill, sourceCanvasX, sourceCanvasY, startClientX: e.clientX, startClientY: e.clientY };
    setPortDragPreview({ x1: sourceCanvasX, y1: sourceCanvasY, x2: sourceCanvasX, y2: sourceCanvasY });
  }, []);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== viewportRef.current) return;
    setProjectDropdownOpen(false);
    setSortMenuOpen(false);
    panningRef.current = { sx: e.clientX, sy: e.clientY, opx: panXRef.current, opy: panYRef.current };
    setSelectedId(null);
    setDetailNodeId(null);
    setMultiSelectedIds(new Set());
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(2.5, Math.max(0.2, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const cmdContextLabel = useMemo(() => {
    if (!cmdParentId) return undefined;
    const n = nodes.find(x => x.id === cmdParentId);
    if (!n) return undefined;
    if (n.nodeType === "query") return (n as QueryNode).query;
    if (n.nodeType === "file") return (n as FileNode).fileName ?? "Datei";
    if (n.nodeType === "list") return (n as ListNode).title ?? "Liste";
    if (n.nodeType === "note") return ((n as NoteNode).content ?? "").slice(0, 80);
    if (n.nodeType === "idea") return ((n as IdeaNode).title || (n as IdeaNode).content || "").slice(0, 80);
    return (n as DerivedNode).content?.slice(0, 80) ?? "";
  }, [cmdParentId, nodes]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--color-page-bg)" }}>

      {/* Backdrop for dropdown */}
      {projectDropdownOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setProjectDropdownOpen(false)} />
      )}

      {/* ── Global Header (hidden when embedded) ────────── */}
      {!embedded && hydrated && <AppHeader />}

      {/* ── Canvas Toolbar — Row 1: Project Bar ────────── */}
      {!embedded && hydrated && (<>
      <div style={{ height: 44, flexShrink: 0, zIndex: 190, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface, rgba(255,255,255,0.95))", backdropFilter: "blur(12px) saturate(160%)" }}>

        {/* ── LEFT: Project management ─────────────────────────────── */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, zIndex: 200, flexShrink: 0 }}>
          {/* Editable project name */}
          {editingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={saveProjectName}
              onKeyDown={e => { if (e.key === "Enter") saveProjectName(); if (e.key === "Escape") { setEditingName(false); } }}
              style={{ fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 8px", color: "var(--color-text-heading)", outline: "none", minWidth: 140 }}
            />
          ) : projectId ? (
            <span
              onClick={() => setEditingName(true)}
              title={de ? "Klicken zum Umbenennen" : "Click to rename"}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", cursor: "text", padding: "2px 4px", borderRadius: 4, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >{projectName || (de ? "Unbenanntes Projekt" : "Untitled")}</span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {de ? "Kein Projekt" : "No project"}
            </span>
          )}

          {/* Dropdown toggle */}
          <button
            onClick={() => setProjectDropdownOpen(o => !o)}
            style={{ padding: "3px 7px", fontSize: 10, background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer", color: "var(--color-text-muted)", transition: "all 0.12s", lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.3)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
          >{projectDropdownOpen ? "▴" : "▾"}</button>

          {/* Save status */}
          {projectId && saveStatus && (
            <span style={{ fontSize: 10, color: saveStatus === "saved" ? "#1A9E5A" : saveStatus === "error" ? "#E8402A" : "var(--color-text-muted)", minWidth: 80, transition: "opacity 0.5s" }}>
              {saveStatus === "saving" ? (de ? "↑ Speichert…" : "↑ Saving…")
                : saveStatus === "saved" ? (de ? "✓ Gespeichert" : "✓ Saved")
                : (de ? "! Fehler beim Speichern" : "! Save error")}
            </span>
          )}

          {/* Project dropdown — with "+ Neu" as first item */}
          {projectDropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              minWidth: 280, maxHeight: 320, overflowY: "auto",
            }}>
              {/* New project — always first item in dropdown */}
              <button
                onClick={() => { createNewProject(); setProjectDropdownOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "9px 14px", border: "none", borderBottom: "1px solid var(--color-border)",
                  background: "transparent", color: "var(--color-text-secondary)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-secondary)"; }}
              >
                <span style={{ fontSize: 14, fontWeight: 300, lineHeight: 1, color: "#1A9E5A" }}>+</span>
                {de ? "Neues Projekt erstellen" : "Create new project"}
              </button>
              {projects.length === 0 ? (
                <div style={{ padding: "16px 16px", fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                  {de ? "Noch keine Projekte" : "No projects yet"}
                </div>
              ) : (
                projects.map((p, i) => (
                  <div key={p.id}
                    style={{
                      padding: "9px 14px", display: "flex", alignItems: "center", gap: 8,
                      cursor: "pointer",
                      borderBottom: i < projects.length - 1 ? "1px solid var(--color-border)" : "none",
                      background: p.id === projectId ? "var(--color-page-bg)" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onClick={() => loadProject(p.id)}
                    onMouseEnter={e => { if (p.id !== projectId) (e.currentTarget as HTMLElement).style.background = "var(--color-page-bg)"; }}
                    onMouseLeave={e => { if (p.id !== projectId) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 11, color: p.id === projectId ? "var(--color-brand)" : "var(--color-text-muted)", flexShrink: 0 }}>
                      {p.id === projectId ? "◆" : p.hasState ? "◈" : "○"}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: p.id === projectId ? 600 : 400, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--color-text-muted)", flexShrink: 0 }}>
                      {new Date(p.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                      style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "2px 5px", color: "var(--color-text-muted)", fontSize: 11, borderRadius: 4, opacity: 0.6 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
                    >✕</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: View mode tabs (primary navigation) ─────────────── */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            padding: 3,
            background: "var(--muted, #F7F7F7)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}>
            {(["canvas","board","timeline","orbit"] as ViewMode[]).map(mode => {
              const icons: Record<ViewMode, React.ReactNode> = {
                canvas: <LayoutGrid className="w-3.5 h-3.5" />,
                board: <Columns3 className="w-3.5 h-3.5" />,
                timeline: <Clock className="w-3.5 h-3.5" />,
                orbit: <Hexagon className="w-3.5 h-3.5" />,
              };
              const labels: Record<ViewMode, string> = { canvas: "Canvas", board: "Board", timeline: de ? "Zeitlinie" : "Timeline", orbit: "Orbit" };
              const tips: Record<ViewMode, string> = {
                canvas: de ? "Freie Karten-Ansicht zum Denken und Analysieren" : "Free-form card layout for thinking and analysis",
                board: de ? "Strukturierte Spalten-Ansicht nach Node-Typ" : "Structured column view by node type",
                timeline: de ? "Chronologische Ansicht aller Analysen" : "Chronological view of all analyses",
                orbit: de ? "Orbit: Netzwerk & Evidenzketten" : "Orbit: Network & Evidence chains",
              };
              const isActive = viewMode === mode;
              return (
                <Tooltip key={mode} content={tips[mode]} placement="bottom">
                  <button
                    onClick={() => switchViewMode(mode)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11, padding: "5px 11px",
                      borderRadius: 6, border: "none",
                      background: isActive ? "var(--card, #fff)" : "transparent",
                      color: isActive ? "var(--foreground, #0A0A0A)" : "var(--muted-foreground, #6B6B6B)",
                      cursor: "pointer",
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: "var(--font-ui)",
                      boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.12s",
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; }}
                  >
                    {icons[mode]}
                    <span>{labels[mode]}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Compact action buttons ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* + Add node */}
          <button
            onClick={() => { setIterateCtx(null); setNodePickerVisible(true); }}
            title={de ? "Neue Karte hinzufügen (Abfrage, Notiz, Idee, Liste)" : "Add new card (query, note, idea, list)"}
            style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", transition: "all 0.12s", display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-secondary)"; el.style.borderColor = "var(--color-border)"; }}
          >
            <span style={{ fontSize: 15, fontWeight: 300, lineHeight: 1 }}>+</span>
            {de ? "Neu" : "Add"}
          </button>

          {/* Sort/Arrange dropdown */}
          {nodes.length > 1 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setSortMenuOpen(v => !v)}
                title={de ? "Karten sortieren und anordnen" : "Sort and arrange cards"}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: sortMenuOpen ? "var(--color-page-bg)" : "transparent", color: sortMenuOpen ? "var(--color-text-heading)" : "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                onMouseLeave={e => { if (!sortMenuOpen) { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; } }}
              ><LayoutGrid className="w-3 h-3 inline-block mr-1 -mt-px" /> {de ? "Ordnen" : "Arrange"} ▾</button>
              {sortMenuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setSortMenuOpen(false)} />
                  <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 160, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 300, padding: "4px 0", fontFamily: "var(--font-ui)" }}>
                    {/* ── Layout modes ── */}
                    <div style={{ padding: "2px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{de ? "Anordnen" : "Layout"}</div>
                    {([
                      { mode: "tree" as SortMode, icon: <TreePine className="w-3.5 h-3.5" />, label: de ? "Baum (Standard)" : "Tree (Default)" },
                      { mode: "time" as SortMode, icon: <Clock className="w-3.5 h-3.5" />, label: de ? "Zeitlich" : "By Time" },
                      { mode: "type" as SortMode, icon: <Layers className="w-3.5 h-3.5" />, label: de ? "Nach Typ" : "By Type" },
                      { mode: "status" as SortMode, icon: <Tag className="w-3.5 h-3.5" />, label: de ? "Nach Status" : "By Status" },
                    ] as const).map(item => (
                      <button key={item.mode}
                        onClick={() => { reorganizeCanvas(item.mode); setSortMenuOpen(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", border: "none", background: "transparent", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-page-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"; }}
                      >
                        <span className="flex-shrink-0 opacity-60">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}

                    {/* ── Gruppen-Sektion ── */}
                    <div style={{ height: 1, background: "var(--color-border)", margin: "6px 0" }} />
                    <div style={{ padding: "2px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{de ? "Gruppen" : "Groups"}</div>

                    {/* Hinweis auf Multi-Select */}
                    {multiSelectedIds.size < 2 && (
                      <div style={{ padding: "4px 14px 6px", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                        {de ? `⇧ Shift + Klick auf 2+ Karten, dann „Gruppieren"` : `⇧ Shift + click 2+ cards, then "Group"`}
                      </div>
                    )}

                    {/* Gruppieren-Button wenn Multi-Select aktiv */}
                    {multiSelectedIds.size >= 2 && (
                      <button
                        onClick={() => {
                          const ids = [...multiSelectedIds];
                          const gNodes = nodes.filter(n => ids.includes(n.id));
                          if (gNodes.length < 2) return;
                          const xs = gNodes.map(n => n.x);
                          const ys = gNodes.map(n => n.y);
                          const PAD = 40;
                          const colors = ["#2563EB", "#8B5CF6", "#F97316", "#1A9E5A", "#0369A1", "#D4A017"];
                          const newGroup: CanvasGroup = {
                            id: `ug-${Date.now()}`,
                            nodeIds: ids,
                            label: de ? "Neue Gruppe" : "New Group",
                            color: colors[userGroups.length % colors.length],
                            bounds: { x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD, w: Math.max(...gNodes.map(n => n.x + getNodeWidth(n))) - Math.min(...xs) + PAD * 2, h: Math.max(...gNodes.map(n => n.y + getNodeHeight(n))) - Math.min(...ys) + PAD * 2 },
                          };
                          setUserGroups(prev => [...prev, newGroup]);
                          setMultiSelectedIds(new Set());
                          setEditingGroupId(newGroup.id);
                          setSortMenuOpen(false);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", border: "none", background: "#2563EB0C", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2563EB18"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563EB0C"; }}
                      >
                        <Group className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{de ? `${multiSelectedIds.size} Karten gruppieren` : `Group ${multiSelectedIds.size} cards`}</span>
                      </button>
                    )}

                    {/* Bestehende Gruppen auflisten */}
                    {[...canvasGroups, ...userGroups].length > 0 && (
                      <>
                        {[...canvasGroups, ...userGroups].map(g => {
                          const isUser = userGroups.some(ug => ug.id === g.id);
                          return (
                            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 11, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                              <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{g.nodeIds.length}</span>
                              {isUser && (
                                <button
                                  onClick={() => { setUserGroups(prev => prev.filter(ug => ug.id !== g.id)); }}
                                  title={de ? "Gruppe auflösen" : "Remove group"}
                                  style={{ fontSize: 9, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; }}
                                >✕</button>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Alle Gruppen auflösen */}
                    {userGroups.length > 0 && (
                      <>
                        <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
                        <button
                          onClick={() => { setUserGroups([]); setSortMenuOpen(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", border: "none", background: "transparent", color: "#E8402A", fontSize: 11, fontWeight: 500, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <Trash2 className="w-3 h-3 flex-shrink-0" />
                          <span>{de ? "Alle Gruppen auflösen" : "Remove all groups"}</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Briefing button (icon-only with tooltip) */}
          {nodes.length >= 2 && (
            <Tooltip content={de ? "Strategisches Memo aus allen Analysen generieren" : "Generate strategic memo from all analyses"} placement="bottom">
              <button
                onClick={generateBriefing}
                disabled={briefingLoading}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontWeight: 500, opacity: briefingLoading ? 0.5 : 1, transition: "all 0.12s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{briefingLoading ? "..." : "Briefing"}</button>
            </Tooltip>
          )}

          {/* Export dropdown */}
          {nodes.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setExportMenuOpen(prev => !prev)}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: exportMenuOpen ? "var(--volt-surface-raised, #fff)" : "transparent", color: exportMenuOpen ? "var(--color-text-heading)" : "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s", fontWeight: 500 }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(0,0,0,0.3)"; el.style.color = "var(--color-text-heading)"; }}
                onMouseLeave={e => { if (!exportMenuOpen) { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border)"; el.style.color = "var(--color-text-muted)"; }}}
              >Export ▾</button>
              {exportMenuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setExportMenuOpen(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200,
                    background: "var(--volt-surface-raised, #fff)", border: "1px solid var(--color-border)",
                    borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 150,
                    padding: "4px 0", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  }}>
                    {([
                      { label: "Markdown (.md)", format: "markdown" as const },
                      { label: "JSON (.json)", format: "json" as const },
                      { label: "PDF (.pdf)", format: "pdf" as const },
                    ]).map(opt => (
                      <button key={opt.format} onClick={() => exportCanvas(opt.format)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 14px", fontSize: 12, background: "transparent", border: "none", color: "var(--color-text-primary, #333)", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(228,255,151,0.4)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas Toolbar — Row 2: Filter Bar (only when nodes exist) ────────── */}
      {nodes.length > 0 && (
      <div style={{ height: 32, flexShrink: 0, zIndex: 189, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, borderBottom: "1px solid var(--color-border)", background: "var(--color-page-bg)", fontSize: 11 }}>

        {/* LEFT: Stats */}
        <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>
          {queryNodes.length} {de ? "Abfragen" : "queries"} · {nodes.length - queryNodes.length} {de ? "Karten" : "cards"}
          {connections.length > 0 && ` · ${connections.length} ${de ? "Verb." : "links"}`}
        </span>

        {/* RIGHT: Layer toggles + Tag filters + Gruppieren */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Layer toggles — with counts and eye icon for clear affordance */}
          {(["analyse", "karte", "datei"] as CanvasLayer[]).map(layer => {
            const count = nodes.filter(n => NODE_LAYER[n.nodeType] === layer).length;
            if (count === 0) return null;
            const hidden = hiddenLayers.has(layer);
            return (
              <button key={layer}
                onClick={() => toggleLayer(layer)}
                title={de
                  ? `${LAYER_LABELS[layer].de} (${count}) ${hidden ? "einblenden" : "ausblenden"} — Klicken zum Umschalten`
                  : `${LAYER_LABELS[layer].de} (${count}) ${hidden ? "show" : "hide"} — Click to toggle`}
                style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 20, display: "flex", alignItems: "center", gap: 3,
                  border: `1px solid ${hidden ? "var(--color-border)" : LAYER_LABELS[layer].color}`,
                  background: hidden ? "transparent" : `${LAYER_LABELS[layer].color}18`,
                  color: hidden ? "var(--color-text-muted)" : LAYER_LABELS[layer].color,
                  cursor: "pointer", transition: "all 0.12s", fontWeight: 600,
                  opacity: hidden ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 10 }}>{hidden ? "◻" : "◼"}</span>
                {LAYER_LABELS[layer].de}
                <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}

          {/* Connection visibility toggle — 3 modes, each with a distinct visual
              state so the user never has to read the label to know what's on:
                auto → neutral pill (connections follow zoom/selection heuristics)
                show → filled dark pill with dot indicator (all connections forced on)
                hide → strike-through muted pill with dashed border (all off) */}
          {connections.length > 0 && (() => {
            const modeColor = connVisMode === "show"
              ? "#0A0A0A"
              : connVisMode === "hide"
              ? "#9CA3AF"
              : "#4B5563";
            const isShow = connVisMode === "show";
            const isHide = connVisMode === "hide";
            return (
              <button
                onClick={() => setConnVisMode(prev => prev === "auto" ? "show" : prev === "show" ? "hide" : "auto")}
                title={de ? "Verbindungslinien: auto → ein → aus" : "Connection lines: auto → show → hide"}
                style={{
                  fontSize: 10, padding: "1px 8px 1px 7px", borderRadius: 20,
                  border: isHide
                    ? `1px dashed ${modeColor}`
                    : isShow
                    ? `1px solid ${modeColor}`
                    : "1px solid var(--color-border)",
                  background: isShow
                    ? modeColor
                    : isHide
                    ? "transparent"
                    : "transparent",
                  color: isShow ? "#FFFFFF" : modeColor,
                  cursor: "pointer", transition: "all 0.12s", fontWeight: 600,
                  textDecoration: isHide ? "line-through" : "none",
                  opacity: isHide ? 0.75 : 1,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  boxShadow: isShow ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
                }}
              >
                {/* Mode indicator glyph — encodes the state beyond just the label */}
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isShow
                    ? "#E4FF97"
                    : isHide
                    ? "transparent"
                    : modeColor,
                  border: isHide ? `1.5px solid ${modeColor}` : "none",
                  flexShrink: 0,
                }} />
                {de
                  ? (connVisMode === "auto" ? "Verb. auto" : connVisMode === "show" ? "Verb. ein" : "Verb. aus")
                  : (connVisMode === "auto" ? "Links auto" : connVisMode === "show" ? "Links on" : "Links off")}
              </button>
            );
          })()}

          {/* Tag filter pills */}
          {allTags.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "nowrap", overflow: "hidden" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 1, flexShrink: 0 }}>Tags</span>
              {allTags.slice(0, 8).map(tag => {
                const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                const isActive = activeTagFilter === tag;
                return (
                  <button key={tag}
                    onClick={() => setActiveTagFilter(prev => prev === tag ? null : tag)}
                    style={{
                      fontSize: 9, padding: "1px 7px", borderRadius: 10, border: `1px solid ${isActive ? `hsl(${hue}, 55%, 50%)` : `hsl(${hue}, 45%, 80%)`}`,
                      background: isActive ? `hsl(${hue}, 55%, 92%)` : `hsl(${hue}, 55%, 96%)`, color: `hsl(${hue}, 55%, ${isActive ? 30 : 45}%)`,
                      fontWeight: isActive ? 700 : 500, cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", flexShrink: 0,
                      boxShadow: isActive ? `0 0 0 2px hsl(${hue}, 55%, 80%)` : "none",
                    }}
                  >{tag}</button>
                );
              })}
              {activeTagFilter && (
                <button onClick={() => setActiveTagFilter(null)}
                  style={{ fontSize: 9, padding: "1px 5px", borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
                  title={de ? "Tag-Filter aufheben" : "Clear tag filter"}
                >✕</button>
              )}
            </div>
          )}

          {/* Group button (when multi-selected) */}
          {multiSelectedIds.size >= 2 && (
            <button
              onClick={() => {
                const ids = [...multiSelectedIds];
                const gNodes = nodes.filter(n => ids.includes(n.id));
                if (gNodes.length < 2) return;
                const xs = gNodes.map(n => n.x);
                const ys = gNodes.map(n => n.y);
                const PAD = 40;
                const colors = ["#2563EB", "#8B5CF6", "#F97316", "#1A9E5A", "#0369A1", "#D4A017"];
                const newGroup: CanvasGroup = {
                  id: `ug-${Date.now()}`,
                  nodeIds: ids,
                  label: de ? "Neue Gruppe" : "New Group",
                  color: colors[userGroups.length % colors.length],
                  bounds: { x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD, w: Math.max(...xs) + 460 - Math.min(...xs) + PAD * 2, h: Math.max(...ys) + 200 - Math.min(...ys) + PAD * 2 },
                };
                setUserGroups(prev => [...prev, newGroup]);
                setMultiSelectedIds(new Set());
                setEditingGroupId(newGroup.id);
              }}
              title={de ? "Ausgewählte Karten gruppieren" : "Group selected cards"}
              style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 6, border: "1px solid #2563EB40", background: "#2563EB14", color: "#2563EB", cursor: "pointer", transition: "all 0.12s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2563EB"; el.style.color = "#fff"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2563EB14"; el.style.color = "#2563EB"; }}
            >
              <Group className="w-3 h-3 inline-block mr-0.5 -mt-px" /> {de ? "Gruppieren" : "Group"} ({multiSelectedIds.size})
            </button>
          )}
        </div>
      </div>
      )}
      </>)}

      {/* FIXED: DAT-08 / EDGE-09 — Concurrent tab warning banner */}
      {concurrentTabWarning && (
        <div style={{
          position: "absolute", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 9100,
          padding: "8px 20px", borderRadius: 8, background: "#FFFBEB", border: "1px solid #FCD34D",
          color: "#92400E", fontSize: 12, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          display: "flex", alignItems: "center", gap: 8, maxWidth: 560,
          animation: "sis-tooltip-in 0.15s ease",
        }}>
          <span>&#x26A0;</span>
          <span style={{ flex: 1 }}>
            {de
              ? "Canvas ist in einem anderen Tab ge\u00f6ffnet. \u00c4nderungen k\u00f6nnen verloren gehen (last-write-wins)."
              : "Canvas is open in another tab. Changes may be lost (last-write-wins)."}
          </span>
          <button onClick={() => setConcurrentTabWarning(false)} style={{ background: "none", border: "none", color: "#92400E", cursor: "pointer", fontSize: 14, padding: 0 }}>&#x2715;</button>
        </div>
      )}

      {/* Error banner */}
      {projectError && (
        <div style={{
          position: "absolute", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 9000,
          padding: "8px 20px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5",
          color: "#E8402A", fontSize: 12, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          display: "flex", alignItems: "center", gap: 8, maxWidth: 500,
          animation: "sis-tooltip-in 0.15s ease",
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{projectError}</span>
          <button onClick={() => setProjectError(null)} style={{ background: "none", border: "none", color: "#E8402A", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Loading overlay for project operations */}
      {projectOp && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 8000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)",
          pointerEvents: "all",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><RefreshCw size={20} style={{ animation: "spin 1s linear infinite", color: "var(--color-text-muted)" }} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)" }}>
              {projectOp === "creating" ? (de ? "Erstelle Projekt…" : "Creating project…") :
               projectOp === "deleting" ? (de ? "Lösche Projekt…" : "Deleting project…") :
               (de ? "Lade Projekt…" : "Loading project…")}
            </div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Template Picker Modal (Volt UI Node Canvas style) ────── */}
      {showTemplatePicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowTemplatePicker(false)}
        >
          <div style={{
            background: "var(--color-surface, #fff)",
            borderRadius: 20,
            padding: 0,
            width: "min(880px, 92vw)",
            maxHeight: "90vh",
            overflow: "hidden",
            boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
          }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Modal Header (Volt UI Page-Header pattern) ── */}
            <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <VoltIconBox icon={<GitBranch size={22} />} variant="lime" size={44} rounded="lg" />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: "var(--muted-foreground, #6B6B6B)",
                    marginBottom: 6,
                  }}>
                    {de ? "Workflow-System" : "Workflow System"}
                  </div>
                  <h2 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    color: "var(--foreground, #0A0A0A)",
                    margin: 0,
                    lineHeight: 1.15,
                  }}>
                    Node Canvas
                  </h2>
                  <p style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: "var(--muted-foreground, #6B6B6B)",
                    margin: "8px 0 0",
                    lineHeight: 1.55,
                    maxWidth: 600,
                  }}>
                    {de
                      ? "Ein interaktives Canvas-System für visuelle Workflows, KI-Pipelines und strategische Analysen. Wähle ein Framework zum Start oder beginne mit einem leeren Canvas."
                      : "An interactive canvas system for visual workflows, AI pipelines and strategic analyses. Pick a framework to start or begin with an empty canvas."}
                  </p>
                </div>
                <button onClick={() => setShowTemplatePicker(false)}
                  style={{
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >✕</button>
              </div>
            </div>

            {/* ── Scrollable content ── */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 28px" }}>

              {/* Section label: Pipeline-Templates */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground)",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span>{de ? "Pipeline-Templates" : "Pipeline Templates"}</span>
                <span style={{ opacity: 0.7 }}>({TEMPLATES.length})</span>
              </div>

              {/* Template Grid — Volt UI Node Canvas card style */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
                {TEMPLATES.map(t => {
                  // Volt UI Node Canvas prefix pill: AI/ETL/LOGIC/MM/CRON style
                  const prefixMap: Record<string, { prefix: string; variant: "lime" | "mint" | "blue" | "orchid" | "butter" | "rose" | "peach" | "light" }> = {
                    "empty":              { prefix: "NEW",  variant: "light"  },
                    "market-analysis":    { prefix: "MKT",  variant: "blue"   },
                    "war-gaming":         { prefix: "WAR",  variant: "rose"   },
                    "pre-mortem":         { prefix: "PRE",  variant: "peach"  },
                    "post-mortem":        { prefix: "POST", variant: "mint"   },
                    "trend-deep-dive":    { prefix: "TRND", variant: "orchid" },
                    "stakeholder-mapping":{ prefix: "STKH", variant: "butter" },
                  };
                  const meta = prefixMap[t.id] || { prefix: "FW", variant: "light" as const };
                  const prefixStyles = {
                    lime:   { bg: "var(--volt-lime, #E4FF97)", text: "#0A0A0A" },
                    light:  { bg: "var(--muted, #F7F7F7)", text: "#6B6B6B" },
                    mint:   { bg: "var(--pastel-mint, #C3F4D3)", text: "#0F6038" },
                    blue:   { bg: "var(--pastel-blue, #D4E8FF)", text: "#1A4A8A" },
                    rose:   { bg: "var(--pastel-rose, #FFD6E0)", text: "#A0244A" },
                    butter: { bg: "var(--pastel-butter, #FFF5BA)", text: "#7A5C00" },
                    orchid: { bg: "var(--pastel-orchid, #FDE2FF)", text: "#7C1A9E" },
                    peach:  { bg: "var(--pastel-peach, #FFECD2)", text: "#955A20" },
                  };
                  const ps = prefixStyles[meta.variant];
                  return (
                    <button key={t.id}
                      onClick={() => {
                        if (t.id === "empty") {
                          setShowTemplatePicker(false);
                          return;
                        }
                        const topic = window.prompt(de ? "Thema eingeben:" : "Enter topic:", "");
                        if (!topic?.trim()) return;
                        const fw = FRAMEWORKS.find(f => f.id === t.id);
                        if (fw) {
                          const steps: WorkflowStep[] = fw.steps.map((s, i) => ({
                            id: `step-${i}`,
                            title: s.title,
                            description: s.description,
                            status: (i === 0 ? "pending" : s.dependsOn.every(d => false) ? "pending" : "locked") as "pending" | "locked",
                            queryTemplate: s.queryTemplate,
                            dependsOn: s.dependsOn,
                            userInputPrompt: s.userInputPrompt,
                          }));
                          steps.forEach((s, i) => {
                            if (fw.steps[i].dependsOn.length === 0) s.status = "pending";
                            else s.status = "locked";
                          });
                          setActiveWorkflow({
                            frameworkId: fw.id,
                            frameworkName: de ? fw.name : fw.nameEn,
                            methodology: de ? fw.methodology : fw.methodologyEn,
                            topic: topic.trim(),
                            steps,
                            currentStepIndex: 0,
                          });
                          setShowTemplatePicker(false);
                          return;
                        }
                        const result = t.build(topic.trim());
                        setNodes(result.nodes as any[]);
                        setConnections(result.conns as any[]);
                        setZoom(0.7);
                        setShowTemplatePicker(false);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--card, #fff)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        fontFamily: "var(--font-ui)",
                        minHeight: 102,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--color-border)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Prefix pill + title row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 7px",
                          borderRadius: 4,
                          background: ps.bg,
                          color: ps.text,
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          lineHeight: 1.2,
                          flexShrink: 0,
                        }}>
                          {meta.prefix}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--foreground, #0A0A0A)",
                          letterSpacing: "-0.01em",
                          lineHeight: 1.2,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {de ? t.labelDe : t.labelEn}
                        </span>
                      </div>
                      {/* Description */}
                      <div style={{
                        fontSize: 11,
                        color: "var(--muted-foreground, #6B6B6B)",
                        lineHeight: 1.5,
                        fontFamily: "var(--font-ui)",
                        flex: 1,
                      }}>
                        {de ? t.descDe : t.descEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Node Canvas Features (Volt UI spec summary) ── */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground)",
                marginBottom: 12,
              }}>
                {de ? "Was drin ist" : "What's inside"}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}>
                {[
                  { label: de ? "Node-Typen" : "Node Types", value: "12", hint: de ? "Query, Insight, Scenario…" : "Query, Insight, Scenario…" },
                  { label: de ? "Edge-Stile" : "Edge Styles", value: "4", hint: "Bezier · Step · Straight · Smooth" },
                  { label: de ? "Status-Zustände" : "Status States", value: "6", hint: de ? "Idle · Running · Done · Error…" : "Idle · Running · Done · Error…" },
                  { label: de ? "Ansichten" : "Views", value: "4", hint: "Canvas · Board · Timeline · Orbit" },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--muted, #F7F7F7)",
                    border: "1px solid var(--color-border)",
                  }}>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase" as const,
                      color: "var(--muted-foreground)",
                      marginBottom: 4,
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--foreground)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      marginBottom: 4,
                    }}>
                      {item.value}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.4,
                      fontFamily: "var(--font-ui)",
                    }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Node-Status Legend (Volt UI Node-Status spec) ── */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground)",
                marginBottom: 10,
              }}>
                {de ? "Node-Status" : "Node Status"}
              </div>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}>
                {[
                  { dot: "#9CA3AF", label: de ? "Idle" : "Idle" },
                  { dot: "var(--volt-lime, #E4FF97)", label: de ? "Running" : "Running" },
                  { dot: "#1A9E5A", label: de ? "Success" : "Success" },
                  { dot: "#E8402A", label: de ? "Error" : "Error" },
                  { dot: "#F5A623", label: de ? "Warning" : "Warning" },
                  { dot: "#D1D5DB", label: de ? "Disabled" : "Disabled" },
                ].map((s, i) => (
                  <span key={i} style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 9999,
                    border: "1px solid var(--color-border)",
                    background: "var(--card, #fff)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                  }}>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: s.dot,
                      border: s.dot.includes("E4FF97") ? "1px solid #C8E873" : "none",
                    }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for NodePicker "Datei" upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/* ── Workflow Panel (right sidebar when active) ────────────── */}
      {activeWorkflow && (
        <div style={{ position: "fixed", right: 0, top: embedded ? 0 : 48, bottom: 0, zIndex: 500 }}>
          <WorkflowPanel
            workflow={activeWorkflow}
            onClose={() => setActiveWorkflow(null)}
            onStartStep={(stepIndex, userContext) => {
              if (!activeWorkflow) return;
              const step = activeWorkflow.steps[stepIndex];
              if (!step) return;

              // Build query from template
              const fw = FRAMEWORKS.find(f => f.id === activeWorkflow.frameworkId);
              if (!fw) return;
              const fwStep = fw.steps[stepIndex];

              // Gather context from dependency steps
              let context = "";
              fwStep.dependsOn.forEach(depIdx => {
                const depStep = activeWorkflow.steps[depIdx];
                if (depStep?.synthesis) {
                  context += `[${depStep.title}]: ${depStep.synthesis}\n\n`;
                }
              });

              let query = fwStep.queryTemplate
                .replace(/\{topic\}/g, activeWorkflow.topic)
                .replace(/\{context\}/g, context);

              // Add user context if provided
              if (userContext?.trim()) {
                query += `\n\nNUTZER-KONTEXT: ${userContext.trim()}`;
              }

              // Update step status to running
              setActiveWorkflow(prev => {
                if (!prev) return null;
                const newSteps = [...prev.steps];
                newSteps[stepIndex] = { ...newSteps[stepIndex], status: "running" };
                return { ...prev, steps: newSteps, currentStepIndex: stepIndex };
              });

              // Submit the query with a generated parent connection
              const parentNodeId = stepIndex > 0
                ? activeWorkflow.steps.find((s, i) => i < stepIndex && s.queryNodeId)?.queryNodeId
                : undefined;

              const nodeId = uid();
              const pos = getNextQueryPos(parentNodeId);
              const qNode: QueryNode = {
                id: nodeId, nodeType: "query", x: pos.x, y: pos.y, query: query.slice(0, 200) + "...", locale,
                status: "loading", synthesis: "", result: null, collapsed: false,
                parentId: parentNodeId, createdAt: Date.now(), tags: [activeWorkflow.frameworkId, `schritt-${stepIndex + 1}`],
              };
              setNodes(prev => [...prev, qNode]);
              if (parentNodeId) setConnections(prev => [...prev, { from: parentNodeId, to: nodeId, connectionType: "builds-on" }]);

              // Store nodeId in workflow
              setActiveWorkflow(prev => {
                if (!prev) return null;
                const newSteps = [...prev.steps];
                newSteps[stepIndex] = { ...newSteps[stepIndex], queryNodeId: nodeId };
                return { ...prev, steps: newSteps };
              });

              // Stream the query
              streamQuery(
                query, locale,
                (chunk) => setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
                (result) => {
                  const synthesis = result.synthesis ?? "";
                  setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, status: "done", synthesis, result } as QueryNode : n));

                  // Update workflow: mark step as done, unlock dependents
                  setActiveWorkflow(prev => {
                    if (!prev) return null;
                    const newSteps = [...prev.steps];
                    newSteps[stepIndex] = { ...newSteps[stepIndex], status: "done", synthesis };

                    // Unlock steps whose dependencies are all done
                    newSteps.forEach((s, i) => {
                      if (s.status === "locked") {
                        const deps = fw!.steps[i].dependsOn;
                        if (deps.every(d => newSteps[d]?.status === "done")) {
                          newSteps[i] = { ...newSteps[i], status: "pending" };
                        }
                      }
                    });

                    // Find next pending step
                    const nextPending = newSteps.findIndex(s => s.status === "pending");

                    return { ...prev, steps: newSteps, currentStepIndex: nextPending >= 0 ? nextPending : stepIndex };
                  });

                  // Also generate derived nodes from the result
                  const derived = computeDerivedNodes(nodeId, pos.x, pos.y, result);
                  const derivedConns = derived.map(d => ({ from: nodeId, to: d.id, derived: true }));
                  setTimeout(() => {
                    setNodes(prev => [...prev, ...derived]);
                    setConnections(prev => [...prev, ...derivedConns]);
                  }, 300);
                },
                (errMsg) => {
                  setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, status: "error", errorMsg: errMsg } as QueryNode : n));
                  setActiveWorkflow(prev => {
                    if (!prev) return null;
                    const newSteps = [...prev.steps];
                    newSteps[stepIndex] = { ...newSteps[stepIndex], status: "pending" }; // allow retry
                    return { ...prev, steps: newSteps };
                  });
                },
                (phase) => setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
              );
            }}
          />
        </div>
      )}

      {/* ── Canvas viewport ──────────────────────────────────────── */}
      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onWheel={handleWheel}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={handleCanvasDrop}
        style={{
          flex: 1, position: "relative", overflow: "hidden",
          background: "var(--color-page-bg)",
          ...(viewMode === "canvas" ? {
            backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.18) 0.85px, transparent 0.85px)",
            backgroundSize: "24px 24px",
            backgroundAttachment: "fixed",
          } : {}),
        }}
      >
        {/* FIXED: UX-09 — Empty state / onboarding guidance */}
        {nodes.length === 0 && viewMode === "canvas" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: "var(--muted-foreground, #888)", fontFamily: "var(--font-display)", maxWidth: 400, zIndex: 10, pointerEvents: "none" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#x1F9ED;</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--color-text-heading, #333)" }}>Willkommen im Canvas</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Tippe eine Frage ein und dr&uuml;cke Enter, um zu starten.<br/>
              Nutze <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface, #fff)", fontSize: 11 }}>/trend</kbd>, <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface, #fff)", fontSize: 11 }}>/scenario</kbd> oder <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface, #fff)", fontSize: 11 }}>/signal</kbd> f&uuml;r spezifische Analysen.
            </div>
          </div>
        )}

        {/* Canvas transform layer */}
        {viewMode === "canvas" && (
          <ErrorBoundary>
          <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            <ConnectionsSVG nodes={visibleNodes} connections={connections} pipelineChain={pipelineChain} selectedId={selectedId} zoom={zoom} activeTagFilter={activeTagFilter} nodeTagMap={nodeTagMap} nodeGroupMap={nodeGroupMap} connVisMode={connVisMode} de={de} />

            {/* Port drag preview line */}
            {portDragPreview && (
              <svg style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none", zIndex: 100 }}>
                <defs>
                  <marker id="portDragArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="var(--color-brand)" opacity="0.7" />
                  </marker>
                </defs>
                <line
                  x1={portDragPreview.x1} y1={portDragPreview.y1}
                  x2={portDragPreview.x2} y2={portDragPreview.y2}
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  opacity={0.65}
                  markerEnd="url(#portDragArrow)"
                />
                <circle cx={portDragPreview.x2} cy={portDragPreview.y2} r={5} fill="var(--color-brand)" opacity={0.7} />
              </svg>
            )}

            {/* Auto-computed group blobs */}
            {canvasGroups.map(g => {
              const matchRatio = activeTagFilter
                ? g.nodeIds.filter(id => (nodeTagMap.get(id) ?? []).includes(activeTagFilter!)).length / g.nodeIds.length
                : 1;
              const groupOpacity = matchRatio >= 0.3 ? 1 : matchRatio > 0 ? 0.35 : 0.15;
              return (
              <div key={g.id} style={{
                position: "absolute",
                left: g.bounds.x, top: g.bounds.y,
                width: g.bounds.w, height: g.bounds.h,
                background: `${g.color}18`,
                border: `2px solid ${g.color}38`,
                borderRadius: 24,
                pointerEvents: "none",
                boxShadow: `inset 0 0 30px ${g.color}0C, 0 0 0 1px ${g.color}12`,
                opacity: groupOpacity,
                transition: "opacity 0.2s",
              }}>
                <div style={{
                  // Float the label above the group frame so it acts like a
                  // tab-style header — gives clear breathing room between the
                  // label pill and the first card inside the group.
                  position: "absolute", top: -13, left: 14,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                  color: g.color,
                  background: "var(--color-surface, #FFFFFF)",
                  boxShadow: `0 0 0 1px ${g.color}55, 0 1px 2px rgba(0,0,0,0.04)`,
                  padding: "3px 10px",
                  borderRadius: 8,
                  fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                  lineHeight: 1.2,
                }}>{g.label}</div>
              </div>
              );
            })}

            {/* User-created group blobs */}
            {userGroups.map(g => {
              // Recompute bounds dynamically from current node positions AND
              // transitive descendants — otherwise the box only covers the
              // explicitly-grouped queries and misses their derived cards.
              const boundsNodeIds = new Set<string>(g.nodeIds);
              let addedU = true;
              while (addedU) {
                addedU = false;
                for (const n of nodes) {
                  if (n.parentId && boundsNodeIds.has(n.parentId) && !boundsNodeIds.has(n.id)) {
                    boundsNodeIds.add(n.id);
                    addedU = true;
                  }
                }
              }
              const gNodes = Array.from(boundsNodeIds).map(id => nodes.find(n => n.id === id)).filter(Boolean) as CanvasNode[];
              if (gNodes.length < 2) return null;
              const xs = gNodes.map(n => n.x);
              const ys = gNodes.map(n => n.y);
              const PAD = 40;
              const bounds = {
                x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD,
                w: Math.max(...gNodes.map(n => n.x + getNodeWidth(n))) - Math.min(...xs) + PAD * 2,
                h: Math.max(...gNodes.map(n => n.y + getNodeHeight(n))) - Math.min(...ys) + PAD * 2,
              };
              const matchRatio = activeTagFilter
                ? g.nodeIds.filter(id => (nodeTagMap.get(id) ?? []).includes(activeTagFilter!)).length / g.nodeIds.length
                : 1;
              const groupOpacity = matchRatio >= 0.3 ? 1 : matchRatio > 0 ? 0.35 : 0.15;
              return (
                <div key={g.id} style={{
                  position: "absolute",
                  left: bounds.x, top: bounds.y,
                  width: bounds.w, height: bounds.h,
                  background: `${g.color}18`,
                  border: `2px solid ${g.color}38`,
                  boxShadow: `inset 0 0 30px ${g.color}0C, 0 0 0 1px ${g.color}12`,
                  borderRadius: 24,
                  opacity: groupOpacity,
                  transition: "opacity 0.2s",
                }}>
                  {/* Editable label — tab-style header floating above frame */}
                  <div style={{ position: "absolute", top: -13, left: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    {editingGroupId === g.id ? (
                      <input
                        autoFocus
                        defaultValue={g.label}
                        onBlur={e => {
                          setUserGroups(prev => prev.map(gg => gg.id === g.id ? { ...gg, label: e.target.value || g.label } : gg));
                          setEditingGroupId(null);
                        }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setEditingGroupId(null); } }}
                        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: g.color, background: "var(--color-surface, #FFFFFF)", border: `1px solid ${g.color}50`, borderRadius: 8, padding: "3px 10px", outline: "none", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", lineHeight: 1.2 }}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingGroupId(g.id)}
                        style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                          color: g.color, cursor: "pointer",
                          background: "var(--color-surface, #FFFFFF)",
                          boxShadow: `0 0 0 1px ${g.color}55, 0 1px 2px rgba(0,0,0,0.04)`,
                          padding: "3px 10px",
                          borderRadius: 8,
                          lineHeight: 1.2,
                          fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                        }}
                        title={de ? "Klicken zum Umbenennen" : "Click to rename"}
                      >{g.label}</span>
                    )}
                    <button
                      onClick={() => setUserGroups(prev => prev.filter(gg => gg.id !== g.id))}
                      title={de ? "Gruppe auflösen" : "Remove group"}
                      style={{ fontSize: 10, color: `${g.color}88`, background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = `${g.color}88`; }}
                    >✕</button>
                  </div>
                </div>
              );
            })}

            {/* Multi-select outlines */}
            {multiSelectedIds.size > 0 && visibleNodes.filter(n => multiSelectedIds.has(n.id)).map(n => {
              const nw = n.nodeType === "query" ? ((n as QueryNode).customWidth ?? QUERY_NODE_W) : ((n as DerivedNode).customWidth ?? DERIVED_W);
              const nh = n.nodeType === "query" ? ((n as QueryNode).customHeight ?? QUERY_NODE_W) : ((n as DerivedNode).customHeight ?? DERIVED_W);
              return (
                <div key={`ms-${n.id}`} style={{
                  position: "absolute", left: n.x - 4, top: n.y - 4,
                  width: nw + 8, height: nh + 8,
                  border: "2px dashed #2563EB", borderRadius: 14,
                  pointerEvents: "none",
                  boxShadow: "0 0 0 2px rgba(37,99,235,0.15)",
                }} />
              );
            })}

            {/* Group membership left-border stripes */}
            {visibleNodes.map(n => {
              const grpColor = nodeGroupColor.get(n.id);
              if (!grpColor) return null;
              const isDimmedBySelection = selectedId !== null && !pipelineChain.has(n.id);
              const isDimmedByTag = activeTagFilter !== null && !(n.tags ?? []).includes(activeTagFilter);
              const isDimmed = isDimmedBySelection || isDimmedByTag;
              return (
                <div key={`grp-${n.id}`} style={{
                  position: "absolute", left: n.x - 5, top: n.y + 4,
                  width: 3, height: getNodeHeight(n) - 8,
                  background: grpColor, borderRadius: 2,
                  pointerEvents: "none", opacity: isDimmed ? 0.15 : 0.7,
                  transition: "opacity 0.2s",
                }} />
              );
            })}

            {visibleNodes.map(n => {
              const isDimmedBySelection = selectedId !== null && !pipelineChain.has(n.id);
              const isDimmedByTag = activeTagFilter !== null && !(n.tags ?? []).includes(activeTagFilter);
              const isDimmed = isDimmedBySelection || isDimmedByTag;
              const isMultiSelected = multiSelectedIds.has(n.id);
              if (n.nodeType === "query") {
                const qNode = n as QueryNode;
                return (
                  <QueryNodeCard key={n.id}
                    node={qNode} de={de}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onFollowUp={handleFollowUp}
                    onFollowUpQ={(id, q) => handleFollowUp(id, q)}
                    onDelete={deleteNode}
                    onToggleCollapse={toggleCollapse}
                    onRefresh={handleRefresh}
                    onResizeStart={handleResizeStart}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={qNode.customWidth ?? QUERY_NODE_W}
                    dimmed={isDimmed}
                    zoom={zoom}
                    causalFingerprint={(() => {
                      const cg = nodes.find(c => c.parentId === n.id && c.nodeType === "causalgraph") as DerivedNode | undefined;
                      if (!cg?.causalEdges?.length) return undefined;
                      const names = cg.causalTrendNames ?? {};
                      const counts = new Map<string, number>();
                      cg.causalEdges.forEach(e => {
                        counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
                        counts.set(e.to, (counts.get(e.to) ?? 0) + 1);
                      });
                      return Array.from(counts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([id]) => names[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                    })()}
                    childCounts={(() => {
                      const children = nodes.filter(c => c.parentId === n.id);
                      return {
                        insights:  children.filter(c => c.nodeType === "insight").length,
                        scenarios: children.filter(c => c.nodeType === "scenario").length,
                        decisions: children.filter(c => c.nodeType === "decision").length,
                        followups: children.filter(c => c.nodeType === "followup").length,
                        causal:    children.filter(c => c.nodeType === "causalgraph").length,
                      };
                    })()}
                    duplicateIndex={queryDupIndex.get(n.id) ?? 0}
                    onAddTag={handleAddTag}
                    onSetStatus={handleSetNodeStatus}
                  />
                );
              }
              if (n.nodeType === "note") {
                const nNode = n as NoteNode;
                return (
                  <NoteNodeCard key={n.id}
                    node={nNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onUpdate={handleUpdateNote}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    onPromote={handlePromoteNote}
                    nodeW={nNode.customWidth ?? 280}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              if (n.nodeType === "idea") {
                const iNode = n as IdeaNode;
                return (
                  <IdeaNodeCard key={n.id}
                    node={iNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onUpdate={handleUpdateIdea}
                    onPromote={handlePromoteIdea}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={iNode.customWidth ?? 300}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              if (n.nodeType === "list") {
                const lNode = n as ListNode;
                return (
                  <ListNodeCard key={n.id}
                    node={lNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onUpdate={handleUpdateList}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={lNode.customWidth ?? 280}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              if (n.nodeType === "file") {
                const fNode = n as FileNode;
                return (
                  <FileNodeCard key={n.id}
                    node={fNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onAnalyze={(query, parentId) => submitQuery(query, parentId)}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={fNode.customWidth ?? FILE_NODE_W}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              const dNode = n as DerivedNode;
              if (dNode.nodeType === "dimensions") {
                return (
                  <DimensionsNodeCard key={n.id}
                    node={dNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={dNode.customWidth ?? DERIVED_W}
                    dimmed={isDimmed}
                  />
                );
              }
              if (dNode.nodeType === "causalgraph") {
                return (
                  <CausalGraphNodeCard key={n.id}
                    node={dNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={dNode.customWidth ?? DERIVED_W}
                    dimmed={isDimmed}
                  />
                );
              }
              return (
                <DerivedNodeCard key={n.id}
                  node={dNode} de={de}
                  selected={selectedId === n.id}
                  onSelect={handleSelectNode}
                  onDragStart={handleDragStart}
                  onExplore={handleExplore}
                  onDelete={deleteNode}
                  onResizeStart={handleResizeStart}
                  onIterate={handleIterateFromNode}
                  onPortDragStart={handlePortDragStart}
                  onAddTag={handleAddTag}
                  onSetStatus={handleSetNodeStatus}
                  nodeW={dNode.customWidth ?? DERIVED_W}
                  dimmed={isDimmed}
                  zoom={zoom}
                />
              );
            })}
          </div>
          </ErrorBoundary>
        )}

        {/* Board mode */}
        {viewMode === "board" && (
          <div style={{ display: "flex", gap: 0, height: "100%", overflowX: "auto" }}>
            {BOARD_COLUMNS.map(col => {
              const allGroups = [...canvasGroups, ...userGroups];
              const colNodes = nodes.filter(n => col.types.includes(n.nodeType))
                .sort((a, b) => {
                  // Group members together, then by createdAt
                  const gA = allGroups.findIndex(g => g.nodeIds.includes(a.id));
                  const gB = allGroups.findIndex(g => g.nodeIds.includes(b.id));
                  if (gA !== gB) return gA - gB;
                  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
                });
              return (
                <div key={col.key} style={{ minWidth: 280, flex: 1, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                    <span className="section-label" style={{ color: col.color, marginBottom: 0 }}>{de ? col.labelDe : col.labelEn}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-page-bg)", padding: "1px 6px", borderRadius: 10, border: "1px solid var(--color-border)" }}>{colNodes.length}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {colNodes.map(n => {
                      const grpColor = nodeGroupColor.get(n.id);
                      return (
                      <div key={n.id}
                        onClick={() => handleSelectNode(n.id)}
                        style={{
                          padding: "10px 12px", borderRadius: 10, border: `1px solid ${selectedId === n.id ? col.color : "var(--color-border)"}`,
                          borderLeft: grpColor ? `3px solid ${grpColor}` : undefined,
                          background: "var(--color-surface)", cursor: "pointer", transition: "all 0.12s",
                          boxShadow: selectedId === n.id ? `0 0 0 2px ${col.color}40` : "0 1px 4px rgba(0,0,0,0.06)",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = col.color}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = selectedId === n.id ? col.color : "var(--color-border)"}
                      >
                        {grpColor && (
                          <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: grpColor, marginBottom: 3, fontFamily: "var(--font-code, monospace)" }}>
                            {allGroups.find(g => g.nodeIds.includes(n.id))?.label}
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", lineHeight: 1.35, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {n.nodeType === "query" ? (n as QueryNode).query
                           : n.nodeType === "note" ? (n as NoteNode).content.slice(0,80)
                           : n.nodeType === "idea" ? (n as IdeaNode).title || (n as IdeaNode).content.slice(0,80)
                           : n.nodeType === "list" ? (n as ListNode).title || (n as ListNode).items?.[0] || "Liste"
                           : n.nodeType === "file" ? (n as FileNode).fileName
                           : (n as DerivedNode).label || (n as DerivedNode).content?.slice(0,80)}
                        </div>
                        {n.nodeType === "query" && (n as QueryNode).synthesis && (
                          <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(n as QueryNode).synthesis.slice(0,120)}
                          </p>
                        )}
                        {/* Causal fingerprint on query cards */}
                        {n.nodeType === "query" && (() => {
                          const cgChild = nodes.find(c => c.parentId === n.id && c.nodeType === "causalgraph") as DerivedNode | undefined;
                          if (!cgChild?.causalEdges?.length) return null;
                          const fpNames = cgChild.causalTrendNames ?? {};
                          const fpCounts = new Map<string, number>();
                          cgChild.causalEdges.forEach(e => {
                            fpCounts.set(e.from, (fpCounts.get(e.from) ?? 0) + 1);
                            fpCounts.set(e.to, (fpCounts.get(e.to) ?? 0) + 1);
                          });
                          const fingerprint = Array.from(fpCounts.entries())
                            .sort((a, b) => b[1] - a[1]).slice(0, 3)
                            .map(([id]) => fpNames[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                          return fingerprint.length > 0 ? (
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                              {fingerprint.map(t => (
                                <span key={t} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: "#1A9E5A14", color: "#1A9E5A", fontWeight: 600, fontFamily: "var(--font-code, monospace)" }}>{t}</span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        {/* Causal preview on causalgraph cards */}
                        {n.nodeType === "causalgraph" && (() => {
                          const cgNode = n as DerivedNode;
                          const edges = cgNode.causalEdges ?? [];
                          if (!edges.length) return null;
                          const names = cgNode.causalTrendNames ?? {};
                          const topTrends = Array.from(new Set(
                            edges.flatMap(e => [e.from, e.to])
                          )).slice(0, 4).map(id => names[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                          const typeCounts = new Map<string, number>();
                          edges.forEach(e => typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1));
                          return (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ fontSize: 10, color: EDGE_STYLE.drives.color, fontWeight: 600, marginBottom: 2 }}>
                                {edges.length} {de ? "Beziehungen" : "relations"}
                              </div>
                              {topTrends.length > 0 && (
                                <div style={{ fontSize: 10, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                                  {topTrends.join(", ")}
                                </div>
                              )}
                              <div style={{ fontSize: 9, color: "var(--color-text-muted)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {Array.from(typeCounts.entries()).map(([type, count]) => (
                                  <span key={type} style={{ color: EDGE_STYLE[type]?.color ?? "var(--color-text-muted)" }}>
                                    {count}× {de ? (EDGE_STYLE[type]?.labelDe ?? type) : (EDGE_STYLE[type]?.labelEn ?? type)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--color-text-muted)" }}>
                          <span>{formatNodeTime(n.createdAt)}</span>
                          {(n as any).nodeStatus && (n as any).nodeStatus !== "open" && (
                            <span style={{ color: NODE_STATUS_META[(n as any).nodeStatus as NodeStatus]?.color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <StatusIcon status={(n as any).nodeStatus as NodeStatus} size={9} /> {NODE_STATUS_META[(n as any).nodeStatus as NodeStatus]?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline mode */}
        {viewMode === "timeline" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "24px 32px" }}>
            <div className="section-label" style={{ marginBottom: 20 }}>
              {de ? "Gedankenverlauf" : "Thought History"}
            </div>
            {[...nodes].sort((a,b) => a.createdAt - b.createdAt).map((n, i) => {
              const color = NODE_MINIMAP_COLOR[n.nodeType] ?? "#888";
              const grpColor = nodeGroupColor.get(n.id);
              const grpLabel = grpColor ? [...canvasGroups, ...userGroups].find(g => g.nodeIds.includes(n.id))?.label : undefined;
              return (
                <div key={n.id} style={{ display: "flex", gap: 16, marginBottom: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: grpColor || color, flexShrink: 0, marginTop: 4, border: grpColor ? `2px solid ${grpColor}` : undefined }} />
                    {i < nodes.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 20, background: "var(--color-border)", marginTop: 3 }} />}
                  </div>
                  <div
                    onClick={() => { handleSelectNode(n.id); switchViewMode("canvas"); }}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", borderLeft: grpColor ? `3px solid ${grpColor}` : undefined, background: "var(--color-surface)", cursor: "pointer", marginBottom: 8, transition: "all 0.1s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.background = "var(--color-page-bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{n.nodeType}</span>
                      {grpLabel && (
                        <span style={{ fontSize: 8, padding: "0 5px", borderRadius: 3, background: `${grpColor}18`, color: grpColor, fontWeight: 600, fontFamily: "var(--font-code, monospace)" }}>{grpLabel}</span>
                      )}
                      {n.nodeType === "causalgraph" && ((n as DerivedNode).causalEdges?.length ?? 0) > 0 && (
                        <span style={{ fontSize: 8, padding: "0 5px", borderRadius: 3, background: `${EDGE_STYLE.drives.color}14`, color: EDGE_STYLE.drives.color, fontWeight: 600, fontFamily: "var(--font-code, monospace)" }}>
                          {(n as DerivedNode).causalEdges!.length} {de ? "Kanten" : "edges"}
                        </span>
                      )}
                      {(n as any).nodeStatus && (n as any).nodeStatus !== "open" && (
                        <StatusIcon status={(n as any).nodeStatus as NodeStatus} size={10} />
                      )}
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{formatNodeTime(n.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-heading)", lineHeight: 1.4 }}>
                      {n.nodeType === "query" ? (n as QueryNode).query
                       : n.nodeType === "note" ? (n as NoteNode).content.slice(0,100)
                       : n.nodeType === "idea" ? (n as IdeaNode).title
                       : n.nodeType === "list" ? (n as ListNode).title
                       : n.nodeType === "causalgraph" && ((n as DerivedNode).causalEdges?.length ?? 0) > 0
                         ? (() => {
                             const cgNames = (n as DerivedNode).causalTrendNames ?? {};
                             const cgEdges = (n as DerivedNode).causalEdges ?? [];
                             const topTrends = Array.from(new Set(cgEdges.flatMap(e => [e.from, e.to])))
                               .slice(0, 3).map(id => cgNames[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                             return `${(n as DerivedNode).label || "Kausalnetz"} — ${topTrends.join(", ")}`;
                           })()
                       : (n as DerivedNode).label || (n as DerivedNode).content.slice(0,100)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Orbit view (Ableitung / Netzwerk sub-modes) ────────── */}
        {/* Sub-mode toggle (absolute, renders above OrbitDerivationView / OrbitGraphView) */}
        {viewMode === "orbit" && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 20, display: "inline-flex", gap: 1, padding: 3,
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
            borderRadius: 8, border: "1px solid var(--color-border)",
          }}>
            {(["ableitung", "netzwerk"] as const).map(mode => {
              const isAct = orbitSubMode === mode;
              const Icon = mode === "ableitung" ? GitBranch : Hexagon;
              const label = mode === "ableitung"
                ? (de ? "Ableitung" : "Derivation")
                : (de ? "Netzwerk" : "Network");
              return (
                <button key={mode} onClick={() => setOrbitSubMode(mode)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, padding: "5px 13px", borderRadius: 6, border: "none",
                    background: isAct ? "var(--card, #fff)" : "transparent",
                    color: isAct ? "var(--foreground, #0A0A0A)" : "var(--muted-foreground, #6B6B6B)",
                    fontWeight: isAct ? 700 : 500,
                    fontFamily: "var(--font-ui)",
                    boxShadow: isAct ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  <Icon size={12} strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {viewMode === "orbit" && orbitSubMode === "netzwerk" && (() => {
          // Aggregate all causal edges + trend names from causalgraph nodes
          const cgNodes = nodes.filter(n => n.nodeType === "causalgraph") as DerivedNode[];
          const orbitEdges = cgNodes.flatMap(n => n.causalEdges ?? []);
          const orbitNames: Record<string, string> = {};
          cgNodes.forEach(n => { Object.assign(orbitNames, n.causalTrendNames ?? {}); });
          const trendQueryMap: Record<string, string[]> = {};
          cgNodes.forEach(cg => {
            const parentQId = cg.parentId;
            if (!parentQId) return;
            (cg.causalEdges ?? []).forEach(e => {
              [e.from, e.to].forEach(tid => {
                if (!trendQueryMap[tid]) trendQueryMap[tid] = [];
                if (!trendQueryMap[tid].includes(parentQId)) trendQueryMap[tid].push(parentQId);
              });
            });
          });
          return (
            <OrbitGraphView
              allEdges={orbitEdges}
              allTrendNames={orbitNames}
              trendQueryMap={trendQueryMap}
              de={de}
              onSelectQuery={(qId) => {
                if (qId.startsWith("__orbit_deepen__")) {
                  const trendLabel = qId.replace("__orbit_deepen__", "");
                  setCmdVisible(true);
                  setCmdPrefill(`Vertiefen: ${trendLabel} — Wie beeinflusst dieser Trend andere strategische Bereiche?`);
                  switchViewMode("canvas");
                } else {
                  handleSelectNode(qId);
                  switchViewMode("canvas");
                }
              }}
            />
          );
        })()}
        {viewMode === "orbit" && orbitSubMode === "ableitung" && (
          <OrbitDerivationView
            nodes={nodes as unknown as DerivCanvasNode[]}
            selectedNodeId={selectedId}
            de={de}
            onNavigateToNode={(nodeId) => {
              handleSelectNode(nodeId);
              switchViewMode("canvas");
            }}
          />
        )}

        {/* ── Empty state ─────────────────────────────────────────── */}
        {/* Embedded empty state — subtle hint */}
        {viewMode === "canvas" && isEmpty && embedded && hydrated && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "var(--color-text-muted)", opacity: 0.5 }}>
              <div style={{ marginBottom: 8 }}><LayoutGrid className="w-7 h-7 mx-auto" /></div>
              <div style={{ fontSize: 12 }}>Starte eine Analyse im Standard-View</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Die Ergebnisse erscheinen hier als Karten</div>
            </div>
          </div>
        )}
        {/* Standalone empty state */}
        {viewMode === "canvas" && isEmpty && !cmdVisible && !embedded && hydrated && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, background: "radial-gradient(ellipse at 30% 40%, rgba(228,255,151,0.14) 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(10,10,10,0.03) 0%, transparent 50%)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-muted)", marginBottom: 28, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>
              {projectId ? projectName : "Intelligence Canvas"}
            </div>
            <CommandLine onSubmit={q => submitQuery(q)} onClose={() => {}} locale={locale} />
            <p style={{ marginTop: 18, fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.6, maxWidth: 460 }}>
              {de
                ? "Stelle eine Frage — die Antwort erscheint als Knoten, flankiert von Erkenntnissen, Szenarien und Empfehlungen als eigenständige Karten."
                : "Ask a question — the answer appears as a node, flanked by insights, scenarios and recommendations as individual cards."}
            </p>
            <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
              {(de ? ["AI Agents 2025", "Wie verändert sich die Arbeitswelt?", "DORA für Finanzdienstleister", "Quanten-Computing 2027"]
                   : ["AI Agents 2025", "Future of work", "DORA regulation", "Quantum computing outlook"]
              ).map(s => (
                <button key={s}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => submitQuery(s)}
                  style={{ fontSize: 12, padding: "5px 13px", borderRadius: 20, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#0A0A0A"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"; }}
                >→ {s}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Floating command line ───────────────────────────────── */}
        {viewMode === "canvas" && cmdVisible && !(embedded && isEmpty) && hydrated && (
          <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
            <CommandLine
              key={cmdPrefill + cmdParentId}
              onSubmit={q => submitQuery(q, cmdParentId ?? undefined)}
              onClose={() => { setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null); }}
              locale={locale}
              prefill={cmdPrefill}
              contextLabel={cmdContextLabel}
            />
          </div>
        )}

        {/* ── NodePicker overlay ──────────────────────────────────── */}
        {viewMode === "canvas" && nodePickerVisible && (
          <>
            {/* Backdrop */}
            <div style={{ position: "absolute", inset: 0, zIndex: 49 }} onPointerDown={() => { setNodePickerVisible(false); setIterateCtx(null); setNodePickerPos(null); portDropCanvasPosRef.current = null; }} />
            <div style={nodePickerPos
              ? { position: "absolute", left: nodePickerPos.x, top: nodePickerPos.y, transform: "translate(-50%, -100%) translateY(-16px)", zIndex: 50 }
              : { position: "absolute", bottom: 84, left: "50%", transform: "translateX(-50%)", zIndex: 50 }
            }>
              <NodePicker onSelect={handleNodeTypeSelect} onClose={() => { setNodePickerVisible(false); setIterateCtx(null); setNodePickerPos(null); portDropCanvasPosRef.current = null; }} hasContext={!!iterateCtx} />
            </div>
          </>
        )}

        {/* ── Hints bottom-right ──────────────────────────────────── */}
        {viewMode === "canvas" && (
          <div style={{ position: "absolute", bottom: 14, right: 18, fontSize: 10, color: "var(--color-text-muted)", textAlign: "right", pointerEvents: "none", lineHeight: 1.6 }}>
            <div>{de ? "Scrollen = Zoom · Hintergrund ziehen = Pan" : "Scroll = zoom · Drag background = pan"}</div>
          </div>
        )}

        {/* ── Minimap ──────────────────────────────────────────────── */}
        {viewMode === "canvas" && (
          <Minimap
            nodes={visibleNodes}
            panX={panX} panY={panY} zoom={zoom}
            viewportW={viewportSize.w} viewportH={viewportSize.h}
            onNavigate={(px, py) => { setPanX(px); setPanY(py); }}
            rightOffset={16}
          />
        )}

        {/* ── Volt UI Node Canvas: Zoom Controls (bottom-right) ─────── */}
        {viewMode === "canvas" && !embedded && hydrated && (
          <div style={{
            position: "absolute",
            bottom: 16, right: 16,
            display: "flex",
            alignItems: "center",
            gap: 1,
            padding: "4px",
            background: "var(--color-surface, rgba(255,255,255,0.96))",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            backdropFilter: "blur(12px) saturate(160%)",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}>
            <button
              onClick={() => setZoom(prev => Math.max(0.2, prev * 0.85))}
              title={de ? "Verkleinern" : "Zoom out"}
              style={{
                width: 32, height: 32, borderRadius: 7, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--foreground)", fontSize: 16, fontWeight: 500,
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--muted, #F7F7F7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >−</button>
            <button
              onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
              title={de ? "Zurücksetzen" : "Reset"}
              style={{
                minWidth: 56, height: 32, borderRadius: 7, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--muted-foreground)", fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 600, letterSpacing: "0.02em",
                transition: "background 0.12s",
                fontVariantNumeric: "tabular-nums",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--muted, #F7F7F7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >{Math.round(zoom * 100)}%</button>
            <button
              onClick={() => setZoom(prev => Math.min(2.5, prev * 1.18))}
              title={de ? "Vergrößern" : "Zoom in"}
              style={{
                width: 32, height: 32, borderRadius: 7, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--foreground)", fontSize: 16, fontWeight: 500,
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--muted, #F7F7F7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >+</button>
          </div>
        )}

        {/* ── Volt UI Node Canvas: Node-Status Legend (bottom-left) ─── */}
        {viewMode === "canvas" && !embedded && hydrated && nodes.length > 0 && (
          <div style={{
            position: "absolute",
            // Raised above the floating command line zone so items never clip
            // on shorter viewports and there's visible gap from the bottom
            // edge; horizontal padding inside the pill was too tight against
            // the container edge, so the whole pill shifts 4px in.
            bottom: 20, left: 20,
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            gap: 12,
            padding: "8px 16px",
            maxWidth: "calc(100% - 320px)",
            overflow: "hidden",
            background: "var(--color-surface, rgba(255,255,255,0.96))",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            backdropFilter: "blur(12px) saturate(160%)",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--muted-foreground)",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase" as const, color: "var(--muted-foreground)",
              marginRight: 2, flexShrink: 0,
            }}>
              {de ? "Status" : "Status"}
            </span>
            {[
              { dot: "#1A9E5A", label: de ? "Fertig" : "Done" },
              { dot: "#F5A623", label: de ? "Läuft" : "Running" },
              { dot: "#E8402A", label: de ? "Fehler" : "Error" },
              { dot: "#9CA3AF", label: de ? "Offen" : "Idle" },
            ].map((s, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* FIXED: UX-05 — Ensure text cursor in input/textarea/contentEditable even when parent has cursor:pointer */}
      <style>{`
        @keyframes cur-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        input, textarea, [contenteditable="true"] { cursor: text !important; }
      `}</style>

      {/* ── Detail Panel ────────────────────────────────────────────── */}
      {detailNodeId && (() => {
        const detailNode = nodes.find(n => n.id === detailNodeId);
        if (!detailNode) return null;
        return (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setDetailNodeId(null)}
              style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
            />
            <DetailPanel
              key={detailNodeId}
              node={detailNode}
              de={de}
              allQueryNodes={queryNodes}
              siblingScenarios={detailNode.nodeType === "scenario"
                ? (nodes.filter(n => n.nodeType === "scenario" && (n as DerivedNode).parentId === (detailNode as DerivedNode).parentId) as DerivedNode[])
                : undefined
              }
              onClose={() => setDetailNodeId(null)}
              onFollowUp={handleFollowUp}
              onRefresh={handleRefresh}
              onExplore={handleExplore}
              onDelete={deleteNode}
              onUpdateNote={handleUpdateNote}
              onUpdateIdea={handleUpdateIdea}
              onUpdateList={handleUpdateList}
              onPromoteNote={handlePromoteNote}
              onPromoteIdea={handlePromoteIdea}
              onAnalyzeFile={(query, parentId) => submitQuery(query, parentId)}
              onIterate={handleIterateFromNode}
              onSetStatus={handleSetNodeStatus}
              onUpdateTags={(id, tags) => setNodes(prev => prev.map(n => n.id === id ? { ...n, tags } : n))}
            />
          </>
        );
      })()}

      {/* ── Delete Confirmation Toast ──────────────────────────────── */}
      {/* VERIFIED: UX-07 — deleteConfirmId captures target node ID at dialog-show time,
          so even if selectedId changes between showing dialog and confirming,
          the correct node is always deleted. Both Enter-key and button use deleteConfirmId. */}
      {deleteConfirmId && (() => {
        const dn = nodes.find(n => n.id === deleteConfirmId);
        const label = dn
          ? dn.nodeType === "query" ? `„${(dn as QueryNode).query.slice(0, 42)}${(dn as QueryNode).query.length > 42 ? "…" : ""}"`
          : dn.nodeType === "note" ? "diese Notiz"
          : dn.nodeType === "idea" ? "diese Idee"
          : dn.nodeType === "list" ? "diese Liste"
          : dn.nodeType === "file" ? `„${(dn as FileNode).fileName}"`
          : "diese Karte"
          : "diese Karte";
        return (
          <div style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1.5px solid var(--signal-negative-border, #F4A090)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
            zIndex: 9999, minWidth: 340,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: "var(--signal-negative-light, #FDEEE9)",
              border: "1px solid var(--signal-negative-border, #F4A090)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>🗑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-heading)", margin: 0, letterSpacing: "-0.01em" }}>Karte löschen?</p>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label} · nicht rückgängig machbar · Enter zum Bestätigen
              </p>
            </div>
            <button
              onClick={() => { deleteNode(deleteConfirmId); setDeleteConfirmId(null); }}
              style={{ background: "var(--signal-negative-light, #FDEEE9)", border: "1.5px solid var(--signal-negative-border, #F4A090)", color: "var(--signal-negative-text, #A01A08)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E8402A"; el.style.color = "#fff"; el.style.borderColor = "#E8402A"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--signal-negative-light, #FDEEE9)"; el.style.color = "var(--signal-negative-text, #A01A08)"; el.style.borderColor = "var(--signal-negative-border, #F4A090)"; }}
            >Löschen</button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              style={{ background: "transparent", border: "1.5px solid var(--color-border)", color: "var(--color-text-secondary)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            >Abbrechen</button>
          </div>
        );
      })()}

      {/* ── Briefing Modal ─────────────────────────────────────────── */}
      {briefingOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 250 }} onClick={() => setBriefingOpen(false)} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: "min(680px, 92vw)", maxHeight: "80vh",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 18,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.08)", zIndex: 251,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)" }}>{de ? "Strategisches Briefing" : "Strategic Briefing"}</span>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "generiert aus Canvas" : "generated from canvas"}</span>
              <button onClick={() => setBriefingOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-muted)", padding: "2px 6px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {briefingLoading && !briefingText && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{de ? "Generiere Briefing…" : "Generating briefing…"}</div>
              )}
              {briefingText && (
                <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--color-text-primary)", margin: 0, whiteSpace: "pre-wrap" }}>{briefingText}</p>
              )}
            </div>
            {briefingText && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid var(--color-border)", display: "flex", gap: 8 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(briefingText); }}
                  style={{ fontSize: 12, padding: "5px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", color: "var(--color-text-secondary)" }}
                >{de ? "Kopieren" : "Copy"}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
