/**
 * scripts/enrich-trends.ts — einmaliges Batch-Script für Notion P1-3.
 *
 * Problem: Die 134 Trends in der live DB haben je eine generische Ein-
 * Satz-Beschreibung von durchschnittlich ~100 Zeichen. Bei "Artificial
 * Intelligence & Automation" steht z.B. "KI-Systeme automatisieren
 * Wissensarbeit..." — null analytischer Wert, keine Zahlen, keine
 * Datenpunkte. Wenn dieser Text in den System-Prompt injiziert wird
 * (`TREND: …`-Referenz), bringt er keinen Mehrwert fürs LLM.
 *
 * Fix: Ein LLM-Call pro Trend generiert eine 4-Satz-Beschreibung mit
 * konkretem Messwert, Treiber, und EU-strategischer Implikation. Ein
 * Claude-Haiku-Call kostet unter einem Cent, macht aber den Unterschied
 * zwischen "datendump" und "analyse-ready context".
 *
 * Aufruf:
 *   npm run trends:enrich              # nur noch unangetastete Trends
 *   npm run trends:enrich -- --force   # alle neu generieren (Kosten!)
 *   npm run trends:enrich -- --dry     # nur output, kein DB-write
 *
 * Idempotent: überspringt Trends, deren Description bereits ≥ 400 Zeichen
 * hat (die sind schon enriched) es sei denn --force gesetzt.
 */

import Database from "better-sqlite3";
import path from "path";
import { resolveEnv } from "../src/lib/env";

const MIN_ENRICHED_LENGTH = 400;
const HAIKU_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 800;
const RATE_LIMIT_MS = 800; // ~75 calls/min = sicher unter Anthropic-Limits

interface TrendRow {
  id: string;
  name: string;
  category: string;
  description: string;
}

function buildEnrichmentPrompt(trend: TrendRow): string {
  return `Du bist ein Think-Tank-Analyst. Beschreibe den Trend "${trend.name}" (Kategorie: ${trend.category}) in exakt 4 Sätzen auf Deutsch.

Satz 1: Definition und Scope — was genau ist dieser Trend, wo fängt er an, wo hört er auf.
Satz 2: Aktuelle Messbare Indikatoren mit konkreten Zahlen (Jahr, Prozentwert, Akteursname) — z.B. "Laut OECD 2025 sind 27% der Tätigkeiten in Hochlohnländern durch LLMs substituierbar".
Satz 3: Treiber — warum entfaltet sich dieser Trend JETZT, welche strukturelle Veränderung steht dahinter.
Satz 4: Wichtigste strategische Implikation für europäische Entscheider — was MÜSSEN CTOs, Policy Maker, Investoren in der EU wissen um zu agieren.

VERBOTEN: Vage Aussagen ohne Zahlen ("transformiert grundlegend", "verändert massiv"). VERBOTEN: Zukunftsformen ohne Datenbasis ("wird voraussichtlich…"). VERBOTEN: Hollow-Worte wie "ganzheitlich", "systemisch" ohne Beleg.

PFLICHT: Konkret, messbar, aktuell (letzte 24 Monate). Jeder Satz fügt echten Informationsgehalt hinzu.

Antwort: Gib NUR den 4-Satz-Text zurück. Keine Einleitung, kein Kommentar, keine Markdown-Formatierung.`;
}

async function enrichOneTrend(trend: TrendRow, apiKey: string): Promise<string | null> {
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
        max_tokens: MAX_TOKENS,
        system:
          "Du bist ein präziser Think-Tank-Analyst. Antworte nur mit dem geforderten 4-Satz-Text, keine Meta-Kommentare.",
        messages: [{ role: "user", content: buildEnrichmentPrompt(trend) }],
      }),
    });
    if (!res.ok) {
      console.error(`[enrich] ${trend.name} — HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    const cleaned = text.trim().replace(/^["']|["']$/g, "");
    if (cleaned.length < 200) {
      console.warn(`[enrich] ${trend.name} — suspiciously short output (${cleaned.length} chars), skipping`);
      return null;
    }
    return cleaned;
  } catch (err) {
    console.error(`[enrich] ${trend.name} — error:`, err);
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dry = args.includes("--dry");

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY fehlt. Abbruch.");
    process.exit(1);
  }

  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const rows = db.prepare(
    "SELECT id, name, category, description FROM trends WHERE status != 'archived' ORDER BY name"
  ).all() as TrendRow[];

  const candidates = force
    ? rows
    : rows.filter((r) => !r.description || r.description.length < MIN_ENRICHED_LENGTH);

  console.log(`[enrich] ${candidates.length} von ${rows.length} Trends werden verarbeitet (${force ? "force mode" : "skip already-enriched"}${dry ? ", DRY RUN" : ""}).`);

  const update = db.prepare("UPDATE trends SET description = ? WHERE id = ?");
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const trend of candidates) {
    const newDesc = await enrichOneTrend(trend, apiKey);
    if (!newDesc) {
      failed++;
      console.log(`  [${done + skipped + failed}/${candidates.length}] ${trend.name} — FAILED`);
      continue;
    }
    if (dry) {
      console.log(`\n--- ${trend.name} ---\n${newDesc}\n`);
      skipped++;
    } else {
      update.run(newDesc, trend.id);
      done++;
      console.log(`  [${done + skipped + failed}/${candidates.length}] ${trend.name} — OK (${newDesc.length} chars)`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  db.close();
  console.log(`\n[enrich] Fertig. ${done} aktualisiert, ${skipped} dry-run, ${failed} fehlgeschlagen.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[enrich] Fatal:", e);
  process.exit(1);
});
