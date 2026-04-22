#!/usr/bin/env tsx
/**
 * source-metadata-test — unit test for src/lib/source-metadata.ts.
 *
 * Backlog-Task "STEEP+V Ontologie" (2026-04-21): das Modul ist die
 * Single-Source-of-Truth für per-Connector STEEP+V + Trend-Level
 * Klassifizierung. Wenn hier etwas driftet, verrutscht das ganze
 * Filter-/Analyse-/Display-System. Der Test pinnt:
 *
 *   - getSourceMetadata resolves known sources exactly
 *   - Fallback für unbekannte Quellen ist stabil (values + signal)
 *   - Case-Insensitivity funktioniert
 *   - Jede STEEP+V-Bucket und jedes Trend-Level ist in mindestens einem
 *     Source-Eintrag vertreten (Abdeckungscheck gegen versehentliches
 *     Kollabieren der Taxonomie)
 *   - Social/Proxy-Tiers enthalten die erwarteten überangepassten Fälle
 *
 * Run: `npx tsx scripts/source-metadata-test.ts`
 */

import {
  getSourceMetadata,
  summariseSourceDistribution,
  SOURCE_METADATA,
  type TrendLevel,
} from "../src/lib/source-metadata";
import type { SteepVKey } from "../src/lib/source-taxonomy";

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
//  getSourceMetadata — known-source lookup
// ═══════════════════════════════════════════════════════════════════════
section("getSourceMetadata — known sources");

{
  const un = getSourceMetadata("un_sdg");
  assert(un.steepV === "values", "UN SDG → values (SDGs sind Werte-Framework)");
  assert(un.trendLevel === "mega", "UN SDG → mega");

  const worldbank = getSourceMetadata("worldbank");
  assert(worldbank.steepV === "economic", "World Bank → economic");
  assert(worldbank.trendLevel === "mega", "World Bank → mega");

  const arxiv = getSourceMetadata("arxiv");
  assert(arxiv.steepV === "technological", "arxiv → technological");
  assert(arxiv.trendLevel === "micro", "arxiv → micro");

  const bluesky = getSourceMetadata("bluesky");
  assert(bluesky.steepV === "social", "Bluesky → social");
  assert(bluesky.trendLevel === "signal", "Bluesky → signal");

  const polymarket = getSourceMetadata("polymarket");
  assert(polymarket.steepV === "economic", "Polymarket → economic");
  assert(polymarket.trendLevel === "signal", "Polymarket → signal");
}

// ═══════════════════════════════════════════════════════════════════════
//  getSourceMetadata — fallback & case handling
// ═══════════════════════════════════════════════════════════════════════
section("getSourceMetadata — fallback + case");

{
  const fallback = getSourceMetadata("some_unknown_source");
  assert(fallback.steepV === "values", "unknown source → values (sichtbar aber harmlos)");
  assert(fallback.trendLevel === "signal", "unknown source → signal (konservativer Default)");

  const empty = getSourceMetadata("");
  assert(empty.steepV === "values" && empty.trendLevel === "signal", "empty → default metadata");

  const upper = getSourceMetadata("BLUESKY");
  assert(upper.steepV === "social", "uppercase lookup falls back to lowercase");
  assert(upper.trendLevel === "signal", "uppercase lookup preserves trendLevel");
}

// ═══════════════════════════════════════════════════════════════════════
//  Coverage — every STEEP+V bucket and every TrendLevel is populated
// ═══════════════════════════════════════════════════════════════════════
section("Coverage — taxonomy completeness");

{
  const summary = summariseSourceDistribution();
  assert(summary.total === Object.keys(SOURCE_METADATA).length, "summary total == registry size");

  const steepVKeys: SteepVKey[] = ["social", "technological", "economic", "environmental", "political", "values"];
  for (const key of steepVKeys) {
    assert(summary.bySteepV[key] > 0, `STEEP+V "${key}" has at least one source`);
  }

  const levels: TrendLevel[] = ["mega", "macro", "micro", "signal"];
  for (const lvl of levels) {
    assert(summary.byTrendLevel[lvl] > 0, `trend-level "${lvl}" has at least one source`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Regression — overfit cases from the 2026-04-21 Signal-Kettenbezug-Bug
//  must stay correctly tiered
// ═══════════════════════════════════════════════════════════════════════
section("Regression — Signal-Kettenbezug-Bug specifically");

{
  // Die drei Source-Typen, die im Wien-/Wintersport-Bug falsch als
  // „evidence" durchgegangen waren:
  const bluesky = getSourceMetadata("bluesky");
  const mastodon = getSourceMetadata("mastodon_api");
  const polymarket = getSourceMetadata("polymarket");
  const ngram = getSourceMetadata("google-ngram");

  assert(bluesky.steepV === "social", "Bluesky remains social (triggert strengste Filter)");
  assert(mastodon.steepV === "social", "Mastodon remains social");
  assert(polymarket.steepV === "economic", "Polymarket remains economic (proxy-level, nicht authoritative)");
  assert(polymarket.trendLevel === "signal", "Polymarket remains signal-level");
  assert(ngram.steepV === "values", "Google Ngram remains values (cultural macro)");

  // Die autoritativen Gegenstücke müssen mega/macro bleiben, damit
  // der Filter sie nicht als schwach klassifiziert.
  const un = getSourceMetadata("un_sdg");
  const ipcc = getSourceMetadata("worldbank"); // IPCC nicht direkt gemappt; wb als Mega-Proxy
  assert(un.trendLevel === "mega", "UN SDG stays mega (authoritative long-horizon)");
  assert(ipcc.trendLevel === "mega", "World Bank stays mega");
}

// ═══════════════════════════════════════════════════════════════════════
//  Google News Wärmepumpe (C-Pilot Connector)
// ═══════════════════════════════════════════════════════════════════════
section("google_news_wp_de — C-Pilot Wärmepumpen Connector");

{
  const wp = getSourceMetadata("google_news_wp_de");
  assert(wp.steepV === "environmental", "google_news_wp_de → environmental (Wärmepumpen = Energie/Klima)");
  assert(wp.trendLevel === "signal", "google_news_wp_de → signal-level (tagesaktuelle Presseartikel)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
