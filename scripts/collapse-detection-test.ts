#!/usr/bin/env tsx
/**
 * collapse-detection-test — pinn für detectSynthesisOnlyCollapse +
 * buildCollapseRetryMessage.
 *
 * Pilot-Eval 2026-04-22: Claude Sonnet 4.5 ignoriert den Zero-Signal-
 * Fallback-Guard nicht-deterministisch. Fix: Post-Validator erkennt
 * den Collapse anhand strukturierter Response-Metriken und triggert
 * einen Retry mit verstärkter User-Message. Dieser Test pinnt die
 * Erkennungs-Heuristik auf realistische Response-Payloads.
 *
 * Run: `npx tsx scripts/collapse-detection-test.ts`
 */

import {
  detectSynthesisOnlyCollapse,
  buildCollapseRetryMessage,
} from "../src/lib/collapse-detection";

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
//  Produktions-Fälle aus der Pilot-Eval
// ═══════════════════════════════════════════════════════════════════════
section("Realer B-DE-Collapse (aus Pilot-Eval 2026-04-22)");

{
  const realBDeResponse = {
    synthesis:
      "Der europäische Arbeitsmarkt steht bis 2028 nicht vor einer graduellen Automatisierungswelle, sondern vor einem qualitativen Strukturbruch: Autonome KI-Agenten sind anders als frühere Automatisierungswellen in der Lage, kognitive Routinen zu übernehmen, die bislang als menschliche Domäne galten (Analyse, Koordination, Dokumentation, Entscheidungsvorbereitung). Die Branchenexposition verteilt sich hochgradig ungleich — Hochexponiert (>50% der Tasks agentisierbar bis 2028) sind Finanzdienstleistungen (Back-Office, Compliance, Reporting), Business Process Services, Versicherungen, öffentliche Verwaltung, Rechts- und Steuerberatung im Standardsegment. Der kritischste Befund ist nicht technologischer, sondern institutioneller Natur: Die Transformationsgeschwindigkeit autonomer KI-Agenten übersteigt bereits heute die Reaktionsgeschwindigkeit europäischer Bildungs- und Sozialsysteme.",
    reasoningChains: [],
    keyInsights: [],
    regulatoryContext: [],
    causalChain: [],
    scenarios: [],
    references: [],
    followUpQuestions: [],
    confidence: 0.05,
  };
  const detection = detectSynthesisOnlyCollapse(realBDeResponse);
  assert(detection.collapsed === true, "B-DE-Pattern erkannt als Collapse");
  assert(
    detection.missingFields.includes("scenarios"),
    "scenarios als missing markiert",
  );
  assert(
    detection.missingFields.includes("keyInsights"),
    "keyInsights als missing markiert",
  );
  assert(
    detection.missingFields.includes("references"),
    "references als missing markiert",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Gesunder voller Output soll NICHT als Collapse gelten
// ═══════════════════════════════════════════════════════════════════════
section("Gesunder Output — kein Retry");

{
  const fullResponse = {
    synthesis: "A".repeat(3000),
    scenarios: [
      { type: "optimistic", title: "X", description: "…", probability: 28 },
      { type: "likely", title: "Y", description: "…", probability: 47 },
      { type: "pessimistic", title: "Z", description: "…", probability: 25 },
    ],
    keyInsights: ["Insight 1", "Insight 2", "Insight 3"],
    references: [
      { title: "Ref 1" },
      { title: "Ref 2" },
      { title: "Ref 3" },
    ],
    decisionFramework: "1. Do X\n2. Do Y\n3. Do Z",
    causalChain: ["A → B → C"],
    reasoningChains: ["chain"],
    followUpQuestions: ["q1", "q2"],
  };
  const detection = detectSynthesisOnlyCollapse(fullResponse);
  assert(detection.collapsed === false, "Voller Output NICHT als Collapse");
  assert(detection.missingFields.length === 0, "keine missing fields");
}

// ═══════════════════════════════════════════════════════════════════════
//  Trivial-faktische Query — kurze synthesis, keine Szenarien erwartet
// ═══════════════════════════════════════════════════════════════════════
section("Trivial-faktisch — kein Retry trotz leerer Felder");

{
  const factualResponse = {
    synthesis:
      "Die Wärmepumpenbranche wird vom Bundesverband Wärmepumpe (BWP) vertreten, Sitz in Berlin, gegründet 1998.",
    scenarios: [],
    keyInsights: [],
    references: [],
  };
  const detection = detectSynthesisOnlyCollapse(factualResponse);
  assert(
    detection.collapsed === false,
    "Kurze synthesis (≤500) triggert KEINEN Retry",
  );
  assert(
    /synthesis too short/.test(detection.reason ?? ""),
    "Reason nennt 'synthesis too short'",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Edge: lange synthesis, aber nur 2 von 3 kritischen Feldern leer
// ═══════════════════════════════════════════════════════════════════════
section("Partial-empty — nicht aggressiv retryen");

{
  const partialResponse = {
    synthesis: "A".repeat(3000),
    scenarios: [{ type: "optimistic", title: "X" }],
    keyInsights: [], // missing
    references: [], // missing
    decisionFramework: "some text",
  };
  const detection = detectSynthesisOnlyCollapse(partialResponse);
  assert(
    detection.collapsed === false,
    "nur 2 von 3 kritischen Feldern leer → KEIN Retry",
  );
  assert(
    detection.missingFields.includes("keyInsights") &&
      detection.missingFields.includes("references"),
    "missing fields korrekt gelistet (für Logging)",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Scenarios als Empty-Object `{}` — legitimer Escape
// ═══════════════════════════════════════════════════════════════════════
section("scenarios: {} — legitimer Escape behandeln");

{
  // Bei faktischen Queries darf der LLM scenarios: {} setzen. Wenn
  // ALLE drei kritischen Felder leer sind UND synthesis > 500, ist
  // es trotzdem ein Collapse (der LLM hat strategische Frage als
  // faktisch missinterpretiert). Der Retry-Prompt erklärt das.
  const emptyObjScenarios = {
    synthesis: "A".repeat(2000),
    scenarios: {},
    keyInsights: [],
    references: [],
  };
  const detection = detectSynthesisOnlyCollapse(emptyObjScenarios);
  assert(
    detection.collapsed === true,
    "scenarios: {} + leere keyInsights/references bei langer synthesis = Collapse",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Schmaler Edge: synthesis knapp über Threshold
// ═══════════════════════════════════════════════════════════════════════
section("synthesis exakt am Threshold");

{
  const justOver = {
    synthesis: "A".repeat(501),
    scenarios: [],
    keyInsights: [],
    references: [],
  };
  const detection = detectSynthesisOnlyCollapse(justOver);
  assert(detection.collapsed === true, "synthesis=501 + alles leer = Collapse");
}

{
  const atThreshold = {
    synthesis: "A".repeat(500),
    scenarios: [],
    keyInsights: [],
    references: [],
  };
  const detection = detectSynthesisOnlyCollapse(atThreshold);
  assert(
    detection.collapsed === false,
    "synthesis=500 (Threshold) = KEIN Collapse",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Retry-Message-Generator
// ═══════════════════════════════════════════════════════════════════════
section("buildCollapseRetryMessage — DE");

{
  const msg = buildCollapseRetryMessage(
    ["scenarios", "keyInsights", "references"],
    "de",
  );
  assert(/HARD-CONTRACT/i.test(msg), "DE-Message nennt HARD-CONTRACT");
  assert(
    /scenarios, keyInsights, references/.test(msg),
    "DE-Message listet konkret die fehlenden Felder",
  );
  assert(
    /VOLLSTÄNDIGE JSON-Schema/i.test(msg),
    "DE-Message fordert vollständiges Schema",
  );
  assert(
    /\[LLM-KNOWLEDGE\]/.test(msg),
    "DE-Message erlaubt LLM-KNOWLEDGE-Tags",
  );
  assert(
    /NUR mit dem kompletten JSON/i.test(msg),
    "DE-Message fordert JSON-only (kein Prose)",
  );
}

section("buildCollapseRetryMessage — EN");

{
  const msg = buildCollapseRetryMessage(
    ["scenarios", "references", "decisionFramework"],
    "en",
  );
  assert(/HARD-CONTRACT/i.test(msg), "EN-Message nennt HARD-CONTRACT");
  assert(
    /scenarios, references, decisionFramework/.test(msg),
    "EN-Message listet fehlende Felder",
  );
  assert(
    /NOT acceptable/i.test(msg),
    "EN-Message macht klar, dass leere Struktur nicht akzeptabel ist",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Robustheit: malformed input
// ═══════════════════════════════════════════════════════════════════════
section("Malformed Input — kein Crash");

{
  assert(
    detectSynthesisOnlyCollapse({}).collapsed === false,
    "Leeres Objekt → kein Crash, kein Collapse",
  );
  assert(
    detectSynthesisOnlyCollapse({ synthesis: null }).collapsed === false,
    "synthesis=null → kein Crash",
  );
  assert(
    detectSynthesisOnlyCollapse({ synthesis: 42 } as any).collapsed === false,
    "synthesis=number → kein Crash",
  );
  assert(
    detectSynthesisOnlyCollapse({
      synthesis: "A".repeat(2000),
      scenarios: null,
      keyInsights: null,
      references: null,
    }).collapsed === true,
    "null-Felder werden als leer erkannt",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
