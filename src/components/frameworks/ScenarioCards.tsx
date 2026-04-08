"use client";

import React, { useState } from "react";

interface Scenario {
  type: "optimistic" | "probable" | "pessimistic" | string;
  title: string;
  description: string;
  probability?: number;
  timeframe?: string;
  keyDrivers?: string[];
}

const SCENARIO_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  optimistic:  { bg: "#EEFAF4", border: "#90DCA8", text: "#0F6038", badge: "#C3F4D3" },
  probable:    { bg: "#EEF5FF", border: "#C0D8F4", text: "#1A4A8A", badge: "#D4E8FF" },
  pessimistic: { bg: "#FFF0F4", border: "#F4B8C8", text: "#A0244A", badge: "#FFD6E0" },
};

export function ScenarioCards({ scenarios, de }: { scenarios: Scenario[]; de?: boolean }) {
  const [active, setActive] = useState<string | null>(null);

  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 4,
      }}>
        {de ? "3-Szenarien-Modell" : "3-Scenario Model"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {scenarios.map((s, i) => {
          const colors = SCENARIO_COLORS[s.type] || SCENARIO_COLORS.probable;
          const isActive = active === `${i}`;
          return (
            <div
              key={i}
              onClick={() => setActive(isActive ? null : `${i}`)}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                background: colors.bg,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: colors.text, fontFamily: "var(--font-mono)",
                  background: colors.badge, padding: "2px 8px", borderRadius: 4,
                }}>
                  {s.type === "optimistic" ? (de ? "Optimistisch" : "Optimistic") :
                   s.type === "pessimistic" ? (de ? "Pessimistisch" : "Pessimistic") :
                   (de ? "Wahrscheinlich" : "Probable")}
                </span>
                {s.probability != null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, fontFamily: "var(--font-mono)" }}>
                    {Math.round(s.probability * (s.probability > 1 ? 1 : 100))}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
                {isActive ? s.description : (s.description?.slice(0, 120) + (s.description?.length > 120 ? "…" : ""))}
              </div>
              {isActive && s.keyDrivers && s.keyDrivers.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.keyDrivers.map((d, j) => (
                    <span key={j} style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: colors.badge, color: colors.text, fontWeight: 500,
                    }}>
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
