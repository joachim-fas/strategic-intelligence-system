/**
 * Data Pipeline — orchestrates the signal collection and scoring cycle.
 *
 * 1. Runs all connectors (with rate-limiting delay between calls)
 * 2. Matches signals to existing trends or creates new ones
 * 3. Stores signals in trend_signals table
 * 4. Recomputes aggregate scores on the trends table
 * 5. Writes daily snapshots to score_log
 *
 * Designed for resilience: one connector failure does not abort the pipeline.
 */

import { connectors, type RawSignal } from "@/connectors";
import { groupSignalsByTopic, scoreTrend } from "@/lib/scoring";
import { megaTrends } from "@/lib/mega-trends";
import { eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineResult {
  success: boolean;
  signalCount: number;
  trendCount: number;
  sources: string[];
  errors: Array<{ source: string; error: string }>;
  durationMs: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Rate-limit delay between connector calls (ms)
// ---------------------------------------------------------------------------
const CONNECTOR_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(): Promise<PipelineResult> {
  const start = Date.now();
  const allSignals: RawSignal[] = [];
  const errors: Array<{ source: string; error: string }> = [];
  const activeSources: string[] = [];

  // Phase 1: Collect signals from all connectors sequentially with delay
  for (const connector of connectors) {
    try {
      const signals = await connector.fetchSignals();
      allSignals.push(...signals);
      activeSources.push(connector.name);
      console.log(`[pipeline] ${connector.name}: ${signals.length} signals`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ source: connector.name, error: message });
      console.error(`[pipeline] ${connector.name} FAILED: ${message}`);
    }
    // Rate-limit between calls
    await sleep(CONNECTOR_DELAY_MS);
  }

  // Phase 2: Store signals and update scores in the database
  try {
    await storeSignalsAndUpdateScores(allSignals);
  } catch (err) {
    console.error("[pipeline] DB update failed:", err);
    errors.push({
      source: "database",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const durationMs = Date.now() - start;

  return {
    success: errors.length === 0,
    signalCount: allSignals.length,
    trendCount: megaTrends.length,
    sources: activeSources,
    errors,
    durationMs,
    timestamp: new Date().toISOString(),
  };
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
