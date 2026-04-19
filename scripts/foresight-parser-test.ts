#!/usr/bin/env tsx
/**
 * foresight-parser-test — unit test for the LLM-output parsing in
 * generateClusterForesight (Welle B Item 2 follow-up: SIS's Perigon-
 * differentiator forward-looking slot).
 *
 * The function is supposed to be lenient with LLM responses: strip
 * preamble, extract the JSON array, validate each entry, drop
 * malformed ones, clamp confidence, cap lengths. This test mocks
 * completeText to return crafted strings and asserts the parser
 * produces the right shape (or null) every time.
 *
 * Run: `tsx scripts/foresight-parser-test.ts`
 */

import { generateClusterForesight } from "../src/lib/cluster-snapshots";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// ── Mock fetch so the parser is exercised without a real API call ──
function mockFetch(responseText: string | null): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (responseText === null) {
      return new Response("", { status: 500 });
    }
    return new Response(
      JSON.stringify({ content: [{ text: responseText }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = real; };
}

function mockEnv(): () => void {
  const savedFlag = process.env.CLUSTER_FORESIGHT_LLM_ENABLED;
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.CLUSTER_FORESIGHT_LLM_ENABLED = "true";
  process.env.ANTHROPIC_API_KEY = "test-key";
  return () => {
    if (savedFlag === undefined) delete process.env.CLUSTER_FORESIGHT_LLM_ENABLED;
    else process.env.CLUSTER_FORESIGHT_LLM_ENABLED = savedFlag;
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  };
}

const sampleInput = { topic: "AI", summary: "recent summary text", signalCount: 12 };

async function main() {
  // ─── 1. Feature flag off ────────────────────────────────────────
  section("1. Feature flag off → returns null without any fetch");
  {
    const savedFlag = process.env.CLUSTER_FORESIGHT_LLM_ENABLED;
    delete process.env.CLUSTER_FORESIGHT_LLM_ENABLED;
    let called = false;
    const real = globalThis.fetch;
    globalThis.fetch = (() => { called = true; return Promise.resolve(new Response("")); }) as typeof globalThis.fetch;
    try {
      const result = await generateClusterForesight(sampleInput);
      assert(result === null, "returns null");
      assert(called === false, "fetch was NOT called");
    } finally {
      globalThis.fetch = real;
      if (savedFlag !== undefined) process.env.CLUSTER_FORESIGHT_LLM_ENABLED = savedFlag;
    }
  }

  // ─── 2. Clean JSON response ────────────────────────────────────
  section("2. Clean JSON array response → parsed correctly");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch(
      '[{"scenario":"Adoption accelerates","confidence":0.72,"drivers":["EU mandate","open-source push","cost drop"]},{"scenario":"Regulation tightens","confidence":0.45,"drivers":["ENISA report"]}]',
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(Array.isArray(r), "returned an array");
      assert(r?.length === 2, `array length 2 (got ${r?.length})`);
      assert(r?.[0].scenario === "Adoption accelerates", "scenario 1 title");
      assert(r?.[0].confidence === 0.72, "scenario 1 confidence");
      assert(r?.[0].drivers.length === 3, "scenario 1 has 3 drivers");
      assert(r?.[1].drivers.length === 1, "scenario 2 has 1 driver");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 3. Preamble before JSON ───────────────────────────────────
  section("3. Preamble before the JSON → parser strips it");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch(
      'Here are the scenarios: [{"scenario":"S1","confidence":0.5,"drivers":["d1"]}]\nEnd.',
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(Array.isArray(r) && r.length === 1, "array extracted despite preamble");
      assert(r?.[0].scenario === "S1", "scenario text correct");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 4. Confidence clamping ────────────────────────────────────
  section("4. Out-of-range confidence is clamped to [0,1]");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch(
      '[{"scenario":"too high","confidence":1.5,"drivers":[]},{"scenario":"too low","confidence":-0.3,"drivers":[]}]',
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r?.length === 2, "both entries kept");
      assert(r?.[0].confidence === 1, "clamped up to 1");
      assert(r?.[1].confidence === 0, "clamped down to 0");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 5. Drivers array caps at 3 ────────────────────────────────
  section("5. Drivers array capped at 3 entries");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch(
      '[{"scenario":"many drivers","confidence":0.5,"drivers":["a","b","c","d","e"]}]',
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r?.[0].drivers.length === 3, `drivers capped at 3 (got ${r?.[0].drivers.length})`);
      assert(r?.[0].drivers[0] === "a" && r?.[0].drivers[2] === "c", "first 3 preserved");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 6. Malformed entries dropped silently ─────────────────────
  section("6. Malformed entries dropped, good ones kept");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch(
      '[{"scenario":"keep me","confidence":0.5,"drivers":[]},{"scenario":123,"confidence":0.5},{"confidence":0.5},{"scenario":"also keep","confidence":0.7}]',
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r?.length === 2, `2 valid entries kept (got ${r?.length})`);
      assert(r?.[0].scenario === "keep me", "first valid kept");
      assert(r?.[1].scenario === "also keep", "second valid kept");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 7. All-malformed → null ───────────────────────────────────
  section("7. All entries malformed → returns null");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch('[{"no":"scenario"},{"x":1}]');
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r === null, "all-invalid array returns null");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 8. Non-array response → null ──────────────────────────────
  section("8. Non-array JSON → null");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch('{"scenarios": []}');
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r === null, "object-instead-of-array returns null");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 9. Unparseable garbage → null ─────────────────────────────
  section("9. Unparseable output → null");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch("totally not json at all");
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r === null, "garbage returns null");
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 10. Empty summary short-circuits ──────────────────────────
  section("10. Empty or fallback summary → null, no fetch");
  {
    const restoreEnv = mockEnv();
    let called = false;
    const real = globalThis.fetch;
    globalThis.fetch = (() => { called = true; return Promise.resolve(new Response("")); }) as typeof globalThis.fetch;
    try {
      const a = await generateClusterForesight({ topic: "AI", summary: "", signalCount: 0 });
      const b = await generateClusterForesight({ topic: "AI", summary: "(empty)", signalCount: 0 });
      assert(a === null && b === null, "both empty-summary cases null");
      assert(called === false, "fetch never called for empty-summary");
    } finally { globalThis.fetch = real; restoreEnv(); }
  }

  // ─── 11. Scenario title hard-capped at 80 chars ─────────────────
  section("11. Scenario title capped at 80 chars");
  {
    const restoreEnv = mockEnv();
    const longTitle = "a".repeat(200);
    const restoreFetch = mockFetch(
      `[{"scenario":"${longTitle}","confidence":0.5,"drivers":[]}]`,
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r?.[0].scenario.length === 80, `title capped at 80 (got ${r?.[0].scenario.length})`);
    } finally { restoreFetch(); restoreEnv(); }
  }

  // ─── 12. Result cap at 3 scenarios ─────────────────────────────
  section("12. More than 3 scenarios → first 3 kept");
  {
    const restoreEnv = mockEnv();
    const restoreFetch = mockFetch(
      '[{"scenario":"s1","confidence":0.5,"drivers":[]},{"scenario":"s2","confidence":0.5,"drivers":[]},{"scenario":"s3","confidence":0.5,"drivers":[]},{"scenario":"s4","confidence":0.5,"drivers":[]}]',
    );
    try {
      const r = await generateClusterForesight(sampleInput);
      assert(r?.length === 3, `capped at 3 (got ${r?.length})`);
      assert(r?.[2].scenario === "s3", "s3 is last");
    } finally { restoreFetch(); restoreEnv(); }
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
