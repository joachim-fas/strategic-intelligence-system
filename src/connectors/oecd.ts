import { SourceConnector, RawSignal } from "./types";

/**
 * OECD Data Connector — completely free, no API key required
 *
 * Tracks key economic and policy indicators from OECD member countries.
 * Data from the official OECD.Stat SDMX-JSON API.
 *
 * API: https://data.oecd.org/api/sdmx-json-documentation/
 * License: OECD Terms & Conditions (free for non-commercial use)
 */

const OECD_INDICATORS: {
  url: string;
  label: string;
  topic: string;
  unit: string;
}[] = [
  {
    // GDP quarterly growth, G7 countries
    url: "https://stats.oecd.org/SDMX-JSON/data/QNA/DEU+USA+FRA+GBR.B1_GS1.GPSA.Q/OECD?lastNObservations=4&format=jsondata",
    label: "GDP Growth (G7 Quarterly)",
    topic: "Economic Trends",
    unit: "% QoQ",
  },
  {
    // Unemployment rate
    url: "https://stats.oecd.org/SDMX-JSON/data/STLABOUR/DEU+USA+FRA+GBR+OECD.UNEMA.ST.M/OECD?lastNObservations=3&format=jsondata",
    label: "Unemployment Rate (OECD)",
    topic: "Future of Work",
    unit: "%",
  },
  {
    // CPI inflation
    url: "https://stats.oecd.org/SDMX-JSON/data/PRICES_CPI/DEU+USA+OECD.CPALTT01.GY.M/OECD?lastNObservations=3&format=jsondata",
    label: "CPI Inflation (OECD)",
    topic: "Economic Trends",
    unit: "% YoY",
  },
];

export const oecdConnector: SourceConnector = {
  name: "oecd",
  displayName: "OECD (Economic Indicators)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const ind of OECD_INDICATORS) {
      try {
        const res = await fetch(ind.url, {
          headers: { "User-Agent": "SIS/1.0 (mailto:sis@strategic-intelligence.app)", Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) continue;

        const data = await res.json();
        // SDMX-JSON structure: data.dataSets[0].series → keyed by dimension indices
        const series = data?.dataSets?.[0]?.series;
        if (!series) continue;

        const allValues: number[] = [];
        for (const key of Object.keys(series)) {
          const obs = series[key]?.observations;
          if (!obs) continue;
          for (const obsKey of Object.keys(obs)) {
            const v = obs[obsKey]?.[0];
            if (v != null && !isNaN(v)) allValues.push(v);
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
