import { TrendDot, TrendClassification, TrendDuration, TrendDirection, TrendFocus } from "@/types";

/**
 * Auto-classify a trend based on its properties and category.
 * This provides a default classification that can be overridden by the user.
 */
export function autoClassify(trend: TrendDot): TrendClassification {
  return {
    duration: inferDuration(trend),
    durationYears: inferDurationYears(trend),
    direction: inferDirection(trend),
    momentum: inferMomentum(trend),
    focus: inferFocus(trend),
    analysisMethod: inferAnalysisMethod(trend),
  };
}

function inferDuration(t: TrendDot): TrendDuration {
  if (t.category === "Mega-Trend") return "megatrend";
  if (t.category === "Makro-Trend") return "trend";

  // Heuristic: high signal count + short horizon + high velocity = might be hype
  if (t.timeHorizon === "short" && t.velocity === "rising" && t.confidence < 0.5) return "hype";
  if (t.timeHorizon === "long" && t.impact > 0.7) return "megatrend";
  if (t.timeHorizon === "short" && t.signalCount < 20) return "hype";

  return "trend";
}

function inferDurationYears(t: TrendDot): string {
  const dur = inferDuration(t);
  if (dur === "hype") return "0-2";
  if (dur === "trend") return "3-10";
  return "30+";
}

function inferDirection(t: TrendDot): TrendDirection {
  // Map velocity to direction, with cyclical detection
  if (t.velocity === "rising") return "rising";
  if (t.velocity === "falling") return "falling";

  // Check for cyclical patterns in certain categories
  const cyclicalTags = ["blockchain", "crypto", "web3", "nft", "seasonal"];
  if (t.tags.some((tag) => cyclicalTags.includes(tag.toLowerCase()))) return "cyclical";

  return "stable";
}

function inferMomentum(t: TrendDot): number {
  // -1 (strong decline) to +1 (strong growth)
  if (t.velocity === "rising") return 0.3 + t.relevance * 0.7;
  if (t.velocity === "falling") return -(0.3 + (1 - t.relevance) * 0.7);
  return 0;
}

function inferFocus(t: TrendDot): TrendFocus[] {
  const focus: TrendFocus[] = [];
  const tags = t.tags.map((tag) => tag.toLowerCase());
  const name = t.name.toLowerCase();

  // Technology
  if (
    tags.some((tag) => ["ai", "llm", "cloud", "quantum", "blockchain", "iot", "edge", "xr", "cyber",
      "digital", "automation", "generative", "agents", "machine-learning", "data"].includes(tag)) ||
    name.includes("ai") || name.includes("computing") || name.includes("technology")
  ) {
    focus.push("technology");
  }

  // Market
  if (
    tags.some((tag) => ["market", "commerce", "platform", "api", "saas", "startup", "fintech",
      "e-commerce", "low-code", "creator"].includes(tag)) ||
    name.includes("economy") || name.includes("platform") || name.includes("commerce")
  ) {
    focus.push("market");
  }

  // Society
  if (
    tags.some((tag) => ["work", "education", "health", "demographics", "identity", "skills",
      "social", "diversity", "remote", "hybrid", "culture"].includes(tag)) ||
    name.includes("work") || name.includes("society") || name.includes("social") ||
    name.includes("health") || name.includes("demographic")
  ) {
    focus.push("society");
  }

  // Environment
  if (
    tags.some((tag) => ["sustainability", "climate", "green", "energy", "circular", "esg",
      "renewable", "decarbonization", "net-zero"].includes(tag)) ||
    name.includes("climate") || name.includes("sustainability") || name.includes("green") ||
    name.includes("energy") || name.includes("circular")
  ) {
    focus.push("environment");
  }

  // Political
  if (
    tags.some((tag) => ["geopolitics", "regulation", "governance", "fragmentation", "multipolar",
      "sovereignty", "gdpr", "trust"].includes(tag)) ||
    name.includes("geopolitical") || name.includes("governance") || name.includes("trust")
  ) {
    focus.push("political");
  }

  // Economic
  if (
    tags.some((tag) => ["economic", "fintech", "defi", "trade", "debt", "investment"].includes(tag)) ||
    name.includes("economic") || name.includes("financial") || name.includes("defi")
  ) {
    focus.push("economic");
  }

  // Default to technology if nothing matched
  if (focus.length === 0) focus.push("technology");

  return focus;
}

function inferAnalysisMethod(t: TrendDot): ("quantitative" | "qualitative" | "visual")[] {
  const methods: ("quantitative" | "qualitative" | "visual")[] = [];

  // If we have strong signal data from APIs, it's quantitative
  if (t.signalCount > 10) methods.push("quantitative");

  // If from research sources (PwC, EY, etc.), it's qualitative
  if (t.tags.some((tag) => ["PwC", "EY", "TRENDONE", "Roland Berger", "Zukunftsinstitut", "EU ESPAS"].includes(tag))) {
    methods.push("qualitative");
  }

  // Visual if it's a chart-based trend
  if ((t.topSources ?? []).includes("google_trends") || (t.topSources ?? []).includes("npm_pypi")) {
    methods.push("visual");
  }

  if (methods.length === 0) methods.push("qualitative");
  return methods;
}

/**
 * Enrich all trends with auto-classification
 */
export function classifyTrends(trends: TrendDot[]): TrendDot[] {
  return trends.map((t) => ({
    ...t,
    classification: t.classification || autoClassify(t),
  }));
}
