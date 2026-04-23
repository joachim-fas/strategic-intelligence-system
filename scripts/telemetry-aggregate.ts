#!/usr/bin/env tsx
/**
 * telemetry-aggregate — parses the structured `[query:*]` log lines
 * from the SIS server log and produces aggregate cost/latency/quality
 * statistics across many queries.
 *
 * Background:
 *   The Iteration-Loop pipeline (Pass 2a, Pass 2b, Pass 3, Synthesis)
 *   logs greppable lines per query:
 *     [query:llm-1]              stop_reason=… input_tokens=… output_tokens=… duration_ms=…
 *     [query:llm-2-retry]        stop_reason=… input_tokens=… output_tokens=… duration_ms=…
 *     [query:relevance-pass-1]   in=… out=… dropped=… mean=… coverage=… model=… duration_ms=… tokens_in=… tokens_out=…
 *     [query:relevance-pass-2]   in=… out=… dropped=… mean=… coverage=… duration_ms=… tokens_in=… tokens_out=…
 *     [query:coverage-critique]  signals=… gaps=… biases=… ceiling=… model=… duration_ms=… tokens_in=… tokens_out=…
 *     [query:coverage-clamp]     LLM confidence …% > ceiling …%, clamping
 *
 *   Without aggregation these are inert text. This script parses them
 *   and surfaces:
 *     - Total cost per query (rough estimate, Haiku + Sonnet pricing)
 *     - Total latency per query
 *     - How often the collapse-retry, the coverage-clamp, and
 *       low-coverage-ceiling situations actually trigger
 *     - Mean Pass-2 drop rate (quality of Pass-1 candidate set)
 *     - Mean Pass-3 ceiling (proxy for "how well does the DB cover the
 *       queries we get?")
 *
 * Usage:
 *   - Pipe a server log: `cat server.log | npx tsx scripts/telemetry-aggregate.ts`
 *   - Or: `npx tsx scripts/telemetry-aggregate.ts /path/to/server.log`
 *   - Or read from npm-run-dev directly while developing
 *
 * Pricing assumptions (claude-haiku-4-5 + claude-sonnet-4-5/4-6 as of
 * 2026-04). Update `PRICING` if rates change.
 */

import * as fs from "fs";

interface PerQueryRecord {
  llm1?: { stopReason?: string; inputTokens?: number; outputTokens?: number; durationMs?: number };
  llm2Retry?: { stopReason?: string; inputTokens?: number; outputTokens?: number; durationMs?: number };
  pass1?: { in?: number; out?: number; dropped?: number; mean?: number; tokensIn?: number; tokensOut?: number; durationMs?: number };
  pass2?: { in?: number; out?: number; dropped?: number; mean?: number; tokensIn?: number; tokensOut?: number; durationMs?: number };
  pass3?: { signals?: number; gaps?: number; biases?: number; ceiling?: number; tokensIn?: number; tokensOut?: number; durationMs?: number };
  clamp?: { fromPct?: number; toPct?: number };
}

const PRICING = {
  // claude-haiku-4-5: $1/MTok input, $5/MTok output
  haikuInput: 1 / 1_000_000,
  haikuOutput: 5 / 1_000_000,
  // claude-sonnet-4-5/4-6: $3/MTok input, $15/MTok output
  sonnetInput: 3 / 1_000_000,
  sonnetOutput: 15 / 1_000_000,
};

// ───────────────────────────────────────────────────────────────────────
// Parsing — one record per "session" (heuristic: each [query:llm-1] line
// starts a new query session; subsequent lines until the next [query:llm-1]
// belong to that session). This is fragile if log lines from concurrent
// queries interleave — for now we assume sequential-ish dev usage.
// ───────────────────────────────────────────────────────────────────────

function parseKv(line: string): Record<string, string> {
  // Parse "key=value key2=value2" pairs. Values are unquoted, no spaces.
  const out: Record<string, string> = {};
  const re = /(\w+)=([^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out[m[1]] = m[2];
  }
  return out;
}

function asNumber(v: string | undefined): number | undefined {
  if (v === undefined || v === "null" || v === "undefined") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function parseLog(text: string): PerQueryRecord[] {
  const lines = text.split("\n");
  const records: PerQueryRecord[] = [];
  let current: PerQueryRecord | null = null;

  // 2026-04-23 Bug-Fix: previously the session-start marker was
  // [query:llm-1], but Pass 2a (relevance-pass-1) and Pass 3
  // (coverage-critique) actually appear BEFORE llm-1 in the log
  // sequence. So those lines were either dropped (first query) or
  // attached to the PREVIOUS query (subsequent queries). Now:
  // [query:relevance-pass-1] is the canonical session-start; if a
  // log doesn't have it (legacy/pre-Pass-2 logs), [query:llm-1] is
  // the fallback start.
  for (const line of lines) {
    // Primary session-start: relevance-pass-1 (modern pipeline)
    if (line.includes("[query:relevance-pass-1]")) {
      if (current) records.push(current);
      current = {};
      const kv = parseKv(line);
      current.pass1 = {
        in: asNumber(kv.in),
        out: asNumber(kv.out),
        dropped: asNumber(kv.dropped),
        mean: asNumber(kv.mean),
        tokensIn: asNumber(kv.tokens_in),
        tokensOut: asNumber(kv.tokens_out),
        durationMs: asNumber(kv.duration_ms),
      };
      continue;
    }
    // Fallback session-start: llm-1 (legacy, pre-Pass-2 logs)
    if (line.includes("[query:llm-1]")) {
      // If current session already has an llm-1, this is a new session.
      // If not, attach to current (the relevance-pass-1 already opened it).
      if (current && current.llm1) {
        records.push(current);
        current = {};
      } else if (!current) {
        current = {};
      }
      const kv = parseKv(line);
      current.llm1 = {
        stopReason: kv.stop_reason,
        inputTokens: asNumber(kv.input_tokens),
        outputTokens: asNumber(kv.output_tokens),
        durationMs: asNumber(kv.duration_ms),
      };
      continue;
    }
    if (!current) continue;
    if (line.includes("[query:llm-2-retry]")) {
      const kv = parseKv(line);
      current.llm2Retry = {
        stopReason: kv.stop_reason,
        inputTokens: asNumber(kv.input_tokens),
        outputTokens: asNumber(kv.output_tokens),
        durationMs: asNumber(kv.duration_ms),
      };
    } else if (line.includes("[query:relevance-pass-2]")) {
      const kv = parseKv(line);
      current.pass2 = {
        in: asNumber(kv.in),
        out: asNumber(kv.out),
        dropped: asNumber(kv.dropped),
        mean: asNumber(kv.mean),
        tokensIn: asNumber(kv.tokens_in),
        tokensOut: asNumber(kv.tokens_out),
        durationMs: asNumber(kv.duration_ms),
      };
    } else if (line.includes("[query:coverage-critique]")) {
      const kv = parseKv(line);
      current.pass3 = {
        signals: asNumber(kv.signals),
        gaps: asNumber(kv.gaps),
        biases: asNumber(kv.biases),
        ceiling: asNumber(kv.ceiling),
        tokensIn: asNumber(kv.tokens_in),
        tokensOut: asNumber(kv.tokens_out),
        durationMs: asNumber(kv.duration_ms),
      };
    } else if (line.includes("[query:coverage-clamp]")) {
      // Free-text format: "LLM confidence 85% > ceiling 40%, clamping"
      const m = line.match(/(\d+)%\s*>\s*ceiling\s*(\d+)%/);
      if (m) {
        current.clamp = { fromPct: Number(m[1]), toPct: Number(m[2]) };
      }
    }
  }
  if (current) records.push(current);
  return records;
}

// ───────────────────────────────────────────────────────────────────────
// Cost calculation
// ───────────────────────────────────────────────────────────────────────

function costFor(rec: PerQueryRecord): number {
  let total = 0;
  if (rec.llm1?.inputTokens) total += rec.llm1.inputTokens * PRICING.sonnetInput;
  if (rec.llm1?.outputTokens) total += rec.llm1.outputTokens * PRICING.sonnetOutput;
  if (rec.llm2Retry?.inputTokens) total += rec.llm2Retry.inputTokens * PRICING.sonnetInput;
  if (rec.llm2Retry?.outputTokens) total += rec.llm2Retry.outputTokens * PRICING.sonnetOutput;
  if (rec.pass1?.tokensIn) total += rec.pass1.tokensIn * PRICING.haikuInput;
  if (rec.pass1?.tokensOut) total += rec.pass1.tokensOut * PRICING.haikuOutput;
  if (rec.pass2?.tokensIn) total += rec.pass2.tokensIn * PRICING.haikuInput;
  if (rec.pass2?.tokensOut) total += rec.pass2.tokensOut * PRICING.haikuOutput;
  if (rec.pass3?.tokensIn) total += rec.pass3.tokensIn * PRICING.haikuInput;
  if (rec.pass3?.tokensOut) total += rec.pass3.tokensOut * PRICING.haikuOutput;
  return total;
}

function totalLatency(rec: PerQueryRecord): number {
  return (
    (rec.llm1?.durationMs ?? 0) +
    (rec.llm2Retry?.durationMs ?? 0) +
    (rec.pass1?.durationMs ?? 0) +
    (rec.pass2?.durationMs ?? 0) +
    (rec.pass3?.durationMs ?? 0)
  );
}

// ───────────────────────────────────────────────────────────────────────
// Aggregation + reporting
// ───────────────────────────────────────────────────────────────────────

function p(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function pUSD(n: number): string {
  return `$${n.toFixed(4)}`;
}

// 2026-04-23 Min-sample-size guard für Warnings.
// Vor diesem Fix feuerten Warnungen wie "⚠️ >50% Sonnet ignoriert ceiling"
// schon bei N=1 (1 von 1 = 100% > 50%), was statistisch sinnlos ist —
// ein einzelner Datenpunkt sagt nichts über systematisches Verhalten.
// MIN_WARN_SAMPLES = 3 ist ein konservativer Floor: Warnungen erscheinen
// erst wenn wir mindestens 3 Datenpunkte haben. Bei N<3 wird stattdessen
// eine sample-size-Notiz angezeigt damit der User weiß dass mehr Runs
// für aussagekräftige Diagnose nötig sind.
const MIN_WARN_SAMPLES = 3;
function maybeWarn(condition: boolean, sampleSize: number, message: string): void {
  if (sampleSize < MIN_WARN_SAMPLES) {
    if (condition) {
      console.log(`  (Hinweis: N=${sampleSize}, mindestens ${MIN_WARN_SAMPLES} Samples für aussagekräftige Warnung)`);
    }
    return;
  }
  if (condition) {
    console.log(message);
  }
}

function report(records: PerQueryRecord[]) {
  if (records.length === 0) {
    console.log("No [query:*] records found in input.");
    return;
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  SIS Telemetry Aggregate — ${records.length} queries`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // Cost
  const costs = records.map(costFor);
  const totalCost = costs.reduce((a, b) => a + b, 0);
  const meanCost = totalCost / records.length;
  const maxCost = Math.max(...costs);
  console.log(`COST`);
  console.log(`  Total:      ${pUSD(totalCost)}`);
  console.log(`  Mean/query: ${pUSD(meanCost)}`);
  console.log(`  Max/query:  ${pUSD(maxCost)}`);
  console.log();

  // Latency
  const latencies = records.map(totalLatency);
  const meanLatency = latencies.reduce((a, b) => a + b, 0) / records.length;
  const p95Latency = [...latencies].sort((a, b) => a - b)[Math.floor(records.length * 0.95)] ?? 0;
  console.log(`LATENCY (sum of all LLM calls per query)`);
  console.log(`  Mean: ${(meanLatency / 1000).toFixed(1)}s`);
  console.log(`  P95:  ${(p95Latency / 1000).toFixed(1)}s`);
  console.log();

  // Synthesis call analysis
  const llm1Records = records.filter(r => r.llm1);
  const synthesisStopReasons = new Map<string, number>();
  for (const r of llm1Records) {
    const reason = r.llm1?.stopReason ?? "(unknown)";
    synthesisStopReasons.set(reason, (synthesisStopReasons.get(reason) ?? 0) + 1);
  }
  console.log(`SYNTHESIS (Sonnet) STOP REASONS`);
  for (const [reason, count] of synthesisStopReasons.entries()) {
    const pct = (count / llm1Records.length * 100).toFixed(0);
    console.log(`  ${reason.padEnd(20)} ${count.toString().padStart(4)}  (${pct}%)`);
  }
  maybeWarn(
    Boolean(synthesisStopReasons.get("max_tokens")),
    llm1Records.length,
    `  ⚠️  max_tokens stop_reason indicates synthesis was truncated. Consider raising max_tokens.`,
  );
  console.log();

  // Retry rate
  const retryCount = records.filter(r => r.llm2Retry).length;
  console.log(`COLLAPSE-RETRY RATE`);
  console.log(`  ${retryCount} of ${records.length} queries triggered the synthesis-only-collapse retry  (${(retryCount / records.length * 100).toFixed(0)}%)`);
  console.log();

  // Pass 1 (relevance-pass-1) stats
  const pass1Records = records.filter(r => r.pass1);
  if (pass1Records.length > 0) {
    const drops = pass1Records.map(r => (r.pass1?.dropped ?? 0));
    const ins = pass1Records.map(r => (r.pass1?.in ?? 0));
    const meanScores = pass1Records.map(r => (r.pass1?.mean ?? 0)).filter(m => m > 0);
    const meanDropPct = (drops.reduce((a, b) => a + b, 0) / ins.reduce((a, b) => a + b, 0)) * 100;
    const meanScore = meanScores.reduce((a, b) => a + b, 0) / Math.max(1, meanScores.length);
    console.log(`PASS 2A — LLM-Relevance-Filter (pre-synthesis)`);
    console.log(`  Queries: ${pass1Records.length}`);
    console.log(`  Mean drop rate: ${meanDropPct.toFixed(0)}%`);
    console.log(`  Mean LLM score: ${meanScore.toFixed(1)} / 10`);
    maybeWarn(
      meanScore < 4,
      pass1Records.length,
      `  ⚠️  Mean score < 4 suggests Pass 1 admits too much noise OR queries don't match the DB well.`,
    );
    console.log();
  }

  // Pass 2 (relevance-pass-2) stats
  const pass2Records = records.filter(r => r.pass2);
  if (pass2Records.length > 0) {
    const drops = pass2Records.map(r => (r.pass2?.dropped ?? 0));
    const ins = pass2Records.map(r => (r.pass2?.in ?? 0));
    const meanDropPct = (drops.reduce((a, b) => a + b, 0) / ins.reduce((a, b) => a + b, 0)) * 100;
    console.log(`PASS 2B — LLM-Relevance-Filter (post-augment, for UI)`);
    console.log(`  Queries: ${pass2Records.length}`);
    console.log(`  Mean drop rate: ${meanDropPct.toFixed(0)}%`);
    console.log();
  }

  // Pass 3 (coverage-critique) stats
  const pass3Records = records.filter(r => r.pass3);
  if (pass3Records.length > 0) {
    const ceilings = pass3Records.map(r => (r.pass3?.ceiling ?? 0));
    const meanCeiling = ceilings.reduce((a, b) => a + b, 0) / pass3Records.length;
    const lowCeiling = ceilings.filter(c => c < 0.5).length;
    const highCeiling = ceilings.filter(c => c >= 0.7).length;
    const totalGaps = pass3Records.reduce((a, r) => a + (r.pass3?.gaps ?? 0), 0);
    console.log(`PASS 3 — Coverage-Critique`);
    console.log(`  Queries: ${pass3Records.length}`);
    console.log(`  Mean confidence-ceiling: ${(meanCeiling * 100).toFixed(0)}%`);
    console.log(`  Low ceilings (< 50%):    ${lowCeiling} (${(lowCeiling / pass3Records.length * 100).toFixed(0)}%)`);
    console.log(`  High ceilings (≥ 70%):   ${highCeiling} (${(highCeiling / pass3Records.length * 100).toFixed(0)}%)`);
    console.log(`  Total coverage-gaps detected: ${totalGaps}`);
    maybeWarn(
      lowCeiling / pass3Records.length > 0.4,
      pass3Records.length,
      `  ⚠️  >40% of queries get low ceiling — DB likely too sparse for the question domain.`,
    );
    console.log();
  }

  // Confidence-clamp activations
  const clampRecords = records.filter(r => r.clamp);
  if (clampRecords.length > 0) {
    const drops = clampRecords.map(r => (r.clamp!.fromPct! - r.clamp!.toPct!));
    const meanDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    console.log(`PASS 3 — Confidence-Clamp activations`);
    console.log(`  Queries: ${clampRecords.length} of ${records.length}  (${(clampRecords.length / records.length * 100).toFixed(0)}%)`);
    console.log(`  Mean drop: ${meanDrop.toFixed(0)}pp (synthesis was over-confident vs Pass 3 ceiling)`);
    maybeWarn(
      clampRecords.length / records.length > 0.5,
      records.length,
      `  ⚠️  Sonnet ignores the ceiling instruction in >50% of cases. Consider strengthening the prompt.`,
    );
    console.log();
  }

  console.log(`═══════════════════════════════════════════════════════════════`);
}

// ───────────────────────────────────────────────────────────────────────
// Entry point — read from stdin or file argument
// ───────────────────────────────────────────────────────────────────────

const fileArg = process.argv[2];
let input = "";

if (fileArg) {
  try {
    input = fs.readFileSync(fileArg, "utf8");
  } catch (e) {
    console.error(`Could not read ${fileArg}: ${(e as Error).message}`);
    process.exit(1);
  }
} else if (!process.stdin.isTTY) {
  // Read from piped stdin
  input = fs.readFileSync(0, "utf8");
} else {
  console.error(`Usage: telemetry-aggregate /path/to/server.log`);
  console.error(`   or: cat server.log | telemetry-aggregate`);
  process.exit(1);
}

const records = parseLog(input);
report(records);
