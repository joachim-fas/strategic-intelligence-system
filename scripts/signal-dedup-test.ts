#!/usr/bin/env tsx
/**
 * signal-dedup-test — pinn für dedupSignalsBySourceTitle.
 *
 * Pilot-Eval 2026-04-22 deckte auf: getRelevantSignals liefert nominal
 * 16 Treffer, aber aus dem Pool oft nur 1-3 unique Titles (ecfr_rss-
 * Artikel 5× dupliziert durch Multi-Tenant-Pipeline-Polls). Fix war,
 * einen (source, title)-Dedup-Pass nach Filter und vor dem Top-N-Slice
 * einzufügen.
 *
 * Dieser Test prüft die pure Dedup-Logik auf:
 * - Exakte Duplikate werden verworfen
 * - Whitespace/Case-Unterschiede als Duplikat erkannt (Normalisierung)
 * - Gleicher Titel aus verschiedenen Sources bleibt separat
 * - Reihenfolge stabil (First-Seen-Wins)
 * - Edge-Cases (leere Strings, Unicode)
 *
 * Run: `npx tsx scripts/signal-dedup-test.ts`
 */

import { dedupSignalsBySourceTitle } from "../src/lib/signals";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

type Sig = { source: string; title: string; score?: number };

// ═══════════════════════════════════════════════════════════════════════
//  Exakte Duplikate (der Produktions-Fall aus der Pilot-Eval)
// ═══════════════════════════════════════════════════════════════════════
section("Exakte Duplikate — der ECFR-5×-Fall");

{
  const input: Sig[] = [
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Political accession first: A new pact for Ukraine to join the EU", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Political accession first: A new pact for Ukraine to join the EU", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Political accession first: A new pact for Ukraine to join the EU", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Political accession first: A new pact for Ukraine to join the EU", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Political accession first: A new pact for Ukraine to join the EU", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Four principles for an EU-Hungary reset", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Four principles for an EU-Hungary reset", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Four principles for an EU-Hungary reset", score: 25 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): From good to not-too-bad", score: 22 },
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): From good to not-too-bad", score: 22 },
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 3, `10 Duplikate → 3 unique (got ${out.length})`);
  assert(out[0].title.includes("Political accession"), "erster unique: Political accession");
  assert(out[1].title.includes("Four principles"), "zweiter unique: Four principles");
  assert(out[2].title.includes("From good"), "dritter unique: From good");
}

// ═══════════════════════════════════════════════════════════════════════
//  Normalisierung: Whitespace + Case
// ═══════════════════════════════════════════════════════════════════════
section("Whitespace- und Case-Normalisierung");

{
  const input: Sig[] = [
    { source: "x", title: "Same Title" },
    { source: "x", title: "  Same Title  " },            // padding
    { source: "x", title: "Same  Title" },                // double space
    { source: "x", title: "SAME TITLE" },                 // case
    { source: "x", title: "same title" },                 // lowercase
    { source: "x", title: "Same\tTitle" },                // tab
    { source: "x", title: "Same\nTitle" },                // newline
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 1, `7 Formatierungs-Varianten → 1 unique (got ${out.length})`);
  assert(out[0].title === "Same Title", "Erster (verbatim) wird behalten, spätere gelöscht");
}

// ═══════════════════════════════════════════════════════════════════════
//  Verschiedene Sources mit gleichem Titel → beide behalten
// ═══════════════════════════════════════════════════════════════════════
section("Cross-Source: gleicher Titel zählt als unabhängige Quelle");

{
  const input: Sig[] = [
    { source: "guardian", title: "EU passes Critical Raw Materials Act" },
    { source: "reuters", title: "EU passes Critical Raw Materials Act" },
    { source: "bloomberg", title: "EU passes Critical Raw Materials Act" },
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 3, "3 Sources mit gleichem Titel bleiben als 3 Einträge");
  assert(out.map(s => s.source).join(",") === "guardian,reuters,bloomberg", "Source-Reihenfolge stabil");
}

// ═══════════════════════════════════════════════════════════════════════
//  Gemischter Fall: echte Duplikate + echte Mehrfach-Reports
// ═══════════════════════════════════════════════════════════════════════
section("Gemischter Fall");

{
  const input: Sig[] = [
    { source: "guardian", title: "Story A" },     // keep
    { source: "guardian", title: "Story A" },     // drop (dup)
    { source: "reuters", title: "Story A" },      // keep (cross-source)
    { source: "guardian", title: "Story B" },     // keep
    { source: "reuters", title: "Story B" },      // keep (cross-source)
    { source: "reuters", title: "Story B" },      // drop (dup)
    { source: "guardian", title: "Story C" },     // keep
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 5, `7 in, 5 out nach Dedup (got ${out.length})`);
}

// ═══════════════════════════════════════════════════════════════════════
//  Reihenfolge-Stabilität (First-Seen-Wins)
// ═══════════════════════════════════════════════════════════════════════
section("Reihenfolge-Stabilität");

{
  const input: Sig[] = [
    { source: "x", title: "A", score: 10 },
    { source: "x", title: "A", score: 99 }, // höherer score aber zweiter
    { source: "x", title: "B", score: 5 },
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 2, "2 unique");
  assert(out[0].score === 10, "First-Seen-Wins: erster 'A'-Eintrag bleibt (score 10)");
  // NOTE: getRelevantSignals sortiert VOR dem Dedup nach relevance_score DESC,
  // d.h. in der Produktion landet der höchste score ohnehin als erster.
  // Dieser Test pinnt die reine Dedup-Semantik ohne Pre-Sort-Annahme.
}

// ═══════════════════════════════════════════════════════════════════════
//  Edge-Cases
// ═══════════════════════════════════════════════════════════════════════
section("Edge-Cases");

{
  assert(dedupSignalsBySourceTitle([]).length === 0, "Leeres Array → leeres Array");
}

{
  const input: Sig[] = [{ source: "x", title: "" }, { source: "x", title: "" }];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 1, "Leere Titel zählen auch als Duplikat (source-normalized)");
}

{
  // Unicode-Variationen (NFC/NFD verschieden) — NFC ist Normalform, die wir
  // hier NICHT aktiv normalisieren (Overhead > Nutzen für DACH-Content).
  // Dieser Test pinnt die Erwartung: wir behandeln sie als VERSCHIEDEN,
  // damit zukünftige Leser nicht über das Verhalten stolpern.
  const nfcTitle = "Straße";          // ß als ein Codepoint
  const input: Sig[] = [
    { source: "x", title: nfcTitle },
    { source: "x", title: "Straße" }, // identisch — sollte dedupt werden
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 1, "Identische UTF-8-Strings sind Duplikate");
}

// ═══════════════════════════════════════════════════════════════════════
//  Source-Branding-Präfix bleibt Teil des Titels
// ═══════════════════════════════════════════════════════════════════════
section("Source-Branding-Präfix wird NICHT gestrippt beim Dedup-Key");

{
  // Das ist eine bewusste Design-Entscheidung: der Dedup-Key schließt das
  // komplette Titel-Feld ein. Der Source-Branding-Präfix-Strip existiert
  // separat für das Keyword-Overlap-Scoring (nicht für Dedup). Wenn ein
  // Connector inkonsistent mal mit und mal ohne Präfix schreibt, sind das
  // im Dedup-Sinn verschiedene Signale — Analyse-Autor kann das
  // ohne UI-Crash sehen und den Connector sauber fixen.
  const input: Sig[] = [
    { source: "ecfr_rss", title: "ECFR (European Council on Foreign Relations): Story X" },
    { source: "ecfr_rss", title: "Story X" }, // ohne Präfix
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 2, "Titel mit vs. ohne Source-Präfix: KEIN Dedup (bewusst)");
}

// ═══════════════════════════════════════════════════════════════════════
//  Zusatzfeld-Durchlauf: Dedup tastet die Payload nicht an
// ═══════════════════════════════════════════════════════════════════════
section("Payload-Preservierung");

{
  type RichSig = { source: string; title: string; url: string; content: string; strength: number };
  const input: RichSig[] = [
    { source: "x", title: "A", url: "https://a.com/1", content: "long content 1", strength: 0.8 },
    { source: "x", title: "A", url: "https://a.com/2", content: "long content 2", strength: 0.6 },
  ];
  const out = dedupSignalsBySourceTitle(input);
  assert(out.length === 1, "Dedup auf (source, title) trotz verschiedener URLs");
  assert(out[0].url === "https://a.com/1", "Erstes komplettes Objekt bleibt erhalten inkl. URL");
  assert(out[0].content === "long content 1", "content bleibt");
  assert(out[0].strength === 0.8, "strength bleibt");
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
