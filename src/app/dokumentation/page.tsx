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
function ConnectorChip({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 8px",
        borderRadius: 6,
        background: "rgba(228,255,151,0.2)",
        border: "1px solid var(--color-border, #E8E8E8)",
        color: "var(--color-text-heading, #0A0A0A)",
        whiteSpace: "nowrap" as const,
      }}
    >
      {name}
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
  connectors: string[];
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
          <ConnectorChip key={c} name={c} />
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
}: {
  num: number;
  text: string;
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
      <span style={{ fontSize: 13, lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   JSON field display
   ──────────────────────────────────────────────────────────────── */
function JsonField({
  name,
  desc,
  optional,
}: {
  name: string;
  desc: string;
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
      }}
    >
      <Code>{name}</Code>
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
            {de ? "Systemdokumentation" : "System Documentation"}
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
              ? "Vollstaendige technische Dokumentation des Strategic Intelligence System. Klicke auf eine Sektion, um sie aufzuklappen."
              : "Complete technical documentation of the Strategic Intelligence System. Click a section to expand it."}
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
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 1: System Overview
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="01"
          title={de ? "Systemueberblick" : "System Overview"}
          defaultOpen
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Das SIS (Strategic Intelligence System) ist ein Denk-Instrument auf Think-Tank-Niveau mit explizitem EU-Fokus. Es verbindet 57 Live-Datenquellen mit einem kuratierten Wissensgraphen und einem LLM-Analysekern zu einem System, das strategische Fragen strukturiert und belegt beantwortet."
              : "SIS (Strategic Intelligence System) is a thinking instrument at think-tank level with an explicit EU focus. It connects 57 live data sources with a curated knowledge graph and an LLM analysis core into a system that answers strategic questions in a structured and evidence-based way."}
          </p>

          <div
            style={{
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--color-text-muted, #6B6B6B)",
              marginBottom: 8,
            }}
          >
            {de ? "RAG-Architektur" : "RAG Architecture"}
          </div>
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
            }}
          >
            57 Connectors {"\u2192"} SQLite {"\u2192"} Signal Retrieval{" "}
            {"\u2192"} System Prompt {"\u2192"} Claude API {"\u2192"} Structured
            JSON {"\u2192"} Validated Output
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {[
              {
                label: "LLM",
                value: "Claude claude-sonnet-4-6, max 12.000 tokens",
              },
              {
                label: de ? "Datenbank" : "Database",
                value: "SQLite + better-sqlite3, WAL mode",
              },
              { label: "Frontend", value: "Next.js 15, React 19" },
              {
                label: de ? "Datenquellen" : "Data sources",
                value: de
                  ? "57 Live-Connectors, 12 Kategorien"
                  : "57 live connectors, 12 categories",
              },
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
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Alle 57 Connectors, gruppiert nach Kategorie. Jeder Connector liefert Metadaten (Titel, Snippet, Datum, Quelle) in die SQLite-Datenbank."
              : "All 57 connectors, grouped by category. Each connector delivers metadata (title, snippet, date, source) into the SQLite database."}
          </p>

          <ConnectorCategory
            label="Tech & Developer (10)"
            connectors={[
              "hackernews",
              "github",
              "reddit",
              "arxiv",
              "stackoverflow",
              "npm-pypi",
              "producthunt",
              "wikipedia",
              "docker-hub",
              "steamspy",
            ]}
          />
          <ConnectorCategory
            label="Search & Sentiment (3)"
            connectors={["google-trends", "sentiment", "google-ngram"]}
          />
          <ConnectorCategory
            label="News & Media (6)"
            connectors={[
              "news",
              "guardian",
              "nyt",
              "newsdata",
              "media-cloud",
              "gdelt",
            ]}
          />
          <ConnectorCategory
            label="Research & Academia (3)"
            connectors={["openalex", "crossref", "semantic-scholar"]}
          />
          <ConnectorCategory
            label={
              de ? "Offizielle Statistiken (8)" : "Official Statistics (8)"
            }
            connectors={[
              "eurostat",
              "oecd",
              "fred",
              "owid",
              "destatis",
              "worldbank",
              "bls",
              "imf",
            ]}
          />
          <ConnectorCategory
            label={de ? "Prognosemaerkte (4)" : "Prediction Markets (4)"}
            connectors={["polymarket", "manifold", "metaculus", "kalshi"]}
          />
          <ConnectorCategory
            label={de ? "Geopolitik & Konflikte (4)" : "Geopolitics & Conflict (4)"}
            connectors={["acled", "ucdp", "vdem", "unhcr"]}
          />
          <ConnectorCategory
            label={de ? "Gesundheit & Wissenschaft (5)" : "Health & Science (5)"}
            connectors={[
              "who-gho",
              "ilo",
              "clinicaltrials",
              "openfda",
              "nextstrain",
            ]}
          />
          <ConnectorCategory
            label={de ? "Klima & Umwelt (3)" : "Climate & Environment (3)"}
            connectors={["nasa-eonet", "open-meteo", "usgs-earthquake"]}
          />
          <ConnectorCategory
            label={de ? "Finanzen (4)" : "Financial (4)"}
            connectors={[
              "finnhub",
              "open-exchange",
              "coingecko",
              "defi-llama",
            ]}
          />
          <ConnectorCategory
            label="Social (2)"
            connectors={["bluesky", "mastodon-api"]}
          />
          <ConnectorCategory
            label={de ? "Weitere (5)" : "Other (5)"}
            connectors={[
              "worldmonitor",
              "patentsview",
              "un-data",
              "un-sdg",
            ]}
          />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 3: Analysis Pipeline
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="03"
          title={de ? "Analyse-Pipeline" : "Analysis Pipeline"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Der vollstaendige Ablauf von der Nutzereingabe bis zur validierten Antwort:"
              : "The complete flow from user input to validated answer:"}
          </p>

          <PipelineStep
            num={1}
            text={
              de
                ? "Nutzer gibt eine Abfrage auf der Canvas-Seite ein"
                : "User enters a query on the Canvas page"
            }
          />
          <PipelineStep
            num={2}
            text={
              de
                ? "Query wird sanitisiert (Injection-Patterns, XML-Tags, Laengenlimits)"
                : "Query is sanitized (injection patterns, XML tags, length limits)"
            }
          />
          <PipelineStep
            num={3}
            text={
              de
                ? "Relevante Signale werden aus SQLite abgerufen (Keyword-Matching mit sprachuebergreifenden Aliases DE<>EN, Minimum-Relevanz-Score >= 2)"
                : "Relevant signals are retrieved from SQLite (keyword matching with cross-language aliases DE<>EN, minimum relevance score >= 2)"
            }
          />
          <PipelineStep
            num={4}
            text={
              de
                ? "System-Prompt wird aufgebaut mit: 40 Trend-Summaries, 15 Regulierungen, 102 kausale Kanten, Live-Signale"
                : "System prompt is built with: 40 trend summaries, 15 regulations, 102 causal edges, live signals"
            }
          />
          <PipelineStep
            num={5}
            text={
              de
                ? "LLM generiert strukturierte JSON-Antwort"
                : "LLM generates structured JSON response"
            }
          />
          <PipelineStep
            num={6}
            text={
              de
                ? "Antwort wird mit Zod-Schema validiert (alle Felder typsicher geprueft)"
                : "Response is validated with Zod schema (all fields type-checked)"
            }
          />
          <PipelineStep
            num={7}
            text={
              de
                ? "matchedTrendIds werden gegen echte Trend-Datenbank verifiziert"
                : "matchedTrendIds are verified against real trend database"
            }
          />
          <PipelineStep
            num={8}
            text={
              de
                ? "Szenario-Wahrscheinlichkeiten werden normalisiert (Summe muss ~100% ergeben)"
                : "Scenario probabilities are normalized (sum must be ~100%)"
            }
          />
          <PipelineStep
            num={9}
            text={
              de
                ? "Confidence-Score wird berechnet: 60% Server-Evidenz + 40% LLM-Selbsteinschaetzung"
                : "Confidence score is computed: 60% server evidence + 40% LLM self-assessment"
            }
          />
          <PipelineStep
            num={10}
            text={
              de
                ? "Referenzen werden URL-validiert (Formatpruefung)"
                : "References are URL-validated (format check)"
            }
          />
          <PipelineStep
            num={11}
            text={
              de
                ? "Ergebnis wird per SSE (Server-Sent Events) an den Client gestreamt"
                : "Result is streamed to client via SSE (Server-Sent Events)"
            }
          />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 4: System Prompt
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="04"
          title={de ? "System-Prompt-Struktur" : "System Prompt Structure"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Der System-Prompt, den das LLM erhaelt, ist aus mehreren Bausteinen zusammengesetzt:"
              : "The system prompt received by the LLM is composed of several building blocks:"}
          </p>

          {[
            {
              title: de
                ? "STEEP+V Analytisches Framework"
                : "STEEP+V Analytical Framework",
              desc: de
                ? "6 Dimensionen: Society (S), Technology (T), Economy (E), Environment (E), Politics (P), Values (V). Jede Analyse muss alle Dimensionen adressieren."
                : "6 dimensions: Society (S), Technology (T), Economy (E), Environment (E), Politics (P), Values (V). Every analysis must address all dimensions.",
            },
            {
              title: de
                ? "EU JRC 14 Megatrends Referenzrahmen"
                : "EU JRC 14 Megatrends Reference Frame",
              desc: de
                ? "Die 14 Megatrends der Europaeischen Kommission als Orientierungsraster fuer die Analyse."
                : "The 14 megatrends of the European Commission as orientation frame for the analysis.",
            },
            {
              title: de
                ? "7 Absolute Anforderungen (PFLICHTEN)"
                : "7 Absolute Requirements (PFLICHTEN)",
              desc: de
                ? "Verbindliche Regeln, die das LLM in jeder Antwort einhalten muss: Quellenangaben, Provenienz, Szenarienformat, etc."
                : "Mandatory rules the LLM must follow in every response: citations, provenance, scenario format, etc.",
            },
            {
              title: de
                ? "Provenienz-Tagging-Regeln"
                : "Provenance Tagging Rules",
              desc: de
                ? "Jede Aussage muss als [SIGNAL], [TREND] oder [LLM-Einschaetzung] gekennzeichnet sein. Keine unbelegten Behauptungen."
                : "Every statement must be tagged as [SIGNAL], [TREND] or [LLM-Einschaetzung]. No unattributed claims.",
            },
            {
              title: de
                ? "Szenario-Wahrscheinlichkeits-Instruktionen"
                : "Scenario Probability Instructions",
              desc: de
                ? "Drei Szenarien (optimistisch, Baseline, pessimistisch) mit Wahrscheinlichkeiten, die sich zu ~100% summieren muessen."
                : "Three scenarios (optimistic, baseline, pessimistic) with probabilities that must sum to ~100%.",
            },
            {
              title: de
                ? "Trend-Matching-Instruktionen"
                : "Trend-Matching Instructions",
              desc: de
                ? "Das LLM muss IDs aus der echten Trend-Datenbank zuordnen. Erfundene IDs werden serverseitig herausgefiltert."
                : "The LLM must match IDs from the real trend database. Fabricated IDs are filtered out server-side.",
            },
            {
              title: de ? "Qualitaetsstandard" : "Quality Standard",
              desc: de
                ? "Think-Tank-Niveau: substanziell, belegt, nuanciert. Keine Allgemeinplaetze, keine Buzzword-Listen."
                : "Think-tank level: substantive, evidenced, nuanced. No platitudes, no buzzword lists.",
            },
            {
              title: de ? "JSON-Antwortstruktur" : "JSON Response Structure",
              desc: de
                ? "Exakte Feldnamen und Typen, die das LLM liefern muss. Wird per Zod-Schema serverseitig validiert."
                : "Exact field names and types the LLM must deliver. Validated server-side via Zod schema.",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--color-border, #E8E8E8)",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 3,
                  color: "var(--color-text-heading, #0A0A0A)",
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted, #6B6B6B)",
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 5: Analysis Frameworks
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="05"
          title={de ? "Analyse-Frameworks (6)" : "Analysis Frameworks (6)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Neben der Standard-Analyse koennen spezialisierte Frameworks gewaehlt werden, die den System-Prompt und die Ausgabestruktur anpassen:"
              : "Beyond the default analysis, specialized frameworks can be selected that adjust the system prompt and output structure:"}
          </p>

          {[
            {
              num: "1",
              title: de
                ? "Marktanalyse (SWOT + PESTEL)"
                : "Market Analysis (SWOT + PESTEL)",
              desc: de
                ? "Klassische Marktanalyse mit Staerken/Schwaechen/Chancen/Risiken und PESTEL-Umfeldanalyse. Fuer Produkt- und Wettbewerbsfragen."
                : "Classic market analysis with Strengths/Weaknesses/Opportunities/Threats and PESTEL environmental analysis. For product and competitive questions.",
            },
            {
              num: "2",
              title: de
                ? "War-Gaming (RAND/Shell-Methodik)"
                : "War-Gaming (RAND/Shell Methodology)",
              desc: de
                ? "Strategische Simulation mit Akteursanalyse, Zuegen und Gegenzuegen. Basiert auf RAND Corporation und Shell Szenario-Methodik."
                : "Strategic simulation with actor analysis, moves and counter-moves. Based on RAND Corporation and Shell scenario methodology.",
            },
            {
              num: "3",
              title: de
                ? "Pre-Mortem (Gary Klein)"
                : "Pre-Mortem (Gary Klein)",
              desc: de
                ? "Proaktive Risikoanalyse: 'Stell dir vor, das Projekt ist gescheitert. Warum?' Identifiziert blinde Flecken und versteckte Risiken bevor sie eintreten."
                : "Proactive risk analysis: 'Imagine the project has failed. Why?' Identifies blind spots and hidden risks before they materialize.",
            },
            {
              num: "4",
              title: de
                ? "Post-Mortem (5-Whys)"
                : "Post-Mortem (5-Whys)",
              desc: de
                ? "Ursachenanalyse: Fuenffaches 'Warum?' bis zur Wurzelursache. Fuer die Aufarbeitung von Ereignissen und Fehlschlaegen."
                : "Root cause analysis: five times 'Why?' until the root cause. For analyzing events and failures.",
            },
            {
              num: "5",
              title: de
                ? "Trend Deep-Dive (STEEP+V)"
                : "Trend Deep-Dive (STEEP+V)",
              desc: de
                ? "Systemische Trendanalyse entlang aller 6 STEEP+V-Dimensionen mit Wechselwirkungen, Kaskadeneffekten und Zeitachse."
                : "Systemic trend analysis along all 6 STEEP+V dimensions with interactions, cascade effects and timeline.",
            },
            {
              num: "6",
              title: de
                ? "Stakeholder (Mitchell Salience Model)"
                : "Stakeholder (Mitchell Salience Model)",
              desc: de
                ? "Einfluss-Mapping nach Power/Legitimacy/Urgency. Identifiziert dominante, abhaengige und fordernde Stakeholder."
                : "Influence mapping by Power/Legitimacy/Urgency. Identifies dominant, dependent and demanding stakeholders.",
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
                  fontFamily:
                    "var(--volt-font-mono, 'JetBrains Mono', monospace)",
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
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                  {fw.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-muted, #6B6B6B)",
                  }}
                >
                  {fw.desc}
                </div>
              </div>
            </div>
          ))}
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 6: Anti-Hallucination Measures
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="06"
          title={
            de
              ? "Anti-Halluzinations-Massnahmen"
              : "Anti-Hallucination Measures"
          }
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Das System setzt auf mehrere Schichten der Validierung, um LLM-Halluzinationen zu erkennen und zu korrigieren:"
              : "The system employs multiple layers of validation to detect and correct LLM hallucinations:"}
          </p>

          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 8,
              color: "var(--color-text-heading, #0A0A0A)",
            }}
          >
            {de ? "Server-seitige Validierung" : "Server-side Validation"}
          </div>
          <ul
            style={{
              margin: "0 0 20px",
              paddingLeft: 20,
              lineHeight: 1.9,
              fontSize: 13,
            }}
          >
            <li>
              {de
                ? "Zod-Schema-Validierung auf allen LLM-Ausgaben"
                : "Zod schema validation on all LLM outputs"}
            </li>
            <li>
              {de
                ? "matchedTrendIds werden gegen die echte Datenbank abgeglichen"
                : "matchedTrendIds cross-referenced with real database"}
            </li>
            <li>
              {de
                ? "URL-Format-Validierung fuer Referenzen"
                : "URL format validation for references"}
            </li>
            <li>
              {de
                ? "Szenario-Wahrscheinlichkeiten werden normalisiert (Summe ~100%)"
                : "Scenario probability normalization (sum ~100%)"}
            </li>
            <li>
              {de
                ? "Evidenz-basierte Confidence-Berechnung (60% Server + 40% LLM)"
                : "Evidence-based confidence scoring (60% server + 40% LLM)"}
            </li>
            <li>
              {de
                ? "previousContext-Sanitisierung"
                : "previousContext sanitization"}
            </li>
            <li>
              {de
                ? "contextProfile Injection Prevention"
                : "contextProfile injection prevention"}
            </li>
            <li>
              {de
                ? "Signal-Text-Sanitisierung (SEC-07)"
                : "Signal text sanitization (SEC-07)"}
            </li>
            <li>
              {de
                ? 'Provenienz-Tagging: Fakten muessen mit Quelltyp markiert sein ([SIGNAL], [TREND], [LLM-Einschaetzung])'
                : "Provenance tagging: facts must be labeled with source type ([SIGNAL], [TREND], [LLM-Einschaetzung])"}
            </li>
          </ul>

          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 8,
              color: "var(--color-text-heading, #0A0A0A)",
            }}
          >
            {de ? "Frontend-Transparenz" : "Frontend Transparency"}
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              lineHeight: 1.9,
              fontSize: 13,
            }}
          >
            <li>
              {de
                ? '"KI-vorgeschlagen, nicht redaktionell verifiziert" bei Referenzen'
                : '"AI-suggested, not editorially verified" on references'}
            </li>
            <li>
              {de
                ? '"Repariert" und "Datenhinweis" Badges bei Qualitaetsproblemen'
                : '"Repaired" and "Data Note" badges on quality issues'}
            </li>
          </ul>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 7: Knowledge Base
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="07"
          title={de ? "Wissensbasis" : "Knowledge Base"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Die statische Wissensbasis, die in den System-Prompt eingespeist wird:"
              : "The static knowledge base fed into the system prompt:"}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: de ? "Kuratierte Trends" : "Curated Trends",
                value: "40",
                desc: de
                  ? "Mega- und Makrotrends mit je 3-5 Satz-Beschreibungen"
                  : "Mega and macro trends with 3-5 sentence descriptions each",
              },
              {
                label: de ? "Kausale Kanten" : "Causal Edges",
                value: "102",
                desc: de
                  ? "Handkuratierte Ursache-Wirkungs-Beziehungen"
                  : "Hand-curated cause-effect relationships",
              },
              {
                label: de
                  ? "Regulatorische Frameworks"
                  : "Regulatory Frameworks",
                value: "15",
                desc: de
                  ? "EU AI Act, CSRD, NIS-2, DORA, u.a."
                  : "EU AI Act, CSRD, NIS-2, DORA, etc.",
              },
              {
                label: de
                  ? "Sprachuebergreifende Aliases"
                  : "Cross-Language Aliases",
                value: de ? "9 Termingruppen" : "9 term groups",
                desc: de
                  ? "DE<>EN Alias-System fuer praezises Signal-Retrieval"
                  : "DE<>EN alias system for precise signal retrieval",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border, #E8E8E8)",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    fontFamily:
                      "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                    color: "var(--color-text-heading, #0A0A0A)",
                    marginBottom: 2,
                  }}
                >
                  {item.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--color-text-heading, #0A0A0A)",
                    marginBottom: 4,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted, #6B6B6B)",
                  }}
                >
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 8: Output Structure
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="08"
          title={de ? "Ausgabestruktur (JSON)" : "Output Structure (JSON)"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Die strukturierte JSON-Antwort, die das System produziert und per Zod validiert:"
              : "The structured JSON response the system produces and validates via Zod:"}
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.03)",
              border: "1px solid var(--color-border, #E8E8E8)",
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 12,
              lineHeight: 1.9,
            }}
          >
            <JsonField
              name="synthesis"
              desc={de ? "6-10 Saetze Kernanalyse" : "6-10 sentences core analysis"}
            />
            <JsonField
              name="reasoningChains"
              desc={de ? "Kausale Logikketten" : "Causal logic chains"}
            />
            <JsonField
              name="steepV"
              desc={de ? "6 Dimensionen (S, T, E, E, P, V)" : "6 dimensions (S, T, E, E, P, V)"}
            />
            <JsonField
              name="matchedTrendIds"
              desc={de ? "IDs aus der Trend-Datenbank" : "IDs from the trend database"}
            />
            <JsonField
              name="keyInsights"
              desc={de ? "3-5 Kern-Erkenntnisse" : "3-5 key insights"}
            />
            <JsonField
              name="regulatoryContext"
              desc={
                de
                  ? "Relevante Regulierungen"
                  : "Relevant regulations"
              }
            />
            <JsonField
              name="causalAnalysis"
              desc={
                de
                  ? "Ursache-Wirkungs-Analyse"
                  : "Cause-effect analysis"
              }
            />
            <JsonField
              name="scenarios"
              desc={
                de
                  ? "3 Szenarien: optimistisch, Baseline, pessimistisch"
                  : "3 scenarios: optimistic, baseline, pessimistic"
              }
            />
            <JsonField
              name="interpretation"
              desc={de ? "Analytische Einordnung" : "Analytical interpretation"}
            />
            <JsonField
              name="references"
              desc={de ? "Quellenverweise mit URLs" : "Source references with URLs"}
            />
            <JsonField
              name="followUpQuestions"
              desc={de ? "Vorgeschlagene Folgefragen" : "Suggested follow-up questions"}
            />
            <JsonField
              name="newsContext"
              desc={de ? "Aktuelle Nachrichtenlage" : "Current news context"}
            />
            <JsonField
              name="decisionFramework"
              desc={de ? "Handlungsempfehlung" : "Action recommendation"}
            />
            <JsonField
              name="balancedScorecard"
              desc={
                de
                  ? "Fuer strategische Fragen"
                  : "For strategic questions"
              }
              optional
            />
            <JsonField
              name="confidence"
              desc={de ? "0-1 Konfidenz-Score" : "0-1 confidence score"}
            />
          </div>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════
            SECTION 9: Known Limitations
            ══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          tag="09"
          title={de ? "Bekannte Einschraenkungen" : "Known Limitations"}
        >
          <p style={{ marginBottom: 16 }}>
            {de
              ? "Transparenz ueber die Grenzen des Systems:"
              : "Transparency about the boundaries of the system:"}
          </p>

          {[
            {
              de: "Signale sind nur Metadaten (Titel + Snippets), keine vollstaendigen Artikel",
              en: "Signals are metadata only (titles + snippets), not full articles",
            },
            {
              de: "Keyword-basiertes Signal-Retrieval (kein semantisches/Embedding-basiertes Retrieval)",
              en: "Keyword-based signal retrieval (not semantic/embedding search)",
            },
            {
              de: "Confidence-Scores sind Approximationen, keine statistischen Masse",
              en: "Confidence scores are approximations, not statistical measures",
            },
            {
              de: "Szenarien sind analytische Denkrahmen, keine Vorhersagen",
              en: "Scenarios are analytical frameworks, not predictions",
            },
            {
              de: "Referenzen koennen trotz URL-Validierung LLM-fabriziert sein",
              en: "References may be LLM-fabricated despite URL validation",
            },
            {
              de: "Staerkste Abdeckung: Technologie, Wirtschaft, Klima, Geopolitik, EU-Politik",
              en: "Coverage strongest in: Tech, Economy, Climate, Geopolitics, EU Policy",
            },
            {
              de: "Schwaechste Abdeckung: Kultur, Sport, Unterhaltung, lokale/regionale Themen",
              en: "Coverage weakest in: Culture, Sports, Entertainment, local/regional topics",
            },
            {
              de: "Einzelnes LLM (Claude) — keine modelluebergreifende Verifikation",
              en: "Single LLM (Claude) -- no cross-model verification",
            },
            {
              de: "Noch keine Nutzer-Feedback-Schleife (geplant)",
              en: "No user feedback loop yet (planned)",
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
              ? "Transparenz ueber Unsicherheit ist wertvoller als falsche Praezision. Das System zeigt explizit an, worauf es sich stuetzt und wo die Grenzen liegen."
              : "Transparency about uncertainty is more valuable than false precision. The system explicitly shows what it relies on and where the boundaries are."}
          </div>
        </CollapsibleSection>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid var(--color-border, #E8E8E8)",
            fontSize: 12,
            color: "var(--color-text-muted, #6B6B6B)",
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          }}
        >
          {de
            ? "Strategic Intelligence System -- Systemdokumentation"
            : "Strategic Intelligence System -- System Documentation"}
        </div>
      </main>
    </div>
  );
}
