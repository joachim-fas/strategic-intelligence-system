#!/usr/bin/env tsx
/**
 * scenario-validation-test — regression test for the
 * „Szenarien-Validierung: Immer exakt 3 erzwingen" fix (Task 1.2,
 * 2026-04-21) in src/lib/validation.ts.
 *
 * The validator must:
 *   - accept 0 scenarios as honest (FACTUAL queries)
 *   - pad 1 or 2 scenarios up to 3 (opt/base/pess) with placeholders
 *   - pass 3 scenarios unchanged (types assigned if missing)
 *   - split wildcards off when 4+ are returned and keep 3 primary
 *   - normalise probabilities that don't sum to ~1.0
 *   - warn when all primary probabilities are identical (LLM-default smell)
 *
 * Run: `npx tsx scripts/scenario-validation-test.ts`
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

// Minimum payload the validator accepts — we only vary `scenarios` below.
function makePayload(scenarios: unknown[]) {
  return {
    synthesis: "Test synthesis",
    matchedTrendIds: [],
    keyInsights: [],
    regulatoryContext: [],
    causalAnalysis: [],
    scenarios,
    references: [],
    followUpQuestions: [],
    confidence: 0.5,
  };
}

const validTrendIds = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════
//  Empty list — FACTUAL queries
// ═══════════════════════════════════════════════════════════════════════
section("empty scenarios — FACTUAL query");

{
  const { data, warnings } = validateLLMResponse(makePayload([]), validTrendIds);
  assert(data.scenarios.length === 0, "empty input stays empty (no padding)");
  assert(!warnings.some(w => /scenarios/i.test(w)), "no scenario warning on empty input");
}

// ═══════════════════════════════════════════════════════════════════════
//  One scenario — pad to 3
// ═══════════════════════════════════════════════════════════════════════
section("one scenario — padding");

{
  const { data, warnings } = validateLLMResponse(
    makePayload([
      { type: "optimistic", name: "Upside", description: "Positive", probability: 0.4 },
    ]),
    validTrendIds,
  );
  assert(data.scenarios.length === 3, "1 scenario padded to 3");
  const types = data.scenarios.map(s => s.type);
  assert(types.includes("optimistic"), "optimistic preserved");
  assert(types.includes("baseline"), "baseline added as placeholder");
  assert(types.includes("pessimistic"), "pessimistic added as placeholder");
  assert(warnings.some(w => /Missing scenarios/i.test(w)), "warning: Missing scenarios");
}

// ═══════════════════════════════════════════════════════════════════════
//  Two scenarios — pad the missing third
// ═══════════════════════════════════════════════════════════════════════
section("two scenarios — pad missing");

{
  const { data, warnings } = validateLLMResponse(
    makePayload([
      { type: "optimistic", name: "Up", description: "A", probability: 0.35 },
      { type: "baseline",   name: "Mid", description: "B", probability: 0.5  },
    ]),
    validTrendIds,
  );
  assert(data.scenarios.length === 3, "2 scenarios padded to 3");
  const types = data.scenarios.map(s => s.type);
  assert(types.includes("pessimistic"), "pessimistic synthesised");
  assert(warnings.some(w => w.includes("pessimistic")), "warning names the missing slot");
}

// ═══════════════════════════════════════════════════════════════════════
//  Three typed scenarios — pass through
// ═══════════════════════════════════════════════════════════════════════
section("three typed scenarios — pass through");

{
  const { data, warnings } = validateLLMResponse(
    makePayload([
      { type: "optimistic",  name: "A", description: "A", probability: 0.3 },
      { type: "baseline",    name: "B", description: "B", probability: 0.5 },
      { type: "pessimistic", name: "C", description: "C", probability: 0.2 },
    ]),
    validTrendIds,
  );
  assert(data.scenarios.length === 3, "3 typed scenarios kept");
  assert(data.scenarios[0].type === "optimistic",  "optimistic at index 0");
  assert(data.scenarios[1].type === "baseline",    "baseline at index 1");
  assert(data.scenarios[2].type === "pessimistic", "pessimistic at index 2");
  assert(!warnings.some(w => /Missing scenarios/i.test(w)), "no missing-warning");
}

// ═══════════════════════════════════════════════════════════════════════
//  Three untyped scenarios — assign types by position
// ═══════════════════════════════════════════════════════════════════════
section("three untyped scenarios — type assignment");

{
  const { data } = validateLLMResponse(
    makePayload([
      { name: "First",  description: "A", probability: 0.3 },
      { name: "Second", description: "B", probability: 0.5 },
      { name: "Third",  description: "C", probability: 0.2 },
    ]),
    validTrendIds,
  );
  assert(data.scenarios.length === 3, "3 untyped scenarios kept");
  assert(data.scenarios[0].type === "optimistic",  "first → optimistic");
  assert(data.scenarios[1].type === "baseline",    "second → baseline");
  assert(data.scenarios[2].type === "pessimistic", "third → pessimistic");
}

// ═══════════════════════════════════════════════════════════════════════
//  v0.2 object shape with optimistic/likely/pessimistic
// ═══════════════════════════════════════════════════════════════════════
section("v0.2 object shape — normalised to array");

{
  const { data } = validateLLMResponse(
    makePayload([
      // Use the already-flat legacy form via the array slot. Zod preprocesses
      // the v0.2 object form through normalizeScenarios — exercised via the
      // array path because "scenarios" is typed unknown[].
      { type: "optimistic",  name: "v0.2 opt",  description: "x", probability: 0.3 },
      { type: "likely",      name: "v0.2 mid",  description: "y", probability: 0.5 },
      { type: "pessimistic", name: "v0.2 pess", description: "z", probability: 0.2 },
    ] as any),
    validTrendIds,
  );
  // "likely" maps to baseline in normalizeScenarios
  assert(data.scenarios.length === 3, "v0.2 shape produces 3");
  const types = data.scenarios.map(s => s.type);
  assert(types.includes("baseline"), "'likely' normalised to baseline");
}

// ═══════════════════════════════════════════════════════════════════════
//  Wildcard handling — 3 primary + wildcard kept
// ═══════════════════════════════════════════════════════════════════════
section("wildcard — kept alongside 3 primary");

{
  const { data } = validateLLMResponse(
    makePayload([
      { type: "optimistic",  name: "A", description: "a", probability: 0.3 },
      { type: "baseline",    name: "B", description: "b", probability: 0.5 },
      { type: "pessimistic", name: "C", description: "c", probability: 0.15 },
      { type: "wildcard",    name: "Black swan", description: "d", probability: 0.05 },
    ]),
    validTrendIds,
  );
  assert(data.scenarios.length === 4, "4 scenarios with 1 wildcard kept");
  assert(data.scenarios.filter(s => s.type === "wildcard").length === 1, "exactly 1 wildcard");
  const primaryTypes = data.scenarios.filter(s => s.type !== "wildcard").map(s => s.type);
  assert(primaryTypes.length === 3, "exactly 3 primary scenarios");
}

// ═══════════════════════════════════════════════════════════════════════
//  Probability normalisation — sum off by >10%
// ═══════════════════════════════════════════════════════════════════════
section("probability normalisation");

{
  const { data, warnings } = validateLLMResponse(
    makePayload([
      { type: "optimistic",  name: "A", description: "a", probability: 0.6 },
      { type: "baseline",    name: "B", description: "b", probability: 0.8 },
      { type: "pessimistic", name: "C", description: "c", probability: 0.4 },
    ]),
    validTrendIds,
  );
  const sum = data.scenarios.reduce((a, s) => a + (s.probability ?? 0), 0);
  assert(Math.abs(sum - 1.0) < 0.05, "probabilities normalised to sum ≈ 1.0");
  assert(warnings.some(w => /normalized/i.test(w)), "warning about normalisation emitted");
}

// ═══════════════════════════════════════════════════════════════════════
//  Identical probabilities — LLM-default smell
// ═══════════════════════════════════════════════════════════════════════
section("identical probabilities — default-smell warning");

{
  const { warnings } = validateLLMResponse(
    makePayload([
      { type: "optimistic",  name: "A", description: "a", probability: 0.33 },
      { type: "baseline",    name: "B", description: "b", probability: 0.33 },
      { type: "pessimistic", name: "C", description: "c", probability: 0.33 },
    ]),
    validTrendIds,
  );
  assert(warnings.some(w => /identical/i.test(w)), "default-smell warning emitted");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
