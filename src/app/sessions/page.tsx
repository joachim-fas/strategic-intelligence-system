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
        body: JSON.stringify({ name: de ? "Neues Projekt" : "New Project" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const id = (json.data ?? json)?.canvas?.id;
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
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "36px 32px 0" }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--volt-text-faint, #AAA)",
            marginBottom: 10,
          }}>
            {de ? "Deine strategischen Projekte" : "Your strategic projects"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--volt-text, #0A0A0A)", margin: 0, lineHeight: 1.15,
            }}>
              Projekte
            </h1>
            {/* Volt UI Primary Button: 14px/600, h-36, px-20, rounded-lg (8px), bg-lime, tracking-tight */}
            <button
              onClick={createNewSession}
              disabled={creating}
              className={creating ? "" : "sis-shimmer-btn"}
              style={{
                fontSize: 14, fontWeight: 600, height: 36, padding: "0 20px",
                borderRadius: 8,
                background: creating ? "var(--volt-surface, #F7F7F7)" : "#E4FF97",
                color: creating ? "var(--volt-text-muted)" : "#0A0A0A",
                border: "none", cursor: creating ? "wait" : "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                letterSpacing: "-0.025em",
                transition: "all 0.2s ease-out",
              }}
            >
              {creating ? (de ? "Erstelle…" : "Creating…") : (de ? "+ Neues Projekt" : "+ New Project")}
            </button>
          </div>
          <p style={{
            fontSize: 14, lineHeight: 1.55, color: "var(--volt-text-muted, #6B6B6B)",
            margin: "12px 0 20px", maxWidth: 620,
          }}>
            {de
              ? "Jedes Projekt ist ein zusammenhängender strategischer Arbeitsstrang — Fragen, Nodes, Szenarien, Entscheidungen. Klicke ein Projekt an, um im Node Canvas weiterzuarbeiten."
              : "Each project is a connected strand of strategic work — questions, nodes, scenarios, decisions. Click a project to continue working in the Node Canvas."}
          </p>

          <SessionsSubNav active="active" de={de} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "32px 32px 80px" }}>
        <SessionList mode="active" de={de} />
      </div>
    </div>
  );
}
