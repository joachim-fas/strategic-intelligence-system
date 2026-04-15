/**
 * POST /api/v1/admin/tenants/[id]/invites
 *   Body: { email, role, message?: string }
 *   - If user with this email exists: create membership directly,
 *     emit "member.added" audit entry, return { kind: "direct" }.
 *   - If not: create tenant_invites row with crypto token, return
 *     { kind: "invite", token, acceptUrl }. Email dispatch is a
 *     later phase — for now the admin UI shows the accept URL so
 *     the admin can share it manually.
 *
 * DELETE /api/v1/admin/tenants/[id]/invites?inviteId=<id>
 *   Revoke a pending invite (sets accepted_at? no — we just hard-
 *   delete so the token is unusable). Audit-logged.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, parseBody, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  message: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * URL-safe random token, ~43 chars (32 bytes → 256 bits of entropy).
 * Longer than necessary but aligned with typical invite-token lengths
 * so there's no ambiguity about brute-force resistance.
 */
function newInviteToken(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * 14-day default expiry. Invites older than that cannot be accepted
 * even if the token is still known — the user must be re-invited.
 */
function defaultExpiryIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, inviteSchema);
  if (error) return error;

  const d = getSqliteHandle();
  const tenant = d.prepare("SELECT id, name, slug FROM tenants WHERE id = ? AND archived_at IS NULL")
    .get(id) as { id: string; name: string; slug: string } | undefined;
  if (!tenant) return apiError("Tenant not found or archived", 404, "NOT_FOUND");

  const normalizedEmail = data!.email.toLowerCase().trim();
  const actorId = session!.user.id ?? null;

  // If the user already exists, add them as a member directly — no
  // email round-trip needed. If they're already a member, that's a
  // 409 so the admin sees the mistake.
  const user = d.prepare("SELECT id FROM users WHERE lower(email) = ?")
    .get(normalizedEmail) as { id: string } | undefined;

  if (user) {
    const existingMembership = d.prepare(
      "SELECT id FROM tenant_memberships WHERE tenant_id = ? AND user_id = ?",
    ).get(tenant.id, user.id);
    if (existingMembership) {
      return apiError("User is already a member of this tenant", 409, "ALREADY_MEMBER");
    }
    const membershipId = crypto.randomUUID();
    d.prepare(`
      INSERT INTO tenant_memberships (id, tenant_id, user_id, role, invited_by, joined_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(membershipId, tenant.id, user.id, data!.role, actorId);

    d.prepare(`
      INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
      VALUES (?, ?, ?, 'member.added', ?)
    `).run(
      crypto.randomUUID(),
      tenant.id,
      actorId,
      JSON.stringify({ membershipId, userId: user.id, email: normalizedEmail, role: data!.role }),
    );

    return apiSuccess({
      kind: "direct",
      membershipId,
      userId: user.id,
      email: normalizedEmail,
      role: data!.role,
    }, 201);
  }

  // User does not exist — issue a token-based invite. The accept URL
  // is returned so the admin UI can show + copy it; when the email
  // dispatch lands in a later phase we'll also send it automatically.
  const inviteId = crypto.randomUUID();
  const token = newInviteToken();
  const expiresAt = defaultExpiryIso();

  d.prepare(`
    INSERT INTO tenant_invites (id, tenant_id, email, role, token, invited_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(inviteId, tenant.id, normalizedEmail, data!.role, token, actorId, expiresAt);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'invite.sent', ?)
  `).run(
    crypto.randomUUID(),
    tenant.id,
    actorId,
    JSON.stringify({ inviteId, email: normalizedEmail, role: data!.role }),
  );

  // Accept URL is a relative path — the client composes it with
  // window.location.origin. We also return it so the admin UI
  // can show it for manual-share-flow.
  return apiSuccess({
    kind: "invite",
    inviteId,
    email: normalizedEmail,
    role: data!.role,
    expiresAt,
    acceptPath: `/invite/accept?token=${token}`,
  }, 201);
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const inviteId = url.searchParams.get("inviteId");
  if (!inviteId) return apiError("inviteId required", 400, "VALIDATION_ERROR");

  const d = getSqliteHandle();
  const invite = d.prepare("SELECT id, email, role FROM tenant_invites WHERE id = ? AND tenant_id = ?")
    .get(inviteId, id) as { id: string; email: string; role: string } | undefined;
  if (!invite) return apiError("Invite not found", 404, "NOT_FOUND");

  d.prepare("DELETE FROM tenant_invites WHERE id = ?").run(inviteId);
  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'invite.revoked', ?)
  `).run(
    crypto.randomUUID(),
    id,
    session!.user.id ?? null,
    JSON.stringify({ inviteId, email: invite.email, role: invite.role }),
  );

  return new NextResponse(null, { status: 204 });
}
