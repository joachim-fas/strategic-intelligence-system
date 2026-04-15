// TODO: DAT-15 — This route reads exclusively from SQLite via better-sqlite3.
// PG writes via Drizzle in pipeline.ts create orphaned data never read by any API.
// FIX: Use a unified DB access layer (Drizzle for both, or a getDb() wrapper).

import Database from "better-sqlite3";
import path from "path";
import { calculateRing } from "@/lib/scoring";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";
import {
  buildTrendIndex,
  matchesTrend,
  signalKeys,
} from "@/lib/trend-signal-match";

interface DbTrend {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  tags: string | null;
  status: string;
  agg_relevance: number | null;
  agg_confidence: number | null;
  agg_impact: number | null;
  time_horizon: string | null;
  metadata: string | null;
}

function getLocalDb() {
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }

  try {
    const db = getLocalDb();
    const rows = db.prepare("SELECT * FROM trends WHERE status != 'archived'").all() as DbTrend[];

    // ── Live-signal signalCount (fuzzy match) ────────────────────────────
    // Previously we served `meta.signalCount` straight from trends.metadata
    // which meant:
    //   1. Pipeline-created trends had `signalCount: 0` in their metadata
    //      (nothing ever updates it), so the UI showed "0 sig." everywhere.
    //   2. Curated megaTrends kept their static seed value (500, 400, …)
    //      regardless of the real signal flow.
    //
    // Now we compute a live count by scanning live_signals and matching
    // each signal against the trend index (slug / id / name / tags +
    // name-token substring on the title). `signalCount` is the 14-day
    // active window (matches the default pruneOldSignals window), while
    // `signalCount72h` mirrors the feed route's notion of "fresh".
    interface RawSig {
      topic: string | null;
      tags: string | null;
      title: string | null;
      days_ago: number;
    }
    const sigRows = db.prepare(`
      SELECT topic, tags, title,
        CAST(julianday('now') - julianday(fetched_at) AS INTEGER) as days_ago
      FROM live_signals
      WHERE fetched_at > datetime('now', '-14 days')
    `).all() as RawSig[];

    db.close();

    // Pre-parse trends for the matcher
    const trendLikes = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
    }));
    const index = buildTrendIndex(trendLikes);

    // Count per trend id.
    const countAll = new Map<string, number>();
    const count72h = new Map<string, number>();
    for (const sig of sigRows) {
      const sKeys = signalKeys(sig);
      const titleLower = sig.title ? sig.title.toLowerCase() : null;
      for (const tIdx of index) {
        if (matchesTrend(tIdx, sKeys, titleLower)) {
          countAll.set(tIdx.id, (countAll.get(tIdx.id) ?? 0) + 1);
          if (sig.days_ago <= 3) {
            count72h.set(tIdx.id, (count72h.get(tIdx.id) ?? 0) + 1);
          }
        }
      }
    }

    const shaped = rows.map((row) => {
      const tags = row.tags ? JSON.parse(row.tags) : [];
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      const liveCount = countAll.get(row.id) ?? 0;
      const liveCount72h = count72h.get(row.id) ?? 0;

      // Prefer the live count. Fall back to any legacy metadata.signalCount
      // only if the live store has literally zero signals for this trend —
      // that way curated megatrends still render their seed value while the
      // pipeline is bootstrapping.
      const signalCount = liveCount > 0
        ? liveCount
        : (typeof meta.signalCount === "number" ? meta.signalCount : 0);

      return {
        id: row.id,
        name: row.name,
        description: row.description || "",
        category: row.category,
        tags,
        relevance: row.agg_relevance ?? 0.5,
        confidence: row.agg_confidence ?? 0.5,
        impact: row.agg_impact ?? 0.5,
        timeHorizon: row.time_horizon || "mid",
        ring: meta.ring || calculateRing(((row.agg_relevance ?? 0.5) + (row.agg_confidence ?? 0.5)) / 2),
        quadrant: meta.quadrant ?? 0,
        signalCount,
        signalCount72h: liveCount72h,
        topSources: meta.topSources ?? [],
        velocity: meta.velocity || "stable",
        userOverride: false,
      };
    });

    // Deduplicate by lowercased name — the DB currently contains ~31 cases
    // where the pipeline's upsert-by-slug created a second stub row (empty
    // metadata, different casing) alongside the curated mega/macro seed.
    // The client's `new Map([[name, t], …])` pattern silently let the
    // last-seen row overwrite the populated one, so the UI showed "0 sig.".
    // We keep whichever row has the richer data: live signalCount wins,
    // description length breaks ties.
    const byName = new Map<string, typeof shaped[number]>();
    for (const t of shaped) {
      const key = t.name.toLowerCase();
      const prior = byName.get(key);
      if (!prior) {
        byName.set(key, t);
        continue;
      }
      const priorScore = (prior.signalCount || 0) * 1000 + (prior.description?.length ?? 0);
      const curScore = (t.signalCount || 0) * 1000 + (t.description?.length ?? 0);
      if (curScore > priorScore) byName.set(key, t);
    }
    const trends = Array.from(byName.values());

    return apiSuccess({ trends, source: "sqlite", count: trends.length }, 200, CACHE_HEADERS.medium);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to read trends from DB:", message);
    return apiError(message, 500, "DB_ERROR");
  }
}

// ALG-06: Local deriveRing removed — now uses shared calculateRing() from scoring.ts
// to ensure consistent ring thresholds across the entire application.
