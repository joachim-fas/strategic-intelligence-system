import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

// GET — list saved queries for project
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = db();
  const queries = d.prepare(`
    SELECT q.*, (SELECT COUNT(*) FROM project_notes WHERE query_id = q.id) as note_count
    FROM project_queries q WHERE q.radar_id = ? ORDER BY q.created_at DESC
  `).all(id);
  d.close();

  // Parse result_json for each query
  const parsed = (queries as any[]).map((q) => ({
    ...q,
    result: q.result_json ? JSON.parse(q.result_json) : null,
    contextProfile: q.context_profile ? JSON.parse(q.context_profile) : null,
  }));

  return NextResponse.json({ queries: parsed });
}

// POST — save a query result to project
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { query, result, locale, contextProfile } = await req.json();
  if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

  const d = db();
  const qid = crypto.randomUUID();
  d.prepare(`
    INSERT INTO project_queries (id, radar_id, query, locale, result_json, context_profile, pinned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(qid, id, query, locale || "de", result ? JSON.stringify(result) : null, contextProfile ? JSON.stringify(contextProfile) : null);

  // Update project timestamp
  d.prepare("UPDATE radars SET updated_at = datetime('now') WHERE id = ?").run(id);

  const saved = d.prepare("SELECT * FROM project_queries WHERE id = ?").get(qid);
  d.close();
  return NextResponse.json({ query: saved }, { status: 201 });
}

// DELETE — remove a query (via query param ?qid=xxx)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const qid = url.searchParams.get("qid");
  if (!qid) return NextResponse.json({ error: "qid required" }, { status: 400 });

  const d = db();
  d.prepare("DELETE FROM project_queries WHERE id = ? AND radar_id = ?").run(qid, id);
  d.close();
  return NextResponse.json({ deleted: true });
}

// PATCH — pin/unpin a query (via query param ?qid=xxx)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const qid = url.searchParams.get("qid");
  if (!qid) return NextResponse.json({ error: "qid required" }, { status: 400 });
  const { pinned } = await req.json();
  const d = db();
  d.prepare("UPDATE project_queries SET pinned = ? WHERE id = ? AND radar_id = ?").run(pinned ? 1 : 0, qid, id);
  d.close();
  return NextResponse.json({ updated: true });
}
