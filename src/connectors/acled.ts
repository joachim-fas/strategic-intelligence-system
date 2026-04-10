import { SourceConnector, RawSignal } from "./types";

/**
 * ACLED Armed Conflict Data Connector
 *
 * Real-time data on political violence and protest events worldwide.
 * Requires free registration at https://acleddata.com/
 *
 * API: https://apidocs.acleddata.com/
 */

// CON-11: Event-type-based base strength so non-fatal events (protests,
// strategic developments, coups) are not invisible at rawStrength 0.
const EVENT_TYPE_BASE_STRENGTH: Record<string, number> = {
  "Battles": 0.7,
  "Violence against civilians": 0.8,
  "Protests": 0.5,
  "Riots": 0.6,
  "Strategic developments": 0.6,
  "Explosions/Remote violence": 0.7,
};

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
      // NOTE: API key in URL - required by ACLED API's design
      const url = `https://api.acleddata.com/acled/read?event_date=${encodeURIComponent(dateRange)}&event_date_where=BETWEEN&limit=50&key=${key}&email=${encodeURIComponent(email)}`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
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

        // CON-11: Combine event-type base strength with fatality bonus
        const baseTypeStrength = EVENT_TYPE_BASE_STRENGTH[eventType] ?? 0.5;
        const rawStrength = Math.min(
          1,
          baseTypeStrength + (fatalities > 0 ? Math.min(0.3, fatalities / 100) : 0),
        );

        signals.push({
          sourceType: "acled",
          sourceUrl: "https://acleddata.com/",
          sourceTitle: `ACLED: ${eventType} in ${country} — ${truncatedNotes}`,
          signalType: fatalities > 10 ? "spike" : "mention",
          topic: "Geopolitical Fragmentation",
          rawStrength,
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
