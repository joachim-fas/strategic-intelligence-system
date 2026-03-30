import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  return d;
}

type Params = { params: Promise<{ id: string }> };

// PATCH — rename project
export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { name, description } = body;
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const d = db();
    d.prepare("UPDATE radars SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name.trim(), description ?? null, id);
    const updated = d.prepare("SELECT * FROM radars WHERE id = ?").get(id);
    d.close();
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — delete project + cascade
export async function DELETE(_req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const d = db();
    // Cascade manually (foreign_keys pragma handles it if FK constraints exist,
    // but we delete explicitly to be safe)
    d.prepare("DELETE FROM project_notes WHERE radar_id = ?").run(id);
    d.prepare("DELETE FROM project_queries WHERE radar_id = ?").run(id);
    d.prepare("DELETE FROM radars WHERE id = ?").run(id);
    d.close();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
