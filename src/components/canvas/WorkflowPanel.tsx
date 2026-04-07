"use client";

import React, { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "done" | "locked";
  queryTemplate: string;
  dependsOn: number[];
  userInputPrompt?: string;
  userInput?: string;
  synthesis?: string;
  queryNodeId?: string;
}

export interface WorkflowState {
  frameworkId: string;
  frameworkName: string;
  methodology: string;
  topic: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
}

interface WorkflowPanelProps {
  workflow: WorkflowState;
  onStartStep: (stepIndex: number, userContext?: string) => void;
  onClose: () => void;
}

// ─── Status Icons ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  done:    { icon: "✓", color: "var(--pastel-mint-text, #0F6038)", bg: "var(--pastel-mint, #C3F4D3)", label: "Erledigt" },
  running: { icon: "⟳", color: "var(--pastel-sky-text, #1A4A8A)", bg: "var(--pastel-sky, #D4E8FF)", label: "Läuft..." },
  pending: { icon: "○", color: "var(--volt-text-muted, #6B7280)", bg: "var(--color-surface-2, #F3F4F6)", label: "Bereit" },
  locked:  { icon: "🔒", color: "var(--volt-text-faint, #9CA3AF)", bg: "var(--color-surface, #F9FAFB)", label: "Gesperrt" },
};

// ─── WorkflowPanel ───────────────────────────────────────────────────────────

export function WorkflowPanel({ workflow, onStartStep, onClose }: WorkflowPanelProps) {
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const { steps, currentStepIndex, frameworkName, methodology, topic } = workflow;
  const doneCount = steps.filter(s => s.status === "done").length;
  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;

  return (
    <div style={{
      width: 420, height: "100%", borderLeft: "1px solid var(--color-border)",
      background: "var(--color-surface)", display: "flex", flexDirection: "column",
      overflowY: "auto", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
              {frameworkName}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-heading)", lineHeight: 1.3 }}>
              {topic}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "var(--color-text-muted)", cursor: "pointer", padding: "0 4px" }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--color-text-muted)", marginBottom: 4 }}>
            <span>{doneCount}/{steps.length} Schritte</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--signal-positive, #1A9E5A)", borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Methodology hint */}
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5, padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 6 }}>
          {methodology}
        </div>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {steps.map((step, i) => {
          const cfg = STATUS_CFG[step.status];
          const isActive = i === currentStepIndex && step.status !== "done";
          const isExpanded = expandedStep === i || isActive;
          const canStart = step.status === "pending" && step.dependsOn.every(d => steps[d]?.status === "done");

          return (
            <div key={step.id} style={{
              padding: "0 20px", marginBottom: 4,
            }}>
              {/* Step header */}
              <div
                onClick={() => setExpandedStep(isExpanded ? null : i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, cursor: "pointer", transition: "background 0.1s",
                  background: isActive ? "color-mix(in srgb, var(--volt-lime, #E4FF97) 9%, transparent)" : "transparent",
                  border: isActive ? "1px solid #E4FF9766" : "1px solid transparent",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Step number + status */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: step.status === "done" ? 12 : 11, fontWeight: 700,
                  background: cfg.bg, color: cfg.color, flexShrink: 0,
                  border: isActive ? "2px solid #E4FF97" : `1px solid ${cfg.color}30`,
                }}>
                  {step.status === "done" ? cfg.icon : i + 1}
                </div>

                {/* Title + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: step.status === "locked" ? "var(--color-text-muted)" : "var(--color-text-heading)" }}>
                    {step.title}
                  </div>
                  {!isExpanded && (
                    <div style={{ fontSize: 10, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {step.status === "done" ? (step.synthesis?.slice(0, 60) + "…") : step.description}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                  {cfg.label}
                </span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "8px 12px 12px 50px" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                    {step.description}
                  </div>

                  {/* Show previous context if available */}
                  {step.dependsOn.length > 0 && step.dependsOn.some(d => steps[d]?.synthesis) && (
                    <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(37,99,235,0.04)", borderRadius: 6, border: "1px solid rgba(37,99,235,0.1)" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--pastel-sky-text, #2563EB)", textTransform: "uppercase", marginBottom: 4 }}>
                        Kontext aus vorherigen Schritten
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5, maxHeight: 100, overflowY: "auto" }}>
                        {step.dependsOn.map(d => steps[d]?.synthesis).filter(Boolean).join("\n\n").slice(0, 300)}
                        {step.dependsOn.map(d => steps[d]?.synthesis).filter(Boolean).join("").length > 300 ? "…" : ""}
                      </div>
                    </div>
                  )}

                  {/* User input field */}
                  {step.userInputPrompt && step.status !== "done" && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-heading)", display: "block", marginBottom: 4 }}>
                        {step.userInputPrompt}
                      </label>
                      <textarea
                        value={userInputs[i] ?? ""}
                        onChange={e => setUserInputs(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Dein spezifischer Kontext (optional)..."
                        rows={3}
                        style={{
                          width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 6,
                          border: "1px solid var(--color-border)", background: "transparent",
                          color: "var(--color-text-primary)", outline: "none", resize: "vertical",
                          fontFamily: "inherit", lineHeight: 1.5,
                        }}
                      />
                    </div>
                  )}

                  {/* Result (if done) */}
                  {step.status === "done" && step.synthesis && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6, padding: "10px 12px", background: "rgba(26,158,90,0.04)", borderRadius: 6, border: "1px solid rgba(26,158,90,0.1)", maxHeight: 200, overflowY: "auto" }}>
                      {step.synthesis}
                    </div>
                  )}

                  {/* Action buttons */}
                  {step.status === "running" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 14, height: 14, border: "2px solid #2563EB", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ fontSize: 12, color: "var(--pastel-sky-text, #2563EB)", fontWeight: 500 }}>Analyse läuft...</span>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {canStart && step.status === "pending" && (
                    <button
                      onClick={() => onStartStep(i, userInputs[i])}
                      style={{
                        width: "100%", fontSize: 13, fontWeight: 600, padding: "10px 16px",
                        borderRadius: 8, border: "none",
                        background: "var(--color-text-heading)", color: "white",
                        cursor: "pointer", transition: "opacity 0.12s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                    >
                      Analyse starten →
                    </button>
                  )}

                  {step.status === "locked" && (
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                      Wartet auf: {step.dependsOn.map(d => steps[d]?.title).join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — summary when all done */}
      {doneCount === steps.length && steps.length > 0 && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--signal-positive, #1A9E5A)", marginBottom: 4 }}>
            ✓ Alle {steps.length} Schritte abgeschlossen
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Die Ergebnisse sind als Karten im Canvas sichtbar. Du kannst das Panel schließen und frei weiterarbeiten.
          </div>
        </div>
      )}
    </div>
  );
}
