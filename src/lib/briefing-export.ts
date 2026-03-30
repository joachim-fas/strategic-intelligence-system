/**
 * Export functions for SIS Intelligence Briefings
 * Converts IntelligenceBriefing entries to Markdown, plain text, JSON
 */

import type { HistoryEntry } from "@/components/briefing/BriefingResult";
import type { Locale } from "@/lib/i18n";

// ── Single briefing → Markdown ────────────────────────────────────────────────
export function briefingToMarkdown(entry: HistoryEntry, locale: Locale): string {
  const b = entry.briefing as any;
  const de = locale === "de";
  const ts = entry.timestamp.toLocaleString(de ? "de-DE" : "en-US");
  const conf = b.confidence > 0 ? ` · ${(b.confidence * 100).toFixed(0)}% ${de ? "Konfidenz" : "confidence"}` : "";
  const lines: string[] = [];

  // Header
  lines.push(`# ${entry.query}`);
  lines.push(`_${ts}${conf}_`);
  lines.push("");

  // Synthesis
  if (b.synthesis && b.synthesis !== "Analysiere..." && b.synthesis !== "Analyzing...") {
    lines.push(`## ${de ? "Synthese" : "Synthesis"}`);
    lines.push(b.synthesis);
    lines.push("");
  }

  // Scenarios
  if (b.scenarios?.length > 0) {
    lines.push(`## ${de ? "Szenarien" : "Scenarios"}`);
    lines.push("");
    for (const s of b.scenarios) {
      const pct = (s.probability * 100).toFixed(0);
      lines.push(`### ${s.name} (${pct}%)`);
      lines.push(s.description);
      lines.push("");
    }
  }

  // Key Insights
  if (b.keyInsights?.length > 0) {
    lines.push(`## ${de ? "Erkenntnisse" : "Key Insights"}`);
    for (const insight of b.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push("");
  }

  // Causal chains
  if (b.causalChain?.length > 0) {
    lines.push(`## ${de ? "Kausalketten" : "Causal Chains"}`);
    for (const chain of b.causalChain) {
      lines.push(`- ${chain}`);
    }
    lines.push("");
  }

  // Strategic interpretation
  if (b.interpretation) {
    lines.push(`## ${de ? "Strategische Interpretation" : "Strategic Interpretation"}`);
    lines.push(b.interpretation);
    lines.push("");
  }

  // Decision framework
  if (b.decisionFramework) {
    lines.push(`## ${de ? "Entscheidungshilfe" : "Decision Framework"}`);
    lines.push(b.decisionFramework);
    lines.push("");
  }

  // Follow-up questions
  if (b.followUpQuestions?.length > 0) {
    lines.push(`## ${de ? "Weiterführende Fragen" : "Follow-up Questions"}`);
    for (const q of b.followUpQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  // News context
  if (b.newsContext) {
    lines.push(`## ${de ? "Aktueller Kontext" : "Current Context"}`);
    lines.push(b.newsContext);
    lines.push("");
  }

  // Regulatory context
  if (b.regulatoryContext?.length > 0) {
    lines.push(`## ${de ? "Regulierung" : "Regulation"}`);
    for (const r of b.regulatoryContext) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  // References
  if (b.references?.length > 0) {
    lines.push(`## ${de ? "Quellen" : "Sources"}`);
    for (const ref of b.references) {
      lines.push(`- [${ref.title}](${ref.url})`);
    }
    lines.push("");
  }

  // Balanced Scorecard
  if (b.balancedScorecard?.perspectives?.length > 0) {
    lines.push(`## ${de ? "Balanced Scorecard" : "Balanced Scorecard"}`);
    if (b.balancedScorecard.criticalTension) {
      lines.push(`> ${b.balancedScorecard.criticalTension}`);
      lines.push("");
    }
    for (const p of b.balancedScorecard.perspectives) {
      const score = (p.score * 100).toFixed(0);
      lines.push(`**${p.label}** — ${score}% · ${p.trend}`);
      lines.push(p.summary);
      if (p.keyFactors?.length > 0) {
        for (const f of p.keyFactors) lines.push(`  - ${f}`);
      }
      lines.push("");
    }
  }

  // Live signals
  if (b.usedSignals?.length > 0) {
    lines.push(`## ${de ? "Live-Signale" : "Live Signals"}`);
    for (const s of b.usedSignals) {
      const link = s.url ? `[${s.title}](${s.url})` : s.title;
      lines.push(`- **${s.source}** — ${link} _(${s.date})_`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`_${de ? "Exportiert von" : "Exported from"} SIS — Strategic Intelligence System_`);

  return lines.join("\n");
}

// ── Session export (all entries) ─────────────────────────────────────────────
export function sessionToMarkdown(history: HistoryEntry[], locale: Locale): string {
  const de = locale === "de";
  const now = new Date().toLocaleString(de ? "de-DE" : "en-US");
  const completed = history.filter(
    (e) => e.briefing.synthesis !== "Analysiere..." && e.briefing.synthesis !== "Analyzing..."
  );

  const header = [
    `# SIS Session Export`,
    `_${now} · ${completed.length} ${de ? "Analysen" : "analyses"}_`,
    "",
    "---",
    "",
  ].join("\n");

  const body = completed
    .slice() // preserve order, newest first in history
    .reverse() // oldest first in export
    .map((e) => briefingToMarkdown(e, locale))
    .join("\n\n---\n\n");

  return header + body;
}

// ── Download helpers ──────────────────────────────────────────────────────────
function downloadText(content: string, filename: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

export function downloadBriefingMarkdown(entry: HistoryEntry, locale: Locale) {
  const md = briefingToMarkdown(entry, locale);
  const filename = `sis-${slugify(entry.query)}.md`;
  downloadText(md, filename);
}

export function downloadSessionMarkdown(history: HistoryEntry[], locale: Locale) {
  const md = sessionToMarkdown(history, locale);
  const date = new Date().toISOString().slice(0, 10);
  downloadText(md, `sis-session-${date}.md`);
}

export function downloadBriefingJSON(entry: HistoryEntry) {
  const content = JSON.stringify({ query: entry.query, timestamp: entry.timestamp, briefing: entry.briefing }, null, 2);
  const filename = `sis-${slugify(entry.query)}.json`;
  downloadText(content, filename, "application/json");
}

// ── Clipboard ─────────────────────────────────────────────────────────────────
export async function copyBriefingToClipboard(entry: HistoryEntry, locale: Locale): Promise<void> {
  const md = briefingToMarkdown(entry, locale);
  await navigator.clipboard.writeText(md);
}

// ── localStorage persistence ─────────────────────────────────────────────────
const STORAGE_KEY = "sis-history-v2";
const MAX_STORED = 30;

export function saveHistoryToStorage(history: HistoryEntry[]) {
  try {
    const completed = history.filter(
      (e) => e.briefing.synthesis !== "Analysiere..." && e.briefing.synthesis !== "Analyzing..."
        && e.briefing.synthesis !== ""
    );
    const toStore = completed.slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // storage quota exceeded — ignore
  }
}

export function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Restore Date objects
    return parsed.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));
  } catch {
    return [];
  }
}

export function clearHistoryStorage() {
  localStorage.removeItem(STORAGE_KEY);
}
