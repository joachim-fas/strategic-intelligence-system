/**
 * GET /api/v1/alerts?nodeIds=a,b,c — batch alert counts for canvas nodes
 */
import { getAlertCounts } from "@/lib/scenario-alerts";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nodeIds = url.searchParams.get("nodeIds");
  if (!nodeIds) {
    return apiError("nodeIds required", 400, "VALIDATION_ERROR");
  }
  const ids = nodeIds.split(",").filter(Boolean).slice(0, 100);
  const counts = getAlertCounts(ids);
  return apiSuccess({ counts }, 200, CACHE_HEADERS.short);
}
