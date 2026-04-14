import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { getEdgesForTrend } from "@/lib/causal-graph";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

/**
 * GET /api/v1/trends/[id] — Trend detail with connected signals, sources, causal edges
 */

function getDb() {
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  try {
    // ── Trend base data ──────────────────────────────────────────
    const trend = db.prepare(
      "SELECT * FROM trends WHERE id = ? OR slug = ?"
    ).get(id, id) as {
      id: string; slug: string; name: string; description: string | null;
      category: string; tags: string | null; status: string;
      agg_relevance: number | null; agg_confidence: number | null;
      agg_impact: number | null; time_horizon: string | null;
      metadata: string | null;
    } | undefined;

    if (!trend) {
      db.close();
      return apiError("Trend not found", 404, "NOT_FOUND");
    }

    const meta = trend.metadata ? JSON.parse(trend.metadata) : {};
    const tags = trend.tags ? JSON.parse(trend.tags) : [];

    // ── Connected signals (last 72h, top 20 by strength) ─────────
    const signals = db.prepare(`
      SELECT id, source, title, url, strength, signal_type, fetched_at, topic
      FROM live_signals
      WHERE (topic = ? OR topic LIKE ? OR topic LIKE ?)
        AND fetched_at > datetime('now', '-7 days')
        AND title IS NOT NULL AND title != ''
      ORDER BY COALESCE(strength, 0) DESC, fetched_at DESC
      LIMIT 20
    `).all(trend.slug, `%${trend.slug}%`, `%${trend.name.toLowerCase().replace(/\s+/g, "%")}%`) as Array<{
      id: string; source: string; title: string; url: string | null;
      strength: number | null; signal_type: string | null; fetched_at: string;
      topic: string | null;
    }>;

    const now = Date.now();
    const signalsWithAge = signals.map(s => ({
      ...s,
      strength: s.strength ?? 0,
      hoursAgo: Math.round((now - new Date(s.fetched_at).getTime()) / 3600000),
    }));

    // ── Top sources for this trend ───────────────────────────────
    const topSources = db.prepare(`
      SELECT source, COUNT(*) as signal_count, MAX(fetched_at) as last_signal_at
      FROM live_signals
      WHERE (topic = ? OR topic LIKE ?)
        AND fetched_at > datetime('now', '-7 days')
      GROUP BY source
      ORDER BY signal_count DESC
      LIMIT 10
    `).all(trend.slug, `%${trend.slug}%`) as Array<{
      source: string; signal_count: number; last_signal_at: string;
    }>;

    // ── Sparkline (signal count per day, last 7 days) ────────────
    const sparklineRows = db.prepare(`
      SELECT CAST(julianday('now') - julianday(fetched_at) AS INTEGER) as days_ago,
             COUNT(*) as cnt
      FROM live_signals
      WHERE (topic = ? OR topic LIKE ?)
        AND fetched_at > datetime('now', '-7 days')
      GROUP BY days_ago
    `).all(trend.slug, `%${trend.slug}%`) as Array<{ days_ago: number; cnt: number }>;

    const sparkline = [0, 0, 0, 0, 0, 0, 0];
    for (const r of sparklineRows) {
      if (r.days_ago >= 0 && r.days_ago <= 6) sparkline[6 - r.days_ago] = r.cnt;
    }

    // ── Causal edges (from static graph) ─────────────────────────
    const causalEdges = getEdgesForTrend(trend.id);

    // ── Related trends (via causal edges) ────────────────────────
    const relatedIds = new Set<string>();
    causalEdges.forEach(e => { relatedIds.add(e.from); relatedIds.add(e.to); });
    relatedIds.delete(trend.id);

    const relatedTrends = relatedIds.size > 0
      ? db.prepare(
          `SELECT id, name, slug, category, agg_relevance, metadata FROM trends WHERE id IN (${[...relatedIds].map(() => "?").join(",")})`
        ).all(...relatedIds) as Array<{ id: string; name: string; slug: string; category: string; agg_relevance: number | null; metadata: string | null }>
      : [];

    const relatedWithMeta = relatedTrends.map(t => {
      const m = t.metadata ? JSON.parse(t.metadata) : {};
      return { id: t.id, name: t.name, category: t.category, ring: m.ring ?? "assess", velocity: m.velocity ?? "stable" };
    });

    db.close();

    // ── Derive ring + velocity ───────────────────────────────────
    const rel = trend.agg_relevance ?? 0.5;
    const conf = trend.agg_confidence ?? 0.5;
    const imp = trend.agg_impact ?? 0.5;
    const ring = meta.ring ?? (((rel + conf) / 2) >= 0.85 ? "adopt" : ((rel + conf) / 2) >= 0.7 ? "trial" : ((rel + conf) / 2) >= 0.5 ? "assess" : "hold");

    // Velocity from sparkline
    const recent = sparkline.slice(4).reduce((a, b) => a + b, 0);
    const older = sparkline.slice(0, 4).reduce((a, b) => a + b, 0);
    const velocity = meta.velocity ?? (recent > (older / 4) * 1.2 * 3 ? "rising" : recent < (older / 4) * 0.8 * 3 ? "falling" : "stable");

    return apiSuccess({
      trend: {
        id: trend.id,
        slug: trend.slug,
        name: trend.name,
        description: trend.description ?? "",
        category: trend.category,
        tags,
        ring,
        velocity,
        relevance: rel,
        confidence: conf,
        impact: imp,
        sparkline,
        trendType: tags.includes("megatrend") || rel > 0.75 ? "megatrend" : "macrotrend",
      },
      signals: signalsWithAge,
      causalEdges: causalEdges.map(e => ({
        from: e.from,
        to: e.to,
        type: e.type,
        strength: e.strength,
        description: e.description ?? "",
      })),
      topSources,
      relatedTrends: relatedWithMeta,
    }, 200, CACHE_HEADERS.medium);
  } catch (err: unknown) {
    db.close();
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
