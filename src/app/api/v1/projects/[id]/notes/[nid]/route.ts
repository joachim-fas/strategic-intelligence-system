import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { requireTenantContext } from "@/lib/api-helpers";

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
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!assertNoteInTenant(id, nid, ctx.tenantId)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const d = getSqliteHandle();
    d.prepare("DELETE FROM project_notes WHERE id = ?").run(nid);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — update note content
export async function PATCH(req: Request, context: Params) {
  try {
    const { id, nid } = await context.params;
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!assertNoteInTenant(id, nid, ctx.tenantId)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => null as null | { content?: string });
    if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const { content } = body;
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    const d = getSqliteHandle();
    d.prepare("UPDATE project_notes SET content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(content.trim(), nid);
    const updated = d.prepare("SELECT * FROM project_notes WHERE id = ?").get(nid);
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ note: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
