import { SourceConnector, RawSignal } from "./types";

/**
 * Google Trends Connector
 *
 * Google has no official API. We pull the public "Trending now" RSS feed
 * across multiple regions and map the resulting search spikes to SIS
 * trend topics. Search volume is a powerful leading indicator — public
 * interest shifts before markets and regulations.
 *
 * 2026-04-22 (Backlog "Google Trends Connector reparieren oder entfernen"):
 * Früher lieferte der Connector regelmäßig 0 Signale. Zwei Ursachen:
 *
 *  1. Nur `geo=US` wurde abgefragt — wir sind ein EU-System, und der
 *     US-Feed wird von Google auf Server-IPs oft rate-limited.
 *  2. `matchToTopic` filterte 15–20 Trends auf vielleicht 2 relevante,
 *     weil die Keyword-Liste zu eng war. Alles ohne explicit Match flog
 *     raus, statt als allgemeines „Cultural Signal" gespeichert zu
 *     werden.
 *
 * Fix: drei Regionen (DE, US, WORLD) parallel abfragen, Mapping um ~20
 * Keywords erweitert, und alles, was durchs Keyword-Raster fällt, landet
 * unter „Cultural Signal" statt verworfen zu werden. Harte Deduplication
 * auf dem Titel, damit derselbe globale Trend nicht drei Mal als
 * Einzel-Signal landet.
 */

const TRENDS_REGIONS: { geo: string; label: string }[] = [
  { geo: "DE",    label: "DE" },
  { geo: "US",    label: "US" },
  { geo: "", label: "WORLD" }, // Global default, parameter omitted
];

export const googleTrendsConnector: SourceConnector = {
  name: "google_trends",
  displayName: "Google Trends",

  async fetchSignals(): Promise<RawSignal[]> {
    const seenTitles = new Set<string>();
    const signals: RawSignal[] = [];

    // Parallel alle Regionen, damit ein einzelner Region-Block das Ergebnis
    // nicht auf 0 drückt. Promise.all mit runOne → null ist resilient gegen
    // 403/429 einzelner Regionen.
    async function fetchRegion(geo: string, label: string): Promise<RawSignal[]> {
      const url = geo
        ? `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`
        : "https://trends.google.com/trending/rss";
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "SIS/1.0" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        const text = await res.text();
        const items = text.split("<item>").slice(1);

        const regionSignals: RawSignal[] = [];
        for (const item of items.slice(0, 30)) {
          const rawTitle = item.match(/<title>([^<]*)<\/title>/)?.[1] || "";
          const title = rawTitle.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
          if (!title) continue;
          const traffic = item.match(/<ht:approx_traffic>([^<]*)<\/ht:approx_traffic>/)?.[1] || "";
          const pubDate = item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || "";

          const topic = matchToTopic(title);
          const trafficNum = parseInt(traffic.replace(/[^0-9]/g, "")) || 10000;
          const strength = Math.min(1, trafficNum / 1000000);

          regionSignals.push({
            sourceType: "google_trends",
            sourceUrl: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}`,
            sourceTitle: `Trending (${label}): ${title}${traffic ? ` — ${traffic} searches` : ""}`,
            signalType: strength > 0.5 ? "spike" : "mention",
            topic,
            rawStrength: strength,
            rawData: { title, traffic: trafficNum, region: label },
            detectedAt: pubDate ? new Date(pubDate) : new Date(),
          });
        }
        return regionSignals;
      } catch {
        return [];
      }
    }

    const regionResults = await Promise.all(
      TRENDS_REGIONS.map(({ geo, label }) => fetchRegion(geo, label))
    );

    // Dedup auf dem Titel (case-insensitive). Ein globaler Top-Trend taucht
    // in DE + US + WORLD auf — wir nehmen die erste Variante (bevorzugt
    // DE, da das unsere Primärregion ist) und werfen Duplikate weg.
    for (const regionSignals of regionResults) {
      for (const s of regionSignals) {
        const key = (s.rawData.title as string).toLowerCase().trim();
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        signals.push(s);
      }
    }

    return signals;
  },
};

/**
 * Best-effort Mapping von Search-Trend-Titeln auf SIS-Trend-Topics.
 * Alles, was keinem spezifischen Trend zuzuordnen ist, landet unter
 * „Cultural Signal" (Values/Foresight-Bucket) statt verworfen zu werden
 * — ein Signal, das tausendfach gesucht wird, ist per se strategisch
 * interessant, auch wenn es aktuell nicht zu einem kuratierten Trend
 * passt.
 */
function matchToTopic(title: string): string {
  const lower = title.toLowerCase();
  const keywords: [string, string][] = [
    // Technology
    ["ai", "Artificial Intelligence & Automation"],
    ["artificial intelligence", "Artificial Intelligence & Automation"],
    ["chatgpt", "Generative AI"],
    ["openai", "Generative AI"],
    ["claude", "Generative AI"],
    ["gemini", "Generative AI"],
    ["robot", "Artificial Intelligence & Automation"],
    ["quantum", "Quantum Computing"],
    ["cybersecurity", "Cybersecurity & Zero Trust"],
    ["cyberangriff", "Cybersecurity & Zero Trust"],
    ["hack", "Cybersecurity & Zero Trust"],
    ["data breach", "Cybersecurity & Zero Trust"],
    ["5g", "Connectivity & Digital Networks"],
    ["6g", "Connectivity & Digital Networks"],
    // Climate / environment
    ["climate", "Climate Change & Sustainability"],
    ["klima", "Climate Change & Sustainability"],
    ["hitzewelle", "Climate Change & Sustainability"],
    ["heatwave", "Climate Change & Sustainability"],
    ["flood", "Climate Change & Sustainability"],
    ["hochwasser", "Climate Change & Sustainability"],
    ["wildfire", "Climate Change & Sustainability"],
    // Energy
    ["energy transition", "Energy Transition & Decarbonization"],
    ["energiewende", "Energy Transition & Decarbonization"],
    ["solar", "Energy Transition & Decarbonization"],
    ["wind power", "Energy Transition & Decarbonization"],
    ["electric vehicle", "Mobility & Autonomous Transport"],
    ["ev ", "Mobility & Autonomous Transport"],
    ["autonomous", "Mobility & Autonomous Transport"],
    ["tesla", "Mobility & Autonomous Transport"],
    // Finance / crypto
    ["crypto", "Web3 & Decentralization"],
    ["bitcoin", "Web3 & Decentralization"],
    ["ethereum", "Web3 & Decentralization"],
    ["inflation", "Economic Trends"],
    ["recession", "Economic Trends"],
    ["rezession", "Economic Trends"],
    ["unemployment", "Economic Trends"],
    ["zinsen", "Economic Trends"],
    ["interest rate", "Economic Trends"],
    // Geopolitics
    ["war", "Geopolitical Fragmentation"],
    ["krieg", "Geopolitical Fragmentation"],
    ["sanctions", "Geopolitical Fragmentation"],
    ["sanktionen", "Geopolitical Fragmentation"],
    ["election", "Geopolitical Fragmentation"],
    ["wahl", "Geopolitical Fragmentation"],
    ["referendum", "Geopolitical Fragmentation"],
    ["nato", "Geopolitical Fragmentation"],
    ["bundestag", "Geopolitical Fragmentation"],
    // Health
    ["pandemic", "Health, Biotech & Longevity"],
    ["pandemie", "Health, Biotech & Longevity"],
    ["vaccine", "Health, Biotech & Longevity"],
    ["impfung", "Health, Biotech & Longevity"],
    ["outbreak", "Health, Biotech & Longevity"],
    ["ozempic", "Health, Biotech & Longevity"],
    // Labor / society
    ["remote work", "Future of Work"],
    ["hybrid work", "Future of Work"],
    ["streik", "Future of Work"],
    ["strike", "Future of Work"],
    ["layoff", "Future of Work"],
    ["migration", "Demographic Shifts & Migration"],
    ["refugee", "Demographic Shifts & Migration"],
  ];

  for (const [kw, topic] of keywords) {
    if (lower.includes(kw)) return topic;
  }
  // Fallback: Cultural Signal — kein spezifischer Trend, aber ein
  // öffentlich getriebener Aufmerksamkeits-Spike, der trotzdem Evidence-
  // Wert trägt. Landet via source-metadata im Values/Foresight-Bucket.
  return "Cultural Signal";
}
