"use client";

// TODO: FE-01 — Remove "use client". Extract interactive parts into Client Components.
// This page should be a Server Component with only interactive islands as "use client".

/**
 * /verstehen — Knowledge Cockpit
 *
 * Simplified to match the discipline applied across Home and Sessions pages:
 *   — Single-line mono stats instead of a KPI hero grid
 *   — Functional subtitle, not marketing prose
 *   — 4 tabs (Radar · Netzwerk · Signale · Quellen), Methodik lives on its
 *     own route /verstehen/methodik and is reached from a link in the hero
 *   — Live Sources count pulled from /api/v1/feed (no hardcoded lies)
 *   — 1360 max-width container, consistent with Sessions
 *   — No redundant mini-stats above the Radar (already in the hero)
 *
 * The "Signale" tab is now a live signal stream (LiveSignalStream) that pulls
 * from /api/v1/feed/ticker, replacing the old trend-grid which duplicated the
 * Radar sidebar.
 */

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/lib/locale-context";
import { AppHeader } from "@/components/AppHeader";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { classifyTrends } from "@/lib/classify";
import { TREND_EDGES } from "@/lib/causal-graph";
import { VoltTabs } from "@/components/volt";
import { connectors } from "@/connectors";
import dynamic from "next/dynamic";

// ── Lazy-load heavy visualization components ────────────────────────────────

const RadarView = dynamic(() => import("@/components/radar/RadarView"), {
  ssr: false,
  loading: () => <ViewLoading label="Radar" />,
});
const CausalGraphView = dynamic(() => import("@/components/radar/CausalGraphView"), {
  ssr: false,
  loading: () => <ViewLoading label="Netzwerk" />,
});
const LiveSignalStream = dynamic(() => import("@/components/verstehen/LiveSignalStream"), {
  ssr: false,
  loading: () => <ViewLoading label="Signale" />,
});
const TrendDetailPanel = dynamic(() => import("@/components/radar/TrendDetailPanel"), {
  ssr: false,
});
const QuellenTable = dynamic(() => import("@/components/verstehen/QuellenTable"), {
  ssr: false,
  loading: () => <ViewLoading label="Quellen" />,
});

function ViewLoading({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "var(--volt-text-muted, #6B6B6B)", fontSize: 13 }}>
      {label} laden…
    </div>
  );
}

// ── View modes (Tabs) — 4 tabs, Methodik moved to /verstehen/methodik ──────

type Tab = "radar" | "netzwerk" | "signale" | "quellen";

const TABS: { key: Tab; labelDe: string; labelEn: string }[] = [
  { key: "radar",    labelDe: "Radar",    labelEn: "Radar" },
  { key: "netzwerk", labelDe: "Netzwerk", labelEn: "Network" },
  { key: "signale",  labelDe: "Signale",  labelEn: "Signals" },
  { key: "quellen",  labelDe: "Quellen",  labelEn: "Sources" },
];

// ── Main Page ───────────────────────────────────────────────────────────────

export default function VerstehenPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  // Trends data — megaTrends as base, overlay DB scores if available.
  const [trends, setTrends] = useState<TrendDot[]>(megaTrends);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const loadTrends = useCallback(() => {
    setTrendsLoading(true);
    setTrendsError(null);
    fetch("/api/v1/trends")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.trends?.length > 0) {
          const dbTrends = data.trends as TrendDot[];
          const dbByName = new Map(dbTrends.map((t: TrendDot) => [t.name.toLowerCase(), t]));
          const merged = megaTrends.map(mt => {
            const db = dbByName.get(mt.name.toLowerCase());
            if (!db) return mt;
            return { ...mt, relevance: db.relevance, confidence: db.confidence, impact: db.impact, ring: db.ring, velocity: db.velocity ?? mt.velocity, signalCount: db.signalCount ?? mt.signalCount };
          });
          setTrends(classifyTrends(merged));
        }
      })
      .catch((e) => {
        setTrendsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setTrendsLoading(false));
  }, []);
  useEffect(() => { loadTrends(); }, [loadTrends]);

  // Live sources count — pulled from /api/v1/feed sourceStatus. No more
  // hardcoded "47" lies. Falls back to the total connector count if the
  // endpoint is unreachable.
  const [sourcesCount, setSourcesCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/v1/feed")
      .then(r => r.json())
      .then(data => {
        const list = data?.sourceStatus ?? [];
        if (Array.isArray(list) && list.length > 0) setSourcesCount(list.length);
      })
      .catch(() => {});
  }, []);

  // Responsive: detect mobile for detail panel layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // View state — tab + selected trend, synced with URL params for shareable links.
  const [activeTab, setActiveTabState] = useState<Tab>("radar");
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Read initial tab from URL + handle legacy ?tab=methodik redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    // Legacy URL compat: ?tab=methodik used to select the Methodik tab.
    // Methodik is now a dedicated route — redirect to preserve old links.
    if (urlTab === "methodik") {
      window.location.replace("/verstehen/methodik");
      return;
    }
    if (urlTab && (["radar", "netzwerk", "signale", "quellen"] as Tab[]).includes(urlTab as Tab)) {
      setActiveTabState(urlTab as Tab);
    }
  }, []);

  const setActiveTab = useCallback((newTab: Tab) => {
    setActiveTabState(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const handleTrendClick = useCallback((trend: TrendDot) => {
    setSelectedTrend(prev => prev?.id === trend.id ? null : trend);
    setSelectedId(prev => prev === trend.id ? null : trend.id);
  }, []);

  // Derived stats for the mono stats line
  const activeEdges = TREND_EDGES.length;
  const adoptCount = trends.filter(t => t.ring === "adopt").length;
  // Use live API count when available, fall back to static connector count,
  // never use a hardcoded number.
  const effectiveSourcesCount = sourcesCount ?? connectors.length;

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "var(--color-text-primary)", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* ── Hero — minimal, functional, consistent with Home + Sessions ── */}
      <div style={{
        borderBottom: "1px solid var(--volt-border, #E8E8E8)",
        background: "var(--volt-surface-raised, #fff)",
      }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 24px 0" }}>
          {/* Mono stats line — replaces the 4-KPI-card bloat */}
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--volt-text-faint, #AAA)",
            marginBottom: 12,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <span>{trends.length} {de ? "Trends" : "Trends"}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{activeEdges} {de ? "Kausal-Edges" : "Causal edges"}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{effectiveSourcesCount} {de ? "Quellen" : "Sources"}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{adoptCount} {de ? "Adopt-Ring" : "Adopt ring"}</span>
          </div>

          {/* Title + Methodik link */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--volt-text, #0A0A0A)", margin: 0, lineHeight: 1.1,
            }}>
              Knowledge Cockpit
            </h1>
            <a
              href="/verstehen/methodik"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600,
                padding: "8px 14px",
                borderRadius: "var(--volt-radius-md, 10px)",
                border: "1px solid var(--volt-border, #E8E8E8)",
                background: "var(--volt-surface-raised, #fff)",
                color: "var(--volt-text-muted, #6B6B6B)",
                textDecoration: "none",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                transition: "all 140ms ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = "var(--volt-surface, #FAFAFA)";
                el.style.color = "var(--volt-text, #0A0A0A)";
                el.style.borderColor = "var(--volt-text, #0A0A0A)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = "var(--volt-surface-raised, #fff)";
                el.style.color = "var(--volt-text-muted, #6B6B6B)";
                el.style.borderColor = "var(--volt-border, #E8E8E8)";
              }}
            >
              <span style={{
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                {de ? "Methodik" : "Methodology"}
              </span>
              <span>→</span>
            </a>
          </div>

          {/* Functional subtitle — tells the user what they're looking at */}
          <p style={{
            fontSize: 14, lineHeight: 1.6,
            color: "var(--volt-text-muted, #6B6B6B)",
            margin: "0 0 18px", maxWidth: 720,
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
          }}>
            {de
              ? "Die Daten-Landschaft, gegen die du deine strategischen Fragen stellst — Trends, Kausalnetz, Live-Signale und Quellen in einem System."
              : "The data landscape you run your strategic questions against — trends, causal network, live signals, and sources in one system."}
          </p>

          {/* Tabs — flush to the hero bottom, no standalone container */}
          <VoltTabs
            variant="underline"
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as Tab)}
            tabs={TABS.map(t => ({
              id: t.key,
              label: de ? t.labelDe : t.labelEn,
            }))}
          />
        </div>
      </div>

      {/* ── Main content: Visualization + Detail Panel ──────────── */}
      <div style={{ maxWidth: 1360, margin: "0 auto", width: "100%", flex: 1, display: "flex" }}>

        {/* Left: Visualization */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* UX-15 / EDGE-20: Loading indicator and error state for trend data */}
          {trendsLoading && (activeTab === "radar" || activeTab === "netzwerk") && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--volt-text-muted, #6B6B6B)", fontSize: 13 }}>
              {de ? "Trends laden\u2026" : "Loading trends\u2026"}
            </div>
          )}
          {trendsError && (activeTab === "radar" || activeTab === "netzwerk") && (
            <div role="alert" style={{
              margin: "24px", padding: "20px 22px",
              background: "var(--volt-negative-light, #FEF2F2)",
              border: "1px solid var(--volt-negative-border, #FECACA)",
              borderRadius: "var(--volt-radius-md, 10px)",
              color: "var(--volt-negative-text, #991B1B)",
              fontSize: 13,
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <span>
                {de
                  ? "Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut."
                  : "Data could not be loaded. Please try again."}
              </span>
              <button
                onClick={loadTrends}
                style={{
                  alignSelf: "flex-start",
                  fontSize: 12, fontWeight: 600, padding: "6px 16px",
                  borderRadius: "var(--volt-radius-md, 10px)",
                  border: "1px solid var(--volt-negative-border, #FECACA)",
                  background: "transparent",
                  color: "var(--volt-negative-text, #991B1B)",
                  cursor: "pointer",
                }}
              >
                {de ? "Erneut versuchen" : "Retry"}
              </button>
            </div>
          )}
          {activeTab === "radar" && !trendsLoading && (
            <RadarView
              trends={trends}
              onTrendClick={handleTrendClick}
              locale={locale}
              filteredTrendIds={selectedTrend ? [selectedTrend.id] : undefined}
            />
          )}

          {activeTab === "netzwerk" && !trendsLoading && (
            <div style={{ padding: "20px 24px 40px" }}>
              <CausalGraphView
                trends={trends}
                onTrendClick={handleTrendClick}
                locale={locale}
                highlightTrendId={selectedTrend?.id}
              />
            </div>
          )}

          {activeTab === "signale" && (
            <LiveSignalStream
              trends={trends}
              de={de}
              onTrendClick={(trendName) => {
                // Jump to Radar and highlight the matched trend (if any)
                const match = trends.find(t => t.name.toLowerCase() === trendName.toLowerCase());
                if (match) {
                  setSelectedTrend(match);
                  setSelectedId(match.id);
                  setActiveTab("radar");
                }
              }}
            />
          )}

          {activeTab === "quellen" && (
            <QuellenTable de={de} />
          )}
        </div>

        {/* Right: Detail Panel — only shown on radar/netzwerk where it makes sense.
             On narrow viewports (< 768px) the panel overlays full-width as a
             fixed sheet; on wider screens it sits as a sticky sidebar. */}
        {selectedTrend && (activeTab === "radar" || activeTab === "netzwerk") && (
          <div style={isMobile ? {
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50,
            overflowY: "auto",
            display: "flex", flexDirection: "column",
            background: "var(--volt-surface-raised, #fff)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
          } : {
            width: 440, flexShrink: 0,
            borderLeft: "1px solid var(--volt-border, #E8E8E8)",
            overflowY: "auto",
            position: "sticky", top: 0, alignSelf: "flex-start",
            maxHeight: "100vh",
            display: "flex", flexDirection: "column",
            background: "var(--volt-surface-raised, #fff)",
          }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <TrendDetailPanel
                trend={selectedTrend}
                onClose={() => { setSelectedTrend(null); setSelectedId(null); }}
              />
            </div>
            {/* Analyze in Canvas — closes the cockpit→session loop */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--volt-border, #E8E8E8)", flexShrink: 0 }}>
              <button
                onClick={async () => {
                  try {
                    const { buildTrendDeepDive } = await import("@/lib/canvas-templates");
                    const template = buildTrendDeepDive(selectedTrend.name);
                    const res = await fetch("/api/v1/canvas", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: `Trend: ${selectedTrend.name}` }),
                    });
                    if (!res.ok) return;
                    const json = await res.json();
                    const pid = json.canvas?.id;
                    if (!pid) return;
                    await fetch(`/api/v1/canvas/${pid}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ canvasState: { nodes: template.nodes, conns: template.conns, pan: { x: 0, y: 0 }, zoom: 0.7, v: 2 } }),
                    });
                    localStorage.setItem("sis-active-canvas", pid);
                    window.location.href = `/canvas?project=${pid}`;
                  } catch (e) { console.error(e); }
                }}
                style={{
                  width: "100%", fontSize: 12, fontWeight: 600, padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid color-mix(in srgb, var(--signal-positive, #1A9E5A) 26%, transparent)",
                  background: "color-mix(in srgb, var(--signal-positive, #1A9E5A) 5%, transparent)",
                  color: "var(--signal-positive, #1A9E5A)", cursor: "pointer",
                  transition: "all 0.12s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--signal-positive, #1A9E5A) 10%, transparent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--signal-positive, #1A9E5A) 5%, transparent)"; }}
              >
                ⊞ {de ? "Im Canvas analysieren" : "Analyze in Canvas"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
