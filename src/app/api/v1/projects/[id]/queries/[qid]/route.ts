import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { requireTenantContext } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; qid: string }> };

/**
 * Tenant-scope guard: the parent radar must belong to the caller's active
 * tenant. Because project_queries has no direct tenant_id, we verify the
 * scope through the three-way join radar_id → radars.tenant_id.
 */
function assertQueryInTenant(radarId: string, qid: string, tenantId: string): boolean {
  const d = getSqliteHandle();
  const row = d.prepare(
    `SELECT q.id FROM project_queries q
     JOIN radars r ON r.id = q.radar_id
     WHERE q.id = ? AND q.radar_id = ? AND r.tenant_id = ?`,
  ).get(qid, radarId, tenantId);
  return !!row;
}

// PATCH — toggle pin or update fields
export async function PATCH(req: Request, context: Params) {
  try {
    const { id, qid } = await context.params;
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return NextResponse.json({ ok: false, error: { message: "Viewers cannot modify queries", code: "INSUFFICIENT_TENANT_ROLE" } }, { status: 403 });
    }
    if (!assertQueryInTenant(id, qid, ctx.tenantId)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null as null | { pinned?: boolean });
    if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const d = getSqliteHandle();
    if (typeof body.pinned === "boolean") {
      d.prepare("UPDATE project_queries SET pinned = ? WHERE id = ?").run(body.pinned ? 1 : 0, qid);
    }
    const updated = d.prepare("SELECT * FROM project_queries WHERE id = ?").get(qid);
    return NextResponse.json({ query: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a specific query
export async function DELETE(req: Request, context: Params) {
  try {
    const { id, qid } = await context.params;
    const ctx = await requireTenantContext(req);
    if (ctx.errorResponse) return ctx.errorResponse;
    if (ctx.role === "viewer") {
      return NextResponse.json({ ok: false, error: { message: "Viewers cannot delete queries", code: "INSUFFICIENT_TENANT_ROLE" } }, { status: 403 });
    }
    if (!assertQueryInTenant(id, qid, ctx.tenantId)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const d = getSqliteHandle();
    // Also delete associated notes
    d.prepare("DELETE FROM project_notes WHERE query_id = ?").run(qid);
    d.prepare("DELETE FROM project_queries WHERE id = ?").run(qid);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
