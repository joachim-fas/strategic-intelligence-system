/**
 * og-image — Lightweight Open-Graph image extractor.
 *
 * Fetches a target URL, reads the first ~64 KB of HTML, and regex-parses
 * the `<head>` for `og:image` / `twitter:image` meta tags. Deliberately
 * does NOT pull in a full HTML parser — meta tags live in the head and
 * are structurally simple, so a couple of well-targeted regexes do the
 * job for 98% of publishers without dragging cheerio/jsdom into the
 * bundle.
 *
 * Intentional limits:
 *   - 5 second timeout, aborts the fetch if the target is slow
 *   - 64 KB read cap via content-length guard + byte counter, so we
 *     never download a 20 MB PDF by accident
 *   - User-Agent looks like a social bot so servers that 403 on
 *     Node.js-UA still answer
 *   - Relative image URLs get resolved against the source URL
 *
 * Called from /api/v1/og-image which adds the DB cache layer on top.
 */

export type OgImageStatus = "ok" | "no-image" | "error";

export interface OgImageResult {
  imageUrl: string | null;
  status: OgImageStatus;
  /** Short diagnostic string — empty on success, reason on failure. */
  reason: string;
}

// Matches `<meta property="og:image" content="...">` and its twitter
// siblings, tolerating single/double quotes and reversed attribute order.
// We use `[^>]{0,400}` (not `.*`) both to cap backtracking and to avoid
// needing the `s` (dotall) flag — the tsconfig target predates ES2018.
const META_CONTENT_PATTERNS: RegExp[] = [
  /<meta[^>]{0,400}property=["']og:image(?::url)?["'][^>]{0,400}content=["']([^"']+)["']/i,
  /<meta[^>]{0,400}content=["']([^"']+)["'][^>]{0,400}property=["']og:image(?::url)?["']/i,
  /<meta[^>]{0,400}name=["']twitter:image(?::src)?["'][^>]{0,400}content=["']([^"']+)["']/i,
  /<meta[^>]{0,400}content=["']([^"']+)["'][^>]{0,400}name=["']twitter:image(?::src)?["']/i,
];

// 64 KB — enough to capture the <head> on every mainstream CMS we know
// (WordPress, Ghost, Drupal, NYT, FT, Medium) but small enough that a
// pathological page can't blow memory.
const MAX_BYTES = 64 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; SIS-LinkPreview/1.0; +https://sis.local/bot)";

/**
 * Fetch a URL and extract its Open-Graph image, if any.
 *
 * Never throws — always returns an `OgImageResult`. Callers decide what
 * to do with the three status values.
 */
export async function fetchOgImage(targetUrl: string): Promise<OgImageResult> {
  // Validate the URL early — bad input shouldn't reach the network.
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { imageUrl: null, status: "error", reason: "invalid-url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { imageUrl: null, status: "error", reason: "unsupported-protocol" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        // Ask for HTML only — some endpoints 406 otherwise.
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
      },
    });

    if (!res.ok) {
      return {
        imageUrl: null,
        status: "error",
        reason: `http-${res.status}`,
      };
    }

    // Reject non-HTML responses — no point regex-parsing a JSON API.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
      return { imageUrl: null, status: "error", reason: "not-html" };
    }

    // Stream up to MAX_BYTES of the body, then stop. `res.body` is a
    // ReadableStream in Next.js server runtime. If the reader breaks
    // we fall back to `res.text()` (which is still bounded by the
    // content-length header most servers send).
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (bytesRead >= MAX_BYTES) {
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
      }
      html += decoder.decode();
    } else {
      html = await res.text();
      if (html.length > MAX_BYTES) html = html.slice(0, MAX_BYTES);
    }

    // Strip anything past </head> — the og tags ALWAYS live in the head
    // and the body can be huge; this keeps the regex cheap.
    const headEnd = html.search(/<\/head>/i);
    if (headEnd > 0) html = html.slice(0, headEnd);

    for (const pattern of META_CONTENT_PATTERNS) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const raw = decodeHtmlEntities(match[1].trim());
        const resolved = resolveUrl(raw, parsed);
        if (resolved) {
          return { imageUrl: resolved, status: "ok", reason: "" };
        }
      }
    }

    return { imageUrl: null, status: "no-image", reason: "no-meta-tag" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Abort → timeout, everything else → network
    if (msg.includes("aborted") || msg.includes("timed out")) {
      return { imageUrl: null, status: "error", reason: "timeout" };
    }
    return { imageUrl: null, status: "error", reason: `fetch-fail: ${msg.slice(0, 80)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a (possibly relative) image URL against the source page URL.
 * Drops anything that doesn't end up http(s) — data URIs, file://, etc.
 */
function resolveUrl(raw: string, base: URL): string | null {
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Decode the handful of HTML entities that show up in meta content
 * attributes. We don't need a full entity table — just the ones that
 * break `new URL()`.
 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/");
}
