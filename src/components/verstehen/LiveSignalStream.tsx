"use client";

// TODO: UX-14 — Technical error messages shown to users (SQLITE_CONSTRAINT, TypeError...).
// FIX: Map error codes to user-friendly German messages with actionable guidance.

/**
 * LiveSignalStream — Raw signal feed for the Knowledge Cockpit "Signale" tab.
 *
 * Renders the live signals streaming in from /api/v1/feed/ticker as a
 * responsive card grid with Open-Graph image previews fetched on demand
 * via /api/v1/og-image (SQLite-cached, 7-day TTL on success).
 *
 * Card anatomy:
 *   [────────  16:9 image or source-colour gradient placeholder  ────────]
 *   [ SOURCE · 2h ago                                        95 strength ]
 *   [ Title (3-line clamp, links to source URL in new tab)               ]
 *   [ Topic-Badge → Radar                                                ]
 *
 * Image loading strategy:
 *   - IntersectionObserver watches each card; only cards that enter the
 *     viewport fire the OG-image fetch (avoid 200 network calls on mount)
 *   - /api/v1/og-image returns cached results from SQLite on hit, so a
 *     second visit to the tab is effectively instant
 *   - Failed lookups or signals without a URL fall through to the
 *     source-coloured gradient placeholder
 *
 * Signals from /api/v1/feed/ticker arrive in a source-balanced round-
 * robin order (SQL window function); the default "Gemischt" sort mode
 * preserves that interleave.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { TrendDot } from "@/types";
import {
  VoltAccordion,
  VoltAccordionItem,
  VoltAccordionTrigger,
  VoltAccordionContent,
} from "@/components/volt/VoltAccordion";

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

// Cache og-image lookups per render session so switching filters
// doesn't re-request the same URLs. The endpoint also caches in SQLite,
// but this saves the round-trip entirely.
type OgCacheState = "pending" | "ok" | "fail";
interface OgCacheEntry { state: OgCacheState; imageUrl: string | null }

export default function LiveSignalStream({ trends, de, onTrendClick }: Props) {
  const [signals, setSignals] = useState<RawSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindowKey>("168");
  // Default to "mixed" — preserves the server's round-robin interleave so the
  // first thing a user sees is a diverse cross-source feed, not 10 reddits.
  const [sortKey, setSortKey] = useState<SortKey>("mixed");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-URL og-image cache (session scope). Key = signal URL. Re-render
  // target: we want cards to re-render when their entry flips from
  // "pending" to "ok"/"fail", hence a map held in state.
  const [ogMap, setOgMap] = useState<Map<string, OgCacheEntry>>(new Map());
  // Imperative mirror so event handlers (IO callback, fetch .then) can
  // check "have we already asked for this URL?" without closure staleness.
  const ogMapRef = useRef(ogMap);
  ogMapRef.current = ogMap;

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

  // View mode: "evidenz" groups signals by trend, "feed" shows flat card grid
  type ViewMode = "evidenz" | "feed";
  const [viewMode, setViewMode] = useState<ViewMode>("evidenz");

  // Group signals by their matching trend (for evidence view)
  const groupedByTrend = useMemo(() => {
    if (viewMode !== "evidenz") return [];
    const groups = new Map<string, { trend: TrendDot | null; signals: RawSignal[] }>();
    for (const signal of displaySignals) {
      const trendName = signal.topic
        ? trendNameByLower.get(signal.topic.toLowerCase())
        : undefined;
      const key = trendName?.toLowerCase() ?? "__unmatched__";
      if (!groups.has(key)) {
        const matchedTrend = trendName
          ? trends.find(t => t.name.toLowerCase() === key) ?? null
          : null;
        groups.set(key, { trend: matchedTrend, signals: [] });
      }
      groups.get(key)!.signals.push(signal);
    }
    return Array.from(groups.entries())
      .sort(([keyA, a], [keyB, b]) => {
        if (keyA === "__unmatched__") return 1;
        if (keyB === "__unmatched__") return -1;
        return b.signals.length - a.signals.length;
      });
  }, [viewMode, displaySignals, trendNameByLower, trends]);

  // Above-the-fold priority load: after displaySignals changes, kick off
  // og-image fetches for the first 12 entries immediately. Two reasons:
  //   1) Guarantees visible cards show real previews without waiting for
  //      IntersectionObserver — which some automated/headless contexts
  //      never fire at all.
  //   2) Parallelises the most-important fetches; the endpoint is
  //      SQLite-cached so subsequent visits are effectively free.
  // The rest of the grid is still lazy-loaded via IO (see SignalCard).
  const PRIORITY_COUNT = 12;

  /**
   * Fires an og-image lookup for a single URL if not already cached/
   * in-flight. Writes the result back into ogMap state so the
   * corresponding card re-renders.
   */
  const requestOgImage = useCallback(async (url: string) => {
    if (ogMapRef.current.has(url)) return;
    // Reserve the slot first so rapid IO bursts don't double-fetch.
    setOgMap((prev) => {
      if (prev.has(url)) return prev;
      const next = new Map(prev);
      next.set(url, { state: "pending", imageUrl: null });
      return next;
    });

    try {
      const res = await fetch(`/api/v1/og-image?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { imageUrl: string | null; status: string };
      const ok = data.status === "ok" && data.imageUrl;
      setOgMap((prev) => {
        const next = new Map(prev);
        next.set(url, {
          state: ok ? "ok" : "fail",
          imageUrl: ok ? data.imageUrl : null,
        });
        return next;
      });
    } catch {
      setOgMap((prev) => {
        const next = new Map(prev);
        next.set(url, { state: "fail", imageUrl: null });
        return next;
      });
    }
  }, []);

  // Priority-load the first N visible signals' OG images. Runs whenever
  // the filtered/sorted list changes — if the user flips filters and a
  // fresh set of top cards appears, those get a proactive fetch too.
  useEffect(() => {
    const urls = displaySignals
      .slice(0, PRIORITY_COUNT)
      .map((s) => s.url)
      .filter((u): u is string => !!u);
    for (const u of urls) requestOgImage(u);
  }, [displaySignals, requestOgImage]);

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
        gridTemplateColumns: "1fr 1fr auto auto auto",
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
                  color: active ? "var(--background, #fff)" : "var(--volt-text-muted, #6B6B6B)",
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

        {/* View mode toggle */}
        <div style={{
          display: "inline-flex",
          border: "1px solid var(--volt-border, #E8E8E8)",
          borderRadius: 999,
          padding: 2,
          background: "var(--volt-surface-raised, #fff)",
        }}>
          {(["evidenz", "feed"] as ViewMode[]).map((key) => {
            const active = viewMode === key;
            const label = key === "evidenz"
              ? (de ? "Evidenz" : "Evidence")
              : (de ? "Feed" : "Feed");
            return (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "5px 12px",
                  border: "none",
                  borderRadius: 999,
                  background: active ? "var(--volt-text, #0A0A0A)" : "transparent",
                  color: active ? "var(--background, #fff)" : "var(--volt-text-muted, #6B6B6B)",
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

      {/* Empty state */}
      {displaySignals.length === 0 && !loading && (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          border: "1px dashed var(--volt-border, #E8E8E8)",
          borderRadius: "var(--volt-radius-md, 10px)",
          color: "var(--volt-text-muted, #6B6B6B)",
          fontSize: 13,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <span>{de ? "Keine Signale für diese Filter-Kombination." : "No signals for this filter combination."}</span>
          {timeWindow !== "168" && (
            <button
              type="button"
              onClick={() => setTimeWindow("168")}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid var(--volt-border, #E8E8E8)",
                background: "var(--volt-surface-raised, #fff)",
                color: "var(--volt-text, #0A0A0A)",
                cursor: "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              }}
            >
              {de ? "Zeitfenster auf 7 Tage erweitern →" : "Expand to 7 days →"}
            </button>
          )}
          {timeWindow === "168" && signals.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--volt-text-faint, #AAA)" }}>
              {de
                ? "Es wurden noch keine Konnektoren ausgeführt. Starte einen Connector-Lauf, um Live-Signale zu sehen."
                : "No connectors have been run yet. Start a connector run to see live signals."}
            </span>
          )}
        </div>
      )}

      {/* ── Evidence view (grouped by trend) ─────────────────────── */}
      {viewMode === "evidenz" && displaySignals.length > 0 && (
        <VoltAccordion
          type="multiple"
          defaultValue={groupedByTrend.slice(0, 3).map(([key]) => key)}
          style={{
            border: "1px solid var(--color-border, #E8E8E8)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--card, #fff)",
          }}
        >
          {groupedByTrend.map(([key, { trend, signals: groupSignals }]) => {
            const isUnmatched = key === "__unmatched__";
            // Source breakdown for this group
            const srcBreakdown = new Map<string, number>();
            for (const s of groupSignals) srcBreakdown.set(s.source, (srcBreakdown.get(s.source) ?? 0) + 1);
            const srcEntries = Array.from(srcBreakdown.entries()).sort((a, b) => b[1] - a[1]);

            return (
              <VoltAccordionItem key={key} value={key} className="border-b border-[var(--color-border,#E8E8E8)] last:border-b-0">
                <VoltAccordionTrigger className="hover:no-underline px-4 gap-3">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                    {/* Row 1: Ring + Name + Velocity + Count */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {trend && !isUnmatched && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          padding: "2px 8px", borderRadius: 999,
                          background: RING_BG[trend.ring] ?? "#F5F5F5",
                          color: RING_TEXT[trend.ring] ?? "#666",
                          fontFamily: "var(--font-mono)",
                          whiteSpace: "nowrap",
                        }}>
                          {trend.ring}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (trend) onTrendClick(trend.name);
                        }}
                        disabled={!trend}
                        style={{
                          fontSize: 14, fontWeight: 700, color: "var(--foreground)",
                          fontFamily: "var(--font-display)",
                          background: "none", border: "none", padding: 0, cursor: trend ? "pointer" : "default",
                          textAlign: "left",
                        }}
                      >
                        {isUnmatched
                          ? (de ? "Unzugeordnete Signale" : "Unmatched Signals")
                          : (trend?.name ?? key)}
                      </button>
                      {trend && trend.velocity !== "stable" && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: trend.velocity === "rising" ? "var(--signal-positive, #1A9E5A)" : "var(--signal-negative, #E53935)",
                        }}>
                          {trend.velocity === "rising" ? "▲" : "▼"}
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: "var(--muted-foreground)",
                        marginLeft: "auto",
                        whiteSpace: "nowrap",
                      }}>
                        {groupSignals.length} {de ? "Signale" : "signals"}
                      </span>
                    </div>

                    {/* Row 2: Score bars + Source dots */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {trend && !isUnmatched && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MiniScore label="R" value={trend.relevance} />
                          <MiniScore label="C" value={trend.confidence} />
                          <MiniScore label="I" value={trend.impact} />
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {srcEntries.slice(0, 6).map(([src, count]) => (
                          <span key={src} style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            fontSize: 10, color: "var(--muted-foreground)",
                            fontFamily: "var(--font-mono)",
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: "50%",
                              background: sourceColor(src), flexShrink: 0,
                            }} />
                            {count}
                          </span>
                        ))}
                        {srcEntries.length > 6 && (
                          <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                            +{srcEntries.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </VoltAccordionTrigger>

                <VoltAccordionContent className="px-4">
                  <div style={{
                    display: "flex", flexDirection: "column",
                    borderTop: "1px solid var(--color-border, #E8E8E8)",
                  }}>
                    {groupSignals.map((s) => (
                      <EvidenceSignalRow key={s.id} signal={s} de={de} />
                    ))}
                  </div>
                </VoltAccordionContent>
              </VoltAccordionItem>
            );
          })}
        </VoltAccordion>
      )}

      {/* ── Feed view (flat card grid) ─────────────────────────── */}
      {viewMode === "feed" && displaySignals.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {displaySignals.map((s) => {
            const color = sourceColor(s.source);
            const matchingTrend = s.topic
              ? trendNameByLower.get(s.topic.toLowerCase())
              : undefined;
            const og = s.url ? ogMap.get(s.url) : undefined;
            return (
              <SignalCard
                key={s.id}
                signal={s}
                color={color}
                ageText={ageLabel(s.hoursAgo, de)}
                og={og}
                onVisible={() => {
                  if (s.url) requestOgImage(s.url);
                }}
                onTopicClick={() => {
                  if (s.topic) onTrendClick(s.topic);
                }}
                topicHasTrend={!!matchingTrend}
                de={de}
              />
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

// ─── Signal Card ─────────────────────────────────────────────────────────
interface SignalCardProps {
  signal: RawSignal;
  color: string;
  ageText: string;
  og: OgCacheEntry | undefined;
  onVisible: () => void;
  onTopicClick: () => void;
  topicHasTrend: boolean;
  de: boolean;
}

function SignalCard({
  signal: s,
  color,
  ageText,
  og,
  onVisible,
  onTopicClick,
  topicHasTrend,
  de,
}: SignalCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver → only fetch the OG image once this card
  // actually enters the viewport. The observer disconnects after the
  // first trigger because we never need to re-fetch.
  useEffect(() => {
    if (!s.url) return;
    const el = cardRef.current;
    if (!el) return;
    if (og) return; // already cached / in-flight

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onVisible();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }, // start fetching slightly before card enters viewport
    );
    io.observe(el);
    return () => io.disconnect();
  }, [s.url, og, onVisible]);

  const hasImage = og?.state === "ok" && !!og.imageUrl;
  const showPlaceholder = !hasImage;

  return (
    <div
      ref={cardRef}
      className="sis-signal-card"
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--volt-border, #E8E8E8)",
        borderRadius: "var(--volt-radius-lg, 14px)",
        overflow: "hidden",
        background: "var(--volt-surface-raised, #fff)",
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
        cursor: s.url ? "pointer" : "default",
      }}
      onClick={(e) => {
        if (!s.url) return;
        // Ignore clicks that originated on interactive children (topic button)
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        window.open(s.url, "_blank", "noopener,noreferrer");
      }}
    >
      {/* Image / placeholder — 16:9 aspect ratio */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          background: showPlaceholder
            ? `linear-gradient(135deg, ${color}22 0%, ${color}11 50%, var(--volt-surface, #FAFAFA) 100%)`
            : "var(--volt-surface, #FAFAFA)",
          overflow: "hidden",
          borderBottom: "1px solid var(--volt-border, #EEE)",
        }}
      >
        {hasImage && og?.imageUrl && (
          <img
            src={og.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              // Hide the <img> on network-level failures so the
              // placeholder gradient shows through. We can't retroactively
              // update ogMap from here without a callback chain, but
              // swapping display is enough for visual fallback.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        {showPlaceholder && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: `${color}`,
              opacity: 0.45,
              textTransform: "uppercase",
            }}
          >
            {s.source.slice(0, 3)}
          </div>
        )}
        {/* Strength pill (top-right on the image) */}
        {s.strength > 0 && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(10,10,10,0.78)",
              color: "var(--background, #fff)",
              padding: "3px 8px",
              borderRadius: 999,
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              backdropFilter: "blur(4px)",
            }}
          >
            {Math.round(s.strength * 100)}
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 16px 16px",
          flex: 1,
        }}
      >
        {/* Source + time row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {s.source}
          </span>
          <span
            style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              color: "var(--volt-text-faint, #A8A8A8)",
              marginLeft: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {ageText}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.35,
            color: "var(--volt-text, #0A0A0A)",
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            flex: 1,
          }}
        >
          {s.title}
        </div>

        {/* Topic badge (pinned to bottom) */}
        {s.topic && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTopicClick();
            }}
            disabled={!topicHasTrend}
            title={topicHasTrend
              ? (de ? "Im Radar anzeigen" : "Show in Radar")
              : (de ? "Kein passender Trend im Radar" : "No matching trend in Radar")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              alignSelf: "flex-start",
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              border: `1px solid ${topicHasTrend ? "rgba(228,255,151,0.7)" : "var(--volt-border, #E8E8E8)"}`,
              background: topicHasTrend ? "rgba(228,255,151,0.3)" : "var(--volt-surface, #FAFAFA)",
              color: topicHasTrend ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-faint, #AAA)",
              cursor: topicHasTrend ? "pointer" : "default",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              transition: "all 120ms ease",
              marginTop: "auto",
            }}
          >
            {s.topic}
            {topicHasTrend && <span style={{ fontSize: 9 }}>→</span>}
          </button>
        )}
      </div>

      <style jsx>{`
        .sis-signal-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -12px rgba(10, 10, 10, 0.18);
          border-color: var(--volt-border-strong, #D0D0D0);
        }
      `}</style>
    </div>
  );
}

// ─── Evidence Signal Row (compact, inside accordion) ───────────────────
function EvidenceSignalRow({ signal: s, de }: { signal: RawSignal; de: boolean }) {
  const color = sourceColor(s.source);
  return (
    <a
      href={s.url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid var(--color-border, #F0F0F0)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 100ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--volt-surface, #FAFAFA)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Source + age */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        minWidth: 130, flexShrink: 0,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: color, flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.04em",
          color, whiteSpace: "nowrap",
        }}>
          {s.source}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: "var(--muted-foreground)", whiteSpace: "nowrap",
        }}>
          · {ageLabel(s.hoursAgo, de)}
        </span>
      </div>

      {/* Title */}
      <span style={{
        fontSize: 12, fontWeight: 500, lineHeight: 1.3,
        color: "var(--foreground)",
        fontFamily: "var(--font-ui)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {s.title}
      </span>

      {/* Strength pill */}
      {s.strength > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700,
          fontFamily: "var(--font-mono)",
          padding: "2px 6px", borderRadius: 999,
          background: `rgba(${s.strength > 0.7 ? "26,158,90" : s.strength > 0.4 ? "122,92,0" : "107,122,154"},0.12)`,
          color: s.strength > 0.7 ? "var(--signal-positive, #1A9E5A)" : s.strength > 0.4 ? "#7A5C00" : "var(--muted-foreground)",
          whiteSpace: "nowrap",
        }}>
          {Math.round(s.strength * 100)}
        </span>
      )}
    </a>
  );
}

// ─── Mini Score Bar (inline in evidence group header) ──────────────────
function MiniScore({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 3,
    }}>
      <span style={{
        fontSize: 8, fontWeight: 700, color: "var(--muted-foreground)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
      }}>{label}</span>
      <div style={{
        width: 32, height: 3, borderRadius: 2,
        background: "var(--color-border, #E8E8E8)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 2,
          background: pct > 70 ? "var(--signal-positive, #1A9E5A)" : pct > 40 ? "#C4A21B" : "var(--muted-foreground)",
        }} />
      </div>
      <span style={{
        fontSize: 8, fontWeight: 600, color: "var(--muted-foreground)",
        fontFamily: "var(--font-mono)",
      }}>{pct}</span>
    </div>
  );
}

// Ring badge colors
const RING_BG: Record<string, string> = {
  adopt: "#E4FF9714", trial: "#FFF3E014", assess: "#E0F2FE14", hold: "#F5F5F514",
};
const RING_TEXT: Record<string, string> = {
  adopt: "#4D7C0F", trial: "#92400E", assess: "#0369A1", hold: "#737373",
};

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
