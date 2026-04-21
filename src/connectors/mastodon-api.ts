import { SourceConnector, RawSignal } from "./types";

/**
 * Mastodon Public Timeline Connector
 *
 * Public federated timeline from mastodon.social.
 * No authentication required for public timelines.
 *
 * API: https://docs.joinmastodon.org/methods/timelines/
 */

// CON-18: Use more specific multi-word keywords to reduce false positives.
// "tech" alone matches "techno", "technically", etc. — use more specific terms.
const KEYWORD_TOPICS: Record<string, string> = {
  "artificial intelligence": "Artificial Intelligence & Automation",
  "machine learning": "Artificial Intelligence & Automation",
  "climate change": "Climate Change & Sustainability",
  "global warming": "Climate Change & Sustainability",
  "renewable energy": "Climate Change & Sustainability",
  economy: "Economic Trends",
  inflation: "Economic Trends",
  geopolitics: "Geopolitical Fragmentation",
  "foreign policy": "Geopolitical Fragmentation",
  cybersecurity: "Security, Trust & Resilience",
  "data breach": "Security, Trust & Resilience",
  "public health": "Health & Wellbeing",
  pandemic: "Health & Wellbeing",
};

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, topic] of Object.entries(KEYWORD_TOPICS)) {
    if (lower.includes(keyword)) return topic;
  }
  return "Technological Disruption";
}

// TODO: CON-18 — Add keyword relevance scoring to filter out low-relevance
// posts. Currently matches any post containing the search term.

export const mastodonApiConnector: SourceConnector = {
  name: "mastodon_api",
  // Backlog "Quellen-Namensinkonsistenzen" (2026-04-22): auf den
  // kurzen Grid-Pill-Name („Mastodon") in /dokumentation angeglichen.
  displayName: "Mastodon",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // CON-18: Fetch public timeline — no topic-specific filtering available
      // on the public timeline endpoint. The detectTopic function below uses
      // single generic keywords (e.g. "tech") that match too broadly.
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
