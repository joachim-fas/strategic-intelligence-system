import { buildDeclarativeConnector } from "./framework";

/**
 * USGS Earthquake Hazards Program — Significant seismic events (last 30 days).
 *
 * Ingests the USGS "Magnitude 4.5+ Past Month" GeoJSON feed — a live,
 * authoritative feed of every earthquake above M4.5 worldwide in the
 * trailing 30 days. Updated every ~5 minutes by USGS upstream.
 *
 * Why: the existing climate-hazard coverage (NASA EONET) tracks wildfires,
 * storms, floods and volcanic activity but explicitly excludes seismic
 * events. This connector closes that gap and gives the SIS a geophysical-
 * risk signal relevant to supply-chain disruption, geopolitical stability,
 * and infrastructure-resilience analyses.
 *
 * Topic mapping: every signal lands on "Security, Trust & Resilience" —
 * the closest semantic match in the SIS trend taxonomy for natural-hazard
 * disruption. Granularity (magnitude, depth, coordinates, tsunami flag)
 * is preserved in rawData for downstream analysis.
 *
 * Strength: USGS publishes a `sig` (significance) field that combines
 * magnitude, impact, "felt" reports, and alert level into a single 0–1000
 * score. We divide by 1000 and clamp to [0, 1]. A sig > 600 is headline
 * news, sig 100-400 is noteworthy regional, sig < 100 is background noise
 * and gets dropped by minStrength.
 *
 * Endpoint: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/
 *           4.5_month.geojson
 *
 * Shape: standard GeoJSON FeatureCollection — `features` is the array
 * of events, each with `properties` holding the magnitude/place/sig
 * fields. We point rowsPath at "features" and drill into `properties`
 * inside `map()`.
 *
 * Rate limit: none documented, USGS allows polling every ~1 min.
 */

interface UsgsFeature {
  type: "Feature";
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null; // unix ms
    updated: number | null;
    url: string;
    sig: number | null; // 0–1000 significance
    tsunami: 0 | 1;
    alert: "green" | "yellow" | "orange" | "red" | null;
    magType: string | null;
    status: string | null;
    title: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number]; // lon, lat, depth_km
  };
  id: string;
}

export const usgsEarthquakeConnector = buildDeclarativeConnector<UsgsFeature>({
  name: "usgs-earthquake",
  displayName: "USGS Earthquakes (Seismic Hazard)",
  endpoint:
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
  defaultTopic: "Security, Trust & Resilience",
  defaultSignalType: "spike",
  rowsPath: "features",
  // Drops the long tail of tiny M4.5 events with no significance score —
  // we only ingest events the USGS itself flags as noteworthy.
  minStrength: 0.1,
  limit: 100, // top 100 by recency — USGS returns newest-first
  map: (feature) => {
    const p = feature.properties;
    if (!p || typeof p.title !== "string") return null;
    const mag = p.mag;
    if (mag == null || !Number.isFinite(mag) || mag < 4.5) return null;
    // sig ranges 0–1000 — normalise to [0, 1]. A few events are missing
    // sig entirely; fall back to a magnitude-based estimate so we don't
    // silently drop real hazards.
    const sigRaw = p.sig;
    const strength =
      sigRaw != null && Number.isFinite(sigRaw)
        ? Math.min(1, sigRaw / 1000)
        : Math.min(1, Math.max(0, (mag - 4.5) / 4)); // M4.5 → 0, M8.5+ → 1
    if (!Number.isFinite(strength) || strength <= 0) return null;
    const depthKm = feature.geometry?.coordinates?.[2];
    const tsunamiNote = p.tsunami === 1 ? " · TSUNAMI" : "";
    const alertNote = p.alert ? ` · ${p.alert.toUpperCase()}` : "";
    const depthStr =
      depthKm != null && Number.isFinite(depthKm)
        ? ` · ${depthKm.toFixed(0)}km deep`
        : "";
    return {
      sourceUrl: p.url,
      sourceTitle: `M${mag.toFixed(1)} ${p.place ?? "unknown location"}${depthStr}${tsunamiNote}${alertNote}`,
      rawStrength: strength,
      detectedAt: p.time ? new Date(p.time) : new Date(),
      rawData: {
        usgsId: feature.id,
        magnitude: mag,
        magType: p.magType,
        place: p.place,
        significance: sigRaw,
        tsunami: p.tsunami === 1,
        alert: p.alert,
        depthKm,
        coordinates: feature.geometry?.coordinates,
        url: p.url,
        status: p.status,
      },
    };
  },
});
