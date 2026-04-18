/**
 * Briefing URL helpers — slug + content-hash.
 *
 * Welle A Item 3 of the 4-app Deep-Dive: Theia's `/article/{slug}-{8-char-hash}`
 * pattern. The hash makes the URL:
 *   1. Collision-resistant when two briefings end up with the same slug
 *      (e.g. two queries slugifying to "ki-regulierung").
 *   2. Stale-detectable when the briefing content gets rewritten — the
 *      hash changes, so links to the old version can be recognised and
 *      either redirected or flagged.
 *   3. Human-scannable: "ki-regulierung-a3b7f2c4" is readable and
 *      shareable, unlike a raw UUID.
 *
 * Hash choice: FNV-1a 32-bit, rendered as 8 lowercase hex chars. Not
 * cryptographically strong — we just need deterministic 32-bit spread
 * across ~10s to low 1000s of briefings, which FNV-1a handles with
 * extremely low collision rates. It's pure JS, sync, works in both
 * browser and Node, and takes ~15 lines of code. A SHA-1 prefix would
 * be cleaner cryptographically but requires async `crypto.subtle` on
 * the web side, which is awkward for inline URL generation.
 *
 * Shape: `/briefing/{slug}-{hash}`
 *   slug = lowercase kebab-case of the original query, trimmed to
 *          60 chars max. Non-ASCII letters are stripped (German
 *          umlauts are transliterated: ä→ae, ö→oe, ü→ue, ß→ss).
 *   hash = 8-char lowercase hex of FNV-1a(query + "\u0000" + synthesis).
 *          The null separator prevents trivial prefix-collision attacks
 *          (not that we're adversarial — just principled).
 */

/**
 * FNV-1a 32-bit hash, returned as 8-char lowercase hex string.
 * Reference: http://isthe.com/chongo/tech/comp/fnv/
 */
function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5; // 2166136261 — FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime = 16777619. We multiply in the 32-bit modular domain
    // by shifting: h * 16777619 = h + (h << 1) + (h << 4) + (h << 7) +
    // (h << 8) + (h << 24). Avoids BigInt for speed.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Turn a query/title into a URL-safe slug. Handles German umlauts and
 * strips anything that isn't [a-z0-9-]. Trimmed to 60 chars to keep
 * URLs reasonable (Theia caps at ~50, we allow a bit more for German
 * compound nouns).
 */
export function briefingSlug(queryOrTitle: string): string {
  if (!queryOrTitle) return "briefing";
  const transliterated = queryOrTitle
    .toLowerCase()
    // German umlauts — transliterate before the [a-z] strip, otherwise
    // "für" becomes "fr" instead of "fuer".
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    // Generic diacritic strip for other accented chars (é → e, etc.)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, "-") // collapse all non-slug chars to hyphens
    .replace(/^-+|-+$/g, "")      // trim leading/trailing hyphens
    .slice(0, 60)                  // cap length
    .replace(/-+$/g, "");          // retrim after slice (might have cut mid-hyphen)

  return slug || "briefing";
}

/**
 * Generate the 8-char hash for a briefing. Takes the query and the
 * full synthesis text; any content change invalidates the hash.
 */
export function briefingHash(query: string, synthesis: string): string {
  return fnv1a32Hex(`${query}\u0000${synthesis}`);
}

/**
 * Build the canonical URL for a briefing entry. The entry shape
 * matches `DEMO_BRIEFINGS` and the at-rest briefing structure from
 * the query API.
 */
export function briefingUrl(entry: {
  query: string;
  briefing: { synthesis?: string };
}): string {
  const slug = briefingSlug(entry.query);
  const hash = briefingHash(entry.query, entry.briefing.synthesis ?? "");
  return `/briefing/${slug}-${hash}`;
}

/**
 * Parse the `[slugHash]` dynamic route parameter. Returns `null` if
 * the shape doesn't look like a slug-hash pair (missing trailing
 * 8-hex-char suffix).
 *
 * We accept the parameter permissively — consumers can look up a
 * briefing by slug alone and validate the hash separately, or treat
 * a hash-only lookup as a fallback.
 */
export function parseBriefingSlugHash(param: string): { slug: string; hash: string } | null {
  if (!param) return null;
  // Match "<slug>-<8 hex chars>" with the hash anchored to end-of-string.
  const m = param.match(/^(.+)-([0-9a-f]{8})$/);
  if (!m) return null;
  return { slug: m[1], hash: m[2] };
}
