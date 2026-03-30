import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  // Ensure table exists (idempotent)
  d.exec(`CREATE TABLE IF NOT EXISTS bsc_ratings (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL,
    perspective_id TEXT NOT NULL,
    rating TEXT NOT NULL CHECK(rating IN ('up', 'down')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(query_hash, perspective_id)
  )`);
  return d;
}

// POST — upsert a rating
export async function POST(req: Request) {
  const { queryHash, perspectiveId, rating } = await req.json();
  if (!queryHash || !perspectiveId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const d = db();
  if (rating === null) {
    d.prepare("DELETE FROM bsc_ratings WHERE query_hash = ? AND perspective_id = ?")
      .run(queryHash, perspectiveId);
  } else {
    d.prepare(`
      INSERT INTO bsc_ratings (id, query_hash, perspective_id, rating)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?)
      ON CONFLICT(query_hash, perspective_id) DO UPDATE SET rating = excluded.rating
    `).run(queryHash, perspectiveId, rating);
  }
  d.close();
  return NextResponse.json({ ok: true });
}

// GET — load ratings for a query
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const queryHash = searchParams.get("queryHash");
  if (!queryHash) return NextResponse.json({ ratings: [] });

  const d = db();
  const rows = d.prepare("SELECT perspective_id, rating FROM bsc_ratings WHERE query_hash = ?")
    .all(queryHash) as { perspective_id: string; rating: string }[];
  d.close();

  const ratings: Record<string, string> = {};
  for (const row of rows) ratings[row.perspective_id] = row.rating;
  return NextResponse.json({ ratings });
}
