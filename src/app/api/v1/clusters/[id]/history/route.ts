/**
 * GET /api/v1/clusters/[id]/history — cluster snapshot history.
 *
 * Welle B Item 2 of the 4-app Deep-Dive (Perigon-inspired, SIS shape).
 *
 * Returns the snapshot time-series for a single cluster in reverse-
 * chronological order. The cluster id is the slugified topic string
 * (`ai-regulation`, `quantum-computing`, etc.) — stable across pipeline
 * runs. Pipeline-Phase 2d writes one snapshot row per cluster per run;
 * this route reads them back.
 *
 * Query params:
 *   ?limit=N  — cap the result set (default 50 ≈ 8 days @ 4h cadence).
 *
 * Response shape:
 *   {
 *     clusterId: string,
 *     topic: string | null,
 *     count: number,
 *     snapshots: Array<{
 *       id: string,
 *       triggeredAt: string,      // ISO
 *       signalCount: number,
 *       signalIds: string[],
 *       summary: string,
 *       changelog: string | null,   // null until Welle-C LLM hook lands
 *       foresight: unknown | null,  // null until Welle-C LLM hook lands
 *     }>,
 *   }
 *
 * Authentication: unauthenticated reads of snapshot history are
 * acceptable in this MVP — the data doesn't cross a tenant boundary
 * (clusters are derived from public signals, not per-tenant content)
 * and the entire shape is otherwise available via /monitor. When
 * per-tenant clusters land (Welle C), this route will move under
 * requireTenantContext().
 */

import { NextResponse } from "next/server";
import { getClusterHistory, countClusterSnapshots } from "@/lib/cluster-snapshots";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import {
  parsePaginationParams,
  buildPaginationEnvelope,
} from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60_000)) {
    return tooManyRequests();
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return apiError("Missing cluster id", 400);
  }

  // PERF-13 — standardised offset+limit pagination via the shared
  // helper. Existing callers that only passed ?limit= keep working
  // because offset defaults to 0.
  const url = new URL(request.url);
  const { offset, limit } = parsePaginationParams(url, { defaultLimit: 50 });

  try {
    const snapshots = getClusterHistory(id, limit, offset);
    const total = countClusterSnapshots(id);
    return apiSuccess(
      {
        clusterId: id,
        topic: snapshots[0]?.topic ?? null,
        count: snapshots.length,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          triggeredAt: s.triggeredAt,
          signalCount: s.signalCount,
          signalIds: s.signalIds,
          summary: s.summary,
          changelog: s.changelog,
          foresight: s.foresight,
        })),
        pagination: buildPaginationEnvelope({
          total, offset, limit, returned: snapshots.length,
        }),
      },
      200,
      CACHE_HEADERS.short,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/v1/clusters/${id}/history]`, err);
    return apiError(`History lookup failed: ${message}`, 500);
  }
}
