import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * PatentsView Connector — USPTO Patent Data
 *
 * Recent US patents from the PatentsView API.
 * No API key required.
 *
 * API: https://patentsview.org/apis/
 */

export const patentsviewConnector: SourceConnector = {
  name: "patentsview",
  displayName: "PatentsView (USPTO Patents)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const year = new Date().getFullYear();
      const q = encodeURIComponent(`{"_gte":{"patent_date":"${year}-01-01"}}`);
      const f = encodeURIComponent('["patent_title","patent_date","patent_type"]');
      const s = encodeURIComponent('[{"patent_date":"desc"}]');

      const res = await fetch(
        `https://search.patentsview.org/api/v1/patent/?q=${q}&f=${f}&s=${s}&per_page=20`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const patents = data.patents || [];

      for (const patent of patents) {
        const title = (patent.patent_title || "Untitled Patent").slice(0, 200);
        const titleLower = title.toLowerCase();
        let topic = "Technological Disruption";
        if (titleLower.includes("ai") || titleLower.includes("neural") || titleLower.includes("machine learning")) {
          topic = "Artificial Intelligence & Automation";
        } else if (titleLower.includes("battery") || titleLower.includes("solar") || titleLower.includes("energy")) {
          topic = "Climate Change & Sustainability";
        } else if (titleLower.includes("security") || titleLower.includes("crypto")) {
          topic = "Security, Trust & Resilience";
        }

        const signal: RawSignal = {
          sourceType: "patentsview",
          sourceUrl: `https://patentsview.org/patent/${patent.patent_id || ""}`,
          sourceTitle: `USPTO: ${title}`,
          signalType: "paper",
          topic,
          rawStrength: 0, // computed below
          rawData: {
            title,
            date: patent.patent_date,
            type: patent.patent_type,
            patentId: patent.patent_id,
          },
          detectedAt: patent.patent_date ? new Date(patent.patent_date) : new Date(),
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
