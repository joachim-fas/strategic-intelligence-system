"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface UsedSignal {
  source: string;
  title: string;
  url?: string;
  strength?: number;
  date?: string;
}

interface Scenario {
  type?: "optimistic" | "baseline" | "pessimistic" | "wildcard";
  name: string;
  description: string;
  probability: number;
  timeframe?: string;
  keyDrivers?: string[];
}

interface Reference {
  title: string;
  url: string;
  relevance?: string;
}

interface QueryResult {
  synthesis?: string;
  keyInsights?: string[];
  scenarios?: Scenario[];
  decisionFramework?: string;
  references?: Reference[];
  followUpQuestions?: string[];
  confidence?: number;
  interpretation?: string;
  regulatoryContext?: string[];
  causalChain?: string[];
  usedSignals?: UsedSignal[];
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
}

type DerivedType = "insight" | "scenario" | "decision" | "followup";

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
}

type CanvasNode = QueryNode | DerivedNode | NoteNode | IdeaNode | ListNode;

interface Connection {
  from: string;
  to: string;
  derived?: boolean;
  refreshed?: boolean; // temporal chain: re-run of same query
}

interface CanvasProject {
  id: string;
  name: string;
  hasState: boolean;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const QUERY_NODE_W       = 420;
const QUERY_NODE_H       = 50;
const DERIVED_W          = 256;
const LIST_NODE_W        = 280;
const DERIVED_COL_GAP_X  = 72;
const DERIVED_COL_GAP    = 16;
const DERIVED_ROW_GAP    = 12;

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
  const CHARS_PER_LINE = 29;
  const LINE_H   = 20;
  const MAX_LINES = 4;

  const contentLines = Math.min(MAX_LINES, Math.max(1, Math.ceil(content.length / CHARS_PER_LINE)));
  const labelLines   = label ? Math.min(2, Math.ceil(label.length / CHARS_PER_LINE)) : 0;

  const HEADER    = 44;
  const FOOTER    = 44;
  const PAD       = 20;
  const SOURCES   = hasSources ? 26 : 0;
  const TIMESTAMP = 18;
  const BUFFER    = 28;

  if (type === "scenario") {
    return HEADER + PAD + 42 + labelLines * LINE_H + contentLines * LINE_H + SOURCES + TIMESTAMP + FOOTER + BUFFER;
  }
  return HEADER + PAD + contentLines * LINE_H + SOURCES + TIMESTAMP + FOOTER + BUFFER;
}

const STORAGE_KEY = "sis-canvas-v2";

// ── Scenario colours ──────────────────────────────────────────────────────

const SCEN: Record<string, { color: string; bg: string; border: string; label: string; labelEn: string }> = {
  optimistic:  { color: "#0F6038", bg: "#E8F8EF", border: "#7DD4A8", label: "Optimistisch", labelEn: "Optimistic" },
  baseline:    { color: "#1D4ED8", bg: "#EFF6FF", border: "#93C5FD", label: "Basisfall",    labelEn: "Baseline"   },
  pessimistic: { color: "#B91C1C", bg: "#FEF2F2", border: "#FCA5A5", label: "Pessimistisch",labelEn: "Pessimistic" },
  wildcard:    { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Wildcard",      labelEn: "Wildcard"   },
};

// ── Persistence (localStorage) ────────────────────────────────────────────

function saveToStorage(nodes: CanvasNode[], conns: Connection[], pan: { x: number; y: number }, zoom: number) {
  try {
    const saveable = nodes.filter(n =>
      n.nodeType !== "query" || (n.status === "done" || n.status === "error")
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: saveable, conns, pan, zoom, v: 2 }));
  } catch {}
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
      result += nx === "n" ? "\n" : nx === "t" ? "\t" : nx;
      i += 2;
    } else if (ch === '"') break;
    else { result += ch; i++; }
  }
  return result.length > sent ? result.slice(sent) : "";
}

async function streamQuery(
  query: string, locale: string,
  onChunk: (c: string) => void,
  onComplete: (r: QueryResult) => void,
  onError: (m: string) => void,
) {
  try {
    const res = await fetch("/api/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, locale }),
    });
    if (!res.ok || !res.body) { onError(`HTTP ${res.status}`); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", acc = "", sent = 0;
    let final: QueryResult | null = null;
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
//   [MAIN NODE]──► Col A: ERKENNTNISSE (stacked)   │  Col B: SZENARIEN (stacked)
//                          EMPFEHLUNG               │
//                  ────────────────────────────────────────
//                  FOLGEFRAGEN  (horizontal row, full width)

function computeDerivedNodes(parentId: string, px: number, py: number, result: QueryResult): DerivedNode[] {
  const derived: DerivedNode[] = [];
  const now = Date.now();
  const topSources = (result.usedSignals ?? []).slice(0, 3);
  const hasSources = topSources.length > 0;

  const colA_X = px + QUERY_NODE_W + DERIVED_COL_GAP_X;
  const colB_X = colA_X + DERIVED_W + DERIVED_COL_GAP;

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
      queryText: `Analysiere dieses Szenario tiefer: ${s.name} — ${s.description.slice(0, 100)}`,
      sources: topSources,
      createdAt: now,
    });
    colB_Y += h + DERIVED_ROW_GAP;
  });

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

const uid = () => Math.random().toString(36).slice(2, 10);

// ── ConfidenceBadge ───────────────────────────────────────────────────────

function ConfidenceBadge({ value, de }: { value: number; de: boolean }) {
  const pct = Math.round(value * 100);
  const s = value > 0.7 ? { bg: "#E8F8EF", color: "#0F6038", border: "#7DD4A8" }
    : value > 0.4       ? { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" }
    :                     { bg: "#FEF2F2", color: "#B91C1C", border: "#FCA5A5" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
      {pct}% {de ? "Konfidenz" : "confidence"}
    </span>
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
      {sources.map((s, i) => (
        s.url ? (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title={`${s.title}${s.date ? ` · ${s.date}` : ""}`}
            style={{
              fontSize: 9, padding: "1px 7px", borderRadius: 20,
              background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)",
              color: "var(--color-text-muted)", fontWeight: 500,
              textDecoration: "none", whiteSpace: "nowrap",
              display: "inline-block", transition: "all 0.1s",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(0,0,0,0.08)"; el.style.color = "var(--color-text-secondary)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(0,0,0,0.04)"; el.style.color = "var(--color-text-muted)"; }}
          >{s.source}</a>
        ) : (
          <span key={i}
            title={`${s.title}${s.date ? ` · ${s.date}` : ""}`}
            style={{
              fontSize: 9, padding: "1px 7px", borderRadius: 20,
              background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)",
              color: "var(--color-text-muted)", fontWeight: 500, whiteSpace: "nowrap",
              display: "inline-block",
            }}
          >{s.source}</span>
        )
      ))}
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

  return (
    <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {contextLabel && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 20, padding: "3px 12px", maxWidth: 460, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ↳ {de ? "Folge-Analyse:" : "Follow-up on:"} <em>{contextLabel}</em>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--color-surface)", border: "2px solid #0A0A0A", borderRadius: 12, padding: "8px 10px 8px 14px", boxShadow: "0 8px 40px rgba(0,0,0,0.12)", width: 520, maxWidth: "90vw" }}>
        <span style={{ fontSize: 15, color: "var(--color-text-muted)", flexShrink: 0 }}>⌕</span>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
          placeholder={de ? "Frage, Thema oder Stichwort…" : "Question, topic or keyword…"}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, color: "var(--color-text-primary)", fontFamily: "inherit" }}
        />
        <button onClick={submit} style={{ flexShrink: 0, padding: "6px 16px", borderRadius: 8, background: "#E4FF97", border: "1px solid rgba(0,0,0,0.1)", color: "#0A0A0A", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          {de ? "Analysieren" : "Analyze"} ↵
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
        Esc {de ? "schließen" : "to close"} · ↵ {de ? "ausführen" : "to run"}
      </div>
    </div>
  );
}

// ── ConnectionsSVG ────────────────────────────────────────────────────────

function ConnectionsSVG({ nodes, connections }: { nodes: CanvasNode[]; connections: Connection[] }) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <marker id="arr-q" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L0,5 L5,2.5 z" fill="rgba(0,0,0,0.22)" />
        </marker>
        <marker id="arr-d" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <path d="M0,0 L0,4 L4,2 z" fill="rgba(0,0,0,0.12)" />
        </marker>
        <marker id="arr-r" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L0,5 L5,2.5 z" fill="#F5A62388" />
        </marker>
      </defs>
      {connections.map(c => {
        const from = nodeMap.get(c.from);
        const to = nodeMap.get(c.to);
        if (!from || !to) return null;

        const nodeDefaultW = (n: CanvasNode) => {
          if (n.nodeType === "query") return QUERY_NODE_W;
          if (n.nodeType === "list") return LIST_NODE_W;
          if (n.nodeType === "note") return 280;
          if (n.nodeType === "idea") return 300;
          return DERIVED_W;
        };
        const fromW = from.customWidth ?? nodeDefaultW(from);

        const x1 = from.x + fromW;
        const y1 = from.y + (from.nodeType === "query" ? QUERY_NODE_H : 24);
        const x2 = to.x;
        const y2 = to.y + (to.nodeType === "query" ? QUERY_NODE_H : 24);
        const cp = Math.min(Math.abs(x2 - x1) * 0.45, 120);

        if (c.refreshed) {
          return (
            <path key={`${c.from}-${c.to}`}
              d={`M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`}
              fill="none" stroke="#F5A62355" strokeWidth={1.5} strokeDasharray="4 4"
              markerEnd="url(#arr-r)"
            />
          );
        }
        if (c.derived) {
          return (
            <path key={`${c.from}-${c.to}`}
              d={`M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`}
              fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth={1} strokeDasharray="3 3"
              markerEnd="url(#arr-d)"
            />
          );
        }
        return (
          <path key={`${c.from}-${c.to}`}
            d={`M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`}
            fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={1.5} strokeDasharray="5 3"
            markerEnd="url(#arr-q)"
          />
        );
      })}
    </svg>
  );
}

// ── DerivedNodeCard ───────────────────────────────────────────────────────

function DerivedNodeCard({
  node, de, selected, onSelect, onDragStart, onExplore, onDelete, onResizeStart, onIterate, nodeW,
}: {
  node: DerivedNode;
  de: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onExplore: (id: string, queryText: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v") => void;
  onIterate: (nodeId: string, prefill: string) => void;
  nodeW: number;
}) {
  const type = node.nodeType;
  const age = nodeAge(node.createdAt);

  const cfg = useMemo(() => {
    if (type === "insight")  return { accent: "#E4FF97", accentText: "#0A0A0A", bg: "var(--color-surface)", badge: de ? "ERKENNTNIS" : "INSIGHT",    btnLabel: de ? "Analysieren" : "Analyze",   direct: true };
    if (type === "decision") return { accent: "#7DD4A8", accentText: "#0A3A20", bg: "#F4FBF7",              badge: de ? "EMPFEHLUNG"  : "DECISION",   btnLabel: de ? "Umsetzen"   : "Implement", direct: true };
    if (type === "followup") return { accent: "rgba(0,0,0,0.08)", accentText: "var(--color-text-muted)", bg: "var(--color-surface)", badge: de ? "FOLGEFRAGE" : "FOLLOW-UP", btnLabel: de ? "Vertiefen" : "Explore", direct: false };
    const scen = SCEN[node.colorKey ?? "baseline"] ?? SCEN.baseline;
    return { accent: scen.color, accentText: scen.color, bg: scen.bg, badge: de ? scen.label.toUpperCase() : scen.labelEn.toUpperCase(), btnLabel: de ? "Analysieren" : "Analyze", direct: true };
  }, [type, node.colorKey, de]);

  const isScenario = type === "scenario";
  const isFollowup = type === "followup";
  const scenCfg    = isScenario && node.colorKey ? SCEN[node.colorKey] ?? SCEN.baseline : null;

  const staleStyle = age === "stale"
    ? { boxShadow: "inset 0 0 0 1px rgba(245,166,35,0.3)" }
    : age === "aging"
    ? { boxShadow: "inset 0 0 0 1px rgba(245,166,35,0.15)" }
    : {};

  const nodeH = node.customHeight;

  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{
        position: "absolute", left: node.x, top: node.y, width: nodeW,
        ...(nodeH ? { height: nodeH, overflow: "hidden" } : {}),
        background: isScenario ? (scenCfg?.bg ?? "var(--color-surface)") : cfg.bg,
        border: `1.5px solid ${selected ? "#0A0A0A" : age === "stale" ? "rgba(245,166,35,0.35)" : "rgba(0,0,0,0.1)"}`,
        borderLeft: `3px solid ${isScenario ? (scenCfg?.color ?? "#1D4ED8") : type === "followup" ? "var(--color-border)" : cfg.accent}`,
        borderRadius: 10,
        boxShadow: selected
          ? "0 0 0 3px rgba(228,255,151,0.6), 0 4px 16px rgba(0,0,0,0.1)"
          : `0 2px 8px rgba(0,0,0,0.06)${staleStyle.boxShadow ? `, ${staleStyle.boxShadow.replace("inset ", "inset ")}` : ""}`,
        overflow: nodeH ? "hidden" : "visible",
        userSelect: "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
        ...(isFollowup ? { borderStyle: "dashed" } : {}),
      }}
    >
      {/* Drag handle + header */}
      <div
        onPointerDown={e => onDragStart(e, node.id)}
        style={{ padding: "9px 10px 5px", cursor: "grab", display: "flex", alignItems: "flex-start", gap: 7 }}
      >
        <span style={{
          flexShrink: 0, fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isScenario ? (scenCfg?.color ?? "#1D4ED8") : isFollowup ? "var(--color-text-muted)" : cfg.accentText,
          background: isScenario ? "rgba(255,255,255,0.7)" : isFollowup ? "transparent" : cfg.accent,
          border: isScenario ? `1px solid ${scenCfg?.border ?? "#93C5FD"}` : isFollowup ? "none" : "1px solid rgba(0,0,0,0.08)",
          borderRadius: 4, padding: "2px 6px", marginTop: 2,
        }}>{cfg.badge}</span>

        {isScenario && node.probability != null && (
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 18, fontWeight: 800, color: scenCfg?.color ?? "#1D4ED8", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {Math.round(node.probability * 100)}%
          </span>
        )}

        {age !== "fresh" && (
          <span style={{ flexShrink: 0, fontSize: 8, padding: "2px 5px", borderRadius: 4, background: age === "stale" ? "rgba(245,166,35,0.15)" : "rgba(245,166,35,0.08)", color: "#92400E", border: "1px solid rgba(245,166,35,0.2)", marginTop: 2, marginLeft: isScenario ? 0 : "auto" }}>
            {age === "stale" ? (de ? "Veraltet" : "Stale") : (de ? "Altert" : "Aging")}
          </span>
        )}

        <div onPointerDown={e => e.stopPropagation()} style={{ marginLeft: (age !== "fresh" && !isScenario) ? 0 : "auto", display: "flex", gap: 1, flexShrink: 0 }}>
          {/* + iteration → NodePicker */}
          <button
            onClick={e => { e.stopPropagation(); onIterate(node.id, node.queryText); }}
            title={de ? "Iteration starten" : "Start iteration"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 5px", color: "var(--color-text-muted)", fontSize: 13, borderRadius: 4, opacity: 0.5, lineHeight: 1, fontWeight: 300 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.color = "#1A9E5A"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.5"; el.style.color = "var(--color-text-muted)"; }}
          >+</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(node.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 4px", color: "var(--color-text-muted)", fontSize: 11, borderRadius: 4, opacity: 0.5 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.color = "#E8402A"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; }}
          >✕</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 10px 4px" }}>
        {isScenario && node.label && (
          <div style={{ fontSize: 12, fontWeight: 700, color: scenCfg?.color ?? "#1D4ED8", marginBottom: 4, lineHeight: 1.3 }}>
            {node.label}
          </div>
        )}
        {isScenario && node.probability != null && (
          <div style={{ height: 3, borderRadius: 2, background: "rgba(0,0,0,0.08)", marginBottom: 6, overflow: "hidden" }}>
            <div style={{ height: 3, width: `${node.probability * 100}%`, borderRadius: 2, background: scenCfg?.color ?? "#1D4ED8" }} />
          </div>
        )}
        <p style={{
          fontSize: 12, fontStyle: isFollowup ? "italic" : "normal",
          lineHeight: 1.55,
          color: isScenario ? (scenCfg?.color ?? "var(--color-text-secondary)") : "var(--color-text-secondary)",
          margin: 0,
        }}>
          {isFollowup ? `→ ${node.content}` : node.content}
        </p>
      </div>

      {/* Sources */}
      {node.sources && node.sources.length > 0 && (
        <div onPointerDown={e => e.stopPropagation()} style={{ padding: "3px 10px 5px" }}>
          <SourceChips sources={node.sources} de={de} />
        </div>
      )}

      {/* Timestamp + rethink */}
      <div onPointerDown={e => e.stopPropagation()} style={{ padding: "0 10px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "var(--color-text-muted)", opacity: 0.65, fontVariantNumeric: "tabular-nums" }}>
          {formatNodeTime(node.createdAt)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onExplore(node.id, node.queryText); }}
          title={de ? "Neu durchdenken" : "Rethink"}
          style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", opacity: 0.65, lineHeight: 1.3, transition: "all 0.1s" }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.borderColor = "rgba(0,0,0,0.25)"; el.style.color = "var(--color-text-secondary)"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.65"; el.style.borderColor = "rgba(0,0,0,0.1)"; el.style.color = "var(--color-text-muted)"; }}
        >↺ rethink</button>
      </div>

      {/* Footer: Explore button */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{ padding: "6px 10px 8px", borderTop: "1px solid rgba(0,0,0,0.06)" }}
      >
        <button
          onClick={e => { e.stopPropagation(); onExplore(node.id, node.queryText); }}
          title={de ? `${cfg.btnLabel}: Neue KI-Analyse auf Basis dieses Inhalts` : `${cfg.btnLabel}: Run new AI analysis based on this content`}
          style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 16,
            border: `1px solid ${isScenario ? (scenCfg?.border ?? "#93C5FD") : "rgba(0,0,0,0.1)"}`,
            background: isScenario ? "rgba(255,255,255,0.7)" : isFollowup ? "transparent" : "#E4FF97",
            color: isScenario ? (scenCfg?.color ?? "#1D4ED8") : isFollowup ? "var(--color-text-secondary)" : "#0A0A0A",
            cursor: "pointer",
          }}
        >{cfg.btnLabel}</button>
      </div>

      {/* Resize handle – right edge (width) */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? 200, "h"); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", borderRadius: "0 10px 10px 0", background: "transparent", transition: "background 0.15s", zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.1)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
      {/* Resize handle – bottom edge (height) */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (e.currentTarget.parentElement?.offsetHeight ?? 200), "v"); }}
        style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 6, cursor: "ns-resize", background: "transparent", transition: "background 0.15s", zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
    </div>
  );
}

// ── QueryNodeCard ─────────────────────────────────────────────────────────

function QueryNodeCard({
  node, de, selected, onSelect, onDragStart, onFollowUp, onFollowUpQ, onDelete, onToggleCollapse, onRefresh, onResizeStart, onIterate, nodeW,
}: {
  node: QueryNode;
  de: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onFollowUp: (id: string, prefill?: string) => void;
  onFollowUpQ: (id: string, q: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onRefresh: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v") => void;
  onIterate: (nodeId: string, prefill: string) => void;
  nodeW: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const isLoading = node.status === "loading" || node.status === "streaming";
  const r = node.result;
  const age = nodeAge(node.createdAt);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.synthesis) return;
    await navigator.clipboard.writeText(node.synthesis);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const staleAccent = age === "stale" ? "#F5A623" : age === "aging" ? "rgba(245,166,35,0.5)" : null;

  const nodeH = node.customHeight;

  return (
    <div
      ref={cardRef}
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{
        position: "absolute", left: node.x, top: node.y, width: nodeW,
        ...(nodeH ? { height: nodeH, overflow: "hidden" } : {}),
        background: "var(--color-surface)",
        border: `1.5px solid ${selected ? "#0A0A0A" : staleAccent ?? "var(--color-border)"}`,
        borderRadius: 12,
        boxShadow: selected ? "0 0 0 3px rgba(228,255,151,0.65), 0 8px 32px rgba(0,0,0,0.1)" : "0 2px 12px rgba(0,0,0,0.07)",
        overflow: nodeH ? "hidden" : "visible",
        userSelect: "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      {/* Staleness bar */}
      {age === "stale" && (
        <div style={{ height: 2, background: "linear-gradient(90deg, #F5A623, #FDE68A)", opacity: 0.7 }} />
      )}

      {/* Header / drag handle */}
      <div
        onPointerDown={e => onDragStart(e, node.id)}
        style={{
          padding: "10px 12px 8px", cursor: "grab",
          background: isLoading ? "linear-gradient(90deg, #E4FF9740 0%, #E4FF9715 100%)" : "var(--color-page-bg)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", alignItems: "flex-start", gap: 8,
          minHeight: QUERY_NODE_H,
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 4,
          background: node.status === "done" ? "#1A9E5A" : node.status === "error" ? "#E8402A" : "#F5A623",
          boxShadow: node.status === "streaming" ? "0 0 6px #F5A62388" : "none",
        }} />
        <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {node.query}
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
          {/* Button row */}
          <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", gap: 1, alignItems: "center" }}>
            {/* + iteration → NodePicker */}
            <button
              onClick={e => { e.stopPropagation(); onIterate(node.id, node.query); }}
              title={de ? "Iteration starten" : "Start iteration"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 5px", color: "var(--color-text-muted)", fontSize: 14, borderRadius: 4, opacity: 0.5, lineHeight: 1, fontWeight: 300 }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.color = "#1A9E5A"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.5"; el.style.color = "var(--color-text-muted)"; }}
            >+</button>
            <button
              onClick={e => { e.stopPropagation(); onToggleCollapse(node.id); }}
              title={node.collapsed ? (de ? "Karte aufklappen" : "Expand card") : (de ? "Karte einklappen" : "Collapse card")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 5px", color: "var(--color-text-muted)", fontSize: 12, borderRadius: 4 }}
            >
              {node.collapsed ? "▾" : "▴"}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(node.id); }}
              title={de ? "Karte löschen" : "Delete card"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 5px", color: "var(--color-text-muted)", fontSize: 12, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#E8402A"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"}
            >✕</button>
          </div>
          {/* Timestamp + rethink */}
          <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 9, color: age === "stale" ? "#F5A623" : "var(--color-text-muted)", opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>
              {formatNodeTime(node.createdAt)}
            </span>
            {node.status === "done" && (
              <button
                onClick={e => { e.stopPropagation(); onRefresh(node.id); }}
                title={de ? "Neu analysieren mit aktuellen Daten" : "Re-analyse with current data"}
                style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, border: `1px solid ${age === "stale" ? "rgba(245,166,35,0.3)" : "rgba(0,0,0,0.1)"}`, background: "transparent", color: age === "stale" ? "#F5A623" : "var(--color-text-muted)", cursor: "pointer", opacity: 0.75, lineHeight: 1.3, transition: "all 0.1s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.borderColor = "rgba(0,0,0,0.25)"; el.style.color = "var(--color-text-secondary)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.75"; el.style.borderColor = age === "stale" ? "rgba(245,166,35,0.3)" : "rgba(0,0,0,0.1)"; el.style.color = age === "stale" ? "#F5A623" : "var(--color-text-muted)"; }}
              >↺ rethink</button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {!node.collapsed && (
        <div style={{ padding: "12px 14px 4px" }}>
          {(node.synthesis || isLoading) && (
            <p style={{ fontSize: 13, lineHeight: 1.72, color: "var(--color-text-primary)", margin: "0 0 10px" }}>
              {node.synthesis}
              {node.status === "streaming" && (
                <span style={{ display: "inline-block", width: 2, height: "0.9em", background: "#0A0A0A", marginLeft: 2, animation: "cur-blink 0.8s steps(1) infinite", verticalAlign: "text-bottom" }} />
              )}
              {node.status === "loading" && <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{de ? "Analysiere…" : "Analyzing…"}</span>}
            </p>
          )}
          {node.status === "error" && <p style={{ fontSize: 13, color: "#E8402A", margin: "0 0 8px" }}>{node.errorMsg || "Fehler"}</p>}

          {r?.confidence != null && r.confidence > 0 && (
            <div style={{ marginBottom: 10 }}><ConfidenceBadge value={r.confidence} de={de} /></div>
          )}

          {/* Used signals (data basis) */}
          {r?.usedSignals && r.usedSignals.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <SourceChips sources={r.usedSignals.slice(0, 5)} de={de} />
            </div>
          )}

          {r?.references && r.references.length > 0 && (
            <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {r.references.slice(0, 4).map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--color-brand)", textDecoration: "none", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--color-border)", background: "var(--color-surface)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#0A0A0A"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
                >↗ {ref.title}</a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 12px 9px", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", flexWrap: "wrap" }}>
        <button
          onClick={e => { e.stopPropagation(); onFollowUp(node.id); }}
          title={de ? "Folgefrage auf Basis dieser Analyse starten" : "Start a follow-up query based on this analysis"}
          style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.12)", background: "#E4FF97", color: "#0A0A0A", cursor: "pointer" }}
        >
          {de ? "Weiterdenken" : "Follow up"}
        </button>
        {node.status === "done" && age !== "fresh" && (
          <button onClick={e => { e.stopPropagation(); onRefresh(node.id); }}
            title={de ? "Dieselbe Frage neu stellen — Ergebnis könnte sich geändert haben" : "Re-run this query — results may have changed"}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 20, border: `1px solid ${age === "stale" ? "rgba(245,166,35,0.4)" : "var(--color-border)"}`, background: "transparent", color: age === "stale" ? "#F5A623" : "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(245,166,35,0.1)"; el.style.color = "#F5A623"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = age === "stale" ? "#F5A623" : "var(--color-text-muted)"; }}
          >⟳ {de ? "Aktualisieren" : "Refresh"}</button>
        )}
        {node.synthesis && (
          <button
            onClick={copy}
            title={de ? "Synthese kopieren" : "Copy synthesis"}
            style={{ fontSize: 11, padding: "4px 9px", borderRadius: 20, border: "1px solid var(--color-border)", background: "transparent", color: copied ? "#0F6038" : "var(--color-text-muted)", cursor: "pointer" }}
          >
            {copied ? "✓" : "⎘"}
          </button>
        )}
        {r?.followUpQuestions && r.followUpQuestions.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
            {r.followUpQuestions.slice(0, 2).map((q, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); onFollowUpQ(node.id, q); }} title={de ? `Folgefrage: ${q}` : `Follow-up: ${q}`}
                style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#0A0A0A"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; }}
              >{q}</button>
            ))}
          </div>
        )}
      </div>

      {/* Resize handle – right edge (width) */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 200), "h"); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", borderRadius: "0 12px 12px 0", background: "transparent", transition: "background 0.15s", zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
      {/* Resize handle – bottom edge (height) */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 200), "v"); }}
        style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 6, cursor: "ns-resize", background: "transparent", transition: "background 0.15s", zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
    </div>
  );
}

// ── NodePicker ────────────────────────────────────────────────────────────

type NewNodeType =
  | "query"
  | "insights" | "scenarios" | "decision" | "followups"
  | "note" | "idea" | "list";

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
  { type: "query",    icon: "⌕", label: "Abfrage",       desc: "Vollständige KI-Analyse starten",        bg: "#E4FF97", color: "#0A0A0A",  section: "analyse" },
  { type: "insights", icon: "◉", label: "Erkenntnisse",  desc: "Kernaussagen & Muster extrahieren",       bg: "#C3F4D3", color: "#0F6038",  section: "analyse" },
  { type: "scenarios",icon: "◈", label: "Szenarien",     desc: "Optimist. / wahrsch. / pessim. Zukunft",  bg: "#FDE2FF", color: "#7C1A9E",  section: "analyse" },
  { type: "decision", icon: "◆", label: "Empfehlung",    desc: "Konkreten Handlungsrahmen ableiten",      bg: "#D4F4F4", color: "#0A6060",  section: "analyse" },
  { type: "followups",icon: "◎", label: "Folgefragen",   desc: "Offene Fragen & nächste Schritte",        bg: "#FFF5BA", color: "#7A5C00",  section: "analyse" },
  // ── Karten ──────────────────────────────────────────────────────────────
  { type: "note",  icon: "✎", label: "Notiz",   desc: "Freitext, Beobachtung, Quelle",   bg: "#FFF9C4", color: "#5D4037", section: "karte" },
  { type: "idea",  icon: "◇", label: "Idee",    desc: "Hypothese, Ansatz, These",        bg: "#FFF3E0", color: "#E65100", section: "karte" },
  { type: "list",  icon: "≡", label: "Liste",   desc: "Strukturierte Aufzählung",        bg: "#E8F5E9", color: "#1B5E20", section: "karte" },
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
      style={{ width: 340, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.18)", overflow: "hidden" }}
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
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", padding: "6px 10px 3px" }}>
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

// ── NoteNodeCard ──────────────────────────────────────────────────────────

function NoteNodeCard({ node, selected, onSelect, onDragStart, onDelete, onResizeStart, onUpdate, onIterate, nodeW }: {
  node: NoteNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v") => void;
  onUpdate: (id: string, content: string) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  nodeW: number;
}) {
  const [editing, setEditing] = useState(!node.content);
  const [draft, setDraft] = useState(node.content);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(node.content); }, [node.content]);

  const commit = () => { setEditing(false); onUpdate(node.id, draft); };

  const cardRef = useRef<HTMLDivElement>(null);
  const nodeH = node.customHeight;

  return (
    <div
      ref={cardRef}
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{
        position: "absolute", left: node.x, top: node.y, width: nodeW,
        ...(nodeH ? { height: nodeH, overflow: "hidden" } : {}),
        background: "#FFFDE7",
        border: `1.5px solid ${selected ? "#0A0A0A" : "rgba(0,0,0,0.08)"}`,
        borderTop: "3px solid #F9A825",
        borderRadius: 10,
        boxShadow: selected ? "0 0 0 3px rgba(228,255,151,0.6), 0 4px 16px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.06)",
        userSelect: "none",
      }}
    >
      {/* Header / drag handle */}
      <div
        onPointerDown={e => onDragStart(e, node.id)}
        style={{ cursor: "grab", padding: "5px 10px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F9A825" }}>NOTIZ</span>
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", gap: 1, alignItems: "center" }}>
          <button
            onClick={e => { e.stopPropagation(); onIterate(node.id, node.content); }}
            title="Iteration starten"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 5px", color: "rgba(0,0,0,0.3)", fontSize: 14, borderRadius: 4, lineHeight: 1, fontWeight: 300 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#1A9E5A"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.3)"; }}
          >+</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(node.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 4px", color: "rgba(0,0,0,0.25)", fontSize: 11, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#E8402A"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.25)"}
          >✕</button>
        </div>
      </div>

      {/* Editable content */}
      <div
        onPointerDown={e => { e.stopPropagation(); if (!editing) { setEditing(true); } }}
        style={{ padding: "4px 10px 8px", minHeight: 80 }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Escape") { setEditing(false); setDraft(node.content); } }}
            style={{ width: "100%", minHeight: 80, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 13, lineHeight: 1.65, color: "#3E2723", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.65, color: node.content ? "#3E2723" : "rgba(0,0,0,0.28)", margin: 0, whiteSpace: "pre-wrap", cursor: "text", minHeight: 80 }}>
            {node.content || "Notiz hinzufügen…"}
          </p>
        )}
      </div>

      <div onPointerDown={e => e.stopPropagation()} style={{ padding: "0 10px 7px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", fontVariantNumeric: "tabular-nums" }}>
          {formatNodeTime(node.createdAt)}
        </span>
        {node.content && (
          <button
            onClick={e => { e.stopPropagation(); onIterate(node.id, node.content); }}
            style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", background: "transparent", color: "rgba(0,0,0,0.3)", cursor: "pointer", lineHeight: 1.3, transition: "all 0.1s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.6)"; el.style.borderColor = "rgba(0,0,0,0.2)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.3)"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
          >↺ rethink</button>
        )}
      </div>

      {/* Right resize handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 200), "h"); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", zIndex: 10, background: "transparent", transition: "background 0.15s", borderRadius: "0 10px 10px 0" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
      {/* Bottom resize handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 200), "v"); }}
        style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 6, cursor: "ns-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
    </div>
  );
}

// ── IdeaNodeCard ──────────────────────────────────────────────────────────

function IdeaNodeCard({ node, selected, onSelect, onDragStart, onDelete, onResizeStart, onUpdate, onPromote, onIterate, nodeW }: {
  node: IdeaNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v") => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onPromote: (query: string) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  nodeW: number;
}) {
  const [editingTitle, setEditingTitle] = useState(!node.title);
  const [editingContent, setEditingContent] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [draftContent, setDraftContent] = useState(node.content);
  const cardRef = useRef<HTMLDivElement>(null);
  const nodeH = node.customHeight;

  const commitTitle = () => { setEditingTitle(false); onUpdate(node.id, draftTitle, draftContent); };
  const commitContent = () => { setEditingContent(false); onUpdate(node.id, draftTitle, draftContent); };

  return (
    <div
      ref={cardRef}
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{
        position: "absolute", left: node.x, top: node.y, width: nodeW,
        ...(nodeH ? { height: nodeH, overflow: "hidden" } : {}),
        background: "#FFFBF0",
        border: `1.5px solid ${selected ? "#0A0A0A" : "rgba(0,0,0,0.08)"}`,
        borderTop: "3px solid #FF9800",
        borderRadius: 10,
        boxShadow: selected ? "0 0 0 3px rgba(228,255,151,0.6), 0 4px 16px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.06)",
        userSelect: "none",
      }}
    >
      {/* Header / drag handle */}
      <div
        onPointerDown={e => onDragStart(e, node.id)}
        style={{ padding: "9px 10px 7px", cursor: "grab", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontSize: 15, flexShrink: 0 }}>💡</span>
        {editingTitle ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") { setEditingTitle(false); setDraftTitle(node.title); } }}
            onPointerDown={e => e.stopPropagation()}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 600, color: "#0A0A0A", fontFamily: "inherit" }}
            placeholder="Idee oder Hypothese…"
          />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, color: node.title ? "#0A0A0A" : "rgba(0,0,0,0.28)", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >{node.title || "Idee oder Hypothese…"}</span>
        )}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onIterate(node.id, [node.title, node.content].filter(Boolean).join(" — ")); }}
          title="Weitere Iteration starten"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 5px", color: "rgba(0,0,0,0.3)", fontSize: 14, borderRadius: 4, lineHeight: 1, fontWeight: 300, flexShrink: 0 }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#1A9E5A"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.3)"; }}
        >+</button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(node.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 4px", color: "rgba(0,0,0,0.25)", fontSize: 11, flexShrink: 0, borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#E8402A"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.25)"}
        >✕</button>
      </div>

      {/* Content body */}
      <div
        onPointerDown={e => { e.stopPropagation(); if (!editingContent) setEditingContent(true); }}
        style={{ padding: "8px 10px 6px", minHeight: 60 }}
      >
        {editingContent ? (
          <textarea
            autoFocus
            value={draftContent}
            onChange={e => setDraftContent(e.target.value)}
            onBlur={commitContent}
            onKeyDown={e => { if (e.key === "Escape") { setEditingContent(false); setDraftContent(node.content); } }}
            style={{ width: "100%", minHeight: 60, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.65, color: "#0A0A0A", fontFamily: "inherit", boxSizing: "border-box" }}
            placeholder="Beschreibung, Begründung oder nächste Schritte…"
          />
        ) : (
          <p style={{ fontSize: 12, lineHeight: 1.65, color: node.content ? "#0A0A0A" : "rgba(0,0,0,0.28)", margin: 0, whiteSpace: "pre-wrap", cursor: "text", minHeight: 60 }}>
            {node.content || "Beschreibung, Begründung oder nächste Schritte…"}
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{ padding: "5px 10px 8px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", fontVariantNumeric: "tabular-nums" }}>
          {formatNodeTime(node.createdAt)}
        </span>
        {(node.title || node.content) && (
          <button
            onClick={e => { e.stopPropagation(); onIterate(node.id, [node.title, node.content].filter(Boolean).join(" — ")); }}
            style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", background: "transparent", color: "rgba(0,0,0,0.3)", cursor: "pointer", lineHeight: 1.3, transition: "all 0.1s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.6)"; el.style.borderColor = "rgba(0,0,0,0.2)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.3)"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
          >↺ rethink</button>
        )}
        <div style={{ flex: 1 }} />
        {(node.title || node.content) && (
          <button
            onClick={e => { e.stopPropagation(); onPromote([node.title, node.content].filter(Boolean).join(" — ")); }}
            style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(255,152,0,0.3)", background: "rgba(255,152,0,0.08)", color: "#E65100", cursor: "pointer", transition: "all 0.12s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,152,0,0.18)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,152,0,0.08)"; }}
          >Als Abfrage</button>
        )}
      </div>

      {/* Right resize handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 200), "h"); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", zIndex: 10, background: "transparent", transition: "background 0.15s", borderRadius: "0 10px 10px 0" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
      {/* Bottom resize handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 160), "v"); }}
        style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 6, cursor: "ns-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
    </div>
  );
}

// ── ListNodeCard ──────────────────────────────────────────────────────────

function ListNodeCard({ node, selected, onSelect, onDragStart, onDelete, onResizeStart, onUpdate, onIterate, nodeW }: {
  node: ListNode; selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number, dir?: "h" | "v") => void;
  onUpdate: (id: string, title: string, items: string[]) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  nodeW: number;
}) {
  const [editingTitle, setEditingTitle] = useState(!node.title);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nodeH = node.customHeight;

  const commitTitle = () => { setEditingTitle(false); onUpdate(node.id, draftTitle, node.items); };

  const startEditItem = (i: number) => {
    setEditingIdx(i); setDraftItem(node.items[i]);
    setTimeout(() => itemRefs.current[i]?.focus(), 0);
  };

  const commitItem = (i: number) => {
    const updated = node.items.map((it, idx) => idx === i ? draftItem : it).filter((it, idx) => it.trim() !== "" || idx === node.items.length - 1);
    onUpdate(node.id, node.title, updated.length > 0 ? updated : [""]);
    setEditingIdx(null);
  };

  const addItem = () => {
    const items = [...node.items, ""];
    onUpdate(node.id, node.title, items);
    setTimeout(() => { const i = items.length - 1; setEditingIdx(i); setDraftItem(""); itemRefs.current[i]?.focus(); }, 30);
  };

  const removeItem = (i: number) => {
    const items = node.items.filter((_, idx) => idx !== i);
    onUpdate(node.id, node.title, items.length > 0 ? items : [""]);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Enter") { e.preventDefault(); commitItem(i); addItem(); }
    if (e.key === "Escape") { setEditingIdx(null); setDraftItem(node.items[i]); }
    if (e.key === "Backspace" && draftItem === "" && node.items.length > 1) {
      e.preventDefault(); removeItem(i); const prev = Math.max(0, i - 1); setTimeout(() => startEditItem(prev), 30);
    }
  };

  const prefillForIterate = [node.title, ...node.items.filter(Boolean)].join(" · ");

  return (
    <div
      ref={cardRef}
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{
        position: "absolute", left: node.x, top: node.y, width: nodeW,
        ...(nodeH ? { height: nodeH, overflow: "hidden" } : {}),
        background: "#F1FBF4",
        border: `1.5px solid ${selected ? "#0A0A0A" : "rgba(0,0,0,0.08)"}`,
        borderTop: "3px solid #2E7D32",
        borderRadius: 10,
        boxShadow: selected ? "0 0 0 3px rgba(228,255,151,0.6), 0 4px 16px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.06)",
        userSelect: "none",
      }}
    >
      {/* Header / drag handle */}
      <div
        onPointerDown={e => onDragStart(e, node.id)}
        style={{ padding: "9px 10px 7px", cursor: "grab", borderBottom: "1px solid rgba(46,125,50,0.1)", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontSize: 13, color: "#2E7D32", flexShrink: 0, fontWeight: 700, lineHeight: 1 }}>≡</span>
        {editingTitle ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") { setEditingTitle(false); setDraftTitle(node.title); } }}
            onPointerDown={e => e.stopPropagation()}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 600, color: "#0A0A0A", fontFamily: "inherit" }}
            placeholder="Listen-Titel…"
          />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, color: node.title ? "#0A0A0A" : "rgba(0,0,0,0.28)", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title="Klicken zum Bearbeiten"
          >{node.title || "Listen-Titel…"}</span>
        )}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onIterate(node.id, prefillForIterate); }}
          title="Neue Iteration starten"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 5px", color: "rgba(0,0,0,0.3)", fontSize: 14, borderRadius: 4, lineHeight: 1, fontWeight: 300, flexShrink: 0 }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#1A9E5A"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.3)"; }}
        >+</button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(node.id); }}
          title="Karte löschen"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 4px", color: "rgba(0,0,0,0.25)", fontSize: 11, flexShrink: 0, borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#E8402A"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.25)"}
        >✕</button>
      </div>

      {/* List items */}
      <div onPointerDown={e => e.stopPropagation()} style={{ padding: "6px 10px 2px" }}>
        {node.items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
            <span style={{ color: "#2E7D32", fontSize: 11, marginTop: 3, flexShrink: 0 }}>•</span>
            {editingIdx === i ? (
              <input
                ref={el => { itemRefs.current[i] = el; }}
                value={draftItem}
                onChange={e => setDraftItem(e.target.value)}
                onBlur={() => commitItem(i)}
                onKeyDown={e => handleItemKeyDown(e, i)}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit", lineHeight: 1.5, minWidth: 0 }}
              />
            ) : (
              <span
                onClick={() => startEditItem(i)}
                style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: item ? "#0A0A0A" : "rgba(0,0,0,0.28)", cursor: "text", minHeight: 20 }}
                title="Klicken zum Bearbeiten"
              >{item || "Eintrag…"}</span>
            )}
            {node.items.length > 1 && (
              <button
                onClick={() => removeItem(i)}
                title="Eintrag entfernen"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "rgba(0,0,0,0.18)", fontSize: 10, borderRadius: 3, flexShrink: 0, lineHeight: 1, marginTop: 3 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#E8402A"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.18)"}
              >✕</button>
            )}
          </div>
        ))}
        <button
          onClick={addItem}
          title="Eintrag hinzufügen (oder Enter am Ende)"
          style={{ marginTop: 4, marginBottom: 4, fontSize: 11, color: "#2E7D32", background: "none", border: "none", cursor: "pointer", padding: "2px 0", display: "flex", alignItems: "center", gap: 4, opacity: 0.65 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.65"}
        >+ Eintrag</button>
      </div>

      {/* Footer: timestamp + rethink */}
      <div onPointerDown={e => e.stopPropagation()} style={{ padding: "4px 10px 7px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", fontVariantNumeric: "tabular-nums" }}>
          {formatNodeTime(node.createdAt)}
        </span>
        {(node.title || node.items.some(Boolean)) && (
          <button
            onClick={e => { e.stopPropagation(); onIterate(node.id, prefillForIterate); }}
            title="Diesen Inhalt weiterdenken"
            style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", background: "transparent", color: "rgba(0,0,0,0.3)", cursor: "pointer", lineHeight: 1.3, transition: "all 0.1s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.6)"; el.style.borderColor = "rgba(0,0,0,0.2)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(0,0,0,0.3)"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
          >↺ rethink</button>
        )}
      </div>

      {/* Right resize handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 200), "h"); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", zIndex: 10, background: "transparent", transition: "background 0.15s", borderRadius: "0 10px 10px 0" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
      {/* Bottom resize handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, nodeH ?? (cardRef.current?.offsetHeight ?? 160), "v"); }}
        style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 6, cursor: "ns-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CanvasPage() {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  // locale fixed to "de" — language toggle deferred
  const locale: "de" | "en" = "de";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cmdVisible, setCmdVisible] = useState(false);
  const [cmdParentId, setCmdParentId] = useState<string | null>(null);
  const [cmdPrefill, setCmdPrefill] = useState("");
  const [nodePickerVisible, setNodePickerVisible] = useState(false);
  const [iterateCtx, setIterateCtx] = useState<{ parentId: string; prefill: string } | null>(null);
  const iterateCtxRef = useRef<{ parentId: string; prefill: string } | null>(null);

  // ── Project state ─────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error" | null>(null);

  const de = locale === "de";
  const queryNodes = useMemo(() => nodes.filter((n): n is QueryNode => n.nodeType === "query"), [nodes]);
  const isEmpty = nodes.length === 0;

  // Refs for pointer events and DB save
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const projectIdRef = useRef(projectId);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; panYRef.current = panY; }, [panX, panY]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { iterateCtxRef.current = iterateCtx; }, [iterateCtx]);

  const draggingRef  = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizingRef  = useRef<{ id: string; dir: "h" | "v"; startX: number; startW: number; startY: number; startH: number } | null>(null);
  const panningRef   = useRef<{ sx: number; sy: number; opx: number; opy: number } | null>(null);
  const viewportRef  = useRef<HTMLDivElement>(null);
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Project API functions ─────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/canvas");
      const json = await res.json();
      setProjects(json.canvases ?? []);
    } catch {}
  }, []);

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
      };
      await fetch(`/api/v1/canvas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: state }),
      });
      setSaveStatus("saved");
      // Refresh project list to update updated_at
      setProjects(prev => prev.map(p =>
        p.id === id ? { ...p, updated_at: new Date().toISOString(), hasState: true } : p
      ));
    } catch {
      setSaveStatus("error");
    }
  }, []);

  const createNewProject = useCallback(async () => {
    const name = window.prompt(de ? "Projektname:" : "Project name:", de ? "Neues Projekt" : "New project");
    if (!name?.trim()) return;
    try {
      const res = await fetch("/api/v1/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      const newCanvas = json.canvas;
      if (!newCanvas?.id) return;
      setProjectId(newCanvas.id);
      setProjectName(name.trim());
      setNodes([]); setConnections([]);
      setPanX(0); setPanY(0); setZoom(1);
      setSelectedId(null); setCmdVisible(false);
      setSaveStatus(null);
      try { localStorage.setItem("sis-active-canvas", newCanvas.id); } catch {}
      await loadProjects();
    } catch {}
  }, [de, loadProjects]);

  const loadProject = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/canvas/${id}`);
      const json = await res.json();
      const canvas = json.canvas;
      if (!canvas) return;
      setProjectId(id);
      setProjectName(canvas.name);
      setSaveStatus(null);
      try { localStorage.setItem("sis-active-canvas", id); } catch {}
      if (canvas.canvas_state) {
        const state = JSON.parse(canvas.canvas_state);
        if (state.nodes) setNodes(state.nodes);
        if (state.conns) setConnections(state.conns);
        if (state.pan) { setPanX(state.pan.x); setPanY(state.pan.y); }
        if (state.zoom) setZoom(state.zoom);
      } else {
        setNodes([]); setConnections([]);
        setPanX(0); setPanY(0); setZoom(1);
      }
      setProjectDropdownOpen(false);
    } catch {}
  }, []);

  const saveProjectName = useCallback(async () => {
    setEditingName(false);
    if (!projectId || !projectName.trim()) return;
    try {
      await fetch(`/api/v1/canvas/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: projectName.trim() } : p));
    } catch {}
  }, [projectId, projectName]);

  const deleteProject = useCallback(async (id: string) => {
    if (!window.confirm(de ? "Projekt unwiderruflich löschen?" : "Delete project permanently?")) return;
    try {
      await fetch(`/api/v1/canvas/${id}`, { method: "DELETE" });
      setProjects(prev => prev.filter(p => p.id !== id));
      if (projectId === id) {
        setProjectId(null); setProjectName(""); setSaveStatus(null);
        try { localStorage.removeItem("sis-active-canvas"); } catch {}
      }
    } catch {}
  }, [de, projectId]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    // locale is fixed to "de" for now

    loadProjects();

    const activeId = (() => { try { return localStorage.getItem("sis-active-canvas"); } catch { return null; } })();

    if (activeId) {
      fetch(`/api/v1/canvas/${activeId}`)
        .then(r => r.json())
        .then(json => {
          const canvas = json.canvas;
          if (!canvas) { fallbackLocalStorage(); return; }
          setProjectId(activeId);
          setProjectName(canvas.name);
          if (canvas.canvas_state) {
            const state = JSON.parse(canvas.canvas_state);
            if (state.nodes) setNodes(state.nodes);
            if (state.conns) setConnections(state.conns);
            if (state.pan)  { setPanX(state.pan.x); setPanY(state.pan.y); }
            if (state.zoom) setZoom(state.zoom);
          }
        })
        .catch(fallbackLocalStorage);
    } else {
      fallbackLocalStorage();
    }

    function fallbackLocalStorage() {
      const saved = loadFromStorage();
      if (saved) {
        setNodes(saved.nodes); setConnections(saved.conns);
        setPanX(saved.pan.x); setPanY(saved.pan.y); setZoom(saved.zoom);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced localStorage persist
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const doneNodes = nodes.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
      if (doneNodes.length > 0) saveToStorage(doneNodes, connections, { x: panX, y: panY }, zoom);
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, connections, panX, panY, zoom]);

  // Debounced DB persist (only when a project is active)
  useEffect(() => {
    if (!projectId) return;
    clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(() => {
      const hasDone = nodesRef.current.some(n =>
        n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error"
      );
      if (hasDone) saveCanvasToDb(projectId);
    }, 2000);
    return () => clearTimeout(dbSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, connections, panX, panY, zoom, projectId]);

  // ── Global pointer events ─────────────────────────────────────────────────

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (draggingRef.current) {
        const { id, sx, sy, ox, oy } = draggingRef.current;
        const dx = (e.clientX - sx) / zoomRef.current;
        const dy = (e.clientY - sy) / zoomRef.current;
        setNodes(prev => prev.map(n => n.id === id ? { ...n, x: ox + dx, y: oy + dy } : n));
      } else if (resizingRef.current) {
        const { id, dir, startX, startW, startY, startH } = resizingRef.current;
        if (dir === "h") {
          const dx = (e.clientX - startX) / zoomRef.current;
          const newW = Math.max(200, Math.min(900, Math.round(startW + dx)));
          setNodes(prev => prev.map(n => n.id === id ? { ...n, customWidth: newW } : n));
        } else {
          const dy = (e.clientY - startY) / zoomRef.current;
          const newH = Math.max(80, Math.min(1400, Math.round(startH + dy)));
          setNodes(prev => prev.map(n => n.id === id ? { ...n, customHeight: newH } : n));
        }
      } else if (panningRef.current) {
        const { sx, sy, opx, opy } = panningRef.current;
        setPanX(opx + e.clientX - sx);
        setPanY(opy + e.clientY - sy);
      }
    };
    const up = () => { draggingRef.current = null; resizingRef.current = null; panningRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCmdVisible(false); setCmdPrefill(""); setProjectDropdownOpen(false); setNodePickerVisible(false); setIterateCtx(null); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !cmdVisible) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
        deleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, cmdVisible]);

  // ── Positioning ───────────────────────────────────────────────────────────

  const getNextQueryPos = useCallback((parentId?: string): { x: number; y: number } => {
    if (parentId) {
      const parent = nodesRef.current.find(n => n.id === parentId);
      if (parent) {
        const parentW = parent.customWidth ?? (
          parent.nodeType === "query" ? QUERY_NODE_W :
          parent.nodeType === "list"  ? LIST_NODE_W  : DERIVED_W
        );
        const siblings = nodesRef.current.filter(n => n.parentId === parentId && n.nodeType === "query");
        return { x: parent.x + parentW + 80, y: parent.y + siblings.length * 28 };
      }
    }
    if (nodesRef.current.length === 0) {
      const vp = viewportRef.current?.getBoundingClientRect();
      if (vp) return { x: (vp.width / 2 - QUERY_NODE_W / 2 - panXRef.current) / zoomRef.current, y: (vp.height / 2 - 150 - panYRef.current) / zoomRef.current };
      return { x: 80, y: 80 };
    }
    const last = [...nodesRef.current].filter(n => n.nodeType === "query").sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!last) return { x: 80, y: 80 };
    return { x: last.x, y: last.y + 320 };
  }, []);

  // ── Query submission ──────────────────────────────────────────────────────

  const submitQuery = useCallback((query: string, parentId?: string, opts?: { refreshed?: boolean }) => {
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

    streamQuery(
      query, locale,
      (chunk) => setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
      (result) => {
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
      },
      (msg) => setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n)),
    );
  }, [locale, getNextQueryPos]);

  // ── Node actions ──────────────────────────────────────────────────────────

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id && n.parentId !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    setSelectedId(prev => prev === id ? null : prev);
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
    const derivedType = (n as DerivedNode).nodeType;
    if (derivedType === "followup") {
      handleFollowUp(nodeId, queryText);
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
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "note" ? { ...n, content } : n));
  }, []);

  const handleUpdateIdea = useCallback((id: string, title: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "idea" ? { ...n, title, content } : n));
  }, []);

  const handlePromoteIdea = useCallback((query: string) => {
    submitQuery(query);
  }, [submitQuery]);

  const handleUpdateList = useCallback((id: string, title: string, items: string[]) => {
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "list" ? { ...n, title, items } : n));
  }, []);

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
      setCmdParentId(parentId); setCmdPrefill(prefill); setCmdVisible(true);
      return;
    }

    // Position near parent if we have context
    const getCtxPos = () => {
      if (!ctx) return getNextQueryPos();
      const parent = nodesRef.current.find(n => n.id === ctx.parentId);
      if (!parent) return getNextQueryPos();
      const parentW = parent.nodeType === "query"
        ? ((parent as QueryNode).customWidth ?? QUERY_NODE_W)
        : parent.nodeType === "list"
        ? ((parent as ListNode).customWidth ?? LIST_NODE_W)
        : ((parent as DerivedNode | NoteNode | IdeaNode).customWidth ?? DERIVED_W);
      return { x: parent.x + parentW + 64, y: parent.y + 80 };
    };

    const pos = getCtxPos();
    const id = uid();

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
    }
    setSelectedId(id);
  }, [getNextQueryPos]);

  const clearCanvas = useCallback(() => {
    if (!window.confirm(de ? "Canvas leeren?" : "Clear canvas?")) return;
    setNodes([]); setConnections([]);
    setPanX(0); setPanY(0); setZoom(1);
    setSelectedId(null); setCmdVisible(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    if (projectIdRef.current) {
      fetch(`/api/v1/canvas/${projectIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: null }),
      }).catch(() => {});
    }
  }, [de]);

  // ── Auto-reorganize layout ────────────────────────────────────────────────

  const reorganizeCanvas = useCallback(() => {
    const ns = nodesRef.current;
    const conns = connectionsRef.current;
    if (ns.length === 0) return;

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

      const insights  = derived.filter(n => n.nodeType === "insight");
      const decisions = derived.filter(n => n.nodeType === "decision");
      const scenarios = derived.filter(n => n.nodeType === "scenario");
      const followups = derived.filter(n => n.nodeType === "followup");
      const hasSrc    = derived.some(n => (n as DerivedNode).sources?.length);

      const colA_X = startX + curQW + DERIVED_COL_GAP_X;
      const colB_X = colA_X + curDW + DERIVED_COL_GAP;
      let colA_Y   = startY;
      let colB_Y   = startY;

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
      const rowY = Math.max(colA_Y, colB_Y) + 20;
      followups.forEach((n, i) => {
        newPos.set(n.id, { x: colA_X + i * (curDW + DERIVED_COL_GAP), y: rowY });
      });

      let clusterBottom = Math.max(
        startY + 160,
        colA_Y, colB_Y,
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

    // Orphaned nodes (no position assigned yet)
    ns.filter(n => !newPos.has(n.id)).forEach((n, i) => {
      newPos.set(n.id, { x: MARGIN_X + (i % 3) * (curQW + 60), y: globalY + Math.floor(i / 3) * 200 });
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
  }, []);

  // ── Drag / pan / zoom ────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.PointerEvent, id: string) => {
    const n = nodesRef.current.find(x => x.id === id);
    if (!n) return;
    draggingRef.current = { id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, id: string, currentW: number, currentH: number, dir: "h" | "v" = "h") => {
    e.stopPropagation();
    resizingRef.current = { id, dir, startX: e.clientX, startW: currentW, startY: e.clientY, startH: currentH };
  }, []);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== viewportRef.current) return;
    setProjectDropdownOpen(false);
    panningRef.current = { sx: e.clientX, sy: e.clientY, opx: panXRef.current, opy: panYRef.current };
    setSelectedId(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(2.5, Math.max(0.2, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const cmdContextLabel = useMemo(() => {
    if (!cmdParentId) return undefined;
    const n = nodes.find(x => x.id === cmdParentId);
    if (!n) return undefined;
    return n.nodeType === "query" ? (n as QueryNode).query : (n as DerivedNode).content.slice(0, 80);
  }, [cmdParentId, nodes]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--color-page-bg)" }}>

      {/* Backdrop for dropdown */}
      {projectDropdownOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setProjectDropdownOpen(false)} />
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{ height: 48, flexShrink: 0, zIndex: 200, display: "flex", alignItems: "center", padding: "0 20px", gap: 10, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>

        {/* Logo + back */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#E4FF97", border: "1.5px solid rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.05em" }}>SIS</div>
          <a href="/" style={{ fontSize: 12, color: "var(--color-text-secondary)", textDecoration: "none", fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"}
          >← {de ? "Zurück" : "Back"}</a>
        </div>
        <span style={{ color: "var(--color-border)", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-heading)", letterSpacing: "-0.01em", flexShrink: 0 }}>Canvas</span>
        <span style={{ color: "var(--color-border)", fontSize: 14 }}>|</span>

        {/* ── Project management ─────────────────────────────── */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, zIndex: 200 }}>
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

          {/* New project button */}
          <button
            onClick={createNewProject}
            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: "transparent", border: "1px solid var(--color-border)", borderRadius: 20, cursor: "pointer", color: "var(--color-text-secondary)", transition: "all 0.12s", whiteSpace: "nowrap" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-secondary)"; el.style.borderColor = "var(--color-border)"; }}
          >+ {de ? "Neu" : "New"}</button>

          {/* Save status */}
          {projectId && saveStatus && (
            <span style={{ fontSize: 10, color: saveStatus === "saved" ? "#1A9E5A" : saveStatus === "error" ? "#E8402A" : "var(--color-text-muted)", minWidth: 80, transition: "opacity 0.5s" }}>
              {saveStatus === "saving" ? (de ? "↑ Speichert…" : "↑ Saving…")
                : saveStatus === "saved" ? (de ? "✓ Gespeichert" : "✓ Saved")
                : (de ? "! Fehler beim Speichern" : "! Save error")}
            </span>
          )}

          {/* Project dropdown */}
          {projectDropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              minWidth: 280, maxHeight: 320, overflowY: "auto",
            }}>
              {projects.length === 0 ? (
                <div style={{ padding: "16px 16px", fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                  {de ? "Noch keine Projekte" : "No projects yet"}<br />
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{de ? "Klicke »+ Neu« um zu starten" : 'Click "+ New" to start'}</span>
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

        {/* Stats */}
        {nodes.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>
            {queryNodes.length} {de ? "Abfragen" : "queries"} · {nodes.length - queryNodes.length} {de ? "Karten" : "cards"}
            {connections.length > 0 && ` · ${connections.length} ${de ? "Verb." : "links"}`}
          </span>
        )}

        {/* Right controls */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* + Add node — always visible in top right */}
          <button
            onClick={() => { setIterateCtx(null); setNodePickerVisible(true); }}
            title={de ? "Neue Karte hinzufügen (Abfrage, Notiz, Idee, Liste)" : "Add new card (query, note, idea, list)"}
            style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", transition: "all 0.12s", display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-secondary)"; el.style.borderColor = "var(--color-border)"; }}
          >
            <span style={{ fontSize: 15, fontWeight: 300, lineHeight: 1 }}>+</span>
            {de ? "Hinzufügen" : "Add"}
          </button>

          <span style={{ color: "var(--color-border)", fontSize: 14 }}>|</span>

          {/* Reorganize */}
          {nodes.length > 1 && (
            <button onClick={reorganizeCanvas}
              title={de ? "Alle Karten automatisch neu anordnen" : "Auto-arrange all cards"}
              style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; }}
            >⊞ {de ? "Ordnen" : "Arrange"}</button>
          )}

          <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right" }}>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
            title={de ? "Zoom zurücksetzen und zentrieren" : "Reset zoom and center"}
            style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}
          >⊙</button>
          {nodes.length > 0 && (
            <button onClick={clearCanvas}
              title={de ? "Canvas komplett leeren" : "Clear entire canvas"}
              style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; (e.currentTarget as HTMLElement).style.borderColor = "#FCA5A5"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
            >{de ? "Leeren" : "Clear"}</button>
          )}
        </div>
      </header>

      {/* ── Canvas viewport ──────────────────────────────────────── */}
      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onWheel={handleWheel}
        style={{
          flex: 1, position: "relative", overflow: "hidden",
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.09) 1px, transparent 1px)",
          backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
          backgroundPosition: `${panX % (22 * zoom)}px ${panY % (22 * zoom)}px`,
        }}
      >
        {/* Canvas transform layer */}
        <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          <ConnectionsSVG nodes={nodes} connections={connections} />

          {nodes.map(n => {
            if (n.nodeType === "query") {
              const qNode = n as QueryNode;
              return (
                <QueryNodeCard key={n.id}
                  node={qNode} de={de}
                  selected={selectedId === n.id}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  onFollowUp={handleFollowUp}
                  onFollowUpQ={(id, q) => handleFollowUp(id, q)}
                  onDelete={deleteNode}
                  onToggleCollapse={toggleCollapse}
                  onRefresh={handleRefresh}
                  onResizeStart={handleResizeStart}
                  onIterate={handleIterateFromNode}
                  nodeW={qNode.customWidth ?? QUERY_NODE_W}
                />
              );
            }
            if (n.nodeType === "note") {
              const nNode = n as NoteNode;
              return (
                <NoteNodeCard key={n.id}
                  node={nNode}
                  selected={selectedId === n.id}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  onDelete={deleteNode}
                  onResizeStart={handleResizeStart}
                  onUpdate={handleUpdateNote}
                  onIterate={handleIterateFromNode}
                  nodeW={nNode.customWidth ?? 280}
                />
              );
            }
            if (n.nodeType === "idea") {
              const iNode = n as IdeaNode;
              return (
                <IdeaNodeCard key={n.id}
                  node={iNode}
                  selected={selectedId === n.id}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  onDelete={deleteNode}
                  onResizeStart={handleResizeStart}
                  onUpdate={handleUpdateIdea}
                  onPromote={handlePromoteIdea}
                  onIterate={handleIterateFromNode}
                  nodeW={iNode.customWidth ?? 300}
                />
              );
            }
            if (n.nodeType === "list") {
              const lNode = n as ListNode;
              return (
                <ListNodeCard key={n.id}
                  node={lNode}
                  selected={selectedId === n.id}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  onDelete={deleteNode}
                  onResizeStart={handleResizeStart}
                  onUpdate={handleUpdateList}
                  onIterate={handleIterateFromNode}
                  nodeW={lNode.customWidth ?? 280}
                />
              );
            }
            const dNode = n as DerivedNode;
            return (
              <DerivedNodeCard key={n.id}
                node={dNode} de={de}
                selected={selectedId === n.id}
                onSelect={setSelectedId}
                onDragStart={handleDragStart}
                onExplore={handleExplore}
                onDelete={deleteNode}
                onResizeStart={handleResizeStart}
                onIterate={handleIterateFromNode}
                nodeW={dNode.customWidth ?? DERIVED_W}
              />
            );
          })}
        </div>

        {/* ── Empty state ─────────────────────────────────────────── */}
        {isEmpty && !cmdVisible && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-muted)", marginBottom: 28 }}>
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
        {cmdVisible && (
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
        {nodePickerVisible && (
          <>
            {/* Backdrop */}
            <div style={{ position: "absolute", inset: 0, zIndex: 49 }} onPointerDown={() => { setNodePickerVisible(false); setIterateCtx(null); }} />
            <div style={{ position: "absolute", bottom: 84, left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
              <NodePicker onSelect={handleNodeTypeSelect} onClose={() => { setNodePickerVisible(false); setIterateCtx(null); }} hasContext={!!iterateCtx} />
            </div>
          </>
        )}

        {/* bottom-center floating button removed — "+" is now in the header top-right */}

        {/* ── Hints bottom-right ──────────────────────────────────── */}
        <div style={{ position: "absolute", bottom: 14, right: 18, fontSize: 10, color: "var(--color-text-muted)", textAlign: "right", pointerEvents: "none", lineHeight: 1.6 }}>
          <div>{de ? "Scrollen = Zoom · Hintergrund ziehen = Pan" : "Scroll = zoom · Drag background = pan"}</div>
          <div style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>
            {Math.round(panX)},{Math.round(panY)} · {Math.round(zoom * 100)}%
          </div>
        </div>
      </div>

      <style>{`@keyframes cur-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
