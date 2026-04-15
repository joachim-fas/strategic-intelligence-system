import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { validationError } from "@/lib/api-utils";
import { validateStringLength, validateId } from "@/lib/validation";
import { apiSuccess, apiError, requireTenantContext } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// SEC-14 resolved: PATCH/DELETE now require tenant membership and the
// radar row must belong to the active tenant.

// PATCH — rename project
export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;

    // SEC-13: Validate path param
    const idCheck = validateId(id);
    if (!idCheck.valid) return validationError(idCheck.error);

    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return apiError("Viewers cannot rename projects", 403, "INSUFFICIENT_TENANT_ROLE");
    }

    const body = await req.json();
    const { name, description } = body;

    // SEC-13: Input validation
    const nameCheck = validateStringLength(name, "name", 200, 1);
    if (!nameCheck.valid) return validationError(nameCheck.error);

    if (description !== undefined && description !== null) {
      const descCheck = validateStringLength(description, "description", 2000);
      if (!descCheck.valid) return validationError(descCheck.error);
    }

    const d = getSqliteHandle();
    const res = d.prepare(
      "UPDATE radars SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    ).run(name.trim(), description ?? null, id, ctx.tenantId);
    if (res.changes === 0) return apiError("Project not found", 404, "NOT_FOUND");
    const updated = d.prepare("SELECT * FROM radars WHERE id = ? AND tenant_id = ?").get(id, ctx.tenantId);
    return apiSuccess({ project: updated });
  } catch (err) {
    console.error("PATCH /api/v1/projects/[id] error:", err);
    return apiError("Failed to update project", 500, "INTERNAL_ERROR");
  }
}

// DELETE — delete project + cascade
export async function DELETE(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    // Only admin/owner can delete — members and viewers cannot.
    if (ctx.role === "member" || ctx.role === "viewer") {
      return apiError("Only tenant admins/owners can delete projects", 403, "INSUFFICIENT_TENANT_ROLE");
    }

    const d = getSqliteHandle();
    const existing = d.prepare("SELECT id FROM radars WHERE id = ? AND tenant_id = ?").get(id, ctx.tenantId);
    if (!existing) {
      return apiError("Project not found", 404, "NOT_FOUND");
    }

    // Cascade manually (foreign_keys pragma handles it if FK constraints exist,
    // but we delete explicitly to be safe). All join tables reference radar_id
    // so no extra tenant_id filter is needed once we verified the radar is
    // in-tenant above.
    d.prepare("DELETE FROM project_notes WHERE radar_id = ?").run(id);
    d.prepare("DELETE FROM project_queries WHERE radar_id = ?").run(id);
    d.prepare("DELETE FROM radars WHERE id = ? AND tenant_id = ?").run(id, ctx.tenantId);
    // API-18: DELETE with no body should return 204
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/v1/projects/[id] error:", err);
    return apiError("Failed to delete project", 500, "INTERNAL_ERROR");
  }
}
