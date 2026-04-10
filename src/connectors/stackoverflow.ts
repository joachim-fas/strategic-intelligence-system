import { SourceConnector, RawSignal } from "./types";

interface SOTag {
  name: string;
  count: number;
  has_synonyms: boolean;
}

const TRACKED_TAGS: Record<string, string> = {
  "machine-learning": "Machine Learning",
  "artificial-intelligence": "AI",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  rust: "Rust",
  go: "Go",
  react: "React",
  "next.js": "Next.js",
  docker: "Docker",
  kubernetes: "Kubernetes",
  "amazon-web-services": "AWS",
  postgresql: "PostgreSQL",
  graphql: "GraphQL",
  "web-assembly": "WebAssembly",
  blockchain: "Blockchain",
  cybersecurity: "Security",
  "large-language-model": "LLM",
  langchain: "LangChain",
  openai: "OpenAI",
};

export const stackoverflowConnector: SourceConnector = {
  name: "stackoverflow",
  displayName: "Stack Overflow",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const tagNames = Object.keys(TRACKED_TAGS).join(";");

    try {
      // NOTE: API key in URL - required by Stack Exchange API's design
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res: Response;
      try {
        res = await fetch(
          `https://api.stackexchange.com/2.3/tags/${encodeURIComponent(tagNames)}/info?site=stackoverflow&key=${process.env.SO_API_KEY || ""}`,
          { signal: controller.signal }
        );
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) return signals;

      const data = await res.json();
      const tags: SOTag[] = data.items || [];

      // TODO: Use week-over-week delta instead of cumulative tag count for better signal freshness
      // Get max count for normalization
      const maxCount = Math.max(...tags.map((t) => t.count), 1);

      for (const tag of tags) {
        const topic = TRACKED_TAGS[tag.name];
        if (!topic) continue;

        const strength = Math.min(1, tag.count / maxCount);

        signals.push({
          sourceType: "stackoverflow",
          sourceUrl: `https://stackoverflow.com/questions/tagged/${tag.name}`,
          sourceTitle: `${topic} — ${tag.count.toLocaleString()} questions`,
          signalType: "mention",
          topic,
          rawStrength: strength,
          rawData: { tagName: tag.name, questionCount: tag.count },
          detectedAt: new Date(),
        });
      }
    } catch {
      // API rate limit or key missing
    }

    return signals;
  },
};
