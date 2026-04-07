"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { AppHeader } from "@/components/AppHeader";

// ─── Complete source registry — ALL sources (integrated + planned) ──────────

interface SourceEntry {
  name: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "integrated" | "new" | "planned" | "download-only" | "deactivated";
  auth: "none" | "free-key" | "registration" | "download";
  apiEndpoint?: string;
  docsUrl?: string;
  description: string;
  signalCount?: number; // filled from DB at runtime
}

const ALL_SOURCES: SourceEntry[] = [
  // ── ALREADY INTEGRATED ──────────────────────────────────────────
  { name: "HackerNews", category: "Tech & Developer", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://hn.algolia.com/api/v1/search", description: "Tech-Community Headlines + Diskussionen" },
  { name: "GitHub Trending", category: "Tech & Developer", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://api.github.com/search/repositories", description: "Trending Repos, Stars, Forks als Tech-Trend-Indikatoren" },
  { name: "Reddit", category: "Tech & Developer", priority: "high", status: "integrated", auth: "free-key", description: "Community-Diskussionen aus 16 Tech-Subreddits" },
  { name: "arXiv", category: "Wissenschaft & Innovation", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://export.arxiv.org/api/query", description: "Preprints: Physics, CS, Bio, Economics — frühestes Forschungssignal" },
  { name: "OpenAlex", category: "Wissenschaft & Innovation", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://api.openalex.org/works", description: "250M+ Works, Zitations-Analyse, Konzept-Trends" },
  { name: "GDELT 2.0", category: "Geopolitik & Konflikte", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://api.gdeltproject.org/api/v2/doc/doc", description: "15-Min-Updates zu globalen Medienereignissen + Sentiment" },
  { name: "NASA EONET", category: "Klima & Umwelt", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://eonet.gsfc.nasa.gov/api/v3/events", description: "Echtzeit Naturkatastrophen: Waldbrände, Erdbeben, Hurrikane" },
  { name: "Polymarket", category: "Prediction Markets", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://gamma-api.polymarket.com/markets", description: "Echtgeld-Prediction Markets für Politik, Wirtschaft, Klima" },
  { name: "Manifold Markets", category: "Prediction Markets", priority: "medium", status: "integrated", auth: "none", apiEndpoint: "https://api.manifold.markets/v0/markets", description: "Play-Money Predictions, breiterer Themenbereich" },
  { name: "World Bank", category: "Makroökonomie", priority: "high", status: "integrated", auth: "none", apiEndpoint: "https://api.worldbank.org/v2/", description: "BIP, Armut, Bildung, Gesundheit für 200+ Länder" },
  { name: "Eurostat", category: "Makroökonomie", priority: "medium", status: "integrated", auth: "none", description: "EU-Wirtschafts- und Sozialdaten" },
  { name: "OECD", category: "Makroökonomie", priority: "medium", status: "integrated", auth: "none", description: "OECD-Länderdaten: Bildung, Gesundheit, Wirtschaft" },
  { name: "Our World in Data", category: "Gesellschaft & Demografie", priority: "high", status: "integrated", auth: "none", description: "Langfristige gesellschaftliche Megatrend-Daten" },
  { name: "Destatis", category: "Gesellschaft & Demografie", priority: "medium", status: "integrated", auth: "registration", description: "Deutsche Bevölkerungs- und Wirtschaftsdaten" },
  { name: "Wikipedia", category: "Gesellschaft & Demografie", priority: "medium", status: "integrated", auth: "none", description: "Pageview-Statistiken als Popularitätsindikator" },
  { name: "Stack Overflow", category: "Tech & Developer", priority: "medium", status: "integrated", auth: "none", description: "Tag-Frage-Volumen als Developer-Aktivitäts-Indikator" },
  { name: "npm + PyPI", category: "Tech & Developer", priority: "medium", status: "integrated", auth: "none", description: "Download-Trends für JS/Python-Pakete" },
  { name: "Product Hunt", category: "Tech & Developer", priority: "medium", status: "integrated", auth: "registration", description: "Tägliche neue Tech-Produkte und Startups" },
  { name: "Google Trends", category: "Gesellschaft & Demografie", priority: "medium", status: "integrated", auth: "none", description: "21 tracked Keywords: Suchvolumen als Aufmerksamkeits-Indikator" },
  { name: "Sentiment (YouTube/Mastodon/RSS)", category: "Tech & Developer", priority: "medium", status: "integrated", auth: "none", description: "YouTube Trending, Mastodon, RSS Headline Sentiment" },
  { name: "World Monitor", category: "Makroökonomie", priority: "medium", status: "integrated", auth: "none", description: "Klimaanomalien, Marktquoten, Prediction Markets Aggregation" },
  { name: "News API", category: "News & Medien", priority: "medium", status: "integrated", auth: "free-key", description: "News-Artikel aus 50+ Quellen" },

  // ── BATCH 1: HIGH PRIORITY (building now) ──────────────────────
  { name: "The Guardian", category: "News & Medien", priority: "high", status: "new", auth: "free-key", apiEndpoint: "https://content.guardianapis.com/search", docsUrl: "https://open-platform.theguardian.com/documentation/", description: "Volltext-Artikelzugriff seit 1999 — LLM-Zitierung möglich" },
  { name: "ACLED", category: "Geopolitik & Konflikte", priority: "high", status: "new", auth: "registration", apiEndpoint: "https://api.acleddata.com/acled/read", docsUrl: "https://acleddata.com/acled-api-documentation", description: "Politische Gewalt & Proteste weltweit + CAST Frühwarnungen" },
  { name: "Finnhub", category: "Makroökonomie", priority: "high", status: "new", auth: "free-key", apiEndpoint: "https://finnhub.io/api/v1/", docsUrl: "https://finnhub.io/docs/api", description: "News Sentiment + Earnings Calendar + Echtzeit-Marktdaten" },
  { name: "Metaculus", category: "Prediction Markets", priority: "high", status: "new", auth: "registration", apiEndpoint: "https://www.metaculus.com/api2/questions/", docsUrl: "https://www.metaculus.com/api/", description: "7.000+ Forecasting-Fragen, akademisch kuratiert" },
  { name: "WHO GHO", category: "Gesundheit", priority: "high", status: "new", auth: "none", apiEndpoint: "https://ghoapi.azureedge.net/api/", docsUrl: "https://www.who.int/data/gho/info/gho-odata-api", description: "2.000+ Gesundheitsindikatoren für 194 Länder" },
  { name: "ILO ILOSTAT", category: "Arbeit & Wirtschaft", priority: "high", status: "new", auth: "none", apiEndpoint: "https://rplumber.ilo.org/data/indicator/", docsUrl: "https://rplumber.ilo.org/__docs__/", description: "Globale Arbeitsmarktdaten: 200+ Länder, ~100M Datenpunkte" },

  // ── BATCH 2: MEDIUM PRIORITY ───────────────────────────────────
  { name: "UCDP", category: "Geopolitik & Konflikte", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://ucdpapi.pcr.uu.se/api/gedevents/22.1", description: "Akademisch präziseste Konfliktdatenbank seit 1946" },
  { name: "FRED", category: "Makroökonomie", priority: "medium", status: "deactivated", auth: "free-key", apiEndpoint: "https://api.stlouisfed.org/fred/series/observations", description: "800.000+ Zeitreihen — US & international. Derzeit deaktiviert." },
  { name: "CrossRef", category: "Wissenschaft & Innovation", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://api.crossref.org/works", description: "150M+ DOI-Metadaten, Publikationsvolumen-Trends" },
  { name: "Semantic Scholar", category: "Wissenschaft & Innovation", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://api.semanticscholar.org/graph/v1/paper/search", description: "220M+ Papers, semantische Suche, Citation-Graph" },
  { name: "NYT Article Search", category: "News & Medien", priority: "medium", status: "planned", auth: "free-key", apiEndpoint: "https://api.nytimes.com/svc/search/v2/articlesearch.json", description: "Volltext-Archiv seit 1851, Themen-Volumen-Analyse" },
  { name: "NewsData.io", category: "News & Medien", priority: "medium", status: "planned", auth: "free-key", apiEndpoint: "https://newsdata.io/api/1/latest", description: "95.000+ Quellen, 200+ Länder, multilingual" },
  { name: "Open-Meteo", category: "Klima & Umwelt", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://api.open-meteo.com/v1/forecast", description: "80+ Jahre historische Klimadaten, kein Auth nötig" },
  { name: "UN Data", category: "Gesellschaft & Demografie", priority: "medium", status: "planned", auth: "none", apiEndpoint: "http://data.un.org/ws/rest/data/", description: "Demografische Daten, HDI, 200+ Länder" },
  { name: "UN SDG Indicators", category: "Gesellschaft & Demografie", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://unstats.un.org/sdgs/api/v1/", description: "231 offizielle SDG-Indikatoren für alle UN-Mitgliedsstaaten" },
  { name: "BLS", category: "Arbeit & Wirtschaft", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://api.bls.gov/publicAPI/v2/timeseries/data/", description: "US-Arbeitsmarkt: Arbeitslosigkeit, Beschäftigung, Löhne" },
  { name: "IMF Data", category: "Makroökonomie", priority: "medium", status: "planned", auth: "none", apiEndpoint: "https://www.imf.org/external/datamapper/api/v1/", description: "Globale Wirtschaftsprognosen, Finanzstabilität" },
  { name: "Open Exchange Rates", category: "Makroökonomie", priority: "medium", status: "planned", auth: "free-key", description: "Wechselkurse für 168 Währungen, stündlich" },

  // ── BATCH 3+4: LOWER PRIORITY ──────────────────────────────────
  { name: "Bluesky / AT Protocol", category: "Tech & Developer", priority: "low", status: "planned", auth: "none", apiEndpoint: "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts", description: "Dezentrales Social-Signal, wachsende Tech-Community" },
  { name: "Mastodon", category: "Tech & Developer", priority: "low", status: "planned", auth: "none", apiEndpoint: "https://mastodon.social/api/v1/timelines/public", description: "Dezentrales Social, europäische Tech/Wissenschaft" },
  { name: "Docker Hub", category: "Tech & Developer", priority: "low", status: "planned", auth: "none", apiEndpoint: "https://hub.docker.com/v2/repositories/", description: "Container Pull-Zahlen als Tech-Adoption-Signal" },
  { name: "V-Dem", category: "Gesellschaft & Demografie", priority: "low", status: "planned", auth: "none", description: "Demokratiequalität als Governance-Indikator" },
  { name: "ESS (European Social Survey)", category: "Gesellschaft & Demografie", priority: "low", status: "planned", auth: "none", description: "Akademisch höchster Standard unter EU-Surveys" },
  { name: "USPTO PatentsView", category: "Wissenschaft & Innovation", priority: "low", status: "planned", auth: "none", apiEndpoint: "https://search.patentsview.org/api/v1/patent/", description: "US-Patent-Trends als Innovationsindikator" },
  { name: "EPO OPS", category: "Wissenschaft & Innovation", priority: "low", status: "planned", auth: "registration", description: "Europäische Patentdaten (EP + PCT)" },
  { name: "Alpha Vantage", category: "Makroökonomie", priority: "low", status: "planned", auth: "free-key", description: "Aktien, ETFs, Forex, Rohstoffe + Fundamentaldaten" },
  { name: "Kalshi", category: "Prediction Markets", priority: "low", status: "planned", auth: "registration", description: "US-regulierter Real-Money Prediction Market" },
  { name: "NOAA CDO", category: "Klima & Umwelt", priority: "low", status: "planned", auth: "free-key", description: "Historische Klimadaten seit 1763" },
  { name: "Copernicus / Sentinel", category: "Klima & Umwelt", priority: "low", status: "planned", auth: "registration", description: "Satellitendaten: Luftqualität, Landnutzung, CO₂" },
  { name: "Media Cloud", category: "News & Medien", priority: "low", status: "planned", auth: "none", description: "Open-Source Media Analytics Plattform" },
  { name: "Manifesto Project", category: "Gesellschaft & Demografie", priority: "low", status: "planned", auth: "registration", description: "Inhaltsanalyse von Wahlprogrammen, 50+ Länder seit 1945" },
  { name: "Google Trends (pytrends)", category: "Gesellschaft & Demografie", priority: "low", status: "planned", auth: "none", description: "Inoffizielle Suchvolumen-Daten als Aufmerksamkeitsindikator" },

  // ── DOWNLOAD-ONLY (kein Live-Connector) ─────────────────────────
  { name: "World Values Survey", category: "Werte & Einstellungen", priority: "medium", status: "download-only", auth: "download", description: "Wichtigste Längsschnitt-Wertestudie: 90+ Länder, seit 1981" },
  { name: "Eurobarometer (GESIS)", category: "Werte & Einstellungen", priority: "medium", status: "download-only", auth: "download", description: "EU-Bürger-Einstellungen seit 1973, halbjährlich" },
  { name: "Pew Research Datasets", category: "Gesellschaft & Demografie", priority: "medium", status: "download-only", auth: "download", description: "Globale Einstellungen: Technologie, Demokratie, Klima" },
  { name: "Edelman Trust Barometer", category: "Werte & Einstellungen", priority: "medium", status: "download-only", auth: "download", description: "Jährliche Messung Institutionsvertrauen, 28 Länder" },
  { name: "EU JRC Megatrends Hub", category: "Foresight & Szenarien", priority: "medium", status: "download-only", auth: "none", docsUrl: "https://knowledge4policy.ec.europa.eu/foresight/tool/megatrends-hub_en", description: "14 EU-Megatrends mit Evidenz-Links und Szenarien" },
  { name: "Wellcome Global Monitor", category: "Gesundheit", priority: "medium", status: "download-only", auth: "download", description: "Vertrauen in Wissenschaft + Gesundheitsversorgung, 140 Länder" },
  { name: "GBD Foresight / IHME", category: "Gesundheit", priority: "low", status: "download-only", auth: "download", description: "Krankheitslast-Projektionen bis 2050 (kein API mehr)" },
  { name: "IPSOS Global Trends", category: "Werte & Einstellungen", priority: "low", status: "download-only", auth: "download", description: "Zweijährliche Werte-Verschiebungen, 27 Länder" },
  { name: "Millennium Project", category: "Foresight & Szenarien", priority: "low", status: "download-only", auth: "none", description: "15 Global Challenges, 4.000+ Experten, seit 1996" },
  { name: "Stanford HAI AI Index", category: "Wissenschaft & Innovation", priority: "low", status: "download-only", auth: "none", description: "Globale KI-Einstellungen + aggregierter Survey-Überblick" },
];

// ─── Status styling ──────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  integrated: { color: "#0F6038", bg: "#C3F4D3", label: "Integriert" },
  new: { color: "#1A4A8A", bg: "#D4E8FF", label: "Neu (wird gebaut)" },
  planned: { color: "#7A5C00", bg: "#FFF5BA", label: "Geplant" },
  "download-only": { color: "#6B7280", bg: "#F3F4F6", label: "Nur Download" },
  deactivated: { color: "#E8402A", bg: "#FDEEE9", label: "Deaktiviert" },
};

const PRIO_CFG: Record<string, { color: string; label: string }> = {
  high: { color: "#E8402A", label: "🔴 Hoch" },
  medium: { color: "#F5A623", label: "🟡 Mittel" },
  low: { color: "#1A9E5A", label: "🟢 Niedrig" },
};

const AUTH_LABELS: Record<string, string> = {
  none: "Kein Auth",
  "free-key": "Kostenloser Key",
  registration: "Registrierung",
  download: "Download",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QuellenPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Load signal counts from DB
  const [signalCounts, setSignalCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch("/api/v1/feed")
      .then(r => r.json())
      .then(data => {
        const counts: Record<string, number> = {};
        (data.sourceStatus ?? []).forEach((s: any) => { counts[s.source] = s.signalCount; });
        setSignalCounts(counts);
      })
      .catch(() => {});
  }, []);

  const q = search.toLowerCase();
  const filtered = ALL_SOURCES.filter(s => {
    if (filter !== "all" && s.status !== filter) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
    return true;
  });

  // Group by category
  const categories = [...new Set(ALL_SOURCES.map(s => s.category))].sort();
  const byCategory = categories.map(cat => ({ category: cat, sources: filtered.filter(s => s.category === cat) })).filter(g => g.sources.length > 0);

  const integratedCount = ALL_SOURCES.filter(s => s.status === "integrated").length;
  const newCount = ALL_SOURCES.filter(s => s.status === "new").length;
  const plannedCount = ALL_SOURCES.filter(s => s.status === "planned").length;
  const downloadCount = ALL_SOURCES.filter(s => s.status === "download-only").length;

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main className="volt-container" style={{ padding: "32px 24px 80px" }}>
        {/* Header */}
        <h1 className="volt-display-md" style={{ margin: "0 0 4px" }}>
          {de ? "Alle Datenquellen" : "All Data Sources"}
        </h1>
        <p className="volt-body-sm" style={{ color: "var(--color-text-muted)", margin: "0 0 16px" }}>
          {ALL_SOURCES.length} {de ? "Quellen insgesamt" : "sources total"} · {integratedCount} {de ? "integriert" : "integrated"} · {newCount} neu · {plannedCount} {de ? "geplant" : "planned"} · {downloadCount} {de ? "nur Download" : "download only"}
        </p>

        {/* Filter + Search */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { key: "all", label: `Alle (${ALL_SOURCES.length})` },
            { key: "integrated", label: `✅ Integriert (${integratedCount})` },
            { key: "new", label: `🆕 Neu (${newCount})` },
            { key: "planned", label: `📋 Geplant (${plannedCount})` },
            { key: "download-only", label: `📥 Download (${downloadCount})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={filter === f.key ? "volt-btn volt-btn-solid volt-btn-sm" : "volt-btn volt-btn-ghost volt-btn-sm"}
            >{f.label}</button>
          ))}
          <input className="volt-input" placeholder={de ? "Suchen…" : "Search…"} value={search} onChange={e => setSearch(e.target.value)}
            style={{ marginLeft: "auto", width: 200 }} />
        </div>

        {/* Sources by category */}
        {byCategory.map(g => (
          <div key={g.category} style={{ marginBottom: 24 }}>
            <div className="volt-label" style={{ marginBottom: 8 }}>
              {g.category} ({g.sources.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8 }}>
              {g.sources.map(s => {
                const st = STATUS_CFG[s.status] ?? STATUS_CFG.planned;
                const pr = PRIO_CFG[s.priority];
                const sc = signalCounts[s.name.toLowerCase().replace(/\s+/g, "_")] ?? signalCounts[s.name.toLowerCase()];
                const statusVariant = s.status === "integrated" ? "volt-badge-positive"
                  : s.status === "new" ? "volt-badge-info"
                  : s.status === "deactivated" ? "volt-badge-negative"
                  : "volt-badge-muted";
                return (
                  <div key={s.name} className="volt-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {s.apiEndpoint || s.docsUrl ? (
                        <a href={s.docsUrl || s.apiEndpoint} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", flex: 1, textDecoration: "none", borderBottom: "1px dashed var(--color-border)" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-text-heading)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
                        >{s.name} ↗</a>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", flex: 1 }}>{s.name}</span>
                      )}
                      <span className={`volt-badge ${statusVariant}`}>{st.label}</span>
                    </div>
                    <div className="volt-body-sm" style={{ color: "var(--color-text-muted)", lineHeight: 1.4, marginBottom: 6 }}>{s.description}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--color-text-muted)" }}>
                      <span className="volt-badge" style={{ background: pr.color + "18", color: pr.color }}>{pr.label}</span>
                      <span className="volt-badge volt-badge-muted">{AUTH_LABELS[s.auth]}</span>
                      {sc != null && <span style={{ fontWeight: 600 }}>{sc} Signale</span>}
                      {s.docsUrl && <a href={s.docsUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", color: "var(--color-text-muted)", textDecoration: "none" }}>Docs ↗</a>}
                      {s.apiEndpoint && !s.docsUrl && <a href={s.apiEndpoint} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", color: "var(--color-text-muted)", textDecoration: "none" }}>API ↗</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
