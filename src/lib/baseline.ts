/**
 * Welford-style baseline statistics.
 *
 * Welle B Item 3 of the 4-app Deep-Dive. Worldmonitor uses Welford's
 * streaming variance algorithm to detect per-source signal-volume
 * anomalies. The key property: you get numerically-stable mean +
 * variance after a single pass with O(1) state per key. No need to
 * store raw samples, no catastrophic cancellation, and a new sample
 * updates the running statistics in a few arithmetic operations.
 *
 * Key shape
 * ─────────
 * Baselines are keyed per (metric, source, weekday, month). The
 * combined key lets "Reuters publishes a lot on Tuesdays in October"
 * be a different baseline from "Reuters publishes a lot on Sundays in
 * July" — so Sunday-low-signal isn't mis-flagged against a Tuesday
 * baseline. Key format:
 *
 *   "<metric>:<source>:<weekday(0-6)>:<month(1-12)>"
 *
 * Currently the only metric SIS tracks is `signal_count`, but the
 * schema is generic so future metrics (API response latency, trend
 * relevance density, etc.) can use the same table.
 *
 * Z-score thresholds (from Worldmonitor's `algorithms.mdx`):
 *   ≥ 1.5  → low anomaly
 *   ≥ 2.0  → medium anomaly
 *   ≥ 3.0  → high/critical anomaly
 *
 * Minimum sample size before any z-score can be trusted: 10. Fewer
 * samples and the variance estimate is too noisy to act on — we
 * report `null` for the z-score and let the caller fall back to a
 * "warming up" state.
 */

import { getSqliteHandle } from "@/db";

/**
 * In-flight sample added to the baseline for a given key. Returns
 * the new `(n, mean, m2)` state so callers can chain it into a
 * z-score query on the same sample for an immediate anomaly
 * assessment on the value they just wrote.
 */
export interface BaselineState {
  n: number;
  mean: number;
  m2: number;
  variance: number;
  stddev: number;
}

/** Minimum samples before we're willing to report a z-score. */
const MIN_SAMPLES = 10;

/**
 * Build the canonical baseline key. Lives in one place so the key
 * shape stays stable across callers; changing the shape requires a
 * schema migration (`baseline_stats.key` is the primary key).
 */
export function baselineKey(params: {
  metric: string;
  source: string;
  /** 0..6, JS Date.getDay() convention (0 = Sunday) */
  weekday: number;
  /** 1..12 */
  month: number;
}): string {
  return `${params.metric}:${params.source}:${params.weekday}:${params.month}`;
}

/** Convenience wrapper that reads the weekday + month off a Date. */
export function baselineKeyForDate(metric: string, source: string, at: Date = new Date()): string {
  return baselineKey({
    metric,
    source,
    weekday: at.getDay(),
    month: at.getMonth() + 1,
  });
}

/**
 * Online Welford update. Given the prior state and the new sample,
 * returns the updated state. Pure — no DB I/O, so it's trivially
 * testable in isolation.
 *
 * Reference: https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm
 */
export function welfordUpdate(
  prior: { n: number; mean: number; m2: number },
  sample: number,
): { n: number; mean: number; m2: number } {
  const n = prior.n + 1;
  const delta = sample - prior.mean;
  const mean = prior.mean + delta / n;
  const delta2 = sample - mean;
  const m2 = prior.m2 + delta * delta2;
  return { n, mean, m2 };
}

/**
 * Compute variance + stddev from Welford state. Uses the population
 * estimator (m2 / n) rather than sample estimator (m2 / (n - 1))
 * because once we have ≥10 samples the difference is negligible and
 * the population form avoids an edge case at n=1.
 */
export function welfordStats(state: { n: number; mean: number; m2: number }): BaselineState {
  const variance = state.n > 0 ? state.m2 / state.n : 0;
  return {
    n: state.n,
    mean: state.mean,
    m2: state.m2,
    variance,
    stddev: Math.sqrt(variance),
  };
}

/**
 * Add a sample to the baseline identified by `key`, upserting into
 * `baseline_stats`. Returns the updated state so callers can
 * immediately compute a z-score on the value they just wrote.
 *
 * Safe to call from a pipeline hot loop: one SELECT + one UPSERT per
 * call, both primary-key lookups on the small baseline table.
 */
export function updateBaseline(key: string, sample: number): BaselineState {
  if (!Number.isFinite(sample)) {
    throw new Error(`updateBaseline: non-finite sample for key ${key}`);
  }
  const db = getSqliteHandle();
  const row = db
    .prepare("SELECT n, mean, m2 FROM baseline_stats WHERE key = ?")
    .get(key) as { n: number; mean: number; m2: number } | undefined;

  const prior = row ?? { n: 0, mean: 0, m2: 0 };
  const next = welfordUpdate(prior, sample);

  db.prepare(
    `INSERT INTO baseline_stats (key, n, mean, m2, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       n = excluded.n,
       mean = excluded.mean,
       m2 = excluded.m2,
       updated_at = excluded.updated_at`,
  ).run(key, next.n, next.mean, next.m2);

  return welfordStats(next);
}

/**
 * Read the current baseline state for `key`. Returns `null` if the
 * key is unknown (first-ever sample).
 */
export function getBaseline(key: string): BaselineState | null {
  const db = getSqliteHandle();
  const row = db
    .prepare("SELECT n, mean, m2 FROM baseline_stats WHERE key = ?")
    .get(key) as { n: number; mean: number; m2: number } | undefined;
  if (!row) return null;
  return welfordStats(row);
}

/**
 * Compute the z-score of `sample` against the baseline at `key`.
 * Returns:
 *   - `null` if the baseline has fewer than MIN_SAMPLES observations
 *     (too noisy to trust).
 *   - `null` if stddev is 0 (a constant baseline — z is undefined).
 *   - A signed number otherwise (positive = above mean, negative =
 *     below mean).
 */
export function zScoreFor(key: string, sample: number): number | null {
  const state = getBaseline(key);
  if (!state) return null;
  if (state.n < MIN_SAMPLES) return null;
  if (state.stddev === 0) return null;
  return (sample - state.mean) / state.stddev;
}

/** Anomaly tier for a z-score, or null if the value is too small. */
export type AnomalyTier = "low" | "medium" | "high" | null;

/**
 * Tier the z-score using Worldmonitor's thresholds. Negative and
 * positive anomalies are treated symmetrically — a source with
 * unusually low volume is as signal-worthy as one with unusually
 * high volume (both suggest something is off).
 */
export function anomalyTier(z: number | null): AnomalyTier {
  if (z == null) return null;
  const abs = Math.abs(z);
  if (abs >= 3.0) return "high";
  if (abs >= 2.0) return "medium";
  if (abs >= 1.5) return "low";
  return null;
}
