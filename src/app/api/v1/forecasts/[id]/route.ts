/**
 * /api/v1/forecasts/[id] — single forecast detail (tenant-scoped).
 *
 * Welle C Item 2. Feature-flagged via FORECASTS_ENABLED.
 *
 * GET /api/v1/forecasts/[id]
 *   Returns { ...forecast, positions[], derivedYesProbability }.
 *   404 when the forecast doesn't exist OR belongs to a different
 *   tenant (we don't leak existence across tenant boundaries).
 */

import { NextResponse } from "next/server";
import {
  apiSuccess,
  apiError,
  CACHE_HEADERS,
  requireTenantContext,
} from "@/lib/api-helpers";
import { getForecastDetail, forecastsEnabled } from "@/lib/forecasts";

export const dynamic = "force-dynamic";

const FEATURE_404 = () =>
  NextResponse.json(
    { ok: false, error: { message: "Not found", code: "NOT_FOUND" } },
    { status: 404 },
  );

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const { id } = await context.params;
  if (!id) return apiError("Missing id", 400);

  const detail = getForecastDetail(id, ctx.tenantId);
  if (!detail) return FEATURE_404();

  return apiSuccess(detail, 200, CACHE_HEADERS.short);
}
