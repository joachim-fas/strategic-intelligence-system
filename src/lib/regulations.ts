/**
 * Global Regulatory Landscape
 *
 * Tracks major regulations and regulatory frameworks by jurisdiction
 * that impact trends in the radar. Regulations are both DRIVERS and
 * INHIBITORS of trends — they can accelerate adoption (e.g., EU Green Deal
 * drives sustainability) or slow it down (e.g., AI Act constrains AI deployment).
 */

export interface Regulation {
  id: string;
  name: string;
  shortName: string;
  jurisdiction: string; // "EU", "US", "China", "UK", "Global", etc.
  status: "proposed" | "adopted" | "enforcing" | "planned";
  effectiveDate?: string;
  description: string;
  url?: string;
  impactedTrends: {
    trendId: string;
    effect: "accelerates" | "constrains" | "reshapes";
    strength: number; // 0-1
  }[];
  tags: string[];
}

export const GLOBAL_REGULATIONS: Regulation[] = [
  // ═══════════════════════════════════════════════════════════
  // EUROPEAN UNION
  // ═══════════════════════════════════════════════════════════
  {
    id: "eu-ai-act",
    name: "EU AI Act",
    shortName: "AI Act",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2024-08",
    description: "World's first comprehensive AI regulation. Risk-based framework classifying AI systems. High-risk AI requires conformity assessments.",
    url: "https://artificialintelligenceact.eu/",
    impactedTrends: [
      { trendId: "mega-ai-transformation", effect: "reshapes", strength: 0.9 },
      { trendId: "macro-generative-ai", effect: "constrains", strength: 0.7 },
      { trendId: "macro-ai-agents", effect: "constrains", strength: 0.8 },
      { trendId: "mega-security-trust", effect: "accelerates", strength: 0.6 },
    ],
    tags: ["ai", "regulation", "risk-based", "conformity"],
  },
  {
    id: "eu-gdpr",
    name: "General Data Protection Regulation",
    shortName: "GDPR",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2018-05",
    description: "Comprehensive data protection framework. Sets global standard for privacy regulation. Extraterritorial scope.",
    impactedTrends: [
      { trendId: "macro-data-economy", effect: "reshapes", strength: 0.9 },
      { trendId: "mega-security-trust", effect: "accelerates", strength: 0.7 },
      { trendId: "mega-connectivity", effect: "constrains", strength: 0.4 },
    ],
    tags: ["data", "privacy", "protection", "extraterritorial"],
  },
  {
    id: "eu-dora",
    name: "Digital Operational Resilience Act",
    shortName: "DORA",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2025-01",
    description: "ICT risk management framework for financial sector. Requires third-party risk management and incident reporting.",
    impactedTrends: [
      { trendId: "macro-cybersecurity", effect: "accelerates", strength: 0.8 },
      { trendId: "mega-security-trust", effect: "accelerates", strength: 0.7 },
    ],
    tags: ["fintech", "resilience", "ict-risk", "financial"],
  },
  {
    id: "eu-nis2",
    name: "NIS2 Directive",
    shortName: "NIS2",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2024-10",
    description: "Network and Information Security directive. Expands scope of critical infrastructure cybersecurity requirements.",
    impactedTrends: [
      { trendId: "macro-cybersecurity", effect: "accelerates", strength: 0.9 },
      { trendId: "mega-security-trust", effect: "accelerates", strength: 0.8 },
    ],
    tags: ["cybersecurity", "critical-infrastructure", "reporting"],
  },
  {
    id: "eu-green-deal",
    name: "European Green Deal / Fit for 55",
    shortName: "Green Deal",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2020-03",
    description: "Climate neutrality by 2050. 55% emissions reduction by 2030. Carbon border adjustment, emissions trading, renewable targets.",
    impactedTrends: [
      { trendId: "mega-climate-sustainability", effect: "accelerates", strength: 0.95 },
      { trendId: "mega-energy-transition", effect: "accelerates", strength: 0.9 },
      { trendId: "macro-green-energy", effect: "accelerates", strength: 0.9 },
      { trendId: "macro-circular-economy", effect: "accelerates", strength: 0.7 },
    ],
    tags: ["climate", "emissions", "carbon", "renewable"],
  },
  {
    id: "eu-dma-dsa",
    name: "Digital Markets Act / Digital Services Act",
    shortName: "DMA/DSA",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2023-11",
    description: "Regulates gatekeepers (big tech platforms). Interoperability, data portability, content moderation requirements.",
    impactedTrends: [
      { trendId: "macro-platform-economy", effect: "reshapes", strength: 0.8 },
      { trendId: "mega-connectivity", effect: "reshapes", strength: 0.5 },
    ],
    tags: ["platform", "gatekeeper", "interoperability", "content"],
  },
  {
    id: "eu-csrd",
    name: "Corporate Sustainability Reporting Directive",
    shortName: "CSRD",
    jurisdiction: "EU",
    status: "enforcing",
    effectiveDate: "2024-01",
    description: "Mandatory sustainability reporting for ~50,000 companies. Double materiality, taxonomy alignment, third-party assurance.",
    impactedTrends: [
      { trendId: "mega-climate-sustainability", effect: "accelerates", strength: 0.8 },
      { trendId: "macro-circular-economy", effect: "accelerates", strength: 0.6 },
    ],
    tags: ["esg", "reporting", "sustainability", "materiality"],
  },

  // ═══════════════════════════════════════════════════════════
  // UNITED STATES
  // ═══════════════════════════════════════════════════════════
  {
    id: "us-ai-eo",
    name: "US Executive Order on AI Safety",
    shortName: "AI EO",
    jurisdiction: "US",
    status: "enforcing",
    effectiveDate: "2023-10",
    description: "Requires safety testing for powerful AI models. Establishes AI Safety Institute. Addresses dual-use foundation models.",
    impactedTrends: [
      { trendId: "mega-ai-transformation", effect: "reshapes", strength: 0.6 },
      { trendId: "macro-generative-ai", effect: "constrains", strength: 0.5 },
    ],
    tags: ["ai", "safety", "foundation-models", "dual-use"],
  },
  {
    id: "us-chips-act",
    name: "CHIPS and Science Act",
    shortName: "CHIPS Act",
    jurisdiction: "US",
    status: "enforcing",
    effectiveDate: "2022-08",
    description: "$280B for semiconductor manufacturing and R&D. Reshoring chip production. Export controls on advanced chips to China.",
    impactedTrends: [
      { trendId: "mega-technological-disruption", effect: "accelerates", strength: 0.7 },
      { trendId: "mega-geopolitical-fracturing", effect: "accelerates", strength: 0.8 },
    ],
    tags: ["semiconductor", "reshoring", "export-controls", "china"],
  },
  {
    id: "us-ira",
    name: "Inflation Reduction Act (Climate)",
    shortName: "IRA",
    jurisdiction: "US",
    status: "enforcing",
    effectiveDate: "2022-08",
    description: "$370B for clean energy. Tax credits for EVs, solar, wind, hydrogen. Largest US climate investment ever.",
    impactedTrends: [
      { trendId: "mega-energy-transition", effect: "accelerates", strength: 0.85 },
      { trendId: "macro-green-energy", effect: "accelerates", strength: 0.9 },
      { trendId: "mega-climate-sustainability", effect: "accelerates", strength: 0.6 },
    ],
    tags: ["climate", "clean-energy", "ev", "tax-credits"],
  },

  // ═══════════════════════════════════════════════════════════
  // CHINA
  // ═══════════════════════════════════════════════════════════
  {
    id: "cn-ai-regulation",
    name: "China AI Governance Framework",
    shortName: "CN AI Gov",
    jurisdiction: "China",
    status: "enforcing",
    effectiveDate: "2023-08",
    description: "Generative AI regulation, algorithmic recommendation rules, deepfake rules. Content moderation and socialist values compliance.",
    impactedTrends: [
      { trendId: "mega-ai-transformation", effect: "reshapes", strength: 0.7 },
      { trendId: "macro-generative-ai", effect: "constrains", strength: 0.6 },
      { trendId: "mega-geopolitical-fracturing", effect: "accelerates", strength: 0.5 },
    ],
    tags: ["ai", "content", "algorithm", "values"],
  },
  {
    id: "cn-data-security",
    name: "China Data Security Law / PIPL",
    shortName: "DSL/PIPL",
    jurisdiction: "China",
    status: "enforcing",
    effectiveDate: "2021-11",
    description: "Data localization, cross-border transfer restrictions, critical information infrastructure. China's GDPR equivalent.",
    impactedTrends: [
      { trendId: "macro-data-economy", effect: "reshapes", strength: 0.8 },
      { trendId: "mega-geopolitical-fracturing", effect: "accelerates", strength: 0.6 },
      { trendId: "mega-connectivity", effect: "constrains", strength: 0.5 },
    ],
    tags: ["data", "localization", "cross-border", "privacy"],
  },

  // ═══════════════════════════════════════════════════════════
  // UNITED KINGDOM
  // ═══════════════════════════════════════════════════════════
  {
    id: "uk-ai-framework",
    name: "UK Pro-Innovation AI Framework",
    shortName: "UK AI",
    jurisdiction: "UK",
    status: "adopted",
    effectiveDate: "2024-02",
    description: "Sector-specific AI regulation through existing regulators. Pro-innovation approach without horizontal legislation.",
    impactedTrends: [
      { trendId: "mega-ai-transformation", effect: "accelerates", strength: 0.5 },
      { trendId: "macro-generative-ai", effect: "accelerates", strength: 0.4 },
    ],
    tags: ["ai", "sector-specific", "innovation", "sandbox"],
  },
  {
    id: "uk-online-safety",
    name: "UK Online Safety Act",
    shortName: "OSA",
    jurisdiction: "UK",
    status: "enforcing",
    effectiveDate: "2023-10",
    description: "Platform safety, age verification, illegal content removal duties.",
    impactedTrends: [
      { trendId: "macro-platform-economy", effect: "constrains", strength: 0.6 },
      { trendId: "mega-security-trust", effect: "accelerates", strength: 0.5 },
    ],
    tags: ["platform", "safety", "age-verification", "content"],
  },

  // ═══════════════════════════════════════════════════════════
  // GLOBAL / MULTILATERAL
  // ═══════════════════════════════════════════════════════════
  {
    id: "un-sdgs",
    name: "UN Sustainable Development Goals 2030",
    shortName: "SDGs",
    jurisdiction: "Global",
    status: "enforcing",
    effectiveDate: "2015-09",
    description: "17 goals for sustainable development. Framework referenced by governments, corporations, and investors globally.",
    impactedTrends: [
      { trendId: "mega-climate-sustainability", effect: "accelerates", strength: 0.7 },
      { trendId: "mega-social-instability", effect: "reshapes", strength: 0.4 },
      { trendId: "mega-health-biotech", effect: "accelerates", strength: 0.4 },
    ],
    tags: ["sustainability", "development", "global-goals"],
  },
  {
    id: "paris-agreement",
    name: "Paris Climate Agreement",
    shortName: "Paris",
    jurisdiction: "Global",
    status: "enforcing",
    effectiveDate: "2016-11",
    description: "Limit warming to 1.5°C. Nationally Determined Contributions. Global stocktake mechanism.",
    impactedTrends: [
      { trendId: "mega-climate-sustainability", effect: "accelerates", strength: 0.9 },
      { trendId: "mega-energy-transition", effect: "accelerates", strength: 0.85 },
    ],
    tags: ["climate", "1.5-degrees", "ndc", "stocktake"],
  },
  {
    id: "basel-iii",
    name: "Basel III / IV Banking Regulation",
    shortName: "Basel III",
    jurisdiction: "Global",
    status: "enforcing",
    effectiveDate: "2023-01",
    description: "Capital adequacy, stress testing, market liquidity risk. Impacts fintech and digital banking.",
    impactedTrends: [
      { trendId: "mega-security-trust", effect: "accelerates", strength: 0.5 },
    ],
    tags: ["banking", "capital", "risk", "fintech"],
  },
];

/**
 * Get regulations impacting a specific trend
 */
export function getRegulationsForTrend(trendId: string): Regulation[] {
  return GLOBAL_REGULATIONS.filter((r) =>
    r.impactedTrends.some((it) => it.trendId === trendId)
  );
}

/**
 * Get all regulations for a specific jurisdiction
 */
export function getRegulationsByJurisdiction(jurisdiction: string): Regulation[] {
  return GLOBAL_REGULATIONS.filter((r) => r.jurisdiction === jurisdiction);
}

/**
 * Get unique jurisdictions
 */
export function getJurisdictions(): string[] {
  return [...new Set(GLOBAL_REGULATIONS.map((r) => r.jurisdiction))].sort();
}

/**
 * Calculate regulatory pressure on a trend (how much regulation affects it)
 */
export function getRegulatoryPressure(trendId: string): {
  total: number;
  accelerating: number;
  constraining: number;
  reshaping: number;
} {
  const regs = getRegulationsForTrend(trendId);
  let accelerating = 0, constraining = 0, reshaping = 0;

  for (const reg of regs) {
    const impact = reg.impactedTrends.find((it) => it.trendId === trendId);
    if (!impact) continue;
    if (impact.effect === "accelerates") accelerating += impact.strength;
    if (impact.effect === "constrains") constraining += impact.strength;
    if (impact.effect === "reshapes") reshaping += impact.strength;
  }

  return { total: regs.length, accelerating, constraining, reshaping };
}
