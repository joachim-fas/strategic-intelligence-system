/**
 * Export functions for SIS Intelligence Briefings
 * Converts IntelligenceBriefing entries to Markdown, plain text, JSON
 */

import type { HistoryEntry } from "@/components/briefing/BriefingResult";
import { t as translate, localeTag, type Locale } from "@/lib/i18n";

// ── Single briefing → Markdown ────────────────────────────────────────────────
export function briefingToMarkdown(entry: HistoryEntry, locale: Locale): string {
  const b = entry.briefing as any;
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
  const ts = entry.timestamp.toLocaleString(localeTag(locale));
  const conf = b.confidence > 0 ? ` · ${(b.confidence * 100).toFixed(0)}% ${t("summary.confidenceLabel")}` : "";
  const lines: string[] = [];

  // Header
  lines.push(`# ${entry.query}`);
  lines.push(`_${ts}${conf}_`);
  lines.push("");

  // Synthesis
  if (b.synthesis && b.synthesis !== "Analysiere..." && b.synthesis !== "Analyzing...") {
    lines.push(`## ${t("summary.sectionSynthesis")}`);
    lines.push(b.synthesis);
    lines.push("");
  }

  // Scenarios
  if (b.scenarios?.length > 0) {
    lines.push(`## ${t("summary.sectionScenarios")}`);
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
    lines.push(`## ${t("summary.sectionKeyInsights")}`);
    for (const insight of b.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push("");
  }

  // Causal chains
  const causalChains = b.causalAnalysis ?? b.causalChain;
  if (causalChains?.length > 0) {
    lines.push(`## ${t("summary.sectionCausalChains")}`);
    for (const chain of causalChains) {
      lines.push(`- ${chain}`);
    }
    lines.push("");
  }

  // Strategic interpretation
  if (b.interpretation) {
    lines.push(`## ${t("summary.sectionInterpretation")}`);
    lines.push(b.interpretation);
    lines.push("");
  }

  // Decision framework
  if (b.decisionFramework) {
    lines.push(`## ${t("summary.sectionDecisionFramework")}`);
    lines.push(b.decisionFramework);
    lines.push("");
  }

  // Follow-up questions
  if (b.followUpQuestions?.length > 0) {
    lines.push(`## ${t("summary.sectionFollowUps")}`);
    for (const q of b.followUpQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  // News context
  if (b.newsContext) {
    lines.push(`## ${t("summary.sectionCurrentContext")}`);
    lines.push(b.newsContext);
    lines.push("");
  }

  // Regulatory context
  if (b.regulatoryContext?.length > 0) {
    lines.push(`## ${t("summary.sectionRegulation")}`);
    for (const r of b.regulatoryContext) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  // References
  if (b.references?.length > 0) {
    lines.push(`## ${t("summary.sectionReferences")}`);
    for (const ref of b.references) {
      lines.push(`- [${ref.title}](${ref.url})`);
    }
    lines.push("");
  }

  // Balanced Scorecard
  if (b.balancedScorecard?.perspectives?.length > 0) {
    lines.push(`## ${t("summary.sectionBalancedScorecard")}`);
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
    lines.push(`## ${t("summary.sectionLiveSignals")}`);
    for (const s of b.usedSignals) {
      const link = s.url ? `[${s.title}](${s.url})` : s.title;
      lines.push(`- **${s.source}** — ${link} _(${s.date})_`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`_${t("summary.exportedFrom")} SIS — Strategic Intelligence System_`);

  return lines.join("\n");
}

// ── Session export (all entries) ─────────────────────────────────────────────
export function sessionToMarkdown(history: HistoryEntry[], locale: Locale): string {
  const now = new Date().toLocaleString(localeTag(locale));
  const completed = history.filter(
    (e) => !e.isLoading
      && e.briefing.synthesis !== "Analysiere..." && e.briefing.synthesis !== "Analyzing..."
      && e.briefing.synthesis !== ""
  );

  const header = [
    `# SIS Session Export`,
    `_${now} · ${completed.length} ${translate(locale, "summary.analysisPlural")}_`,
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
  if (typeof window === "undefined") return;
  try {
    const completed = history.filter(
      (e) => !e.isLoading
        && e.briefing.synthesis !== "Analysiere..." && e.briefing.synthesis !== "Analyzing..."
        && e.briefing.synthesis !== ""
    );
    const toStore = completed.slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // storage quota exceeded — ignore
  }
}

export function loadHistoryFromStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Restore Date objects; force isLoading=false since no request survives a reload
    return parsed.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp), isLoading: false }));
  } catch {
    return [];
  }
}

export function clearHistoryStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// ═════════════════════════════════════════════════════════════════════
// Notion v0.2 — Export prompt templates (Section 6)
//
// These are LLM-backed polishers that transform a full briefing into a
// C-level executive summary or a shareable email/Slack briefing. They
// are separate from the deterministic Markdown export above: the
// deterministic path preserves every detail, the LLM polishers
// prioritize for a specific audience.
//
// The templates live here as editorial source of truth and are exposed
// via the system-prompts registry + /dokumentation/prompts. A dedicated
// API route that runs them can be wired later without touching the
// prompt wording.
// ═════════════════════════════════════════════════════════════════════

export const EXECUTIVE_SUMMARY_PROMPT_EN = `You are writing an executive summary from a strategic analysis.
Target audience: C-level, no time, needs to grasp the core immediately.

<full_analysis>
BRIEFING_OR_FRAMEWORK_OUTPUT
</full_analysis>

Rules:
- Maximum 250 words
- No jargon without explanation
- First sentence = most important finding (no warm-up, no context-setting)
- Last paragraph: 1-2 concrete recommendations
- Never begin with: "In this analysis...", "This briefing shows...", "To summarize..."
- Confidence level must be mentioned: append "(Confidence: X%)" to the first section heading
- If confidence < 60: add a one-sentence caveat before recommendations

Return plain text, formatted with Markdown headings:

## [Title of the key finding] (Confidence: X%)
[2-3 sentences: core message. Causal. Direct.]

[If confidence < 60: one sentence caveat on data quality]

**Strategic Implications:**
- [Implication 1]
- [Implication 2]

**Recommendation:** [1 concrete action, with urgency indicator: immediate / near-term / long-term]`;

export const SHAREABLE_BRIEFING_PROMPT_EN = `Create a shareable short version of this analysis —
formatted to read well in an email or Slack message and comprehensible without prior context.

<analysis>
BRIEFING
</analysis>

Return plain text:

**SIS Intelligence Briefing | DATE**
**Query:** QUERY
**Confidence:** CONFIDENCE% | **Sources:** SIGNAL_COUNT signals (newest: NEWEST_SIGNAL_AGE)

**Core Finding:** [2 sentences — the most important conclusion, causally stated]

**Top 3 Insights:**
1. ...
2. ...
3. ...

**Scenarios:**
Optimistic (PROB%): [1 sentence]
Likely (PROB%): [1 sentence]
Pessimistic (PROB%): [1 sentence]

**Data note:** [1 sentence on coverage gaps if confidence < 70, else omit]

*Generated with Strategic Intelligence System — sis.free-agents.io*`;
