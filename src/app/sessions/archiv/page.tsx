"use client";

/**
 * /sessions/archiv — Archived strategic sessions.
 *
 * Shares hero structure and sub-nav with /sessions. Uses SessionList in
 * mode="archived" which fetches `/api/v1/canvas?archived=true` and provides
 * restore + delete row actions.
 */

import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { SessionList } from "@/components/sessions/SessionList";
import { SessionsSubNav } from "@/components/sessions/SessionsSubNav";

export default function SessionsArchivePage() {
  const { locale } = useLocale();
  const de = locale === "de";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* Hero */}
      <div style={{
        borderBottom: "1px solid var(--volt-border, #E8E8E8)",
        background: "var(--volt-surface-raised, #fff)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "36px 32px 0" }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--volt-text-faint, #AAA)",
            marginBottom: 10,
          }}>
            {de ? "Abgeschlossene Arbeit" : "Completed work"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--volt-text, #0A0A0A)", margin: 0, lineHeight: 1.15,
            }}>
              {de ? "Projekt-Archiv" : "Project Archive"}
            </h1>
          </div>
          <p style={{
            fontSize: 14, lineHeight: 1.55, color: "var(--volt-text-muted, #6B6B6B)",
            margin: "12px 0 20px", maxWidth: 620,
          }}>
            {de
              ? "Abgeschlossene Projekte, die nicht mehr aktiv bearbeitet werden. Du kannst sie jederzeit wiederherstellen oder endgültig löschen."
              : "Completed projects that are no longer actively worked on. You can restore them at any time or delete them permanently."}
          </p>

          <SessionsSubNav active="archive" de={de} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "32px 32px 80px" }}>
        <SessionList mode="archived" de={de} />
      </div>
    </div>
  );
}
