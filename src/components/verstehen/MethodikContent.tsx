"use client";

/**
 * MethodikContent — Rich methodology explainer, used by the /verstehen/methodik
 * route. Pure content component: no overlay chrome, no modal wrapper. The
 * parent page provides AppHeader and navigation chrome. This component
 * renders the body only, section by section, with inline visualizations.
 *
 * Purpose: trust building. Users should walk out understanding HOW the SIS
 * turns raw signals into classified trends — without reading a whitepaper.
 *
 * Sections:
 *   01  Was ist das SIS? (Mission + Abgrenzung)
 *   02  Die Daten-Pipeline (4-Stationen-Diagramm)
 *   03  STEEP+V Framework (6-Kategorien-Grid)
 *   04  Trend-Klassifikation (Adopt/Trial/Assess/Hold mit Schwellwerten)
 *   05  Konfidenz-Score (3 gewichtete Faktoren)
 *   06  Kausal-Edges (4 Typen als Mini-Diagramme)
 *   07  Was das SIS NICHT tut (Versprechen)
 */

import { Database, Network, TrendingUp, Filter, Eye, GitBranch, AlertCircle, Layers, Cpu, BarChart3, Map as MapIcon } from "lucide-react";

interface Props {
  de: boolean;
}

export function MethodikContent({ de }: Props) {
  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "var(--volt-text-faint, #AAA)",
          marginBottom: 14,
        }}>
          {de ? "So funktioniert das SIS" : "How the SIS works"}
        </div>
        <h1 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em",
          color: "var(--volt-text, #0A0A0A)", margin: "0 0 16px", lineHeight: 1.1,
        }}>
          {de ? "Methodik" : "Methodology"}
        </h1>
        <p style={{
          fontSize: 16, lineHeight: 1.65,
          color: "var(--volt-text-muted, #6B6B6B)",
          margin: 0, maxWidth: 720,
          fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        }}>
          {de
            ? "Transparenz ist kein Risiko — sie ist unser schärfstes Differenzierungsmerkmal. Dieser Abschnitt erklärt jeden Schritt, den ein Signal durchläuft, bevor es dir im Cockpit als bewerteter Trend erscheint. Nichts ist eine Black-Box."
            : "Transparency is not a risk — it is our sharpest differentiator. This section explains every step a signal takes before it appears in your cockpit as a scored trend. Nothing is a black box."}
        </p>
      </div>

      {/* Section 1 */}
      <Section
        number="01"
        icon={<Eye size={18} />}
        title={de ? "Was ist das SIS?" : "What is the SIS?"}
      >
        <p style={paragraphStyle}>
          {de
            ? "Das Strategic Intelligence System ist kein weiteres Dashboard und keine Nachrichten-App. Es ist ein strategisches Terminal, das kontinuierlich Signale aus offenen Datenquellen aggregiert, in ein kausales Trend-Netzwerk einordnet und natürlichsprachliche Abfragen gegen dieses lebende Weltmodell zulässt."
            : "The Strategic Intelligence System is not just another dashboard or news app. It is a strategic terminal that continuously aggregates signals from open data sources, maps them into a causal trend network, and enables natural-language queries against this living world model."}
        </p>
        <p style={paragraphStyle}>
          {de
            ? "Der Unterschied zu Dashboards, Newslettern und News-Aggregatoren liegt im strukturellen Anspruch: Du sollst nicht informiert werden, sondern strategisch denken können. Die Ergebnisse sind kausale Zusammenhänge und Szenarien, nicht Schlagzeilen."
            : "The difference from dashboards, newsletters, and news aggregators is structural: you should not be informed — you should be able to think strategically. The outputs are causal relationships and scenarios, not headlines."}
        </p>
        <AbgrenzungBox de={de} />
      </Section>

      {/* Section 2 */}
      <Section
        number="02"
        icon={<Database size={18} />}
        title={de ? "Die Daten-Pipeline" : "The Data Pipeline"}
      >
        <p style={paragraphStyle}>
          {de
            ? "Jedes Signal durchläuft vier klar getrennte Stationen. Du kannst an jeder Station anhalten und nachvollziehen, was passiert — keine Station ist versteckt oder proprietär."
            : "Every signal passes through four clearly separated stations. You can pause at any station and trace what happens — no station is hidden or proprietary."}
        </p>
        <PipelineDiagram de={de} />
        <p style={{ ...paragraphStyle, marginTop: 20 }}>
          {de
            ? "Station 1 (Rohsignale) läuft alle 15 Minuten. Station 2 (Klassifikation) ist deterministisch und nutzt feste Regeln plus ein LLM als Fallback. Station 3 (Aggregation) ist pur statistisch — keine KI. Station 4 (Trend-Mapping) kombiniert die aggregierten Signale mit dem vordefinierten Kausal-Graph."
            : "Station 1 (raw signals) runs every 15 minutes. Station 2 (classification) is deterministic and uses fixed rules plus an LLM as fallback. Station 3 (aggregation) is pure statistics — no AI. Station 4 (trend mapping) combines aggregated signals with the predefined causal graph."}
        </p>
      </Section>

      {/* Section 3 */}
      <Section
        number="03"
        icon={<Filter size={18} />}
        title={de ? "STEEP+V — die sechs Dimensionen" : "STEEP+V — the six dimensions"}
      >
        <p style={paragraphStyle}>
          {de
            ? "Jeder Trend wird in eine von sechs STEEP+V-Kategorien eingeordnet. Das Framework stammt ursprünglich aus der strategischen Zukunftsforschung und wird von der EU JRC für die 14 Megatrends der Europäischen Kommission verwendet. Wir haben es übernommen, weil es die breiteste strukturelle Abdeckung bei minimaler Überlappung bietet."
            : "Every trend is categorized into one of six STEEP+V dimensions. The framework originates in strategic futures research and is used by the EU JRC for the 14 Megatrends of the European Commission. We adopted it because it offers the broadest structural coverage with minimal overlap."}
        </p>
        <SteepVGrid de={de} />
      </Section>

      {/* Section 4 */}
      <Section
        number="04"
        icon={<TrendingUp size={18} />}
        title={de ? "Trend-Klassifikation: Adopt · Trial · Assess · Hold" : "Trend Classification: Adopt · Trial · Assess · Hold"}
      >
        <p style={paragraphStyle}>
          {de
            ? "Jeder Trend wird einem von vier Reifegraden zugeordnet, angelehnt an das ThoughtWorks Technology Radar. Die Einstufung basiert auf Signal-Stärke, Quellen-Abdeckung und historischer Entwicklung — nicht auf Meinung. Die Schwellwerte sind fest und dokumentiert."
            : "Each trend is assigned one of four maturity levels, adapted from the ThoughtWorks Technology Radar. Classification is based on signal strength, source coverage, and historical development — not opinion. Thresholds are fixed and documented."}
        </p>
        <RingExplainer de={de} />
      </Section>

      {/* Section 5 */}
      <Section
        number="05"
        icon={<Network size={18} />}
        title={de ? "Konfidenz-Score: Wie sicher ist die Einschätzung?" : "Confidence Score: How certain is the assessment?"}
      >
        <p style={paragraphStyle}>
          {de
            ? "Jede Trend-Einschätzung bekommt einen Konfidenz-Score zwischen 0 und 100 %. Der Score ergibt sich aus drei gleichgewichteten Faktoren. Niedrige Werte sind ein Feature, keine Schwäche — sie zwingen dich, kritisch zu lesen."
            : "Every trend assessment gets a confidence score between 0 and 100%. The score is derived from three equally weighted factors. Low values are a feature, not a weakness — they force you to read critically."}
        </p>
        <ConfidenceBreakdown de={de} />
      </Section>

      {/* Section 6 */}
      <Section
        number="06"
        icon={<GitBranch size={18} />}
        title={de ? "Kausal-Edges: Wie Trends einander beeinflussen" : "Causal Edges: How trends influence each other"}
      >
        <p style={paragraphStyle}>
          {de
            ? "Trends stehen nicht isoliert — sie beeinflussen einander. Das SIS modelliert diese Beziehungen als gerichteten Graphen mit vier Kanten-Typen. Jeder Typ hat eine eindeutige visuelle Kodierung und eine operative Bedeutung."
            : "Trends don't stand in isolation — they influence each other. The SIS models these relationships as a directed graph with four edge types. Each type has a unique visual encoding and an operational meaning."}
        </p>
        <EdgeTypesGrid de={de} />
      </Section>

      {/* Section 7 */}
      <Section
        number="07"
        icon={<AlertCircle size={18} />}
        title={de ? "Was das SIS NICHT tut" : "What the SIS does NOT do"}
        accent="warning"
      >
        <p style={paragraphStyle}>
          {de
            ? "Genauso wichtig wie das, was das SIS tut, ist das, was es bewusst NICHT tut. Diese Liste ist keine Verlegenheits-Klausel — sie ist ein Versprechen."
            : "As important as what the SIS does is what it deliberately does NOT do. This list is not a disclaimer — it's a promise."}
        </p>
        <NotList de={de} />
      </Section>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────

const paragraphStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "var(--volt-text-muted, #4A4A4A)",
  margin: "0 0 20px",
  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
  maxWidth: 760,
};

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  number, icon, title, children, accent,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: "warning";
}) {
  const accentBg = accent === "warning" ? "rgba(232, 64, 42, 0.04)" : "transparent";
  return (
    <section style={{
      marginBottom: 48,
      paddingTop: 32,
      borderTop: "1px solid var(--volt-border, #EEE)",
      background: accentBg,
      borderRadius: accent === "warning" ? "var(--volt-radius-md, 10px)" : 0,
      padding: accent === "warning" ? "28px 28px 32px" : "32px 0 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          color: "var(--volt-text-faint, #AAA)",
        }}>
          {number}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8,
          background: accent === "warning" ? "rgba(232,64,42,0.1)" : "var(--volt-surface, #FAFAFA)",
          color: accent === "warning" ? "#E8402A" : "var(--volt-text, #0A0A0A)",
          border: accent === "warning" ? "1px solid rgba(232,64,42,0.2)" : "1px solid var(--volt-border, #E8E8E8)",
        }}>
          {icon}
        </span>
        <h2 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em",
          color: accent === "warning" ? "#B83220" : "var(--volt-text, #0A0A0A)",
          margin: 0, lineHeight: 1.2,
        }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ── Abgrenzungs-Box (Section 1) ──────────────────────────────────────────────

function AbgrenzungBox({ de }: { de: boolean }) {
  const rows: Array<{ label: string; ja: string; nein: string }> = de ? [
    { label: "Zweck", ja: "Strategische Fragestellungen beantworten", nein: "Nachrichten lesen" },
    { label: "Nutzer", ja: "Entscheider, Strategen, Analysten", nein: "Massen-Publikum" },
    { label: "Quellen", ja: "Offen, nachvollziehbar, zitierbar", nein: "Hinter Paywalls, anonym" },
    { label: "Output", ja: "Kausale Zusammenhänge, Szenarien", nein: "Schlagzeilen, Breaking News" },
  ] : [
    { label: "Purpose", ja: "Answer strategic questions", nein: "Read news" },
    { label: "Users", ja: "Decision-makers, strategists, analysts", nein: "Mass audience" },
    { label: "Sources", ja: "Open, traceable, citable", nein: "Paywalled, anonymous" },
    { label: "Output", ja: "Causal relationships, scenarios", nein: "Headlines, breaking news" },
  ];
  return (
    <div style={{
      border: "1px solid var(--volt-border, #E8E8E8)",
      borderRadius: "var(--volt-radius-md, 10px)",
      overflow: "hidden",
      marginTop: 8,
      maxWidth: 760,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 1fr",
        background: "var(--volt-surface, #FAFAFA)",
        borderBottom: "1px solid var(--volt-border, #EEE)",
        padding: "10px 16px",
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--volt-text-faint, #999)",
      }}>
        <div></div>
        <div style={{ color: "var(--signal-positive, #1A9E5A)" }}>{de ? "Das ist SIS" : "This is SIS"}</div>
        <div>{de ? "Das ist NICHT SIS" : "This is NOT SIS"}</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 1fr",
            padding: "14px 16px",
            borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--volt-border, #EEE)",
            fontSize: 13,
            alignItems: "center",
          }}
        >
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 600,
            color: "var(--volt-text-muted, #6B6B6B)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>{r.label}</div>
          <div style={{ color: "var(--volt-text, #0A0A0A)", fontWeight: 500 }}>{r.ja}</div>
          <div style={{ color: "var(--volt-text-faint, #A8A8A8)" }}>{r.nein}</div>
        </div>
      ))}
    </div>
  );
}

// ── Pipeline-Diagramm (Section 2) ────────────────────────────────────────────
//
// Adopts the Volt UI "Kern-Schema" pattern: four solid-color panels sitting
// flush against each other, white circular arrows bridging the seams. Each
// panel has an icon top-left, a phase label top-right, a display-font title,
// and a short description. Visually consistent with the Volt UI reference.

function PipelineDiagram({ de }: { de: boolean }) {
  const stations = de ? [
    {
      icon: <Layers size={24} strokeWidth={1.75} />,
      phase: "INPUT",
      title: "Rohsignale",
      desc: "48+ offene Quellen, Push- und Pull-Feeds, 15-Min-Takt",
      bg: "#D5E5FA",           // light blue
    },
    {
      icon: <Cpu size={24} strokeWidth={1.75} />,
      phase: "PARSE",
      title: "Klassifikation",
      desc: "STEEP+V, Themen, Sprache, Zeitstempel — deterministisch + LLM-Fallback",
      bg: "#FBEFB0",           // light yellow
    },
    {
      icon: <BarChart3 size={24} strokeWidth={1.75} />,
      phase: "SCORE",
      title: "Aggregation",
      desc: "Signal-Stärke, Konfidenz, Frequenz — rein statistisch, keine KI",
      bg: "#C8E9D2",           // light mint
    },
    {
      icon: <MapIcon size={24} strokeWidth={1.75} />,
      phase: "MAP",
      title: "Trend-Mapping",
      desc: "Kausal-Graph, Ring-Klassifikation, Velocity",
      bg: "#DCF3A4",           // volt-lime adjacent
    },
  ] : [
    {
      icon: <Layers size={24} strokeWidth={1.75} />,
      phase: "INPUT",
      title: "Raw Signals",
      desc: "48+ open sources, push and pull feeds, 15-min cadence",
      bg: "#D5E5FA",
    },
    {
      icon: <Cpu size={24} strokeWidth={1.75} />,
      phase: "PARSE",
      title: "Classification",
      desc: "STEEP+V, topics, language, timestamps — deterministic + LLM fallback",
      bg: "#FBEFB0",
    },
    {
      icon: <BarChart3 size={24} strokeWidth={1.75} />,
      phase: "SCORE",
      title: "Aggregation",
      desc: "Signal strength, confidence, frequency — pure statistics, no AI",
      bg: "#C8E9D2",
    },
    {
      icon: <MapIcon size={24} strokeWidth={1.75} />,
      phase: "MAP",
      title: "Trend Mapping",
      desc: "Causal graph, ring classification, velocity",
      bg: "#DCF3A4",
    },
  ];

  return (
    <div style={{ position: "relative", maxWidth: 1040 }}>
      {/* Four panels flush against each other (grid, no gap) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0,
        borderRadius: "var(--volt-radius-lg, 14px)",
        overflow: "hidden",
        border: "1px solid var(--volt-border, #E8E8E8)",
      }}>
        {stations.map((s) => (
          <div
            key={s.title}
            style={{
              position: "relative",
              padding: "24px 22px 26px",
              background: s.bg,
              minHeight: 180,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Top row: icon left, phase label right */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 28,
            }}>
              <span style={{
                color: "var(--volt-text, #0A0A0A)",
                display: "inline-flex",
              }}>
                {s.icon}
              </span>
              <span style={{
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(10, 10, 10, 0.5)",
              }}>
                {s.phase}
              </span>
            </div>

            {/* Title */}
            <div style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 20, fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--volt-text, #0A0A0A)",
              marginBottom: 8,
              lineHeight: 1.2,
            }}>
              {s.title}
            </div>

            {/* Description */}
            <div style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "rgba(10, 10, 10, 0.68)",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      {/* White circular arrows overlapping the seams between panels.
          Positioned absolutely at 25%, 50%, 75% of the container width. */}
      {[25, 50, 75].map((leftPct) => (
        <div
          key={leftPct}
          aria-hidden
          style={{
            position: "absolute",
            left: `${leftPct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--volt-border, #E8E8E8)",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--volt-text, #0A0A0A)",
            fontSize: 14,
            fontWeight: 500,
            zIndex: 2,
          }}
        >
          →
        </div>
      ))}
    </div>
  );
}

// ── STEEP+V Grid (Section 3) ─────────────────────────────────────────────────

function SteepVGrid({ de }: { de: boolean }) {
  const cats = de ? [
    { letter: "S", name: "Social", desc: "Demografie, Werte, Kultur, Bildung" },
    { letter: "T", name: "Technological", desc: "Innovation, Forschung, Reifegrad" },
    { letter: "E", name: "Economic", desc: "Märkte, Handel, Kapitalflüsse" },
    { letter: "E", name: "Environmental", desc: "Klima, Ressourcen, Biodiversität" },
    { letter: "P", name: "Political", desc: "Regulierung, Geopolitik, Institutionen" },
    { letter: "V", name: "Values", desc: "Normen, Ideologie, Vertrauen" },
  ] : [
    { letter: "S", name: "Social", desc: "Demographics, values, culture, education" },
    { letter: "T", name: "Technological", desc: "Innovation, research, maturity" },
    { letter: "E", name: "Economic", desc: "Markets, trade, capital flows" },
    { letter: "E", name: "Environmental", desc: "Climate, resources, biodiversity" },
    { letter: "P", name: "Political", desc: "Regulation, geopolitics, institutions" },
    { letter: "V", name: "Values", desc: "Norms, ideology, trust" },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 10,
      maxWidth: 900,
    }}>
      {cats.map((c, i) => (
        <div
          key={`${c.letter}-${c.name}-${i}`}
          style={{
            padding: "16px 18px",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--volt-border, #E8E8E8)",
            borderRadius: "var(--volt-radius-md, 10px)",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "var(--volt-lime, #E4FF97)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            fontSize: 17, fontWeight: 700, color: "#0A0A0A",
            flexShrink: 0,
          }}>
            {c.letter}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--volt-text, #0A0A0A)",
              marginBottom: 2,
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            }}>
              {c.name}
            </div>
            <div style={{
              fontSize: 11,
              color: "var(--volt-text-muted, #6B6B6B)",
              lineHeight: 1.45,
            }}>
              {c.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ring Explainer (Section 4) ───────────────────────────────────────────────

function RingExplainer({ de }: { de: boolean }) {
  const rings = de ? [
    { key: "adopt",  label: "Adopt",  color: "#1A9E5A", desc: "Sofort relevant. Breite Quellen-Abdeckung, hohe Konfidenz, klare Evidenz. Entscheidungen treffen.", threshold: "Score ≥ 0.85" },
    { key: "trial",  label: "Trial",  color: "#7AB8F5", desc: "Pilotieren. Starke Signale, aber noch nicht überall angekommen. Geeignet für kontrollierte Experimente.", threshold: "Score 0.70 – 0.84" },
    { key: "assess", label: "Assess", color: "#F5C87A", desc: "Beobachten und bewerten. Frühe Signale, unklare Richtung, Trend könnte kippen. Nicht investieren, aber im Blick behalten.", threshold: "Score 0.50 – 0.69" },
    { key: "hold",   label: "Hold",   color: "#A8A8A8", desc: "Langfristig relevant, aber heute nicht handlungsleitend. Im Radar halten, keine Ressourcen binden.", threshold: "Score < 0.50" },
  ] : [
    { key: "adopt",  label: "Adopt",  color: "#1A9E5A", desc: "Immediately relevant. Broad source coverage, high confidence, clear evidence. Make decisions.", threshold: "Score ≥ 0.85" },
    { key: "trial",  label: "Trial",  color: "#7AB8F5", desc: "Pilot. Strong signals, but not yet mainstream. Suitable for controlled experiments.", threshold: "Score 0.70 – 0.84" },
    { key: "assess", label: "Assess", color: "#F5C87A", desc: "Observe and evaluate. Early signals, direction unclear, trend may flip. Don't invest, but keep watch.", threshold: "Score 0.50 – 0.69" },
    { key: "hold",   label: "Hold",   color: "#A8A8A8", desc: "Long-term relevant but not action-driving today. Keep on radar, don't commit resources.", threshold: "Score < 0.50" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 900 }}>
      {rings.map((r) => (
        <div
          key={r.key}
          style={{
            display: "grid",
            gridTemplateColumns: "130px 1fr 140px",
            gap: 18,
            alignItems: "center",
            padding: "16px 20px",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--volt-border, #E8E8E8)",
            borderLeft: `4px solid ${r.color}`,
            borderRadius: "var(--volt-radius-md, 10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: r.color, flexShrink: 0,
            }} />
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: "var(--volt-text, #0A0A0A)",
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}>
              {r.label}
            </span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--volt-text-muted, #6B6B6B)" }}>
            {r.desc}
          </div>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 600,
            color: "var(--volt-text-faint, #999)",
            textAlign: "right",
          }}>
            {r.threshold}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Confidence Breakdown (Section 5) ─────────────────────────────────────────

function ConfidenceBreakdown({ de }: { de: boolean }) {
  const factors = de ? [
    {
      name: "Quellen-Breite",
      weight: "33 %",
      desc: "Wie viele unabhängige Quellen stützen diese Einschätzung? Eine einzige Studie reicht nicht. Ziel: ≥ 5 divergente Quellen für volle Punktzahl.",
      color: "#7AB8F5",
    },
    {
      name: "Signal-Übereinstimmung",
      weight: "33 %",
      desc: "Wie stark stimmen die Signale inhaltlich überein? Widersprüchliche Signale senken den Score — das ist gewollt, weil sie reale Unsicherheit abbilden.",
      color: "#9B87F5",
    },
    {
      name: "Zeitnähe",
      weight: "34 %",
      desc: "Wie aktuell sind die Signale? Ein Trend, dessen letzte Evidenz zwölf Monate alt ist, bekommt weniger Konfidenz als einer mit wöchentlichen neuen Datenpunkten.",
      color: "#F5C87A",
    },
  ] : [
    {
      name: "Source Breadth",
      weight: "33%",
      desc: "How many independent sources support this assessment? A single study isn't enough. Target: ≥ 5 divergent sources for full score.",
      color: "#7AB8F5",
    },
    {
      name: "Signal Agreement",
      weight: "33%",
      desc: "How strongly do signals agree in substance? Contradicting signals lower the score — intentionally, because they reflect real uncertainty.",
      color: "#9B87F5",
    },
    {
      name: "Recency",
      weight: "34%",
      desc: "How fresh are the signals? A trend whose last evidence is twelve months old gets less confidence than one with weekly new data points.",
      color: "#F5C87A",
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
      {factors.map((f) => (
        <div
          key={f.name}
          style={{
            padding: "18px 22px",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--volt-border, #E8E8E8)",
            borderRadius: "var(--volt-radius-md, 10px)",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--volt-text, #0A0A0A)",
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            }}>
              {f.name}
            </div>
            <div style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 11, fontWeight: 700,
              color: f.color,
              padding: "3px 10px",
              borderRadius: 999,
              background: `${f.color}1A`,
              border: `1px solid ${f.color}33`,
            }}>
              {f.weight}
            </div>
          </div>
          <div style={{
            height: 6,
            background: "var(--volt-surface, #F0F0F0)",
            borderRadius: 3,
            overflow: "hidden",
            marginBottom: 10,
          }}>
            <div style={{
              width: "33%",
              height: "100%",
              background: f.color,
              borderRadius: 3,
            }} />
          </div>
          <div style={{
            fontSize: 12, lineHeight: 1.55,
            color: "var(--volt-text-muted, #6B6B6B)",
          }}>
            {f.desc}
          </div>
        </div>
      ))}
      <div style={{
        padding: "14px 18px",
        background: "rgba(228,255,151,0.24)",
        border: "1px solid rgba(228,255,151,0.6)",
        borderRadius: "var(--volt-radius-md, 10px)",
        fontSize: 12, lineHeight: 1.55,
        color: "var(--volt-text, #0A0A0A)",
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      }}>
        <strong>{de ? "Beispiel: " : "Example: "}</strong>
        {de
          ? "Ein Trend mit 7 Quellen (voll), 60 % Übereinstimmung (mittel) und Signalen aus der letzten Woche (voll) ergibt ca. 33 + 20 + 34 = 87 % Konfidenz → Adopt-Ring."
          : "A trend with 7 sources (full), 60% agreement (medium), and signals from the last week (full) yields ≈ 33 + 20 + 34 = 87% confidence → Adopt ring."}
      </div>
    </div>
  );
}

// ── Edge Types Grid (Section 6) ──────────────────────────────────────────────

function EdgeTypesGrid({ de }: { de: boolean }) {
  const edges = de ? [
    { type: "treibt",      color: "#1A9E5A", solid: true,  desc: "A treibt B direkt an. Wenn A stärker wird, wird B wahrscheinlicher.", example: "Agentic AI → Automatisierungs-Druck" },
    { type: "ermöglicht",  color: "#7AB8F5", solid: true,  desc: "A ist Voraussetzung für B. B kann ohne A nicht existieren.", example: "5G-Netze → Autonomes Fahren" },
    { type: "hemmt",       color: "#E8402A", solid: true,  desc: "A wirkt B entgegen. Stärker A, schwächer B.", example: "Datenschutz-Regulierung → Daten-Monetarisierung" },
    { type: "korreliert",  color: "#F5C87A", solid: false, desc: "A und B treten gemeinsam auf, ohne dass einer den anderen kausal bedingt.", example: "Urbanisierung ↔ Mikromobilität" },
  ] : [
    { type: "drives",     color: "#1A9E5A", solid: true,  desc: "A directly drives B. As A grows stronger, B becomes more likely.", example: "Agentic AI → automation pressure" },
    { type: "enables",    color: "#7AB8F5", solid: true,  desc: "A is a prerequisite for B. B cannot exist without A.", example: "5G networks → autonomous driving" },
    { type: "dampens",    color: "#E8402A", solid: true,  desc: "A counteracts B. Stronger A, weaker B.", example: "Privacy regulation → data monetization" },
    { type: "correlates", color: "#F5C87A", solid: false, desc: "A and B appear together without one causally determining the other.", example: "Urbanization ↔ micromobility" },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 12,
      maxWidth: 900,
    }}>
      {edges.map((e) => (
        <div
          key={e.type}
          style={{
            padding: "18px 20px",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--volt-border, #E8E8E8)",
            borderRadius: "var(--volt-radius-md, 10px)",
          }}
        >
          <svg width="124" height="28" style={{ marginBottom: 10, overflow: "visible" }}>
            <circle cx="12" cy="14" r="6" fill="var(--volt-text, #0A0A0A)" />
            <line
              x1="22" y1="14" x2="98" y2="14"
              stroke={e.color}
              strokeWidth="2"
              strokeDasharray={e.solid ? "" : "4 3"}
            />
            <polygon
              points="98,10 106,14 98,18"
              fill={e.color}
            />
            <circle cx="112" cy="14" r="6" fill="var(--volt-text, #0A0A0A)" />
          </svg>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: e.color,
            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 6,
          }}>
            {e.type}
          </div>
          <div style={{
            fontSize: 12, lineHeight: 1.55,
            color: "var(--volt-text-muted, #6B6B6B)",
            marginBottom: 8,
          }}>
            {e.desc}
          </div>
          <div style={{
            fontSize: 11,
            color: "var(--volt-text-faint, #999)",
            fontStyle: "italic",
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          }}>
            {de ? "Beispiel: " : "Example: "}{e.example}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── "What SIS does NOT do" (Section 7) ──────────────────────────────────────

function NotList({ de }: { de: boolean }) {
  const items = de ? [
    { head: "Keine Prognose-Wahrsagerei",            body: "Das SIS sagt die Zukunft nicht voraus. Es strukturiert, was heute in den Daten sichtbar ist — nicht mehr, nicht weniger." },
    { head: "Keine Meinung ohne Quelle",             body: "Jede Einschätzung ist an belegbare Signale geknüpft. Wenn wir die Quelle nicht nennen können, gibt es keine Einschätzung." },
    { head: "Keine Schwarze-Box-KI",                 body: "Modelle, Prompts und Scoring-Logik sind im Quellcode nachvollziehbar. Keine versteckte Intelligenz, die du nicht prüfen kannst." },
    { head: "Keine geschlossenen Datenquellen",      body: "Wir arbeiten ausschließlich mit offenen, zitierbaren Quellen. Proprietäre Newsletter, Paywalls und anonyme Gerüchte haben keinen Platz." },
    { head: "Keine personalisierte Filter-Blase",    body: "Das SIS passt die Ergebnisse nicht an deine Klick-Historie an. Was du siehst, sieht jeder andere Nutzer auch." },
  ] : [
    { head: "No fortune telling",                  body: "The SIS does not predict the future. It structures what is visible in today's data — nothing more, nothing less." },
    { head: "No opinions without sources",         body: "Every assessment is tied to traceable signals. If we can't name the source, there's no assessment." },
    { head: "No black-box AI",                     body: "Models, prompts, and scoring logic are visible in the source code. No hidden intelligence you can't inspect." },
    { head: "No closed data sources",              body: "We work exclusively with open, citable sources. Proprietary newsletters, paywalls, and anonymous rumors have no place." },
    { head: "No personalized filter bubble",       body: "The SIS does not adapt results to your click history. What you see is what everyone else sees." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 860 }}>
      {items.map((it) => (
        <div
          key={it.head}
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 16px",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid rgba(232, 64, 42, 0.16)",
            borderRadius: "var(--volt-radius-md, 10px)",
          }}
        >
          <span style={{
            flexShrink: 0,
            width: 24, height: 24, borderRadius: "50%",
            background: "rgba(232, 64, 42, 0.08)",
            color: "#E8402A",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700,
            marginTop: 1,
          }}>
            ✕
          </span>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--volt-text, #0A0A0A)",
              marginBottom: 3,
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            }}>
              {it.head}
            </div>
            <div style={{
              fontSize: 12, lineHeight: 1.55,
              color: "var(--volt-text-muted, #6B6B6B)",
            }}>
              {it.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
