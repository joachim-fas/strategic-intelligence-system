"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { TrendDot } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeedSignal {
  id: string; source: string; title: string; url: string | null;
  strength: number; topic: string | null; signal_type: string;
  fetched_at: string; hoursAgo: number;
}

interface FeedTrend {
  id: string; name: string; description: string; category: string;
  trendType: string; ring: string; velocity: "rising" | "stable" | "falling";
  relevance: number; confidence: number; impact: number;
  signalCount72h: number; avgStrength: number; sparkline: number[]; tags: string[];
}

interface SourceStatus {
  source: string; lastSignalAt: string | null; signalCount: number;
  status: "fresh" | "stale" | "empty";
}

interface FeedData {
  topSignals: FeedSignal[]; trends: FeedTrend[]; sourceStatus: SourceStatus[];
  meta: { totalSignals: number; freshSignals: number; timestamp: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  hackernews: "#FF6600", github: "#333", reddit: "#FF5700", news: "#1A73E8",
  arxiv: "#B31B1B", wikipedia: "#636466", polymarket: "#6366F1", manifold: "#8B5CF6",
  worldbank: "#0070C0", google_trends: "#4285F4", stackoverflow: "#F48024",
  npm_pypi: "#CB3837", producthunt: "#DA552F", openalex: "#CC5500",
  worldmonitor: "#2E7D32", sentiment: "#9C27B0", gdelt: "#607D8B",
};

const RING_CFG: Record<string, { color: string; bg: string; border: string }> = {
  adopt:  { color: "var(--pastel-mint-text, #0F6038)", bg: "var(--pastel-mint, #C3F4D3)", border: "#7DD4A8" },
  trial:  { color: "#1A4A8A", bg: "#D4E8FF", border: "#80B8F0" },
  assess: { color: "#7A5C00", bg: "#FFF5BA", border: "#E0C840" },
  hold:   { color: "#3A4560", bg: "#F0F2F7", border: "#D1D5DB" },
};

const VELOCITY_CFG = {
  rising:  { symbol: "↑", color: "var(--signal-positive, #1A9E5A)", label: { de: "steigend", en: "rising" } },
  stable:  { symbol: "→", color: "#9CA3AF", label: { de: "stabil", en: "stable" } },
  falling: { symbol: "↓", color: "var(--signal-negative, #E8402A)", label: { de: "fallend", en: "falling" } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageLabel(h: number): string { return h < 1 ? "<1h" : h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`; }
function strengthDots(s: number): string { const f = Math.min(3, Math.ceil(s * 3)); return "●".repeat(f) + "○".repeat(3 - f); }

function MiniSparkline({ data, width = 48, height = 14, color = "#3B82F6" }: { data: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(...data, 1);
  const bw = (width - 2) / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", flexShrink: 0 }}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 2);
        return <rect key={i} x={1 + i * bw} y={height - 1 - h} width={bw - 1} height={Math.max(h, 0.5)} rx={1} fill={color} fillOpacity={0.2 + (v / max) * 0.6} />;
      })}
    </svg>
  );
}

function MetricBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ flex: 1, height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 100}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 600, color, minWidth: 24, textAlign: "right" }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

// ─── SignalRadar ──────────────────────────────────────────────────────────────

interface Props { locale: "de" | "en"; onTrendClick?: (trend: TrendDot) => void; }

export default function SignalRadar({ locale, onTrendClick }: Props) {
  const de = locale === "de";
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [trendFilter, setTrendFilter] = useState<string>("all");
  const [hoveredTrend, setHoveredTrend] = useState<FeedTrend | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/feed");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { console.error("[SignalRadar]", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFeed(); const iv = setInterval(fetchFeed, 5 * 60000); return () => clearInterval(iv); }, [fetchFeed]);

  // ── Collapsed state ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div onClick={() => setCollapsed(false)} style={{
        padding: "8px 24px", cursor: "pointer",
        borderTop: "1px solid var(--color-border)", background: "rgba(250,250,250,0.95)",
        backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: 8,
        fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600,
      }}>
        <span style={{ fontSize: 8, color: "var(--signal-positive, #1A9E5A)" }}>●</span>
        SIGNAL-RADAR
        {data && <span style={{ fontWeight: 400, marginLeft: 4 }}>{data.meta.freshSignals} {de ? "Signale" : "signals"} · {data.trends.length} Trends</span>}
        <span style={{ marginLeft: "auto", fontSize: 13 }}>▲</span>
      </div>
    );
  }

  // ── Full view ──────────────────────────────────────────────────────────────
  return (
    <div style={{ borderTop: "1.5px solid var(--color-border)", background: "rgba(250,250,250,0.97)" }}>
      {/* Header */}
      <div onClick={() => setCollapsed(true)} style={{ padding: "8px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <span style={{ fontSize: 8, color: "var(--signal-positive, #1A9E5A)" }}>●</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--color-text-heading)" }}>SIGNAL-RADAR</span>
        {data && <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          {data.meta.freshSignals} {de ? "Signale" : "signals"} · {data.trends.length} Trends · {data.sourceStatus.filter(s => s.status === "fresh").length} {de ? "aktive Quellen" : "active sources"}
        </span>}
        <button onClick={e => { e.stopPropagation(); fetchFeed(); }} style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>↻</button>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>▼</span>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--volt-text-faint, #999)" }}>{de ? "Lade…" : "Loading…"}</div>
      ) : data ? (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>

          {/* ── SECTION 1: Mega- & Makrotrends (Kern) ──────────────────── */}
          <div style={{ padding: "10px 24px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                {de ? "Mega- & Makrotrends" : "Mega & Macro Trends"} ({data.trends.length})
              </span>
              <div style={{ display: "flex", gap: 3, marginLeft: 8 }}>
                {["all", "technology", "society", "economy", "geopolitics", "environment"].map(cat => {
                  const labels: Record<string, string> = { all: de ? "Alle" : "All", technology: de ? "Technologie" : "Tech", society: de ? "Gesellschaft" : "Society", economy: de ? "Wirtschaft" : "Economy", geopolitics: de ? "Geopolitik" : "Geopolitics", environment: de ? "Umwelt" : "Environment" };
                  const active = trendFilter === cat;
                  return <button key={cat} onClick={() => setTrendFilter(cat)} style={{
                    fontSize: 9, padding: "1px 7px", borderRadius: 10,
                    border: `1px solid ${active ? "var(--color-text-heading)" : "var(--color-border)"}`,
                    background: active ? "var(--color-text-heading)" : "transparent",
                    color: active ? "var(--volt-surface, #fff)" : "var(--color-text-muted)", cursor: "pointer", fontWeight: active ? 600 : 400,
                  }}>{labels[cat] ?? cat}</button>;
                })}
              </div>
            </div>

            {/* Trend cards — 3-column grid like old IntelligenceFeed */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
              {data.trends
                .filter(t => trendFilter === "all" || t.category === trendFilter)
                .map(t => {
                  const vel = VELOCITY_CFG[t.velocity];
                  const ring = RING_CFG[t.ring] ?? RING_CFG.hold;
                  return (
                    <div key={t.id}
                      onClick={() => onTrendClick?.({
                        id: t.id, name: t.name, description: t.description, category: t.category, tags: t.tags,
                        relevance: t.relevance, confidence: t.confidence, impact: t.impact, ring: t.ring,
                        velocity: t.velocity, quadrant: 0, signalCount: t.signalCount72h, topSources: [],
                        timeHorizon: "mid", userOverride: false,
                      } as TrendDot)}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHoveredTrend(t);
                        setTooltipPos({ x: Math.min(rect.left, window.innerWidth - 280), y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredTrend(null)}
                      style={{
                        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        background: ring.bg, borderLeft: `3px solid ${ring.border}`,
                        transition: "box-shadow 0.12s",
                      }}
                      onMouseOver={e => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)")}
                      onMouseOut={e => (e.currentTarget.style.boxShadow = "none")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: ring.color, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: vel.color, flexShrink: 0 }}>{vel.symbol}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: t.trendType === "megatrend" ? "#FFF5BA" : "var(--color-surface-2, #F3F4F6)", color: t.trendType === "megatrend" ? "#7A5C00" : "var(--volt-text-muted, #6B7280)", border: `1px solid ${t.trendType === "megatrend" ? "#E0C840" : "#D1D5DB"}` }}>
                          {t.trendType === "megatrend" ? "MEGA" : "MAKRO"}
                        </span>
                        <span style={{ fontSize: 8, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: ring.bg, color: ring.color, border: `1px solid ${ring.border}` }}>{t.ring.toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{t.signalCount72h} sig.</span>
                        <MiniSparkline data={t.sparkline} color={vel.color} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ── SECTION 2: Stärkste Signale ────────────────────────────── */}
          <div style={{ padding: "10px 24px 6px", borderTop: "1px solid rgba(0,0,0,0.04)", marginTop: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase" }}>
              {de ? "Stärkste Live-Signale" : "Strongest Live Signals"} ({data.topSignals.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.topSignals.map(s => {
                const srcColor = SOURCE_COLORS[s.source] ?? "var(--volt-text-muted, #666)";
                const ageBg = s.hoursAgo < 24 ? "var(--signal-positive, #1A9E5A)" : s.hoursAgo < 72 ? "#F5A623" : "#9CA3AF";
                return (
                  <a key={s.id}
                    href={s.url ?? undefined}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "4px 8px",
                      borderRadius: 6, textDecoration: "none", color: "inherit",
                      transition: "background 0.1s", cursor: s.url ? "pointer" : "default",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 9, color: ageBg, flexShrink: 0, fontFamily: "monospace", width: 28, textAlign: "right" }}>{ageLabel(s.hoursAgo)}</span>
                    <span style={{ fontSize: 8, color: "var(--color-text-muted)", flexShrink: 0, width: 24 }}>{strengthDots(s.strength)}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: `${srcColor}14`, color: srcColor, border: `1px solid ${srcColor}25`, flexShrink: 0, fontFamily: "var(--font-code, monospace)", minWidth: 72, textAlign: "center" }}>{s.source}</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    {s.url && <span style={{ fontSize: 9, color: "var(--color-text-muted)", flexShrink: 0, opacity: 0.5 }}>↗</span>}
                  </a>
                );
              })}
            </div>
          </div>

          {/* ── SECTION 3: Quellen-Status ──────────────────────────────── */}
          <div style={{ padding: "8px 24px 8px", borderTop: "1px solid rgba(0,0,0,0.04)", marginTop: 4 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", marginRight: 4 }}>{de ? "Quellen" : "Sources"}</span>
              {data.sourceStatus.map(s => {
                const dot = s.status === "fresh" ? "var(--signal-positive, #1A9E5A)" : s.status === "stale" ? "#F5A623" : "#D1D5DB";
                return (
                  <span key={s.source} title={`${s.signalCount} signals · last: ${s.lastSignalAt ?? "never"}`}
                    style={{ fontSize: 9, display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 4, background: "rgba(0,0,0,0.02)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                    <span style={{ color: "var(--color-text-muted)" }}>{s.source}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Hover Tooltip for Trend Card ───────────────────────────────── */}
      {hoveredTrend && (() => {
        const t = hoveredTrend;
        const ring = RING_CFG[t.ring] ?? RING_CFG.hold;
        const vel = VELOCITY_CFG[t.velocity];
        return (
          <div style={{
            position: "fixed",
            left: Math.min(tooltipPos.x, typeof window !== "undefined" ? window.innerWidth - 290 : 500),
            bottom: typeof window !== "undefined" ? window.innerHeight - tooltipPos.y + 8 : 100,
            zIndex: 50, width: 270, background: "var(--volt-surface, #fff)", border: `1px solid ${ring.border}`,
            borderLeft: `3px solid ${ring.color}`, borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)", padding: "12px 14px", pointerEvents: "none",
          }}>
            {/* Name + Type */}
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--volt-text, #0F172A)", lineHeight: 1.3 }}>{t.name}</span>
              <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: t.trendType === "megatrend" ? "#FFF5BA" : "var(--color-surface-2, #F3F4F6)", color: t.trendType === "megatrend" ? "#7A5C00" : "var(--volt-text-muted, #6B7280)", flexShrink: 0 }}>
                {t.trendType === "megatrend" ? "MEGA" : "MAKRO"}
              </span>
            </div>
            {/* Description */}
            {t.description && <div style={{ fontSize: 11, color: "var(--volt-text-muted, #475569)", lineHeight: 1.5, marginBottom: 10 }}>{t.description}</div>}
            {/* Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 10 }}>
              <div><div style={{ fontSize: 9, color: "var(--volt-text-faint, #94A3B8)", marginBottom: 2 }}>{de ? "Relevanz" : "Relevance"}</div><MetricBar value={t.relevance} color="#4F46E5" /></div>
              <div><div style={{ fontSize: 9, color: "var(--volt-text-faint, #94A3B8)", marginBottom: 2 }}>Impact</div><MetricBar value={t.impact} color="#059669" /></div>
              <div><div style={{ fontSize: 9, color: "var(--volt-text-faint, #94A3B8)", marginBottom: 2 }}>{de ? "Konfidenz" : "Confidence"}</div><MetricBar value={t.confidence} color="#D97706" /></div>
              <div><div style={{ fontSize: 9, color: "var(--volt-text-faint, #94A3B8)", marginBottom: 2 }}>{de ? "Signale" : "Signals"}</div><div style={{ fontSize: 12, fontWeight: 600, color: "var(--volt-text, #1E293B)" }}>{t.signalCount72h}</div></div>
            </div>
            {/* Ring + Velocity + Sparkline */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: ring.bg, color: ring.color }}>{t.ring}</span>
              <span style={{ fontSize: 11, color: vel.color }}>{vel.symbol} {vel.label[de ? "de" : "en"]}</span>
              <div style={{ marginLeft: "auto" }}><MiniSparkline data={t.sparkline} width={56} height={16} color={vel.color} /></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
