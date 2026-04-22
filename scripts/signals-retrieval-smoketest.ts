#!/usr/bin/env tsx
/**
 * signals-retrieval-smoketest — offline validation of getRelevantSignals()
 * for the three Pilot-Eval-Queries (B EN, C DE, C EN) before burning
 * live LLM calls.
 *
 * Why: between 2026-04-21 and 2026-04-22 we made four successive fixes
 * to the relevance pipeline (anchor-position, academic/authoritative
 * bypass, long-domain-anchor bypass, reverse EN→DE aliases). Each fix
 * was reasoned, but each was also discovered the hard way — by running
 * a 60–200 s LLM query and seeing 0 signals. This script breaks that
 * loop by simulating the retrieval offline so we know BEFORE the live
 * run whether signals will reach the prompt.
 *
 * Run: `npx tsx scripts/signals-retrieval-smoketest.ts`
 *
 * Pass criteria (per query):
 *   - signals.length >= 5 (otherwise the LLM has nothing to ground on)
 *   - top sources include the expected domain feed
 *     (B EN: arxiv* / academic; C DE: google_news_wp_de; C EN: google_news_hp_en)
 */

import { getRelevantSignals } from "../src/lib/signals";

interface Probe {
  name: string;
  query: string;
  expectedSources: string[];
  minSignals: number;
  /**
   * 2026-04-23 Noise-Regression-Erweiterung: optional ceiling on signal
   * count. When set, more than `maxSignals` signals coming back is
   * treated as a noise-leak failure (typically because a generic word
   * like a country name has matched everywhere it shouldn't).
   */
  maxSignals?: number;
  /**
   * 2026-04-23 Noise-Regression-Erweiterung: optional list of source
   * names that must NOT appear. Used for queries where certain sources
   * leaking through is a known anti-pattern (e.g. usgs-earthquake on a
   * Rundfunk query — was the original report bug ff19ba5 was fixing).
   */
  forbiddenSources?: string[];
}

const PROBES: Probe[] = [
  {
    name: "B EN — Autonomous AI agents in European labor markets",
    query:
      "How will autonomous AI agents reshape European labor markets in the next decade? " +
      "Which sectors are most exposed, and what structural interventions in regulation, " +
      "education and social systems are most effective at closing the biggest looming " +
      "gap between political reality and labor displacement?",
    expectedSources: ["arxiv", "arxiv_econ_rss", "ecfr_rss", "iab_rss", "ecipe_rss"],
    minSignals: 5,
  },
  {
    name: "C DE — Wärmepumpen-Adoption in Deutschland",
    query:
      "Wie skaliert die Wärmepumpen-Adoption in Deutschland bis 2030? " +
      "Welche regulatorischen, ökonomischen und technologischen Faktoren sind die " +
      "größten Hebel und Bremsen, und welche EU-Politikinstrumente haben den " +
      "stärksten Einfluss auf das Marktwachstum?",
    expectedSources: ["google_news_wp_de"],
    // 2026-04-23 Multi-Evidence-Gate: lowered from 5 → 3.
    // The C-DE query has many short generic news titles in
    // `google_news_wp_de` that match only "wärmepumpen" — single-keyword
    // matches no longer pass the multi-evidence gate. Drops single-match
    // atmospheric signals; keeps high-quality multi-match. The pilot-eval
    // 91% score depended on multi-match signals, not solitary matches.
    minSignals: 3,
  },
  {
    name: "C EN — Heat pump regulatory penetration in Europe",
    query:
      "How will heat pump regulatory penetration scale across Europe by 2030? " +
      "What are the largest economic and technological levers and barriers, and " +
      "which EU policy instruments most strongly shape market adoption?",
    expectedSources: ["google_news_hp_en", "google_news_wp_de"],
    minSignals: 5,
  },
  {
    // 2026-04-23 Noise-Regression-Probe (promoted from probe-rundfunk.ts).
    //
    // Original report: a Rundfunk-Query produced 30 signals, 27 of them
    // off-topic (heat-pump articles, Iran-war news, USGS earthquakes —
    // anything containing "Deutschland"). Root cause was the
    // `long-domain-anchor` bypass admitting single-keyword matches on
    // common long words like country names. Fix in ff19ba5 retired the
    // bypass and replaced it with the multi-evidence-gate.
    //
    // This probe pins that fix: the Rundfunk query has no real DB-backed
    // sources (no broadcasting connectors), so it should return VERY FEW
    // signals — and never the noise-class (heat-pump, earthquakes,
    // prediction markets, social posts).
    //
    // If this probe ever shows >8 signals OR includes any forbidden
    // source, the noise-leak bug has regressed.
    name: "Rundfunk noise-regression — should NOT leak heat-pump/earthquake/etc.",
    query:
      "Welchen Einfluss hat der öffentliche Rundfunk auf die Gesellschaft in Deutschland und Österreich?",
    // We don't strictly require any specific source — DB simply lacks
    // broadcasting connectors. The point is what should NOT come back.
    // Listing ECFR/OSW as "expected" because they were the only legit
    // matches we saw (multi-match on Germany + governance/security
    // keywords). The expectedSources check tolerates either being
    // present, but the real test is below.
    expectedSources: ["ecfr_rss", "osw_rss"],
    minSignals: 0,
    maxSignals: 8,
    forbiddenSources: [
      "usgs-earthquake",
      "google_news_hp_en",
      "google_news_wp_de",
      "polymarket",
      "manifold",
      "kalshi",
      "metaculus",
      "bluesky",
      "mastodon_api",
      "reddit",
      "finnhub",
      "coingecko",
    ],
  },
];

let allPassed = true;

for (const probe of PROBES) {
  console.log(`\n▸ ${probe.name}`);
  console.log(`  query: "${probe.query.slice(0, 100)}..."`);

  const t0 = Date.now();
  const signals = getRelevantSignals(probe.query, 30);
  const dt = Date.now() - t0;

  console.log(`  → ${signals.length} signals (${dt} ms)`);

  if (signals.length === 0) {
    if (probe.minSignals === 0) {
      console.log(`  ✓ 0 signals (acceptable for this probe — minSignals=0)`);
      console.log(`  ✓ PASS`);
      continue;
    }
    console.log(`  ✗ FAIL: 0 signals returned`);
    allPassed = false;
    continue;
  }

  const sourceCounts = new Map<string, number>();
  for (const s of signals) {
    sourceCounts.set(s.source, (sourceCounts.get(s.source) ?? 0) + 1);
  }
  const sortedSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  console.log(`  top sources:`);
  for (const [src, n] of sortedSources) {
    const tier = signals.find(s => s.source === src)?.sourceTier ?? "?";
    const expected = probe.expectedSources.includes(src) ? " ★" : "";
    console.log(`    ${n.toString().padStart(2)}× ${src} [${tier}]${expected}`);
  }

  console.log(`  top 5 titles:`);
  for (const s of signals.slice(0, 5)) {
    const overlap = s.keywordOverlap?.toFixed(2) ?? "?";
    const display = s.displayScore?.toFixed(2) ?? "?";
    const reason = s.passReason ?? "?";
    console.log(`    [${s.source}] (overlap=${overlap} display=${display} via=${reason}) ${s.title.slice(0, 70)}`);
  }

  // 2026-04-23 Layered-Filter-Architecture-Fix verification:
  // every retrieved signal must carry both passReason and displayScore,
  // and displayScore must be ≥ keywordOverlap (the floor invariant).
  let invariantOK = true;
  for (const s of signals) {
    if (!s.passReason) { invariantOK = false; console.log(`  ✗ missing passReason on ${s.source}`); break; }
    if (typeof s.displayScore !== "number") { invariantOK = false; console.log(`  ✗ missing displayScore on ${s.source}`); break; }
    if (typeof s.keywordOverlap === "number" && s.displayScore < s.keywordOverlap) {
      invariantOK = false;
      console.log(`  ✗ displayScore<keywordOverlap on ${s.source} (${s.displayScore} < ${s.keywordOverlap})`);
      break;
    }
  }
  if (invariantOK) {
    console.log(`  ✓ passReason + displayScore invariants hold on all ${signals.length} signals`);
  } else {
    allPassed = false;
  }

  // Pass criteria
  let probePassed = true;

  // Min-signal floor
  if (signals.length < probe.minSignals) {
    console.log(`  ✗ FAIL: only ${signals.length} signals, need ≥${probe.minSignals}`);
    probePassed = false;
  }

  // Max-signal ceiling (noise-regression probes)
  if (typeof probe.maxSignals === "number" && signals.length > probe.maxSignals) {
    console.log(
      `  ✗ FAIL (noise-leak): ${signals.length} signals returned, ceiling is ${probe.maxSignals}. ` +
      `Likely cause: a generic word in the query is matching too broadly.`,
    );
    probePassed = false;
  }

  // Forbidden-sources check (noise-regression probes)
  if (Array.isArray(probe.forbiddenSources) && probe.forbiddenSources.length > 0) {
    const leaked = probe.forbiddenSources.filter(src => sourceCounts.has(src));
    if (leaked.length > 0) {
      console.log(
        `  ✗ FAIL (forbidden-source-leak): [${leaked.join(", ")}] should NOT appear in this query's results`,
      );
      probePassed = false;
    }
  }

  // Expected-sources check (only meaningful when minSignals > 0)
  if (probe.minSignals > 0) {
    const expectedHit = probe.expectedSources.some(src => sourceCounts.has(src));
    if (!expectedHit) {
      console.log(`  ⚠ WARN: none of expected sources [${probe.expectedSources.join(", ")}] in top signals`);
      probePassed = false;
    }
  }

  if (probePassed) {
    console.log(`  ✓ PASS`);
  } else {
    allPassed = false;
  }
}

console.log(`\n─────────────────────────────────────────`);
console.log(allPassed ? "ALL GREEN — ready for live runs" : "RED — fix retrieval before running live");
console.log(`─────────────────────────────────────────`);
process.exit(allPassed ? 0 : 1);
