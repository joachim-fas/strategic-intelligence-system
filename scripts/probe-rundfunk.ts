#!/usr/bin/env tsx
import { getRelevantSignals, extractQueryKeywords } from "../src/lib/signals";

const query = "Welchen Einfluss hat der öffentliche Rundfunk auf die Gesellschaft in Deutschland und Österreich?";

console.log(`Query: ${query}\n`);
console.log(`Keywords: ${extractQueryKeywords(query).join(", ")}\n`);

const signals = getRelevantSignals(query, 30);
console.log(`Retrieved: ${signals.length} signals\n`);

// Group by source
const bySource = new Map<string, number>();
for (const s of signals) {
  bySource.set(s.source, (bySource.get(s.source) ?? 0) + 1);
}
console.log(`Sources:`);
for (const [src, n] of [...bySource.entries()].sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${n.toString().padStart(2)}× ${src}`);
}

console.log(`\nAll titles with passReason + displayScore:`);
for (const s of signals) {
  const ds = s.displayScore?.toFixed(2) ?? "?";
  const ko = s.keywordOverlap?.toFixed(2) ?? "?";
  const reason = s.passReason ?? "?";
  console.log(`  [${s.source}] (overlap=${ko} display=${ds} via=${reason})`);
  console.log(`     ${s.title.slice(0, 110)}`);
}
