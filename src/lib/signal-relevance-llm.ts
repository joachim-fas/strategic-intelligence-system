/**
 * Signal-Relevance LLM-Pass — Iteration-Loop Pass 2
 *
 * ════════════════════════════════════════════════════════════════════════
 * WAS DAS MODUL TUT
 * ════════════════════════════════════════════════════════════════════════
 *
 * Nach der mechanischen Retrieval (Pass 1: Multi-Evidence-Gate in
 * `signals.ts`) erhalten wir 20-30 Signal-Kandidaten, die strukturell
 * relevant erscheinen — sie matchen mehrere Query-Keywords oder eine
 * Bigram-Phrase oder kommen aus einer authoritative-tier Quelle.
 *
 * Strukturelle Relevanz ≠ semantische Relevanz. Beispiel:
 *
 *   Query:  „Welchen Einfluss hat der öffentliche Rundfunk auf die
 *            Gesellschaft in Deutschland und Österreich?"
 *   Signal: „OSW: Germany–Ukraine intergovernmental consultations:
 *            security as the foundation of bilateral relations"
 *
 * Multi-Match? Ja (deutschland + österreich/ukraine via context). Aber
 * inhaltlich hat das Signal NICHTS mit Rundfunk-Einfluss zu tun. Die
 * Keyword-Heuristik kann das nicht wissen — sie sieht nur Token-Matches.
 *
 * Pass 2 schickt jeden Kandidaten an ein günstiges LLM (Claude Haiku) mit
 * der Frage: „Würde dieses Signal einen Strategist in die Irre führen,
 * wenn es als Evidenz für die Frage zitiert würde?"
 *
 * Das LLM scort 0-10 und gibt einen 1-Satz-Grund zurück. Signale mit
 * Score ≤ MIN_RELEVANCE_SCORE werden gefiltert; übrige Signale werden
 * nach Score sortiert und behalten ihre `llmRelevanceScore` und
 * `llmRelevanceReason` für Telemetrie und UI-Transparenz.
 *
 * ════════════════════════════════════════════════════════════════════════
 * WARUM DIESE LÖSUNG (statt noch mehr Heuristik)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Vor diesem Modul hatten wir vier Iterationen Heuristik-Patches:
 *   - 4da3710:  Cross-Language-Aliase
 *   - fd999c4:  Anchor-Position-Erweiterung
 *   - 6a6d5e8:  Bigram-Anchor + alias-aware long-anchor
 *   - ff19ba5:  Multi-Evidence-Gate (long-domain-anchor retired)
 *
 * Jeder Fix war evidenz-basiert und richtig. Jeder hat trotzdem einen
 * neuen Edge-Case offengelegt. Der User hat es richtig formuliert: „das
 * gilt nicht nur für ein Beispiel, das gilt generell". Heuristiken über
 * Token-Matches werden niemals semantische Relevanz erfassen.
 *
 * Die Lösung ist ein Paradigmenwechsel: statt Token-Matching-Tricks ein
 * tatsächliches Sprachmodell die Relevanz beurteilen lassen. Das ist
 * teurer als Regex (~$0.001/Query Haiku Cost statt ~0), aber es löst
 * die Klasse von Bugs strukturell statt einzeln.
 *
 * ════════════════════════════════════════════════════════════════════════
 * INTEGRATION IM PIPELINE-LOOP
 * ════════════════════════════════════════════════════════════════════════
 *
 *   Query
 *     ↓
 *   Pass 1: Multi-Evidence-Gate (signals.ts getRelevantSignals)
 *     → 20-30 Kandidaten
 *     ↓
 *   Pass 2: LLM-Relevance-Scoring  ← DIESES MODUL
 *     → 5-15 echte Treffer + Score + Begründung
 *     ↓
 *   Pass 3: Coverage-Critique (geplant, noch nicht gebaut)
 *     → Gap-Liste / Refinement-Anfrage
 *     ↓
 *   Pass 4: Refined-Retrieval (geplant, noch nicht gebaut)
 *     → erweiterte Kandidaten
 *     ↓
 *   Synthesis-LLM (Sonnet)
 *
 * Pass 2 ist unabhängig deploybar — wenn Pass 3+4 fehlen, wird einfach
 * der Pass-2-Output direkt zur Synthese gereicht. Das war absichtlich so
 * designed: jeder Pass kann separat shippen und liefert sofortigen Wert.
 *
 * ════════════════════════════════════════════════════════════════════════
 * KOSTEN UND LATENZ
 * ════════════════════════════════════════════════════════════════════════
 *
 * Pro Query (30 Kandidaten):
 *   - Input: ~3000 Tokens (Query + 30 Signale je ~80 Tokens)
 *   - Output: ~1000 Tokens (30 JSON-Judgments)
 *   - Haiku 4.5: $1/MTok input, $5/MTok output
 *   - Cost: ~$0.003 + $0.005 = ~$0.008/Query
 *   - Latenz: ~2-4 Sekunden (Haiku ist schnell)
 *
 * Bei einer typischen Pilot-Eval-Session mit 6 Queries: ~$0.05 zusätzlich.
 * Bei einer Stakeholder-Demo mit 20 Queries: ~$0.16 zusätzlich. Das ist
 * marginal verglichen mit dem Wert „der Strategist sieht keine Erdbeben-
 * Daten mehr in der Antwort auf eine Rundfunk-Frage".
 *
 * ════════════════════════════════════════════════════════════════════════
 * FAILURE-HANDLING
 * ════════════════════════════════════════════════════════════════════════
 *
 * Folgt der gleichen Konvention wie `runContradictionCheck` /
 * `runAssumptionExtraction`: bei jedem Fehler (kein API-Key, HTTP-Fail,
 * malformed JSON, Timeout) gibt die Funktion `null` zurück. Der Caller
 * muss dann auf den ungefilterten Pass-1-Output zurückfallen — keine
 * Synthese-Blockade durch Pass-2-Fehler.
 *
 * Das bedeutet: Pass 2 ist STRENG ADDITIV. Wenn er ausfällt, ist die
 * Pipeline genau so gut/schlecht wie vorher. Wenn er funktioniert, ist
 * sie messbar besser. No-regression-guarantee.
 */

import { resolveEnv } from "./env";
import type { LiveSignal } from "./signals";

/**
 * Default minimum relevance score for keeping a signal. Signals scored
 * below this threshold are filtered out. Tuning notes:
 *
 *   - 0-2: «would actively mislead a strategist» — always drop
 *   - 3-4: «tangential» — touches a related concept but not the question
 *   - 5-6: «contextual» — adjacent evidence, useful for framing
 *   - 7-8: «relevant» — direct engagement with one aspect
 *   - 9-10: «core» — addresses the question's heart
 *
 * MIN_RELEVANCE_SCORE = 5 errs on the side of quality. Anything below
 * "contextual" is dropped. If the user reports «too few signals», we can
 * lower to 4. If they report «still some noise», we can raise to 6.
 */
export const MIN_RELEVANCE_SCORE = 5;

/**
 * Maximum number of signals scored per LLM call. The Anthropic API can
 * handle larger batches but the JSON output gets unwieldy past ~50.
 * Pass 1 caps at 32 candidates, so 50 is a comfortable ceiling.
 */
const MAX_SIGNALS_PER_BATCH = 50;

export interface RelevanceJudgment {
  /** Signal identifier (we use index-based "s1", "s2", ... for prompt brevity) */
  id: string;
  /** Score 0-10 */
  score: number;
  /** One-line reason (≤ ~120 chars) */
  reason: string;
}

export interface BatchScoringResult {
  /** Map from signal index ("s1", "s2", ...) → judgment */
  judgments: Map<string, RelevanceJudgment>;
  /** Total tokens / latency for telemetry */
  callDurationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  modelUsed: string;
  /** True iff every input signal got a judgment back */
  fullCoverage: boolean;
  /** Distribution stats for log lines */
  stats: {
    inputCount: number;
    judgedCount: number;
    meanScore: number;
    keptAtThreshold: number;
    droppedAtThreshold: number;
  };
}

/**
 * Build the relevance-scoring prompt. Bilingual (DE/EN) — the prompt
 * itself is in English (LLM understands either) but the instruction set
 * mentions the locale of the query so Haiku scores in-context.
 *
 * Each signal is given a stable index ("s1", "s2", ...) so the LLM
 * doesn't have to repeat full titles in its output — keeps tokens down.
 */
function buildScoringPrompt(query: string, signals: LiveSignal[]): string {
  const signalLines = signals.map((s, i) => {
    const id = `s${i + 1}`;
    const source = s.source;
    // Strip the source-prefix convention (e.g. "ECFR (...): real title")
    // so the LLM sees the actual content, not the boilerplate.
    const title = (s.title || "").replace(/^[^:]{1,120}:\s*/, "").slice(0, 200);
    const snippet = (s.content || "").slice(0, 180).replace(/\s+/g, " ").trim();
    return `[${id}] [${source}] ${title}${snippet ? `\n     snippet: ${snippet}` : ""}`;
  }).join("\n");

  return `You are a signal-relevance evaluator for a strategic intelligence system. Given a strategic question and a list of candidate signals retrieved by keyword matching, rate how strongly each signal engages with the actual question.

Strategic question:
${query}

Signals to evaluate:
${signalLines}

Score each signal on a 0-10 scale:
- 9-10: Directly addresses a core aspect of the question (would be cited as primary evidence)
- 7-8:  Relevant — engages substantively with one part of the question
- 5-6:  Contextual — adjacent evidence useful for framing
- 3-4:  Tangential — touches on a related concept but not the question itself
- 0-2:  Off-topic — would mislead a strategist if cited as evidence

Critical: keyword overlap alone is not sufficient. A signal that mentions "Germany" or "AI" or "society" but addresses an unrelated topic (e.g. heat pumps in Germany when the question is about public broadcasting) should score 0-2. Only signals that engage with the actual subject matter of the question deserve scores ≥5.

Return ONLY a valid JSON array, one entry per signal in the same order, with the structure:
[
  {"id": "s1", "score": 7, "reason": "Brief 1-line justification (max 120 chars)"},
  ...
]

No prose, no markdown fences, no commentary. The array must contain exactly ${signals.length} entries.`;
}

/**
 * Robust JSON extractor for LLM output. Haiku usually returns clean JSON
 * but occasionally wraps it in code fences or adds prose despite the
 * instruction. This function strips common decorations and tries hard
 * to return a parsed array.
 *
 * Exported for testing (signal-relevance-llm-test.ts) — the brittle
 * surface is the LLM's tendency to decorate output, so the parser
 * deserves explicit regression coverage.
 */
export function extractJudgmentArray(text: string): RelevanceJudgment[] | null {
  if (!text) return null;

  // Strip code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Find the first [...] block (greedy match for nested objects)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return null;

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return null;
    // Validate shape
    return parsed
      .filter((j: any) => j && typeof j.id === "string" && typeof j.score === "number")
      .map((j: any) => ({
        id: String(j.id),
        score: Math.max(0, Math.min(10, Number(j.score))),
        reason: typeof j.reason === "string" ? j.reason.slice(0, 200) : "",
      }));
  } catch {
    return null;
  }
}

/**
 * Score a batch of signals against a query using Claude Haiku. Returns
 * `null` on any failure (no API key, HTTP error, malformed output) —
 * callers should treat null as "Pass 2 skipped" and fall back to the
 * Pass 1 candidate set.
 *
 * Empty input is handled: returns an empty result without making an API
 * call.
 *
 * 2026-04-23 Iteration-Loop Pass 2 implementation.
 */
export async function batchScoreSignalRelevance(
  query: string,
  signals: LiveSignal[],
): Promise<BatchScoringResult | null> {
  if (signals.length === 0) {
    return {
      judgments: new Map(),
      callDurationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      modelUsed: "(none — empty input)",
      fullCoverage: true,
      stats: {
        inputCount: 0,
        judgedCount: 0,
        meanScore: 0,
        keptAtThreshold: 0,
        droppedAtThreshold: 0,
      },
    };
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  // Cap batch to MAX_SIGNALS_PER_BATCH — Pass 1 already caps at 32, but
  // defensive in case future caller passes more.
  const batch = signals.slice(0, MAX_SIGNALS_PER_BATCH);
  const prompt = buildScoringPrompt(query, batch);

  const t0 = Date.now();
  const model = "claude-haiku-4-5";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        // 1500 tokens fits ~50 judgments comfortably (each ~25-30 tokens).
        max_tokens: 1500,
        system: "You are a precise relevance evaluator. Return ONLY valid JSON. No prose, no markdown fences.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[signal-relevance-llm] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    const inputTokens = data?.usage?.input_tokens ?? null;
    const outputTokens = data?.usage?.output_tokens ?? null;
    const callDurationMs = Date.now() - t0;

    if (!text) {
      console.warn("[signal-relevance-llm] empty response text");
      return null;
    }

    const judgments = extractJudgmentArray(text);
    if (!judgments || judgments.length === 0) {
      console.warn("[signal-relevance-llm] could not parse judgment array from:", text.slice(0, 300));
      return null;
    }

    const judgmentMap = new Map<string, RelevanceJudgment>();
    for (const j of judgments) judgmentMap.set(j.id, j);

    // Stats for telemetry
    const scores = judgments.map(j => j.score);
    const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const kept = judgments.filter(j => j.score >= MIN_RELEVANCE_SCORE).length;

    return {
      judgments: judgmentMap,
      callDurationMs,
      inputTokens,
      outputTokens,
      modelUsed: model,
      fullCoverage: judgments.length === batch.length,
      stats: {
        inputCount: batch.length,
        judgedCount: judgments.length,
        meanScore: Math.round(meanScore * 10) / 10,
        keptAtThreshold: kept,
        droppedAtThreshold: judgments.length - kept,
      },
    };
  } catch (e) {
    console.warn("[signal-relevance-llm] exception:", e);
    return null;
  }
}

/**
 * Apply LLM judgments to a candidate signal list. Returns a new list of
 * signals annotated with `llmRelevanceScore` and `llmRelevanceReason`,
 * filtered to those scoring at or above `minScore`, sorted by score
 * descending.
 *
 * Signals NOT in the judgment map are KEPT but un-annotated (this happens
 * when the LLM returned partial coverage, e.g. judged 28 of 30 — we don't
 * silently drop the 2 it missed; we surface them as "unjudged" so the
 * caller can decide).
 *
 * If `judgments` is null (Pass 2 failed), the input list is returned
 * unchanged — caller falls back to Pass 1 result.
 */
export function applyRelevanceFilter(
  signals: LiveSignal[],
  judgments: Map<string, RelevanceJudgment> | null,
  options: { minScore?: number } = {},
): LiveSignal[] {
  if (!judgments) return signals;

  const minScore = options.minScore ?? MIN_RELEVANCE_SCORE;

  const annotated = signals.map((s, i) => {
    const id = `s${i + 1}`;
    const j = judgments.get(id);
    if (!j) {
      // Unjudged — keep but no annotation. Caller can decide policy.
      return s;
    }
    return {
      ...s,
      llmRelevanceScore: j.score,
      llmRelevanceReason: j.reason,
    };
  });

  // Filter: keep if either (a) judged and score >= minScore,
  // or (b) unjudged (defensive: Pass 1 already vetted them).
  const filtered = annotated.filter(s => {
    if (typeof s.llmRelevanceScore !== "number") return true; // unjudged: keep
    return s.llmRelevanceScore >= minScore;
  });

  // Sort: judged signals by score desc; unjudged signals at the bottom
  filtered.sort((a, b) => {
    const sa = a.llmRelevanceScore ?? -1;
    const sb = b.llmRelevanceScore ?? -1;
    return sb - sa;
  });

  return filtered;
}
