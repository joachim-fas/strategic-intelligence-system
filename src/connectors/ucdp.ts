import { SourceConnector, RawSignal } from "./types";

/**
 * UCDP Connector — Uppsala Conflict Data Program
 *
 * Georeferenced conflict events from the world's leading
 * academic data source on organized violence.
 *
 * API: https://ucdp.uu.se/apidocs/
 */

const VIOLENCE_TOPICS: Record<number, string> = {
  1: "Geopolitical Fragmentation", // state-based
  2: "Geopolitical Fragmentation", // non-state
  3: "Security, Trust & Resilience", // one-sided
};

export const ucdpConnector: SourceConnector = {
  name: "ucdp",
  displayName: "UCDP (Conflict Data)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=20&page=0",
        { signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const events = data.Result || [];

      for (const ev of events) {
        const country = ev.country || "Unknown";
        const violenceType = ev.type_of_violence || 1;
        const topic = VIOLENCE_TOPICS[violenceType] || "Geopolitical Fragmentation";
        const deaths = (ev.best || 0) as number;

        signals.push({
          sourceType: "ucdp",
          sourceUrl: `https://ucdp.uu.se/event/${ev.id || ""}`,
          sourceTitle: `UCDP: Type ${violenceType} violence in ${country}`,
          signalType: deaths > 50 ? "spike" : "mention",
          topic,
          rawStrength: Math.min(1, deaths / 100),
          rawData: {
            country,
            violenceType,
            deaths,
            date: ev.date_start,
            source: ev.source_article,
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
