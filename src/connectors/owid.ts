import { SourceConnector, RawSignal } from "./types";

/**
 * Our World in Data Connector — completely free, no API key
 *
 * Tracks long-term global development indicators on technology adoption,
 * energy transition, health, and sustainability.
 *
 * Data: https://ourworldindata.org — CC BY 4.0 License
 * API: https://docs.owid.io/projects/etl/api/
 */

interface OwidIndicator {
  slug: string;
  label: string;
  topic: string;
  entityCode?: string; // ISO code e.g. "OWID_WRL" for world
}

const INDICATORS: OwidIndicator[] = [
  { slug: "share-electricity-renewables", label: "Global Renewable Electricity Share", topic: "Energy Transition & Decarbonization" },
  { slug: "internet-users-by-technology", label: "Global Internet Users", topic: "Connectivity & Digital Networks" },
  { slug: "life-expectancy", label: "Global Life Expectancy", topic: "Health, Biotech & Longevity" },
  { slug: "co2-emissions-per-capita", label: "CO₂ Emissions Per Capita", topic: "Climate Change & Sustainability" },
  { slug: "urban-and-rural-population", label: "World Urban Population", topic: "Urbanization & Smart Cities" },
];

export const owidConnector: SourceConnector = {
  name: "owid",
  displayName: "Our World in Data (Global Trends)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const ind of INDICATORS) {
      try {
        // Use OWID's latest data endpoint — returns CSV with latest values
        const url = `https://ourworldindata.org/grapher/${ind.slug}.csv?time=latest`;
        const res = await fetch(url, {
          headers: { "User-Agent": "SIS/1.0 (mailto:sis@strategic-intelligence.app)" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) continue;

        const csv = await res.text();
        const lines = csv.split("\n").filter(Boolean);
        if (lines.length < 2) continue;

        // CSV columns: Entity,Code,Year,{metric}
        const header = lines[0].split(",");
        const metricCol = header.length > 3 ? header.slice(3).join(",") : header[3] ?? "";

        // Find world row or first row
        const worldRow = lines.slice(1).find((l) => l.startsWith("World,") || l.includes(",OWID_WRL,"));
        const dataRow = worldRow ?? lines[1];
        const parts = dataRow.split(",");
        if (parts.length < 4) continue;

        const year = parts[2]?.trim();
        const valueStr = parts[3]?.trim();
        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;

        signals.push({
          sourceType: "owid",
          sourceUrl: `https://ourworldindata.org/grapher/${ind.slug}`,
          sourceTitle: `OWID: ${ind.label} — ${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} (${year})`,
          signalType: "mention",
          topic: ind.topic,
          rawStrength: 0.5, // TODO: compute strength dynamically from signal data
          rawData: { slug: ind.slug, label: ind.label, value, year, metric: metricCol },
          detectedAt: new Date(),
        });
      } catch {
        // Timeout or parse error — skip
      }
    }

    return signals;
  },
};
