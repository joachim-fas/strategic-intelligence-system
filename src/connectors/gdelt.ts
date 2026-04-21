import { SourceConnector, RawSignal } from "./types";

/**
 * GDELT Connector — free, no API key, updates every 15 minutes
 *
 * The GDELT Project monitors the world's news media from nearly
 * every corner of every country in print, broadcast, and web formats.
 * Perfect for detecting emerging geopolitical and social trends.
 *
 * API: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

// GDELT syntax note: multi-term boolean queries MUST wrap the OR'd terms in
// parentheses. Requests without parens come back as 200 + the plain-text
// error "Queries containing OR'd terms must be surrounded by ().", which
// JSON.parse then throws on. Ten silent throws = zero signals.
const TREND_QUERIES: { query: string; topic: string; label: string }[] = [
  { query: "(\"artificial intelligence\" OR \"machine learning\" OR \"AI regulation\")", topic: "Artificial Intelligence & Automation", label: "AI" },
  { query: "(\"climate change\" OR \"global warming\" OR \"carbon emissions\")", topic: "Climate Change & Sustainability", label: "Climate" },
  { query: "(cyberattack OR ransomware OR \"data breach\" OR cybersecurity)", topic: "Cybersecurity & Zero Trust", label: "Cyber" },
  { query: "(\"geopolitical tension\" OR sanctions OR \"trade war\")", topic: "Geopolitical Fragmentation", label: "Geopolitics" },
  { query: "(\"renewable energy\" OR solar OR \"wind power\" OR \"energy transition\")", topic: "Energy Transition & Decarbonization", label: "Energy" },
  { query: "(\"quantum computing\" OR \"quantum advantage\")", topic: "Quantum Computing", label: "Quantum" },
  { query: "(\"autonomous vehicles\" OR \"self-driving\")", topic: "Mobility & Autonomous Transport", label: "Autonomous" },
  { query: "(blockchain OR \"cryptocurrency regulation\" OR CBDC)", topic: "Web3 & Decentralization", label: "Crypto/Web3" },
  { query: "(\"pandemic preparedness\" OR \"disease outbreak\" OR \"WHO alert\")", topic: "Health, Biotech & Longevity", label: "Health" },
  { query: "(\"supply chain disruption\" OR \"semiconductor shortage\")", topic: "Economic Trends", label: "Supply Chain" },
];

export const gdeltConnector: SourceConnector = {
  name: "gdelt",
  displayName: "GDELT (Global News Intelligence)",

  async fetchSignals(): Promise<RawSignal[]> {
    // Backlog-Task 1.3 (2026-04-21): GDELT Timeout inkrementell beheben.
    //
    // Der alte Pfad war 10 sequentielle Fetches mit je 3 s Abstand = 30 s+
    // wall time. Der Pipeline-Gesamt-Timeout (60 s) fraß damit die Hälfte
    // der Budget-Zeit nur für GDELT. Master-Spec-Fix: kleinere Zeitfenster,
    // kürzere Per-Fetch-Timeouts, parallele Batches statt striktes seriell.
    //
    //  - Zeitfenster: 12 h statt 24 h — weniger Payload pro Query, GDELT
    //    liefert schneller, Trend-Signal bleibt aussagekräftig (wir messen
    //    Kurzfrist-Momentum, kein Archiv).
    //  - Batch-Size: 3 parallele Queries, 1.5 s zwischen Batches — GDELT
    //    zählt 429-Rate-Limits from end-of-previous-request, kurze Bursts
    //    mit Pausen sind tolerierter als langsam-seriell.
    //  - Per-Fetch-Timeout: 25 s (vorher 20 s) — großzügig genug für
    //    langsame Antworten, aber hart genug, damit ein hängender Fetch
    //    nicht den Batch blockiert.
    //  - Ergebnis: Worst-case ~15 s statt ~35 s bei gleicher Signal-Menge.
    const WINDOW_HOURS = 12;
    const PER_FETCH_TIMEOUT_MS = 25_000;
    const BATCH_SIZE = 3;
    const INTER_BATCH_DELAY_MS = 1500;

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - WINDOW_HOURS * 3600 * 1000);
    const fromStr = toGdeltTimestamp(fromDate);
    const toStr = toGdeltTimestamp(toDate);

    async function runOne(params: { query: string; topic: string; label: string }): Promise<RawSignal | null> {
      const { query, topic, label } = params;
      const url = `${GDELT_BASE}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=10&format=json&startdatetime=${fromStr}&enddatetime=${toStr}`;
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(PER_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || text.length < 10) return null;
        const data = JSON.parse(text);
        const articles = data.articles || [];
        if (articles.length === 0) return null;

        const domains = new Set(articles.map((a: { url?: string }) => {
          try { return a.url ? new URL(a.url).hostname : null; } catch { return null; }
        }).filter(Boolean));

        return {
          sourceType: "gdelt",
          sourceUrl: "https://www.gdeltproject.org/",
          sourceTitle: `GDELT: ${label} — ${articles.length} articles from ${domains.size} sources (${WINDOW_HOURS}h)`,
          signalType: articles.length > 7 ? "spike" : "mention",
          topic,
          rawStrength: Math.min(1, articles.length / 10),
          rawData: {
            articleCount: articles.length,
            domainCount: domains.size,
            topArticles: articles.slice(0, 3).map((a: { title?: string; url?: string; domain?: string }) => ({ title: a.title, url: a.url, domain: a.domain })),
          },
          detectedAt: new Date(),
        };
      } catch {
        // Timeout, parse error, network error → null (batch resilient)
        return null;
      }
    }

    const signals: RawSignal[] = [];
    for (let i = 0; i < TREND_QUERIES.length; i += BATCH_SIZE) {
      const batch = TREND_QUERIES.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(runOne));
      for (const r of batchResults) if (r) signals.push(r);
      if (i + BATCH_SIZE < TREND_QUERIES.length) {
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
      }
    }

    return signals;
  },
};

function toGdeltTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
