import { SourceConnector, RawSignal } from "./types";

/**
 * ILO ILOSTAT Connector — free, no API key
 *
 * International Labour Organization statistics on employment,
 * unemployment, wages, and working conditions worldwide.
 *
 * API: https://ilostat.ilo.org/resources/sdmx-tools/
 */

export const iloConnector: SourceConnector = {
  name: "ilo",
  displayName: "ILO ILOSTAT (Labour Statistics)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const url = `https://rplumber.ilo.org/data/indicator/?id=UNE_DEAP_SEX_AGE_RT&timefrom=2024&format=.json`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return signals;

      const data = await res.json();

      // The ILO API returns an array of observations
      // Group by reference area (country) and take most recent per country
      const byCountry: Record<string, any> = {};

      for (const obs of (Array.isArray(data) ? data : [])) {
        const country = obs.ref_area?.label || obs.ref_area || "Unknown";
        const time = obs.time || obs.timePeriod || "0";
        const existing = byCountry[country];
        if (!existing || time > (existing.time || "0")) {
          byCountry[country] = { ...obs, time, country };
        }
      }

      // Take top 20 entries
      const entries = Object.values(byCountry).slice(0, 20);

      for (const entry of entries) {
        const country = entry.country || "Unknown";
        const value = Number(entry.obs_value ?? entry.value ?? 0);
        const time = entry.time || "Unknown";

        signals.push({
          sourceType: "ilo",
          sourceUrl: "https://ilostat.ilo.org/",
          sourceTitle: `ILO: Unemployment rate in ${country} — ${value.toFixed(1)}% (${time})`,
          signalType: "mention",
          topic: "Future of Work",
          rawStrength: 0.5, // TODO: compute strength dynamically from signal data
          rawData: {
            country,
            indicator: "UNE_DEAP_SEX_AGE_RT",
            indicatorLabel: "Unemployment rate by sex and age",
            value,
            time,
            sex: entry.sex?.label || entry.sex,
            age: entry.classif1?.label || entry.classif1,
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
