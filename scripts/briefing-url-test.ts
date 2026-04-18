#!/usr/bin/env tsx
/**
 * briefing-url-test — unit test for briefing URL helpers added under
 * Welle A Item 3 (deep-linkable briefing URLs with slug + content hash).
 *
 * Covers the contract:
 *   1. Slug is URL-safe (lowercase kebab, umlauts transliterated).
 *   2. Hash is 8 hex chars, deterministic, and changes with content.
 *   3. Hash is stable when the same (query, synthesis) is hashed twice.
 *   4. parseBriefingSlugHash round-trips a built URL back to its parts.
 *   5. parseBriefingSlugHash rejects malformed input cleanly.
 *
 * Run: `tsx scripts/briefing-url-test.ts` (or `npm run test:briefing-url`).
 */

import {
  briefingSlug,
  briefingHash,
  briefingUrl,
  parseBriefingSlugHash,
} from "../src/lib/briefing-url";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// ─── 1. Slug generation ─────────────────────────────────────────
section("1. briefingSlug — URL-safe slugification");
assert(briefingSlug("Wie entwickelt sich die KI-Regulierung?") === "wie-entwickelt-sich-die-ki-regulierung", "German query → kebab-case");
assert(briefingSlug("Für die Zukunft") === "fuer-die-zukunft", "umlaut ü → ue");
assert(briefingSlug("Über Öl, ähm") === "ueber-oel-aehm", "ü/ö/ä all transliterated");
assert(briefingSlug("Weißt du was?") === "weisst-du-was", "ß → ss");
assert(briefingSlug("Café déjà vu") === "cafe-deja-vu", "accented chars stripped");
assert(briefingSlug("   spaces !!! ~*!") === "spaces", "punct + whitespace collapsed");
assert(briefingSlug("") === "briefing", "empty input → fallback");
assert(briefingSlug("!!!").length > 0, "all-punct input → non-empty fallback");
assert(briefingSlug("a".repeat(100)).length === 60, "60-char cap honoured");
assert(!briefingSlug("A-B-C").endsWith("-"), "no trailing hyphen");

// ─── 2. Hash generation ─────────────────────────────────────────
section("2. briefingHash — FNV-1a 32-bit, 8 hex chars");
const h1 = briefingHash("query", "synthesis");
assert(/^[0-9a-f]{8}$/.test(h1), `hash format correct (got "${h1}")`);
assert(briefingHash("query", "synthesis") === h1, "deterministic on repeat");
assert(briefingHash("query", "synthesi") !== h1, "changes when synthesis changes");
assert(briefingHash("querz", "synthesis") !== h1, "changes when query changes");
assert(briefingHash("", "") === fnv1a32Hex("\u0000"), "empty inputs still produce a valid hash");

// ─── 3. URL round-trip ──────────────────────────────────────────
section("3. briefingUrl + parseBriefingSlugHash round-trip");
const entry = {
  query: "Was bedeutet die EU-KI-Verordnung für deutsche Mittelständler?",
  briefing: { synthesis: "Der AI Act trifft KMUs asymmetrisch..." },
};
const url = briefingUrl(entry);
assert(url.startsWith("/briefing/"), `URL starts with /briefing/ (got "${url}")`);
const afterPrefix = url.replace(/^\/briefing\//, "");
const parsed = parseBriefingSlugHash(afterPrefix);
assert(parsed !== null, "parses back");
assert(parsed?.slug.startsWith("was-bedeutet-die-eu-ki"), `slug preserved (got "${parsed?.slug}")`);
assert(parsed?.hash === briefingHash(entry.query, entry.briefing.synthesis), "hash matches recomputed");
assert(parsed?.hash.length === 8, "hash is 8 chars");

// ─── 4. Parser robustness ───────────────────────────────────────
section("4. parseBriefingSlugHash — invalid input");
assert(parseBriefingSlugHash("") === null, "empty → null");
assert(parseBriefingSlugHash("no-hash-suffix") === null, "missing hash → null");
assert(parseBriefingSlugHash("slug-ZZZZZZZZ") === null, "non-hex hash → null");
assert(parseBriefingSlugHash("slug-abc") === null, "too-short hash → null");
assert(parseBriefingSlugHash("slug-abcdef12abcdef12") === null, "too-long hash → null");
assert(parseBriefingSlugHash("a-12345678")?.slug === "a", "minimal slug parses");
assert(parseBriefingSlugHash("multi-word-slug-abcdef12")?.slug === "multi-word-slug", "multi-word slug: final hyphen before hash");

// ─── 5. Cross-briefing uniqueness (sanity) ──────────────────────
section("5. Hash spread across a realistic corpus");
const samples = [
  { q: "AI regulation in EU", s: "long synthesis 1..." },
  { q: "Energy transition timeline", s: "long synthesis 2..." },
  { q: "Future of work", s: "long synthesis 3..." },
  { q: "Supply chain resilience", s: "long synthesis 4..." },
  { q: "Digital sovereignty", s: "long synthesis 5..." },
];
const hashes = new Set(samples.map((x) => briefingHash(x.q, x.s)));
assert(hashes.size === samples.length, `no collisions across ${samples.length} samples`);

// ─── Summary ────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);

// Inline helper so the "empty inputs" test above can assert the exact
// hash without circular-importing the private `fnv1a32Hex` function.
function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
