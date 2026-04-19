/**
 * GET /api/v1/monitor — System activity & health dashboard data
 *
 * Returns real-time system metrics: signal stats, connector health,
 * pipeline status, recent activity log. Used by the /monitor page.
 *
 * No auth required — this is diagnostic data, no secrets exposed.
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { statSync } from "fs";
import { connectors } from "@/connectors";
import { getSignalAge } from "@/lib/signals";
import { megaTrends } from "@/lib/mega-trends";
import { TREND_EDGES } from "@/lib/causal-graph";
import { GLOBAL_REGULATIONS } from "@/lib/regulations";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"), { readonly: true });
  d.pragma("journal_mode = WAL");
  return d;
}

export async function GET() {
  try {
    const d = db();

    // ── Signal statistics ──────────────────────────────────────────
    const signalAge = getSignalAge();

    const signalsBySourceRaw = d.prepare(`
      SELECT source, COUNT(*) as count,
        MAX(fetched_at) as latest,
        ROUND(AVG(strength), 2) as avg_strength
      FROM live_signals
      WHERE fetched_at > datetime('now', '-336 hours')
      GROUP BY source
      ORDER BY count DESC
    `).all() as Array<{ source: string; count: number; latest: string; avg_strength: number }>;

    // Welle B Item 3 — attach per-source Welford anomaly tier for
    // the last pipeline run. `signal_count` baseline is keyed by
    // (metric, source, weekday, month); we look up today's weekday
    // + month and read the existing baseline. Everything happens on
    // the read-only handle so no schema writes leak from GET.
    const now = new Date();
    const wd = now.getDay();
    const mn = now.getMonth() + 1;
    const signalsBySource = signalsBySourceRaw.map((row) => {
      try {
        const key = `signal_count:${row.source}:${wd}:${mn}`;
        const bl = d.prepare(
          "SELECT n, mean, m2 FROM baseline_stats WHERE key = ?",
        ).get(key) as { n: number; mean: number; m2: number } | undefined;
        // We need the LAST value the pipeline wrote to compute a
        // z-score — which is what the baseline itself last ingested.
        // Reconstructing "latest sample" from Welford state isn't
        // exact; we use the current 14-day count as a proxy. That's
        // fine for a monitor tile — we want "is current volume
        // unusual for this weekday/month?" and the 336h-window
        // count is the closest honest approximation on the read
        // side without adding a separate table.
        if (!bl || bl.n < 10) {
          return { ...row, anomaly: { tier: null as string | null, z: null as number | null, n: bl?.n ?? 0 } };
        }
        const variance = bl.m2 / bl.n;
        const stddev = Math.sqrt(variance);
        if (stddev === 0) {
          return { ...row, anomaly: { tier: null, z: null, n: bl.n } };
        }
        const z = (row.count - bl.mean) / stddev;
        const abs = Math.abs(z);
        const tier =
          abs >= 3.0 ? "high"
          : abs >= 2.0 ? "medium"
          : abs >= 1.5 ? "low"
          : null;
        return { ...row, anomaly: { tier, z: Number(z.toFixed(2)), n: bl.n } };
      } catch {
        return { ...row, anomaly: { tier: null, z: null, n: 0 } };
      }
    });

    const signalTimeline = d.prepare(`
      SELECT
        date(fetched_at) as day,
        COUNT(*) as count
      FROM live_signals
      WHERE fetched_at > datetime('now', '-14 days')
      GROUP BY date(fetched_at)
      ORDER BY day DESC
      LIMIT 14
    `).all() as any[];

    // ── Trend statistics ───────────────────────────────────────────
    let trendCount: any = null;
    let trendsByCategory: any[] = [];
    try {
      trendCount = d.prepare(
        "SELECT COUNT(*) as count FROM trends WHERE status != 'archived'"
      ).get() as any;
      trendsByCategory = d.prepare(`
        SELECT category, COUNT(*) as count
        FROM trends WHERE status != 'archived'
        GROUP BY category ORDER BY count DESC
      `).all() as any[];
    } catch { /* trends table may not exist yet */ }

    // ── DB size ────────────────────────────────────────────────────
    let dbSizeKB = 0;
    try {
      const stats = statSync(path.join(process.cwd(), "local.db"));
      dbSizeKB = Math.round(stats.size / 1024);
    } catch { /* ignore */ }

    // ── Recent queries (from canvas query nodes) ───────────────────
    let recentQueries: any[] = [];
    try {
      recentQueries = d.prepare(`
        SELECT
          cs.id as canvas_id,
          json_extract(n.value, '$.data.query') as query,
          json_extract(n.value, '$.data.timestamp') as timestamp,
          json_extract(n.value, '$.type') as node_type
        FROM canvas_state cs,
          json_each(cs.nodes) n
        WHERE json_extract(n.value, '$.type') = 'QUERY'
          AND json_extract(n.value, '$.data.query') IS NOT NULL
        ORDER BY json_extract(n.value, '$.data.timestamp') DESC
        LIMIT 20
      `).all() as any[];
    } catch { /* canvas_state table may not exist yet */ }

    d.close();

    // ── Connector registry ─────────────────────────────────────────
    const connectorInfo = connectors.map((c) => ({
      name: c.name,
      displayName: c.displayName,
    }));

    // ── Static knowledge base stats ────────────────────────────────
    const knowledgeBase = {
      megaTrends: megaTrends.length,
      causalEdges: TREND_EDGES.length,
      regulations: GLOBAL_REGULATIONS.length,
      connectors: connectors.length,
    };

    // ── Pipeline status (try to fetch from pipeline endpoint) ──────
    let pipelineStatus = null;
    try {
      const base = process.env.NEXTAUTH_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        ?? "http://localhost:3001";
      const res = await fetch(`${base}/api/v1/pipeline`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        pipelineStatus = await res.json();
      }
    } catch { /* pipeline not run yet */ }

    return apiSuccess({
      timestamp: new Date().toISOString(),
      signals: {
        total: signalAge.count,
        oldestHours: signalAge.oldestHours,
        newestHours: signalAge.newestHours,
        bySource: signalsBySource,
        timeline: signalTimeline,
      },
      trends: {
        total: trendCount?.count ?? megaTrends.length,
        byCategory: trendsByCategory,
      },
      knowledgeBase,
      connectors: connectorInfo,
      pipeline: pipelineStatus,
      recentQueries: recentQueries.map((q: any) => ({
        query: q.query,
        timestamp: q.timestamp,
        canvasId: q.canvas_id,
      })),
      system: {
        dbSizeKB,
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
      },
    }, 200, CACHE_HEADERS.short);
  } catch (err) {
    console.error("[monitor] Error:", err);
    return apiError("Monitor data unavailable", 500);
  }
}
