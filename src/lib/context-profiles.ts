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

// ═════════════════════════════════════════════════════════════════════
// Notion v0.2 — Context Profile Prompt Prefix (Section 7)
//
// When a context profile is active, this block is prepended to the
// main system prompt to recalibrate LANGUAGE and RECOMMENDATIONS to the
// user's decision frame. The scoring side is handled separately by
// `applyContextProfile()` above — the prompt side is purely about:
//
//   - which trends / regulations to emphasize
//   - which vocabulary and decision horizon to use
//   - which recommendations fall within the user's decision authority
//
// Important: this does NOT override source rules, anti-hallucination
// constraints, or temporal validity.
//
// The prefix is currently NOT automatically injected — the main query
// route attaches a short `[Context: role / industry / region]` tag to
// the USER message instead (see `/api/v1/query/route.ts`). The full
// prefix below is published here as Notion-spec source of truth so
// that when a richer context-aware route is wired, the prompt is
// ready to drop in.
// ═════════════════════════════════════════════════════════════════════

/**
 * Render the Notion v0.2 context profile prefix with the user's
 * profile interpolated. The output is an English system-prompt
 * fragment intended to be prepended before the main briefing prompt.
 */
export function buildContextProfilePrefix(profile: Partial<ContextProfile>): string {
  const role = profile.role || "—";
  const industry = profile.industry || "—";
  const region = profile.region || "Global";
  const orgSize = profile.orgSize || "—";
  const categoryWeights = profile.trendWeights
    ? Object.entries(profile.trendWeights)
        .map(([k, v]) => `${k}:${v.toFixed(1)}x`)
        .join(", ")
    : "(default weights)";

  return `## Active Context Filter

The user has activated a context profile. Calibrate all responses accordingly:

Role: ${role}
Industry: ${industry}
Region: ${region}
OrgSize: ${orgSize}

Calibration rules:

1. RELEVANCE FILTER: Emphasize trends and signals directly relevant to ${role} in ${industry}.
   Reweight STEEP+V categories: ${categoryWeights}
   Surface regulations applicable to ${industry} in ${region} first.

2. LANGUAGE: Use the frame of reference of ${role}.
   A CTO thinks in tech stack, team capacity, and build/buy/partner decisions.
   A CFO thinks in EBITDA impact and cash flow risk.
   A Policy Maker thinks in regulatory windows and coalition feasibility.
   Match this framing in recommendations — not just vocabulary.

3. RECOMMENDATIONS: Action recommendations must fall within the typical decision authority of ${role}.
   Do not recommend actions that require a different role's budget or mandate.

4. REGULATORY FOCUS: Prioritize regulations applicable to ${region} and ${industry}.
   EU-focus for DACH profiles. US-focus for US profiles.
   Name compliance deadlines explicitly.

5. CONFIDENCE CALIBRATION: Apply ${role}-specific signal weighting.
   For a CTO: technical signals weight more. For a CFO: financial signals weight more.

This profile does not override source rules, anti-hallucination constraints, or temporal validity rules.

TEMPORAL VALIDITY applies equally under all context profiles: all recommendations, action windows, and scenario horizons must be future-dated relative to CURRENT_DATE.`;
}

/** Raw English template for registry/docs. Placeholders intact. */
export const CONTEXT_PROFILE_PREFIX_TEMPLATE_EN = `## Active Context Filter

The user has activated a context profile. Calibrate all responses accordingly:

Role: ROLE           // e.g. "CTO", "CEO", "Investor", "Policy Maker"
Industry: INDUSTRY   // e.g. "Automotive", "Finance", "Healthcare"
Region: REGION       // e.g. "DACH", "EU", "Global"
OrgSize: ORG_SIZE

Calibration rules:

1. RELEVANCE FILTER: Emphasize trends and signals directly relevant to ROLE in INDUSTRY.
   Reweight STEEP+V categories: CATEGORY_WEIGHTS
   Surface regulations applicable to INDUSTRY in REGION first.

2. LANGUAGE: Use the frame of reference of ROLE.
   A CTO thinks in tech stack, team capacity, and build/buy/partner decisions.
   A CFO thinks in EBITDA impact and cash flow risk.
   A Policy Maker thinks in regulatory windows and coalition feasibility.
   Match this framing in recommendations — not just vocabulary.

3. RECOMMENDATIONS: Action recommendations must fall within the typical decision authority of ROLE.
   Do not recommend actions that require a different role's budget or mandate.

4. REGULATORY FOCUS: Prioritize regulations applicable to REGION and INDUSTRY.
   EU-focus for DACH profiles. US-focus for US profiles.
   Name compliance deadlines explicitly.

5. CONFIDENCE CALIBRATION: Apply ROLE-specific signal weighting.
   For a CTO: technical signals weight more. For a CFO: financial signals weight more.

This profile does not override source rules, anti-hallucination constraints, or temporal validity rules.

TEMPORAL VALIDITY applies equally under all context profiles: all recommendations, action windows, and scenario horizons must be future-dated relative to CURRENT_DATE.`;
