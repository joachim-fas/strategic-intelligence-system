/**
 * Public invite-accept endpoints.
 *
 * GET /api/v1/invites/accept?token=<t>
 *   Looks up the invite by token (public — no auth needed because the
 *   token itself is the credential). Returns tenant + role + email so
 *   the /invite/accept page can render a nice "You've been invited to
 *   <Tenant>" landing.
 *
 * POST /api/v1/invites/accept
 *   Body: { token }
 *   Requires an authenticated session — the caller must be logged in
 *   and their session email must match the invite email. Converts the
 *   invite row into a tenant_memberships row and stamps accepted_at.
 *   Caller must redirect after success; we don't issue a redirect
 *   server-side because the client has more context (locale etc.).
 */

import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, parseBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

interface InviteRow {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  tenant_name: string;
  tenant_slug: string;
}

function loadInviteByToken(token: string): InviteRow | null {
  const d = getSqliteHandle();
  return d.prepare(`
    SELECT i.id, i.tenant_id, i.email, i.role, i.expires_at, i.accepted_at,
      t.name AS tenant_name, t.slug AS tenant_slug
    FROM tenant_invites i
    JOIN tenants t ON t.id = i.tenant_id
    WHERE i.token = ?
  `).get(token) as InviteRow | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return apiError("Missing token", 400, "VALIDATION_ERROR");

  const invite = loadInviteByToken(token);
  if (!invite) return apiError("Invite not found", 404, "NOT_FOUND");
  if (invite.accepted_at) return apiError("Invite already accepted", 410, "ALREADY_ACCEPTED");
  if (new Date(invite.expires_at) < new Date()) {
    return apiError("Invite expired", 410, "EXPIRED");
  }

  return apiSuccess({
    email: invite.email,
    role: invite.role,
    tenant: {
      id: invite.tenant_id,
      name: invite.tenant_name,
      slug: invite.tenant_slug,
    },
    expiresAt: invite.expires_at,
  });
}

const acceptSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, acceptSchema);
  if (error) return error;

  const invite = loadInviteByToken(data!.token);
  if (!invite) return apiError("Invite not found", 404, "NOT_FOUND");
  if (invite.accepted_at) return apiError("Invite already accepted", 410, "ALREADY_ACCEPTED");
  if (new Date(invite.expires_at) < new Date()) {
    return apiError("Invite expired", 410, "EXPIRED");
  }

  const session = await auth();
  if (!session?.user?.id) {
    return apiError("Sign in required before accepting", 401, "UNAUTHORIZED");
  }
  if (!session.user.email || session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return apiError(
      "You must be signed in as the invited email to accept",
      403,
      "EMAIL_MISMATCH",
    );
  }

  const d = getSqliteHandle();
  // Upsert membership: if the user somehow already has a membership
  // (e.g. admin added them manually meanwhile), don't duplicate.
  const existing = d.prepare(
    "SELECT id FROM tenant_memberships WHERE tenant_id = ? AND user_id = ?",
  ).get(invite.tenant_id, session.user.id) as { id: string } | undefined;

  let membershipId: string;
  if (existing) {
    membershipId = existing.id;
  } else {
    membershipId = crypto.randomUUID();
    d.prepare(`
      INSERT INTO tenant_memberships (id, tenant_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(membershipId, invite.tenant_id, session.user.id, invite.role);
  }

  // Consume the invite.
  d.prepare("UPDATE tenant_invites SET accepted_at = datetime('now') WHERE id = ?")
    .run(invite.id);

  // Activate this tenant for the newcomer.
  d.prepare("UPDATE users SET last_active_tenant_id = ? WHERE id = ?")
    .run(invite.tenant_id, session.user.id);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'invite.accepted', ?)
  `).run(
    crypto.randomUUID(),
    invite.tenant_id,
    session.user.id,
    JSON.stringify({ inviteId: invite.id, membershipId, role: invite.role }),
  );

  return apiSuccess({
    membershipId,
    tenantId: invite.tenant_id,
    role: invite.role,
  });
}
