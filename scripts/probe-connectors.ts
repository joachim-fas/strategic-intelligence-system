/**
 * scripts/probe-connectors.ts — Diagnose each connector in isolation.
 *
 * For each connector that returned 0 signals in the last pipeline run,
 * call its fetchSignals() directly and capture what happens (HTTP status,
 * response shape, error). Helps identify which connectors are broken vs
 * just "API returns nothing today".
 *
 * Usage:
 *   npx tsx scripts/probe-connectors.ts                 # all connectors
 *   npx tsx scripts/probe-connectors.ts gdelt acled nyt # named connectors
 */

import { ensureEnvLoaded } from "../src/lib/env";
ensureEnvLoaded();

import { connectors } from "../src/connectors";

async function main() {
  const filter = process.argv.slice(2);
  const targets =
    filter.length > 0
      ? connectors.filter((c) => filter.includes(c.name))
      : connectors;

  console.log(`[probe] running ${targets.length} connectors sequentially`);

  for (const c of targets) {
    const start = Date.now();
    try {
      const signals = await c.fetchSignals();
      const ms = Date.now() - start;
      console.log(`[${c.name}] ok: ${signals.length} signals in ${ms}ms`);
    } catch (err) {
      const ms = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[${c.name}] THREW after ${ms}ms: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error("[probe] fatal:", err);
  process.exit(1);
});
