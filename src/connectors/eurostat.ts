import { SourceConnector, RawSignal } from "./types";

/**
 * Eurostat Connector — EU official statistics, completely free, no API key
 *
 * Tracks key EU economic, social, and sustainability indicators.
 * Data is official EU statistics from Eurostat, updated regularly.
 *
 * API: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access
 * License: Free reuse under EC open data policy
 */

const DATASETS: { code: string; label: string; topic: string; unit?: string }[] = [
  { code: "une_rt_m", label: "EU Unemployment Rate", topic: "Future of Work", unit: "%" },
  { code: "prc_hicp_manr", label: "EU Inflation (HICP)", topic: "Economic Trends", unit: "%" },
  { code: "nrg_ind_ren", label: "EU Renewable Energy Share", topic: "Energy Transition & Decarbonization", unit: "%" },
  { code: "demo_gind", label: "EU Population Growth", topic: "Demographic Shifts & Aging", unit: "‰" },
  { code: "isoc_ci_in_h", label: "EU Internet Access (Households)", topic: "Connectivity & Digital Networks", unit: "%" },
];

const HEADERS = { "User-Agent": "SIS/1.0 (mailto:sis@strategic-intelligence.app)" };

export const eurostatConnector: SourceConnector = {
  name: "eurostat",
  displayName: "Eurostat (EU Official Statistics)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const ds of DATASETS) {
      try {
        // Fetch latest 2 years of data for trend detection
        const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ds.code}?format=JSON&lang=EN&lastTimePeriod=2`;
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;

        const data = await res.json();
        if (!data?.value || typeof data.value !== "object") continue;

        const values = Object.values(data.value as Record<string, number>).filter(v => v != null);
        if (values.length < 1) continue;

        const latest = values[values.length - 1] as number;
        const previous = values.length >= 2 ? (values[values.length - 2] as number) : null;
        const change = previous != null && previous !== 0 ? (latest - previous) / Math.abs(previous) : 0;

        signals.push({
          sourceType: "eurostat",
          sourceUrl: `https://ec.europa.eu/eurostat/databrowser/view/${ds.code}/default/table`,
          sourceTitle: `Eurostat: ${ds.label} = ${latest.toFixed(1)}${ds.unit ?? ""}${previous != null ? ` (${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}% vs prior)` : ""}`,
          signalType: Math.abs(change) > 0.15 ? "spike" : "mention",
          topic: ds.topic,
          rawStrength: Math.min(1, Math.abs(change) + 0.3),
          rawData: { code: ds.code, label: ds.label, latest, previous, change },
          detectedAt: new Date(),
        });
      } catch {
        // Timeout or API error — skip this dataset
      }
    }

    return signals;
  },
};
