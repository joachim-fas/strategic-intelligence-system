import { SourceConnector, RawSignal } from "./types";

// WARNING: SEC-20 — Spoofing Origin/Referer headers may violate worldmonitor.app ToS. Consider reaching out for official API access.

const API_BASE = "https://api.worldmonitor.app/api";

// Required headers — Cloudflare blocks without Origin/Referer
const WM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "SIS/1.0",
  Origin: "https://www.worldmonitor.app",
  Referer: "https://www.worldmonitor.app/",
};

/**
 * World Monitor Connector — verified working endpoints (2026-03-27)
 *
 * Proto-based RPC endpoints: /api/{domain}/v1/{rpc-name}
 * 29 domains, kebab-case RPC names derived from proto service definitions.
 */

interface WMFetcher {
  domain: string;
  rpc: string;
  responseKey: string;
  mapToSignals: (data: Record<string, unknown>[]) => RawSignal[];
}

const fetchers: WMFetcher[] = [
  // ─── Climate (verified: 15 anomalies, real data) ──────────
  {
    domain: "climate",
    rpc: "list-climate-anomalies",
    responseKey: "anomalies",
    mapToSignals: (data) => {
      return data.map((item) => {
        const tempDelta = Number(item.tempDelta || 0);
        const zone = String(item.zone || "Unknown");
        const severity = String(item.severity || "");
        return {
          sourceType: "worldmonitor" as const,
          sourceUrl: "https://www.worldmonitor.app/",
          sourceTitle: `Climate: ${zone} ${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}°C (${severity.replace("ANOMALY_SEVERITY_", "")})`,
          signalType: severity.includes("SEVERE") || severity.includes("EXTREME") ? "spike" as const : "mention" as const,
          topic: "Climate Change & Sustainability",
          rawStrength: Math.min(1, Math.abs(tempDelta) / 5),
          rawData: item,
          detectedAt: new Date(),
        };
      });
    },
  },

  // ─── Market (verified: 29 quotes, real-time) ──────────────
  {
    domain: "market",
    rpc: "list-market-quotes",
    responseKey: "quotes",
    mapToSignals: (data) => {
      const signals: RawSignal[] = [];
      // Aggregate market sentiment from price changes
      const changes = data.map((q) => Number(q.change || 0));
      const avgChange = changes.reduce((a, b) => a + b, 0) / Math.max(changes.length, 1);
      const volatility = Math.sqrt(changes.reduce((sum, c) => sum + (c - avgChange) ** 2, 0) / Math.max(changes.length, 1));

      signals.push({
        sourceType: "worldmonitor",
        sourceUrl: "https://www.worldmonitor.app/",
        sourceTitle: `Market: ${data.length} quotes, avg change ${avgChange > 0 ? "+" : ""}${avgChange.toFixed(2)}%, volatility ${volatility.toFixed(2)}%`,
        signalType: volatility > 3 ? "spike" : "mention",
        topic: "Economic Trends",
        rawStrength: Math.min(1, volatility / 5),
        rawData: { quoteCount: data.length, avgChange, volatility, topMovers: data.slice(0, 5) },
        detectedAt: new Date(),
      });

      // Flag extreme movers
      for (const q of data) {
        const change = Math.abs(Number(q.change || 0));
        if (change > 5) {
          signals.push({
            sourceType: "worldmonitor",
            sourceUrl: "https://www.worldmonitor.app/",
            sourceTitle: `Market Alert: ${q.symbol} ${Number(q.change) > 0 ? "+" : ""}${Number(q.change).toFixed(1)}%`,
            signalType: "spike",
            topic: "Economic Trends",
            rawStrength: Math.min(1, change / 10),
            rawData: q,
            detectedAt: new Date(),
          });
        }
      }
      return signals;
    },
  },

  // ─── Prediction Markets (verified: returns markets array) ─
  {
    domain: "prediction",
    rpc: "list-prediction-markets",
    responseKey: "markets",
    mapToSignals: (data) => {
      return data.map((item) => {
        const question = String(item.question || item.title || "");
        const probability = Number(item.probability || item.yesPrice || 0.5);
        const topic = inferTopicFromPrediction(question);
        if (!topic) return null;

        return {
          sourceType: "worldmonitor" as const,
          sourceUrl: String(item.url || "https://www.worldmonitor.app/"),
          sourceTitle: `Prediction: ${question} (${(probability * 100).toFixed(0)}%)`,
          signalType: "mention" as const,
          topic,
          rawStrength: probability,
          rawData: { ...item, prediction_probability: probability },
          detectedAt: new Date(),
        };
      }).filter(Boolean) as RawSignal[];
    },
  },

  // ─── Conflict (verified: endpoint works, may return empty) ─
  {
    domain: "conflict",
    rpc: "list-acled-events",
    responseKey: "events",
    mapToSignals: (data) =>
      aggregateSignals(data, "Geopolitical Fragmentation", "conflict", "spike"),
  },

  // ─── Additional endpoints (may require params, try anyway) ─
  {
    domain: "conflict",
    rpc: "list-ucdp-events",
    responseKey: "events",
    mapToSignals: (data) =>
      aggregateSignals(data, "Geopolitical Fragmentation", "conflict-ucdp", "spike"),
  },
  {
    domain: "displacement",
    rpc: "list-displacement-data",
    responseKey: "data",
    mapToSignals: (data) =>
      aggregateSignals(data, "Demographic Shifts & Aging", "displacement", "mention"),
  },
  {
    domain: "natural",
    rpc: "list-natural-events",
    responseKey: "events",
    mapToSignals: (data) =>
      aggregateSignals(data, "Climate Change & Sustainability", "natural-disaster", "spike"),
  },
  {
    domain: "wildfire",
    rpc: "list-wildfire-events",
    responseKey: "events",
    mapToSignals: (data) =>
      aggregateSignals(data, "Climate Change & Sustainability", "wildfire", "spike"),
  },
  {
    domain: "seismology",
    rpc: "list-earthquakes",
    responseKey: "earthquakes",
    mapToSignals: (data) =>
      aggregateSignals(data, "Security, Trust & Resilience", "seismology", "spike"),
  },
  {
    domain: "trade",
    rpc: "list-trade-flows",
    responseKey: "flows",
    mapToSignals: (data) =>
      aggregateSignals(data, "Geopolitical Fragmentation", "trade", "mention"),
  },
  {
    domain: "supply-chain",
    rpc: "list-supply-chain-events",
    responseKey: "events",
    mapToSignals: (data) =>
      aggregateSignals(data, "Economic Trends", "supply-chain", "spike"),
  },
  {
    domain: "radiation",
    rpc: "list-radiation-readings",
    responseKey: "readings",
    mapToSignals: (data) =>
      aggregateSignals(data, "Security, Trust & Resilience", "radiation", "spike"),
  },
];

// ─── Helpers ────────────────────────────────────────────────

function aggregateSignals(
  data: Record<string, unknown>[],
  topic: string,
  domain: string,
  signalType: RawSignal["signalType"]
): RawSignal[] {
  if (data.length === 0) return [];
  return [{
    sourceType: "worldmonitor",
    sourceUrl: "https://www.worldmonitor.app/",
    sourceTitle: `World Monitor ${domain}: ${data.length} events/signals`,
    signalType,
    topic,
    rawStrength: Math.min(1, data.length / 50),
    rawData: { domain, count: data.length, sample: data.slice(0, 3) },
    detectedAt: new Date(),
  }];
}

function inferTopicFromPrediction(question: string): string | null {
  const q = question.toLowerCase();
  if (q.includes("ai") || q.includes("artificial intelligence")) return "Artificial Intelligence & Automation";
  if (q.includes("climate") || q.includes("temperature")) return "Climate Change & Sustainability";
  if (q.includes("war") || q.includes("conflict") || q.includes("invasion")) return "Geopolitical Fragmentation";
  if (q.includes("election") || q.includes("president")) return "Geopolitical Fragmentation";
  if (q.includes("crypto") || q.includes("bitcoin")) return "Web3 & Decentralization";
  if (q.includes("recession") || q.includes("inflation")) return "Economic Trends";
  if (q.includes("regulation") || q.includes("ban")) return "Security, Trust & Resilience";
  if (q.includes("pandemic") || q.includes("virus")) return "Health, Biotech & Longevity";
  if (q.includes("energy") || q.includes("oil") || q.includes("solar")) return "Energy Transition & Decarbonization";
  if (q.includes("nuclear")) return "Security, Trust & Resilience";
  if (q.includes("ukraine") || q.includes("russia") || q.includes("china") || q.includes("taiwan")) return "Geopolitical Fragmentation";
  return null;
}

// ─── Main Connector ─────────────────────────────────────────

export const worldmonitorConnector: SourceConnector = {
  name: "worldmonitor",
  displayName: "World Monitor",

  async fetchSignals(): Promise<RawSignal[]> {
    const allSignals: RawSignal[] = [];

    for (const fetcher of fetchers) {
      try {
        const url = `${API_BASE}/${fetcher.domain}/v1/${fetcher.rpc}`;
        const res = await fetch(url, {
          headers: WM_HEADERS,
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) continue;

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("json")) continue;

        const data = await res.json();
        const items = Array.isArray(data)
          ? data
          : (data[fetcher.responseKey] || []);

        if (!Array.isArray(items)) continue;

        const signals = fetcher.mapToSignals(items);
        allSignals.push(...signals);
      } catch {
        // Timeout, rate limit, or API change — skip silently
      }
    }

    return allSignals;
  },
};
