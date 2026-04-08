"use client";

/**
 * LiveSignalStream — Raw signal feed for the Knowledge Cockpit "Signale" tab.
 *
 * Replaces the old TrendOverview grid that duplicated the Radar sidebar. This
 * component shows the ACTUAL raw signals streaming in from /api/v1/feed/ticker
 * — Hacker News posts, arXiv preprints, GDELT events, etc. — not aggregated
 * trend cards.
 *
 * Layout:
 *   [Filter row: Source filter · Topic filter · Time window · Sort]
 *   [Signal list: one row per signal]
 *     Each row: Source chip · Time ago · Title (link) · Topic badge
 *
 * Click behaviors:
 *   — Title → opens the original URL in a new tab
 *   — Topic badge → calls onTrendClick(topic) which jumps to the Radar tab
 *     and highlights the matched trend
 *
 * Auto-refreshes every 2 minutes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { TrendDot } from "@/types";

interface RawSignal {
  id: string;
  source: string;
  title: string;
  url: string | null;
  topic: string | null;
  strength: number;
  hoursAgo: number;
}

interface Props {
  trends: TrendDot[];
  de: boolean;
  onTrendClick: (trendName: string) => void;
}

// Source → brand-ish dot color (matches SignalTicker at the bottom of the app)
const SOURCE_COLORS: Record<string, string> = {
  hackernews: "#FF6600",
  github: "#333333",
  reddit: "#FF5700",
  arxiv: "#B31B1B",
  gdelt: "#1A4A8A",
  polymarket: "#6366F1",
  guardian: "#052962",
  nyt: "#111111",
  newsdata: "#0EA5E9",
  rss: "#9333EA",
  twitter: "#1DA1F2",
  bloomberg: "#FF6B00",
  reuters: "#FF7A00",
  ft: "#FFB08A",
  wsj: "#C8102E",
  noaa: "#1E88E5",
  worldbank: "#00A651",
  unctad: "#009EDB",
};

function sourceColor(source: string): string {
  return SOURCE_COLORS[source?.toLowerCase?.() ?? ""] ?? "#6B7A9A";
}

function ageLabel(h: number, de: boolean): string {
  if (h < 1) return de ? "<1 Std" : "<1h";
  if (h < 24) return de ? `vor ${Math.round(h)} Std` : `${Math.round(h)}h ago`;
  const days = Math.round(h / 24);
  return de ? `vor ${days} Tg` : `${days}d ago`;
}

// "mixed" is the default — preserves the server-side round-robin interleave
// from /api/v1/feed/ticker so the feed opens with a diverse cross-source mix
// instead of whichever source happened to fetch last. "newest" and
// "strongest" are explicit user-requested re-sorts.
type SortKey = "mixed" | "newest" | "strongest";

const TIME_WINDOWS = [
  { key: "6",  labelDe: "6 Stunden",  labelEn: "6 hours",  hours: 6 },
  { key: "24", labelDe: "24 Stunden", labelEn: "24 hours", hours: 24 },
  { key: "48", labelDe: "48 Stunden", labelEn: "48 hours", hours: 48 },
  { key: "168", labelDe: "7 Tage",    labelEn: "7 days",   hours: 168 },
] as const;

type TimeWindowKey = typeof TIME_WINDOWS[number]["key"];

export default function LiveSignalStream({ trends, de, onTrendClick }: Props) {
  const [signals, setSignals] = useState<RawSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindowKey>("48");
  // Default to "mixed" — preserves the server's round-robin interleave so the
  // first thing a user sees is a diverse cross-source feed, not 10 reddits.
  const [sortKey, setSortKey] = useState<SortKey>("mixed");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    const window = TIME_WINDOWS.find(w => w.key === timeWindow)!;
    fetch(`/api/v1/feed/ticker?limit=200&hours=${window.hours}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const list = (data?.signals ?? []) as RawSignal[];
        setSignals(list);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
    refreshTimer.current = setInterval(load, 120_000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow]);

  // Derived: unique source list for the source filter (with counts)
  const sourceCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of signals) {
      map.set(s.source, (map.get(s.source) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [signals]);

  // Derived: unique topic list (with counts)
  const topicCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of signals) {
      if (s.topic && s.topic.trim()) {
        map.set(s.topic, (map.get(s.topic) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12); // show top 12 topics
  }, [signals]);

  // Filtered + sorted signals
  const displaySignals = useMemo(() => {
    const filtered = signals.filter((s) => {
      if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
      if (topicFilter !== "all" && s.topic !== topicFilter) return false;
      return true;
    });
    // "mixed" preserves the server's round-robin interleave — DO NOT sort.
    // Only "newest" and "strongest" apply a client-side re-sort.
    if (sortKey === "mixed") return filtered;
    const out = [...filtered].sort((a, b) => {
      if (sortKey === "newest") return a.hoursAgo - b.hoursAgo;
      return (b.strength ?? 0) - (a.strength ?? 0);
    });
    return out;
  }, [signals, sourceFilter, topicFilter, sortKey]);

  // Topic → trend match (for the click-through to Radar)
  const trendNameByLower = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of trends) map.set(t.name.toLowerCase(), t.name);
    return map;
  }, [trends]);

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1360, margin: "0 auto" }}>
      {/* Stats header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginBottom: 16,
      }}>
        <div style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--volt-text-faint, #999)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--signal-positive, #1A9E5A)",
            boxShadow: "0 0 6px rgba(26,158,90,0.6)",
            animation: "sis-signal-pulse 1.8s ease-in-out infinite",
          }} />
          <span style={{ color: "var(--signal-positive, #1A9E5A)" }}>LIVE</span>
        </div>
        <div style={{
          fontSize: 12,
          color: "var(--volt-text-muted, #6B6B6B)",
        }}>
          {loading
            ? (de ? "Lade Signale…" : "Loading signals…")
            : error
              ? (de ? `Fehler: ${error}` : `Error: ${error}`)
              : (
                <>
                  <strong>{displaySignals.length}</strong>{" "}
                  {de ? "Signale" : "signals"}
                  {displaySignals.length !== signals.length && (
                    <span style={{ color: "var(--volt-text-faint, #AAA)" }}>
                      {" "}({de ? `von ${signals.length}` : `of ${signals.length}`})
                    </span>
                  )}
                  <span style={{ color: "var(--volt-text-faint, #AAA)", marginLeft: 8 }}>
                    · {de ? "aktualisiert alle 2 Min" : "refreshes every 2 min"}
                  </span>
                </>
              )}
        </div>
      </div>

      {/* Filter row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto auto",
        gap: 12,
        marginBottom: 20,
        alignItems: "center",
      }}>
        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">{de ? "Alle Quellen" : "All sources"} ({signals.length})</option>
          {sourceCounts.map(([src, count]) => (
            <option key={src} value={src}>{src} ({count})</option>
          ))}
        </select>

        {/* Topic filter */}
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">{de ? "Alle Themen" : "All topics"}</option>
          {topicCounts.map(([topic, count]) => (
            <option key={topic} value={topic}>{topic} ({count})</option>
          ))}
        </select>

        {/* Time window */}
        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value as TimeWindowKey)}
          style={{ ...selectStyle, minWidth: 140 }}
        >
          {TIME_WINDOWS.map(w => (
            <option key={w.key} value={w.key}>
              {de ? w.labelDe : w.labelEn}
            </option>
          ))}
        </select>

        {/* Sort toggle */}
        <div style={{
          display: "inline-flex",
          border: "1px solid var(--volt-border, #E8E8E8)",
          borderRadius: 999,
          padding: 2,
          background: "var(--volt-surface-raised, #fff)",
        }}>
          {(["mixed", "newest", "strongest"] as SortKey[]).map((key) => {
            const active = sortKey === key;
            const label =
              key === "mixed"     ? (de ? "Gemischt"  : "Mixed")
              : key === "newest"  ? (de ? "Neueste"   : "Newest")
              :                     (de ? "Stärkste"  : "Strongest");
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                title={key === "mixed"
                  ? (de ? "Quellen-ausgewogener Mix (Round-Robin)" : "Source-balanced mix (round-robin)")
                  : undefined}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "5px 12px",
                  border: "none",
                  borderRadius: 999,
                  background: active ? "var(--volt-text, #0A0A0A)" : "transparent",
                  color: active ? "#fff" : "var(--volt-text-muted, #6B6B6B)",
                  cursor: "pointer",
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  transition: "all 120ms ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Signal list */}
      {displaySignals.length === 0 && !loading && (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          border: "1px dashed var(--volt-border, #E8E8E8)",
          borderRadius: "var(--volt-radius-md, 10px)",
          color: "var(--volt-text-muted, #6B6B6B)",
          fontSize: 13,
        }}>
          {de ? "Keine Signale für diese Filter-Kombination." : "No signals for this filter combination."}
        </div>
      )}

      {displaySignals.length > 0 && (
        <div style={{
          border: "1px solid var(--volt-border, #E8E8E8)",
          borderRadius: "var(--volt-radius-lg, 14px)",
          overflow: "hidden",
          background: "var(--volt-surface-raised, #fff)",
        }}>
          {displaySignals.map((s, idx) => {
            const color = sourceColor(s.source);
            const isLast = idx === displaySignals.length - 1;
            const matchingTrend = s.topic
              ? trendNameByLower.get(s.topic.toLowerCase())
              : undefined;
            return (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 96px 1fr auto",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: isLast ? "none" : "1px solid var(--volt-border, #EEE)",
                  alignItems: "center",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--volt-surface, #FAFAFA)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                {/* Source chip */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: color, flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {s.source}
                  </span>
                </div>

                {/* Time ago */}
                <div style={{
                  fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 10,
                  color: "var(--volt-text-faint, #A8A8A8)",
                  whiteSpace: "nowrap",
                }}>
                  {ageLabel(s.hoursAgo, de)}
                </div>

                {/* Title + topic badge */}
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: "var(--volt-text, #0A0A0A)",
                        textDecoration: "none",
                        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span style={{
                      fontSize: 13,
                      color: "var(--volt-text, #0A0A0A)",
                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                      lineHeight: 1.4,
                    }}>
                      {s.title}
                    </span>
                  )}
                  {s.topic && (
                    <button
                      type="button"
                      onClick={() => onTrendClick(s.topic!)}
                      disabled={!matchingTrend}
                      title={matchingTrend
                        ? (de ? "Im Radar anzeigen" : "Show in Radar")
                        : (de ? "Kein passender Trend im Radar" : "No matching trend in Radar")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        alignSelf: "flex-start",
                        fontSize: 10, fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: `1px solid ${matchingTrend ? "rgba(228,255,151,0.7)" : "var(--volt-border, #E8E8E8)"}`,
                        background: matchingTrend ? "rgba(228,255,151,0.3)" : "var(--volt-surface, #FAFAFA)",
                        color: matchingTrend ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-faint, #AAA)",
                        cursor: matchingTrend ? "pointer" : "default",
                        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                        transition: "all 120ms ease",
                      }}
                    >
                      {s.topic}
                      {matchingTrend && <span style={{ fontSize: 9 }}>→</span>}
                    </button>
                  )}
                </div>

                {/* Strength indicator */}
                <div style={{
                  fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 10,
                  color: "var(--volt-text-faint, #A8A8A8)",
                  textAlign: "right",
                  minWidth: 40,
                }}>
                  {s.strength > 0 ? `${Math.round(s.strength * 100)}` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes sis-signal-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "8px 32px 8px 12px",
  border: "1px solid var(--volt-border, #E8E8E8)",
  borderRadius: "var(--volt-radius-md, 10px)",
  background: "var(--volt-surface-raised, #fff)",
  color: "var(--volt-text, #0A0A0A)",
  cursor: "pointer",
  outline: "none",
  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B6B6B\' stroke-width=\'2\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  backgroundSize: "12px",
};
