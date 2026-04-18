/**
 * Shared signal-freshness thresholds.
 *
 * Why this exists
 * ───────────────
 * Three call sites encoded three different thresholds for the same
 * concept:
 *
 *   - ActivityPanel (`recencyScore`)        — green ≤ 6 h, amber ≤ 24 h
 *   - /api/v1/sources/status                — stale when newest > 12 h
 *   - /cockpit page freshness banner        — stale when newest > 24 h
 *
 * A connector could legitimately be green in one surface and orange
 * in another — audit finding A3-M2 (2026-04) flagged this as an
 * honesty problem ("users can't tell which number to trust"). A
 * single constant makes the staleness bar consistent across every
 * surface that reads signals.
 *
 * Semantics
 * ─────────
 *   OK_HOURS    — still "fresh"; render as green / positive
 *   WARN_HOURS  — "stale but not dead"; render as amber / neutral
 *   anything beyond WARN_HOURS — surface as red / broken
 *
 * Importers should use {@link freshnessTier} for a consistent
 * 3-bucket classification and {@link isStale} / {@link isOk} for
 * simple boolean gates.
 */

export const FRESHNESS_THRESHOLDS = {
  /** Still fresh enough to trust as "current". */
  OK_HOURS: 6,
  /** Stale-but-visible; explain it in the UI. */
  WARN_HOURS: 24,
} as const;

export type FreshnessTier = "ok" | "warn" | "stale";

/** Classify an age-in-hours into one of three tiers. */
export function freshnessTier(ageHours: number): FreshnessTier {
  if (ageHours <= FRESHNESS_THRESHOLDS.OK_HOURS) return "ok";
  if (ageHours <= FRESHNESS_THRESHOLDS.WARN_HOURS) return "warn";
  return "stale";
}

/** True when the signal is past the WARN cutoff. */
export function isStale(ageHours: number): boolean {
  return ageHours > FRESHNESS_THRESHOLDS.WARN_HOURS;
}

/** True when the signal is within the OK cutoff. */
export function isOk(ageHours: number): boolean {
  return ageHours <= FRESHNESS_THRESHOLDS.OK_HOURS;
}

/** Display colour tokens matching the three tiers, for inline styles. */
export const FRESHNESS_COLOR: Record<FreshnessTier, string> = {
  ok: "#059669",   // emerald
  warn: "#D97706", // amber
  stale: "#DC2626", // red
};
