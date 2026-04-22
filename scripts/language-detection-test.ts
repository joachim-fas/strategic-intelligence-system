#!/usr/bin/env tsx
/**
 * language-detection-test — pinn für detectQueryLanguage.
 *
 * Protects against regressing to the 2026-04-22 Pilot-A-EN bug where
 * a German UI-Locale-Switch caused English queries to come back as
 * German briefings. Fix routed query-language detection through the
 * query text itself, independent of the UI state.
 *
 * Run: `npx tsx scripts/language-detection-test.ts`
 */

import { detectQueryLanguage } from "../src/lib/llm";

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
//  Core EN cases
// ═══════════════════════════════════════════════════════════════════════
section("English queries");

{
  assert(detectQueryLanguage("Which EU countries will be most affected by the fragmentation of global supply chains by 2030 — and what strategic options does Germany have as Europe's industrial backbone?") === "en",
    "Pilot A EN query");
  assert(detectQueryLanguage("How will the European labor market change through autonomous AI agents by 2028?") === "en",
    "Pilot B EN query");
  assert(detectQueryLanguage("What regulatory and economic forces will shape the future of the heat pump industry?") === "en",
    "Pilot C EN query");
  assert(detectQueryLanguage("AI adoption in European healthcare") === "en",
    "short EN noun phrase");
  assert(detectQueryLanguage("The war in Ukraine is reshaping global energy flows") === "en",
    "EN sentence");
}

// ═══════════════════════════════════════════════════════════════════════
//  Core DE cases
// ═══════════════════════════════════════════════════════════════════════
section("German queries");

{
  assert(detectQueryLanguage("Welche EU-Länder werden bis 2030 am stärksten von der Fragmentierung globaler Lieferketten betroffen sein?") === "de",
    "Pilot A DE query");
  assert(detectQueryLanguage("Wie verändert sich der europäische Arbeitsmarkt durch autonome KI-Agenten bis 2028?") === "de",
    "Pilot B DE query");
  assert(detectQueryLanguage("Welche regulatorischen und wirtschaftlichen Kräfte prägen die Zukunft der Wärmepumpen-Industrie?") === "de",
    "Pilot C DE query");
  assert(detectQueryLanguage("Welcher Bezirk in Wien eignet sich am besten für ein Hotel?") === "de",
    "Wien-Bezirk-Regression query");
  assert(detectQueryLanguage("Grüne Wasserstoff-Industrie in Österreich") === "de",
    "umlaut-laden DE noun phrase");
}

// ═══════════════════════════════════════════════════════════════════════
//  Edge cases
// ═══════════════════════════════════════════════════════════════════════
section("Edge cases");

{
  assert(detectQueryLanguage("") === "de", "empty → DE default");
  assert(detectQueryLanguage("AI") === "de", "too short → DE default");
  assert(detectQueryLanguage("KI") === "de", "short DE acronym → DE default");
  // Queries ohne Stopwords UND ohne Umlaut defaulten auf DE — bewusste
  // Design-Wahl für ein EU/DACH-fokussiertes Produkt. Wer „CRISPR
  // therapies" als Query hätte, kriegt DE-Antwort; das ist akzeptabler
  // Zwischenstand, weil im UI weiterhin der Locale-Switch übersteuerbar
  // ist (wenn Frontend in Zukunft mitgibt).
  assert(detectQueryLanguage("CRISPR therapies") === "de",
    "acronym-only query → DE default (no stopwords, no umlaut)");
  // Mixed-language: Satzstruktur (EN-Stopwords) gewinnt, wenn keine
  // Umlaute vorhanden — pragmatisch, Frame dominiert Content.
  assert(detectQueryLanguage("What is the Wirtschaftsleistung of Deutschland 2025?") === "en",
    "mixed EN frame + DE nouns, no umlaut → EN (frame wins)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
