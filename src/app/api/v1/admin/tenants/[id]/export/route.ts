/**
 * GET /api/v1/admin/tenants/[id]/export — full JSON dump of a tenant.
 *
 * Audience: system admins handling GDPR / DSGVO data-subject-access or
 * data-portability requests, or archiving-with-export workflows. The
 * response is a single JSON document with everything that belongs to
 * this tenant: membership list, invites (non-PII token hashed out),
 * canvases, scenarios, bsc_ratings, audit log, tenant settings.
 *
 * Security considerations:
 *   - system-admin-only (requireSystemAdmin). Downloading another
 *     tenant's data from a member's own tenant would be a leak.
 *   - Invite tokens are redacted — they grant login-without-auth and
 *     must never leave the system in a backup.
 *   - Content-Disposition forces a download so the browser doesn't
 *     render potentially large JSON inline.
 *
 * The dump is NOT streamed — tenants are small enough that building
 * the object in memory is fine. If a tenant's canvas_state column
 * grows into the MB range we'd switch to NDJSON; current footprint is
 * ≤ 20 MB per tenant even with heavy usage.
 */

import { NextResponse } from "next/server";
import { getSqliteHandle } from "@/db";
import { apiError, requireSystemAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { session, errorResponse } = await requireSystemAdmin();
  if (errorResponse) return errorResponse;

  const d = getSqliteHandle();
  const tenant = d.prepare(
    "SELECT id, name, slug, plan, settings, archived_at, created_at, updated_at FROM tenants WHERE id = ?",
  ).get(id) as TenantRow | undefined;
  if (!tenant) return apiError("Tenant not found", 404, "NOT_FOUND");

  // Memberships joined with user-email so the export is self-contained.
  const members = d.prepare(`
    SELECT m.id, m.role, m.joined_at, m.invited_by,
      u.id AS user_id, u.email, u.name, u.created_at AS user_created_at
    FROM tenant_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ?
    ORDER BY m.joined_at ASC
  `).all(id);

  // Invites — token redacted. accepted_at + expires_at + email keep
  // the history interpretable without leaking the credential.
  const invites = d.prepare(`
    SELECT id, email, role, invited_by, expires_at, accepted_at, created_at
    FROM tenant_invites WHERE tenant_id = ?
    ORDER BY created_at DESC
  `).all(id);

  const radars = d.prepare(`
    SELECT id, owner_id, name, description, scope, is_shared, canvas_state,
      archived_at, created_at, updated_at
    FROM radars WHERE tenant_id = ?
    ORDER BY created_at ASC
  `).all(id);

  // Radar-children: queries + notes + trend scores. Joined via
  // radar_id so we stay within this tenant by construction.
  const radarIds = (radars as Array<{ id: string }>).map((r) => r.id);
  const queries = radarIds.length > 0
    ? d.prepare(`SELECT * FROM project_queries WHERE radar_id IN (${radarIds.map(() => "?").join(",")}) ORDER BY created_at ASC`).all(...radarIds)
    : [];
  const notes = radarIds.length > 0
    ? d.prepare(`SELECT * FROM project_notes WHERE radar_id IN (${radarIds.map(() => "?").join(",")}) ORDER BY created_at ASC`).all(...radarIds)
    : [];
  const radarTrends = radarIds.length > 0
    ? d.prepare(`SELECT * FROM radar_trends WHERE radar_id IN (${radarIds.map(() => "?").join(",")}) ORDER BY created_at ASC`).all(...radarIds)
    : [];

  const scenarios = d.prepare(`
    SELECT id, name, description, type, probability, timeframe,
      key_drivers, impacts, source, source_query, created_at, updated_at
    FROM scenarios WHERE tenant_id = ?
    ORDER BY created_at ASC
  `).all(id);

  const bscRatings = d.prepare(`
    SELECT id, query_hash, perspective_id, rating, created_at
    FROM bsc_ratings WHERE tenant_id = ?
    ORDER BY created_at ASC
  `).all(id);

  const auditLog = d.prepare(`
    SELECT id, actor_user_id, action, target, created_at
    FROM tenant_audit_log WHERE tenant_id = ?
    ORDER BY created_at ASC
  `).all(id);

  // Write the export action itself to the audit trail so the subject
  // of the DSGVO request has a record that their data was pulled.
  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'tenant.exported', ?)
  `).run(
    crypto.randomUUID(),
    id,
    session!.user.id ?? null,
    JSON.stringify({
      memberCount: members.length,
      radarCount: radars.length,
      scenarioCount: scenarios.length,
      ratingCount: bscRatings.length,
    }),
  );

  const dump = {
    exportFormatVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: session!.user.id,
    tenant: {
      ...tenant,
      settings: (() => { try { return JSON.parse(tenant.settings); } catch { return tenant.settings; } })(),
    },
    memberships: members,
    invites,
    radars: (radars as Array<Record<string, unknown>>).map((r) => ({
      ...r,
      canvas_state: (() => {
        const raw = r.canvas_state as string | null | undefined;
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return raw; }
      })(),
    })),
    queries,
    notes,
    radarTrends,
    scenarios,
    bscRatings,
    auditLog,
  };

  const body = JSON.stringify(dump, null, 2);
  const filename = `tenant-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
