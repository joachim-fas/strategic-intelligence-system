import { SourceConnector, RawSignal } from "./types";

/**
 * Metaculus Forecasting Connector — free, no API key
 *
 * Community forecasting platform for questions about the future.
 * Shows what the crowd predicts about emerging trends.
 *
 * API: https://www.metaculus.com/api/
 */

const TAG_TOPICS: Record<string, string> = {
  "artificial-intelligence": "Artificial Intelligence & Automation",
  ai: "Artificial Intelligence & Automation",
  technology: "Artificial Intelligence & Automation",
  climate: "Climate Change & Sustainability",
  "climate-change": "Climate Change & Sustainability",
  environment: "Climate Change & Sustainability",
  geopolitics: "Geopolitical Fragmentation",
  politics: "Geopolitical Fragmentation",
  war: "Geopolitical Fragmentation",
  economics: "Economic Trends",
  finance: "Economic Trends",
  health: "Health, Biotech & Longevity",
  biosecurity: "Health, Biotech & Longevity",
  pandemic: "Health, Biotech & Longevity",
  nuclear: "Security, Trust & Resilience",
  cybersecurity: "Cybersecurity & Zero Trust",
  space: "Space & New Frontiers",
  energy: "Energy Transition & Decarbonization",
  transportation: "Mobility & Autonomous Transport",
  blockchain: "Web3 & Decentralization",
  crypto: "Web3 & Decentralization",
};

function deriveTopicFromTags(tags: string[]): string {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (TAG_TOPICS[lower]) return TAG_TOPICS[lower];
  }
  return "Future of Work";
}

function deriveTopicFromTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("ai") || lower.includes("artificial intelligence") || lower.includes("machine learning")) return "Artificial Intelligence & Automation";
  if (lower.includes("climate") || lower.includes("temperature") || lower.includes("emission")) return "Climate Change & Sustainability";
  if (lower.includes("war") || lower.includes("conflict") || lower.includes("sanction")) return "Geopolitical Fragmentation";
  if (lower.includes("economy") || lower.includes("gdp") || lower.includes("inflation")) return "Economic Trends";
  if (lower.includes("pandemic") || lower.includes("health") || lower.includes("vaccine")) return "Health, Biotech & Longevity";
  if (lower.includes("nuclear") || lower.includes("cyber")) return "Security, Trust & Resilience";
  if (lower.includes("energy") || lower.includes("solar") || lower.includes("renewable")) return "Energy Transition & Decarbonization";
  return "Future of Work";
}

export const metaculusConnector: SourceConnector = {
  name: "metaculus",
  displayName: "Metaculus (Forecasting)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch("https://www.metaculus.com/api2/questions/?status=open&order_by=-activity&limit=20", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return signals;

      const data = await res.json();
      const questions = data.results || [];

      for (const q of questions) {
        const title = q.title || q.title_short || "Unknown question";
        const tags = (q.tags || []).map((t: any) => (typeof t === "string" ? t : t.slug || t.name || ""));
        const topic = tags.length > 0 ? deriveTopicFromTags(tags) : deriveTopicFromTitle(title);
        const forecasterCount = q.number_of_predictions || 0;
        const communityPrediction = q.community_prediction?.full?.q2 ?? null;
        const questionUrl = q.url || `https://www.metaculus.com/questions/${q.id}/`;

        signals.push({
          sourceType: "metaculus",
          sourceUrl: questionUrl,
          sourceTitle: `Metaculus: ${title}`,
          signalType: "mention",
          topic,
          rawStrength: Math.min(1, forecasterCount / 500),
          rawData: {
            questionId: q.id,
            title,
            forecasterCount,
            communityPrediction,
            tags,
            createdAt: q.created_time,
            closeTime: q.close_time,
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
