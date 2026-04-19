/**
 * Data Pipeline — orchestrates the signal collection and scoring cycle.
 *
 * 1. Runs all connectors (with concurrency-limited parallelism)
 * 2. Deduplicates signals
 * 3. Matches signals to existing trends or creates new ones
 * 4. Stores signals in trend_signals table
 * 5. Recomputes aggregate scores on the trends table
 * 6. Writes daily snapshots to score_log
 *
 * Designed for resilience: one connector failure does not abort the pipeline.
 */

// TODO: DAT-03 — DUAL STORAGE CONSOLIDATION
// Currently there are 3 independent signal storage paths:
// 1. pipeline/route.ts: fetches connectors → stores in-memory (lastFetchResult)
// 2. pipeline.ts: fetches connectors → stores in trend_signals (SQLite) + trend_signals (PG via Drizzle)
// 3. signals/route.ts: fetches connectors → returns directly without storage
// This causes: triple API calls, inconsistent data between paths, inflated scores.
// FIX: Consolidate into a single pipeline path that:
// - Fetches each connector once
// - Deduplicates signals
// - Stores in ONE canonical table
// - Returns from that table for all consumers

import { connectors, type RawSignal } from "@/connectors";
import { groupSignalsByTopic, scoreTrend } from "@/lib/scoring";
import { megaTrends } from "@/lib/mega-trends";
import { sanitizeConnectorResponse } from "@/lib/api-utils";
import { storeSignals, pruneOldSignals } from "@/lib/signals";
import { updateBaseline, baselineKeyForDate } from "@/lib/baseline";
import {
  createClusterSnapshot,
  clusterSlug,
  getClusterHistory,
  generateClusterDiff,
  generateClusterForesight,
  buildSimpleSummary,
} from "@/lib/cluster-snapshots";
import { eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineResult {
  success: boolean;
  skipped?: boolean;
  signalCount: number;
  trendCount: number;
  sources: string[];
  errors: Array<{ source: string; error: string }>;
  durationMs: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// In-memory mutex — prevents concurrent pipeline runs
// ---------------------------------------------------------------------------
let pipelineRunning = false;

// ---------------------------------------------------------------------------
// Concurrency-limited task runner
// ---------------------------------------------------------------------------
const CONCURRENCY_LIMIT = 10;

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    // Wrap each task so it (a) always settles, (b) removes itself from the
    // in-flight set exactly when it completes — not when Promise.race happens
    // to fire. The old version called `executing.findIndex((e) => e === p)`
    // right after racing and spliced the JUST-ADDED promise, orphaning the
    // one that actually finished and causing long-running connectors (GDELT
    // with its 3 s rate-limit backoff) to be dropped from results because
    // the outer function returned before they pushed.
    let self: Promise<void>;
    self = task().then(
      (value) => {
        results.push({ status: "fulfilled", value });
        executing.delete(self);
      },
      (reason) => {
        results.push({ status: "rejected", reason });
        executing.delete(self);
      },
    );
    executing.add(self);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// ---------------------------------------------------------------------------
// Signal deduplication
// ---------------------------------------------------------------------------

function deduplicateSignals(signals: RawSignal[]): RawSignal[] {
  const seen = new Map<string, RawSignal>();
  for (const signal of signals) {
    // Prefer dedup by URL when available, otherwise by (source, title, date)
    const key = signal.sourceUrl
      ? `url:${signal.sourceUrl}`
      : `composite:${signal.sourceType}|${signal.sourceTitle}|${signal.detectedAt.toISOString().slice(0, 10)}`;
    // Keep the most recent version of each duplicate
    const existing = seen.get(key);
    if (!existing || signal.detectedAt > existing.detectedAt) {
      seen.set(key, signal);
    }
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(): Promise<PipelineResult> {
  // Prevent concurrent runs
  if (pipelineRunning) {
    return {
      success: true,
      skipped: true,
      signalCount: 0,
      trendCount: 0,
      sources: [],
      errors: [],
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }
  pipelineRunning = true;

  const start = Date.now();
  const allSignals: RawSignal[] = [];
  const errors: Array<{ source: string; error: string }> = [];
  const activeSources: string[] = [];

  try {
    // Phase 1: Collect signals from all connectors with concurrency limit
    const tasks = connectors.map((connector) => () =>
      connector.fetchSignals().then((signals) => ({
        name: connector.name,
        signals,
      })),
    );

    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);

    // Collect per-connector signals so we can write them to live_signals
    // grouped by source — this is what the Knowledge Cockpit reads.
    const signalsByConnector = new Map<string, RawSignal[]>();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const connectorName = connectors[i].name;
      if (result.status === "fulfilled") {
        allSignals.push(...result.value.signals);
        activeSources.push(result.value.name);
        signalsByConnector.set(result.value.name, result.value.signals);
        console.log(
          `[pipeline] ${result.value.name}: ${result.value.signals.length} signals`,
        );
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push({ source: connectorName, error: message });
        console.error(`[pipeline] ${connectorName} FAILED: ${message}`);
      }
    }

    // Phase 1b: Deduplicate signals
    const dedupedSignals = deduplicateSignals(allSignals);
    console.log(
      `[pipeline] Deduplication: ${allSignals.length} → ${dedupedSignals.length} signals`,
    );

    // Phase 1c: Sanitize all signals (SEC-19)
    const sanitizedSignals = dedupedSignals.map((s) => sanitizeConnectorResponse(s));

    // Phase 2a: Persist into live_signals — this is the live RAG store
    // that /api/v1/feed, /api/v1/feed/ticker, /api/v1/sources/status and
    // the Knowledge Cockpit (/cockpit) all read from. Before this fix
    // the pipeline only filled trend_signals, so the UI looked stale even
    // when connectors succeeded.
    try {
      // Prune first so the window stays bounded.
      pruneOldSignals(48);
      // Audit-Log haushalten: tenant_audit_log wuchs bislang unbegrenzt
      // und stand als Restrisiko in der QC. Wir loeschen Eintraege
      // aelter als 180 Tage auf jedem Pipeline-Run (alle 4h in Prod).
      // 180 Tage lassen genug Zeit fuer Rueckverfolgung von Tenant-
      // Aktionen ueber ein Halbjahr, bevor die Zeile faellt.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getSqliteHandle } = require("@/db");
        getSqliteHandle().prepare(
          "DELETE FROM tenant_audit_log WHERE created_at < datetime('now', '-180 day')",
        ).run();
      } catch {
        /* audit table missing in very old DBs — ignore */
      }
      let liveStored = 0;
      for (const [connectorName, connSignals] of signalsByConnector) {
        if (connSignals.length === 0) continue;
        const toStore = connSignals.map((s) => ({
          title: s.sourceTitle,
          content: s.rawData
            ? Object.entries(s.rawData)
                .filter(([k]) =>
                  ["summary", "description", "excerpt", "text", "trailText", "snippet", "abstract", "lead_paragraph", "content"].includes(k),
                )
                .map(([, v]) => String(v).slice(0, 400))
                .join(" | ")
                .slice(0, 600) || undefined
            : undefined,
          url: s.sourceUrl || undefined,
          topic: s.topic || undefined,
          tags: s.topic ? [s.topic] : [],
          signalType: s.signalType,
          strength: s.rawStrength,
          rawData: s.rawData,
        }));
        try {
          storeSignals(connectorName, toStore);
          liveStored += toStore.length;
        } catch (err) {
          console.error(
            `[pipeline] live_signals insert failed for ${connectorName}:`,
            err,
          );
          errors.push({
            source: `live_signals:${connectorName}`,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      console.log(`[pipeline] live_signals: stored ${liveStored} rows across ${signalsByConnector.size} connectors`);
    } catch (err) {
      console.error("[pipeline] live_signals write failed:", err);
      errors.push({
        source: "live_signals",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Phase 2b: Store signals and update aggregate trend scores (trend_signals)
    try {
      await storeSignalsAndUpdateScores(sanitizedSignals);
    } catch (err) {
      console.error("[pipeline] DB update failed:", err);
      errors.push({
        source: "database",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Phase 2c (Welle B Item 3 — Welford baselines):
    // Update streaming-variance state for per-source signal volume.
    // One sample per connector per pipeline run, keyed by weekday x
    // month so Tuesday-vs-Sunday patterns don't wash each other out.
    // Wrapped per-connector so one bad write doesn't short-circuit
    // the rest — this is a side-channel metric, not on the hot path.
    try {
      const now = new Date();
      for (const [connectorName, connSignals] of signalsByConnector) {
        try {
          updateBaseline(
            baselineKeyForDate("signal_count", connectorName, now),
            connSignals.length,
          );
        } catch (innerErr) {
          console.error(
            `[pipeline] baseline update failed for ${connectorName}:`,
            innerErr,
          );
          // Not added to errors[] — baseline is a nice-to-have, not
          // a pipeline-health signal. A missing baseline just means
          // the anomaly UI will stay in "warming up" state longer.
        }
      }
    } catch (err) {
      console.error("[pipeline] baseline phase failed:", err);
    }

    // Phase 2d (Welle B Item 2 — Cluster snapshots):
    // Write one cluster_snapshots row per topic-group per pipeline run.
    // Enables a Perigon-style `/v1/stories/history`-equivalent endpoint
    // so analysts can trace how a cluster has evolved over time. The
    // LLM changelog is gated behind CLUSTER_DIFF_LLM_ENABLED so the
    // operator opts in explicitly (pipeline cadence would otherwise
    // mean ~180 LLM calls/day at prod 4h cadence × 30 clusters).
    // Wrapped per-cluster so a single malformed group doesn't take
    // out the whole phase.
    try {
      const clusterGroups = groupSignalsByTopic(sanitizedSignals);
      let snapshotCount = 0;
      let diffCount = 0;
      let foresightCount = 0;
      for (const group of clusterGroups) {
        try {
          // Look up the previous snapshot for diff-generation BEFORE
          // writing the new one — otherwise getClusterHistory(1)
          // would return the row we just wrote.
          const slug = clusterSlug(group.topic);
          const prev = getClusterHistory(slug, 1)[0] ?? null;

          const summaryPreview = buildSimpleSummary(group.signals);
          const currentShape = {
            topic: group.topic,
            summary: summaryPreview,
            signalCount: group.signals.length,
          };

          // Both LLM calls gated behind their own env flags. Running
          // them in parallel because neither depends on the other's
          // output, and the pipeline run is already tolerant of slow
          // LLM calls (per-cluster wrap-try below). `Promise.all` so
          // the per-cluster latency is max(diff, foresight) not sum.
          const [changelog, foresight] = await Promise.all([
            generateClusterDiff(prev, currentShape),
            generateClusterForesight(currentShape),
          ]);
          if (changelog) diffCount += 1;
          if (foresight && foresight.length > 0) foresightCount += 1;

          createClusterSnapshot({
            topic: group.topic,
            signals: group.signals,
            changelog,
            foresight,
          });
          snapshotCount += 1;
        } catch (innerErr) {
          console.error(
            `[pipeline] cluster snapshot failed for topic "${group.topic}":`,
            innerErr,
          );
          // Not added to errors[] — snapshot history is observational
          // metadata, not on the critical path. A missing snapshot
          // means the history endpoint returns one fewer row; the
          // next run picks up the cadence again.
        }
      }
      console.log(`[pipeline] cluster_snapshots: wrote ${snapshotCount} rows across ${clusterGroups.length} topics (${diffCount} with LLM changelog, ${foresightCount} with foresight)`);
    } catch (err) {
      console.error("[pipeline] cluster snapshot phase failed:", err);
    }

    const durationMs = Date.now() - start;

    return {
      success: errors.length === 0,
      signalCount: sanitizedSignals.length,
      trendCount: megaTrends.length,
      sources: activeSources,
      errors,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  } finally {
    pipelineRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Database operations (ARC-16: dialect-agnostic via SignalStore adapter)
// ---------------------------------------------------------------------------
//
// Previously this section had storeSignalsPg (96 lines) and
// storeSignalsSqlite (103 lines) that duplicated the signal-group-loop +
// trend-upsert + score-log-insert sequence. The only real differences
// were (a) async vs sync calls and (b) Date / Array marshaling. We
// captured those two axes in a `SignalStore` interface and have the
// two adapters implement it — each is now ~50 lines of DB-specific
// glue, and the loop logic lives in one place.
//
// DAT-14 note: the old `// TODO` about date format divergence is now
// partly resolved — the shared loop never sees raw Date objects, it
// just passes the scored+group payload to the adapter which decides.
// If we ever fully normalize to ISO strings the adapters collapse
// further.

/** Minimal shape the shared `storeSignalsGeneric` loop needs from a
 *  dialect adapter. All methods may be async or sync; callers always
 *  `await` them so promise-wrapping is automatic. */
interface SignalStore {
  /** Insert-or-update a trend by slug, returns the trend's id. */
  upsertTrend(scored: ReturnType<typeof scoreTrend>): Promise<string>;
  /** Persist one raw signal linked to a trend. */
  insertSignal(trendId: string, signal: RawSignal): Promise<void>;
  /** Persist one score snapshot (one row per group per run). */
  insertScoreLog(
    trendId: string,
    scored: ReturnType<typeof scoreTrend>,
    signalCount: number,
  ): Promise<void>;
  /** Mark a connector as having run successfully (for freshness). */
  updateDataSource(name: string): Promise<void>;
  /** Release the underlying connection. Called in a `finally`. */
  close(): Promise<void>;
}

/** The part that's identical across dialects. Groups → scores →
 *  upserts → signals → log → source-timestamp update. */
async function storeSignalsGeneric(signals: RawSignal[], store: SignalStore) {
  try {
    const groups = groupSignalsByTopic(signals);
    for (const group of groups) {
      const scored = scoreTrend(group);
      const trendId = await store.upsertTrend(scored);
      for (const signal of group.signals) {
        await store.insertSignal(trendId, signal);
      }
      await store.insertScoreLog(trendId, scored, group.signals.length);
    }
    for (const sourceName of [...new Set(signals.map((s) => s.sourceType))]) {
      await store.updateDataSource(sourceName);
    }
  } finally {
    await store.close();
  }
}

async function storeSignalsAndUpdateScores(signals: RawSignal[]) {
  const url = process.env.DATABASE_URL ?? "";
  const isPg = url.startsWith("postgres");
  const store = isPg ? await createPgStore() : await createSqliteStore();
  await storeSignalsGeneric(signals, store);
}

// ─── Postgres adapter ─────────────────────────────────────────────
async function createPgStore(): Promise<SignalStore> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/postgres-js");
  const schema = await import("@/db/schema");
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  return {
    async upsertTrend(scored) {
      const existing = await db
        .select()
        .from(schema.trends)
        .where(eq(schema.trends.slug, scored.id))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(schema.trends)
          .set({
            aggRelevance: scored.relevance,
            aggConfidence: scored.confidence,
            aggImpact: scored.impact,
            timeHorizon: scored.timeHorizon,
            lastSignalAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.trends.id, existing[0].id));
        return existing[0].id;
      }
      const result = await db
        .insert(schema.trends)
        .values({
          slug: scored.id,
          name: scored.name,
          category: scored.category,
          tags: scored.tags, // PG jsonb accepts native arrays
          status: "candidate",
          aggRelevance: scored.relevance,
          aggConfidence: scored.confidence,
          aggImpact: scored.impact,
          timeHorizon: scored.timeHorizon,
        })
        .returning({ id: schema.trends.id });
      return result[0].id;
    },
    async insertSignal(trendId, signal) {
      await db.insert(schema.trendSignals).values({
        trendId,
        sourceType: signal.sourceType,
        sourceUrl: signal.sourceUrl,
        sourceTitle: signal.sourceTitle,
        signalType: signal.signalType,
        signalStrength: signal.rawStrength,
        rawData: signal.rawData, // PG jsonb accepts native objects
        detectedAt: signal.detectedAt, // PG timestamp accepts native Date
      });
    },
    async insertScoreLog(trendId, scored, signalCount) {
      await db.insert(schema.scoreLog).values({
        trendId,
        relevance: scored.relevance,
        confidence: scored.confidence,
        impact: scored.impact,
        signalCount,
      });
    },
    async updateDataSource(name) {
      await db
        .update(schema.dataSources)
        .set({ lastRunAt: new Date(), lastStatus: "success" })
        .where(eq(schema.dataSources.name, name));
    },
    async close() { await client.end(); },
  };
}

// ─── SQLite adapter ───────────────────────────────────────────────
async function createSqliteStore(): Promise<SignalStore> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const schema = await import("@/db/schema-sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const dbPath = path.join(process.cwd(), "local.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  const nowIso = () => new Date().toISOString();

  return {
    async upsertTrend(scored) {
      const existing = db
        .select()
        .from(schema.trends)
        .where(eq(schema.trends.slug, scored.id))
        .limit(1)
        .all();
      if (existing.length > 0) {
        db.update(schema.trends)
          .set({
            aggRelevance: scored.relevance,
            aggConfidence: scored.confidence,
            aggImpact: scored.impact,
            timeHorizon: scored.timeHorizon,
            lastSignalAt: nowIso(),
            updatedAt: nowIso(),
          })
          .where(eq(schema.trends.id, existing[0].id))
          .run();
        return existing[0].id;
      }
      const id = crypto.randomUUID();
      db.insert(schema.trends)
        .values({
          id,
          slug: scored.id,
          name: scored.name,
          category: scored.category,
          tags: JSON.stringify(scored.tags), // SQLite has no array type
          status: "candidate",
          aggRelevance: scored.relevance,
          aggConfidence: scored.confidence,
          aggImpact: scored.impact,
          timeHorizon: scored.timeHorizon,
        })
        .run();
      return id;
    },
    async insertSignal(trendId, signal) {
      db.insert(schema.trendSignals)
        .values({
          trendId,
          sourceType: signal.sourceType,
          sourceUrl: signal.sourceUrl,
          sourceTitle: signal.sourceTitle,
          signalType: signal.signalType,
          signalStrength: signal.rawStrength,
          rawData: JSON.stringify(signal.rawData),
          detectedAt: signal.detectedAt.toISOString(),
        })
        .run();
    },
    async insertScoreLog(trendId, scored, signalCount) {
      db.insert(schema.scoreLog)
        .values({
          trendId,
          relevance: scored.relevance,
          confidence: scored.confidence,
          impact: scored.impact,
          signalCount,
        })
        .run();
    },
    async updateDataSource(name) {
      db.update(schema.dataSources)
        .set({ lastRunAt: nowIso(), lastStatus: "success" })
        .where(eq(schema.dataSources.name, name))
        .run();
    },
    async close() { sqlite.close(); },
  };
}
