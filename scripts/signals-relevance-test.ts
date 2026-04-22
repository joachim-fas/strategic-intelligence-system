#!/usr/bin/env tsx
/**
 * signals-relevance-test — unit test for the signal-relevance helpers
 * in src/lib/signals.ts.
 *
 * This test protects the 2026-04-21 „Signal-Kettenbezug" fix against
 * regression. Three functions are in scope:
 *
 *   - extractQueryKeywords(query)   — stopword-stripped keyword list
 *   - computeKeywordStats(kw, text) — overlap / weightedOverlap / anchor
 *   - classifySource(source)        — authority-tier classification
 *
 * Runs deterministically without touching the DB (the helpers are pure).
 *
 * Run: `npx tsx scripts/signals-relevance-test.ts`
 */

import {
  extractQueryKeywords,
  computeKeywordStats,
  classifySource,
} from "../src/lib/signals";

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
//  extractQueryKeywords
// ═══════════════════════════════════════════════════════════════════════
section("extractQueryKeywords");

{
  const kw = extractQueryKeywords("Welcher Bezirk in Wien eignet sich am besten für ein Hotel?");
  assert(kw.includes("bezirk"), "extracts 'bezirk' (6 chars)");
  assert(kw.includes("wien"), "extracts 'wien' (4 chars, non-stopword)");
  assert(kw.includes("eignet"), "extracts 'eignet'");
  assert(kw.includes("besten"), "extracts 'besten'");
  assert(kw.includes("hotel"), "extracts 'hotel'");
  assert(!kw.includes("welcher"), "drops stopword 'welcher'");
  assert(!kw.includes("ein"), "drops stopword 'ein'");
  assert(!kw.includes("für"), "drops stopword 'für'");
  assert(!kw.includes("am"), "drops 2-char stopword 'am'");
  assert(!kw.includes("in"), "drops 2-char stopword 'in'");
}

{
  const kw = extractQueryKeywords("AI adoption in European healthcare");
  assert(kw.includes("ai"), "keeps 2-char 'ai' via importantShortTerms");
  assert(kw.includes("adoption"), "extracts 'adoption'");
  assert(kw.includes("european"), "extracts 'european'");
  assert(kw.includes("healthcare"), "extracts 'healthcare'");
  assert(!kw.includes("in"), "drops English stopword 'in'");
}

{
  const kw = extractQueryKeywords("");
  assert(Array.isArray(kw) && kw.length === 0, "empty query → empty array");
}

{
  const kw = extractQueryKeywords("????   ! ! !  ");
  assert(kw.length === 0, "punctuation-only query → empty array");
}

{
  const kw = extractQueryKeywords("Welche Regionen in Europa haben Potenzial zu einer neuen Wintersport-Region zu werden.");
  assert(kw.includes("regionen"), "extracts 'regionen'");
  assert(kw.includes("europa"), "extracts 'europa'");
  assert(kw.includes("potenzial"), "extracts 'potenzial'");
  assert(kw.includes("wintersport"), "extracts 'wintersport'");
  // "werden" is technically in stopwords; we want to verify that.
  assert(!kw.includes("werden"), "drops verb stopword 'werden'");
}

// ═══════════════════════════════════════════════════════════════════════
//  computeKeywordStats — overlap, weightedOverlap, anchorMatched
// ═══════════════════════════════════════════════════════════════════════
section("computeKeywordStats");

{
  const kw = ["bezirk", "wien", "eignet", "hotel"];
  // Signal on-topic for Vienna district hotel question
  const onTopic = computeKeywordStats(kw, "Neues Hotel-Viertel im 7. Bezirk Wien — Standort-Analyse");
  assert(onTopic.matched === 3, "on-topic signal: 3/4 keywords match");
  assert(onTopic.anchorMatched === true, "on-topic signal: anchor matched");
  assert(onTopic.overlap === 0.75, "on-topic signal: overlap == 0.75");
  assert(onTopic.weightedOverlap > 0.5, "on-topic signal: weighted > 0.5");
}

{
  const kw = ["bezirk", "wien", "eignet", "hotel"];
  // Off-topic UN article (like in the original bug)
  const offTopic = computeKeywordStats(kw, "UN News: Why lower fertility does not have to mean economic decline");
  assert(offTopic.matched === 0, "off-topic: 0 keywords match");
  assert(offTopic.anchorMatched === false, "off-topic: no anchor match");
  assert(offTopic.overlap === 0, "off-topic: overlap == 0");
  assert(offTopic.weightedOverlap === 0, "off-topic: weighted == 0");
}

{
  const kw = ["wintersport", "europa", "regionen", "potenzial"];
  // Bluesky babysitter post — the actual overfit case
  const babysitter = computeKeywordStats(kw, "Best babysitter ❤️ our little one just hit 1.2kg");
  assert(babysitter.anchorMatched === false, "babysitter post: no anchor match");
  assert(babysitter.weightedOverlap === 0, "babysitter post: weighted == 0");
}

{
  // Weighted overlap: 'wintersport' (11 chars) weighs more than 'eu' (2 chars)
  const kw = ["eu", "wintersport"];
  const longMatch = computeKeywordStats(kw, "Wintersport-Saison 2026 in Österreich: Überblick");
  const shortMatch = computeKeywordStats(kw, "EU Commission approves new ruling");
  // Both matched 1 keyword, but long word weighted more
  assert(longMatch.matched === 1 && shortMatch.matched === 1, "both: 1/2 keywords");
  assert(longMatch.overlap === shortMatch.overlap, "unweighted overlap: equal");
  assert(longMatch.weightedOverlap > shortMatch.weightedOverlap, "weighted: wintersport > eu");
}

{
  // Anchor rule: keyword ≥ 5 chars must appear
  const kw = ["bezirk", "wien", "eignet", "hotel"]; // 4+ char anchors: bezirk, eignet, hotel
  // Signal matches only short word 'wien' (4 chars — not an anchor by ≥5 rule)
  const onlyShort = computeKeywordStats(kw, "Wien ist super");
  assert(onlyShort.matched === 1, "short-match: 1 keyword");
  assert(onlyShort.anchorMatched === false, "short-match: no anchor (wien is 4, not ≥5)");
}

{
  // Fallback: when no keyword is ≥5, every keyword counts as anchor
  const kw = ["eu", "us", "uk"];
  const anyMatch = computeKeywordStats(kw, "EU commission");
  assert(anyMatch.anchorMatched === true, "no long words → any match counts as anchor");
}

{
  // Empty keywords
  const empty = computeKeywordStats([], "any text");
  assert(empty.matched === 0, "empty keywords: matched = 0");
  assert(empty.overlap === 0, "empty keywords: overlap = 0");
  assert(empty.weightedOverlap === 0, "empty keywords: weighted = 0");
  assert(empty.anchorMatched === false, "empty keywords: no anchor");
}

{
  // Case insensitivity
  const kw = ["wintersport"];
  const upper = computeKeywordStats(kw, "WINTERSPORT in Europe");
  assert(upper.matched === 1, "case insensitive: uppercase matches");
}

// ═══════════════════════════════════════════════════════════════════════
//  classifySource — source tier taxonomy
// ═══════════════════════════════════════════════════════════════════════
section("classifySource");

{
  assert(classifySource("un_sdg") === "authoritative", "UN SDG → authoritative");
  assert(classifySource("ecfr_rss") === "authoritative", "ECFR → authoritative");
  assert(classifySource("imf") === "authoritative", "IMF → authoritative");
  assert(classifySource("eurostat") === "authoritative", "Eurostat → authoritative");

  assert(classifySource("arxiv") === "academic", "arxiv → academic");
  assert(classifySource("crossref") === "academic", "CrossRef → academic");
  assert(classifySource("nature_rss") === "academic", "Nature → academic");

  assert(classifySource("guardian") === "media", "Guardian → media");
  assert(classifySource("nyt") === "media", "NYT → media");
  assert(classifySource("spiegel_rss") === "media", "SPIEGEL → media");

  assert(classifySource("bluesky") === "social", "Bluesky → social");
  assert(classifySource("mastodon_api") === "social", "Mastodon → social");
  assert(classifySource("reddit") === "social", "Reddit → social");

  assert(classifySource("polymarket") === "proxy", "Polymarket → proxy");
  assert(classifySource("google-ngram") === "proxy", "Ngram → proxy");
  assert(classifySource("github") === "proxy", "GitHub → proxy");

  // Heuristic fallback for unmapped sources
  assert(classifySource("some_news_outlet") === "media", "unmapped 'news' → media heuristic");
  assert(classifySource("unknown_rss") === "media", "unmapped '_rss' → media heuristic");
  assert(classifySource("bundesdings") === "media", "fully unknown → media default");

  // Case insensitivity
  assert(classifySource("BLUESKY") === "social", "uppercase BLUESKY → social");
}

// ═══════════════════════════════════════════════════════════════════════
//  Integration: full Wien-Bezirk regression scenario
// ═══════════════════════════════════════════════════════════════════════
section("Integration — Wien-Bezirk regression check");

{
  // Original query from the Notion bug report
  const query = "Welcher Bezirk in Wien eignet sich am besten für ein Hotel?";
  const kw = extractQueryKeywords(query);

  // All three originally-wrongly-matched signals must score 0 topical fit
  const badSignals = [
    "UN News: Why lower fertility does not have to mean economic decline",
    "Al Jazeera (All): US veterans arrested in Capitol during protest",
    "Global dynamics and regime shifts in a resource-consumer model",
    "Best babysitter ❤️",
    "Sunrise this morning here in Glastonbury",
  ];
  for (const text of badSignals) {
    const stats = computeKeywordStats(kw, text);
    assert(
      !stats.anchorMatched || stats.weightedOverlap < 0.25,
      `off-topic signal drops below 0.25 weighted OR has no anchor: "${text.slice(0, 48)}…"`
    );
  }

  // At least one on-topic signal must score high
  const goodSignal = "Wien: Neue Hotel-Eröffnung im 1. Bezirk im Frühjahr 2026";
  const goodStats = computeKeywordStats(kw, goodSignal);
  assert(goodStats.anchorMatched, "on-topic Wien-Hotel signal: anchor matched");
  assert(goodStats.weightedOverlap > 0.4, "on-topic: weighted > 0.4");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
