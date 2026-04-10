import { SourceConnector, RawSignal } from "./types";

// Product Hunt doesn't have a free public API anymore,
// but we can scrape the RSS/Atom feed for recent launches
export const producthuntConnector: SourceConnector = {
  name: "producthunt",
  displayName: "Product Hunt",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // Use the unofficial front page endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res: Response;
      try {
        res = await fetch("https://www.producthunt.com/feed", {
          headers: { Accept: "application/rss+xml, application/xml, text/xml" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) return signals;

      const text = await res.text();

      // Parse RSS items
      const items = text.split("<item>").slice(1);

      for (const item of items.slice(0, 20)) {
        const title = extractRss(item, "title") || "";
        const link = extractRss(item, "link") || "";
        const pubDate = extractRss(item, "pubDate") || "";
        const description = extractRss(item, "description")?.slice(0, 200) || "";

        if (!title) continue;

        // Try to map to a known topic
        const topic = detectTopic(title + " " + description);
        if (!topic) continue;

        signals.push({
          sourceType: "producthunt",
          sourceUrl: link,
          sourceTitle: title,
          signalType: "mention",
          topic,
          rawStrength: 0.5, // TODO: compute strength dynamically from signal data
          rawData: { description },
          detectedAt: pubDate ? new Date(pubDate) : new Date(),
        });
      }
    } catch {
      // Feed unavailable
    }

    return signals;
  },
};

function extractRss(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return match ? match[1].trim() : null;
}

function detectTopic(text: string): string | null {
  const lower = text.toLowerCase();
  const keywords: [string, string][] = [
    ["ai", "AI"], ["artificial intelligence", "AI"], ["machine learning", "Machine Learning"],
    ["llm", "LLM"], ["gpt", "LLM"], ["chatbot", "AI"],
    ["automation", "Automation"], ["no-code", "Low-Code/No-Code"], ["low-code", "Low-Code/No-Code"],
    ["api", "API Economy"], ["developer", "Developer Tools"],
    ["design", "Design Tools"], ["productivity", "Productivity"],
    ["analytics", "Analytics"], ["security", "Security"], ["privacy", "Privacy"],
    ["crypto", "Blockchain"], ["web3", "Web3"],
    ["health", "Digital Health"], ["fitness", "Digital Health"],
    ["sustainability", "Green Tech"], ["climate", "Green Tech"],
    ["remote", "Remote Work"], ["collaboration", "Collaboration"],
    ["e-commerce", "E-Commerce"], ["saas", "SaaS"],
  ];

  for (const [kw, topic] of keywords) {
    if (lower.includes(kw)) return topic;
  }
  return null;
}
