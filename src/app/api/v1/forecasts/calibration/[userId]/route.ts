/**
 * /api/v1/forecasts/calibration/[userId] — per-user calibration summary.
 *
 * Welle C Item 3. Feature-flagged via FORECASTS_ENABLED.
 *
 * GET /api/v1/forecasts/calibration/[userId]
 *   Returns { user, totalResolved, meanBrier, buckets } scoped to
 *   the active tenant. The userId is the tenant member whose
 *   calibration we want; request scope is tenant-only (any
 *   member can read any member's calibration — data is the
 *   team's transparency layer, not a privacy boundary).
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
  getCalibrationSummary,
  forecastsEnabled,
} from "@/lib/forecasts";

export const dynamic = "force-dynamic";

const FEATURE_404 = () =>
  NextResponse.json(
    { ok: false, error: { message: "Not found", code: "NOT_FOUND" } },
    { status: 404 },
  );

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  // The /forecasts detail panel calls this once per position on
  // mount, so the limit matches the list endpoint (60/min).
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60_000)) return tooManyRequests();

  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const { userId } = await context.params;
  if (!userId) return apiError("Missing userId", 400);

  try {
    const summary = getCalibrationSummary(ctx.tenantId, userId);
    return apiSuccess(summary, 200, CACHE_HEADERS.short);
  } catch (err) {
    console.error("[api/v1/forecasts/calibration]", err);
    return apiError("Calibration lookup failed", 500);
  }
}
