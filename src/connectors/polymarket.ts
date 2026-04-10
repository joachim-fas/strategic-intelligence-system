import { SourceConnector, RawSignal } from "./types";

/**
 * Polymarket Connector
 *
 * Pulls prediction market data for trend-relevant events.
 * Prediction markets aggregate crowd wisdom with real money at stake —
 * a fundamentally different confidence signal than expert opinions.
 *
 * API: https://docs.polymarket.com/
 * Public CLOB API: https://clob.polymarket.com
 */

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  end_date_iso?: string;
  markets: {
    id: string;
    question: string;
    outcome_prices?: { yes: number; no: number };
    tokens?: { outcome: string; price: number }[];
    volume?: number;
    liquidity?: number;
  }[];
}

const POLYMARKET_API = "https://gamma-api.polymarket.com";

// Categories to track — maps Polymarket tags to our trend topics
const TOPIC_KEYWORDS: [string[], string][] = [
  [["ai", "artificial intelligence", "openai", "google ai", "chatgpt", "claude"], "Artificial Intelligence & Automation"],
  [["climate", "temperature", "carbon", "paris agreement", "cop"], "Climate Change & Sustainability"],
  [["war", "invasion", "conflict", "military", "ukraine", "taiwan", "nato"], "Geopolitical Fragmentation"],
  [["election", "president", "prime minister", "parliament"], "Geopolitical Fragmentation"],
  [["crypto", "bitcoin", "ethereum", "btc", "stablecoin"], "Web3 & Decentralization"],
  [["recession", "inflation", "fed", "interest rate", "gdp"], "Economic Trends"],
  [["regulation", "ban", "eu act", "sec"], "Security, Trust & Resilience"],
  [["pandemic", "virus", "vaccine", "who"], "Health, Biotech & Longevity"],
  [["energy", "oil", "solar", "nuclear", "renewable"], "Energy Transition & Decarbonization"],
  [["tech", "startup", "ipo", "acquisition"], "Technological Disruption"],
  [["autonomous", "self-driving", "ev", "tesla"], "Mobility & Autonomous Transport"],
  [["quantum", "computing"], "Quantum Computing"],
  [["space", "spacex", "nasa", "mars"], "Technological Disruption"],
  [["cyber", "hack", "ransomware"], "Cybersecurity & Zero Trust"],
];

function matchTopic(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keywords, topic] of TOPIC_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return null;
}

export const polymarketConnector: SourceConnector = {
  name: "polymarket",
  displayName: "Polymarket (Prediction Markets)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // Fetch active events
      const res = await fetch(`${POLYMARKET_API}/events?closed=false&limit=100&order=volume`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return signals;

      const events: PolymarketEvent[] = await res.json();

      for (const event of events) {
        const topic = matchTopic(event.title + " " + (event.description || ""));
        if (!topic) continue;

        for (const market of event.markets || []) {
          // Get the YES probability
          let yesProbability = 0.5;
          if (market.outcome_prices) {
            yesProbability = market.outcome_prices.yes;
          } else if (market.tokens) {
            const yesToken = market.tokens.find((t) => t.outcome === "Yes");
            if (yesToken) yesProbability = yesToken.price;
          }

          const volume = market.volume || 0;

          signals.push({
            sourceType: "polymarket",
            sourceUrl: `https://polymarket.com/event/${event.slug}`,
            sourceTitle: market.question || event.title,
            signalType: "mention",
            topic,
            rawStrength: 0.3 + Math.abs(0.5 - yesProbability) * 1.4, // Extreme predictions = stronger signal
            rawData: {
              eventId: event.id,
              marketId: market.id,
              probability: yesProbability,
              volume,
              liquidity: market.liquidity,
              endDate: event.end_date_iso,
              type: "prediction_market",
            },
            detectedAt: new Date(),
          });
        }
      }
    } catch {
      // API unavailable or rate limited
    }

    return signals;
  },
};

/**
 * Extract prediction market signals for a specific trend
 * Used by the scenario system to get relevant predictions
 */
export async function getPredictionsForTrend(trendName: string): Promise<{
  question: string;
  probability: number;
  volume: number;
  url: string;
}[]> {
  try {
    const searchQuery = trendName.toLowerCase().split(" ").slice(0, 3).join(" ");
    const res = await fetch(
      `${POLYMARKET_API}/events?closed=false&limit=20&title=${encodeURIComponent(searchQuery)}`,
      { signal: AbortSignal.timeout(20000) }
    );

    if (!res.ok) return [];

    const events: PolymarketEvent[] = await res.json();
    const predictions: { question: string; probability: number; volume: number; url: string }[] = [];

    for (const event of events) {
      for (const market of event.markets || []) {
        let prob = 0.5;
        if (market.outcome_prices) prob = market.outcome_prices.yes;
        else if (market.tokens) {
          const yesToken = market.tokens.find((t) => t.outcome === "Yes");
          if (yesToken) prob = yesToken.price;
        }

        predictions.push({
          question: market.question || event.title,
          probability: prob,
          volume: market.volume || 0,
          url: `https://polymarket.com/event/${event.slug}`,
        });
      }
    }

    return predictions.sort((a, b) => b.volume - a.volume);
  } catch {
    return [];
  }
}
