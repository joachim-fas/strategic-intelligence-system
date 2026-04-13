import { TrendDot, DURATION_CONFIG, DIRECTION_CONFIG, FOCUS_CONFIG } from "@/types";
import { findConcepts } from "./semantic-engine";
import { getEdgesForTrend, getDrivers, getEffects, calculateCascadeDepth } from "./causal-graph";
import { getRegulationsForTrend, getRegulatoryPressure } from "./regulations";
import { getTrendSources } from "./trend-sources";
import { autoClassify } from "./classify";
import { Locale } from "./i18n";

/**
 * Intelligence Engine
 *
 * Takes a user query (question, keyword, or topic) and synthesizes
 * a structured intelligence briefing from ALL available data layers:
 * - Trend data (scores, classification, velocity)
 * - Causal graph (connections, cascade effects)
 * - Regulations (legal landscape)
 * - Sources (who says what)
 * - Signals (live data from connectors)
 */

export interface IntelligenceBriefing {
  query: string;
  matchedTrends: TrendMatch[];
  synthesis: string;
  reasoningChains: string[]; // How the query connects to trends
  keyInsights: string[];
  regulatoryContext: string[];
  causalChain: string[];
  signalSummary: string;
  confidence: number;
  dataPoints: number;
  // Tag cloud for disambiguation when query is ambiguous
  suggestedTags?: string[];
  // Extended LLM fields
  scenarios?: {
    type?: "optimistic" | "baseline" | "pessimistic" | "wildcard";
    name: string;
    description: string;
    probability: number;
    timeframe?: string;
    keyDrivers?: string[];
  }[];
  interpretation?: string;
  references?: { title: string; url: string; relevance?: string }[];
  followUpQuestions?: string[];
  newsContext?: string;
  decisionFramework?: string;
  usedSignals?: { source: string; title: string; url: string | null; strength: number | null; date: string }[];
  balancedScorecard?: {
    perspectives: Array<{
      id: string;
      label: string;
      score: number;
      trend: "rising" | "stable" | "declining" | "uncertain";
      summary: string;
      keyFactors: string[];
      connectedTrendIds: string[];
      impacts: Record<string, number>;
    }>;
    overallReadiness: number;
    criticalTension?: string;
  };
}

interface TrendMatch {
  trend: TrendDot;
  relevanceToQuery: number; // how well this trend matches the query
  matchReason: string;
}

/**
 * Extract synthesis text progressively from accumulated streaming JSON.
 * Returns the new characters added since last call (delta only).
 */
function extractSynthesisDelta(accumulated: string, prevLength: number): string {
  const marker = '"synthesis": "';
  const start = accumulated.indexOf(marker);
  if (start === -1) return "";

  const contentStart = start + marker.length;
  const raw = accumulated.slice(contentStart);

  // Walk through chars, handle JSON escapes, stop at unescaped closing quote
  let text = "";
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === "\\") {
      if (i + 1 < raw.length) {
        const next = raw[i + 1];
        if (next === '"') text += '"';
        else if (next === "n") text += "\n";
        else if (next === "t") text += "\t";
        else if (next === "\\") text += "\\";
        else text += next;
        i += 2;
      } else {
        break; // incomplete escape at end of buffer
      }
    } else if (c === '"') {
      break; // end of synthesis value
    } else {
      text += c;
      i++;
    }
  }

  if (text.length > prevLength) {
    return text.slice(prevLength);
  }
  return "";
}

/**
 * Query via LLM API with SSE streaming.
 * onSynthesisChunk is called progressively as synthesis text arrives (~2s after submit).
 * Returns the full structured briefing when the stream completes.
 */
export async function queryIntelligenceAsync(
  query: string,
  allTrends: TrendDot[],
  locale: Locale,
  contextProfile?: { role: string; industry: string; region: string },
  onSynthesisChunk?: (chunk: string) => void,
  previousContext?: { query: string; synthesis: string },
): Promise<IntelligenceBriefing | null> {
  try {
    const res = await fetch("/api/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, locale, contextProfile, previousContext }),
    });

    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = "";
    let fullRawText = "";    // accumulated LLM text for synthesis extraction
    let synthExtractedLen = 0; // chars of synthesis already emitted
    let llmResult: any = null;

    const processLine = (line: string) => {
      if (!line.startsWith("data: ")) return;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) return;
      try {
        const event = JSON.parse(jsonStr);
        if (event.type === "delta" && event.text) {
          fullRawText += event.text;
          if (onSynthesisChunk) {
            const delta = extractSynthesisDelta(fullRawText, synthExtractedLen);
            if (delta) {
              synthExtractedLen += delta.length;
              onSynthesisChunk(delta);
            }
          }
        } else if (event.type === "complete" && event.result) {
          llmResult = event.result;
        }
      } catch {
        // ignore parse errors on individual SSE lines
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    }

    // Process any remaining buffered content (last line without trailing \n)
    if (lineBuffer.trim()) processLine(lineBuffer.trim());

    if (!llmResult) return null;

    // Map LLM response to IntelligenceBriefing
    const trendMap = new Map(allTrends.map((t) => [t.id, t]));
    const matchedTrends: TrendMatch[] = (llmResult.matchedTrendIds || [])
      .map((id: string) => trendMap.get(id))
      .filter(Boolean)
      .map((trend: TrendDot) => ({
        trend,
        relevanceToQuery: trend.relevance,
        matchReason: "LLM analysis",
      }));

    const totalSignals = matchedTrends.reduce((sum: number, m: TrendMatch) => sum + m.trend.signalCount, 0);

    return {
      query,
      matchedTrends,
      synthesis: llmResult.synthesis || "",
      reasoningChains: llmResult.reasoningChains || [],
      keyInsights: llmResult.keyInsights || [],
      regulatoryContext: llmResult.regulatoryContext || [],
      causalChain: llmResult.causalAnalysis || [],
      scenarios: llmResult.scenarios,
      interpretation: llmResult.interpretation,
      references: llmResult.references,
      followUpQuestions: llmResult.followUpQuestions,
      newsContext: llmResult.newsContext,
      decisionFramework: llmResult.decisionFramework,
      usedSignals: llmResult.usedSignals,
      balancedScorecard: llmResult.balancedScorecard,
      signalSummary: `${totalSignals} signals across ${matchedTrends.length} trends`,
      confidence: llmResult.confidence ?? 0.5,
      dataPoints: totalSignals,
    };
  } catch {
    return null;
  }
}

/**
 * Process a user query against all data layers (synchronous fallback)
 */
export function queryIntelligence(
  query: string,
  allTrends: TrendDot[],
  locale: Locale
): IntelligenceBriefing {
  const q = query.toLowerCase().trim();

  // Step 1: Find matching trends
  const matchedTrends = findMatchingTrends(q, allTrends);

  // Step 2: Build synthesis
  const synthesis = buildSynthesis(q, matchedTrends, locale);

  // Step 2b: Extract reasoning chains from matches
  const reasoningChains = [...new Set(
    matchedTrends.flatMap((m) => {
      // Extract chains from matchReason
      if (m.matchReason.includes("→")) return [m.matchReason];
      return [];
    })
  )].slice(0, 5);

  // Step 3: Extract key insights
  const keyInsights = extractInsights(matchedTrends, locale);

  // Step 4: Regulatory context
  const regulatoryContext = extractRegulatoryContext(matchedTrends, locale);

  // Step 5: Causal chains
  const causalChain = extractCausalChains(matchedTrends, locale);

  // Step 6: Signal summary
  const signalSummary = buildSignalSummary(matchedTrends, locale);

  // Step 7: Confidence based on data coverage
  // FIX: Use logarithmic scale so confidence reaches ~0.95 only with 50+ trends,
  // not saturating at 7. Formula: 1 - 1/(1 + k*sqrt(signals)), blended with
  // log-scaled trend count and source count.
  const totalSignals = matchedTrends.reduce((sum, m) => sum + m.trend.signalCount, 0);
  const totalSources = new Set(matchedTrends.flatMap((m) => m.trend.topSources)).size;
  const trendComponent  = Math.log2(1 + matchedTrends.length) / Math.log2(1 + 50) * 0.4;  // ~0.4 at 50 trends
  const sourceComponent = Math.log2(1 + totalSources)         / Math.log2(1 + 30) * 0.25; // ~0.25 at 30 sources
  const signalComponent = (1 - 1 / (1 + 0.005 * Math.sqrt(totalSignals)))          * 0.3;  // ~0.3 at ~500 signals
  const confidence = Math.min(0.98, trendComponent + sourceComponent + signalComponent);

  // Step 8: Generate tag cloud for disambiguation
  const suggestedTags = generateTagCloud(q, matchedTrends, allTrends, locale);

  return {
    query,
    matchedTrends,
    synthesis,
    reasoningChains,
    keyInsights,
    regulatoryContext,
    causalChain,
    signalSummary,
    confidence,
    dataPoints: totalSignals,
    suggestedTags,
  };
}

/**
 * Generate a tag cloud of related concepts for disambiguation.
 * Shows when the query is ambiguous or has few matches.
 */
function generateTagCloud(query: string, matches: TrendMatch[], allTrends: TrendDot[], locale: Locale): string[] {
  // Always generate tags — they help orient the user
  const tags = new Set<string>();

  // From matched trends: extract key tags
  for (const m of matches.slice(0, 5)) {
    for (const tag of m.trend.tags) {
      if (tag.length > 2 && tag !== "mega-trend" && tag !== "makro-trend" &&
          !["PwC", "EY", "TRENDONE", "Roland Berger", "Zukunftsinstitut", "EU ESPAS", "World Monitor"].includes(tag)) {
        tags.add(tag);
      }
    }
    // Add category
    tags.add(m.trend.category);
  }

  // If few matches, suggest broader concepts
  if (matches.length < 3) {
    const allCategories = [...new Set(allTrends.map((t) => t.category))];
    for (const cat of allCategories.slice(0, 5)) {
      tags.add(cat);
    }
    // Add some common entry points
    const common = locale === "de"
      ? ["AI", "Klima", "Geopolitik", "Cybersecurity", "Energie", "Arbeit", "Gesundheit", "Mobilität"]
      : ["AI", "Climate", "Geopolitics", "Cybersecurity", "Energy", "Work", "Health", "Mobility"];
    for (const c of common) tags.add(c);
  }

  return [...tags].slice(0, 15);
}

/**
 * Semantic Association Map
 * Maps ANY real-world concept to the trends it relates to.
 * This is the "thinking" layer — it connects "benzinpreise" to
 * Energy Transition, Geopolitics, Mobility, Climate, Social Stability.
 *
 * Structure: keyword → [{ trendTag, strength, reasoning }]
 *
 * TODO: PERF-11 — Module-level caches grow unbounded in long-running servers.
 * Add LRU eviction (max 500 entries) or TTL-based cleanup.
 * Note: SEMANTIC_MAP is static and safe, but any runtime caches (e.g. in semantic-engine)
 * must be bounded. See semantic-engine.ts for existing LRU pattern.
 *
 * TODO: CONSOLIDATE — overlapping with findConcepts (semantic-engine),
 * keywordMap, and contextMap in findMatchingTrends. All four systems do
 * variants of query-to-tag matching; should be unified into a single
 * scoring pipeline to avoid triple-counting and maintenance burden.
 */
const SEMANTIC_MAP: Record<string, { tag: string; strength: number; chain: string }[]> = {
  // Energy & Fuel
  benzinpreise: [
    { tag: "energy", strength: 0.9, chain: "Benzinpreise → Energiemarkt → Energy Transition" },
    { tag: "climate", strength: 0.7, chain: "Benzinpreise → fossile Brennstoffe → Klimawandel" },
    { tag: "geopolitics", strength: 0.8, chain: "Benzinpreise → Ölmarkt → OPEC → Geopolitik" },
    { tag: "mobility", strength: 0.7, chain: "Benzinpreise → Autokosten → E-Mobilität als Alternative" },
    { tag: "social", strength: 0.6, chain: "Benzinpreise → Lebenshaltungskosten → Soziale Stabilität" },
    { tag: "renewable", strength: 0.7, chain: "Benzinpreise hoch → Renewables attraktiver" },
  ],
  benzin: [
    { tag: "energy", strength: 0.9, chain: "Benzin → Energiemarkt" },
    { tag: "climate", strength: 0.7, chain: "Benzin → CO2 → Klima" },
    { tag: "mobility", strength: 0.7, chain: "Benzin → Mobilität → EV" },
  ],
  oil: [
    { tag: "energy", strength: 0.95, chain: "Oil → Energy markets → Transition" },
    { tag: "geopolitics", strength: 0.85, chain: "Oil → OPEC → Geopolitical power" },
    { tag: "climate", strength: 0.7, chain: "Oil → Fossil fuels → Climate change" },
  ],
  öl: [
    { tag: "energy", strength: 0.95, chain: "Öl → Energiemärkte → Transition" },
    { tag: "geopolitics", strength: 0.85, chain: "Öl → OPEC → Geopolitik" },
    { tag: "climate", strength: 0.7, chain: "Öl → Fossile Brennstoffe → Klimawandel" },
  ],
  gas: [
    { tag: "energy", strength: 0.9, chain: "Gas → Energy → Transition" },
    { tag: "geopolitics", strength: 0.8, chain: "Gas → Russia/Middle East → Geopolitics" },
    { tag: "climate", strength: 0.6, chain: "Gas → Bridge fuel → Climate" },
  ],

  // Geopolitical events
  krieg: [
    { tag: "geopolitics", strength: 0.95, chain: "Krieg → Geopolitische Fragmentierung" },
    { tag: "security", strength: 0.9, chain: "Krieg → Sicherheitsbedrohung" },
    { tag: "energy", strength: 0.7, chain: "Krieg → Energieversorgung gefährdet" },
    { tag: "social", strength: 0.7, chain: "Krieg → Flucht → Soziale Instabilität" },
    { tag: "cyber", strength: 0.6, chain: "Krieg → Cyberwarfare" },
  ],
  war: [
    { tag: "geopolitics", strength: 0.95, chain: "War → Geopolitical fragmentation" },
    { tag: "security", strength: 0.9, chain: "War → Security threats" },
    { tag: "energy", strength: 0.7, chain: "War → Energy supply disruption" },
    { tag: "cyber", strength: 0.6, chain: "War → Cyber warfare" },
  ],
  migration: [
    { tag: "demographics", strength: 0.9, chain: "Migration → Demographic shifts" },
    { tag: "social", strength: 0.8, chain: "Migration → Social tension" },
    { tag: "geopolitics", strength: 0.6, chain: "Migration → Border politics" },
    { tag: "work", strength: 0.5, chain: "Migration → Labor market" },
  ],
  flüchtlinge: [
    { tag: "demographics", strength: 0.9, chain: "Flüchtlinge → Demografie" },
    { tag: "social", strength: 0.85, chain: "Flüchtlinge → Gesellschaftliche Spannung" },
    { tag: "geopolitics", strength: 0.7, chain: "Flüchtlinge → Geopolitische Ursachen" },
  ],

  // Economic
  inflation: [
    { tag: "economic", strength: 0.95, chain: "Inflation → Economic instability" },
    { tag: "social", strength: 0.8, chain: "Inflation → Purchasing power → Social unrest" },
    { tag: "geopolitics", strength: 0.5, chain: "Inflation → Central bank policy → Global coordination" },
    { tag: "energy", strength: 0.6, chain: "Inflation → Energy prices as driver" },
  ],
  zinsen: [
    { tag: "economic", strength: 0.9, chain: "Zinsen → Geldpolitik → Wirtschaft" },
    { tag: "social", strength: 0.5, chain: "Zinsen → Immobilien → Lebenshaltung" },
  ],
  immobilien: [
    { tag: "economic", strength: 0.8, chain: "Immobilien → Wirtschaft" },
    { tag: "social", strength: 0.7, chain: "Immobilien → Wohnen → Soziale Frage" },
    { tag: "urbanization", strength: 0.6, chain: "Immobilien → Urbanisierung" },
  ],
  lieferkette: [
    { tag: "geopolitics", strength: 0.8, chain: "Lieferkette → Globalisierung → Fragmentierung" },
    { tag: "technology", strength: 0.6, chain: "Lieferkette → Digitalisierung → Resilienz" },
    { tag: "sustainability", strength: 0.5, chain: "Lieferkette → Transparenz → ESG" },
  ],
  "supply chain": [
    { tag: "geopolitics", strength: 0.8, chain: "Supply chain → Globalization → Fragmentation" },
    { tag: "technology", strength: 0.6, chain: "Supply chain → Digitalization" },
  ],

  // Technology-adjacent
  chip: [
    { tag: "technology", strength: 0.9, chain: "Chip → Semiconductor → Tech disruption" },
    { tag: "geopolitics", strength: 0.85, chain: "Chip → TSMC/Taiwan → Geopolitics" },
    { tag: "ai", strength: 0.7, chain: "Chip → GPU → AI infrastructure" },
  ],
  halbleiter: [
    { tag: "technology", strength: 0.9, chain: "Halbleiter → Technologie" },
    { tag: "geopolitics", strength: 0.85, chain: "Halbleiter → Taiwan → Geopolitik" },
    { tag: "ai", strength: 0.7, chain: "Halbleiter → GPU → AI" },
  ],
  smartphone: [
    { tag: "technology", strength: 0.8, chain: "Smartphone → Tech platforms" },
    { tag: "connectivity", strength: 0.7, chain: "Smartphone → Digital connectivity" },
    { tag: "platform", strength: 0.6, chain: "Smartphone → App economy → Platforms" },
  ],
  internet: [
    { tag: "connectivity", strength: 0.95, chain: "Internet → Digital connectivity" },
    { tag: "platform", strength: 0.7, chain: "Internet → Platform economy" },
    { tag: "security", strength: 0.6, chain: "Internet → Cyber threats" },
    { tag: "data", strength: 0.7, chain: "Internet → Data economy" },
  ],
  auto: [
    { tag: "mobility", strength: 0.9, chain: "Auto → Mobilität" },
    { tag: "energy", strength: 0.7, chain: "Auto → Antrieb → Energiewende" },
    { tag: "ai", strength: 0.5, chain: "Auto → Autonomes Fahren → AI" },
    { tag: "sustainability", strength: 0.6, chain: "Auto → Emissionen → Nachhaltigkeit" },
  ],
  elektroauto: [
    { tag: "mobility", strength: 0.95, chain: "E-Auto → Mobilität → EV" },
    { tag: "energy", strength: 0.85, chain: "E-Auto → Batterie → Energiewende" },
    { tag: "sustainability", strength: 0.8, chain: "E-Auto → Emissionsreduktion" },
  ],

  // Social
  rente: [
    { tag: "demographics", strength: 0.9, chain: "Rente → Demografie → Alterung" },
    { tag: "social", strength: 0.8, chain: "Rente → Soziale Sicherung" },
    { tag: "work", strength: 0.6, chain: "Rente → Arbeitsmarkt → Fachkräfte" },
  ],
  bildung: [
    { tag: "education", strength: 0.95, chain: "Bildung → Wissenskultur" },
    { tag: "work", strength: 0.7, chain: "Bildung → Qualifizierung → Future of Work" },
    { tag: "ai", strength: 0.5, chain: "Bildung → EdTech → AI in Education" },
  ],
  gesundheit: [
    { tag: "health", strength: 0.95, chain: "Gesundheit → Health Tech" },
    { tag: "demographics", strength: 0.6, chain: "Gesundheit → Alterung → Demografie" },
    { tag: "ai", strength: 0.5, chain: "Gesundheit → Diagnostik → AI" },
  ],
  wasser: [
    { tag: "climate", strength: 0.85, chain: "Wasser → Ressourcenknappheit → Klima" },
    { tag: "sustainability", strength: 0.8, chain: "Wasser → Nachhaltigkeit" },
    { tag: "geopolitics", strength: 0.5, chain: "Wasser → Ressourcenkonflikte" },
  ],
  nahrung: [
    { tag: "climate", strength: 0.7, chain: "Nahrung → Landwirtschaft → Klima" },
    { tag: "sustainability", strength: 0.75, chain: "Nahrung → Ernährungssystem → Nachhaltigkeit" },
    { tag: "demographics", strength: 0.5, chain: "Nahrung → Bevölkerungswachstum" },
  ],
  food: [
    { tag: "climate", strength: 0.7, chain: "Food → Agriculture → Climate" },
    { tag: "sustainability", strength: 0.75, chain: "Food → Food systems → Sustainability" },
  ],
  datenschutz: [
    { tag: "data", strength: 0.9, chain: "Datenschutz → Data Economy" },
    { tag: "security", strength: 0.8, chain: "Datenschutz → Digital Trust" },
    { tag: "regulation", strength: 0.85, chain: "Datenschutz → GDPR → Regulierung" },
  ],
  privacy: [
    { tag: "data", strength: 0.9, chain: "Privacy → Data sovereignty" },
    { tag: "security", strength: 0.8, chain: "Privacy → Digital trust" },
    { tag: "regulation", strength: 0.85, chain: "Privacy → GDPR" },
  ],
  ki: [
    { tag: "ai", strength: 1.0, chain: "KI = Künstliche Intelligenz" },
    { tag: "automation", strength: 0.8, chain: "KI → Automatisierung" },
    { tag: "work", strength: 0.6, chain: "KI → Arbeitsplätze → Future of Work" },
  ],
  arbeitsplätze: [
    { tag: "work", strength: 0.9, chain: "Arbeitsplätze → Future of Work" },
    { tag: "ai", strength: 0.7, chain: "Arbeitsplätze → Automatisierung → AI" },
    { tag: "demographics", strength: 0.6, chain: "Arbeitsplätze → Fachkräftemangel → Demografie" },
  ],
  jobs: [
    { tag: "work", strength: 0.9, chain: "Jobs → Future of Work" },
    { tag: "ai", strength: 0.7, chain: "Jobs → Automation → AI" },
  ],
};

function findMatchingTrends(query: string, trends: TrendDot[]): TrendMatch[] {
  const matches: TrendMatch[] = [];

  // FIRST: Use semantic engine for broad concept matching
  // TODO: CONSOLIDATE — overlapping with SEMANTIC_MAP, keywordMap, and contextMap below
  const semanticResult = findConcepts(query, trends);
  const semanticTrendIds = semanticResult.trendIds;
  const semanticChains = semanticResult.chains;

  for (const trend of trends) {
    let score = 0;
    let reason = "";
    const reasoningChains: string[] = [];
    // FIX: Track which match sources already contributed to prevent
    // triple-counting the same trend (e.g., once via semantic engine,
    // once via tag match, once via SEMANTIC_MAP for the same concept).
    const matchedSources = new Set<string>();

    // Semantic engine match (strongest for unknown/novel queries)
    if (semanticTrendIds.has(trend.id)) {
      score += 0.7;
      reason = "semantic match";
      matchedSources.add("semantic-engine");
      reasoningChains.push(...semanticChains.filter((c) => c.length < 100).slice(0, 2));
    }

    // Direct name match (strongest)
    if (trend.name.toLowerCase().includes(query)) {
      score += 1.0;
      reason = "name match";
      matchedSources.add("name");
    }

    // Tag match — skip if semantic engine already matched this trend
    const tagMatch = trend.tags.find((t) => t.toLowerCase().includes(query) || query.includes(t.toLowerCase()));
    if (tagMatch && !matchedSources.has("semantic-engine")) {
      score += 0.7;
      reason = reason ? reason + " + tag" : `tag: ${tagMatch}`;
      matchedSources.add("tag");
    }

    // Category match
    if (trend.category.toLowerCase().includes(query)) {
      score += 0.5;
      reason = reason ? reason + " + category" : "category match";
      matchedSources.add("category");
    }

    // Keyword matching for common queries
    const keywordMap: Record<string, string[]> = {
      ai: ["ai", "artificial", "intelligence", "llm", "machine-learning", "generative", "agents"],
      climate: ["climate", "sustainability", "green", "energy", "carbon", "esg", "circular"],
      security: ["security", "cyber", "trust", "zero-trust", "encryption", "privacy"],
      geopolitics: ["geopolitics", "fragmentation", "conflict", "war", "multipolar", "sovereignty"],
      work: ["work", "remote", "hybrid", "skills", "education", "upskilling", "future-of-work"],
      health: ["health", "biotech", "genomics", "digital-health", "longevity", "telemedicine"],
      data: ["data", "cloud", "edge", "iot", "platform", "api", "infrastructure"],
      blockchain: ["blockchain", "web3", "crypto", "decentralized", "defi", "token"],
      mobility: ["mobility", "autonomous", "ev", "transport", "self-driving"],
      quantum: ["quantum", "computing", "post-quantum", "cryptography"],
    };

    // Semantic context mapping: real-world entities → trend topics
    // Countries, events, companies, people → what trends they relate to
    const contextMap: Record<string, string[]> = {
      // Countries & Regions → geopolitical + economic + tech trends
      taiwan: ["geopolitics", "fragmentation", "semiconductor", "technology", "disruption", "security"],
      china: ["geopolitics", "fragmentation", "ai", "technology", "trade", "sovereignty", "regulation"],
      russia: ["geopolitics", "fragmentation", "energy", "conflict", "security", "cyber"],
      ukraine: ["geopolitics", "fragmentation", "conflict", "energy", "security"],
      usa: ["geopolitics", "ai", "technology", "regulation", "energy"],
      europe: ["regulation", "climate", "sustainability", "digital", "gdpr", "ai"],
      eu: ["regulation", "climate", "sustainability", "digital", "gdpr", "ai"],
      india: ["demographics", "technology", "digital", "energy"],
      africa: ["demographics", "climate", "energy", "health", "urbanization"],
      "middle east": ["energy", "geopolitics", "conflict", "urbanization"],
      japan: ["demographics", "technology", "robotics", "aging"],
      korea: ["technology", "semiconductor", "geopolitics"],
      // Events & Concepts
      semiconductor: ["technology", "disruption", "geopolitics", "fragmentation", "sovereignty"],
      chips: ["technology", "disruption", "geopolitics", "semiconductor"],
      tariff: ["geopolitics", "fragmentation", "trade"],
      sanction: ["geopolitics", "fragmentation", "security"],
      election: ["geopolitics", "fragmentation", "social"],
      inflation: ["economic", "social", "inequality"],
      recession: ["economic", "social", "inequality", "energy"],
      pandemic: ["health", "biotech", "digital", "remote"],
      nato: ["geopolitics", "security", "fragmentation"],
      opec: ["energy", "geopolitics", "climate"],
      // Companies & Organizations as context
      openai: ["ai", "generative", "llm", "agents", "technology"],
      google: ["ai", "technology", "platform", "cloud"],
      microsoft: ["ai", "technology", "platform", "cloud"],
      anthropic: ["ai", "generative", "llm", "agents", "technology"],
      tesla: ["mobility", "autonomous", "ev", "energy"],
      nvidia: ["ai", "technology", "semiconductor", "computing"],
      tsmc: ["technology", "semiconductor", "geopolitics", "fragmentation"],
      apple: ["technology", "platform", "spatial"],
      meta: ["technology", "platform", "spatial", "xr"],
      amazon: ["technology", "platform", "cloud", "commerce"],
      spacex: ["technology", "disruption"],
    };

    // TODO: CONSOLIDATE — overlapping with findConcepts (semantic-engine), keywordMap, and SEMANTIC_MAP
    // Check context mapping — skip if already matched via semantic engine
    if (!matchedSources.has("semantic-engine")) {
      for (const [contextTerm, relatedTags] of Object.entries(contextMap)) {
        if (query.includes(contextTerm) && !matchedSources.has(`context:${contextTerm}`)) {
          if (trend.tags.some((t) => relatedTags.includes(t.toLowerCase())) ||
              relatedTags.some((rt) => trend.name.toLowerCase().includes(rt))) {
            score += 0.6;
            matchedSources.add(`context:${contextTerm}`);
            reason = reason ? reason + ` + context:${contextTerm}` : `context: ${contextTerm}`;
          }
        }
      }
    }

    // TODO: CONSOLIDATE — overlapping with findConcepts (semantic-engine), contextMap, and SEMANTIC_MAP
    // Keyword map — skip if already matched via semantic engine or context
    if (!matchedSources.has("semantic-engine")) {
      for (const [keyword, related] of Object.entries(keywordMap)) {
        if (!matchedSources.has(`keyword:${keyword}`) &&
            (query.includes(keyword) || related.some((r) => query.includes(r)))) {
          if (trend.tags.some((t) => related.includes(t.toLowerCase()))) {
            score += 0.4;
            matchedSources.add(`keyword:${keyword}`);
            reason = reason ? reason + " + keyword" : `keyword: ${keyword}`;
          }
        }
      }
    }

    // Semantic association map — the "thinking" layer
    // Only apply if semantic engine did not already match this trend
    // (SEMANTIC_MAP and semantic-engine overlap heavily)
    if (!matchedSources.has("semantic-engine")) {
      const queryWords = query.split(/\s+/);
      const matchedTags = new Set<string>(); // Deduplicate by tag within SEMANTIC_MAP
      for (const word of queryWords) {
        const associations = SEMANTIC_MAP[word];
        if (associations) {
          for (const assoc of associations) {
            if (matchedTags.has(assoc.tag)) continue; // already scored this tag
            if (trend.tags.some((t) => t.toLowerCase().includes(assoc.tag)) ||
                trend.name.toLowerCase().includes(assoc.tag) ||
                trend.category.toLowerCase().includes(assoc.tag)) {
              score += assoc.strength * 0.8;
              matchedTags.add(assoc.tag);
              reasoningChains.push(assoc.chain);
              reason = reason ? reason + ` + semantic:${assoc.tag}` : `semantic: ${assoc.chain}`;
            }
          }
        }
      }
    }

    if (score > 0) {
      matches.push({
        trend,
        relevanceToQuery: Math.min(1, score),
        matchReason: reasoningChains.length > 0 ? reasoningChains[0] : reason,
      });
    }
  }

  return matches.sort((a, b) => b.relevanceToQuery - a.relevanceToQuery).slice(0, 10);
}

function buildSynthesis(query: string, matches: TrendMatch[], locale: Locale): string {
  if (matches.length === 0 || matches[0].relevanceToQuery < 0.3) {
    return locale === "de"
      ? `Die LLM-Analyse wird für "${query}" gestartet. Das lokale Datenmodell enthält keine direkt passenden Trends — die KI-gestützte Analyse liefert eine substanzielle Antwort in wenigen Sekunden.`
      : `LLM analysis initiated for "${query}". The local data model has no direct matches — the AI-powered analysis will provide a substantive answer in a few seconds.`;
  }

  const top = matches[0].trend;
  const classification = top.classification || autoClassify(top);
  const regulations = getRegulationsForTrend(top.id);
  const cascadeCount = calculateCascadeDepth(top.id).length;
  const velocity = top.velocity === "rising" ? (locale === "de" ? "zunehmend" : "rising") :
                   top.velocity === "falling" ? (locale === "de" ? "abnehmend" : "falling") :
                   (locale === "de" ? "stabil" : "stable");
  const ring = top.ring === "adopt" ? (locale === "de" ? "reif und adoptionsbereit" : "mature and ready to adopt") :
               top.ring === "trial" ? (locale === "de" ? "in aktiver Erprobung" : "in active trial phase") :
               top.ring === "assess" ? (locale === "de" ? "in Beobachtung" : "under observation") :
               (locale === "de" ? "pausiert oder rückläufig" : "on hold or declining");
  const relatedNames = matches.slice(1, 4).map((m) => m.trend.name);

  if (locale === "de") {
    return `Das SIS-Datenmodell hat "${query}" mit ${matches.length} relevanten Trend-Clustern verknüpft. ` +
      `Dominanter Kontext: ${top.name} — ${velocity}, ${ring}, mit ${(top.relevance * 100).toFixed(0)}% strategischer Relevanz. ` +
      `${classification.momentum > 0.3 ? `Die Dynamik ist positiv (Momentum +${(classification.momentum * 100).toFixed(0)}), was auf strukturelles Wachstum hindeutet.` : classification.momentum < -0.2 ? `Die Dynamik ist rückläufig — Vorsicht bei langfristigen Investitionen.` : `Die Dynamik ist ausgewogen — kein starkes Signal in eine Richtung.`} ` +
      `${regulations.length > 0 ? `${regulations.length} Regulierungen beeinflussen dieses Feld direkt.` : ""}` +
      `${cascadeCount > 0 ? ` Systemische Reichweite: ${cascadeCount} weitere Trends werden beeinflusst — das deutet auf strukturelle Relevanz hin.` : ""}` +
      (relatedNames.length > 0 ? ` Verwandte Kraftfelder: ${relatedNames.join(", ")}. Die vollständige KI-Analyse liefert eine tiefere Einschätzung.` : " Die vollständige KI-Analyse liefert eine tiefere strategische Einschätzung.");
  }

  return `The SIS data model linked "${query}" to ${matches.length} relevant trend clusters. ` +
    `Dominant context: ${top.name} — ${velocity}, ${ring}, at ${(top.relevance * 100).toFixed(0)}% strategic relevance. ` +
    `${classification.momentum > 0.3 ? `Momentum is positive (+${(classification.momentum * 100).toFixed(0)}), indicating structural growth.` : classification.momentum < -0.2 ? `Momentum is declining — caution warranted for long-term commitments.` : `Dynamics are balanced — no strong directional signal.`} ` +
    `${regulations.length > 0 ? `${regulations.length} regulations directly shape this field.` : ""}` +
    `${cascadeCount > 0 ? ` Systemic reach: affects ${cascadeCount} other trends — indicating structural significance.` : ""}` +
    (relatedNames.length > 0 ? ` Related force fields: ${relatedNames.join(", ")}. Full AI analysis delivers deeper strategic context.` : " Full AI analysis delivers deeper strategic context.");
}

function extractInsights(matches: TrendMatch[], locale: Locale): string[] {
  const insights: string[] = [];
  const de = locale === "de";

  for (const match of matches.filter((m) => m.relevanceToQuery >= 0.3).slice(0, 4)) {
    const t = match.trend;
    const classification = t.classification || autoClassify(t);
    const pressure = getRegulatoryPressure(t.id);

    // Velocity + ring combination → strategic signal
    if (t.velocity === "rising" && t.ring === "adopt") {
      insights.push(de
        ? `${t.name} ist reif und beschleunigt: Invest- und Implementierungsdruck steigt jetzt`
        : `${t.name} is mature and accelerating: investment and adoption pressure is building now`);
    } else if (t.velocity === "rising" && t.ring === "assess") {
      insights.push(de
        ? `${t.name} gewinnt an Fahrt, aber noch unbewiesen: frühzeitige Positionierung empfohlen`
        : `${t.name} is gaining momentum but unproven: early positioning recommended`);
    } else if (t.velocity === "falling") {
      insights.push(de
        ? `${t.name} verliert an Dynamik — Exit-Strategie und Ressourcen-Umschichtung prüfen`
        : `${t.name} is losing momentum — evaluate exit strategy and resource reallocation`);
    }

    // High impact + low confidence = strategic risk/opportunity
    if (t.impact > 0.75 && t.confidence < 0.5) {
      insights.push(de
        ? `Hohes Potenzial, geringe Datenlage: ${t.name} verdient priorisierte Beobachtung — die Richtung ist unklar, der Einsatz hoch`
        : `High stakes, low certainty: ${t.name} warrants priority monitoring — direction unclear, impact significant`);
    }

    // Strong regulatory pressure
    if (pressure.constraining > 1.5) {
      insights.push(de
        ? `${t.name} kämpft gegen regulatorischen Gegenwind — Compliance-Kosten und Markteinschränkungen sind kalkulierte Risiken`
        : `${t.name} faces strong regulatory headwinds — compliance costs and market restrictions are calculated risks`);
    } else if (pressure.accelerating > 1.5) {
      insights.push(de
        ? `Regulierung beschleunigt ${t.name}: Politische Rückendeckung senkt Adoptionsrisiken`
        : `Regulation is accelerating ${t.name}: policy tailwinds reduce adoption risks`);
    }

    // Cascade depth = systemic relevance
    const cascade = calculateCascadeDepth(t.id);
    if (cascade.length >= 5) {
      insights.push(de
        ? `${t.name} hat systemische Reichweite: Entscheidungen hier beeinflussen ${cascade.length} weitere Bereiche indirekt`
        : `${t.name} has systemic reach: decisions here indirectly affect ${cascade.length} other domains`);
    }
  }

  // Cross-trend causal insight
  if (matches.length >= 2) {
    const connected = matches.filter((m, i) =>
      i > 0 && getEdgesForTrend(m.trend.id).some((e) =>
        e.from === matches[0].trend.id || e.to === matches[0].trend.id
      )
    );
    if (connected.length > 0) {
      insights.push(de
        ? `Kausale Verbindung: ${matches[0].trend.name} treibt oder hemmt ${connected.slice(0,2).map((c) => c.trend.name).join(" und ")} — Wechselwirkungen beachten`
        : `Causal link: ${matches[0].trend.name} drives or inhibits ${connected.slice(0,2).map((c) => c.trend.name).join(" and ")} — monitor feedback loops`);
    }
  }

  return insights.slice(0, 5);
}

function extractRegulatoryContext(matches: TrendMatch[], locale: Locale): string[] {
  const context: string[] = [];

  for (const match of matches.slice(0, 3)) {
    const regs = getRegulationsForTrend(match.trend.id);
    for (const reg of regs.slice(0, 2)) {
      const impact = reg.impactedTrends.find((it) => it.trendId === match.trend.id);
      if (!impact) continue;
      const effectLabel = locale === "de"
        ? { accelerates: "beschleunigt", constrains: "bremst", reshapes: "formt um" }[impact.effect]
        : impact.effect;
      context.push(`${reg.jurisdiction}: ${reg.shortName} — ${effectLabel} ${match.trend.name} (${reg.status})`);
    }
  }

  return context;
}

function extractCausalChains(matches: TrendMatch[], locale: Locale): string[] {
  const chains: string[] = [];

  for (const match of matches.slice(0, 2)) {
    const effects = getEffects(match.trend.id);
    if (effects.length > 0) {
      const effectNames = effects.slice(0, 3).map((e) => {
        const name = e.to.replace(/^mega-/, "").replace(/^macro-/, "").replace(/-/g, " ");
        return `${name} (${e.type} ${(e.strength * 100).toFixed(0)}%)`;
      });
      chains.push(locale === "de"
        ? `${match.trend.name} → treibt: ${effectNames.join(", ")}`
        : `${match.trend.name} → drives: ${effectNames.join(", ")}`);
    }

    const drivers = getDrivers(match.trend.id);
    if (drivers.length > 0) {
      const driverNames = drivers.slice(0, 3).map((e) => {
        const name = e.from.replace(/^mega-/, "").replace(/^macro-/, "").replace(/-/g, " ");
        return name;
      });
      chains.push(locale === "de"
        ? `${match.trend.name} ← getrieben von: ${driverNames.join(", ")}`
        : `${match.trend.name} ← driven by: ${driverNames.join(", ")}`);
    }
  }

  return chains;
}

function buildSignalSummary(matches: TrendMatch[], locale: Locale): string {
  const totalSignals = matches.reduce((sum, m) => sum + m.trend.signalCount, 0);
  const allSources = [...new Set(matches.flatMap((m) => m.trend.topSources))];
  const risingCount = matches.filter((m) => m.trend.velocity === "rising").length;
  const fallingCount = matches.filter((m) => m.trend.velocity === "falling").length;

  if (locale === "de") {
    return `${totalSignals} Signale aus ${allSources.length} Quellen (${allSources.slice(0, 5).join(", ")}). ` +
      `${risingCount} steigend, ${fallingCount} fallend.`;
  }
  return `${totalSignals} signals from ${allSources.length} sources (${allSources.slice(0, 5).join(", ")}). ` +
    `${risingCount} rising, ${fallingCount} falling.`;
}
