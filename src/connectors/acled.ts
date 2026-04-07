import { SourceConnector, RawSignal } from "./types";

/**
 * ACLED Armed Conflict Data Connector
 *
 * Real-time data on political violence and protest events worldwide.
 * Requires free registration at https://acleddata.com/
 *
 * API: https://apidocs.acleddata.com/
 */

function getLast7DaysRange(): string {
  const end = new Date();
  const start = new Date(Date.now() - 7 * 86400000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(start)}|${fmt(end)}`;
}

export const acledConnector: SourceConnector = {
  name: "acled",
  displayName: "ACLED (Armed Conflict Data)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const email = process.env.ACLED_EMAIL;
    const key = process.env.ACLED_KEY;
    if (!email || !key) return signals;

    try {
      const dateRange = getLast7DaysRange();
      const url = `https://api.acleddata.com/acled/read?event_date=${encodeURIComponent(dateRange)}&event_date_where=BETWEEN&limit=50&key=${key}&email=${encodeURIComponent(email)}`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return signals;

      const data = await res.json();
      const events = data.data || [];

      for (const event of events) {
        const fatalities = Number(event.fatalities) || 0;
        const notes = event.notes || "";
        const truncatedNotes = notes.length > 100 ? notes.slice(0, 100) + "..." : notes;
        const country = event.country || "Unknown";
        const eventType = event.event_type || "Event";

        signals.push({
          sourceType: "acled",
          sourceUrl: "https://acleddata.com/",
          sourceTitle: `ACLED: ${eventType} in ${country} — ${truncatedNotes}`,
          signalType: fatalities > 10 ? "spike" : "mention",
          topic: "Geopolitical Fragmentation",
          rawStrength: Math.min(1, fatalities / 50),
          rawData: {
            eventType,
            country,
            fatalities,
            region: event.region,
            subEventType: event.sub_event_type,
            actor1: event.actor1,
            actor2: event.actor2,
            eventDate: event.event_date,
            notes: truncatedNotes,
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
