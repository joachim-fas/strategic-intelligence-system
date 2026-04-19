/**
 * /api/v1/forecasts/[id]/positions — stake confidence on a forecast.
 *
 * Welle C Item 2. Feature-flagged via FORECASTS_ENABLED.
 *
 * POST /api/v1/forecasts/[id]/positions
 *   Body: { yesProbability: 0..1, rationale?: string }
 *   Upserts the caller's position on the forecast. Idempotent per
 *   (forecast, user) — later calls update the stored probability
 *   and bump the stake timestamp (audit trail is a follow-up).
 *
 * Requires tenant role "member" or higher. Fails if:
 *   - forecast isn't OPEN
 *   - close_at has passed
 *   - probability outside [0, 1]
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiSuccess,
  apiError,
  CACHE_HEADERS,
  requireTenantRole,
} from "@/lib/api-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { recordPosition, forecastsEnabled } from "@/lib/forecasts";

export const dynamic = "force-dynamic";

const FEATURE_404 = () =>
  NextResponse.json(
    { ok: false, error: { message: "Not found", code: "NOT_FOUND" } },
    { status: 404 },
  );

const PositionBody = z.object({
  yesProbability: z.number().min(0).max(1),
  rationale: z.string().max(2000).optional().nullable(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Positions are upserts (one per user per forecast) — 30/min is
  // generous for a human-driven slider but catches automation.
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`POST:${clientIp}`, 30, 60_000)) return tooManyRequests();

  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantRole(request, "member");
  if (ctx.errorResponse) return ctx.errorResponse;

  const { id } = await context.params;
  if (!id) return apiError("Missing forecast id", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = PositionBody.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Invalid body: " + parsed.error.issues.map((i) => i.message).join(", "),
      400,
    );
  }

  try {
    const position = recordPosition({
      forecastId: id,
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      yesProbability: parsed.data.yesProbability,
      rationale: parsed.data.rationale ?? null,
    });
    return apiSuccess(position, 201, CACHE_HEADERS.none);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Expected validation-style errors from the library → 400.
    // Anything else → 500.
    const status = /not found|not open|past its close|must be in/i.test(msg) ? 400 : 500;
    if (status === 500) console.error("[api/v1/forecasts/positions] error:", err);
    return apiError(msg, status);
  }
}
