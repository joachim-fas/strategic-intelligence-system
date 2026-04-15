/**
 * GET  /api/v1/tenant/settings — read current tenant's name/slug/settings
 * PATCH /api/v1/tenant/settings — owner/admin update their own tenant
 *
 * This is the member-facing counterpart to /api/v1/admin/tenants/[id] —
 * system admins update any tenant via the admin path, tenant owners +
 * admins update their own via this path. Slug + name changes require
 * owner role; settings payload (logo, defaults, branding) only requires
 * admin.
 *
 * The route lives at /tenant/* (singular), not /tenants/*, so it is
 * easy to distinguish in logs: "admin touches someone else's tenant"
 * vs "member configures their own".
 */

import { z } from "zod";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, CACHE_HEADERS, parseBody, requireTenantContext, requireTenantRole } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

// Zwei getrennte Schemas: "owner"-Felder (Name, Slug) und "admin"-Felder
// (Settings-Blob). Owner-Change durch einen Admin wird unten hart ab-
// gewiesen.
const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().regex(SLUG_RE).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const d = getSqliteHandle();
  const row = d.prepare(`
    SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at
    FROM tenants WHERE id = ?
  `).get(ctx.tenantId) as Record<string, unknown> | undefined;
  if (!row) return apiError("Tenant not found", 404, "NOT_FOUND");

  return apiSuccess({
    tenant: row,
    role: ctx.role,
    canEditSettings: ctx.role === "owner" || ctx.role === "admin",
    canEditSlug: ctx.role === "owner",
  }, 200, CACHE_HEADERS.short);
}

export async function PATCH(request: Request) {
  const ctx = await requireTenantRole(request, "admin");
  if (ctx.errorResponse) return ctx.errorResponse;

  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;

  // Name + Slug nur Owner, der Rest kann auch Admin.
  const touchesOwnerFields = data!.name !== undefined || data!.slug !== undefined;
  if (touchesOwnerFields && ctx.role !== "owner") {
    return apiError("Only tenant owners can rename or change the slug", 403, "OWNER_REQUIRED");
  }

  const d = getSqliteHandle();
  const existing = d.prepare("SELECT id, slug FROM tenants WHERE id = ?")
    .get(ctx.tenantId) as { id: string; slug: string } | undefined;
  if (!existing) return apiError("Tenant not found", 404, "NOT_FOUND");

  if (data!.slug && data!.slug !== existing.slug) {
    const conflict = d.prepare("SELECT id FROM tenants WHERE slug = ? AND id != ?")
      .get(data!.slug, ctx.tenantId);
    if (conflict) return apiError("Slug already in use", 409, "SLUG_CONFLICT");
  }

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];
  if (data!.name !== undefined) { sets.push("name = ?"); values.push(data!.name); }
  if (data!.slug !== undefined) { sets.push("slug = ?"); values.push(data!.slug); }
  if (data!.settings !== undefined) { sets.push("settings = ?"); values.push(JSON.stringify(data!.settings)); }

  values.push(ctx.tenantId);
  d.prepare(`UPDATE tenants SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'tenant.updated', ?)
  `).run(crypto.randomUUID(), ctx.tenantId, ctx.user.id || null, JSON.stringify(data));

  const updated = d.prepare(`
    SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at
    FROM tenants WHERE id = ?
  `).get(ctx.tenantId);
  return apiSuccess({ tenant: updated, role: ctx.role });
}
