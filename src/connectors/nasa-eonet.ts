import { SourceConnector, RawSignal } from "./types";

/**
 * NASA EONET Connector — free, no API key
 *
 * Earth Observatory Natural Event Tracker.
 * Real-time feed of wildfires, storms, volcanic eruptions,
 * earthquakes, floods, and other natural events.
 *
 * API: https://eonet.gsfc.nasa.gov/docs/v3
 */

const CATEGORY_TOPICS: Record<string, string> = {
  wildfires: "Climate Change & Sustainability",
  severeStorms: "Climate Change & Sustainability",
  volcanoes: "Security, Trust & Resilience",
  earthquakes: "Security, Trust & Resilience",
  floods: "Climate Change & Sustainability",
  drought: "Climate Change & Sustainability",
  dustHaze: "Climate Change & Sustainability",
  landslides: "Climate Change & Sustainability",
  seaLakeIce: "Climate Change & Sustainability",
  tempExtremes: "Climate Change & Sustainability",
};

export const nasaEonetConnector: SourceConnector = {
  name: "nasa_eonet",
  displayName: "NASA EONET (Natural Events)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return signals;

      const data = await res.json();
      const events = data.events || [];

      // Group by category
      const byCategory: Record<string, any[]> = {};
      for (const event of events) {
        const cat = event.categories?.[0]?.id || "unknown";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(event);
      }

      for (const [category, catEvents] of Object.entries(byCategory)) {
        const topic = CATEGORY_TOPICS[category] || "Security, Trust & Resilience";

        signals.push({
          sourceType: "nasa_eonet",
          sourceUrl: "https://eonet.gsfc.nasa.gov/",
          sourceTitle: `NASA EONET: ${catEvents.length} active ${category} events`,
          signalType: catEvents.length > 10 ? "spike" : "mention",
          topic,
          rawStrength: Math.min(1, catEvents.length / 20),
          rawData: {
            category,
            count: catEvents.length,
            events: catEvents.slice(0, 5).map((e: any) => ({
              title: e.title,
              id: e.id,
              geometry: e.geometry?.[0],
            })),
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
