/**
 * Trend ↔ Live-Signal Matching
 *
 * The Knowledge Cockpit (/cockpit), Radar and Trends grid read
 * `signalCount` / `signalCount72h` from the trends API. Those values
 * come from this module's matchers, which bridge the loose naming of
 * `live_signals.topic` / `live_signals.tags` with the canonical
 * `trends.name`, `trends.slug` and `trends.tags`.
 *
 * Why we need more than exact-match:
 * - Connectors emit `topic = "Rust"` but the trend is `Rust / rust` — exact hits.
 * - But `topic = "LLM"` should ALSO light up "Generative AI & Foundation Models"
 *   (tag intersection on ["llm","generative"]).
 * - And `topic = "Robotics"` should light up "Mobility & Autonomous Transport"
 *   or "AI Agents & Autonomous Systems" via tag overlap.
 *
 * The matching strategy in priority order:
 *   1. Exact match of live.topic against trend.slug / trend.id / trend.name
 *      (case-insensitive)
 *   2. Tag intersection: at least ONE normalized tag in live.tags matches
 *      ANY normalized trend tag (including synthesized tags from the name)
 *   3. Substring of the live signal title against trend name tokens
 *      (length >= 4) — only if (1) and (2) yield nothing for that trend.
 *
 * All comparisons are lowercase, stripped of hyphens / non-alphanumerics,
 * so `"Generative AI & Foundation Models"`, `"generative-ai"`,
 * `"Generative AI"` and tag `"generative-ai"` all collapse to the same
 * bucket.
 */

// ────────────────────────────────────────────────────────────────────────────
// Normalization
// ────────────────────────────────────────────────────────────────────────────

/** Strip punctuation, lowercase, collapse whitespace. */
export function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Slug-like comparison key: letters+digits only. */
export function slugKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Splits a name into meaningful tokens (>= 3 chars, skipping connectors). */
export function nameTokens(name: string): string[] {
  const stop = new Set([
    "the", "and", "of", "for", "with", "in", "to", "a", "an", "&",
    "der", "die", "das", "und", "oder", "bei", "auf", "von", "mit",
  ]);
  return normalizeToken(name)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stop.has(t));
}

// ────────────────────────────────────────────────────────────────────────────
// Trend side: build a compact index per trend
// ────────────────────────────────────────────────────────────────────────────

export interface TrendIndexRow {
  id: string;
  slug: string;
  name: string;
  /** All tokens we will accept as "this trend" from a signal. */
  keys: Set<string>;
  /** Tokens (>=3 chars) from the name, for substring fallback. */
  nameTokens: string[];
}

export interface TrendLike {
  id: string;
  slug: string;
  name: string;
  tags?: string[] | null;
}

/** Build a per-trend index once per API request. */
export function buildTrendIndex(trends: TrendLike[]): TrendIndexRow[] {
  return trends.map((t) => {
    const keys = new Set<string>();
    // 1. slug / id / name identifiers
    keys.add(slugKey(t.slug));
    keys.add(slugKey(t.id));
    keys.add(slugKey(t.name));
    // 2. explicit tags
    const tags = Array.isArray(t.tags) ? t.tags : [];
    for (const tag of tags) {
      if (!tag) continue;
      const k = slugKey(String(tag));
      if (k.length >= 2) keys.add(k);
    }
    // 3. name tokens (single-word synonyms, e.g. "AI" from "Artificial Intelligence")
    for (const tok of nameTokens(t.name)) {
      const k = slugKey(tok);
      if (k.length >= 3) keys.add(k);
    }
    // Drop the trivial empty key if any slot produced nothing
    keys.delete("");
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      keys,
      nameTokens: nameTokens(t.name),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Signal side: extract its match keys
// ────────────────────────────────────────────────────────────────────────────

/** Parse a tags column that can be JSON-string or already an array. */
export function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    // comma-separated fallback
    return trimmed.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

export interface SignalLike {
  topic: string | null;
  tags: string | null;
  title?: string | null;
}

/** All lowercase slug-keys a signal should be matched against. */
export function signalKeys(s: SignalLike): Set<string> {
  const out = new Set<string>();
  if (s.topic) out.add(slugKey(s.topic));
  for (const tag of parseTags(s.tags)) out.add(slugKey(tag));
  out.delete("");
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Matching
// ────────────────────────────────────────────────────────────────────────────

/**
 * Does signal belong to trend?  Returns true if:
 *   - any signal key is in trend keys, OR
 *   - any name token appears as substring in the (lowercased) title.
 */
export function matchesTrend(
  trend: TrendIndexRow,
  sigKeys: Set<string>,
  titleLower: string | null,
): boolean {
  // 1. Key intersection
  for (const k of sigKeys) {
    if (trend.keys.has(k)) return true;
  }
  // 2. Title substring fallback (only if we have a real title)
  if (titleLower) {
    for (const tok of trend.nameTokens) {
      if (tok.length >= 4 && titleLower.includes(tok)) return true;
    }
  }
  return false;
}
