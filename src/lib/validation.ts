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
  type: z.enum(["optimistic", "baseline", "pessimistic", "wildcard"]).optional(),
  name: z.string().max(200).default("Unnamed Scenario"),
  description: z.string().max(2000).default(""),
  probability: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    },
    z.number().min(0).max(1).nullable()
  ),
  timeframe: z.string().max(200).optional(),
  keyDrivers: z.array(z.string().max(300)).max(10).optional(),
});

const ReferenceSchema = z.object({
  title: z.string().max(500).default(""),
  url: z.string().max(2000).default(""),
  relevance: z.string().max(500).optional(),
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
  synthesis: z.string().min(1).max(10000),
  reasoningChains: z.array(z.string().max(1000)).max(10).default([]),
  steepV: SteepVSchema.optional().nullable(),
  matchedTrendIds: z.array(z.string().max(100)).max(40).default([]),
  matchedTrendRelevance: z
    .record(z.string().max(100), z.number().min(0).max(1))
    .optional()
    .nullable(),
  keyInsights: z.array(z.string().max(1000)).max(10).default([]),
  regulatoryContext: z.array(z.string().max(1000)).max(10).default([]),
  causalAnalysis: z.array(z.string().max(1000)).max(10).default([]),
  scenarios: z.array(ScenarioSchema).max(5).default([]),
  interpretation: z.string().max(3000).optional().nullable(),
  references: z.array(ReferenceSchema).max(20).default([]),
  followUpQuestions: z.array(z.string().max(500)).max(10).default([]),
  newsContext: z.string().max(3000).optional().nullable(),
  decisionFramework: z.string().max(3000).optional().nullable(),
  balancedScorecard: BSCSchema.optional().nullable(),
  confidence: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") return parseFloat(val) || 0;
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

  // Step 2: Validate matchedTrendIds — filter hallucinated IDs
  const originalCount = data.matchedTrendIds.length;
  const droppedIds = data.matchedTrendIds.filter((id) => !validTrendIds.has(id));
  data.matchedTrendIds = data.matchedTrendIds.filter((id) => validTrendIds.has(id));
  if (droppedIds.length > 0) {
    warnings.push(
      `Dropped ${droppedIds.length}/${originalCount} hallucinated matchedTrendIds: ${droppedIds.slice(0, 5).join(", ")}`
    );
  }
  if (data.matchedTrendIds.length === 0 && originalCount > 0) {
    warnings.push("ALL matchedTrendIds were invalid — LLM did not match any real trends");
  }

  // Step 2b: Filter matchedTrendRelevance to only keep entries for valid matched IDs.
  // Entries for dropped / hallucinated ids are removed so they cannot re-enter the pipeline.
  if (data.matchedTrendRelevance) {
    const validSet = new Set(data.matchedTrendIds);
    const filtered: Record<string, number> = {};
    for (const [id, score] of Object.entries(data.matchedTrendRelevance)) {
      if (validSet.has(id)) filtered[id] = score;
    }
    data.matchedTrendRelevance = Object.keys(filtered).length > 0 ? filtered : null;
  }

  // Step 3: Normalize scenario probabilities
  if (data.scenarios.length === 3) {
    const probs = data.scenarios.map((s) => s.probability);
    const hasNulls = probs.some((p) => p === null);

    if (hasNulls) {
      warnings.push("Scenario probabilities contained non-numeric values — applied type-based defaults");
      data.scenarios.forEach((s) => {
        if (s.probability === null) {
          s.probability =
            s.type === "baseline" ? 0.45 :
            s.type === "optimistic" ? 0.30 : 0.25;
        }
      });
    }

    const numericProbs = data.scenarios.map((s) => s.probability as number);
    const sum = numericProbs.reduce((a, b) => a + b, 0);

    if (sum > 0 && (sum > 1.1 || sum < 0.8)) {
      warnings.push(`Scenario probability sum was ${sum.toFixed(2)} — normalized to 1.0`);
      data.scenarios.forEach((s, i) => {
        s.probability = Math.round((numericProbs[i] / sum) * 100) / 100;
      });
    }

    // Detect identical/default distributions
    const probValues = data.scenarios.map((s) => s.probability);
    if (probValues[0] === probValues[1] && probValues[1] === probValues[2]) {
      warnings.push(`All scenario probabilities identical (${probValues[0]}) — LLM may be defaulting`);
    }
  } else if (data.scenarios.length > 0 && data.scenarios.length !== 3) {
    warnings.push(`Expected 3 scenarios, got ${data.scenarios.length}`);
  }

  // Step 4: Validate reference URLs — check format, drop malformed
  data.references = data.references.filter((ref) => {
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
