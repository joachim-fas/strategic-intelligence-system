import { SourceConnector, RawSignal } from "./types";

interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
}

export const newsConnector: SourceConnector = {
  name: "news",
  displayName: "News API",

  async fetchSignals(): Promise<RawSignal[]> {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      console.warn("NEWS_API_KEY not set, skipping news connector");
      return [];
    }

    const signals: RawSignal[] = [];

    // Search for tech trend keywords
    const queries = [
      "artificial intelligence",
      "machine learning startup",
      "quantum computing",
      "blockchain technology",
      "cybersecurity breach",
      "edge computing",
      "robotics automation",
      "green technology climate",
      "fintech payments",
      "biotech genomics",
    ];

    for (const query of queries) {
      try {
        const res = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=relevancy&pageSize=10&language=en&apiKey=${apiKey}`
        );

        if (!res.ok) continue;

        const data = await res.json();
        const articles: NewsArticle[] = data.articles || [];

        for (const article of articles) {
          const topic = mapQueryToTopic(query);

          signals.push({
            sourceType: "news",
            sourceUrl: article.url,
            sourceTitle: article.title,
            signalType: "mention",
            topic,
            rawStrength: 0.5, // news articles get base strength, volume matters more
            rawData: {
              source: article.source.name,
              description: article.description,
              query,
            },
            detectedAt: new Date(article.publishedAt),
          });
        }
      } catch (err) {
        console.warn(`News fetch error for "${query}":`, err);
      }
    }

    return signals;
  },
};

function mapQueryToTopic(query: string): string {
  const map: Record<string, string> = {
    "artificial intelligence": "AI",
    "machine learning startup": "Machine Learning",
    "quantum computing": "Quantum Computing",
    "blockchain technology": "Blockchain",
    "cybersecurity breach": "Security",
    "edge computing": "Edge Computing",
    "robotics automation": "Robotics",
    "green technology climate": "Green Tech",
    "fintech payments": "Fintech",
    "biotech genomics": "Biotech",
  };
  return map[query] || query;
}
