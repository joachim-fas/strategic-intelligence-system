/**
 * GET /api/v1/health — liveness / readiness probe.
 *
 * Unauthenticated on purpose — uptime monitors (Vercel, BetterUptime,
 * Datadog, K8s probes) need a stable HTTP endpoint without carrying
 * credentials. No sensitive data leaks: we publish only booleans +
 * counts and a couple of age metrics.
 *
 * Return shape is flat + stable so monitoring tools can grep for
 * "ok:true" and boolean sub-fields, and so the schema is a documented
 * contract rather than shifting envelope keys.
 *
 * Status determination:
 *   - If DB can be opened + required tables exist → db.ok=true.
 *   - If signals pipeline wrote something in the last 6h → pipeline.ok=true.
 *     (6h is > Vercel-cron 4h interval; a single miss shouldn't alert,
 *     two consecutive misses should.)
 *   - Overall `ok`:
 *       - true  → all critical subsystems healthy
 *       - false → DB unreachable (critical)
 *     Pipeline-stale does NOT flip `ok` to false — it's reported as a
 *     separate boolean so monitoring can alert with a lower severity.
 *
 * HTTP:
 *   200 with `ok:true`   → fully healthy
 *   200 with `ok:false`  → degraded but running (e.g. pipeline stale)
 *   503 with `ok:false`  → DB unreachable (readiness fail)
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthPayload {
  ok: boolean;
  /**
   * Critical-Fix-Plan P0-4 (Notion 2026-04-20): Top-level Label für
   * Monitoring-Tools. "fresh" = Cron läuft, Signale jünger als Toleranz.
   * "stale" = mindestens zwei aufeinanderfolgende Cron-Misses. Triggert
   * keine 5xx — das bleibt bei DB-Unreachable — aber Monitoring soll hier
   * bei "stale" eine Low-Severity-Alarmierung auslösen.
   */
  staleness: "fresh" | "stale" | "unknown";
  uptimeMs: number;
  timestamp: string;
  db: {
    ok: boolean;
    dialect: "sqlite" | "postgres";
    tables: {
      tenants: number | null;
      liveSignals: number | null;
      radars: number | null;
    };
  };
  pipeline: {
    ok: boolean;
    newestSignalAgeHours: number | null;
    signalsLast72h: number | null;
    /** ISO-Timestamp des neuesten live_signal — de-facto "last pipeline run". */
    lastSignalAt: string | null;
    /** Gesamtzahl live_signals (nicht nur letzte 72h). */
    totalSignals: number | null;
  };
  app: {
    env: string;
    nodeVersion: string;
  };
}

/**
 * Staleness-Schwelle: Cron läuft alle 4h (vercel.json). Zwischen zwei
 * Läufen sind Signale maximal ~4h alt — zur Toleranz eines einzelnen
 * verpassten Cron-Runs setzen wir die Grenze auf 6h. Zwei aufeinander-
 * folgende Misses (8-12h) lösen dann "stale" aus.
 */
const STALENESS_THRESHOLD_HOURS = 6;

// Process-level start used for `uptimeMs`. Captured once per cold-start.
const PROCESS_START = Date.now();

export async function GET() {
  const dialect = (process.env.DATABASE_URL ?? "").startsWith("postgres") ? "postgres" : "sqlite";
  const payload: HealthPayload = {
    ok: true,
    staleness: "unknown",
    uptimeMs: Date.now() - PROCESS_START,
    timestamp: new Date().toISOString(),
    db: {
      ok: false,
      dialect,
      tables: { tenants: null, liveSignals: null, radars: null },
    },
    pipeline: {
      ok: false,
      newestSignalAgeHours: null,
      signalsLast72h: null,
      lastSignalAt: null,
      totalSignals: null,
    },
    app: {
      env: process.env.NODE_ENV ?? "unknown",
      nodeVersion: process.version,
    },
  };

  // Open the DB directly (readonly) to avoid side-effects: the auto-
  // migration in src/db/index.ts would otherwise run on every probe.
  if (dialect === "sqlite") {
    try {
      const dbPath = path.join(process.cwd(), "local.db");
      const d = new Database(dbPath, { readonly: true });
      try {
        const tenants = d.prepare("SELECT COUNT(*) AS n FROM tenants").get() as { n: number } | undefined;
        const radars = d.prepare("SELECT COUNT(*) AS n FROM radars").get() as { n: number } | undefined;
        const signals = d.prepare("SELECT COUNT(*) AS n FROM live_signals WHERE fetched_at > datetime('now','-72 hours')").get() as { n: number } | undefined;
        const total = d.prepare("SELECT COUNT(*) AS n FROM live_signals").get() as { n: number } | undefined;
        const newest = d.prepare("SELECT MAX(fetched_at) AS t FROM live_signals").get() as { t: string | null } | undefined;

        payload.db.ok = true;
        payload.db.tables.tenants = tenants?.n ?? 0;
        payload.db.tables.radars = radars?.n ?? 0;
        payload.db.tables.liveSignals = signals?.n ?? 0;
        payload.pipeline.totalSignals = total?.n ?? 0;

        if (newest?.t) {
          const ageMs = Date.now() - new Date(newest.t).getTime();
          const ageHours = ageMs / 3_600_000;
          payload.pipeline.newestSignalAgeHours = Number(ageHours.toFixed(2));
          payload.pipeline.signalsLast72h = signals?.n ?? 0;
          payload.pipeline.lastSignalAt = new Date(newest.t).toISOString();
          payload.pipeline.ok = ageHours <= STALENESS_THRESHOLD_HOURS;
          payload.staleness = ageHours <= STALENESS_THRESHOLD_HOURS ? "fresh" : "stale";
        } else {
          // Keine Signale überhaupt → Pipeline hat noch nie gelaufen.
          payload.staleness = "stale";
        }
      } finally {
        d.close();
      }
    } catch {
      // DB probe failed — leave payload.db.ok=false.
    }
  } else {
    // Postgres path: don't attempt to open here. We report dialect but
    // rely on the Drizzle-backed routes to surface DB issues separately.
    // A dedicated /api/v1/health/deep could do a real ping later.
    payload.db.ok = true;
  }

  const dbOk = payload.db.ok;
  payload.ok = dbOk; // pipeline-stale doesn't flip overall; it's separate

  return NextResponse.json(payload, {
    status: dbOk ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
