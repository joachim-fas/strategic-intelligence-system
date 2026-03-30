export default function HowTo() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-page-bg)" }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-xs)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-md)",
              background: "#E4FF97",
              border: "1.5px solid rgba(0,0,0,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.05em",
            }}>SIS</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-heading)" }}>Strategic Intelligence System</span>
          </a>
          <span style={{ color: "var(--color-border)", fontSize: 18 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--color-text-subtle)" }}>How-to</span>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Lead */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-heading)", margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Was ist das SIS — und wie nutzt man es?
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-primary)", margin: "0 0 12px" }}>
            Das <strong>Strategic Intelligence System</strong> ist ein Denk-Instrument für strategische Zukunftsanalyse. Es verbindet Echtzeit-Signale aus 22 Live-Quellen, 43+ Forschungsquellen und einem kausalen Trend-Graphen — und macht das alles über eine einzige Frage zugänglich.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-primary)", margin: 0 }}>
            Kein Dashboard. Keine Tabellen. Du stellst eine Frage — das System denkt.
          </p>
        </div>

        <Section title="So funktioniert eine Abfrage">
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)", marginBottom: 20 }}>
            Gib eine Frage, ein Thema oder ein einzelnes Stichwort in die Suchleiste ein. Das System erkennt den Kontext, zieht relevante Signale und Trends heran und antwortet strukturiert — mit Quellenangaben, Szenarien und Handlungsempfehlungen.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Beispiele — einfach so eingeben:
            </div>
            {[
              { input: "AI Agents", hint: "Überblick über den Stand der Technik, Adoption, Regulierung" },
              { input: "Wie entwickelt sich die Energiewende in Deutschland?", hint: "Kontextuelle Analyse mit Zeitrahmen und Szenarien" },
              { input: "ÖPNV rural", hint: "Kurzes Stichwort reicht — das System versteht den Kontext" },
              { input: "Was bedeutet DORA für Finanzdienstleister?", hint: "Regulatorische Fragen mit Handlungsempfehlungen" },
              { input: "Quanten-Computing 2027", hint: "Prognosefrage mit Zeithorizont" },
            ].map(({ input, hint }) => (
              <div key={input} style={{
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)", padding: "10px 14px",
                display: "flex", alignItems: "baseline", gap: 12,
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-brand)", fontFamily: "monospace", flexShrink: 0 }}>
                  &gt; {input}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{hint}</span>
              </div>
            ))}
          </div>

          <div style={{
            background: "#E4FF97", border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "var(--radius-md)", padding: "12px 16px",
          }}>
            <p style={{ fontSize: 14, color: "#0A0A0A", margin: 0, lineHeight: 1.6 }}>
              <strong>Tipp:</strong> Das SIS versteht Deutsch und Englisch gleichwertig. Misch ruhig — es kommt auf die Substanz der Frage an, nicht auf die Sprache.
            </p>
          </div>
        </Section>

        <Section title="Was das SIS zurückgibt">
          {[
            {
              label: "Synthese",
              color: "#1A1A1A",
              bg: "#E4FF97",
              desc: "Die direkte Antwort auf deine Frage — substanziell, mit Quellenangaben im Fließtext. Keine oberflächlichen Zusammenfassungen.",
            },
            {
              label: "Erkenntnisse",
              color: "#0F6038",
              bg: "#C3F4D3",
              desc: "3–5 konkrete Insights, die über die Synthese hinausgehen. Strukturelle Zusammenhänge, Überraschungen, Widersprüche.",
            },
            {
              label: "Szenarien",
              color: "#7C1A9E",
              bg: "#FDE2FF",
              desc: "Optimistisch / Wahrscheinlichst / Pessimistisch — mit Wahrscheinlichkeiten. Was passiert wenn sich nichts ändert? Was wenn es besser/schlechter läuft?",
            },
            {
              label: "Kausal-Netz",
              color: "#7A5C00",
              bg: "#FFF5BA",
              desc: "Ursache-Wirkungs-Ketten: Welche Trends bedingen einander? Wo sind Kaskadeneffekte? Was sind die echten Treiber hinter dem Thema?",
            },
            {
              label: "Entscheidungsrahmen",
              color: "#C0341D",
              bg: "#FDEEE9",
              desc: "Was tun? Konkrete Handlungsempfehlung basierend auf der Analyse — kein generisches Fazit, sondern ein Orientierungspunkt.",
            },
            {
              label: "Live-Signale",
              color: "#0A6060",
              bg: "#D4F4F4",
              desc: "Welche aktuellen Signale (letzte 72h) wurden für diese Antwort verwendet — mit Quelle, Datum und Stärke. Transparenz über die Datenbasis.",
            },
          ].map(({ label, color, bg, desc }) => (
            <div key={label} style={{
              display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start",
            }}>
              <div style={{
                flexShrink: 0, padding: "3px 10px", borderRadius: 20,
                background: bg, color, fontSize: 12, fontWeight: 600,
                whiteSpace: "nowrap", marginTop: 2,
              }}>{label}</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        <Section title="Die Navigation verstehen">
          {[
            {
              label: "N Trends",
              desc: "Alle Trends in der Datenbank — sortiert nach Relevanz. Klick auf einen Trend öffnet das Detail-Panel mit Quellen, Scoring und Kausalnetz.",
            },
            {
              label: "N Quellen",
              desc: "43 autoritative Forschungsquellen: WEF, PwC, EU ESPAS, Zukunftsinstitut, IPCC, Stanford HAI u.v.m. — nach Kategorie gruppiert und verlinkt.",
            },
            {
              label: "N Connectors",
              desc: "22 Live-Daten-Connectors: GitHub, arXiv, GDELT, Polymarket, World Monitor, NASA EONET, World Bank, Eurostat, OECD, Our World in Data, Hacker News, Reddit u.a.",
            },
            {
              label: "Projekte",
              desc: "Eigene Seite für Projektarbeit: Abfragen mit vollständigem Inhalt speichern und wieder öffnen, Notizen hinzufügen, als aktives Projekt markieren — alles persistiert in der Datenbank.",
            },
            {
              label: "Radar",
              desc: "Die Visualisierung zeigt alle Trends nach Ring (Adopt / Trial / Assess / Hold) und Quadrant — interaktiv, klickbar.",
            },
          ].map(({ label, desc }) => (
            <div key={label} style={{
              display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start",
            }}>
              <div style={{
                flexShrink: 0, padding: "3px 10px", borderRadius: "var(--radius-md)",
                background: "var(--color-page-bg)", border: "1px solid var(--color-border)",
                fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)",
                whiteSpace: "nowrap", marginTop: 2,
              }}>{label}</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        <Section title="Worauf das SIS aufgebaut ist">
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
            Das System kombiniert drei Erkenntnisquellen:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              {
                title: "Strukturwissen",
                desc: "39 klassifizierte Trends (Mega / Macro / Micro), 18 Regulierungen aus 5 Jurisdiktionen, 40+ kausale Verbindungen im Trend-Graphen.",
              },
              {
                title: "Echtzeit-Signale",
                desc: "22 Live-Connectors aktualisieren alle 6h: Tech-Adoption (GitHub, npm, arXiv), Märkte (Polymarket), Klima (NASA, EONET), Geopolitik (GDELT, World Monitor), Wirtschaft (Eurostat, OECD, World Bank).",
              },
              {
                title: "LLM-Analyse",
                desc: "Claude synthetisiert Strukturwissen + Live-Signale zu einer kohärenten Antwort — mit expliziten Quellenangaben, Szenarien und Handlungsempfehlungen.",
              },
            ].map(({ title, desc }) => (
              <div key={title} style={{
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)", padding: "14px 16px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 6 }}>{title}</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-subtle)", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Grenzen & Ehrlichkeit">
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)", margin: "0 0 12px" }}>
            Das SIS ist ein Denk-Instrument, kein Orakel. Es hilft dir, komplexe Fragen zu strukturieren und belegt zu durchdenken — aber:
          </p>
          <ul style={{ fontSize: 14, lineHeight: 1.9, color: "var(--color-text-primary)", margin: 0, paddingLeft: 20 }}>
            <li>Confidence-Werte zeigen an, wie gut die Datenlage ist — ein niedriger Wert ist kein Fehler, sondern ehrliche Transparenz.</li>
            <li>Live-Signale sind die Titel und Metadaten von Quellen — keine vollständigen Artikel (in Entwicklung).</li>
            <li>Szenarien sind Denkrahmen, keine Vorhersagen. Das Wahrscheinlichste tritt selten genau so ein.</li>
            <li>Das System deckt primär Technologie, Wirtschaft, Klima, Geopolitik ab — keine Nischenthemen ohne Datenlage.</li>
          </ul>
        </Section>

        {/* Back link */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--color-border)" }}>
          <a href="/" style={{ fontSize: 14, color: "var(--color-brand)", textDecoration: "none", fontWeight: 500 }}>
            ← Zurück zum SIS
          </a>
        </div>

      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-heading)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
