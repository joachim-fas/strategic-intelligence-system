import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { connectors } from "@/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbPath = path.join(process.cwd(), "local.db");
  let stats: Record<string, { count: number; lastFetch: string | null; newestHours: number | null }> = {};

  try {
    const db = new Database(dbPath, { readonly: true });
    db.pragma("journal_mode = WAL");

    const rows = db.prepare(`
      SELECT
        source,
        COUNT(*) as count,
        MAX(fetched_at) as last_fetch,
        ROUND((julianday('now') - julianday(MAX(fetched_at))) * 24, 1) as newest_hours
      FROM live_signals
      WHERE fetched_at > datetime('now', '-72 hours')
      GROUP BY source
    `).all() as { source: string; count: number; last_fetch: string; newest_hours: number }[];

    db.close();

    for (const row of rows) {
      stats[row.source] = {
        count: row.count,
        lastFetch: row.last_fetch,
        newestHours: row.newest_hours,
      };
    }
  } catch {
    // DB not ready yet
  }

  // Merge with connector list so all connectors appear even if no signals
  const result = connectors.map((c) => ({
    name: c.name,
    displayName: c.displayName,
    signalCount: stats[c.name]?.count ?? 0,
    lastFetch: stats[c.name]?.lastFetch ?? null,
    newestHours: stats[c.name]?.newestHours ?? null,
    status: getStatus(stats[c.name]?.newestHours ?? null, stats[c.name]?.count ?? 0),
  }));

  const totalSignals = result.reduce((s, c) => s + c.signalCount, 0);
  const healthy = result.filter((c) => c.status === "ok").length;
  const stale = result.filter((c) => c.status === "stale").length;
  const inactive = result.filter((c) => c.status === "inactive").length;

  return NextResponse.json({ connectors: result, totalSignals, healthy, stale, inactive });
}

function getStatus(newestHours: number | null, count: number): "ok" | "stale" | "inactive" {
  if (count === 0 || newestHours === null) return "inactive";
  if (newestHours > 12) return "stale";
  return "ok";
}
