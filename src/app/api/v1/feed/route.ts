import Database from "better-sqlite3";
import path from "path";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";
import {
  buildTrendIndex,
  matchesTrend,
  signalKeys,
} from "@/lib/trend-signal-match";

/**
 * GET /api/v1/feed — Signal-Radar Feed
 *
 * Returns 3 sections:
 * 1. topSignals: strongest real signals from last 72h
 * 2. trends: all mega/macro trends with signal counts + sparkline
 * 3. sourceStatus: connector freshness overview
 */

function getDb() {
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET() {
  const db = getDb();
  const now = Date.now();

  try {
    // ── 1. Top Signals (strongest in last 72h) ──────────────────────────
    const topSignals = db.prepare(`
      SELECT id, source, title, url, strength, topic, signal_type, fetched_at
      FROM live_signals
      WHERE fetched_at > datetime('now', '-72 hours')
        AND title IS NOT NULL AND title != ''
      ORDER BY COALESCE(strength, 0) DESC, fetched_at DESC
      LIMIT 10
    `).all() as Array<{
      id: string; source: string; title: string; url: string | null;
      strength: number | null; topic: string | null; signal_type: string | null;
      fetched_at: string;
    }>;

    const topSignalsWithAge = topSignals.map(s => ({
      ...s,
      strength: s.strength ?? 0,
      signal_type: s.signal_type ?? "mention",
      hoursAgo: Math.round((now - new Date(s.fetched_at).getTime()) / 3600000),
    }));

    // ── 2. Trends with signal counts + sparkline ────────────────────────
    interface TrendRow {
      id: string; slug: string; name: string; description: string | null;
      category: string; tags: string | null; status: string;
      agg_relevance: number | null; agg_confidence: number | null;
      agg_impact: number | null; time_horizon: string | null;
      metadata: string | null;
    }

    const trendRows = db.prepare(`
      SELECT * FROM trends WHERE status != 'archived'
    `).all() as TrendRow[];

    // ── Fuzzy trend ↔ live_signals matching ─────────────────────────────
    // The old logic grouped live_signals by `topic` string and looked it up
    // by trend slug / id / name. That missed every connector that emits
    // tag-based topics (github "Rust", hackernews "AI", clinicaltrials
    // "Health, Biotech & Longevity" → matches only the "mega-health-biotech"
    // slug by name but NOT the pipeline-created duplicates). Now we scan
    // all signals in the 7-day window once and fan them out over a shared
    // trend index keyed on slug / id / name + tag intersection + name-token
    // substring. See src/lib/trend-signal-match.ts.
    interface RawSig {
      topic: string | null;
      tags: string | null;
      title: string | null;
      strength: number | null;
      days_ago: number;
    }
    const sigRows = db.prepare(`
      SELECT topic, tags, title, strength,
        CAST(julianday('now') - julianday(fetched_at) AS INTEGER) as days_ago
      FROM live_signals
      WHERE fetched_at > datetime('now', '-7 days')
    `).all() as RawSig[];

    const trendLikes = trendRows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
    }));
    const trendIndex = buildTrendIndex(trendLikes);

    // Map keyed by trend.id → { count72h, sumStr72h, sparkline[7] }
    const perTrend = new Map<string, { count: number; sumStr: number; spark: number[] }>();
    for (const t of trendRows) perTrend.set(t.id, { count: 0, sumStr: 0, spark: [0, 0, 0, 0, 0, 0, 0] });

    for (const sig of sigRows) {
      const sKeys = signalKeys(sig);
      const titleLower = sig.title ? sig.title.toLowerCase() : null;
      for (const tIdx of trendIndex) {
        if (!matchesTrend(tIdx, sKeys, titleLower)) continue;
        const slot = perTrend.get(tIdx.id)!;
        // 72h window feeds both the count and avg strength
        if (sig.days_ago <= 3) {
          slot.count += 1;
          slot.sumStr += sig.strength ?? 0;
        }
        // 7-day sparkline
        if (sig.days_ago >= 0 && sig.days_ago <= 6) {
          slot.spark[6 - sig.days_ago] += 1;
        }
      }
    }

    function deriveRing(rel: number, conf: number): string {
      const s = (rel + conf) / 2;
      if (s >= 0.85) return "adopt";
      if (s >= 0.7) return "trial";
      if (s >= 0.5) return "assess";
      return "hold";
    }

    function deriveVelocity(sparkline: number[]): "rising" | "stable" | "falling" {
      if (sparkline.every(v => v === 0)) return "stable";
      const recent = sparkline.slice(4).reduce((a, b) => a + b, 0); // last 3 days
      const older = sparkline.slice(0, 4).reduce((a, b) => a + b, 0);  // first 4 days
      const olderAvg = older / 4 || 0.1;
      const recentAvg = recent / 3 || 0;
      if (recentAvg > olderAvg * 1.2) return "rising";
      if (recentAvg < olderAvg * 0.8) return "falling";
      return "stable";
    }

    const trends = trendRows.map(t => {
      const meta = t.metadata ? JSON.parse(t.metadata) : {};
      const tags = t.tags ? JSON.parse(t.tags) : [];
      const rel = t.agg_relevance ?? 0.5;
      const conf = t.agg_confidence ?? 0.5;
      const imp = t.agg_impact ?? 0.5;
      const slot = perTrend.get(t.id) ?? { count: 0, sumStr: 0, spark: [0, 0, 0, 0, 0, 0, 0] };
      const count72h = slot.count;
      const avgStr = count72h > 0 ? slot.sumStr / count72h : 0;
      const spark = slot.spark;
      const vel = meta.velocity ?? deriveVelocity(spark);

      // Derive trend type from tags or name heuristic
      const isMega = tags.includes("megatrend") || t.name.toLowerCase().includes("mega") || rel > 0.75;

      return {
        id: t.id,
        name: t.name,
        description: t.description ?? "",
        category: t.category,
        trendType: isMega ? "megatrend" : "macrotrend",
        ring: meta.ring ?? deriveRing(rel, conf),
        velocity: vel as "rising" | "stable" | "falling",
        relevance: rel,
        confidence: conf,
        impact: imp,
        signalCount72h: count72h,
        avgStrength: avgStr,
        sparkline: spark,
        tags,
      };
    }).sort((a, b) => {
      // Sort by combined relevance + velocity signal
      const velBoost = (v: string) => v === "rising" ? 0.15 : v === "falling" ? -0.1 : 0;
      return (b.relevance + velBoost(b.velocity)) - (a.relevance + velBoost(a.velocity));
    });

    // ── 3. Source status ────────────────────────────────────────────────
    const sourceRows = db.prepare(`
      SELECT source,
        MAX(fetched_at) as last_signal_at,
        COUNT(*) as signal_count
      FROM live_signals
      GROUP BY source
    `).all() as Array<{ source: string; last_signal_at: string | null; signal_count: number }>;

    const sourceStatus = sourceRows.map(r => {
      const lastAt = r.last_signal_at ? new Date(r.last_signal_at).getTime() : 0;
      const hoursAgo = lastAt ? (now - lastAt) / 3600000 : Infinity;
      return {
        source: r.source,
        lastSignalAt: r.last_signal_at,
        signalCount: r.signal_count,
        status: (hoursAgo < 24 ? "fresh" : hoursAgo < 72 ? "stale" : "empty") as "fresh" | "stale" | "empty",
      };
    }).sort((a, b) => b.signalCount - a.signalCount);

    // ── Meta ────────────────────────────────────────────────────────────
    const totalRow = db.prepare("SELECT COUNT(*) as total FROM live_signals").get() as { total: number };
    const freshRow = db.prepare("SELECT COUNT(*) as fresh FROM live_signals WHERE fetched_at > datetime('now', '-72 hours')").get() as { fresh: number };

    db.close();

    return apiSuccess({
      topSignals: topSignalsWithAge,
      trends,
      sourceStatus,
      meta: {
        totalSignals: totalRow.total,
        freshSignals: freshRow.fresh,
        timestamp: new Date().toISOString(),
      },
    }, 200, CACHE_HEADERS.short);
  } catch (err: unknown) {
    db.close();
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/feed]", msg);
    return apiError(msg, 500);
  }
}
