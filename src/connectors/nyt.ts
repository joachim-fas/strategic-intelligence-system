import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * New York Times Connector — Article Search API
 *
 * Technology and trending articles from the NYT.
 * Requires a free API key from https://developer.nytimes.com/
 *
 * Env: NYT_API_KEY
 */

const SECTION_TOPICS: Record<string, string> = {
  Technology: "Artificial Intelligence & Automation",
  Science: "Artificial Intelligence & Automation",
  Business: "Economic Trends",
  World: "Geopolitical Fragmentation",
  Climate: "Climate Change & Sustainability",
  Health: "Health & Wellbeing",
  Politics: "Geopolitical Fragmentation",
};

export const nytConnector: SourceConnector = {
  name: "nyt",
  displayName: "New York Times (Articles)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const key = process.env.NYT_API_KEY;
    if (!key) return signals;

    try {
      // TODO: SEC-09 — NYT Article Search API only supports query-param auth (api-key=...).
      // No header-based authentication alternative is documented.
      // See https://developer.nytimes.com/docs/articlesearch-product/1/overview
      const res = await fetch(
        `https://api.nytimes.com/svc/search/v2/articlesearch.json?q=technology&sort=newest&api-key=${key}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const docs = data.response?.docs || [];

      for (const doc of docs.slice(0, 20)) {
        const headline = doc.headline?.main || "Unknown";
        const section = doc.section_name || "World";
        const topic = SECTION_TOPICS[section] || "Geopolitical Fragmentation";

        // Backlog-Task 1.6 (2026-04-21): Article-Snippet-Anreicherung.
        // NYT liefert drei potenzielle Kurzfassungen — snippet (Preview),
        // abstract (Zusammenfassung), lead_paragraph (Einstiegs-Absatz).
        // Wir bevorzugen das reichhaltigste vorhandene und fallen zurück,
        // damit die Pipeline's content-Extraktion nie an einem leeren
        // Feld scheitert.
        const richSnippet = (doc.lead_paragraph && doc.lead_paragraph.length > 40)
          ? doc.lead_paragraph
          : (doc.abstract && doc.abstract.length > 20)
            ? doc.abstract
            : (doc.snippet || "");

        const signal: RawSignal = {
          sourceType: "nyt",
          sourceUrl: doc.web_url || "https://www.nytimes.com/",
          sourceTitle: `NYT: ${headline.slice(0, 150)}`,
          signalType: "mention",
          topic,
          rawStrength: 0, // computed below
          rawData: {
            headline,
            section,
            abstract: doc.abstract,
            snippet: doc.snippet,
            lead_paragraph: doc.lead_paragraph,
            // `content` wird vom Pipeline-Extractor bevorzugt aufgegriffen —
            // darin die beste vorhandene Kurzfassung.
            content: richSnippet ? String(richSnippet).slice(0, 500) : undefined,
            publishedAt: doc.pub_date,
            byline: doc.byline?.original,
          },
          detectedAt: doc.pub_date ? new Date(doc.pub_date) : new Date(),
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
