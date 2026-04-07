import { SourceConnector, RawSignal } from "./types";

/**
 * Manifold Markets Connector — free, no API key
 *
 * Prediction market with play money but serious forecasting.
 * Covers AI, geopolitics, climate, tech, and policy.
 * Complements Polymarket (real money) with broader topic coverage.
 *
 * API: https://docs.manifold.markets/api
 */

const TOPIC_SEARCHES: { query: string; topic: string }[] = [
  { query: "AI artificial intelligence", topic: "Artificial Intelligence & Automation" },
  { query: "climate change temperature", topic: "Climate Change & Sustainability" },
  { query: "war conflict military", topic: "Geopolitical Fragmentation" },
  { query: "election president", topic: "Geopolitical Fragmentation" },
  { query: "recession inflation economy", topic: "Economic Trends" },
  { query: "quantum computing", topic: "Quantum Computing" },
  { query: "energy renewable nuclear", topic: "Energy Transition & Decarbonization" },
  { query: "cybersecurity hack breach", topic: "Cybersecurity & Zero Trust" },
  { query: "pandemic virus health", topic: "Health, Biotech & Longevity" },
  { query: "regulation EU policy", topic: "Security, Trust & Resilience" },
];

export const manifoldConnector: SourceConnector = {
  name: "manifold",
  displayName: "Manifold Markets (Predictions)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const { query, topic } of TOPIC_SEARCHES) {
      try {
        const res = await fetch(
          `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(query)}&limit=5&sort=liquidity`,
          { signal: AbortSignal.timeout(20000) }
        );

        if (!res.ok) continue;

        const markets = await res.json();
        if (!Array.isArray(markets) || markets.length === 0) continue;

        for (const market of markets) {
          const prob = market.probability || 0.5;
          const question = market.question || "";
          if (!question) continue;

          signals.push({
            sourceType: "manifold",
            sourceUrl: `https://manifold.markets/${market.creatorUsername}/${market.slug}`,
            sourceTitle: `Manifold: ${question.slice(0, 80)} (${(prob * 100).toFixed(0)}%)`,
            signalType: "mention",
            topic,
            rawStrength: prob,
            rawData: {
              marketId: market.id,
              probability: prob,
              volume: market.volume || 0,
              liquidity: market.totalLiquidity || 0,
              closeTime: market.closeTime,
              type: "prediction_market",
            },
            detectedAt: new Date(),
          });
        }
      } catch {
        // Rate limit or timeout
      }
    }

    return signals;
  },
};
