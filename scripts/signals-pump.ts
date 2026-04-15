/**
 * scripts/signals-pump.ts — Manual signal pipeline trigger for local dev.
 *
 * Runs the full connector orchestration (`runPipeline`) directly from the
 * CLI, bypassing the Next.js HTTP layer and CRON_SECRET. Use this when:
 *
 *   - The dev server is not running but you still want fresh signals
 *   - You want to see per-connector output (stdout logs are verbose)
 *   - You're debugging a specific connector failure
 *
 * Usage:
 *   npm run signals:pump            # pump all 56 connectors
 *
 * The script loads .env.local directly (same bootstrap as the server)
 * and writes into local.db. Knowledge Cockpit (/verstehen), /monitor,
 * and any page reading /api/v1/feed will see fresh data on next load.
 */

import { ensureEnvLoaded } from "../src/lib/env";
ensureEnvLoaded();

import { runPipeline } from "../src/lib/pipeline";

async function main() {
  const start = Date.now();
  console.log(`[signals:pump] starting pipeline at ${new Date().toISOString()}`);
  try {
    const result = await runPipeline();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log("");
    console.log(`[signals:pump] done in ${elapsed}s`);
    console.log(`  signals stored: ${result.signalCount}`);
    console.log(`  active sources: ${result.sources.length}`);
    console.log(`  errors:         ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log("");
      console.log("[signals:pump] errors (first 10):");
      for (const e of result.errors.slice(0, 10)) {
        console.log(`  - ${e.source}: ${e.error}`);
      }
    }
    console.log("");
    console.log("[signals:pump] Knowledge Cockpit (/verstehen) now reads fresh signals.");
    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (err) {
    console.error("[signals:pump] fatal:", err);
    process.exit(2);
  }
}

main();
