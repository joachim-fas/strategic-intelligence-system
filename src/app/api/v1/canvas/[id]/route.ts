/**
 * GET    /api/v1/canvas/[id] — load canvas state
 * POST   /api/v1/canvas/[id] — save canvas state (sendBeacon compatibility)
 * PATCH  /api/v1/canvas/[id] — save canvas state and/or rename
 * DELETE /api/v1/canvas/[id] — delete canvas project
 */

import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// SEC-14 resolved: every handler now checks that the canvas belongs to the
// active tenant and that the requesting user has at least viewer access.
// Write handlers additionally reject the "viewer" role.

/** Load a canvas row and enforce tenant-scope in a single query. */
function loadScopedCanvas(id: string, tenantId: string) {
  const d = getSqliteHandle();
  return d.prepare(
    `SELECT id, name, description, tenant_id, canvas_state, created_at, updated_at, archived_at
     FROM radars WHERE id = ? AND tenant_id = ?`,
  ).get(id, tenantId) as
    | { id: string; name: string; description: string | null; tenant_id: string; canvas_state: string | null; created_at: string; updated_at: string; archived_at: string | null }
    | undefined;
}

// GET — load full canvas state
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const row = loadScopedCanvas(id, ctx.tenantId);
  if (!row) return apiError("Canvas not found", 404, "NOT_FOUND");
  // Strip tenant_id from the response — the client doesn't need it and
  // it keeps the payload shape compatible with the pre-tenant API.
  const { tenant_id: _t, ...canvas } = row;
  return apiSuccess({ canvas }, 200, CACHE_HEADERS.short);
}

/** Shared update logic for PATCH and POST (sendBeacon). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCanvasUpdate(d: any, id: string, tenantId: string, body: Record<string, unknown>) {
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if ("canvasState" in body) {
    sets.push("canvas_state = ?");
    values.push(body.canvasState === null ? null : JSON.stringify(body.canvasState));
  }
  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name);
  }
  if (typeof body.archived === "boolean") {
    if (body.archived) {
      sets.push("archived_at = datetime('now')");
    } else {
      sets.push("archived_at = NULL");
    }
  }

  if (sets.length > 0) {
    values.push(id, tenantId);
    // The tenant_id-guarded WHERE clause is critical: a PATCH with an id
    // from another tenant must not silently succeed.
    d.prepare(`UPDATE radars SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).run(...values);
  }
}

// POST — save canvas state (sendBeacon compatibility for tab-close saves)
//   Accepts the same body as PATCH.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot modify canvases", 403, "INSUFFICIENT_TENANT_ROLE");
  }

  const body = await req.json().catch(() => ({}));
  const d = getSqliteHandle();

  try {
    const existing = loadScopedCanvas(id, ctx.tenantId);
    if (!existing) {
      return apiError("Canvas not found", 404, "NOT_FOUND");
    }

    applyCanvasUpdate(d, id, ctx.tenantId, body);

    const updated = d.prepare(
      "SELECT id, name, description, canvas_state, created_at, updated_at, archived_at FROM radars WHERE id = ? AND tenant_id = ?",
    ).get(id, ctx.tenantId);
    return apiSuccess({ canvas: updated });
  } catch (err) {
    console.error("POST /api/v1/canvas/[id] error:", err);
    return apiError("Failed to save canvas", 500, "INTERNAL_ERROR");
  }
}

// PATCH — save canvas state, rename, or archive/restore
//   Body can contain any subset of:
//   - canvasState: serialized canvas JSON (null to clear)
//   - name: string
//   - archived: boolean (true → archive now, false → restore from archive)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot modify canvases", 403, "INSUFFICIENT_TENANT_ROLE");
  }

  const body = await req.json().catch(() => ({}));
  const d = getSqliteHandle();

  try {
    const existing = loadScopedCanvas(id, ctx.tenantId);
    if (!existing) {
      return apiError("Canvas not found", 404, "NOT_FOUND");
    }

    applyCanvasUpdate(d, id, ctx.tenantId, body);

    const updated = d.prepare(
      "SELECT id, name, description, canvas_state, created_at, updated_at, archived_at FROM radars WHERE id = ? AND tenant_id = ?",
    ).get(id, ctx.tenantId);
    return apiSuccess({ canvas: updated });
  } catch (err) {
    console.error("PATCH /api/v1/canvas/[id] error:", err);
    return apiError("Failed to update canvas", 500, "INTERNAL_ERROR");
  }
}

// DELETE — delete canvas project (cascades to project_queries and project_notes)
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  // Only admin/owner can delete — members and viewers cannot.
  if (ctx.role === "member" || ctx.role === "viewer") {
    return apiError("Only tenant admins/owners can delete", 403, "INSUFFICIENT_TENANT_ROLE");
  }

  const d = getSqliteHandle();

  try {
    const existing = loadScopedCanvas(id, ctx.tenantId);
    if (!existing) {
      return apiError("Canvas not found", 404, "NOT_FOUND");
    }

    d.prepare("DELETE FROM radars WHERE id = ? AND tenant_id = ?").run(id, ctx.tenantId);
    // API-18: DELETE with no body should return 204
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/v1/canvas/[id] error:", err);
    return apiError("Failed to delete canvas", 500, "INTERNAL_ERROR");
  }
}
