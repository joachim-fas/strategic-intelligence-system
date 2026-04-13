/**
 * GET    /api/v1/scenarios/[id] — Get single scenario
 * PATCH  /api/v1/scenarios/[id] — Update scenario
 * DELETE /api/v1/scenarios/[id] — Delete scenario
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const d = db();
  const row = d.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as any;
  d.close();

  if (!row) return apiError("Scenario not found", 404, "NOT_FOUND");

  return apiSuccess({
    scenario: {
      ...row,
      key_drivers: row.key_drivers ? JSON.parse(row.key_drivers) : [],
      impacts: row.impacts ? JSON.parse(row.impacts) : [],
    },
  }, 200, CACHE_HEADERS.short);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const d = db();

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (body.name !== undefined) { sets.push("name = ?"); values.push(body.name); }
  if (body.description !== undefined) { sets.push("description = ?"); values.push(body.description); }
  if (body.type !== undefined) { sets.push("type = ?"); values.push(body.type); }
  if (body.probability !== undefined) { sets.push("probability = ?"); values.push(body.probability); }
  if (body.timeframe !== undefined) { sets.push("timeframe = ?"); values.push(body.timeframe); }
  if (body.key_drivers !== undefined) { sets.push("key_drivers = ?"); values.push(JSON.stringify(body.key_drivers)); }
  if (body.impacts !== undefined) { sets.push("impacts = ?"); values.push(JSON.stringify(body.impacts)); }

  if (sets.length > 0) {
    values.push(id);
    d.prepare(`UPDATE scenarios SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  const row = d.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as any;
  d.close();

  if (!row) return apiError("Scenario not found", 404, "NOT_FOUND");

  return apiSuccess({
    scenario: {
      ...row,
      key_drivers: row.key_drivers ? JSON.parse(row.key_drivers) : [],
      impacts: row.impacts ? JSON.parse(row.impacts) : [],
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const d = db();
  d.prepare("DELETE FROM scenarios WHERE id = ?").run(id);
  d.close();
  return new NextResponse(null, { status: 204 });
}
