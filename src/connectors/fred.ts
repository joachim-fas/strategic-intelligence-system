import { SourceConnector, RawSignal } from "./types";

/**
 * FRED Connector — Federal Reserve Economic Data
 * Free API key required: https://fred.stlouisfed.org/docs/api/api_key.html
 * Set FRED_API_KEY in .env.local — returns no signals if not set.
 *
 * 800,000+ US economic time series, updated in near-real-time.
 * API: https://fred.stlouisfed.org/docs/api/fred/
 */

const SERIES: { id: string; label: string; topic: string; unit: string }[] = [
  { id: "FEDFUNDS", label: "Federal Funds Rate", topic: "Economic Trends", unit: "%" },
  { id: "UNRATE", label: "US Unemployment Rate", topic: "Future of Work", unit: "%" },
  { id: "CPIAUCSL", label: "US CPI Inflation", topic: "Economic Trends", unit: "index" },
  { id: "DGS10", label: "US 10-Year Treasury Yield", topic: "Economic Trends", unit: "%" },
  { id: "INDPRO", label: "US Industrial Production", topic: "Economic Trends", unit: "index" },
  { id: "HOUST", label: "US Housing Starts", topic: "Economic Trends", unit: "k units" },
];

export const fredConnector: SourceConnector = {
  name: "fred",
  displayName: "FRED (Federal Reserve Economic Data)",

  async fetchSignals(): Promise<RawSignal[]> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) return []; // Gracefully skip if no key configured

    const signals: RawSignal[] = [];

    for (const series of SERIES) {
      try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&limit=5&sort_order=desc&file_type=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;

        const data = await res.json();
        const obs: { date: string; value: string }[] = data.observations ?? [];
        const valid = obs.filter((o) => o.value !== "." && !isNaN(parseFloat(o.value)));
        if (valid.length < 1) continue;

        const latest = parseFloat(valid[0].value);
        const previous = valid.length >= 2 ? parseFloat(valid[1].value) : null;
        const change = previous != null && previous !== 0 ? (latest - previous) / Math.abs(previous) : 0;

        signals.push({
          sourceType: "fred",
          sourceUrl: `https://fred.stlouisfed.org/series/${series.id}`,
          sourceTitle: `FRED: ${series.label} = ${latest.toFixed(2)}${series.unit === "%" ? "%" : ""} (${valid[0].date})${previous != null ? ` — ${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}% change` : ""}`,
          signalType: Math.abs(change) > 0.1 ? "spike" : "mention",
          topic: series.topic,
          rawStrength: Math.min(1, Math.abs(change) + 0.35),
          rawData: { seriesId: series.id, label: series.label, latest, previous, change, latestDate: valid[0].date },
          detectedAt: new Date(),
        });
      } catch {
        // Timeout or API error — skip
      }
    }

    return signals;
  },
};
