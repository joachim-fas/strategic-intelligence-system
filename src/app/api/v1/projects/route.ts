import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

// GET — list projects in the active tenant
export async function GET(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const d = getSqliteHandle();
  const projects = d.prepare(`
    SELECT r.id, r.name, r.description, r.scope, r.is_shared,
      r.created_at, r.updated_at,
      (SELECT COUNT(*) FROM project_queries WHERE radar_id = r.id) as query_count,
      (SELECT COUNT(*) FROM project_notes WHERE radar_id = r.id) as note_count
    FROM radars r
    WHERE r.tenant_id = ?
    ORDER BY r.updated_at DESC
  `).all(ctx.tenantId);
  return apiSuccess({ projects }, 200, CACHE_HEADERS.short);
}

// POST — create project in the active tenant
export async function POST(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return apiError("Viewers cannot create projects", 403, "INSUFFICIENT_TENANT_ROLE");
  }

  const body = await req.json().catch(() => ({}));
  const { name, description } = body;

  // Validate title: required, max 200 chars
  if (!name || typeof name !== "string" || !name.trim()) {
    return apiError("Title is required", 400, "VALIDATION_ERROR");
  }
  if (name.trim().length > 200) {
    return apiError("Title must be 200 characters or fewer", 400, "VALIDATION_ERROR");
  }
  // Validate description: optional, max 2000 chars
  if (description !== undefined && description !== null && typeof description === "string" && description.length > 2000) {
    return apiError("Description must be 2000 characters or fewer", 400, "VALIDATION_ERROR");
  }

  const d = getSqliteHandle();
  const id = crypto.randomUUID();
  d.prepare(`
    INSERT INTO radars (id, tenant_id, owner_id, name, description, scope, is_shared, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '{}', 0, datetime('now'), datetime('now'))
  `).run(id, ctx.tenantId, ctx.user.id || null, name.trim(), description || null);

  const project = d.prepare("SELECT * FROM radars WHERE id = ?").get(id);
  return apiSuccess({ project }, 201);
}
