/**
 * STEEP+V Quadrant Mapping for the Radar
 *
 * The 4 radar quadrants are anchored in the STEEP+V foresight framework
 * (Society / Technology / Economy / Environment+Politics / Values), compressed
 * from 5 dimensions into 4 because a circular radar has exactly 4 quadrants.
 *
 *   Quadrant 0  Society & Values   — people, demographics, culture, identity,
 *                                    work, learning, attention, consumption
 *   Quadrant 1  Technology & Data  — AI, compute, networks, software, data
 *   Quadrant 2  Economy & Markets  — commerce, finance, manufacturing, health
 *                                    business, mobility business, infrastructure
 *   Quadrant 3  Environment & Politics — climate, energy, geopolitics, security,
 *                                        urban systems
 *
 * Why this exists: the original `mega-trends.ts` data has each trend's
 * `quadrant` field set inconsistently (some 0, some 1, some 3 based on a now-
 * outdated dimension scheme). Rather than do 40 inline edits in the data file,
 * we centralize the mapping here and let `RadarView` apply it as a deterministic
 * override at render time. New trends added later can either set their own
 * quadrant or fall through to the heuristic (which infers from tags + name).
 */

import type { TrendDot } from "@/types";

export type SteepVQuadrant = 0 | 1 | 2 | 3;

export const QUADRANT_LABELS_DE: Record<SteepVQuadrant, string> = {
  0: "Gesellschaft & Werte",
  1: "Technologie & Daten",
  2: "Wirtschaft & Märkte",
  3: "Umwelt & Politik",
};

export const QUADRANT_LABELS_EN: Record<SteepVQuadrant, string> = {
  0: "Society & Values",
  1: "Technology & Data",
  2: "Economy & Markets",
  3: "Environment & Politics",
};

export const QUADRANT_DESCRIPTIONS_DE: Record<SteepVQuadrant, string> = {
  0: "Demografie, Identität, Lernen, Arbeit, Aufmerksamkeit, Konsum",
  1: "KI, Rechnen, Netze, Software-Plattformen, Daten-Ökonomie",
  2: "Handel, Finanzen, Fertigung, Mobilitäts- und Gesundheitsmärkte",
  3: "Klima, Energie, Geopolitik, Sicherheit, Urbanisierung",
};

export const QUADRANT_DESCRIPTIONS_EN: Record<SteepVQuadrant, string> = {
  0: "Demographics, identity, learning, work, attention, consumption",
  1: "AI, compute, networks, software platforms, data economy",
  2: "Commerce, finance, manufacturing, mobility & health markets",
  3: "Climate, energy, geopolitics, security, urban systems",
};

/**
 * Explicit ID → quadrant assignments for the 40 curated mega/macro trends.
 * This is the canonical map. Anything not in here falls through to the
 * heuristic in `inferQuadrantFromTags` below.
 */
const EXPLICIT_QUADRANT_MAP: Record<string, SteepVQuadrant> = {
  // ── Society & Values (0) ──────────────────────────────────────────────
  "mega-demographic-shift": 0,
  "mega-future-of-work": 0,
  "mega-knowledge-culture": 0,
  "mega-identity-values": 0,
  "mega-social-instability": 0,
  "mega-migration-displacement": 0,
  "macro-skills-upskilling": 0,
  "macro-remote-hybrid": 0,
  "macro-attention-economy": 0,
  "macro-conscious-consumption": 0,

  // ── Technology & Data (1) ─────────────────────────────────────────────
  "mega-ai-transformation": 1,
  "mega-technological-disruption": 1,
  "mega-connectivity": 1,
  "macro-generative-ai": 1,
  "macro-ai-agents": 1,
  "macro-human-machine": 1,
  "macro-cloud-native": 1,
  "macro-edge-iot": 1,
  "macro-quantum-computing": 1,
  "macro-spatial-computing": 1,
  "macro-web3-decentralization": 1,
  "macro-data-economy": 1,

  // ── Economy & Markets (2) ─────────────────────────────────────────────
  "mega-mobility": 2,
  "mega-health-biotech": 2,
  "macro-platform-economy": 2,
  "macro-seamless-commerce": 2,
  "macro-circular-economy": 2,
  "macro-exponential-manufacturing": 2,
  "macro-autonomous-mobility": 2,
  "macro-digital-health": 2,
  "macro-genomics": 2,
  "macro-engineered-evolution": 2,
  "macro-smart-surroundings": 2,

  // ── Environment & Politics (3) ────────────────────────────────────────
  "mega-climate-sustainability": 3,
  "mega-energy-transition": 3,
  "mega-geopolitical-fracturing": 3,
  "mega-security-trust": 3,
  "mega-urbanization": 3,
  "macro-green-energy": 3,
  "macro-cybersecurity": 3,
};

/**
 * Tag/name-based heuristic fallback for trends not in the explicit map.
 * Used for any future trends that don't have a hand-assigned quadrant.
 */
function inferQuadrantFromTags(trend: TrendDot): SteepVQuadrant {
  const haystack = [
    ...trend.tags,
    trend.name.toLowerCase(),
    trend.description?.toLowerCase() ?? "",
  ].join(" ");

  // Environment & Politics — climate, energy, geo, security take precedence
  if (/\b(climate|energy|geopolit|security|urban|sustainability|carbon|emission|fossil|renewable)\b/.test(haystack)) {
    return 3;
  }
  // Technology & Data
  if (/\b(ai|artificial intelligence|machine learning|cloud|data|edge|iot|quantum|web3|blockchain|spatial|xr|vr|ar|connectivity|software|compute|network)\b/.test(haystack)) {
    return 1;
  }
  // Economy & Markets
  if (/\b(commerce|platform|marketplace|economy|manufactur|mobility|supply chain|circular|finance|trade|industry|health|biotech|genomic|medic)\b/.test(haystack)) {
    return 2;
  }
  // Society & Values default — covers culture, work, identity, learning, demographics
  return 0;
}

/**
 * Resolve a trend's STEEP+V quadrant. Explicit map first, then heuristic.
 */
export function resolveQuadrant(trend: TrendDot): SteepVQuadrant {
  if (trend.id in EXPLICIT_QUADRANT_MAP) {
    return EXPLICIT_QUADRANT_MAP[trend.id];
  }
  return inferQuadrantFromTags(trend);
}

/**
 * Apply the canonical STEEP+V quadrant to a list of trends. Returns a new
 * array — the input list is not mutated. Used by RadarView to override
 * whatever quadrant the data file currently has with the centralized one.
 */
export function applySteepVQuadrants(trends: TrendDot[]): TrendDot[] {
  return trends.map((t) => ({ ...t, quadrant: resolveQuadrant(t) }));
}
