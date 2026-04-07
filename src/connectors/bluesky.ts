import { SourceConnector, RawSignal } from "./types";

/**
 * Bluesky Connector — AT Protocol social network
 *
 * Public post search for tech/AI discussions.
 * No authentication required for public API.
 *
 * API: https://docs.bsky.app/
 */

export const blueskyConnector: SourceConnector = {
  name: "bluesky",
  displayName: "Bluesky (Social)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=AI&limit=20",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const posts = data.posts || [];

      for (const post of posts) {
        const text = (post.record?.text || "").slice(0, 200);
        const author = post.author?.handle || "unknown";
        const likes = post.likeCount || 0;
        const reposts = post.repostCount || 0;
        const engagement = likes + reposts;

        signals.push({
          sourceType: "bluesky",
          sourceUrl: `https://bsky.app/profile/${author}`,
          sourceTitle: `Bluesky @${author}: ${text.slice(0, 80)}...`,
          signalType: engagement > 50 ? "spike" : "discussion",
          topic: "Technological Disruption",
          rawStrength: Math.min(1, engagement / 100),
          rawData: {
            text,
            author,
            likes,
            reposts,
            createdAt: post.record?.createdAt,
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
