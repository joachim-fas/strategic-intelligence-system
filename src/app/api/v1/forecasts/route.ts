/**
 * /api/v1/forecasts — list + create forecasts (tenant-scoped).
 *
 * Welle C Item 2. Feature-flagged behind `FORECASTS_ENABLED=true`.
 * When the flag is off, returns 404 for every verb so the feature's
 * existence doesn't leak to unauthorised probes.
 *
 * GET /api/v1/forecasts?state=OPEN&limit=50
 *   Returns { count, forecasts[] } scoped to the active tenant.
 *
 * POST /api/v1/forecasts
 *   Body: { question, description?, closeAt?, state? }
 *   Creates a forecast in the active tenant, returns the shape.
 *   Requires tenant role "member" or higher — viewers can't author.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiSuccess,
  apiError,
  CACHE_HEADERS,
  requireTenantContext,
  requireTenantRole,
} from "@/lib/api-helpers";
import {
  createForecast,
  listForecasts,
  forecastsEnabled,
  type ForecastState,
} from "@/lib/forecasts";

export const dynamic = "force-dynamic";

const FEATURE_404 = () =>
  NextResponse.json(
    { ok: false, error: { message: "Not found", code: "NOT_FOUND" } },
    { status: 404 },
  );

export async function GET(request: Request): Promise<NextResponse> {
  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state");
  const state = isForecastState(stateParam) ? stateParam : undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw) || 100)) : 100;

  const forecasts = listForecasts(ctx.tenantId, { state, limit });
  return apiSuccess(
    { count: forecasts.length, forecasts },
    200,
    CACHE_HEADERS.short,
  );
}

const CreateBody = z.object({
  question: z.string().min(1).max(500),
  description: z.string().max(4000).optional().nullable(),
  closeAt: z.string().datetime().optional().nullable(),
  state: z.enum(["DRAFT", "OPEN"]).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantRole(request, "member");
  if (ctx.errorResponse) return ctx.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Invalid body: " + parsed.error.issues.map((i) => i.message).join(", "),
      400,
    );
  }

  try {
    const forecast = createForecast({
      tenantId: ctx.tenantId,
      question: parsed.data.question,
      description: parsed.data.description ?? null,
      closeAt: parsed.data.closeAt ?? null,
      state: parsed.data.state,
      createdBy: ctx.user.id,
    });
    return apiSuccess(forecast, 201, CACHE_HEADERS.none);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/v1/forecasts] create failed:", err);
    return apiError(`Create failed: ${msg}`, 400);
  }
}

function isForecastState(v: string | null): v is ForecastState {
  return v === "DRAFT" || v === "OPEN" || v === "CLOSED"
    || v === "PENDING_RESOLUTION" || v === "RESOLVED" || v === "CANCELLED";
}
