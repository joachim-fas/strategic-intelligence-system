import { buildDeclarativeConnector } from "./framework";

/**
 * IDMC — Internal Displacement Monitoring Centre.
 *
 * Public, no-auth API from IDMC. We fetch the internal displacement events
 * feed, which tracks new internal displacements triggered by conflict or
 * disasters (floods, wildfires, earthquakes). Complements UNHCR which
 * tracks cross-border refugees.
 *
 * Endpoint: https://helix-tools-api.idmcdb.org/external-api/events/
 * Docs:     https://www.internal-displacement.org/
 */

interface IdmcEvent {
  id: number;
  name: string;
  event_type: string; // "Conflict" | "Disaster"
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  total_displacement: number | null;
  countries_iso3: string[] | null;
  hazard_type?: string | null;
  hazard_sub_type?: string | null;
  description?: string | null;
}

type IdmcResponse = IdmcEvent[] | { results?: IdmcEvent[] };

export const idmcConnector = buildDeclarativeConnector<IdmcEvent>({
  name: "idmc",
  displayName: "IDMC (Internal Displacement)",
  endpoint:
    "https://helix-tools-api.idmcdb.org/external-api/events/" +
    "?limit=200&ordering=-start_date",
  rowsPath: "results",
  defaultTopic: "Migration & Displacement",
  defaultSignalType: "spike",
  minStrength: 0.1,
  limit: 120,
  map: (e) => {
    if (!e.name) return null;
    const displaced = e.total_displacement ?? 0;
    if (displaced < 1000) return null;

    // 1M+ = 1.0, 100k = 0.7, 10k = 0.35, 1k = 0.1.
    const strength = Math.min(1, Math.log10(displaced) / 6);
    const totalLabel =
      displaced >= 1_000_000
        ? `${(displaced / 1_000_000).toFixed(1)}M`
        : displaced >= 1000
        ? `${Math.round(displaced / 1000)}k`
        : String(displaced);

    const countries = (e.countries_iso3 ?? []).join(", ") || "—";
    const cause = e.hazard_type ?? e.category ?? e.event_type;

    const detectedAt = e.start_date ? new Date(e.start_date) : new Date();

    return {
      sourceUrl: `https://www.internal-displacement.org/countries/`,
      sourceTitle: `${e.name} (${countries}) — ${totalLabel} displaced · ${cause}`,
      rawStrength: strength,
      detectedAt,
      rawData: {
        eventId: e.id,
        eventType: e.event_type,
        category: e.category,
        hazardType: e.hazard_type,
        totalDisplacement: displaced,
        countries: e.countries_iso3,
        startDate: e.start_date,
        endDate: e.end_date,
      },
    };
  },
});
