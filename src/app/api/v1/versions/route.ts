/**
 * GET  /api/v1/versions?nodeId=... — list versions for a canvas node
 * POST /api/v1/versions — save a new version (called by canvas after query completes)
 * GET  /api/v1/versions?nodeIds=a,b,c — batch version counts
 */
import { saveQueryVersion, getVersionsForNode, getVersionCounts } from "@/lib/query-versions";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

/**
 * query_versions rows are scoped through radar_id → radars.tenant_id.
 * For writes we verify that the supplied radarId belongs to the active
 * tenant. For reads we trust the node_id lookup (node ids are not
 * enumerable scope boundaries in the current UI), but the request
 * still requires a valid tenant membership so anonymous callers can't
 * probe historical queries.
 */
function assertRadarInTenant(radarId: string, tenantId: string): boolean {
  const d = getSqliteHandle();
  const row = d.prepare("SELECT id FROM radars WHERE id = ? AND tenant_id = ?").get(radarId, tenantId);
  return !!row;
}

export async function GET(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const nodeIds = url.searchParams.get("nodeIds");

  if (nodeIds) {
    const ids = nodeIds.split(",").filter(Boolean).slice(0, 100);
    const counts = getVersionCounts(ids);
    return apiSuccess({ counts }, 200, CACHE_HEADERS.short);
  }

  if (!nodeId) {
    return apiError("nodeId required", 400, "VALIDATION_ERROR");
  }

  const versions = getVersionsForNode(nodeId);
  return apiSuccess({ versions }, 200, CACHE_HEADERS.short);
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return apiError("Viewers cannot save query versions", 403, "INSUFFICIENT_TENANT_ROLE");
    }

    const body = await req.json().catch(() => null as null | Record<string, unknown>);
    if (!body) return apiError("Invalid or empty JSON body", 400, "VALIDATION_ERROR");
    const { canvasNodeId, radarId, queryText, locale, result } = body as {
      canvasNodeId?: string; radarId?: string | null; queryText?: string;
      locale?: string; result?: unknown;
    };
    if (!canvasNodeId || !queryText || !result) {
      return apiError("Missing required fields", 400, "VALIDATION_ERROR");
    }
    // If a radarId is supplied, verify it is within the caller's tenant.
    // radarId may be null for "floating" canvas nodes that are not yet
    // bound to a project — those get the tenant from ctx implicitly.
    if (radarId && !assertRadarInTenant(radarId, ctx.tenantId)) {
      return apiError("Radar not found in tenant", 404, "NOT_FOUND");
    }
    // `result` is `unknown` after the defensive parse; narrow it once
    // before reading fields so downstream stays typed.
    const r = (result ?? {}) as {
      confidence?: number;
      matchedTrends?: unknown[];
      usedSignals?: unknown[];
    };
    const id = saveQueryVersion({
      canvasNodeId,
      radarId: radarId ?? null,
      queryText,
      locale: locale ?? "de",
      result,
      confidence: r.confidence ?? null,
      matchedTrendCount: Array.isArray(r.matchedTrends) ? r.matchedTrends.length : null,
      signalCount: Array.isArray(r.usedSignals) ? r.usedSignals.length : null,
    });
    return apiSuccess({ id }, 201);
  } catch (err) {
    return apiError(String(err), 500);
  }
}
