/**
 * GET /api/v1/alerts?nodeIds=a,b,c — batch alert counts for canvas nodes
 *
 * Alerts hang off canvas nodes which live inside a radar. The node IDs
 * in the request are canvas-node-ids, which are scoped to a particular
 * radar's canvas_state. The scope check here is light — we just require
 * that the caller has an active tenant context (i.e. is authenticated
 * and has a membership), rather than validating every node_id against
 * the tenant's radars, because doing so would be expensive and the node
 * ids themselves carry no sensitive data beyond a badge count.
 *
 * If stricter scoping becomes necessary (e.g. batch counts leak that a
 * node exists in another tenant), the getAlertCounts helper would need
 * a tenantId parameter + a JOIN through scenario_alerts → radars.
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
  const counts = getAlertCounts(ids);
  return apiSuccess({ counts }, 200, CACHE_HEADERS.short);
}
