import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, requireTenantContext } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; nid: string }> };

/** Scope-Join — project_notes has no direct tenant_id. */
function assertNoteInTenant(radarId: string, nid: string, tenantId: string): boolean {
  const d = getSqliteHandle();
  const row = d.prepare(
    `SELECT n.id FROM project_notes n
     JOIN radars r ON r.id = n.radar_id
     WHERE n.id = ? AND n.radar_id = ? AND r.tenant_id = ?`,
  ).get(nid, radarId, tenantId);
  return !!row;
}

// DELETE — remove a specific note
export async function DELETE(req: Request, context: Params) {
  try {
    const { id, nid } = await context.params;
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return apiError("Viewers cannot delete notes", 403, "INSUFFICIENT_TENANT_ROLE");
    }
    if (!assertNoteInTenant(id, nid, ctx.tenantId)) {
      return apiError("Note not found", 404, "NOT_FOUND");
    }
    const d = getSqliteHandle();
    d.prepare("DELETE FROM project_notes WHERE id = ?").run(nid);
    return apiSuccess({ deleted: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500, "INTERNAL_ERROR");
  }
}

// PATCH — update note content
export async function PATCH(req: Request, context: Params) {
  try {
    const { id, nid } = await context.params;
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return apiError("Viewers cannot modify notes", 403, "INSUFFICIENT_TENANT_ROLE");
    }
    if (!assertNoteInTenant(id, nid, ctx.tenantId)) {
      return apiError("Note not found", 404, "NOT_FOUND");
    }
    const body = await req.json().catch(() => null as null | { content?: string });
    if (!body) return apiError("Invalid or empty JSON body", 400, "VALIDATION_ERROR");
    const { content } = body;
    if (!content?.trim()) return apiError("Content required", 400, "VALIDATION_ERROR");
    const d = getSqliteHandle();
    d.prepare("UPDATE project_notes SET content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(content.trim(), nid);
    const updated = d.prepare("SELECT * FROM project_notes WHERE id = ?").get(nid);
    if (!updated) return apiError("Note not found", 404, "NOT_FOUND");
    return apiSuccess({ note: updated });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500, "INTERNAL_ERROR");
  }
}
