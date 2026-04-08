import { buildDeclarativeConnector } from "./framework";

/**
 * UNHCR Refugee Data Finder — Population of concern by country of asylum.
 *
 * Public, no-auth API from the UN High Commissioner for Refugees. The
 * "Population Statistics" endpoint returns forcibly-displaced population
 * counts by year and country. We query the most recent year and rank
 * countries by their refugee population; large populations = higher
 * structural migration pressure signal.
 *
 * Endpoint: https://api.unhcr.org/population/v1/population
 * Docs:     https://api.unhcr.org/docs/refugee-statistics.html
 */

interface UnhcrPopulationRow {
  year: number;
  coo: string; // country of origin
  coa: string; // country of asylum
  coa_name: string;
  coo_name: string;
  refugees: number | string | null;
  asylum_seekers: number | string | null;
  returned_refugees: number | string | null;
  idps: number | string | null;
  stateless: number | string | null;
  ooc: number | string | null;
  hst: number | string | null;
}

interface UnhcrResponse {
  items: UnhcrPopulationRow[];
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Query the most recent available year. UNHCR publishes annual mid-year
// and end-year snapshots; the v1/population endpoint serves both.
const ENDPOINT =
  "https://api.unhcr.org/population/v1/population" +
  "?limit=500&yearFrom=2024&yearTo=2026&coa_all=true";

export const unhcrConnector = buildDeclarativeConnector<UnhcrPopulationRow>({
  name: "unhcr",
  displayName: "UNHCR Refugee Data",
  endpoint: ENDPOINT,
  rowsPath: "items",
  defaultTopic: "Migration & Displacement",
  defaultSignalType: "mention",
  minStrength: 0.1,
  limit: 200,
  map: (row) => {
    if (!row.coa_name || !row.coo_name) return null;
    const refugees = toNum(row.refugees);
    const asylum = toNum(row.asylum_seekers);
    const idps = toNum(row.idps);
    const total = refugees + asylum + idps;
    if (total < 10_000) return null; // Drop small flows

    // Normalise: 1M+ displaced people = 1.0, 100k = 0.5, 10k = 0.1.
    const strength = Math.min(1, Math.log10(total) / 6);

    const totalLabel =
      total >= 1_000_000
        ? `${(total / 1_000_000).toFixed(1)}M`
        : `${Math.round(total / 1000)}k`;

    return {
      sourceUrl: `https://www.unhcr.org/refugee-statistics/download/?url=${encodeURIComponent(
        row.coa_name,
      )}`,
      sourceTitle: `${row.coo_name} → ${row.coa_name} (${row.year}): ${totalLabel} displaced`,
      rawStrength: strength,
      detectedAt: new Date(`${row.year}-12-31`),
      rawData: {
        year: row.year,
        countryOfOrigin: row.coo_name,
        countryOfAsylum: row.coa_name,
        refugees,
        asylumSeekers: asylum,
        idps,
        total,
      },
    };
  },
});
