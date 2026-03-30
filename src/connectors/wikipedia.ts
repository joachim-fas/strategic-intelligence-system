import { SourceConnector, RawSignal } from "./types";

// Track Wikipedia pageview spikes for trend-related articles
// A spike indicates public interest growth
const TRACKED_ARTICLES: { article: string; topic: string }[] = [
  { article: "Artificial_intelligence", topic: "AI" },
  { article: "Large_language_model", topic: "LLM" },
  { article: "Generative_artificial_intelligence", topic: "Generative AI" },
  { article: "ChatGPT", topic: "LLM" },
  { article: "Quantum_computing", topic: "Quantum Computing" },
  { article: "Blockchain", topic: "Blockchain" },
  { article: "Rust_(programming_language)", topic: "Rust" },
  { article: "WebAssembly", topic: "WebAssembly" },
  { article: "Edge_computing", topic: "Edge Computing" },
  { article: "Kubernetes", topic: "Kubernetes" },
  { article: "Electric_vehicle", topic: "Electric Vehicles" },
  { article: "Renewable_energy", topic: "Green Tech" },
  { article: "CRISPR_gene_editing", topic: "Genomics" },
  { article: "Autonomous_car", topic: "Autonomous Mobility" },
  { article: "Cybersecurity", topic: "Security" },
  { article: "Internet_of_things", topic: "IoT" },
  { article: "Metaverse", topic: "Spatial Computing" },
  { article: "Digital_transformation", topic: "Digital Transformation" },
  { article: "Remote_work", topic: "Remote Work" },
  { article: "Circular_economy", topic: "Circular Economy" },
];

export const wikipediaConnector: SourceConnector = {
  name: "wikipedia",
  displayName: "Wikipedia Pageviews",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Get yesterday's date for the API
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0].replace(/-/g, "");

    for (const { article, topic } of TRACKED_ARTICLES) {
      try {
        const res = await fetch(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(article)}/daily/${dateStr}/${dateStr}`,
          { headers: { "User-Agent": "SIS/1.0 (strategic intelligence system)" } }
        );
        if (!res.ok) continue;

        const data = await res.json();
        const views = data?.items?.[0]?.views;
        if (!views) continue;

        // Normalize: 50k+ views/day is strong signal
        const strength = Math.min(1, views / 50000);

        signals.push({
          sourceType: "wikipedia",
          sourceUrl: `https://en.wikipedia.org/wiki/${article}`,
          sourceTitle: `${article.replace(/_/g, " ")} — ${views.toLocaleString()} views/day`,
          signalType: strength > 0.5 ? "spike" : "mention",
          topic,
          rawStrength: strength,
          rawData: { article, views, date: dateStr },
          detectedAt: yesterday,
        });

        await new Promise((r) => setTimeout(r, 100)); // Rate limit
      } catch {
        // Skip
      }
    }

    return signals;
  },
};
