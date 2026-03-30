import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

type Params = { params: Promise<{ id: string; nid: string }> };

// DELETE — remove a specific note
export async function DELETE(_req: Request, context: Params) {
  try {
    const { nid } = await context.params;
    const d = db();
    d.prepare("DELETE FROM project_notes WHERE id = ?").run(nid);
    d.close();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — update note content
export async function PATCH(req: Request, context: Params) {
  try {
    const { nid } = await context.params;
    const body = await req.json();
    const { content } = body;
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    const d = db();
    d.prepare("UPDATE project_notes SET content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(content.trim(), nid);
    const updated = d.prepare("SELECT * FROM project_notes WHERE id = ?").get(nid);
    d.close();
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ note: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
