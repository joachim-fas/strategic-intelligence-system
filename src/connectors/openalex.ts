import { SourceConnector, RawSignal } from "./types";

/**
 * OpenAlex Connector — free, no API key, 100K requests/day
 *
 * Tracks research paper volume and citation velocity across
 * all scientific domains. Detects emerging research trends
 * before they hit mainstream.
 *
 * API: https://docs.openalex.org/
 */

// OpenAlex concept IDs for trend-relevant topics
const CONCEPT_QUERIES: { conceptId: string; topic: string; label: string }[] = [
  { conceptId: "C154945302", topic: "Artificial Intelligence & Automation", label: "AI" },
  { conceptId: "C119857082", topic: "Artificial Intelligence & Automation", label: "Machine Learning" },
  { conceptId: "C41008148", topic: "Technological Disruption", label: "Computer Science" },
  { conceptId: "C62520636", topic: "Quantum Computing", label: "Quantum Mechanics" },
  { conceptId: "C185592680", topic: "Health, Biotech & Longevity", label: "Biotechnology" },
  { conceptId: "C127413603", topic: "Health, Biotech & Longevity", label: "Genetics" },
  { conceptId: "C39432304", topic: "Climate Change & Sustainability", label: "Environmental Science" },
  { conceptId: "C33923547", topic: "Energy Transition & Decarbonization", label: "Renewable Energy" },
  { conceptId: "C199539241", topic: "Cybersecurity & Zero Trust", label: "Computer Security" },
  { conceptId: "C204321447", topic: "Connectivity & Digital Networks", label: "Internet" },
  { conceptId: "C136764020", topic: "Urbanization & Smart Cities", label: "Urban Planning" },
  { conceptId: "C162324750", topic: "Economic Trends", label: "Economics" },
];

export const openalexConnector: SourceConnector = {
  name: "openalex",
  displayName: "OpenAlex (Research Papers)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const currentYear = new Date().getFullYear();

    for (const { conceptId, topic, label } of CONCEPT_QUERIES) {
      try {
        // Get paper count for current year vs last year
        const [currentRes, prevRes] = await Promise.all([
          fetch(`https://api.openalex.org/works?filter=publication_year:${currentYear},concept.id:${conceptId}&per_page=1`, {
            headers: { "User-Agent": "SIS/1.0 (mailto:sis@strategic-intelligence.app)" },
            signal: AbortSignal.timeout(8000),
          }),
          fetch(`https://api.openalex.org/works?filter=publication_year:${currentYear - 1},concept.id:${conceptId}&per_page=1`, {
            headers: { "User-Agent": "SIS/1.0 (mailto:sis@strategic-intelligence.app)" },
            signal: AbortSignal.timeout(8000),
          }),
        ]);

        if (!currentRes.ok || !prevRes.ok) continue;

        const current = await currentRes.json();
        const prev = await prevRes.json();
        const currentCount = current.meta?.count || 0;
        const prevCount = prev.meta?.count || 0;

        // Calculate growth rate
        const growth = prevCount > 0 ? (currentCount - prevCount) / prevCount : 0;
        const isSpike = growth > 0.2; // 20%+ growth = spike

        signals.push({
          sourceType: "openalex",
          sourceUrl: `https://openalex.org/concepts/${conceptId}`,
          sourceTitle: `Research: ${label} — ${currentCount.toLocaleString()} papers ${currentYear} (${growth > 0 ? "+" : ""}${(growth * 100).toFixed(0)}% YoY)`,
          signalType: isSpike ? "spike" : "paper",
          topic,
          rawStrength: Math.min(1, Math.abs(growth) + 0.3),
          rawData: { conceptId, label, currentYear: currentCount, prevYear: prevCount, growth },
          detectedAt: new Date(),
        });
      } catch {
        // Rate limit or timeout — skip
      }
    }

    return signals;
  },
};
