/**
 * GET  /api/v1/canvas — list all canvas projects
 * POST /api/v1/canvas — create a new canvas project
 *
 * Canvas projects reuse the existing `radars` table.
 * Canvas state (nodes, connections, pan, zoom) is stored in the `canvas_state` column.
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  // Ensure canvas_state column exists (idempotent)
  try { d.exec("ALTER TABLE radars ADD COLUMN canvas_state TEXT"); } catch {}
  return d;
}

// GET — list all canvas projects (newest first)
export async function GET() {
  const d = db();
  const rows = d.prepare(`
    SELECT id, name, description, canvas_state, created_at, updated_at
    FROM radars
    ORDER BY updated_at DESC
  `).all() as Array<{
    id: string; name: string; description: string | null;
    canvas_state: string | null; created_at: string; updated_at: string;
  }>;
  d.close();

  // Return lightweight list (no full canvas_state payload)
  const canvases = rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    hasState: !!r.canvas_state,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return NextResponse.json({ canvases });
}

// POST — create a new canvas project
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name: string = body.name?.trim() || "Neues Projekt";

  const d = db();
  const id = crypto.randomUUID();
  d.prepare(`
    INSERT INTO radars (id, name, description, scope, is_shared, canvas_state, created_at, updated_at)
    VALUES (?, ?, ?, '{}', 0, NULL, datetime('now'), datetime('now'))
  `).run(id, name, body.description ?? null);

  const canvas = d.prepare("SELECT id, name, description, created_at, updated_at FROM radars WHERE id = ?").get(id);
  d.close();
  return NextResponse.json({ canvas }, { status: 201 });
}
