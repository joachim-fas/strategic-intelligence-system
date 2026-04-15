import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

// Product Hunt doesn't have a free public API anymore, but the site still
// publishes an Atom feed of recent posts at /feed. We scrape that feed and
// extract each `<entry>` — the old RSS `<item>` split left zero matches and
// silently produced zero signals.
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
          headers: { Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) return signals;

      const text = await res.text();

      // Detect Atom vs. RSS. The current feed is Atom (`<entry>`); fall back
      // to `<item>` in case Product Hunt switches format again.
      const isAtom = text.includes("<entry>") || text.includes("<entry ");
      const splitTag = isAtom ? "<entry>" : "<item>";
      const items = text.split(splitTag).slice(1);

      for (const item of items.slice(0, 20)) {
        const title = extractXml(item, "title") || "";
        const link = isAtom ? extractAtomLink(item) : (extractXml(item, "link") || "");
        const pubDate =
          extractXml(item, isAtom ? "published" : "pubDate") ||
          extractXml(item, "updated") ||
          "";
        const description =
          extractXml(item, isAtom ? "content" : "description")?.slice(0, 200) || "";

        if (!title) continue;

        // Try to map to a known topic
        const topic = detectTopic(title + " " + description);
        if (!topic) continue;

        const signal: RawSignal = {
          sourceType: "producthunt",
          sourceUrl: link,
          sourceTitle: title,
          signalType: "mention",
          topic,
          rawStrength: 0, // computed below
          rawData: { description },
          detectedAt: pubDate ? new Date(pubDate) : new Date(),
        };
        signal.rawStrength = computeSignalStrength(signal);
        signals.push(signal);
      }
    } catch {
      // Feed unavailable
    }

    return signals;
  },
};

function extractXml(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return match ? match[1].trim() : null;
}

// Atom `<link rel="alternate" href="..."/>` — pick the first alternate href.
function extractAtomLink(xml: string): string {
  const match = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
    || xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i)
    || xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  return match ? match[1] : "";
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
