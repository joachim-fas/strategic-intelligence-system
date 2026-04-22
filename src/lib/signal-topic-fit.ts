/**
 * signalTopicalFit — single source of truth for «how strongly does this
 * signal engage with the query?», normalized to 0-1.
 *
 * 2026-04-23 (Hygiene-Pass after Pass-2-build):
 * Previously this logic was duplicated in two places —
 * `OrbitDerivationView.signalTopicalFit` and `BriefingResult.topicFit`.
 * Both had the same priority chain (LLM-judged > LLM queryRelevance >
 * displayScore > keywordOverlap > 0.3 default), but as separate copies
 * they would inevitably drift. Extracted here with explicit tests for
 * backwards compatibility against older briefings (pre-2026-04-23) that
 * lack the new schema fields.
 *
 * Resolution priority (most-trusted first):
 *
 *   1. `llmRelevanceScore` (0-10, normalized to 0-1) — the LLM judged
 *      semantic relevance directly. Most-authoritative when present.
 *      Set by Iteration-Loop Pass 2 (signal-relevance-llm.ts).
 *
 *   2. `queryRelevance` (0-1) — the synthesis LLM marked this signal as
 *      one it actually leaned on for the answer. High signal when present
 *      because it's based on observed use, not a priori match.
 *
 *   3. `displayScore` (0-1) — canonical retrieval-layer relevance score
 *      from `getRelevantSignals`, with anchor-bypass floors applied.
 *      Honest measure of «how confident is retrieval that this is on-topic?»
 *
 *   4. `keywordOverlap` (0-1) — raw weighted-overlap fraction. Fallback
 *      for older briefings that pre-date the displayScore introduction.
 *
 *   5. `0.3` default — pessimistic fallback. Triggers for very old
 *      briefings (pre-2026-04-21) where no relevance metadata was
 *      attached at all. 0.3 is below the social-tier threshold (0.5)
 *      and below most overlap thresholds (0.45-0.55), so unjudged
 *      signals don't dominate visualization but are also not invisible.
 */

export interface TopicFitInput {
  llmRelevanceScore?: number; // 0-10
  queryRelevance?: number;    // 0-1
  displayScore?: number;      // 0-1
  keywordOverlap?: number;    // 0-1
}

export const TOPIC_FIT_DEFAULT = 0.3;

/**
 * Returns the canonical topic-fit score in [0, 1] for a signal,
 * preferring the highest-trust available field. Never throws — returns
 * the safe `TOPIC_FIT_DEFAULT` when no usable field is present.
 *
 * Defensive validation: each field is checked for both `typeof === "number"`
 * AND in-range. Out-of-range values fall through to the next priority
 * tier rather than being clamped silently — that way bad data doesn't
 * masquerade as confident input.
 */
export function signalTopicalFit(s: TopicFitInput | null | undefined): number {
  if (!s) return TOPIC_FIT_DEFAULT;

  if (typeof s.llmRelevanceScore === "number" && s.llmRelevanceScore >= 0 && s.llmRelevanceScore <= 10) {
    return s.llmRelevanceScore / 10;
  }
  if (typeof s.queryRelevance === "number" && s.queryRelevance >= 0 && s.queryRelevance <= 1) {
    return s.queryRelevance;
  }
  if (typeof s.displayScore === "number" && s.displayScore >= 0 && s.displayScore <= 1) {
    return s.displayScore;
  }
  if (typeof s.keywordOverlap === "number" && s.keywordOverlap >= 0 && s.keywordOverlap <= 1) {
    return s.keywordOverlap;
  }
  return TOPIC_FIT_DEFAULT;
}
