"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { AppHeader } from "@/components/AppHeader";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { classifyTrends } from "@/lib/classify";
import { TREND_EDGES } from "@/lib/causal-graph";
import { VoltBadge, VoltTabs } from "@/components/volt";
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
const IntelligenceFeed = dynamic(() => import("@/components/radar/IntelligenceFeed"), {
  ssr: false,
  loading: () => <ViewLoading label="Signale" />,
});
const TrendDetailPanel = dynamic(() => import("@/components/radar/TrendDetailPanel"), {
  ssr: false,
});

function ViewLoading({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "var(--color-text-muted)", fontSize: 13 }}>
      {label} laden…
    </div>
  );
}

// ── View modes (Tabs) ──────────────────────────────────────────────────────

type Tab = "radar" | "netzwerk" | "signale" | "quellen" | "methodik";

const TABS: { key: Tab; icon: string; labelDe: string; labelEn: string }[] = [
  { key: "radar",    icon: "◎", labelDe: "Radar",    labelEn: "Radar" },
  { key: "netzwerk", icon: "⇄", labelDe: "Netzwerk", labelEn: "Network" },
  { key: "signale",  icon: "⚡", labelDe: "Signale",  labelEn: "Signals" },
  { key: "quellen",  icon: "📚", labelDe: "Quellen",  labelEn: "Sources" },
  { key: "methodik", icon: "📋", labelDe: "Methodik", labelEn: "Methodology" },
];

// ── Main Page ───────────────────────────────────────────────────────────────

export default function VerstehenPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  // Trends data — use megaTrends as base (they have slug-IDs that match TREND_EDGES).
  // Overlay DB scores if available, but keep megaTrend IDs for causal graph compatibility.
  const [trends, setTrends] = useState<TrendDot[]>(megaTrends);
  useEffect(() => {
    fetch("/api/v1/trends")
      .then(r => r.json())
      .then(data => {
        if (data.trends?.length > 0) {
          const dbTrends = data.trends as TrendDot[];
          // Merge: use megaTrends structure, overlay DB scores by name match
          const dbByName = new Map(dbTrends.map((t: TrendDot) => [t.name.toLowerCase(), t]));
          const merged = megaTrends.map(mt => {
            const db = dbByName.get(mt.name.toLowerCase());
            if (!db) return mt;
            return { ...mt, relevance: db.relevance, confidence: db.confidence, impact: db.impact, ring: db.ring, velocity: db.velocity ?? mt.velocity, signalCount: db.signalCount ?? mt.signalCount };
          });
          setTrends(classifyTrends(merged));
        }
      })
      .catch(() => {});
  }, []);

  // View state — sync with URL params for shareable links
  const [activeTab, setActiveTabState] = useState<Tab>("radar");
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Read initial tab from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab") as Tab | null;
    if (urlTab && (["radar", "netzwerk", "signale", "quellen", "methodik"] as Tab[]).includes(urlTab)) {
      setActiveTabState(urlTab);
    }
  }, []);

  // Update URL when tab changes
  const setActiveTab = (newTab: Tab) => {
    setActiveTabState(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState({}, "", url.toString());
  };

  const handleTrendClick = (trend: TrendDot) => {
    setSelectedTrend(prev => prev?.id === trend.id ? null : trend);
    setSelectedId(prev => prev === trend.id ? null : trend.id);
  };

  // Stats
  const activeEdges = TREND_EDGES.length;

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "var(--color-text-primary)", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* ── Page header + Tab switcher ──────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", padding: "16px 24px 0" }}>
        <div className="volt-container" style={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display)", fontSize: 20, fontWeight: 700,
              letterSpacing: "-0.02em", color: "var(--color-text-heading)", margin: 0,
            }}>
              Verstehen
            </h1>

            {/* Stat badges */}
            <div style={{ display: "flex", gap: 6 }}>
              <VoltBadge variant="default">{trends.length} Nodes</VoltBadge>
              <VoltBadge variant="outline">{activeEdges} Edges</VoltBadge>
              <VoltBadge variant="default">65+ {de ? "Quellen" : "Sources"}</VoltBadge>
            </div>
          </div>

          {/* Tab switcher — VoltTabs */}
          <VoltTabs
            variant="underline"
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as Tab)}
            tabs={TABS.map(t => ({
              id: t.key,
              label: de ? t.labelDe : t.labelEn,
              icon: <span style={{ fontSize: 11 }}>{t.icon}</span>,
            }))}
          />
        </div>
      </div>

      {/* ── Main content: Visualization + Detail Panel ──────────── */}
      <div className="volt-container" style={{ flex: 1, display: "flex", overflow: "hidden", width: "100%" }}>

        {/* Left: Visualization */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {activeTab === "radar" && (
            <div style={{ padding: "16px 24px" }}>
              <RadarView
                trends={trends}
                onTrendClick={handleTrendClick}
                locale={locale}
                filteredTrendIds={selectedTrend ? [selectedTrend.id] : undefined}
              />
            </div>
          )}

          {activeTab === "netzwerk" && (
            <div style={{ padding: "16px 24px", height: "calc(100vh - 300px)" }}>
              <CausalGraphView
                trends={trends}
                onTrendClick={handleTrendClick}
                locale={locale}
                highlightTrendId={selectedTrend?.id}
              />
            </div>
          )}

          {activeTab === "signale" && (
            <div style={{ padding: "16px 24px" }}>
              <IntelligenceFeed
                trends={trends}
                locale={locale}
                onTrendClick={(t) => {
                  setSelectedId(t.id);
                  setSelectedTrend(t);
                }}
              />
            </div>
          )}

          {activeTab === "quellen" && (
            <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "var(--volt-font-display)", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                {de ? "Verbundene Datenquellen" : "Connected Data Sources"}
              </h2>
              <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
                {de ? `${trends.length} Nodes · ${activeEdges} Edges · 65+ Quellen` : `${trends.length} Nodes · ${activeEdges} Edges · 65+ Sources`}
              </p>
              <a href="/archiv" style={{ color: "var(--pastel-sky-text, #1A4A8A)", textDecoration: "none", fontWeight: 600 }}>
                {de ? "Vollstaendige Quellen-Datenbank oeffnen →" : "Open full source database →"}
              </a>
            </div>
          )}

          {activeTab === "methodik" && (
            <div style={{ padding: "24px 32px", maxWidth: 800, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "var(--volt-font-display)", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {de ? "Methodik des Strategic Intelligence System" : "Strategic Intelligence System Methodology"}
              </h2>
              <p style={{ color: "var(--color-text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
                {de ? "Dieses Whitepaper erklaert die Methodik des SIS. Transparenz ist kein Risiko — sie ist unser schaerfstes Differenzierungsmerkmal."
                     : "This whitepaper explains the SIS methodology. Transparency is not a risk — it is our sharpest differentiator."}
              </p>
              <div style={{ display: "grid", gap: 24 }}>
                <section>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{de ? "1. Was ist das SIS?" : "1. What is SIS?"}</h3>
                  <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                    {de ? "Das SIS ist ein strategisches Intelligence-Terminal. Es aggregiert kontinuierlich Signale aus 50 offenen Datenquellen, ordnet sie in ein kausales Trend-Netzwerk ein und ermoeglicht natursprachliche Abfragen gegen dieses lebende Weltmodell."
                         : "The SIS is a strategic intelligence terminal. It continuously aggregates signals from 50+ open data sources, organizes them into a causal trend network, and enables natural-language queries against this living world model."}
                  </p>
                </section>
                <section>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{de ? "2. Trend-Klassifikation" : "2. Trend Classification"}</h3>
                  <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                    {de ? "Jeder Trend wird in 4 Reifegrade eingestuft: Adopt (sofort relevant), Trial (Pilotprojekte empfohlen), Assess (beobachten) und Hold (langfristig relevant). Die Einstufung basiert auf Signal-Staerke, Quellen-Abdeckung und historischer Entwicklung."
                         : "Each trend is classified into 4 maturity levels: Adopt, Trial, Assess, and Hold. Classification is based on signal strength, source coverage, and historical development."}
                  </p>
                </section>
                <section>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{de ? "3. Konfidenz-Berechnung" : "3. Confidence Calculation"}</h3>
                  <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                    {de ? "Konfidenz (0-100%) misst wie sicher die Einschaetzung ist. Hohe Konfidenz entsteht durch breite Quellen-Abdeckung, aktuelle Signale und starke Signal-Uebereinstimmung."
                         : "Confidence (0-100%) measures assessment certainty. High confidence comes from broad source coverage, recent signals, and strong signal agreement."}
                  </p>
                </section>
                <section>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{de ? "4. Kausalanalyse" : "4. Causal Analysis"}</h3>
                  <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                    {de ? "SIS modelliert Beziehungen zwischen Trends als gerichteten Graphen mit 4 Edge-Typen: drives (treibt), amplifies (verstaerkt), dampens (daempft), correlates (korreliert)."
                         : "SIS models trend relationships as a directed graph with 4 edge types: drives, amplifies, dampens, correlates."}
                  </p>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        {selectedTrend && (
          <div style={{ width: 440, flexShrink: 0, borderLeft: "1px solid var(--color-border)", overflowY: "auto", height: "calc(100vh - 130px)", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <TrendDetailPanel
                trend={selectedTrend}
                onClose={() => { setSelectedTrend(null); setSelectedId(null); }}
              />
            </div>
            {/* Analyze in Canvas button */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
              <button
                onClick={async () => {
                  try {
                    // Create new canvas project with Trend Deep-Dive template
                    const { buildTrendDeepDive } = await import("@/lib/canvas-templates");
                    const template = buildTrendDeepDive(selectedTrend.name);
                    // Create project
                    const res = await fetch("/api/v1/canvas", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: `Trend: ${selectedTrend.name}` }),
                    });
                    if (!res.ok) return;
                    const json = await res.json();
                    const pid = json.canvas?.id;
                    if (!pid) return;
                    // Save template nodes
                    await fetch(`/api/v1/canvas/${pid}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ canvasState: { nodes: template.nodes, conns: template.conns, pan: { x: 0, y: 0 }, zoom: 0.7, v: 2 } }),
                    });
                    localStorage.setItem("sis-active-canvas", pid);
                    window.location.href = "/canvas";
                  } catch (e) { console.error(e); }
                }}
                style={{
                  width: "100%", fontSize: 12, fontWeight: 600, padding: "10px 16px",
                  borderRadius: 8, border: "1px solid color-mix(in srgb, var(--signal-positive, #1A9E5A) 26%, transparent)",
                  background: "color-mix(in srgb, var(--signal-positive, #1A9E5A) 5%, transparent)", color: "var(--signal-positive)", cursor: "pointer",
                  transition: "all 0.12s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
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
