/**
 * GET  /api/v1/canvas — list all canvas projects
 * POST /api/v1/canvas — create a new canvas project
 *
 * Canvas projects reuse the existing `radars` table.
 * Canvas state (nodes, connections, pan, zoom) is stored in the `canvas_state` column.
 */

import Database from "better-sqlite3";
import path from "path";
import { apiSuccess, CACHE_HEADERS } from "@/lib/api-helpers";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  // Idempotent schema upgrades
  try { d.exec("ALTER TABLE radars ADD COLUMN canvas_state TEXT"); } catch {}
  try { d.exec("ALTER TABLE radars ADD COLUMN archived_at TEXT"); } catch {}
  return d;
}

// GET — list canvas projects
//   /api/v1/canvas                 → active only (archived_at IS NULL)
//   /api/v1/canvas?archived=true   → archived only (archived_at IS NOT NULL)
//   /api/v1/canvas?archived=all    → everything
export async function GET(req: Request) {
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived"); // null | "true" | "all"

  let where = "WHERE archived_at IS NULL";
  if (archived === "true") where = "WHERE archived_at IS NOT NULL";
  else if (archived === "all") where = "";

  const d = db();
  const rows = d.prepare(`
    SELECT id, name, description, canvas_state, created_at, updated_at, archived_at
    FROM radars
    ${where}
    ORDER BY
      CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
      COALESCE(archived_at, updated_at) DESC
  `).all() as Array<{
    id: string; name: string; description: string | null;
    canvas_state: string | null; created_at: string; updated_at: string;
    archived_at: string | null;
  }>;
  d.close();

  // Return lightweight list (with node count for session picker UX)
  const canvases = rows.map(r => {
    let nodeCount = 0;
    let queryCount = 0;
    if (r.canvas_state) {
      try {
        const state = JSON.parse(r.canvas_state);
        if (Array.isArray(state?.nodes)) {
          nodeCount = state.nodes.length;
          queryCount = state.nodes.filter((n: any) => n.nodeType === "query").length;
        }
      } catch {}
    }
    // cardCount = everything that isn't a query root. This is what the Canvas
    // toolbar shows ("6 Abfragen · 59 Karten") and what the user thinks of as
    // "cards". Surfacing it from the API keeps Home / SessionBar / Canvas in
    // sync with one source of truth instead of each view re-deriving it.
    const cardCount = Math.max(0, nodeCount - queryCount);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      hasState: !!r.canvas_state,
      nodeCount,
      queryCount,
      cardCount,
      created_at: r.created_at,
      updated_at: r.updated_at,
      archived_at: r.archived_at,
    };
  });

  return apiSuccess({ canvases }, 200, CACHE_HEADERS.short);
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
  return apiSuccess({ canvas }, 201);
}
