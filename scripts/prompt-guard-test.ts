#!/usr/bin/env tsx
/**
 * prompt-guard-test — strukturelle Assertions für den System-Prompt.
 *
 * Schützt gegen Regression des 2026-04-22-Pilot-Befunds: bei leerem
 * Signal-Pool degenerierte der LLM zu synthesis-only-Output (alle
 * strukturierten Felder leer). Fix war, im Prompt eine explizite
 * "Zero-Signal Fallback"-Sektion einzufügen, die auch bei 0 Signalen
 * strukturierte Felder erzwingt.
 *
 * Dieser Test prüft den gebauten Prompt-Text auf das Vorhandensein der
 * Guard-Klauseln — ohne LLM-Call. Er kostet nichts und fängt zukünftige
 * Prompt-Edits ab, die die Guards versehentlich entfernen würden.
 *
 * End-to-End-Verifikation (tatsächlich strukturierte Response bei 0
 * Signalen) erfolgt manuell über einen UI-Re-Run der C-DE-Query.
 *
 * Run: `npx tsx scripts/prompt-guard-test.ts`
 */

import { buildSystemPrompt } from "../src/lib/llm";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// Minimaler TrendDot-Mock, reicht für Prompt-Bau
const mockTrends = [
  { id: "mock-trend-1", name: "Mock Trend 1", category: "Technology", ring: "watch", relevance: 0.8, confidence: 0.7, impact: 0.6, velocity: "stable", signalCount: 3, tags: [] },
  { id: "mock-trend-2", name: "Mock Trend 2", category: "Economy", ring: "near", relevance: 0.7, confidence: 0.6, impact: 0.5, velocity: "accelerating", signalCount: 5, tags: [] },
  { id: "mock-trend-3", name: "Mock Trend 3", category: "Politics", ring: "here", relevance: 0.9, confidence: 0.8, impact: 0.7, velocity: "stable", signalCount: 2, tags: [] },
] as any;

// ═══════════════════════════════════════════════════════════════════════
//  Zero-Signal-Fallback Guard — DE-Prompt
// ═══════════════════════════════════════════════════════════════════════
section("Zero-Signal-Fallback (DE-Query)");

{
  const prompt = buildSystemPrompt(
    mockTrends,
    "de",
    undefined, // <-- kein Signal-Kontext, simuliert 0-Signal-Fall
    "Wie entwickelt sich die Wärmepumpen-Industrie bis 2030?"
  );

  assert(
    /Zero-Signal Fallback/i.test(prompt),
    "Prompt enthält 'Zero-Signal Fallback'-Section-Heading"
  );
  assert(
    /HARD CONTRACT/i.test(prompt),
    "Section ist als HARD CONTRACT markiert (nicht als Soft-Suggestion)"
  );
  assert(
    /non-negotiable/i.test(prompt),
    "Explizit 'non-negotiable' für den Guard"
  );

  // Pflichtfelder-Auflistung
  assert(
    prompt.includes("scenarios") && prompt.includes("three primary scenarios"),
    "scenarios explizit als Pflichtfeld auch ohne Signale"
  );
  assert(
    prompt.includes("keyInsights") && /at least three concrete/.test(prompt),
    "keyInsights (≥3) explizit als Pflichtfeld"
  );
  assert(
    prompt.includes("references") && /at least three authoritative/.test(prompt),
    "references (≥3) explizit als Pflichtfeld"
  );
  assert(
    prompt.includes("decisionFramework") && /3-5 concrete decision points/.test(prompt),
    "decisionFramework explizit als Pflichtfeld"
  );
  assert(
    /followUpQuestions/.test(prompt) && /three sharpening/.test(prompt),
    "followUpQuestions (3) explizit als Pflichtfeld"
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  FORBIDDEN-Klauseln
// ═══════════════════════════════════════════════════════════════════════
section("FORBIDDEN-Klauseln gegen synthesis-only-Collapse");

{
  const prompt = buildSystemPrompt(mockTrends, "de", undefined, "Strategische Frage?");

  assert(
    /FORBIDDEN on strategic questions/i.test(prompt),
    "FORBIDDEN-Section für strategische Fragen"
  );
  assert(
    /only a populated .*synthesis.* field with empty arrays/i.test(prompt),
    "Explizit verboten: nur synthesis gefüllt + alle anderen leer"
  );
  assert(
    /HARD FAILURE/i.test(prompt),
    "synthesis-only als HARD FAILURE markiert"
  );
  assert(
    /Packing the entire analysis into the synthesis text/i.test(prompt),
    "Explizit verboten: Analyse komplett in synthesis-Markdown packen"
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Escape-Hatch `scenarios: {}` nur für trivial-factual
// ═══════════════════════════════════════════════════════════════════════
section("Escape-Hatch-Einschränkung");

{
  const prompt = buildSystemPrompt(mockTrends, "de", undefined, "Query");

  assert(
    /TRIVIALLY FACTUAL/i.test(prompt),
    "Escape-Hatch scenarios: {} nur für TRIVIALLY FACTUAL markiert"
  );
  assert(
    /does NOT apply to strategic questions with sparse signal coverage/i.test(prompt),
    "Escape-Hatch explizit NICHT für signal-arme strategische Fragen"
  );
  assert(
    /STRATEGIC even when live signals are missing/i.test(prompt),
    "Strategische Fragen bleiben strategisch auch ohne Signale"
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Signal-vollem Prompt: Guard muss auch dort drin sein (defensiv)
// ═══════════════════════════════════════════════════════════════════════
section("Guard ist auch im signal-reichen Prompt vorhanden");

{
  const richSignalsContext = `
<live_signals>
- [SIGNAL: ecfr_rss, 2026-04-20] Sample signal 1
- [SIGNAL: un_sdg, 2026-04-19] Sample signal 2
- [SIGNAL: bruegel, 2026-04-18] Sample signal 3
</live_signals>
`;
  const prompt = buildSystemPrompt(
    mockTrends,
    "de",
    richSignalsContext,
    "Was ist die Zukunft der EU-Lieferketten?"
  );

  assert(
    /Zero-Signal Fallback/i.test(prompt),
    "Guard bleibt aktiv auch bei Signal-reichem Prompt (defensiv gegen Signal-Qualitäts-Degradation)"
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Positionierung: Guard steht VOR dem JSON-Schema
// ═══════════════════════════════════════════════════════════════════════
section("Strukturelle Position des Guards");

{
  const prompt = buildSystemPrompt(mockTrends, "de", undefined, "Query");

  const guardIdx = prompt.indexOf("Zero-Signal Fallback");
  const schemaIdx = prompt.indexOf("Response Format (JSON");

  assert(
    guardIdx > 0 && schemaIdx > 0,
    "Guard-Section und Schema-Section beide vorhanden"
  );
  assert(
    guardIdx < schemaIdx,
    "Guard-Section steht VOR der Schema-Definition (wird zuerst gelesen)"
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
