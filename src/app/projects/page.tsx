"use client";

/**
 * /projects — Active strategic projects (the workspace).
 *
 * Hero + subnav (Aktiv | Archiv) + SessionList.
 * The archive list lives at /projects/archive and shares SessionList.
 */

import { useState } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { useActiveTenantId } from "@/lib/tenant-context";
import { tenantStorage, TENANT_STORAGE_KEYS } from "@/lib/tenant-storage";
import { SessionList } from "@/components/sessions/SessionList";
import { SessionsSubNav } from "@/components/sessions/SessionsSubNav";

export default function ProjectsPage() {
  const { t, de } = useT();
  const activeTenantId = useActiveTenantId();
  const [creating, setCreating] = useState(false);

  const createNewSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetchWithTimeout("/api/v1/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t("sessions.newProjectName") }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const id = (json.data ?? json)?.canvas?.id;
      if (id) {
        if (activeTenantId) tenantStorage.set(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas, id);
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
            {t("sessions.heroCaption")}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--volt-text, #0A0A0A)", margin: 0, lineHeight: 1.15,
            }}>
              {t("sessions.projects")}
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
              {creating ? t("sessions.newProjectCreating") : t("sessions.newProjectButton")}
            </button>
          </div>
          <p style={{
            fontSize: 14, lineHeight: 1.55, color: "var(--volt-text-muted, #6B6B6B)",
            margin: "12px 0 20px", maxWidth: 620,
          }}>
            {t("sessions.heroBody")}
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
