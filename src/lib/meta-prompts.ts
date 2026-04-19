/**
 * Meta-Prompts — Anti-Hallucination Layer (Notion v0.2)
 *
 * These prompts operate on the OUTPUT of the main system prompt. They
 * run as second-pass LLM calls (or pure validators) to catch
 * contradictions, enforce scenario divergence, and surface the
 * implicit assumptions behind an analysis.
 *
 * They are OPTIONAL — not every query needs every meta-pass. The main
 * Briefing path can call them selectively based on the query mode:
 *
 *  - `contradictionCheck`: run in `mode: 'deep'` to catch claims that
 *    contradict the provided signals/trends/edges
 *  - `scenarioDivergence`: pure validator — run on every briefing with
 *    3 scenarios to enforce probability sum + causal distinctness
 *  - `extractAssumptions`: optional finisher that surfaces falsifiable
 *    assumptions behind a framework or briefing output
 *
 * They are **separate** from the main briefing prompt so we can tune
 * them independently and swap to cheaper models (e.g. Haiku for the
 * contradiction check).
 */

// IMPORTANT: this module stays CLIENT-SAFE. No `./env`, no Node
// built-ins — `system-prompts-registry.ts` pulls it into the docs page
// which is "use client". The two runner functions
// (`runContradictionCheck`, `runAssumptionExtraction`) that DO need
// `resolveEnv` were moved to `./meta-prompts-runtime.ts`. Next's
// client bundler statically follows every reachable module, including
// `await import()` paths, so we can't hide a top-level env import
// behind a dynamic call — it has to sit in a separate file.
import { Locale } from "./i18n";

/* ───────────────────────────────────────────────────────────────────────────
 * 2.2 Contradiction Detection Prompt (second-pass fact-check)
 *
 * Cheap model (haiku). Only the LLM's own claims are checked against the
 * signals/trends it was given — this is structural consistency, not a
 * re-grading of the synthesis.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ContradictionCheckInput {
  query: string;
  signalsUsed: string;         // Pre-formatted list of used signals
  trendsMatched: string;       // Pre-formatted list of matched trends
  synthesisOutput: string;     // The full synthesis / JSON output to check
  locale?: Locale;
}

export interface ContradictionFinding {
  claim: string;
  contradicts: string;
  severity: "minor" | "major";
  suggestion: string;
}

export interface StructuralIssue {
  issue: string;
  field: string;
  fix: string;
}

export interface ContradictionReport {
  contradictions: ContradictionFinding[];
  structuralIssues: StructuralIssue[];
  overallVerdict: "clean" | "has_minor_issues" | "has_major_issues";
  /** Points to subtract from the original LLM confidence (0-100). */
  confidenceAdjustment: number;
}

export function buildContradictionCheckPrompt(input: ContradictionCheckInput): string {
  return `You are a critical fact-checker. Your sole task: detect contradictions.

<original_query>
${input.query}
</original_query>

<provided_signals>
${input.signalsUsed || "(no signals were attached to the original query)"}
</provided_signals>

<provided_trends>
${input.trendsMatched || "(no trends were matched)"}
</provided_trends>

<ai_synthesis>
${input.synthesisOutput}
</ai_synthesis>

Check: Does the synthesis contain claims that DIRECTLY contradict the provided signals or trends?

Also check:
- Probability distributions: do the three scenario probabilities sum to 100 (±5)?
- Causal logic: does the stated causal chain match the direction of the provided edges?
- Recency: does the synthesis treat old signals as if they were current?
- Temporal validity: are any recommendations phrased as "future actions" but actually reference past deadlines?

Return JSON only — no prose, no markdown fences:
{
  "contradictions": [
    {
      "claim": "The claim from the synthesis",
      "contradicts": "Which signal/trend contradicts it",
      "severity": "minor | major",
      "suggestion": "How to correct"
    }
  ],
  "structuralIssues": [
    {
      "issue": "e.g. 'probability sum = 95, not 100'",
      "field": "JSON field affected",
      "fix": "How to fix"
    }
  ],
  "overallVerdict": "clean | has_minor_issues | has_major_issues",
  "confidenceAdjustment": 0
}

If no contradictions: { "contradictions": [], "structuralIssues": [], "overallVerdict": "clean", "confidenceAdjustment": 0 }

Do NOT judge whether assessments are correct — only whether they contradict the PROVIDED data.`;
}

// Runner moved to `./meta-prompts-runtime.ts` — see comment at the top
// of this file. Import `runContradictionCheck` from that module on the
// server side; here we only export the prompt builder + types.

/* ───────────────────────────────────────────────────────────────────────────
 * 2.3 Scenario Divergence Check (pure validator — no LLM call)
 *
 * Checks three scenarios for: probability-sum ≈ 1.0, distinct causal
 * mechanisms (keyword heuristic), falsifiable assumptions, and non-empty
 * early indicators. Cheap to run on every briefing.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ScenarioForCheck {
  type?: string;
  title?: string;
  name?: string;
  description?: string;
  probability?: number | null;
  horizon?: string;
  keyAssumptions?: string[];
  earlyIndicators?: string[];
  keyDrivers?: string[];
}

export interface ScenarioDivergenceFinding {
  /** One of the six Notion v0.2 rules that failed. */
  rule: "probability_sum" | "causal_distinctness" | "falsifiable_assumptions" | "time_horizons" | "early_indicators" | "actor_differentiation";
  severity: "minor" | "major";
  message: string;
}

export interface ScenarioDivergenceReport {
  findings: ScenarioDivergenceFinding[];
  probabilitySum: number;
  verdict: "clean" | "has_minor_issues" | "has_major_issues";
}

/**
 * Run scenario-divergence validation.
 *
 * Probability normalization (sum to 1.0) is already handled by the
 * response validator; here we DIAGNOSE rather than correct, so the UI
 * can surface warnings and the confidence calibrator can downgrade.
 */
export function checkScenarioDivergence(scenarios: ScenarioForCheck[]): ScenarioDivergenceReport {
  const findings: ScenarioDivergenceFinding[] = [];

  // Rule 1: exactly 3 scenarios
  if (scenarios.length !== 3) {
    findings.push({
      rule: "probability_sum",
      severity: "major",
      message: `Expected 3 scenarios, got ${scenarios.length}.`,
    });
    return {
      findings,
      probabilitySum: 0,
      verdict: "has_major_issues",
    };
  }

  // Rule 1b: probability sum ≈ 1.0
  const probs = scenarios.map((s) => (typeof s.probability === "number" ? s.probability : 0));
  const probSum = probs.reduce((a, b) => a + b, 0);
  if (Math.abs(probSum - 1) > 0.05) {
    findings.push({
      rule: "probability_sum",
      severity: probSum < 0.8 || probSum > 1.2 ? "major" : "minor",
      message: `Scenario probabilities sum to ${probSum.toFixed(2)} instead of ~1.0.`,
    });
  }

  // Rule 1c: Critical-Fix-Plan P0-2 (Notion 2026-04-20) — erkenne
  // Standard-Templates die der LLM gern aus dem JSON-Schema abkupfert.
  // 20/55/25 und Konsorten sind Heuristik-Verdacht: Der LLM hat eine
  // Default-Verteilung gewählt statt die Datenlage zu reflektieren.
  //
  // Werte in der Registry sind auf 0.0-1.0 normiert (der Validator
  // skaliert von LLM-0-100 auf 0-1), deshalb vergleichen wir hier
  // gegen die normierten Paare.
  const DEFAULT_FALLBACK_DISTRIBUTIONS: Array<[number, number, number]> = [
    [0.20, 0.55, 0.25],
    [0.25, 0.50, 0.25],
    [0.30, 0.40, 0.30],
    [0.33, 0.34, 0.33],
    [0.25, 0.55, 0.20],
    [0.20, 0.60, 0.20],
  ];
  // Toleranz: 4 Prozentpunkte pro Szenario. Demo-Test 2026-04-20 hat
  // gezeigt, dass der LLM das 2pp-Schema umgeht indem er minimal
  // verschiebt (22/55/23 statt 20/55/25). 4pp fängt das ab, ohne
  // echte legitime Verteilungen zu treffen (mature markets: 65/20/15
  // sind weit genug weg von allen Defaults).
  const matchesDefault = DEFAULT_FALLBACK_DISTRIBUTIONS.some((tmpl) =>
    tmpl.every((tv, i) => Math.abs((probs[i] ?? 0) - tv) <= 0.04),
  );
  if (matchesDefault) {
    findings.push({
      rule: "probability_sum",
      severity: "major",
      message:
        "Scenario probabilities match a known default template " +
        "(e.g. 20/55/25) within 4pp tolerance — LLM likely fell back " +
        "to schema placeholder instead of deriving from signals. " +
        "Confidence should be penalized.",
    });
  }

  // Zusätzliche Heuristik: zwei identische Probabilities zeigen fast
  // immer, dass der LLM kopiert hat ("nochmal dasselbe, nur ein anderes
  // Label dran"). Echte Daten-getriebene Einschätzungen haben fast nie
  // exakt gleiche Werte über zwei der drei Szenarien.
  const uniqueProbs = new Set(probs.map((p) => Math.round(p * 100) / 100));
  if (uniqueProbs.size < probs.length) {
    findings.push({
      rule: "probability_sum",
      severity: "minor",
      message:
        `Two scenarios share the same probability (${probs.join("/")}) — ` +
        "unlikely to reflect genuine data-derived estimates.",
    });
  }

  // Rule 2: causal distinctness — heuristic on description/keyDrivers
  // overlap. If two scenarios share ≥ 60% of their keyDrivers or their
  // descriptions open with the same phrase, the LLM likely only varied
  // tone, not mechanism.
  const firstSentence = (s: string | undefined) =>
    (s || "").split(/[.!?]/)[0].toLowerCase().trim().slice(0, 80);
  const openings = scenarios.map((s) => firstSentence(s.description));
  if (openings[0] && openings[0] === openings[1]) {
    findings.push({
      rule: "causal_distinctness",
      severity: "minor",
      message: "Optimistic and likely scenarios begin identically — consider differentiating causal mechanisms.",
    });
  }
  const driverSets = scenarios.map((s) =>
    new Set((s.keyDrivers || []).map((d) => d.toLowerCase().trim())),
  );
  const overlapRatio = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 || b.size === 0) return 0;
    const shared = [...a].filter((x) => b.has(x)).length;
    return shared / Math.min(a.size, b.size);
  };
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]] as const) {
    if (overlapRatio(driverSets[i], driverSets[j]) > 0.6) {
      findings.push({
        rule: "causal_distinctness",
        severity: "minor",
        message: `Scenarios ${scenarios[i].type ?? i} and ${scenarios[j].type ?? j} share most keyDrivers — likely same causal mechanism.`,
      });
    }
  }

  // Rule 3: falsifiable assumptions — each scenario should have ≥ 2
  for (let i = 0; i < scenarios.length; i++) {
    const assumptions = scenarios[i].keyAssumptions || [];
    if (assumptions.length < 2) {
      findings.push({
        rule: "falsifiable_assumptions",
        severity: "minor",
        message: `Scenario ${scenarios[i].type ?? i} has only ${assumptions.length} keyAssumptions (minimum 2).`,
      });
    }
  }

  // Rule 4: time horizons — at least 2 different horizons across the 3 scenarios
  const horizons = new Set(scenarios.map((s) => s.horizon).filter(Boolean));
  if (horizons.size < 2) {
    findings.push({
      rule: "time_horizons",
      severity: "minor",
      message: "All scenarios share the same horizon — distribute short/mid/long for strategic breadth.",
    });
  }

  // Rule 5: early indicators — each scenario needs ≥ 1
  for (let i = 0; i < scenarios.length; i++) {
    const indicators = scenarios[i].earlyIndicators || [];
    if (indicators.length < 1) {
      findings.push({
        rule: "early_indicators",
        severity: "minor",
        message: `Scenario ${scenarios[i].type ?? i} has no earlyIndicators — users need at least one signal to watch.`,
      });
    }
  }

  const hasMajor = findings.some((f) => f.severity === "major");
  const verdict = hasMajor ? "has_major_issues" : findings.length > 0 ? "has_minor_issues" : "clean";
  return { findings, probabilitySum: probSum, verdict };
}

/* ───────────────────────────────────────────────────────────────────────────
 * 2.4 Assumption Extraction Prompt (meta-step after briefing/framework)
 *
 * Surfaces the implicit foundational assumptions behind an analysis,
 * together with what would falsify them and what signal type SIS
 * should watch. Ideal finisher for high-stakes briefings — not
 * required for every query.
 * ──────────────────────────────────────────────────────────────────────── */

export interface AssumptionExtractionInput {
  synthesis: string;
  worldModelContext?: string;
  locale?: Locale;
}

export interface ExtractedAssumption {
  assumption: string;
  type: "factual" | "trend" | "behavioral" | "regulatory" | "geopolitical";
  currentEvidence: "supports" | "neutral" | "against";
  evidenceSource: string;
  falsifiableBy: string;
  monitoringSignal: string;
  timeToFalsification: string;
}

export interface AssumptionReport {
  assumptions: ExtractedAssumption[];
  criticalAssumption: string;
  assumptionCluster: string;
}

export function buildAssumptionExtractionPrompt(input: AssumptionExtractionInput): string {
  return `Extract the implicit foundational assumptions from the following analysis.
A foundational assumption is a statement that MUST be true for the analysis to be correct, but was not explicitly marked as an assumption in the text.

<analysis>
${input.synthesis}
</analysis>

<world_model_context>
${input.worldModelContext || "(no additional world model context attached)"}
</world_model_context>

Return JSON only — no prose, no markdown fences:
{
  "assumptions": [
    {
      "assumption": "The implicit assumption, clearly stated",
      "type": "factual | trend | behavioral | regulatory | geopolitical",
      "currentEvidence": "supports | neutral | against",
      "evidenceSource": "[SIGNAL/TREND/EDGE: …] that supports/contradicts",
      "falsifiableBy": "What event/signal would disprove this assumption?",
      "monitoringSignal": "What signal type should SIS watch to detect falsification?",
      "timeToFalsification": "How long until we'd know if this is wrong?"
    }
  ],
  "criticalAssumption": "The single assumption whose failure breaks everything",
  "assumptionCluster": "Do assumptions form a coherent cluster or are they independent? One sentence."
}

Focus on: causal assumptions ("if X then Y"), market assumptions, regulatory assumptions, actor-behavior assumptions. Maximum 6 assumptions. Prioritize by consequence of being wrong.`;
}

// Runner moved to `./meta-prompts-runtime.ts` — import
// `runAssumptionExtraction` from that module on the server side.

/* ───────────────────────────────────────────────────────────────────────────
 * Provenance Tagging Rule (2.1) — published as a prompt fragment so it
 * can be reused by the registry / docs. The actual enforcement is
 * inline in the main system prompt in `src/lib/llm.ts`.
 * ──────────────────────────────────────────────────────────────────────── */

export const PROVENANCE_TAGGING_PROMPT_EN = `## Provenance Requirements

Every unit of information in your response MUST belong to one of the following categories.
Tag inline in the text — no exceptions.

- [SIGNAL: <SourceName>, <Date>]
  A concrete event, number, or development from the provided live signals.
  Example: "GitHub recorded a 340% spike in AI agent repositories in March 2026 [SIGNAL: GitHub Trending, 2026-03-15]"

- [TREND: <TrendName>]
  An assessment derived from the curated trend catalog.
  Example: "Rising velocity in the Generative AI space [TREND: AI & Automation]"

- [REG: <RegulationName>]
  A reference to a specific regulation from the regulation database.
  Example: "High-risk requirements of the EU AI Act apply from 2025 [REG: EU AI Act]"

- [EDGE: <TrendA> → <TrendB>]
  A causal relationship from the causal graph.
  Example: "Compute cost reduction directly enables broader AI adoption [EDGE: Semiconductor Efficiency → AI & Automation]"

- [LLM-KNOWLEDGE]
  General training knowledge when no signals are available.
  Example: "Historically, technology hype cycles follow a pattern... [LLM-KNOWLEDGE]"
  WARNING: [LLM-KNOWLEDGE] may never be the sole basis for action recommendations.

WRONG (never do this):
"AI will grow significantly in the coming years."

CORRECT:
"AI investment grew 47% in Q1 2026 [SIGNAL: Crunchbase, 2026-03-20],
driven by enterprise adoption [TREND: AI & Automation] enabled by
reduced inference costs [EDGE: Semiconductor Efficiency → AI & Automation]
and compliance pressure from the EU AI Act [REG: EU AI Act]."`;
