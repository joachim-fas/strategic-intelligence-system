"use client";

/**
 * /sessions — Active strategic sessions (the workspace).
 *
 * Hero + subnav (Aktiv | Archiv) + SessionList.
 * The archive list lives at /sessions/archiv and shares SessionList.
 */

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { SessionList } from "@/components/sessions/SessionList";
import { SessionsSubNav } from "@/components/sessions/SessionsSubNav";

export default function SessionsPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [creating, setCreating] = useState(false);

  const createNewSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: de ? "Neue Session" : "New Session" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const id = json?.canvas?.id;
      if (id) {
        try { localStorage.setItem("sis-active-canvas", id); } catch {}
        window.location.href = `/canvas?project=${id}`;
      }
    } catch (e) {
      console.error("[createNewSession]", e);
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* Hero */}
      <div style={{
        borderBottom: "1px solid var(--volt-border, #E8E8E8)",
        background: "var(--volt-surface-raised, #fff)",
      }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 24px 0" }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--volt-text-faint, #AAA)",
            marginBottom: 10,
          }}>
            {de ? "Deine strategischen Sessions" : "Your strategic sessions"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--volt-text, #0A0A0A)", margin: 0, lineHeight: 1.15,
            }}>
              Sessions
            </h1>
            <button
              onClick={createNewSession}
              disabled={creating}
              className={creating ? "" : "sis-shimmer-btn"}
              style={{
                fontSize: 13, fontWeight: 600, height: 38, padding: "0 18px",
                borderRadius: "var(--volt-radius-md, 10px)",
                background: creating ? "var(--volt-surface, #F7F7F7)" : "var(--volt-lime, #E4FF97)",
                color: creating ? "var(--volt-text-muted)" : "#0A0A0A",
                border: "none", cursor: creating ? "wait" : "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              }}
            >
              {creating ? (de ? "Erstelle…" : "Creating…") : (de ? "+ Neue Session" : "+ New Session")}
            </button>
          </div>
          <p style={{
            fontSize: 13, lineHeight: 1.55, color: "var(--volt-text-muted, #6B6B6B)",
            margin: "12px 0 20px", maxWidth: 620,
          }}>
            {de
              ? "Jede Session ist ein zusammenhängender strategischer Arbeitsstrang — Fragen, Nodes, Szenarien, Entscheidungen. Klicke eine Session an, um im Node Canvas weiterzuarbeiten."
              : "Each session is a connected strand of strategic work — questions, nodes, scenarios, decisions. Click a session to continue working in the Node Canvas."}
          </p>

          <SessionsSubNav active="active" de={de} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 1360, margin: "0 auto", width: "100%", padding: "32px 24px 80px" }}>
        <SessionList mode="active" de={de} />
      </div>
    </div>
  );
}
