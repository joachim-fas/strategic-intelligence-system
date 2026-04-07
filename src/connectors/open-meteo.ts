import { SourceConnector, RawSignal } from "./types";

/**
 * Open-Meteo Connector — Climate & weather data
 *
 * Temperature extremes from the past 7 days for Vienna.
 * No API key required.
 *
 * API: https://open-meteo.com/en/docs
 */

export const openMeteoConnector: SourceConnector = {
  name: "open_meteo",
  displayName: "Open-Meteo (Climate Data)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=48.2&longitude=16.37&daily=temperature_2m_max,temperature_2m_min&past_days=7&timezone=Europe/Vienna",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const dates = data.daily?.time || [];
      const maxTemps = data.daily?.temperature_2m_max || [];
      const minTemps = data.daily?.temperature_2m_min || [];

      const highMax = Math.max(...maxTemps.filter((t: number) => t != null));
      const lowMin = Math.min(...minTemps.filter((t: number) => t != null));
      const isExtreme = highMax > 35 || lowMin < -10;

      signals.push({
        sourceType: "open_meteo",
        sourceUrl: "https://open-meteo.com/",
        sourceTitle: `Open-Meteo: Vienna 7d range ${lowMin.toFixed(1)}C to ${highMax.toFixed(1)}C`,
        signalType: isExtreme ? "spike" : "mention",
        topic: "Climate Change & Sustainability",
        rawStrength: isExtreme ? 0.8 : 0.3,
        rawData: {
          location: "Vienna",
          dates,
          maxTemps,
          minTemps,
          highMax,
          lowMin,
        },
        detectedAt: new Date(),
      });
    } catch {
      // API unavailable
    }

    return signals;
  },
};
