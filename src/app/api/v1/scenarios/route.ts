/**
 * GET  /api/v1/scenarios — List all scenarios
 * POST /api/v1/scenarios — Create a new scenario
 */

import { randomUUID } from "crypto";
import { getSqliteHandle } from "@/db";
import { checkRateLimit, tooManyRequests, validationError } from "@/lib/api-utils";
import { validateStringLength } from "@/lib/validation";
import { apiSuccess, CACHE_HEADERS, requireTenantContext } from "@/lib/api-helpers";

// SEC-14 resolved: scenarios are now tenant-scoped via tenant_id.

export async function GET(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx.errorResponse;

  const d = getSqliteHandle();
  const rows = d.prepare(
    "SELECT * FROM scenarios WHERE tenant_id = ? ORDER BY updated_at DESC"
  ).all(ctx.tenantId);

  const scenarios = (rows as any[]).map((r) => ({
    ...r,
    key_drivers: r.key_drivers ? JSON.parse(r.key_drivers) : [],
    impacts: r.impacts ? JSON.parse(r.impacts) : [],
  }));

  return apiSuccess({ scenarios }, 200, CACHE_HEADERS.short);
}

export async function POST(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;
  if (ctx.role === "viewer") {
    return validationError("Viewers cannot create scenarios");
  }

  const body = await req.json().catch(() => ({}));
  const { name, description, type, probability, timeframe, key_drivers, impacts, source, source_query } = body;

  // SEC-13: Input validation
  const nameCheck = validateStringLength(name, "name", 300, 1);
  if (!nameCheck.valid) return validationError(nameCheck.error);

  if (description !== undefined && description !== null) {
    const descCheck = validateStringLength(description, "description", 5000);
    if (!descCheck.valid) return validationError(descCheck.error);
  }

  if (type !== undefined && type !== null) {
    const typeCheck = validateStringLength(type, "type", 100);
    if (!typeCheck.valid) return validationError(typeCheck.error);
  }

  if (probability !== undefined && probability !== null) {
    if (typeof probability !== "number" || probability < 0 || probability > 1) {
      return validationError("probability must be a number between 0 and 1");
    }
  }

  if (timeframe !== undefined && timeframe !== null) {
    const tfCheck = validateStringLength(timeframe, "timeframe", 200);
    if (!tfCheck.valid) return validationError(tfCheck.error);
  }

  const id = randomUUID();
  const d = getSqliteHandle();
  d.prepare(`
    INSERT INTO scenarios (id, tenant_id, name, description, type, probability, timeframe, key_drivers, impacts, source, source_query)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    ctx.tenantId,
    name,
    description ?? null,
    type ?? "custom",
    probability ?? 0.5,
    timeframe ?? null,
    key_drivers ? JSON.stringify(key_drivers) : null,
    impacts ? JSON.stringify(impacts) : null,
    source ?? "user",
    source_query ?? null,
  );

  const row = d.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as any;

  return apiSuccess({
    scenario: {
      ...row,
      key_drivers: row.key_drivers ? JSON.parse(row.key_drivers) : [],
      impacts: row.impacts ? JSON.parse(row.impacts) : [],
    },
  }, 201);
}
