#!/usr/bin/env tsx
/**
 * reference-verification-test — smoke test for the two-stage reference
 * verification added 2026-04-22 after Pilot-Eval A DE:
 *
 *   1. URL domain match against KNOWN_DOMAINS (primary path)
 *   2. Title pattern match against TRUSTED_TITLE_PATTERNS (fallback
 *      for URL-less refs, because the system prompt forbids URL
 *      invention — so authoritative citations routinely arrive title-only)
 *
 * Protects against regressing to "all refs show `?` even when real"
 * (the state Pilot A DE caught in the wild).
 *
 * Run: `npx tsx scripts/reference-verification-test.ts`
 */

import { validateLLMResponse } from "../src/lib/validation";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

function makeResponse(refs: Array<{ title: string; url?: string }>): unknown {
  return {
    synthesis: "x",
    matchedTrendIds: [],
    keyInsights: [],
    regulatoryContext: [],
    causalAnalysis: [],
    scenarios: [],
    references: refs.map(r => ({ title: r.title, url: r.url ?? "" })),
    followUpQuestions: [],
    confidence: 0.5,
  };
}

const validTrendIds = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════
//  Title-only (URL-less) verification — the Pilot-Eval-A bug
// ═══════════════════════════════════════════════════════════════════════
section("title-only refs — authoritative publications");

{
  // The five actual titles from Pilot-Eval A DE, all URL-less
  const { data } = validateLLMResponse(
    makeResponse([
      { title: "EU Critical Raw Materials Act (2024)" },
      { title: "European Commission Strategic Autonomy" },
      { title: "BDI Study Standort Deutschland 2026" },
      { title: "IMF World Economic Outlook October 2025" },
      { title: "EU JRC Megatrends: Geopolitical Fragmentation" },
    ]),
    validTrendIds,
  );
  const refs = data.references as Array<{ title: string; verified?: boolean }>;
  for (const r of refs) {
    assert(r.verified === true, `"${r.title.slice(0, 40)}…" is verified via title`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  URL-based verification (primary path, must keep working)
// ═══════════════════════════════════════════════════════════════════════
section("URL-based verification — primary path");

{
  const { data } = validateLLMResponse(
    makeResponse([
      { title: "Example", url: "https://eur-lex.europa.eu/eli/reg/2024/1252" },
      { title: "Example", url: "https://www.imf.org/en/Publications/WEO" },
      { title: "Example", url: "https://knowledge4policy.ec.europa.eu/foresight" },
      { title: "Example", url: "https://www.bdi.eu/publikationen" },
      { title: "Example", url: "https://www.bundesregierung.de/breg-de" },
    ]),
    validTrendIds,
  );
  const refs = data.references as Array<{ verified?: boolean; url: string }>;
  for (const r of refs) {
    assert(r.verified === true, `URL match: ${r.url}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Non-authoritative refs must stay unverified
// ═══════════════════════════════════════════════════════════════════════
section("non-authoritative refs stay unverified");

{
  const { data } = validateLLMResponse(
    makeResponse([
      { title: "Some Random Blog Post" },
      { title: "Medium article on ai by user42" },
      { title: "Unknown Source 2024" },
      { title: "Example URL", url: "https://some-random-blog.com/ai-takeover" },
    ]),
    validTrendIds,
  );
  const refs = data.references as Array<{ title: string; verified?: boolean }>;
  for (const r of refs) {
    assert(r.verified !== true, `"${r.title}" stays unverified`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Edge: short title, empty title
// ═══════════════════════════════════════════════════════════════════════
section("edge cases");

{
  const { data } = validateLLMResponse(
    makeResponse([
      { title: "" },       // empty — must not crash
      { title: "EU" },     // too short to pattern-match
      { title: "IMF" },    // too short
    ]),
    validTrendIds,
  );
  const refs = data.references as Array<{ title: string; verified?: boolean }>;
  assert(refs[0].verified !== true, "empty title stays unverified");
  assert(refs[1].verified !== true, "'EU' too short to verify");
  assert(refs[2].verified !== true, "'IMF' alone too short to verify");
}

// ═══════════════════════════════════════════════════════════════════════
//  URL priority over title: URL hits allowlist → verified, even if
//  title wouldn't pattern-match
// ═══════════════════════════════════════════════════════════════════════
section("URL match wins even without title pattern");

{
  const { data } = validateLLMResponse(
    makeResponse([
      { title: "Custom study", url: "https://www.imf.org/special-report" },
    ]),
    validTrendIds,
  );
  const refs = data.references as Array<{ verified?: boolean }>;
  assert(refs[0].verified === true, "URL on allowlist wins");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
