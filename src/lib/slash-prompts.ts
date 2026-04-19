/**
 * Slash-Command Prompt Templates (Notion v0.2)
 *
 * In the current architecture slash-commands (/trend, /scenario, /signal)
 * work by translating the terminal input into a natural-language query
 * text which then flows through the main `buildSystemPrompt()` pipeline.
 * That means the Notion v0.2 JSON schema, provenance tagging, and
 * temporal validity are already enforced automatically — no separate
 * API route needed.
 *
 * What lives here:
 *
 *  1. `expandSlashCommand(input, locale)` — converts a slash input like
 *     `/trend Generative AI` into a rich, locale-aware query text that
 *     the main briefing pipeline can handle. Used by the canvas
 *     command-line. Replaces the previous hardcoded German-only
 *     one-liner.
 *
 *  2. `TREND_SHORTFORM_PROMPT_EN`, `SCENARIO_INSTANT_PROMPT_EN` —
 *     dedicated templates from the Notion spec, in case we later wire
 *     up a separate lightweight route that returns the compact JSON
 *     instead of the full briefing shape. For now they live here as the
 *     editorial source of truth and are published via the registry +
 *     `/dokumentation/prompts`.
 *
 * The dedicated templates are intentionally kept even though they are
 * not wired into a route yet — it lets reviewers see the full Notion
 * intent, and it keeps the docs page truthful rather than silently
 * hiding prompts that exist on paper only.
 */

import { Locale } from "./i18n";

export type SlashCommand = "trend" | "scenario" | "signal" | "compare" | "explain";

/**
 * Expand a `/command arg` input into a rich query text for the main
 * briefing pipeline. Returns null when the input isn't a recognised
 * slash command — callers then route to a different handler
 * (history, export, etc.).
 */
export function expandSlashCommand(input: string, locale: Locale): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const lower = trimmed.toLowerCase();
  const de = locale === "de";

  // /trend [topic]
  if (lower === "/trend" || lower.startsWith("/trend ")) {
    const topic = trimmed.slice(6).trim();
    if (!topic) {
      return de
        ? "Welche Megatrends prägen die strategische Landschaft aktuell? Liefere die drei dringendsten mit kausalen Verbindungen."
        : "Which megatrends are shaping the strategic landscape right now? Surface the three most urgent with their causal links.";
    }
    return de
      ? `Trend Deep-Dive: ${topic}. Analysiere Treiber, Bremser, Kausal-Kanten zu verwandten Trends, aktuelle Signal-Geschwindigkeit, Tipping Points und eine Ring-Empfehlung (adopt/trial/assess/hold). Tagge jede Aussage mit [SIGNAL/TREND/EDGE/REG/LLM-KNOWLEDGE].`
      : `Trend deep-dive: ${topic}. Analyze drivers, brakes, causal edges to adjacent trends, current signal velocity, tipping points, and give a ring recommendation (adopt/trial/assess/hold). Tag every claim with [SIGNAL/TREND/EDGE/REG/LLM-KNOWLEDGE].`;
  }

  // /scenario [question]
  if (lower === "/scenario" || lower.startsWith("/scenario ")) {
    const topic = trimmed.slice(9).trim();
    if (!topic) {
      return de
        ? "Entwickle drei Szenarien (optimistisch/wahrscheinlich/pessimistisch) für die größten strategischen Unsicherheiten. Wahrscheinlichkeiten müssen sich zu 100% summieren, jedes Szenario braucht einen anderen Kausal-Mechanismus."
        : "Develop three scenarios (optimistic/likely/pessimistic) for the biggest strategic uncertainties. Probabilities must sum to 100 and each scenario needs a different causal mechanism.";
    }
    return de
      ? `Szenarien für: ${topic}. Drei unterschiedliche Szenarien (optimistisch/wahrscheinlich/pessimistisch). Jedes Szenario muss durch einen anderen Kausal-Mechanismus aus dem Weltmodell getrieben sein, benenne die Kausal-Kante die bricht oder sich verstärkt. Wahrscheinlichkeiten summieren zu 100. Früh-Indikatoren pro Szenario angeben.`
      : `Scenarios for: ${topic}. Three divergent scenarios (optimistic/likely/pessimistic). Each scenario must be driven by a DIFFERENT causal mechanism from the world model — name the causal edge that breaks or amplifies. Probabilities sum to 100. Include early indicators per scenario.`;
  }

  // /signal [source]
  if (lower === "/signal" || lower.startsWith("/signal ")) {
    const topic = trimmed.slice(7).trim();
    if (!topic) {
      return de
        ? "Welche schwachen Signale und Frühwarnzeichen gibt es aktuell? Zeige Anomalien die der herrschenden Trend-Richtung widersprechen."
        : "Which weak signals and early warnings exist right now? Show anomalies that contradict the dominant trend direction.";
    }
    return de
      ? `Identifiziere schwache Signale und Frühwarnzeichen für: ${topic}. Liste Anomalien die nicht zum dominanten Narrativ passen — potenzielle Trendwende-Indikatoren.`
      : `Identify weak signals and early warnings for: ${topic}. List anomalies that don't fit the dominant narrative — potential reversal indicators.`;
  }

  // /compare a vs b
  if (lower.startsWith("/compare ")) {
    const rest = trimmed.slice(9).trim();
    return de
      ? `Vergleiche: ${rest}. Direkte Gegenüberstellung mit Stärken/Schwächen, gegensätzlichen Kausal-Wirkungen und klarer Handlungsempfehlung.`
      : `Compare: ${rest}. Direct side-by-side with strengths/weaknesses, opposing causal effects, and a clear recommendation.`;
  }

  // /explain [term]
  if (lower.startsWith("/explain ")) {
    const term = trimmed.slice(9).trim();
    return de
      ? `Erkläre in 2-3 Sätzen: ${term}. Nutze das Weltmodell wenn der Begriff dort vorkommt; sonst LLM-Wissen transparent markiert.`
      : `Explain in 2-3 sentences: ${term}. Use the world model when the term is in it; otherwise LLM-knowledge tagged transparently.`;
  }

  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Notion v0.2 — Dedicated compact templates (editorial source of truth)
// ═════════════════════════════════════════════════════════════════════

/**
 * Compact trend briefing — returns structured data, no prose.
 * Intended for a future lightweight route that can serve the compact
 * JSON without running the full briefing pipeline.
 */
export const TREND_SHORTFORM_PROMPT_EN = `Quick analysis for trend: TREND_NAME

Return a compact trend briefing. No prose — structured data.
Use world model data first. Tag every claim.

<world_model>
<trend_record>TREND_FROM_DB_IF_EXISTS</trend_record>
<causal_edges>EDGES_CONNECTED_TO_TREND</causal_edges>
<live_signals>ALL_RELEVANT_SIGNALS</live_signals>
<regulations>TREND_RELEVANT_REGULATIONS</regulations>
</world_model>

// OUTPUT CONTRACT: Return valid JSON. No prose. Every field tagged with source.

Return JSON:
{
  "name": "string",
  "oneLiner": "string",
  "ring": "adopt|trial|assess|hold",
  "velocity": "rising|stable|falling",
  "velocitySignal": "string",            // [SIGNAL: ...] driving current velocity
  "confidence": 0,
  "keyDrivers": ["string"],
  "topRisks": ["string"],
  "connectedTrends": [
    { "name": "string", "edgeType": "drives|amplifies|dampens", "direction": "incoming|outgoing" }
  ],
  "latestSignal": "string",
  "regulatoryPressure": "none|low|medium|high",
  "recommendedAction": "string"
}`;

/**
 * Instant-scenarios template — 3 concise scenarios, no prior framework.
 * Probability sum must equal 100, each scenario by a different causal
 * mechanism.
 */
export const SCENARIO_INSTANT_PROMPT_EN = `Instant scenarios for: QUERY

Three scenarios only. Clear and concise.
Probabilities must sum to exactly 100. Horizon must be explicit.
Each scenario must be driven by a different causal mechanism — not just different outcomes.

<context>
<live_signals>ALL_RELEVANT_SIGNALS</live_signals>
<trends>ALL_RELEVANT_TRENDS_WITH_VELOCITY</trends>
<causal_edges>RELEVANT_EDGES</causal_edges>
</context>

Return JSON:
{
  "question": "string",
  "optimistic": {
    "title": "string",
    "description": "string",
    "probability": 0,
    "horizon": "string",
    "trigger": "string",
    "keyAssumption": "string"
  },
  "likely": { /* same structure */ },
  "pessimistic": { /* same structure */ },
  "confidence": 0,
  "dominantUncertainty": "string"  // The single biggest unknown that determines which scenario plays out
}`;
