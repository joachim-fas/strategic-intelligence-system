import { SourceConnector, RawSignal } from "./types";

/**
 * Mastodon Public Timeline Connector
 *
 * Public federated timeline from mastodon.social.
 * No authentication required for public timelines.
 *
 * API: https://docs.joinmastodon.org/methods/timelines/
 */

const KEYWORD_TOPICS: Record<string, string> = {
  ai: "Artificial Intelligence & Automation",
  climate: "Climate Change & Sustainability",
  economy: "Economic Trends",
  politics: "Geopolitical Fragmentation",
  tech: "Technological Disruption",
  security: "Security, Trust & Resilience",
  health: "Health & Wellbeing",
};

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, topic] of Object.entries(KEYWORD_TOPICS)) {
    if (lower.includes(keyword)) return topic;
  }
  return "Technological Disruption";
}

export const mastodonApiConnector: SourceConnector = {
  name: "mastodon_api",
  displayName: "Mastodon (Public Timeline)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://mastodon.social/api/v1/timelines/public?limit=20",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const statuses = await res.json();

      for (const status of (statuses || []).slice(0, 20)) {
        const text = (status.content || "").replace(/<[^>]*>/g, "").slice(0, 200);
        const author = status.account?.acct || "unknown";
        const boosts = status.reblogs_count || 0;
        const favs = status.favourites_count || 0;
        const engagement = boosts + favs;
        const topic = detectTopic(text);

        signals.push({
          sourceType: "mastodon_api",
          sourceUrl: status.url || "https://mastodon.social/",
          sourceTitle: `Mastodon @${author}: ${text.slice(0, 80)}`,
          signalType: engagement > 20 ? "spike" : "discussion",
          topic,
          rawStrength: Math.min(1, engagement / 50),
          rawData: {
            text,
            author,
            boosts,
            favs,
            language: status.language,
            createdAt: status.created_at,
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
