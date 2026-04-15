/**
 * GET    /api/v1/admin/tenants/[id] — single tenant with full stats
 * PATCH  /api/v1/admin/tenants/[id] — rename / change slug / update settings
 * DELETE /api/v1/admin/tenants/[id] — delete permanently (only if archived)
 *
 * Archiving (soft-delete) is a separate action at
 * POST /api/v1/admin/tenants/[id]/archive — see that file.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, parseBody, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().regex(SLUG_RE).optional(),
  plan: z.string().max(50).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const d = getSqliteHandle();
  const tenant = d.prepare(`
    SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at
    FROM tenants WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;
  if (!tenant) return apiError("Tenant not found", 404, "NOT_FOUND");

  // Aggregat-Stats fuer die Detail-Seite.
  const memberCount = d.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id = ?")
    .get(id) as { n: number };
  const radarCount = d.prepare("SELECT COUNT(*) AS n FROM radars WHERE tenant_id = ?")
    .get(id) as { n: number };
  const scenarioCount = d.prepare("SELECT COUNT(*) AS n FROM scenarios WHERE tenant_id = ?")
    .get(id) as { n: number };
  const ratingCount = d.prepare("SELECT COUNT(*) AS n FROM bsc_ratings WHERE tenant_id = ?")
    .get(id) as { n: number };

  return apiSuccess({
    tenant,
    stats: {
      memberCount: memberCount.n,
      radarCount: radarCount.n,
      scenarioCount: scenarioCount.n,
      ratingCount: ratingCount.n,
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, updateTenantSchema);
  if (error) return error;

  const d = getSqliteHandle();
  const existing = d.prepare("SELECT id, slug, name FROM tenants WHERE id = ?")
    .get(id) as { id: string; slug: string; name: string } | undefined;
  if (!existing) return apiError("Tenant not found", 404, "NOT_FOUND");

  // Slug-Aenderung: auf Kollision pruefen.
  if (data!.slug && data!.slug !== existing.slug) {
    const conflict = d.prepare("SELECT id FROM tenants WHERE slug = ? AND id != ?")
      .get(data!.slug, id);
    if (conflict) return apiError("Slug already in use", 409, "SLUG_CONFLICT");
  }

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];
  if (data!.name !== undefined) { sets.push("name = ?"); values.push(data!.name); }
  if (data!.slug !== undefined) { sets.push("slug = ?"); values.push(data!.slug); }
  if (data!.plan !== undefined) { sets.push("plan = ?"); values.push(data!.plan); }
  if (data!.settings !== undefined) { sets.push("settings = ?"); values.push(JSON.stringify(data!.settings)); }

  values.push(id);
  d.prepare(`UPDATE tenants SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'tenant.updated', ?)
  `).run(crypto.randomUUID(), id, session!.user.id ?? null, JSON.stringify(data));

  const updated = d.prepare(`
    SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at
    FROM tenants WHERE id = ?
  `).get(id);
  return apiSuccess({ tenant: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const d = getSqliteHandle();
  const existing = d.prepare("SELECT id, archived_at FROM tenants WHERE id = ?")
    .get(id) as { id: string; archived_at: string | null } | undefined;
  if (!existing) return apiError("Tenant not found", 404, "NOT_FOUND");

  // Hart-loeschen nur, wenn zuvor archiviert. Zweistufiger Prozess
  // verhindert versehentliches Wegreissen eines produktiven Mandanten.
  if (!existing.archived_at) {
    return apiError(
      "Tenant must be archived before it can be deleted permanently",
      409,
      "MUST_ARCHIVE_FIRST",
    );
  }

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'tenant.deleted', '{}')
  `).run(crypto.randomUUID(), id, session!.user.id ?? null);

  // ON DELETE CASCADE in der Schema-Definition raeumt memberships,
  // invites, audit_log, und alle radars/scenarios/bsc_ratings mit
  // tenant_id auf. Die Kinder-Kinder (project_queries/notes ueber
  // radar_id) cascaden ueber radars.
  d.prepare("DELETE FROM tenants WHERE id = ?").run(id);

  return new NextResponse(null, { status: 204 });
}
