/**
 * Forecasts — SIS-native prediction-market-lite.
 *
 * Welle C Item 2 of the 4-app Deep-Dive. Manifold-inspired schema
 * stripped to the slice that makes sense for strategy teams (5–15
 * people in a tenant) rather than a 100k-user community:
 *   - No AMM, no mana, no liquidity pools. Prediction markets only
 *     make sense with thousands of participants; strategy teams
 *     need direct confidence capture.
 *   - No leagues / no `manaEarned` ranking. Gamifying volume would
 *     reward noise over calibration — the opposite of what a
 *     strategy team should incentivise.
 *   - Yes to Manifold's state machine + structured-resolution +
 *     per-user-at-close calibration. Yes to peer-signoff as SIS's
 *     differentiator over Manifold's single-creator resolution
 *     (strategy teams need political resilience).
 *   - Yes to the `{addAnswersMode, shouldAnswersSumToOne}` flag
 *     design — good vocabulary for future MC / NUMERIC support. In
 *     this first slice only BINARY is implemented; the flags are
 *     reserved in the schema without being exercised.
 *
 * Feature-flagged behind `FORECASTS_ENABLED=true`. When unset, the
 * API routes return 404 (not 401 — we don't want the feature's
 * existence to leak before it's ready to be used). The DB schema
 * is always present but empty; no migration toggle needed.
 *
 * Tenant-scoped. Every forecast belongs to a tenant, every read
 * and write goes through `requireTenantContext` in the route
 * layer. Positions are per-user; the one-position-per-user
 * uniqueness constraint prevents accidental double-staking.
 */

import { getSqliteHandle } from "@/db";
import { resolveEnv } from "./env";

/** State machine. First-slice only BINARY forecasts, all states
 *  but `PENDING_RESOLUTION` reachable (that one waits on peer-
 *  signoff which is a follow-up commit). */
export type ForecastState =
  | "DRAFT"
  | "OPEN"
  | "CLOSED"
  | "PENDING_RESOLUTION"
  | "RESOLVED"
  | "CANCELLED";

/** Resolution outcome for BINARY forecasts. MC / NUMERIC will add
 *  more variants; the `string` union stays additive-safe. */
export type ForecastResolution = "YES" | "NO" | "PARTIAL" | "CANCEL";

export interface Forecast {
  id: string;
  tenantId: string;
  question: string;
  description: string | null;
  state: ForecastState;
  closeAt: string | null;
  resolvedAt: string | null;
  resolution: ForecastResolution | null;
  resolutionRationale: string | null;
  resolvedBy: string | null;
  resolutionApprover: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastPosition {
  id: string;
  forecastId: string;
  userId: string;
  /** For BINARY: the user's probability that the question resolves
   *  YES. 0..1. 0.5 means "genuinely uncertain". */
  yesProbability: number;
  rationale: string | null;
  stakedAt: string;
}

/** Returned by `getForecastDetail` — includes positions + derived
 *  aggregate so the UI doesn't need a second round-trip. */
export interface ForecastDetail extends Forecast {
  positions: ForecastPosition[];
  /** Unweighted mean of position probabilities. Null when there
   *  are zero positions. Separated from individual positions so
   *  the UI can show both the group view AND per-person stance. */
  derivedYesProbability: number | null;
}

/** Is the feature active for this deployment? */
export function forecastsEnabled(): boolean {
  return resolveEnv("FORECASTS_ENABLED") === "true";
}

/** Map a DB row to the domain type. Keeps the column-name → camel
 *  translation in one place. */
function rowToForecast(r: {
  id: string;
  tenant_id: string;
  question: string;
  description: string | null;
  state: ForecastState;
  close_at: string | null;
  resolved_at: string | null;
  resolution: ForecastResolution | null;
  resolution_rationale: string | null;
  resolved_by: string | null;
  resolution_approver: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): Forecast {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    question: r.question,
    description: r.description,
    state: r.state,
    closeAt: r.close_at,
    resolvedAt: r.resolved_at,
    resolution: r.resolution,
    resolutionRationale: r.resolution_rationale,
    resolvedBy: r.resolved_by,
    resolutionApprover: r.resolution_approver,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToPosition(r: {
  id: string;
  forecast_id: string;
  user_id: string;
  yes_probability: number;
  rationale: string | null;
  staked_at: string;
}): ForecastPosition {
  return {
    id: r.id,
    forecastId: r.forecast_id,
    userId: r.user_id,
    yesProbability: r.yes_probability,
    rationale: r.rationale,
    stakedAt: r.staked_at,
  };
}

function uuid(): string { return crypto.randomUUID(); }

/**
 * Create a new forecast. Defaults to `OPEN` state — the UI can
 * opt into `DRAFT` for questions that aren't ready for the team
 * yet. `closeAt` is optional; open-ended forecasts stay open
 * until an explicit state transition.
 */
export function createForecast(params: {
  tenantId: string;
  question: string;
  description?: string | null;
  closeAt?: string | null;
  createdBy: string;
  state?: ForecastState;
}): Forecast {
  if (!params.question.trim()) {
    throw new Error("Forecast question cannot be empty");
  }
  const db = getSqliteHandle();
  const id = uuid();
  const state: ForecastState = params.state ?? "OPEN";
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO forecasts (
      id, tenant_id, question, description, state,
      close_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.tenantId,
    params.question.trim(),
    params.description ?? null,
    state,
    params.closeAt ?? null,
    params.createdBy,
    now,
    now,
  );

  return {
    id,
    tenantId: params.tenantId,
    question: params.question.trim(),
    description: params.description ?? null,
    state,
    closeAt: params.closeAt ?? null,
    resolvedAt: null,
    resolution: null,
    resolutionRationale: null,
    resolvedBy: null,
    resolutionApprover: null,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

/** Read a single forecast by id, scoped to a tenant. Returns null
 *  if the forecast doesn't exist OR belongs to a different tenant.
 *  The API layer treats both as 404 — we don't leak existence. */
export function getForecast(id: string, tenantId: string): Forecast | null {
  const db = getSqliteHandle();
  const row = db.prepare(
    `SELECT * FROM forecasts WHERE id = ? AND tenant_id = ?`,
  ).get(id, tenantId) as Parameters<typeof rowToForecast>[0] | undefined;
  return row ? rowToForecast(row) : null;
}

/**
 * List forecasts in a tenant. Supports optional state filtering;
 * default order is newest-first by updated_at so recently-edited
 * items surface. No pagination for MVP (strategy teams rarely
 * have more than a few dozen open forecasts at once).
 */
export function listForecasts(
  tenantId: string,
  opts: { state?: ForecastState; limit?: number } = {},
): Forecast[] {
  const db = getSqliteHandle();
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500);
  let sql = `SELECT * FROM forecasts WHERE tenant_id = ?`;
  const args: unknown[] = [tenantId];
  if (opts.state) {
    sql += ` AND state = ?`;
    args.push(opts.state);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  args.push(limit);

  const rows = db.prepare(sql).all(...args) as Parameters<typeof rowToForecast>[0][];
  return rows.map(rowToForecast);
}

/** Load a forecast with its positions + derived aggregate. */
export function getForecastDetail(id: string, tenantId: string): ForecastDetail | null {
  const forecast = getForecast(id, tenantId);
  if (!forecast) return null;

  const db = getSqliteHandle();
  const positionRows = db.prepare(
    `SELECT * FROM forecast_positions WHERE forecast_id = ? ORDER BY staked_at DESC`,
  ).all(id) as Parameters<typeof rowToPosition>[0][];
  const positions = positionRows.map(rowToPosition);

  const derivedYesProbability = positions.length === 0
    ? null
    : positions.reduce((sum, p) => sum + p.yesProbability, 0) / positions.length;

  return { ...forecast, positions, derivedYesProbability };
}

/**
 * Upsert a position for a user on a forecast. Manifold's state-
 * machine lesson: allow updates but record the audit trail so we
 * know when a user changed their mind. First-slice simplification:
 * we overwrite `staked_at` on update; a proper audit table comes
 * with the resolution commit.
 */
export function recordPosition(params: {
  forecastId: string;
  tenantId: string;
  userId: string;
  yesProbability: number;
  rationale?: string | null;
}): ForecastPosition {
  if (!(params.yesProbability >= 0 && params.yesProbability <= 1)) {
    throw new Error("yesProbability must be in [0, 1]");
  }
  // Scope check — refuse to stake on a forecast from another tenant
  // even if we get a correct forecast_id by accident.
  const forecast = getForecast(params.forecastId, params.tenantId);
  if (!forecast) throw new Error("Forecast not found in this tenant");
  if (forecast.state !== "OPEN") {
    throw new Error(`Forecast is not open (state=${forecast.state})`);
  }
  if (forecast.closeAt && new Date(forecast.closeAt) < new Date()) {
    throw new Error("Forecast is past its close date");
  }

  const db = getSqliteHandle();
  const now = new Date().toISOString();
  const id = uuid();

  db.prepare(
    `INSERT INTO forecast_positions (
      id, forecast_id, user_id, yes_probability, rationale, staked_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(forecast_id, user_id) DO UPDATE SET
      yes_probability = excluded.yes_probability,
      rationale = excluded.rationale,
      staked_at = excluded.staked_at`,
  ).run(
    id,
    params.forecastId,
    params.userId,
    params.yesProbability,
    params.rationale ?? null,
    now,
  );

  // Read back to get the canonical row (handles the upsert case
  // where `id` in the SELECT won't match the `id` we generated).
  const row = db.prepare(
    `SELECT * FROM forecast_positions WHERE forecast_id = ? AND user_id = ?`,
  ).get(params.forecastId, params.userId) as Parameters<typeof rowToPosition>[0];

  // Bump the forecast's updated_at so list views sort it to the top.
  db.prepare(`UPDATE forecasts SET updated_at = ? WHERE id = ?`).run(now, params.forecastId);

  return rowToPosition(row);
}

/**
 * Propose a resolution. SIS's differentiator over Manifold's
 * creator-resolves-own-market: resolution requires TWO signers.
 * This call records the outcome + rationale + who proposed it,
 * but leaves the forecast in PENDING_RESOLUTION state. A second
 * owner/admin (not the proposer) must call `approveResolution`
 * to finalise.
 *
 * Transitions accepted: OPEN → PENDING_RESOLUTION, CLOSED →
 * PENDING_RESOLUTION. Re-proposing (calling this on an already-
 * PENDING_RESOLUTION forecast) is allowed and just overwrites
 * the proposed outcome — the approver still needs to sign off.
 */
export function proposeResolution(params: {
  forecastId: string;
  tenantId: string;
  proposerUserId: string;
  resolution: ForecastResolution;
  rationale: string;
}): Forecast {
  if (!params.rationale.trim()) {
    throw new Error("Resolution rationale required");
  }
  const forecast = getForecast(params.forecastId, params.tenantId);
  if (!forecast) throw new Error("Forecast not found in this tenant");
  if (forecast.state !== "OPEN" && forecast.state !== "CLOSED" && forecast.state !== "PENDING_RESOLUTION") {
    throw new Error(`Forecast cannot be proposed for resolution (state=${forecast.state})`);
  }

  const db = getSqliteHandle();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE forecasts SET
      state = 'PENDING_RESOLUTION',
      resolution = ?,
      resolution_rationale = ?,
      resolved_by = ?,
      resolution_approver = NULL,
      updated_at = ?
    WHERE id = ?`,
  ).run(params.resolution, params.rationale.trim(), params.proposerUserId, now, params.forecastId);

  return {
    ...forecast,
    state: "PENDING_RESOLUTION",
    resolution: params.resolution,
    resolutionRationale: params.rationale.trim(),
    resolvedBy: params.proposerUserId,
    resolutionApprover: null,
    updatedAt: now,
  };
}

/**
 * Second signature on a pending resolution — transitions the
 * forecast to RESOLVED. The approver MUST be a different user
 * than the proposer. Callers are responsible for enforcing the
 * "owner/admin only" rule at the API layer (requireTenantRole).
 *
 * Welle C Item 3 hook: on successful transition to RESOLVED, we
 * snapshot per-user Brier scores into `forecast_calibration`.
 * This is what feeds the calibration-curve endpoint.
 */
export function approveResolution(params: {
  forecastId: string;
  tenantId: string;
  approverUserId: string;
}): Forecast {
  const forecast = getForecast(params.forecastId, params.tenantId);
  if (!forecast) throw new Error("Forecast not found in this tenant");
  if (forecast.state !== "PENDING_RESOLUTION") {
    throw new Error(`Forecast is not pending resolution (state=${forecast.state})`);
  }
  if (!forecast.resolvedBy || !forecast.resolution) {
    throw new Error("Forecast is pending but missing proposal details — data corruption?");
  }
  if (forecast.resolvedBy === params.approverUserId) {
    throw new Error("The approver must be a different user than the proposer");
  }

  const db = getSqliteHandle();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE forecasts SET
      state = 'RESOLVED',
      resolution_approver = ?,
      resolved_at = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(params.approverUserId, now, now, params.forecastId);

  // Welle C Item 3 — snapshot calibration for every position.
  // Only BINARY YES/NO map to a numeric outcome; PARTIAL and
  // CANCEL don't produce a clean ground truth, so we skip
  // calibration writes in those cases. The caller still gets a
  // successful RESOLVED state — we just don't feed a noisy
  // sample into the Brier stats.
  if (forecast.resolution === "YES" || forecast.resolution === "NO") {
    const outcome = forecast.resolution === "YES" ? 1 : 0;
    const positionRows = db.prepare(
      `SELECT user_id, yes_probability FROM forecast_positions WHERE forecast_id = ?`,
    ).all(params.forecastId) as Array<{ user_id: string; yes_probability: number }>;

    const insert = db.prepare(
      `INSERT INTO forecast_calibration (
        id, forecast_id, tenant_id, user_id, yes_probability,
        outcome, brier_score, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(forecast_id, user_id) DO UPDATE SET
        yes_probability = excluded.yes_probability,
        outcome = excluded.outcome,
        brier_score = excluded.brier_score,
        recorded_at = excluded.recorded_at`,
    );

    for (const row of positionRows) {
      const brier = (row.yes_probability - outcome) ** 2;
      insert.run(
        `${params.forecastId}-${row.user_id}`,
        params.forecastId,
        params.tenantId,
        row.user_id,
        row.yes_probability,
        outcome,
        brier,
        now,
      );
    }
  }

  return {
    ...forecast,
    state: "RESOLVED",
    resolutionApprover: params.approverUserId,
    resolvedAt: now,
    updatedAt: now,
  };
}

// ─── Calibration read helpers (Welle C Item 3) ──────────────────────

export interface CalibrationRow {
  forecastId: string;
  userId: string;
  yesProbability: number;
  outcome: 0 | 1;
  brierScore: number;
  recordedAt: string;
}

/** Raw calibration history for one user in one tenant. */
export function getUserCalibration(
  tenantId: string,
  userId: string,
  limit = 200,
): CalibrationRow[] {
  const db = getSqliteHandle();
  const rows = db.prepare(
    `SELECT forecast_id, user_id, yes_probability, outcome, brier_score, recorded_at
       FROM forecast_calibration
      WHERE tenant_id = ? AND user_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?`,
  ).all(tenantId, userId, Math.max(1, Math.min(500, limit))) as Array<{
    forecast_id: string; user_id: string; yes_probability: number;
    outcome: 0 | 1; brier_score: number; recorded_at: string;
  }>;
  return rows.map((r) => ({
    forecastId: r.forecast_id,
    userId: r.user_id,
    yesProbability: r.yes_probability,
    outcome: r.outcome,
    brierScore: r.brier_score,
    recordedAt: r.recorded_at,
  }));
}

/**
 * Decile-bucketed calibration curve for one user. Each bucket:
 *   { bucketMid: 0.05, 0.15, ..., 0.95
 *     count: number of predictions whose yesProbability fell in
 *             that bucket,
 *     observedRate: mean outcome in the bucket (what % actually
 *             resolved YES)
 *   }
 * A well-calibrated user has `observedRate ≈ bucketMid` across
 * the curve. The UI can plot (bucketMid, observedRate) against
 * the y=x diagonal — deviation = calibration error.
 */
export interface CalibrationBucket {
  bucketMid: number;
  count: number;
  observedRate: number | null;
}

export interface CalibrationSummary {
  user: string;
  totalResolved: number;
  meanBrier: number | null;
  buckets: CalibrationBucket[];
}

const DECILE_BOUNDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

/**
 * Build a decile calibration summary for a user. Null `meanBrier`
 * and empty buckets when the user has no resolved positions yet.
 * The Stanford calibration convention: lower Brier is better,
 * 0.0 = perfectly calibrated on every call, 0.25 = always 50-50,
 * 1.0 = maximally wrong.
 */
export function getCalibrationSummary(
  tenantId: string,
  userId: string,
): CalibrationSummary {
  const rows = getUserCalibration(tenantId, userId, 500);
  if (rows.length === 0) {
    return { user: userId, totalResolved: 0, meanBrier: null, buckets: [] };
  }

  const meanBrier = rows.reduce((sum, r) => sum + r.brierScore, 0) / rows.length;

  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < DECILE_BOUNDS.length - 1; i++) {
    const low = DECILE_BOUNDS[i];
    const high = DECILE_BOUNDS[i + 1];
    // Last bucket is closed on both sides so p=1.0 lands in it.
    const inBucket = rows.filter((r) =>
      i === DECILE_BOUNDS.length - 2
        ? r.yesProbability >= low && r.yesProbability <= high
        : r.yesProbability >= low && r.yesProbability < high,
    );
    if (inBucket.length === 0) {
      buckets.push({ bucketMid: (low + high) / 2, count: 0, observedRate: null });
      continue;
    }
    const observed = inBucket.reduce((sum, r) => sum + r.outcome, 0) / inBucket.length;
    buckets.push({
      bucketMid: (low + high) / 2,
      count: inBucket.length,
      observedRate: observed,
    });
  }

  return {
    user: userId,
    totalResolved: rows.length,
    meanBrier,
    buckets,
  };
}

/**
 * Transition the state of a forecast. Permitted transitions are
 * enforced here rather than in SQL CHECK so error messages are
 * readable.
 */
export function setForecastState(
  id: string,
  tenantId: string,
  newState: ForecastState,
): Forecast {
  const forecast = getForecast(id, tenantId);
  if (!forecast) throw new Error("Forecast not found in this tenant");

  const allowed: Record<ForecastState, ForecastState[]> = {
    DRAFT: ["OPEN", "CANCELLED"],
    OPEN: ["CLOSED", "PENDING_RESOLUTION", "CANCELLED"],
    CLOSED: ["OPEN", "PENDING_RESOLUTION", "CANCELLED"],
    PENDING_RESOLUTION: ["RESOLVED", "CLOSED", "CANCELLED"],
    RESOLVED: [], // terminal
    CANCELLED: [], // terminal
  };

  if (!allowed[forecast.state].includes(newState)) {
    throw new Error(`Invalid transition: ${forecast.state} → ${newState}`);
  }

  const db = getSqliteHandle();
  const now = new Date().toISOString();
  db.prepare(`UPDATE forecasts SET state = ?, updated_at = ? WHERE id = ?`).run(
    newState,
    now,
    id,
  );
  return { ...forecast, state: newState, updatedAt: now };
}
