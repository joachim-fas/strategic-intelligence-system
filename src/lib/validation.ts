/**
 * Validation utilities for the Strategic Intelligence System
 *
 * Contains:
 * - VAL-01: Zod-based LLM response validation (anti-hallucination enforcement)
 * - Input sanitization utilities
 * - Number/string validators
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// VAL-01: Zod-based validation for LLM responses
//
// The LLM is INSTRUCTED not to hallucinate, but this code VERIFIES compliance.
// Ensures LLM output conforms to expected structure before reaching the client.
// ═══════════════════════════════════════════════════════════════════════════════

const ScenarioSchema = z.object({
  type: z.enum(["optimistic", "baseline", "likely", "pessimistic", "wildcard"]).optional(),
  name: z.string().max(200).default("Unnamed Scenario"),
  title: z.string().max(200).optional(), // v0.2 alias for name
  description: z.string().max(2000).default(""),
  probability: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "number") {
        // v0.2 Notion spec uses 0-100 integers; legacy used 0-1 floats.
        // Normalize to 0-1.
        return val > 1 ? val / 100 : val;
      }
      if (typeof val === "string") {
        const parsed = parseFloat(val);
        if (isNaN(parsed)) return null;
        return parsed > 1 ? parsed / 100 : parsed;
      }
      return null;
    },
    z.number().min(0).max(1).nullable()
  ),
  timeframe: z.string().max(200).optional(),
  horizon: z.enum(["short", "mid", "long"]).optional(), // v0.2
  keyDrivers: z.array(z.string().max(300)).max(10).optional(),
  keyAssumptions: z.array(z.string().max(400)).max(10).optional(), // v0.2
  earlyIndicators: z.array(z.string().max(400)).max(10).optional(), // v0.2
});

/**
 * v0.2 scenario-as-named-object shape. The Notion spec switched from
 * `scenarios: [{type: "optimistic", …}, …]` to
 * `scenarios: {optimistic: {…}, likely: {…}, pessimistic: {…}}`. We
 * accept both in the preprocessor below and normalize to the legacy
 * array shape so the rest of the pipeline doesn't need to change.
 */
const ScenarioObjectSchema = z.object({
  optimistic: ScenarioSchema.optional(),
  likely: ScenarioSchema.optional(),
  baseline: ScenarioSchema.optional(),
  pessimistic: ScenarioSchema.optional(),
});

/** Normalize `scenarios` from either Notion-v0.2 object or legacy array to a legacy array. */
function normalizeScenarios(raw: unknown): Array<z.infer<typeof ScenarioSchema>> {
  if (Array.isArray(raw)) return raw as Array<z.infer<typeof ScenarioSchema>>;
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const out: Array<Record<string, unknown>> = [];
  // Notion uses "likely" for the middle scenario; legacy UI expects "baseline".
  for (const [key, type] of [["optimistic", "optimistic"], ["likely", "baseline"], ["baseline", "baseline"], ["pessimistic", "pessimistic"]] as const) {
    const entry = obj[key];
    if (!entry || typeof entry !== "object") continue;
    // Don't double-add if both "likely" and "baseline" are present
    if (type === "baseline" && out.some((e) => e.type === "baseline")) continue;
    const e = entry as Record<string, unknown>;
    out.push({
      ...e,
      type,
      name: (e.name as string) ?? (e.title as string) ?? "",
    });
  }
  return out as Array<z.infer<typeof ScenarioSchema>>;
}

/**
 * v0.2 structured regulatory context. Accepted alongside legacy string[].
 * Normalized to string[] for the UI via `flattenRegulatoryContext`.
 */
const RegulatoryContextEntrySchema = z.object({
  name: z.string().max(300),
  jurisdiction: z.string().max(120).optional(),
  effect: z.string().max(800).optional(),
  urgency: z.enum(["immediate", "near_term", "long_term"]).optional(),
});

function flattenRegulatoryContext(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      const name = typeof e.name === "string" ? e.name : "";
      if (!name) return null;
      const parts: string[] = [name];
      if (typeof e.jurisdiction === "string" && e.jurisdiction) parts[0] = `${name} (${e.jurisdiction})`;
      if (typeof e.effect === "string" && e.effect) parts.push(e.effect);
      if (typeof e.urgency === "string" && e.urgency) parts.push(`urgency: ${e.urgency.replace("_", " ")}`);
      return parts.join(" — ");
    })
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** v0.2 matched-trend object entry — has richer metadata than matchedTrendIds. */
const MatchedTrendEntrySchema = z.object({
  trendId: z.string().max(100),
  relevanceScore: z.preprocess(
    (v) => (typeof v === "number" ? (v > 1 ? v / 100 : v) : (typeof v === "string" ? parseFloat(v) || 0 : 0)),
    z.number().min(0).max(1)
  ),
  velocityChange: z.string().max(100).optional(),
  explanation: z.string().max(1000).optional(),
});

/** v0.2 signals that contradict dominant trend directions. */
const AnomalySignalSchema = z.object({
  signal: z.string().max(1000),
  contradicts: z.string().max(500),
  interpretation: z.string().max(1000),
});

/** v0.2 data-quality coverage meta. */
const DataQualitySchema = z.object({
  signalCount: z.number().min(0).max(10000).optional(),
  newestSignalAge: z.string().max(100).optional(),
  coverageGaps: z.array(z.string().max(500)).max(20).optional(),
  dominantSourceType: z.string().max(50).optional(),
});

/** v0.2 structured source list. */
const UsedSourceSchema = z.object({
  type: z.enum(["signal", "trend", "regulation", "edge", "llm"]),
  name: z.string().max(300),
  date: z.string().max(50).optional(),
});

/**
 * Per-query relevance rating for a live signal the LLM actually engaged
 * with. Added 2026-04-21 as part of the Signal-Kettenbezug fix — lets
 * the server and UI tell apart "signal that the LLM used" from
 * "signal that matched a keyword by accident".
 *
 * The match back to the retrieved signal set is via exact
 * source + title string equality, so both fields must be copied VERBATIM
 * from the `<live_signals>` block in the prompt.
 */
const UsedSignalRefSchema = z.object({
  source: z.string().max(120),
  title: z.string().max(500),
  queryRelevance: z.preprocess(
    (val) => {
      if (typeof val === "number") return val > 1 ? val / 100 : val;
      if (typeof val === "string") {
        const p = parseFloat(val);
        if (isNaN(p)) return 0;
        return p > 1 ? p / 100 : p;
      }
      return 0;
    },
    z.number().min(0).max(1).default(0)
  ),
});

/**
 * Critical-Fix-Plan P1-2 (Notion 2026-04-20): Domains, deren URLs wir als
 * "editorially verified" markieren. Reihenfolge ist irrelevant; der
 * Match läuft via `host === domain || host.endsWith("." + domain)`.
 *
 * Kriterien für Aufnahme in diese Liste:
 *  - Autoritative Primär-Quelle (Regierung, internationale Org, Research)
 *  - Connector-Backend (GDELT, Polymarket, arXiv etc. — Quellen der
 *    Live-Signal-Pipeline)
 *  - Etablierte Fachmedien mit redaktioneller Verantwortung
 *
 * NICHT auf der Liste: Blogs, Medium-Artikel, beliebige
 * Sub-Domain-Konstrukte. Für die zeigt die UI explizit
 * "unverifizierte Quelle".
 */
const KNOWN_DOMAINS: string[] = [
  // EU + nationale Behörden
  "europa.eu", "ec.europa.eu", "eurostat.ec.europa.eu",
  "bundestag.de", "bundesregierung.de", "parlament.gv.at",
  // Internationale Organisationen
  "un.org", "who.int", "imf.org", "worldbank.org", "oecd.org",
  "wto.org", "iea.org", "unfccc.int", "weforum.org",
  // Research + Academic
  "arxiv.org", "nature.com", "science.org", "ssrn.com",
  "jrc.ec.europa.eu", "nber.org",
  // Connectors
  "polymarket.com", "kalshi.com", "manifold.markets",
  "github.com", "news.ycombinator.com", "reddit.com",
  "fred.stlouisfed.org", "bls.gov", "eia.gov",
  "npm.js", "pypi.org", "producthunt.com", "wikipedia.org",
  "stackoverflow.com", "gdelt.org", "gdeltproject.org",
  // Etablierte Fachmedien
  "ft.com", "economist.com", "bloomberg.com", "reuters.com",
  "wsj.com", "nytimes.com", "spiegel.de", "zeit.de", "faz.net",
  "handelsblatt.com", "diepresse.com", "derstandard.at",
  "politico.eu", "bruegel.org", "carnegieendowment.org",
  // Tech + Industry Research
  "gartner.com", "forrester.com", "mckinsey.com", "bcg.com",
  "bain.com", "deloitte.com", "pwc.com", "ey.com", "kpmg.com",
];

const ReferenceSchema = z.object({
  title: z.string().max(500).default(""),
  url: z.string().max(2000).default(""),
  relevance: z.string().max(500).optional(),
  /** Gesetzt vom Validator nach Domain-Check (P1-2). */
  verified: z.boolean().optional(),
});

const BSCPerspectiveSchema = z.object({
  id: z.string().max(50),
  label: z.string().max(100),
  score: z.number().min(0).max(1),
  trend: z.enum(["rising", "stable", "declining", "uncertain"]),
  summary: z.string().max(1000),
  keyFactors: z.array(z.string().max(300)).max(10).default([]),
  connectedTrendIds: z.array(z.string().max(100)).max(20).default([]),
  impacts: z.record(z.string(), z.number().min(-1).max(1)).default({}),
});

const BSCSchema = z.object({
  perspectives: z.array(BSCPerspectiveSchema).min(3).max(6),
  overallReadiness: z.number().min(0).max(1),
  criticalTension: z.string().max(500).optional(),
});

const SteepVSchema = z.object({
  S: z.string().max(1000).nullable().optional(),
  T: z.string().max(1000).nullable().optional(),
  E_economy: z.string().max(1000).nullable().optional(),
  E_environment: z.string().max(1000).nullable().optional(),
  P: z.string().max(1000).nullable().optional(),
  V: z.string().max(1000).nullable().optional(),
});

export const LLMResponseSchema = z.object({
  synthesis: z.string().min(1).max(12000),
  reasoningChains: z.array(z.string().max(1000)).max(10).default([]),
  steepV: SteepVSchema.optional().nullable(),
  matchedTrendIds: z.array(z.string().max(100)).max(40).default([]),
  matchedTrendRelevance: z
    .record(z.string().max(100), z.number().min(0).max(1))
    .optional()
    .nullable(),
  /** v0.2 structured matched-trend objects (optional, additive). */
  matchedTrends: z.array(MatchedTrendEntrySchema).max(40).optional(),
  keyInsights: z.array(z.string().max(1500)).max(10).default([]),
  /**
   * regulatoryContext accepts legacy flat strings OR v0.2 objects. Normalized
   * to string[] via the preprocessor.
   */
  regulatoryContext: z.preprocess(
    (val) => flattenRegulatoryContext(val),
    z.array(z.string().max(1500)).max(10).default([])
  ),
  /** v0.2 alias — rich regulation objects, if the LLM supplied them. */
  regulatoryContextRich: z.array(RegulatoryContextEntrySchema).max(10).optional(),
  causalAnalysis: z.array(z.string().max(1000)).max(10).default([]),
  /** v0.2 alias — same content as causalAnalysis, enforced by the prompt. */
  causalChain: z.array(z.string().max(1000)).max(10).optional(),
  /**
   * scenarios accepts legacy array form OR v0.2 named-object form. Normalized
   * to array for the UI.
   */
  scenarios: z.preprocess(
    (val) => normalizeScenarios(val),
    z.array(ScenarioSchema).max(5).default([])
  ),
  /** v0.2 signals that contradict the dominant trend direction. */
  anomalySignals: z.array(AnomalySignalSchema).max(10).optional(),
  interpretation: z.string().max(3000).optional().nullable(),
  references: z.array(ReferenceSchema).max(20).default([]),
  followUpQuestions: z.array(z.string().max(500)).max(10).default([]),
  newsContext: z.string().max(3000).optional().nullable(),
  decisionFramework: z.string().max(3000).optional().nullable(),
  balancedScorecard: BSCSchema.optional().nullable(),
  /** v0.2 data-coverage meta rendered as a badge. */
  dataQuality: DataQualitySchema.optional(),
  /** v0.2 structured source list for the provenance panel. */
  usedSources: z.array(UsedSourceSchema).max(40).optional(),
  /** 2026-04-21 Signal-Kettenbezug fix: per-signal query relevance. */
  usedSignalRefs: z.array(UsedSignalRefSchema).max(40).optional(),
  confidence: z.preprocess(
    (val) => {
      if (typeof val === "number") return val > 1 ? val / 100 : val;
      if (typeof val === "string") {
        const p = parseFloat(val);
        if (isNaN(p)) return 0;
        return p > 1 ? p / 100 : p;
      }
      return 0;
    },
    z.number().min(0).max(1).default(0)
  ),
});

export type ValidatedLLMResponse = z.infer<typeof LLMResponseSchema>;

export interface ValidationResult {
  data: ValidatedLLMResponse;
  warnings: string[];
}

/**
 * VAL-02: Validate and normalize parsed LLM output.
 *
 * Returns a clean, type-safe result with all fields coerced to correct types.
 * Collects warnings about issues found (for logging / data quality indicators).
 */
export function validateLLMResponse(
  raw: unknown,
  validTrendIds: Set<string>
): ValidationResult {
  const warnings: string[] = [];

  // Step 1: Zod structural validation with coercion
  const parsed = LLMResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    warnings.push(`Zod validation failed: ${issues.join("; ")}`);

    // Attempt partial extraction: at minimum, get synthesis
    const rawObj = raw as Record<string, unknown>;
    const synthesis =
      typeof rawObj?.synthesis === "string" && rawObj.synthesis.length > 0
        ? rawObj.synthesis
        : "Analyse konnte nicht validiert werden. Bitte erneut versuchen.";

    return {
      data: {
        synthesis,
        reasoningChains: [],
        matchedTrendIds: [],
        keyInsights: [],
        regulatoryContext: [],
        causalAnalysis: [],
        scenarios: [],
        references: [],
        followUpQuestions: [],
        confidence: 0.1,
      },
      warnings,
    };
  }

  const data = parsed.data;

  // v0.2 cross-fill: if the LLM supplied matchedTrends (rich objects) but
  // left matchedTrendIds empty (or vice versa), harmonize them.
  if (data.matchedTrends && data.matchedTrends.length > 0) {
    if (data.matchedTrendIds.length === 0) {
      data.matchedTrendIds = data.matchedTrends.map((mt) => mt.trendId);
    }
    if (!data.matchedTrendRelevance) {
      const rel: Record<string, number> = {};
      for (const mt of data.matchedTrends) rel[mt.trendId] = mt.relevanceScore;
      data.matchedTrendRelevance = rel;
    }
  }

  // Step 2: Validate matchedTrendIds — filter hallucinated IDs.
  //
  // Critical-Fix-Plan P0-3 (Notion 2026-04-20): zusätzlich zur klassischen
  // Filter-Logik geben wir einen expliziten [HALLUCINATION]-Server-Log
  // aus, wenn mehr als die Hälfte der LLM-zurückgegebenen IDs nicht in
  // der echten Trend-DB existieren. Das triggert Log-Alerts und macht
  // schleichende Prompt-Regressionen sichtbar, bevor sie den Output-
  // Qualität aushöhlen.
  const originalCount = data.matchedTrendIds.length;
  const droppedIds = data.matchedTrendIds.filter((id) => !validTrendIds.has(id));
  data.matchedTrendIds = data.matchedTrendIds.filter((id) => validTrendIds.has(id));
  if (droppedIds.length > 0) {
    warnings.push(
      `Dropped ${droppedIds.length}/${originalCount} hallucinated matchedTrendIds: ${droppedIds.slice(0, 5).join(", ")}`
    );
    // >50%-Schwelle: harter Konsolen-Warn für Monitoring.
    if (originalCount > 0 && droppedIds.length / originalCount > 0.5) {
      // eslint-disable-next-line no-console
      console.warn(
        `[HALLUCINATION] >50% invalid trend IDs returned by LLM ` +
        `(${droppedIds.length}/${originalCount}). ` +
        `Dropped samples: ${droppedIds.slice(0, 3).join(", ")}`
      );
    }
  }
  if (data.matchedTrendIds.length === 0 && originalCount > 0) {
    warnings.push("ALL matchedTrendIds were invalid — LLM did not match any real trends");
  }

  // Step 2b: Filter matchedTrendRelevance + matchedTrends to only keep entries
  // for valid matched IDs. Entries for dropped / hallucinated ids are removed
  // so they cannot re-enter the pipeline.
  if (data.matchedTrendRelevance) {
    const validSet = new Set(data.matchedTrendIds);
    const filtered: Record<string, number> = {};
    for (const [id, score] of Object.entries(data.matchedTrendRelevance)) {
      if (validSet.has(id)) filtered[id] = score;
    }
    data.matchedTrendRelevance = Object.keys(filtered).length > 0 ? filtered : null;
  }
  if (data.matchedTrends && data.matchedTrends.length > 0) {
    const validSet = new Set(data.matchedTrendIds);
    data.matchedTrends = data.matchedTrends.filter((mt) => validSet.has(mt.trendId));
  }

  // Step 2c: v0.2 cross-fill causalChain ↔ causalAnalysis. The prompt asks
  // the LLM to supply both, but some models skip the alias. Make sure the
  // UI always has causalAnalysis populated (legacy renderer) and
  // causalChain is available for newer consumers.
  if ((!data.causalAnalysis || data.causalAnalysis.length === 0) && data.causalChain && data.causalChain.length > 0) {
    data.causalAnalysis = data.causalChain;
  } else if ((!data.causalChain || data.causalChain.length === 0) && data.causalAnalysis.length > 0) {
    data.causalChain = data.causalAnalysis;
  }

  // Step 3: Scenario-Kontrakt erzwingen (Master Spec, Backlog-Task 1.2).
  //
  // Invariante: wenn die LLM überhaupt Szenarien zurückgegeben hat, müssen es
  // genau 3 sein — optimistic / baseline / pessimistic. Eine Wildcard darf
  // optional als 4. Szenario mitlaufen. Der alte Code hat 0–∞ akzeptiert und
  // nur gewarnt; damit landete eine 2-Szenarien-LLM-Antwort ungefiltert in der
  // UI und der User bekam zwei Karten statt drei.
  //
  // Regel: leere Liste bleibt leer (FACTUAL-Query, UI blendet Sektion aus).
  // Für 1–2 Szenarien füllen wir die fehlenden Slots mit deklarativen
  // Platzhaltern und markieren sie mit einer Warning, damit die Datenqualität-
  // Anzeige den Hinweis aufgreift. Ab 3 Szenarien sortieren wir in
  // optimistic→baseline→pessimistic + Wildcard-Rest.
  if (data.scenarios.length > 0) {
    const wildcards = data.scenarios.filter((s) => s.type === "wildcard");
    const primaryCandidates = data.scenarios.filter((s) => s.type !== "wildcard");

    const requiredTypes: Array<"optimistic" | "baseline" | "pessimistic"> = [
      "optimistic", "baseline", "pessimistic",
    ];
    const primary: Array<z.infer<typeof ScenarioSchema>> = [];

    // Erster Durchgang: Typen exakt matchen
    const taken = new Set<number>();
    for (const requested of requiredTypes) {
      const idx = primaryCandidates.findIndex((s, i) => !taken.has(i) && s.type === requested);
      if (idx !== -1) {
        primary.push(primaryCandidates[idx]);
        taken.add(idx);
      }
    }

    // Zweiter Durchgang: fehlende Slots mit untyped-Szenarien auffüllen,
    // dabei den gewünschten Typ zuweisen.
    for (let slot = 0; slot < requiredTypes.length; slot++) {
      if (primary[slot]) continue;
      const nextUntyped = primaryCandidates.findIndex((s, i) => !taken.has(i) && !s.type);
      if (nextUntyped !== -1) {
        primary[slot] = { ...primaryCandidates[nextUntyped], type: requiredTypes[slot] };
        taken.add(nextUntyped);
      }
    }

    // Dritter Durchgang: noch immer fehlend → synthetischer Platzhalter.
    const missingPlaceholders: string[] = [];
    for (let slot = 0; slot < requiredTypes.length; slot++) {
      if (primary[slot]) continue;
      const requiredType = requiredTypes[slot];
      missingPlaceholders.push(requiredType);
      primary[slot] = {
        type: requiredType,
        name: requiredType === "optimistic" ? "Positive Auslenkung (nicht modelliert)"
            : requiredType === "baseline" ? "Basisfall (nicht modelliert)"
            : "Negative Auslenkung (nicht modelliert)",
        description: "Dieses Szenario wurde von der Analyse nicht belastbar hergeleitet — Datenlage oder Fragetyp haben kein eigenständiges Szenario dieser Richtung getragen.",
        probability: requiredType === "baseline" ? 0.45 : 0.275,
      };
    }
    if (missingPlaceholders.length > 0) {
      warnings.push(
        `Missing scenarios: ${missingPlaceholders.join(", ")} — filled with placeholders`,
      );
    }

    // In die eigentliche Liste zurückschreiben: 3 Primär-Szenarien + optional
    // Wildcards (maximal 2, der LLM soll sparsam mit Wildcards sein).
    const finalList = [...primary, ...wildcards.slice(0, 2)];

    // Probability-Defaults für alle null-Werte setzen.
    for (const s of finalList) {
      if (s.probability === null) {
        s.probability =
          s.type === "baseline" ? 0.45 :
          s.type === "optimistic" ? 0.30 :
          s.type === "wildcard" ? 0.08 :
          0.25;
      }
    }

    // Normalize primary probabilities to sum ≈ 1.0 (Wildcards bleiben außen vor,
    // damit ihre Wahrscheinlichkeit additiv und nicht re-normalisiert wirkt).
    const primaryProbs = primary.map((s) => s.probability as number);
    const sum = primaryProbs.reduce((a, b) => a + b, 0);
    if (sum > 0 && (sum > 1.1 || sum < 0.8)) {
      warnings.push(`Primary scenario probability sum was ${sum.toFixed(2)} — normalized to 1.0`);
      primary.forEach((s, i) => {
        s.probability = Math.round((primaryProbs[i] / sum) * 100) / 100;
      });
    }

    // Detect identical/default distributions (Hinweis auf LLM-Default).
    const probValues = primary.map((s) => s.probability);
    if (probValues.length === 3 && probValues[0] === probValues[1] && probValues[1] === probValues[2]) {
      warnings.push(`All primary scenario probabilities identical (${probValues[0]}) — LLM may be defaulting`);
    }

    if (data.scenarios.length !== finalList.length) {
      warnings.push(`Normalized ${data.scenarios.length} scenarios to ${finalList.length} (3 primary + ${wildcards.length > 0 ? "wildcards" : "no wildcards"})`);
    }
    data.scenarios = finalList;
  }

  // Step 4: Validate reference URLs — check format, drop malformed +
  // mark whether the URL is from a known, audited domain.
  //
  // Critical-Fix-Plan P1-2 (Notion 2026-04-20): LLMs fabrizieren
  // gerne plausibel aussehende URLs ("Verordnung 2022/1426"). Vollständige
  // HEAD-Requests wären zu teuer + blockieren Streaming; stattdessen
  // halten wir eine Allowlist verifizierter Domains. Alles was dort nicht
  // drauf ist, bekommt ein verified:false-Flag — die UI kann das als
  // "nicht editorially geprüft" kennzeichnen (siehe BriefingExport /
  // BriefingResult references-Sektion).
  data.references = data.references
    .filter((ref) => {
      if (!ref.url || ref.url.length === 0) return true; // Title-only ref is OK
      try {
        const url = new URL(ref.url);
        if (!["http:", "https:"].includes(url.protocol)) {
          warnings.push(`Dropped reference with invalid protocol: ${ref.url}`);
          return false;
        }
        return true;
      } catch {
        warnings.push(`Dropped reference with malformed URL: ${ref.url}`);
        return false;
      }
    })
    .map((ref) => {
      if (!ref.url) return ref;
      try {
        const host = new URL(ref.url).hostname.toLowerCase();
        const verified = KNOWN_DOMAINS.some(
          (d) => host === d || host.endsWith("." + d),
        );
        // Legacy references don't have the verified-field. z.infer still works
        // because the schema's shape is open-ended via `.default`.
        return { ...ref, verified } as typeof ref & { verified: boolean };
      } catch {
        return ref;
      }
    });

  // Step 5: Confidence sanity check
  if (data.confidence === 0) {
    warnings.push("LLM returned confidence = 0 — may indicate missing calibration");
  }

  return { data, warnings };
}

/**
 * VAL-03: Compute server-side confidence score based on actual data coverage.
 * Blends with LLM's self-reported confidence for a meaningful score.
 *
 * This replaces decorative LLM confidence with evidence-based scoring.
 */
export function computeBlendedConfidence(
  llmConfidence: number,
  matchedTrendCount: number,
  signalCount: number,
  sourceCount: number,
  hasReferences: boolean
): number {
  // Server-side evidence score (same formula as intelligence-engine.ts synchronous path)
  const trendComponent  = Math.log2(1 + matchedTrendCount) / Math.log2(1 + 50) * 0.35;
  const sourceComponent = Math.log2(1 + sourceCount)        / Math.log2(1 + 30) * 0.25;
  const signalComponent = (1 - 1 / (1 + 0.005 * Math.sqrt(signalCount)))        * 0.25;
  const refComponent    = hasReferences ? 0.15 : 0;
  const serverScore = Math.min(0.95, trendComponent + sourceComponent + signalComponent + refComponent);

  // Blend: 60% evidence-based, 40% LLM self-assessment
  const blended = 0.6 * serverScore + 0.4 * (llmConfidence ?? 0);
  return Math.round(Math.min(0.98, Math.max(0.05, blended)) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Original input validation utilities
// ═══════════════════════════════════════════════════════════════════════════════

// === Input Validation ===

export function validateStringLength(
  value: string | undefined | null,
  fieldName: string,
  maxLength: number,
  minLength: number = 0
): { valid: true; value: string } | { valid: false; error: string } {
  if (value === undefined || value === null) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
  }

  return { valid: true, value: trimmed };
}

export function validateEnum<T extends string>(
  value: string | undefined | null,
  fieldName: string,
  allowedValues: readonly T[]
): { valid: true; value: T } | { valid: false; error: string } {
  if (!value || !allowedValues.includes(value as T)) {
    return {
      valid: false,
      error: `${fieldName} must be one of: ${allowedValues.join(", ")}`
    };
  }
  return { valid: true, value: value as T };
}

export function validateId(
  value: string | undefined | null,
  fieldName: string = "id"
): { valid: true; value: string } | { valid: false; error: string } {
  if (!value || typeof value !== "string") {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Allow UUIDs, nanoids, and simple alphanumeric IDs
  const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
  if (!idPattern.test(value)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true, value };
}

// === Prompt Injection Sanitization ===
export function sanitizeUserInput(input: string): string {
  // Strip content that looks like prompt injection attempts
  let sanitized = input;

  // Remove attempts to inject system/assistant/human role markers
  sanitized = sanitized.replace(/\b(System|Assistant|Human|User)\s*:/gi, "");

  // Remove XML-like tags that could manipulate prompt structure
  sanitized = sanitized.replace(/<\/?(?:system|assistant|human|prompt|instruction|context|role|message)[^>]*>/gi, "");

  // Remove markdown-style role markers
  sanitized = sanitized.replace(/^#{1,3}\s*(System|Instructions?|Prompt|Context)\b/gim, "");

  // Collapse excessive whitespace
  sanitized = sanitized.replace(/\s{10,}/g, " ");

  return sanitized.trim();
}

// === Number Validation ===
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0 && value <= 1;
}
