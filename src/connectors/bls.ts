import { SourceConnector, RawSignal } from "./types";

/**
 * BLS Connector — Bureau of Labor Statistics
 *
 * US unemployment rate and labor market data.
 * No API key required for v1 (limited to 25 queries/day).
 *
 * API: https://www.bls.gov/developers/
 */

export const blsConnector: SourceConnector = {
  name: "bls",
  displayName: "BLS (US Labor Statistics)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesid: ["LNS14000000"] }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const series = data.Results?.series?.[0];
      const points = series?.data?.slice(0, 6) || [];

      if (points.length === 0) return signals;

      const latest = points[0];
      const rate = parseFloat(latest.value);
      const prevRate = points.length > 1 ? parseFloat(points[1].value) : rate;
      const change = rate - prevRate;

      signals.push({
        sourceType: "bls",
        sourceUrl: "https://www.bls.gov/cps/",
        sourceTitle: `BLS: US unemployment ${rate}% (${latest.year} ${latest.periodName})`,
        signalType: Math.abs(change) > 0.3 ? "spike" : "mention",
        topic: "Future of Work",
        rawStrength: Math.min(1, rate / 10),
        rawData: {
          rate,
          change,
          year: latest.year,
          period: latest.periodName,
          seriesId: "LNS14000000",
          recentPoints: points.slice(0, 3).map((p: any) => ({
            year: p.year,
            period: p.periodName,
            value: p.value,
          })),
        },
        detectedAt: new Date(),
      });
    } catch {
      // API unavailable
    }

    return signals;
  },
};
