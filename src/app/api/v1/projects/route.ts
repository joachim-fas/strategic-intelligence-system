import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

// GET — list all projects
export async function GET() {
  const d = db();
  const projects = d.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM project_queries WHERE radar_id = r.id) as query_count,
      (SELECT COUNT(*) FROM project_notes WHERE radar_id = r.id) as note_count
    FROM radars r ORDER BY r.updated_at DESC
  `).all();
  d.close();
  return NextResponse.json({ projects });
}

// POST — create project
export async function POST(req: Request) {
  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const d = db();
  const id = crypto.randomUUID();
  d.prepare(`
    INSERT INTO radars (id, name, description, scope, is_shared, created_at, updated_at)
    VALUES (?, ?, ?, '{}', 0, datetime('now'), datetime('now'))
  `).run(id, name, description || null);

  const project = d.prepare("SELECT * FROM radars WHERE id = ?").get(id);
  d.close();
  return NextResponse.json({ project }, { status: 201 });
}
