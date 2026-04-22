#!/usr/bin/env tsx
/**
 * pilot-eval-run — scaffold ein Pilot-Evaluation-Dokument für ein
 * Thema und (optional) eine Query-Version aus der DB.
 *
 * Usage:
 *
 *   # Scaffold ein leeres Eval-Dokument
 *   npx tsx scripts/pilot-eval-run.ts "Welche EU-Länder…" \
 *     --slug=lieferketten-fragmentierung
 *
 *   # Dito, aber mit bereits gespeicherter query_version vorausgefüllt
 *   npx tsx scripts/pilot-eval-run.ts "…" \
 *     --slug=ki-agenten-arbeitsmarkt \
 *     --version-id=<uuid-from-db>
 *
 * Das Script schreibt `docs/pilot-evaluations/<slug>.md` mit dem
 * Rubrik-Template + (falls version-id angegeben) dem serialisierten
 * Briefing. User füllt Scores + Notes manuell aus.
 *
 * Warum kein automatischer API-Call?
 *   - /api/v1/query braucht Session-Auth + Rate-Limit-Respekt
 *   - das Briefing ist am besten im UI zu lesen, wo Farb-Kodierung und
 *     Interaktivität da sind — der User soll da evaluieren und dann
 *     die Ergebnisse ins Dokument übernehmen
 *
 * Nach der Evaluation kann das gefüllte MD committed werden und als
 * Entscheidungs-Instrument für den nächsten System-Prompt-Feinschliff
 * dienen.
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { getVersion } from "../src/lib/query-versions";

function parseArgs(): { topic: string; slug: string; versionId?: string } {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    console.error("Usage: pilot-eval-run <topic> [--slug=<slug>] [--version-id=<id>]");
    process.exit(1);
  }
  const topic = args[0];
  let slug: string | undefined;
  let versionId: string | undefined;
  for (const a of args.slice(1)) {
    if (a.startsWith("--slug=")) slug = a.slice("--slug=".length);
    else if (a.startsWith("--version-id=")) versionId = a.slice("--version-id=".length);
  }
  if (!slug) {
    slug = topic.toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }
  return { topic, slug, versionId };
}

function formatBriefing(result: unknown): string {
  if (!result || typeof result !== "object") return "_(no result)_";
  const r = result as any;
  const parts: string[] = [];

  if (r.synthesis) {
    parts.push("### Synthesis\n\n" + String(r.synthesis));
  }
  if (Array.isArray(r.keyInsights) && r.keyInsights.length > 0) {
    parts.push("### Key Insights\n\n" + r.keyInsights.map((k: string, i: number) => `${i + 1}. ${k}`).join("\n"));
  }
  if (r.scenarios) {
    const scenarios = Array.isArray(r.scenarios) ? r.scenarios : [];
    if (scenarios.length > 0) {
      parts.push("### Scenarios\n\n" + scenarios.map((s: any, i: number) => {
        const label = s.type || s.name || `#${i + 1}`;
        const prob = typeof s.probability === "number" ? ` (${Math.round(s.probability * 100)}%)` : "";
        return `**${label}${prob}** — ${s.description ?? s.name ?? "—"}`;
      }).join("\n\n"));
    }
  }
  if (r.causalChain && Array.isArray(r.causalChain) && r.causalChain.length > 0) {
    parts.push("### Causal Chain\n\n" + r.causalChain.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n"));
  }
  if (Array.isArray(r.references) && r.references.length > 0) {
    parts.push("### References\n\n" + r.references.map((ref: any) => {
      const verif = ref.verified ? "✓" : "?";
      return `- [${verif}] [${ref.title ?? "—"}](${ref.url ?? "#"})`;
    }).join("\n"));
  }
  if (Array.isArray(r.usedSignals) && r.usedSignals.length > 0) {
    parts.push("### Used Signals\n\n" + r.usedSignals.map((s: any) => {
      const score = typeof s.queryRelevance === "number"
        ? ` [LLM:${Math.round(s.queryRelevance * 100)}%]`
        : typeof s.keywordOverlap === "number"
          ? ` [KW:${Math.round(s.keywordOverlap * 100)}%]`
          : "";
      return `- **${s.source}**${score} — ${s.title}`;
    }).join("\n"));
  }
  if (r.dataQuality) {
    parts.push("### Data Quality\n\n```json\n" + JSON.stringify(r.dataQuality, null, 2) + "\n```");
  }

  return parts.length > 0 ? parts.join("\n\n---\n\n") : "_(empty briefing)_";
}

function dimensionSection(num: number, dim: string, question: string): string {
  return `### ${num}. ${dim}

${question}

- **Score:** \`_ / 5\`
- **Notes:** `;
}

function buildMarkdown(topic: string, slug: string, briefing: string | null, versionId?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const head = [
    `# Pilot-Evaluation — ${slug}`,
    "",
    `**Thema:** ${topic}`,
    `**Datum:** ${today}`,
    versionId ? `**Version-ID:** \`${versionId}\`` : "**Version-ID:** _(not set)_",
    "",
    "Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.",
    "",
    "---",
    "",
    "## Briefing-Output",
    "",
    briefing ?? "_(Briefing hier einfügen oder mit `--version-id=<id>` vorbefüllen lassen)_",
    "",
    "---",
    "",
    "## Rubrik-Bewertung",
    "",
    dimensionSection(1, "Claim-Provenienz", "Jede faktische Aussage mit `[SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]` getaggt?"),
    "",
    dimensionSection(2, "Source-Qualität", "Sind References real, verifiziert und relevant? URLs funktionieren? Keine LLM-Fabrikate?"),
    "",
    dimensionSection(3, "Signal-Relevanz", "Passen die gezeigten Live-Signale topisch zur Frage?"),
    "",
    dimensionSection(4, "Szenarien-Disziplin", "3 Szenarien kausal distinkt? Falsifizierbare Annahmen? Probabilities nicht-default?"),
    "",
    dimensionSection(5, "EU-Frame", "Ist der europäische Blickwinkel explizit und spezifisch?"),
    "",
    dimensionSection(6, "Action-Readiness", "Sind Empfehlungen mit Akteur, Hebel, Zeitfenster, Erfolgskriterium versehen?"),
    "",
    dimensionSection(7, "Ehrlichkeit-über-Lücken", "Benennt das Briefing Coverage-Gaps und dominanten Source-Type ehrlich?"),
    "",
    "---",
    "",
    "## Gesamt-Score",
    "",
    "- **Summe:** `_ / 35`",
    "- **Band:** _(publishable ≥32 · intern 26–31 · schwach 20–25 · stop <20)_",
    "",
    "## Konkrete Fix-Action-Items",
    "",
    "Pro schwachem Dimension-Score (< 4) hier einen Action-Item notieren:",
    "",
    "1. _…_",
    "2. _…_",
    "3. _…_",
    "",
    "## Notizen / Überraschungen",
    "",
    "- _Was war unerwartet gut?_",
    "- _Was war unerwartet schwach?_",
    "- _Welche Signale hat das System übersehen, die du intuitiv erwartet hättest?_",
    "",
  ];
  return head.join("\n");
}

async function main() {
  const { topic, slug, versionId } = parseArgs();
  const outDir = path.join(process.cwd(), "docs", "pilot-evaluations");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.md`);

  let briefing: string | null = null;
  if (versionId) {
    try {
      const v = getVersion(versionId);
      if (v) {
        briefing = formatBriefing(v.resultJson);
        console.log(`✓ Loaded version ${versionId} (v${v.versionNumber}, ${v.executedAt})`);
      } else {
        console.warn(`⚠ Version ${versionId} not found in DB; leaving briefing section empty`);
      }
    } catch (err) {
      console.warn(`⚠ Could not load version: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (existsSync(outPath)) {
    const overwrite = process.argv.includes("--force");
    if (!overwrite) {
      console.error(`✗ ${outPath} already exists. Use --force to overwrite, or pick a different --slug.`);
      process.exit(1);
    }
  }

  const md = buildMarkdown(topic, slug, briefing, versionId);
  writeFileSync(outPath, md);
  console.log(`✓ Wrote ${outPath}`);
  console.log(`\nNächste Schritte:`);
  console.log(`  1. Query in SIS-UI laufen lassen: http://localhost:3001/?q=${encodeURIComponent(topic)}&autostart=1`);
  console.log(`  2. Briefing sichten, ${briefing ? "Prefill prüfen" : "Inhalt in Sektion 'Briefing-Output' einfügen"}.`);
  console.log(`  3. Rubrik-Scores (1–5) + Notes pro Dimension ausfüllen.`);
  console.log(`  4. Summe ausrechnen, Action-Items notieren.`);
  console.log(`  5. Datei committen: ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
