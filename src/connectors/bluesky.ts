import { SourceConnector, RawSignal } from "./types";

/**
 * Bluesky Connector — AT Protocol social network
 *
 * Public "What's Hot" feed from the AT Protocol. The old `searchPosts` route
 * now returns 403 without an authenticated app-view token, so we switched to
 * `getFeed` against the discover.bsky.app "whats-hot" feed generator, which
 * stays open for anonymous clients. The keyword-detection step lets us tag
 * each post with a real SIS topic.
 *
 * API: https://docs.bsky.app/
 */

// Keyword → SIS topic. Simple substring match on post text.
const TOPIC_KEYWORDS: Array<[string[], string]> = [
  [["ai", "artificial intelligence", "machine learning", "llm", "gpt", "chatbot", "neural"], "Artificial Intelligence & Automation"],
  [["climate", "global warming", "renewable", "solar", "wind power", "emissions"], "Climate Change & Sustainability"],
  [["cyber", "ransomware", "data breach", "hacking", "security"], "Cybersecurity & Zero Trust"],
  [["crypto", "bitcoin", "ethereum", "blockchain", "web3"], "Web3 & Decentralization"],
  [["geopolitical", "sanctions", "war", "election", "ukraine", "russia", "china", "taiwan"], "Geopolitical Fragmentation"],
  [["economy", "inflation", "recession", "gdp", "market"], "Economic Trends"],
  [["pandemic", "vaccine", "health"], "Health, Biotech & Longevity"],
  [["energy", "oil", "gas", "nuclear"], "Energy Transition & Decarbonization"],
];

const WHATS_HOT_FEED =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  for (const [keywords, topic] of TOPIC_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return "Technological Disruption";
}

export const blueskyConnector: SourceConnector = {
  name: "bluesky",
  // Backlog "Quellen-Namensinkonsistenzen" (2026-04-22): Einheitlicher
  // Anzeigename quer durch SOURCES.md, /cockpit Quellen-Tabelle und
  // /dokumentation. „AT Protocol" beschreibt die Plattform präziser als
  // das generische „Social" und stimmt mit der externen Markenführung
  // von Bluesky überein.
  displayName: "Bluesky (AT Protocol)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(WHATS_HOT_FEED)}&limit=30`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return signals;

      const data = await res.json();
      // getFeed returns { feed: [ { post: {...} }, ... ] }
      const items = (data.feed || []) as Array<{ post: Record<string, unknown> }>;

      for (const item of items) {
        const post = item.post as Record<string, unknown>;
        if (!post) continue;
        const record = post.record as { text?: string; createdAt?: string } | undefined;
        const author = (post.author as { handle?: string } | undefined)?.handle || "unknown";
        const text = (record?.text || "").slice(0, 200);
        if (!text) continue;
        const likes = Number(post.likeCount || 0);
        const reposts = Number(post.repostCount || 0);
        const replies = Number(post.replyCount || 0);
        const engagement = likes + reposts + replies;

        // Build post-specific URL using the AT URI (at://did/app.bsky.feed.post/rkey)
        let sourceUrl = `https://bsky.app/profile/${author}`;
        const atUri = post.uri as string | undefined;
        if (atUri) {
          const rkey = atUri.split("/").pop();
          if (rkey) sourceUrl = `https://bsky.app/profile/${author}/post/${rkey}`;
        }

        const topic = detectTopic(text);

        signals.push({
          sourceType: "bluesky",
          sourceUrl,
          sourceTitle: `Bluesky @${author}: ${text.slice(0, 80)}...`,
          signalType: engagement > 50 ? "spike" : "discussion",
          topic,
          rawStrength: Math.min(1, engagement / 100),
          rawData: {
            text,
            author,
            likes,
            reposts,
            replies,
            createdAt: record?.createdAt,
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
