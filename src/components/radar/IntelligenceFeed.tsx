"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendDot, RING_COLORS } from "@/types";
import { Locale } from "@/lib/i18n";

interface FeedSignal {
  id: string;
  source: string;
  title: string;
  topic: string;
  trendName?: string;
  strength: number;
  type: "spike" | "mention" | "alert" | "prediction";
  timestamp: Date;
  meta?: { relevance?: number; impact?: number; confidence?: number; ring?: string; velocity?: string; signalCount?: number };
}

interface IntelligenceFeedProps {
  trends: TrendDot[];
  locale: Locale;
  onTrendClick: (trend: TrendDot) => void;
}

const RING_PASTEL: Record<string, { color: string; background: string }> = {
  adopt:  { color: "#0F6038", background: "#C3F4D3" }, // pastel-mint
  trial:  { color: "#1A4A8A", background: "#D4E8FF" }, // pastel-blue
  assess: { color: "#7A5C00", background: "#FFF5BA" }, // pastel-butter
  hold:   { color: "#3A4560", background: "#F0F2F7" }, // signal-neutral-light
};

const TYPE_CFG = {
  spike:      { color: "#E8402A", bg: "#FDEEE9", border: "#F4A090", icon: "▲" }, // Grain Koralle (signal-negative)
  alert:      { color: "#7A5C00", bg: "#FFF5BA", border: "#E0C840", icon: "●" }, // Grain Butter (pastel-butter)
  prediction: { color: "#7C1A9E", bg: "#FDE2FF", border: "#D4A0F0", icon: "◆" }, // Grain Orchid (pastel-orchid)
  mention:    { color: "#1A4A8A", bg: "#D4E8FF", border: "#80B8F0", icon: "→" }, // Grain Blue (pastel-blue)
};

export default function IntelligenceFeed({ trends, locale, onTrendClick }: IntelligenceFeedProps) {
  const [signals, setSignals] = useState<FeedSignal[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ signal: FeedSignal; x: number; y: number } | null>(null);

  const de = locale === "de";

  const generateLocalFeed = useCallback(() => {
    const feed: FeedSignal[] = [];
    const now = new Date();

    for (const t of trends) {
      if (t.velocity === "rising" && t.relevance > 0.85) {
        feed.push({ id: `r-${t.id}`, source: "sis", trendName: t.name,
          title: `${(t.relevance * 100).toFixed(0)}% · ${t.signalCount} signals`,
          topic: t.category, strength: t.relevance, type: "spike",
          timestamp: new Date(now.getTime() - Math.random() * 1800000),
          meta: { relevance: t.relevance, impact: t.impact, confidence: t.confidence, ring: t.ring, velocity: t.velocity, signalCount: t.signalCount },
        });
      }
      if (t.ring === "adopt" && t.impact > 0.88 && !(t.velocity === "rising" && t.relevance > 0.85)) {
        feed.push({ id: `a-${t.id}`, source: "sis", trendName: t.name,
          title: `Impact ${(t.impact * 100).toFixed(0)}% · Conf ${(t.confidence * 100).toFixed(0)}%`,
          topic: t.category, strength: t.impact, type: "alert",
          timestamp: new Date(now.getTime() - Math.random() * 3600000),
          meta: { relevance: t.relevance, impact: t.impact, confidence: t.confidence, ring: t.ring, velocity: t.velocity, signalCount: t.signalCount },
        });
      }
      if ((t.ring === "assess" || t.ring === "hold") && t.impact > 0.8 && t.velocity === "rising") {
        feed.push({ id: `w-${t.id}`, source: "sis", trendName: t.name,
          title: `${t.ring} · ${de ? "steigend" : "rising"} · ${(t.impact * 100).toFixed(0)}% impact`,
          topic: t.category, strength: t.impact * 0.7, type: "mention",
          timestamp: new Date(now.getTime() - Math.random() * 7200000),
          meta: { relevance: t.relevance, impact: t.impact, confidence: t.confidence, ring: t.ring, velocity: t.velocity, signalCount: t.signalCount },
        });
      }
    }

    // Patterns
    const risingByCategory: Record<string, number> = {};
    for (const t of trends) { if (t.velocity === "rising") risingByCategory[t.category] = (risingByCategory[t.category] || 0) + 1; }
    for (const [cat, count] of Object.entries(risingByCategory)) {
      if (count >= 3) {
        feed.push({ id: `p-${cat}`, source: "sis",
          title: `${count} ${de ? "steigende Trends" : "rising trends"}`,
          topic: cat, strength: Math.min(1, count / 5), type: "alert",
          timestamp: new Date(now.getTime() - Math.random() * 2700000),
        });
      }
    }

    feed.sort((a, b) => {
      const o = { spike: 0, alert: 1, prediction: 2, mention: 3 };
      const d = (o[a.type] || 3) - (o[b.type] || 3);
      return d !== 0 ? d : b.strength - a.strength;
    });

    setSignals(feed.slice(0, 30));
    setLastUpdate(now);
  }, [trends, de]);

  useEffect(() => { generateLocalFeed(); }, [generateLocalFeed]);

  const filtered = filter ? signals.filter((s) => s.type === filter) : signals;
  const spikes = signals.filter((s) => s.type === "spike").length;
  const alerts = signals.filter((s) => s.type === "alert").length;
  const mentions = signals.filter((s) => s.type === "mention").length;

  // Split into columns
  const colCount = 3;
  const columns: FeedSignal[][] = Array.from({ length: colCount }, () => []);
  filtered.forEach((s, i) => columns[i % colCount].push(s));

  return (
    <div className="border-t border-[#E8E8E8] bg-[#FAFAFA]">
      {/* Header */}
      <div className="px-6 py-3 flex items-center gap-3">
        <button onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors">
          <span className={`transition-transform duration-200 text-[10px] ${collapsed ? "" : "rotate-90"}`}>▸</span>
          <span className="text-xs uppercase tracking-wider font-semibold">Intelligence Feed</span>
        </button>

        {/* Filter pills */}
        <div className="flex items-center gap-1">
          <button onClick={() => setFilter(null)}
            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${!filter ? "bg-[#0A0A0A] text-white" : "text-[#9B9B9B] hover:text-[#6B6B6B] hover:bg-[#F0F0F0]"}`}>
            {de ? "Alle" : "All"} {signals.length}
          </button>
          {spikes > 0 && (
            <button onClick={() => setFilter(filter === "spike" ? null : "spike")}
              className={`px-2 py-0.5 rounded-full text-xs transition-colors ${filter === "spike" ? "bg-[#FDEEE9] text-[#E8402A]" : "text-[#E8402A]/60 hover:bg-[#FDEEE9]"}`}>
              ▲ {spikes}
            </button>
          )}
          {alerts > 0 && (
            <button onClick={() => setFilter(filter === "alert" ? null : "alert")}
              className={`px-2 py-0.5 rounded-full text-xs transition-colors ${filter === "alert" ? "bg-[#FFF5BA] text-[#7A5C00]" : "text-[#7A5C00]/60 hover:bg-[#FFF5BA]"}`}>
              ● {alerts}
            </button>
          )}
          {mentions > 0 && (
            <button onClick={() => setFilter(filter === "mention" ? null : "mention")}
              className={`px-2 py-0.5 rounded-full text-xs transition-colors ${filter === "mention" ? "bg-[#D4E8FF] text-[#1A4A8A]" : "text-[#1A4A8A]/60 hover:bg-[#D4E8FF]"}`}>
              → {mentions}
            </button>
          )}
        </div>

        <span className="ml-auto text-[#B0B0B0] text-[10px] hidden sm:block select-none">
          {de ? "Hover für Details · Klicken für Analyse" : "Hover for details · Click for analysis"}
        </span>
        <span className="text-[#C8C8C8] text-xs">
          {lastUpdate ? (de ? `aktualisiert ${timeAgo(lastUpdate, de)}` : `updated ${timeAgo(lastUpdate, de)}`) : ""}
        </span>
        <button onClick={generateLocalFeed} className="text-[#C8C8C8] hover:text-[#0A0A0A] transition-colors text-sm" title="Refresh">↻</button>
      </div>

      {/* Multi-column feed */}
      {!collapsed && (
        <div className="px-6 pb-4 max-h-[220px] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
            {columns.map((col, ci) => (
              <div key={ci} className="space-y-1">
                {col.map((signal) => {
                  const cfg = TYPE_CFG[signal.type] || TYPE_CFG.mention;
                  return (
                    <div key={signal.id}
                      onClick={() => {
                        if (signal.trendName) {
                          const t = trends.find(tr => tr.name === signal.trendName);
                          if (t) onTrendClick(t);
                        }
                      }}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setTooltip({ signal, x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg group hover:shadow-sm transition-all"
                      style={{
                        background: cfg.bg,
                        borderLeft: `3px solid ${cfg.border}`,
                        cursor: signal.trendName ? "pointer" : "default",
                      }}>
                      {/* Icon */}
                      <span className="text-[10px] w-3 text-center shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#1A1A1A] font-medium truncate">
                            {signal.trendName || signal.topic}
                          </span>
                          {signal.meta?.ring && (
                            <span className="text-[9px] px-1 py-0.5 rounded-full font-semibold shrink-0" style={{
                              ...RING_PASTEL[signal.meta.ring as keyof typeof RING_PASTEL] || { color: "#6B7A9A", background: "#F0F2F7" },
                            }}>{signal.meta.ring}</span>
                          )}
                          {signal.meta?.velocity === "rising" && <span className="text-[10px] shrink-0" style={{ color: "#1A9E5A" }}>▲</span>}
                        </div>
                        <div className="text-[10px] truncate text-[#6B6B6B]">{signal.title}</div>
                      </div>
                      {/* Strength mini-bar */}
                      <div className="w-8 h-1.5 bg-white/60 rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${signal.strength * 100}%`, background: cfg.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {tooltip && (() => {
        const { signal, x, y } = tooltip;
        const cfg = TYPE_CFG[signal.type] || TYPE_CFG.mention;
        const m = signal.meta;
        const de = locale === "de";
        const typeLabel = {
          spike: de ? "Starkes Momentum" : "Strong Momentum",
          alert: de ? "Hoher Impact" : "High Impact",
          prediction: de ? "Markt-Signal" : "Market Signal",
          mention: de ? "Im Aufwind" : "Rising Signal",
        }[signal.type];

        // Position: above the item, aligned left
        const tooltipY = y - 8;
        const tooltipX = Math.min(x, window.innerWidth - 280);
        const fullTrend = signal.trendName ? trends.find(t => t.name === signal.trendName) : null;

        return (
          <div
            onMouseEnter={() => {/* keep open */}}
            onMouseLeave={() => setTooltip(null)}
            style={{
              position: "fixed",
              left: tooltipX,
              top: tooltipY,
              transform: "translateY(-100%)",
              zIndex: 50,
              width: 260,
              background: "#fff",
              border: `1px solid ${cfg.border}`,
              borderLeft: `3px solid ${cfg.color}`,
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              padding: "12px 14px",
              pointerEvents: "none",
            }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", lineHeight: 1.4 }}>
                {signal.trendName || signal.topic}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: cfg.bg, color: cfg.color, flexShrink: 0, whiteSpace: "nowrap" }}>
                {cfg.icon} {typeLabel}
              </span>
            </div>

            {/* Description — the one sentence that matters */}
            {fullTrend?.description && (
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, marginBottom: 10 }}>
                {fullTrend.description}
              </div>
            )}

            {/* Metrics grid */}
            {m && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 10 }}>
                {m.relevance != null && (
                  <MetricRow label={de ? "Relevanz" : "Relevance"} value={m.relevance} color="#4F46E5" />
                )}
                {m.impact != null && (
                  <MetricRow label={de ? "Impact" : "Impact"} value={m.impact} color="#059669" />
                )}
                {m.confidence != null && (
                  <MetricRow label={de ? "Vertrauen" : "Confidence"} value={m.confidence} color="#D97706" />
                )}
                {m.signalCount != null && (
                  <div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>{de ? "Signale" : "Signals"}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{m.signalCount.toLocaleString()}</div>
                  </div>
                )}
              </div>
            )}

            {/* Ring + Velocity */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {m?.ring && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  background: RING_PASTEL[m.ring]?.background || "#F0F2F7",
                  color: RING_PASTEL[m.ring]?.color || "#3A4560",
                }}>
                  {m.ring}
                </span>
              )}
              {m?.velocity && (
                <span style={{ fontSize: 11, color: m.velocity === "rising" ? "#059669" : m.velocity === "falling" ? "#DC2626" : "#94A3B8" }}>
                  {m.velocity === "rising" ? "↑ " : m.velocity === "falling" ? "↓ " : "→ "}
                  {de ? (m.velocity === "rising" ? "steigend" : m.velocity === "falling" ? "fallend" : "stabil") :
                         (m.velocity === "rising" ? "rising" : m.velocity === "falling" ? "falling" : "stable")}
                </span>
              )}
            </div>

            {signal.trendName && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #F1F5F9", fontSize: 11, color: "#94A3B8" }}>
                {de ? "Klicken für vollständige Analyse →" : "Click for full analysis →"}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "#F1F5F9" }}>
          <div style={{ height: 3, borderRadius: 2, background: color, width: `${value * 100}%` }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#1E293B", flexShrink: 0 }}>{(value * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function timeAgo(date: Date, de: boolean): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return de ? "jetzt" : "now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}
