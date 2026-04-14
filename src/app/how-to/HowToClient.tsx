"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { AppHeader } from "@/components/AppHeader";

export default function HowToClient() {
  const { locale } = useLocale();
  const de = locale === "de";

  const examples = de
    ? [
        { input: "AI Agents", hint: "Überblick über den Stand der Technik, Adoption, Regulierung" },
        { input: "Wie entwickelt sich die Energiewende in Deutschland?", hint: "Kontextuelle Analyse mit Zeitrahmen und Szenarien" },
        { input: "ÖPNV rural", hint: "Kurzes Stichwort reicht — das System versteht den Kontext" },
        { input: "Was bedeutet DORA für Finanzdienstleister?", hint: "Regulatorische Fragen mit Handlungsempfehlungen" },
        { input: "Quanten-Computing 2027", hint: "Prognosefrage mit Zeithorizont" },
      ]
    : [
        { input: "AI Agents", hint: "Overview of state of the art, adoption, regulation" },
        { input: "How is the energy transition developing in Germany?", hint: "Contextual analysis with timelines and scenarios" },
        { input: "Rural mobility", hint: "A short keyword is enough — the system understands context" },
        { input: "What does DORA mean for financial institutions?", hint: "Regulatory questions with action recommendations" },
        { input: "Quantum computing 2027", hint: "Forecast question with time horizon" },
      ];

  const outputs = de
    ? [
        { label: "Synthese", color: "var(--color-text-heading)", bg: "var(--color-lime)", desc: "Die direkte Antwort auf deine Frage — substanziell, mit Quellenangaben im Fließtext. Keine oberflächlichen Zusammenfassungen." },
        { label: "Erkenntnisse", color: "var(--pastel-mint-text)", bg: "var(--pastel-mint)", desc: "3–5 konkrete Insights, die über die Synthese hinausgehen. Strukturelle Zusammenhänge, Überraschungen, Widersprüche." },
        { label: "Szenarien", color: "var(--pastel-orchid-text)", bg: "var(--pastel-orchid)", desc: "Optimistisch / Wahrscheinlichst / Pessimistisch — mit Wahrscheinlichkeiten. Was passiert wenn sich nichts ändert? Was wenn es besser/schlechter läuft?" },
        { label: "Kausal-Netz", color: "var(--pastel-butter-text)", bg: "var(--pastel-butter)", desc: "Ursache-Wirkungs-Ketten: Welche Trends bedingen einander? Wo sind Kaskadeneffekte? Was sind die echten Treiber hinter dem Thema?" },
        { label: "Entscheidungsrahmen", color: "var(--signal-negative-text)", bg: "var(--signal-negative-light)", desc: "Was tun? Konkrete Handlungsempfehlung basierend auf der Analyse — kein generisches Fazit, sondern ein Orientierungspunkt." },
        { label: "Live-Signale", color: "var(--pastel-aqua-text)", bg: "var(--pastel-aqua)", desc: "Welche aktuellen Signale (letzte 72h) wurden für diese Antwort verwendet — mit Quelle, Datum und Stärke. Transparenz über die Datenbasis." },
      ]
    : [
        { label: "Synthesis", color: "var(--color-text-heading)", bg: "var(--color-lime)", desc: "The direct answer to your question — substantive, with inline citations. No surface-level summaries." },
        { label: "Insights", color: "var(--pastel-mint-text)", bg: "var(--pastel-mint)", desc: "3–5 concrete insights beyond the synthesis. Structural connections, surprises, contradictions." },
        { label: "Scenarios", color: "var(--pastel-orchid-text)", bg: "var(--pastel-orchid)", desc: "Optimistic / Most likely / Pessimistic — with probabilities. What happens if nothing changes? What if things go better or worse?" },
        { label: "Causal network", color: "var(--pastel-butter-text)", bg: "var(--pastel-butter)", desc: "Cause-and-effect chains: which trends drive each other? Where are cascade effects? What are the real forces behind the topic?" },
        { label: "Decision framework", color: "var(--signal-negative-text)", bg: "var(--signal-negative-light)", desc: "What to do? Concrete action recommendation based on the analysis — not a generic conclusion but an orientation point." },
        { label: "Live signals", color: "var(--pastel-aqua-text)", bg: "var(--pastel-aqua)", desc: "Which recent signals (last 72h) were used for this answer — with source, date and strength. Full transparency about the data basis." },
      ];

  const navItems = de
    ? [
        { label: "N Trends", desc: "Alle Trends in der Datenbank — sortiert nach Relevanz. Klick auf einen Trend öffnet das Detail-Panel mit Quellen, Scoring und Kausalnetz." },
        { label: "N Quellen", desc: "65 autoritative Forschungsquellen: WEF, PwC, EU ESPAS, Zukunftsinstitut, IPCC, Stanford HAI u.v.m. — nach Kategorie gruppiert und verlinkt." },
        { label: "N Connectors", desc: "50 Live-Daten-Connectors: GitHub, arXiv, GDELT, Polymarket, World Monitor, NASA EONET, World Bank, Eurostat, OECD, Our World in Data, Hacker News, Reddit u.a." },
        { label: "Projekte", desc: "Eigene Seite für Projektarbeit: Abfragen mit vollständigem Inhalt speichern und wieder öffnen, Notizen hinzufügen, als aktives Projekt markieren — alles persistiert in der Datenbank." },
        { label: "Radar", desc: "Die Visualisierung zeigt alle Trends nach Ring (Adopt / Trial / Assess / Hold) und Quadrant — interaktiv, klickbar." },
      ]
    : [
        { label: "N Trends", desc: "All trends in the database — sorted by relevance. Click a trend to open the detail panel with sources, scoring and causal network." },
        { label: "N Sources", desc: "65 authoritative research sources: WEF, PwC, EU ESPAS, Zukunftsinstitut, IPCC, Stanford HAI and more — grouped by category and linked." },
        { label: "N Connectors", desc: "50 live data connectors: GitHub, arXiv, GDELT, Polymarket, World Monitor, NASA EONET, World Bank, Eurostat, OECD, Our World in Data, Hacker News, Reddit and more." },
        { label: "Projects", desc: "Dedicated workspace: save queries with full content and reopen them, add notes, mark as active project — everything persisted in the database." },
        { label: "Radar", desc: "The visualization shows all trends by ring (Adopt / Trial / Assess / Hold) and quadrant — interactive and clickable." },
      ];

  const foundations = de
    ? [
        { title: "Analytisches Framework", desc: "STEEP+V-Methodik (Society, Technology, Economy, Environment, Politics, Values) — jede Analyse wird systematisch entlang dieser 6 Dimensionen strukturiert. Orientierung an den 14 EU JRC Megatrends der Europäischen Kommission." },
        { title: "Strukturwissen", desc: "39 klassifizierte Trends (Mega / Makro), 18 Regulierungen aus 5 Jurisdiktionen, 70+ kausale Verbindungen im Trend-Graphen. Belegt durch 65 institutionelle Forschungsquellen (PwC, EY, Roland Berger, OECD, EU JRC, u.a.)." },
        { title: "Echtzeit-Signale", desc: "50 Live-Connectors aus 12 Kategorien: Tech-Adoption (GitHub, npm, arXiv, Docker Hub), Nachrichten (Guardian, NYT, GDELT), Prognosen (Polymarket, Metaculus, Kalshi), Klima (NASA EONET, Open-Meteo), Geopolitik (ACLED, UCDP), Wirtschaft (Eurostat, OECD, World Bank, Finnhub, ILO), Gesundheit (WHO GHO)." },
        { title: "LLM-Analyse", desc: "Claude synthetisiert Strukturwissen + Live-Signale zu einer kohärenten Antwort — mit STEEP+V-Einordnung, expliziten Quellenangaben, Szenarien und Handlungsempfehlungen. EU-Fokus als Default-Perspektive." },
      ]
    : [
        { title: "Analytical Framework", desc: "STEEP+V methodology (Society, Technology, Economy, Environment, Politics, Values) — every analysis is systematically structured along these 6 dimensions. Aligned with the 14 EU JRC Megatrends of the European Commission." },
        { title: "Structural knowledge", desc: "39 classified trends (Mega / Macro), 18 regulations from 5 jurisdictions, 70+ causal connections in the trend graph. Backed by 65 institutional research sources (PwC, EY, Roland Berger, OECD, EU JRC, etc.)." },
        { title: "Real-time signals", desc: "50 live connectors across 12 categories: tech adoption (GitHub, npm, arXiv, Docker Hub), news (Guardian, NYT, GDELT), forecasting (Polymarket, Metaculus, Kalshi), climate (NASA EONET, Open-Meteo), geopolitics (ACLED, UCDP), economics (Eurostat, OECD, World Bank, Finnhub, ILO), health (WHO GHO)." },
        { title: "LLM analysis", desc: "Claude synthesises structural knowledge + live signals into a coherent answer — with STEEP+V classification, explicit citations, scenarios and action recommendations. EU focus as default perspective." },
      ];

  const limits = de
    ? [
        "Confidence-Werte zeigen an, wie gut die Datenlage ist — ein niedriger Wert ist kein Fehler, sondern ehrliche Transparenz.",
        "Live-Signale sind die Titel und Metadaten von Quellen — keine vollständigen Artikel (in Entwicklung).",
        "Szenarien sind Denkrahmen, keine Vorhersagen. Das Wahrscheinlichste tritt selten genau so ein.",
        "Das System deckt primär Technologie, Wirtschaft, Klima, Geopolitik ab — keine Nischenthemen ohne Datenlage.",
      ]
    : [
        "Confidence scores indicate data quality — a low score is not an error, it is honest transparency.",
        "Live signals are titles and metadata from sources — not full articles (in development).",
        "Scenarios are thinking frameworks, not predictions. The most likely outcome rarely happens exactly as described.",
        "The system primarily covers technology, economics, climate, geopolitics — not niche topics without a data basis.",
      ];

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main className="volt-container" style={{ padding: "32px 24px 80px" }}>

        {/* Lead */}
        <div style={{ marginBottom: 48 }}>
          <h1 className="volt-display-md" style={{ margin: "0 0 16px" }}>
            {de ? "Was ist das SIS — und wie nutzt man es?" : "What is SIS — and how do you use it?"}
          </h1>
          <p className="volt-body" style={{ margin: "0 0 12px" }}>
            {de
              ? <>Das <strong>Strategic Intelligence System</strong> ist ein Denk-Instrument für strategische Zukunftsanalyse. Es verbindet Echtzeit-Signale aus 50 Live-Quellen, 65+ Forschungsquellen und einem kausalen Trend-Graphen — und macht das alles über eine einzige Frage zugänglich.</>
              : <>The <strong>Strategic Intelligence System</strong> is a thinking instrument for strategic foresight. It connects real-time signals from 50 live sources, 65+ research sources and a causal trend graph — and makes all of this accessible through a single question.</>
            }
          </p>
          <p className="volt-body" style={{ margin: "0 0 16px" }}>
            {de
              ? "Kein Dashboard. Keine Tabellen. Du stellst eine Frage — das System denkt."
              : "No dashboard. No tables. You ask a question — the system thinks."}
          </p>
          <Link href="/beispiele" className="volt-btn volt-btn-solid" style={{
            textDecoration: "none",
            background: "var(--color-lime)", color: "var(--color-brand-text)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}>
            {de ? "Beispiel-Briefings ansehen" : "View example briefings"} →
          </Link>
        </div>

        <Section title={de ? "So funktioniert eine Abfrage" : "How a query works"}>
          <p className="volt-body" style={{ marginBottom: 20 }}>
            {de
              ? "Gib eine Frage, ein Thema oder ein einzelnes Stichwort in die Suchleiste ein. Das System erkennt den Kontext, zieht relevante Signale und Trends heran und antwortet strukturiert — mit Quellenangaben, Szenarien und Handlungsempfehlungen."
              : "Enter a question, topic or single keyword into the search bar. The system recognises the context, pulls in relevant signals and trends, and responds in a structured way — with citations, scenarios and action recommendations."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            <div className="volt-label" style={{ marginBottom: 4 }}>
              {de ? "Beispiele — einfach so eingeben:" : "Examples — just type them in:"}
            </div>
            {examples.map(({ input, hint }) => (
              <div key={input} className="volt-card" style={{
                padding: "10px 14px",
                display: "flex", alignItems: "baseline", gap: 12,
              }}>
                <span className="term-query" style={{ fontSize: 13 }}>{input}</span>
                <span className="volt-body-sm" style={{ color: "var(--color-text-muted)" }}>{hint}</span>
              </div>
            ))}
          </div>

          <div className="volt-card" style={{ background: "var(--color-lime)", border: "1px solid rgba(0,0,0,0.08)", padding: "12px 16px" }}>
            <p className="volt-body-sm" style={{ color: "var(--color-brand-text)", margin: 0 }}>
              <strong>{de ? "Tipp:" : "Tip:"}</strong>{" "}
              {de
                ? "Das SIS versteht Deutsch und Englisch gleichwertig. Misch ruhig — es kommt auf die Substanz der Frage an, nicht auf die Sprache."
                : "SIS understands German and English equally well. Mix freely — what matters is the substance of the question, not the language."}
            </p>
          </div>
        </Section>

        <Section title={de ? "Was das SIS zurückgibt" : "What SIS returns"}>
          {outputs.map(({ label, color, bg, desc }) => (
            <div key={label} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
              <div className="volt-badge" style={{ flexShrink: 0, background: bg, color, whiteSpace: "nowrap", marginTop: 2 }}>
                {label}
              </div>
              <p className="volt-body-sm" style={{ margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        <Section title={de ? "Die Navigation verstehen" : "Understanding the navigation"}>
          {navItems.map(({ label, desc }) => (
            <div key={label} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
              <div className="volt-badge volt-badge-muted" style={{ flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}>
                {label}
              </div>
              <p className="volt-body-sm" style={{ margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        <Section title={de ? "Worauf das SIS aufgebaut ist" : "What SIS is built on"}>
          <p className="volt-body" style={{ margin: "0 0 16px" }}>
            {de ? "Das System kombiniert drei Erkenntnisquellen:" : "The system combines three knowledge sources:"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {foundations.map(({ title, desc }) => (
              <div key={title} className="volt-card" style={{ padding: "14px 16px" }}>
                <div className="volt-label" style={{ marginBottom: 6 }}>{title}</div>
                <p className="volt-body-sm" style={{ color: "var(--color-text-subtle)", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={de ? "Grenzen & Ehrlichkeit" : "Limitations & honesty"}>
          <p className="volt-body" style={{ margin: "0 0 12px" }}>
            {de
              ? "Das SIS ist ein Denk-Instrument, kein Orakel. Es hilft dir, komplexe Fragen zu strukturieren und belegt zu durchdenken — aber:"
              : "SIS is a thinking instrument, not an oracle. It helps you structure and reason through complex questions with evidence — but:"}
          </p>
          <ul className="volt-body-sm" style={{ lineHeight: 1.9, margin: 0, paddingLeft: 20 }}>
            {limits.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </Section>

        {/* Canvas link */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--color-border)" }}>
          <Link href="/canvas" className="volt-btn volt-btn-outline" style={{ textDecoration: "none" }}>
            {de ? "→ Canvas öffnen" : "→ Open Canvas"}
          </Link>
        </div>

      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="volt-heading" style={{ margin: "0 0 16px" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
