import { SourceConnector, RawSignal } from "./types";

// WARNING: This connector returns STATIC DATA - not connected to real V-Dem API
// The V-Dem website is fetched only to check availability, but the signal
// returned is always the same hardcoded data regardless of response content.

/**
 * V-Dem Connector — Varieties of Democracy
 *
 * Democracy indices and governance metrics.
 * Limited public API; fetches country-level overview.
 *
 * API: https://v-dem.net/
 */

export const vdemConnector: SourceConnector = {
  name: "vdem",
  displayName: "V-Dem (Democracy Index)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://v-dem.net/data_analysis/VariableGraph/",
        {
          headers: { Accept: "text/html,application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      // V-Dem has limited API; generate a status signal
      signals.push({
        sourceType: "vdem",
        sourceUrl: "https://v-dem.net/",
        sourceTitle: "V-Dem: Global democracy monitoring active",
        signalType: "mention",
        topic: "Geopolitical Fragmentation",
        rawStrength: 0.5, // TODO: compute strength dynamically from signal data
        rawData: {
          note: "V-Dem dataset available for detailed analysis",
          latestVersion: "v14",
          coverage: "202 countries, 1789-present",
        },
        detectedAt: new Date(),
      });
    } catch {
      // API unavailable
    }

    return signals;
  },
};
