#!/usr/bin/env tsx
/**
 * baseline-test — unit test for the Welford streaming-variance helpers
 * added under Welle B Item 3 (anomaly baselines for the pipeline).
 *
 * Covers the pure math (no DB I/O):
 *   1. welfordUpdate: n, mean, m2 after each sample
 *   2. welfordStats: variance + stddev derived correctly
 *   3. anomalyTier: correct z-thresholds (1.5 / 2.0 / 3.0)
 *   4. baselineKey: stable canonical key shape
 *   5. Agreement with a naive batch calculation on a fixed corpus
 *
 * Run: `tsx scripts/baseline-test.ts` (or `npm run test:baseline`).
 */

import {
  welfordUpdate,
  welfordStats,
  anomalyTier,
  baselineKey,
} from "../src/lib/baseline";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

function close(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// ─── 1. welfordUpdate — running state ────────────────────────────
section("1. welfordUpdate — running state after samples");
let s: { n: number; mean: number; m2: number } = { n: 0, mean: 0, m2: 0 };
s = welfordUpdate(s, 10);
assert(s.n === 1 && s.mean === 10 && s.m2 === 0, "first sample → n=1, mean=x, m2=0");
s = welfordUpdate(s, 20);
assert(s.n === 2 && s.mean === 15 && s.m2 === 50, "second sample → mean updates, m2 = delta*delta2");
s = welfordUpdate(s, 30);
assert(s.n === 3 && s.mean === 20, "third sample: mean=20");
// Variance of [10,20,30] population = 66.666...; m2 = n * variance = 200
assert(close(s.m2, 200), `m2 matches n*variance(pop) = 200 (got ${s.m2})`);

// ─── 2. welfordStats — variance + stddev derived ────────────────
section("2. welfordStats — variance + stddev derived from (n, m2)");
const stats = welfordStats(s);
assert(close(stats.variance, 200 / 3), `variance = m2/n = 66.67 (got ${stats.variance.toFixed(3)})`);
assert(close(stats.stddev, Math.sqrt(200 / 3)), `stddev = sqrt(variance) (got ${stats.stddev.toFixed(3)})`);

// ─── 3. anomalyTier — z-score thresholds ────────────────────────
section("3. anomalyTier — Worldmonitor z-score thresholds");
assert(anomalyTier(null) === null, "null z → null tier");
assert(anomalyTier(0) === null, "z=0 → null tier");
assert(anomalyTier(1.49) === null, "z=1.49 → null (just under low)");
assert(anomalyTier(1.5) === "low", "z=1.5 → low");
assert(anomalyTier(-1.5) === "low", "z=-1.5 → low (symmetric)");
assert(anomalyTier(1.99) === "low", "z=1.99 → low (just under medium)");
assert(anomalyTier(2.0) === "medium", "z=2.0 → medium");
assert(anomalyTier(2.99) === "medium", "z=2.99 → medium (just under high)");
assert(anomalyTier(3.0) === "high", "z=3.0 → high");
assert(anomalyTier(5.0) === "high", "z=5.0 → high");
assert(anomalyTier(-3.5) === "high", "z=-3.5 → high (symmetric)");

// ─── 4. baselineKey — canonical shape ───────────────────────────
section("4. baselineKey — canonical shape + stability");
assert(
  baselineKey({ metric: "signal_count", source: "reuters", weekday: 3, month: 4 }) === "signal_count:reuters:3:4",
  "key format metric:source:weekday:month",
);
assert(
  baselineKey({ metric: "signal_count", source: "reuters", weekday: 0, month: 12 }) === "signal_count:reuters:0:12",
  "weekday 0 (Sunday) preserved, month 12 preserved",
);
// Different params → different keys
const k1 = baselineKey({ metric: "signal_count", source: "a", weekday: 1, month: 6 });
const k2 = baselineKey({ metric: "signal_count", source: "b", weekday: 1, month: 6 });
assert(k1 !== k2, "different source → different key");

// ─── 5. Agreement with batch calculation on real data ────────────
section("5. Welford agrees with naive batch calculation");
const samples = [12, 15, 8, 14, 20, 9, 11, 16, 13, 18, 22, 7];
let ws: { n: number; mean: number; m2: number } = { n: 0, mean: 0, m2: 0 };
for (const x of samples) ws = welfordUpdate(ws, x);
const wstats = welfordStats(ws);

// Naive batch
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
assert(close(wstats.mean, mean), `mean matches batch (${wstats.mean.toFixed(4)} ≈ ${mean.toFixed(4)})`);
assert(close(wstats.variance, variance), `variance matches batch (${wstats.variance.toFixed(4)} ≈ ${variance.toFixed(4)})`);
assert(wstats.n === samples.length, `n matches sample count (${wstats.n})`);

// ─── Summary ────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
