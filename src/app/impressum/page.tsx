"use client";

import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";

export default function ImpressumPage() {
  const { t } = useT();

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
            {t("impressum.testProjectTitle")}
          </div>
          <p style={{
            fontSize: 13, lineHeight: 1.6,
            color: "#92400E",
            margin: 0,
          }}>
            {t("impressum.testProjectBody")}
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
            {t("impressum.tmgHeading")}
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
            {t("impressum.technologyHeading")}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary, #333)", margin: 0 }}>
            {t("impressum.technologyBody")}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
            {t("impressum.disclaimerHeading")}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary, #333)", margin: 0 }}>
            {t("impressum.disclaimerBody")}
          </p>
        </section>
      </main>
    </>
  );
}
