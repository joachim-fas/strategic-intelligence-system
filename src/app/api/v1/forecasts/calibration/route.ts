/**
 * GET /api/v1/forecasts/calibration — tenant-wide leaderboard.
 *
 * Welle C Item 3 follow-up. Returns one row per user with ≥ N
 * resolved predictions, sorted best-calibrated first (lowest mean
 * Brier). N defaults to 3 — scale-adjusted from Manifold's "≥10
 * markets" threshold which is too high for a 5–15-person tenant.
 *
 * Query params:
 *   ?min=<int>    — minimum resolved predictions, default 3, max 50.
 *   ?limit=<int>  — cap the result set, default 50, max 200.
 *
 * Response:
 *   {
 *     count: number,
 *     leaderboard: Array<{
 *       userId: string,
 *       totalResolved: number,
 *       meanBrier: number,   // always present (HAVING n>=1)
 *     }>,
 *   }
 *
 * Same rate-limit + feature-flag posture as the per-user
 * calibration endpoint.
 */

import { NextResponse } from "next/server";
import {
  apiSuccess,
  apiError,
  CACHE_HEADERS,
  requireTenantContext,
} from "@/lib/api-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import {
  getTenantCalibrationLeaderboard,
  forecastsEnabled,
} from "@/lib/forecasts";

export const dynamic = "force-dynamic";

const FEATURE_404 = () =>
  NextResponse.json(
    { ok: false, error: { message: "Not found", code: "NOT_FOUND" } },
    { status: 404 },
  );

export async function GET(request: Request): Promise<NextResponse> {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60_000)) return tooManyRequests();

  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const url = new URL(request.url);
  const minRaw = url.searchParams.get("min");
  const limitRaw = url.searchParams.get("limit");
  const min = minRaw ? Math.max(1, Math.min(50, Number(minRaw) || 3)) : 3;
  const limit = limitRaw ? Math.max(1, Math.min(200, Number(limitRaw) || 50)) : 50;

  try {
    const leaderboard = getTenantCalibrationLeaderboard(ctx.tenantId, {
      minPredictions: min,
      limit,
    });
    return apiSuccess(
      { count: leaderboard.length, leaderboard },
      200,
      CACHE_HEADERS.short,
    );
  } catch (err) {
    console.error("[api/v1/forecasts/calibration]", err);
    return apiError("Leaderboard lookup failed", 500);
  }
}
