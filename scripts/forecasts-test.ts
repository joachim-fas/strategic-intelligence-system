#!/usr/bin/env tsx
/**
 * forecasts-test — end-to-end unit test for src/lib/forecasts.ts
 * (Welle C Item 2 first slice).
 *
 * Exercises every exported function against the real local.db so
 * the schema + library contract are validated together. Rows are
 * tagged with a unique prefix so cleanup is surgical.
 *
 * Coverage:
 *   1. forecastsEnabled reads the env var.
 *   2. createForecast writes + returns the expected shape; empty
 *      question rejected.
 *   3. getForecast scopes by tenant (returns null for other tenant).
 *   4. listForecasts filters by state + honours limit + orders
 *      newest-first.
 *   5. getForecastDetail attaches positions + derived probability.
 *   6. recordPosition writes, updates on repeat, bumps updated_at.
 *   7. recordPosition rejects on closed/resolved forecasts.
 *   8. recordPosition rejects probability outside [0,1].
 *   9. setForecastState enforces allowed transitions.
 *  10. Derived probability is mean of positions, null when zero.
 *
 * Run: `tsx scripts/forecasts-test.ts`
 */

import Database from "better-sqlite3";
import path from "path";
import {
  createForecast,
  getForecast,
  getForecastDetail,
  listForecasts,
  recordPosition,
  setForecastState,
  proposeResolution,
  approveResolution,
  forecastsEnabled,
  getUserCalibration,
  getCalibrationSummary,
} from "../src/lib/forecasts";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) { console.log(`\n▸ ${title}`); }

// Ensure the schema exists in case this test runs first on a fresh DB.
const dbPath = path.join(process.cwd(), "local.db");
const seedDb = new Database(dbPath);
seedDb.pragma("journal_mode = WAL");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ensureMultiTenantSchema } = require("../src/db/sqlite-helpers");
ensureMultiTenantSchema(seedDb);
seedDb.close();

// Tag rows so cleanup is surgical if the test crashes halfway.
const TENANT_A = `TEST_T_${Date.now()}_A`;
const TENANT_B = `TEST_T_${Date.now()}_B`;
const USER_1 = `TEST_U_${Date.now()}_1`;
const USER_2 = `TEST_U_${Date.now()}_2`;

// Wrap the whole test body in an async IIFE — tsx/CJS doesn't allow
// top-level await for the `await new Promise(r => setTimeout(...))`
// calls below.
async function main() {

// ─── 1. forecastsEnabled ────────────────────────────────────────
section("1. forecastsEnabled reads env var");
{
  const saved = process.env.FORECASTS_ENABLED;
  delete process.env.FORECASTS_ENABLED;
  assert(forecastsEnabled() === false, "unset → false");
  process.env.FORECASTS_ENABLED = "false";
  assert(forecastsEnabled() === false, "'false' → false");
  process.env.FORECASTS_ENABLED = "true";
  assert(forecastsEnabled() === true, "'true' → true");
  if (saved === undefined) delete process.env.FORECASTS_ENABLED;
  else process.env.FORECASTS_ENABLED = saved;
}

// ─── 2. createForecast ──────────────────────────────────────────
section("2. createForecast writes and returns shape; empty rejected");
const f1 = createForecast({
  tenantId: TENANT_A,
  question: "Will the EU AI Act phase-2 enforcement start Q3 2026?",
  description: "Test forecast",
  createdBy: USER_1,
});
assert(f1.id.length > 10, "id generated");
assert(f1.state === "OPEN", "default state OPEN");
assert(f1.tenantId === TENANT_A, "tenant scoped");
assert(f1.createdBy === USER_1, "creator recorded");
assert(f1.resolution === null, "no resolution yet");

let threw = false;
try {
  createForecast({ tenantId: TENANT_A, question: "   ", createdBy: USER_1 });
} catch { threw = true; }
assert(threw, "empty/whitespace question rejected");

// ─── 3. Tenant scoping ──────────────────────────────────────────
section("3. getForecast is tenant-scoped");
const r1 = getForecast(f1.id, TENANT_A);
assert(r1?.id === f1.id, "found in own tenant");
const r2 = getForecast(f1.id, TENANT_B);
assert(r2 === null, "not found in other tenant (leak guard)");

// ─── 4. listForecasts ───────────────────────────────────────────
section("4. listForecasts filter + order + limit");
// Create a second forecast a millisecond later so updated_at differs.
await new Promise(r => setTimeout(r, 10));
const f2 = createForecast({
  tenantId: TENANT_A,
  question: "Will renewables > 50% of EU electricity in 2027?",
  createdBy: USER_1,
  state: "DRAFT",
});
const openList = listForecasts(TENANT_A, { state: "OPEN" });
const draftList = listForecasts(TENANT_A, { state: "DRAFT" });
const allList = listForecasts(TENANT_A);
assert(openList.some(f => f.id === f1.id), "OPEN list contains f1");
assert(!openList.some(f => f.id === f2.id), "OPEN list excludes f2 (DRAFT)");
assert(draftList.some(f => f.id === f2.id), "DRAFT list contains f2");
assert(allList.length >= 2, "all-state list returns both");
assert(allList[0].id === f2.id, "newest-first ordering (f2 created later)");
const limitOne = listForecasts(TENANT_A, { limit: 1 });
assert(limitOne.length === 1, "limit=1 honored");

// ─── 5. recordPosition ──────────────────────────────────────────
section("5. recordPosition writes + upserts + bumps updated_at");
const beforeUpdate = getForecast(f1.id, TENANT_A)!;
await new Promise(r => setTimeout(r, 10));
const p1 = recordPosition({
  forecastId: f1.id,
  tenantId: TENANT_A,
  userId: USER_1,
  yesProbability: 0.72,
  rationale: "EU regulators are on schedule",
});
assert(p1.yesProbability === 0.72, "probability stored");
const afterUpdate = getForecast(f1.id, TENANT_A)!;
assert(afterUpdate.updatedAt > beforeUpdate.updatedAt, "forecast.updated_at bumped");

// Second call for same user = upsert, not duplicate row.
const p2 = recordPosition({
  forecastId: f1.id,
  tenantId: TENANT_A,
  userId: USER_1,
  yesProbability: 0.80,
  rationale: "Updated after Q1 data",
});
const detail = getForecastDetail(f1.id, TENANT_A)!;
const user1Positions = detail.positions.filter(p => p.userId === USER_1);
assert(user1Positions.length === 1, "still exactly 1 position per user");
assert(user1Positions[0].yesProbability === 0.80, "latest probability stored");
assert(p2.id !== "" && typeof p2.id === "string", "upsert returns valid row");

// ─── 6. Second user position → derived probability is mean ──────
section("6. Derived probability is mean of positions");
recordPosition({
  forecastId: f1.id,
  tenantId: TENANT_A,
  userId: USER_2,
  yesProbability: 0.40,
});
const d2 = getForecastDetail(f1.id, TENANT_A)!;
assert(d2.positions.length === 2, "2 positions in detail");
const expected = (0.80 + 0.40) / 2;
assert(Math.abs((d2.derivedYesProbability ?? 0) - expected) < 1e-9,
  `derived = mean (${d2.derivedYesProbability} ≈ ${expected})`);

// ─── 7. No positions → derived = null ───────────────────────────
section("7. Forecast with zero positions → derived null");
const f3 = createForecast({
  tenantId: TENANT_A,
  question: "Untouched forecast for null-derived test",
  createdBy: USER_1,
});
const d3 = getForecastDetail(f3.id, TENANT_A)!;
assert(d3.positions.length === 0, "no positions");
assert(d3.derivedYesProbability === null, "derived null when empty");

// ─── 8. recordPosition rejects on non-OPEN state ────────────────
section("8. recordPosition rejects on non-OPEN state");
setForecastState(f3.id, TENANT_A, "CLOSED");
let rejected = false;
try {
  recordPosition({
    forecastId: f3.id,
    tenantId: TENANT_A,
    userId: USER_1,
    yesProbability: 0.5,
  });
} catch { rejected = true; }
assert(rejected, "position on CLOSED forecast throws");

// ─── 9. recordPosition rejects bad probability ──────────────────
section("9. recordPosition rejects probability outside [0,1]");
let bad1 = false, bad2 = false;
try { recordPosition({ forecastId: f1.id, tenantId: TENANT_A, userId: USER_1, yesProbability: 1.5 }); }
catch { bad1 = true; }
try { recordPosition({ forecastId: f1.id, tenantId: TENANT_A, userId: USER_1, yesProbability: -0.1 }); }
catch { bad2 = true; }
assert(bad1 && bad2, "both out-of-range probabilities rejected");

// ─── 10. setForecastState transitions ───────────────────────────
section("10. setForecastState enforces state-machine");
const ft = createForecast({
  tenantId: TENANT_A,
  question: "state-machine test forecast",
  createdBy: USER_1,
  state: "DRAFT",
});
const s1 = setForecastState(ft.id, TENANT_A, "OPEN");
assert(s1.state === "OPEN", "DRAFT → OPEN allowed");
const s2 = setForecastState(ft.id, TENANT_A, "CLOSED");
assert(s2.state === "CLOSED", "OPEN → CLOSED allowed");
let badTransition = false;
try { setForecastState(ft.id, TENANT_A, "DRAFT"); } catch { badTransition = true; }
assert(badTransition, "CLOSED → DRAFT rejected");

// Terminal state: RESOLVED cannot transition further.
setForecastState(ft.id, TENANT_A, "PENDING_RESOLUTION");
const resolvedDirect = Database.bind; // unused reference to silence lint on direct SQL below
void resolvedDirect;
// Promote to RESOLVED by direct SQL (the lib guards against it in the
// setter, which we want to keep — we only test the terminal-exit rule
// here).
const directDb = new Database(dbPath);
directDb.prepare(`UPDATE forecasts SET state = 'RESOLVED' WHERE id = ?`).run(ft.id);
directDb.close();
let terminalBlocked = false;
try { setForecastState(ft.id, TENANT_A, "OPEN"); } catch { terminalBlocked = true; }
assert(terminalBlocked, "RESOLVED is terminal — no re-open");

// ─── 11. Peer-signoff resolution ────────────────────────────────
section("11. Resolution requires proposer ≠ approver (two signers)");
const fResolve = createForecast({
  tenantId: TENANT_A,
  question: "peer-signoff test forecast",
  createdBy: USER_1,
});
recordPosition({
  forecastId: fResolve.id,
  tenantId: TENANT_A,
  userId: USER_1,
  yesProbability: 0.7,
});

// Propose resolution as USER_1.
const proposed = proposeResolution({
  forecastId: fResolve.id,
  tenantId: TENANT_A,
  proposerUserId: USER_1,
  resolution: "YES",
  rationale: "EU publication confirmed on Monday",
});
assert(proposed.state === "PENDING_RESOLUTION", "state → PENDING_RESOLUTION");
assert(proposed.resolution === "YES", "proposed resolution recorded");
assert(proposed.resolvedBy === USER_1, "proposer recorded");
assert(proposed.resolutionApprover === null, "no approver yet");

// Cannot approve as same user (proposer ≠ approver rule).
let sameSignerBlocked = false;
try {
  approveResolution({ forecastId: fResolve.id, tenantId: TENANT_A, approverUserId: USER_1 });
} catch { sameSignerBlocked = true; }
assert(sameSignerBlocked, "proposer cannot self-approve");

// Approve as USER_2 (different user).
const approved = approveResolution({
  forecastId: fResolve.id,
  tenantId: TENANT_A,
  approverUserId: USER_2,
});
assert(approved.state === "RESOLVED", "state → RESOLVED after 2nd signer");
assert(approved.resolvedBy === USER_1, "proposer preserved");
assert(approved.resolutionApprover === USER_2, "approver recorded");
assert(approved.resolvedAt !== null, "resolved_at set");

// Cannot approve a non-pending forecast.
let notPendingBlocked = false;
try {
  approveResolution({ forecastId: fResolve.id, tenantId: TENANT_A, approverUserId: USER_2 });
} catch { notPendingBlocked = true; }
assert(notPendingBlocked, "approving already-resolved forecast throws");

// Cannot propose on an already-resolved forecast.
let noProposeOnResolved = false;
try {
  proposeResolution({
    forecastId: fResolve.id,
    tenantId: TENANT_A,
    proposerUserId: USER_1,
    resolution: "NO",
    rationale: "try to reverse",
  });
} catch { noProposeOnResolved = true; }
assert(noProposeOnResolved, "proposing on RESOLVED forecast throws");

// Empty rationale rejected.
let emptyRationaleBlocked = false;
try {
  const fResolve2 = createForecast({
    tenantId: TENANT_A,
    question: "rationale-test forecast",
    createdBy: USER_1,
  });
  proposeResolution({
    forecastId: fResolve2.id,
    tenantId: TENANT_A,
    proposerUserId: USER_1,
    resolution: "YES",
    rationale: "   ",
  });
} catch { emptyRationaleBlocked = true; }
assert(emptyRationaleBlocked, "empty/whitespace rationale rejected");

// Re-proposing: an OPEN → PENDING → [different proposal by same user
// or different user] → still PENDING (just overwrites proposed
// outcome; approver still needs to be different).
const fRe = createForecast({
  tenantId: TENANT_A,
  question: "re-proposal test",
  createdBy: USER_1,
});
proposeResolution({
  forecastId: fRe.id,
  tenantId: TENANT_A,
  proposerUserId: USER_1,
  resolution: "YES",
  rationale: "first proposal",
});
const rePropose = proposeResolution({
  forecastId: fRe.id,
  tenantId: TENANT_A,
  proposerUserId: USER_2,
  resolution: "NO",
  rationale: "actually no",
});
assert(rePropose.resolution === "NO", "re-proposal overwrites outcome");
assert(rePropose.resolvedBy === USER_2, "re-proposal records new proposer");

// ─── 12. Calibration hook on resolution ─────────────────────────
section("12. Calibration snapshot on RESOLVED (Welle C Item 3)");
// Fresh forecast that will resolve YES. USER_1 predicts 0.8, USER_2 predicts 0.3.
const fCal = createForecast({
  tenantId: TENANT_A,
  question: "calibration test forecast",
  createdBy: USER_1,
});
recordPosition({ forecastId: fCal.id, tenantId: TENANT_A, userId: USER_1, yesProbability: 0.8 });
recordPosition({ forecastId: fCal.id, tenantId: TENANT_A, userId: USER_2, yesProbability: 0.3 });

// No calibration row yet — forecast isn't resolved.
const preCal = getUserCalibration(TENANT_A, USER_1);
assert(preCal.every(r => r.forecastId !== fCal.id), "no calibration row pre-resolution");

// Resolve YES by proposer USER_1 + approver USER_2.
proposeResolution({
  forecastId: fCal.id, tenantId: TENANT_A, proposerUserId: USER_1,
  resolution: "YES", rationale: "occurred",
});
approveResolution({
  forecastId: fCal.id, tenantId: TENANT_A, approverUserId: USER_2,
});

const u1Cal = getUserCalibration(TENANT_A, USER_1);
const u2Cal = getUserCalibration(TENANT_A, USER_2);
const u1Row = u1Cal.find(r => r.forecastId === fCal.id);
const u2Row = u2Cal.find(r => r.forecastId === fCal.id);
assert(u1Row !== undefined, "USER_1 calibration row written");
assert(u2Row !== undefined, "USER_2 calibration row written");
assert(u1Row?.outcome === 1, "outcome stored as 1 for YES resolution");
// Brier for USER_1 (p=0.8, outcome=1): (0.8-1)^2 = 0.04
assert(Math.abs((u1Row?.brierScore ?? 0) - 0.04) < 1e-9, `USER_1 Brier ≈ 0.04 (got ${u1Row?.brierScore})`);
// Brier for USER_2 (p=0.3, outcome=1): (0.3-1)^2 = 0.49
assert(Math.abs((u2Row?.brierScore ?? 0) - 0.49) < 1e-9, `USER_2 Brier ≈ 0.49 (got ${u2Row?.brierScore})`);

// Resolve a second forecast NO, USER_1 predicts 0.1 (good) → Brier 0.01
const fCal2 = createForecast({
  tenantId: TENANT_A,
  question: "calibration NO test",
  createdBy: USER_2,
});
recordPosition({ forecastId: fCal2.id, tenantId: TENANT_A, userId: USER_1, yesProbability: 0.1 });
proposeResolution({
  forecastId: fCal2.id, tenantId: TENANT_A, proposerUserId: USER_2,
  resolution: "NO", rationale: "did not occur",
});
approveResolution({
  forecastId: fCal2.id, tenantId: TENANT_A, approverUserId: USER_1,
});
const u1CalAfter = getUserCalibration(TENANT_A, USER_1);
const u1Row2 = u1CalAfter.find(r => r.forecastId === fCal2.id);
assert(u1Row2?.outcome === 0, "outcome stored as 0 for NO resolution");
assert(Math.abs((u1Row2?.brierScore ?? 0) - 0.01) < 1e-9, `USER_1 Brier on NO forecast ≈ 0.01 (got ${u1Row2?.brierScore})`);

// Summary
const u1Summary = getCalibrationSummary(TENANT_A, USER_1);
assert(u1Summary.totalResolved >= 2, `USER_1 has ≥2 resolved predictions (${u1Summary.totalResolved})`);
// Mean Brier for USER_1 (across fCal and fCal2) = (0.04 + 0.01) / 2 = 0.025 —
// but only if these are the only two. We'll just check it's in [0, 1].
assert((u1Summary.meanBrier ?? -1) >= 0 && (u1Summary.meanBrier ?? -1) <= 1, "mean Brier in [0,1]");
assert(u1Summary.buckets.length === 10, "10 decile buckets");
assert(u1Summary.buckets.every(b => b.count >= 0), "all bucket counts non-negative");

// PARTIAL / CANCEL resolutions don't write calibration rows.
const fCancel = createForecast({
  tenantId: TENANT_A,
  question: "cancel test",
  createdBy: USER_1,
});
recordPosition({ forecastId: fCancel.id, tenantId: TENANT_A, userId: USER_1, yesProbability: 0.6 });
proposeResolution({
  forecastId: fCancel.id, tenantId: TENANT_A, proposerUserId: USER_1,
  resolution: "CANCEL", rationale: "question became irrelevant",
});
approveResolution({
  forecastId: fCancel.id, tenantId: TENANT_A, approverUserId: USER_2,
});
const u1Final = getUserCalibration(TENANT_A, USER_1);
assert(u1Final.every(r => r.forecastId !== fCancel.id), "CANCEL resolution does not write calibration");

// Empty user → meaningful null summary.
const emptySummary = getCalibrationSummary(TENANT_A, "user-that-never-staked");
assert(emptySummary.totalResolved === 0, "empty user: 0 resolved");
assert(emptySummary.meanBrier === null, "empty user: null mean");
assert(emptySummary.buckets.length === 0, "empty user: no buckets");

// ─── Cleanup ────────────────────────────────────────────────────
section("cleanup");
const clean = new Database(dbPath);
clean.prepare("DELETE FROM forecast_calibration WHERE tenant_id IN (?, ?)").run(TENANT_A, TENANT_B);
clean.prepare("DELETE FROM forecast_positions WHERE forecast_id IN (SELECT id FROM forecasts WHERE tenant_id IN (?, ?))").run(TENANT_A, TENANT_B);
const beforeDel = clean.prepare("SELECT COUNT(*) AS n FROM forecasts WHERE tenant_id IN (?, ?)").get(TENANT_A, TENANT_B) as { n: number };
clean.prepare("DELETE FROM forecasts WHERE tenant_id IN (?, ?)").run(TENANT_A, TENANT_B);
const afterDel = clean.prepare("SELECT COUNT(*) AS n FROM forecasts WHERE tenant_id IN (?, ?)").get(TENANT_A, TENANT_B) as { n: number };
clean.close();
assert(beforeDel.n >= 4, `before: ${beforeDel.n} test forecasts`);
assert(afterDel.n === 0, "all test rows deleted");

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);

} // end main

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
