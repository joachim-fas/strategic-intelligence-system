/**
 * ConfidenceBadge — canonical confidence tier badge.
 *
 * Welle A Item 2 of the 4-app Deep-Dive: Delphi-inspired confidence badges
 * on every trend card and briefing statement. Trust-Hebel. The pattern is
 * directly lifted from Delphi's per-fact confidence scores (0.95–0.99 in
 * their demo snippets); SIS uses three tiers (High / Medium / Low) backed
 * by the signal-positive/neutral/negative CSS classes in globals.css so
 * the badge integrates with the existing Volt UI language.
 *
 * Design decisions:
 *   - Accepts either a normalised 0..1 value or a 0..100 percentage
 *     (auto-detected by `value > 1`). Callers don't need to pre-normalise.
 *   - Tier boundaries are ≥ 0.70 (high), ≥ 0.40 (medium), < 0.40 (low).
 *     These match the existing `ConfidenceBadge` in `DetailPanel.tsx`
 *     (which this component replaces) so no visual regression.
 *   - Compact `size="xs"` drops font-size to 9 px for tight places like
 *     card footers; `size="sm"` (default) matches the DetailPanel and
 *     briefing usage.
 *   - Bilingual label via `useT()`. Hover tooltip explains the tier so
 *     users understand what "72 % Konfidenz" actually means.
 *   - `showLabel={false}` renders a percent-only badge when the context
 *     (e.g. "Konfidenz" row header) already provides the label.
 *
 * Where used:
 *   - DetailPanel (card-level synthesis confidence)
 *   - VoltTrendCard (trend card footer)
 *   - BriefingResult / SynthesisBlock (per-statement confidence, future)
 */

"use client";

import React from "react";
import { Tooltip } from "./Tooltip";
import { useT } from "@/lib/locale-context";

export type ConfidenceTier = "high" | "medium" | "low";

export interface ConfidenceBadgeProps {
  /** 0..1 or 0..100 — auto-detected. NaN / non-finite normalised to 0. */
  value: number;
  /** Visual footprint. `xs` for card footers, `sm` for panels. */
  size?: "xs" | "sm";
  /** Whether to suffix the percent with "Konfidenz" / "Confidence". */
  showLabel?: boolean;
  /** Extra className merged onto the badge span. */
  className?: string;
}

/**
 * Normalise the incoming value to a 0..100 integer percent. Accepts both
 * 0..1 (probability) and 0..100 (percentage) inputs.
 */
function toPercent(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  const safe = value > 1 ? value / 100 : value;
  return Math.round(Math.min(1, Math.max(0, safe)) * 100);
}

function tierOf(pct: number): ConfidenceTier {
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

const TIER_CLASS: Record<ConfidenceTier, string> = {
  high: "signal-positive-badge",
  medium: "signal-neutral-badge",
  low: "signal-negative-badge",
};

export function ConfidenceBadge({
  value,
  size = "sm",
  showLabel = true,
  className,
}: ConfidenceBadgeProps) {
  const { t, locale } = useT();
  const pct = toPercent(value);
  const tier = tierOf(pct);
  const cls = TIER_CLASS[tier];
  const de = locale === "de";

  // Tier-aware tooltip copy. Users need to know what "72 % Konfidenz"
  // actually means for the underlying assessment. Copy lifted directly
  // from the methodology page explanations so the vocabulary stays
  // consistent with how SIS documents its scoring.
  const tierHint = de
    ? tier === "high"
      ? "Hohe Konfidenz — breite Datenbasis, starke Übereinstimmung."
      : tier === "medium"
      ? "Mittlere Konfidenz — Datenbasis tragfähig, aber nicht abgesichert."
      : "Niedrige Konfidenz — dünne Datenbasis, kritisch lesen."
    : tier === "high"
    ? "High confidence — broad data basis, strong agreement."
    : tier === "medium"
    ? "Medium confidence — data basis viable but not fully corroborated."
    : "Low confidence — thin data basis, read critically.";

  const style: React.CSSProperties = {
    fontSize: size === "xs" ? 9 : 10,
    padding: size === "xs" ? "1px 6px" : "2px 7px",
    cursor: "help",
  };

  return (
    <Tooltip content={tierHint} placement="top" delay={280} maxWidth={220}>
      <span
        className={[cls, className].filter(Boolean).join(" ")}
        style={style}
        aria-label={`${pct}% ${t("detail.confidence")} — ${tierHint}`}
      >
        {pct}%{showLabel ? ` ${t("detail.confidence")}` : ""}
      </span>
    </Tooltip>
  );
}

export default ConfidenceBadge;
