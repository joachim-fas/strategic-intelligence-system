import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { checkRateLimit, tooManyRequests, validationError } from "@/lib/api-utils";
import { validateStringLength, validateEnum } from "@/lib/validation";

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
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }

  const body = await req.json().catch(() => ({}));
  const { queryHash, perspectiveId, rating } = body;

  // SEC-13: Input validation
  const qhCheck = validateStringLength(queryHash, "queryHash", 256, 1);
  if (!qhCheck.valid) return validationError(qhCheck.error);

  const pidCheck = validateStringLength(perspectiveId, "perspectiveId", 256, 1);
  if (!pidCheck.valid) return validationError(pidCheck.error);

  if (rating !== null) {
    const ratingCheck = validateEnum(rating, "rating", ["up", "down"] as const);
    if (!ratingCheck.valid) return validationError(ratingCheck.error);
  }

  // DAT-13: Ensure DB handle is always closed
  const d = db();
  try {
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
    return NextResponse.json({ ok: true });
  } finally {
    d.close();
  }
}

// GET — load ratings for a query
export async function GET(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const { searchParams } = new URL(req.url);
  const queryHash = searchParams.get("queryHash");
  if (!queryHash) return NextResponse.json({ ratings: [] });

  // DAT-13: Ensure DB handle is always closed
  const d = db();
  try {
    const rows = d.prepare("SELECT perspective_id, rating FROM bsc_ratings WHERE query_hash = ?")
      .all(queryHash) as { perspective_id: string; rating: string }[];

    const ratings: Record<string, string> = {};
    for (const row of rows) ratings[row.perspective_id] = row.rating;
    return NextResponse.json({ ratings });
  } finally {
    d.close();
  }
}
