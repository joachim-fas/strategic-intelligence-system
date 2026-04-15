/**
 * GET /api/v1/admin/tenants/[id]/audit — list audit-log entries.
 *
 * Query params:
 *   limit=<n>   Max entries (default 50, max 500)
 *   before=<ts> Pagination cursor (ISO timestamp of the oldest entry
 *               the client has, to fetch the next page).
 *
 * Writes to the log happen implicitly from the admin routes (tenant
 * created/updated/archived/deleted, memberships added/removed/role
 * changed, invites sent/revoked/accepted). This endpoint is the read
 * side — system-admin only.
 *
 * Each row joins the actor user so the UI can render "jochen@…
 * changed X" without a second roundtrip.
 */

import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: string;
  target: string;
  created_at: string;
  actor_email: string | null;
  actor_name: string | null;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const limit = clamp(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1, 500);
  const before = url.searchParams.get("before"); // ISO timestamp

  const d = getSqliteHandle();
  const tenant = d.prepare("SELECT id FROM tenants WHERE id = ?").get(id);
  if (!tenant) return apiError("Tenant not found", 404, "NOT_FOUND");

  const rows = (before
    ? d.prepare(`
        SELECT a.id, a.tenant_id, a.actor_user_id, a.action, a.target, a.created_at,
          u.email AS actor_email, u.name AS actor_name
        FROM tenant_audit_log a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.tenant_id = ? AND a.created_at < ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `).all(id, before, limit)
    : d.prepare(`
        SELECT a.id, a.tenant_id, a.actor_user_id, a.action, a.target, a.created_at,
          u.email AS actor_email, u.name AS actor_name
        FROM tenant_audit_log a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.tenant_id = ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `).all(id, limit)) as AuditRow[];

  const entries = rows.map((r) => {
    let target: unknown = null;
    try { target = r.target ? JSON.parse(r.target) : null; } catch { target = r.target; }
    return {
      id: r.id,
      action: r.action,
      target,
      createdAt: r.created_at,
      actor: r.actor_user_id ? {
        id: r.actor_user_id,
        name: r.actor_name,
        email: r.actor_email,
      } : null,
    };
  });

  // Cursor fuer Pagination: der letzte (aeltester) created_at-Wert der
  // aktuellen Seite; null wenn wir alle Eintraege haben.
  const nextBefore = rows.length === limit ? rows[rows.length - 1].created_at : null;

  return apiSuccess({ entries, nextBefore }, 200, CACHE_HEADERS.short);
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
