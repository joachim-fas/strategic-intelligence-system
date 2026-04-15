/**
 * GET    /api/v1/radars/[id] — Get a single radar
 * PATCH  /api/v1/radars/[id] — Update a radar
 * DELETE /api/v1/radars/[id] — Delete a radar
 */

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { parseBody, apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";
import { getDb, getDialectName } from "@/db";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const updateRadarSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  scope: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  isShared: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

// SEC-14 resolved: access is gated by tenant membership. The legacy
// owner_id / isShared branching is removed — inside a tenant every member
// sees the radar; cross-tenant visibility is (for now) only possible for
// system-admins via a future /admin/* view.

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: Request, context: Params) {
  const { id } = await context.params;
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const db = getDb();
  const dialect = getDialectName();

  let radar;
  if (dialect === "pg") {
    const schema = await import("@/db/schema");
    const rows = await db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .limit(1);
    radar = rows[0];
  } else {
    const schema = await import("@/db/schema-sqlite");
    radar = db.select().from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .get();
  }

  if (!radar) return apiError("Radar not found", 404, "NOT_FOUND");
  return apiSuccess({ radar }, 200, CACHE_HEADERS.short);
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
export async function PATCH(request: Request, context: Params) {
  const { id } = await context.params;
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot modify radars", 403, "INSUFFICIENT_TENANT_ROLE");
  }

  const { data, error } = await parseBody(request, updateRadarSchema);
  if (error) return error;

  const db = getDb();
  const dialect = getDialectName();

  if (dialect === "pg") {
    const schema = await import("@/db/schema");

    const existing = await db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return apiError("Radar not found", 404, "NOT_FOUND");
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data!.name !== undefined) updateData.name = data!.name;
    if (data!.description !== undefined) updateData.description = data!.description;
    if (data!.scope !== undefined) updateData.scope = data!.scope;
    if (data!.isShared !== undefined) updateData.isShared = data!.isShared;

    const result = await db
      .update(schema.radars)
      .set(updateData)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .returning();

    return apiSuccess({ radar: result[0] });
  } else {
    const schema = await import("@/db/schema-sqlite");

    const existing = db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .get();

    if (!existing) {
      return apiError("Radar not found", 404, "NOT_FOUND");
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data!.name !== undefined) updateData.name = data!.name;
    if (data!.description !== undefined) updateData.description = data!.description;
    if (data!.scope !== undefined) updateData.scope = JSON.stringify(data!.scope);
    if (data!.isShared !== undefined) updateData.isShared = data!.isShared;

    db.update(schema.radars)
      .set(updateData)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .run();

    const updated = db.select().from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .get();
    return apiSuccess({ radar: updated });
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export async function DELETE(request: Request, context: Params) {
  const { id } = await context.params;
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;
  // Only admin/owner can delete.
  if (ctx.role === "member" || ctx.role === "viewer") {
    return apiError("Only tenant admins/owners can delete radars", 403, "INSUFFICIENT_TENANT_ROLE");
  }

  const db = getDb();
  const dialect = getDialectName();

  if (dialect === "pg") {
    const schema = await import("@/db/schema");
    const existing = await db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return apiError("Radar not found", 404, "NOT_FOUND");
    }

    await db.delete(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)));
  } else {
    const schema = await import("@/db/schema-sqlite");
    const existing = db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .get();

    if (!existing) {
      return apiError("Radar not found", 404, "NOT_FOUND");
    }

    db.delete(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .run();
  }

  return new NextResponse(null, { status: 204 });
}
