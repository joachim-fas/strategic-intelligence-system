/**
 * Meta-Prompt Runtime — server-only execution paths.
 *
 * Split out of `meta-prompts.ts` on 2026-04-19 because the docs page
 * `/dokumentation/prompts/page.tsx` is a client component that imports
 * the registry, which in turn imports prompt builders from
 * `meta-prompts.ts`. Next.js's client bundler statically resolves every
 * module that is reachable — including `await import("./env")` paths —
 * so a top-level `import { resolveEnv } from "./env"` anywhere in the
 * reachable graph pulled `fs` into the browser bundle and broke the
 * page with "Module not found: Can't resolve 'fs'".
 *
 * The fix: the two LLM-runner functions (`runContradictionCheck`,
 * `runAssumptionExtraction`) live here, NOT in `meta-prompts.ts`.
 * Server-side callers (e.g. `/api/v1/query`) import from this module;
 * the registry only pulls pure prompt builders + constants from
 * `meta-prompts.ts`, which stays client-safe.
 *
 * `checkScenarioDivergence` (pure validator, no LLM call, no env) still
 * lives in `meta-prompts.ts` and can be imported from either side.
 */

import { resolveEnv } from "./env";
import type {
  ContradictionCheckInput,
  ContradictionReport,
  AssumptionExtractionInput,
  AssumptionReport,
} from "./meta-prompts";
import {
  buildContradictionCheckPrompt,
  buildAssumptionExtractionPrompt,
} from "./meta-prompts";

/**
 * Run the contradiction check against Claude Haiku. Returns null if the
 * API key is missing, the HTTP call fails, or the output can't be parsed
 * — callers should treat null as "check skipped" and not a verdict.
 */
export async function runContradictionCheck(
  input: ContradictionCheckInput,
): Promise<ContradictionReport | null> {
  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const prompt = buildContradictionCheckPrompt(input);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        system: "You are a precise, structural fact-checker. Return only valid JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as ContradictionReport;
  } catch {
    return null;
  }
}

/**
 * Run the assumption-extraction pass against Claude Sonnet. Same null-
 * on-failure contract as runContradictionCheck: callers log and
 * continue, the base briefing is never blocked.
 */
export async function runAssumptionExtraction(
  input: AssumptionExtractionInput,
): Promise<AssumptionReport | null> {
  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const prompt = buildAssumptionExtractionPrompt(input);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        system: "You are a precise analyst surfacing implicit assumptions. Return only valid JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as AssumptionReport;
  } catch {
    return null;
  }
}
