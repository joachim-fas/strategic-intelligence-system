import { buildDeclarativeConnector, matchTopicByKeywords } from "./framework";

/**
 * DeFi Llama — Top DeFi protocols by Total Value Locked (TVL).
 *
 * Open-source DeFi TVL tracker. Public, no auth required. We pull the top
 * protocols ranked by TVL and use the 1-day TVL change as signal strength.
 * A protocol leaking 10% TVL in 24h is a strong risk signal; a protocol
 * gaining 20% is an adoption signal.
 *
 * Endpoint: https://api.llama.fi/protocols
 */

interface DeFiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  chains: string[];
  tvl: number;
  change_1d: number | null;
  change_7d: number | null;
  url: string | null;
}

// Map DeFi category tags to SIS trend topics. All DeFi-adjacent categories
// subsume into "Web3 & Decentralization" because the DB has no dedicated
// "Alternative Finance" or "Privacy & Data Protection" trend. Granularity
// is preserved in rawData.category for downstream analysis.
const CATEGORY_TOPICS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["lending", "credit", "cdp"],             "Web3 & Decentralization"],
  [["dex", "dexes", "liquidity"],             "Web3 & Decentralization"],
  [["stablecoin"],                            "Web3 & Decentralization"],
  [["restaking", "staking", "yield"],         "Web3 & Decentralization"],
  [["rwa", "real world"],                     "Web3 & Decentralization"],
  [["privacy"],                               "Web3 & Decentralization"],
];

export const defiLlamaConnector = buildDeclarativeConnector<DeFiLlamaProtocol>({
  name: "defi-llama",
  displayName: "DeFi Llama (Protocol TVL)",
  endpoint: "https://api.llama.fi/protocols",
  defaultTopic: "Web3 & Decentralization",
  defaultSignalType: "spike",
  minStrength: 0.08,
  limit: 60, // top 60 by TVL — enough to catch long-tail movements
  map: (p) => {
    if (!p.name || p.tvl == null || p.tvl < 10_000_000) return null; // skip dust
    const change = p.change_1d;
    if (change == null || !Number.isFinite(change)) return null;
    // ±50% in 24h saturates to 1.0.
    const strength = Math.min(1, Math.abs(change) / 50);
    const topic =
      matchTopicByKeywords(`${p.category ?? ""} ${p.name}`, CATEGORY_TOPICS) ??
      "Web3 & Decentralization";
    const tvlStr =
      p.tvl >= 1_000_000_000
        ? `$${(p.tvl / 1_000_000_000).toFixed(2)}B`
        : `$${(p.tvl / 1_000_000).toFixed(0)}M`;
    const pct = change.toFixed(1);
    return {
      sourceUrl: p.url ?? `https://defillama.com/protocol/${p.slug}`,
      sourceTitle: `${p.name} (${p.category ?? "DeFi"}): ${tvlStr} TVL · ${
        change >= 0 ? "+" : ""
      }${pct}% 24h`,
      topic,
      rawStrength: strength,
      rawData: {
        protocolId: p.id,
        slug: p.slug,
        tvlUsd: p.tvl,
        change1d: change,
        change7d: p.change_7d,
        category: p.category,
        chains: p.chains,
      },
    };
  },
});
