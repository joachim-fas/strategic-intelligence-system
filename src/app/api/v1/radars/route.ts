/**
 * GET  /api/v1/radars — List radars for the authenticated user
 * POST /api/v1/radars — Create a new radar
 */

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { parseBody, apiSuccess, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";
import { getDb, getDialectName } from "@/db";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createRadarSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  scope: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  isShared: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET — list radars for the active tenant
// Previously this filtered by owner_id OR isShared. Tenant-scoping
// supersedes that — a member sees all radars in their org regardless of
// who created them. The `isShared` flag is kept on the schema but has no
// effect today; cross-tenant sharing is a later-phase feature.
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const db = getDb();
  const dialect = getDialectName();

  let schema: typeof import("@/db/schema") | typeof import("@/db/schema-sqlite");
  if (dialect === "pg") {
    schema = await import("@/db/schema");
  } else {
    schema = await import("@/db/schema-sqlite");
  }

  const result = await db
    .select()
    .from(schema.radars)
    .where(eq(schema.radars.tenantId, ctx.tenantId));

  return apiSuccess({ radars: result }, 200, CACHE_HEADERS.short);
}

// ---------------------------------------------------------------------------
// POST — create radar in the active tenant
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiSuccess(
      { ok: false, error: { message: "Viewers cannot create radars", code: "INSUFFICIENT_TENANT_ROLE" } },
      403,
    );
  }

  const { data, error } = await parseBody(request, createRadarSchema);
  if (error) return error;

  const db = getDb();
  const dialect = getDialectName();

  const userId = ctx.user.id;

  if (dialect === "pg") {
    const schema = await import("@/db/schema");
    const result = await db
      .insert(schema.radars)
      .values({
        name: data!.name,
        description: data!.description ?? null,
        scope: data!.scope ?? {},
        isShared: data!.isShared ?? false,
        ownerId: userId || null,
        tenantId: ctx.tenantId,
      })
      .returning();

    return apiSuccess({ radar: result[0] }, 201);
  } else {
    const schema = await import("@/db/schema-sqlite");
    const id = crypto.randomUUID();
    db.insert(schema.radars)
      .values({
        id,
        name: data!.name,
        description: data!.description ?? null,
        scope: JSON.stringify(data!.scope ?? {}),
        isShared: data!.isShared ?? false,
        ownerId: userId || null,
        tenantId: ctx.tenantId,
      })
      .run();

    const created = db
      .select()
      .from(schema.radars)
      .where(and(eq(schema.radars.id, id), eq(schema.radars.tenantId, ctx.tenantId)))
      .get();

    return apiSuccess({ radar: created }, 201);
  }
}
