/**
 * GET /api/v1/radars/[id]/trends — List all trends for a specific radar
 *
 * Returns radar_trends joined with the trends table so each entry
 * includes the trend name, category, tags etc.
 */

import { eq, and } from "drizzle-orm";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";
import { getDb, getDialectName } from "@/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  const { id: radarId } = await context.params;
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const db = getDb();
  const dialect = getDialectName();

  if (dialect === "pg") {
    const schema = await import("@/db/schema");

    // Tenant-scoped radar check (replaces the legacy owner/shared branch).
    const radar = await db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, radarId), eq(schema.radars.tenantId, ctx.tenantId)))
      .limit(1);

    if (radar.length === 0) {
      return apiError("Radar not found", 404, "NOT_FOUND");
    }

    const result = await db
      .select({
        radarTrend: schema.radarTrends,
        trend: schema.trends,
      })
      .from(schema.radarTrends)
      .innerJoin(schema.trends, eq(schema.radarTrends.trendId, schema.trends.id))
      .where(eq(schema.radarTrends.radarId, radarId));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (result as any[]).map((row) => ({
      ...row.radarTrend,
      trend: row.trend,
    }));

    return apiSuccess({ radarTrends: data }, 200, CACHE_HEADERS.medium);
  } else {
    const schema = await import("@/db/schema-sqlite");

    const radar = db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, radarId), eq(schema.radars.tenantId, ctx.tenantId)))
      .get();

    if (!radar) {
      return apiError("Radar not found", 404, "NOT_FOUND");
    }

    const result = db
      .select({
        radarTrend: schema.radarTrends,
        trend: schema.trends,
      })
      .from(schema.radarTrends)
      .innerJoin(schema.trends, eq(schema.radarTrends.trendId, schema.trends.id))
      .where(eq(schema.radarTrends.radarId, radarId))
      .all();

    const data = result.map((row: { radarTrend: Record<string, unknown>; trend: Record<string, unknown> }) => ({
      ...row.radarTrend,
      trend: row.trend,
    }));

    return apiSuccess({ radarTrends: data }, 200, CACHE_HEADERS.medium);
  }
}
