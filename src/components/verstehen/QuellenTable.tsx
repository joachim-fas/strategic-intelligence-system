"use client";

/**
 * QuellenTable — Implements the Volt UI "Quellen-Tabelle" template.
 *
 * Spec from https://grainui-jddpkx7p.manus.space/ (Templates & Visualisierung):
 *   "Vollständige Quellen-Verwaltungsansicht mit Filter-Pills, Suchfeld,
 *    Typ-Badges und Status/Auth-Spalten."
 *
 * Used as the "Quellen" tab in /verstehen.
 *
 * Layout:
 *   [Header: "X Quellen · X aktiv · X brauchen Key"   🔍 Suchen...]
 *   [Filter pills: Alle · Tech & Developer · Wissenschaft · ...]
 *   [Table: Quelle | Kategorie | Typ | Beschreibung | Status | Auth]
 *
 * Auth "KEY" badge is shown for connectors that need an API key.
 * Typ badges: LIVE-SIGNAL / SOCIAL / FORSCHUNG / PROGNOSE
 */

import React, { useState, useEffect, useMemo } from "react";
import { connectors } from "@/connectors";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { PLANNED_CONNECTORS, PLANNED_CATEGORY_LABELS } from "@/lib/planned-connectors";
import {
  VoltFilterPill,
  VoltTypeBadge,
  VoltStatusBadge,
  TypeBadgeKind,
  StatusKind,
} from "./VoltPrimitives";

// ─── Category config ────────────────────────────────────────────────────
// Core categories for the live connectors PLUS every category that appears
// only in the planned list (wetten, kultur, gaming, crypto, cyber, …).
// Keeping both in one map lets us build a single filter-pill row whose
// dynamic counts reflect BOTH live and planned sources.
const CATEGORIES = {
  all:          { de: "Alle",                     en: "All" },
  tech:         { de: "Tech & Developer",         en: "Tech & Developers" },
  wissenschaft: { de: "Wissenschaft",             en: "Science" },
  geopolitik:   { de: "Geopolitik",               en: "Geopolitics" },
  makro:        { de: "Makroökonomie",            en: "Macroeconomics" },
  gesellschaft: { de: "Gesellschaft",             en: "Society" },
  news:         { de: "News & Medien",            en: "News & Media" },
  klima:        { de: "Klima & Umwelt",           en: "Climate & Environment" },
  gesundheit:   { de: "Gesundheit",               en: "Health" },
  prognose:     { de: "Prognosemärkte",           en: "Prediction Markets" },
  // New categories introduced by the planned-connectors roadmap
  wetten:       { de: "Wettmärkte",               en: "Betting Markets" },
  kultur:       { de: "Kultur & Entertainment",   en: "Culture & Entertainment" },
  gaming:       { de: "Gaming",                   en: "Gaming" },
  crypto:       { de: "Finanzen & Crypto",        en: "Finance & Crypto" },
  cyber:        { de: "Cybersecurity",            en: "Cybersecurity" },
  energie:      { de: "Energie & Rohstoffe",      en: "Energy & Commodities" },
  recht:        { de: "Gesetzgebung",             en: "Legislation" },
  arbeit:       { de: "Arbeitsmarkt",             en: "Labor Market" },
  migration:    { de: "Migration",                en: "Migration" },
  mobilitaet:   { de: "Mobilität",                en: "Mobility" },
  agrar:        { de: "Nahrungsmittel & Agrar",   en: "Food & Agriculture" },
  supply:       { de: "Supply Chain",             en: "Supply Chain" },
  publishing:   { de: "Publishing & Podcasts",    en: "Publishing & Podcasts" },
  foresight:    { de: "Foresight",                en: "Foresight" },
  umfragen:     { de: "Umfragen",                 en: "Surveys" },
  // "forschung" is a special pseudo-category: selecting it switches the view
  // from the live-connector table to the curated research source grid.
  forschung:    { de: "Forschung",                en: "Research" },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

const CONNECTOR_CATEGORY: Record<string, CategoryKey> = {
  hackernews: "tech", github: "tech", reddit: "gesellschaft", "stackoverflow": "tech",
  "npm-pypi": "tech", producthunt: "tech", "docker-hub": "tech", bluesky: "gesellschaft",
  "mastodon-api": "gesellschaft", wikipedia: "wissenschaft",
  arxiv: "wissenschaft", openalex: "wissenschaft", crossref: "wissenschaft",
  "semantic-scholar": "wissenschaft", patentsview: "wissenschaft",
  gdelt: "geopolitik", acled: "geopolitik", ucdp: "geopolitik", vdem: "geopolitik",
  worldmonitor: "geopolitik",
  worldbank: "makro", eurostat: "makro", fred: "makro", oecd: "makro",
  owid: "wissenschaft", destatis: "makro", bls: "makro", imf: "makro",
  finnhub: "makro", "open-exchange": "makro",
  news: "news", nyt: "news", newsdata: "news", guardian: "news", "media-cloud": "news",
  "nasa-eonet": "klima", "open-meteo": "klima",
  "who-gho": "gesundheit", ilo: "gesundheit",
  polymarket: "prognose", manifold: "prognose", metaculus: "prognose", kalshi: "prognose",
  "google-trends": "tech", sentiment: "news",
  "un-data": "makro", "un-sdg": "makro",
};

const CONNECTOR_TYPE: Record<string, TypeBadgeKind> = {
  hackernews: "live-signal", github: "live-signal", reddit: "social",
  "stackoverflow": "live-signal", "npm-pypi": "live-signal",
  producthunt: "live-signal", "docker-hub": "live-signal",
  bluesky: "social", "mastodon-api": "social",
  arxiv: "forschung", openalex: "forschung", crossref: "forschung",
  "semantic-scholar": "forschung", patentsview: "forschung", wikipedia: "forschung",
  gdelt: "live-signal", acled: "live-signal", ucdp: "forschung", vdem: "forschung",
  worldmonitor: "live-signal",
  worldbank: "forschung", eurostat: "forschung", fred: "forschung",
  oecd: "forschung", owid: "forschung", destatis: "forschung", bls: "forschung",
  imf: "forschung", finnhub: "live-signal", "open-exchange": "live-signal",
  news: "live-signal", nyt: "live-signal", newsdata: "live-signal",
  guardian: "live-signal", "media-cloud": "live-signal", sentiment: "live-signal",
  "nasa-eonet": "live-signal", "open-meteo": "live-signal",
  "who-gho": "forschung", ilo: "forschung",
  polymarket: "prognose", manifold: "prognose", metaculus: "prognose", kalshi: "prognose",
  "google-trends": "live-signal",
  "un-data": "forschung", "un-sdg": "forschung",
};

// Short descriptions per connector (derived from Volt UI sample)
const DESCRIPTIONS: Record<string, { de: string; en: string }> = {
  hackernews:      { de: "Tech-Community Headlines, Diskussionen, Upvotes", en: "Tech community headlines, discussions, upvotes" },
  github:          { de: "Trending Repos, Stars, Forks — Tech-Adoption", en: "Trending repos, stars, forks — tech adoption" },
  reddit:          { de: "Diskussionen aus 16 Tech-Subreddits", en: "Discussions from 16 tech subreddits" },
  "stackoverflow": { de: "Tag-Volumen als Developer-Aktivitäts-Indikator", en: "Tag volume as developer activity indicator" },
  "npm-pypi":      { de: "Download-Trends für JS/Python-Pakete", en: "Download trends for JS/Python packages" },
  producthunt:    { de: "Neue Tech-Produkte und Startups täglich", en: "New tech products and startups daily" },
  "docker-hub":    { de: "Container Pull-Zahlen als Adoption-Signal", en: "Container pull counts as adoption signal" },
  bluesky:         { de: "Dezentrales Social, Tech-Community", en: "Decentralized social, tech community" },
  "mastodon-api":  { de: "Dezentrales Social, EU Tech/Wissenschaft", en: "Decentralized social, EU tech/science" },
  wikipedia:       { de: "Pageviews als Aufmerksamkeits-Indikator", en: "Pageviews as attention indicator" },
  arxiv:           { de: "Preprints: Physics, CS, Bio — frühestes Signal", en: "Preprints: Physics, CS, Bio — earliest signal" },
  openalex:        { de: "250M+ Works, Zitations-Analyse, Konzept-Trends", en: "250M+ works, citation analysis, concept trends" },
  crossref:        { de: "150M+ DOI-Metadaten, Publikationsvolumen", en: "150M+ DOI metadata, publication volume" },
  "semantic-scholar": { de: "220M+ Papers, semantische Suche, Citations", en: "220M+ papers, semantic search, citations" },
  patentsview:     { de: "US-Patent-Trends als Innovationsindikator", en: "US patent trends as innovation indicator" },
  gdelt:            { de: "15-Min-Updates, 100+ Sprachen, Sentiment", en: "15-min updates, 100+ languages, sentiment" },
  acled:            { de: "Konflikte & politische Gewalt weltweit", en: "Conflicts & political violence worldwide" },
  ucdp:             { de: "Uppsala Conflict Data Program — Kriegsdaten", en: "Uppsala Conflict Data Program — war data" },
  vdem:             { de: "Democracy index, Demokratie-Qualität", en: "Democracy index, democracy quality" },
  worldmonitor:     { de: "22 globale Domains: Geopolitik-Monitor", en: "22 global domains: geopolitical monitor" },
  worldbank:       { de: "Wirtschaftsindikatoren, 200+ Länder", en: "Economic indicators, 200+ countries" },
  eurostat:        { de: "EU-Wirtschafts- und Sozialstatistiken", en: "EU economic and social statistics" },
  fred:            { de: "US Federal Reserve Economic Data", en: "US Federal Reserve economic data" },
  oecd:            { de: "OECD-Länder Wirtschaftsdaten", en: "OECD country economic data" },
  owid:            { de: "Our World in Data — globale Stats", en: "Our World in Data — global stats" },
  destatis:        { de: "Statistisches Bundesamt Deutschland", en: "German Federal Statistical Office" },
  bls:             { de: "US Bureau of Labor Statistics", en: "US Bureau of Labor Statistics" },
  imf:             { de: "IMF Finanz- und Wirtschaftsdaten", en: "IMF financial and economic data" },
  finnhub:         { de: "Börse, Aktien, Finanznachrichten in Echtzeit", en: "Stock market and financial news in real time" },
  "open-exchange": { de: "Währungskurse, Wechselkurse", en: "Currency rates, exchange rates" },
  news:            { de: "Allgemeine Nachrichten aus 100+ Quellen", en: "General news from 100+ sources" },
  nyt:             { de: "New York Times Top Stories API", en: "New York Times top stories API" },
  newsdata:        { de: "Multi-Sprachen Nachrichten-Feed", en: "Multi-language news feed" },
  guardian:        { de: "The Guardian Content API", en: "The Guardian content API" },
  "media-cloud":   { de: "Media Cloud — Medien-Analyse", en: "Media Cloud — media analysis" },
  sentiment:       { de: "Sentiment-Analyse aus News und Social", en: "Sentiment analysis from news and social" },
  "nasa-eonet":    { de: "NASA Earth Observatory: Naturereignisse", en: "NASA Earth Observatory: natural events" },
  "open-meteo":    { de: "Wetter- und Klimadaten global", en: "Weather and climate data globally" },
  "who-gho":       { de: "WHO Global Health Observatory", en: "WHO Global Health Observatory" },
  ilo:             { de: "International Labour Organization", en: "International Labour Organization" },
  polymarket:      { de: "Prediction Markets — DeFi Basis", en: "Prediction markets — DeFi-based" },
  manifold:        { de: "Prediction Markets — Community", en: "Prediction markets — community-driven" },
  metaculus:       { de: "Expert Forecasting Platform", en: "Expert forecasting platform" },
  kalshi:          { de: "Regulierte US-Event-Märkte", en: "Regulated US event markets" },
  "google-trends": { de: "Google-Suchtrends als Attention-Indikator", en: "Google search trends as attention indicator" },
  "un-data":       { de: "UN Statistical Division Daten", en: "UN Statistical Division data" },
  "un-sdg":        { de: "UN Sustainable Development Goals Tracker", en: "UN Sustainable Development Goals tracker" },
};

interface QuellenTableProps {
  de: boolean;
}

type StatusFilter = "all" | "aktiv" | "geplant";

// Unified row shape — works for both live connectors and planned entries.
interface UnifiedRow {
  key: string;
  displayName: string;
  category: CategoryKey;
  type: TypeBadgeKind;
  descDe: string;
  descEn: string;
  status: StatusKind; // "aktiv" | "inaktiv" | "geplant"
  docUrl?: string;
  priority?: "high" | "medium" | "low";
}

export default function QuellenTable({ de }: QuellenTableProps) {
  const [statusMap, setStatusMap] = useState<Record<string, { lastRunAt?: string; status?: string }>>({});
  const [activeFilter, setActiveFilter] = useState<CategoryKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/v1/sources/status")
      .then((r) => r.json())
      .then((data) => {
        const list = data?.connectors || data?.sources || [];
        if (Array.isArray(list)) {
          const map: Record<string, { lastRunAt?: string; status?: string }> = {};
          for (const s of list) {
            map[s.name] = {
              lastRunAt: s.lastFetch || s.lastRunAt,
              status: s.status || s.lastStatus,
            };
          }
          setStatusMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Derive a single unified row list from live connectors AND planned
  // connectors. The table then filters/sorts once and the rendering logic
  // stays uniform — a live row and a planned row only differ by `status`.
  const allRows: UnifiedRow[] = useMemo(() => {
    const liveRows: UnifiedRow[] = connectors.map((c) => {
      const stat = statusMap[c.name] || {};
      let isActive = false;
      if (stat.status === "active" || stat.status === "ok" || stat.status === "fresh") {
        isActive = true;
      } else if (stat.lastRunAt) {
        const age = Date.now() - new Date(stat.lastRunAt).getTime();
        isActive = age < 24 * 60 * 60 * 1000;
      }
      const category = (CONNECTOR_CATEGORY[c.name] || "tech") as CategoryKey;
      const type = (CONNECTOR_TYPE[c.name] || "live-signal") as TypeBadgeKind;
      const desc = DESCRIPTIONS[c.name] || { de: c.displayName, en: c.displayName };
      return {
        key: `live:${c.name}`,
        displayName: c.displayName,
        category,
        type,
        descDe: desc.de,
        descEn: desc.en,
        status: isActive ? "aktiv" : "inaktiv",
      } as UnifiedRow;
    });

    const plannedRows: UnifiedRow[] = PLANNED_CONNECTORS.map((p) => ({
      key: `planned:${p.slug}`,
      displayName: p.displayName,
      category: p.category as CategoryKey,
      type: p.type as TypeBadgeKind,
      descDe: p.descriptionDe,
      descEn: p.descriptionEn,
      status: "geplant",
      docUrl: p.docUrl,
      priority: p.priority,
    }));

    return [...liveRows, ...plannedRows];
  }, [statusMap]);

  // Category counts cover live + planned so filter-pills reflect the
  // full roadmap, not just the live connectors.
  const categoryCounts = useMemo(() => {
    const map = new Map<CategoryKey, number>();
    for (const r of allRows) {
      map.set(r.category, (map.get(r.category) ?? 0) + 1);
    }
    return map;
  }, [allRows]);

  // Apply all three filters (category, status, search) in one pass.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (activeFilter === "forschung") return false; // handled by research grid
      if (activeFilter !== "all" && r.category !== activeFilter) return false;
      if (statusFilter === "aktiv" && r.status !== "aktiv") return false;
      if (statusFilter === "geplant" && r.status !== "geplant") return false;
      if (q) {
        const hay = `${r.displayName} ${r.descDe} ${r.descEn}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, activeFilter, statusFilter, search]);

  // Sort rows: aktiv first, then geplant (by priority), then inaktiv.
  const sorted = useMemo(() => {
    const prioRank = { high: 0, medium: 1, low: 2 } as const;
    return [...filtered].sort((a, b) => {
      const statusRank = (s: StatusKind) =>
        s === "aktiv" ? 0 : s === "geplant" ? 1 : 2;
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;
      if (a.status === "geplant" && b.status === "geplant") {
        const ar = prioRank[a.priority ?? "low"];
        const br = prioRank[b.priority ?? "low"];
        if (ar !== br) return ar - br;
      }
      return a.displayName.localeCompare(b.displayName, de ? "de" : "en");
    });
  }, [filtered, de]);

  const liveCount = connectors.length;
  const activeCount = allRows.filter((r) => r.status === "aktiv").length;
  const plannedCount = PLANNED_CONNECTORS.length;

  // Research sources — a curated grid of non-realtime reference sources.
  // Shown when the "Forschung" filter pill is selected.
  const researchSources = Object.entries(SOURCE_REGISTRY);
  const filteredResearch = useMemo(() => {
    if (activeFilter !== "forschung") return [];
    const q = search.trim().toLowerCase();
    if (!q) return researchSources;
    return researchSources.filter(([key, src]) =>
      (src.name?.toLowerCase() ?? "").includes(q)
      || key.toLowerCase().includes(q)
      || (src.description?.toLowerCase() ?? "").includes(q)
    );
  }, [activeFilter, search, researchSources]);

  const showResearch = activeFilter === "forschung";

  return (
    <div style={{ padding: "24px", maxWidth: 1360, margin: "0 auto" }}>
      {/* Section header */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--foreground)",
          margin: "0 0 6px",
        }}
      >
        {de ? "Datenquellen" : "Data Sources"}
      </h2>

      {/* Stats line — live-first, planned as transparent roadmap */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--muted-foreground)",
          margin: "0 0 20px",
        }}
      >
        {showResearch ? (
          <>
            {researchSources.length} {de ? "kuratierte Forschungs- und Beratungsquellen" : "curated research and consulting sources"}
          </>
        ) : (
          <>
            {liveCount} {de ? "Live-Quellen" : "live sources"} ·{" "}
            <span style={{ color: "#1A9E5A", fontWeight: 600 }}>
              {activeCount} {de ? "aktiv" : "active"}
            </span>
            {" · "}
            <span style={{ color: "#7A5C00", fontWeight: 600 }}>
              {plannedCount} {de ? "geplant" : "planned"}
            </span>
          </>
        )}
      </p>

      {/* Unified filter-pills + search row.
           Top row: category filter (all live + planned categories).
           Bottom row: status segmented control (Alle / Aktiv / Geplant).
           "Forschung" is a pseudo-category that switches the view from
           the unified table to the curated research grid. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
          {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => {
            // Skip empty categories (nothing live AND nothing planned) to keep the
            // pill row tight. "all" and "forschung" are always shown.
            if (key !== "all" && key !== "forschung") {
              const count = categoryCounts.get(key) ?? 0;
              if (count === 0) return null;
            }
            return (
              <VoltFilterPill
                key={key}
                active={activeFilter === key}
                onClick={() => setActiveFilter(key)}
              >
                {de ? CATEGORIES[key].de : CATEGORIES[key].en}
              </VoltFilterPill>
            );
          })}
        </div>
        <SearchBox value={search} onChange={setSearch} de={de} />
      </div>

      {/* Status segmented control — only shown when not in research mode */}
      {!showResearch && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--volt-text-faint, #999)",
            marginRight: 4,
          }}>
            {de ? "Status" : "Status"}
          </span>
          {(["all", "aktiv", "geplant"] as const).map((k) => {
            const active = statusFilter === k;
            const label = k === "all"
              ? (de ? "Alle" : "All")
              : k === "aktiv"
                ? (de ? "Live (aktiv)" : "Live (active)")
                : (de ? "Geplant (Roadmap)" : "Planned (roadmap)");
            const count = k === "all"
              ? allRows.length
              : k === "aktiv"
                ? activeCount
                : plannedCount;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setStatusFilter(k)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: active ? "1px solid var(--volt-text, #0A0A0A)" : "1px solid var(--volt-border, #E8E8E8)",
                  background: active ? "var(--volt-text, #0A0A0A)" : "var(--volt-surface-raised, #fff)",
                  color: active ? "#fff" : "var(--volt-text-muted, #6B6B6B)",
                  cursor: "pointer",
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  transition: "all 120ms ease",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {label}
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  opacity: active ? 0.8 : 0.5,
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Connectors table — shown when a normal category (or "all") is active */}
      {!showResearch && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--card)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-ui)" }}>
            <thead>
              <tr style={{ background: "var(--muted, #F7F7F7)" }}>
                <Th>{de ? "Quelle" : "Source"}</Th>
                <Th>{de ? "Kategorie" : "Category"}</Th>
                <Th>{de ? "Typ" : "Type"}</Th>
                <Th style={{ width: "44%" }}>{de ? "Beschreibung" : "Description"}</Th>
                <Th style={{ width: 100, textAlign: "center" }}>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isPlanned = r.status === "geplant";
                return (
                  <tr
                    key={r.key}
                    style={{
                      borderTop: "1px solid var(--color-border)",
                      transition: "background 0.1s",
                      opacity: isPlanned ? 0.82 : 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted, #F7F7F7)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 6 }}>
                        {r.displayName}
                        {isPlanned && r.priority === "high" && (
                          <span
                            title={de ? "Hohe Priorität in der Roadmap" : "High priority on the roadmap"}
                            style={{
                              fontSize: 9,
                              color: "#C8102E",
                              fontWeight: 700,
                            }}
                          >●</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        {de ? CATEGORIES[r.category].de : CATEGORIES[r.category].en}
                      </span>
                    </Td>
                    <Td>
                      <VoltTypeBadge kind={r.type} />
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                        {de ? r.descDe : r.descEn}
                      </span>
                    </Td>
                    <Td style={{ textAlign: "center" }}>
                      <VoltStatusBadge kind={r.status} />
                    </Td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "40px 16px",
                      textAlign: "center",
                      color: "var(--muted-foreground)",
                      fontSize: 13,
                    }}
                  >
                    {de ? "Keine Quellen gefunden" : "No sources found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Research source grid — shown when "Forschung" pill is active */}
      {showResearch && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(
            filteredResearch.reduce<Record<string, typeof filteredResearch>>((acc, entry) => {
              const cat = entry[1].category || "Other";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(entry);
              return acc;
            }, {})
          )
            .sort((a, b) => b[1].length - a[1].length)
            .map(([cat, items]) => (
              <div key={cat}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  {cat} ({items.length})
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 10,
                  }}
                >
                  {items.map(([key, src]) => (
                    <ResearchCard key={key} src={src} de={de} />
                  ))}
                </div>
              </div>
            ))}
          {filteredResearch.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
              {de ? "Keine Forschungsquellen gefunden" : "No research sources found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function SearchBox({ value, onChange, de }: { value: string; onChange: (v: string) => void; de: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        border: "1px solid var(--color-border)",
        borderRadius: 9999,
        background: "var(--card)",
        minWidth: 200,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={de ? "Suchen..." : "Search..."}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 12,
          fontFamily: "var(--font-ui)",
          color: "var(--foreground)",
          width: "100%",
        }}
      />
    </div>
  );
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: "12px 14px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--muted-foreground)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "12px 14px",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function ResearchCard({ src, de }: { src: any; de: boolean }) {
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
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--foreground)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-display)" }}>
          {src.name}
        </div>
        {src.access && (
          <VoltStatusBadge kind={src.access === "free" ? "frei" : (src.access === "paid" ? "key" : "key")} />
        )}
      </div>
      {src.description && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4, marginBottom: 6 }}>
          {src.description}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 10,
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--muted-foreground)",
        }}
      >
        {src.frequency && <span>{src.frequency}</span>}
        {src.geoFocus && <span>· {src.geoFocus}</span>}
      </div>
    </a>
  );
}
