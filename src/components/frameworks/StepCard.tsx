"use client";

import React from "react";
import { StepResult } from "@/lib/use-framework-analysis";

interface StepCardProps {
  stepId: string;
  title: string;
  description: string;
  accentColor: string;
  borderColor: string;
  result?: StepResult;
  onRun: () => void;
  disabled?: boolean;
  children?: React.ReactNode; // custom visualization when done
  de?: boolean;
}

export function StepCard({ stepId, title, description, accentColor, borderColor, result, onRun, disabled, children, de }: StepCardProps) {
  const status = result?.status || "idle";

  return (
    <div style={{
      border: `1px solid ${status === "done" ? borderColor : "var(--border)"}`,
      borderRadius: 14,
      background: status === "done" ? `${borderColor}08` : "var(--card)",
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: status === "done" || status === "running" ? `1px solid ${borderColor}30` : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StepIndicator status={status} color={accentColor} />
          <div>
            <div style={{
              fontSize: 14, fontWeight: 600,
              fontFamily: "var(--font-display)",
              color: "var(--foreground)",
            }}>
              {title}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
              {description}
            </div>
          </div>
        </div>

        {status === "idle" && (
          <button
            onClick={onRun}
            disabled={disabled}
            style={{
              fontSize: 12, fontWeight: 600,
              padding: "6px 14px", borderRadius: 8,
              border: "none",
              background: disabled ? "var(--muted)" : accentColor,
              color: disabled ? "var(--muted-foreground)" : "#fff",
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "var(--font-ui)",
              transition: "all 0.15s",
            }}
          >
            {de ? "Starten" : "Run"} →
          </button>
        )}

        {status === "done" && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: accentColor,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            ✓ {de ? "Fertig" : "Done"}
          </span>
        )}
      </div>

      {/* Running: show streaming text */}
      {status === "running" && (
        <div style={{
          padding: "14px 18px",
          fontSize: 12, lineHeight: 1.7,
          color: "var(--muted-foreground)",
          fontFamily: "var(--font-mono)",
          maxHeight: 240, overflow: "auto",
          whiteSpace: "pre-wrap",
        }}>
          {result?.statusMessage && (
            <div style={{
              fontSize: 10, color: accentColor, marginBottom: 8,
              textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700,
            }}>
              ⚡ {result.statusMessage}
            </div>
          )}
          <span className="animate-pulse" style={{ marginRight: 6 }}>●</span>
          {result?.rawText && result.rawText.length > 0
            ? result.rawText.slice(-400)
            : (de ? "Modell antwortet…" : "Waiting for response…")}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{
          padding: "14px 18px",
          fontSize: 12, color: "var(--destructive)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>⚠</span>
          <span>{result?.error || (de ? "Fehler bei der Analyse" : "Analysis error")}</span>
          <button
            onClick={onRun}
            style={{
              marginLeft: "auto", fontSize: 11, fontWeight: 600,
              padding: "4px 10px", borderRadius: 6,
              border: `1px solid var(--destructive)`,
              background: "transparent", color: "var(--destructive)",
              cursor: "pointer",
            }}
          >
            {de ? "Erneut" : "Retry"}
          </button>
        </div>
      )}

      {/* Done: show structured result + optional visualization */}
      {status === "done" && result?.data && (
        <div style={{ padding: "14px 18px" }}>
          {children || <DefaultResult data={result.data} />}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ status, color }: { status: string; color: string }) {
  const size = 24;
  if (status === "done") {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "#fff", fontWeight: 700,
      }}>✓</div>
    );
  }
  if (status === "running") {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div className="animate-spin" style={{
          width: 12, height: 12, border: `2px solid ${color}`,
          borderTopColor: "transparent", borderRadius: "50%",
        }} />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "var(--destructive)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "#fff",
      }}>!</div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: "2px solid var(--border)",
      background: "var(--muted)",
    }} />
  );
}

function DefaultResult({ data }: { data: any }) {
  if (!data) return null;
  const synthesis = data.synthesis || data.description || "";

  return (
    <div>
      {synthesis && (
        <p style={{
          fontSize: 13, lineHeight: 1.7, color: "var(--foreground)",
          marginBottom: 12,
        }}>
          {synthesis}
        </p>
      )}
    </div>
  );
}
