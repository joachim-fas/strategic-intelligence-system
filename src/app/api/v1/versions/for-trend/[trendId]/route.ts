/**
 * GET /api/v1/versions/for-trend/[trendId]
 *
 * Backlog-Task „Szenarien-History" (2026-04-22): der TrendDetailPanel (L3)
 * zeigt eine kompakte Liste der letzten Analysen, die den angefragten
 * Trend berührt haben. Das Endpoint liefert dafür eine tenant-gescopte,
 * deduplizierte Query-Versions-Liste (max 10) mit Metadaten, aber ohne
 * den schweren `result_json`-Body — nur Query-Text, Konfidenz, Alter.
 *
 * Tenant-Guard: requireTenantContext + getVersionsForTrend honoriert
 * radars.tenant_id. Orphan-Nodes ohne radar_id bleiben sichtbar (wie
 * im bestehenden /versions-Endpoint).
 */
import { getVersionsForTrend } from "@/lib/query-versions";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trendId: string }> },
) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const { trendId } = await params;
  if (!trendId) {
    return apiError("trendId required", 400, "VALIDATION_ERROR");
  }
  // getVersionsForTrend whitelist-prüft das Format (alphanum + - _); hier
  // zusätzlich ein dünner Längen-Guard gegen absurde IDs, bevor das
  // LIKE-Pattern gegen die DB feuert.
  if (trendId.length > 200) {
    return apiError("trendId too long", 400, "VALIDATION_ERROR");
  }

  const limit = Math.max(1, Math.min(20, Number(new URL(req.url).searchParams.get("limit")) || 10));
  const versions = getVersionsForTrend(trendId, ctx.tenantId, limit);
  return apiSuccess({ versions }, 200, CACHE_HEADERS.short);
}
