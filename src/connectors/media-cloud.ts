import { SourceConnector, RawSignal } from "./types";

/**
 * Media Cloud Connector — Open-source media analysis
 *
 * Tracks media coverage and attention on key topics.
 * No API key required for basic search.
 *
 * API: https://search.mediacloud.org/
 */

// CON-13: Expanded query list covering major STEEP+V topics instead of only 2
// hardcoded queries. Each entry maps a search query to its SIS topic.
const MEDIA_CLOUD_QUERIES: Array<{ query: string; topic: string }> = [
  // Original 2 queries
  { query: "artificial intelligence", topic: "Artificial Intelligence & Automation" },
  { query: "climate change", topic: "Climate Change & Sustainability" },
  // CON-13: Additional STEEP+V topics
  { query: "cybersecurity", topic: "Cybersecurity & Zero Trust" },
  { query: "energy transition", topic: "Energy Transition & Decarbonization" },
  { query: "migration", topic: "Migration & Displacement" },
  { query: "geopolitics", topic: "Geopolitical Fragmentation" },
  { query: "supply chain", topic: "Platform Economy & Ecosystems" },
  { query: "cryptocurrency", topic: "Web3 & Decentralization" },
  { query: "public health", topic: "Health, Biotech & Longevity" },
];

export const mediaCloudConnector: SourceConnector = {
  name: "media_cloud",
  displayName: "Media Cloud (Media Analysis)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      for (const { query, topic } of MEDIA_CLOUD_QUERIES) {
        try {
          const encodedQuery = encodeURIComponent(query);
          const res = await fetch(
            `https://search.mediacloud.org/api/v4/search/overview?q=${encodedQuery}`,
            {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(20000),
            },
          );

          if (!res.ok) continue;

          const data = await res.json();
          const totalHits = data.total || data.total_hits || 0;

          if (totalHits > 0) {
            signals.push({
              sourceType: "media_cloud",
              sourceUrl: "https://search.mediacloud.org/",
              sourceTitle: `Media Cloud: ${totalHits} articles on ${query}`,
              signalType: totalHits > 10000 ? "spike" : "mention",
              topic,
              rawStrength: Math.min(1, totalHits / 50000),
              rawData: {
                query,
                totalHits,
                rawResponse: typeof data === "object" ? Object.keys(data) : [],
              },
              detectedAt: new Date(),
            });
          }
        } catch {
          // Individual query failed, continue with the rest
        }
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
