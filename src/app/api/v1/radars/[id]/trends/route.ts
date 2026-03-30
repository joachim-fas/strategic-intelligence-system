/**
 * GET /api/v1/radars/[id]/trends — List all trends for a specific radar
 *
 * Returns radar_trends joined with the trends table so each entry
 * includes the trend name, category, tags etc.
 */

import { NextResponse } from "next/server";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";
import { getDb, getDialectName } from "@/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id: radarId } = await context.params;
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const db = getDb();
  const dialect = getDialectName();
  const userId = session!.user!.id!;

  if (dialect === "pg") {
    const schema = await import("@/db/schema");

    // Verify the user can see this radar
    const radar = await db
      .select()
      .from(schema.radars)
      .where(
        and(
          eq(schema.radars.id, radarId),
          or(
            eq(schema.radars.ownerId, userId),
            eq(schema.radars.isShared, true)
          )
        )
      )
      .limit(1);

    if (radar.length === 0) {
      return NextResponse.json({ error: "Radar not found" }, { status: 404 });
    }

    // Get radar trends with full trend details
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

    return NextResponse.json({ data });
  } else {
    const schema = await import("@/db/schema-sqlite");

    const radar = db
      .select()
      .from(schema.radars)
      .where(
        and(
          eq(schema.radars.id, radarId),
          or(
            eq(schema.radars.ownerId, userId),
            eq(schema.radars.isShared, true)
          )
        )
      )
      .get();

    if (!radar) {
      return NextResponse.json({ error: "Radar not found" }, { status: 404 });
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

    return NextResponse.json({ data });
  }
}
