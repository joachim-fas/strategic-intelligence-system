/**
 * POST /api/v1/admin/tenants/[id]/archive — archive or restore a tenant
 *
 * Archiving sets `archived_at` and:
 *   - hides the tenant from the user-facing tenant switcher
 *   - prevents writes to its radars/canvases (routes check archived_at)
 *   - keeps the data readable, so the tenant can be restored
 *
 * Restoring (body: { archived: false }) clears `archived_at` again.
 * Permanent delete is a separate DELETE on the parent route and is
 * only allowed if the tenant is currently archived.
 */

import { z } from "zod";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, parseBody, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const archiveSchema = z.object({
  archived: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const { data, error } = await parseBody(request, archiveSchema);
  if (error) return error;

  const d = getSqliteHandle();
  const existing = d.prepare("SELECT id FROM tenants WHERE id = ?").get(id);
  if (!existing) return apiError("Tenant not found", 404, "NOT_FOUND");

  if (data!.archived) {
    d.prepare(`
      UPDATE tenants SET archived_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND archived_at IS NULL
    `).run(id);
  } else {
    d.prepare(`
      UPDATE tenants SET archived_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, ?, '{}')
  `).run(
    crypto.randomUUID(),
    id,
    session!.user.id ?? null,
    data!.archived ? "tenant.archived" : "tenant.restored",
  );

  const tenant = d.prepare(`
    SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at
    FROM tenants WHERE id = ?
  `).get(id);
  return apiSuccess({ tenant });
}
