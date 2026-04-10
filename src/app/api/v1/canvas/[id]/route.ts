/**
 * GET    /api/v1/canvas/[id] — load canvas state
 * POST   /api/v1/canvas/[id] — save canvas state (sendBeacon compatibility)
 * PATCH  /api/v1/canvas/[id] — save canvas state and/or rename
 * DELETE /api/v1/canvas/[id] — delete canvas project
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  // Idempotent schema upgrades (must match /api/v1/canvas/route.ts)
  try { d.exec("ALTER TABLE radars ADD COLUMN canvas_state TEXT"); } catch {}
  try { d.exec("ALTER TABLE radars ADD COLUMN archived_at TEXT"); } catch {}
  return d;
}

type Params = { params: Promise<{ id: string }> };

// TODO: SEC-14 — Add user_id ownership check when user_id column exists on the radars table.
// All GET/POST/PATCH/DELETE handlers should verify the resource belongs to the authenticated user.

// GET — load full canvas state
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  // DAT-13: Ensure DB handle is always closed
  const d = db();
  try {
    const row = d.prepare(
      "SELECT id, name, description, canvas_state, created_at, updated_at, archived_at FROM radars WHERE id = ?"
    ).get(id) as { id: string; name: string; description: string | null; canvas_state: string | null; created_at: string; updated_at: string; archived_at: string | null } | undefined;

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ canvas: row });
  } finally {
    d.close();
  }
}

// Shared update logic for PATCH and POST (sendBeacon)
function applyCanvasUpdate(d: ReturnType<typeof db>, id: string, body: Record<string, unknown>) {
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
  if (typeof body.archived === "boolean") {
    if (body.archived) {
      sets.push("archived_at = datetime('now')");
    } else {
      sets.push("archived_at = NULL");
    }
  }

  if (sets.length > 0) {
    values.push(id);
    d.prepare(`UPDATE radars SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }
}

// POST — save canvas state (sendBeacon compatibility for tab-close saves)
//   Accepts the same body as PATCH.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const d = db();

  try {
    const existing = d.prepare("SELECT id FROM radars WHERE id = ?").get(id);
    if (!existing) {
      d.close();
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Canvas not found", status: 404 } },
        { status: 404 }
      );
    }

    applyCanvasUpdate(d, id, body);

    const updated = d.prepare(
      "SELECT id, name, description, canvas_state, created_at, updated_at, archived_at FROM radars WHERE id = ?"
    ).get(id);
    d.close();
    return NextResponse.json({ canvas: updated });
  } catch (err) {
    d.close();
    console.error("POST /api/v1/canvas/[id] error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to save canvas", status: 500 } },
      { status: 500 }
    );
  }
}

// PATCH — save canvas state, rename, or archive/restore
//   Body can contain any subset of:
//   - canvasState: serialized canvas JSON (null to clear)
//   - name: string
//   - archived: boolean (true → archive now, false → restore from archive)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const d = db();

  try {
    const existing = d.prepare("SELECT id FROM radars WHERE id = ?").get(id);
    if (!existing) {
      d.close();
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Canvas not found", status: 404 } },
        { status: 404 }
      );
    }

    applyCanvasUpdate(d, id, body);

    const updated = d.prepare(
      "SELECT id, name, description, canvas_state, created_at, updated_at, archived_at FROM radars WHERE id = ?"
    ).get(id);
    d.close();
    return NextResponse.json({ canvas: updated });
  } catch (err) {
    d.close();
    console.error("PATCH /api/v1/canvas/[id] error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update canvas", status: 500 } },
      { status: 500 }
    );
  }
}

// DELETE — delete canvas project (cascades to project_queries and project_notes)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const d = db();

  try {
    const existing = d.prepare("SELECT id FROM radars WHERE id = ?").get(id);
    if (!existing) {
      d.close();
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Canvas not found", status: 404 } },
        { status: 404 }
      );
    }

    d.prepare("DELETE FROM radars WHERE id = ?").run(id);
    d.close();
    // API-18: DELETE with no body should return 204
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    d.close();
    console.error("DELETE /api/v1/canvas/[id] error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete canvas", status: 500 } },
      { status: 500 }
    );
  }
}
