#!/usr/bin/env tsx
/**
 * signal-topic-fit-test — pinn die Resolution-Chain und backwards-compat
 * für `signalTopicalFit` (src/lib/signal-topic-fit.ts).
 *
 * Background: am 2026-04-23 wurde dieselbe Topic-Fit-Logik in zwei
 * Dateien unabhängig implementiert (OrbitDerivationView und
 * BriefingResult). Sie war konsistent — bis vermutlich nicht mehr. Im
 * Hygiene-Pass nach dem Iteration-Loop-Build wurde sie als Single
 * Source of Truth extrahiert und mit Tests pinned.
 *
 * Besonders wichtig: backwards-compat für ÄLTERE BRIEFINGS, die NONE
 * der neuen Schema-Felder (displayScore, passReason, llmRelevanceScore,
 * llmRelevanceReason) haben. Konkret: in der DB lagen bei diesem Test
 * 37 Briefings vom 2026-04-18 bis 2026-04-22 — die ältesten haben
 * weder keywordOverlap noch sourceTier noch sonst was außer source +
 * title. Diese müssen sauber den 0.3-Default treffen, nicht crashen.
 *
 * Run: `npx tsx scripts/signal-topic-fit-test.ts`
 */

import { signalTopicalFit, TOPIC_FIT_DEFAULT } from "../src/lib/signal-topic-fit";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// ═══════════════════════════════════════════════════════════════════════
//  Default constant + null-safety
// ═══════════════════════════════════════════════════════════════════════
section("Defaults + null-safety");

{
  assert(TOPIC_FIT_DEFAULT === 0.3, "TOPIC_FIT_DEFAULT is 0.3");
  assert(signalTopicalFit(null) === 0.3, "null input → default");
  assert(signalTopicalFit(undefined) === 0.3, "undefined input → default");
  assert(signalTopicalFit({}) === 0.3, "empty object → default (no fields present)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Resolution priority — most-trusted field wins
// ═══════════════════════════════════════════════════════════════════════
section("Resolution priority — LLM-judged wins all");

{
  const all = {
    llmRelevanceScore: 8,    // → 0.8
    queryRelevance: 0.6,
    displayScore: 0.55,
    keywordOverlap: 0.20,
  };
  assert(signalTopicalFit(all) === 0.8, "all fields present → llmRelevanceScore wins (8/10 = 0.8)");
}

section("Resolution priority — falls through correctly");

{
  const noLLM = { queryRelevance: 0.6, displayScore: 0.55, keywordOverlap: 0.20 };
  assert(signalTopicalFit(noLLM) === 0.6, "no LLM → queryRelevance (0.6)");
}

{
  const onlyDisplay = { displayScore: 0.55, keywordOverlap: 0.20 };
  assert(signalTopicalFit(onlyDisplay) === 0.55, "no LLM/queryRelevance → displayScore (0.55)");
}

{
  const onlyOverlap = { keywordOverlap: 0.20 };
  assert(signalTopicalFit(onlyOverlap) === 0.20, "only keywordOverlap → uses it (0.20)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Backwards-compat: ÄLTERE BRIEFINGS (DB-realistischer Fall)
// ═══════════════════════════════════════════════════════════════════════
section("Backwards-compat — old briefings (pre-2026-04-21 schema)");

{
  // Wirkliches Datenmuster aus den ältesten Briefings (2026-04-18):
  // weder keywordOverlap noch displayScore — nur source + title.
  // Aus Sicht der Topic-Fit-Funktion: das object ist effektiv leer.
  const oldestSignal = { source: "hackernews", title: "AI agents reshape research" };
  assert(signalTopicalFit(oldestSignal as any) === 0.3, "oldest briefing format → default 0.3");
}

{
  // Briefings vom 2026-04-21 hatten schon keywordOverlap aber noch
  // KEIN displayScore/passReason/llmRelevanceScore.
  const apr21Signal = { keywordOverlap: 0.45, sourceTier: "media" };
  assert(signalTopicalFit(apr21Signal as any) === 0.45, "Apr-21 briefing → uses keywordOverlap (0.45)");
}

{
  // Briefings vom 2026-04-23 (gleicher Tag dieser Test) sollten
  // displayScore haben.
  const apr23Signal = { displayScore: 0.50, keywordOverlap: 0.07, passReason: "long-domain-anchor" };
  assert(signalTopicalFit(apr23Signal as any) === 0.50, "Apr-23 briefing → uses displayScore (0.50, not raw overlap 0.07)");
}

{
  // Briefings nach Pass-2-Build (gleicher Tag, später) sollten
  // llmRelevanceScore haben.
  const postPass2Signal = {
    llmRelevanceScore: 7,
    displayScore: 0.50,
    keywordOverlap: 0.07,
    passReason: "long-domain-anchor",
    llmRelevanceReason: "directly relevant",
  };
  assert(signalTopicalFit(postPass2Signal as any) === 0.7, "post-Pass-2 → uses llmRelevanceScore (7/10 = 0.7)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Defensive validation — out-of-range falls through, doesn't clamp silently
// ═══════════════════════════════════════════════════════════════════════
section("Defensive validation — out-of-range falls through");

{
  // llmRelevanceScore must be 0-10. Out-of-range → falls through to next
  // tier rather than silently clamping.
  const badLLM = { llmRelevanceScore: 15, queryRelevance: 0.6 };
  assert(signalTopicalFit(badLLM) === 0.6, "llmRelevanceScore=15 (out of 0-10) → falls through to queryRelevance");
}

{
  const negLLM = { llmRelevanceScore: -2, queryRelevance: 0.6 };
  assert(signalTopicalFit(negLLM) === 0.6, "llmRelevanceScore=-2 → falls through");
}

{
  // queryRelevance must be 0-1. Out-of-range → falls through.
  const badQR = { queryRelevance: 1.5, displayScore: 0.55 };
  assert(signalTopicalFit(badQR) === 0.55, "queryRelevance=1.5 (out of 0-1) → falls through to displayScore");
}

{
  // Same for displayScore + keywordOverlap
  const badDS = { displayScore: 2.0, keywordOverlap: 0.20 };
  assert(signalTopicalFit(badDS) === 0.20, "displayScore=2.0 → falls through to keywordOverlap");
}

{
  const badKO = { keywordOverlap: -0.5 };
  assert(signalTopicalFit(badKO) === 0.3, "keywordOverlap=-0.5 → falls through to default");
}

// ═══════════════════════════════════════════════════════════════════════
//  Type-defensive — non-number values
// ═══════════════════════════════════════════════════════════════════════
section("Type-defensive — non-number values fall through");

{
  // String values should fall through (typeof check)
  const stringScore = { llmRelevanceScore: "8" as any, queryRelevance: 0.6 };
  assert(signalTopicalFit(stringScore) === 0.6, "string llmRelevanceScore → falls through");
}

{
  // null fields fall through
  const nullField = { llmRelevanceScore: null as any, queryRelevance: 0.6 };
  assert(signalTopicalFit(nullField) === 0.6, "null field → falls through");
}

// ═══════════════════════════════════════════════════════════════════════
//  Edge values — 0 and 1
// ═══════════════════════════════════════════════════════════════════════
section("Edge values — 0 and 1 are valid");

{
  const zero = { displayScore: 0 };
  assert(signalTopicalFit(zero) === 0, "displayScore=0 is valid (not falsy-skipped)");
}

{
  const one = { displayScore: 1 };
  assert(signalTopicalFit(one) === 1, "displayScore=1 is valid (boundary)");
}

{
  const zeroLLM = { llmRelevanceScore: 0 };
  assert(signalTopicalFit(zeroLLM) === 0, "llmRelevanceScore=0 is valid (not falsy-skipped)");
}

{
  const tenLLM = { llmRelevanceScore: 10 };
  assert(signalTopicalFit(tenLLM) === 1, "llmRelevanceScore=10 → 1.0 (boundary)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
