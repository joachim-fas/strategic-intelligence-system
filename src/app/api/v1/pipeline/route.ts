/**
 * POST /api/v1/pipeline — trigger a full pipeline run.
 *
 * Thin wrapper around `runPipeline()` in `@/lib/pipeline`. Both the
 * user-triggered run (Monitor page "Run Pipeline" button, and the
 * `/live` home-page shortcut) and the scheduled cron hit the same
 * implementation — one code path, one storage target (live_signals +
 * trend_signals in SQLite/Postgres).
 *
 * 2026-04-18 (ARC-06): previously this route had its own Promise.allSettled
 * fan-out + in-memory `lastFetchResult` state while `@/lib/pipeline` had
 * a concurrency-limited loop that wrote to the DB. Both call sites ran a
 * different pipeline with different storage, which meant the Monitor
 * button produced phantom results that cron/other API routes never saw.
 * That dual implementation is gone; this file now just delegates.
 *
 * Response shape is kept backward-compatible with what the Monitor page
 * and the HomeClient `/live` command rely on (signalCount, sources,
 * errors, duration) so no consumer needs to change.
 */

import { NextResponse } from "next/server";
import { ensureEnvLoaded } from "@/lib/env";
import { requirePipelineTrigger } from "@/lib/api-helpers";
import { runPipeline } from "@/lib/pipeline";

// Bootstrap .env.local for paths with spaces (e.g. "Meine Ablage")
ensureEnvLoaded();

export async function POST(req: Request) {
  // SEC audit 2026-04: previously anonymous — any client could trigger
  // a full connector fan-out, burning external API quotas and in-memory
  // state. Requires a system-admin session or the CRON_SECRET bearer.
  const gate = await requirePipelineTrigger(req);
  if (gate.errorResponse) return gate.errorResponse;

  const result = await runPipeline();

  // Normalise response shape for existing consumers. `runPipeline()`
  // returns `errors: { source, error }[]` + `durationMs` + `trendCount`;
  // the Monitor page (and the `/live` fire-and-forget) read the older
  // flat shape, so map here rather than forcing a client change.
  return NextResponse.json({
    success: result.success,
    skipped: result.skipped ?? false,
    signalCount: result.signalCount,
    trendCount: result.trendCount,
    sources: result.sources,
    errors: result.errors.map(e => `${e.source}: ${e.error}`),
    duration: result.durationMs,
    fetchedAt: result.timestamp,
  });
}
