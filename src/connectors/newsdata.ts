import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * NewsData.io Connector — Global news aggregation
 *
 * Latest news in technology and politics (EN/DE).
 * Requires a free API key from https://newsdata.io/
 *
 * Env: NEWSDATA_API_KEY
 */

const CATEGORY_TOPICS: Record<string, string> = {
  technology: "Artificial Intelligence & Automation",
  politics: "Geopolitical Fragmentation",
  business: "Economic Trends",
  science: "Artificial Intelligence & Automation",
  environment: "Climate Change & Sustainability",
  health: "Health & Wellbeing",
  world: "Geopolitical Fragmentation",
};

export const newsdataConnector: SourceConnector = {
  name: "newsdata",
  displayName: "NewsData.io (Global News)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const key = process.env.NEWSDATA_API_KEY;
    if (!key) return signals;

    try {
      // SEC-09: API key moved from URL query string to X-ACCESS-KEY header
      const res = await fetch(
        `https://newsdata.io/api/1/latest?language=en,de&category=technology,politics`,
        {
          headers: { Accept: "application/json", "X-ACCESS-KEY": key },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const articles = data.results || [];

      for (const article of articles.slice(0, 20)) {
        const title = article.title || "Unknown";
        const category = (article.category?.[0] || "world").toLowerCase();
        const topic = CATEGORY_TOPICS[category] || "Geopolitical Fragmentation";

        // Backlog-Task 1.6 (2026-04-21): NewsData liefert `description`
        // (Teaser) UND `content` (voller Text, wenn verfügbar). Wir
        // nutzen das reichhaltigste vorhandene Feld und schneiden auf 500
        // Zeichen — genug für einen snippet-artigen Kontext, ohne die
        // live_signals-Row übermäßig aufzublähen.
        const richSnippet = (article.content && article.content.length > 100)
          ? String(article.content).slice(0, 500)
          : (article.description ? String(article.description).slice(0, 500) : "");

        const signal: RawSignal = {
          sourceType: "newsdata",
          sourceUrl: article.link || "https://newsdata.io/",
          sourceTitle: `NewsData: ${title.slice(0, 150)}`,
          signalType: "mention",
          topic,
          rawStrength: 0, // computed below
          rawData: {
            title,
            category,
            description: article.description?.slice(0, 300),
            // Pipeline-Extractor greift `content` bevorzugt auf — enthält
            // den besten verfügbaren Snippet.
            content: richSnippet || undefined,
            country: article.country,
            language: article.language,
            publishedAt: article.pubDate,
          },
          detectedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
        };
        signal.rawStrength = computeSignalStrength(signal);
        signals.push(signal);
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
