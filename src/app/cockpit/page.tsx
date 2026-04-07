"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { AppHeader } from "@/components/AppHeader";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { classifyTrends } from "@/lib/classify";
import { TREND_CLUSTERS, TREND_CLUSTER_MAP, getIntraClusterEdges } from "@/lib/trend-clusters";
import { VoltBadge, VoltTabs, VoltTrendCard, VoltStat } from "@/components/volt";
import { Tooltip } from "@/components/ui/Tooltip";
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

// ── View modes (Linsen) ─────────────────────────────────────────────────────

type Lens = "radar" | "network" | "trends";

const LENSES: { key: Lens; icon: string; labelDe: string; labelEn: string }[] = [
  { key: "radar",   icon: "◎", labelDe: "Radar",    labelEn: "Radar" },
  { key: "network", icon: "⬡", labelDe: "Netzwerk", labelEn: "Network" },
  { key: "trends",  icon: "☰", labelDe: "Trends",   labelEn: "Trends" },
];

// ── List view (inline TrendsGrid) ───────────────────────────────────────────

const RING_ORDER = ["adopt", "trial", "assess", "hold"];
const RING_COLOR: Record<string, string> = { adopt: "var(--color-adopt)", trial: "var(--color-trial)", assess: "var(--color-assess)", hold: "var(--color-hold)" };
const RING_BG: Record<string, string> = { adopt: "var(--pastel-mint-light, #F0FDF6)", trial: "var(--pastel-sky-light, #EFF6FF)", assess: "var(--pastel-butter-light, #FFFBEB)", hold: "var(--color-surface, #F9FAFB)" };

function TrendCard({ t, isSel, onSelect }: { t: TrendDot; isSel: boolean; onSelect: (t: TrendDot) => void }) {
  const dir = t.velocity === "rising" ? "up" as const : t.velocity === "falling" ? "down" as const : "stable" as const;
  const status = t.ring as "adopt" | "trial" | "assess" | "hold";
  return (
    <VoltTrendCard
      title={t.name}
      category={t.relevance > 0.75 ? "MEGA" : "MAKRO"}
      status={status}
      direction={dir}
      signals={t.signalCount}
      confidence={Math.round(t.confidence * 100)}
      active={isSel}
      onClick={() => onSelect(t)}
    />
  );
}

function TrendsGrid({ trends, selectedId, onSelect, de }: {
  trends: TrendDot[]; selectedId: string | null;
  onSelect: (t: TrendDot) => void; de: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"relevance" | "confidence" | "name">("relevance");
  const [groupBy, setGroupBy] = useState<"ring" | "cluster">("cluster");

  const q = search.toLowerCase();
  const filtered = trends.filter(t => !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => sortBy === "relevance" ? b.relevance - a.relevance : sortBy === "confidence" ? b.confidence - a.confidence : a.name.localeCompare(b.name));

  // Ring groups
  const ringGroups = RING_ORDER.map(r => ({ key: r, items: sorted.filter(t => t.ring === r) })).filter(g => g.items.length > 0);

  // Cluster groups
  const clusterGroups = TREND_CLUSTERS.map(c => {
    const clusterTrends = sorted.filter(t => TREND_CLUSTER_MAP[t.id] === c.id);
    const stats = clusterTrends.length > 0 ? {
      avgRel: Math.round(clusterTrends.reduce((s, t) => s + t.relevance, 0) / clusterTrends.length * 100),
      rising: clusterTrends.filter(t => t.velocity === "rising").length,
    } : null;
    return { cluster: c, items: clusterTrends, stats };
  }).filter(g => g.items.length > 0);

  const EDGE_LABELS_SHORT: Record<string, string> = { drives: "→", enables: "⟶", inhibits: "⊣", correlates: "↔" };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {/* Toolbar */}
      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
        <input className="volt-input" placeholder={de ? "Suchen…" : "Search…"} value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 180 }} />

        {/* Group-by toggle */}
        <div style={{ display: "flex", gap: 2, background: "var(--color-surface-2, #f5f5f5)", borderRadius: 8, padding: 2 }}>
          {(["cluster", "ring"] as const).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={groupBy === g ? "volt-btn volt-btn-solid volt-btn-sm" : "volt-btn volt-btn-ghost volt-btn-sm"}
              style={{ padding: "3px 10px", borderRadius: 6 }}
            >{g === "cluster" ? (de ? "Cluster" : "Clusters") : "Ring"}</button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {(["relevance", "confidence", "name"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={sortBy === s ? "volt-btn volt-btn-solid volt-btn-sm" : "volt-btn volt-btn-ghost volt-btn-sm"}
              style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12 }}
            >{s === "relevance" ? (de ? "Relevanz" : "Relevance") : s === "confidence" ? (de ? "Konfidenz" : "Confidence") : "A–Z"}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 20px" }}>
        {/* ── Cluster view ──────────────────────────────────────── */}
        {groupBy === "cluster" && clusterGroups.map(({ cluster: c, items, stats }) => {
          const intraEdges = getIntraClusterEdges(c.id).slice(0, 4);
          return (
            <div key={c.id} className="volt-card volt-texture" style={{ marginBottom: 20 }}>
              {/* Cluster header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)" }}>
                    {de ? c.nameDe : c.name}
                  </div>
                  <div className="volt-body-sm" style={{ color: "var(--color-text-muted)", marginTop: 2 }}>
                    {de ? c.descriptionDe : c.description}
                  </div>
                </div>
                {/* Stats badges */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <span className="volt-badge volt-badge-muted" style={{ background: c.color + "18", color: c.color }}>
                    {items.length} Trends
                  </span>
                  {stats && stats.rising > 0 && (
                    <span className="volt-badge volt-badge-muted" style={{ background: "var(--pastel-mint, #C3F4D3)", color: "var(--pastel-mint-text)" }}>
                      {stats.rising} ↑
                    </span>
                  )}
                  {stats && (
                    <span className="volt-badge volt-badge-muted">
                      {stats.avgRel}% rel.
                    </span>
                  )}
                  {/* STEEP badges */}
                  {c.steep.map(s => {
                    const steepLabel: Record<string, string> = { S: "Society", T: "Technology", E_env: "Environment", E_eco: "Economy", P: "Politics", V: "Values" };
                    return (
                      <span key={s} className="volt-badge volt-badge-muted" style={{ fontSize: 8, background: c.color + "12", color: c.color, textTransform: "uppercase" }}>
                        {steepLabel[s] ?? s}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Trend cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: intraEdges.length > 0 ? 12 : 0 }}>
                {items.map(t => (
                  <TrendCard key={t.id} t={t} isSel={selectedId === t.id} onSelect={onSelect} />
                ))}
              </div>

              {/* Intra-cluster causal edges */}
              {intraEdges.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
                  <span className="volt-label" style={{ marginRight: 4, lineHeight: "20px" }}>
                    {de ? "Verbindungen" : "Connections"}
                  </span>
                  {intraEdges.map((e, i) => {
                    const fromT = trends.find(t => t.id === e.from);
                    const toT = trends.find(t => t.id === e.to);
                    if (!fromT || !toT) return null;
                    const arrow = EDGE_LABELS_SHORT[e.type] ?? "→";
                    return (
                      <span key={i} style={{ fontSize: 10, color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 8, background: "var(--color-page-bg)" }}>
                        <span style={{ fontWeight: 500 }}>{fromT.name.split(" ")[0]}</span>
                        <span style={{ color: "var(--color-text-muted)" }}>{arrow}</span>
                        <span style={{ fontWeight: 500 }}>{toT.name.split(" ")[0]}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Ring view (original) ──────────────────────────────── */}
        {groupBy === "ring" && ringGroups.map(g => (
          <div key={g.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: RING_COLOR[g.key] }} />
              <span className="volt-label">{g.key} ({g.items.length})</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {g.items.map(t => (
                <TrendCard key={t.id} t={t} isSel={selectedId === t.id} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function CockpitPage() {
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
  const [lens, setLensState] = useState<Lens>("radar");
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);

  // Read initial lens from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLens = params.get("lens") as Lens | null;
    if (urlLens && ["radar", "network", "trends"].includes(urlLens)) {
      setLensState(urlLens);
    }
  }, []);

  // Update URL when lens changes
  const setLens = (newLens: Lens) => {
    setLensState(newLens);
    const url = new URL(window.location.href);
    url.searchParams.set("lens", newLens);
    window.history.replaceState({}, "", url.toString());
  };

  const handleTrendClick = (trend: TrendDot) => {
    setSelectedTrend(prev => prev?.id === trend.id ? null : trend);
  };

  // Stats
  const megaCount = trends.filter(t => t.tags?.includes("megatrend") || t.relevance > 0.75).length;
  const risingCount = trends.filter(t => t.velocity === "rising").length;

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "var(--color-text-primary)", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* ── Page header + Lens switcher ─────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", padding: "16px 24px 0" }}>
        <div className="volt-container" style={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display)", fontSize: 20, fontWeight: 700,
              letterSpacing: "-0.02em", color: "var(--color-text-heading)", margin: 0,
            }}>
              Cockpit
            </h1>

            {/* Stat badges — Volt components */}
            <div style={{ display: "flex", gap: 6 }}>
              <VoltBadge variant="default">{trends.length} Trends</VoltBadge>
              <VoltBadge variant="outline">{megaCount} Mega</VoltBadge>
              <VoltBadge variant="positive">{risingCount} ↑ {de ? "steigend" : "rising"}</VoltBadge>
            </div>
          </div>

          {/* Lens switcher — VoltTabs */}
          <VoltTabs
            variant="underline"
            activeTab={lens}
            onTabChange={(id) => setLens(id as Lens)}
            tabs={LENSES.map(l => ({
              id: l.key,
              label: de ? l.labelDe : l.labelEn,
              icon: <span style={{ fontSize: 11 }}>{l.icon}</span>,
            }))}
          />
        </div>
      </div>

      {/* ── Main content: Visualization + Detail Panel ──────────── */}
      <div className="volt-container" style={{ flex: 1, display: "flex", overflow: "hidden", width: "100%" }}>

        {/* Left: Visualization */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {lens === "radar" && (
            <div style={{ padding: "16px 24px" }}>
              {/* KPI Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                <Tooltip content={de ? "Gesamtanzahl ueberwachter Trends im System" : "Total number of monitored trends"} placement="bottom">
                  <VoltStat label="Trends" value={String(trends.length)} variant="default" size="sm" />
                </Tooltip>
                <Tooltip content={de ? "Mega-Trends: Langfristige, branchentransformierende Entwicklungen" : "Mega trends: Long-term, industry-transforming developments"} placement="bottom">
                  <VoltStat label="Mega-Trends" value={String(megaCount)} variant="default" size="sm" />
                </Tooltip>
                <Tooltip content={de ? "Trends deren Relevanz in den letzten 30 Tagen gestiegen ist" : "Trends whose relevance increased in the last 30 days"} placement="bottom">
                  <VoltStat label={de ? "Steigend" : "Rising"} value={String(risingCount)} change={risingCount > 10 ? +(risingCount / trends.length * 100).toFixed(0) : undefined} variant="positive" size="sm" />
                </Tooltip>
                <Tooltip content={de ? "Thematische Cluster: Gruppen verwandter Trends" : "Thematic clusters: Groups of related trends"} placement="bottom">
                  <VoltStat label={de ? "Cluster" : "Clusters"} value={String(TREND_CLUSTERS.length)} variant="default" size="sm" />
                </Tooltip>
              </div>
              <RadarView
                trends={trends}
                onTrendClick={handleTrendClick}
                locale={locale}
                filteredTrendIds={selectedTrend ? [selectedTrend.id] : undefined}
              />
            </div>
          )}

          {lens === "network" && (
            <div style={{ padding: "16px 24px", height: "calc(100vh - 300px)" }}>
              <CausalGraphView
                trends={trends}
                onTrendClick={handleTrendClick}
                locale={locale}
                highlightTrendId={selectedTrend?.id}
              />
            </div>
          )}

          {lens === "trends" && (
            <TrendsGrid
              trends={trends}
              selectedId={selectedTrend?.id ?? null}
              onSelect={handleTrendClick}
              de={de}
            />
          )}
        </div>

        {/* Right: Detail Panel */}
        {selectedTrend && (
          <div style={{ width: 440, flexShrink: 0, borderLeft: "1px solid var(--color-border)", overflowY: "auto", height: "calc(100vh - 130px)", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <TrendDetailPanel
                trend={selectedTrend}
                onClose={() => setSelectedTrend(null)}
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
