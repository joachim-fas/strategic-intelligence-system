import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

// GET — list all projects (excludes canvas_state blob for performance)
export async function GET() {
  // DAT-13: Ensure DB handle is always closed
  const d = db();
  try {
    const projects = d.prepare(`
      SELECT r.id, r.name, r.description, r.scope, r.is_shared,
        r.created_at, r.updated_at,
        (SELECT COUNT(*) FROM project_queries WHERE radar_id = r.id) as query_count,
        (SELECT COUNT(*) FROM project_notes WHERE radar_id = r.id) as note_count
      FROM radars r ORDER BY r.updated_at DESC
    `).all();
    return NextResponse.json({ projects });
  } finally {
    d.close();
  }
}

// POST — create project
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { name, description } = body;

  // Validate title: required, max 200 chars
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Title is required", status: 400 } },
      { status: 400 }
    );
  }
  if (name.trim().length > 200) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Title must be 200 characters or fewer", status: 400 } },
      { status: 400 }
    );
  }
  // Validate description: optional, max 2000 chars
  if (description !== undefined && description !== null && typeof description === "string" && description.length > 2000) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Description must be 2000 characters or fewer", status: 400 } },
      { status: 400 }
    );
  }

  // DAT-13: Ensure DB handle is always closed
  const d = db();
  try {
    const id = crypto.randomUUID();
    d.prepare(`
      INSERT INTO radars (id, name, description, scope, is_shared, created_at, updated_at)
      VALUES (?, ?, ?, '{}', 0, datetime('now'), datetime('now'))
    `).run(id, name.trim(), description || null);

    const project = d.prepare("SELECT * FROM radars WHERE id = ?").get(id);
    return NextResponse.json({ project }, { status: 201 });
  } finally {
    d.close();
  }
}
