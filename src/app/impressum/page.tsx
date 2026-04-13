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
        {/* Prominent test-project banner */}
        <div style={{
          padding: "20px 24px",
          borderRadius: 12,
          background: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.2)",
          marginBottom: 40,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: "#B45309",
            marginBottom: 6,
            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          }}>
            {de ? "Experimentelles Test-Projekt" : "Experimental Test Project"}
          </div>
          <p style={{
            fontSize: 13, lineHeight: 1.6,
            color: "#92400E",
            margin: 0,
          }}>
            {de
              ? "Das Strategic Intelligence System (SIS) ist ein experimentelles Forschungsprojekt. Es dient der Erprobung von KI-gestützter strategischer Analyse und stellt kein kommerzielles Produkt dar. Alle generierten Analysen, Szenarien und Empfehlungen sind maschinell erstellt, nicht redaktionell verifiziert und stellen keine Beratung dar."
              : "The Strategic Intelligence System (SIS) is an experimental research project. It serves to explore AI-assisted strategic analysis and is not a commercial product. All generated analyses, scenarios, and recommendations are machine-generated, not editorially verified, and do not constitute advice."}
          </p>
        </div>

        <h1 style={{
          fontSize: 28, fontWeight: 700,
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          color: "var(--color-text-heading, #0A0A0A)",
          marginBottom: 32,
        }}>
          Impressum
        </h1>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
            {de ? "Angaben gemäß § 5 TMG" : "Information according to § 5 TMG"}
          </h2>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-text-primary, #333)" }}>
            <p style={{ margin: "0 0 4px" }}><strong>Joachim Unterberger</strong></p>
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
              ? "Die Inhalte werden maschinell generiert. Trotz sorgfältiger Auswahl der Datenquellen und Validierung kann keine Gewähr für Richtigkeit, Vollständigkeit oder Aktualität der generierten Analysen übernommen werden."
              : "Content is machine-generated. Despite careful selection of data sources and validation, no guarantee can be given for the accuracy, completeness, or timeliness of generated analyses."}
          </p>
        </section>
      </main>
    </>
  );
}
