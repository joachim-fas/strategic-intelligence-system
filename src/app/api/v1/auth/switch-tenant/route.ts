/**
 * POST /api/v1/auth/switch-tenant — set the active tenant for the
 * authenticated user.
 *
 * Flow:
 * - Body: `{ tenantId: string }` — id of the tenant to switch to.
 * - Verifies the user has an active (non-archived) membership in that
 *   tenant; otherwise 403.
 * - Updates `users.last_active_tenant_id` — this column is the source of
 *   truth picked up by the auth adapter's `enrichUser` on the next
 *   session read (see src/lib/auth.ts + src/lib/auth.config.ts).
 * - Client is expected to hard-reload after a successful switch
 *   (`window.location.reload()`) so the next request carries the new
 *   session. No in-memory state needs to be flipped server-side; the
 *   session callback will read the fresh value on the next fetch.
 *
 * Dev-mode: no auth required, but the tenant still has to exist. We
 * treat the switch as a no-op success so local dev UI can still
 * exercise the code path.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, parseBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const switchBody = z.object({
  tenantId: z.string().min(1),
});

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, switchBody);
  if (error) return error;

  const db = getSqliteHandle();

  // Tenant must exist and not be archived.
  const tenant = db.prepare(`SELECT id, name, slug FROM tenants WHERE id = ? AND archived_at IS NULL`)
    .get(data.tenantId) as { id: string; name: string; slug: string } | undefined;
  if (!tenant) return apiError("Tenant not found or archived", 404, "NOT_FOUND");

  // Dev-mode: accept any existing tenant, no membership check, no write.
  // (Session object has no stable user-id we could persist against.)
  if (process.env.NODE_ENV === "development") {
    return apiSuccess({ tenant });
  }

  // Prod path: require real session + membership.
  const session = await auth();
  if (!session?.user?.id) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const membership = db.prepare(
    `SELECT role FROM tenant_memberships WHERE tenant_id = ? AND user_id = ?`,
  ).get(tenant.id, session.user.id) as { role: string } | undefined;
  if (!membership) return apiError("Not a member of this tenant", 403, "TENANT_NOT_AUTHORIZED");

  // Persist — this is what the session callback will pick up next time.
  db.prepare(`UPDATE users SET last_active_tenant_id = ? WHERE id = ?`).run(tenant.id, session.user.id);

  return apiSuccess({ tenant, role: membership.role });
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: { message: "Use POST", code: "METHOD_NOT_ALLOWED" } },
    { status: 405 },
  );
}
