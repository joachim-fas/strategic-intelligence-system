#!/usr/bin/env tsx
/**
 * signal-coverage-critique-test — Pure-Function-Tests für Pass 3
 * (Iteration-Loop Coverage-Critique).
 *
 * Was getestet wird:
 *   - extractCoverageReport: robuster JSON-Parser für Haiku-Output mit
 *     defensiver Normalisierung (Severity-enums, type-enums, ceiling-clamp)
 *   - formatCoverageBlock: Prompt-Block-Generator (DE/EN, Empty-Skip-Logik)
 *
 * NICHT getestet (braucht echten Haiku-Call):
 *   - analyzeCoverage: live LLM-Aufruf
 *
 * Run: `npx tsx scripts/signal-coverage-critique-test.ts`
 */

import {
  extractCoverageReport,
  formatCoverageBlock,
  type CoverageReport,
} from "../src/lib/signal-coverage-critique";

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
//  extractCoverageReport — JSON parsing + defensive normalisation
// ═══════════════════════════════════════════════════════════════════════
section("extractCoverageReport — clean input");

{
  const clean = `{
    "coverageGaps": [
      {"aspect": "ARD/ZDF/ORF data missing", "severity": "high", "whyMissing": "no broadcasting connectors", "refinementQuery": "ARD ZDF ORF Vertrauen"}
    ],
    "representationBiases": [
      {"type": "source", "description": "ECFR + OSW dominate", "howSkews": "geopolitics framing"}
    ],
    "confidenceCeiling": 0.4,
    "refinementQueries": ["ARD ZDF ORF Vertrauen", "Public Service Media Index"],
    "synthesis": "Coverage is geopolitics-tilted, broadcasting-specific data missing."
  }`;
  const r = extractCoverageReport(clean);
  assert(r !== null, "parses clean JSON");
  assert(r?.coverageGaps?.length === 1, "1 gap");
  assert(r?.coverageGaps?.[0].severity === "high", "severity preserved");
  assert(r?.representationBiases?.length === 1, "1 bias");
  assert(r?.confidenceCeiling === 0.4, "ceiling parsed");
  assert(r?.refinementQueries?.length === 2, "2 refinement queries");
  assert(typeof r?.synthesis === "string" && r.synthesis.length > 0, "synthesis present");
}

section("extractCoverageReport — code-fence wrapping");

{
  const fenced = "```json\n{\"coverageGaps\":[],\"representationBiases\":[],\"confidenceCeiling\":0.85,\"refinementQueries\":[],\"synthesis\":\"all good\"}\n```";
  const r = extractCoverageReport(fenced);
  assert(r !== null, "strips ```json fences");
  assert(r?.confidenceCeiling === 0.85, "ceiling correct after fence-strip");
}

section("extractCoverageReport — defensive normalisation");

{
  // Invalid severity → defaults to "medium"
  const invalidSev = `{"coverageGaps":[{"aspect":"x","severity":"super-bad","whyMissing":"","refinementQuery":""}],"representationBiases":[],"confidenceCeiling":0.5,"refinementQueries":[],"synthesis":""}`;
  const r = extractCoverageReport(invalidSev);
  assert(r?.coverageGaps?.[0].severity === "medium", "invalid severity → medium default");
}

{
  // Invalid bias type → defaults to "perspective"
  const invalidType = `{"coverageGaps":[],"representationBiases":[{"type":"weird","description":"x","howSkews":""}],"confidenceCeiling":0.5,"refinementQueries":[],"synthesis":""}`;
  const r = extractCoverageReport(invalidType);
  assert(r?.representationBiases?.[0].type === "perspective", "invalid bias type → perspective default");
}

{
  // Out-of-range ceiling → clamped
  const overCeiling = `{"coverageGaps":[],"representationBiases":[],"confidenceCeiling":1.5,"refinementQueries":[],"synthesis":""}`;
  const r = extractCoverageReport(overCeiling);
  assert(r?.confidenceCeiling === 1.0, "ceiling > 1 clamped to 1");

  const negCeiling = `{"coverageGaps":[],"representationBiases":[],"confidenceCeiling":-0.5,"refinementQueries":[],"synthesis":""}`;
  const r2 = extractCoverageReport(negCeiling);
  assert(r2?.confidenceCeiling === 0.0, "ceiling < 0 clamped to 0");
}

{
  // Missing ceiling → safe fallback 0.5
  const noCeiling = `{"coverageGaps":[],"representationBiases":[],"refinementQueries":[],"synthesis":""}`;
  const r = extractCoverageReport(noCeiling);
  assert(r?.confidenceCeiling === 0.5, "missing ceiling → 0.5 fallback");
}

{
  // Filter invalid gap entries (missing aspect)
  const mixedGaps = `{"coverageGaps":[{"aspect":"valid"},{"severity":"high"},{"aspect":"valid2","severity":"low"}],"representationBiases":[],"confidenceCeiling":0.5,"refinementQueries":[],"synthesis":""}`;
  const r = extractCoverageReport(mixedGaps);
  assert(r?.coverageGaps?.length === 2, "gaps without aspect filtered out");
}

{
  // Refinement queries: filter empty strings
  const emptyQueries = `{"coverageGaps":[],"representationBiases":[],"confidenceCeiling":0.5,"refinementQueries":["valid","",null,"another valid"],"synthesis":""}`;
  const r = extractCoverageReport(emptyQueries);
  assert(r?.refinementQueries?.length === 2, "empty/null refinement queries filtered");
}

section("extractCoverageReport — edge cases");

{
  assert(extractCoverageReport("") === null, "empty string → null");
  assert(extractCoverageReport("not json") === null, "non-JSON → null");
  assert(extractCoverageReport("[1,2,3]") === null, "array (not object) → null");
  assert(extractCoverageReport("null") === null, "literal null → null");
}

// ═══════════════════════════════════════════════════════════════════════
//  formatCoverageBlock — prompt-block generation
// ═══════════════════════════════════════════════════════════════════════
section("formatCoverageBlock — null + trivial cases skip block");

{
  assert(formatCoverageBlock(null) === "", "null report → empty string");
  assert(formatCoverageBlock(null, "de") === "", "null report (de) → empty string");
}

{
  // No gaps + no biases + high ceiling → no need to clutter prompt
  const trivial: CoverageReport = {
    coverageGaps: [],
    representationBiases: [],
    confidenceCeiling: 0.85,
    refinementQueries: [],
    synthesis: "all good",
    callDurationMs: 100,
    inputTokens: 100,
    outputTokens: 50,
    modelUsed: "haiku",
  };
  assert(formatCoverageBlock(trivial) === "", "trivially-fine coverage → empty block (no clutter)");
}

section("formatCoverageBlock — non-trivial reports inject block");

{
  const withGaps: CoverageReport = {
    coverageGaps: [
      { aspect: "X missing", severity: "high", whyMissing: "no source", refinementQuery: "find X" },
    ],
    representationBiases: [],
    confidenceCeiling: 0.4,
    refinementQueries: ["find X"],
    synthesis: "weak coverage",
    callDurationMs: 100,
    inputTokens: 100,
    outputTokens: 50,
    modelUsed: "haiku",
  };
  const block = formatCoverageBlock(withGaps, "en");
  assert(block.startsWith("<coverage_analysis>"), "block has opening tag");
  assert(block.endsWith("</coverage_analysis>"), "block has closing tag");
  assert(block.includes("0.40"), "ceiling shown formatted");
  assert(block.includes("X missing"), "gap aspect shown");
  assert(block.includes("[HIGH]"), "severity shown uppercase");
  assert(block.includes("INSTRUCTION"), "instruction line included");
  assert(block.includes("LLM-KNOWLEDGE"), "instruction tells synthesis to use LLM-KNOWLEDGE tags");
}

{
  const withBiases: CoverageReport = {
    coverageGaps: [],
    representationBiases: [
      { type: "source", description: "ECFR dominates", howSkews: "EU-centric" },
    ],
    confidenceCeiling: 0.5,
    refinementQueries: [],
    synthesis: "biased",
    callDurationMs: 100,
    inputTokens: 100,
    outputTokens: 50,
    modelUsed: "haiku",
  };
  const block = formatCoverageBlock(withBiases, "en");
  assert(block.length > 0, "biases-only also produces block");
  assert(block.includes("ECFR dominates"), "bias description shown");
  assert(block.includes("[source]"), "bias type shown");
}

section("formatCoverageBlock — locale switch DE/EN");

{
  const r: CoverageReport = {
    coverageGaps: [{ aspect: "x", severity: "high", whyMissing: "y", refinementQuery: "z" }],
    representationBiases: [],
    confidenceCeiling: 0.4,
    refinementQueries: [],
    synthesis: "",
    callDurationMs: 100,
    inputTokens: 100,
    outputTokens: 50,
    modelUsed: "haiku",
  };
  const blockEn = formatCoverageBlock(r, "en");
  const blockDe = formatCoverageBlock(r, "de");
  assert(blockEn.includes("Confidence ceiling"), "EN: 'Confidence ceiling' label");
  assert(blockDe.includes("Confidence-Ceiling für diese Frage"), "DE: deutsches Label");
  assert(blockEn.includes("INSTRUCTION:"), "EN: english instruction");
  assert(blockDe.includes("ANWEISUNG:"), "DE: deutsche Anweisung");
}

section("formatCoverageBlock — gaps with low severity also shown");

{
  const lowGaps: CoverageReport = {
    coverageGaps: [{ aspect: "minor gap", severity: "low", whyMissing: "tangential", refinementQuery: "" }],
    representationBiases: [],
    confidenceCeiling: 0.65,
    refinementQueries: [],
    synthesis: "",
    callDurationMs: 100,
    inputTokens: 100,
    outputTokens: 50,
    modelUsed: "haiku",
  };
  const block = formatCoverageBlock(lowGaps);
  assert(block.length > 0, "low-severity gap still triggers block (any gap = relevant)");
  assert(block.includes("[LOW]"), "low severity shown");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
