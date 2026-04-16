/**
 * Generic RSS / Atom feed connector builder.
 *
 * The SIS registry uses one `SourceConnector` per upstream source so the
 * /monitor page can count them individually (active / inactive / N signals).
 * RSS feeds fit the same shape — fetch XML, split items, map to `RawSignal`
 * — so the only per-feed differences are the URL, the default topic, and
 * (optionally) keyword-driven topic refinement.
 *
 * Parsing strategy
 * ────────────────
 * We use regex-based extraction rather than pulling in a new XML dependency.
 * The producthunt connector already demonstrates this pattern works for both
 * RSS (`<item>`) and Atom (`<entry>`) feeds; `extractXml` handles optional
 * CDATA wrappers and namespaced tags (`dc:creator`, `content:encoded`, etc.).
 *
 * Failure posture
 * ───────────────
 * `fetchSignals()` NEVER throws. Any upstream failure (timeout, non-200,
 * malformed XML, empty feed) returns `[]`. The pipeline orchestrator already
 * logs per-connector results, so we stay quiet on success and warn only on
 * unexpected shapes.
 */

import type { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";
import { matchTopicByKeywords, type TopicMapping } from "./framework";

export interface RssFeedConfig {
  /** Stable slug used as `sourceType`. Must be unique across all connectors. */
  name: string;
  /** Human-readable name shown in the Quellen table. */
  displayName: string;
  /** Full feed URL (RSS 2.0 or Atom 1.0). */
  feedUrl: string;
  /** Topic assigned when no `keywordMapping` matches. */
  defaultTopic: string;
  /**
   * Optional first-match-wins keyword mapping applied to `title + description`.
   * Used when a single feed carries items across multiple SIS trend topics
   * (e.g. The Guardian World section covers both geopolitics and climate).
   */
  keywordMapping?: TopicMapping;
  /** Free-form tags persisted on `rawData.tags` — useful for UI filtering. */
  tags?: string[];
  /** Hard cap on items processed per fetch. Default: 30. */
  limit?: number;
  /** Fetch timeout in ms. Default: 20000. */
  timeoutMs?: number;
  /** Override `sourceType` if several feeds should group under one logical source. */
  sourceType?: string;
  /** Extra HTTP headers (e.g. User-Agent for picky origins). */
  headers?: Record<string, string>;
}

// ── XML extraction helpers ─────────────────────────────────────────────────

/**
 * Match `<tag ...>...</tag>` with optional CDATA wrapping. Matches the FIRST
 * occurrence (good enough for <item>/<entry>-scoped fragments which have
 * exactly one of each tag). `[\s\S]` instead of `.` so newlines count.
 */
function extractXml(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`,
    "i",
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** Atom `<link rel="alternate" href="..."/>` — RSS `<link>url</link>`. */
function extractAtomLink(xml: string): string {
  const alt = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
    || xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i)
    || xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return alt ? alt[1] : "";
}

/** RSS `<link>https://…</link>` — Atom fallback also returns empty-string on miss. */
function extractRssLink(xml: string): string {
  // First: plain `<link>text</link>`.
  const plain = xml.match(/<link>([\s\S]*?)<\/link>/i);
  if (plain) return plain[1].trim();
  return extractAtomLink(xml);
}

/** Collapse HTML tags, normalize whitespace. Caps length to keep DB rows sane. */
function stripHtml(s: string, maxLen = 400): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ── Builder ────────────────────────────────────────────────────────────────

export function buildRssFeedConnector(config: RssFeedConfig): SourceConnector {
  const sourceType = config.sourceType ?? config.name;

  return {
    name: config.name,
    displayName: config.displayName,

    async fetchSignals(): Promise<RawSignal[]> {
      const timeoutMs = config.timeoutMs ?? 20000;
      const limit = config.limit ?? 30;

      try {
        const res = await fetch(config.feedUrl, {
          headers: {
            Accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            // Some origins 403 without a User-Agent (Bellingcat, ifo, SWP).
            "User-Agent": "SIS/1.0 (+https://strategic-intelligence.app)",
            ...(config.headers ?? {}),
          },
          signal: AbortSignal.timeout(timeoutMs),
          // Feeds occasionally 301 to the canonical host — follow silently.
          redirect: "follow",
        });

        if (!res.ok) {
          console.warn(`[${config.name}] HTTP ${res.status} ${res.statusText}`);
          return [];
        }

        const text = await res.text();

        // Atom uses `<entry>`; RSS uses `<item>`. Some feeds emit both; prefer
        // whichever split produces fragments, fall back to the other.
        const isAtom =
          /<feed[\s>]/i.test(text) || /<entry[\s>]/.test(text);
        const splitTag = isAtom ? "<entry" : "<item";
        const parts = text.split(new RegExp(splitTag + "[\\s>]", "i")).slice(1);
        // Reattach the opening char so extraction regexes still work.
        const items = parts.map((p) => splitTag + (p.startsWith(">") ? "" : " ") + p);

        if (items.length === 0) return [];

        const signals: RawSignal[] = [];
        for (const item of items.slice(0, limit)) {
          const title = extractXml(item, "title");
          if (!title) continue;

          const link = isAtom ? extractAtomLink(item) : extractRssLink(item);
          const pubRaw =
            extractXml(item, isAtom ? "published" : "pubDate") ??
            extractXml(item, "updated") ??
            extractXml(item, "dc:date") ??
            null;
          const descRaw =
            extractXml(item, isAtom ? "summary" : "description") ??
            extractXml(item, "content:encoded") ??
            extractXml(item, "content") ??
            "";

          const cleanTitle = stripHtml(title, 240);
          const description = stripHtml(descRaw, 400);

          // Topic resolution: keyword mapping (if set) wins over default.
          const haystack = `${cleanTitle} ${description}`;
          const topic =
            (config.keywordMapping
              ? matchTopicByKeywords(haystack, config.keywordMapping, config.defaultTopic)
              : config.defaultTopic) ?? config.defaultTopic;

          let detectedAt: Date;
          if (pubRaw) {
            const parsed = new Date(pubRaw);
            detectedAt = Number.isFinite(parsed.getTime()) ? parsed : new Date();
          } else {
            detectedAt = new Date();
          }

          const signal: RawSignal = {
            sourceType,
            sourceUrl: link || config.feedUrl,
            sourceTitle: `${config.displayName}: ${cleanTitle}`,
            signalType: "mention",
            topic,
            rawStrength: 0, // filled below
            rawData: {
              feedName: config.name,
              headline: cleanTitle,
              description,
              publishedAt: pubRaw,
              tags: config.tags ?? [],
            },
            detectedAt,
          };
          signal.rawStrength = computeSignalStrength(signal);
          signals.push(signal);
        }

        return signals;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[${config.name}] fetchSignals failed: ${msg}`);
        return [];
      }
    },
  };
}
