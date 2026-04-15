/**
 * PATCH  /api/v1/admin/tenants/[id]/memberships/[membershipId]
 *   Body: { role: "owner" | "admin" | "member" | "viewer" }
 *   Updates a member's role. Owner demotion is rejected if it would
 *   leave the tenant without an owner.
 *
 * DELETE /api/v1/admin/tenants/[id]/memberships/[membershipId]
 *   Removes the member from the tenant. Same last-owner guard.
 *
 * Both writes write an audit_log entry.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, parseBody, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

type Params = { params: Promise<{ id: string; membershipId: string }> };

function ownerCount(db: ReturnType<typeof getSqliteHandle>, tenantId: string): number {
  const row = db.prepare(
    "SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id = ? AND role = 'owner'",
  ).get(tenantId) as { n: number };
  return row.n;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id, membershipId } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;

  const d = getSqliteHandle();
  const existing = d.prepare(`
    SELECT id, tenant_id, user_id, role FROM tenant_memberships
    WHERE id = ? AND tenant_id = ?
  `).get(membershipId, id) as { id: string; tenant_id: string; user_id: string; role: string } | undefined;
  if (!existing) return apiError("Membership not found", 404, "NOT_FOUND");

  // Last-owner guard: demoting the last owner is rejected.
  if (existing.role === "owner" && data!.role !== "owner" && ownerCount(d, id) <= 1) {
    return apiError(
      "Cannot demote the last owner of a tenant",
      409,
      "LAST_OWNER",
    );
  }

  d.prepare("UPDATE tenant_memberships SET role = ? WHERE id = ?")
    .run(data!.role, membershipId);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'role.changed', ?)
  `).run(
    crypto.randomUUID(),
    id,
    session!.user.id ?? null,
    JSON.stringify({ membershipId, userId: existing.user_id, from: existing.role, to: data!.role }),
  );

  return apiSuccess({ id: membershipId, role: data!.role });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, membershipId } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const d = getSqliteHandle();
  const existing = d.prepare(`
    SELECT id, tenant_id, user_id, role FROM tenant_memberships
    WHERE id = ? AND tenant_id = ?
  `).get(membershipId, id) as { id: string; tenant_id: string; user_id: string; role: string } | undefined;
  if (!existing) return apiError("Membership not found", 404, "NOT_FOUND");

  // Last-owner guard: removing the last owner is rejected. An admin
  // must promote someone else first, then remove the old owner.
  if (existing.role === "owner" && ownerCount(d, id) <= 1) {
    return apiError(
      "Cannot remove the last owner of a tenant",
      409,
      "LAST_OWNER",
    );
  }

  d.prepare("DELETE FROM tenant_memberships WHERE id = ?").run(membershipId);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'member.removed', ?)
  `).run(
    crypto.randomUUID(),
    id,
    session!.user.id ?? null,
    JSON.stringify({ membershipId, userId: existing.user_id, role: existing.role }),
  );

  return new NextResponse(null, { status: 204 });
}
