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
// Database operations
// ---------------------------------------------------------------------------

async function storeSignalsAndUpdateScores(signals: RawSignal[]) {
  const url = process.env.DATABASE_URL ?? "";
  const isPg = url.startsWith("postgres");

  if (isPg) {
    await storeSignalsPg(signals);
  } else {
    await storeSignalsSqlite(signals);
  }
}

// TODO: ARC-16 — storeSignalsPg and storeSignalsSqlite are 96/103 lines respectively,
// differing only in async vs sync and Date vs ISO-String.
// FIX: Abstract behind a DB-agnostic storeSignals() wrapper.

async function storeSignalsPg(signals: RawSignal[]) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/postgres-js");
  const schema = await import("@/db/schema");

  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    // Group signals by topic and score them
    const groups = groupSignalsByTopic(signals);

    for (const group of groups) {
      const scored = scoreTrend(group);

      // Find or create trend
      const existing = await db
        .select()
        .from(schema.trends)
        .where(eq(schema.trends.slug, scored.id))
        .limit(1);

      let trendId: string;

      if (existing.length > 0) {
        trendId = existing[0].id;
        // Update aggregate scores
        // TODO: DAT-14 — Date format divergence: PG uses native Date objects, SQLite uses ISO strings.
        // Tags: PG = native Array, SQLite = JSON.stringify. Read code must handle both.
        // FIX: Define a canonical date format (ISO-8601 strings) and use consistently.
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
          .where(eq(schema.trends.id, trendId));
      } else {
        // Insert new trend
        const result = await db
          .insert(schema.trends)
          .values({
            slug: scored.id,
            name: scored.name,
            category: scored.category,
            tags: scored.tags,
            status: "candidate",
            aggRelevance: scored.relevance,
            aggConfidence: scored.confidence,
            aggImpact: scored.impact,
            timeHorizon: scored.timeHorizon,
          })
          .returning({ id: schema.trends.id });
        trendId = result[0].id;
      }

      // Store individual signals
      for (const signal of group.signals) {
        await db.insert(schema.trendSignals).values({
          trendId,
          sourceType: signal.sourceType,
          sourceUrl: signal.sourceUrl,
          sourceTitle: signal.sourceTitle,
          signalType: signal.signalType,
          signalStrength: signal.rawStrength,
          rawData: signal.rawData,
          detectedAt: signal.detectedAt,
        });
      }

      // Write score snapshot
      await db.insert(schema.scoreLog).values({
        trendId,
        relevance: scored.relevance,
        confidence: scored.confidence,
        impact: scored.impact,
        signalCount: group.signals.length,
      });
    }

    // Update data source last-run timestamps
    for (const sourceName of [...new Set(signals.map((s) => s.sourceType))]) {
      await db
        .update(schema.dataSources)
        .set({
          lastRunAt: new Date(),
          lastStatus: "success",
        })
        .where(eq(schema.dataSources.name, sourceName));
    }
  } finally {
    await client.end();
  }
}

async function storeSignalsSqlite(signals: RawSignal[]) {
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

  try {
    const groups = groupSignalsByTopic(signals);

    for (const group of groups) {
      const scored = scoreTrend(group);

      const existing = db
        .select()
        .from(schema.trends)
        .where(eq(schema.trends.slug, scored.id))
        .limit(1)
        .all();

      let trendId: string;

      if (existing.length > 0) {
        trendId = existing[0].id;
        db.update(schema.trends)
          .set({
            aggRelevance: scored.relevance,
            aggConfidence: scored.confidence,
            aggImpact: scored.impact,
            timeHorizon: scored.timeHorizon,
            lastSignalAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.trends.id, trendId))
          .run();
      } else {
        const id = crypto.randomUUID();
        db.insert(schema.trends)
          .values({
            id,
            slug: scored.id,
            name: scored.name,
            category: scored.category,
            tags: JSON.stringify(scored.tags),
            status: "candidate",
            aggRelevance: scored.relevance,
            aggConfidence: scored.confidence,
            aggImpact: scored.impact,
            timeHorizon: scored.timeHorizon,
          })
          .run();
        trendId = id;
      }

      // Store signals
      for (const signal of group.signals) {
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
      }

      // Score snapshot
      db.insert(schema.scoreLog)
        .values({
          trendId,
          relevance: scored.relevance,
          confidence: scored.confidence,
          impact: scored.impact,
          signalCount: group.signals.length,
        })
        .run();
    }

    // Update data source timestamps
    for (const sourceName of [...new Set(signals.map((s) => s.sourceType))]) {
      db.update(schema.dataSources)
        .set({
          lastRunAt: new Date().toISOString(),
          lastStatus: "success",
        })
        .where(eq(schema.dataSources.name, sourceName))
        .run();
    }
  } finally {
    sqlite.close();
  }
}
