/**
 * GET /api/v1/admin/audit — cross-tenant audit-log viewer (system-admin).
 *
 * Same payload shape as /api/v1/admin/tenants/[id]/audit, but joined
 * across every tenant. Used by /admin/audit to give a global "what
 * changed where" view for the whole system.
 *
 * Supported filters (all optional, combinable):
 *   action   — exact match on action string (e.g. "invite.sent")
 *   tenantId — limit to one tenant
 *   actorId  — limit to one actor user
 *   limit    — default 100, max 500
 *   before   — ISO timestamp cursor for pagination (newest-first)
 */

import { getSqliteHandle } from "@/db";
import { apiSuccess, CACHE_HEADERS, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  actor_user_id: string | null;
  action: string;
  target: string;
  created_at: string;
  actor_email: string | null;
  actor_name: string | null;
}

export async function GET(request: Request) {
  const { errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const limit = clamp(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1, 500);
  const before = url.searchParams.get("before");
  const actionFilter = url.searchParams.get("action");
  const tenantFilter = url.searchParams.get("tenantId");
  const actorFilter = url.searchParams.get("actorId");
  // NEU: Actor-Email-Freitext-Filter server-side. Frueher nur Client-
  // side (auf dem geladenen Batch) — das fand nur Treffer in den
  // juengsten 100 Eintraegen. Server-side nutzt eine case-insensitive
  // LIKE-Query auf users.email, damit der Filter auch in alten
  // Audit-Rows findet, die nicht mehr in der ersten Seite stecken.
  const actorEmail = url.searchParams.get("actorEmail");

  const d = getSqliteHandle();

  // Build up the WHERE clause piecewise. We keep the SQL literal-free
  // by using parametrised placeholders only — no string interpolation
  // of user input.
  const wheres: string[] = [];
  const vals: unknown[] = [];
  if (before) { wheres.push("a.created_at < ?"); vals.push(before); }
  if (actionFilter) { wheres.push("a.action = ?"); vals.push(actionFilter); }
  if (tenantFilter) { wheres.push("a.tenant_id = ?"); vals.push(tenantFilter); }
  if (actorFilter) { wheres.push("a.actor_user_id = ?"); vals.push(actorFilter); }
  if (actorEmail) {
    // LIKE mit %…% matched Substring, lower() macht es case-insensitive.
    // Die JOIN-Alias `u` wird unten im SELECT auch verwendet, deshalb
    // kein extra JOIN noetig.
    wheres.push("lower(u.email) LIKE ?");
    vals.push(`%${actorEmail.toLowerCase().trim()}%`);
  }
  const whereSql = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";

  const rows = d.prepare(`
    SELECT a.id, a.tenant_id, a.actor_user_id, a.action, a.target, a.created_at,
      t.name AS tenant_name, t.slug AS tenant_slug,
      u.email AS actor_email, u.name AS actor_name
    FROM tenant_audit_log a
    JOIN tenants t ON t.id = a.tenant_id
    LEFT JOIN users u ON u.id = a.actor_user_id
    ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(...vals, limit) as AuditRow[];

  const entries = rows.map((r) => {
    let target: unknown = null;
    try { target = r.target ? JSON.parse(r.target) : null; } catch { target = r.target; }
    return {
      id: r.id,
      action: r.action,
      target,
      createdAt: r.created_at,
      tenant: { id: r.tenant_id, name: r.tenant_name, slug: r.tenant_slug },
      actor: r.actor_user_id ? {
        id: r.actor_user_id,
        name: r.actor_name,
        email: r.actor_email,
      } : null,
    };
  });

  // Filter-metadata so the UI can render dropdowns without a second
  // round-trip: distinct actions ever seen and distinct actor emails.
  const actions = d.prepare(
    "SELECT DISTINCT action FROM tenant_audit_log ORDER BY action",
  ).all() as { action: string }[];
  const tenants = d.prepare(
    "SELECT id, name, slug FROM tenants WHERE archived_at IS NULL ORDER BY name",
  ).all() as { id: string; name: string; slug: string }[];

  const nextBefore = rows.length === limit ? rows[rows.length - 1].created_at : null;

  return apiSuccess({
    entries,
    nextBefore,
    filters: {
      actions: actions.map((a) => a.action),
      tenants,
    },
  }, 200, CACHE_HEADERS.short);
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
