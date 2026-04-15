"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { Locale } from "@/lib/i18n";
import type { PipelineStage } from "@/lib/intelligence-engine";

export interface PipelineStageState {
  status: "pending" | "active" | "done";
  count?: number;
}

export type PipelineStageMap = Record<PipelineStage, PipelineStageState>;

/**
 * Initial/default state for the 7-stage pipeline.
 * Frage is done the moment the user submits; everything else starts pending.
 */
export function defaultPipelineStages(): PipelineStageMap {
  return {
    frage: { status: "done" },
    signale: { status: "pending" },
    trends: { status: "pending" },
    kausal: { status: "pending" },
    erkenntnisse: { status: "pending" },
    szenarien: { status: "pending" },
    empfehlungen: { status: "pending" },
  };
}

const STAGE_ORDER: PipelineStage[] = [
  "frage",
  "signale",
  "trends",
  "kausal",
  "erkenntnisse",
  "szenarien",
  "empfehlungen",
];

const STAGE_LABELS: Record<PipelineStage, { de: string; en: string }> = {
  frage:        { de: "Frage",         en: "Query" },
  signale:      { de: "Signale",       en: "Signals" },
  trends:       { de: "Trends",        en: "Trends" },
  kausal:       { de: "Kausalitäten",  en: "Causal chains" },
  erkenntnisse: { de: "Erkenntnisse",  en: "Insights" },
  szenarien:    { de: "Szenarien",     en: "Scenarios" },
  empfehlungen: { de: "Empfehlungen",  en: "Recommendations" },
};

const STAGE_HINT: Record<PipelineStage, { de: string; en: string }> = {
  frage:        { de: "Anfrage erfasst",                       en: "Query captured" },
  signale:      { de: "Live-Quellen werden abgeglichen",       en: "Matching live sources" },
  trends:       { de: "Relevante Trends werden zugeordnet",    en: "Mapping relevant trends" },
  kausal:       { de: "Kausalketten werden gezogen",           en: "Deriving causal chains" },
  erkenntnisse: { de: "Strategische Erkenntnisse formuliert",  en: "Forming strategic insights" },
  szenarien:    { de: "Szenarien und Wahrscheinlichkeiten",    en: "Scenarios and probabilities" },
  empfehlungen: { de: "Entscheidungsrahmen fertigstellen",     en: "Finalising decision framework" },
};

/**
 * SequentialPipeline — progressive reveal of the 7-stage LLM pipeline.
 *
 * Unlike the earlier time-based ReasoningTrace (which was cosmetic), this
 * component is driven by real streaming milestones: each stage's status flips
 * from "pending" → "active" → "done" as the LLM's JSON output crosses the
 * respective marker. Counts surface when a stage completes.
 */
export function SequentialPipeline({
  stages,
  query,
  locale,
}: {
  stages: PipelineStageMap;
  query: string;
  locale: Locale;
}) {
  const de = locale === "de";
  const shortQuery = query.length > 48 ? query.slice(0, 48) + "…" : query;

  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.55,
      padding: "14px 16px", borderRadius: 8,
      background: "var(--color-surface, #F7F7F5)",
      border: "1px solid var(--volt-border, #EBEBEB)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {STAGE_ORDER.map((stage, i) => {
        const state = stages[stage];
        const isDone = state.status === "done";
        const isActive = state.status === "active";
        const isPending = state.status === "pending";
        const label = de ? STAGE_LABELS[stage].de : STAGE_LABELS[stage].en;
        const hint = de ? STAGE_HINT[stage].de : STAGE_HINT[stage].en;
        const indexStr = String(i + 1).padStart(2, "0");

        // For the Frage stage, surface the query text itself as the "count"
        // — it's the most informative thing we can show at that step.
        const detail = stage === "frage"
          ? shortQuery
          : typeof state.count === "number" && state.count > 0
            ? `${state.count}`
            : isDone && typeof state.count === "number"
              ? "—"
              : "";

        return (
          <div key={stage} style={{
            display: "flex", alignItems: "center", gap: 10,
            opacity: isPending ? 0.32 : 1,
            transition: "opacity 0.35s ease",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 600, color: "var(--volt-text-faint, #9B9B9B)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
              flexShrink: 0, width: 18,
            }}>
              {indexStr}
            </span>
            <span style={{
              width: 14, height: 14, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {isDone ? (
                <Check size={14} strokeWidth={2.5} color="var(--signal-positive, #1A9E5A)" />
              ) : isActive ? (
                <Loader2 size={14} strokeWidth={2.25} color="var(--volt-text, #0A0A0A)" style={{ animation: "sis-spin 1s linear infinite" }} />
              ) : (
                <Circle size={12} strokeWidth={2} color="var(--volt-text-faint, #C8C8C8)" />
              )}
            </span>
            <span style={{
              color: isDone ? "var(--volt-text-faint, #9B9B9B)"
                   : isActive ? "var(--volt-text, #0A0A0A)"
                   : "var(--volt-text-faint, #C8C8C8)",
              fontWeight: isActive ? 600 : 500,
              flexShrink: 0,
              minWidth: 110,
              transition: "color 0.25s ease",
            }}>
              {label}
            </span>
            <span style={{
              flex: 1, minWidth: 0,
              color: isPending ? "var(--volt-text-faint, #C8C8C8)" : "var(--volt-text-muted, #6B6B6B)",
              fontSize: 11,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontStyle: stage === "frage" ? "normal" : "italic",
            }}>
              {stage === "frage" ? detail : hint}
            </span>
            {detail && stage !== "frage" && (
              <span style={{
                flexShrink: 0, padding: "1px 7px", borderRadius: 10,
                fontSize: 10, fontWeight: 700,
                background: isDone ? "var(--signal-positive-light, #DCFCE7)"
                         : isActive ? "var(--volt-lime, #E4FF97)"
                         : "transparent",
                color: isDone ? "var(--signal-positive-text, #14532D)"
                     : isActive ? "#0A0A0A"
                     : "var(--volt-text-faint, #C8C8C8)",
                fontFamily: "var(--font-mono)",
                minWidth: 26, textAlign: "center",
                transition: "background 0.25s ease, color 0.25s ease",
              }}>
                {detail}
              </span>
            )}
          </div>
        );
      })}
      <style>{`@keyframes sis-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
