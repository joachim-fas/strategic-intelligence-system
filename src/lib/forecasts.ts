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
