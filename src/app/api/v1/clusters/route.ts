/**
 * GET /api/v1/clusters — list of all known clusters with metadata.
 *
 * Companion to /api/v1/clusters/[id]/history. Returns one row per
 * cluster with enough data to render a catalogue: topic, latest
 * snapshot timestamp, total snapshot count, latest signal count.
 *
 * Response:
 *   {
 *     count: number,
 *     clusters: Array<{
 *       clusterId: string,
 *       topic: string,
 *       latestAt: string,
 *       snapshotCount: number,
 *       latestSignalCount: number,
 *     }>,
 *   }
 *
 * Rate-limited to the same 60 req/min budget as the rest of the
 * unauthenticated read routes. Cached short — the cluster set turns
 * over on pipeline cadence (every 4 h in prod).
 */

import { NextResponse } from "next/server";
import { listClusters } from "@/lib/cluster-snapshots";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60_000)) {
    return tooManyRequests();
  }

  try {
    const clusters = listClusters();
    return apiSuccess(
      { count: clusters.length, clusters },
      200,
      CACHE_HEADERS.short,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/v1/clusters]", err);
    return apiError(`Cluster list failed: ${message}`, 500);
  }
}
