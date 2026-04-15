import { getSqliteHandle } from "@/db";
import { checkRateLimit, tooManyRequests, validationError } from "@/lib/api-utils";
import { validateStringLength, validateEnum } from "@/lib/validation";
import { apiSuccess, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

// SEC-14 resolved: bsc_ratings are now tenant-scoped via tenant_id.
// Note: the unique index bsc_ratings_unique was rebuilt to include
// tenant_id, so two orgs can hold independent up/down votes for the
// same queryHash.

// POST — upsert a rating
export async function POST(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const body = await req.json().catch(() => ({}));
  const { queryHash, perspectiveId, rating } = body;

  // SEC-13: Input validation
  const qhCheck = validateStringLength(queryHash, "queryHash", 256, 1);
  if (!qhCheck.valid) return validationError(qhCheck.error);

  const pidCheck = validateStringLength(perspectiveId, "perspectiveId", 256, 1);
  if (!pidCheck.valid) return validationError(pidCheck.error);

  if (rating !== null) {
    const ratingCheck = validateEnum(rating, "rating", ["up", "down"] as const);
    if (!ratingCheck.valid) return validationError(ratingCheck.error);
  }

  const d = getSqliteHandle();
  if (rating === null) {
    d.prepare("DELETE FROM bsc_ratings WHERE tenant_id = ? AND query_hash = ? AND perspective_id = ?")
      .run(ctx.tenantId, queryHash, perspectiveId);
  } else {
    d.prepare(`
      INSERT INTO bsc_ratings (id, tenant_id, query_hash, perspective_id, rating)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
      ON CONFLICT(tenant_id, query_hash, perspective_id) DO UPDATE SET rating = excluded.rating
    `).run(ctx.tenantId, queryHash, perspectiveId, rating);
  }
  return apiSuccess({ ok: true });
}

// GET — load ratings for a query
export async function GET(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const { searchParams } = new URL(req.url);
  const queryHash = searchParams.get("queryHash");
  if (!queryHash) return apiSuccess({ ratings: {} });

  const d = getSqliteHandle();
  const rows = d.prepare("SELECT perspective_id, rating FROM bsc_ratings WHERE tenant_id = ? AND query_hash = ?")
    .all(ctx.tenantId, queryHash) as { perspective_id: string; rating: string }[];

  const ratings: Record<string, string> = {};
  for (const row of rows) ratings[row.perspective_id] = row.rating;
  return apiSuccess({ ratings }, 200, CACHE_HEADERS.short);
}
