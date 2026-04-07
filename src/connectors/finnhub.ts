import { SourceConnector, RawSignal } from "./types";

/**
 * Finnhub Connector — Stock market news & sentiment
 *
 * Real-time market news and sentiment analysis.
 * Requires a free API key from https://finnhub.io/
 *
 * API: https://finnhub.io/docs/api
 */

const CATEGORY_TOPICS: Record<string, string> = {
  technology: "Artificial Intelligence & Automation",
  business: "Economic Trends",
  economy: "Economic Trends",
  forex: "Economic Trends",
  crypto: "Web3 & Decentralization",
  merger: "Economic Trends",
  general: "Economic Trends",
};

export const finnhubConnector: SourceConnector = {
  name: "finnhub",
  displayName: "Finnhub (Market News & Sentiment)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const key = process.env.FINNHUB_API_KEY;
    if (!key) return signals;

    try {
      // Fetch general market news
      const newsRes = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!newsRes.ok) return signals;

      const articles = await newsRes.json();

      // Fetch market sentiment for SPY (S&P 500 ETF) as a market-wide indicator
      let marketSentiment = 0.5;
      try {
        const sentRes = await fetch(`https://finnhub.io/api/v1/news-sentiment?symbol=SPY&token=${key}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (sentRes.ok) {
          const sentData = await sentRes.json();
          marketSentiment = sentData.sentiment?.bullishPercent ?? 0.5;
        }
      } catch {
        // Sentiment fetch failed, use default
      }

      for (const article of (articles || []).slice(0, 20)) {
        const category = (article.category || "general").toLowerCase();
        const topic = CATEGORY_TOPICS[category] || "Economic Trends";
        const headline = article.headline || "Unknown";
        const articleSentiment = article.sentiment ?? marketSentiment;

        signals.push({
          sourceType: "finnhub",
          sourceUrl: article.url || "https://finnhub.io/",
          sourceTitle: `Finnhub: ${headline}`,
          signalType: articleSentiment > 0.7 ? "spike" : "mention",
          topic,
          rawStrength: Math.min(1, Math.max(0.1, articleSentiment)),
          rawData: {
            category,
            headline,
            source: article.source,
            summary: article.summary,
            sentiment: articleSentiment,
            marketSentiment,
            publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : undefined,
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
