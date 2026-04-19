/**
 * /api/v1/forecasts/[id]/resolve — two-stage resolution.
 *
 * Welle C Item 2, slice 2. Feature-flagged via FORECASTS_ENABLED.
 *
 * SIS's differentiator over Manifold's creator-resolves-own-market:
 * resolution requires a SECOND signer. Flow:
 *   1. Owner/admin calls POST with { action: "propose", resolution,
 *      rationale }. Forecast moves to PENDING_RESOLUTION state.
 *   2. A different owner/admin calls POST with { action: "approve" }.
 *      Forecast moves to RESOLVED.
 *
 * Both endpoints require tenant role "admin" or higher. The
 * proposer ≠ approver check lives in the library so the rule is
 * enforced even if a different UI path invokes the same helper.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiSuccess,
  apiError,
  CACHE_HEADERS,
  requireTenantRole,
} from "@/lib/api-helpers";
import {
  proposeResolution,
  approveResolution,
  forecastsEnabled,
  type ForecastResolution,
} from "@/lib/forecasts";

export const dynamic = "force-dynamic";

const FEATURE_404 = () =>
  NextResponse.json(
    { ok: false, error: { message: "Not found", code: "NOT_FOUND" } },
    { status: 404 },
  );

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("propose"),
    resolution: z.enum(["YES", "NO", "PARTIAL", "CANCEL"]),
    rationale: z.string().min(1).max(2000),
  }),
  z.object({
    action: z.literal("approve"),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!forecastsEnabled()) return FEATURE_404();

  const ctx = await requireTenantRole(request, "admin");
  if (ctx.errorResponse) return ctx.errorResponse;

  const { id } = await context.params;
  if (!id) return apiError("Missing forecast id", 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "Invalid body: " + parsed.error.issues.map((i) => i.message).join(", "),
      400,
    );
  }

  try {
    if (parsed.data.action === "propose") {
      const forecast = proposeResolution({
        forecastId: id,
        tenantId: ctx.tenantId,
        proposerUserId: ctx.user.id,
        resolution: parsed.data.resolution as ForecastResolution,
        rationale: parsed.data.rationale,
      });
      return apiSuccess(forecast, 200, CACHE_HEADERS.none);
    }

    // action === "approve"
    const forecast = approveResolution({
      forecastId: id,
      tenantId: ctx.tenantId,
      approverUserId: ctx.user.id,
    });
    return apiSuccess(forecast, 200, CACHE_HEADERS.none);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /not found|not pending|cannot be proposed|different user|rationale required|missing proposal/i.test(msg)
      ? 400 : 500;
    if (status === 500) console.error("[api/v1/forecasts/resolve]", err);
    return apiError(msg, status);
  }
}
