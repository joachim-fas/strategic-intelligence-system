import { SourceConnector, RawSignal } from "./types";

const SEARCH_QUERIES = [
  { query: "large language model", topic: "LLM" },
  { query: "artificial intelligence", topic: "AI" },
  { query: "machine learning", topic: "Machine Learning" },
  { query: "reinforcement learning", topic: "Reinforcement Learning" },
  { query: "quantum computing", topic: "Quantum Computing" },
  { query: "robotics", topic: "Robotics" },
  { query: "computer vision", topic: "Computer Vision" },
  { query: "natural language processing", topic: "NLP" },
  { query: "federated learning", topic: "Federated Learning" },
  { query: "generative model", topic: "Generative AI" },
  { query: "cybersecurity", topic: "Security" },
  { query: "edge computing", topic: "Edge Computing" },
  { query: "blockchain consensus", topic: "Blockchain" },
];

export const arxivConnector: SourceConnector = {
  name: "arxiv",
  displayName: "arXiv",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const { query, topic } of SEARCH_QUERIES) {
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 30000);
        let res: Response;
        try {
          res = await fetch(
            `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=5`,
            { signal: controller.signal }
          );
        } finally {
          clearTimeout(fetchTimeout);
        }
        if (!res.ok) continue;

        const text = await res.text();
        // Parse Atom XML simply
        const entries = text.split("<entry>").slice(1);

        for (const entry of entries) {
          const title = extractXml(entry, "title")?.replace(/\s+/g, " ").trim() || "";
          const id = extractXml(entry, "id") || "";
          const published = extractXml(entry, "published") || "";
          const summary = extractXml(entry, "summary")?.slice(0, 200) || "";

          if (!title) continue;

          const parsedDate = new Date(published);
          const detectedAt = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

          signals.push({
            sourceType: "arxiv",
            sourceUrl: id,
            sourceTitle: title,
            signalType: "paper",
            topic,
            rawStrength: 0.6, // TODO: compute strength dynamically from signal data
            rawData: { query, summary },
            detectedAt,
          });
        }

        // Small delay to be nice to arXiv API
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        // Skip on error
      }
    }
    return signals;
  },
};

function extractXml(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}
