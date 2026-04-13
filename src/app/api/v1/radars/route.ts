/**
 * GET  /api/v1/radars — List radars for the authenticated user
 * POST /api/v1/radars — Create a new radar
 */

import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, parseBody, apiSuccess, CACHE_HEADERS } from "@/lib/api-helpers";
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
// GET — list radars
// ---------------------------------------------------------------------------
export async function GET() {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const db = getDb();
  const dialect = getDialectName();

  let schema: typeof import("@/db/schema") | typeof import("@/db/schema-sqlite");
  if (dialect === "pg") {
    schema = await import("@/db/schema");
  } else {
    schema = await import("@/db/schema-sqlite");
  }

  const userId = session!.user!.id!;

  // Return radars the user owns OR that are shared
  const result = await db
    .select()
    .from(schema.radars)
    .where(
      or(
        eq(schema.radars.ownerId, userId),
        eq(schema.radars.isShared, true)
      )
    );

  return apiSuccess({ radars: result }, 200, CACHE_HEADERS.short);
}

// ---------------------------------------------------------------------------
// POST — create radar
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, createRadarSchema);
  if (error) return error;

  const db = getDb();
  const dialect = getDialectName();

  const userId = session!.user!.id!;

  if (dialect === "pg") {
    const schema = await import("@/db/schema");
    const result = await db
      .insert(schema.radars)
      .values({
        name: data!.name,
        description: data!.description ?? null,
        scope: data!.scope ?? {},
        isShared: data!.isShared ?? false,
        ownerId: userId,
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
        ownerId: userId,
      })
      .run();

    const created = db
      .select()
      .from(schema.radars)
      .where(eq(schema.radars.id, id))
      .get();

    return apiSuccess({ radar: created }, 201);
  }
}
