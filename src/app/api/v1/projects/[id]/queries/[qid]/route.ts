import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

type Params = { params: Promise<{ id: string; qid: string }> };

// PATCH — toggle pin or update fields
export async function PATCH(req: Request, context: Params) {
  try {
    const { qid } = await context.params;
    const body = await req.json();
    const d = db();
    if (typeof body.pinned === "boolean") {
      d.prepare("UPDATE project_queries SET pinned = ? WHERE id = ?").run(body.pinned ? 1 : 0, qid);
    }
    const updated = d.prepare("SELECT * FROM project_queries WHERE id = ?").get(qid);
    d.close();
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ query: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a specific query
export async function DELETE(_req: Request, context: Params) {
  try {
    const { qid } = await context.params;
    const d = db();
    // Also delete associated notes
    d.prepare("DELETE FROM project_notes WHERE query_id = ?").run(qid);
    d.prepare("DELETE FROM project_queries WHERE id = ?").run(qid);
    d.close();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
