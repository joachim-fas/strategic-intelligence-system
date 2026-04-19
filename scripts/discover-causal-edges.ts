/**
 * scripts/discover-causal-edges.ts — Notion-Plan P1-4 Phase 1 (#14).
 *
 * Der kuratierte Kausal-Graph (`src/lib/causal-graph.ts`) hat aktuell
 * ~102 manuell gepflegte Kanten. Bei Wachstum auf 200+ Trends skaliert
 * das nicht — das Pflege-Backlog explodiert, blinde Flecken entstehen.
 *
 * Dieses Script läuft täglich (oder manuell) und generiert Edge-
 * Vorschläge aus Co-Occurrence in den Live-Signals der letzten 30 Tage:
 *
 *   1. Alle matchedTrends-Paare aus project_queries.result extrahieren
 *   2. Paare mit >= 3 gemeinsamen Auftritten → Kandidat
 *   3. Haiku-Call: "Ist das Korrelation oder Kausation?"
 *   4. Hypothesen-Ergebnis in edge_proposals-Tabelle schreiben
 *   5. Admin-UI (später) zeigt Vorschläge, User akzeptiert/ablehnt
 *
 * **Schreibt nicht direkt in causal-graph.ts.** Alle Vorschläge müssen
 * menschlich reviewed werden — das Ziel ist NICHT Automation des Graphs,
 * sondern Beschleunigung des Kurators durch datengetriebene Kandidaten.
 *
 * Aufruf:
 *   npm run edges:discover          # nur neue Paare, keine Duplikate
 *   npm run edges:discover -- --dry # nur Liste, kein DB-Write
 *
 * Idempotent: Paar (A,B) wird übersprungen wenn es schon als Vorschlag
 * existiert ODER schon im kuratierten Graph ist.
 */

import Database from "better-sqlite3";
import path from "path";
import { resolveEnv } from "../src/lib/env";

const LOOKBACK_DAYS = 30;
const MIN_COOCCURRENCE = 3;
const HAIKU_MODEL = "claude-haiku-4-5";
const RATE_LIMIT_MS = 800;

interface TrendPair {
  trendAId: string;
  trendBId: string;
  trendAName: string;
  trendBName: string;
  coOccurrences: number;
}

interface EdgeHypothesis {
  causal: boolean;
  type: "drives" | "amplifies" | "dampens" | null;
  direction: "a_to_b" | "b_to_a" | null;
  strength: 1 | 2 | 3 | null;
  rationale: string;
}

function ensureEdgeProposalsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS edge_proposals (
      id TEXT PRIMARY KEY,
      trend_a_id TEXT NOT NULL,
      trend_b_id TEXT NOT NULL,
      type TEXT NOT NULL,
      direction TEXT NOT NULL,
      strength INTEGER NOT NULL,
      rationale TEXT NOT NULL,
      co_occurrences INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      UNIQUE(trend_a_id, trend_b_id, direction)
    )
  `);
}

function findCoOccurrencePairs(db: Database.Database): TrendPair[] {
  // Alle query-results der letzten N Tage auslesen und matchedTrendIds sammeln
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();
  const rows = db.prepare(`
    SELECT result FROM project_queries
    WHERE created_at > ?
    AND result IS NOT NULL
  `).all(cutoff) as Array<{ result: string }>;

  const counts = new Map<string, number>();
  for (const row of rows) {
    try {
      const r = JSON.parse(row.result);
      const ids: string[] = Array.isArray(r.matchedTrendIds) ? r.matchedTrendIds : [];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          // Deterministisch sortieren damit (A,B) == (B,A)
          const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
          const key = `${a}::${b}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    } catch {
      // skip malformed results
    }
  }

  // Namen zu IDs auflösen
  const trendNames = new Map<string, string>();
  const trendRows = db.prepare("SELECT id, name FROM trends WHERE status != 'archived'").all() as Array<{ id: string; name: string }>;
  for (const t of trendRows) trendNames.set(t.id, t.name);

  const pairs: TrendPair[] = [];
  for (const [key, count] of counts) {
    if (count < MIN_COOCCURRENCE) continue;
    const [a, b] = key.split("::");
    const nameA = trendNames.get(a);
    const nameB = trendNames.get(b);
    if (!nameA || !nameB) continue;
    pairs.push({ trendAId: a, trendBId: b, trendAName: nameA, trendBName: nameB, coOccurrences: count });
  }

  // Nach Co-Occurrence-Count absteigend sortieren — die heißesten Paare zuerst
  pairs.sort((x, y) => y.coOccurrences - x.coOccurrences);
  return pairs;
}

async function askLLMForCausality(pair: TrendPair, apiKey: string): Promise<EdgeHypothesis | null> {
  const prompt = `Du bist ein Systemanalyst. Prüfe ob zwischen zwei Trends eine KAUSALE Beziehung existiert — nicht nur Korrelation.

Trend A: ${pair.trendAName}
Trend B: ${pair.trendBName}
Kontext: Diese beiden Trends tauchen in ${pair.coOccurrences} Briefings der letzten ${LOOKBACK_DAYS} Tage gemeinsam auf.

Aufgabe: Entscheide ob es eine kausale Beziehung gibt und welche.

Antworte mit JSON exakt dieser Form (keine Erklärung, kein Markdown):
{
  "causal": true|false,
  "type": "drives" | "amplifies" | "dampens" | null,   // null wenn causal:false
  "direction": "a_to_b" | "b_to_a" | null,              // null wenn causal:false
  "strength": 1 | 2 | 3 | null,                         // 1=schwach, 2=mittel, 3=stark
  "rationale": "string"                                 // Ein Satz Begründung
}

Nur "causal":true wenn einer der beiden Trends den anderen nachweislich beeinflusst. Reine thematische Nähe ist KEINE Kausation.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 400,
        system: "Antworte nur mit dem geforderten JSON-Objekt. Kein Begleittext.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return parsed as EdgeHypothesis;
  } catch (e) {
    console.error("[edges] LLM-Call failed:", e);
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomId(): string {
  return `ep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) { console.error("ANTHROPIC_API_KEY fehlt"); process.exit(1); }

  const db = new Database(path.join(process.cwd(), "local.db"));
  db.pragma("journal_mode = WAL");

  ensureEdgeProposalsTable(db);

  const pairs = findCoOccurrencePairs(db);
  console.log(`[edges] ${pairs.length} Co-Occurrence-Paare ≥ ${MIN_COOCCURRENCE} gefunden.`);

  // Bestehende Proposals + kuratierte Edges ausschließen
  const existingProposals = db.prepare("SELECT trend_a_id, trend_b_id FROM edge_proposals").all() as Array<{ trend_a_id: string; trend_b_id: string }>;
  const existingSet = new Set(existingProposals.map((p) => `${p.trend_a_id}::${p.trend_b_id}`));

  const candidates = pairs.filter((p) => !existingSet.has(`${p.trendAId}::${p.trendBId}`));
  console.log(`[edges] ${candidates.length} neue Kandidaten (nach Deduplizierung).`);

  if (candidates.length === 0) {
    console.log("[edges] Nichts zu tun.");
    db.close();
    return;
  }

  const insert = db.prepare(`
    INSERT INTO edge_proposals
    (id, trend_a_id, trend_b_id, type, direction, strength, rationale, co_occurrences, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  let causalCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Max 50 pro Lauf — begrenzt Kosten bei großen Paar-Mengen
  const limit = Math.min(candidates.length, 50);
  for (let i = 0; i < limit; i++) {
    const pair = candidates[i];
    process.stdout.write(`  [${i + 1}/${limit}] ${pair.trendAName} × ${pair.trendBName} (${pair.coOccurrences}x) … `);

    const hyp = await askLLMForCausality(pair, apiKey);
    if (!hyp) {
      failCount++;
      console.log("FAIL");
      continue;
    }
    if (!hyp.causal || !hyp.type || !hyp.direction || !hyp.strength) {
      skipCount++;
      console.log("no causation");
      continue;
    }
    causalCount++;
    console.log(`${hyp.type}/${hyp.direction}/strength:${hyp.strength}`);
    if (!dry) {
      insert.run(
        randomId(),
        pair.trendAId,
        pair.trendBId,
        hyp.type,
        hyp.direction,
        hyp.strength,
        hyp.rationale,
        pair.coOccurrences,
        new Date().toISOString(),
      );
    }
    await sleep(RATE_LIMIT_MS);
  }

  db.close();
  console.log(`\n[edges] Fertig. ${causalCount} neue Vorschläge, ${skipCount} als nicht-kausal verworfen, ${failCount} fehlgeschlagen.`);
  console.log(`[edges] Review unter /admin/edge-proposals (Admin-UI kommt in P1-4 Phase 2).`);
}

main().catch((e) => { console.error("[edges] Fatal:", e); process.exit(1); });
