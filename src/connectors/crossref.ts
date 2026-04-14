import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

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
            // TODO: Replace with real contact email for CrossRef polite pool access
            "User-Agent": "SIS-TrendRadar/1.0 (mailto:info@example.com)",
          },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const items = data.message?.items || [];

      for (const item of items) {
        const title = (item.title?.[0] || "Untitled").slice(0, 200);
        const subjects = item.subject || [];
        const topic = subjects.length > 0
          ? subjects[0]
          : "Artificial Intelligence & Automation";
        const refs = item["is-referenced-by-count"] || 0;

        const signal: RawSignal = {
          sourceType: "crossref",
          sourceUrl: item.URL || "https://www.crossref.org/",
          sourceTitle: `CrossRef: ${title}`,
          signalType: "paper",
          topic,
          rawStrength: 0.5,
          rawData: {
            title,
            doi: item.DOI,
            subjects,
            referenceCount: refs,
            publisher: item.publisher,
            deposited: item.deposited?.["date-time"],
          },
          detectedAt: item.deposited?.["date-time"] ? new Date(item.deposited["date-time"]) : new Date(),
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
