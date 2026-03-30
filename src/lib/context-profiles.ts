/**
 * Context Profiles
 *
 * A context profile defines WHO is asking.
 * The same trend landscape looks completely different to:
 * - A CTO at an automotive supplier in Germany
 * - An investor in Singapore focused on climate tech
 * - A policy maker at the EU Commission
 *
 * The profile recalibrates ALL scores and filters.
 */

export interface ContextProfile {
  id: string;
  role: string;        // CTO, CEO, Investor, Policy Maker, Researcher, ...
  industry: string;    // Automotive, Finance, Healthcare, Energy, Tech, ...
  region: string;      // DACH, EU, US, Asia-Pacific, Global, ...
  orgSize?: string;    // Startup, SME, Enterprise, Government
  interests?: string[]; // Specific areas of interest

  // How this profile changes the scoring
  trendWeights: {
    // Boost or reduce specific trend categories
    [category: string]: number; // multiplier: 1.0 = neutral, 1.5 = boost, 0.5 = reduce
  };
  regulationFocus: string[]; // Which jurisdictions matter most
  sourcePreferences: {
    // Which sources matter most for this profile
    [sourceType: string]: number; // multiplier
  };
}

export const PRESET_PROFILES: ContextProfile[] = [
  {
    id: "cto-automotive-dach",
    role: "CTO",
    industry: "Automotive",
    region: "DACH",
    orgSize: "Enterprise",
    trendWeights: {
      "Mega-Trend": 1.2,
      "Makro-Trend": 1.3,
      "AI/ML": 1.5,
      "Languages": 0.5,
      "Frontend": 0.3,
      "Infrastructure": 1.4,
      "Emerging": 1.2,
      "Security": 1.3,
    },
    regulationFocus: ["EU", "Global"],
    sourcePreferences: {
      hackernews: 0.6,
      github: 1.0,
      arxiv: 1.3,
      news: 1.2,
      worldmonitor: 1.4,
      polymarket: 1.2,
      reddit: 0.4,
      producthunt: 0.3,
    },
  },
  {
    id: "investor-climatetech",
    role: "Investor",
    industry: "Climate Tech",
    region: "Global",
    trendWeights: {
      "Mega-Trend": 1.5,
      "Makro-Trend": 1.3,
      "Sustainability": 2.0,
      "Energy/Climate": 2.0,
      "AI/ML": 1.2,
      "Languages": 0.2,
      "Frontend": 0.1,
    },
    regulationFocus: ["EU", "US", "Global"],
    sourcePreferences: {
      news: 1.5,
      worldmonitor: 1.5,
      polymarket: 1.8,
      arxiv: 1.3,
      hackernews: 0.5,
      github: 0.8,
    },
  },
  {
    id: "policy-eu",
    role: "Policy Maker",
    industry: "Government",
    region: "EU",
    trendWeights: {
      "Mega-Trend": 1.8,
      "Makro-Trend": 1.5,
      "Security": 1.5,
      "AI/ML": 1.3,
      "Infrastructure": 1.3,
      "Languages": 0.1,
    },
    regulationFocus: ["EU", "Global", "US", "China"],
    sourcePreferences: {
      worldmonitor: 2.0,
      news: 1.5,
      polymarket: 1.3,
      arxiv: 1.2,
      hackernews: 0.3,
      producthunt: 0.1,
    },
  },
  {
    id: "startup-founder-ai",
    role: "Founder / CEO",
    industry: "AI / Tech",
    region: "Global",
    orgSize: "Startup",
    trendWeights: {
      "AI/ML": 2.0,
      "Makro-Trend": 1.2,
      "Developer Tools": 1.5,
      "AI Platforms": 1.8,
    },
    regulationFocus: ["EU", "US"],
    sourcePreferences: {
      hackernews: 1.5,
      github: 1.8,
      producthunt: 1.5,
      arxiv: 1.3,
      polymarket: 1.0,
      worldmonitor: 0.8,
    },
  },
  {
    id: "ciso-finance",
    role: "CISO",
    industry: "Finance",
    region: "EU",
    orgSize: "Enterprise",
    trendWeights: {
      "Security": 2.5,
      "Mega-Trend": 1.3,
      "Infrastructure": 1.5,
      "AI/ML": 1.2,
      "Languages": 0.2,
      "Frontend": 0.1,
    },
    regulationFocus: ["EU", "Global", "US"],
    sourcePreferences: {
      worldmonitor: 2.0,
      news: 1.5,
      hackernews: 1.0,
      arxiv: 0.8,
      producthunt: 0.2,
    },
  },
];

/**
 * Apply a context profile to trend scores
 */
export function applyContextProfile(
  trends: import("@/types").TrendDot[],
  profile: ContextProfile
): import("@/types").TrendDot[] {
  return trends.map((trend) => {
    // Calculate category boost
    let categoryMultiplier = 1.0;
    for (const [cat, weight] of Object.entries(profile.trendWeights)) {
      if (trend.category.includes(cat) || trend.tags.some((t) => t.toLowerCase().includes(cat.toLowerCase()))) {
        categoryMultiplier = Math.max(categoryMultiplier, weight);
      }
    }

    // Calculate source boost
    let sourceMultiplier = 1.0;
    let sourceCount = 0;
    for (const source of trend.topSources) {
      const pref = profile.sourcePreferences[source];
      if (pref !== undefined) {
        sourceMultiplier += pref - 1.0;
        sourceCount++;
      }
    }
    if (sourceCount > 0) sourceMultiplier /= sourceCount;
    else sourceMultiplier = 1.0;

    const boostedRelevance = Math.min(1, trend.relevance * categoryMultiplier * sourceMultiplier);

    return {
      ...trend,
      relevance: boostedRelevance,
    };
  }).sort((a, b) => b.relevance - a.relevance);
}

/**
 * Parse a natural language context description into a profile
 */
export function parseContextFromText(text: string): Partial<ContextProfile> {
  const lower = text.toLowerCase();
  const profile: Partial<ContextProfile> = {};

  // Role detection
  const roles: Record<string, string> = {
    cto: "CTO", ceo: "CEO", cfo: "CFO", ciso: "CISO", cmo: "CMO",
    investor: "Investor", founder: "Founder", researcher: "Researcher",
    berater: "Consultant", consultant: "Consultant",
    "policy maker": "Policy Maker", politiker: "Policy Maker",
    entwickler: "Developer", developer: "Developer",
    "product manager": "Product Manager", produktmanager: "Product Manager",
  };
  for (const [key, value] of Object.entries(roles)) {
    if (lower.includes(key)) { profile.role = value; break; }
  }

  // Industry detection
  const industries: Record<string, string> = {
    automotive: "Automotive", auto: "Automotive", fahrzeug: "Automotive",
    finance: "Finance", bank: "Finance", versicherung: "Insurance",
    healthcare: "Healthcare", gesundheit: "Healthcare", pharma: "Pharma",
    energy: "Energy", energie: "Energy",
    tech: "Tech", software: "Tech", saas: "Tech",
    manufacturing: "Manufacturing", industrie: "Manufacturing", maschinenbau: "Manufacturing",
    retail: "Retail", handel: "Retail",
    media: "Media", medien: "Media",
    education: "Education", bildung: "Education",
    government: "Government", regierung: "Government",
  };
  for (const [key, value] of Object.entries(industries)) {
    if (lower.includes(key)) { profile.industry = value; break; }
  }

  // Region detection
  const regions: Record<string, string> = {
    dach: "DACH", deutschland: "DACH", germany: "DACH", austria: "DACH", schweiz: "DACH",
    europe: "EU", europa: "EU", eu: "EU",
    usa: "US", "united states": "US", amerika: "US",
    asia: "Asia-Pacific", asien: "Asia-Pacific", china: "Asia-Pacific", japan: "Asia-Pacific",
    global: "Global", weltweit: "Global",
  };
  for (const [key, value] of Object.entries(regions)) {
    if (lower.includes(key)) { profile.region = value; break; }
  }

  // Size detection
  if (lower.includes("startup")) profile.orgSize = "Startup";
  else if (lower.includes("mittelstand") || lower.includes("sme") || lower.includes("kmu")) profile.orgSize = "SME";
  else if (lower.includes("konzern") || lower.includes("enterprise") || lower.includes("dax")) profile.orgSize = "Enterprise";

  return profile;
}
