import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

/** Project notes are scoped through radar_id → radars.tenant_id. */
function assertRadarInTenant(radarId: string, tenantId: string): boolean {
  const d = getSqliteHandle();
  const row = d.prepare("SELECT id FROM radars WHERE id = ? AND tenant_id = ?").get(radarId, tenantId);
  return !!row;
}

// GET — list notes for project
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }
  const d = getSqliteHandle();
  const notes = d.prepare("SELECT * FROM project_notes WHERE radar_id = ? ORDER BY created_at DESC").all(id);
  return apiSuccess({ notes }, 200, CACHE_HEADERS.short);
}

// POST — add note
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot add notes", 403, "INSUFFICIENT_TENANT_ROLE");
  }
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }

  const { content, queryId } = await req.json();
  if (!content) return apiError("Content required", 400, "VALIDATION_ERROR");

  const d = getSqliteHandle();
  const nid = crypto.randomUUID();
  d.prepare(`
    INSERT INTO project_notes (id, radar_id, query_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(nid, id, queryId || null, content);

  d.prepare("UPDATE radars SET updated_at = datetime('now') WHERE id = ?").run(id);

  const saved = d.prepare("SELECT * FROM project_notes WHERE id = ?").get(nid);
  return apiSuccess({ note: saved }, 201);
}

// DELETE — remove note (via query param ?nid=xxx)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot delete notes", 403, "INSUFFICIENT_TENANT_ROLE");
  }
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }
  const url = new URL(req.url);
  const nid = url.searchParams.get("nid");
  if (!nid) return apiError("nid required", 400, "VALIDATION_ERROR");

  const d = getSqliteHandle();
  d.prepare("DELETE FROM project_notes WHERE id = ? AND radar_id = ?").run(nid, id);
  return new NextResponse(null, { status: 204 });
}
