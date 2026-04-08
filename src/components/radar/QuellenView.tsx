"use client";

import React, { useState, useEffect, useMemo } from "react";
import { connectors } from "@/connectors";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { VoltBadge } from "@/components/volt";

interface ConnectorStatus {
  name: string;
  displayName: string;
  status: "active" | "stale" | "error" | "unknown";
  lastRunAt?: string;
  signalCount?: number;
  category: string;
}

const CONNECTOR_CATEGORIES: Record<string, { de: string; en: string; color: string; icon: string }> = {
  "tech":          { de: "Tech & Entwickler",      en: "Tech & Developers",     color: "#3B82F6", icon: "💻" },
  "news":          { de: "Nachrichten & Medien",    en: "News & Media",           color: "#EF4444", icon: "📰" },
  "research":      { de: "Forschung & Wissenschaft", en: "Research & Academia",    color: "#8B5CF6", icon: "🔬" },
  "economic":      { de: "Wirtschaft & Finanzen",  en: "Economy & Finance",      color: "#F59E0B", icon: "💰" },
  "social":        { de: "Soziale Netzwerke",      en: "Social Networks",        color: "#EC4899", icon: "💬" },
  "governmental":  { de: "Behörden & Statistiken", en: "Government & Statistics", color: "#0EA5E9", icon: "🏛" },
  "geopolitical":  { de: "Geopolitik & Konflikt",  en: "Geopolitics & Conflict", color: "#DC2626", icon: "🌍" },
  "climate":       { de: "Klima & Umwelt",          en: "Climate & Environment",  color: "#10B981", icon: "🌱" },
  "prediction":    { de: "Prognosemärkte",          en: "Prediction Markets",     color: "#7C3AED", icon: "📊" },
  "health":        { de: "Gesundheit & Arbeit",    en: "Health & Labor",         color: "#06B6D4", icon: "⚕" },
  "other":         { de: "Sonstige",                en: "Other",                  color: "#6B7280", icon: "•" },
};

const CONNECTOR_TO_CATEGORY: Record<string, string> = {
  hackernews: "tech", github: "tech", reddit: "social", arxiv: "research",
  stackoverflow: "tech", "npm-pypi": "tech", producthunt: "tech", wikipedia: "research",
  news: "news", "google-trends": "tech", sentiment: "news",
  worldmonitor: "geopolitical", polymarket: "prediction", manifold: "prediction",
  openalex: "research", gdelt: "geopolitical", "nasa-eonet": "climate",
  worldbank: "economic", eurostat: "governmental", fred: "economic",
  oecd: "economic", owid: "research", destatis: "governmental",
  guardian: "news", acled: "geopolitical", finnhub: "economic",
  metaculus: "prediction", "who-gho": "health", ilo: "health",
  ucdp: "geopolitical", vdem: "geopolitical", crossref: "research",
  "semantic-scholar": "research", "un-data": "governmental", "un-sdg": "governmental",
  imf: "economic", nyt: "news", newsdata: "news", "media-cloud": "news",
  "open-meteo": "climate", bls: "economic", "open-exchange": "economic",
  bluesky: "social", "mastodon-api": "social", "docker-hub": "tech",
  patentsview: "research", kalshi: "prediction",
};

interface QuellenViewProps {
  de: boolean;
  trendCount: number;
  edgeCount: number;
}

export default function QuellenView({ de, trendCount, edgeCount }: QuellenViewProps) {
  const [statusMap, setStatusMap] = useState<Record<string, { lastRunAt?: string; status?: string; signalCount?: number }>>({});
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"connectors" | "research">("connectors");

  useEffect(() => {
    fetch("/api/v1/sources/status")
      .then(r => r.json())
      .then(data => {
        const list = data?.connectors || data?.sources || [];
        if (Array.isArray(list)) {
          const map: Record<string, { lastRunAt?: string; status?: string; signalCount?: number }> = {};
          for (const s of list) {
            map[s.name] = {
              lastRunAt: s.lastFetch || s.lastRunAt,
              status: s.status || s.lastStatus,
              signalCount: s.signalCount,
            };
          }
          setStatusMap(map);
        }
      })
      .catch(() => {});
  }, []);

  const connectorList: ConnectorStatus[] = useMemo(() => {
    return connectors.map(c => {
      const stat = statusMap[c.name] || {};
      let status: "active" | "stale" | "error" | "unknown" = "unknown";
      if (stat.status === "active" || stat.status === "ok" || stat.status === "fresh") status = "active";
      else if (stat.status === "stale") status = "stale";
      else if (stat.status === "error") status = "error";
      else if (stat.lastRunAt) {
        const age = Date.now() - new Date(stat.lastRunAt).getTime();
        status = age < 24 * 60 * 60 * 1000 ? "active" : "stale";
      }
      return {
        name: c.name,
        displayName: c.displayName,
        status,
        lastRunAt: stat.lastRunAt,
        signalCount: stat.signalCount,
        category: CONNECTOR_TO_CATEGORY[c.name] || "other",
      };
    });
  }, [statusMap]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return connectorList;
    return connectorList.filter(c => c.category === activeFilter);
  }, [connectorList, activeFilter]);

  const categoriesUsed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of connectorList) counts[c.category] = (counts[c.category] || 0) + 1;
    return counts;
  }, [connectorList]);

  const activeCount = connectorList.filter(c => c.status === "active").length;
  const totalSignals = connectorList.reduce((sum, c) => sum + (c.signalCount || 0), 0);

  const researchSources = Object.entries(SOURCE_REGISTRY);
  const researchCategories = useMemo(() => {
    const cats: Record<string, typeof researchSources> = {};
    for (const entry of researchSources) {
      const cat = entry[1].category || "Other";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(entry);
    }
    return cats;
  }, [researchSources]);

  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header summary */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em",
          color: "var(--color-text-heading)", margin: 0, marginBottom: 6,
        }}>
          {de ? "Verbundene Datenquellen" : "Connected Data Sources"}
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
          {de
            ? `${connectors.length} Live-Connectors aktiv · ${activeCount} laufen · ${trendCount} Nodes · ${edgeCount} Edges im Kausal-Graph`
            : `${connectors.length} live connectors · ${activeCount} running · ${trendCount} nodes · ${edgeCount} edges in causal graph`}
        </p>
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10, marginBottom: 24,
      }}>
        <StatBox label={de ? "Live-Connectors" : "Live Connectors"} value={connectors.length} accent="#3B82F6" />
        <StatBox label={de ? "Aktiv" : "Active"} value={activeCount} accent="#16a34a" />
        <StatBox label={de ? "Forschungsquellen" : "Research Sources"} value={researchSources.length} accent="#8B5CF6" />
        <StatBox label={de ? "Trend-Nodes" : "Trend Nodes"} value={trendCount} accent="#F59E0B" />
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 16,
        borderBottom: "1px solid var(--color-border)",
      }}>
        <TabButton active={activeTab === "connectors"} onClick={() => setActiveTab("connectors")}>
          {de ? `Live-Connectors (${connectors.length})` : `Live Connectors (${connectors.length})`}
        </TabButton>
        <TabButton active={activeTab === "research"} onClick={() => setActiveTab("research")}>
          {de ? `Forschungsquellen (${researchSources.length})` : `Research Sources (${researchSources.length})`}
        </TabButton>
      </div>

      {activeTab === "connectors" && (
        <>
          {/* Category filter chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            <FilterChip active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>
              {de ? "Alle" : "All"} ({connectors.length})
            </FilterChip>
            {Object.entries(CONNECTOR_CATEGORIES).map(([key, meta]) => {
              const count = categoriesUsed[key];
              if (!count) return null;
              return (
                <FilterChip
                  key={key}
                  active={activeFilter === key}
                  color={meta.color}
                  onClick={() => setActiveFilter(key)}
                >
                  {meta.icon} {de ? meta.de : meta.en} ({count})
                </FilterChip>
              );
            })}
          </div>

          {/* Connector grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}>
            {filtered.map(c => (
              <ConnectorCard key={c.name} connector={c} de={de} />
            ))}
          </div>
        </>
      )}

      {activeTab === "research" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(researchCategories).sort((a, b) => b[1].length - a[1].length).map(([cat, items]) => (
            <div key={cat}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)", marginBottom: 8,
                paddingBottom: 4, borderBottom: "1px solid var(--color-border)",
              }}>
                {cat} ({items.length})
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 10,
              }}>
                {items.map(([key, src]) => (
                  <ResearchSourceCard key={key} src={src} de={de} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      padding: "14px 16px",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      background: "var(--card)",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--muted-foreground)",
        fontFamily: "var(--font-mono)", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700, color: accent,
        fontFamily: "var(--font-display)", lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? "var(--color-text-heading)" : "var(--muted-foreground)",
        fontFamily: "var(--font-ui)",
        borderBottom: active ? "2px solid var(--color-text-heading)" : "2px solid transparent",
        marginBottom: -1,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, color, onClick, children }: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 11px",
        fontSize: 11, fontWeight: 600,
        border: `1px solid ${active ? (color || "var(--color-text-heading)") : "var(--color-border)"}`,
        background: active ? (color ? `${color}18` : "var(--muted)") : "transparent",
        color: active ? (color || "var(--color-text-heading)") : "var(--muted-foreground)",
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function ConnectorCard({ connector, de }: { connector: ConnectorStatus; de: boolean }) {
  const meta = CONNECTOR_CATEGORIES[connector.category] || CONNECTOR_CATEGORIES.other;
  const statusColors: Record<string, { bg: string; fg: string; label: { de: string; en: string } }> = {
    active:  { bg: "#DCFCE7", fg: "#16a34a", label: { de: "Aktiv", en: "Active" } },
    stale:   { bg: "#FEF3C7", fg: "#CA8A04", label: { de: "Veraltet", en: "Stale" } },
    error:   { bg: "#FEE2E2", fg: "#DC2626", label: { de: "Fehler", en: "Error" } },
    unknown: { bg: "#F3F4F6", fg: "#6B7280", label: { de: "Bereit", en: "Ready" } },
  };
  const statusInfo = statusColors[connector.status];

  return (
    <div style={{
      padding: "12px 14px",
      border: "1px solid var(--color-border)",
      borderRadius: 10,
      background: "var(--card)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: `${meta.color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 14,
          }}>
            {meta.icon}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: "var(--foreground)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              fontFamily: "var(--font-ui)",
            }}>
              {connector.displayName}
            </div>
            <div style={{
              fontSize: 10, color: "var(--muted-foreground)",
              fontFamily: "var(--font-mono)",
            }}>
              {connector.name}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700,
          padding: "2px 6px", borderRadius: 4,
          background: statusInfo.bg, color: statusInfo.fg,
          textTransform: "uppercase", letterSpacing: "0.04em",
          fontFamily: "var(--font-mono)", flexShrink: 0,
        }}>
          {de ? statusInfo.label.de : statusInfo.label.en}
        </span>
      </div>
      <div style={{
        fontSize: 10, color: "var(--muted-foreground)",
        display: "flex", justifyContent: "space-between",
        fontFamily: "var(--font-mono)",
      }}>
        <span>{de ? meta.de : meta.en}</span>
        {connector.signalCount != null && connector.signalCount > 0 && (
          <span>{connector.signalCount} {de ? "Signale" : "signals"}</span>
        )}
      </div>
    </div>
  );
}

function ResearchSourceCard({ src, de }: { src: any; de: boolean }) {
  const accessColors: Record<string, { bg: string; fg: string }> = {
    free:     { bg: "#DCFCE7", fg: "#166534" },
    freemium: { bg: "#FEF3C7", fg: "#854D0E" },
    paid:     { bg: "#FEE2E2", fg: "#991B1B" },
  };
  const accessInfo = accessColors[src.access || "free"];

  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        padding: "12px 14px",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        background: "var(--card)",
        textDecoration: "none",
        color: "inherit",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--color-text-heading)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--foreground)",
            fontFamily: "var(--font-display)",
          }}>
            {src.name}
          </div>
          {src.shortName && (
            <div style={{
              fontSize: 10, color: "var(--muted-foreground)",
              fontFamily: "var(--font-mono)",
            }}>
              {src.shortName}
            </div>
          )}
        </div>
        {src.access && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            padding: "2px 6px", borderRadius: 4,
            background: accessInfo.bg, color: accessInfo.fg,
            textTransform: "uppercase", letterSpacing: "0.04em",
            fontFamily: "var(--font-mono)", flexShrink: 0,
          }}>
            {src.access}
          </span>
        )}
      </div>
      {src.description && (
        <div style={{
          fontSize: 11, color: "var(--muted-foreground)",
          lineHeight: 1.5, marginTop: 4,
        }}>
          {src.description}
        </div>
      )}
      <div style={{
        marginTop: 6, fontSize: 9, color: "var(--muted-foreground)",
        display: "flex", gap: 8, fontFamily: "var(--font-mono)",
      }}>
        {src.frequency && <span>↻ {src.frequency}</span>}
        {src.geoFocus && <span>🌐 {src.geoFocus}</span>}
      </div>
    </a>
  );
}
