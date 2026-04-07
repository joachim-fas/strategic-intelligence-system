import { SourceConnector, RawSignal } from "./types";

/**
 * Media Cloud Connector — Open-source media analysis
 *
 * Tracks media coverage and attention on key topics.
 * No API key required for basic search.
 *
 * API: https://search.mediacloud.org/
 */

export const mediaCloudConnector: SourceConnector = {
  name: "media_cloud",
  displayName: "Media Cloud (Media Analysis)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://search.mediacloud.org/api/v4/search/overview?q=artificial+intelligence",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const totalHits = data.total || data.total_hits || 0;

      if (totalHits > 0) {
        signals.push({
          sourceType: "media_cloud",
          sourceUrl: "https://search.mediacloud.org/",
          sourceTitle: `Media Cloud: ${totalHits} articles on AI`,
          signalType: totalHits > 10000 ? "spike" : "mention",
          topic: "Artificial Intelligence & Automation",
          rawStrength: Math.min(1, totalHits / 50000),
          rawData: {
            query: "artificial intelligence",
            totalHits,
            rawResponse: typeof data === "object" ? Object.keys(data) : [],
          },
          detectedAt: new Date(),
        });
      }

      // Also query for climate
      const res2 = await fetch(
        "https://search.mediacloud.org/api/v4/search/overview?q=climate+change",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (res2.ok) {
        const data2 = await res2.json();
        const hits2 = data2.total || data2.total_hits || 0;
        if (hits2 > 0) {
          signals.push({
            sourceType: "media_cloud",
            sourceUrl: "https://search.mediacloud.org/",
            sourceTitle: `Media Cloud: ${hits2} articles on climate change`,
            signalType: hits2 > 10000 ? "spike" : "mention",
            topic: "Climate Change & Sustainability",
            rawStrength: Math.min(1, hits2 / 50000),
            rawData: { query: "climate change", totalHits: hits2 },
            detectedAt: new Date(),
          });
        }
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
