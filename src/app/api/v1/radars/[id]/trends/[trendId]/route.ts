/**
 * PATCH /api/v1/radars/[id]/trends/[trendId]
 *
 * Override a trend's ring, score, or other properties within a specific radar.
 * Sets userOverride = true so the UI knows this was manually adjusted.
 */

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, parseBody } from "@/lib/api-helpers";
import { getDb, getDialectName } from "@/db";

const updateRadarTrendSchema = z.object({
  ring: z.enum(["adopt", "trial", "assess", "hold"]).optional(),
  relevance: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  impact: z.number().min(0).max(1).optional(),
  timeHorizon: z.enum(["short", "mid", "long"]).optional(),
  quadrant: z.string().optional(),
  notes: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string; trendId: string }> };

export async function PATCH(request: Request, context: Params) {
  const { id: radarId, trendId } = await context.params;
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, updateRadarTrendSchema);
  if (error) return error;

  const db = getDb();
  const dialect = getDialectName();
  const userId = session!.user!.id!;

  if (dialect === "pg") {
    const schema = await import("@/db/schema");

    // Verify radar ownership
    const radar = await db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, radarId), eq(schema.radars.ownerId, userId)))
      .limit(1);

    if (radar.length === 0) {
      return NextResponse.json({ error: "Radar not found or not owned by you" }, { status: 404 });
    }

    // Find the radar-trend entry
    const existing = await db
      .select()
      .from(schema.radarTrends)
      .where(
        and(
          eq(schema.radarTrends.radarId, radarId),
          eq(schema.radarTrends.trendId, trendId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Trend not found in this radar" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      userOverride: true,
      updatedAt: new Date(),
    };
    if (data!.ring !== undefined) updateData.ring = data!.ring;
    if (data!.relevance !== undefined) updateData.relevance = data!.relevance;
    if (data!.confidence !== undefined) updateData.confidence = data!.confidence;
    if (data!.impact !== undefined) updateData.impact = data!.impact;
    if (data!.timeHorizon !== undefined) updateData.timeHorizon = data!.timeHorizon;
    if (data!.quadrant !== undefined) updateData.quadrant = data!.quadrant;
    if (data!.notes !== undefined) updateData.notes = data!.notes;
    if (data!.pinned !== undefined) updateData.pinned = data!.pinned;

    const result = await db
      .update(schema.radarTrends)
      .set(updateData)
      .where(
        and(
          eq(schema.radarTrends.radarId, radarId),
          eq(schema.radarTrends.trendId, trendId)
        )
      )
      .returning();

    return NextResponse.json({ data: result[0] });
  } else {
    const schema = await import("@/db/schema-sqlite");

    const radar = db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, radarId), eq(schema.radars.ownerId, userId)))
      .get();

    if (!radar) {
      return NextResponse.json({ error: "Radar not found or not owned by you" }, { status: 404 });
    }

    const existing = db
      .select()
      .from(schema.radarTrends)
      .where(
        and(
          eq(schema.radarTrends.radarId, radarId),
          eq(schema.radarTrends.trendId, trendId)
        )
      )
      .get();

    if (!existing) {
      return NextResponse.json(
        { error: "Trend not found in this radar" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };
    if (data!.ring !== undefined) updateData.ring = data!.ring;
    if (data!.relevance !== undefined) updateData.relevance = data!.relevance;
    if (data!.confidence !== undefined) updateData.confidence = data!.confidence;
    if (data!.impact !== undefined) updateData.impact = data!.impact;
    if (data!.timeHorizon !== undefined) updateData.timeHorizon = data!.timeHorizon;
    if (data!.quadrant !== undefined) updateData.quadrant = data!.quadrant;
    if (data!.notes !== undefined) updateData.notes = data!.notes;
    if (data!.pinned !== undefined) updateData.pinned = data!.pinned;

    db.update(schema.radarTrends)
      .set(updateData)
      .where(
        and(
          eq(schema.radarTrends.radarId, radarId),
          eq(schema.radarTrends.trendId, trendId)
        )
      )
      .run();

    const updated = db
      .select()
      .from(schema.radarTrends)
      .where(
        and(
          eq(schema.radarTrends.radarId, radarId),
          eq(schema.radarTrends.trendId, trendId)
        )
      )
      .get();

    return NextResponse.json({ data: updated });
  }
}
