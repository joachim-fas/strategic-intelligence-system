import { SourceConnector, RawSignal } from "./types";

interface GHTrendingRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  created_at: string;
  pushed_at: string;
}

export const githubConnector: SourceConnector = {
  name: "github",
  displayName: "GitHub Trending",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Use GitHub search API to find recently created repos with high star velocity
    // Sort by stars, created in the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const dateStr = weekAgo.toISOString().split("T")[0];

    const queries = [
      `created:>${dateStr} stars:>50`,
      `created:>${dateStr} topic:ai stars:>10`,
      `created:>${dateStr} topic:llm stars:>10`,
      `created:>${dateStr} topic:rust stars:>10`,
      `created:>${dateStr} topic:webassembly stars:>5`,
    ];

    for (const q of queries) {
      try {
        const controller = new AbortController();
        const ghTimeout = setTimeout(() => controller.abort(), 30000);
        let res: Response;
        try {
          res = await fetch(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`,
            {
              headers: {
                Accept: "application/vnd.github.v3+json",
                ...(process.env.GITHUB_TOKEN
                  ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
                  : {}),
              },
              signal: controller.signal,
            }
          );
        } finally {
          clearTimeout(ghTimeout);
        }

        if (!res.ok) {
          console.warn(`GitHub API error: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const repos: GHTrendingRepo[] = data.items || [];

        for (const repo of repos) {
          const topic = extractGitHubTopic(repo);
          if (!topic) continue;

          // Normalize strength: 1000+ stars in a week is max
          const strength = Math.min(1, repo.stargazers_count / 1000);

          signals.push({
            sourceType: "github",
            sourceUrl: repo.html_url,
            sourceTitle: `${repo.full_name}: ${repo.description || ""}`.slice(0, 200),
            signalType: "new_repo",
            topic,
            rawStrength: strength,
            rawData: {
              repoName: repo.full_name,
              stars: repo.stargazers_count,
              language: repo.language,
              topics: repo.topics,
              description: repo.description || null,
            },
            detectedAt: new Date(repo.pushed_at),
          });
        }
      } catch (err) {
        console.warn(`GitHub fetch error for query "${q}":`, err);
      }
    }

    // Deduplicate by repo URL
    const seen = new Set<string>();
    return signals.filter((s) => {
      if (seen.has(s.sourceUrl)) return false;
      seen.add(s.sourceUrl);
      return true;
    });
  },
};

function extractGitHubTopic(repo: GHTrendingRepo): string | null {
  // Prioritize explicit topics
  const topicMap: Record<string, string> = {
    "artificial-intelligence": "AI",
    "machine-learning": "Machine Learning",
    llm: "LLM",
    "large-language-model": "LLM",
    rust: "Rust",
    golang: "Go",
    python: "Python",
    typescript: "TypeScript",
    react: "React",
    nextjs: "Next.js",
    svelte: "Svelte",
    webassembly: "WebAssembly",
    kubernetes: "Kubernetes",
    docker: "Docker",
    blockchain: "Blockchain",
    "vector-database": "Vector Database",
    rag: "RAG",
    embedding: "Embeddings",
    security: "Security",
    privacy: "Privacy",
    robotics: "Robotics",
    iot: "IoT",
    edge: "Edge Computing",
  };

  for (const t of repo.topics || []) {
    if (topicMap[t]) return topicMap[t];
  }

  // Fallback to language (only well-known ones)
  const knownLanguages = [
    "Rust", "Go", "Python", "TypeScript", "JavaScript", "C++", "C",
    "Java", "Kotlin", "Swift", "Zig", "Ruby", "Elixir", "Haskell",
  ];
  if (repo.language && knownLanguages.includes(repo.language)) return repo.language;

  // Skip repos without a recognizable topic to reduce noise
  return null;
}
