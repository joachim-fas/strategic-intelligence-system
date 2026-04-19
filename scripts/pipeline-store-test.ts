#!/usr/bin/env tsx
/**
 * pipeline-store-test — integration test for the pipeline's
 * `storeSignalsGeneric` loop + the SignalStore interface (ARC-16
 * follow-up).
 *
 * Before the ARC-16 refactor this code path had zero coverage —
 * the pipeline was always invoked in production through real
 * connectors. Now that the DB-specific parts are behind an
 * adapter, we can validate the invariant call order cheaply with a
 * mock SignalStore.
 *
 * Coverage:
 *   1. Every signal-group produces exactly: upsertTrend →
 *      insertSignal(n) → insertScoreLog → (next group) …
 *   2. upsertTrend is called once per unique topic.
 *   3. updateDataSource is called once per unique source.
 *   4. close() is called exactly once, after everything else.
 *   5. close() is still called even when an inner method throws.
 *
 * Run: `tsx scripts/pipeline-store-test.ts`
 */

import { storeSignalsGeneric, type SignalStore } from "../src/lib/pipeline";
import type { RawSignal } from "../src/connectors/types";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) { console.log(`\n▸ ${title}`); }

// Synthetic signal factory — matches the RawSignal shape but only
// carries the fields the store interacts with.
function fakeSignal(overrides: Partial<RawSignal> & { topic: string; sourceType: string; id?: string }): RawSignal {
  const base = {
    id: overrides.id ?? crypto.randomUUID(),
    sourceUrl: "https://example.test/a",
    sourceTitle: "A title",
    signalType: "news",
    rawStrength: 0.5,
    rawData: { body: "x" },
    detectedAt: new Date(),
  };
  // Merge overrides last so topic/sourceType/sourceTitle win over
  // defaults without triggering TS's "specified more than once"
  // diagnostic.
  return { ...base, ...overrides } as unknown as RawSignal;
}

type Call =
  | { kind: "upsertTrend"; slug: string }
  | { kind: "insertSignal"; trendId: string; title: string }
  | { kind: "insertScoreLog"; trendId: string; count: number }
  | { kind: "updateDataSource"; name: string }
  | { kind: "close" };

function mockStore(opts: { throwOn?: Call["kind"] } = {}): { store: SignalStore; calls: Call[] } {
  const calls: Call[] = [];
  const store: SignalStore = {
    async upsertTrend(scored) {
      if (opts.throwOn === "upsertTrend") throw new Error("boom upsert");
      calls.push({ kind: "upsertTrend", slug: scored.id });
      return `trend-${scored.id}`;
    },
    async insertSignal(trendId, signal) {
      if (opts.throwOn === "insertSignal") throw new Error("boom insert");
      calls.push({
        kind: "insertSignal",
        trendId,
        title: signal.sourceTitle ?? "",
      });
    },
    async insertScoreLog(trendId, scored, signalCount) {
      if (opts.throwOn === "insertScoreLog") throw new Error("boom log");
      calls.push({ kind: "insertScoreLog", trendId, count: signalCount });
    },
    async updateDataSource(name) {
      if (opts.throwOn === "updateDataSource") throw new Error("boom ds");
      calls.push({ kind: "updateDataSource", name });
    },
    async close() {
      calls.push({ kind: "close" });
    },
  };
  return { store, calls };
}

async function main() {
  // ─── 1. Happy path — invariant order ────────────────────────────
  section("1. One group produces upsertTrend → signals → scoreLog → dataSource → close");
  {
    const { store, calls } = mockStore();
    const signals = [
      fakeSignal({ topic: "AI", sourceType: "hackernews", sourceTitle: "t1" }),
      fakeSignal({ topic: "AI", sourceType: "hackernews", sourceTitle: "t2" }),
    ];
    await storeSignalsGeneric(signals, store);

    assert(calls[0]?.kind === "upsertTrend", `first call upsertTrend (got ${calls[0]?.kind})`);
    assert(calls[1]?.kind === "insertSignal" && calls[2]?.kind === "insertSignal", "next two insertSignal");
    assert(calls[3]?.kind === "insertScoreLog", `then insertScoreLog (got ${calls[3]?.kind})`);
    assert(calls[3]?.kind === "insertScoreLog" && (calls[3] as Extract<Call, { kind: "insertScoreLog" }>).count === 2, "scoreLog count matches group size");
    assert(calls[4]?.kind === "updateDataSource", "then updateDataSource");
    assert(calls[calls.length - 1]?.kind === "close", "close() last");
    assert(calls.length === 6, `total 6 calls (got ${calls.length})`);
  }

  // ─── 2. Multiple groups handled independently ──────────────────
  section("2. Multiple topics → one upsertTrend per topic in sequence");
  {
    const { store, calls } = mockStore();
    const signals = [
      fakeSignal({ topic: "AI", sourceType: "hackernews" }),
      fakeSignal({ topic: "Climate", sourceType: "reuters" }),
      fakeSignal({ topic: "AI", sourceType: "reuters" }),
    ];
    await storeSignalsGeneric(signals, store);

    const upserts = calls.filter(c => c.kind === "upsertTrend").length;
    assert(upserts === 2, `2 unique topics → 2 upsertTrend calls (got ${upserts})`);

    const dsUpdates = calls.filter(c => c.kind === "updateDataSource").length;
    assert(dsUpdates === 2, `2 unique sources → 2 updateDataSource calls (got ${dsUpdates})`);
  }

  // ─── 3. close() runs on mid-loop throw ─────────────────────────
  section("3. close() still runs when upsertTrend throws");
  {
    const { store, calls } = mockStore({ throwOn: "upsertTrend" });
    const signals = [fakeSignal({ topic: "AI", sourceType: "hackernews" })];
    let thrown = false;
    try { await storeSignalsGeneric(signals, store); } catch { thrown = true; }
    assert(thrown, "error propagated to caller");
    assert(calls.some(c => c.kind === "close"), "close() called despite the throw");
    assert(!calls.some(c => c.kind === "updateDataSource"), "updateDataSource NOT reached after throw");
  }

  // ─── 4. Empty signals → close() only ───────────────────────────
  section("4. Empty signals list → single close() call");
  {
    const { store, calls } = mockStore();
    await storeSignalsGeneric([], store);
    assert(calls.length === 1 && calls[0].kind === "close", `just close() (got ${calls.length} calls)`);
  }

  // ─── 5. Signal count passed correctly ──────────────────────────
  section("5. insertScoreLog receives the group's signal count");
  {
    const { store, calls } = mockStore();
    const signals = [
      fakeSignal({ topic: "AI", sourceType: "a", sourceTitle: "1" }),
      fakeSignal({ topic: "AI", sourceType: "a", sourceTitle: "2" }),
      fakeSignal({ topic: "AI", sourceType: "a", sourceTitle: "3" }),
    ];
    await storeSignalsGeneric(signals, store);
    const scoreLogCall = calls.find(c => c.kind === "insertScoreLog") as Extract<Call, { kind: "insertScoreLog" }> | undefined;
    assert(scoreLogCall?.count === 3, `count=3 (got ${scoreLogCall?.count})`);
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
