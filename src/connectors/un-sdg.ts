import { SourceConnector, RawSignal } from "./types";

/**
 * UN SDG Connector — Sustainable Development Goals
 *
 * Tracks progress on the 17 UN Sustainable Development Goals.
 * No API key required.
 *
 * API: https://unstats.un.org/sdgs/
 */

const SDG_TOPICS: Record<number, string> = {
  1: "Demographic Shifts & Aging",
  2: "Climate Change & Sustainability",
  3: "Health & Wellbeing",
  4: "Future of Work",
  5: "Demographic Shifts & Aging",
  6: "Climate Change & Sustainability",
  7: "Climate Change & Sustainability",
  8: "Future of Work",
  9: "Artificial Intelligence & Automation",
  10: "Demographic Shifts & Aging",
  11: "Climate Change & Sustainability",
  12: "Climate Change & Sustainability",
  13: "Climate Change & Sustainability",
  14: "Climate Change & Sustainability",
  15: "Climate Change & Sustainability",
  16: "Geopolitical Fragmentation",
  17: "Geopolitical Fragmentation",
};

export const unSdgConnector: SourceConnector = {
  name: "un_sdg",
  displayName: "UN SDG Indicators",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://unstats.un.org/sdgs/UNSDGAPIV5/v1/sdg/Goal/List",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const goals = await res.json();

      for (const goal of (goals || []).slice(0, 17)) {
        const code = goal.code ? parseInt(goal.code, 10) : 0;
        const title = goal.title || goal.description || `SDG ${code}`;
        const topic = SDG_TOPICS[code] || "Climate Change & Sustainability";

        signals.push({
          sourceType: "un_sdg",
          sourceUrl: `https://sdgs.un.org/goals/goal${code}`,
          sourceTitle: `UN SDG ${code}: ${title.slice(0, 120)}`,
          signalType: "mention",
          topic,
          rawStrength: 0.4, // TODO: compute strength dynamically from signal data
          rawData: { code, title, description: goal.description },
          detectedAt: new Date(),
        });
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
