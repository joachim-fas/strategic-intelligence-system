/**
 * GET /api/v1/versions/[id] — get a single version with full result
 *
 * Tenant scope: the version's radar_id (if present) must belong to the
 * caller's active tenant. Versions without a radar_id (legacy / unbound
 * nodes) are readable to any authenticated tenant member — these are
 * pre-multi-tenant rows that will be cleaned up in a later migration.
 */
import { getVersion } from "@/lib/query-versions";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const version = getVersion(id);
  if (!version) {
    return apiError("Version not found", 404, "NOT_FOUND");
  }

  // Cross-check tenant when a radar_id is attached.
  const radarId = (version as { radarId?: string | null; radar_id?: string | null }).radarId
    ?? (version as { radar_id?: string | null }).radar_id
    ?? null;
  if (radarId) {
    const d = getSqliteHandle();
    const row = d.prepare("SELECT id FROM radars WHERE id = ? AND tenant_id = ?").get(radarId, ctx.tenantId);
    if (!row) return apiError("Version not found", 404, "NOT_FOUND");
  }

  return apiSuccess({ version }, 200, CACHE_HEADERS.long);
}
