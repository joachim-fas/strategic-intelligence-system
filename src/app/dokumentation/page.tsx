"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";

/* ────────────────────────────────────────────────────────────────
   Collapsible Section component
   ──────────────────────────────────────────────────────────────── */
function CollapsibleSection({
  title,
  tag,
  children,
  defaultOpen = false,
}: {
  title: string;
  tag: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        marginBottom: 16,
        border: "1px solid var(--color-border, #E8E8E8)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--volt-surface-raised, #fff)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--color-text-heading, #0A0A0A)",
          letterSpacing: "-0.01em",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            "rgba(228,255,151,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span
          style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: "var(--color-text-muted, #6B6B6B)",
            flexShrink: 0,
          }}
        >
          {tag}
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        <span
          style={{
            fontSize: 14,
            color: "var(--color-text-muted, #6B6B6B)",
            transition: "transform 0.2s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          {"\u25B6"}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 20px 20px",
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--color-text-heading, #0A0A0A)",
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Small code/token badge
   ──────────────────────────────────────────────────────────────── */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 12,
        background: "rgba(228,255,151,0.25)",
        color: "var(--color-text-heading, #0A0A0A)",
        padding: "1px 6px",
        borderRadius: 4,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </code>
  );
}

/* ────────────────────────────────────────────────────────────────
   Connector grid item
   ──────────────────────────────────────────────────────────────── */
function ConnectorChip({ name, apiKey }: { name: string; apiKey?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 8px",
        borderRadius: 6,
        background: apiKey ? "rgba(255,200,100,0.15)" : "rgba(228,255,151,0.2)",
        border: `1px solid ${apiKey ? "rgba(255,180,60,0.3)" : "var(--color-border, #E8E8E8)"}`,
        color: "var(--color-text-heading, #0A0A0A)",
        whiteSpace: "nowrap" as const,
      }}
    >
      {name}
      {apiKey && <span style={{ fontSize: 9, opacity: 0.6 }} title="Requires API key">KEY</span>}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────
   Connector category row
   ──────────────────────────────────────────────────────────────── */
function ConnectorCategory({
  label,
  connectors,
}: {
  label: string;
  connectors: { name: string; apiKey?: boolean }[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-text-muted, #6B6B6B)",
          marginBottom: 6,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
        {connectors.map((c) => (
          <ConnectorChip key={c.name} name={c.name} apiKey={c.apiKey} />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Pipeline step
   ──────────────────────────────────────────────────────────────── */
function PipelineStep({
  num,
  text,
  detail,
}: {
  num: number;
  text: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--color-lime, #E4FF97)",
          color: "var(--color-brand-text, #0A0A0A)",
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {num}
      </span>
      <div>
        <span style={{ fontSize: 13, lineHeight: 1.6 }}>{text}</span>
        {detail && (
          <div style={{ fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginTop: 2, lineHeight: 1.5 }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   JSON field display
   ──────────────────────────────────────────────────────────────── */
function JsonField({
  name,
  type,
  desc,
  constraints,
  optional,
}: {
  name: string;
  type?: string;
  desc: string;
  constraints?: string;
  optional?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        marginBottom: 6,
        fontSize: 13,
        flexWrap: "wrap" as const,
      }}
    >
      <Code>{name}</Code>
      {type && (
        <span style={{ fontSize: 11, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "rgba(100,140,40,0.8)" }}>
          {type}
        </span>
      )}
      {optional && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--color-text-muted, #6B6B6B)",
            textTransform: "uppercase" as const,
          }}
        >
          optional
        </span>
      )}
      <span style={{ color: "var(--color-text-muted, #6B6B6B)" }}>
        {desc}
      </span>
      {constraints && (
        <span style={{ fontSize: 11, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)" }}>
          [{constraints}]
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Mono pre-formatted block
   ──────────────────────────────────────────────────────────────── */
function MonoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 12,
        lineHeight: 1.8,
        padding: "12px 16px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.03)",
        border: "1px solid var(--color-border, #E8E8E8)",
        overflowX: "auto" as const,
        marginBottom: 16,
        whiteSpace: "pre-wrap" as const,
      }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Subsection heading
   ──────────────────────────────────────────────────────────────── */
function SubH({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        fontWeight: 700,
        fontSize: 13,
        color: "var(--color-text-heading, #0A0A0A)",
        marginBottom: 8,
        marginTop: 20,
      }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Regulation row
   ──────────────────────────────────────────────────────────────── */
function RegRow({ shortName, jurisdiction, status, desc }: { shortName: string; jurisdiction: string; status: string; desc: string }) {
  const colors: Record<string, string> = { enforcing: "rgba(80,180,80,0.2)", adopted: "rgba(100,160,255,0.2)", proposed: "rgba(255,200,80,0.2)", planned: "rgba(200,200,200,0.2)" };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6, fontSize: 13 }}>
      <Code>{shortName}</Code>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: colors[status] || colors.planned, textTransform: "uppercase" as const }}>{status}</span>
      <span style={{ fontSize: 11, color: "var(--color-text-muted, #6B6B6B)" }}>{jurisdiction}</span>
      <span style={{ color: "var(--color-text-muted, #6B6B6B)" }}>{desc}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════ */
export default function Dokumentation() {
  const { locale } = useLocale();
  const de = locale === "de";

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main
        className="volt-container"
        style={{ padding: "32px 24px 80px", maxWidth: 920, margin: "0 auto" }}
      >
        {/* ── Page header ────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily:
                "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--color-text-heading, #0A0A0A)",
              margin: "0 0 8px",
            }}
          >
            {de ? "Technische Systemdokumentation" : "Technical System Documentation"}
          </h1>
          <p
            style={{
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 15,
              color: "var(--color-text-muted, #6B6B6B)",
              margin: "0 0 12px",
              lineHeight: 1.6,
            }}
          >
            {de
              ? "Vollstaendige technische Referenz des Strategic Intelligence System. Alle Angaben sind aus dem Quellcode extrahiert und 1:1 verifizierbar. Klicke auf eine Sektion, um sie aufzuklappen."
              : "Complete technical reference of the Strategic Intelligence System. All claims are extracted from source code and 1:1 verifiable. Click a section to expand."}
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap" as const,
              gap: 8,
              fontSize: 12,
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              color: "var(--color-text-muted, #6B6B6B)",
            }}
          >
            <span>Next.js 15</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>React 19</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Claude claude-sonnet-4-6</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>SQLite + WAL</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>57 Connectors</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Zod Validation</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>SSE Streaming</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 1: System Overview
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="01"
          title={de ? "Systemuebersicht & Architektur" : "System Overview & Architecture"}
          defaultOpen
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Das SIS (Strategic Intelligence System) ist ein Denk-Instrument auf Think-Tank-Niveau mit explizitem EU-Fokus. Es verbindet 57 Live-Datenquellen mit einem kuratierten Wissensgraphen (40 Trends, 102 kausale Kanten, 15 Regulierungen) und einem LLM-Analysekern (Claude claude-sonnet-4-6) zu einem Retrieval-Augmented-Generation (RAG) System, das strategische Fragen strukturiert und belegt beantwortet."
              : "SIS (Strategic Intelligence System) is a thinking instrument at think-tank level with an explicit EU focus. It connects 57 live data sources with a curated knowledge graph (40 trends, 102 causal edges, 15 regulations) and an LLM analysis core (Claude claude-sonnet-4-6) into a Retrieval-Augmented Generation (RAG) system that answers strategic questions in a structured and evidence-based way."}
          </p>

          <SubH>{de ? "RAG-Architektur (Datenfluss)" : "RAG Architecture (Data Flow)"}</SubH>
          <MonoBlock>
{`┌─────────────────────────────────────────────────────────────────┐
│  57 Connectors (APIs)                                           │
│  HackerNews, GDELT, Eurostat, WHO, ACLED, arXiv, ...           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ storeSignals()
                           v
┌─────────────────────────────────────────────────────────────────┐
│  SQLite (better-sqlite3, WAL mode)                              │
│  live_signals: id, source, title, content, url, topic,          │
│                tags, signal_type, strength, fetched_at           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ getRelevantSignals(query, 12)
                           │ Keyword-Matching + Cross-Language Aliases
                           v
┌─────────────────────────────────────────────────────────────────┐
│  System Prompt Builder (buildSystemPrompt)                      │
│  Top 40 Trends + 15 Regulierungen + 102 Kausale Kanten         │
│  + formatierte Live-Signale + STEEP+V Framework                 │
│  + EU JRC 14 Megatrends + 7 PFLICHTEN + JSON-Schema             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Anthropic API (claude-sonnet-4-6)
                           │ max_tokens: 12.000, SSE-Streaming
                           v
┌─────────────────────────────────────────────────────────────────┐
│  Post-Processing & Validation                                   │
│  1. JSON-Extraktion (inkl. Reparatur bei Truncation)            │
│  2. Zod-Schema-Validierung (VAL-01)                             │
│  3. matchedTrendIds Anti-Halluzination (VAL-02)                 │
│  4. Szenario-Normalisierung                                     │
│  5. Blended Confidence (VAL-03)                                 │
│  6. URL-Validierung                                             │
│  7. Causal-Edge-Augmentation                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ SSE (Server-Sent Events)
                           v
┌─────────────────────────────────────────────────────────────────┐
│  Client (React 19 + Next.js 15)                                 │
│  Streaming-Synthese + Strukturiertes Briefing                   │
└─────────────────────────────────────────────────────────────────┘`}
          </MonoBlock>

          <SubH>{de ? "Technologie-Stack" : "Technology Stack"}</SubH>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {[
              { label: "LLM", value: "Claude claude-sonnet-4-6, max 12.000 tokens, Anthropic API v2023-06-01" },
              { label: de ? "Datenbank" : "Database", value: "SQLite via better-sqlite3, WAL-Modus, Trend-Tabelle + live_signals-Tabelle" },
              { label: "Frontend", value: "Next.js 15, React 19, TypeScript" },
              { label: de ? "Datenquellen" : "Data Sources", value: de ? "57 Live-Connectors, 42+ institutionelle Forschungsquellen" : "57 live connectors, 42+ institutional research sources" },
              { label: "Streaming", value: "SSE (Server-Sent Events), progressive JSON extraction" },
              { label: "Validation", value: "Zod Schema, Input Sanitization, Rate Limiting" },
              { label: de ? "Wissensgraph" : "Knowledge Graph", value: de ? "40 Trends, 102 kausale Kanten, 15 Regulierungen" : "40 trends, 102 causal edges, 15 regulations" },
              { label: "API", value: de ? "Retry bis 3x bei 429/529, Exponential Backoff" : "Retry up to 3x on 429/529, exponential backoff" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border, #E8E8E8)",
                  background: "transparent",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--color-text-muted, #6B6B6B)",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: 13 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 2: Data Connectors
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="02"
          title={
            de ? "Daten-Connectors (57 gesamt)" : "Data Connectors (57 total)"
          }
        >
          <p style={{ marginBottom: 8 }}>
            {de
              ? "Alle 57 Connectors, gruppiert nach Kategorie. Jeder Connector liefert strukturierte Signale (Titel, Inhalt, URL, Datum, Staerke) in die SQLite-Datenbank. Connectors mit \"KEY\" benoetigen einen API-Schluessel in .env.local."
              : "All 57 connectors, grouped by category. Each connector delivers structured signals (title, content, URL, date, strength) to the SQLite database. Connectors marked \"KEY\" require an API key in .env.local."}
          </p>
          <p style={{ marginBottom: 16, fontSize: 12, color: "var(--color-text-muted, #6B6B6B)" }}>
            {de
              ? "Signale werden automatisch nach 336 Stunden (14 Tage) geloescht. Bei jedem Query wird geprueft ob die neuesten Signale aelter als 6 Stunden sind -- wenn ja, wird die Pipeline automatisch neu ausgeloest."
              : "Signals are automatically pruned after 336 hours (14 days). On every query, the system checks if the newest signals are older than 6 hours -- if so, the pipeline is automatically re-triggered."}
          </p>

          <ConnectorCategory
            label={de ? "Tech & Developer (9)" : "Tech & Developer (9)"}
            connectors={[
              { name: "Hacker News" },
              { name: "GitHub Trending" },
              { name: "Reddit" },
              { name: "arXiv" },
              { name: "Stack Overflow" },
              { name: "npm & PyPI" },
              { name: "Product Hunt" },
              { name: "Wikipedia Pageviews" },
              { name: "Docker Hub" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Suche & Sentiment (3)" : "Search & Sentiment (3)"}
            connectors={[
              { name: "Google Trends" },
              { name: "Social Media Sentiment" },
              { name: "Google Books Ngram" },
            ]}
          />
          <ConnectorCategory
            label="News & Media (6)"
            connectors={[
              { name: "News API", apiKey: true },
              { name: "The Guardian", apiKey: true },
              { name: "New York Times", apiKey: true },
              { name: "NewsData.io", apiKey: true },
              { name: "Media Cloud" },
              { name: "GDELT" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Forschung & Wissenschaft (3)" : "Research & Academia (3)"}
            connectors={[
              { name: "OpenAlex" },
              { name: "CrossRef" },
              { name: "Semantic Scholar" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Offizielle Statistiken (8)" : "Official Statistics (8)"}
            connectors={[
              { name: "Eurostat" },
              { name: "OECD" },
              { name: "FRED", apiKey: true },
              { name: "Our World in Data" },
              { name: "Destatis" },
              { name: "World Bank" },
              { name: "BLS (US Labor)" },
              { name: "IMF" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Prognosemaerkte (4)" : "Prediction Markets (4)"}
            connectors={[
              { name: "Polymarket" },
              { name: "Manifold Markets" },
              { name: "Metaculus" },
              { name: "Kalshi" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Geopolitik & Konflikte (4)" : "Geopolitics & Conflict (4)"}
            connectors={[
              { name: "ACLED", apiKey: true },
              { name: "UCDP" },
              { name: "V-Dem" },
              { name: "UNHCR Refugee Data" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Gesundheit & Biowissenschaften (5)" : "Health & Life Sciences (5)"}
            connectors={[
              { name: "WHO GHO" },
              { name: "ILO ILOSTAT" },
              { name: "ClinicalTrials.gov" },
              { name: "OpenFDA" },
              { name: "Nextstrain" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Klima & Umwelt (3)" : "Climate & Environment (3)"}
            connectors={[
              { name: "NASA EONET" },
              { name: "Open-Meteo" },
              { name: "USGS Earthquakes" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Finanzen & Maerkte (4)" : "Finance & Markets (4)"}
            connectors={[
              { name: "Finnhub", apiKey: true },
              { name: "Open Exchange Rates" },
              { name: "CoinGecko" },
              { name: "DeFi Llama" },
            ]}
          />
          <ConnectorCategory
            label="Social (2)"
            connectors={[
              { name: "Bluesky" },
              { name: "Mastodon" },
            ]}
          />
          <ConnectorCategory
            label={de ? "Global Intelligence & Sonstige (6)" : "Global Intelligence & Other (6)"}
            connectors={[
              { name: "World Monitor" },
              { name: "PatentsView (USPTO)" },
              { name: "UN Data" },
              { name: "UN SDG Indicators" },
              { name: "SteamSpy (Gaming)" },
            ]}
          />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 3: Signal-Retrieval (RAG)
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="03"
          title={de ? "Signal-Retrieval (RAG-Schicht)" : "Signal Retrieval (RAG Layer)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Das Signal-Retrieval ist die Bruecke zwischen den 57 Connectors und dem LLM-Prompt. Es findet die thematisch relevantesten Signale fuer eine gegebene Nutzeranfrage und formatiert sie fuer den Prompt. Quellcode: signals.ts"
              : "Signal retrieval bridges the 57 connectors and the LLM prompt. It finds the most topically relevant signals for a given user query and formats them for the prompt. Source: signals.ts"}
          </p>

          <SubH>{de ? "Keyword-Extraktion" : "Keyword Extraction"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Die Query wird in Kleinbuchstaben konvertiert, Sonderzeichen entfernt und in Woerter aufgesplittet. Woerter werden gefiltert nach:"
              : "The query is lowercased, special characters removed, and split into words. Words are filtered by:"}
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Stoppwoerter werden entfernt (DE + EN): " : "Stop words are removed (DE + EN): "}<Code>wie, was, wo, wer, wann, warum, welche, ist, sind, hat, haben, wird, werden, kann, koennen, fuer, von, mit, bei, auf, an, in, zu, ueber, unter, the, how, what, where, when, why, which, who, is, are, has, have, will, can, for, with, from, und, oder, aber, also, noch, schon, sehr</Code></li>
            <li>{de ? "Mindestlaenge: 2 Zeichen" : "Minimum length: 2 characters"}</li>
            <li>{de ? "Ausnahme: Wichtige Kurzterme werden akzeptiert: " : "Exception: Important short terms are accepted: "}<Code>ki, ai, eu, un, us, uk, it, ml, ar, vr, xr, 5g, 6g, iot, llm, rag, api, b2b, b2c, esg, gdp</Code></li>
            <li>{de ? "Maximale Keywords nach Expansion: 12" : "Maximum keywords after expansion: 12"}</li>
          </ul>

          <SubH>{de ? "Sprachuebergreifende Alias-Gruppen (ALG-21)" : "Cross-Language Alias Groups (ALG-21)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Wenn ein Keyword in einer Alias-Gruppe vorkommt, werden alle anderen Begriffe dieser Gruppe automatisch zur Suchmenge hinzugefuegt. Es gibt 9 Alias-Gruppen:"
              : "When a keyword matches an alias group, all other terms in that group are automatically added to the search set. There are 9 alias groups:"}
          </p>
          <MonoBlock>
{`1. ki       <-> ai, artificial intelligence, kuenstliche intelligenz
2. klimawandel <-> climate change, global warming
3. cybersicherheit <-> cybersecurity, cyber security
4. energiewende  <-> energy transition
5. lieferkette   <-> supply chain
6. gesundheit    <-> health, public health
7. migration     <-> immigration, refugees
8. geopolitik    <-> geopolitics
9. kryptowaehrung <-> cryptocurrency, crypto`}
          </MonoBlock>

          <SubH>{de ? "SQL-Scoring-Formel" : "SQL Scoring Formula"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Jedes Keyword erzeugt drei CASE-Klauseln (parametrisierte LIKE-Queries, keine String-Interpolation):"
              : "Each keyword generates three CASE clauses (parameterized LIKE queries, no string interpolation):"}
          </p>
          <MonoBlock>
{`Score = SUM(
  CASE WHEN lower(title)   LIKE '%keyword%' THEN 2 ELSE 0 END +
  CASE WHEN lower(topic)   LIKE '%keyword%' THEN 2 ELSE 0 END +
  CASE WHEN lower(content) LIKE '%keyword%' THEN 1 ELSE 0 END
)

Filter: Score >= 2 (verhindert Rauschen durch einzelne Content-Treffer)
Sortierung: relevance_score DESC, strength DESC, fetched_at DESC
Limit: 12 Signale pro Query
Zeitfenster: fetched_at > datetime('now', '-336 hours')  (= 14 Tage)`}
          </MonoBlock>

          <SubH>{de ? "Signal-Sanitisierung (SEC-07)" : "Signal Sanitization (SEC-07)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Bevor Signale in den LLM-Prompt eingebettet werden, wird der Text sanitisiert um Prompt-Injection ueber manipulierte Signaldaten zu verhindern:"
              : "Before signals are embedded in the LLM prompt, text is sanitized to prevent prompt injection via crafted signal data:"}
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Steuerzeichen entfernen (ausser Newline/Tab)" : "Strip control characters (except newline/tab)"}</li>
            <li>{de ? "XML-artige Tags entfernen die die Prompt-Struktur manipulieren koennten" : "Strip XML-style tags that could hijack prompt structure"}</li>
            <li>{de ? "Rollen-Marker entfernen: system:, user:, assistant:, human:" : "Strip role markers: system:, user:, assistant:, human:"}</li>
          </ul>

          <SubH>{de ? "Signal-Format im Prompt" : "Signal Format in Prompt"}</SubH>
          <MonoBlock>
{`AKTUELLE BELEGTE SIGNALE (letzte 14 Tage, aus N Quellen):
* [GDELT, 2026-04-10] [Staerke: 85%] Signal-Titel -> URL
    Signal-Content (max 200 Zeichen)`}
          </MonoBlock>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 4: System Prompt (MOST IMPORTANT)
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="04"
          title={de ? "System-Prompt (vollstaendige Struktur)" : "System Prompt (Complete Structure)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Der System-Prompt ist das Herzsteueck des SIS. Er instruiert das LLM, als Think-Tank-Analyst zu agieren, und liefert gleichzeitig den vollstaendigen Datenkontext. Nachfolgend die exakte Struktur aus llm.ts/buildSystemPrompt():"
              : "The system prompt is the heart of SIS. It instructs the LLM to act as a think-tank analyst while providing the complete data context. Below is the exact structure from llm.ts/buildSystemPrompt():"}
          </p>

          <SubH>{de ? "Rollen-Definition" : "Role Definition"}</SubH>
          <MonoBlock>
{`"Du bist das Strategic Intelligence System (SIS) -- ein Denk-Instrument
auf dem Niveau eines erstklassigen Think-Tanks mit explizitem EU-Fokus."

Sprache: Dynamisch per Locale (de/en)`}
          </MonoBlock>

          <SubH>{de ? "STEEP+V Analytisches Framework (6 Dimensionen)" : "STEEP+V Analytical Framework (6 Dimensions)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Jede Frage wird systematisch entlang dieser 6 Dimensionen analysiert. Gewichtung ist dynamisch je nach Fragekontext:"
              : "Every query is systematically analyzed along these 6 dimensions. Weighting is dynamic depending on query context:"}
          </p>
          <MonoBlock>
{`S = Society     Demografischer Wandel, Urbanisierung, Migration, Wertewandel
T = Technology   KI, Digitalisierung, Biotech, Quantencomputing, Cybersecurity
E = Economy      Globalisierung, Handelskonflikte, Arbeitsmarkt, Inflation, Ungleichheit
E = Environment  Klimawandel, Biodiversitaet, Energie, Ressourcen
P = Politics     Regulierung, Geopolitik, Demokratie, EU-Politik, Governance
V = Values       Vertrauenserosion, Polarisierung, Akzeptanz, kulturelle Verschiebungen`}
          </MonoBlock>

          <SubH>{de ? "EU JRC 14 Megatrends (Referenzrahmen)" : "EU JRC 14 Megatrends (Reference Frame)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Die 14 Megatrends der Europaeischen Kommission (Joint Research Centre) dienen als Orientierungsraster:"
              : "The 14 megatrends of the European Commission (Joint Research Centre) serve as an orientation frame:"}
          </p>
          <ol style={{ margin: "0 0 16px", paddingLeft: 24, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Beschleunigte technologische Veraenderung & Hyperkonnektivitaet" : "Accelerating technological change & hyperconnectivity"}</li>
            <li>{de ? "Zunehmende demografische Ungleichgewichte" : "Increasing demographic imbalances"}</li>
            <li>{de ? "Verschaerfter Klimawandel & oekologische Degradation" : "Intensifying climate change & environmental degradation"}</li>
            <li>{de ? "Wachsende oekonomische Ungleichheiten" : "Growing economic inequalities"}</li>
            <li>{de ? "Zunehmende geopolitische Spannungen" : "Increasing geopolitical tensions"}</li>
            <li>{de ? "Fortschreitende menschliche Erweiterung (Enhancement)" : "Advancing human enhancement"}</li>
            <li>{de ? "Machtverschiebungen zwischen Staaten" : "Power shifts between states"}</li>
            <li>{de ? "Wachsende Bedeutung globaler Gemeingueter" : "Growing importance of global commons"}</li>
            <li>{de ? "Entstehung neuer Governance-Formen" : "Emergence of new governance forms"}</li>
            <li>{de ? "Schwaechung von Demokratie & institutionellem Vertrauen" : "Weakening of democracy & institutional trust"}</li>
            <li>{de ? "Veraenderung von Arbeit & Bildung" : "Changing work & education"}</li>
            <li>{de ? "Zunehmende globale Gesundheitsherausforderungen" : "Increasing global health challenges"}</li>
            <li>{de ? "Wachsende Rolle von Staedten & Urbanisierung" : "Growing role of cities & urbanization"}</li>
            <li>{de ? "Steigende Aspirationen & Erwartungen" : "Rising aspirations & expectations"}</li>
          </ol>

          <SubH>{de ? "7 Absolute PFLICHTEN" : "7 Absolute Requirements (PFLICHTEN)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Diese 7 Regeln sind im Prompt als \"ABSOLUTE PFLICHTEN\" markiert und muessen in jeder Antwort eingehalten werden:"
              : "These 7 rules are marked as \"ABSOLUTE PFLICHTEN\" in the prompt and must be followed in every response:"}
          </p>
          <div style={{ borderLeft: "3px solid var(--color-lime, #E4FF97)", paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>1.</strong> {de
                ? "BEANTWORTE DIE FRAGE DIREKT UND SUBSTANZIELL -- nicht die Frage welche Trends passen."
                : "ANSWER THE QUESTION DIRECTLY AND SUBSTANTIALLY -- not which trends fit."}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>2.</strong> {de
                ? "Die synthesis MUSS 6-10 Saetze lang sein. Kurze synthesis = Fehler."
                : "The synthesis MUST be 6-10 sentences long. Short synthesis = error."}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>3.</strong> {de
                ? "Nenne KONKRETE Zahlen, Laender, Unternehmen, Technologien, Zeitrahmen."
                : "Name CONCRETE numbers, countries, companies, technologies, timeframes."}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>4.</strong> {de
                ? "Verwende die Trends als HINTERGRUND-KONTEXT -- sie sind Signalgeber, nicht deine Antwort."
                : "Use trends as BACKGROUND CONTEXT -- they are signal providers, not your answer."}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>5.</strong> {de
                ? "VERBOTEN: Saetze wie \"X ist ein Megatrend mit Y% Relevanz\" -- das ist Datendump, keine Analyse."
                : "FORBIDDEN: Sentences like \"X is a megatrend with Y% relevance\" -- that is data dump, not analysis."}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>6.</strong> {de
                ? "scenarios IMMER generieren -- GENAU 3 Szenarien: optimistic, baseline, pessimistic. Summe der Wahrscheinlichkeiten muss ungefaehr 100% ergeben."
                : "scenarios ALWAYS generated -- EXACTLY 3 scenarios: optimistic, baseline, pessimistic. Sum of probabilities must be approximately 100%."}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>7.</strong> {de
                ? "TRANSPARENZ & QUELLENHERKUNFT (Provenance Tagging): Fakten aus Live-Signalen mit [SIGNAL: Quelle, Datum], aus Trend-Daten mit [TREND: Name], eigenes Wissen mit [LLM-Einschaetzung]. ERFINDE NIEMALS URLs. Das references-Array darf NIEMALS leer sein (mind. 2 echte Quellen). Wo die Datenlage duenn ist, sage es explizit."
                : "TRANSPARENCY & PROVENANCE (Provenance Tagging): Facts from live signals tagged [SIGNAL: Source, Date], from trend data [TREND: Name], own knowledge [LLM-Einschaetzung]. NEVER fabricate URLs. The references array must NEVER be empty (min. 2 real sources). Where data is thin, say so explicitly."}
            </div>
          </div>

          <SubH>{de ? "Szenario-Wahrscheinlichkeits-Instruktionen" : "Scenario Probability Instructions"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Wahrscheinlichkeiten muessen sich aus der ANALYSE ERGEBEN, nicht aus einem Default-Schema" : "Probabilities must FOLLOW FROM THE ANALYSIS, not from a default scheme"}</li>
            <li>{de ? "VERBOTEN: Identische Verteilungen wie 0.20/0.55/0.25 fuer jede Frage" : "FORBIDDEN: Identical distributions like 0.20/0.55/0.25 for every query"}</li>
            <li>{de ? "Reifer Markt: baseline hoeher (z.B. 0.65)" : "Mature market: baseline higher (e.g. 0.65)"}</li>
            <li>{de ? "Volatiles Thema: breitere Verteilung, pessimistic kann hoeher sein" : "Volatile topic: wider distribution, pessimistic can be higher"}</li>
            <li>{de ? "Politisch getrieben: baseline niedriger weil unsicherer" : "Politically driven: baseline lower because more uncertain"}</li>
            <li>{de ? "Summe muss ~100% sein (95-105% akzeptabel durch Rundung)" : "Sum must be ~100% (95-105% acceptable due to rounding)"}</li>
          </ul>

          <SubH>{de ? "Trend-Matching-Instruktionen" : "Trend-Matching Instructions"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Nur Trend-IDs zurueckgeben (z.B. \"mega-ai-transformation\"), NICHT die Namen" : "Return only trend IDs (e.g. \"mega-ai-transformation\"), NOT names"}</li>
            <li>{de ? "Erwartete Anzahl: 3-8 matched Trends pro Query" : "Expected count: 3-8 matched trends per query"}</li>
            <li>{de ? "matchedTrendIds = [] ist IMMER ein Fehler" : "matchedTrendIds = [] is ALWAYS an error"}</li>
            <li>{de ? "Erfundene IDs werden serverseitig herausgefiltert und geloggt" : "Fabricated IDs are filtered out server-side and logged"}</li>
          </ul>

          <SubH>{de ? "Fragetypen-Erkennung" : "Query Type Detection"}</SubH>
          <MonoBlock>
{`STRATEGISCH ("Wie entwickelt sich X in 5 Jahren?")
  -> Tiefe STEEP+V-Analyse + BSC-Kandidat

FAKTENFRAGE ("Wer ist X?", "Was kostet Y?")
  -> Direktantwort aus Allgemeinwissen, Trends nur als Kontext

STICHWORT/TAG ("AI", "frontier-tech", "Cybersecurity")
  -> Strategisches Lagebild: was bewegt sich, welche Kraefte wirken

VERGLEICH/ITERATION
  -> Direkte Gegenueberstellung mit Handlungsempfehlung`}
          </MonoBlock>

          <SubH>{de ? "Qualitaetsstandard" : "Quality Standard"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Der Prompt verlangt Think-Tank-Niveau -- wie ein brillanter Analyst nach 2 Stunden Recherche:"
              : "The prompt demands think-tank level -- like a brilliant analyst after 2 hours of research:"}
          </p>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Was ist der AKTUELLE STAND der Dinge?" : "What is the CURRENT STATE of things?"}</li>
            <li>{de ? "Was sind die TREIBENDEN KRAEFTE entlang STEEP+V?" : "What are the DRIVING FORCES along STEEP+V?"}</li>
            <li>{de ? "Was sind die KRITISCHEN UNSICHERHEITEN?" : "What are the CRITICAL UNCERTAINTIES?"}</li>
            <li>{de ? "Welche KONKRETEN IMPLIKATIONEN ergeben sich -- insbesondere fuer Europa?" : "What CONCRETE IMPLICATIONS arise -- especially for Europe?"}</li>
            <li>{de ? "Wo ist die DATENLAGE DUENN -- was wissen wir nicht?" : "Where is DATA THIN -- what don't we know?"}</li>
            <li>{de ? "Belege Aussagen direkt im Fliesstext: [Quellenname, Datum]. Ohne Beleg = Meinung." : "Back claims directly in running text: [Source, Date]. Without citation = opinion."}</li>
          </ul>

          <SubH>{de ? "Balanced Scorecard (BSC) Regeln" : "Balanced Scorecard (BSC) Rules"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Standard: null. Wird NUR bei strategischen Analyse-Fragen generiert" : "Default: null. Generated ONLY for strategic analysis questions"}</li>
            <li>{de ? "NICHT bei Faktenfragen, Politik, Namen, historischen Ereignissen" : "NOT for factual questions, politics, names, historical events"}</li>
            <li>{de ? "3-6 themenspezifische Perspectives (NICHT generisch)" : "3-6 topic-specific perspectives (NOT generic)"}</li>
            <li>{de ? "scores: 0-1, impacts: -1 bis +1 (0 = keine Verbindung)" : "scores: 0-1, impacts: -1 to +1 (0 = no connection)"}</li>
            <li>{de ? "overallReadiness: 0-1" : "overallReadiness: 0-1"}</li>
          </ul>

          <SubH>{de ? "Datenkontext im Prompt" : "Data Context in Prompt"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Der Prompt enthaelt drei komprimierte Datenbloecke, die dem LLM den gesamten Wissensstand des Systems vermitteln:"
              : "The prompt contains three compressed data blocks that convey the system's entire knowledge state to the LLM:"}
          </p>
          <MonoBlock>
{`TRENDS (Top 40, sortiert nach Relevanz):
- ID:"mega-ai-transformation" | Artificial Intelligence [Mega-Trend]
  Ring:adopt Rel:98% Conf:95% Imp:98% rising Dur:permanent Dir:both
  Focus:strategic,investment Signals:500 Sources:PwC,EY,TRENDONE
  Regs:AI Act,AI EO Edges:6

REGULIERUNGEN (15 Frameworks):
- EU:AI Act [enforcing] -> mega-ai-transformation(reshapes), ...
- US:CHIPS Act [enforcing] -> mega-technological-disruption(accelerates), ...

KAUSALE VERBINDUNGEN (102 Kanten):
mega-climate-sustainability --drives(95%)--> mega-energy-transition
mega-ai-transformation --drives(95%)--> mega-future-of-work
mega-geopolitical-fracturing --dampens(70%)--> mega-connectivity`}
          </MonoBlock>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 5: Validation & Anti-Hallucination
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="05"
          title={de ? "Validierung & Anti-Halluzination" : "Validation & Anti-Hallucination"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Das System implementiert 10 Sicherheits- und Validierungsschichten (SEC-01 bis SEC-10, VAL-01 bis VAL-03), die LLM-Halluzinationen erkennen, korrigieren und dokumentieren. Quellcode: validation.ts, route.ts"
              : "The system implements 10 security and validation layers (SEC-01 to SEC-10, VAL-01 to VAL-03) that detect, correct, and document LLM hallucinations. Source: validation.ts, route.ts"}
          </p>

          <SubH>{de ? "Input-Sanitisierung (Prompt-Injection-Schutz)" : "Input Sanitization (Prompt Injection Protection)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Alle 9 Injection-Patterns werden vor der LLM-Uebergabe neutralisiert (route.ts):"
              : "All 9 injection patterns are neutralized before LLM handoff (route.ts):"}
          </p>
          <MonoBlock>
{`INJECTION_PATTERNS (9 RegExp):
1. /\\b(?:system|assistant|human)\\s*:/gi     -- Rollen-Direktiven
2. /\\byou are\\b/gi                           -- Identitaets-Override
3. /\\bignore .* instructions?\\b/gi           -- Instruktions-Override
4. /\\bforget .* instructions?\\b/gi           -- Gedaechtnis-Manipulation
5. /\\bdisregard .* instructions?\\b/gi        -- Instruktions-Override
6. /\\boverride .* instructions?\\b/gi         -- Instruktions-Override
7. /\\bnew instructions?\\s*:/gi               -- Neue Instruktionen
8. /\\bact as\\b/gi                            -- Rollenuebernahme
9. /\\bpretend (?:to be|you are)\\b/gi         -- Identitaets-Override

+ XML-Tag-Pattern: /<\\/?[a-zA-Z][a-zA-Z0-9_-]*>/g
+ Max Query-Laenge: 2.000 Zeichen`}
          </MonoBlock>

          <SubH>{de ? "contextProfile-Sanitisierung (SEC-08)" : "contextProfile Sanitization (SEC-08)"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Felder role, industry, region werden auf max 100 Zeichen begrenzt" : "Fields role, industry, region limited to max 100 characters"}</li>
            <li>{de ? "Newlines/Returns entfernt" : "Newlines/returns removed"}</li>
            <li>{de ? "HTML-Tags entfernt" : "HTML tags removed"}</li>
            <li>{de ? "Rollen-Marker (system:, assistant:, human:) entfernt" : "Role markers (system:, assistant:, human:) removed"}</li>
          </ul>

          <SubH>{de ? "previousContext-Sanitisierung (SEC-10)" : "previousContext Sanitization (SEC-10)"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Synthesis wird auf 6.000 Zeichen begrenzt" : "Synthesis truncated to 6,000 characters"}</li>
            <li>{de ? "XML-artige Tags werden entfernt" : "XML-like tags are stripped"}</li>
            <li>{de ? "Rollen-Marker werden entfernt (system:, user:, assistant:, human:)" : "Role markers stripped (system:, user:, assistant:, human:)"}</li>
            <li>{de ? "Query wird durch sanitizeQuery() gefiltert" : "Query is filtered through sanitizeQuery()"}</li>
            <li>{de ? "Wird als Assistant-Message injiziert (potenter Injektionsvektor, daher besonders geschuetzt)" : "Injected as assistant message (potent injection vector, thus specially protected)"}</li>
          </ul>

          <SubH>{de ? "Zod-Schema-Validierung (VAL-01)" : "Zod Schema Validation (VAL-01)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Alle LLM-Ausgaben werden gegen ein striktes Zod-Schema validiert. Felder und Constraints:"
              : "All LLM outputs are validated against a strict Zod schema. Fields and constraints:"}
          </p>
          <div style={{ padding: "14px 16px", borderRadius: 8, background: "rgba(0,0,0,0.03)", border: "1px solid var(--color-border, #E8E8E8)", fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 12, lineHeight: 1.9, marginBottom: 16 }}>
            <JsonField name="synthesis" type="string" desc={de ? "Kernanalyse" : "Core analysis"} constraints="min:1, max:10000" />
            <JsonField name="reasoningChains" type="string[]" desc={de ? "Kausale Logikketten" : "Causal logic chains"} constraints="max 10 items, each max 1000 chars" />
            <JsonField name="steepV" type="object|null" desc={de ? "6 Dimensionen, je max 1000 chars, nullable" : "6 dimensions, each max 1000 chars, nullable"} optional />
            <JsonField name="matchedTrendIds" type="string[]" desc={de ? "IDs aus der Trend-DB" : "IDs from trend DB"} constraints="max 40 items, each max 100 chars" />
            <JsonField name="keyInsights" type="string[]" desc={de ? "Kern-Erkenntnisse" : "Key insights"} constraints="max 10 items, each max 1000 chars" />
            <JsonField name="regulatoryContext" type="string[]" desc={de ? "Regulatorischer Kontext" : "Regulatory context"} constraints="max 10 items, each max 1000 chars" />
            <JsonField name="causalAnalysis" type="string[]" desc={de ? "Ursache-Wirkungs-Analyse" : "Cause-effect analysis"} constraints="max 10 items, each max 1000 chars" />
            <JsonField name="scenarios" type="Scenario[]" desc={de ? "3 Szenarien" : "3 scenarios"} constraints="max 5 items" />
            <JsonField name="scenarios[].type" type="enum" desc="optimistic | baseline | pessimistic | wildcard" optional />
            <JsonField name="scenarios[].name" type="string" desc={de ? "Szenario-Name" : "Scenario name"} constraints="max 200 chars" />
            <JsonField name="scenarios[].description" type="string" desc={de ? "Beschreibung" : "Description"} constraints="max 2000 chars" />
            <JsonField name="scenarios[].probability" type="number|null" desc="0-1" constraints="preprocess: string->number" />
            <JsonField name="scenarios[].timeframe" type="string" desc={de ? "Zeitraum" : "Timeframe"} constraints="max 200 chars" optional />
            <JsonField name="scenarios[].keyDrivers" type="string[]" desc={de ? "Treiber" : "Drivers"} constraints="max 10, each max 300 chars" optional />
            <JsonField name="interpretation" type="string|null" desc={de ? "Analytische Einordnung" : "Analytical interpretation"} constraints="max 3000 chars" optional />
            <JsonField name="references" type="Reference[]" desc={de ? "Quellenverweise" : "Source references"} constraints="max 20 items" />
            <JsonField name="references[].title" type="string" desc="" constraints="max 500 chars" />
            <JsonField name="references[].url" type="string" desc="" constraints="max 2000 chars, URL-validated" />
            <JsonField name="followUpQuestions" type="string[]" desc={de ? "Folgefragen" : "Follow-up questions"} constraints="max 10, each max 500 chars" />
            <JsonField name="newsContext" type="string|null" desc={de ? "Nachrichtenkontext" : "News context"} constraints="max 3000 chars" optional />
            <JsonField name="decisionFramework" type="string|null" desc={de ? "Entscheidungsrahmen" : "Decision framework"} constraints="max 3000 chars" optional />
            <JsonField name="balancedScorecard" type="BSC|null" desc={de ? "Balanced Scorecard" : "Balanced Scorecard"} optional />
            <JsonField name="balancedScorecard.perspectives" type="Perspective[]" desc="" constraints="min 3, max 6" />
            <JsonField name="balancedScorecard.overallReadiness" type="number" desc="" constraints="0-1" />
            <JsonField name="confidence" type="number" desc={de ? "Konfidenz-Score" : "Confidence score"} constraints="0-1, preprocess: string->number" />
          </div>

          <SubH>{de ? "matchedTrendIds Anti-Halluzination (VAL-02)" : "matchedTrendIds Anti-Hallucination (VAL-02)"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Jede vom LLM zurueckgegebene Trend-ID wird gegen die echte validTrendIds-Menge geprueft" : "Every trend ID returned by the LLM is checked against the real validTrendIds set"}</li>
            <li>{de ? "Nicht existierende IDs werden entfernt und in Warnings geloggt" : "Non-existent IDs are removed and logged as warnings"}</li>
            <li>{de ? "Meldung: \"Dropped N/M hallucinated matchedTrendIds: id1, id2, ...\"" : "Message: \"Dropped N/M hallucinated matchedTrendIds: id1, id2, ...\""}</li>
            <li>{de ? "Wenn ALLE IDs ungueltig: \"ALL matchedTrendIds were invalid\"" : "If ALL IDs invalid: \"ALL matchedTrendIds were invalid\""}</li>
          </ul>

          <SubH>{de ? "Szenario-Wahrscheinlichkeits-Normalisierung" : "Scenario Probability Normalization"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Prueft ob genau 3 Szenarien vorhanden sind" : "Checks for exactly 3 scenarios"}</li>
            <li>{de ? "Null/nicht-numerische Werte: werden durch Defaults ersetzt (baseline=0.45, optimistic=0.30, pessimistic=0.25)" : "Null/non-numeric values: replaced with defaults (baseline=0.45, optimistic=0.30, pessimistic=0.25)"}</li>
            <li>{de ? "Summe geprueft: 0.8-1.1 ist akzeptabel. Ausserhalb wird auf 1.0 normalisiert." : "Sum checked: 0.8-1.1 is acceptable. Outside this range, normalized to 1.0."}</li>
            <li>{de ? "Identische Wahrscheinlichkeiten (z.B. alle 0.33) werden als Warning geloggt" : "Identical probabilities (e.g. all 0.33) are logged as warning"}</li>
          </ul>

          <SubH>{de ? "URL-Validierung fuer Referenzen" : "URL Validation for References"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Titel-only-Referenzen (ohne URL) sind erlaubt" : "Title-only references (without URL) are allowed"}</li>
            <li>{de ? "URLs muessen http: oder https: Protokoll haben" : "URLs must have http: or https: protocol"}</li>
            <li>{de ? "Malformed URLs werden entfernt und geloggt" : "Malformed URLs are removed and logged"}</li>
          </ul>

          <SubH>{de ? "Rate Limiting" : "Rate Limiting"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "In-Memory Sliding Window: 100 Requests pro IP pro Stunde" : "In-memory sliding window: 100 requests per IP per hour"}</li>
            <li>{de ? "Abgelaufene Eintraege werden alle 50 Aufrufe bereinigt" : "Expired entries pruned every 50 calls"}</li>
            <li>{de ? "HTTP 429 mit Retry-After: 3600 bei Ueberschreitung" : "HTTP 429 with Retry-After: 3600 on limit exceeded"}</li>
            <li>{de ? "Reset bei Server-Neustart (kein persistenter Speicher)" : "Resets on server restart (no persistent storage)"}</li>
          </ul>

          <SubH>{de ? "JSON-Reparatur bei Truncation" : "JSON Repair on Truncation"}</SubH>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "Wenn der LLM-Stream abgeschnitten wird, versucht das System das JSON zu reparieren" : "If the LLM stream is truncated, the system attempts to repair the JSON"}</li>
            <li>{de ? "Strategie: Offene Strukturen zaehlen und passende Schlussklammern anfuegen" : "Strategy: Count open structures and append matching closing brackets"}</li>
            <li>{de ? "Fallback-Strategie: Zurueckgehen zum letzten vollstaendigen Key-Value-Paar" : "Fallback strategy: Backtrack to last complete key-value pair"}</li>
            <li>{de ? "Reparierte Ergebnisse werden mit _repaired: true markiert" : "Repaired results are marked with _repaired: true"}</li>
            <li>{de ? "Minimum-Anforderung: synthesis-Feld muss vorhanden sein" : "Minimum requirement: synthesis field must be present"}</li>
          </ul>

          <SubH>{de ? "Frontend-Transparenz" : "Frontend Transparency"}</SubH>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
            <li>{de ? "\"KI-vorgeschlagen, nicht redaktionell verifiziert\" bei Referenzen" : "\"AI-suggested, not editorially verified\" on references"}</li>
            <li>{de ? "\"Repariert\"-Badge wenn JSON repariert wurde (_repaired: true)" : "\"Repaired\" badge when JSON was repaired (_repaired: true)"}</li>
            <li>{de ? "\"Datenhinweis\"-Badges bei Qualitaetsproblemen (_dataQualityWarnings)" : "\"Data Note\" badges on quality issues (_dataQualityWarnings)"}</li>
            <li>{de ? "Validierungs-Warnungen werden serverseitig geloggt (_validationWarnings)" : "Validation warnings logged server-side (_validationWarnings)"}</li>
          </ul>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 6: Analysis Frameworks
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="06"
          title={de ? "Analyse-Frameworks (6)" : "Analysis Frameworks (6)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Neben der Standard-Analyse (STEEP+V) koennen 6 spezialisierte Frameworks gewaehlt werden, die den System-Prompt und die Ausgabestruktur anpassen:"
              : "Beyond the default analysis (STEEP+V), 6 specialized frameworks can be selected that adjust the system prompt and output structure:"}
          </p>

          {[
            {
              num: "1",
              title: de ? "Marktanalyse (SWOT + PESTEL)" : "Market Analysis (SWOT + PESTEL)",
              method: "SWOT + PESTEL",
              desc: de
                ? "Klassische Marktanalyse mit Staerken/Schwaechen/Chancen/Risiken und PESTEL-Umfeldanalyse. Fuer Produkt- und Wettbewerbsfragen. Anwendung: Maerkte, Produkte, Wettbewerbsumfeld."
                : "Classic market analysis with Strengths/Weaknesses/Opportunities/Threats and PESTEL environmental analysis. For product and competitive questions. Applied to: markets, products, competitive landscape.",
            },
            {
              num: "2",
              title: de ? "War-Gaming (RAND/Shell-Methodik)" : "War-Gaming (RAND/Shell Methodology)",
              method: "RAND Corporation + Shell Scenario Planning",
              desc: de
                ? "Strategische Simulation mit Akteursanalyse, Zuegen und Gegenzuegen. Basiert auf RAND Corporation und Shell Szenario-Methodik. Anwendung: geopolitische Analyse, Konkurrenzstrategie."
                : "Strategic simulation with actor analysis, moves and counter-moves. Based on RAND Corporation and Shell scenario methodology. Applied to: geopolitical analysis, competitive strategy.",
            },
            {
              num: "3",
              title: "Pre-Mortem (Gary Klein)",
              method: "Gary Klein's Pre-Mortem Analysis (1998)",
              desc: de
                ? "Proaktive Risikoanalyse: 'Stell dir vor, das Projekt ist gescheitert. Warum?' Identifiziert blinde Flecken und versteckte Risiken bevor sie eintreten. Anwendung: Projektplanung, Strategiepruefung."
                : "Proactive risk analysis: 'Imagine the project has failed. Why?' Identifies blind spots and hidden risks before they materialize. Applied to: project planning, strategy review.",
            },
            {
              num: "4",
              title: "Post-Mortem (5-Whys)",
              method: "Toyota 5-Whys Root Cause Analysis",
              desc: de
                ? "Ursachenanalyse: Fuenffaches 'Warum?' bis zur Wurzelursache. Fuer die Aufarbeitung von Ereignissen und Fehlschlaegen. Anwendung: Vorfallanalyse, Fehlerbehebung."
                : "Root cause analysis: five times 'Why?' until the root cause. For analyzing events and failures. Applied to: incident analysis, failure correction.",
            },
            {
              num: "5",
              title: de ? "Trend Deep-Dive (STEEP+V)" : "Trend Deep-Dive (STEEP+V)",
              method: "STEEP+V Extended Analysis",
              desc: de
                ? "Systemische Trendanalyse entlang aller 6 STEEP+V-Dimensionen mit Wechselwirkungen, Kaskadeneffekten und Zeitachse. Anwendung: Tiefe Trendforschung, Langfristplanung."
                : "Systemic trend analysis along all 6 STEEP+V dimensions with interactions, cascade effects and timeline. Applied to: deep trend research, long-term planning.",
            },
            {
              num: "6",
              title: "Stakeholder (Mitchell Salience Model)",
              method: "Mitchell, Agle & Wood (1997) Stakeholder Salience",
              desc: de
                ? "Einfluss-Mapping nach Power/Legitimacy/Urgency. Identifiziert dominante, abhaengige und fordernde Stakeholder. Anwendung: Change Management, Policy-Analyse."
                : "Influence mapping by Power/Legitimacy/Urgency. Identifies dominant, dependent and demanding stakeholders. Applied to: change management, policy analysis.",
            },
          ].map((fw) => (
            <div
              key={fw.num}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--color-border, #E8E8E8)",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--color-lime, #E4FF97)",
                  color: "var(--color-brand-text, #0A0A0A)",
                  fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {fw.num}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{fw.title}</div>
                <div style={{ fontSize: 11, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)", marginBottom: 4 }}>{fw.method}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted, #6B6B6B)" }}>{fw.desc}</div>
              </div>
            </div>
          ))}
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 7: Knowledge Base
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="07"
          title={de ? "Wissensbasis (Trends, Kausalgraph, Regulierungen)" : "Knowledge Base (Trends, Causal Graph, Regulations)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Die statische Wissensbasis wird bei jedem Query in den System-Prompt eingespeist. Sie basiert auf 6 autoritativen Quellen: Zukunftsinstitut (11 Megatrends), PwC (5 Megatrends), EY (Megatrends 2026+), EU ESPAS (Global Trends to 2030), Roland Berger (Trend Compendium 2050), TRENDONE (Trend Universe 2026)."
              : "The static knowledge base is fed into the system prompt on every query. It is based on 6 authoritative sources: Zukunftsinstitut (11 Megatrends), PwC (5 Megatrends), EY (Megatrends 2026+), EU ESPAS (Global Trends to 2030), Roland Berger (Trend Compendium 2050), TRENDONE (Trend Universe 2026)."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: de ? "Kuratierte Trends" : "Curated Trends", value: "40", desc: de ? "Top 40 nach Relevanz" : "Top 40 by relevance" },
              { label: de ? "Kausale Kanten" : "Causal Edges", value: "102", desc: "drives | amplifies | dampens | correlates" },
              { label: de ? "Regulierungen" : "Regulations", value: "15", desc: de ? "4 Jurisdiktionen" : "4 jurisdictions" },
              { label: de ? "Quellen-Institutionen" : "Source Institutions", value: "42+", desc: de ? "Forschungseinrichtungen" : "Research institutions" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border, #E8E8E8)" }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", color: "var(--color-text-heading, #0A0A0A)", marginBottom: 2 }}>{item.value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-heading, #0A0A0A)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted, #6B6B6B)" }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <SubH>{de ? "Trend-Beispiele (aus mega-trends.ts)" : "Trend Examples (from mega-trends.ts)"}</SubH>
          {[
            {
              id: "mega-ai-transformation",
              name: "Artificial Intelligence & Automation",
              desc: de
                ? "KI durchdringt alle Wirtschaftssektoren. PwC (2024): bis 2030 bis zu 15,7 Bio. USD Wertschoepfung. Treiber: sinkende Rechenkosten, multimodale Modelle, EU AI Act seit Aug 2024. Confidence: 0.95 (5/6 Quellen)."
                : "AI permeates all economic sectors. PwC (2024): up to 15.7T USD value by 2030. Drivers: falling compute costs, multimodal models, EU AI Act since Aug 2024. Confidence: 0.95 (5/6 sources).",
              stats: "Rel:98% Conf:95% Imp:98% Ring:adopt Velocity:rising Signals:500",
            },
            {
              id: "mega-climate-sustainability",
              name: "Climate Change & Sustainability",
              desc: de
                ? "IPCC AR6: 1,1 Grad Erwaermung. EU Green Deal: Klimaneutralitaet 2050, -55% bis 2030. 6/6 Quellen stuetzen diesen Trend (hoechste Confidence aller Trends)."
                : "IPCC AR6: 1.1 degree warming. EU Green Deal: climate neutrality 2050, -55% by 2030. 6/6 sources support this trend (highest confidence of all trends).",
              stats: "Rel:96% Conf:100% Imp:97% Ring:adopt Velocity:rising Signals:450",
            },
            {
              id: "mega-geopolitical-fracturing",
              name: "Geopolitical Fragmentation",
              desc: de
                ? "PwC: 'Fracturing World'. Tech-, Handels- und Finanzraeume fragmentieren entlang geopolitischer Linien. EU: strategische Autonomie in Halbleitern, Energie, Rohstoffen. Treiber: Ukraine, Indo-Pazifik, US-China."
                : "PwC: 'Fracturing World'. Tech, trade and financial spaces fragment along geopolitical lines. EU: strategic autonomy in semiconductors, energy, raw materials. Drivers: Ukraine, Indo-Pacific, US-China.",
              stats: "Rel:85% Conf:83% Imp:88% Ring:adopt Velocity:rising Signals:250",
            },
            {
              id: "mega-demographic-shift",
              name: "Demographic Shifts & Aging",
              desc: de
                ? "UN 2024: Anteil 65+ global von 10% (2022) auf 16% (2050). EU-Dependency-Ratio: 33% auf >50%. Silver Economy waechst, aber Pflegekosten und Fachkraeftemangel steigen."
                : "UN 2024: share 65+ globally from 10% (2022) to 16% (2050). EU dependency ratio: 33% to >50%. Silver economy grows, but care costs and skills shortages increase.",
              stats: "Rel:88% Conf:83% Imp:90% Ring:adopt Velocity:stable Signals:300",
            },
          ].map((t) => (
            <div key={t.id} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--color-border, #E8E8E8)", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                <Code>{t.id}</Code>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginBottom: 4 }}>{t.desc}</div>
              <div style={{ fontSize: 11, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)" }}>{t.stats}</div>
            </div>
          ))}

          <SubH>{de ? "Kausale Kanten (Beispiele aus causal-graph.ts)" : "Causal Edges (Examples from causal-graph.ts)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "102 handkuratierte Ursache-Wirkungs-Beziehungen. 4 Kantentypen: drives, amplifies, dampens, correlates. Staerke: 0-1."
              : "102 hand-curated cause-effect relationships. 4 edge types: drives, amplifies, dampens, correlates. Strength: 0-1."}
          </p>
          <MonoBlock>
{`mega-climate-sustainability --drives(95%)--> mega-energy-transition
  "Climate urgency accelerates energy transition"

mega-ai-transformation --drives(95%)--> mega-future-of-work
  "AI fundamentally reshapes jobs, skills, and work models"

mega-ai-transformation --amplifies(98%)--> macro-generative-ai
  "AI research directly produces generative AI capabilities"

mega-geopolitical-fracturing --dampens(70%)--> mega-connectivity
  "Fragmentation leads to internet splinternet, tech decoupling"

mega-demographic-shift --drives(90%)--> mega-health-biotech
  "Aging populations drive healthcare innovation demand"

mega-connectivity --amplifies(80%)--> mega-ai-transformation
  "Connected data fuels AI training and deployment"

mega-ai-transformation --drives(80%)--> mega-security-trust
  "AI creates new attack vectors and defense needs" [bidirectional]`}
          </MonoBlock>

          <SubH>{de ? "Regulatorische Frameworks (15, aus regulations.ts)" : "Regulatory Frameworks (15, from regulations.ts)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            {de
              ? "Alle erfassten Regulierungen nach Jurisdiktion, mit Status und Wirkung auf Trends:"
              : "All tracked regulations by jurisdiction, with status and impact on trends:"}
          </p>

          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginBottom: 6, textTransform: "uppercase" as const }}>EU (7)</div>
          <RegRow shortName="AI Act" jurisdiction="EU" status="enforcing" desc={de ? "Weltweit erste umfassende KI-Regulierung (seit 08/2024). Risikobasiert." : "World's first comprehensive AI regulation (since 08/2024). Risk-based."} />
          <RegRow shortName="GDPR" jurisdiction="EU" status="enforcing" desc={de ? "Datenschutz-Grundverordnung (seit 05/2018). Extraterritorial." : "General Data Protection Regulation (since 05/2018). Extraterritorial."} />
          <RegRow shortName="DORA" jurisdiction="EU" status="enforcing" desc={de ? "IKT-Risikomanagement fuer Finanzsektor (seit 01/2025)." : "ICT risk management for financial sector (since 01/2025)."} />
          <RegRow shortName="NIS2" jurisdiction="EU" status="enforcing" desc={de ? "Cybersicherheit fuer kritische Infrastruktur (seit 10/2024)." : "Cybersecurity for critical infrastructure (since 10/2024)."} />
          <RegRow shortName="Green Deal" jurisdiction="EU" status="enforcing" desc={de ? "Klimaneutralitaet 2050, -55% bis 2030, CBAM, ETS." : "Climate neutrality 2050, -55% by 2030, CBAM, ETS."} />
          <RegRow shortName="DMA/DSA" jurisdiction="EU" status="enforcing" desc={de ? "Platform-Regulierung, Gatekeeper, Interoperabilitaet (seit 11/2023)." : "Platform regulation, gatekeeper, interoperability (since 11/2023)."} />
          <RegRow shortName="CSRD" jurisdiction="EU" status="enforcing" desc={de ? "Nachhaltigkeitsberichterstattung, ~50.000 Unternehmen (seit 01/2024)." : "Sustainability reporting, ~50,000 companies (since 01/2024)."} />

          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginBottom: 6, marginTop: 12, textTransform: "uppercase" as const }}>US (3)</div>
          <RegRow shortName="AI EO" jurisdiction="US" status="enforcing" desc={de ? "Executive Order KI-Sicherheit, Safety Testing (seit 10/2023)." : "Executive Order on AI safety, safety testing (since 10/2023)."} />
          <RegRow shortName="CHIPS Act" jurisdiction="US" status="enforcing" desc={de ? "$280B fuer Halbleiter, Reshoring, Exportkontrollen China." : "$280B for semiconductors, reshoring, China export controls."} />
          <RegRow shortName="IRA" jurisdiction="US" status="enforcing" desc={de ? "$370B Clean Energy, EV/Solar/Wind Tax Credits." : "$370B clean energy, EV/solar/wind tax credits."} />

          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginBottom: 6, marginTop: 12, textTransform: "uppercase" as const }}>China (2)</div>
          <RegRow shortName="CN AI Gov" jurisdiction="China" status="enforcing" desc={de ? "KI-Regulierung, Algorithmen-Regeln, Deepfake-Regeln." : "AI regulation, algorithm rules, deepfake rules."} />
          <RegRow shortName="DSL/PIPL" jurisdiction="China" status="enforcing" desc={de ? "Datenlokalisierung, Cross-Border-Beschraenkungen. Chinas GDPR." : "Data localization, cross-border restrictions. China's GDPR."} />

          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginBottom: 6, marginTop: 12, textTransform: "uppercase" as const }}>UK (2)</div>
          <RegRow shortName="UK AI" jurisdiction="UK" status="adopted" desc={de ? "Pro-Innovation, sektorspezifisch, ohne horizontale Gesetzgebung." : "Pro-innovation, sector-specific, without horizontal legislation."} />
          <RegRow shortName="OSA" jurisdiction="UK" status="enforcing" desc={de ? "Online-Sicherheit, Altersverifikation, Inhaltsmoderation." : "Online safety, age verification, content moderation."} />

          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", marginBottom: 6, marginTop: 12, textTransform: "uppercase" as const }}>Global (3)</div>
          <RegRow shortName="SDGs" jurisdiction="Global" status="enforcing" desc={de ? "UN 17 Ziele fuer nachhaltige Entwicklung 2030." : "UN 17 Sustainable Development Goals 2030."} />
          <RegRow shortName="Paris" jurisdiction="Global" status="enforcing" desc={de ? "Pariser Klimaabkommen: 1,5-Grad-Ziel, NDCs." : "Paris Climate Agreement: 1.5 degree target, NDCs."} />
          <RegRow shortName="Basel III" jurisdiction="Global" status="enforcing" desc={de ? "Bankenregulierung: Eigenkapital, Stresstests." : "Banking regulation: capital adequacy, stress testing."} />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 8: Scoring & Confidence
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="08"
          title={de ? "Scoring & Konfidenz-Berechnung" : "Scoring & Confidence Calculation"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Das System berechnet Konfidenz-Scores auf zwei unabhaengigen Pfaden und kombiniert sie zu einem Blended Score. Quellcode: scoring.ts, intelligence-engine.ts, validation.ts"
              : "The system computes confidence scores on two independent paths and combines them into a blended score. Source: scoring.ts, intelligence-engine.ts, validation.ts"}
          </p>

          <SubH>{de ? "Quellen-Gewichtungen (scoring.ts)" : "Source Weights (scoring.ts)"}</SubH>
          <MonoBlock>
{`DEFAULT_SOURCE_WEIGHTS:
  google_trends:   1.0    hackernews:    1.0    github:       1.0
  arxiv:           0.7    news:          0.9    reddit:        0.8
  stackoverflow:   0.7    npm_pypi:      0.6    producthunt:   0.5
  wikipedia:       0.4`}
          </MonoBlock>

          <SubH>{de ? "Dimensions-Gewichtungen (scoring.ts)" : "Dimension Weights (scoring.ts)"}</SubH>
          <MonoBlock>
{`DEFAULT_DIMENSION_WEIGHTS:
  relevance:    0.35     (35%)
  confidence:   0.25     (25%)
  impact:       0.25     (25%)
  recency:      0.15     (15%)

TIME_DECAY_LAMBDA = 0.05  (Halbwertszeit ~14 Tage)`}
          </MonoBlock>

          <SubH>{de ? "Synchrone Konfidenz-Formel (intelligence-engine.ts)" : "Synchronous Confidence Formula (intelligence-engine.ts)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Wenn die LLM-API nicht verfuegbar ist, berechnet der synchrone Pfad eine rein evidenzbasierte Konfidenz:"
              : "When the LLM API is unavailable, the synchronous path computes a purely evidence-based confidence:"}
          </p>
          <MonoBlock>
{`trendComponent  = log2(1 + matchedTrends) / log2(1 + 50) * 0.4
sourceComponent = log2(1 + totalSources)  / log2(1 + 30) * 0.25
signalComponent = (1 - 1/(1 + 0.005 * sqrt(totalSignals))) * 0.3

confidence = min(0.98, trendComponent + sourceComponent + signalComponent)

// Saettigungsverhalten:
// ~0.4 bei 50 Trends, ~0.25 bei 30 Quellen, ~0.3 bei ~500 Signalen
// Erreicht ~0.95 nur mit umfassender Datenabdeckung`}
          </MonoBlock>

          <SubH>{de ? "Blended Confidence (VAL-03, validation.ts)" : "Blended Confidence (VAL-03, validation.ts)"}</SubH>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {de
              ? "Der finale Score kombiniert Server-Evidenz (objektiv) mit der LLM-Selbsteinschaetzung (subjektiv):"
              : "The final score combines server evidence (objective) with the LLM self-assessment (subjective):"}
          </p>
          <MonoBlock>
{`// Server-Evidenz-Score (gleiche Formel wie synchroner Pfad):
trendComponent  = log2(1 + matchedTrendCount) / log2(1 + 50) * 0.35
sourceComponent = log2(1 + sourceCount)        / log2(1 + 30) * 0.25
signalComponent = (1 - 1/(1 + 0.005 * sqrt(signalCount)))    * 0.25
refComponent    = hasReferences ? 0.15 : 0
serverScore = min(0.95, sum of all components)

// Blended Confidence:
blended = 0.6 * serverScore + 0.4 * llmConfidence

// Clamping:
result = min(0.98, max(0.05, blended))
// Auf 2 Dezimalstellen gerundet`}
          </MonoBlock>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 9: Output Structure
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="09"
          title={de ? "Ausgabestruktur (vollstaendiges JSON-Schema)" : "Output Structure (Complete JSON Schema)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Die strukturierte JSON-Antwort, die das System nach Validierung und Augmentation an den Client liefert. Alle Felder sind per Zod typsicher geprueft."
              : "The structured JSON response the system delivers to the client after validation and augmentation. All fields are type-checked via Zod."}
          </p>

          <MonoBlock>
{`{
  // ── Kern-Analyse ──────────────────────────────────────────
  "synthesis": string,         // 6-10 Saetze, min 1 char, max 10.000
  "reasoningChains": string[], // Kausale Ketten, max 10 items
  "steepV": {                  // STEEP+V Analyse (nullable)
    "S": string|null,          // Society, max 1000 chars
    "T": string|null,          // Technology
    "E_economy": string|null,  // Economy
    "E_environment": string|null, // Environment
    "P": string|null,          // Politics
    "V": string|null           // Values
  },

  // ── Trend-Matching ────────────────────────────────────────
  "matchedTrendIds": string[], // Verifizierte IDs, max 40
  "matchedTrends": [{          // Augmentiert: Details pro Trend
    "id", "name", "category", "tags", "relevance",
    "confidence", "impact", "velocity", "ring", "signalCount"
  }],
  "matchedEdges": [{           // Augmentiert: Kausale Kanten
    "from", "to", "type", "strength", "description"
  }],

  // ── Erkenntnisse ──────────────────────────────────────────
  "keyInsights": string[],     // 3-5 Kern-Erkenntnisse, max 10
  "regulatoryContext": string[], // Regulatorischer Kontext
  "causalAnalysis": string[],  // Ursache-Wirkung

  // ── Szenarien ─────────────────────────────────────────────
  "scenarios": [{
    "type": "optimistic"|"baseline"|"pessimistic",
    "name": string,            // max 200, max 5 Woerter
    "description": string,     // max 2000, mind. 2 Saetze
    "probability": number,     // 0-1, Summe ~1.0
    "timeframe": string,       // Konkreter Zeitraum
    "keyDrivers": string[]     // max 10 Treiber
  }],  // IMMER genau 3

  // ── Strategische Einordnung ───────────────────────────────
  "interpretation": string|null,     // max 3000
  "decisionFramework": string|null,  // 3-5 Punkte
  "newsContext": string|null,        // max 3000

  // ── Quellen & Evidenz ─────────────────────────────────────
  "references": [{
    "title": string,           // max 500
    "url": string,             // max 2000, http/https only
    "relevance": string        // Warum relevant
  }],  // min 2, max 20

  // ── Live-Signale ──────────────────────────────────────────
  "usedSignals": [{            // Augmentiert: verwendete Signale
    "source", "title", "url", "strength", "date"
  }],

  // ── Folgefragen ───────────────────────────────────────────
  "followUpQuestions": string[], // max 10, je max 500 chars

  // ── Balanced Scorecard (optional) ─────────────────────────
  "balancedScorecard": {
    "perspectives": [{         // 3-6 themenspezifische Dimensionen
      "id": string,
      "label": string,         // max 3 Woerter
      "score": number,         // 0-1
      "trend": "rising"|"stable"|"declining"|"uncertain",
      "summary": string,       // max 1000
      "keyFactors": string[],  // max 10
      "connectedTrendIds": string[], // max 20
      "impacts": { [perspId]: number } // -1 bis +1
    }],
    "overallReadiness": number, // 0-1
    "criticalTension": string   // max 500
  } | null,

  // ── Konfidenz ─────────────────────────────────────────────
  "confidence": number,        // 0.05-0.98, blended

  // ── Meta (augmentiert) ────────────────────────────────────
  "_repaired": boolean,        // true wenn JSON repariert wurde
  "_dataQualityWarnings": string[], // Frontend-Hinweise
  "_validationWarnings": string[]   // Server-Log-Details
}`}
          </MonoBlock>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 10: Analyse-Pipeline (Schritt fuer Schritt)
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="10"
          title={de ? "Analyse-Pipeline (vollstaendiger Ablauf)" : "Analysis Pipeline (Complete Flow)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Der vollstaendige Ablauf von der Nutzereingabe bis zur validierten Antwort (route.ts):"
              : "The complete flow from user input to validated answer (route.ts):"}
          </p>

          <PipelineStep
            num={1}
            text={de ? "Authentifizierung" : "Authentication"}
            detail={de
              ? "requireAuth() -- Middleware + Route-Level (Defense-in-Depth)"
              : "requireAuth() -- middleware + route-level (defense-in-depth)"}
          />
          <PipelineStep
            num={2}
            text={de ? "Rate Limiting" : "Rate Limiting"}
            detail={de
              ? "100 Requests/IP/Stunde, In-Memory Sliding Window"
              : "100 requests/IP/hour, in-memory sliding window"}
          />
          <PipelineStep
            num={3}
            text={de ? "Input-Validierung & Sanitisierung" : "Input Validation & Sanitization"}
            detail={de
              ? "Max 2.000 Zeichen, 9 Injection-Patterns, XML-Tags, contextProfile (SEC-08)"
              : "Max 2,000 chars, 9 injection patterns, XML tags, contextProfile (SEC-08)"}
          />
          <PipelineStep
            num={4}
            text={de ? "Trend-Laden aus SQLite" : "Load Trends from SQLite"}
            detail={de
              ? "trends-Tabelle, Fallback auf mega-trends.ts wenn DB nicht verfuegbar"
              : "trends table, fallback to mega-trends.ts if DB unavailable"}
          />
          <PipelineStep
            num={5}
            text={de ? "Signal-Freshness-Check" : "Signal Freshness Check"}
            detail={de
              ? "Wenn neueste Signale > 6 Stunden alt -> Pipeline auto-refresh (fire-and-forget)"
              : "If newest signals > 6 hours old -> pipeline auto-refresh (fire-and-forget)"}
          />
          <PipelineStep
            num={6}
            text={de ? "Signal-Retrieval (RAG)" : "Signal Retrieval (RAG)"}
            detail={de
              ? "getRelevantSignals(query, 12) -- Keyword-Matching, Cross-Language Aliases, Score >= 2"
              : "getRelevantSignals(query, 12) -- keyword matching, cross-language aliases, score >= 2"}
          />
          <PipelineStep
            num={7}
            text={de ? "System-Prompt aufbauen" : "Build System Prompt"}
            detail={de
              ? "buildSystemPrompt() -- 40 Trends + 15 Regulierungen + 102 Kanten + Live-Signale + STEEP+V + PFLICHTEN + JSON-Schema"
              : "buildSystemPrompt() -- 40 trends + 15 regulations + 102 edges + live signals + STEEP+V + PFLICHTEN + JSON schema"}
          />
          <PipelineStep
            num={8}
            text={de ? "previousContext aufbereiten (SEC-10)" : "Prepare previousContext (SEC-10)"}
            detail={de
              ? "Wenn Folge-Query: Synthesis auf 6.000 Zeichen begrenzen, sanitisieren, als Assistant-Message"
              : "If follow-up query: truncate synthesis to 6,000 chars, sanitize, inject as assistant message"}
          />
          <PipelineStep
            num={9}
            text={de ? "LLM-Streaming via Anthropic API" : "LLM Streaming via Anthropic API"}
            detail={de
              ? "claude-sonnet-4-6, max_tokens: 12.000, SSE-Streaming, Retry bis 3x bei 429/529"
              : "claude-sonnet-4-6, max_tokens: 12,000, SSE streaming, retry up to 3x on 429/529"}
          />
          <PipelineStep
            num={10}
            text={de ? "Synthese-Extraktion waehrend Streaming" : "Synthesis Extraction During Streaming"}
            detail={de
              ? "Progressive JSON-Parsing, Delta-Extraktion fuer Live-Anzeige"
              : "Progressive JSON parsing, delta extraction for live display"}
          />
          <PipelineStep
            num={11}
            text={de ? "JSON-Extraktion (ggf. Reparatur)" : "JSON Extraction (with repair if needed)"}
            detail={de
              ? "extractJSON() -- Markdown-Fences entfernen, truncated JSON reparieren"
              : "extractJSON() -- strip markdown fences, repair truncated JSON"}
          />
          <PipelineStep
            num={12}
            text={de ? "Zod-Validierung (VAL-01)" : "Zod Validation (VAL-01)"}
            detail={de
              ? "Alle Felder typsicher pruefen, bei Fehler: Partial-Extraction mit synthesis"
              : "Type-check all fields, on error: partial extraction with synthesis"}
          />
          <PipelineStep
            num={13}
            text={de ? "matchedTrendIds-Verifikation (VAL-02)" : "matchedTrendIds Verification (VAL-02)"}
            detail={de
              ? "Halluzinierte IDs entfernen und loggen"
              : "Remove and log hallucinated IDs"}
          />
          <PipelineStep
            num={14}
            text={de ? "Szenario-Normalisierung" : "Scenario Normalization"}
            detail={de
              ? "Nulls -> Defaults, Summe 0.8-1.1 akzeptabel, sonst normalisieren"
              : "Nulls -> defaults, sum 0.8-1.1 acceptable, otherwise normalize"}
          />
          <PipelineStep
            num={15}
            text={de ? "Blended Confidence (VAL-03)" : "Blended Confidence (VAL-03)"}
            detail="0.6 * serverScore + 0.4 * llmConfidence, clamped [0.05, 0.98]"
          />
          <PipelineStep
            num={16}
            text={de ? "Augmentation" : "Augmentation"}
            detail={de
              ? "matchedTrends-Details, kausale Kanten zwischen Matched Trends, Signal-Metadaten"
              : "matchedTrends details, causal edges between matched trends, signal metadata"}
          />
          <PipelineStep
            num={17}
            text={de ? "Ergebnis an Client streamen" : "Stream Result to Client"}
            detail={de
              ? "SSE: { type: 'delta', text } waehrend Streaming, { type: 'complete', result } am Ende"
              : "SSE: { type: 'delta', text } during streaming, { type: 'complete', result } at end"}
          />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 11: Known Limitations
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="11"
          title={de ? "Bekannte Einschraenkungen" : "Known Limitations"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Transparenz ueber die Grenzen des Systems (basierend auf Code-Review):"
              : "Transparency about the system's boundaries (based on code review):"}
          </p>

          {[
            {
              de: "Signal-Retrieval ist keyword-basiert (kein semantisches/Embedding-basiertes Retrieval). Synonyme werden nur ueber die 9 Alias-Gruppen abgedeckt.",
              en: "Signal retrieval is keyword-based (no semantic/embedding-based retrieval). Synonyms are only covered via the 9 alias groups.",
            },
            {
              de: "Signale sind Metadaten (Titel + max 200 Zeichen Content-Snippet), keine vollstaendigen Artikel. Das LLM erhaelt nur Schlagzeilen und Kurzauszuege.",
              en: "Signals are metadata (title + max 200-char content snippet), not full articles. The LLM receives only headlines and short excerpts.",
            },
            {
              de: "Confidence-Scores sind logarithmisch skalierte Approximationen (nicht statistische Konfidenzintervalle). Max-Wert ist auf 0.98 geclampt.",
              en: "Confidence scores are logarithmically scaled approximations (not statistical confidence intervals). Max value is clamped at 0.98.",
            },
            {
              de: "Szenarien sind analytische Denkrahmen, keine Vorhersagen. Wahrscheinlichkeiten sind LLM-Einschaetzungen, kalibriert durch den Server-Score.",
              en: "Scenarios are analytical thinking frames, not predictions. Probabilities are LLM estimates, calibrated by the server score.",
            },
            {
              de: "Referenzen und URLs koennen trotz Format-Validierung (http/https) LLM-fabriziert sein. URL-Existenz wird nicht geprueft.",
              en: "References and URLs may be LLM-fabricated despite format validation (http/https). URL existence is not verified.",
            },
            {
              de: "Staerkste Abdeckung: Technologie, Wirtschaft, Klima, Geopolitik, EU-Politik (aligned mit Quellen und Connectors).",
              en: "Strongest coverage: Technology, Economy, Climate, Geopolitics, EU Policy (aligned with sources and connectors).",
            },
            {
              de: "Schwaechste Abdeckung: Kultur, Sport, Unterhaltung, lokale/regionale Themen (wenige thematische Connectors).",
              en: "Weakest coverage: Culture, Sports, Entertainment, local/regional topics (few thematic connectors).",
            },
            {
              de: "Einzelnes LLM (Claude claude-sonnet-4-6) -- keine modelluebergreifende Verifikation oder Ensemble-Methode.",
              en: "Single LLM (Claude claude-sonnet-4-6) -- no cross-model verification or ensemble method.",
            },
            {
              de: "Rate Limiting ist In-Memory (nicht persistent). Resets bei Server-Neustart. Keine IP-uebergreifende Aggregation.",
              en: "Rate limiting is in-memory (not persistent). Resets on server restart. No cross-IP aggregation.",
            },
            {
              de: "Der System-Prompt enthaelt nur die Top 40 Trends (sortiert nach Relevanz). Trends ausserhalb der Top 40 werden dem LLM nicht gezeigt.",
              en: "The system prompt contains only the top 40 trends (sorted by relevance). Trends outside the top 40 are not shown to the LLM.",
            },
            {
              de: "Kausale Kanten (102) sind statisch kodiert. Analytiker koennen sie noch nicht ueber ein UI hinzufuegen/bearbeiten.",
              en: "Causal edges (102) are statically coded. Analysts cannot add/edit them via a UI yet.",
            },
            {
              de: "previousContext-Fenster: nur die letzte Frage/Antwort wird als Kontext weitergegeben, kein Multi-Turn-Gedaechtnis.",
              en: "previousContext window: only the last question/answer is passed as context, no multi-turn memory.",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  marginTop: 3,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-text-muted, #6B6B6B)",
                }}
              />
              <span>{de ? item.de : item.en}</span>
            </div>
          ))}

          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 8,
              background: "rgba(228,255,151,0.2)",
              border: "1px solid rgba(228,255,151,0.4)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong>
              {de ? "Design-Prinzip:" : "Design principle:"}
            </strong>{" "}
            {de
              ? "Transparenz ueber Unsicherheit ist wertvoller als falsche Praezision. Das System zeigt explizit an, worauf es sich stuetzt und wo die Grenzen liegen. Jede Aussage ist mit Provenienz-Tags ([SIGNAL], [TREND], [LLM-Einschaetzung]) markiert."
              : "Transparency about uncertainty is more valuable than false precision. The system explicitly shows what it relies on and where the boundaries are. Every statement is marked with provenance tags ([SIGNAL], [TREND], [LLM-Einschaetzung])."}
          </div>
        </CollapsibleSection>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid var(--color-border, #E8E8E8)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--color-text-muted, #6B6B6B)",
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          }}
        >
          <span>
            {de
              ? "Strategic Intelligence System -- Technische Systemdokumentation"
              : "Strategic Intelligence System -- Technical System Documentation"}
          </span>
          <span>
            {de
              ? "Alle Angaben aus dem Quellcode extrahiert"
              : "All claims extracted from source code"}
          </span>
        </div>
      </main>
    </div>
  );
}
