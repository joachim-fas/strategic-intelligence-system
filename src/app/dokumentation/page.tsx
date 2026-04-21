/**
 * /dokumentation — Internal developer docs surface.
 *
 * **i18n note (A5-H9, 2026-04-19):** This page and `/komponenten`
 * intentionally use inline `de ? "…" : "…"` ternaries instead of
 * the shared i18n dictionary. The strings are used exactly once,
 * locally, and the content itself IS the point — migrating ~184
 * sentences into `src/lib/i18n.ts` would double the dictionary
 * size without buying any reuse. If a third locale ever lands,
 * a co-located `content.ts` module is a better fit than the
 * shared dictionary. Until then: inline bilingual is intentional,
 * not tech debt.
 */

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
import { connectors } from "@/connectors";
import { megaTrends } from "@/lib/mega-trends";
import { TREND_EDGES } from "@/lib/causal-graph";
import { GLOBAL_REGULATIONS } from "@/lib/regulations";

/* ─── Live system counts ──────────────────────────────────────
 * Previously this page hardcoded "57 Connectors", "40 Trends",
 * "102 Kanten", "15 Regulierungen". After the RSS expansion
 * (now ~100 connectors) the literals were lying. Read the real
 * numbers from the registries at render time. */
const CONNECTOR_COUNT = connectors.length;
const TREND_COUNT = megaTrends.length;
const EDGE_COUNT = TREND_EDGES.length;
const REGULATION_COUNT = GLOBAL_REGULATIONS.length;

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
        { name: "Bluesky (AT Protocol)" }, { name: "Mastodon" },
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
    { num: 7, t: de ? "System-Prompt aufbauen (v0.2)" : "Build System Prompt (v0.2)", d: de ? `buildSystemPrompt() -- Identity + 6-Punkte-Reasoning + ${TREND_COUNT} Trends + ${REGULATION_COUNT} Regulierungen + ${EDGE_COUNT} Edges + Live-Signale + Source-Rules (SIGNAL>TREND>REG>EDGE>LLM) + Temporal Validity + v0.2 JSON-Schema` : `buildSystemPrompt() -- identity + 6-step reasoning + ${TREND_COUNT} trends + ${REGULATION_COUNT} regulations + ${EDGE_COUNT} edges + live signals + source rules (SIGNAL>TREND>REG>EDGE>LLM) + temporal validity + v0.2 JSON schema` },
    { num: 8, t: de ? "previousContext (SEC-10)" : "previousContext (SEC-10)", d: de ? "Synthesis auf 6.000 Zeichen begrenzen, sanitisieren, als Assistant-Message" : "Truncate synthesis to 6,000 chars, sanitize, inject as assistant message" },
    { num: 9, t: "LLM-Streaming (Anthropic API)", d: de ? "claude-sonnet-4-6, max_tokens: 12.000, SSE-Streaming, Retry bis 3x bei 429/529" : "claude-sonnet-4-6, max_tokens: 12,000, SSE streaming, retry up to 3x on 429/529" },
    { num: 10, t: de ? "Synthese-Extraktion während Streaming" : "Synthesis Extraction During Streaming", d: de ? "Progressive JSON-Parsing, Delta-Extraktion für Live-Anzeige" : "Progressive JSON parsing, delta extraction for live display" },
    { num: 11, t: de ? "JSON-Extraktion (ggf. Reparatur)" : "JSON Extraction (with repair)", d: de ? "extractJSON() -- Markdown-Fences entfernen, truncated JSON reparieren" : "extractJSON() -- strip markdown fences, repair truncated JSON" },
    { num: 12, t: "Zod-Validierung (VAL-01)", d: de ? "Alle Felder typsicher prüfen, bei Fehler: Partial-Extraction" : "Type-check all fields, on error: partial extraction" },
    { num: 13, t: "matchedTrendIds (VAL-02)", d: de ? "Halluzinierte IDs entfernen und loggen" : "Remove and log hallucinated IDs" },
    { num: 14, t: de ? "Szenario-Normalisierung" : "Scenario Normalization", d: de ? "Nulls -> Defaults, Summe 0.8-1.1 akzeptabel, sonst normalisieren" : "Nulls -> defaults, sum 0.8-1.1 acceptable, otherwise normalize" },
    { num: 15, t: "Blended Confidence (VAL-03)", d: "0.6 * serverScore + 0.4 * llmConfidence, clamped [0.05, 0.98]" },
    { num: 16, t: de ? "Calibrated Confidence (v0.2)" : "Calibrated Confidence (v0.2)", d: de ? "computeCalibratedConfidence() -- signalCoverage*0.30 + signalRecency*0.25 + signalStrength*0.20 + sourceVerification*0.15 + causalCoverage*0.10. OVERWRITES LLM-Selbsteinschätzung." : "computeCalibratedConfidence() -- signalCoverage*0.30 + signalRecency*0.25 + signalStrength*0.20 + sourceVerification*0.15 + causalCoverage*0.10. OVERWRITES LLM self-assessment." },
    { num: 17, t: de ? "DataQuality-Verifikation (v0.2)" : "DataQuality Verification (v0.2)", d: de ? "signalCount/newestSignalAge/dominantSourceType backend-verifiziert aus echter Signal-DB -- LLM kann diese Werte nicht erfinden." : "signalCount/newestSignalAge/dominantSourceType backend-verified from actual signal DB -- the LLM cannot fake these." },
    { num: 18, t: de ? "Scenario-Divergence-Check (v0.2)" : "Scenario Divergence Check (v0.2)", d: de ? "checkScenarioDivergence() -- 6 Regeln: Probability-Sum, Kausal-Distinktheit, falsifizierbare Annahmen, Horizont-Mix, Early Indicators, Akteur-Differenzierung." : "checkScenarioDivergence() -- 6 rules: probability sum, causal distinctness, falsifiable assumptions, horizon mix, early indicators, actor differentiation." },
    { num: 19, t: de ? "Deep-Mode Meta-Pipeline (opt-in)" : "Deep-Mode Meta-Pipeline (opt-in)", d: de ? "Bei mode:'deep': Contradiction Detection (Haiku) + Assumption Extraction (Sonnet) parallel. confidenceAdjustment wird abgezogen." : "If mode:'deep': Contradiction Detection (Haiku) + Assumption Extraction (Sonnet) in parallel. confidenceAdjustment is subtracted." },
    { num: 20, t: "Augmentation", d: de ? "matchedTrends-Details, Kausal-Kanten (name-matched), Signal-Metadaten, Provenance-Tag-Analyse" : "matchedTrends details, causal edges (name-matched), signal metadata, provenance tag analysis" },
    { num: 21, t: de ? "Ergebnis an Client streamen" : "Stream Result to Client", d: de ? "SSE: { type: 'delta', text } während Streaming, { type: 'complete', result } am Ende mit _confidenceCalibration, _scenarioDivergence, ggf. _contradictionReport, _assumptionReport" : "SSE: { type: 'delta', text } during streaming, { type: 'complete', result } at end with _confidenceCalibration, _scenarioDivergence, optionally _contradictionReport, _assumptionReport" },
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
            {["Next.js 15", "React 19", "Claude claude-sonnet-4-6", "SQLite + WAL", `${CONNECTOR_COUNT} Connectors`, "Zod", "SSE Streaming"].map((t) => (
              <VoltBadge key={t} variant="outline" size="sm">{t}</VoltBadge>
            ))}
          </div>
        </div>

        {/* ── Key Stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <VoltStat label="Live-Connectors" value={CONNECTOR_COUNT} variant="lime" />
          <VoltStat label={de ? "Kuratierte Trends" : "Curated Trends"} value={TREND_COUNT} />
          <VoltStat label={de ? "Kausale Kanten" : "Causal Edges"} value={EDGE_COUNT} />
          <VoltStat label={de ? "Regulierungen" : "Regulations"} value={REGULATION_COUNT} />
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
                      ? `Das SIS (Strategic Intelligence System) ist ein Denk-Instrument auf Think-Tank-Niveau mit explizitem EU-Fokus. Es verbindet ${CONNECTOR_COUNT} Live-Datenquellen mit einem kuratierten Wissensgraphen (${TREND_COUNT} Trends, ${EDGE_COUNT} kausale Kanten, ${REGULATION_COUNT} Regulierungen) und einem LLM-Analysekern (Claude claude-sonnet-4-6) zu einem Retrieval-Augmented-Generation (RAG) System, das strategische Fragen strukturiert und belegt beantwortet.`
                      : `SIS (Strategic Intelligence System) is a thinking instrument at think-tank level with an explicit EU focus. It connects ${CONNECTOR_COUNT} live data sources with a curated knowledge graph (${TREND_COUNT} trends, ${EDGE_COUNT} causal edges, ${REGULATION_COUNT} regulations) and an LLM analysis core (Claude claude-sonnet-4-6) into a RAG system that answers strategic questions in a structured and evidence-based way.`}
                  </p>

                  <SubH>{de ? "RAG-Architektur (Datenfluss)" : "RAG Architecture (Data Flow)"}</SubH>
                  <VoltTerminalStatic
                    title="RAG Architecture"
                    variant="dark"
                    maxHeight="none"
                    lines={tl(
// Dynamic counts — the literals "57 Connectors" / "Top 40 Trends" /
// "15 Regulierungen" / "102 Kausale Kanten" drifted post-RSS merge.
// Render from the live registries so the diagram is always honest.
`┌──────────────────────────────────────────────────────────┐
│  ${String(CONNECTOR_COUNT).padEnd(3, " ")}Connectors (APIs)                                   │
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
│  System Prompt Builder (v0.2, buildSystemPrompt)          │
│  Identity + 6-Punkte-Reasoning-Discipline                │
│  + Top ${TREND_COUNT} Trends + ${REGULATION_COUNT} Regulierungen + ${EDGE_COUNT} Edges │
│  + Live-Signale + Source Rules + Temporal Validity       │
│  + STEEP+V + EU JRC 14 Megatrends + v0.2 JSON-Schema    │
└────────────────────────────┬─────────────────────────────┘
                             │ Anthropic API (claude-sonnet-4-6)
                             │ max_tokens: 12.000, SSE
                             v
┌──────────────────────────────────────────────────────────┐
│  Post-Processing & Validation                            │
│  1. JSON-Extraktion (inkl. Reparatur bei Truncation)     │
│  2. Zod-Schema-Validierung (VAL-01, v0.2-aware)          │
│  3. matchedTrendIds Anti-Halluzination (VAL-02)          │
│  4. Szenario-Normalisierung                              │
│  5. Blended Confidence (VAL-03) -> Calibrated (v0.2)    │
│  6. URL-Validierung                                      │
│  7. Causal-Edge-Augmentation (name-matched)              │
│  8. DataQuality-Verifikation (v0.2): signalCount,        │
│     newestSignalAge, dominantSourceType (Tag-Analyse)    │
│  9. Scenario-Divergence-Check (v0.2): 6 Regeln           │
│ 10. mode:'deep' -> Contradiction + Assumption (Haiku)    │
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
                      { label: de ? "Datenquellen" : "Data Sources", value: de ? `${CONNECTOR_COUNT} Live-Connectors, institutionelle Forschungsquellen + Open-API-Quellen` : `${CONNECTOR_COUNT} live connectors, institutional research + open-API sources` },
                      { label: "Streaming", value: "SSE (Server-Sent Events), progressive JSON extraction" },
                      { label: "Validation", value: "Zod Schema, Input Sanitization, Rate Limiting" },
                      { label: de ? "Wissensgraph" : "Knowledge Graph", value: de ? `${TREND_COUNT} Trends, ${EDGE_COUNT} kausale Kanten, ${REGULATION_COUNT} Regulierungen` : `${TREND_COUNT} trends, ${EDGE_COUNT} causal edges, ${REGULATION_COUNT} regulations` },
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
                {de ? `Daten-Connectors (${CONNECTOR_COUNT} gesamt)` : `Data Connectors (${CONNECTOR_COUNT} total)`}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-4 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? `Alle ${CONNECTOR_COUNT} Connectors, gruppiert nach Kategorie. Jeder Connector liefert strukturierte Signale (Titel, Inhalt, URL, Datum, Stärke) in die SQLite-Datenbank.`
                      : `All ${CONNECTOR_COUNT} connectors, grouped by category. Each connector delivers structured signals (title, content, URL, date, strength) to the SQLite database.`}
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
                      ? `Das Signal-Retrieval ist die Brücke zwischen den ${CONNECTOR_COUNT} Connectors und dem LLM-Prompt. Es findet die thematisch relevantesten Signale für eine gegebene Nutzeranfrage. Quellcode: signals.ts`
                      : `Signal retrieval bridges the ${CONNECTOR_COUNT} connectors and the LLM prompt. It finds the most topically relevant signals for a given user query. Source: signals.ts`}
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
                      ? "Der System-Prompt ist das Herzstück des SIS. Er instruiert das LLM, als Senior-Strategieberater zu agieren, und liefert gleichzeitig den vollständigen Datenkontext. Struktur aus llm.ts/buildSystemPrompt() — Notion-Blueprint v0.2. Der vollständige Prompt-Text plus alle 23 Registry-Einträge leben unter /dokumentation/prompts."
                      : "The system prompt is the heart of SIS. It instructs the LLM to act as a senior strategy advisor while providing the complete data context. Structure from llm.ts/buildSystemPrompt() — Notion blueprint v0.2. The full prompt text plus all 23 registry entries live at /dokumentation/prompts."}
                  </p>

                  <VoltAlert variant="info" title={de ? "v0.2 (Notion-Blueprint) — live" : "v0.2 (Notion blueprint) — live"}>
                    <div className="text-[13px] mt-2" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                      {de
                        ? <>Der Prompt ist Englisch (Modell-Tuning folgt Englisch), aber der LLM antwortet in der Sprache der Frage. Die vollständige Registry mit <strong>23 Einträgen in 8 Kategorien</strong> (System / Meta / Framework / Slash / Canvas / Export / Context / Pipeline) findest du unter <a href="/dokumentation/prompts" style={{ textDecoration: "underline", fontWeight: 600 }}>/dokumentation/prompts</a>.</>
                        : <>The prompt is in English (model tuning follows English), but the LLM responds in the language of the question. The full registry with <strong>23 entries across 8 categories</strong> (System / Meta / Framework / Slash / Canvas / Export / Context / Pipeline) lives at <a href="/dokumentation/prompts" style={{ textDecoration: "underline", fontWeight: 600 }}>/dokumentation/prompts</a>.</>}
                    </div>
                  </VoltAlert>

                  <SubH>{de ? "Identity (v0.2 Englisch)" : "Identity (v0.2 English)"}</SubH>
                  <VoltTerminalStatic
                    title="Identity"
                    variant="dark"
                    size="sm"
                    maxHeight="200px"
                    lines={[
                      L("You are the Strategic Intelligence System (SIS) --", "info"),
                      L("a European, civilian intelligence terminal for strategic", "info"),
                      L("decision-makers. Your core mission: answer complex", "info"),
                      L("questions about global trends, markets, geopolitics,", "info"),
                      L("and societal developments -- evidence-based,", "info"),
                      L("traceable, hallucination-free.", "info"),
                      L(""),
                      L("## Your Identity", "command"),
                      L("- You are not a chatbot. You are a senior strategy", "info"),
                      L("  advisor with access to a curated world model.", "info"),
                      L("- You work primarily in English but respond in", "info"),
                      L("  the language of the question.", "info"),
                      L("- You think causally, not correlationally.", "info"),
                      L("- You are always honest about data gaps.", "info"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "6-Punkte-Reasoning-Discipline (vor JSON)" : "6-Step Reasoning Discipline (before JSON)"}</SubH>
                  <VoltTerminalStatic
                    title="Reasoning Discipline"
                    variant="dark"
                    size="sm"
                    maxHeight="260px"
                    lines={[
                      L("Before generating your JSON response, reason", "warning"),
                      L("through the problem explicitly:", "warning"),
                      L(""),
                      L("1. What does the question actually ask? What is", "success"),
                      L("   the user's real decision or concern?", "info"),
                      L("2. Which signals, trends, causal edges, and", "success"),
                      L("   regulations are directly relevant? Pull ALL", "info"),
                      L("   matching -- do not artificially limit.", "info"),
                      L("3. Are there conflicts between sources? Resolve", "success"),
                      L("   by priority (see Source Rules). Flag unresolved.", "info"),
                      L("4. What does LLM-KNOWLEDGE add that the world", "success"),
                      L("   model does not cover?", "info"),
                      L("5. Temporal validity: every scenario horizon and", "success"),
                      L("   recommendation future-dated vs CURRENT_DATE.", "info"),
                      L("6. Only then: synthesize and generate the JSON.", "success"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Source Rules (9 kritische Regeln)" : "Source Rules (9 Critical Rules)"}</SubH>
                  <VoltAlert variant="warning" title={de ? "Provenance + Temporal Validity" : "Provenance + Temporal Validity"}>
                    <div className="space-y-2 text-[13px] mt-2">
                      <div><strong>1.</strong> {de ? "Jede Behauptung muss inline getaggt sein:" : "Every claim must be tagged inline:"} <code>[SIGNAL: Source, Date]</code> · <code>[TREND: Name]</code> · <code>[REG: Short]</code> · <code>[EDGE: A → B]</code> · <code>[LLM-KNOWLEDGE]</code></div>
                      <div><strong>2.</strong> {de ? "NIEMALS URLs erfinden. Nur Source + Datum, keine Hyperlinks." : "NEVER invent URLs. Source + date only, no hyperlinks."}</div>
                      <div><strong>3.</strong> {de ? "Datenlücken explizit benennen statt spekulieren." : "State data gaps explicitly rather than speculate."}</div>
                      <div><strong>4.</strong> {de ? "Causal-Graph aktiv nutzen: Mechanismus erklären, nicht nur zwei Trends nebeneinander stellen." : "Use the causal graph actively: explain the mechanism, don't just list two trends."}</div>
                      <div><strong>5.</strong> <strong>{de ? "Quellen-Priorität:" : "Source priority:"}</strong> <code>SIGNAL &gt; TREND &gt; REG &gt; EDGE &gt; LLM-KNOWLEDGE</code>. {de ? "Konflikte in anomalySignals flaggen." : "Flag conflicts in anomalySignals."}</div>
                      <div><strong>6.</strong> {de ? "LLM-KNOWLEDGE ist legitim, aber NIE alleinige Basis für zukunftsgerichtete Empfehlungen — mit ≥1 SIGNAL/TREND/REG paaren." : "LLM-KNOWLEDGE is legitimate but NEVER the sole basis for forward-looking recommendations — pair with ≥1 SIGNAL/TREND/REG."}</div>
                      <div><strong>7.</strong> {de ? "Signale gegen Trends cross-checken; Anomalien in anomalySignals." : "Cross-check signals against trends; flag anomalies in anomalySignals."}</div>
                      <div><strong>8.</strong> <strong>{de ? "Temporal Validity:" : "Temporal validity:"}</strong> {de ? "Keine Empfehlungen mit abgelaufenem Aktionsfenster. Vergangene Deadlines sind Kontext, kein Aktionspunkt. Szenarien starten ab CURRENT_DATE." : "No recommendations with a past action window. Past deadlines are context, not action points. Scenarios start at CURRENT_DATE."}</div>
                      <div><strong>9.</strong> {de ? "Szenarien (genau 3): optimistic / likely / pessimistic mit je anderem Kausal-Mechanismus. Probability-Summe ~100." : "Scenarios (exactly 3): optimistic / likely / pessimistic, each by a DIFFERENT causal mechanism. Probability sum ~100."}</div>
                    </div>
                  </VoltAlert>

                  <VoltSeparator />

                  <SubH>{de ? "Provenance-Tags (5 Tag-Klassen, v0.2 mit [EDGE])" : "Provenance Tags (5 Tag Classes, v0.2 with [EDGE])"}</SubH>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    <div className="px-3 py-2 rounded" style={{ background: "rgba(245, 198, 80, 0.14)", border: "1px solid rgba(245, 198, 80, 0.45)" }}>
                      <strong style={{ color: "#7A5C00" }}>[SIGNAL: Source, Date]</strong><br/>
                      <span className="text-[12px] opacity-80">{de ? "Live-Datum aus einer Connector-Quelle" : "Live event from a connector source"}</span>
                    </div>
                    <div className="px-3 py-2 rounded" style={{ background: "rgba(26, 158, 90, 0.10)", border: "1px solid rgba(26, 158, 90, 0.35)" }}>
                      <strong style={{ color: "#0F6038" }}>[TREND: Name]</strong><br/>
                      <span className="text-[12px] opacity-80">{de ? "Aus dem kuratierten Trend-Katalog" : "From the curated trend catalog"}</span>
                    </div>
                    <div className="px-3 py-2 rounded" style={{ background: "rgba(26, 74, 138, 0.08)", border: "1px solid rgba(26, 74, 138, 0.30)" }}>
                      <strong style={{ color: "#1A4A8A" }}>[REG: Short]</strong><br/>
                      <span className="text-[12px] opacity-80">{de ? "Aus der Regulierungs-DB" : "From the regulation DB"}</span>
                    </div>
                    <div className="px-3 py-2 rounded" style={{ background: "rgba(107, 63, 160, 0.10)", border: "1px solid rgba(107, 63, 160, 0.32)" }}>
                      <strong style={{ color: "#6B3FA0" }}>[EDGE: TrendA → TrendB]</strong> <span className="text-[10px] font-bold" style={{ color: "#6B3FA0" }}>NEU v0.2</span><br/>
                      <span className="text-[12px] opacity-80">{de ? "Kausal-Kante aus dem Trend-Graphen" : "Causal edge from the trend graph"}</span>
                    </div>
                    <div className="px-3 py-2 rounded sm:col-span-2" style={{ background: "rgba(107, 107, 107, 0.10)", border: "1px solid rgba(107, 107, 107, 0.30)" }}>
                      <strong style={{ color: "#6B6B6B" }}>[LLM-KNOWLEDGE]</strong><br/>
                      <span className="text-[12px] opacity-80">{de ? "LLM-Training-Wissen ohne externe Quelle — nie alleinige Basis für zukunftsgerichtete Empfehlungen." : "LLM training knowledge with no external citation — never the sole basis for forward-looking recommendations."}</span>
                    </div>
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "STEEP+V Analytisches Framework (6 Dimensionen)" : "STEEP+V Analytical Framework (6 Dimensions)"}</SubH>
                  <VoltTerminalStatic
                    title="STEEP+V"
                    variant="dark"
                    size="sm"
                    maxHeight="180px"
                    lines={[
                      L("S = Society       Demografie, Urbanisierung, Migration"),
                      L("T = Technology    KI, Digitalisierung, Biotech, Quantum"),
                      L("E = Economy       Globalisierung, Handel, Arbeitsmarkt"),
                      L("E = Environment   Klima, Biodiversität, Energie, Ressourcen"),
                      L("P = Politics      Regulierung, Geopolitik, Demokratie"),
                      L("V = Values        Vertrauen, Polarisierung, Akzeptanz, Kultur"),
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

                  <SubH>{de ? "Meta-Pipeline (v0.2) — Anti-Halluzinations-Schicht" : "Meta Pipeline (v0.2) — Anti-Hallucination Layer"}</SubH>
                  <div className="space-y-3">
                    <div className="p-3 rounded" style={{ background: "rgba(26, 158, 90, 0.08)", border: "1px solid rgba(26, 158, 90, 0.25)" }}>
                      <div className="text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                        <strong>{de ? "Scenario Divergence Check (automatisch)" : "Scenario Divergence Check (automatic)"}</strong> — <span className="text-[11px] font-bold" style={{ color: "#0F6038" }}>WIRED</span>
                        <br/>
                        <span className="text-[12px] opacity-80">{de ? "Pure Validator: Probability-Summe ≈1.0, Kausal-Distinktheit, ≥2 falsifizierbare Annahmen/Szenario, Horizont-Mix, ≥1 Early Indicator, Akteur-Differenzierung." : "Pure validator: probability sum ≈1.0, causal distinctness, ≥2 falsifiable assumptions per scenario, horizon mix, ≥1 early indicator, actor differentiation."}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded" style={{ background: "rgba(26, 158, 90, 0.08)", border: "1px solid rgba(26, 158, 90, 0.25)" }}>
                      <div className="text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                        <strong>{de ? "Confidence Calibration (automatisch)" : "Confidence Calibration (automatic)"}</strong> — <span className="text-[11px] font-bold" style={{ color: "#0F6038" }}>WIRED</span>
                        <br/>
                        <span className="text-[12px] opacity-80 font-mono">confidence = signalCoverage*0.30 + signalRecency*0.25 + signalStrength*0.20 + sourceVerification*0.15 + causalCoverage*0.10</span>
                        <br/>
                        <span className="text-[12px] opacity-80">{de ? "Überschreibt LLM-Selbsteinschätzung. Bands: 80–100 high / 60–79 medium / 40–59 low / 0–39 very low." : "Overwrites LLM self-assessment. Bands: 80–100 high / 60–79 medium / 40–59 low / 0–39 very low."}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded" style={{ background: "rgba(26, 158, 90, 0.08)", border: "1px solid rgba(26, 158, 90, 0.25)" }}>
                      <div className="text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                        <strong>{de ? "DataQuality-Verifikation (automatisch)" : "DataQuality Verification (automatic)"}</strong> — <span className="text-[11px] font-bold" style={{ color: "#0F6038" }}>WIRED</span>
                        <br/>
                        <span className="text-[12px] opacity-80">{de ? "Backend berechnet signalCount, newestSignalAge, dominantSourceType (via Provenance-Tag-Analyse der Synthesis), coverageGaps (aus den 3 Top-Limiting-Factors). Der LLM kann diese Werte nicht erfinden." : "Backend computes signalCount, newestSignalAge, dominantSourceType (via provenance tag analysis of the synthesis), coverageGaps (from top-3 limiting factors). The LLM cannot fake these values."}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded" style={{ background: "rgba(245, 198, 80, 0.10)", border: "1px solid rgba(245, 198, 80, 0.35)" }}>
                      <div className="text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                        <strong>{de ? "Contradiction Detection (opt-in: mode:'deep')" : "Contradiction Detection (opt-in: mode:'deep')"}</strong> — <span className="text-[11px] font-bold" style={{ color: "#7A5C00" }}>OPT-IN</span>
                        <br/>
                        <span className="text-[12px] opacity-80">{de ? "Zweiter Haiku-Pass prüft auf Widersprüche zwischen Synthese und bereitgestellten Signalen/Trends. confidenceAdjustment wird abgezogen." : "Second Haiku pass checks for contradictions between synthesis and provided signals/trends. confidenceAdjustment is subtracted."}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded" style={{ background: "rgba(245, 198, 80, 0.10)", border: "1px solid rgba(245, 198, 80, 0.35)" }}>
                      <div className="text-[13px]" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                        <strong>{de ? "Assumption Extraction (opt-in: mode:'deep')" : "Assumption Extraction (opt-in: mode:'deep')"}</strong> — <span className="text-[11px] font-bold" style={{ color: "#7A5C00" }}>OPT-IN</span>
                        <br/>
                        <span className="text-[12px] opacity-80">{de ? "Zweiter Sonnet-Pass surfaced implizite Annahmen mit falsifiableBy, monitoringSignal, timeToFalsification + benennt den criticalAssumption." : "Second Sonnet pass surfaces implicit assumptions with falsifiableBy, monitoringSignal, timeToFalsification + names the criticalAssumption."}</span>
                      </div>
                    </div>
                  </div>

                  <VoltSeparator />

                  <SubH>{de ? "JSON-Antwort-Schema (v0.2)" : "JSON Response Schema (v0.2)"}</SubH>
                  <VoltTerminalStatic
                    title="v0.2 Response Schema"
                    variant="dark"
                    size="sm"
                    maxHeight="360px"
                    lines={[
                      L("{", "comment"),
                      L('  "synthesis": "2-3 paragraphs, inline provenance",', "info"),
                      L('  "keyInsights": ["..."],', "info"),
                      L('  "matchedTrendIds": ["..."],', "info"),
                      L('  "matchedTrends": [{trendId, relevanceScore,', "info"),
                      L('    velocityChange, explanation}],   // v0.2', "success"),
                      L('  "causalChain": ["[TREND:X] drives [TREND:Y]..."],', "info"),
                      L('  "regulatoryContext": [{name, jurisdiction,', "info"),
                      L('    effect, urgency}],               // v0.2', "success"),
                      L('  "anomalySignals": [{signal, contradicts,', "info"),
                      L('    interpretation}],                // v0.2', "success"),
                      L('  "scenarios": { optimistic, likely,', "info"),
                      L('    pessimistic }   // object shape, v0.2', "success"),
                      L('  "confidence": 0.0,                 // calibrated', "warning"),
                      L('  "dataQuality": { signalCount,', "info"),
                      L('    newestSignalAge, coverageGaps,', "info"),
                      L('    dominantSourceType }             // v0.2', "success"),
                      L('  "followUpQuestions": ["..."],', "info"),
                      L('  "usedSources": [{type, name, date}], // v0.2', "success"),
                      L('  "steepV": { S, T, E_economy,... },', "info"),
                      L('  "interpretation": "...",', "info"),
                      L('  "references": [...],', "info"),
                      L('  "decisionFramework": "...",', "info"),
                      L('  "balancedScorecard": null          // conditional', "info"),
                      L('}', "comment"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Context-Profile-Prefix (v0.2)" : "Context Profile Prefix (v0.2)"}</SubH>
                  <p className="text-[13px] mb-3" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Wenn der User ein Kontext-Profil aktiviert (z.B. cto-automotive-dach), wird der vollständige Kalibrierungs-Prefix VOR dem System-Prompt vorangestellt — rekalibriert Sprache (Role-Frame) + Empfehlungen (im Rahmen der Entscheidungs-Autorität). Überschreibt NICHT die Source/Temporal-Regeln."
                      : "When the user activates a context profile (e.g. cto-automotive-dach), the full calibration prefix is prepended to the system prompt — recalibrates language (role frame) + recommendations (within decision authority). Does NOT override source/temporal rules."}
                  </p>
                  <VoltTerminalStatic
                    title="Context Profile Prefix (excerpt)"
                    variant="dark"
                    size="sm"
                    maxHeight="200px"
                    lines={[
                      L("## Active Context Filter", "command"),
                      L(""),
                      L("Role: CTO", "info"),
                      L("Industry: Automotive", "info"),
                      L("Region: DACH", "info"),
                      L(""),
                      L("Calibration rules:", "comment"),
                      L("1. RELEVANCE FILTER: emphasize trends and", "info"),
                      L("   signals directly relevant to ROLE in INDUSTRY.", "info"),
                      L("2. LANGUAGE: use the frame of reference of ROLE.", "info"),
                      L("   A CTO thinks in tech stack, team capacity,", "info"),
                      L("   build/buy/partner decisions.", "info"),
                      L("3. RECOMMENDATIONS: within role decision authority.", "info"),
                      L("4. REGULATORY FOCUS: REGION + INDUSTRY first.", "info"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Framework-System-Prompt (analyze/route.ts, v0.2)" : "Framework System Prompt (analyze/route.ts, v0.2)"}</SubH>
                  <p className="text-[13px] mb-3" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Alle 6 Analyse-Frameworks verwenden diesen kompakten System-Prompt als Basis. Schritt-spezifische Prompts werden als User-Message übergeben, jeweils mit World-Model-Block (Top 30 Trends / 20 Edges / 20 Regulations)."
                      : "All 6 analysis frameworks use this compact system prompt as base. Step-specific prompts are sent as user message, each with a world-model block (top 30 trends / 20 edges / 20 regulations)."}
                  </p>
                  <VoltTerminalStatic
                    title="Framework System Prompt (v0.2)"
                    variant="dark"
                    size="sm"
                    maxHeight="140px"
                    lines={[
                      L("You are a senior strategy advisor in the Strategic", "info"),
                      L("Intelligence System (SIS). You deliver structured,", "info"),
                      L("data-grounded analyses. ALWAYS respond with valid", "info"),
                      L("JSON -- no markdown fences, no prose before or after,", "info"),
                      L("ONLY the JSON object. Be concrete: real companies,", "info"),
                      L("real numbers, real regulations. Tag every claim with", "info"),
                      L("[SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]. Temporal", "info"),
                      L("validity applies: every recommendation future-dated.", "info"),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Meta-Synthese-Prompt (Canvas-Briefing)" : "Meta-Synthesis Prompt (Canvas Briefing)"}</SubH>
                  <p className="text-[13px] mb-3" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Für das Canvas-Briefing (\"Strategisches Memo\"). Bei genau einer Query sparring-partner-Modus (nicht nochmal zusammenfassen). Bei mehreren Queries Meta-Synthese mit rotem Faden, Cross-Query-Mustern, Spannungen, offenen Flanken."
                      : "Canvas briefing (\"Strategic Memo\"). With exactly one query: sparring-partner mode (do not rewrite the briefing). With multiple queries: meta-synthesis with red thread, cross-query patterns, tensions, open flanks."}
                  </p>
                  <VoltTerminalStatic
                    title="Meta-Synthesis"
                    variant="dark"
                    size="sm"
                    maxHeight="260px"
                    lines={[
                      L("Output schema:", "comment"),
                      L("{ sessionTitle, realQuestion, redThread,"),
                      L("  crossQueryPatterns: [{pattern, explanation, queryRefs}],"),
                      L("  tensions: [{tension, between[], implication}],"),
                      L("  metaDecisionFramework: [{principle, rationale}],"),
                      L("  openFlanks: [{question, why}],"),
                      L("  confidence: 0..1,"),
                      L("  critique: \"Honest assessment of reliability\" }"),
                      L(""),
                      L("Source: canvas/[id]/summary/route.ts", "comment"),
                      L("Registry entry: canvas-summary-single", "comment"),
                    ]}
                  />

                  <VoltSeparator />

                  <VoltAlert variant="info" title={de ? "Einzelner Quellort" : "Single source of truth"}>
                    <div className="text-[13px] mt-2" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                      {de
                        ? <>Alle 23 Prompt-Einträge mit vollständigen Templates + Live/Opt-In/Template-Status leben unter <a href="/dokumentation/prompts" style={{ textDecoration: "underline", fontWeight: 600 }}>/dokumentation/prompts</a>. Markdown-Variante: <code>SYSTEM_PROMPTS.md</code>. Code: <code>src/lib/system-prompts-registry.ts</code>.</>
                        : <>All 23 prompt entries with full templates + live/opt-in/template status live at <a href="/dokumentation/prompts" style={{ textDecoration: "underline", fontWeight: 600 }}>/dokumentation/prompts</a>. Markdown: <code>SYSTEM_PROMPTS.md</code>. Code: <code>src/lib/system-prompts-registry.ts</code>.</>}
                    </div>
                  </VoltAlert>
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
                {de ? "Analyse-Frameworks (6) — Vollständige Dokumentation" : "Analysis Frameworks (6) — Complete Documentation"}
              </SectionHeading>
              <VoltCard>
                <VoltCardContent className="space-y-6 p-6">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-heading, #0A0A0A)" }}>
                    {de
                      ? "Neben der Standard-Analyse (STEEP+V) bietet SIS 6 spezialisierte Frameworks. Jedes Framework besteht aus 3-5 sequenziellen Schritten mit eigenen System-Prompts, Ausgabe-Schemata und Abhängigkeiten. Quelle: canvas-templates.ts (Definitionen) + api/v1/frameworks/analyze/route.ts (Prompts + Schemata)."
                      : "Beyond the default analysis (STEEP+V), SIS offers 6 specialized frameworks. Each consists of 3-5 sequential steps with their own system prompts, output schemas and dependencies. Source: canvas-templates.ts (definitions) + api/v1/frameworks/analyze/route.ts (prompts + schemas)."}
                  </p>

                  {/* ── 1. MARKTANALYSE ── */}
                  <VoltSeparator />
                  <SubH>1. {de ? "Strategische Marktanalyse" : "Strategic Market Analysis"}</SubH>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <VoltBadge variant="muted" size="sm">SWOT + PESTEL</VoltBadge>
                    <VoltBadge variant="neutral" size="sm">5 {de ? "Schritte" : "Steps"}</VoltBadge>
                    <VoltBadge variant="blue" size="sm">Humphrey, Stanford 1960s</VoltBadge>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                    {de
                      ? "Erweiterte SWOT + PESTEL. Analysiert interne Stärken/Schwächen und externe Chancen/Risiken systematisch."
                      : "Extended SWOT + PESTEL. Systematically analyzes internal strengths/weaknesses and external opportunities/risks."}
                  </p>
                  <VoltTerminalStatic
                    title={de ? "Schritte & Prompts" : "Steps & Prompts"}
                    variant="dark"
                    size="sm"
                    maxHeight="360px"
                    lines={[
                      L("Schritt 1: Marktstruktur-Analyse (market-structure)", "command"),
                      L("  abhängig von: —"),
                      L("  Prompt: \"Marktstruktur-Analyse für '{topic}'\""),
                      L("  Output: { tam, sam, som, cagr, segments[], keyPlayers[], synthesis }"),
                      L("  Min: 4-6 Segmente, 5-8 echte Unternehmen"),
                      L(""),
                      L("Schritt 2: Wettbewerber-Radar (competitor-radar)", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Wettbewerber-Radar für '{topic}'\""),
                      L("  Output: { positioning[{name, x, y}], competitors[], synthesis }"),
                      L("  Min: 6 Wettbewerber, x/y 0-5, threatLevel: high|medium|low"),
                      L(""),
                      L("Schritt 3: Trends, Regulierung & Szenarien (trends-regulation)", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Trends, Regulierung und Szenarien für '{topic}'\""),
                      L("  Output: { megatrends[], regulations[], scenarios[3], synthesis }"),
                      L("  category: social|technological|economic|environmental|political"),
                      L("  status: active|planned|draft"),
                      L(""),
                      L("Schritt 4: Benchmarking", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Benchmarking für '{topic}'\""),
                      L("  Output: { metrics[], players[], caption, synthesis }"),
                      L("  Min: 5 Kennzahlen, 5-7 echte Unternehmen"),
                      L(""),
                      L("Schritt 5: Strategische Optionen & Priorisierung", "command"),
                      L("  abhängig von: Schritt 2, 3, 4"),
                      L("  Prompt: \"3-5 strategische Optionen ableiten\""),
                      L("  Output: { options[], prioritization, synthesis }"),
                    ]}
                  />
                  <VoltAlert variant="info" title={de ? "Guidance" : "Guidance"}>
                    <div className="text-[12px] mt-1 space-y-1">
                      <div><strong>{de ? "Ideale Frage:" : "Ideal question:"}</strong> {de ? "Konkrete Frage zu einem abgegrenzten Markt mit Region und Zeithorizont." : "Concrete question about a defined market with region and time horizon."}</div>
                      <div><strong>{de ? "Beispiele:" : "Examples:"}</strong> {de ? "\"Elektroauto-Markt in DACH bis 2027\", \"B2B-SaaS für Supply-Chain-Visibility in Europa\"" : "\"EV market in DACH by 2027\", \"B2B SaaS for supply chain visibility in Europe\""}</div>
                      <div><strong>{de ? "Vermeiden:" : "Avoid:"}</strong> {de ? "Zu generisch (\"Automotive\") oder zu eng (\"Firma XY\")" : "Too generic (\"Automotive\") or too narrow (\"Company XY\")"}</div>
                    </div>
                  </VoltAlert>

                  {/* ── 2. WAR-GAMING ── */}
                  <VoltSeparator />
                  <SubH>2. War-Gaming</SubH>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <VoltBadge variant="muted" size="sm">RAND + Shell Scenarios</VoltBadge>
                    <VoltBadge variant="neutral" size="sm">5 {de ? "Schritte" : "Steps"}</VoltBadge>
                    <VoltBadge variant="blue" size="sm">RAND 1960s, Shell 1970s</VoltBadge>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                    {de
                      ? "Szenario-basierte Strategieplanung. Prämisse: Die Zukunft ist nicht vorhersagbar, aber man kann sich auf mehrere Zukünfte vorbereiten."
                      : "Scenario-based strategy planning. Premise: The future is unpredictable, but you can prepare for multiple futures."}
                  </p>
                  <VoltTerminalStatic
                    title={de ? "Schritte & Prompts" : "Steps & Prompts"}
                    variant="dark"
                    size="sm"
                    maxHeight="360px"
                    lines={[
                      L("Schritt 1: Akteurs-Modellierung (actors)", "command"),
                      L("  abhängig von: —"),
                      L("  Prompt: \"Modelliere strategische Akteure für '{topic}'\""),
                      L("  Output: { actors[{name, type, resources[], goals[], threatLevel}] }"),
                      L("  type: competitor|regulator|partner|disruptor|customer"),
                      L("  Min: 6 Akteure"),
                      L(""),
                      L("Schritt 2: Züge & Gegenzüge (moves)", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Simuliere strategische Züge und Gegenzüge\""),
                      L("  Output: { moves[{actor, action, response, impact}] }"),
                      L(""),
                      L("Schritt 3: Optimistisches Szenario", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Realistisches Best-Case-Szenario\""),
                      L("  Output: { scenario, probability, keyDrivers[], earlyWarnings[] }"),
                      L(""),
                      L("Schritt 4: Pessimistisches Szenario", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Worst-Case: Kipppunkte, Kaskadeneffekte\""),
                      L(""),
                      L("Schritt 5: Robuste Strategie", "command"),
                      L("  abhängig von: Schritt 2, 3, 4"),
                      L("  Prompt: \"No-Regret-Moves + Real Options + Signposts\""),
                      L("  Output: { noRegretMoves[], realOptions[], signposts[], top3 }"),
                    ]}
                  />
                  <VoltAlert variant="info" title={de ? "Guidance" : "Guidance"}>
                    <div className="text-[12px] mt-1 space-y-1">
                      <div><strong>{de ? "Ideale Frage:" : "Ideal question:"}</strong> {de ? "Konkrete strategische Frage mit benannten Akteuren und offenem Ausgang." : "Concrete strategic question with named actors and open outcome."}</div>
                      <div><strong>{de ? "Beispiele:" : "Examples:"}</strong> {de ? "\"Wie reagieren wir auf Temus Preiskampf im DACH-E-Commerce?\", \"EU Cloud-Souveränität: SAP vs. AWS\"" : "\"How do we respond to Temu's pricing attack?\", \"EU cloud sovereignty: SAP vs AWS\""}</div>
                      <div><strong>{de ? "Felder:" : "Fields:"}</strong> {de ? "Gegner/Wettbewerber (Pflicht), Zeithorizont (optional)" : "Opponent/competitor (required), time horizon (optional)"}</div>
                    </div>
                  </VoltAlert>

                  {/* ── 3. PRE-MORTEM ── */}
                  <VoltSeparator />
                  <SubH>3. Pre-Mortem</SubH>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <VoltBadge variant="muted" size="sm">Prospective Hindsight</VoltBadge>
                    <VoltBadge variant="neutral" size="sm">3 {de ? "Schritte" : "Steps"}</VoltBadge>
                    <VoltBadge variant="blue" size="sm">Gary Klein, 1989</VoltBadge>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                    {de
                      ? "Wissenschaftlich belegt: Menschen identifizieren 30% mehr Risiken wenn sie sich das Scheitern als bereits eingetreten vorstellen."
                      : "Scientifically proven: People identify 30% more risks when imagining failure as already occurred."}
                  </p>
                  <VoltTerminalStatic
                    title={de ? "Schritte & Prompts" : "Steps & Prompts"}
                    variant="dark"
                    size="sm"
                    maxHeight="320px"
                    lines={[
                      L("Schritt 1: Scheitern vorstellen (risks)", "command"),
                      L("  abhängig von: —"),
                      L("  Prompt: \"VERSETZE DICH IN DIE ZUKUNFT. Es ist 18 Monate"),
                      L("  später. '{topic}' ist VOLLSTÄNDIG GESCHEITERT.\""),
                      L("  Output: { risks[{name, category, probability(1-5),"),
                      L("    impact(1-5), riskScore, earlyWarnings[]}], blindSpots[] }"),
                      L("  category: technology|market|regulation|organization|financial|social"),
                      L("  Min: 8 Risiken"),
                      L(""),
                      L("Schritt 2: Risiko-Bewertung", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Bewerte jedes Risiko: Wahrscheinlichkeit x Schaden\""),
                      L("  Output: sortiert nach Score (höchste zuerst)"),
                      L(""),
                      L("Schritt 3: Risiko-Mitigation", "command"),
                      L("  abhängig von: Schritt 2"),
                      L("  Prompt: \"Mitigationsplan für Top-3 Risiken:"),
                      L("  Prävention, Notfallplan, Verantwortlicher, Trigger-Punkt\""),
                    ]}
                  />
                  <VoltAlert variant="info" title={de ? "Guidance" : "Guidance"}>
                    <div className="text-[12px] mt-1 space-y-1">
                      <div><strong>{de ? "Ideale Frage:" : "Ideal question:"}</strong> {de ? "Konkretes Vorhaben das noch NICHT gestartet ist, mit Zielzeitpunkt." : "Concrete initiative that hasn't started yet, with target date."}</div>
                      <div><strong>{de ? "Beispiele:" : "Examples:"}</strong> {de ? "\"Markteintritt USA mit B2B-SaaS bis Q4 2026\", \"SAP S/4HANA Migration in 18 Monaten\"" : "\"US market entry with B2B SaaS by Q4 2026\", \"SAP S/4HANA migration in 18 months\""}</div>
                      <div><strong>{de ? "Felder:" : "Fields:"}</strong> {de ? "Zielzeitpunkt, Erfolgskriterium" : "Target date, success criterion"}</div>
                    </div>
                  </VoltAlert>

                  {/* ── 4. POST-MORTEM ── */}
                  <VoltSeparator />
                  <SubH>4. Post-Mortem</SubH>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <VoltBadge variant="muted" size="sm">5-Whys + Ishikawa</VoltBadge>
                    <VoltBadge variant="neutral" size="sm">3 {de ? "Schritte" : "Steps"}</VoltBadge>
                    <VoltBadge variant="blue" size="sm">Toyota, Taiichi Ohno</VoltBadge>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                    {de
                      ? "Unterscheidet strukturelle, konjunkturelle und situative Ursachen. Fünffaches 'Warum?' bis zur Wurzelursache."
                      : "Distinguishes structural, cyclical and situational causes. Five times 'Why?' to the root cause."}
                  </p>
                  <VoltTerminalStatic
                    title={de ? "Schritte & Prompts" : "Steps & Prompts"}
                    variant="dark"
                    size="sm"
                    maxHeight="280px"
                    lines={[
                      L("Schritt 1: Chronologie & Fakten", "command"),
                      L("  abhängig von: —"),
                      L("  Prompt: \"Rekonstruiere die Chronologie von '{topic}':"),
                      L("  Timeline, Schlüsselentscheidungen, externe Auslöser\""),
                      L("  User-Input: Was genau ist passiert? Wann? Wer betroffen?"),
                      L(""),
                      L("Schritt 2: Ursachen auf 3 Ebenen", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  STRUKTURELL: langfristig, systemisch (Megatrends, Regulierung)"),
                      L("  KONJUNKTURELL: mittelfristig (Wirtschaftszyklen, Politik)"),
                      L("  SITUATIV: kurzfristig (Entscheidungen, Personen, Zufall)"),
                      L(""),
                      L("Schritt 3: Lessons Learned", "command"),
                      L("  abhängig von: Schritt 2"),
                      L("  1) Was hätte man WISSEN können?"),
                      L("  2) Was hätte man ANDERS machen können?"),
                      L("  3) Welche SYSTEMISCHEN VERÄNDERUNGEN sind nötig?"),
                    ]}
                  />

                  {/* ── 5. TREND DEEP-DIVE ── */}
                  <VoltSeparator />
                  <SubH>5. Trend Deep-Dive</SubH>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <VoltBadge variant="muted" size="sm">STEEP+V Extended</VoltBadge>
                    <VoltBadge variant="neutral" size="sm">5 {de ? "Schritte" : "Steps"}</VoltBadge>
                    <VoltBadge variant="blue" size="sm">EU JRC 14 Megatrends</VoltBadge>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                    {de
                      ? "STEEP+V-Framework angewendet auf einen einzelnen Trend. Systemische Analyse mit Wechselwirkungen und Kaskadeneffekten."
                      : "STEEP+V framework applied to a single trend. Systemic analysis with interactions and cascade effects."}
                  </p>
                  <VoltTerminalStatic
                    title={de ? "Schritte & Prompts" : "Steps & Prompts"}
                    variant="dark"
                    size="sm"
                    maxHeight="340px"
                    lines={[
                      L("Schritt 1: Definition & Status", "command"),
                      L("  Prompt: \"Umfassendes Briefing: Definition, Entstehung,"),
                      L("  aktueller Stand (Zahlen!), Top 5 Akteure, STEEP+V-Einordnung,"),
                      L("  Position auf der S-Kurve\""),
                      L(""),
                      L("Schritt 2: Evidenz & Daten", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Live-Signale, quantitative Belege,"),
                      L("  Gegenbeweise, Datenlücken\""),
                      L(""),
                      L("Schritt 3: Treiber & Bremser", "command"),
                      L("  abhängig von: Schritt 2"),
                      L("  Prompt: \"Kausale Kräfte: TREIBER (Technologie, Ökonomie,"),
                      L("  Regulierung) + BREMSER (Hürden, Kosten, Akzeptanz)\""),
                      L(""),
                      L("Schritt 4: Impact-Analyse", "command"),
                      L("  abhängig von: Schritt 3"),
                      L("  Prompt: \"Wirtschaft, Gesellschaft, Geopolitik,"),
                      L("  Technologie, Umwelt. Gewinner/Verlierer, Zeitrahmen\""),
                      L(""),
                      L("Schritt 5: Handlungsoptionen", "command"),
                      L("  abhängig von: Schritt 4"),
                      L("  Output-Priorisierung:"),
                      L("  SOFORT (90 Tage) | VORBEREITEN (6-12 Mo) | BEOBACHTEN", "success"),
                    ]}
                  />

                  {/* ── 6. STAKEHOLDER-MAPPING ── */}
                  <VoltSeparator />
                  <SubH>6. Stakeholder-Mapping</SubH>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <VoltBadge variant="muted" size="sm">Mitchell Salience Model</VoltBadge>
                    <VoltBadge variant="neutral" size="sm">4 {de ? "Schritte" : "Steps"}</VoltBadge>
                    <VoltBadge variant="blue" size="sm">Mitchell et al., 1997</VoltBadge>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
                    {de
                      ? "Power x Legitimacy x Urgency. Kombiniert mit Interest/Influence-Matrix für Engagement-Strategie."
                      : "Power x Legitimacy x Urgency. Combined with Interest/Influence Matrix for engagement strategy."}
                  </p>
                  <VoltTerminalStatic
                    title={de ? "Schritte & Prompts" : "Steps & Prompts"}
                    variant="dark"
                    size="sm"
                    maxHeight="320px"
                    lines={[
                      L("Schritt 1: Stakeholder identifizieren", "command"),
                      L("  Prompt: \"7-10 wichtigste Stakeholder bei '{topic}':"),
                      L("  Name, Rolle, primäres Interesse, sekundäres Interesse\""),
                      L("  Gruppierung: Entscheider | Beeinflusser | Betroffene | Beobachter"),
                      L(""),
                      L("Schritt 2: Macht & Einfluss bewerten", "command"),
                      L("  abhängig von: Schritt 1"),
                      L("  Prompt: \"Macht (1-5), Interesse (1-5), Haltung,"),
                      L("  Vorhersagbarkeit\""),
                      L("  Matrix: Key Players | Keep Satisfied | Keep Informed | Monitor"),
                      L(""),
                      L("Schritt 3: Dynamiken & Koalitionen", "command"),
                      L("  abhängig von: Schritt 2"),
                      L("  Prompt: \"Allianzen, Konflikte, Einflussketten (A→B→C),"),
                      L("  mögliche Positionswechsel\""),
                      L(""),
                      L("Schritt 4: Engagement-Strategie", "command"),
                      L("  abhängig von: Schritt 3"),
                      L("  Prompt: \"Kommunikationsansatz, Timing, Kernbotschaft"),
                      L("  je Key Stakeholder. Konkreter 4-Wochen-Plan.\""),
                    ]}
                  />

                  <VoltSeparator />

                  <SubH>{de ? "Framework-Architektur (Zusammenfassung)" : "Framework Architecture (Summary)"}</SubH>
                  <div className="overflow-x-auto">
                    <VoltTableRoot>
                      <VoltTableHeader>
                        <VoltTableRow>
                          <VoltTableHead>Framework</VoltTableHead>
                          <VoltTableHead>{de ? "Methode" : "Method"}</VoltTableHead>
                          <VoltTableHead>{de ? "Schritte" : "Steps"}</VoltTableHead>
                          <VoltTableHead>{de ? "Ausgabe-Format" : "Output"}</VoltTableHead>
                        </VoltTableRow>
                      </VoltTableHeader>
                      <VoltTableBody>
                        {[
                          [de ? "Marktanalyse" : "Market Analysis", "SWOT + PESTEL", "5", "JSON: TAM/SAM/SOM, Segments, Competitors, Scenarios"],
                          ["War-Gaming", "RAND + Shell", "5", "JSON: Actors, Moves, 3 Scenarios, Robust Strategy"],
                          ["Pre-Mortem", "Gary Klein", "3", "JSON: Risks (8+), Risk Scores, Mitigation Plans"],
                          ["Post-Mortem", "5-Whys + Ishikawa", "3", "JSON: Timeline, 3-Layer Causes, Lessons Learned"],
                          ["Trend Deep-Dive", "STEEP+V", "5", "JSON: Definition, Evidence, Drivers, Impact, Actions"],
                          ["Stakeholder", "Mitchell Salience", "4", "JSON: Actors, Power/Interest, Coalitions, Engagement"],
                        ].map(([name, method, steps, output]) => (
                          <VoltTableRow key={name}>
                            <VoltTableCell className="font-bold text-xs">{name}</VoltTableCell>
                            <VoltTableCell className="font-mono text-xs">{method}</VoltTableCell>
                            <VoltTableCell className="text-center text-xs">{steps}</VoltTableCell>
                            <VoltTableCell className="text-xs">{output}</VoltTableCell>
                          </VoltTableRow>
                        ))}
                      </VoltTableBody>
                    </VoltTableRoot>
                  </div>

                  <VoltAlert variant="success" title={de ? "Prompt-Injection-Schutz" : "Prompt Injection Protection"}>
                    <p className="text-[12px] mt-1">
                      {de
                        ? "Alle Framework-Inputs (Topic, Context, Step) werden vor der Prompt-Konstruktion sanitisiert: XML-Tags, Rollen-Marker und Steuerzeichen werden entfernt. Identisch mit dem Schutz in SEC-07 (Query-Route)."
                        : "All framework inputs (topic, context, step) are sanitized before prompt construction: XML tags, role markers and control characters are removed. Identical to SEC-07 (query route) protection."}
                    </p>
                  </VoltAlert>
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
                    <VoltStat label={de ? "Kuratierte Trends" : "Curated Trends"} value={TREND_COUNT} variant="lime" size="sm" />
                    <VoltStat label={de ? "Kausale Kanten" : "Causal Edges"} value={EDGE_COUNT} size="sm" />
                    <VoltStat label={de ? "Regulierungen" : "Regulations"} value={REGULATION_COUNT} size="sm" />
                    <VoltStat label={de ? "Quellen" : "Sources"} value={CONNECTOR_COUNT} size="sm" />
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
                      { de: `System-Prompt enthält nur Top ${TREND_COUNT} Trends.`, en: `System prompt contains only top ${TREND_COUNT} trends.` },
                      { de: `Kausale Kanten (${EDGE_COUNT}) statisch kodiert. Kein UI zum Bearbeiten.`, en: `Causal edges (${EDGE_COUNT}) statically coded. No edit UI.` },
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
