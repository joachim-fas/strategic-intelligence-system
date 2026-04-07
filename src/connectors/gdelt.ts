import { SourceConnector, RawSignal } from "./types";

/**
 * GDELT Connector — free, no API key, updates every 15 minutes
 *
 * The GDELT Project monitors the world's news media from nearly
 * every corner of every country in print, broadcast, and web formats.
 * Perfect for detecting emerging geopolitical and social trends.
 *
 * API: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

const TREND_QUERIES: { query: string; topic: string; label: string }[] = [
  { query: "artificial intelligence OR machine learning OR AI regulation", topic: "Artificial Intelligence & Automation", label: "AI" },
  { query: "climate change OR global warming OR carbon emissions", topic: "Climate Change & Sustainability", label: "Climate" },
  { query: "cyberattack OR ransomware OR data breach OR cybersecurity", topic: "Cybersecurity & Zero Trust", label: "Cyber" },
  { query: "geopolitical tension OR sanctions OR trade war", topic: "Geopolitical Fragmentation", label: "Geopolitics" },
  { query: "renewable energy OR solar OR wind power OR energy transition", topic: "Energy Transition & Decarbonization", label: "Energy" },
  { query: "quantum computing OR quantum advantage", topic: "Quantum Computing", label: "Quantum" },
  { query: "autonomous vehicles OR self-driving", topic: "Mobility & Autonomous Transport", label: "Autonomous" },
  { query: "blockchain OR cryptocurrency regulation OR CBDC", topic: "Web3 & Decentralization", label: "Crypto/Web3" },
  { query: "pandemic preparedness OR disease outbreak OR WHO alert", topic: "Health, Biotech & Longevity", label: "Health" },
  { query: "supply chain disruption OR semiconductor shortage", topic: "Economic Trends", label: "Supply Chain" },
];

export const gdeltConnector: SourceConnector = {
  name: "gdelt",
  displayName: "GDELT (Global News Intelligence)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const { query, topic, label } of TREND_QUERIES) {
      try {
        const url = `${GDELT_BASE}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=10&format=json&startdatetime=${getYesterdayStr()}000000&enddatetime=${getTodayStr()}235959`;

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) continue;

        const text = await res.text();
        if (!text || text.length < 10) continue;

        const data = JSON.parse(text);
        const articles = data.articles || [];

        if (articles.length === 0) continue;

        // Aggregate: article count = signal strength
        const domains = new Set(articles.map((a: any) => new URL(a.url).hostname).filter(Boolean));

        signals.push({
          sourceType: "gdelt",
          sourceUrl: "https://www.gdeltproject.org/",
          sourceTitle: `GDELT: ${label} — ${articles.length} articles from ${domains.size} sources (24h)`,
          signalType: articles.length > 7 ? "spike" : "mention",
          topic,
          rawStrength: Math.min(1, articles.length / 10),
          rawData: {
            articleCount: articles.length,
            domainCount: domains.size,
            topArticles: articles.slice(0, 3).map((a: any) => ({ title: a.title, url: a.url, domain: a.domain })),
          },
          detectedAt: new Date(),
        });
      } catch {
        // Timeout or parse error — skip
      }
    }

    return signals;
  },
};

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function getYesterdayStr(): string {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
