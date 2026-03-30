import { SourceConnector, RawSignal } from "./types";

/**
 * Google Trends Connector
 *
 * Uses the unofficial Google Trends API to track search interest
 * for trend-related topics. Search volume is a powerful leading
 * indicator — public interest shifts BEFORE markets and regulations.
 *
 * Note: Google doesn't have an official API. We use the explore endpoint
 * which returns relative interest over time (0-100 scale).
 */

// Topics to track — each maps to a trend in our system
const TRACKED_TOPICS: { keyword: string; topic: string }[] = [
  // Technology
  { keyword: "artificial intelligence", topic: "AI" },
  { keyword: "ChatGPT", topic: "Generative AI" },
  { keyword: "Claude AI", topic: "Generative AI" },
  { keyword: "machine learning", topic: "Machine Learning" },
  { keyword: "quantum computing", topic: "Quantum Computing" },
  { keyword: "cybersecurity", topic: "Security" },
  { keyword: "blockchain", topic: "Blockchain" },
  { keyword: "electric vehicle", topic: "Electric Vehicles" },
  { keyword: "autonomous driving", topic: "Autonomous Mobility" },
  { keyword: "edge computing", topic: "Edge Computing" },
  // Climate & Energy
  { keyword: "climate change", topic: "Climate Change & Sustainability" },
  { keyword: "renewable energy", topic: "Green Tech" },
  { keyword: "solar energy", topic: "Green Tech" },
  { keyword: "carbon neutral", topic: "Climate Change & Sustainability" },
  { keyword: "ESG investing", topic: "Climate Change & Sustainability" },
  // Society
  { keyword: "remote work", topic: "Remote Work" },
  { keyword: "inflation rate", topic: "Economic Trends" },
  { keyword: "housing crisis", topic: "Social Instability" },
  { keyword: "mental health", topic: "Digital Health" },
  // Geopolitics
  { keyword: "supply chain disruption", topic: "Geopolitical Fragmentation" },
  { keyword: "trade war", topic: "Geopolitical Fragmentation" },
];

export const googleTrendsConnector: SourceConnector = {
  name: "google_trends",
  displayName: "Google Trends",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Google Trends doesn't have a stable public API
    // We use a simple approach: check SerpAPI or direct scraping
    // For now, generate signals based on known trending status

    // Alternative: use pytrends via a Python sidecar, or
    // the Google Trends RSS feed for trending searches

    try {
      // Google Trends Daily Trending Searches (RSS)
      const res = await fetch(
        "https://trends.google.com/trending/rss?geo=US",
        { headers: { "User-Agent": "SIS/1.0" }, signal: AbortSignal.timeout(10000) }
      );

      if (res.ok) {
        const text = await res.text();
        const items = text.split("<item>").slice(1);

        for (const item of items.slice(0, 30)) {
          const title = item.match(/<title>([^<]*)<\/title>/)?.[1] || "";
          const traffic = item.match(/<ht:approx_traffic>([^<]*)<\/ht:approx_traffic>/)?.[1] || "";
          const pubDate = item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || "";

          const topic = matchToTopic(title);
          if (!topic) continue;

          // Parse traffic number (e.g., "500,000+")
          const trafficNum = parseInt(traffic.replace(/[^0-9]/g, "")) || 10000;
          const strength = Math.min(1, trafficNum / 1000000);

          signals.push({
            sourceType: "google_trends",
            sourceUrl: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}`,
            sourceTitle: `Trending: ${title} (${traffic} searches)`,
            signalType: strength > 0.5 ? "spike" : "mention",
            topic,
            rawStrength: strength,
            rawData: { title, traffic: trafficNum },
            detectedAt: pubDate ? new Date(pubDate) : new Date(),
          });
        }
      }
    } catch {
      // RSS feed may be blocked — return empty array, never emit synthetic signals
    }

    return signals;
  },
};

function matchToTopic(title: string): string | null {
  const lower = title.toLowerCase();
  const keywords: [string, string][] = [
    ["ai", "AI"], ["artificial intelligence", "AI"], ["chatgpt", "Generative AI"],
    ["climate", "Climate Change & Sustainability"], ["energy", "Green Tech"],
    ["electric vehicle", "Electric Vehicles"], ["ev", "Electric Vehicles"],
    ["crypto", "Blockchain"], ["bitcoin", "Blockchain"],
    ["cybersecurity", "Security"], ["hack", "Security"],
    ["quantum", "Quantum Computing"],
    ["remote work", "Remote Work"], ["hybrid work", "Remote Work"],
    ["inflation", "Economic Trends"], ["recession", "Economic Trends"],
    ["war", "Geopolitical Fragmentation"], ["sanctions", "Geopolitical Fragmentation"],
    ["election", "Geopolitical Fragmentation"],
    ["pandemic", "Health"], ["vaccine", "Health"],
    ["autonomous", "Autonomous Mobility"], ["tesla", "Electric Vehicles"],
  ];

  for (const [kw, topic] of keywords) {
    if (lower.includes(kw)) return topic;
  }
  return null;
}
