/**
 * GET  /api/v1/admin/tenants — list all tenants (system-admin only)
 * POST /api/v1/admin/tenants — create a new tenant
 *
 * Routes under /api/v1/admin/* are guarded by requireSystemAdmin() —
 * only users.role === "admin" can read/write. Tenant-scoped routes
 * under /api/v1/canvas, /projects, etc. stay member-level.
 */

import { z } from "zod";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, parseBody, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// Slug: lowercase ASCII letters/digits/hyphens, 3–64 chars. Keeps the
// URL-safe profile and prevents Unicode collisions down the road.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().regex(SLUG_RE, "slug must be 3–64 lowercase alphanumerics + hyphens"),
  plan: z.string().max(50).optional(),
  ownerEmail: z.string().email().optional(), // optional: make this user owner
});

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  radar_count: number;
}

export async function GET() {
  const { errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const d = getSqliteHandle();
  const rows = d.prepare(`
    SELECT t.id, t.name, t.slug, t.plan, t.archived_at, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM tenant_memberships m WHERE m.tenant_id = t.id) AS member_count,
      (SELECT COUNT(*) FROM radars r WHERE r.tenant_id = t.id) AS radar_count
    FROM tenants t
    ORDER BY
      CASE WHEN t.archived_at IS NULL THEN 0 ELSE 1 END,
      t.created_at DESC
  `).all() as TenantRow[];

  return apiSuccess({ tenants: rows }, 200, CACHE_HEADERS.short);
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, createTenantSchema);
  if (error) return error;

  const d = getSqliteHandle();

  // Slug-Kollision fangen, statt auf die UNIQUE-Constraint zu laufen.
  const existing = d.prepare("SELECT id FROM tenants WHERE slug = ?").get(data!.slug);
  if (existing) return apiError("Slug already in use", 409, "SLUG_CONFLICT");

  const tenantId = crypto.randomUUID();
  d.prepare(`
    INSERT INTO tenants (id, name, slug, plan, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, '{}', datetime('now'), datetime('now'))
  `).run(tenantId, data!.name, data!.slug, data!.plan ?? "standard");

  // Ownership-Seed: System-Admin wird automatisch Owner, damit der
  // neue Tenant nicht ohne Owner geboren wird. Wenn zusaetzlich eine
  // ownerEmail uebergeben wird und der User existiert, wird auch er
  // Owner. Wenn der User noch nicht existiert: kein Auto-Invite in
  // Phase 2 — das Invite-Flow kommt mit Phase 3.
  const actorId = session!.user.id;
  if (actorId && actorId !== "dev-user") {
    d.prepare(`
      INSERT OR IGNORE INTO tenant_memberships (id, tenant_id, user_id, role, invited_by, joined_at)
      VALUES (?, ?, ?, 'owner', ?, datetime('now'))
    `).run(crypto.randomUUID(), tenantId, actorId, actorId);
  }

  if (data!.ownerEmail) {
    const ownerUser = d.prepare("SELECT id FROM users WHERE email = ?")
      .get(data!.ownerEmail.toLowerCase()) as { id: string } | undefined;
    if (ownerUser) {
      d.prepare(`
        INSERT OR IGNORE INTO tenant_memberships (id, tenant_id, user_id, role, invited_by, joined_at)
        VALUES (?, ?, ?, 'owner', ?, datetime('now'))
      `).run(crypto.randomUUID(), tenantId, ownerUser.id, actorId ?? null);
    }
  }

  // Audit-Log.
  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'tenant.created', ?)
  `).run(crypto.randomUUID(), tenantId, actorId ?? null, JSON.stringify({ name: data!.name, slug: data!.slug }));

  const tenant = d.prepare(`
    SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at
    FROM tenants WHERE id = ?
  `).get(tenantId);

  return apiSuccess({ tenant }, 201);
}
