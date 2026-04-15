import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

/**
 * Tenant-scope guard for all operations on project_queries:
 * ensures the parent radar is in the active tenant before any read/write.
 * project_queries has no direct tenant_id — scope flows through radar_id.
 */
function assertRadarInTenant(radarId: string, tenantId: string): boolean {
  const d = getSqliteHandle();
  const row = d.prepare("SELECT id FROM radars WHERE id = ? AND tenant_id = ?").get(radarId, tenantId);
  return !!row;
}

// GET — list saved queries for project
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }

  const d = getSqliteHandle();
  const queries = d.prepare(`
    SELECT q.*, (SELECT COUNT(*) FROM project_notes WHERE query_id = q.id) as note_count
    FROM project_queries q WHERE q.radar_id = ? ORDER BY q.created_at DESC
  `).all(id);

  // Parse result_json for each query
  const parsed = (queries as any[]).map((q) => ({
    ...q,
    result: q.result_json ? JSON.parse(q.result_json) : null,
    contextProfile: q.context_profile ? JSON.parse(q.context_profile) : null,
  }));

  return apiSuccess({ queries: parsed }, 200, CACHE_HEADERS.short);
}

// POST — save a query result to project
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot add queries", 403, "INSUFFICIENT_TENANT_ROLE");
  }
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }

  const { query, result, locale, contextProfile } = await req.json();
  if (!query) return apiError("Query required", 400, "VALIDATION_ERROR");

  const d = getSqliteHandle();
  const qid = crypto.randomUUID();
  d.prepare(`
    INSERT INTO project_queries (id, radar_id, query, locale, result_json, context_profile, pinned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(qid, id, query, locale || "de", result ? JSON.stringify(result) : null, contextProfile ? JSON.stringify(contextProfile) : null);

  // Update project timestamp
  d.prepare("UPDATE radars SET updated_at = datetime('now') WHERE id = ?").run(id);

  const saved = d.prepare("SELECT * FROM project_queries WHERE id = ?").get(qid);
  return apiSuccess({ query: saved }, 201);
}

// DELETE — remove a query (via query param ?qid=xxx)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot delete queries", 403, "INSUFFICIENT_TENANT_ROLE");
  }
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }

  const url = new URL(req.url);
  const qid = url.searchParams.get("qid");
  if (!qid) return apiError("qid required", 400, "VALIDATION_ERROR");

  const d = getSqliteHandle();
  d.prepare("DELETE FROM project_queries WHERE id = ? AND radar_id = ?").run(qid, id);
  return new NextResponse(null, { status: 204 });
}

// PATCH — pin/unpin a query (via query param ?qid=xxx)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot modify queries", 403, "INSUFFICIENT_TENANT_ROLE");
  }
  if (!assertRadarInTenant(id, ctx.tenantId)) {
    return apiError("Project not found", 404, "NOT_FOUND");
  }

  const url = new URL(req.url);
  const qid = url.searchParams.get("qid");
  if (!qid) return apiError("qid required", 400, "VALIDATION_ERROR");
  const { pinned } = await req.json();
  const d = getSqliteHandle();
  d.prepare("UPDATE project_queries SET pinned = ? WHERE id = ? AND radar_id = ?").run(pinned ? 1 : 0, qid, id);
  return apiSuccess({ updated: true });
}
