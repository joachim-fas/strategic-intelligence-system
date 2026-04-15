import { SourceConnector, RawSignal } from "./types";

/**
 * FRED Connector — Federal Reserve Economic Data
 *
 * Two access paths:
 *   1. Official JSON API (`api.stlouisfed.org/fred/series/observations`)
 *      — fast, structured, requires a valid `FRED_API_KEY`. Preferred when
 *      the key is present and not rejected.
 *   2. Public CSV fallback (`fredgraph.csv?id=<SERIES>`). No key required;
 *      the Federal Reserve exposes every series as a downloadable CSV for
 *      charting. We parse the last two observations from the CSV when the
 *      JSON path is unavailable (missing key, invalid key, etc.).
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

interface Observation {
  date: string;
  value: number;
}

async function fetchJson(seriesId: string, apiKey: string): Promise<Observation[] | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&limit=5&sort_order=desc&file_type=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = await res.json();
    const obs: { date: string; value: string }[] = data.observations ?? [];
    const valid = obs
      .filter((o) => o.value !== "." && !isNaN(parseFloat(o.value)))
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

async function fetchCsv(seriesId: string): Promise<Observation[] | null> {
  try {
    // `fredgraph.csv` is the public chart-export endpoint FRED uses on its
    // own website. Anyone can call it without a key. Columns are:
    //   observation_date,<SERIES_ID>
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;

    const rows: Observation[] = [];
    // Skip header. Walk rows keeping only numeric values.
    for (let i = 1; i < lines.length; i++) {
      const [date, rawValue] = lines[i].split(",");
      if (!date || rawValue == null || rawValue === "" || rawValue === ".") continue;
      const value = parseFloat(rawValue);
      if (!Number.isFinite(value)) continue;
      rows.push({ date, value });
    }
    if (rows.length === 0) return null;
    // Return newest-first so the rest of the connector doesn't care which
    // path produced the data.
    return rows.reverse().slice(0, 5);
  } catch {
    return null;
  }
}

export const fredConnector: SourceConnector = {
  name: "fred",
  displayName: "FRED (Federal Reserve Economic Data)",

  async fetchSignals(): Promise<RawSignal[]> {
    const apiKey = process.env.FRED_API_KEY;
    const signals: RawSignal[] = [];

    for (const series of SERIES) {
      // JSON first, CSV fallback. Both return null on failure; the CSV
      // fallback means FRED can still populate signals when the API key
      // is missing or rejected (e.g. new or rotated keys).
      let valid: Observation[] | null = null;
      if (apiKey) valid = await fetchJson(series.id, apiKey);
      if (!valid) valid = await fetchCsv(series.id);
      if (!valid || valid.length < 1) continue;

      const latest = valid[0].value;
      const previous = valid.length >= 2 ? valid[1].value : null;
      const change =
        previous != null && previous !== 0 ? (latest - previous) / Math.abs(previous) : 0;

      signals.push({
        sourceType: "fred",
        sourceUrl: `https://fred.stlouisfed.org/series/${series.id}`,
        sourceTitle: `FRED: ${series.label} = ${latest.toFixed(2)}${series.unit === "%" ? "%" : ""} (${valid[0].date})${previous != null ? ` — ${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}% change` : ""}`,
        signalType: Math.abs(change) > 0.1 ? "spike" : "mention",
        topic: series.topic,
        rawStrength: Math.min(1, Math.abs(change) + 0.35),
        rawData: {
          seriesId: series.id,
          label: series.label,
          latest,
          previous,
          change,
          latestDate: valid[0].date,
        },
        detectedAt: new Date(),
      });
    }

    return signals;
  },
};
