import { SourceConnector, RawSignal } from "./types";

/**
 * Destatis Connector — German Federal Statistical Office
 * Completely free, no API key required (uses GUEST access)
 *
 * Official German economic and social statistics.
 * GENESIS-Online REST API with ffcsv format output.
 *
 * API: https://www.destatis.de/EN/Service/OpenData/api-webservice.html
 * License: Data Licence Germany – Attribution – Version 2.0
 */

const TABLES: { code: string; label: string; topic: string; unit: string }[] = [
  { code: "61111-0002", label: "Germany Consumer Prices (CPI)", topic: "Economic Trends", unit: "index" },
  { code: "13211-0001", label: "Germany Unemployment Rate", topic: "Future of Work", unit: "%" },
  { code: "42153-0001", label: "Germany Industrial Production Index", topic: "Economic Trends", unit: "index" },
];

const GENESIS_BASE = "https://www-genesis.destatis.de/genesisWS/rest/2020";

export const destatisConnector: SourceConnector = {
  name: "destatis",
  displayName: "Destatis (German Federal Statistics)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const table of TABLES) {
      try {
        const url = `${GENESIS_BASE}/data/tablefile?name=${table.code}&area=all&compress=false&transpose=false&startyear=2023&format=ffcsv&language=en&username=GUEST&password=GUEST`;
        const res = await fetch(url, {
          headers: { "User-Agent": "SIS/1.0 (mailto:sis@strategic-intelligence.app)" },
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) continue;
        const csv = await res.text();
        if (!csv || csv.length < 50) continue;

        // ffcsv format: semicolon-separated, skip metadata header lines
        const lines = csv.split("\n").filter(l => l.trim() && !l.startsWith('"'));
        if (lines.length < 2) continue;

        // Find data rows — numeric values in last column
        const dataLines = lines.filter(l => {
          const parts = l.split(";");
          return parts.length >= 2 && !isNaN(parseFloat(parts[parts.length - 1].replace(",", ".")));
        });

        if (dataLines.length < 1) continue;

        const lastLine = dataLines[dataLines.length - 1];
        const parts = lastLine.split(";");
        const valueStr = parts[parts.length - 1].replace(",", ".").trim();
        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;

        const prevLine = dataLines.length >= 2 ? dataLines[dataLines.length - 2] : null;
        const prevValue = prevLine ? parseFloat(prevLine.split(";").pop()!.replace(",", ".").trim()) : null;
        const change = prevValue != null && prevValue !== 0 ? (value - prevValue) / Math.abs(prevValue) : 0;

        signals.push({
          sourceType: "destatis",
          sourceUrl: `https://www.destatis.de/DE/Themen/`,
          sourceTitle: `Destatis: ${table.label} = ${value.toFixed(1)}${table.unit === "%" ? "%" : ""}${prevValue != null ? ` (${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}% vs prior)` : ""}`,
          signalType: Math.abs(change) > 0.1 ? "spike" : "mention",
          topic: table.topic,
          rawStrength: Math.min(1, Math.abs(change) + 0.3),
          rawData: { code: table.code, label: table.label, value, prevValue, change },
          detectedAt: new Date(),
        });
      } catch {
        // API unavailable — skip
      }
    }

    return signals;
  },
};
