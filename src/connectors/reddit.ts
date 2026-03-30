import { SourceConnector, RawSignal } from "./types";

interface RedditPost {
  data: {
    title: string;
    url: string;
    permalink: string;
    score: number;
    num_comments: number;
    subreddit: string;
    created_utc: number;
  };
}

const TECH_SUBREDDITS = [
  "technology", "artificial", "MachineLearning", "programming",
  "webdev", "devops", "rust", "golang", "typescript",
  "cybersecurity", "datascience", "robotics", "sustainability",
  "Futurology", "singularity", "biotech",
];

const TOPIC_MAP: Record<string, string> = {
  artificial: "AI",
  MachineLearning: "Machine Learning",
  programming: "Programming",
  webdev: "Web Development",
  devops: "DevOps",
  rust: "Rust",
  golang: "Go",
  typescript: "TypeScript",
  cybersecurity: "Security",
  datascience: "Data Science",
  robotics: "Robotics",
  sustainability: "Green Tech",
  Futurology: "Future Tech",
  singularity: "AI",
  biotech: "Biotech",
  technology: "Technology",
};

export const redditConnector: SourceConnector = {
  name: "reddit",
  displayName: "Reddit",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const sub of TECH_SUBREDDITS) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
          { headers: { "User-Agent": "SIS/1.0" } }
        );
        if (!res.ok) continue;

        const data = await res.json();
        const posts: RedditPost[] = data?.data?.children || [];

        for (const post of posts) {
          const { title, permalink, score, num_comments, subreddit, created_utc } = post.data;
          if (score < 50) continue;

          const topic = TOPIC_MAP[subreddit] || subreddit;
          const strength = Math.min(1, (score + num_comments * 2) / 2000);

          signals.push({
            sourceType: "reddit",
            sourceUrl: `https://reddit.com${permalink}`,
            sourceTitle: title.slice(0, 200),
            signalType: strength > 0.5 ? "spike" : "mention",
            topic,
            rawStrength: strength,
            rawData: { subreddit, score, comments: num_comments },
            detectedAt: new Date(created_utc * 1000),
          });
        }
      } catch {
        // Rate limited or blocked, skip
      }
    }
    return signals;
  },
};
