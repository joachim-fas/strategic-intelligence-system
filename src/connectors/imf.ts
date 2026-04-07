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

    try {
      const res = await fetch(
        "https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH?periods=2025",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const values = data?.values?.NGDP_RPCH || {};
      const countries = Object.keys(values).slice(0, 20);

      for (const country of countries) {
        const yearData = values[country] || {};
        const growth = yearData["2025"] as number | undefined;
        if (growth === undefined) continue;

        signals.push({
          sourceType: "imf",
          sourceUrl: "https://www.imf.org/external/datamapper/NGDP_RPCH@WEO",
          sourceTitle: `IMF: ${country} GDP growth ${growth.toFixed(1)}% (2025)`,
          signalType: Math.abs(growth) > 5 ? "spike" : "mention",
          topic: INDICATOR_TOPICS["NGDP_RPCH"] || "Economic Trends",
          rawStrength: Math.min(1, Math.abs(growth) / 10),
          rawData: {
            country,
            indicator: "NGDP_RPCH",
            value: growth,
            period: "2025",
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
