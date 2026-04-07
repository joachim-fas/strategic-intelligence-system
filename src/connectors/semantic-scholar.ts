import { SourceConnector, RawSignal } from "./types";

/**
 * Semantic Scholar Connector — AI-powered research paper search
 *
 * High-quality academic paper data with citation counts.
 * No API key required for basic access.
 *
 * API: https://api.semanticscholar.org/
 */

export const semanticScholarConnector: SourceConnector = {
  name: "semantic_scholar",
  displayName: "Semantic Scholar (Papers)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://api.semanticscholar.org/graph/v1/paper/search?query=AI&limit=20&fields=title,url,year,citationCount",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const papers = data.data || [];

      for (const paper of papers) {
        const title = (paper.title || "Untitled").slice(0, 200);
        const citations = paper.citationCount || 0;

        signals.push({
          sourceType: "semantic_scholar",
          sourceUrl: paper.url || "https://www.semanticscholar.org/",
          sourceTitle: `Semantic Scholar: ${title}`,
          signalType: "paper",
          topic: "Artificial Intelligence & Automation",
          rawStrength: Math.min(1, citations / 200),
          rawData: {
            title,
            year: paper.year,
            citationCount: citations,
            paperId: paper.paperId,
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
