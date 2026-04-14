import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * The Guardian Open Platform Connector
 *
 * World news from The Guardian's open API.
 * Requires a free API key from https://open-platform.theguardian.com/
 *
 * API: https://open-platform.theguardian.com/documentation/
 */

const SECTION_TOPICS: Record<string, string> = {
  technology: "Artificial Intelligence & Automation",
  science: "Artificial Intelligence & Automation",
  environment: "Climate Change & Sustainability",
  business: "Economic Trends",
  politics: "Geopolitical Fragmentation",
  world: "Geopolitical Fragmentation",
  "uk-news": "Geopolitical Fragmentation",
  "us-news": "Geopolitical Fragmentation",
  society: "Future of Work",
  "global-development": "Demographic Shifts & Migration",
  education: "Future of Work",
  money: "Economic Trends",
  law: "Regulation & Digital Governance",
};

export const guardianConnector: SourceConnector = {
  name: "guardian",
  displayName: "The Guardian (News)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const key = process.env.GUARDIAN_API_KEY;
    if (!key) return signals;

    try {
      // SEC-09: Guardian API requires api-key as a query param; it does not support
      // header-based auth. See https://open-platform.theguardian.com/documentation/
      // TODO: SEC-09 — Guardian API only supports query-param auth (api-key=...). No header alternative available.
      const url = `https://content.guardianapis.com/search?q=*&order-by=newest&show-fields=trailText,headline&page-size=20&api-key=${key}`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return signals;

      const data = await res.json();
      const results = data.response?.results || [];

      for (const article of results) {
        const section = article.sectionId || "world";
        const topic = SECTION_TOPICS[section] || "Geopolitical Fragmentation";
        const headline = article.fields?.headline || article.webTitle || "Unknown";
        const trailText = article.fields?.trailText || "";

        const signal: RawSignal = {
          sourceType: "guardian",
          sourceUrl: article.webUrl || "https://www.theguardian.com/",
          sourceTitle: `Guardian: ${headline}`,
          signalType: "mention",
          topic,
          rawStrength: 0, // computed below
          rawData: {
            section,
            headline,
            trailText,
            publishedAt: article.webPublicationDate,
            type: article.type,
          },
          detectedAt: article.webPublicationDate ? new Date(article.webPublicationDate) : new Date(),
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
