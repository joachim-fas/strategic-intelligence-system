/**
 * GET /api/v1/admin/tenants/[id]/memberships — list members + invites
 *
 * Returned shape:
 *   {
 *     members:  [{ id, userId, email, name, role, joinedAt }, …]
 *     invites:  [{ id, email, role, expiresAt, acceptedAt, createdAt }, …]
 *   }
 *
 * Gatekeeper: system-admin (users.role = "admin"). Tenant-owners will
 * use the same data via a member-scoped variant in a later phase — for
 * now the /admin/mandanten/[id]/mitglieder UI lives under the system
 * admin tree and uses this endpoint.
 */

import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface MemberRow {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  joined_at: string;
}

interface InviteRow {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const d = getSqliteHandle();
  const tenant = d.prepare("SELECT id, name, slug FROM tenants WHERE id = ?").get(id);
  if (!tenant) return apiError("Tenant not found", 404, "NOT_FOUND");

  const members = d.prepare(`
    SELECT m.id, m.user_id, m.role, m.joined_at, u.email, u.name
    FROM tenant_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ?
    ORDER BY
      CASE m.role
        WHEN 'owner'  THEN 0
        WHEN 'admin'  THEN 1
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 3
        ELSE 4
      END,
      m.joined_at ASC
  `).all(id) as MemberRow[];

  const invites = d.prepare(`
    SELECT id, email, role, expires_at, accepted_at, created_at
    FROM tenant_invites
    WHERE tenant_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).all(id) as InviteRow[];

  return apiSuccess({ tenant, members, invites }, 200, CACHE_HEADERS.short);
}
