/**
 * Social Media Sentiment Connector
 *
 * Aggregates sentiment signals from publicly accessible social media sources.
 * Sentiment is a LEADING indicator — mood shifts before markets and policies.
 *
 * Sources:
 * - Reddit (already have a connector, this adds sentiment scoring)
 * - YouTube trending (public API)
 * - Mastodon/Fediverse (public API, no auth needed)
 * - RSS news sentiment (headline analysis)
 */

import { SourceConnector, RawSignal } from "./types";

// Simple keyword-based sentiment scoring
// In production: use a local LLM (Transformers.js) or API
const POSITIVE_WORDS = new Set([
  "breakthrough", "innovation", "growth", "success", "record", "surge",
  "advance", "improve", "progress", "opportunity", "bullish", "boom",
  "durchbruch", "wachstum", "erfolg", "rekord", "fortschritt", "chance",
]);

const NEGATIVE_WORDS = new Set([
  "crisis", "crash", "decline", "threat", "risk", "failure", "collapse",
  "warning", "danger", "recession", "bearish", "bust", "concern", "fear",
  "krise", "absturz", "rückgang", "bedrohung", "risiko", "warnung", "gefahr",
]);

function scoreSentiment(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let pos = 0, neg = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) pos++;
    if (NEGATIVE_WORDS.has(w)) neg++;
  }
  const total = pos + neg;
  if (total === 0) return 0; // neutral
  return (pos - neg) / total; // -1 to +1
}

function inferTopic(text: string): string | null {
  const lower = text.toLowerCase();
  const map: [string, string][] = [
    ["ai", "AI"], ["artificial intelligence", "AI"], ["chatgpt", "Generative AI"],
    ["climate", "Climate Change & Sustainability"], ["carbon", "Climate Change & Sustainability"],
    ["renewable", "Green Tech"], ["solar", "Green Tech"], ["wind energy", "Green Tech"],
    ["cyber", "Security"], ["hack", "Security"], ["ransomware", "Security"],
    ["quantum", "Quantum Computing"],
    ["blockchain", "Blockchain"], ["bitcoin", "Blockchain"], ["crypto", "Blockchain"],
    ["electric vehicle", "Electric Vehicles"], ["ev", "Electric Vehicles"], ["tesla", "Electric Vehicles"],
    ["autonomous", "Autonomous Mobility"], ["self-driving", "Autonomous Mobility"],
    ["recession", "Economic Trends"], ["inflation", "Economic Trends"], ["interest rate", "Economic Trends"],
    ["war", "Geopolitical Fragmentation"], ["conflict", "Geopolitical Fragmentation"],
    ["election", "Geopolitical Fragmentation"], ["sanctions", "Geopolitical Fragmentation"],
    ["pandemic", "Health"], ["health", "Health"],
    ["remote work", "Remote Work"], ["hybrid work", "Remote Work"],
    ["startup", "Technological Disruption"], ["ipo", "Technological Disruption"],
    ["regulation", "Security, Trust & Resilience"], ["gdpr", "Security, Trust & Resilience"],
  ];
  for (const [kw, topic] of map) {
    if (lower.includes(kw)) return topic;
  }
  return null;
}

// ─── YouTube Trending ────────────────────────────────────────

async function fetchYouTubeTrending(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    // YouTube doesn't have a free trending API without API key
    // Use RSS feed from popular tech/news channels as proxy
    const feeds = [
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCvjgXvBlbQKAd_deyRjkuqg", // TechLinked
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw", // Linus Tech Tips
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCBcRF18a7Qf58cCRy5xuWwQ", // TLDR News
    ];

    for (const feedUrl of feeds) {
      try {
        const res = await fetch(feedUrl, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;
        const text = await res.text();

        const entries = text.split("<entry>").slice(1, 6); // Last 5 videos
        for (const entry of entries) {
          const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] || "";
          const link = entry.match(/<link[^>]*href="([^"]*)"[^>]*\/>/)?.[1] || "";
          const published = entry.match(/<published>([^<]*)<\/published>/)?.[1] || "";

          const topic = inferTopic(title);
          if (!topic) continue;

          const sentiment = scoreSentiment(title);

          signals.push({
            sourceType: "youtube_sentiment",
            sourceUrl: link,
            sourceTitle: title,
            signalType: "mention",
            topic,
            rawStrength: 0.4 + Math.abs(sentiment) * 0.3, // Stronger sentiment = stronger signal
            rawData: { sentiment, source: "youtube" },
            detectedAt: published ? new Date(published) : new Date(),
          });
        }
      } catch { /* skip feed */ }
    }
  } catch { /* skip all */ }

  return signals;
}

// ─── Mastodon/Fediverse Trending ─────────────────────────────

async function fetchMastodonTrending(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    // Mastodon instances have a public trending API
    const instances = [
      "https://mastodon.social",
      "https://techhub.social",
    ];

    for (const instance of instances) {
      try {
        // Trending tags
        const res = await fetch(`${instance}/api/v1/trends/tags?limit=20`, {
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) continue;

        const tags: { name: string; history: { uses: string; day: string }[] }[] = await res.json();

        for (const tag of tags) {
          const topic = inferTopic(tag.name);
          if (!topic) continue;

          const recentUses = tag.history?.slice(0, 2).reduce(
            (sum, h) => sum + parseInt(h.uses || "0"), 0
          ) || 0;

          signals.push({
            sourceType: "mastodon_sentiment",
            sourceUrl: `${instance}/tags/${tag.name}`,
            sourceTitle: `#${tag.name} trending on Mastodon (${recentUses} uses)`,
            signalType: recentUses > 100 ? "spike" : "mention",
            topic,
            rawStrength: Math.min(1, recentUses / 500),
            rawData: { tag: tag.name, uses: recentUses, instance },
            detectedAt: new Date(),
          });
        }
      } catch { /* skip instance */ }
    }
  } catch { /* skip all */ }

  return signals;
}

// ─── RSS News Headline Sentiment ─────────────────────────────

async function fetchNewsSentiment(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  const feeds = [
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC Tech" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", source: "NYT Tech" },
    { url: "https://feeds.arstechnica.com/arstechnica/index", source: "Ars Technica" },
  ];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "SIS/1.0" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;

      const text = await res.text();
      const items = text.split("<item>").slice(1, 11); // Last 10 articles

      for (const item of items) {
        const title = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || "";
        const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
        const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";

        const topic = inferTopic(title);
        if (!topic) continue;

        const sentiment = scoreSentiment(title);

        signals.push({
          sourceType: "news_sentiment",
          sourceUrl: link,
          sourceTitle: `[${feed.source}] ${title}`,
          signalType: "mention",
          topic,
          rawStrength: 0.5 + Math.abs(sentiment) * 0.3, // Stronger sentiment (pos or neg) = stronger signal
          rawData: { sentiment, source: feed.source },
          detectedAt: pubDate ? new Date(pubDate) : new Date(),
        });
      }
    } catch { /* skip feed */ }
  }

  return signals;
}

// ─── Combined Sentiment Connector ────────────────────────────

export const sentimentConnector: SourceConnector = {
  name: "sentiment",
  displayName: "Social Media Sentiment",

  async fetchSignals(): Promise<RawSignal[]> {
    const [youtube, mastodon, news] = await Promise.allSettled([
      fetchYouTubeTrending(),
      fetchMastodonTrending(),
      fetchNewsSentiment(),
    ]);

    const signals: RawSignal[] = [];
    if (youtube.status === "fulfilled") signals.push(...youtube.value);
    if (mastodon.status === "fulfilled") signals.push(...mastodon.value);
    if (news.status === "fulfilled") signals.push(...news.value);

    return signals;
  },
};
