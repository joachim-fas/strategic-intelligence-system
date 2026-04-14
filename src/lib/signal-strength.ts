/**
 * Signal Strength — dynamic computation based on signal data.
 *
 * Replaces hardcoded rawStrength values across connectors with a heuristic
 * that considers recency, source reliability, and data completeness.
 */

import type { RawSignal } from "@/connectors/types";

// ---------------------------------------------------------------------------
// Source reliability tiers
// ---------------------------------------------------------------------------

const SOURCE_RELIABILITY: Record<string, number> = {
  // Established / institutional sources — high base reliability
  nyt: 0.8,
  guardian: 0.75,
  crossref: 0.7,
  arxiv: 0.7,
  who_gho: 0.7,
  ilo: 0.7,
  un_sdg: 0.65,
  un_data: 0.65,
  owid: 0.7,
  vdem: 0.65,
  open_exchange: 0.6,
  open_meteo: 0.6,
  patentsview: 0.65,

  // News aggregators — moderate reliability
  newsdata: 0.55,
  news: 0.55,

  // Crowd / community sources — lower base
  producthunt: 0.45,
};

const DEFAULT_RELIABILITY = 0.5;

// ---------------------------------------------------------------------------
// Recency scoring
// ---------------------------------------------------------------------------

function recencyScore(detectedAt: Date): number {
  const now = Date.now();
  const ageMs = now - detectedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return 1.0;
  if (ageDays <= 7) return 0.85;
  if (ageDays <= 30) return 0.65;
  if (ageDays <= 90) return 0.45;
  return 0.3;
}

// ---------------------------------------------------------------------------
// Data completeness scoring
// ---------------------------------------------------------------------------

function completenessScore(signal: RawSignal): number {
  let score = 0.4; // base — sourceType and detectedAt are always present

  if (signal.sourceTitle && signal.sourceTitle.length > 5) score += 0.2;
  if (signal.sourceUrl && signal.sourceUrl.startsWith("http")) score += 0.2;
  if (signal.rawData && Object.keys(signal.rawData).length > 0) score += 0.1;
  if (signal.topic) score += 0.1;

  return Math.min(1, score);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes a dynamic signal strength between 0 and 1 based on:
 * - Source reliability (institutional > crowd)
 * - Recency (newer signals score higher)
 * - Data completeness (more fields filled → higher score)
 *
 * Weights: reliability 40%, recency 35%, completeness 25%
 */
export function computeSignalStrength(signal: RawSignal): number {
  const reliability = SOURCE_RELIABILITY[signal.sourceType] ?? DEFAULT_RELIABILITY;
  const recency = recencyScore(signal.detectedAt);
  const completeness = completenessScore(signal);

  const raw = reliability * 0.4 + recency * 0.35 + completeness * 0.25;

  // Clamp to [0.1, 1.0] — never return zero strength for a valid signal
  return Math.round(Math.min(1, Math.max(0.1, raw)) * 100) / 100;
}
