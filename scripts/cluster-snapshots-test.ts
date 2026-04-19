#!/usr/bin/env tsx
/**
 * cluster-snapshots-test — unit test for the cluster-snapshots module
 * added under Welle B Item 2 (Perigon-inspired cluster history).
 *
 * Covers the DB-backed contract end-to-end against the same local.db
 * the app uses. Each run writes + reads a handful of rows, tagged
 * with a unique prefix so we can clean up at the end without
 * touching any real data.
 *
 * What we verify:
 *   1. createClusterSnapshot writes a row and returns the expected shape.
 *   2. clusterSlug produces stable slugs (round-trip safe).
 *   3. getClusterHistory returns reverse-chronological ordering.
 *   4. getClusterHistory honors limit.
 *   5. listClusters aggregates correctly (one row per cluster, latest
 *      row wins for the display topic).
 *   6. signalIds round-trip through JSON serialization.
 *   7. changelog + foresight defaults to null; explicit values persist.
 *
 * Run: `tsx scripts/cluster-snapshots-test.ts` (or `npm run test:cluster-snapshots`).
 */

import Database from "better-sqlite3";
import path from "path";
import {
  clusterSlug,
  createClusterSnapshot,
  getClusterHistory,
  listClusters,
} from "../src/lib/cluster-snapshots";

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

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// Guarantee the schema exists in case this test is the first thing
// that runs against a freshly cloned repo. Reusing the boot-time
// helper is simpler than duplicating the CREATE TABLE here.
const dbPath = path.join(process.cwd(), "local.db");
const seedDb = new Database(dbPath);
seedDb.pragma("journal_mode = WAL");
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ensureMultiTenantSchema } = require("../src/db/sqlite-helpers");
  ensureMultiTenantSchema(seedDb);
}
seedDb.close();

// Tag every row we create with a unique prefix so cleanup is surgical.
const TEST_PREFIX = `TEST_${Date.now()}`;
const topic = (suffix: string) => `${TEST_PREFIX}_${suffix}`;

// Minimal RawSignal-shaped fixture. The module only reads `sourceTitle`
// and the optional `id`/`signalId` fields, so the rest can be skipped.
function fakeSignal(id: string, title: string) {
  return {
    id,
    sourceTitle: title,
    // The rest of the RawSignal fields aren't touched by the module
    // under test; cast-through is safe here.
  } as unknown as import("../src/connectors/types").RawSignal;
}

// ─── 1. clusterSlug ─────────────────────────────────────────────
section("1. clusterSlug — deterministic URL-safe slugs");
assert(clusterSlug("AI") === "ai", "single uppercase word → lowercase");
assert(clusterSlug("AI Regulation") === "ai-regulation", "spaces → hyphens");
assert(clusterSlug("AI/Regulation") === "ai-regulation", "slashes collapse to hyphen");
assert(clusterSlug("  trim me  ") === "trim-me", "leading/trailing whitespace trimmed");
assert(clusterSlug("") === "unknown", "empty → fallback");
assert(clusterSlug("!!!") === "unknown", "all-punct → fallback");
assert(clusterSlug("Large Language Models (LLMs)") === "large-language-models-llms", "parens stripped");
assert(clusterSlug("AI") === clusterSlug("ai"), "case-insensitive");

// ─── 2. createClusterSnapshot + getClusterHistory ────────────────
section("2. createClusterSnapshot writes, getClusterHistory reads");
const topicA = topic("topicA");
const slugA = clusterSlug(topicA);

// Explicit timestamp so section 3 can compare ordering reliably —
// if we let this default to `new Date()` it would sort newer than the
// fixed 10:00/11:00 values in section 3 once the wallclock rolls past
// noon on the test day.
const s1 = createClusterSnapshot({
  topic: topicA,
  signals: [fakeSignal("sig-1", "First title"), fakeSignal("sig-2", "Second title")],
  triggeredAt: "2026-04-19T09:00:00.000Z",
});
assert(s1.topic === topicA, "returned snapshot has topic");
assert(s1.clusterId === slugA, "returned snapshot has slug");
assert(s1.signalCount === 2, "signalCount matches input");
assert(s1.signalIds.length === 2, "signalIds length matches");
assert(s1.signalIds[0] === "sig-1" && s1.signalIds[1] === "sig-2", "signalIds preserved in order");
assert(s1.summary.includes("First title"), "summary includes signal titles");
assert(s1.changelog === null, "changelog defaults to null");
assert(s1.foresight === null, "foresight defaults to null");

const read = getClusterHistory(slugA);
assert(read.length === 1, "one snapshot in history after one write");
assert(read[0].id === s1.id, "id round-trips");

// ─── 3. Multiple snapshots, reverse-chronological order ──────────
section("3. Multiple snapshots return newest-first");
// Use explicit triggered_at so ordering is deterministic across a
// fast test run (two snapshots created in the same millisecond on
// CI would otherwise have undefined SQL sort order).
const s2 = createClusterSnapshot({
  topic: topicA,
  signals: [fakeSignal("sig-3", "Third title")],
  triggeredAt: "2026-04-19T10:00:00.000Z",
});
const s3 = createClusterSnapshot({
  topic: topicA,
  signals: [fakeSignal("sig-4", "Fourth title")],
  triggeredAt: "2026-04-19T11:00:00.000Z",
});

const history = getClusterHistory(slugA);
assert(history.length === 3, "three snapshots now in history");
// Newest-first: s3 (11:00) → s2 (10:00) → s1 (before).
assert(history[0].id === s3.id, "newest snapshot first");
assert(history[history.length - 1].id === s1.id, "oldest snapshot last");

// ─── 4. limit parameter ─────────────────────────────────────────
section("4. getClusterHistory respects limit");
const firstTwo = getClusterHistory(slugA, 2);
assert(firstTwo.length === 2, "limit=2 returns 2 rows");
assert(firstTwo[0].id === s3.id, "limited result is still newest-first");
assert(firstTwo[1].id === s2.id, "second row is s2");

// ─── 5. listClusters aggregates ─────────────────────────────────
section("5. listClusters aggregates one row per cluster");
const topicB = topic("topicB");
const slugB = clusterSlug(topicB);
createClusterSnapshot({
  topic: topicB,
  signals: [fakeSignal("sig-x", "B title")],
});
const catalog = listClusters().filter((c) => c.clusterId === slugA || c.clusterId === slugB);
assert(catalog.length === 2, "two test clusters appear in catalog");
const aEntry = catalog.find((c) => c.clusterId === slugA);
assert(aEntry?.snapshotCount === 3, "cluster A has 3 snapshots");
assert(aEntry?.topic === topicA, "cluster A's catalog topic matches");
const bEntry = catalog.find((c) => c.clusterId === slugB);
assert(bEntry?.snapshotCount === 1, "cluster B has 1 snapshot");

// ─── 6. changelog + foresight explicit values ──────────────────
section("6. changelog + foresight round-trip when supplied");
const topicC = topic("topicC");
const slugC = clusterSlug(topicC);
const withExtras = createClusterSnapshot({
  topic: topicC,
  signals: [fakeSignal("sig-y", "C title")],
  changelog: "New signals from ACME corp",
  foresight: { scenario: "breakthrough", confidence: 0.7 },
});
assert(withExtras.changelog === "New signals from ACME corp", "changelog set on write");
assert(
  typeof withExtras.foresight === "object" &&
    (withExtras.foresight as { scenario?: string }).scenario === "breakthrough",
  "foresight round-trips through JSON",
);
const cHistory = getClusterHistory(slugC);
assert(cHistory[0].changelog === "New signals from ACME corp", "changelog persisted");
const foresightAfter = cHistory[0].foresight as { scenario?: string; confidence?: number } | null;
assert(foresightAfter?.scenario === "breakthrough", "foresight persisted");
assert(foresightAfter?.confidence === 0.7, "foresight numeric field persisted");

// ─── 7. Empty signals is valid ─────────────────────────────────
section("7. Empty signals array produces a snapshot with summary='(empty)'");
const topicD = topic("topicD");
const empty = createClusterSnapshot({ topic: topicD, signals: [] });
assert(empty.signalCount === 0, "signalCount = 0");
assert(empty.signalIds.length === 0, "signalIds = []");
assert(empty.summary === "(empty)", "summary is fallback text");

// ─── Cleanup ────────────────────────────────────────────────────
section("cleanup: remove test rows");
const cleanupDb = new Database(dbPath);
const before = cleanupDb.prepare(
  `SELECT COUNT(*) AS n FROM cluster_snapshots WHERE topic LIKE ?`,
).get(`${TEST_PREFIX}_%`) as { n: number };
cleanupDb.prepare(`DELETE FROM cluster_snapshots WHERE topic LIKE ?`).run(`${TEST_PREFIX}_%`);
const after = cleanupDb.prepare(
  `SELECT COUNT(*) AS n FROM cluster_snapshots WHERE topic LIKE ?`,
).get(`${TEST_PREFIX}_%`) as { n: number };
cleanupDb.close();
assert(before.n > 0, `before: ${before.n} test rows found`);
assert(after.n === 0, "after: test rows deleted");

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
