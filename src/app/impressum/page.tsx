"use client";

import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";

export default function ImpressumPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  return (
    <>
      <AppHeader />
      <main style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 32px 80px",
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700,
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          color: "var(--color-text-heading, #0A0A0A)",
          marginBottom: 8,
        }}>
          Impressum
        </h1>

        <div style={{
          display: "inline-block",
          padding: "4px 12px", borderRadius: 20,
          background: "rgba(249,115,22,0.1)",
          border: "1px solid rgba(249,115,22,0.25)",
          color: "#D97706",
          fontSize: 12, fontWeight: 600,
          marginBottom: 32,
        }}>
          {de ? "Test-Projekt — keine kommerzielle Anwendung" : "Test project — not a commercial application"}
        </div>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
            {de ? "Angaben gemäß § 5 TMG" : "Information according to § 5 TMG"}
          </h2>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-text-primary, #333)" }}>
            <p style={{ margin: "0 0 4px" }}><strong>Joachim Fasching</strong></p>
            <p style={{ margin: "0 0 4px" }}>free-agents.io</p>
            <p style={{ margin: "0 0 16px" }}>
              E-Mail:{" "}
              <a href="mailto:joachim@free-agents.io" style={{ color: "#4F46E5", textDecoration: "none" }}>
                joachim@free-agents.io
              </a>
            </p>
          </div>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
            {de ? "Projekthinweis" : "Project Disclaimer"}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary, #333)", margin: 0 }}>
            {de
              ? "Das Strategic Intelligence System (SIS) ist ein experimentelles Test- und Forschungsprojekt. Es dient der Erprobung von KI-gestützter strategischer Analyse und stellt kein kommerzielles Produkt dar. Alle generierten Analysen, Szenarien und Empfehlungen sind maschinell erstellt und nicht redaktionell verifiziert. Sie stellen keine Beratung dar und sollten nicht als Grundlage für geschäftliche Entscheidungen verwendet werden."
              : "The Strategic Intelligence System (SIS) is an experimental test and research project. It serves to explore AI-assisted strategic analysis and is not a commercial product. All generated analyses, scenarios, and recommendations are machine-generated and not editorially verified. They do not constitute advice and should not be used as a basis for business decisions."}
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
            {de ? "Technologie" : "Technology"}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary, #333)", margin: 0 }}>
            {de
              ? "SIS nutzt die Anthropic Claude API für KI-basierte Analysen. Die Verarbeitung erfolgt auf Servern von Anthropic (USA). Eingegebene Abfragen werden an die API übermittelt. Es werden keine personenbezogenen Daten erhoben oder gespeichert."
              : "SIS uses the Anthropic Claude API for AI-based analysis. Processing occurs on Anthropic servers (USA). Submitted queries are sent to the API. No personal data is collected or stored."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
            {de ? "Haftungsausschluss" : "Disclaimer"}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary, #333)", margin: 0 }}>
            {de
              ? "Die Inhalte werden maschinell generiert. Trotz sorgfältiger Auswahl der Datenquellen (57 Konnektoren) und Validierung (Zod-Schema, Anti-Halluzinations-Pipeline) kann keine Gewähr für Richtigkeit, Vollständigkeit oder Aktualität der generierten Analysen übernommen werden."
              : "Content is machine-generated. Despite careful selection of data sources (57 connectors) and validation (Zod schema, anti-hallucination pipeline), no guarantee can be given for the accuracy, completeness, or timeliness of generated analyses."}
          </p>
        </section>
      </main>
    </>
  );
}
