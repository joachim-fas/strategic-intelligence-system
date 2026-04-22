#!/usr/bin/env tsx
/**
 * bruegel-smoke-test — gezielter Live-Smoke-Test für den neuen
 * Bruegel-RSS-Connector.
 *
 * Ruft den Feed direkt auf, parst ihn, und schreibt die ersten N
 * Items in die lokale DB (SQLite). So können wir ohne den full-pipeline-
 * Run (alle 50+ Connectors, ~30s) verifizieren, dass:
 *   1. Der Feed erreichbar ist (HTTP 200)
 *   2. Das XML korrekt parst
 *   3. Items das erwartete Format haben (Titel, Link, Date)
 *   4. Der signal_strength-Compute nicht crasht
 *   5. Die Insertion in live_signals funktioniert
 *
 * Nach dem Run:
 *   sqlite3 local.db "SELECT COUNT(*), source FROM live_signals \
 *     WHERE source='bruegel_rss' GROUP BY source"
 *
 * Run: `npx tsx scripts/bruegel-smoke-test.ts`
 */

import { ensureEnvLoaded } from "../src/lib/env";
ensureEnvLoaded();

import Database from "better-sqlite3";
import { RSS_FEED_CONFIGS } from "../src/connectors/rss-feeds";
import { buildRssFeedConnector } from "../src/connectors/rss-feed";

async function main() {
  const feedName = process.argv[2] ?? "bruegel_rss";
  const cfg = RSS_FEED_CONFIGS.find((c) => c.name === feedName);
  if (!cfg) {
    console.error(`✗ ${feedName} not in RSS_FEED_CONFIGS — Config missing?`);
    process.exit(1);
  }

  console.log(`→ Found config for ${cfg.name}: ${cfg.feedUrl}`);

  const connector = buildRssFeedConnector(cfg);

  console.log(`→ Fetching signals via ${connector.name}…`);
  const t0 = Date.now();
  const signals = await connector.fetchSignals();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`← ${signals.length} signals in ${elapsed}s`);

  if (signals.length === 0) {
    console.warn("⚠ No signals returned — Feed empty or parse fail?");
    console.warn("  Checking raw response…");
    try {
      const res = await fetch(cfg.feedUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "SIS-Dev-Smoketest/1.0" },
      });
      const text = await res.text();
      console.warn(`  HTTP ${res.status}, body ${text.length} chars`);
      console.warn(`  First 500 chars: ${text.slice(0, 500)}`);
    } catch (e) {
      console.error("  Raw fetch failed:", e);
    }
    process.exit(1);
  }

  console.log("");
  console.log("=== First 5 signals (sourceTitle + topic) ===");
  for (const s of signals.slice(0, 5)) {
    const sr = s as any;
    const title = sr.sourceTitle ?? "<no sourceTitle>";
    const topic = sr.topic ?? "<no topic>";
    console.log(`  • [${topic}] ${title.slice(0, 90)}`);
    console.log(`    ${sr.sourceUrl ?? "?"} @ ${sr.detectedAt ?? "?"}`);
  }

  // Persist to live_signals so signal-retrieval-debug can pick them up
  console.log("");
  console.log("→ Writing to local.db / live_signals…");
  const db = new Database("local.db");
  // Use INSERT (not OR IGNORE) so constraint violations surface as errors
  // — INSERT OR IGNORE silently swallows NOT-NULL violations in SQLite.
  const insert = db.prepare(`
    INSERT INTO live_signals
      (id, source, title, content, url, topic, tags, signal_type, strength, raw_data, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;
  for (const s of signals) {
    // RawSignal schema maps: sourceTitle → title, sourceUrl → url, rawStrength → strength
    const sr = s as unknown as {
      sourceType: string;
      sourceTitle: string;
      sourceUrl: string;
      topic: string;
      signalType: string;
      rawStrength: number;
      detectedAt: string | Date;
      rawData: { description?: string; tags?: string[] };
    };
    // detectedAt is a Date object from the RSS parser — convert to ISO string
    const detectedAtIso =
      sr.detectedAt instanceof Date
        ? sr.detectedAt.toISOString()
        : typeof sr.detectedAt === "string"
          ? sr.detectedAt
          : new Date().toISOString();
    const title = sr.sourceTitle;
    const url = sr.sourceUrl;
    if (!title || !url) { skipped += 1; continue; }
    try {
      const id = `${sr.sourceType}:${url}`.slice(0, 240);
      insert.run(
        id,
        sr.sourceType,
        title,
        sr.rawData?.description ?? "",
        url,
        sr.topic,
        JSON.stringify(sr.rawData?.tags ?? []),
        sr.signalType,
        sr.rawStrength,
        JSON.stringify(sr.rawData ?? {}),
        detectedAtIso,
      );
      inserted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE/i.test(msg)) {
        skipped += 1;
      } else {
        console.warn(`  ✗ insert failed for ${title.slice(0, 40)}: ${msg}`);
      }
    }
  }
  console.log(`  skipped (dup or missing title/url): ${skipped}`);
  db.close();
  console.log(`✓ ${inserted} rows inserted (others may be existing duplicates)`);

  console.log("");
  console.log("Verify:");
  console.log(`  sqlite3 local.db "SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM live_signals WHERE source='${cfg.name}'"`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
