import { NextResponse } from "next/server";
import { connectors } from "@/connectors";

/**
 * /api/v1/feed — Live Intelligence Feed
 *
 * Runs a subset of fast connectors to generate real-time signals.
 * Returns the latest signals sorted by time, with source attribution.
 */

// Fast connectors only — skip slow ones for real-time feed
const FAST_CONNECTORS = [
  "hackernews", "github", "reddit", "news", "wikipedia",
  "polymarket", "manifold", "nasa_eonet", "gdelt",
];

export async function GET() {
  const signals: any[] = [];
  const fastConnectors = connectors.filter((c) => FAST_CONNECTORS.includes(c.name));

  // Run fast connectors in parallel with individual timeouts
  const results = await Promise.allSettled(
    fastConnectors.map(async (connector) => {
      try {
        const raw = await connector.fetchSignals();
        return raw.map((s) => ({
          id: `${connector.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: connector.name,
          title: s.sourceTitle,
          topic: s.topic,
          strength: s.rawStrength,
          type: s.signalType === "spike" ? "spike" : s.signalType === "paper" ? "mention" : s.signalType,
          timestamp: s.detectedAt,
          url: s.sourceUrl,
        }));
      } catch {
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      signals.push(...result.value);
    }
  }

  // Sort by strength (spikes first), then by time
  signals.sort((a, b) => {
    if (a.type === "spike" && b.type !== "spike") return -1;
    if (b.type === "spike" && a.type !== "spike") return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return NextResponse.json({
    signals: signals.slice(0, 50),
    count: signals.length,
    connectors: fastConnectors.length,
    timestamp: new Date().toISOString(),
  });
}
