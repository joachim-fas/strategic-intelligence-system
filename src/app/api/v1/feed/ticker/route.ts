import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

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
  // Upper bound 200 so the LiveSignalStream's default `?limit=200`
  // actually gets that many signals. Lower bound 1 — an earlier
  // minimum-of-10 clamp was silently returning 10 rows when callers
  // asked for 5, which violates the contract. If the ticker needs a
  // floor for smooth scrolling, the client should set its own default.
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "60")));
  const hours = Math.max(6, Math.min(168, Number(url.searchParams.get("hours") ?? "48")));
  // NEW: max rows per source. This is the diversity knob. Default 10 — with
  // 27 active sources in the DB that caps each at 10, so 270 candidate rows
  // before the final hard limit trims to the requested `limit`. Before this
  // knob existed, Reddit (which ran last AND had many strength=1.0 items)
  // monopolized the ticker — polymarket (609 signals) and news (192) were
  // invisible under the Reddit wave.
  const perSource = Math.max(1, Math.min(50, Number(url.searchParams.get("perSource") ?? "10")));

  const db = getDb();
  const now = Date.now();

  try {
    // Per-source quota via ROW_NUMBER() window function + round-robin
    // outer ordering. Each source can contribute at most `perSource` rows.
    //
    // The critical piece is the OUTER ORDER BY — it's by `source_rank ASC`,
    // which interleaves sources: first the top-1 signal from every source
    // (ordered by strength across sources), then the top-2 signal from every
    // source, and so on. The effect: the user sees a diverse mix at the top
    // of the feed instead of 10 reddits, then 10 arxivs, then 10 npm-pypis.
    //
    // Without this interleave, the previous naïve `ORDER BY fetched_at DESC`
    // produced a Reddit-dominant feed because Reddit fetched last AND had
    // the most max-strength items, monopolizing the top positions.
    //
    // SQLite ≥ 3.25 supports window functions natively (we're on 3.51).
    const rows = db.prepare(`
      WITH ranked AS (
        SELECT id, source, title, url, strength, topic, signal_type, fetched_at,
               ROW_NUMBER() OVER (
                 PARTITION BY source
                 ORDER BY COALESCE(strength, 0) DESC, fetched_at DESC
               ) AS source_rank
        FROM live_signals
        WHERE fetched_at > datetime('now', ?)
          AND title IS NOT NULL AND title != ''
      )
      SELECT id, source, title, url, strength, topic, signal_type, fetched_at
      FROM ranked
      WHERE source_rank <= ?
      ORDER BY source_rank ASC,
               COALESCE(strength, 0) DESC,
               fetched_at DESC
      LIMIT ?
    `).all(`-${hours} hours`, perSource, limit) as Array<{
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

    return apiSuccess({
      signals,
      meta: {
        count: signals.length,
        windowHours: hours,
        timestamp: new Date().toISOString(),
      },
    }, 200, CACHE_HEADERS.short);
  } catch (err: unknown) {
    db.close();
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/feed/ticker]", msg);
    return apiError(msg, 500);
  }
}
