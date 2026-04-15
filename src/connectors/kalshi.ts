import { SourceConnector, RawSignal } from "./types";

/**
 * Kalshi Connector — Regulated prediction market
 *
 * Open markets on politics, economics, and world events.
 * Public market listing requires no auth.
 *
 * API: https://api.elections.kalshi.com/trade-api/v2/
 * (The old `trading-api.kalshi.com` host now returns 401 + a migration notice;
 * the elections subdomain is the current public listing endpoint.)
 */

const CATEGORY_TOPICS: Record<string, string> = {
  Politics: "Geopolitical Fragmentation",
  Economics: "Economic Trends",
  Tech: "Technological Disruption",
  Climate: "Climate Change & Sustainability",
  Finance: "Economic Trends",
  Science: "Artificial Intelligence & Automation",
  Health: "Health & Wellbeing",
};

export const kalshiConnector: SourceConnector = {
  name: "kalshi",
  displayName: "Kalshi (Prediction Market)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&status=open",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const markets = data.markets || [];

      for (const market of markets) {
        const title = market.title || market.ticker || "Unknown";
        const category = market.category || "Economics";
        const topic = CATEGORY_TOPICS[category] || "Economic Trends";
        const yesPrice = market.yes_bid ?? market.last_price ?? 0.5;
        const volume = market.volume || 0;

        signals.push({
          sourceType: "kalshi",
          sourceUrl: `https://kalshi.com/markets/${market.ticker || ""}`,
          sourceTitle: `Kalshi: ${title.slice(0, 120)} (${(yesPrice * 100).toFixed(0)}%)`,
          signalType: volume > 10000 ? "spike" : "discussion",
          topic,
          rawStrength: Math.min(1, volume / 50000),
          rawData: {
            title,
            ticker: market.ticker,
            category,
            yesPrice,
            volume,
            closeTime: market.close_time,
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
