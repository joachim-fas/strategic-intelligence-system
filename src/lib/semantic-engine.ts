/**
 * Semantic Association Engine
 *
 * Instead of mapping every possible keyword manually, this engine:
 * 1. Builds a rich concept vocabulary from ALL trend data
 * 2. Uses fuzzy matching to connect any input to known concepts
 * 3. Generates reasoning chains explaining the connection
 *
 * This makes the system understand "benzinpreise", "Halbleiter",
 * "Fachkräftemangel", "Lieferketten", "TSMC", etc. WITHOUT
 * hardcoding each one.
 */

import { TrendDot } from "@/types";
import { GLOBAL_REGULATIONS } from "./regulations";
import { TREND_EDGES } from "./causal-graph";

interface ConceptEntry {
  term: string;          // the keyword/concept
  trendIds: string[];    // which trends it connects to
  strength: number;      // how strong the connection
  chain: string;         // reasoning explanation
  language: "de" | "en" | "both";
}

/**
 * Build a comprehensive concept vocabulary from all available data.
 * This runs once and caches the result.
 */
let _conceptCache: ConceptEntry[] | null = null;

/** Maximum cache entries before triggering eviction. */
const CACHE_MAX_ENTRIES = 1000;

/**
 * Clear the concept vocabulary cache.
 * Call when trends are reloaded or when memory pressure is high.
 */
export function clearCache(): void {
  _conceptCache = null;
}

export function getConceptVocabulary(trends: TrendDot[]): ConceptEntry[] {
  if (_conceptCache) return _conceptCache;

  const concepts: ConceptEntry[] = [];

  // ─── 1. From trend names and tags ──────────────────────────
  for (const trend of trends) {
    // Every word in the trend name becomes a concept
    const nameWords = trend.name.toLowerCase().split(/[\s&,/]+/).filter((w) => w.length > 2);
    for (const word of nameWords) {
      concepts.push({
        term: word,
        trendIds: [trend.id],
        strength: 0.8,
        chain: `${word} → ${trend.name}`,
        language: "both",
      });
    }

    // Every tag becomes a concept
    for (const tag of trend.tags) {
      if (tag.length > 2) {
        concepts.push({
          term: tag.toLowerCase(),
          trendIds: [trend.id],
          strength: 0.7,
          chain: `${tag} → ${trend.name}`,
          language: "both",
        });
      }
    }
  }

  // ─── 2. From regulations ───────────────────────────────────
  for (const reg of GLOBAL_REGULATIONS) {
    // Regulation names and keywords
    const words = [...reg.name.toLowerCase().split(/\s+/), ...reg.tags];
    const affectedIds = reg.impactedTrends.map((it) => it.trendId);
    for (const word of words) {
      if (word.length > 2) {
        concepts.push({
          term: word,
          trendIds: affectedIds,
          strength: 0.6,
          chain: `${word} → ${reg.shortName} (${reg.jurisdiction}) → betroffene Trends`,
          language: "both",
        });
      }
    }
    // Jurisdiction as concept
    concepts.push({
      term: reg.jurisdiction.toLowerCase(),
      trendIds: affectedIds,
      strength: 0.5,
      chain: `${reg.jurisdiction} → ${reg.shortName} → regulatorischer Kontext`,
      language: "both",
    });
  }

  // ─── 3. From causal edges ──────────────────────────────────
  for (const edge of TREND_EDGES) {
    concepts.push({
      term: edge.from.replace(/^(mega|macro)-/, "").replace(/-/g, " "),
      trendIds: [edge.from, edge.to],
      strength: edge.strength * 0.5,
      chain: `${edge.from} ${edge.type} ${edge.to}`,
      language: "both",
    });
  }

  // ─── 4. Massive German-English concept pairs ───────────────
  const bilingualMap: [string, string, string[], number][] = [
    // [german, english, related trend tags, strength]
    // Economy & Finance
    ["benzinpreise", "fuel prices", ["energy", "climate", "geopolitics", "mobility", "social"], 0.8],
    ["ölpreis", "oil price", ["energy", "geopolitics", "climate"], 0.85],
    ["gaspreis", "gas price", ["energy", "geopolitics"], 0.8],
    ["strompreis", "electricity price", ["energy", "renewable", "climate"], 0.8],
    ["inflation", "inflation", ["economic", "social", "inequality"], 0.85],
    ["zinsen", "interest rates", ["economic", "social"], 0.8],
    ["rezession", "recession", ["economic", "social", "geopolitics"], 0.8],
    ["börse", "stock market", ["economic", "technology"], 0.7],
    ["aktien", "stocks", ["economic"], 0.6],
    ["immobilien", "real estate", ["economic", "social", "urbanization"], 0.7],
    ["miete", "rent", ["social", "urbanization"], 0.7],
    ["schulden", "debt", ["economic", "social"], 0.7],
    ["steuern", "taxes", ["economic", "social"], 0.6],
    ["handel", "trade", ["geopolitics", "economic"], 0.7],
    ["lieferkette", "supply chain", ["geopolitics", "technology", "sustainability"], 0.8],
    ["rohstoffe", "raw materials", ["energy", "geopolitics", "sustainability"], 0.8],
    ["lithium", "lithium", ["energy", "mobility", "geopolitics"], 0.8],
    ["seltene erden", "rare earth", ["geopolitics", "technology", "energy"], 0.85],
    ["währung", "currency", ["economic", "geopolitics"], 0.6],
    ["kryptowährung", "cryptocurrency", ["blockchain", "web3", "economic"], 0.8],

    // Work & Society
    ["arbeit", "work", ["work", "automation", "ai", "demographics"], 0.8],
    ["arbeitsplätze", "jobs", ["work", "ai", "automation", "demographics"], 0.85],
    ["fachkräftemangel", "skills shortage", ["work", "demographics", "education", "migration"], 0.9],
    ["gehalt", "salary", ["work", "economic", "social"], 0.6],
    ["homeoffice", "home office", ["work", "remote", "digital"], 0.8],
    ["büro", "office", ["work", "remote", "urbanization"], 0.6],
    ["rente", "pension", ["demographics", "social", "economic"], 0.8],
    ["alter", "aging", ["demographics", "health"], 0.8],
    ["jugend", "youth", ["demographics", "education", "social"], 0.7],
    ["bildung", "education", ["education", "knowledge", "skills", "ai"], 0.85],
    ["universität", "university", ["education", "knowledge"], 0.7],
    ["schule", "school", ["education", "knowledge"], 0.7],
    ["ungleichheit", "inequality", ["social", "economic"], 0.8],
    ["armut", "poverty", ["social", "economic", "demographics"], 0.8],
    ["migration", "migration", ["demographics", "social", "geopolitics"], 0.85],
    ["flüchtlinge", "refugees", ["demographics", "social", "geopolitics", "conflict"], 0.85],
    ["integration", "integration", ["social", "demographics"], 0.6],
    ["diversität", "diversity", ["social", "identity"], 0.7],
    ["gleichberechtigung", "equality", ["social", "identity"], 0.7],
    ["gesundheit", "health", ["health", "biotech", "demographics"], 0.85],
    ["krankenhaus", "hospital", ["health", "digital-health"], 0.7],
    ["medikamente", "medicine", ["health", "biotech"], 0.7],
    ["pflege", "care", ["health", "demographics"], 0.8],
    ["psychische gesundheit", "mental health", ["health", "social", "work"], 0.8],
    ["ernährung", "nutrition", ["health", "sustainability", "climate"], 0.7],
    ["wohnen", "housing", ["social", "urbanization", "economic"], 0.7],

    // Technology
    ["künstliche intelligenz", "artificial intelligence", ["ai", "automation", "technology"], 0.95],
    ["ki", "ai", ["ai", "automation", "technology"], 0.95],
    ["roboter", "robot", ["robotics", "automation", "ai"], 0.85],
    ["automatisierung", "automation", ["automation", "ai", "work"], 0.85],
    ["digitalisierung", "digitalization", ["digital", "technology", "connectivity"], 0.9],
    ["software", "software", ["technology", "ai", "cloud"], 0.7],
    ["hardware", "hardware", ["technology", "semiconductor"], 0.7],
    ["halbleiter", "semiconductor", ["technology", "geopolitics", "ai"], 0.85],
    ["chip", "chip", ["technology", "geopolitics", "ai", "semiconductor"], 0.85],
    ["smartphone", "smartphone", ["technology", "connectivity", "platform"], 0.7],
    ["internet", "internet", ["connectivity", "digital", "platform", "data"], 0.8],
    ["cloud", "cloud", ["cloud", "infrastructure", "technology"], 0.8],
    ["daten", "data", ["data", "privacy", "ai", "cloud"], 0.8],
    ["datenschutz", "data protection", ["data", "privacy", "security", "regulation"], 0.85],
    ["privatsphäre", "privacy", ["privacy", "security", "data", "regulation"], 0.85],
    ["hacker", "hacker", ["cyber", "security"], 0.8],
    ["virus", "virus", ["cyber", "security", "health"], 0.6],
    ["passwort", "password", ["security", "digital"], 0.6],
    ["verschlüsselung", "encryption", ["security", "privacy", "quantum"], 0.8],
    ["algorithmus", "algorithm", ["ai", "technology", "data"], 0.7],
    ["programmieren", "programming", ["technology"], 0.6],
    ["app", "app", ["technology", "platform", "digital"], 0.6],
    ["social media", "social media", ["platform", "connectivity", "attention"], 0.75],
    ["fake news", "fake news", ["security", "social", "platform"], 0.7],
    ["desinformation", "disinformation", ["security", "social", "geopolitics"], 0.75],

    // Environment & Climate
    ["klima", "climate", ["climate", "sustainability", "energy"], 0.9],
    ["klimawandel", "climate change", ["climate", "sustainability", "energy"], 0.95],
    ["erderwärmung", "global warming", ["climate", "sustainability"], 0.9],
    ["co2", "co2", ["climate", "sustainability", "energy"], 0.85],
    ["emissionen", "emissions", ["climate", "energy", "sustainability"], 0.85],
    ["erneuerbare energie", "renewable energy", ["renewable", "energy", "climate"], 0.9],
    ["solar", "solar", ["renewable", "energy"], 0.8],
    ["wind", "wind energy", ["renewable", "energy"], 0.75],
    ["wasserstoff", "hydrogen", ["energy", "renewable", "mobility"], 0.8],
    ["atomkraft", "nuclear", ["energy", "security"], 0.75],
    ["kohle", "coal", ["energy", "climate"], 0.7],
    ["nachhaltigkeit", "sustainability", ["sustainability", "climate", "circular"], 0.9],
    ["recycling", "recycling", ["circular", "sustainability"], 0.8],
    ["plastik", "plastic", ["sustainability", "circular", "climate"], 0.7],
    ["biodiversität", "biodiversity", ["climate", "sustainability"], 0.75],
    ["wald", "forest", ["climate", "sustainability"], 0.6],
    ["wasser", "water", ["climate", "sustainability", "geopolitics"], 0.8],
    ["dürre", "drought", ["climate", "sustainability"], 0.75],
    ["überschwemmung", "flood", ["climate", "sustainability"], 0.75],
    ["naturkatastrophe", "natural disaster", ["climate", "security"], 0.8],

    // Geopolitics & Security
    ["krieg", "war", ["geopolitics", "conflict", "security", "energy"], 0.9],
    ["frieden", "peace", ["geopolitics", "social"], 0.6],
    ["nato", "nato", ["geopolitics", "security", "conflict"], 0.85],
    ["sanktionen", "sanctions", ["geopolitics", "economic"], 0.8],
    ["terrorismus", "terrorism", ["security", "geopolitics"], 0.8],
    ["überwachung", "surveillance", ["security", "privacy", "data"], 0.8],
    ["militär", "military", ["security", "geopolitics", "conflict"], 0.85],
    ["atomwaffen", "nuclear weapons", ["security", "geopolitics"], 0.8],
    ["spionage", "espionage", ["security", "cyber", "geopolitics"], 0.8],
    ["demokratie", "democracy", ["geopolitics", "social"], 0.7],
    ["populismus", "populism", ["social", "geopolitics"], 0.75],
    ["wahl", "election", ["geopolitics", "social"], 0.7],

    // Mobility & Transport
    ["auto", "car", ["mobility", "energy", "ai", "sustainability"], 0.75],
    ["elektroauto", "electric car", ["mobility", "energy", "sustainability"], 0.85],
    ["bahn", "train", ["mobility", "infrastructure", "sustainability"], 0.7],
    ["flugzeug", "airplane", ["mobility", "energy", "climate"], 0.7],
    ["verkehr", "traffic", ["mobility", "urbanization", "sustainability"], 0.75],
    ["autonomes fahren", "autonomous driving", ["mobility", "ai", "autonomous"], 0.9],
    ["fahrrad", "bicycle", ["mobility", "sustainability", "urbanization"], 0.6],
    ["logistik", "logistics", ["mobility", "technology", "geopolitics"], 0.7],

    // Specific companies/entities as context
    ["tsmc", "tsmc", ["technology", "geopolitics", "semiconductor"], 0.9],
    ["nvidia", "nvidia", ["ai", "technology", "semiconductor"], 0.9],
    ["openai", "openai", ["ai", "generative", "technology"], 0.9],
    ["google", "google", ["ai", "technology", "platform", "cloud"], 0.8],
    ["microsoft", "microsoft", ["ai", "technology", "cloud"], 0.8],
    ["apple", "apple", ["technology", "platform", "spatial"], 0.75],
    ["tesla", "tesla", ["mobility", "energy", "autonomous", "ai"], 0.85],
    ["amazon", "amazon", ["platform", "cloud", "commerce", "ai"], 0.8],
    ["meta", "meta", ["platform", "spatial", "xr", "ai"], 0.75],
    ["samsung", "samsung", ["technology", "semiconductor"], 0.7],
    ["siemens", "siemens", ["technology", "automation", "infrastructure"], 0.7],
    ["volkswagen", "volkswagen", ["mobility", "energy", "automation"], 0.75],
    ["bmw", "bmw", ["mobility", "autonomous", "energy"], 0.7],
    ["bayer", "bayer", ["health", "biotech"], 0.7],
    ["basf", "basf", ["sustainability", "energy", "economic"], 0.65],

    // Countries/Regions
    ["china", "china", ["geopolitics", "ai", "technology", "economic", "trade"], 0.85],
    ["usa", "usa", ["geopolitics", "ai", "technology", "economic"], 0.8],
    ["amerika", "america", ["geopolitics", "technology", "economic"], 0.8],
    ["russland", "russia", ["geopolitics", "energy", "conflict", "security"], 0.85],
    ["europa", "europe", ["regulation", "climate", "digital", "geopolitics"], 0.8],
    ["deutschland", "germany", ["economic", "energy", "technology", "work"], 0.75],
    ["japan", "japan", ["technology", "demographics", "robotics"], 0.7],
    ["indien", "india", ["demographics", "technology", "economic"], 0.75],
    ["taiwan", "taiwan", ["geopolitics", "semiconductor", "technology", "conflict"], 0.9],
    ["afrika", "africa", ["demographics", "climate", "energy", "economic"], 0.75],
    ["naher osten", "middle east", ["energy", "geopolitics", "conflict"], 0.8],
    ["ukraine", "ukraine", ["geopolitics", "conflict", "energy", "security"], 0.9],
    ["nordkorea", "north korea", ["geopolitics", "security", "conflict"], 0.8],
    ["iran", "iran", ["geopolitics", "energy", "security", "conflict"], 0.8],
    ["brasilien", "brazil", ["climate", "sustainability", "economic"], 0.65],
    ["singapur", "singapore", ["technology", "economic"], 0.6],
  ];

  for (const [de, en, relatedTags, strength] of bilingualMap) {
    // Find trends that match any of the related tags
    const matchingTrendIds = trends
      .filter((t) =>
        t.tags.some((tag) => relatedTags.some((rt) => tag.toLowerCase().includes(rt))) ||
        relatedTags.some((rt) => t.name.toLowerCase().includes(rt))
      )
      .map((t) => t.id);

    if (matchingTrendIds.length > 0) {
      // German entry
      concepts.push({
        term: de,
        trendIds: matchingTrendIds.slice(0, 8),
        strength,
        chain: `${de.charAt(0).toUpperCase() + de.slice(1)} → ${relatedTags.slice(0, 3).join(", ")}`,
        language: "de",
      });
      // English entry
      concepts.push({
        term: en,
        trendIds: matchingTrendIds.slice(0, 8),
        strength,
        chain: `${en.charAt(0).toUpperCase() + en.slice(1)} → ${relatedTags.slice(0, 3).join(", ")}`,
        language: "en",
      });
    }
  }

  // Deduplicate by term — merge trendIds so associations are never lost
  const deduped = new Map<string, ConceptEntry>();
  for (const c of concepts) {
    const existing = deduped.get(c.term);
    if (!existing) {
      deduped.set(c.term, c);
    } else {
      // Merge trendIds from the losing concept into the winning one
      const mergedIds = [...new Set([...existing.trendIds, ...c.trendIds])];
      if (c.strength > existing.strength) {
        deduped.set(c.term, { ...c, trendIds: mergedIds });
      } else {
        existing.trendIds = mergedIds;
      }
    }
  }

  let entries = Array.from(deduped.values());

  // Simple LRU approximation: if cache exceeds the limit, drop the oldest
  // half (entries are insertion-ordered, so the first half is oldest).
  if (entries.length > CACHE_MAX_ENTRIES) {
    const keepFrom = Math.floor(entries.length / 2);
    entries = entries.slice(keepFrom);
  }

  _conceptCache = entries;
  console.log(`Semantic engine: ${_conceptCache.length} concepts indexed`);
  return _conceptCache;
}

/**
 * Find matching concepts for a query.
 * Uses substring matching, word splitting, and fuzzy proximity.
 */
export function findConcepts(query: string, trends: TrendDot[]): {
  trendIds: Set<string>;
  chains: string[];
  totalStrength: number;
} {
  const vocabulary = getConceptVocabulary(trends);
  const q = query.toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter((w) => w.length > 1);

  const trendIds = new Set<string>();
  const chains: string[] = [];
  let totalStrength = 0;

  // ALG-24: Safe substring matching that prevents false positives.
  // Short terms (length <= 2) require exact word boundary match to avoid
  // "ki" matching inside "skiing". Longer terms require the match to cover
  // at least 40% of the host word's length.
  function isValidMatch(host: string, term: string): boolean {
    if (term.length <= 2) {
      // Require exact word boundary match for very short terms
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return re.test(host);
    }
    // For longer terms used with includes(), check that the term covers a
    // meaningful portion of the host word to prevent e.g. "ion" matching
    // inside "migration" when "ion" is the concept term.
    if (host.includes(term)) {
      return term.length >= host.length * 0.4;
    }
    return false;
  }

  // Match each query word against vocabulary
  for (const word of queryWords) {
    for (const concept of vocabulary) {
      // Exact match or validated substring match
      const matched =
        concept.term === word ||
        isValidMatch(word, concept.term) ||
        isValidMatch(concept.term, word);
      if (matched) {
        for (const id of concept.trendIds) trendIds.add(id);
        if (concept.chain.includes("→")) chains.push(concept.chain);
        totalStrength += concept.strength;
      }
    }
  }

  // Also try the full query as one phrase
  for (const concept of vocabulary) {
    const phraseMatched =
      isValidMatch(q, concept.term) ||
      isValidMatch(concept.term, q);
    if (phraseMatched) {
      for (const id of concept.trendIds) trendIds.add(id);
      if (concept.chain.includes("→") && !chains.includes(concept.chain)) {
        chains.push(concept.chain);
      }
      totalStrength += concept.strength;
    }
  }

  return {
    trendIds,
    chains: [...new Set(chains)].slice(0, 7),
    totalStrength,
  };
}
