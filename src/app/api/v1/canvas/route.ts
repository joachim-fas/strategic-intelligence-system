/**
 * GET  /api/v1/canvas — list all canvas projects for the active tenant
 * POST /api/v1/canvas — create a new canvas project in the active tenant
 *
 * Canvas projects reuse the existing `radars` table — each row is owned
 * by a tenant (via `tenant_id`) and optionally attributed to a user (via
 * the legacy `owner_id`, kept for "who created this"). The row is only
 * visible to members of the owning tenant.
 *
 * The schema migration (tenant_id column + default-tenant backfill) runs
 * in src/db/sqlite-helpers.ts when the DB handle is first opened.
 */

import { getSqliteHandle } from "@/db";
import { apiSuccess, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

// GET — list canvas projects for the active tenant
//   /api/v1/canvas                 → active only (archived_at IS NULL)
//   /api/v1/canvas?archived=true   → archived only (archived_at IS NOT NULL)
//   /api/v1/canvas?archived=all    → everything
export async function GET(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const url = new URL(req.url);
  const archived = url.searchParams.get("archived"); // null | "true" | "all"

  let archivedClause = "AND archived_at IS NULL";
  if (archived === "true") archivedClause = "AND archived_at IS NOT NULL";
  else if (archived === "all") archivedClause = "";

  const d = getSqliteHandle();
  const rows = d.prepare(`
    SELECT id, name, description, canvas_state, created_at, updated_at, archived_at
    FROM radars
    WHERE tenant_id = ? ${archivedClause}
    ORDER BY
      CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
      COALESCE(archived_at, updated_at) DESC
  `).all(ctx.tenantId) as Array<{
    id: string; name: string; description: string | null;
    canvas_state: string | null; created_at: string; updated_at: string;
    archived_at: string | null;
  }>;

  // Return lightweight list (with node count for session picker UX)
  const canvases = rows.map(r => {
    let nodeCount = 0;
    let queryCount = 0;
    if (r.canvas_state) {
      try {
        const state = JSON.parse(r.canvas_state);
        if (Array.isArray(state?.nodes)) {
          nodeCount = state.nodes.length;
          queryCount = state.nodes.filter((n: any) => n.nodeType === "query").length;
        }
      } catch {}
    }
    // cardCount = everything that isn't a query root. This is what the Canvas
    // toolbar shows ("6 Abfragen · 59 Karten") and what the user thinks of as
    // "cards". Surfacing it from the API keeps Home / SessionBar / Canvas in
    // sync with one source of truth instead of each view re-deriving it.
    const cardCount = Math.max(0, nodeCount - queryCount);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      hasState: !!r.canvas_state,
      nodeCount,
      queryCount,
      cardCount,
      created_at: r.created_at,
      updated_at: r.updated_at,
      archived_at: r.archived_at,
    };
  });

  return apiSuccess({ canvases }, 200, CACHE_HEADERS.short);
}

// POST — create a new canvas project in the active tenant
export async function POST(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  // Viewers are read-only within a tenant.
  if (ctx.role === "viewer") {
    return apiSuccess(
      { ok: false, error: { message: "Viewers cannot create projects", code: "INSUFFICIENT_TENANT_ROLE" } },
      403,
    );
  }

  const body = await req.json().catch(() => ({}));
  const name: string = body.name?.trim() || "Neues Projekt";

  const d = getSqliteHandle();
  const id = crypto.randomUUID();
  d.prepare(`
    INSERT INTO radars (id, tenant_id, owner_id, name, description, scope, is_shared, canvas_state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '{}', 0, NULL, datetime('now'), datetime('now'))
  `).run(id, ctx.tenantId, ctx.user.id || null, name, body.description ?? null);

  const canvas = d.prepare("SELECT id, name, description, created_at, updated_at FROM radars WHERE id = ?").get(id);
  return apiSuccess({ canvas }, 201);
}
