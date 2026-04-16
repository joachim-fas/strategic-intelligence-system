/**
 * POST /api/v1/alerts/[id]/dismiss — dismiss a scenario alert
 *
 * Tenant gating: caller must have member-or-higher role in their
 * active tenant, AND the alert's backing radar must live in that
 * tenant. Without the radar-join a member of tenant A could dismiss
 * alerts of tenant B by guessing the alert UUID (SEC audit 2026-04).
 */
import { dismissAlert } from "@/lib/scenario-alerts";
import { apiSuccess, apiError, requireTenantContext } from "@/lib/api-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot dismiss alerts", 403, "INSUFFICIENT_TENANT_ROLE");
  }
  const updated = dismissAlert(id, ctx.tenantId);
  if (!updated) {
    // Either unknown id or alert belongs to another tenant. Return 404
    // rather than 403 so we don't leak the existence of out-of-tenant
    // alerts.
    return apiError("Alert not found", 404, "NOT_FOUND");
  }
  return apiSuccess({ dismissed: true });
}
