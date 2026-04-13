"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import {
  VoltCard, VoltCardContent,
  VoltAlert,
  VoltStat,
  VoltBadge,
  VoltTerminalStatic,
  VoltTableRoot, VoltTableHeader, VoltTableBody, VoltTableRow, VoltTableHead, VoltTableCell,
  VoltSeparator,
  VoltTabs,
} from "@/components/volt";

/* ─── Types ──────────────────────────────────────────────────── */
type TLine = {
  type: "command" | "output" | "error" | "success" | "warning" | "info" | "comment" | "blank";
  text: string;
};

/* ─── Section Config ─────────────────────────────────────────── */
const SECTIONS = [
  { id: "overview", num: "01", de: "Systemübersicht", en: "System Overview" },
  { id: "connectors", num: "02", de: "Daten-Connectors", en: "Data Connectors" },
  { id: "retrieval", num: "03", de: "Signal-Retrieval", en: "Signal Retrieval" },
  { id: "prompt", num: "04", de: "System-Prompt", en: "System Prompt" },
  { id: "validation", num: "05", de: "Validierung", en: "Validation" },
  { id: "frameworks", num: "06", de: "Analyse-Frameworks", en: "Frameworks" },
  { id: "knowledge", num: "07", de: "Wissensbasis", en: "Knowledge Base" },
  { id: "scoring", num: "08", de: "Scoring & Konfidenz", en: "Scoring" },
  { id: "output", num: "09", de: "Ausgabestruktur", en: "Output Schema" },
  { id: "pipeline", num: "10", de: "Analyse-Pipeline", en: "Pipeline" },
  { id: "limitations", num: "11", de: "Einschränkungen", en: "Limitations" },
] as const;

/* ─── Helpers ────────────────────────────────────────────────── */
const L = (text: string, type: TLine["type"] = "output"): TLine => ({ type, text });
const tl = (s: string): TLine[] => s.split("\n").map((l) => L(l));

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="font-mono text-xs px-1.5 py-0.5 rounded"
      style={{
        background: "rgba(228,255,151,0.25)",
        color: "var(--color-text-heading, #0A0A0A)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </code>
  );
}

function SubH({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-sm font-bold mt-6 mb-2 first:mt-0"
      style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)" }}
    >
      {children}
    </h3>
  );
}

function SectionHeading({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
        style={{ color: "var(--color-text-muted, #6B6B6B)" }}
      >
        {num}
      </span>
      <h2
        className="text-lg font-bold tracking-tight"
        style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          color: "var(--color-text-heading, #0A0A0A)",
        }}
      >
        {children}
      </h2>
    </div>
  );
}

/* ─── Connector badges ───────────────────────────────────────── */
function ConnectorGrid({ items }: { items: { name: string; apiKey?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2 py-3">
      {items.map((c) => (
        <VoltBadge
          key={c.name}
          variant={c.apiKey ? "outline" : "muted"}
          size="sm"
          dot={c.apiKey}
          dotColor="rgb(245,166,35)"
        >
          {c.name}
        </VoltBadge>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Dokumentation() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [activeSection, setActiveSection] = useState("overview");

  /* ── Scroll-spy via IntersectionObserver ────────────────────── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  /* ── Connector Tab Data ────────────────────────────────────── */
  const connectorTabs = [
    {
      id: "tech", label: "Tech (9)",
      content: <ConnectorGrid items={[
        { name: "Hacker News" }, { name: "GitHub Trending" }, { name: "Reddit" },
        { name: "arXiv" }, { name: "Stack Overflow" }, { name: "npm & PyPI" },
        { name: "Product Hunt" }, { name: "Wikipedia Pageviews" }, { name: "Docker Hub" },
      ]} />,
    },
    {
      id: "search", label: de ? "Suche (3)" : "Search (3)",
      content: <ConnectorGrid items={[
        { name: "Google Trends" }, { name: "Social Media Sentiment" }, { name: "Google Books Ngram" },
      ]} />,
    },
    {
      id: "news", label: "News (6)",
      content: <ConnectorGrid items={[
        { name: "News API", apiKey: true }, { name: "The Guardian", apiKey: true },
        { name: "New York Times", apiKey: true }, { name: "NewsData.io", apiKey: true },
        { name: "Media Cloud" }, { name: "GDELT" },
      ]} />,
    },
    {
      id: "research", label: de ? "Forschung (3)" : "Research (3)",
      content: <ConnectorGrid items={[
        { name: "OpenAlex" }, { name: "CrossRef" }, { name: "Semantic Scholar" },
      ]} />,
    },
    {
      id: "stats", label: de ? "Statistik (8)" : "Statistics (8)",
      content: <ConnectorGrid items={[
        { name: "Eurostat" }, { name: "OECD" }, { name: "FRED", apiKey: true },
        { name: "Our World in Data" }, { name: "Destatis" }, { name: "World Bank" },
        { name: "BLS (US Labor)" }, { name: "IMF" },
      ]} />,
    },
    {
      id: "prediction", label: de ? "Prognose (4)" : "Prediction (4)",
      content: <ConnectorGrid items={[
        { name: "Polymarket" }, { name: "Manifold Markets" }, { name: "Metaculus" }, { name: "Kalshi" },
      ]} />,
    },
    {
      id: "geopolitics", label: de ? "Geopolitik (4)" : "Geopolitics (4)",
      content: <ConnectorGrid items={[
        { name: "ACLED", apiKey: true }, { name: "UCDP" }, { name: "V-Dem" }, { name: "UNHCR Refugee Data" },
      ]} />,
    },
    {
      id: "health", label: de ? "Gesundheit (5)" : "Health (5)",
      content: <ConnectorGrid items={[
        { name: "WHO GHO" }, { name: "ILO ILOSTAT" }, { name: "ClinicalTrials.gov" },
        { name: "OpenFDA" }, { name: "Nextstrain" },
      ]} />,
    },
    {
      id: "climate", label: de ? "Klima (3)" : "Climate (3)",
      content: <ConnectorGrid items={[
        { name: "NASA EONET" }, { name: "Open-Meteo" }, { name: "USGS Earthquakes" },
      ]} />,
    },
    {
      id: "finance", label: de ? "Finanzen (4)" : "Finance (4)",
      content: <ConnectorGrid items={[
        { name: "Finnhub", apiKey: true }, { name: "Open Exchange Rates" },
        { name: "CoinGecko" }, { name: "DeFi Llama" },
      ]} />,
    },
    {
      id: "social", label: "Social (2)",
      content: <ConnectorGrid items={[
        { name: "Bluesky" }, { name: "Mastodon" },
      ]} />,
    },
    {
      id: "global", label: "Global (6)",
      content: <ConnectorGrid items={[
        { name: "World Monitor" }, { name: "PatentsView (USPTO)" }, { name: "UN Data" },
        { name: "UN SDG Indicators" }, { name: "SteamSpy (Gaming)" },
      ]} />,
    },
  ];

  /* ── Pipeline Steps ────────────────────────────────────────── */
  const pipelineSteps = [
    { num: 1, t: de ? "Authentifizierung" : "Authentication", d: de ? "requireAuth() -- Middleware + Route-Level (Defense-in-Depth)" : "requireAuth() -- middleware + route-level (defense-in-depth)" },
    { num: 2, t: "Rate Limiting", d: de ? "100 Requests/IP/Stunde, In-Memory Sliding Window" : "100 requests/IP/hour, in-memory sliding window" },
    { num: 3, t: de ? "Input-Validierung & Sanitisierung" : "Input Validation & Sanitization", d: de ? "Max 2.000 Zeichen, 9 Injection-Patterns, XML-Tags, contextProfile (SEC-08)" : "Max 2,000 chars, 9 injection patterns, XML tags, contextProfile (SEC-08)" },
    { num: 4, t: de ? "Trend-Laden aus SQLite" : "Load Trends from SQLite", d: de ? "trends-Tabelle, Fallback auf mega-trends.ts" : "trends table, fallback to mega-trends.ts" },
    { num: 5, t: de ? "Signal-Freshness-Check" : "Signal Freshness Check", d: de ? "Neueste Signale > 6h alt -> Pipeline auto-refresh (fire-and-forget)" : "Newest signals > 6h old -> pipeline auto-refresh (fire-and-forget)" },
    { num: 6, t: "Signal-Retrieval (RAG)", d: de ? "getRelevantSignals(query, 12) -- Keyword-Matching, Cross-Language Aliases, Score >= 2" : "getRelevantSignals(query, 12) -- keyword matching, cross-language aliases, score >= 2" },
    { num: 7, t: de ? "System-Prompt aufbauen" : "Build System Prompt", d: de ? "buildSystemPrompt() -- 40 Trends + 15 Regulierungen + 102 Kanten + Live-Signale + STEEP+V + PFLICHTEN + JSON-Schema" : "buildSystemPrompt() -- 40 trends + 15 regulations + 102 edges + live signals + STEEP+V + PFLICHTEN + JSON schema" },
    { num: 8, t: de ? "previousContext (SEC-10)" : "previousContext (SEC-10)", d: de ? "Synthesis auf 6.000 Zeichen begrenzen, sanitisieren, als Assistant-Message" : "Truncate synthesis to 6,000 chars, sanitize, inject as assistant message" },
    { num: 9, t: "LLM-Streaming (Anthropic API)", d: de ? "claude-sonnet-4-6, max_tokens: 12.000, SSE-Streaming, Retry bis 3x bei 429/529" : "claude-sonnet-4-6, max_tokens: 12,000, SSE streaming, retry up to 3x on 429/529" },
    { num: 10, t: de ? "Synthese-Extraktion während Streaming" : "Synthesis Extraction During Streaming", d: de ? "Progressive JSON-Parsing, Delta-Extraktion für Live-Anzeige" : "Progressive JSON parsing, delta extraction for live display" },
    { num: 11, t: de ? "JSON-Extraktion (ggf. Reparatur)" : "JSON Extraction (with repair)", d: de ? "extractJSON() -- Markdown-Fences entfernen, truncated JSON reparieren" : "extractJSON() -- strip markdown fences, repair truncated JSON" },
    { num: 12, t: "Zod-Validierung (VAL-01)", d: de ? "Alle Felder typsicher prüfen, bei Fehler: Partial-Extraction" : "Type-check all fields, on error: partial extraction" },
    { num: 13, t: "matchedTrendIds (VAL-02)", d: de ? "Halluzinierte IDs entfernen und loggen" : "Remove and log hallucinated IDs" },
    { num: 14, t: de ? "Szenario-Normalisierung" : "Scenario Normalization", d: de ? "Nulls -> Defaults, Summe 0.8-1.1 akzeptabel, sonst normalisieren" : "Nulls -> defaults, sum 0.8-1.1 acceptable, otherwise normalize" },
    { num: 15, t: "Blended Confidence (VAL-03)", d: "0.6 * serverScore + 0.4 * llmConfidence, clamped [0.05, 0.98]" },
    { num: 16, t: "Augmentation", d: de ? "matchedTrends-Details, kausale Kanten, Signal-Metadaten" : "matchedTrends details, causal edges, signal metadata" },
    { num: 17, t: de ? "Ergebnis an Client streamen" : "Stream Result to Client", d: de ? "SSE: { type: 'delta', text } während Streaming, { type: 'complete', result } am Ende" : "SSE: { type: 'delta', text } during streaming, { type: 'complete', result } at end" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <div className="max-w-[1120px] mx-auto px-6 py-8">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <VoltBadge variant="solid">SIS</VoltBadge>
            <VoltBadge variant="muted" size="sm">v1.0</VoltBadge>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight mb-3"
            style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", color: "var(--color-text-heading, #0A0A0A)" }}
          >
            {de ? "Technische Systemdokumentation" : "Technical System Documentation"}
          </h1>
          <p
            className="text-[15px] mb-4 max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", color: "var(--color-text-muted, #6B6B6B)" }}
          >
            {de
              ? "Vollständige technische Referenz des Strategic Intelligence System. Alle Angaben sind aus dem Quellcode extrahiert und 1:1 verifizierbar."
              : "Complete technical reference of the Strategic Intelligence System. All claims are extracted from source code and 1:1 verifiable."}
          </p>
          <div className="flex flex-wrap gap-2">
            {["Next.js 15", "React 19", "Claude claude-sonnet-4-6", "SQLite + WAL", "57 Connectors", "Zod", "SSE Streaming"].map((t) => (
              <VoltBadge key={t} variant="outline" size="sm">{t}</VoltBadge>
            ))}
          </div>
        </div>

        {/* ── Key Stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <VoltStat label="Live-Connectors" value={57} variant="lime" />
          <VoltStat label={de ? "Kuratierte Trends" : "Curated Trends"} value={40} />
          <VoltStat label={de ? "Kausale Kanten" : "Causal Edges"} value={102} />
          <VoltStat label={de ? "Regulierungen" : "Regulations"} value={15} />
        </div>

        {/* ── Two-column layout ────────────────────────────────── */}
        <div className="flex gap-8">
          {/* ── Sidebar TOC ──────────────────────────────────── */}
          <nav className="hidden lg:block w-52 flex-shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-3 px-3"
                style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)" }}
              >
                {de ? "Inhalt" : "Contents"}
              </div>
              <div className="space-y-0.5">
                {SECTIONS.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13px] transition-all duration-150"
                      style={{
                        background: isActive ? "rgba(228,255,151,0.15)" : "transparent",
                        color: isActive ? "var(--color-text-heading, #0A0A0A)" : "var(--color-text-muted, #6B6B6B)",
                        fontWeight: isActive ? 600 : 400,
                        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                      }}
                    >
                      <span className="font-mono text-[10px] font-bold w-5 text-right opacity-50 flex-shrink-0">{s.num}</span>
                      <span className="truncate">{de ? s.de : s.en}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* ── Main Content ─────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-10">

            {/* ══════════════════════════════════════════════════
                01 — SYSTEM OVERVIEW
                ══════════════════════════════════════════════════ */}
            <section id="overview" className="scroll-mt-20">
              <SectionHeading num="01">
                {de ? "Systemübersicht & Architektur" : "System Overview & Architecture"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Das SIS (Strategic Intelligence System) ist ein Denk-Instrument auf Think-Tank-Niveau mit explizitem EU-Fokus. Es verbindet 57 Live-Datenquellen mit einem kuratierten Wissensgraphen (40 Trends, 102 kausale Kanten, 15 Regulierungen) und einem LLM-Analysekern (Claude claude-sonnet-4-6) zu einem Retrieval-Augmented-Generation (RAG) System, das strategische Fragen strukturiert und belegt beantwortet."
                      : "SIS (Strategic Intelligence System) is a thinking instrument at think-tank level with an explicit EU focus. It connects 57 live data sources with a curated knowledge graph (40 trends, 102 causal edges, 15 regulations) and an LLM analysis core (Claude claude-sonnet-4-6) into a RAG system that answers strategic questions in a structured and evidence-based way."}
                  </p>

                  <SubH>{de ? "RAG-Architektur (Datenfluss)" : "RAG Architecture (Data Flow)"}</SubH>
                  <VoltTerminalStatic
                    title="RAG Architecture"
                    variant="dark"
                    maxHeight="none"
                    lines={tl(
`┌──────────────────────────────────────────────────────────┐
│  57 Connectors (APIs)                                    │
│  HackerNews, GDELT, Eurostat, WHO, ACLED, arXiv, ...    │
└────────────────────────────┬─────────────────────────────┘
                             │ storeSignals()
                             v
┌──────────────────────────────────────────────────────────┐
│  SQLite (better-sqlite3, WAL mode)                       │
│  live_signals: id, source, title, content, url, topic,   │
│                tags, signal_type, strength, fetched_at    │
└────────────────────────────┬─────────────────────────────┘
                             │ getRelevantSignals(query, 12)
                             v
┌──────────────────────────────────────────────────────────┐
│  System Prompt Builder (buildSystemPrompt)                │
│  Top 40 Trends + 15 Regulierungen + 102 Kausale Kanten  │
│  + formatierte Live-Signale + STEEP+V Framework          │
│  + EU JRC 14 Megatrends + 7 PFLICHTEN + JSON-Schema      │
└────────────────────────────┬─────────────────────────────┘
                             │ Anthropic API (claude-sonnet-4-6)
                             │ max_tokens: 12.000, SSE
                             v
┌──────────────────────────────────────────────────────────┐
│  Post-Processing & Validation                            │
│  1. JSON-Extraktion (inkl. Reparatur bei Truncation)     │
│  2. Zod-Schema-Validierung (VAL-01)                      │
│  3. matchedTrendIds Anti-Halluzination (VAL-02)          │
│  4. Szenario-Normalisierung                              │
│  5. Blended Confidence (VAL-03)                          │
│  6. URL-Validierung                                      │
│  7. Causal-Edge-Augmentation                             │
└────────────────────────────┬─────────────────────────────┘
                             │ SSE (Server-Sent Events)
                             v
┌──────────────────────────────────────────────────────────┐
│  Client (React 19 + Next.js 15)                          │
│  Streaming-Synthese + Strukturiertes Briefing            │
└──────────────────────────────────────────────────────────┘`
                    )}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Technologie-Stack" : "Technology Stack"}</SubH>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "LLM", value: "Claude claude-sonnet-4-6, max 12.000 tokens, Anthropic API v2023-06-01" },
                      { label: de ? "Datenbank" : "Database", value: "SQLite via better-sqlite3, WAL-Modus, Trend + live_signals Tabelle" },
                      { label: "Frontend", value: "Next.js 15, React 19, TypeScript, Volt UI" },
                      { label: de ? "Datenquellen" : "Data Sources", value: de ? "57 Live-Connectors, 42+ institutionelle Forschungsquellen" : "57 live connectors, 42+ institutional research sources" },
                      { label: "Streaming", value: "SSE (Server-Sent Events), progressive JSON extraction" },
                      { label: "Validation", value: "Zod Schema, Input Sanitization, Rate Limiting" },
                      { label: de ? "Wissensgraph" : "Knowledge Graph", value: de ? "40 Trends, 102 kausale Kanten, 15 Regulierungen" : "40 trends, 102 causal edges, 15 regulations" },
                      { label: "API", value: de ? "Retry bis 3x bei 429/529, Exponential Backoff" : "Retry up to 3x on 429/529, exponential backoff" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="p-3 rounded-lg"
                        style={{ border: "1px solid var(--color-border, #E8E8E8)" }}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                          {item.label}
                        </div>
                        <div className="text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                02 — DATA CONNECTORS
                ══════════════════════════════════════════════════ */}
            <section id="connectors" className="scroll-mt-20">
              <SectionHeading num="02">
                {de ? "Daten-Connectors (57 gesamt)" : "Data Connectors (57 total)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-4 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Alle 57 Connectors, gruppiert nach Kategorie. Jeder Connector liefert strukturierte Signale (Titel, Inhalt, URL, Datum, Stärke) in die SQLite-Datenbank."
                      : "All 57 connectors, grouped by category. Each connector delivers structured signals (title, content, URL, date, strength) to the SQLite database."}
                  </p>

                  <VoltAlert variant="info">
                    {de
                      ? "Signale werden automatisch nach 336 Stunden (14 Tage) gelöscht. Bei jedem Query wird geprüft ob die neuesten Signale älter als 6 Stunden sind -- wenn ja, wird die Pipeline automatisch neu ausgelöst. Connectors mit orangem Punkt benötigen einen API-Schlüssel in .env.local."
                      : "Signals are automatically pruned after 336 hours (14 days). On every query, the system checks if the newest signals are older than 6 hours -- if so, the pipeline is auto-triggered. Connectors with an orange dot require an API key in .env.local."}
                  </VoltAlert>

                  <VoltTabs variant="pills" tabs={connectorTabs} />
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                03 — SIGNAL RETRIEVAL (RAG)
                ══════════════════════════════════════════════════ */}
            <section id="retrieval" className="scroll-mt-20">
              <SectionHeading num="03">
                {de ? "Signal-Retrieval (RAG-Schicht)" : "Signal Retrieval (RAG Layer)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Das Signal-Retrieval ist die Brücke zwischen den 57 Connectors und dem LLM-Prompt. Es findet die thematisch relevantesten Signale für eine gegebene Nutzeranfrage. Quellcode: signals.ts"
                      : "Signal retrieval bridges the 57 connectors and the LLM prompt. It finds the most topically relevant signals for a given user query. Source: signals.ts"}
                  </p>

                  <SubH>{de ? "Keyword-Extraktion" : "Keyword Extraction"}</SubH>
                  <ul className="text-[13px] leading-relaxed space-y-2 pl-4 list-disc" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    <li>{de ? "Stoppwörter entfernt (DE + EN): " : "Stop words removed (DE + EN): "}<Code>wie, was, wo, the, how, what, ...</Code></li>
                    <li>{de ? "Mindestlänge: 2 Zeichen" : "Minimum length: 2 characters"}</li>
                    <li>{de ? "Ausnahme für wichtige Kurzterme: " : "Exception for important short terms: "}<Code>ki, ai, eu, un, ml, ar, vr, xr, 5g, 6g, iot, llm, rag, ...</Code></li>
                    <li>{de ? "Max Keywords nach Expansion: 12" : "Max keywords after expansion: 12"}</li>
                  </ul>

                  <SubH>{de ? "Sprachübergreifende Alias-Gruppen (ALG-21)" : "Cross-Language Alias Groups (ALG-21)"}</SubH>
                  <p className="text-[13px] mb-2" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Wenn ein Keyword in einer Alias-Gruppe vorkommt, werden alle anderen Begriffe automatisch zur Suchmenge hinzugefügt. 9 Alias-Gruppen:"
                      : "When a keyword matches an alias group, all other terms are automatically added. 9 alias groups:"}
                  </p>
                  <VoltTerminalStatic
                    title="Alias Groups"
                    variant="dark"
                    size="sm"
                    maxHeight="220px"
                    lines={tl(
`1. ki       <-> ai, artificial intelligence, künstliche intelligenz
2. klimawandel <-> climate change, global warming
3. cybersicherheit <-> cybersecurity, cyber security
4. energiewende  <-> energy transition
5. lieferkette   <-> supply chain
6. gesundheit    <-> health, public health
7. migration     <-> immigration, refugees
8. geopolitik    <-> geopolitics
9. kryptowährung <-> cryptocurrency, crypto`
                    )}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "SQL-Scoring-Formel" : "SQL Scoring Formula"}</SubH>
                  <VoltTerminalStatic
                    title="Scoring"
                    variant="dark"
                    size="sm"
                    maxHeight="200px"
                    lines={[
                      L("Score = SUM(", "command"),
                      L("  CASE WHEN lower(title)   LIKE '%keyword%' THEN 2 ELSE 0 END +"),
                      L("  CASE WHEN lower(topic)   LIKE '%keyword%' THEN 2 ELSE 0 END +"),
                      L("  CASE WHEN lower(content) LIKE '%keyword%' THEN 1 ELSE 0 END"),
                      L(")"),
                      L(""),
                      L("Filter:  Score >= 2", "info"),
                      L("Sort:    relevance_score DESC, strength DESC, fetched_at DESC", "info"),
                      L("Limit:   12 Signale pro Query", "info"),
                      L("Window:  fetched_at > datetime('now', '-336 hours')  (14 Tage)", "info"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Signal-Sanitisierung (SEC-07)" : "Signal Sanitization (SEC-07)"}</SubH>
                  <VoltAlert variant="warning">
                    {de
                      ? "Bevor Signale in den LLM-Prompt eingebettet werden, wird der Text sanitisiert um Prompt-Injection über manipulierte Signaldaten zu verhindern: Steuerzeichen entfernen, XML-Tags entfernen, Rollen-Marker (system:, user:, assistant:, human:) entfernen."
                      : "Before signals are embedded in the LLM prompt, text is sanitized to prevent prompt injection: strip control characters, XML-style tags, and role markers (system:, user:, assistant:, human:)."}
                  </VoltAlert>

                  <SubH>{de ? "Signal-Format im Prompt" : "Signal Format in Prompt"}</SubH>
                  <VoltTerminalStatic
                    title="Signal Format"
                    variant="dark"
                    size="sm"
                    maxHeight="120px"
                    lines={[
                      L("AKTUELLE BELEGTE SIGNALE (letzte 14 Tage, aus N Quellen):", "comment"),
                      L("* [GDELT, 2026-04-10] [Stärke: 85%] Signal-Titel -> URL"),
                      L("    Signal-Content (max 200 Zeichen)"),
                    ]}
                  />
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                04 — SYSTEM PROMPT
                ══════════════════════════════════════════════════ */}
            <section id="prompt" className="scroll-mt-20">
              <SectionHeading num="04">
                {de ? "System-Prompt (vollständige Struktur)" : "System Prompt (Complete Structure)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Der System-Prompt ist das Herzstück des SIS. Er instruiert das LLM, als Think-Tank-Analyst zu agieren, und liefert gleichzeitig den vollständigen Datenkontext. Nachfolgend die exakte Struktur aus llm.ts/buildSystemPrompt():"
                      : "The system prompt is the heart of SIS. It instructs the LLM to act as a think-tank analyst while providing the complete data context. Below is the exact structure from llm.ts/buildSystemPrompt():"}
                  </p>

                  <SubH>{de ? "Rollen-Definition" : "Role Definition"}</SubH>
                  <VoltTerminalStatic
                    title="Role"
                    variant="dark"
                    size="sm"
                    maxHeight="100px"
                    lines={[
                      L("\"Du bist das Strategic Intelligence System (SIS) -- ein Denk-Instrument", "info"),
                      L("auf dem Niveau eines erstklassigen Think-Tanks mit explizitem EU-Fokus.\"", "info"),
                      L(""),
                      L("Sprache: Dynamisch per Locale (de/en)", "comment"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "STEEP+V Analytisches Framework (6 Dimensionen)" : "STEEP+V Analytical Framework (6 Dimensions)"}</SubH>
                  <VoltTerminalStatic
                    title="STEEP+V"
                    variant="dark"
                    size="sm"
                    maxHeight="180px"
                    lines={[
                      L("S = Society     Demografie, Urbanisierung, Migration, Wertewandel"),
                      L("T = Technology   KI, Digitalisierung, Biotech, Quantum, Cybersecurity"),
                      L("E = Economy      Globalisierung, Handel, Arbeitsmarkt, Inflation"),
                      L("E = Environment  Klima, Biodiversität, Energie, Ressourcen"),
                      L("P = Politics     Regulierung, Geopolitik, Demokratie, EU-Politik"),
                      L("V = Values       Vertrauen, Polarisierung, Akzeptanz, Kultur"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "EU JRC 14 Megatrends (Referenzrahmen)" : "EU JRC 14 Megatrends (Reference Frame)"}</SubH>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                      de ? "Technologische Veränderung & Hyperkonnektivität" : "Technological change & hyperconnectivity",
                      de ? "Demografische Ungleichgewichte" : "Demographic imbalances",
                      de ? "Klimawandel & oekologische Degradation" : "Climate change & environmental degradation",
                      de ? "Ökonomische Ungleichheiten" : "Economic inequalities",
                      de ? "Geopolitische Spannungen" : "Geopolitical tensions",
                      de ? "Menschliche Erweiterung (Enhancement)" : "Human enhancement",
                      de ? "Machtverschiebungen zwischen Staaten" : "Power shifts between states",
                      de ? "Globale Gemeingüter" : "Global commons",
                      de ? "Neue Governance-Formen" : "New governance forms",
                      de ? "Demokratie & institutionelles Vertrauen" : "Democracy & institutional trust",
                      de ? "Arbeit & Bildung" : "Work & education",
                      de ? "Globale Gesundheitsherausforderungen" : "Global health challenges",
                      de ? "Städte & Urbanisierung" : "Cities & urbanization",
                      de ? "Steigende Aspirationen" : "Rising aspirations",
                    ].map((mt, i) => (
                      <div key={i} className="flex items-center gap-2 text-[13px] py-1.5 px-2.5 rounded" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                        <span className="font-mono text-[10px] font-bold opacity-35 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span>{mt}</span>
                      </div>
                    ))}
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "7 Absolute PFLICHTEN" : "7 Absolute Requirements (PFLICHTEN)"}</SubH>
                  <VoltAlert variant="warning" title={de ? "Pflichten" : "Requirements"}>
                    <div className="space-y-2 text-[13px] mt-2">
                      <div><strong>1.</strong> {de ? "BEANTWORTE DIE FRAGE DIREKT UND SUBSTANZIELL -- nicht die Frage welche Trends passen." : "ANSWER THE QUESTION DIRECTLY AND SUBSTANTIALLY -- not which trends fit."}</div>
                      <div><strong>2.</strong> {de ? "Die synthesis MUSS 6-10 Saetze lang sein. Kurze synthesis = Fehler." : "The synthesis MUST be 6-10 sentences long. Short synthesis = error."}</div>
                      <div><strong>3.</strong> {de ? "Nenne KONKRETE Zahlen, Laender, Unternehmen, Technologien, Zeitrahmen." : "Name CONCRETE numbers, countries, companies, technologies, timeframes."}</div>
                      <div><strong>4.</strong> {de ? "Verwende Trends als HINTERGRUND-KONTEXT -- Signalgeber, nicht die Antwort." : "Use trends as BACKGROUND CONTEXT -- signal providers, not your answer."}</div>
                      <div><strong>5.</strong> {de ? "VERBOTEN: \"X ist ein Megatrend mit Y% Relevanz\" -- Datendump, keine Analyse." : "FORBIDDEN: \"X is a megatrend with Y% relevance\" -- data dump, not analysis."}</div>
                      <div><strong>6.</strong> {de ? "scenarios IMMER: GENAU 3 Szenarien (optimistic, baseline, pessimistic). Summe ~100%." : "scenarios ALWAYS: EXACTLY 3 scenarios (optimistic, baseline, pessimistic). Sum ~100%."}</div>
                      <div><strong>7.</strong> {de ? "TRANSPARENZ: Fakten aus Live-Signalen [SIGNAL: Quelle, Datum], Trends [TREND: Name], eigenes Wissen [LLM-Einschätzung]. NIEMALS URLs erfinden. references-Array nie leer (mind. 2)." : "TRANSPARENCY: Facts from signals [SIGNAL: Source, Date], trends [TREND: Name], own knowledge [LLM-Einschätzung]. NEVER fabricate URLs. references array never empty (min. 2)."}</div>
                    </div>
                  </VoltAlert>

                  <VoltSeparator />

                  <SubH>{de ? "Szenario-Wahrscheinlichkeiten" : "Scenario Probabilities"}</SubH>
                  <ul className="text-[13px] leading-relaxed space-y-1.5 pl-4 list-disc" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    <li>{de ? "Muessen sich aus der ANALYSE ergeben, nicht aus einem Default-Schema" : "Must FOLLOW FROM ANALYSIS, not from a default scheme"}</li>
                    <li>{de ? "VERBOTEN: identische Verteilungen (z.B. 0.20/0.55/0.25) für jede Frage" : "FORBIDDEN: identical distributions (e.g. 0.20/0.55/0.25) for every query"}</li>
                    <li>{de ? "Reifer Markt: baseline höher (z.B. 0.65)" : "Mature market: baseline higher (e.g. 0.65)"}</li>
                    <li>{de ? "Volatiles Thema: breitere Verteilung" : "Volatile topic: wider distribution"}</li>
                    <li>{de ? "Summe ~100% (95-105% akzeptabel)" : "Sum ~100% (95-105% acceptable)"}</li>
                  </ul>

                  <VoltSeparator />

                  <SubH>{de ? "Fragetypen-Erkennung" : "Query Type Detection"}</SubH>
                  <VoltTerminalStatic
                    title="Query Types"
                    variant="dark"
                    size="sm"
                    maxHeight="200px"
                    lines={[
                      L("STRATEGISCH (\"Wie entwickelt sich X in 5 Jahren?\")", "command"),
                      L("  -> Tiefe STEEP+V-Analyse + BSC-Kandidat"),
                      L(""),
                      L("FAKTENFRAGE (\"Wer ist X?\", \"Was kostet Y?\")", "command"),
                      L("  -> Direktantwort, Trends nur als Kontext"),
                      L(""),
                      L("STICHWORT/TAG (\"AI\", \"frontier-tech\")", "command"),
                      L("  -> Strategisches Lagebild"),
                      L(""),
                      L("VERGLEICH/ITERATION", "command"),
                      L("  -> Direkte Gegenüberstellung + Handlungsempfehlung"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Balanced Scorecard (BSC) Regeln" : "Balanced Scorecard (BSC) Rules"}</SubH>
                  <ul className="text-[13px] leading-relaxed space-y-1.5 pl-4 list-disc" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    <li>{de ? "Standard: null. NUR bei strategischen Analyse-Fragen" : "Default: null. ONLY for strategic analysis questions"}</li>
                    <li>{de ? "NICHT bei Faktenfragen, Politik, historischen Ereignissen" : "NOT for factual, political, or historical questions"}</li>
                    <li>{de ? "3-6 themenspezifische Perspectives (NICHT generisch)" : "3-6 topic-specific perspectives (NOT generic)"}</li>
                    <li>{de ? "scores: 0-1, impacts: -1 bis +1, overallReadiness: 0-1" : "scores: 0-1, impacts: -1 to +1, overallReadiness: 0-1"}</li>
                  </ul>

                  <VoltSeparator />

                  <SubH>{de ? "Datenkontext im Prompt" : "Data Context in Prompt"}</SubH>
                  <VoltTerminalStatic
                    title="Prompt Data Blocks"
                    variant="dark"
                    size="sm"
                    maxHeight="260px"
                    lines={[
                      L("TRENDS (Top 40, sortiert nach Relevanz):", "comment"),
                      L("- ID:\"mega-ai-transformation\" | AI [Mega-Trend]"),
                      L("  Ring:adopt Rel:98% Conf:95% Imp:98% rising Dur:permanent"),
                      L("  Focus:strategic,investment Signals:500 Sources:PwC,EY"),
                      L(""),
                      L("REGULIERUNGEN (15 Frameworks):", "comment"),
                      L("- EU:AI Act [enforcing] -> mega-ai-transformation(reshapes)"),
                      L("- US:CHIPS Act [enforcing] -> mega-technological-disruption"),
                      L(""),
                      L("KAUSALE VERBINDUNGEN (102 Kanten):", "comment"),
                      L("mega-climate --drives(95%)--> mega-energy-transition"),
                      L("mega-ai --drives(95%)--> mega-future-of-work"),
                      L("mega-geopolitical --dampens(70%)--> mega-connectivity"),
                    ]}
                  />
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                05 — VALIDATION & ANTI-HALLUCINATION
                ══════════════════════════════════════════════════ */}
            <section id="validation" className="scroll-mt-20">
              <SectionHeading num="05">
                {de ? "Validierung & Anti-Halluzination" : "Validation & Anti-Hallucination"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "10 Sicherheits- und Validierungsschichten (SEC-01 bis SEC-10, VAL-01 bis VAL-03) erkennen, korrigieren und dokumentieren LLM-Halluzinationen. Quellcode: validation.ts, route.ts"
                      : "10 security and validation layers (SEC-01 to SEC-10, VAL-01 to VAL-03) detect, correct, and document LLM hallucinations. Source: validation.ts, route.ts"}
                  </p>

                  <SubH>{de ? "Input-Sanitisierung (9 Injection-Patterns)" : "Input Sanitization (9 Injection Patterns)"}</SubH>
                  <VoltTerminalStatic
                    title="INJECTION_PATTERNS"
                    variant="dark"
                    size="sm"
                    maxHeight="280px"
                    lines={[
                      L("1. /\\b(?:system|assistant|human)\\s*:/gi", "error"),
                      L("   -- Rollen-Direktiven", "comment"),
                      L("2. /\\byou are\\b/gi", "error"),
                      L("   -- Identitäts-Override", "comment"),
                      L("3. /\\bignore .* instructions?\\b/gi", "error"),
                      L("4. /\\bforget .* instructions?\\b/gi", "error"),
                      L("5. /\\bdisregard .* instructions?\\b/gi", "error"),
                      L("6. /\\boverride .* instructions?\\b/gi", "error"),
                      L("   -- Instruktions-Override (3-6)", "comment"),
                      L("7. /\\bnew instructions?\\s*:/gi", "error"),
                      L("8. /\\bact as\\b/gi", "error"),
                      L("9. /\\bpretend (?:to be|you are)\\b/gi", "error"),
                      L(""),
                      L("+ XML-Tags: /<\\/?[a-zA-Z][a-zA-Z0-9_-]*>/g", "warning"),
                      L("+ Max Query-Laenge: 2.000 Zeichen", "warning"),
                    ]}
                  />

                  <SubH>{de ? "Sanitisierung: contextProfile (SEC-08) & previousContext (SEC-10)" : "Sanitization: contextProfile (SEC-08) & previousContext (SEC-10)"}</SubH>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <VoltAlert variant="info" title="SEC-08: contextProfile">
                      <ul className="text-[12px] mt-1.5 space-y-1 list-disc pl-3">
                        <li>{de ? "role, industry, region: max 100 Zeichen" : "role, industry, region: max 100 chars"}</li>
                        <li>{de ? "Newlines, HTML-Tags, Rollen-Marker entfernt" : "Newlines, HTML tags, role markers removed"}</li>
                      </ul>
                    </VoltAlert>
                    <VoltAlert variant="info" title="SEC-10: previousContext">
                      <ul className="text-[12px] mt-1.5 space-y-1 list-disc pl-3">
                        <li>{de ? "Synthesis auf 6.000 Zeichen begrenzt" : "Synthesis truncated to 6,000 chars"}</li>
                        <li>{de ? "XML-Tags + Rollen-Marker entfernt" : "XML tags + role markers removed"}</li>
                        <li>{de ? "Als Assistant-Message injiziert (geschützt)" : "Injected as assistant message (protected)"}</li>
                      </ul>
                    </VoltAlert>
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "Zod-Schema-Validierung (VAL-01)" : "Zod Schema Validation (VAL-01)"}</SubH>
                  <p className="text-[13px] mb-3" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Alle LLM-Ausgaben werden gegen ein striktes Zod-Schema validiert:"
                      : "All LLM outputs are validated against a strict Zod schema:"}
                  </p>
                  <div className="overflow-x-auto">
                    <VoltTableRoot>
                      <VoltTableHeader>
                        <VoltTableRow>
                          <VoltTableHead>{de ? "Feld" : "Field"}</VoltTableHead>
                          <VoltTableHead>Typ</VoltTableHead>
                          <VoltTableHead>Constraints</VoltTableHead>
                        </VoltTableRow>
                      </VoltTableHeader>
                      <VoltTableBody>
                        {[
                          ["synthesis", "string", "min:1, max:10000"],
                          ["reasoningChains", "string[]", "max 10, each max 1000"],
                          ["steepV", "object | null", "6 dimensions, each max 1000"],
                          ["matchedTrendIds", "string[]", "max 40, each max 100"],
                          ["keyInsights", "string[]", "max 10, each max 1000"],
                          ["regulatoryContext", "string[]", "max 10, each max 1000"],
                          ["causalAnalysis", "string[]", "max 10, each max 1000"],
                          ["scenarios", "Scenario[]", "max 5; type, name, description, probability, timeframe, keyDrivers"],
                          ["interpretation", "string | null", "max 3000"],
                          ["references", "Reference[]", "max 20; title (max 500), url (max 2000, http/https)"],
                          ["followUpQuestions", "string[]", "max 10, each max 500"],
                          ["balancedScorecard", "BSC | null", "3-6 perspectives, scores 0-1, impacts -1 to +1"],
                          ["confidence", "number", "0-1, preprocess: string -> number"],
                        ].map(([field, type, constr]) => (
                          <VoltTableRow key={field}>
                            <VoltTableCell><Code>{field}</Code></VoltTableCell>
                            <VoltTableCell className="font-mono text-xs">{type}</VoltTableCell>
                            <VoltTableCell className="text-xs">{constr}</VoltTableCell>
                          </VoltTableRow>
                        ))}
                      </VoltTableBody>
                    </VoltTableRoot>
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "matchedTrendIds Anti-Halluzination (VAL-02)" : "matchedTrendIds Anti-Hallucination (VAL-02)"}</SubH>
                  <VoltAlert variant="error" title="Anti-Hallucination">
                    <ul className="text-[12px] mt-1.5 space-y-1 list-disc pl-3">
                      <li>{de ? "Jede Trend-ID wird gegen die echte validTrendIds-Menge geprüft" : "Every trend ID checked against real validTrendIds set"}</li>
                      <li>{de ? "Nicht existierende IDs entfernt + Warning geloggt" : "Non-existent IDs removed + warning logged"}</li>
                      <li>{de ? "Meldung: \"Dropped N/M hallucinated matchedTrendIds: ...\"" : "Message: \"Dropped N/M hallucinated matchedTrendIds: ...\""}</li>
                    </ul>
                  </VoltAlert>

                  <SubH>{de ? "Szenario-Normalisierung & URL-Validierung" : "Scenario Normalization & URL Validation"}</SubH>
                  <ul className="text-[13px] leading-relaxed space-y-1.5 pl-4 list-disc" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    <li>{de ? "Null/nicht-numerische Wahrscheinlichkeiten: Defaults (baseline=0.45, optimistic=0.30, pessimistic=0.25)" : "Null/non-numeric probabilities: defaults (baseline=0.45, optimistic=0.30, pessimistic=0.25)"}</li>
                    <li>{de ? "Summe 0.8-1.1 akzeptabel, sonst normalisiert auf 1.0" : "Sum 0.8-1.1 acceptable, otherwise normalized to 1.0"}</li>
                    <li>{de ? "URLs müssen http/https-Protokoll haben, malformed URLs werden entfernt" : "URLs must have http/https protocol, malformed URLs are removed"}</li>
                  </ul>

                  <VoltSeparator />

                  <SubH>Rate Limiting</SubH>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <VoltStat label="Requests/IP/h" value={100} size="sm" />
                    <VoltStat label="Window" value="Sliding" size="sm" />
                    <VoltStat label="HTTP" value={429} size="sm" />
                    <VoltStat label="Retry-After" value="3600s" size="sm" />
                  </div>

                  <SubH>{de ? "JSON-Reparatur & Frontend-Transparenz" : "JSON Repair & Frontend Transparency"}</SubH>
                  <ul className="text-[13px] leading-relaxed space-y-1.5 pl-4 list-disc" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    <li>{de ? "Truncated JSON: offene Strukturen zählen, Schlussklammern anfügen" : "Truncated JSON: count open structures, append closing brackets"}</li>
                    <li>{de ? "Reparierte Ergebnisse: _repaired: true" : "Repaired results: _repaired: true"}</li>
                    <li>{de ? "Frontend: \"KI-vorgeschlagen\"-Badge bei Referenzen, \"Repariert\"-Badge, Datenhinweis-Badges" : "Frontend: \"AI-suggested\" badge on references, \"Repaired\" badge, data quality badges"}</li>
                  </ul>
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                06 — ANALYSIS FRAMEWORKS
                ══════════════════════════════════════════════════ */}
            <section id="frameworks" className="scroll-mt-20">
              <SectionHeading num="06">
                {de ? "Analyse-Frameworks (6)" : "Analysis Frameworks (6)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-4 p-6">
                  <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Neben der Standard-Analyse (STEEP+V) können 6 spezialisierte Frameworks gewählt werden:"
                      : "Beyond the default analysis (STEEP+V), 6 specialized frameworks can be selected:"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      {
                        num: "1", title: de ? "Marktanalyse" : "Market Analysis", method: "SWOT + PESTEL",
                        desc: de ? "Stärken/Schwächen/Chancen/Risiken und PESTEL-Umfeldanalyse für Markt- und Wettbewerbsfragen." : "Strengths/Weaknesses/Opportunities/Threats and PESTEL for market and competitive questions.",
                      },
                      {
                        num: "2", title: "War-Gaming", method: "RAND + Shell Scenarios",
                        desc: de ? "Strategische Simulation mit Akteursanalyse, Zügen und Gegenzügen. Geopolitik & Konkurrenzstrategie." : "Strategic simulation with actor analysis, moves and counter-moves. Geopolitics & competitive strategy.",
                      },
                      {
                        num: "3", title: "Pre-Mortem", method: "Gary Klein (1998)",
                        desc: de ? "Proaktive Risikoanalyse: 'Stell dir vor, das Projekt ist gescheitert. Warum?' Blinde Flecken erkennen." : "Proactive risk analysis: 'Imagine the project has failed. Why?' Identify blind spots.",
                      },
                      {
                        num: "4", title: "Post-Mortem", method: "Toyota 5-Whys",
                        desc: de ? "Ursachenanalyse: Fuenffaches 'Warum?' bis zur Wurzelursache. Fuer Vorfallanalyse." : "Root cause analysis: five times 'Why?' to the root cause. For incident analysis.",
                      },
                      {
                        num: "5", title: "Trend Deep-Dive", method: "STEEP+V Extended",
                        desc: de ? "Systemische Analyse entlang aller 6 Dimensionen mit Wechselwirkungen und Kaskadeneffekten." : "Systemic analysis along all 6 dimensions with interactions and cascade effects.",
                      },
                      {
                        num: "6", title: "Stakeholder", method: "Mitchell Salience Model (1997)",
                        desc: de ? "Einfluss-Mapping nach Power/Legitimacy/Urgency. Dominante, abhängige und fordernde Stakeholder." : "Influence mapping by Power/Legitimacy/Urgency. Dominant, dependent and demanding stakeholders.",
                      },
                    ].map((fw) => (
                      <VoltCard key={fw.num} variant="outlined">
                        <VoltCardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <span
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-sm font-bold"
                              style={{ background: "#E4FF97", color: "#0A0A0A" }}
                            >
                              {fw.num}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-sm mb-0.5" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>{fw.title}</div>
                              <div className="font-mono text-[11px] mb-1.5" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>{fw.method}</div>
                              <div className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>{fw.desc}</div>
                            </div>
                          </div>
                        </VoltCardContent>
                      </VoltCard>
                    ))}
                  </div>
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                07 — KNOWLEDGE BASE
                ══════════════════════════════════════════════════ */}
            <section id="knowledge" className="scroll-mt-20">
              <SectionHeading num="07">
                {de ? "Wissensbasis (Trends, Kausalgraph, Regulierungen)" : "Knowledge Base (Trends, Causal Graph, Regulations)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Basiert auf 6 autoritativen Quellen: Zukunftsinstitut (11 Megatrends), PwC (5 Megatrends), EY (Megatrends 2026+), EU ESPAS (Global Trends to 2030), Roland Berger (Trend Compendium 2050), TRENDONE (Trend Universe 2026)."
                      : "Based on 6 authoritative sources: Zukunftsinstitut, PwC, EY, EU ESPAS, Roland Berger, TRENDONE."}
                  </p>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <VoltStat label={de ? "Kuratierte Trends" : "Curated Trends"} value={40} variant="lime" size="sm" />
                    <VoltStat label={de ? "Kausale Kanten" : "Causal Edges"} value={102} size="sm" />
                    <VoltStat label={de ? "Regulierungen" : "Regulations"} value={15} size="sm" />
                    <VoltStat label={de ? "Quellen" : "Sources"} value="42+" size="sm" />
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "Trend-Beispiele" : "Trend Examples"}</SubH>
                  <div className="space-y-2">
                    {[
                      {
                        id: "mega-ai-transformation", name: "AI & Automation",
                        desc: de ? "PwC: bis 2030 bis zu 15,7 Bio. USD. Treiber: sinkende Rechenkosten, multimodale Modelle, EU AI Act seit Aug 2024." : "PwC: up to 15.7T USD by 2030. Drivers: falling compute costs, multimodal models, EU AI Act since Aug 2024.",
                        stats: "Rel:98% Conf:95% Imp:98% Ring:adopt Velocity:rising",
                      },
                      {
                        id: "mega-climate-sustainability", name: "Climate & Sustainability",
                        desc: de ? "IPCC AR6: 1,1 Grad. EU Green Deal: Klimaneutralität 2050, -55% bis 2030. 6/6 Quellen (höchste Confidence)." : "IPCC AR6: 1.1 degree. EU Green Deal: climate neutrality 2050, -55% by 2030. 6/6 sources (highest confidence).",
                        stats: "Rel:96% Conf:100% Imp:97% Ring:adopt Velocity:rising",
                      },
                      {
                        id: "mega-geopolitical-fracturing", name: "Geopolitical Fragmentation",
                        desc: de ? "PwC: 'Fracturing World'. Tech/Handels/Finanzräume fragmentieren. EU: strategische Autonomie." : "PwC: 'Fracturing World'. Tech/trade/financial fragmentation. EU: strategic autonomy.",
                        stats: "Rel:85% Conf:83% Imp:88% Ring:adopt Velocity:rising",
                      },
                      {
                        id: "mega-demographic-shift", name: "Demographic Shifts & Aging",
                        desc: de ? "UN 2024: 65+ global 10% -> 16% (2050). EU-Dependency-Ratio 33% -> >50%." : "UN 2024: 65+ globally 10% -> 16% (2050). EU dependency ratio 33% -> >50%.",
                        stats: "Rel:88% Conf:83% Imp:90% Ring:adopt Velocity:stable",
                      },
                    ].map((t) => (
                      <div key={t.id} className="p-3 rounded-lg" style={{ border: "1px solid var(--color-border, #E8E8E8)" }}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Code>{t.id}</Code>
                          <span className="text-sm font-bold" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>{t.name}</span>
                        </div>
                        <p className="text-[12px] mb-1.5" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>{t.desc}</p>
                        <p className="font-mono text-[11px]" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>{t.stats}</p>
                      </div>
                    ))}
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "Kausale Kanten (102, aus causal-graph.ts)" : "Causal Edges (102, from causal-graph.ts)"}</SubH>
                  <p className="text-[13px] mb-2" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "4 Kantentypen: drives, amplifies, dampens, correlates. Stärke: 0-1."
                      : "4 edge types: drives, amplifies, dampens, correlates. Strength: 0-1."}
                  </p>
                  <VoltTerminalStatic
                    title="Causal Edges"
                    variant="dark"
                    size="sm"
                    maxHeight="240px"
                    lines={[
                      L("mega-climate --drives(95%)--> mega-energy-transition", "success"),
                      L("  \"Climate urgency accelerates energy transition\"", "comment"),
                      L(""),
                      L("mega-ai --drives(95%)--> mega-future-of-work", "success"),
                      L("  \"AI reshapes jobs, skills, and work models\"", "comment"),
                      L(""),
                      L("mega-ai --amplifies(98%)--> macro-generative-ai", "info"),
                      L("  \"AI research produces generative AI capabilities\"", "comment"),
                      L(""),
                      L("mega-geopolitical --dampens(70%)--> mega-connectivity", "error"),
                      L("  \"Fragmentation leads to splinternet, tech decoupling\"", "comment"),
                      L(""),
                      L("mega-demographic --drives(90%)--> mega-health-biotech", "success"),
                      L("  \"Aging populations drive healthcare innovation\"", "comment"),
                      L(""),
                      L("mega-ai --drives(80%)--> mega-security-trust", "warning"),
                      L("  \"AI creates new attack vectors and defense needs\"", "comment"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Regulatorische Frameworks (15)" : "Regulatory Frameworks (15)"}</SubH>
                  <div className="overflow-x-auto">
                    <VoltTableRoot>
                      <VoltTableHeader>
                        <VoltTableRow>
                          <VoltTableHead>Name</VoltTableHead>
                          <VoltTableHead>{de ? "Jurisdiktion" : "Jurisdiction"}</VoltTableHead>
                          <VoltTableHead>Status</VoltTableHead>
                          <VoltTableHead>{de ? "Beschreibung" : "Description"}</VoltTableHead>
                        </VoltTableRow>
                      </VoltTableHeader>
                      <VoltTableBody>
                        {[
                          { name: "AI Act", j: "EU", s: "enforcing", d: de ? "Weltweit erste umfassende KI-Regulierung (seit 08/2024)" : "World's first comprehensive AI regulation (since 08/2024)" },
                          { name: "GDPR", j: "EU", s: "enforcing", d: de ? "Datenschutz-Grundverordnung (seit 05/2018), extraterritorial" : "General Data Protection Regulation (since 05/2018), extraterritorial" },
                          { name: "DORA", j: "EU", s: "enforcing", d: de ? "IKT-Risikomanagement für Finanzsektor (seit 01/2025)" : "ICT risk management for financial sector (since 01/2025)" },
                          { name: "NIS2", j: "EU", s: "enforcing", d: de ? "Cybersicherheit für kritische Infrastruktur (seit 10/2024)" : "Cybersecurity for critical infrastructure (since 10/2024)" },
                          { name: "Green Deal", j: "EU", s: "enforcing", d: de ? "Klimaneutralität 2050, -55% bis 2030, CBAM, ETS" : "Climate neutrality 2050, -55% by 2030, CBAM, ETS" },
                          { name: "DMA/DSA", j: "EU", s: "enforcing", d: de ? "Platform-Regulierung, Gatekeeper (seit 11/2023)" : "Platform regulation, gatekeeper (since 11/2023)" },
                          { name: "CSRD", j: "EU", s: "enforcing", d: de ? "Nachhaltigkeitsberichterstattung, ~50.000 Unternehmen" : "Sustainability reporting, ~50,000 companies" },
                          { name: "AI EO", j: "US", s: "enforcing", d: de ? "Executive Order KI-Sicherheit (seit 10/2023)" : "Executive Order on AI safety (since 10/2023)" },
                          { name: "CHIPS Act", j: "US", s: "enforcing", d: de ? "$280B Halbleiter, Reshoring, Exportkontrollen" : "$280B semiconductors, reshoring, export controls" },
                          { name: "IRA", j: "US", s: "enforcing", d: de ? "$370B Clean Energy, EV/Solar/Wind Tax Credits" : "$370B clean energy, EV/solar/wind tax credits" },
                          { name: "CN AI Gov", j: "China", s: "enforcing", d: de ? "KI-Regulierung, Algorithmen-Regeln, Deepfake-Regeln" : "AI regulation, algorithm rules, deepfake rules" },
                          { name: "DSL/PIPL", j: "China", s: "enforcing", d: de ? "Datenlokalisierung, Chinas GDPR" : "Data localization, China's GDPR" },
                          { name: "UK AI", j: "UK", s: "adopted", d: de ? "Pro-Innovation, sektorspezifisch" : "Pro-innovation, sector-specific" },
                          { name: "OSA", j: "UK", s: "enforcing", d: de ? "Online-Sicherheit, Altersverifikation" : "Online safety, age verification" },
                          { name: "SDGs", j: "Global", s: "enforcing", d: de ? "UN 17 Nachhaltigkeitsziele 2030" : "UN 17 SDGs 2030" },
                          { name: "Paris", j: "Global", s: "enforcing", d: de ? "Klimaabkommen: 1,5-Grad-Ziel" : "Climate Agreement: 1.5 degree target" },
                          { name: "Basel III", j: "Global", s: "enforcing", d: de ? "Bankenregulierung: Eigenkapital, Stresstests" : "Banking regulation: capital adequacy, stress testing" },
                        ].map((r) => (
                          <VoltTableRow key={r.name}>
                            <VoltTableCell><Code>{r.name}</Code></VoltTableCell>
                            <VoltTableCell className="text-xs">{r.j}</VoltTableCell>
                            <VoltTableCell>
                              <VoltBadge variant={r.s === "enforcing" ? "positive" : "blue"} size="sm">{r.s}</VoltBadge>
                            </VoltTableCell>
                            <VoltTableCell className="text-xs">{r.d}</VoltTableCell>
                          </VoltTableRow>
                        ))}
                      </VoltTableBody>
                    </VoltTableRoot>
                  </div>
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                08 — SCORING & CONFIDENCE
                ══════════════════════════════════════════════════ */}
            <section id="scoring" className="scroll-mt-20">
              <SectionHeading num="08">
                {de ? "Scoring & Konfidenz-Berechnung" : "Scoring & Confidence Calculation"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Das System berechnet Konfidenz-Scores auf zwei unabhängigen Pfaden und kombiniert sie. Quellcode: scoring.ts, intelligence-engine.ts, validation.ts"
                      : "The system computes confidence on two independent paths and combines them. Source: scoring.ts, intelligence-engine.ts, validation.ts"}
                  </p>

                  <SubH>{de ? "Quellen-Gewichtungen" : "Source Weights"}</SubH>
                  <VoltTerminalStatic
                    title="scoring.ts"
                    variant="dark"
                    size="sm"
                    maxHeight="150px"
                    lines={[
                      L("DEFAULT_SOURCE_WEIGHTS:", "comment"),
                      L("  google_trends: 1.0   hackernews: 1.0   github:  1.0"),
                      L("  arxiv:         0.7   news:       0.9   reddit:  0.8"),
                      L("  stackoverflow: 0.7   npm_pypi:   0.6   product: 0.5"),
                      L("  wikipedia:     0.4"),
                      L(""),
                      L("DEFAULT_DIMENSION_WEIGHTS:", "comment"),
                      L("  relevance: 0.35  confidence: 0.25  impact: 0.25  recency: 0.15"),
                      L("  TIME_DECAY_LAMBDA = 0.05  (Halbwertszeit ~14 Tage)", "info"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Synchrone Konfidenz-Formel" : "Synchronous Confidence Formula"}</SubH>
                  <VoltTerminalStatic
                    title="intelligence-engine.ts"
                    variant="dark"
                    size="sm"
                    maxHeight="200px"
                    lines={[
                      L("trendComponent  = log2(1 + matchedTrends) / log2(1 + 50) * 0.4"),
                      L("sourceComponent = log2(1 + totalSources)  / log2(1 + 30) * 0.25"),
                      L("signalComponent = (1 - 1/(1+0.005*sqrt(totalSignals))) * 0.3"),
                      L(""),
                      L("confidence = min(0.98, sum of all components)", "success"),
                      L(""),
                      L("// ~0.4 bei 50 Trends, ~0.25 bei 30 Quellen, ~0.3 bei ~500 Signalen", "comment"),
                      L("// Erreicht ~0.95 nur mit umfassender Datenabdeckung", "comment"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Blended Confidence (VAL-03)" : "Blended Confidence (VAL-03)"}</SubH>
                  <VoltTerminalStatic
                    title="validation.ts"
                    variant="dark"
                    size="sm"
                    maxHeight="220px"
                    lines={[
                      L("// Server-Evidenz-Score:", "comment"),
                      L("trendComp  = log2(1 + matchedTrendCount) / log2(1+50) * 0.35"),
                      L("sourceComp = log2(1 + sourceCount)       / log2(1+30) * 0.25"),
                      L("signalComp = (1 - 1/(1+0.005*sqrt(signalCount)))      * 0.25"),
                      L("refComp    = hasReferences ? 0.15 : 0"),
                      L("serverScore = min(0.95, sum of all components)"),
                      L(""),
                      L("// Blended:", "comment"),
                      L("blended = 0.6 * serverScore + 0.4 * llmConfidence", "success"),
                      L("result  = min(0.98, max(0.05, blended))", "success"),
                      L("// Auf 2 Dezimalstellen gerundet", "comment"),
                    ]}
                  />
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                09 — OUTPUT STRUCTURE
                ══════════════════════════════════════════════════ */}
            <section id="output" className="scroll-mt-20">
              <SectionHeading num="09">
                {de ? "Ausgabestruktur (vollständiges JSON-Schema)" : "Output Structure (Complete JSON Schema)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-4 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Die strukturierte JSON-Antwort nach Validierung und Augmentation. Alle Felder per Zod typsicher geprüft."
                      : "The structured JSON response after validation and augmentation. All fields type-checked via Zod."}
                  </p>
                  <VoltTerminalStatic
                    title="Response Schema"
                    variant="dark"
                    maxHeight="600px"
                    lines={tl(
`{
  // Kern-Analyse
  "synthesis": string,           // 6-10 Saetze, max 10.000
  "reasoningChains": string[],   // Kausale Ketten, max 10
  "steepV": {                    // STEEP+V (nullable)
    "S": string|null,            // Society, max 1000
    "T": string|null,            // Technology
    "E_economy": string|null,    // Economy
    "E_environment": string|null,// Environment
    "P": string|null,            // Politics
    "V": string|null             // Values
  },

  // Trend-Matching
  "matchedTrendIds": string[],   // Verifizierte IDs, max 40
  "matchedTrends": [{            // Augmentiert
    "id", "name", "category", "tags", "relevance",
    "confidence", "impact", "velocity", "ring", "signalCount"
  }],
  "matchedEdges": [{             // Kausale Kanten
    "from", "to", "type", "strength", "description"
  }],

  // Erkenntnisse
  "keyInsights": string[],       // 3-5, max 10
  "regulatoryContext": string[],
  "causalAnalysis": string[],

  // Szenarien (IMMER genau 3)
  "scenarios": [{
    "type": "optimistic"|"baseline"|"pessimistic",
    "name": string,              // max 200, max 5 Woerter
    "description": string,       // max 2000, mind. 2 Saetze
    "probability": number,       // 0-1, Summe ~1.0
    "timeframe": string,
    "keyDrivers": string[]       // max 10
  }],

  // Strategische Einordnung
  "interpretation": string|null,
  "decisionFramework": string|null,
  "newsContext": string|null,

  // Quellen & Evidenz
  "references": [{               // min 2, max 20
    "title": string,
    "url": string,               // http/https only
    "relevance": string
  }],
  "usedSignals": [{              // Augmentiert
    "source", "title", "url", "strength", "date"
  }],

  // Folgefragen
  "followUpQuestions": string[], // max 10

  // Balanced Scorecard (optional)
  "balancedScorecard": {
    "perspectives": [{           // 3-6 Dimensionen
      "id", "label", "score": 0-1,
      "trend": "rising"|"stable"|"declining"|"uncertain",
      "summary", "keyFactors", "connectedTrendIds",
      "impacts": { [perspId]: -1 to +1 }
    }],
    "overallReadiness": 0-1,
    "criticalTension": string
  } | null,

  // Konfidenz
  "confidence": number,          // 0.05-0.98, blended

  // Meta
  "_repaired": boolean,
  "_dataQualityWarnings": string[],
  "_validationWarnings": string[]
}`
                    )}
                  />
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                10 — ANALYSIS PIPELINE
                ══════════════════════════════════════════════════ */}
            <section id="pipeline" className="scroll-mt-20">
              <SectionHeading num="10">
                {de ? "Analyse-Pipeline (vollständiger Ablauf)" : "Analysis Pipeline (Complete Flow)"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="p-6">
                  <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Der vollständige Ablauf von der Nutzereingabe bis zur validierten Antwort (route.ts):"
                      : "The complete flow from user input to validated answer (route.ts):"}
                  </p>
                  <div className="relative">
                    {pipelineSteps.map((step, i) => (
                      <div key={step.num} className="flex gap-4 items-start relative">
                        {/* Vertical connector line */}
                        {i < pipelineSteps.length - 1 && (
                          <div
                            className="absolute left-[14px] top-8 w-px"
                            style={{
                              height: "calc(100% - 8px)",
                              background: "var(--color-border, #E8E8E8)",
                            }}
                          />
                        )}
                        {/* Number circle */}
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[11px] font-bold z-10"
                          style={{ background: "#E4FF97", color: "#0A0A0A" }}
                        >
                          {step.num}
                        </div>
                        {/* Content */}
                        <div className="pb-5 min-w-0">
                          <div className="text-sm font-semibold" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                            {step.t}
                          </div>
                          {step.d && (
                            <div className="text-[12px] mt-0.5 font-mono" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                              {step.d}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ══════════════════════════════════════════════════
                11 — KNOWN LIMITATIONS
                ══════════════════════════════════════════════════ */}
            <section id="limitations" className="scroll-mt-20">
              <SectionHeading num="11">
                {de ? "Bekannte Einschränkungen" : "Known Limitations"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-4 p-6">
                  <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Transparenz ueber die Grenzen des Systems (basierend auf Code-Review):"
                      : "Transparency about the system's boundaries (based on code review):"}
                  </p>

                  <div className="space-y-2">
                    {[
                      { de: "Signal-Retrieval ist keyword-basiert (kein semantisches/Embedding-basiertes Retrieval). Synonyme nur ueber die 9 Alias-Gruppen.", en: "Signal retrieval is keyword-based (no semantic/embedding retrieval). Synonyms only via 9 alias groups." },
                      { de: "Signale sind Metadaten (Titel + max 200 Zeichen Snippet), keine vollständigen Artikel.", en: "Signals are metadata (title + max 200-char snippet), not full articles." },
                      { de: "Confidence-Scores sind logarithmisch skalierte Approximationen, nicht statistische Konfidenzintervalle. Max 0.98.", en: "Confidence scores are log-scaled approximations, not statistical confidence intervals. Max 0.98." },
                      { de: "Szenarien sind analytische Denkrahmen, keine Vorhersagen. Wahrscheinlichkeiten durch Server-Score kalibriert.", en: "Scenarios are analytical frames, not predictions. Probabilities calibrated by server score." },
                      { de: "URLs können trotz Format-Validierung LLM-fabriziert sein. URL-Existenz wird nicht geprüft.", en: "URLs may be LLM-fabricated despite format validation. URL existence is not verified." },
                      { de: "Stärkste Abdeckung: Technologie, Wirtschaft, Klima, Geopolitik, EU-Politik.", en: "Strongest coverage: Tech, Economy, Climate, Geopolitics, EU Policy." },
                      { de: "Schwächste Abdeckung: Kultur, Sport, Unterhaltung, lokale/regionale Themen.", en: "Weakest coverage: Culture, Sports, Entertainment, local topics." },
                      { de: "Einzelnes LLM (Claude claude-sonnet-4-6) -- keine modellübergreifende Verifikation.", en: "Single LLM (Claude claude-sonnet-4-6) -- no cross-model verification." },
                      { de: "Rate Limiting In-Memory, resets bei Server-Neustart.", en: "Rate limiting in-memory, resets on server restart." },
                      { de: "System-Prompt enthält nur Top 40 Trends.", en: "System prompt contains only top 40 trends." },
                      { de: "Kausale Kanten (102) statisch kodiert. Kein UI zum Bearbeiten.", en: "Causal edges (102) statically coded. No edit UI." },
                      { de: "previousContext: nur die letzte Frage/Antwort, kein Multi-Turn-Gedächtnis.", en: "previousContext: only last Q&A, no multi-turn memory." },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 text-[13px] leading-relaxed"
                        style={{ color: "var(--color-text-heading, #0A0A0A)" }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                          style={{ background: "var(--color-text-muted, #6B6B6B)" }}
                        />
                        <span>{de ? item.de : item.en}</span>
                      </div>
                    ))}
                  </div>

                  <VoltAlert variant="success" title={de ? "Design-Prinzip" : "Design Principle"}>
                    {de
                      ? "Transparenz über Unsicherheit ist wertvoller als falsche Präzision. Das System zeigt explizit an, worauf es sich stützt und wo die Grenzen liegen. Jede Aussage ist mit Provenienz-Tags ([SIGNAL], [TREND], [LLM-Einschätzung]) markiert."
                      : "Transparency about uncertainty is more valuable than false precision. The system explicitly shows what it relies on and where boundaries are. Every statement is marked with provenance tags ([SIGNAL], [TREND], [LLM-Einschätzung])."}
                  </VoltAlert>
                </VoltCardContent>
              </VoltCard>
            </section>

            {/* ── Footer ───────────────────────────────────────── */}
            <div
              className="mt-8 pt-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-mono"
              style={{
                borderTop: "1px solid var(--color-border, #E8E8E8)",
                color: "var(--color-text-muted, #6B6B6B)",
              }}
            >
              <span>Strategic Intelligence System</span>
              <span>
                {de
                  ? "Alle Angaben aus dem Quellcode extrahiert"
                  : "All claims extracted from source code"}
              </span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
