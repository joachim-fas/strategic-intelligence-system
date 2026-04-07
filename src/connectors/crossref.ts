import { SourceConnector, RawSignal } from "./types";

/**
 * CrossRef Connector — Academic publication metadata
 *
 * Searches recent publications related to AI/technology.
 * No API key required (polite pool with mailto).
 *
 * API: https://api.crossref.org/swagger-ui/index.html
 */

export const crossrefConnector: SourceConnector = {
  name: "crossref",
  displayName: "CrossRef (Publications)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://api.crossref.org/works?query=artificial+intelligence&rows=20&sort=deposited&order=desc",
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "SIS-TrendRadar/1.0 (mailto:info@example.com)",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const items = data.message?.items || [];

      for (const item of items) {
        const title = (item.title?.[0] || "Untitled").slice(0, 200);
        const subjects = item.subject || [];
        const topic = subjects.length > 0
          ? "Artificial Intelligence & Automation"
          : "Artificial Intelligence & Automation";
        const refs = item["is-referenced-by-count"] || 0;

        signals.push({
          sourceType: "crossref",
          sourceUrl: item.URL || "https://www.crossref.org/",
          sourceTitle: `CrossRef: ${title}`,
          signalType: "paper",
          topic,
          rawStrength: Math.min(1, refs / 50),
          rawData: {
            title,
            doi: item.DOI,
            subjects,
            referenceCount: refs,
            publisher: item.publisher,
            deposited: item.deposited?.["date-time"],
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
