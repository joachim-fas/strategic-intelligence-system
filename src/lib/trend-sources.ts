/**
 * Comprehensive registry of authoritative trend research sources.
 * 42+ institutions + thought leaders providing the knowledge foundation
 * for the Strategic Intelligence System.
 */

export interface TrendSourceRef {
  name: string;
  shortName: string;
  url: string;
  description?: string;
  category?: string;
  frequency?: string;
  access?: "free" | "freemium" | "paid";
  geoFocus?: string;
}

// ═══════════════════════════════════════════════════════════════
// INSTITUTIONAL SOURCES (42)
// ═══════════════════════════════════════════════════════════════

export const SOURCE_REGISTRY: Record<string, TrendSourceRef> = {
  // ─── Original 7 ─────────────────────────────────────────────
  zukunftsinstitut: {
    name: "Zukunftsinstitut",
    shortName: "ZI",
    url: "https://www.zukunftsinstitut.de/megatrends",
    description: "11 Megatrends",
    category: "Trend Research",
    frequency: "continuous",
    access: "free",
    geoFocus: "DACH/Europe",
  },
  pwc: {
    name: "PwC Global",
    shortName: "PwC",
    url: "https://www.pwc.com/gx/en/issues/megatrends.html",
    description: "Five Megatrends Reshaping the World",
    category: "Consulting",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  ey: {
    name: "EY Global",
    shortName: "EY",
    url: "https://www.ey.com/en_gl/megatrends",
    description: "Megatrends 2026 and Beyond",
    category: "Consulting",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  "eu-espas": {
    name: "EU ESPAS",
    shortName: "EU",
    url: "https://ec.europa.eu/assets/epsc/pages/espas/chapter1.html",
    description: "Global Trends to 2030",
    category: "Government",
    frequency: "multi-year",
    access: "free",
    geoFocus: "EU/Global",
  },
  "roland-berger": {
    name: "Roland Berger",
    shortName: "RB",
    url: "https://www.rolandberger.com/en/Insights/Global-Topics/Trend-Compendium/",
    description: "Trend Compendium 2050",
    category: "Consulting",
    frequency: "continuous",
    access: "free",
    geoFocus: "Global",
  },
  trendone: {
    name: "TRENDONE",
    shortName: "T1",
    url: "https://www.trendone.com/en/digital-tools/the-trend-universe-2026",
    description: "Trend Universe 2026 (18 Mega-Trends, 150 Macro-Trends)",
    category: "Trend Research",
    frequency: "annual",
    access: "freemium",
    geoFocus: "Global",
  },
  worldmonitor: {
    name: "World Monitor",
    shortName: "WM",
    url: "https://www.worldmonitor.app/",
    description: "Real-time global intelligence (22 domains, CII, Prediction Markets)",
    category: "Real-time Intelligence",
    frequency: "real-time",
    access: "free",
    geoFocus: "Global",
  },

  // ─── Management Consulting ─────────────────────────────────
  mckinsey: {
    name: "McKinsey Global Institute",
    shortName: "MGI",
    url: "https://www.mckinsey.com/mgi/overview",
    description: "18 Arenas of Competition, Tech Trends Outlook",
    category: "Consulting",
    frequency: "continuous",
    access: "free",
    geoFocus: "Global",
  },
  bcg: {
    name: "BCG",
    shortName: "BCG",
    url: "https://www.bcg.com/publications/2025/ten-forces-reshaping-global-business",
    description: "Ten Forces Reshaping Global Business",
    category: "Consulting",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  bain: {
    name: "Bain & Company",
    shortName: "Bain",
    url: "https://www.bain.com/insights/topics/macro-trends/",
    description: "Three Great Forces, Macro Trends",
    category: "Consulting",
    frequency: "continuous",
    access: "free",
    geoFocus: "Global",
  },
  deloitte: {
    name: "Deloitte Insights",
    shortName: "DI",
    url: "https://www.deloitte.com/us/en/insights/topics/technology-management/tech-trends.html",
    description: "Tech Trends (17th edition), TMT Predictions",
    category: "Consulting",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  accenture: {
    name: "Accenture",
    shortName: "Acc",
    url: "https://www.accenture.com/us-en/insights/technology/technology-trends-index",
    description: "Technology Vision (25th edition), Pulse of Change",
    category: "Consulting",
    frequency: "annual + quarterly",
    access: "free",
    geoFocus: "Global",
  },
  kpmg: {
    name: "KPMG",
    shortName: "KPMG",
    url: "https://kpmg.com/us/en/articles/2025/kpmg-2025-futures-report.html",
    description: "Futures Report, Global Tech Report",
    category: "Consulting",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  capgemini: {
    name: "Capgemini",
    shortName: "Cap",
    url: "https://www.capgemini.com/us-en/insights/research-library/top-tech-trends-of-2026/",
    description: "Top Tech Trends, TechnoVision",
    category: "Consulting",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  "frost-sullivan": {
    name: "Frost & Sullivan",
    shortName: "F&S",
    url: "https://www.frost.com/analytics/visionary-innovation/megatrends/",
    description: "Visionary Innovation Megatrends",
    category: "Consulting",
    frequency: "continuous",
    access: "freemium",
    geoFocus: "Global",
  },

  // ─── Technology Research ───────────────────────────────────
  gartner: {
    name: "Gartner",
    shortName: "Gart",
    url: "https://www.gartner.com/en/articles/top-technology-trends-2026",
    description: "Hype Cycle, Top Strategic Technology Trends",
    category: "Tech Research",
    frequency: "annual",
    access: "freemium",
    geoFocus: "Global",
  },
  forrester: {
    name: "Forrester",
    shortName: "Forr",
    url: "https://www.forrester.com/predictions/",
    description: "Predictions, Tech Tide, Wave reports",
    category: "Tech Research",
    frequency: "annual",
    access: "freemium",
    geoFocus: "Global",
  },
  idc: {
    name: "IDC FutureScape",
    shortName: "IDC",
    url: "https://www.idc.com/resource-center/futurescape/",
    description: "FutureScape Predictions (200+ per year)",
    category: "Tech Research",
    frequency: "annual",
    access: "freemium",
    geoFocus: "Global",
  },
  "cb-insights": {
    name: "CB Insights",
    shortName: "CBI",
    url: "https://www.cbinsights.com/research/report/top-tech-trends-2026/",
    description: "State of Innovation, Tech Trends",
    category: "Tech Research",
    frequency: "annual + quarterly",
    access: "freemium",
    geoFocus: "Global",
  },
  "mit-tech-review": {
    name: "MIT Technology Review",
    shortName: "MIT",
    url: "https://www.technologyreview.com/",
    description: "10 Breakthrough Technologies (25 years running)",
    category: "Tech Research",
    frequency: "annual",
    access: "freemium",
    geoFocus: "Global",
  },
  "startus-insights": {
    name: "StartUs Insights",
    shortName: "SUI",
    url: "https://www.startus-insights.com/innovators-guide/technology-radar/",
    description: "Innovation Map, 3.8M+ startups analyzed",
    category: "Tech Research",
    frequency: "continuous",
    access: "freemium",
    geoFocus: "Global",
  },

  // ─── Intergovernmental / Government ────────────────────────
  wef: {
    name: "World Economic Forum",
    shortName: "WEF",
    url: "https://www.weforum.org/publications/global-risks-report-2026/",
    description: "Global Risks Report, Future of Jobs, Davos Agenda",
    category: "Intergovernmental",
    frequency: "annual",
    access: "free",
    geoFocus: "Global",
  },
  oecd: {
    name: "OECD Strategic Foresight",
    shortName: "OECD",
    url: "https://www.oecd.org/en/about/programmes/strategic-foresight.html",
    description: "Strategic Foresight, Economic Outlook",
    category: "Intergovernmental",
    frequency: "biannual",
    access: "free",
    geoFocus: "OECD countries",
  },
  "us-nic": {
    name: "US National Intelligence Council",
    shortName: "NIC",
    url: "https://www.dni.gov/index.php/gt2040-home",
    description: "Global Trends 2040: A More Contested World",
    category: "Government Intelligence",
    frequency: "every 4 years",
    access: "free",
    geoFocus: "Global",
  },
  undp: {
    name: "UNDP",
    shortName: "UNDP",
    url: "https://www.undp.org/future-development",
    description: "Human Development Report, Future Development",
    category: "Intergovernmental",
    frequency: "annual",
    access: "free",
    geoFocus: "Global/Developing World",
  },
  unctad: {
    name: "UNCTAD",
    shortName: "UNCT",
    url: "https://unctad.org/",
    description: "Trade Trends, Digital Economy Report",
    category: "Intergovernmental",
    frequency: "annual",
    access: "free",
    geoFocus: "Global Trade",
  },
  nato: {
    name: "NATO Allied Command Transformation",
    shortName: "NATO",
    url: "https://www.act.nato.int/activities/allied-command-transformation-strategic-foresight-work/",
    description: "Strategic Foresight Analysis, Emerging Tech",
    category: "Defense/Security",
    frequency: "biannual",
    access: "free",
    geoFocus: "NATO/Global",
  },
  iea: {
    name: "International Energy Agency",
    shortName: "IEA",
    url: "https://www.iea.org/reports/world-energy-outlook-2025",
    description: "World Energy Outlook, Net Zero Roadmap",
    category: "Energy/Climate",
    frequency: "annual",
    access: "free",
    geoFocus: "Global Energy",
  },
  "singapore-csf": {
    name: "Singapore Centre for Strategic Futures",
    shortName: "CSF",
    url: "https://www.csf.gov.sg/",
    description: "National Foresight, Emerging Strategic Issues",
    category: "Government Foresight",
    frequency: "continuous",
    access: "free",
    geoFocus: "Asia-Pacific",
  },

  // ─── Think Tanks ───────────────────────────────────────────
  rand: {
    name: "RAND Corporation",
    shortName: "RAND",
    url: "https://www.rand.org/randeurope/initiatives/futures-and-foresight-studies/research.html",
    description: "Futures & Foresight, Defense Analysis",
    category: "Think Tank",
    frequency: "continuous",
    access: "free",
    geoFocus: "US/Global",
  },
  brookings: {
    name: "Brookings Institution",
    shortName: "Brk",
    url: "https://www.brookings.edu/",
    description: "Foresight Africa, Tech Policy, Economic Studies",
    category: "Think Tank",
    frequency: "continuous",
    access: "free",
    geoFocus: "US/Global/Africa",
  },
  "club-of-rome": {
    name: "Club of Rome",
    shortName: "CoR",
    url: "https://www.clubofrome.org/",
    description: "Earth4All, Limits to Growth legacy",
    category: "Think Tank",
    frequency: "periodic",
    access: "free",
    geoFocus: "Global",
  },
  "chatham-house": {
    name: "Chatham House",
    shortName: "CH",
    url: "https://www.chathamhouse.org/",
    description: "International Affairs, Geopolitical Analysis",
    category: "Think Tank",
    frequency: "continuous",
    access: "freemium",
    geoFocus: "UK/Global",
  },

  // ─── Academic ──────────────────────────────────────────────
  "stanford-hai": {
    name: "Stanford HAI",
    shortName: "HAI",
    url: "https://hai.stanford.edu/ai-index-report",
    description: "AI Index Report (definitive AI benchmark)",
    category: "Academic",
    frequency: "annual",
    access: "free",
    geoFocus: "Global AI",
  },
  "japan-nistep": {
    name: "Japan NISTEP",
    shortName: "NIST",
    url: "https://www.nistep.go.jp/en/?page_id=56",
    description: "Science & Technology Foresight (since 1971)",
    category: "Government/Academic",
    frequency: "every 5 years",
    access: "free",
    geoFocus: "Japan/Global",
  },

  // ─── Consumer/Market Intelligence ─────────────────────────
  euromonitor: {
    name: "Euromonitor International",
    shortName: "Euro",
    url: "https://www.euromonitor.com/",
    description: "Global Consumer Trends, Industry Reports",
    category: "Market Research",
    frequency: "annual",
    access: "freemium",
    geoFocus: "Global Consumer",
  },
  ipsos: {
    name: "Ipsos Global Trends",
    shortName: "Ipsos",
    url: "https://www.ipsos.com/en/global-trends-2024",
    description: "Global Trends Survey (50+ countries)",
    category: "Market Research",
    frequency: "biannual",
    access: "free",
    geoFocus: "Global",
  },

  // ─── Regional/Specialized ─────────────────────────────────
  csiro: {
    name: "CSIRO Australia",
    shortName: "CSIRO",
    url: "https://www.csiro.au/en/research/technology-space/data/our-future-world",
    description: "Our Future World megatrends",
    category: "Government Science",
    frequency: "periodic",
    access: "free",
    geoFocus: "Australia/Asia-Pacific",
  },
  ilo: {
    name: "International Labour Organization",
    shortName: "ILO",
    url: "https://www.ilo.org/",
    description: "Employment & Social Trends, Future of Work",
    category: "Intergovernmental",
    frequency: "annual",
    access: "free",
    geoFocus: "Global Labor",
  },
  imf: {
    name: "IMF",
    shortName: "IMF",
    url: "https://www.imf.org/en/publications/weo",
    description: "World Economic Outlook",
    category: "Intergovernmental",
    frequency: "biannual",
    access: "free",
    geoFocus: "Global Economy",
  },
  "world-bank": {
    name: "World Bank",
    shortName: "WB",
    url: "https://www.worldbank.org/en/publication/global-economic-prospects",
    description: "Global Economic Prospects, Development Indicators",
    category: "Intergovernmental",
    frequency: "biannual",
    access: "free",
    geoFocus: "Global/Developing",
  },
  "marsh-mclennan": {
    name: "Marsh McLennan",
    shortName: "MM",
    url: "https://www.marsh.com/en/risks/global-risk.html",
    description: "Global Risks Report (co-authored with WEF)",
    category: "Risk/Insurance",
    frequency: "annual",
    access: "free",
    geoFocus: "Global Risk",
  },
};

// Source name to registry key mapping
const SOURCE_NAME_MAP: Record<string, string> = {
  Zukunftsinstitut: "zukunftsinstitut",
  PwC: "pwc",
  EY: "ey",
  "EU ESPAS": "eu-espas",
  "Roland Berger": "roland-berger",
  TRENDONE: "trendone",
  "World Monitor": "worldmonitor",
  McKinsey: "mckinsey",
  MGI: "mckinsey",
  BCG: "bcg",
  Bain: "bain",
  Deloitte: "deloitte",
  Accenture: "accenture",
  KPMG: "kpmg",
  Capgemini: "capgemini",
  "Frost & Sullivan": "frost-sullivan",
  Gartner: "gartner",
  Forrester: "forrester",
  IDC: "idc",
  "CB Insights": "cb-insights",
  "MIT Technology Review": "mit-tech-review",
  MIT: "mit-tech-review",
  "StartUs Insights": "startus-insights",
  WEF: "wef",
  "World Economic Forum": "wef",
  OECD: "oecd",
  NIC: "us-nic",
  UNDP: "undp",
  UNCTAD: "unctad",
  NATO: "nato",
  IEA: "iea",
  "Singapore CSF": "singapore-csf",
  RAND: "rand",
  Brookings: "brookings",
  "Club of Rome": "club-of-rome",
  "Chatham House": "chatham-house",
  "Stanford HAI": "stanford-hai",
  "Japan NISTEP": "japan-nistep",
  Euromonitor: "euromonitor",
  Ipsos: "ipsos",
  CSIRO: "csiro",
  ILO: "ilo",
  IMF: "imf",
  "World Bank": "world-bank",
  "Marsh McLennan": "marsh-mclennan",
};

/**
 * Resolve a source name to a full source reference
 */
export function resolveSource(name: string): TrendSourceRef | null {
  const key = SOURCE_NAME_MAP[name] || name.toLowerCase().replace(/\s+/g, "-");
  return SOURCE_REGISTRY[key] || null;
}

/**
 * Get all authoritative sources cited by a trend (from its tags)
 */
export function getTrendSources(tags: string[]): TrendSourceRef[] {
  const sources: TrendSourceRef[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const ref = resolveSource(tag);
    if (ref && !seen.has(ref.name)) {
      sources.push(ref);
      seen.add(ref.name);
    }
  }
  return sources;
}

/**
 * Count how many authoritative sources cite this trend
 */
export function getSourceCount(tags: string[]): number {
  return getTrendSources(tags).length;
}

/**
 * Get total number of registered sources
 */
export function getTotalSourceCount(): number {
  return Object.keys(SOURCE_REGISTRY).length;
}

/**
 * Get all sources grouped by category
 */
export function getSourcesByCategory(): Record<string, TrendSourceRef[]> {
  const grouped: Record<string, TrendSourceRef[]> = {};
  for (const source of Object.values(SOURCE_REGISTRY)) {
    const cat = source.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(source);
  }
  return grouped;
}
