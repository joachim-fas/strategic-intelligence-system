import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { validationError } from "@/lib/api-utils";
import { validateStringLength, validateId } from "@/lib/validation";
import { apiSuccess, apiError } from "@/lib/api-helpers";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  return d;
}

type Params = { params: Promise<{ id: string }> };

// TODO: SEC-14 — Add user_id ownership check when user_id column exists on the radars table.
// PATCH and DELETE handlers should verify the resource belongs to the authenticated user.

// PATCH — rename project
export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;

    // SEC-13: Validate path param
    const idCheck = validateId(id);
    if (!idCheck.valid) return validationError(idCheck.error);

    const body = await req.json();
    const { name, description } = body;

    // SEC-13: Input validation
    const nameCheck = validateStringLength(name, "name", 200, 1);
    if (!nameCheck.valid) return validationError(nameCheck.error);

    if (description !== undefined && description !== null) {
      const descCheck = validateStringLength(description, "description", 2000);
      if (!descCheck.valid) return validationError(descCheck.error);
    }

    // DAT-13: Ensure DB handle is always closed
    const d = db();
    try {
      d.prepare("UPDATE radars SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
        .run(name.trim(), description ?? null, id);
      const updated = d.prepare("SELECT * FROM radars WHERE id = ?").get(id);
      if (!updated) return apiError("Project not found", 404, "NOT_FOUND");
      return apiSuccess({ project: updated });
    } finally {
      d.close();
    }
  } catch (err) {
    console.error("PATCH /api/v1/projects/[id] error:", err);
    return apiError("Failed to update project", 500, "INTERNAL_ERROR");
  }
}

// DELETE — delete project + cascade
export async function DELETE(_req: Request, context: Params) {
  try {
    const { id } = await context.params;
    // DAT-13: Ensure DB handle is always closed
    const d = db();
    try {
      const existing = d.prepare("SELECT id FROM radars WHERE id = ?").get(id);
      if (!existing) {
        return apiError("Project not found", 404, "NOT_FOUND");
      }

      // Cascade manually (foreign_keys pragma handles it if FK constraints exist,
      // but we delete explicitly to be safe)
      d.prepare("DELETE FROM project_notes WHERE radar_id = ?").run(id);
      d.prepare("DELETE FROM project_queries WHERE radar_id = ?").run(id);
      d.prepare("DELETE FROM radars WHERE id = ?").run(id);
      // API-18: DELETE with no body should return 204
      return new NextResponse(null, { status: 204 });
    } finally {
      d.close();
    }
  } catch (err) {
    console.error("DELETE /api/v1/projects/[id] error:", err);
    return apiError("Failed to delete project", 500, "INTERNAL_ERROR");
  }
}
