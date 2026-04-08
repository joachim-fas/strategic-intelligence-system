import { buildDeclarativeConnector } from "./framework";

/**
 * CoinGecko — Top 100 crypto assets by market cap.
 *
 * Public, no-auth API. Returns live price, market cap, and 24h % change for
 * each coin. We treat the absolute 24h price move as the signal strength:
 * ±20% or more saturates to 1.0, ±1% lands around 0.05 and is dropped.
 *
 * SIS interpretation: big moves in majors = market-wide Web3 regime change.
 * Big moves in long-tail alts = speculative rotation.
 *
 * Endpoint: https://api.coingecko.com/api/v3/coins/markets
 * Rate limit: 30 calls/min free tier (no auth). We call once per pipeline run.
 */

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  price_change_percentage_24h: number | null;
  last_updated: string;
}

export const coingeckoConnector = buildDeclarativeConnector<CoinGeckoCoin>({
  name: "coingecko",
  displayName: "CoinGecko (Crypto Markets)",
  endpoint:
    "https://api.coingecko.com/api/v3/coins/markets" +
    "?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=false" +
    "&price_change_percentage=24h",
  defaultTopic: "Web3 & Decentralization",
  defaultSignalType: "spike",
  minStrength: 0.05,
  limit: 100,
  map: (coin) => {
    const change = coin.price_change_percentage_24h;
    if (change == null || !Number.isFinite(change)) return null;
    // Normalise: ±20% and above saturates to 1.0; ±1% lands around 0.05.
    const strength = Math.min(1, Math.abs(change) / 20);
    const priceStr =
      coin.current_price != null
        ? `$${coin.current_price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`
        : "?";
    const pct = change.toFixed(1);
    return {
      sourceUrl: `https://www.coingecko.com/en/coins/${coin.id}`,
      sourceTitle: `${coin.name} (${coin.symbol.toUpperCase()}): ${priceStr} · ${
        change >= 0 ? "+" : ""
      }${pct}% 24h`,
      rawStrength: strength,
      detectedAt: new Date(coin.last_updated),
      rawData: {
        coinId: coin.id,
        symbol: coin.symbol,
        priceUsd: coin.current_price,
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        change24h: change,
      },
    };
  },
});
