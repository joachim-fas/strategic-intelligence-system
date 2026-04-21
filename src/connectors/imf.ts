import { SourceConnector, RawSignal } from "./types";

/**
 * IMF Connector — International Monetary Fund DataMapper
 *
 * Real GDP growth projections and economic indicators.
 * No API key required.
 *
 * API: https://www.imf.org/external/datamapper/api/v1/
 */

const INDICATOR_TOPICS: Record<string, string> = {
  NGDP_RPCH: "Economic Trends",
  PCPIPCH: "Economic Trends",
  LUR: "Future of Work",
  BCA_NGDPD: "Economic Trends",
};

export const imfConnector: SourceConnector = {
  name: "imf",
  displayName: "IMF (Economic Indicators)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const year = new Date().getFullYear();

    // Backlog-Task 1.4 (2026-04-21): 20s → 25s Timeout analog zum
    // WorldBank- und GDELT-Fix, damit langsame IMF-Antworten nicht das
    // Pipeline-Budget ausschöpfen.
    try {
      const res = await fetch(
        `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH?periods=${year}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(25_000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const values = data?.values?.NGDP_RPCH || {};
      const countries = Object.keys(values).slice(0, 20);

      for (const country of countries) {
        const yearData = values[country] || {};
        const growth = yearData[String(year)] as number | undefined;
        if (growth === undefined) continue;

        signals.push({
          sourceType: "imf",
          sourceUrl: "https://www.imf.org/external/datamapper/NGDP_RPCH@WEO",
          sourceTitle: `IMF: ${country} GDP growth ${growth.toFixed(1)}% (${year})`,
          signalType: Math.abs(growth) > 5 ? "spike" : "mention",
          topic: INDICATOR_TOPICS["NGDP_RPCH"] || "Economic Trends",
          rawStrength: Math.min(1, Math.abs(growth) / 10),
          rawData: {
            country,
            indicator: "NGDP_RPCH",
            value: growth,
            period: String(year),
          },
          detectedAt: new Date(),
        });
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
