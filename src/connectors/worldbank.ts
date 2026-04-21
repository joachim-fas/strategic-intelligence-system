import { SourceConnector, RawSignal } from "./types";

/**
 * World Bank + IMF Connector — free, no API key
 *
 * Tracks macroeconomic indicators across 200+ countries.
 * Detects economic trend shifts, regional divergences,
 * and structural changes.
 *
 * APIs:
 * - World Bank: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
 * - IMF: https://www.imf.org/external/datamapper/api/help
 */

// Key indicators to track
const WB_INDICATORS: { id: string; topic: string; label: string }[] = [
  { id: "NY.GDP.MKTP.KD.ZG", topic: "Economic Trends", label: "GDP Growth" },
  { id: "FP.CPI.TOTL.ZG", topic: "Economic Trends", label: "Inflation (CPI)" },
  { id: "SL.UEM.TOTL.ZS", topic: "Future of Work", label: "Unemployment Rate" },
  { id: "IT.NET.USER.ZS", topic: "Connectivity & Digital Networks", label: "Internet Users %" },
  { id: "EG.FEC.RNEW.ZS", topic: "Energy Transition & Decarbonization", label: "Renewable Energy Share" },
  { id: "SP.URB.TOTL.IN.ZS", topic: "Urbanization & Smart Cities", label: "Urban Population %" },
  { id: "SP.POP.65UP.TO.ZS", topic: "Demographic Shifts & Aging", label: "Population 65+ %" },
];

export const worldbankConnector: SourceConnector = {
  name: "worldbank",
  displayName: "World Bank & IMF (Macro Data)",

  async fetchSignals(): Promise<RawSignal[]> {
    // Backlog-Task 1.4 (2026-04-21): World Bank / IMF Timeout beheben.
    //
    // Vorher: 7 sequentielle WB-Indikator-Fetches (je bis 20 s) + 1 IMF-Fetch
    // in einem großen Block — worst case ~140 s, deutlich über dem Pipeline-
    // Budget. Jetzt parallel via Promise.allSettled, Per-Fetch-Timeout auf
    // 25 s angehoben. Total wall-time worst case ~25 s statt 140 s.
    //
    // Die WB-API hat keine dokumentierten Rate-Limits, 7 parallele Requests
    // sind sicher. IMF läuft parallel zum WB-Block, da es einen anderen Host
    // betrifft und die beiden sich nicht gegenseitig rate-limiten.
    const PER_FETCH_TIMEOUT_MS = 25_000;

    async function fetchWbIndicator(params: { id: string; topic: string; label: string }): Promise<RawSignal | null> {
      const { id, topic, label } = params;
      try {
        const res = await fetch(
          `https://api.worldbank.org/v2/country/WLD/indicator/${id}?format=json&per_page=5&date=2019:2024`,
          { signal: AbortSignal.timeout(PER_FETCH_TIMEOUT_MS) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length < 2) return null;
        const records = data[1] || [];
        const values = records
          .filter((r: any) => r.value !== null)
          .map((r: any) => ({ year: r.date, value: r.value }));
        if (values.length < 2) return null;
        const latest = values[0]?.value || 0;
        const previous = values[1]?.value || 0;
        const change = previous !== 0 ? (latest - previous) / Math.abs(previous) : 0;
        return {
          sourceType: "worldbank",
          sourceUrl: `https://data.worldbank.org/indicator/${id}`,
          sourceTitle: `World Bank: ${label} = ${latest.toFixed(1)}% (${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}% change)`,
          signalType: Math.abs(change) > 0.2 ? "spike" : "mention",
          topic,
          rawStrength: Math.min(1, Math.abs(change) + 0.3),
          rawData: { indicator: id, label, values, change },
          detectedAt: new Date(),
        };
      } catch {
        return null;
      }
    }

    const wbResults = await Promise.all(WB_INDICATORS.map(fetchWbIndicator));
    const signals: RawSignal[] = wbResults.filter((r): r is RawSignal => r !== null);

    // IMF GDP growth projections
    try {
      const currentYear = new Date().getFullYear();
      const res = await fetch(
        `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH?periods=${currentYear},${currentYear + 1}`,
        { signal: AbortSignal.timeout(PER_FETCH_TIMEOUT_MS) }
      );

      if (res.ok) {
        const data = await res.json();
        const values = data.values?.NGDP_RPCH || {};

        // Get major economies
        const majors = ["USA", "CHN", "DEU", "JPN", "GBR", "IND", "FRA", "BRA"];
        const projections: { country: string; growth: number }[] = [];

        for (const code of majors) {
          const countryData = values[code];
          if (countryData?.[String(currentYear)]) {
            projections.push({ country: code, growth: countryData[String(currentYear)] });
          }
        }

        if (projections.length > 0) {
          const avgGrowth = projections.reduce((s, p) => s + p.growth, 0) / projections.length;

          signals.push({
            sourceType: "worldbank",
            sourceUrl: "https://www.imf.org/external/datamapper/NGDP_RPCH",
            sourceTitle: `IMF: Major economies avg GDP growth ${currentYear}: ${avgGrowth.toFixed(1)}%`,
            signalType: avgGrowth < 1.5 ? "spike" : "mention",
            topic: "Economic Trends",
            rawStrength: Math.min(1, Math.abs(avgGrowth - 2.5) / 3 + 0.3),
            rawData: { projections, avgGrowth, year: currentYear },
            detectedAt: new Date(),
          });
        }
      }
    } catch {
      // IMF API down
    }

    return signals;
  },
};
