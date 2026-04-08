"use client";

/**
 * /verstehen/methodik — Full-page methodology explainer.
 *
 * Nested under /verstehen so it conceptually belongs to the Knowledge Cockpit
 * without cluttering the main navigation. Reached via the "Methodik" link in
 * the Cockpit hero. Purpose: trust building through radical transparency about
 * how the SIS turns raw signals into classified trends.
 *
 * This is a normal route — NOT an overlay, NOT a modal. The user navigates
 * here, reads, and navigates back via the breadcrumb link or the footer CTA.
 */

import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { MethodikContent } from "@/components/verstehen/MethodikContent";

export default function MethodikPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* Breadcrumb back link */}
      <div style={{
        borderBottom: "1px solid var(--volt-border, #E8E8E8)",
        background: "var(--volt-surface-raised, #fff)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 24px" }}>
          <a
            href="/verstehen"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12,
              color: "var(--volt-text-muted, #6B6B6B)",
              textDecoration: "none",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--volt-text, #0A0A0A)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--volt-text-muted, #6B6B6B)"; }}
          >
            <span style={{ fontSize: 14 }}>←</span>
            <span>{de ? "Zurück zum Knowledge Cockpit" : "Back to Knowledge Cockpit"}</span>
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "48px 32px 40px" }}>
        <MethodikContent de={de} />
      </div>

      {/* Footer CTA */}
      <div style={{
        borderTop: "1px solid var(--volt-border, #E8E8E8)",
        background: "var(--volt-surface, #FAFAFA)",
        padding: "32px 24px",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{
            fontSize: 13, lineHeight: 1.55,
            color: "var(--volt-text-muted, #6B6B6B)",
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            maxWidth: 560,
          }}>
            {de
              ? "Offene Fragen, Einwände oder Verbesserungsvorschläge zur Methodik? Die Transparenz-Schuld ist dein Hebel — sag es uns."
              : "Open questions, objections, or methodology suggestions? Transparency debt is your leverage — tell us."}
          </div>
          <a
            href="/verstehen"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 13, fontWeight: 600,
              padding: "10px 22px",
              borderRadius: "var(--volt-radius-md, 10px)",
              background: "var(--volt-lime, #E4FF97)",
              color: "#0A0A0A",
              textDecoration: "none",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              border: "none",
            }}
          >
            {de ? "Zurück zum Cockpit" : "Back to Cockpit"} →
          </a>
        </div>
      </div>
    </div>
  );
}
