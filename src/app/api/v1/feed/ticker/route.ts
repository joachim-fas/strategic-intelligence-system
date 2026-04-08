import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

/**
 * GET /api/v1/feed/ticker — Live-Signal Ticker Feed
 *
 * Returns a wider, curated list of recent live signals for the continuous
 * marquee ticker at the bottom of the home page. Unlike /api/v1/feed (which
 * returns the 10 strongest signals for the Signal-Radar dashboard), this
 * endpoint is tuned for breadth: more sources, more variety, longer scroll.
 */

function getDb() {
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(10, Math.min(100, Number(url.searchParams.get("limit") ?? "60")));
  const hours = Math.max(6, Math.min(168, Number(url.searchParams.get("hours") ?? "48")));

  const db = getDb();
  const now = Date.now();

  try {
    // Mix of strongest AND most recent signals — gives the ticker a healthy
    // blend of "breaking" and "hot" entries instead of just the top-10
    // re-scored bucket.
    const rows = db.prepare(`
      SELECT id, source, title, url, strength, topic, signal_type, fetched_at
      FROM live_signals
      WHERE fetched_at > datetime('now', ?)
        AND title IS NOT NULL AND title != ''
      ORDER BY fetched_at DESC, COALESCE(strength, 0) DESC
      LIMIT ?
    `).all(`-${hours} hours`, limit) as Array<{
      id: string; source: string; title: string; url: string | null;
      strength: number | null; topic: string | null; signal_type: string | null;
      fetched_at: string;
    }>;

    const signals = rows.map(s => ({
      id: s.id,
      source: s.source,
      title: s.title,
      url: s.url,
      topic: s.topic,
      strength: s.strength ?? 0,
      hoursAgo: Math.max(0, Math.round((now - new Date(s.fetched_at).getTime()) / 3600000)),
    }));

    db.close();

    return NextResponse.json({
      signals,
      meta: {
        count: signals.length,
        windowHours: hours,
        timestamp: new Date().toISOString(),
      },
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (err: unknown) {
    db.close();
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/feed/ticker]", msg);
    return NextResponse.json({ signals: [], meta: { count: 0, windowHours: hours, error: msg } }, { status: 500 });
  }
}
