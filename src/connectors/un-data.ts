import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * UN Data Connector — United Nations Population Data
 *
 * Total population statistics from the UN DESA.
 * No API key required.
 *
 * API: https://data.un.org/
 */

export const unDataConnector: SourceConnector = {
  name: "un_data",
  // Backlog "Quellen-Namensinkonsistenzen" (2026-04-22): auf kurzen
  // Grid-Pill-Name („UN Data") in /dokumentation angeglichen.
  displayName: "UN Data",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://data.un.org/ws/rest/data/DF_UNData_DESA/SP_POP_TOTL..?startPeriod=2023&format=sdmx-json",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const datasets = data?.data?.dataSets?.[0]?.observations || {};
      const keys = Object.keys(datasets).slice(0, 20);

      if (keys.length > 0) {
        const signal: RawSignal = {
          sourceType: "un_data",
          sourceUrl: "https://data.un.org/",
          sourceTitle: `UN Data: Population statistics — ${keys.length} observations`,
          signalType: "mention",
          topic: "Demographic Shifts & Aging",
          rawStrength: 0, // computed below
          rawData: {
            observationCount: keys.length,
            period: "2023+",
            indicator: "SP_POP_TOTL",
          },
          detectedAt: new Date(),
        };
        signal.rawStrength = computeSignalStrength(signal);
        signals.push(signal);
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
