/**
 * GET    /api/v1/canvas/[id] — load canvas state
 * PATCH  /api/v1/canvas/[id] — save canvas state and/or rename
 * DELETE /api/v1/canvas/[id] — delete canvas project
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  try { d.exec("ALTER TABLE radars ADD COLUMN canvas_state TEXT"); } catch {}
  return d;
}

type Params = { params: Promise<{ id: string }> };

// GET — load full canvas state
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const d = db();
  const row = d.prepare(
    "SELECT id, name, description, canvas_state, created_at, updated_at FROM radars WHERE id = ?"
  ).get(id) as { id: string; name: string; description: string | null; canvas_state: string | null; created_at: string; updated_at: string } | undefined;
  d.close();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ canvas: row });
}

// PATCH — save canvas state and/or rename project
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const d = db();

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if ("canvasState" in body) {
    sets.push("canvas_state = ?");
    values.push(body.canvasState === null ? null : JSON.stringify(body.canvasState));
  }
  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name);
  }

  if (sets.length > 0) {
    values.push(id);
    d.prepare(`UPDATE radars SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  const updated = d.prepare(
    "SELECT id, name, description, canvas_state, created_at, updated_at FROM radars WHERE id = ?"
  ).get(id);
  d.close();
  return NextResponse.json({ canvas: updated });
}

// DELETE — delete canvas project (cascades to project_queries and project_notes)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const d = db();
  d.prepare("DELETE FROM radars WHERE id = ?").run(id);
  d.close();
  return NextResponse.json({ success: true });
}
