import Database from "better-sqlite3";
import path from "path";
import { ensureEnvLoaded } from "@/lib/env";
import { connectors } from "@/connectors";
import { apiSuccess, CACHE_HEADERS } from "@/lib/api-helpers";
import { getConnectorConfigStatus } from "@/lib/connector-config";
import { FRESHNESS_THRESHOLDS } from "@/lib/freshness";

ensureEnvLoaded();

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

  // Merge with connector list so all connectors appear even if no signals.
  // Zusaetzlich wird pro Connector geprueft, ob seine ENV-Key-Abhaengigkeiten
  // erfuellt sind — damit der Monitor sagen kann "inaktiv weil Key fehlt",
  // statt "einfach nur stumm".
  const result = connectors.map((c) => {
    const configStatus = getConnectorConfigStatus(c.name);
    return {
      name: c.name,
      displayName: c.displayName,
      signalCount: stats[c.name]?.count ?? 0,
      lastFetch: stats[c.name]?.lastFetch ?? null,
      newestHours: stats[c.name]?.newestHours ?? null,
      status: getStatus(stats[c.name]?.newestHours ?? null, stats[c.name]?.count ?? 0),
      config: {
        status: configStatus.status,
        missing: configStatus.missing,
        registerUrl: configStatus.config?.registerUrl ?? null,
        note: configStatus.config?.note ?? null,
      },
    };
  });

  const totalSignals = result.reduce((s, c) => s + c.signalCount, 0);
  const healthy = result.filter((c) => c.status === "ok").length;
  const stale = result.filter((c) => c.status === "stale").length;
  const inactive = result.filter((c) => c.status === "inactive").length;
  const needsKey = result.filter((c) => c.config.status === "missing-required").length;

  return apiSuccess({ connectors: result, totalSignals, healthy, stale, inactive, needsKey }, 200, CACHE_HEADERS.short);
}

// Audit A3-M2 (18.04.2026): shared FRESHNESS_THRESHOLDS constant so
// the Cockpit, ActivityPanel, and this endpoint agree. Previously
// this file used 12h as the stale cutoff while the Cockpit used 24h
// and the ActivityPanel used 24h — a connector could be green in
// one surface and orange in another.
function getStatus(newestHours: number | null, count: number): "ok" | "stale" | "inactive" {
  if (count === 0 || newestHours === null) return "inactive";
  if (newestHours > FRESHNESS_THRESHOLDS.WARN_HOURS) return "stale";
  return "ok";
}
