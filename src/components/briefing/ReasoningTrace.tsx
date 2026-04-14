"use client";

import { useState, useEffect } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { Locale } from "@/lib/i18n";

export function ReasoningTrace({ query, trendCount, locale }: {
  query: string;
  trendCount: number;
  locale: Locale;
}) {
  const de = locale === "de";
  const [activeStep, setActiveStep] = useState(0);
  const shortQuery = query.length > 32 ? query.slice(0, 32) + "…" : query;

  const steps = de ? [
    { label: `Scanne ${trendCount} Trend-Signale nach relevanten Clustern`, duration: 400 },
    { label: `Verifiziere Quellengewichtung für "${shortQuery}"`, duration: 500 },
    { label: `Aktiviere Kausalnetz und Systemdynamiken`, duration: 500 },
    { label: `Starte LLM-Synthese — tiefe strategische Analyse`, duration: 99999 },
  ] : [
    { label: `Scanning ${trendCount} trend signals for relevant clusters`, duration: 400 },
    { label: `Verifying source weights for "${shortQuery}"`, duration: 500 },
    { label: `Activating causal network and system dynamics`, duration: 500 },
    { label: `Starting LLM synthesis — deep strategic analysis`, duration: 99999 },
  ];

  useEffect(() => {
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((s, i) => {
      timers.push(setTimeout(() => setActiveStep(i), elapsed));
      elapsed += s.duration;
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6,
      padding: "14px 16px", borderRadius: 8,
      background: "var(--color-surface, #F7F7F5)", border: "1px solid var(--volt-border, #EBEBEB)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {steps.map((s, i) => {
        const isDone = activeStep > i;
        const isActive = activeStep === i;
        const isPending = activeStep < i;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            opacity: isPending ? 0.25 : 1,
            transition: "opacity 0.4s ease",
          }}>
            <span style={{
              width: 14, height: 14, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {isDone ? (
                <Check size={14} strokeWidth={2.5} color="var(--signal-positive, #1A9E5A)" />
              ) : isActive ? (
                <Loader2 size={14} strokeWidth={2.25} color="var(--volt-text, #0A0A0A)" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Circle size={12} strokeWidth={2} color="var(--volt-text-faint, #C8C8C8)" />
              )}
            </span>
            <span style={{
              color: isDone ? "var(--volt-text-faint, #9B9B9B)" : isActive ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-faint, #C8C8C8)",
              fontWeight: isActive ? 500 : 400,
              transition: "color 0.3s ease",
            }}>
              {s.label}
            </span>
          </div>
        );
      })}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
