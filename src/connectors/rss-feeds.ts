/**
 * RSS feed registry — the curated list of key-free RSS / Atom sources
 * that SIS ingests through the generic `buildRssFeedConnector`.
 *
 * Source of truth: Notion page "SIS — RSS Feeds & Key-freie Datenquellen"
 * (b97795df03e545698038047d734e9e1a), 2026-04-15.
 *
 * Scope rule: we only register feeds that DON'T already have a dedicated
 * connector. If a source has its own API connector (guardian, nyt, acled,
 * who_gho, hackernews, producthunt), we skip the RSS version — adding both
 * would double-count signals and the API variant is always richer.
 *
 * The feeds are grouped into six Notion categories for readability. Each
 * feed picks a SIS trend topic as its default; multi-topic feeds (news,
 * think tanks) use keyword mappings to refine the topic per item.
 *
 * Topic vocabulary:
 *   Artificial Intelligence & Automation
 *   Climate Change & Sustainability
 *   Cloud Native & Multi-Cloud
 *   Demographic Shifts & Aging
 *   Economic Trends
 *   Future of Work
 *   Geopolitical Fragmentation
 *   Health, Biotech & Longevity
 */

import type { RssFeedConfig } from "./rss-feed";
import type { TopicMapping } from "./framework";

// Reusable keyword mappings — used by several general-purpose feeds.

const GENERAL_NEWS_MAPPING: TopicMapping = [
  [["ai ", "artificial intelligence", "chatgpt", "openai", "machine learning", "neural", "llm", "generative"], "Artificial Intelligence & Automation"],
  [["climate", "warming", "emission", "renewable", "solar", "wind ", "carbon", "cop30", "cop31", "sustainability"], "Climate Change & Sustainability"],
  [["inflation", "gdp", "recession", "interest rate", "central bank", "stocks", "market", "trade deal", "tariff"], "Economic Trends"],
  [["migration", "refugee", "population", "demographic", "aging", "birth rate"], "Demographic Shifts & Aging"],
  [["war", "conflict", "sanction", "election", "geopolit", "nato", "ukraine", "gaza", "taiwan", "russia", "china"], "Geopolitical Fragmentation"],
  [["remote work", "four-day week", "labour", "labor", "unions", "gig economy"], "Future of Work"],
  [["pandemic", "outbreak", "vaccine", "biotech", "genom", "longevity", "mental health"], "Health, Biotech & Longevity"],
];

const THINKTANK_MAPPING: TopicMapping = [
  [["ai ", "artificial intelligence", "algorithm", "automation", "machine learning"], "Artificial Intelligence & Automation"],
  [["climate", "net zero", "emission", "energy transition"], "Climate Change & Sustainability"],
  [["inflation", "fiscal", "monetary", "growth", "debt", "trade"], "Economic Trends"],
  [["migration", "aging", "population"], "Demographic Shifts & Aging"],
  [["conflict", "war", "security", "geopolit", "diplomat", "sanction", "nato", "china", "russia"], "Geopolitical Fragmentation"],
  [["democracy", "authoritarian", "elect", "governance", "corruption"], "Geopolitical Fragmentation"],
  [["work ", "employ", "skill", "labour", "labor"], "Future of Work"],
  [["health", "pandemic", "disease"], "Health, Biotech & Longevity"],
];

// ── News & Medien-Intelligence ─────────────────────────────────────────────
// Note: Guardian + NYT are skipped — they have API-key connectors already.

const NEWS_FEEDS: RssFeedConfig[] = [
  {
    name: "bbc_world_rss",
    displayName: "BBC News (World)",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: GENERAL_NEWS_MAPPING,
    tags: ["news", "international"],
  },
  // Reuters sunset their public RSS in 2020; the connector fired a
  // failed fetch on every pipeline run, polluted the /monitor logs,
  // and produced zero signals. Audit A3-L2 (18.04.2026) recommended
  // removal. Reuters coverage is still reachable via the existing
  // GDELT connector's global-media scope. Re-add an entry here only
  // if Reuters brings back a public feed.
  {
    name: "aljazeera_rss",
    displayName: "Al Jazeera (All)",
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: GENERAL_NEWS_MAPPING,
    tags: ["news", "international", "global-south"],
  },
  {
    name: "spiegel_rss",
    displayName: "DER SPIEGEL (Schlagzeilen)",
    feedUrl: "https://www.spiegel.de/schlagzeilen/index.rss",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: GENERAL_NEWS_MAPPING,
    tags: ["news", "dach", "de"],
  },
  {
    name: "bellingcat_rss",
    displayName: "Bellingcat (OSINT)",
    feedUrl: "https://www.bellingcat.com/feed/",
    defaultTopic: "Geopolitical Fragmentation",
    tags: ["osint", "investigative"],
  },
];

// ── Wissenschaft & Forschung ───────────────────────────────────────────────

const SCIENCE_FEEDS: RssFeedConfig[] = [
  {
    name: "arxiv_cs_ai_rss",
    displayName: "arXiv — AI (cs.AI)",
    feedUrl: "https://export.arxiv.org/rss/cs.AI",
    defaultTopic: "Artificial Intelligence & Automation",
    tags: ["science", "arxiv", "ai"],
  },
  {
    name: "arxiv_econ_rss",
    displayName: "arXiv — Economics (econ)",
    feedUrl: "https://export.arxiv.org/rss/econ",
    defaultTopic: "Economic Trends",
    tags: ["science", "arxiv", "economics"],
  },
  {
    name: "arxiv_qbio_rss",
    displayName: "arXiv — Quantitative Biology (q-bio)",
    feedUrl: "https://export.arxiv.org/rss/q-bio",
    defaultTopic: "Health, Biotech & Longevity",
    tags: ["science", "arxiv", "biotech"],
  },
  {
    name: "arxiv_physics_aoph_rss",
    displayName: "arXiv — Atmospheric Physics (physics.ao-ph)",
    feedUrl: "https://export.arxiv.org/rss/physics.ao-ph",
    defaultTopic: "Climate Change & Sustainability",
    tags: ["science", "arxiv", "climate"],
  },
  {
    name: "arxiv_cs_lg_rss",
    displayName: "arXiv — Machine Learning (cs.LG)",
    feedUrl: "https://export.arxiv.org/rss/cs.LG",
    defaultTopic: "Artificial Intelligence & Automation",
    tags: ["science", "arxiv", "ml"],
  },
  {
    name: "arxiv_cs_cy_rss",
    displayName: "arXiv — Computers & Society (cs.CY)",
    feedUrl: "https://export.arxiv.org/rss/cs.CY",
    defaultTopic: "Artificial Intelligence & Automation",
    tags: ["science", "arxiv", "ethics", "policy"],
  },
  {
    name: "ssrn_rss",
    displayName: "SSRN (Working Papers)",
    feedUrl: "https://www.ssrn.com/rss/hfen_rss.cfm",
    defaultTopic: "Economic Trends",
    tags: ["science", "social-science", "working-paper"],
  },
  {
    name: "nature_rss",
    displayName: "Nature",
    feedUrl: "https://www.nature.com/nature.rss",
    defaultTopic: "Health, Biotech & Longevity",
    keywordMapping: [
      [["climate", "warming", "emission"], "Climate Change & Sustainability"],
      [["ai ", "neural", "machine learning"], "Artificial Intelligence & Automation"],
      [["economy", "inflation", "gdp"], "Economic Trends"],
    ],
    tags: ["science", "journal"],
  },
  {
    name: "science_rss",
    displayName: "Science",
    feedUrl: "https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science",
    defaultTopic: "Health, Biotech & Longevity",
    keywordMapping: [
      [["climate", "warming", "emission"], "Climate Change & Sustainability"],
      [["ai ", "neural", "machine learning"], "Artificial Intelligence & Automation"],
    ],
    tags: ["science", "journal"],
  },
];

// ── Institutionen & Policy ────────────────────────────────────────────────

const INSTITUTION_FEEDS: RssFeedConfig[] = [
  {
    name: "eurlex_rss",
    displayName: "EUR-Lex (EU Legislation)",
    feedUrl: "https://publications.europa.eu/en/rss",
    defaultTopic: "Geopolitical Fragmentation",
    tags: ["policy", "eu", "regulation"],
  },
  {
    name: "europarl_rss",
    displayName: "European Parliament (Top News)",
    feedUrl: "https://www.europarl.europa.eu/rss/doc/top-news/en.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["policy", "eu"],
  },
  {
    name: "un_news_rss",
    displayName: "UN News",
    feedUrl: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: GENERAL_NEWS_MAPPING,
    tags: ["policy", "un", "international"],
  },
  {
    name: "worldbank_blogs_rss",
    displayName: "World Bank Blogs",
    feedUrl: "https://blogs.worldbank.org/en/rss.xml",
    defaultTopic: "Economic Trends",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["policy", "economics", "development"],
  },
  {
    name: "imf_rss",
    displayName: "IMF (Publications)",
    feedUrl: "https://www.imf.org/en/Publications/RSS",
    defaultTopic: "Economic Trends",
    tags: ["policy", "economics", "imf"],
  },
  {
    name: "oecd_ilibrary_rss",
    displayName: "OECD iLibrary",
    feedUrl: "https://www.oecd-ilibrary.org/rss/15-07/en",
    defaultTopic: "Economic Trends",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["policy", "oecd"],
  },
  {
    name: "ecb_press_rss",
    displayName: "ECB (Press)",
    feedUrl: "https://www.ecb.europa.eu/rss/press.html",
    defaultTopic: "Economic Trends",
    tags: ["policy", "central-bank", "eu"],
  },
  {
    name: "bis_fsr_rss",
    displayName: "BIS (Financial Stability)",
    feedUrl: "https://www.bis.org/doclist/bis_fsr_shared.rss",
    defaultTopic: "Economic Trends",
    tags: ["policy", "central-bank", "financial-stability"],
  },
  {
    name: "eurostat_news_rss",
    displayName: "Eurostat Newsroom",
    feedUrl: "https://ec.europa.eu/eurostat/en/rss",
    defaultTopic: "Economic Trends",
    tags: ["policy", "statistics", "eu"],
  },
  {
    name: "ifo_rss",
    displayName: "ifo Institut",
    feedUrl: "https://www.ifo.de/rss/news",
    defaultTopic: "Economic Trends",
    tags: ["policy", "economics", "dach", "de"],
  },
  {
    name: "wifo_rss",
    displayName: "WIFO (Österreich)",
    feedUrl: "https://www.wifo.ac.at/rss",
    defaultTopic: "Economic Trends",
    tags: ["policy", "economics", "dach", "at"],
  },
  {
    name: "diw_rss",
    displayName: "DIW Berlin",
    feedUrl: "https://www.diw.de/de/rss",
    defaultTopic: "Economic Trends",
    tags: ["policy", "economics", "dach", "de"],
  },
];

// ── Foresight & Think Tanks ───────────────────────────────────────────────

const THINKTANK_FEEDS: RssFeedConfig[] = [
  {
    name: "iftf_rss",
    displayName: "IFTF (Institute for the Future)",
    feedUrl: "https://www.iftf.org/insights/feed/",
    defaultTopic: "Future of Work",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["foresight", "think-tank"],
  },
  {
    name: "brookings_rss",
    displayName: "Brookings Institution",
    feedUrl: "https://www.brookings.edu/feed/",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["think-tank", "us"],
  },
  {
    name: "chathamhouse_rss",
    displayName: "Chatham House",
    feedUrl: "https://www.chathamhouse.org/publications/all.rss",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["think-tank", "uk"],
  },
  {
    name: "rand_rss",
    displayName: "RAND Corporation",
    feedUrl: "https://www.rand.org/pubs/rss/all-products.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["think-tank", "us", "security"],
  },
  {
    name: "bertelsmann_rss",
    displayName: "Bertelsmann Stiftung",
    feedUrl: "https://www.bertelsmann-stiftung.de/de/rss",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["think-tank", "dach", "de"],
  },
  {
    name: "swp_rss",
    displayName: "SWP (Stiftung Wissenschaft und Politik)",
    feedUrl: "https://www.swp-berlin.org/rss/aktuelles.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["think-tank", "dach", "de", "security"],
  },
  {
    name: "ecfr_rss",
    displayName: "ECFR (European Council on Foreign Relations)",
    feedUrl: "https://ecfr.eu/feed/",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: THINKTANK_MAPPING,
    tags: ["think-tank", "eu"],
  },
  {
    name: "crisisgroup_rss",
    displayName: "International Crisis Group",
    feedUrl: "https://www.crisisgroup.org/rss.xml",
    defaultTopic: "Geopolitical Fragmentation",
    tags: ["think-tank", "conflict"],
  },
  {
    name: "transparency_rss",
    displayName: "Transparency International",
    feedUrl: "https://www.transparency.org/en/feed",
    defaultTopic: "Geopolitical Fragmentation",
    tags: ["governance", "corruption"],
  },
  {
    name: "vdem_rss",
    displayName: "V-Dem Institute",
    feedUrl: "https://v-dem.net/feed/",
    defaultTopic: "Geopolitical Fragmentation",
    tags: ["democracy", "governance"],
  },
];

// ── Tech-Signale ──────────────────────────────────────────────────────────
// HN + Product Hunt skipped (dedicated connectors). GitHub Trending skipped
// — needs a self-hosted RSSHub instance we don't run.

const TECH_FEEDS: RssFeedConfig[] = [
  {
    name: "techcrunch_rss",
    displayName: "TechCrunch",
    feedUrl: "https://techcrunch.com/feed/",
    defaultTopic: "Artificial Intelligence & Automation",
    keywordMapping: [
      [["ai ", "artificial intelligence", "llm", "generative"], "Artificial Intelligence & Automation"],
      [["climate", "clean tech", "energy"], "Climate Change & Sustainability"],
      [["biotech", "health"], "Health, Biotech & Longevity"],
      [["remote work", "hybrid work"], "Future of Work"],
    ],
    tags: ["tech", "startup"],
  },
  {
    name: "mit_tech_review_rss",
    displayName: "MIT Technology Review",
    feedUrl: "https://www.technologyreview.com/feed/",
    defaultTopic: "Artificial Intelligence & Automation",
    keywordMapping: [
      [["ai ", "artificial intelligence", "llm", "chatgpt"], "Artificial Intelligence & Automation"],
      [["climate", "carbon", "clean energy"], "Climate Change & Sustainability"],
      [["biotech", "crispr", "genom"], "Health, Biotech & Longevity"],
    ],
    tags: ["tech", "analysis"],
  },
  {
    name: "import_ai_rss",
    displayName: "Import AI (Jack Clark)",
    feedUrl: "https://jack-clark.net/feed/",
    defaultTopic: "Artificial Intelligence & Automation",
    tags: ["ai", "newsletter"],
  },
  {
    name: "the_batch_rss",
    displayName: "The Batch (deeplearning.ai)",
    feedUrl: "https://www.deeplearning.ai/the-batch/feed/",
    defaultTopic: "Artificial Intelligence & Automation",
    tags: ["ai", "newsletter"],
  },
];

// ── Gesundheit & Humanitäre Krisen ────────────────────────────────────────
// WHO + ACLED skipped (dedicated). ICG is in the think-tank group.

const HEALTH_FEEDS: RssFeedConfig[] = [
  {
    name: "reliefweb_rss",
    displayName: "ReliefWeb (Humanitarian Updates)",
    feedUrl: "https://reliefweb.int/updates/rss.xml",
    defaultTopic: "Geopolitical Fragmentation",
    keywordMapping: [
      [["health", "disease", "cholera", "outbreak"], "Health, Biotech & Longevity"],
      [["drought", "flood", "cyclone", "earthquake", "climate"], "Climate Change & Sustainability"],
      [["refugee", "displac", "migration"], "Demographic Shifts & Aging"],
    ],
    tags: ["humanitarian", "crisis"],
  },
  {
    name: "carbon_brief_rss",
    displayName: "Carbon Brief",
    feedUrl: "https://www.carbonbrief.org/feed/",
    defaultTopic: "Climate Change & Sustainability",
    tags: ["climate", "journalism"],
  },
  {
    name: "ipcc_rss",
    displayName: "IPCC",
    feedUrl: "https://www.ipcc.ch/feed/",
    defaultTopic: "Climate Change & Sustainability",
    tags: ["climate", "science", "un"],
  },
  {
    name: "iea_rss",
    displayName: "IEA (International Energy Agency)",
    feedUrl: "https://www.iea.org/news.rss",
    defaultTopic: "Climate Change & Sustainability",
    keywordMapping: [
      [["oil", "gas", "energy crisis", "prices"], "Economic Trends"],
    ],
    tags: ["energy", "climate"],
  },
];

// ── Merged export ─────────────────────────────────────────────────────────

export const RSS_FEED_CONFIGS: RssFeedConfig[] = [
  ...NEWS_FEEDS,
  ...SCIENCE_FEEDS,
  ...INSTITUTION_FEEDS,
  ...THINKTANK_FEEDS,
  ...TECH_FEEDS,
  ...HEALTH_FEEDS,
];
