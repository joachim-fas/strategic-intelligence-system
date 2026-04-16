/**
 * GET /api/v1/alerts?nodeIds=a,b,c — batch alert counts for canvas nodes
 *
 * SEC audit 2026-04: the counts query now joins scenario_alerts →
 * radars and filters by `radars.tenant_id = ctx.tenantId`. Without
 * this, a member of tenant A could probe up to 100 node-ids per call
 * and discover which ones exist in tenant B. The leak was small
 * (count, not content) but real.
 */
import { getAlertCounts } from "@/lib/scenario-alerts";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const url = new URL(req.url);
  const nodeIds = url.searchParams.get("nodeIds");
  if (!nodeIds) {
    return apiError("nodeIds required", 400, "VALIDATION_ERROR");
  }
  const ids = nodeIds.split(",").filter(Boolean).slice(0, 100);
  const counts = getAlertCounts(ids, ctx.tenantId);
  return apiSuccess({ counts }, 200, CACHE_HEADERS.short);
}
