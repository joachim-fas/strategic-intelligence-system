import { SourceConnector, RawSignal } from "./types";

/**
 * OECD Data Connector — completely free, no API key required
 *
 * Tracks key economic and policy indicators from OECD member countries.
 * Data from the official OECD SDMX-JSON 2.0 API at sdmx.oecd.org. The
 * legacy `stats.oecd.org/SDMX-JSON/...` hostname was decommissioned and
 * now 301-redirects to a static page, which is why the old connector
 * returned zero.
 *
 * API: https://sdmx.oecd.org/public/rest/
 * License: OECD Terms & Conditions (free for non-commercial use)
 */

const OECD_INDICATORS: {
  url: string;
  label: string;
  topic: string;
  unit: string;
}[] = [
  {
    // Composite Leading Indicators (CLI): amplitude-adjusted index.
    url: "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI/all/all?lastNObservations=3&dimensionAtObservation=AllDimensions&format=jsondata",
    label: "Composite Leading Indicators",
    topic: "Economic Trends",
    unit: "index",
  },
  {
    // Monthly unemployment level (labour force survey)
    url: "https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M/all/all?lastNObservations=3&dimensionAtObservation=AllDimensions&format=jsondata",
    label: "Unemployment (monthly, OECD)",
    topic: "Future of Work",
    unit: "%",
  },
];

export const oecdConnector: SourceConnector = {
  name: "oecd",
  displayName: "OECD (Economic Indicators)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const ind of OECD_INDICATORS) {
      try {
        // NOTE: sdmx.oecd.org 500s when we send certain header combinations
        // (e.g. a `User-Agent` with a mailto: part + `Accept: application/json`).
        // A bare request returns JSON (`format=jsondata` in the URL is
        // enough); adding headers is what breaks content negotiation.
        const res = await fetch(ind.url, {
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) continue;

        const data = await res.json();
        // SDMX-JSON 2.0: when dimensionAtObservation=AllDimensions, numeric
        // observations live directly on dataSets[0].observations as a flat
        // keyed map (no intermediate `series` wrapper). The old connector
        // walked `dataSets[0].series`, which doesn't exist in this shape,
        // so every indicator was dropped silently.
        const ds = data?.data?.dataSets?.[0] ?? data?.dataSets?.[0];
        const obs: Record<string, unknown[]> =
          ds?.observations ?? ds?.series ?? {};
        if (!obs || Object.keys(obs).length === 0) continue;

        const allValues: number[] = [];
        for (const key of Object.keys(obs)) {
          const entry = obs[key];
          // Each entry is either [value, ...flags] (AllDimensions) or
          // { observations: {...} } (legacy series shape).
          if (Array.isArray(entry)) {
            const v = entry[0] as number | null | undefined;
            if (v != null && Number.isFinite(v)) allValues.push(v as number);
          } else if (entry && typeof entry === "object" && "observations" in (entry as Record<string, unknown>)) {
            const inner = (entry as { observations: Record<string, unknown[]> }).observations;
            for (const ok of Object.keys(inner)) {
              const v = inner[ok]?.[0] as number | null | undefined;
              if (v != null && Number.isFinite(v)) allValues.push(v as number);
            }
          }
        }

        if (allValues.length < 1) continue;

        const latest = allValues[allValues.length - 1];
        const previous = allValues.length >= 2 ? allValues[allValues.length - 2] : null;
        const change = previous != null && previous !== 0 ? (latest - previous) / Math.abs(previous) : 0;

        signals.push({
          sourceType: "oecd",
          sourceUrl: "https://data.oecd.org",
          sourceTitle: `OECD: ${ind.label} — latest: ${latest.toFixed(2)}${ind.unit}${previous != null ? ` (${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}% change)` : ""}`,
          signalType: Math.abs(change) > 0.15 ? "spike" : "mention",
          topic: ind.topic,
          rawStrength: Math.min(1, Math.abs(change) + 0.35),
          rawData: { label: ind.label, latest, previous, change, valueCount: allValues.length },
          detectedAt: new Date(),
        });
      } catch {
        // API unavailable or rate limit — skip
      }
    }

    return signals;
  },
};
