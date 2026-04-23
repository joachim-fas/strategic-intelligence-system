/**
 * Signal-Coverage-Critique — Iteration-Loop Pass 3
 *
 * ════════════════════════════════════════════════════════════════════════
 * WAS DAS MODUL TUT
 * ════════════════════════════════════════════════════════════════════════
 *
 * Nach Pass 1 (Multi-Evidence-Gate) und Pass 2 (LLM-Relevance-Filter)
 * haben wir 5-15 Signale, die jedes für sich relevant sind. Pass 3 fragt
 * die andere Hälfte der Frage:
 *
 *   "Sind diese Signale ZUSAMMEN ein ausreichendes Evidence-Fundament
 *    für die Frage? Was fehlt? Was ist überrepräsentiert? Wie hoch
 *    darf die Synthesis-Confidence höchstens sein?"
 *
 * Das ist eine fundamentale andere Frage als Pass 2:
 *   - Pass 2: ist DIESES Signal relevant? (per-signal)
 *   - Pass 3: ist die SET zusammen genug? (collective)
 *
 * Konkretes Beispiel — Rundfunk-Query:
 *   - Pass 1+2 lassen 2 Signale durch: ECFR (EU-Außenpolitik) + OSW
 *     (Osteuropa-Sicherheit). Beide sind technisch relevant (multi-match
 *     auf "Deutschland" + "Gesellschaft" + "Politik").
 *   - Pass 3 erkennt: keine Daten zu konkreten Rundfunk-Anstalten
 *     (ARD/ZDF/ORF), keine Demoskopie zu Vertrauen, beide Quellen
 *     framen Geopolitik nicht Medienpolitik. Confidence-Ceiling 0.3.
 *   - Ohne Pass 3 würde die Synthesis vermutlich 60-70% Konfidenz
 *     reklamieren und über Rundfunk-Vertrauen schwadronieren mit
 *     [LLM-KNOWLEDGE]-Tags überall — aber der User sieht nicht
 *     explizit, was sind die strukturellen Lücken.
 *   - Mit Pass 3: Synthesis-Prompt bekommt expliziten <coverage_analysis>
 *     Block, ist gezwungen die Lücken namentlich zu erwähnen, Confidence
 *     ist auf 0.3 gedeckelt.
 *
 * ════════════════════════════════════════════════════════════════════════
 * WIE PASS 3 IN DEN PROMPT EINGEFÜGT WIRD
 * ════════════════════════════════════════════════════════════════════════
 *
 * Der Synthesis-System-Prompt bekommt einen neuen Block injiziert:
 *
 *   <coverage_analysis>
 *   Confidence ceiling for this query: 0.3
 *
 *   Coverage gaps (aspects with no/weak signal support):
 *   - [HIGH] Specific public broadcasting institutions (ARD, ZDF, ORF)
 *   - [MEDIUM] Public trust survey data
 *
 *   Representation biases:
 *   - Source-bias: ECFR + OSW dominate (geopolitics framing); media-
 *     policy sources missing
 *
 *   INSTRUCTION: Respect the confidence ceiling. Use [LLM-KNOWLEDGE]
 *   tags for any claim that addresses a gap above. Do NOT claim more
 *   than the signals support.
 *   </coverage_analysis>
 *
 * Sonnet liest das, kalibriert sich. Pass 3 zwingt Sonnet zur
 * Ehrlichkeit über Datenlücken, statt sie mit LLM-Wissen zu verdecken.
 *
 * ════════════════════════════════════════════════════════════════════════
 * WAS NICHT TEIL VON PASS 3 IST
 * ════════════════════════════════════════════════════════════════════════
 *
 * Pass 3 generiert auch `refinementQueries` — search-terms die fehlende
 * Signale finden könnten. ABER: Pass 3 führt diese Queries NICHT aus.
 * Das wäre Pass 4 (Refined-Retrieval), separat zu bauen wenn wir sehen
 * dass die Refinement-Queries tatsächlich nützlich sind.
 *
 * Pass 3 alleine = Diagnose ohne Aktion. Ehrliche Synthesis statt
 * korrigierte Retrieval. Schon ein großer Schritt.
 *
 * ════════════════════════════════════════════════════════════════════════
 * KOSTEN UND LATENZ
 * ════════════════════════════════════════════════════════════════════════
 *
 * Pro Query:
 *   - Input: ~1500 Tokens (Query + 5-15 gefilterte Signale + ihre
 *     LLM-Judgments + Begründungen)
 *   - Output: ~500-800 Tokens (gaps[] + biases[] + ceiling + queries[])
 *   - Haiku 4.5: ~$0.001-0.005 pro Query
 *   - Latenz: ~2-4s
 *
 * Total Pipeline-Cost pro Query (jetzt mit Pass 3):
 *   Pass 2a + Pass 2b + Pass 3 + Sonnet-Synthesis ≈ $0.025-0.035
 *
 * ════════════════════════════════════════════════════════════════════════
 * FAILURE-HANDLING
 * ════════════════════════════════════════════════════════════════════════
 *
 * Same Konvention wie Pass 2: bei jedem Fehler returnt `null`. Caller
 * baut den `<coverage_analysis>`-Block dann nicht in den Prompt ein —
 * Synthesis läuft normal ohne explizites Coverage-Bewusstsein. Keine
 * Pass-3-bedingte Regression möglich.
 */

import { resolveEnv } from "./env";
import type { LiveSignal } from "./signals";

export interface CoverageGap {
  aspect: string;
  severity: "low" | "medium" | "high";
  whyMissing: string;
  refinementQuery: string;
}

export interface RepresentationBias {
  type: "source" | "perspective" | "geography" | "time-period";
  description: string;
  howSkews: string;
}

export interface CoverageReport {
  coverageGaps: CoverageGap[];
  representationBiases: RepresentationBias[];
  /** 0-1 cap on appropriate synthesis confidence given the signal set */
  confidenceCeiling: number;
  /** Search queries that might find missing signals (input for future Pass 4) */
  refinementQueries: string[];
  /** 1-2 sentence executive summary */
  synthesis: string;
  /** Telemetry */
  callDurationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  modelUsed: string;
}

const MAX_SIGNALS_TO_CRITIQUE = 30;

/**
 * Build the coverage-critique prompt. Each signal is presented with its
 * Pass-2-LLM-judgment so the Pass-3 LLM has the full picture: which
 * signals are highly relevant, which marginal, and what they collectively
 * cover.
 */
function buildCritiquePrompt(query: string, signals: LiveSignal[]): string {
  const signalLines = signals.map((s, i) => {
    const id = `s${i + 1}`;
    const source = s.source;
    const tier = s.sourceTier ?? "?";
    const llmScore = typeof s.llmRelevanceScore === "number" ? s.llmRelevanceScore : "?";
    const llmReason = s.llmRelevanceReason || "";
    const title = (s.title || "").replace(/^[^:]{1,120}:\s*/, "").slice(0, 180);
    return `[${id}] [${source} | ${tier} | LLM-score: ${llmScore}] ${title}${llmReason ? `\n     why: ${llmReason}` : ""}`;
  }).join("\n");

  return `You are a research-coverage critic for a strategic intelligence system. The user has asked a strategic question. The retrieval and Pass-2 relevance filter have produced this set of signals as evidence base for the synthesis LLM.

Your job is NOT to evaluate individual signals (Pass 2 already did that). Your job is to evaluate the SET COLLECTIVELY:
- Does the set provide adequate coverage of the question?
- Which aspects of the question have NO or WEAK signal support?
- Is any source / perspective / geography / time-period overrepresented in a way that could mislead the synthesis?
- Given the set, what is the highest synthesis confidence that would be honest?

Strategic question:
${query}

Filtered signal set (Pass-2 vetted):
${signalLines}

Be honest about gaps. The synthesis LLM is downstream — if you say "coverage is fine" when it isn't, the synthesis will overclaim. If you flag gaps explicitly, the synthesis will use [LLM-KNOWLEDGE] tags appropriately and adjust confidence down.

Confidence ceiling guideline:
- 0.85-1.0: comprehensive multi-source coverage, multiple perspectives, recent data, strong evidence
- 0.65-0.85: solid coverage of main aspects, some sub-aspects sparse
- 0.45-0.65: covers the question's surface but key sub-questions have weak/no support
- 0.25-0.45: signals tangentially related but not directly answering the core question
- 0.0-0.25: signal set is essentially insufficient — synthesis would be mostly LLM-knowledge

Return ONLY a valid JSON object (no prose, no fences) with this structure:
{
  "coverageGaps": [
    {
      "aspect": "Specific aspect of the query that has weak/no signal coverage (one sentence)",
      "severity": "low | medium | high",
      "whyMissing": "Brief explanation of why no signals address this (e.g. 'no broadcasting connectors in DB', 'all signals are policy-tangential not media-specific')",
      "refinementQuery": "A search query (3-8 words, German if query is German, English otherwise) that might surface missing signals if executed in a future retrieval pass"
    }
  ],
  "representationBiases": [
    {
      "type": "source | perspective | geography | time-period",
      "description": "What is overrepresented (e.g. 'ECFR + OSW dominate, both geopolitics framing')",
      "howSkews": "How this might mislead synthesis if not flagged"
    }
  ],
  "confidenceCeiling": 0.4,
  "refinementQueries": [
    "Top 3-5 most valuable refinement queries from the gaps above (verbatim repeat for easy extraction)"
  ],
  "synthesis": "1-2 sentences: what the coverage analysis says about the appropriate honesty level for the synthesis"
}

Constraints:
- coverageGaps: 0-5 entries (no padding — only real gaps)
- representationBiases: 0-3 entries
- confidenceCeiling: 0.0-1.0, must reflect honest assessment
- refinementQueries: 0-5 entries, drawn from the gaps[] field
- If the signal set is genuinely comprehensive, return empty arrays and a high ceiling. Don't manufacture gaps.`;
}

/**
 * Robust JSON extractor for Haiku output. Same pattern as in
 * signal-relevance-llm.ts — strips code-fence decorations and prose.
 *
 * Exported for testing.
 */
export function extractCoverageReport(text: string): Partial<CoverageReport> | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objMatch) return null;
  try {
    const parsed = JSON.parse(objMatch[0]);
    if (!parsed || typeof parsed !== "object") return null;
    // Defensive normalisation — ensure expected shapes
    const gaps = Array.isArray(parsed.coverageGaps) ? parsed.coverageGaps.filter((g: any) =>
      g && typeof g.aspect === "string"
    ).map((g: any) => ({
      aspect: String(g.aspect),
      severity: ["low", "medium", "high"].includes(g.severity) ? g.severity : "medium",
      whyMissing: typeof g.whyMissing === "string" ? g.whyMissing : "",
      refinementQuery: typeof g.refinementQuery === "string" ? g.refinementQuery : "",
    })) : [];
    const biases = Array.isArray(parsed.representationBiases) ? parsed.representationBiases.filter((b: any) =>
      b && typeof b.description === "string"
    ).map((b: any) => ({
      type: ["source", "perspective", "geography", "time-period"].includes(b.type) ? b.type : "perspective",
      description: String(b.description),
      howSkews: typeof b.howSkews === "string" ? b.howSkews : "",
    })) : [];
    const ceiling = typeof parsed.confidenceCeiling === "number"
      ? Math.max(0, Math.min(1, parsed.confidenceCeiling))
      : 0.5; // safe fallback if missing
    const queries = Array.isArray(parsed.refinementQueries)
      ? parsed.refinementQueries.filter((q: any) => typeof q === "string" && q.trim().length > 0)
      : [];
    return {
      coverageGaps: gaps,
      representationBiases: biases,
      confidenceCeiling: ceiling,
      refinementQueries: queries,
      synthesis: typeof parsed.synthesis === "string" ? parsed.synthesis : "",
    };
  } catch {
    return null;
  }
}

/**
 * Run Pass 3 — Coverage Critique against Claude Haiku. Returns null on
 * any failure (no API key, HTTP error, malformed output) — caller must
 * handle null by NOT injecting the coverage block into the synthesis
 * prompt. Synthesis then runs normally without explicit coverage
 * awareness, which is the pre-Pass-3 baseline behavior. No regression.
 */
export async function analyzeCoverage(
  query: string,
  signals: LiveSignal[],
): Promise<CoverageReport | null> {
  // Empty input → trivial empty report (synthesis already handles 0-signal case)
  if (signals.length === 0) {
    return {
      coverageGaps: [{
        aspect: "Entire query — no signals retrieved",
        severity: "high",
        whyMissing: "Pass 1 + Pass 2 produced empty set",
        refinementQuery: query,
      }],
      representationBiases: [],
      confidenceCeiling: 0.15,
      refinementQueries: [query],
      synthesis: "No signal support. Synthesis must rely entirely on LLM knowledge with explicit [LLM-KNOWLEDGE] tags.",
      callDurationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      modelUsed: "(none — empty input)",
    };
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const batch = signals.slice(0, MAX_SIGNALS_TO_CRITIQUE);
  const prompt = buildCritiquePrompt(query, batch);

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
        max_tokens: 2000,
        system: "You are a precise research-coverage critic. Return ONLY valid JSON. No prose, no markdown fences.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[signal-coverage-critique] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    const inputTokens = data?.usage?.input_tokens ?? null;
    const outputTokens = data?.usage?.output_tokens ?? null;
    const callDurationMs = Date.now() - t0;

    if (!text) {
      console.warn("[signal-coverage-critique] empty response text");
      return null;
    }

    const partial = extractCoverageReport(text);
    if (!partial) {
      console.warn("[signal-coverage-critique] could not parse coverage report:", text.slice(0, 300));
      return null;
    }

    return {
      coverageGaps: partial.coverageGaps ?? [],
      representationBiases: partial.representationBiases ?? [],
      confidenceCeiling: partial.confidenceCeiling ?? 0.5,
      refinementQueries: partial.refinementQueries ?? [],
      synthesis: partial.synthesis ?? "",
      callDurationMs,
      inputTokens,
      outputTokens,
      modelUsed: model,
    };
  } catch (e) {
    console.warn("[signal-coverage-critique] exception:", e);
    return null;
  }
}

/**
 * Hard-clamp the synthesis-LLM's self-reported confidence against the
 * Pass-3 confidence ceiling. Sonnet can ignore the injected
 * <coverage_analysis> instruction and still claim higher confidence
 * than the ceiling allows — this function enforces the ceiling as a
 * UPPER BOUND. Conservative LLM confidence (below ceiling) is left
 * untouched; only over-confidence gets capped.
 *
 * Returns:
 *   - confidence: the (possibly clamped) value the route should use
 *   - clamped: metadata for logging + UI surfacing, or null if no clamp happened
 *
 * Defensive null-handling: if ceiling is missing or out of [0, 1],
 * no clamp is applied. Pass-3 might not have produced a ceiling
 * (Pass-3 failed entirely → null report), in which case we trust the
 * LLM's self-confidence as-is.
 *
 * Exported for testing.
 */
export function clampConfidenceToCeiling(
  llmConfidence: number,
  ceiling: number | null | undefined,
): {
  confidence: number;
  clamped: { original: number; ceiling: number } | null;
} {
  if (typeof ceiling !== "number" || ceiling < 0 || ceiling > 1) {
    return { confidence: llmConfidence, clamped: null };
  }
  if (typeof llmConfidence !== "number" || isNaN(llmConfidence)) {
    return { confidence: llmConfidence, clamped: null };
  }
  if (llmConfidence <= ceiling) {
    return { confidence: llmConfidence, clamped: null };
  }
  return {
    confidence: ceiling,
    clamped: { original: llmConfidence, ceiling },
  };
}

/**
 * Format the coverage report as a structured text block for injection
 * into the synthesis system prompt. Returns empty string if report is
 * null or trivially empty (no gaps, no biases) — in that case there's
 * nothing useful to inject.
 *
 * Exported for testing AND for the route handler that does the
 * injection.
 */
export function formatCoverageBlock(report: CoverageReport | null, locale: "de" | "en" = "en"): string {
  if (!report) return "";
  const hasGaps = report.coverageGaps.length > 0;
  const hasBiases = report.representationBiases.length > 0;
  // If no gaps AND no biases AND ceiling is permissive (>0.7), the
  // coverage is fine — no need to clutter the prompt.
  if (!hasGaps && !hasBiases && report.confidenceCeiling > 0.7) return "";

  const headerDe = "Coverage-Analyse (Iteration-Loop Pass 3):";
  const headerEn = "Coverage Analysis (Iteration-Loop Pass 3):";
  const ceilingLabelDe = "Confidence-Ceiling für diese Frage";
  const ceilingLabelEn = "Confidence ceiling for this query";
  const gapsLabelDe = "Coverage-Lücken (Aspekte ohne/mit schwachem Signal-Support):";
  const gapsLabelEn = "Coverage gaps (aspects with no/weak signal support):";
  const biasesLabelDe = "Repräsentations-Biases (Verzerrungen im Signal-Set):";
  const biasesLabelEn = "Representation biases (skews in the signal set):";
  const instructionDe = "ANWEISUNG: Respektiere das Confidence-Ceiling. Verwende [LLM-KNOWLEDGE]-Tags für Aussagen, die oben als Lücke markiert sind. Erfinde keine Konfidenz, die die Signale nicht stützen.";
  const instructionEn = "INSTRUCTION: Respect the confidence ceiling. Use [LLM-KNOWLEDGE] tags for any claim that addresses a gap above. Do NOT claim more than the signals support.";

  const header = locale === "de" ? headerDe : headerEn;
  const ceilingLabel = locale === "de" ? ceilingLabelDe : ceilingLabelEn;
  const gapsLabel = locale === "de" ? gapsLabelDe : gapsLabelEn;
  const biasesLabel = locale === "de" ? biasesLabelDe : biasesLabelEn;
  const instruction = locale === "de" ? instructionDe : instructionEn;

  const parts: string[] = [
    "<coverage_analysis>",
    `${header}`,
    "",
    `${ceilingLabel}: ${report.confidenceCeiling.toFixed(2)}`,
  ];

  if (hasGaps) {
    parts.push("");
    parts.push(gapsLabel);
    for (const g of report.coverageGaps) {
      parts.push(`  - [${g.severity.toUpperCase()}] ${g.aspect}`);
      if (g.whyMissing) parts.push(`        why: ${g.whyMissing}`);
    }
  }

  if (hasBiases) {
    parts.push("");
    parts.push(biasesLabel);
    for (const b of report.representationBiases) {
      parts.push(`  - [${b.type}] ${b.description}`);
      if (b.howSkews) parts.push(`        skews: ${b.howSkews}`);
    }
  }

  if (report.synthesis) {
    parts.push("");
    parts.push(`Summary: ${report.synthesis}`);
  }

  parts.push("");
  parts.push(instruction);
  parts.push("</coverage_analysis>");

  return parts.join("\n");
}
