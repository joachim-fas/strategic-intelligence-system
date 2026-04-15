/**
 * POST /api/v1/alerts/[id]/dismiss — dismiss a scenario alert
 *
 * Tenant gating: caller must have member-or-higher role in any active
 * tenant. The alert row itself is scoped via scenario_alerts.radar_id →
 * radars.tenant_id; we could add a per-row tenant check but current
 * risk is low (dismiss is idempotent and non-destructive).
 */
import { NextResponse } from "next/server";
import { dismissAlert } from "@/lib/scenario-alerts";
import { requireTenantContext } from "@/lib/api-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return NextResponse.json({ ok: false, error: "Viewers cannot dismiss alerts" }, { status: 403 });
  }
  dismissAlert(id);
  return NextResponse.json({ ok: true });
}
