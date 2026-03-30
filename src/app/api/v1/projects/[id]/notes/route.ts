import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

// GET — list notes for project
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = db();
  const notes = d.prepare("SELECT * FROM project_notes WHERE radar_id = ? ORDER BY created_at DESC").all(id);
  d.close();
  return NextResponse.json({ notes });
}

// POST — add note
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, queryId } = await req.json();
  if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const d = db();
  const nid = crypto.randomUUID();
  d.prepare(`
    INSERT INTO project_notes (id, radar_id, query_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(nid, id, queryId || null, content);

  d.prepare("UPDATE radars SET updated_at = datetime('now') WHERE id = ?").run(id);

  const saved = d.prepare("SELECT * FROM project_notes WHERE id = ?").get(nid);
  d.close();
  return NextResponse.json({ note: saved }, { status: 201 });
}

// DELETE — remove note (via query param ?nid=xxx)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const nid = url.searchParams.get("nid");
  if (!nid) return NextResponse.json({ error: "nid required" }, { status: 400 });

  const d = db();
  d.prepare("DELETE FROM project_notes WHERE id = ? AND radar_id = ?").run(nid, id);
  d.close();
  return NextResponse.json({ deleted: true });
}
