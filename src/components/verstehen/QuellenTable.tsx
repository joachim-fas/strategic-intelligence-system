"use client";

/**
 * QuellenTable — Implements the Volt UI "Quellen-Tabelle" template.
 *
 * Spec from https://grainui-jddpkx7p.manus.space/ (Templates & Visualisierung):
 *   "Vollständige Quellen-Verwaltungsansicht mit Filter-Pills, Suchfeld,
 *    Typ-Badges und Status/Auth-Spalten."
 *
 * Used as the "Quellen" tab in /cockpit.
 *
 * Layout:
 *   [Header: "X Quellen · X aktiv · X brauchen Key"   🔍 Suchen...]
 *   [Filter pills: Alle · Tech & Developer · Wissenschaft · ...]
 *   [Table: Quelle | Kategorie | Typ | Beschreibung | Status | Auth]
 *
 * Auth "KEY" badge is shown for connectors that need an API key.
 * Typ badges: LIVE-SIGNAL / SOCIAL / FORSCHUNG / PROGNOSE
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { connectors } from "@/connectors";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { PLANNED_CONNECTORS } from "@/lib/planned-connectors";
import {
  CATEGORIES,
  CATEGORY_TO_MACRO,
  STEEP_V_META,
  STEEP_V_ORDER,
  type CategoryKey,
  type SteepVKey,
} from "@/lib/source-taxonomy";
import {
  VoltFilterPill,
  VoltTypeBadge,
  VoltStatusBadge,
  TypeBadgeKind,
  StatusKind,
} from "./VoltPrimitives";

// ─── Live connector → fine category / type mapping ─────────────────────
// Live connectors resolve their fine category here (planned connectors
// carry it directly on the PlannedConnector type). The fine category is
// then mapped to a STEEP+V bucket via CATEGORY_TO_MACRO from
// source-taxonomy.ts so the macro filter row works for both kinds.
const CONNECTOR_CATEGORY: Record<string, Exclude<CategoryKey, "all" | "forschung">> = {
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
  // ── Batch-5 (2026-04): added here so STEEP+V buckets are honest ─────
  coingecko:       "crypto",
  "defi-llama":    "crypto",
  clinicaltrials:  "gesundheit",
  openfda:         "gesundheit",
  unhcr:           "migration",
  nextstrain:      "gesundheit",
  // ── Batch-6 (2026-04): newest live connectors ──────────────────────
  steamspy:            "gaming",
  "google-ngram":      "publishing",
  "usgs-earthquake":   "klima",
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
  // ── Batch-5 (2026-04) ───────────────────────────────────────────────
  coingecko:       "live-signal",
  "defi-llama":    "live-signal",
  clinicaltrials:  "forschung",
  openfda:         "live-signal",
  unhcr:           "live-signal",
  nextstrain:      "live-signal",
  // ── Batch-6 (2026-04) ───────────────────────────────────────────────
  steamspy:            "live-signal",
  "google-ngram":      "forschung",
  "usgs-earthquake":   "live-signal",
};

// Short descriptions + doc URLs per connector
const DESCRIPTIONS: Record<string, { de: string; en: string; url?: string }> = {
  hackernews:      { de: "Tech-Community Headlines, Diskussionen, Upvotes", en: "Tech community headlines, discussions, upvotes", url: "https://news.ycombinator.com/" },
  github:          { de: "Trending Repos, Stars, Forks — Tech-Adoption", en: "Trending repos, stars, forks — tech adoption", url: "https://docs.github.com/en/rest" },
  reddit:          { de: "Diskussionen aus 16 Tech-Subreddits", en: "Discussions from 16 tech subreddits", url: "https://www.reddit.com/dev/api/" },
  "stackoverflow": { de: "Tag-Volumen als Developer-Aktivitäts-Indikator", en: "Tag volume as developer activity indicator", url: "https://api.stackexchange.com/docs" },
  "npm-pypi":      { de: "Download-Trends für JS/Python-Pakete", en: "Download trends for JS/Python packages", url: "https://github.com/npm/registry/blob/main/docs/download-counts.md" },
  producthunt:    { de: "Neue Tech-Produkte und Startups täglich", en: "New tech products and startups daily", url: "https://www.producthunt.com/" },
  "docker-hub":    { de: "Container Pull-Zahlen als Adoption-Signal", en: "Container pull counts as adoption signal", url: "https://docs.docker.com/docker-hub/api/latest/" },
  bluesky:         { de: "Dezentrales Social, Tech-Community", en: "Decentralized social, tech community", url: "https://docs.bsky.app/" },
  "mastodon-api":  { de: "Dezentrales Social, EU Tech/Wissenschaft", en: "Decentralized social, EU tech/science", url: "https://docs.joinmastodon.org/api/" },
  wikipedia:       { de: "Pageviews als Aufmerksamkeits-Indikator", en: "Pageviews as attention indicator", url: "https://wikimedia.org/api/rest_v1/" },
  arxiv:           { de: "Preprints: Physics, CS, Bio — frühestes Signal", en: "Preprints: Physics, CS, Bio — earliest signal", url: "https://info.arxiv.org/help/api/index.html" },
  openalex:        { de: "250M+ Works, Zitations-Analyse, Konzept-Trends", en: "250M+ works, citation analysis, concept trends", url: "https://docs.openalex.org/" },
  crossref:        { de: "150M+ DOI-Metadaten, Publikationsvolumen", en: "150M+ DOI metadata, publication volume", url: "https://api.crossref.org/" },
  "semantic-scholar": { de: "220M+ Papers, semantische Suche, Citations", en: "220M+ papers, semantic search, citations", url: "https://api.semanticscholar.org/" },
  patentsview:     { de: "US-Patent-Trends als Innovationsindikator", en: "US patent trends as innovation indicator", url: "https://patentsview.org/apis/api-endpoints" },
  gdelt:            { de: "15-Min-Updates, 100+ Sprachen, Sentiment", en: "15-min updates, 100+ languages, sentiment", url: "https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/" },
  acled:            { de: "Konflikte & politische Gewalt weltweit", en: "Conflicts & political violence worldwide", url: "https://acleddata.com/acleddatanew/wp-content/uploads/dlm_uploads/2023/01/API-User-Guide_2023.pdf" },
  ucdp:             { de: "Uppsala Conflict Data Program — Kriegsdaten", en: "Uppsala Conflict Data Program — war data", url: "https://ucdp.uu.se/apidocs/" },
  vdem:             { de: "Democracy index, Demokratie-Qualität", en: "Democracy index, democracy quality", url: "https://www.v-dem.net/data/" },
  worldmonitor:     { de: "22 globale Domains: Geopolitik-Monitor", en: "22 global domains: geopolitical monitor" },
  worldbank:       { de: "Wirtschaftsindikatoren, 200+ Länder", en: "Economic indicators, 200+ countries", url: "https://datahelpdesk.worldbank.org/knowledgebase/articles/898581" },
  eurostat:        { de: "EU-Wirtschafts- und Sozialstatistiken", en: "EU economic and social statistics", url: "https://ec.europa.eu/eurostat/web/main/data/database" },
  fred:            { de: "US Federal Reserve Economic Data", en: "US Federal Reserve economic data", url: "https://fred.stlouisfed.org/docs/api/fred/" },
  oecd:            { de: "OECD-Länder Wirtschaftsdaten", en: "OECD country economic data", url: "https://data.oecd.org/" },
  owid:            { de: "Our World in Data — globale Stats", en: "Our World in Data — global stats", url: "https://docs.owid.io/projects/etl/" },
  destatis:        { de: "Statistisches Bundesamt Deutschland", en: "German Federal Statistical Office", url: "https://www-genesis.destatis.de/genesis/online" },
  bls:             { de: "US Bureau of Labor Statistics", en: "US Bureau of Labor Statistics", url: "https://www.bls.gov/developers/" },
  imf:             { de: "IMF Finanz- und Wirtschaftsdaten", en: "IMF financial and economic data", url: "https://datahelp.imf.org/knowledgebase/articles/667681" },
  finnhub:         { de: "Börse, Aktien, Finanznachrichten in Echtzeit", en: "Stock market and financial news in real time", url: "https://finnhub.io/docs/api" },
  "open-exchange": { de: "Währungskurse, Wechselkurse", en: "Currency rates, exchange rates", url: "https://openexchangerates.org/api" },
  news:            { de: "Allgemeine Nachrichten aus 100+ Quellen", en: "General news from 100+ sources" },
  nyt:             { de: "New York Times Top Stories API", en: "New York Times top stories API", url: "https://developer.nytimes.com/apis" },
  newsdata:        { de: "Multi-Sprachen Nachrichten-Feed", en: "Multi-language news feed", url: "https://newsdata.io/documentation" },
  guardian:        { de: "The Guardian Content API", en: "The Guardian content API", url: "https://open-platform.theguardian.com/documentation/" },
  "media-cloud":   { de: "Media Cloud — Medien-Analyse", en: "Media Cloud — media analysis", url: "https://mediacloud.org/" },
  sentiment:       { de: "Sentiment-Analyse aus News und Social", en: "Sentiment analysis from news and social" },
  "nasa-eonet":    { de: "NASA Earth Observatory: Naturereignisse", en: "NASA Earth Observatory: natural events", url: "https://eonet.gsfc.nasa.gov/docs/v3" },
  "open-meteo":    { de: "Wetter- und Klimadaten global", en: "Weather and climate data globally", url: "https://open-meteo.com/en/docs" },
  "who-gho":       { de: "WHO Global Health Observatory", en: "WHO Global Health Observatory", url: "https://www.who.int/data/gho/info/gho-odata-api" },
  ilo:             { de: "International Labour Organization", en: "International Labour Organization", url: "https://www.ilo.org/ilostat-files/Documents/SDMX_User_Guide.pdf" },
  polymarket:      { de: "Prediction Markets — DeFi Basis", en: "Prediction markets — DeFi-based", url: "https://docs.polymarket.com/" },
  manifold:        { de: "Prediction Markets — Community", en: "Prediction markets — community-driven", url: "https://docs.manifold.markets/api" },
  metaculus:       { de: "Expert Forecasting Platform", en: "Expert forecasting platform", url: "https://www.metaculus.com/api/" },
  kalshi:          { de: "Regulierte US-Event-Märkte", en: "Regulated US event markets", url: "https://trading-api.readme.io/reference/getevents" },
  "google-trends": { de: "Google-Suchtrends als Attention-Indikator", en: "Google search trends as attention indicator", url: "https://trends.google.com/" },
  "un-data":       { de: "UN Statistical Division Daten", en: "UN Statistical Division data", url: "https://data.un.org/" },
  "un-sdg":        { de: "UN Sustainable Development Goals Tracker", en: "UN Sustainable Development Goals tracker", url: "https://unstats.un.org/sdgs/dataportal" },
  // ── Batch-6 (2026-04) ───────────────────────────────────────────────
  steamspy:            { de: "Steam-Spiele: Spielerzahlen, Genre-Trends", en: "Steam games: player counts, genre trends", url: "https://steamspy.com/api.php" },
  "google-ngram":      { de: "Buch-Korpus Worthäufigkeit seit 1500", en: "Book corpus word frequency since 1500", url: "https://books.google.com/ngrams" },
  "usgs-earthquake":   { de: "USGS Erdbeben-Daten, weltweit in Echtzeit", en: "USGS earthquake data, worldwide real-time", url: "https://earthquake.usgs.gov/fdsnws/event/1/" },
};

// Grid column template shared by the header row and every data row.
// 5 columns: Source | Kategorie | Typ | Status | Docs
const GRID_COLS = "minmax(220px, 2fr) minmax(120px, 1fr) minmax(90px, 0.6fr) minmax(100px, auto) 60px";

interface QuellenTableProps {
  de: boolean;
}

type StatusFilter = "all" | "aktiv" | "geplant";

// Unified row shape — works for both live connectors and planned entries.
interface UnifiedRow {
  key: string;
  displayName: string;
  slug: string;             // machine id rendered under the display name
  category: CategoryKey;
  type: TypeBadgeKind;
  descDe: string;
  descEn: string;
  status: StatusKind;
  docUrl?: string;
  priority?: "high" | "medium" | "low";
}

export default function QuellenTable({ de }: QuellenTableProps) {
  const locale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const [statusMap, setStatusMap] = useState<Record<string, { lastRunAt?: string; status?: string }>>({});
  const [activeMacro, setActiveMacro] = useState<SteepVKey | "all">("all");
  const [activeFilter, setActiveFilter] = useState<CategoryKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "category" | "type" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSort = useCallback((col: "name" | "category" | "type" | "status") => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }, [sortCol]);

  useEffect(() => {
    fetchWithTimeout("/api/v1/sources/status")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data ?? json;
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
      if (stat.status === "active" || stat.status === "ok" || stat.status === "fresh" || stat.status === "stale") {
        // "stale" = data exists but > 12h old. Still counts as active since
        // the connector works — it just hasn't run recently.
        isActive = true;
      } else if (stat.lastRunAt) {
        const age = Date.now() - new Date(stat.lastRunAt).getTime();
        isActive = age < 7 * 24 * 60 * 60 * 1000; // 7 days — generous for batch connectors
      }
      const category = (CONNECTOR_CATEGORY[c.name] || "tech") as CategoryKey;
      const type = (CONNECTOR_TYPE[c.name] || "live-signal") as TypeBadgeKind;
      const desc = DESCRIPTIONS[c.name] || { de: c.displayName, en: c.displayName };
      return {
        key: `live:${c.name}`,
        displayName: c.displayName,
        slug: c.name,
        category,
        type,
        descDe: desc.de,
        descEn: desc.en,
        docUrl: desc.url,
        status: isActive ? "aktiv" : "inaktiv",
      } as UnifiedRow;
    });

    // Planned connectors resolve status from their backlog / needsKey
    // flags so the table surfaces those states automatically. Priority
    // order: backlog > needs-key > geplant. This is intentional — a
    // deferred-AND-keyed connector is more "backlog" than "keyed".
    const plannedRows: UnifiedRow[] = PLANNED_CONNECTORS.map((p) => {
      const status: StatusKind = p.backlog
        ? "backlog"
        : p.needsKey
          ? "needs-key"
          : "geplant";
      return {
        key: `planned:${p.slug}`,
        displayName: p.displayName,
        slug: p.slug,
        category: p.category as CategoryKey,
        type: p.type as TypeBadgeKind,
        descDe: p.descriptionDe,
        descEn: p.descriptionEn,
        status,
        docUrl: p.docUrl,
        priority: p.priority,
      };
    });

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

  // Counts per STEEP+V macro bucket so the macro filter row shows live
  // numbers. "forschung" has no actual connectors, so the values bucket
  // only counts explicit "foresight" entries here — the forschung pseudo
  // is added visually but not counted.
  const macroCounts = useMemo(() => {
    const map = new Map<SteepVKey, number>();
    for (const r of allRows) {
      if (r.category === "forschung" || r.category === "all") continue;
      const macro = CATEGORY_TO_MACRO[r.category];
      if (macro) map.set(macro, (map.get(macro) ?? 0) + 1);
    }
    return map;
  }, [allRows]);

  // Apply all four filters (macro, category, status, search) in one pass.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (activeFilter === "forschung") return false; // handled by research grid
      if (activeMacro !== "all" && r.category !== "forschung" && r.category !== "all") {
        if (CATEGORY_TO_MACRO[r.category] !== activeMacro) return false;
      }
      if (activeFilter !== "all" && r.category !== activeFilter) return false;
      if (statusFilter === "aktiv" && r.status !== "aktiv") return false;
      if (statusFilter === "geplant" && !(r.status === "geplant" || r.status === "backlog" || r.status === "needs-key")) return false;
      if (q) {
        const hay = `${r.displayName} ${r.slug} ${r.descDe} ${r.descEn}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, activeMacro, activeFilter, statusFilter, search]);

  // Sort rows based on active sort column and direction.
  // Default ("status"): aktiv → geplant → needs-key → backlog → inaktiv → fehler.
  // Within "geplant", high-priority entries float to the top.
  const sorted = useMemo(() => {
    const prioRank = { high: 0, medium: 1, low: 2 } as const;
    const statusRank = (s: StatusKind): number => {
      switch (s) {
        case "aktiv":     return 0;
        case "geplant":   return 1;
        case "needs-key": return 2;
        case "backlog":   return 3;
        case "inaktiv":   return 4;
        case "fehler":    return 5;
        default:          return 6;
      }
    };
    const locale = de ? "de" : "en";
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name":
          cmp = a.displayName.localeCompare(b.displayName, locale);
          break;
        case "category": {
          const catA = de ? CATEGORIES[a.category].de : CATEGORIES[a.category].en;
          const catB = de ? CATEGORIES[b.category].de : CATEGORIES[b.category].en;
          cmp = catA.localeCompare(catB, locale);
          break;
        }
        case "type":
          cmp = a.type.localeCompare(b.type, locale);
          break;
        case "status":
        default: {
          const sr = statusRank(a.status) - statusRank(b.status);
          if (sr !== 0) return sr * dir;
          if ((a.status === "geplant" || a.status === "needs-key") && a.status === b.status) {
            const ar = prioRank[a.priority ?? "low"];
            const br = prioRank[b.priority ?? "low"];
            if (ar !== br) return (ar - br) * dir;
          }
          cmp = a.displayName.localeCompare(b.displayName, locale);
          break;
        }
      }
      return cmp * dir;
    });
  }, [filtered, de, sortCol, sortDir]);

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

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

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
        {tl("sources.heading")}
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
            {researchSources.length} {tl("sources.researchSubtitleSuffix")}
          </>
        ) : (
          <>
            {/* "Live-Quellen" war irrefuehrend, weil die Zahl alle
                 registrierten Connectors zaehlte — unabhaengig davon,
                 ob sie in den letzten Tagen Signale geliefert haben.
                 Jetzt klar getrennt: "Registriert" (installiert) vs.
                 "aktiv" (hat frische Signale) vs. "geplant" (Backlog). */}
            {liveCount} {tl("sources.registeredLabel")} ·{" "}
            <span style={{ color: activeCount > 0 ? "var(--signal-positive, #1A9E5A)" : "var(--signal-negative, #C0341D)", fontWeight: 600 }}>
              {activeCount} {tl("sources.activeLabel")}
            </span>
            {" · "}
            <span style={{ color: "var(--pastel-butter-text, #7A5C00)", fontWeight: 600 }}>
              {plannedCount} {tl("sources.plannedLabel")}
            </span>
          </>
        )}
      </p>

      {/* ── Filter container ──────────────────────────────────────── */}
      <div style={{
        background: "var(--card, #fff)",
        border: "1px solid var(--color-border, #E8E8E8)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}>
        {/* Row 1: STEEP+V macro chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <MacroChip
            active={activeMacro === "all"}
            onClick={() => {
              setActiveMacro("all");
              if (activeFilter !== "all" && activeFilter !== "forschung") setActiveFilter("all");
            }}
            label={tl("sources.all")}
            count={allRows.length}
          />
          {[...STEEP_V_ORDER].sort((a, b) => {
            const la = de ? STEEP_V_META[a].labelDe : STEEP_V_META[a].labelEn;
            const lb = de ? STEEP_V_META[b].labelDe : STEEP_V_META[b].labelEn;
            return la.localeCompare(lb, de ? "de" : "en");
          }).map((key) => {
            const meta = STEEP_V_META[key];
            const Icon = meta.icon;
            const count = macroCounts.get(key) ?? 0;
            return (
              <MacroChip
                key={key}
                active={activeMacro === key}
                onClick={() => {
                  setActiveMacro(key);
                  if (
                    activeFilter !== "all" &&
                    activeFilter !== "forschung" &&
                    CATEGORY_TO_MACRO[activeFilter] !== key
                  ) {
                    setActiveFilter("all");
                  }
                }}
                label={de ? meta.labelDe : meta.labelEn}
                count={count}
                icon={<Icon size={13} strokeWidth={2} />}
                bg={meta.bg}
                text={meta.text}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--color-border, #E8E8E8)", margin: "10px 0" }} />

        {/* Row 2: Fine category pills — only shown when a STEEP+V macro is selected */}
        {activeMacro !== "all" && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--volt-text-faint, #999)",
            marginRight: 2,
            flexShrink: 0,
          }}>
            {tl("sources.category")}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
            {(Object.keys(CATEGORIES) as CategoryKey[]).sort((a, b) => {
              if (a === "all") return -1;
              if (b === "all") return 1;
              if (a === "forschung") return 1;
              if (b === "forschung") return -1;
              const labelA = de ? CATEGORIES[a].de : CATEGORIES[a].en;
              const labelB = de ? CATEGORIES[b].de : CATEGORIES[b].en;
              return labelA.localeCompare(labelB, de ? "de" : "en");
            }).map((key) => {
              if (key !== "all" && key !== "forschung") {
                const count = categoryCounts.get(key) ?? 0;
                if (count === 0) return null;
                if (CATEGORY_TO_MACRO[key] !== activeMacro) return null;
              }
              return (
                <VoltFilterPill
                  key={key}
                  active={activeFilter === key}
                  onClick={() => setActiveFilter(key)}
                  size="sm"
                >
                  {de ? CATEGORIES[key].de : CATEGORIES[key].en}
                </VoltFilterPill>
              );
            })}
          </div>
        </div>
        )}

        {/* Row 3: Status + Search — only shown when not in research mode */}
        {!showResearch && (
          <>
            <div style={{ borderTop: "1px solid var(--color-border, #E8E8E8)", margin: "10px 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--volt-text-faint, #999)",
                  marginRight: 4,
                }}>
                  {tl("sources.status")}
                </span>
                {(["all", "aktiv", "geplant"] as const).map((k) => {
                  const active = statusFilter === k;
                  const label = k === "all"
                    ? tl("sources.all")
                    : k === "aktiv"
                      ? tl("sources.statusLive")
                      : tl("sources.statusPlanned");
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
                        color: active ? "var(--background, #fff)" : "var(--volt-text-muted, #6B6B6B)",
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
              <SearchBox value={search} onChange={setSearch} de={de} />
            </div>
          </>
        )}
      </div>

      {/* Connectors grid — 4-column layout with sortable headers.
           Columns: Source | Kategorie | Typ | Status */}
      {!showResearch && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--card)",
          }}
        >
          <div style={{ minWidth: 640 }}>
            {/* Header row — clickable for column sorting */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: GRID_COLS,
                gap: 12,
                padding: "10px 20px",
                background: "var(--volt-surface, #FAFAFA)",
                borderBottom: "1px solid var(--volt-border, #EEE)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--volt-text-faint, #999)",
              }}
            >
              {([
                { col: "name" as const, key: "sources.colSource" as TranslationKey },
                { col: "category" as const, key: "sources.colCategory" as TranslationKey },
                { col: "type" as const, key: "sources.colType" as TranslationKey },
                { col: "status" as const, key: "sources.colStatus" as TranslationKey },
              ]).map(({ col, key }) => (
                <div
                  key={col}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort(col)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSort(col); }}
                  style={{
                    cursor: "pointer",
                    userSelect: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {tl(key)}
                  {sortCol === col && (
                    <span style={{ fontSize: 8, lineHeight: 1 }}>
                      {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </div>
              ))}
              {/* Docs column header — not sortable */}
              <div style={{ textAlign: "center" }}>Docs</div>
            </div>

            {/* Data rows — virtualized for performance at 500+ entries */}
            <div ref={scrollRef} style={{ maxHeight: "min(72vh, 800px)", overflowY: "auto" }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const idx = virtualRow.index;
                  const r = sorted[idx];
                  const isPlanned = r.status === "geplant" || r.status === "backlog" || r.status === "needs-key";
                  const isActiveRow = r.status === "aktiv";
                  const macroKey =
                    r.category !== "forschung" && r.category !== "all"
                      ? CATEGORY_TO_MACRO[r.category]
                      : undefined;
                  const macroMeta = macroKey ? STEEP_V_META[macroKey] : undefined;
                  const MacroIcon = macroMeta?.icon;
                  const desc = de ? r.descDe : r.descEn;
                  return (
                    <div
                      key={r.key}
                      data-index={idx}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: GRID_COLS,
                          gap: 12,
                          alignItems: "center",
                          padding: "12px 20px",
                          borderBottom: idx === sorted.length - 1 ? "none" : "1px solid var(--color-border)",
                          transition: "background-color 120ms ease",
                          borderLeft: isActiveRow
                            ? "3px solid var(--signal-positive, #1A9E5A)"
                            : "3px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(79,99,138,0.07)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Col 1: Source — name, description, doc link */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 5,
                            fontFamily: "var(--font-display)",
                            fontSize: 13, fontWeight: 600,
                            color: "var(--foreground)",
                            lineHeight: 1.3,
                          }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.displayName}
                            </span>
                            {isPlanned && r.priority === "high" && (
                              <span
                                title={tl("sources.highPriority")}
                                style={{ fontSize: 7, color: "var(--signal-negative, #C8102E)", fontWeight: 700, flexShrink: 0 }}
                              >&#9679;</span>
                            )}
                          </div>
                          {desc && (
                            <div style={{
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                              fontFamily: "var(--font-ui)",
                              lineHeight: 1.4,
                              marginTop: 2,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical" as const,
                              overflow: "hidden",
                            }}>
                              {desc}
                            </div>
                          )}
                        </div>

                        {/* Col 2: Kategorie — macro icon + fine category label */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {MacroIcon && macroMeta && (
                            <span
                              style={{
                                width: 22, height: 22, borderRadius: 5,
                                background: macroMeta.bg,
                                color: macroMeta.text,
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <MacroIcon size={12} strokeWidth={2.25} />
                            </span>
                          )}
                          <span style={{
                            fontSize: 12,
                            color: "var(--muted-foreground)",
                            fontFamily: "var(--font-ui)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {de ? CATEGORIES[r.category].de : CATEGORIES[r.category].en}
                          </span>
                        </div>

                        {/* Col 3: Typ */}
                        <div>
                          <VoltTypeBadge kind={r.type} />
                        </div>

                        {/* Col 4: Status */}
                        <div>
                          <VoltStatusBadge kind={r.status} />
                        </div>

                        {/* Col 5: Docs link */}
                        <div style={{ textAlign: "center" }}>
                          {r.docUrl ? (
                            <a
                              href={r.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={r.docUrl}
                              style={{
                                fontSize: 11, fontWeight: 600,
                                color: "var(--signal-positive, #1A9E5A)",
                                textDecoration: "none",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              Docs&thinsp;&#8599;
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)", opacity: 0.3 }}>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {sorted.length === 0 && (
              <div style={{
                padding: "40px 16px",
                textAlign: "center",
                color: "var(--muted-foreground)",
                fontSize: 13,
                fontFamily: "var(--font-ui)",
              }}>
                {tl("sources.noneFound")}
              </div>
            )}
          </div>
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
              {tl("sources.noResearchFound")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function SearchBox({ value, onChange, de }: { value: string; onChange: (v: string) => void; de: boolean }) {
  const locale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(locale, key);
  const [local, setLocal] = useState(value);
  const debounceTimer = useRef<NodeJS.Timeout>(undefined);

  // Sync external value changes (e.g. reset from parent)
  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = useCallback((v: string) => {
    setLocal(v);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChange(v);
    }, 250);
  }, [onChange]);

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

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
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={tl("sources.searchPlaceholder")}
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

// STEEP+V macro filter chip. Inline helper — this component is the only
// consumer. Active state uses the macro's own pastel bg/text so the chip
// visually matches the icon color in the Kategorie column of the rows
// belonging to that macro.
function MacroChip({
  active,
  onClick,
  label,
  count,
  icon,
  bg,
  text,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
  bg?: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 9999,
        border: active
          ? `1px solid ${text ?? "var(--foreground, #0A0A0A)"}`
          : "1px solid var(--color-border, #E8E8E8)",
        background: active ? (bg ?? "var(--foreground, #0A0A0A)") : "var(--card, #fff)",
        color: active ? (text ?? "var(--background, #fff)") : "var(--muted-foreground, #6B6B6B)",
        fontFamily: "var(--font-ui)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
          e.currentTarget.style.color = "var(--foreground, #0A0A0A)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--color-border, #E8E8E8)";
          e.currentTarget.style.color = "var(--muted-foreground, #6B6B6B)";
        }
      }}
    >
      {icon}
      <span>{label}</span>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        opacity: active ? 0.85 : 0.55,
      }}>{count}</span>
    </button>
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
