#!/usr/bin/env tsx
/**
 * signal-retrieval-debug — zeigt den Signal-Retrieval-Pfad für eine
 * Query step-by-step. Benutzt, wenn eine Query live mit `0 Signale`
 * landet, obwohl Connectors laufen und die DB Signale hat.
 *
 * Ausgabe pro Query:
 *   1. extrahierte Keywords
 *   2. welche Signale DB-weit überhaupt existieren (Sample)
 *   3. was getRelevantSignals() zurückgibt
 *   4. falls leer: Keyword-by-Keyword welche Signale tref würden (ohne
 *      Anchor-Filter, ohne Overlap-Schwelle), zum Debug warum der
 *      Filter so scharf greift
 *
 * Run: `npx tsx scripts/signal-retrieval-debug.ts "<Query-String>"`
 */

import Database from "better-sqlite3";
import path from "path";
import {
  extractQueryKeywords,
  computeKeywordStats,
  classifySource,
  getRelevantSignals,
} from "../src/lib/signals";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error("Usage: signal-retrieval-debug <query>");
  process.exit(1);
}

console.log(`\n🔎 Query: "${query}"\n`);

// ── 1) Keywords ─────────────────────────────────────────────────────────
const keywords = extractQueryKeywords(query);
console.log("1) Extrahierte Keywords (Original, DE):");
console.log(`   ${keywords.join(", ")}`);
console.log(`   (${keywords.length} Keywords, davon ${keywords.filter(k => k.length >= 5).length} Anchors ≥5 chars)`);

// Aliased view — mirror the CROSS_LANG_ALIASES logic in getRelevantSignals
// so we can see exactly which expanded set goes into the SQL
const QUICK_ALIASES: Record<string, string[]> = {
  lieferketten: ["supply chain", "supply chains"],
  lieferkette: ["supply chain"],
  fragmentierung: ["fragmentation"],
  deutschland: ["germany", "german"],
  europa: ["europe", "european", "eu"],
  industrielles: ["industrial", "industry"],
  wärmepumpen: ["heat pumps", "heat pump"],
  wärmepumpe: ["heat pump"],
  arbeitsmarkt: ["labor market", "labour market"],
  gesellschaft: ["society", "social"],
  resilienz: ["resilience"],
  automatisierung: ["automation"],
  souveränität: ["sovereignty"],
};
const expanded = new Set(keywords);
const lowerQ = query.toLowerCase();
for (const [ak, group] of Object.entries(QUICK_ALIASES)) {
  if (lowerQ.includes(ak) || keywords.includes(ak)) {
    for (const a of group) expanded.add(a);
  }
}
const aliasOnly = Array.from(expanded).filter(x => !keywords.includes(x));
if (aliasOnly.length > 0) {
  console.log(`   + ${aliasOnly.length} Aliase: ${aliasOnly.join(", ")}`);
}

// ── 2) DB-Gesamtlage ────────────────────────────────────────────────────
const dbPath = path.join(process.cwd(), "local.db");
const d = new Database(dbPath, { readonly: true });

const total = d.prepare("SELECT COUNT(*) as c FROM live_signals").get() as { c: number };
const fresh = d.prepare(`SELECT COUNT(*) as c FROM live_signals WHERE fetched_at > datetime('now', '-336 hours')`).get() as { c: number };
const bySource = d.prepare(`
  SELECT source, COUNT(*) as c FROM live_signals
  WHERE fetched_at > datetime('now', '-336 hours')
  GROUP BY source ORDER BY c DESC LIMIT 12
`).all() as Array<{ source: string; c: number }>;

console.log(`\n2) DB-Status:`);
console.log(`   ${total.c} Signale gesamt, ${fresh.c} davon innerhalb der 14-Tage-Fensters`);
console.log(`   Top-Sources (14d):`);
for (const r of bySource) {
  console.log(`     · ${r.source.padEnd(20)} ${r.c}`);
}

// ── 3) getRelevantSignals ───────────────────────────────────────────────
const relevant = getRelevantSignals(query, 16);
console.log(`\n3) getRelevantSignals(query, 16) → ${relevant.length} Treffer`);
for (const s of relevant.slice(0, 10)) {
  const tier = classifySource(s.source);
  const overlap = (s as any).keywordOverlap;
  const pct = typeof overlap === "number" ? `${Math.round(overlap * 100)}%` : "–";
  console.log(`   [${tier.padEnd(13)}] [${pct.padStart(4)}] ${s.source.padEnd(20)} ${s.title.slice(0, 60)}`);
}
if (relevant.length === 0) {
  console.log(`   (leer — per-Signal-Diagnose in Schritt 3b)`);

  // ── 3b) Direct-SQL mit aliased Keywords + Filter-Trace ───────────────
  console.log(`\n3b) Direct-SQL mit aliased Keywords + Filter-Trace:`);
  const kwArr = Array.from(expanded).slice(0, 24);
  const scoreCase = kwArr.map(() =>
    `(CASE WHEN lower(title) LIKE ? THEN 2 ELSE 0 END +
     CASE WHEN lower(topic) LIKE ? THEN 3 ELSE 0 END +
     CASE WHEN lower(content) LIKE ? THEN 1 ELSE 0 END)`
  ).join(" + ");
  const params = kwArr.flatMap(kw => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);
  const raw = d.prepare(`
    SELECT source, title, topic, content, tags, (${scoreCase}) as score
    FROM live_signals
    WHERE fetched_at > datetime('now', '-336 hours')
      AND (${scoreCase}) >= 3
    ORDER BY score DESC LIMIT 10
  `).all([...params, ...params]) as Array<{ source: string; title: string; topic: string | null; content: string | null; tags: string | null; score: number }>;
  console.log(`   SQL-Treffer mit aliased keywords (${kwArr.length}): ${raw.length} Signale mit score ≥ 3`);
  for (const row of raw) {
    const signalText = [row.title, row.topic, row.content?.slice(0, 1000), row.tags]
      .filter(Boolean).join(" ");
    const stats = computeKeywordStats(kwArr, signalText);
    const tier = classifySource(row.source);
    const wOverlap = Math.round(stats.weightedOverlap * 100);
    const reason = !stats.anchorMatched
      ? "✗ anchor-miss"
      : stats.weightedOverlap < 0.25
        ? `✗ weighted ${wOverlap}% < tier-min`
        : "✓ pass";
    console.log(`   score=${row.score} weighted=${wOverlap}% anchor=${stats.anchorMatched ? "✓" : "✗"}  ${reason.padEnd(28)}  ${tier.padEnd(13)}  ${row.source.padEnd(16)}  ${row.title.slice(0, 52)}`);
  }
}

// ── 4) Debug: was hätten die einzelnen Keywords gefunden? ───────────────
console.log(`\n4) Per-Keyword LIKE-Debug (nur title, 14d-Fenster):`);
for (const kw of keywords) {
  const row = d.prepare(`
    SELECT COUNT(*) as c FROM live_signals
    WHERE fetched_at > datetime('now', '-336 hours')
      AND lower(title) LIKE ?
  `).get(`%${kw}%`) as { c: number };
  console.log(`   ${kw.padEnd(16)} ${row.c.toString().padStart(4)} Titel-Treffer`);
}

// ── 5) Debug: was wäre ohne Anchor- und Overlap-Filter? ─────────────────
if (relevant.length === 0 && keywords.length > 0) {
  console.log(`\n5) Ohne Anchor/Overlap — was der SQL alleine findet:`);
  const likeSql = keywords.slice(0, 10).map(() =>
    `(CASE WHEN lower(title) LIKE ? THEN 2 ELSE 0 END +
     CASE WHEN lower(topic) LIKE ? THEN 3 ELSE 0 END +
     CASE WHEN lower(content) LIKE ? THEN 1 ELSE 0 END)`
  ).join(" + ");
  const likeParams = keywords.slice(0, 10).flatMap(kw => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);
  const rows = d.prepare(`
    SELECT source, title, topic, (${likeSql}) as score
    FROM live_signals
    WHERE fetched_at > datetime('now', '-336 hours')
      AND (${likeSql}) >= 2
    ORDER BY score DESC
    LIMIT 15
  `).all([...likeParams, ...likeParams]) as Array<{ source: string; title: string; topic: string | null; score: number }>;
  console.log(`   ${rows.length} Treffer mit score ≥ 2:`);
  for (const r of rows) {
    const stats = computeKeywordStats(keywords, `${r.title} ${r.topic ?? ""}`);
    const tier = classifySource(r.source);
    console.log(`   [${tier.padEnd(13)}] score=${r.score} weighted=${Math.round(stats.weightedOverlap * 100)}% anchor=${stats.anchorMatched ? "✓" : "✗"}  ${r.source.padEnd(16)} ${r.title.slice(0, 60)}`);
  }
  if (rows.length === 0) {
    console.log(`   (keine Treffer — Content-Pool enthält keine matching Terms)`);
  }
}

d.close();

console.log(`\n✓ Done. Wenn Schritt 3 leer ist, aber Schritt 5 Treffer zeigt, ist der Filter zu scharf.`);
console.log(`  Wenn auch Schritt 5 leer ist, liefert die Query schlicht keine Content-Matches im aktuellen Pool.`);
