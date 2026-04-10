import { SourceConnector, RawSignal } from "./types";

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  descendants: number; // comment count
  time: number;
  type: string;
}

export const hackernewsConnector: SourceConnector = {
  name: "hackernews",
  displayName: "Hacker News",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // Fetch top 100 stories
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let topIds: number[];
      try {
        const topRes = await fetch(
          "https://hacker-news.firebaseio.com/v0/topstories.json",
          { signal: controller.signal }
        );
        topIds = await topRes.json();
      } finally {
        clearTimeout(timeout);
      }
      const top100 = topIds.slice(0, 100);

      // Fetch story details in batches of 20
      const batchSize = 20;

      for (let i = 0; i < top100.length; i += batchSize) {
        const batch = top100.slice(i, i + batchSize);
        const stories = await Promise.all(
          batch.map(async (id) => {
            const itemController = new AbortController();
            const itemTimeout = setTimeout(() => itemController.abort(), 30000);
            try {
              const res = await fetch(
                `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
                { signal: itemController.signal }
              );
              return res.json() as Promise<HNItem>;
            } finally {
              clearTimeout(itemTimeout);
            }
          })
        );

        for (const story of stories) {
          if (!story || story.type !== "story") continue;

          // Calculate signal strength based on points and comments
          const strength = Math.min(
            1,
            (story.score * 0.3 + story.descendants * 0.7) / 500
          );

          // Extract topic from title
          const topic = extractTopic(story.title);
          if (!topic) continue;

          signals.push({
            sourceType: "hackernews",
            sourceUrl: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            sourceTitle: story.title,
            signalType: strength > 0.6 ? "spike" : "mention",
            topic,
            rawStrength: strength,
            rawData: {
              hnId: story.id,
              score: story.score,
              comments: story.descendants,
            },
            detectedAt: new Date(story.time * 1000),
          });
        }
      }
    } catch {
      // API unavailable or timeout — return whatever we collected so far
    }

    return signals;
  },
};

function extractTopic(title: string): string | null {
  // Remove common HN prefixes
  const cleaned = title
    .replace(/^(Show HN|Ask HN|Tell HN|Launch HN):\s*/i, "")
    .trim();

  // Known tech keywords to extract
  const techKeywords = [
    "AI", "LLM", "GPT", "Claude", "Anthropic", "OpenAI", "Machine Learning",
    "Rust", "Go", "Python", "TypeScript", "JavaScript", "React", "Vue", "Svelte",
    "WebAssembly", "WASM", "Kubernetes", "Docker", "AWS", "Azure", "GCP",
    "PostgreSQL", "SQLite", "Redis", "Kafka", "GraphQL", "REST",
    "Blockchain", "Crypto", "Web3", "DeFi", "NFT",
    "Quantum", "Edge Computing", "Serverless", "Microservices",
    "RAG", "Vector Database", "Embedding", "Transformer",
    "Linux", "macOS", "iOS", "Android", "Windows",
    "HTMX", "Tailwind", "Next.js", "Deno", "Bun", "Node.js",
    "Security", "Privacy", "Encryption", "Zero Trust",
    "Open Source", "FOSS", "GPL", "MIT License",
    "Startup", "YC", "Series A", "IPO",
    "GPU", "CUDA", "TPU", "FPGA", "RISC-V", "ARM",
    "5G", "IoT", "AR", "VR", "XR", "Spatial Computing",
    "Robotics", "Autonomous", "Self-Driving",
    "Climate", "Sustainability", "Green Tech", "Energy",
    "Biotech", "CRISPR", "Genomics",
    "Fintech", "Neobank", "Payment",
  ];

  for (const kw of techKeywords) {
    if (cleaned.toLowerCase().includes(kw.toLowerCase())) {
      return kw;
    }
  }

  // No recognized tech topic — skip to reduce noise
  return null;
}
