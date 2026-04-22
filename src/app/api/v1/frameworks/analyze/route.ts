/**
 * Framework analysis endpoint
 *
 * Generates strategic framework analyses (Market Analysis, War-Gaming,
 * Pre-Mortem, Post-Mortem, Trend Deep-Dive, Stakeholder Analysis) via
 * multi-step LLM calls. Each framework has 3-5 ordered steps; the
 * output of step N is passed as `context` to step N+1.
 *
 * ## Prompt architecture (v0.2)
 *
 * Each framework-step prompt follows the Notion-v0.2 spec
 * (https://www.notion.so/SIS-Prompt-Bibliothek-76a86ccd7e92443f952e75f4a1159370)
 * with this structure:
 *
 *  1. Identity — "You are a senior <role> with access to the SIS world model"
 *  2. World model injection — <trends>, <causal_edges>, <regulations>, <live_signals>
 *  3. Source/provenance rules — every claim tagged [SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]
 *  4. Temporal validity — forward-dated recommendations only
 *  5. Task — step-specific analysis brief
 *  6. Output contract — JSON schema (UNCHANGED from v0.1 to keep the
 *     Canvas renderers rendering — richer fields are additive)
 *
 * Step prompts are written in English because that's what the models
 * are tuned on. A locale-specific language hint tells the model to
 * emit the answer in the user's language.
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { TrendDot } from "@/types";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { resolveEnv } from "@/lib/env";
import { requireTenantContext } from "@/lib/api-helpers";
import { buildDateContext } from "@/lib/llm";
import { getRegulationsForTrend, GLOBAL_REGULATIONS } from "@/lib/regulations";
import { getEdgesForTrend, TREND_EDGES } from "@/lib/causal-graph";

/** Repair truncated JSON by closing open structures. */
function tryRepairJSON(text: string): any | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  const closers: string[] = [];

  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { depth++; closers.push("}"); }
    else if (ch === "[") { depth++; closers.push("]"); }
    else if (ch === "}" || ch === "]") { depth--; if (closers.length) closers.pop(); }
  }

  if (depth <= 0) return null;
  let repaired = text.trimEnd();
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, "");
  const suffix = closers.reverse().join("");
  try { return JSON.parse(repaired + suffix); } catch {}

  // Backtrack to last complete string
  for (let i = repaired.length - 1; i > repaired.length - 2000 && i > 0; i--) {
    if (repaired[i] === '"' && repaired[i - 1] !== '\\') {
      const candidate = repaired.slice(0, i + 1);
      let d = 0, inS = false, esc = false;
      const cl: string[] = [];
      for (const ch of candidate) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inS = !inS; continue; }
        if (inS) continue;
        if (ch === "{") { d++; cl.push("}"); }
        else if (ch === "[") { d++; cl.push("]"); }
        else if (ch === "}" || ch === "]") { d--; if (cl.length) cl.pop(); }
      }
      if (d > 0) {
        let fixed = candidate.replace(/,\s*$/, "");
        fixed += cl.reverse().join("");
        try { return JSON.parse(fixed); } catch { continue; }
      }
    }
  }
  return null;
}

function extractJSON(text: string): any | null {
  if (!text || text.trim().length === 0) return null;
  let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  cleaned = cleaned.slice(start);
  try { return JSON.parse(cleaned); } catch {}
  const end = cleaned.lastIndexOf("}");
  if (end > 0) { try { return JSON.parse(cleaned.slice(0, end + 1)); } catch {} }
  return tryRepairJSON(cleaned);
}

/**
 * Load trends from SQLite for world-model injection into framework prompts.
 *
 * Framework prompts now receive the same trend catalog the main briefing
 * prompt sees — this lets the LLM cite specific trends by name (inline
 * via [TREND: …] tags) instead of inventing labels from thin air.
 * Keeping the full catalog reasonable: we slice to the 30 most-relevant
 * for the framework prompt since the prompts themselves are already long.
 */
function loadTrendsFromDB(): TrendDot[] {
  try {
    const dbPath = path.join(process.cwd(), "local.db");
    const db = new Database(dbPath, { readonly: true });
    db.pragma("journal_mode = WAL");
    const rows = db.prepare("SELECT * FROM trends WHERE status != 'archived'").all() as any[];
    db.close();
    return rows.map((row) => {
      const tags = row.tags ? JSON.parse(row.tags) : [];
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      return {
        id: row.id, name: row.name, description: row.description || "",
        category: row.category, tags,
        relevance: row.agg_relevance ?? 0.5, confidence: row.agg_confidence ?? 0.5,
        impact: row.agg_impact ?? 0.5, timeHorizon: row.time_horizon || "mid",
        ring: meta.ring || "assess", quadrant: meta.quadrant ?? 0,
        signalCount: meta.signalCount ?? 0, topSources: meta.topSources ?? [],
        velocity: meta.velocity || "stable", userOverride: false,
      } as TrendDot;
    });
  } catch {
    try {
      const { megaTrends } = require("@/lib/mega-trends");
      return megaTrends as TrendDot[];
    } catch {
      return [];
    }
  }
}

/**
 * Build the reusable world-model block that is injected into every
 * framework step. Same shape as the one in `buildSystemPrompt()` but
 * shorter (30 trends, top 20 regulations, top 20 edges) because the
 * framework prompts are already substantial. The goal is enough
 * context that the LLM can tag claims with specific trend/edge/reg
 * names without inventing them.
 */
function buildWorldModelBlock(trends: TrendDot[]): string {
  const sorted = [...trends].sort((a, b) => b.relevance - a.relevance).slice(0, 30);
  const trendLines = sorted.map((t) => {
    const regs = getRegulationsForTrend(t.id);
    const edges = getEdgesForTrend(t.id);
    return `- ${t.name} [${t.category}] Ring:${t.ring} Rel:${(t.relevance*100).toFixed(0)}% Vel:${t.velocity} Regs:${regs.map(r=>r.shortName).join(",")||"—"} Edges:${edges.length}`;
  }).join("\n");

  const regLines = GLOBAL_REGULATIONS.slice(0, 20)
    .map((r) => `- ${r.jurisdiction}:${r.shortName} [${r.status}]`)
    .join("\n");

  const edgeLines = TREND_EDGES.slice(0, 20)
    .map((e) => `${e.from} --${e.type}(${(e.strength*100).toFixed(0)}%)--> ${e.to}`)
    .join("\n");

  return `<trends>
${trendLines}
</trends>

<causal_edges>
${edgeLines}
</causal_edges>

<regulations>
${regLines}
</regulations>`;
}

/**
 * Common preamble for every framework-step prompt. Carries the Notion
 * v0.2 source-rules and temporal-validity rules so each step benefits
 * from the same discipline as the main briefing prompt.
 */
function buildFrameworkPreamble(locale: string): string {
  const respond = locale === "de" ? "Respond in German." : "Respond in English.";
  return `${respond}

## Source Rules (CRITICAL)

Every factual claim MUST be attributed inline:
- From the trend catalog: \`[TREND: TrendName]\`
- From the regulation DB: \`[REG: RegulationName]\`
- From causal graph edges: \`[EDGE: TrendA → TrendB]\`
- From background knowledge: \`[LLM-KNOWLEDGE]\` — never presented as fact, never the sole basis for action recommendations
- Never invent URLs.

## Temporal Validity

Every recommendation, action window, or scenario horizon must be forward-dated relative to CURRENT_DATE. A past deadline is context, not an action point.

## Output Contract

Return ONLY a single JSON object. No markdown fences. No prose before \`{\` or after \`}\`.`;
}

type FrameworkPromptFn = (
  topic: string,
  step: string,
  context: string,
  locale: string,
  worldModel: string,
) => string;

const FRAMEWORK_PROMPTS: Record<string, FrameworkPromptFn> = {
  // ═════════════════════════════════════════════════════════════════════
  // 3.1 MARKET ANALYSIS — 4 steps
  // ═════════════════════════════════════════════════════════════════════
  "marktanalyse": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "market-structure": `You are a senior market analyst with access to the Strategic Intelligence System.
Analyze the market for: "${topic}"

${preamble}

## Task — Step 1: Market Structure Analysis

Use the world model data below. For every claim, tag the source inline.
Exploit causal edges: if a trend is accelerating this market, explain the mechanism.

<world_model>
${worldModel}
</world_model>

Deliverables:
- Estimate TAM / SAM / SOM in EUR (EU-focused where possible, label which region)
- Segment the market across meaningful dimensions
- Identify top competitors (real companies only, no fictional names)
- Assess CAGR (3-5 year projection) with source
- Identify which world-model trends are the primary growth drivers

Output JSON (v0.1-compatible schema — keep the field names EXACT):
{
  "tam": "e.g. 450 Bn USD",
  "sam": "e.g. 80 Bn USD",
  "som": "e.g. 12 Bn USD",
  "tamLabel": "TAM (Global)",
  "samLabel": "SAM (Europe)",
  "somLabel": "SOM (DACH)",
  "cagr": 0.18,
  "segments": [{"name": "Segment name [TREND: …]", "share": 35}],
  "keyPlayers": [{"name": "Real company", "marketShare": 28, "strength": "What makes them strong [SIGNAL/TREND: …]"}],
  "synthesis": "2-3 sentences on market state. Tag sources inline."
}

At least 4-6 segments and 5-8 real companies. Probability / growth must be topic-specific, not default 18%.`,

      "competitor-radar": `${context}

You are continuing the market analysis. Context from Step 1 is above.
Topic: "${topic}"

${preamble}

## Task — Step 2: Competitive Radar (Positioning Map + Threat Assessment)

<world_model>
${worldModel}
</world_model>

For each competitor: explain which world-model trends are shifting their position. A player who stands still while the axis moves is losing ground even if their current score looks fine — name that dynamic explicitly when you see it.

Output JSON (schema is v0.1-compatible):
{
  "positioning": [{"name": "Real company", "x": 4.2, "y": 3.8}],
  "xLabel": "Market strength",
  "yLabel": "Innovation strength",
  "xLow": "Weak", "xHigh": "Strong", "yLow": "Low", "yHigh": "High",
  "quadrantLabels": ["Visionaries", "Leaders", "Niche", "Challengers"],
  "competitors": [
    {
      "name": "Real company",
      "threatLevel": "high",
      "description": "What they do and why a threat [SIGNAL/TREND: …]",
      "strengths": ["Strength 1 [EDGE: …]", "Strength 2"],
      "weaknesses": ["Weakness 1"]
    }
  ],
  "synthesis": "2-3 sentences on competitive landscape. Tag sources."
}

Minimum 6 competitors. x/y between 0 and 5. threatLevel: "high" | "medium" | "low".`,

      "trends-regulation": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Trends, Regulation & 3-Scenario Model

<world_model>
${worldModel}
</world_model>

Each scenario must be driven by a DIFFERENT causal mechanism from the world model. Do not vary tone — vary the underlying causal logic. Name which causal edge breaks or amplifies in each scenario. Probabilities must sum to ~100 and be topic-specific.

Output JSON (schema is v0.1-compatible):
{
  "megatrends": [{"name": "Trend name", "category": "technological", "description": "Short description [TREND: …]"}],
  "regulations": [{"name": "EU AI Act", "status": "active", "description": "What it regulates [REG: …]", "jurisdiction": "EU"}],
  "scenarios": [
    {"type": "optimistic", "title": "Best Case", "description": "What happens. Justify probability.", "probability": 0.25, "timeframe": "3 years", "keyDrivers": ["[TREND: …]"]},
    {"type": "probable", "title": "Likely", "description": "…", "probability": 0.55, "timeframe": "3 years", "keyDrivers": ["…"]},
    {"type": "pessimistic", "title": "Worst Case", "description": "[EDGE: X → Y] reverses. …", "probability": 0.20, "timeframe": "3 years", "keyDrivers": ["…"]}
  ],
  "synthesis": "2-3 sentences"
}

category MUST be: "social" | "technological" | "economic" | "environmental" | "political"
status MUST be: "active" | "planned" | "draft"
Minimum 5 megatrends, 4 real regulations, 3 scenarios.`,

      "benchmarking": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 4: Benchmarking Table

<world_model>
${worldModel}
</world_model>

Output JSON (schema is v0.1-compatible):
{
  "metrics": ["Revenue 2024", "Employees", "R&D %", "EBITDA margin"],
  "players": [
    {"name": "Real company", "Revenue 2024": "12.4 Bn EUR", "Employees": "45,000", "R&D %": "8%", "EBITDA margin": "22%"}
  ],
  "caption": "Comparison of the main market players [SIGNAL/TREND: …]",
  "synthesis": "2-3 sentences"
}

CRITICAL: keys in "players[]" MUST match the "metrics" strings exactly.
Minimum 5 metrics and 5-7 real companies. Use publicly reported figures or flag as [LLM-KNOWLEDGE] with a year.`,
    };
    return steps[step] || steps["market-structure"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.2 WAR-GAMING — 4 steps
  // ═════════════════════════════════════════════════════════════════════
  "war-gaming": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "actors": `You are an experienced war-gaming facilitator and competitive intelligence analyst.
Topic: "${topic}"

${preamble}

## Task — Step 1: Identify and profile all strategically relevant actors

Think like an intelligence analyst: what are their REAL goals, not the communicated ones?
Use signals to identify recent moves. Use causal edges to understand their leverage points.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "actors": [
    {
      "name": "Real company / agency",
      "type": "competitor",
      "resources": ["Capital", "Patents [TREND: …]", "Market access"],
      "goals": ["Defend market share", "Vertical integration"],
      "threatLevel": "high"
    }
  ],
  "synthesis": "2-3 sentences"
}

type MUST be: "competitor" | "regulator" | "partner" | "disruptor" | "customer"
threatLevel MUST be: "high" | "medium" | "low"
Minimum 6 actors, mixed types.`,

      "moves": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Simulate the most probable moves of the top actors

Think like each actor — from their perspective, with their resources and goals.
Use signals as evidence: recent behavior predicts near-term moves.
For each move: what is the causal chain (cascadeEffects) that follows?

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "moves": [
    {
      "actor": "Actor name (must match Step 1)",
      "move": "Concrete move they will make [SIGNAL/TREND: …]",
      "probability": 0.65,
      "impact": "high",
      "cascadeEffects": ["Follow-on 1 [EDGE: …]", "Follow-on 2", "Follow-on 3"]
    }
  ],
  "synthesis": "2-3 sentences"
}

probability: 0-1. impact: "high" | "medium" | "low"
Minimum 6 moves, distributed across multiple actors.`,

      "responses": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Reaction Matrix

For each opponent move, give the optimal own response. Think in options, not single answers.
Evaluate the "do-nothing" path too — what breaks if we stay still?

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "responses": [
    {
      "opponentMove": "Short description of the opponent's move",
      "bestResponse": "Best response",
      "alternative": "Alternative response",
      "riskOfInaction": "What happens if we do nothing [TREND/EDGE: …]",
      "priority": "immediate"
    }
  ],
  "counterStrategies": [
    {"name": "Strategy name", "description": "What the strategy does", "targetActor": "Against whom"}
  ],
  "synthesis": "2-3 sentences"
}

priority MUST be: "immediate" | "short-term" | "medium-term"
Minimum 5 responses and 4 counter-strategies.`,

      "red-team": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 4: Red Team

Attack the user's strategy as hard as possible. Ask: what have we overlooked? Which assumption invalidates the whole strategy if wrong? Which world-model trends are working against us that we haven't accounted for?

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "vulnerabilities": [
    {
      "name": "Vulnerability name",
      "severity": "critical",
      "exploitScenario": "How an adversary exploits the gap [TREND/EDGE: …]",
      "currentDefense": "What currently protects (or doesn't)",
      "recommendation": "What should be done"
    }
  ],
  "worstCaseScenario": "What happens in the worst case [EDGE: …]",
  "immediateActions": ["Immediate action 1", "Immediate action 2"],
  "synthesis": "2-3 sentences"
}

severity MUST be: "critical" | "high" | "medium" | "low"
Minimum 5 vulnerabilities. Be uncomfortable. Blind spots are more valuable than known risks.`,
    };
    return steps[step] || steps["actors"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.3 PRE-MORTEM — 3 steps
  // ═════════════════════════════════════════════════════════════════════
  "pre-mortem": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "risks": `You are a risk analyst looking back from the future. Imagine: 18 months from now, the initiative on "${topic}" has failed. What went wrong?

${preamble}

## Task — Step 1: Risk Inventory

List ALL plausible causes — not just the obvious ones. Be uncomfortable. Blind spots are more valuable than known risks.
Use world-model trends as a lens: which rising trends create risks? Use causal edges: if TrendA drives TrendB and TrendB threatens this initiative, name the chain.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "risks": [
    {
      "name": "Concrete risk",
      "category": "technology",
      "description": "What exactly happens [SIGNAL/TREND/EDGE: …]",
      "probability": 4,
      "impact": 5,
      "riskScore": 20,
      "earlyWarnings": ["Warning 1", "Warning 2"]
    }
  ],
  "blindSpots": ["Blind spot 1", "Blind spot 2"],
  "synthesis": "2-3 sentences"
}

category MUST be: "technology" | "market" | "regulation" | "organization" | "financial" | "social"
probability/impact: 1-5. riskScore = probability * impact.
Minimum 8 risks, mixed categories.`,

      "assessment": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Impact Assessment & Prioritization

Prioritize by probability × impact. Identify cascade risks: which risks amplify each other? A chain reaction can become unstoppable.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "risks": [
    {"name": "Risk name (must match Step 1)", "probability": 4, "impact": 5}
  ],
  "topRisks": [
    {"name": "Risk name", "whyCritical": "Detailed reasoning. Cite [EDGE/TREND: …] if a cascade is involved."}
  ],
  "synthesis": "2-3 sentences"
}

probability/impact: 0-5. Minimum 8 risks and 3-5 topRisks.`,

      "mitigation": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Early Warning System + Countermeasures

Be specific: "monitor AI regulation news" is NOT a signal. "EU Parliament committee vote on GPAI provisions in Q3 2026" IS a signal. Every early-warning entry must be observable in a connector SIS already runs.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "mitigations": [
    {
      "riskName": "Risk name",
      "prevention": {"action": "Preventive measure", "cost": "e.g. 50k EUR", "timeline": "3 months"},
      "contingency": {"action": "Contingency plan", "trigger": "When X materializes"},
      "monitoring": {"indicator": "What to watch", "threshold": "Threshold", "frequency": "weekly"}
    }
  ],
  "earlyWarningSystem": [
    {"signal": "Specific observable signal", "source": "SIS connector name", "threshold": "Numeric threshold", "action": "What to do when triggered"}
  ],
  "synthesis": "2-3 sentences"
}

Minimum 5 mitigations and 6 early warnings.`,
    };
    return steps[step] || steps["risks"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.4 POST-MORTEM — 3 steps
  // ═════════════════════════════════════════════════════════════════════
  "post-mortem": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "timeline": `You are analyzing the past event "${topic}" for a post-mortem.

${preamble}

## Task — Step 1: Event Reconstruction

Reconstruct the sequence of events objectively. Do not judge with hindsight — separate what was predictable from what was genuinely surprising. Name missed signals that were already observable at the time.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "timeline": [
    {
      "date": "2023-04",
      "event": "What exactly happened",
      "type": "decision",
      "actors": ["Actor 1", "Actor 2"],
      "significance": "high"
    }
  ],
  "keyTurningPoints": [
    {"date": "2023-04", "description": "Why this is a turning point [SIGNAL/TREND: …]", "whatIfAlternative": "What would have happened if decided differently"}
  ],
  "synthesis": "2-3 sentences"
}

type MUST be: "decision" | "external" | "trigger" | "consequence"
significance MUST be: "high" | "medium" | "low"
Minimum 10 events, 3-5 turning points. Turning-point date MUST exactly match a timeline date.`,

      "causes": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Root Cause Analysis (5-Why + Causal Chains)

Run multiple independent why-chains — events rarely have a single cause. Look for process failures, decision failures, assumption failures, external shocks, structural issues. Stop at a genuine root cause: something structural and addressable, not merely the result of another cause.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "structural": [
    {"cause": "Structural cause", "evidence": "Evidence [TREND: …]", "fixability": "hard"}
  ],
  "cyclical": [
    {"cause": "Cyclical cause", "evidence": "Evidence", "predictable": true}
  ],
  "situational": [
    {"cause": "Situational cause", "evidence": "Evidence", "avoidable": true}
  ],
  "causalChains": [
    {"chain": ["Cause A", "leads to B", "leads to C", "Outcome"], "criticalLink": "leads to B [EDGE: …]"}
  ],
  "fiveWhys": [
    {"level": 1, "question": "Why?", "answer": "Because..."},
    {"level": 2, "question": "Why X?", "answer": "Because..."}
  ],
  "synthesis": "2-3 sentences"
}

fixability: "hard" | "medium" | "easy". Minimum 3 causes per level, 2 causal chains, 5 whys.`,

      "lessons": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Lessons Learned & Model Update

Lessons MUST be actionable. "Communicate better" is not a lesson. "Weekly alignment meeting between Tech and Strategy, notes distributed to all stakeholders" is.
World-model updates: this event is new information. What should SIS learn? Which trend assessments should be revised? Which causal edges should be added or strengthened?

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "couldHaveKnown": ["Insight 1 [SIGNAL: …]", "Insight 2"],
  "couldHaveDone": ["What should have been done differently 1", "…"],
  "systemicChanges": [
    {"change": "Systemic change", "priority": "high", "effort": "Effort estimate"}
  ],
  "patternMatches": [
    {"historicalEvent": "Comparable event", "similarity": "Concrete similarity", "lesson": "Insight from it"}
  ],
  "modelUpdates": ["What to adjust in the world model 1 [EDGE: …]", "…"],
  "synthesis": "2-3 sentences"
}

priority: "high" | "medium" | "low". Minimum 5 entries per list.`,
    };
    return steps[step] || steps["timeline"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.5 TREND DEEP-DIVE — 5 steps (kept from v0.1 because the UI wires
  //     "definition / evidence / drivers / impact / actions" explicitly)
  // ═════════════════════════════════════════════════════════════════════
  "trend-deep-dive": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "definition": `You are a senior trend analyst. Analyze the trend "${topic}" in maximum depth.

${preamble}

## Task — Step 1: Definition & Current Status

Identify fundamental drivers — not symptoms, causes. Not "AI is booming" but "compute costs fell exponentially, training data reached critical mass, investment pressure spiked post-ChatGPT release".
Use live signals to calibrate driver strength. Use causal edges to find what drives the drivers.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "definition": "Concrete definition of the trend (3-4 sentences) [TREND: …]",
  "metrics": [
    {"name": "Market size", "value": "12 Bn EUR", "trend": "rising"}
  ],
  "sCurvePosition": 35,
  "steepCategories": ["technological", "social"],
  "keyActors": [
    {"name": "Real company", "role": "leader"}
  ],
  "synthesis": "2-3 sentences"
}

sCurvePosition: 0-100 (0 = Innovation, 100 = Decline)
steepCategories: ["social" | "technological" | "economic" | "environmental" | "political"]
role: "pioneer" | "leader" | "follower" | "regulator"
trend: "rising" | "stable" | "declining"
Minimum 6 metrics and 6 actors.`,

      "evidence": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Signal Synthesis & Evidence

Which signals from the last 72h are most significant for this trend? Are signals accelerating or decelerating? Any anomalies that don't fit the dominant narrative — potential reversal indicators?

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "signals": [
    {"text": "Concrete signal [SIGNAL: Source, Date]", "strength": "strong", "source": "e.g. arXiv, Bloomberg, EU"}
  ],
  "quantitative": [
    {"metric": "Patents 2024", "value": "12,500", "change": "+45% YoY"}
  ],
  "counterEvidence": "Which evidence pushes back against the trend",
  "dataGaps": "Which data is missing / uncertainties",
  "synthesis": "2-3 sentences"
}

strength: "strong" | "moderate" | "weak"
Minimum 8 signals and 6 quant data points.`,

      "drivers": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Drivers, Brakes, Tipping Points

A tipping point must be specific, triggered by an identifiable event, with a concrete consequence. "When compute cost drops below $1/million tokens" is a tipping point. "When AI becomes cheaper" is not.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "drivers": [
    {"name": "Driver name", "strength": 4, "category": "technology"}
  ],
  "brakers": [
    {"name": "Brake name", "strength": 3, "category": "regulation"}
  ],
  "connectedTrends": [
    {"name": "Connected trend", "relationship": "reinforcing", "description": "How they influence each other [EDGE: …]"}
  ],
  "tippingPoints": [
    {"description": "What triggers the tipping point", "probability": "high", "timeframe": "2-3 years"}
  ],
  "synthesis": "2-3 sentences"
}

strength: 0-5. relationship: "reinforcing" | "counteracting" | "enabling"
category: "technology" | "economy" | "regulation" | "society" | "environment"
Minimum 5 drivers, 4 brakes, 4 connected trends, 3 tipping points.`,

      "impact": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 4: Impact Analysis + 3 Scenarios

Each scenario must be driven by a DIFFERENT causal mechanism. Name which causal edge breaks or amplifies.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "economicImpacts": [
    {"sector": "Healthcare", "type": "disruption", "magnitude": "high", "timeframe": "5 years"}
  ],
  "winners": ["Who wins 1 [TREND: …]", "Who wins 2"],
  "losers": ["Who loses 1", "Who loses 2"],
  "scenarios": [
    {"type": "optimistic", "title": "Best Case", "description": "…", "probability": 0.25, "timeframe": "5 years", "keyDrivers": ["[EDGE: …]"]},
    {"type": "probable", "title": "Likely", "description": "…", "probability": 0.55, "timeframe": "5 years", "keyDrivers": ["…"]},
    {"type": "pessimistic", "title": "Worst Case", "description": "…", "probability": 0.20, "timeframe": "5 years", "keyDrivers": ["…"]}
  ],
  "synthesis": "2-3 sentences"
}

economicImpacts.type MUST be: "disruption" | "opportunity" | "risk" | "transformation"
magnitude: "high" | "medium" | "low".
winners/losers are string arrays (people, occupations, industries).
Minimum 6 sectors, 5 each winners/losers, 3 scenarios.`,

      "actions": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 5: Action Options (Ring Classification)

Every action must be forward-dated relative to CURRENT_DATE. If the action window has already passed, drop it.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema — keys EXACT, especially "short-term"):
{
  "ringClassification": "trial",
  "confidence": 0.78,
  "actions": {
    "immediate": [
      {"title": "Immediate action", "description": "What to do [TREND: …]", "target": "Who", "effort": "Effort", "impact": "Expected effect", "ring": "trial"}
    ],
    "short-term": [
      {"title": "…", "description": "…", "target": "…", "effort": "…", "impact": "…", "ring": "assess"}
    ],
    "monitoring": [
      {"title": "…", "description": "…", "target": "…", "effort": "…", "impact": "…", "ring": "hold"}
    ]
  },
  "synthesis": "2-3 sentences"
}

CRITICAL: the key "short-term" MUST use a hyphen.
ringClassification: "adopt" | "trial" | "assess" | "hold"
confidence: 0-1
ring (per action): "adopt" | "trial" | "assess" | "hold"
Minimum 3 actions per category.`,
    };
    return steps[step] || steps["definition"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.6 STAKEHOLDER ANALYSIS — 4 steps
  // ═════════════════════════════════════════════════════════════════════
  "stakeholder": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "inventory": `You are a stakeholder analyst. Topic: "${topic}"

${preamble}

## Task — Step 1: Stakeholder Inventory

Be comprehensive — unexpected actors can be decisive. Use live signals to identify who is currently most active. Use trend data to assess whose power is rising or falling.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "stakeholders": [
    {
      "name": "Real actor",
      "type": "decisionMaker",
      "primaryInterest": "What they want",
      "secondaryInterest": "What they fear",
      "power": 4,
      "interest": 5,
      "stance": "supporter"
    }
  ],
  "synthesis": "2-3 sentences"
}

type: "decisionMaker" | "influencer" | "affected" | "observer"
power/interest: 0-5
stance: "supporter" | "opponent" | "neutral"
Minimum 8 stakeholders, mixed types.`,

      "power-matrix": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Power × Interest Matrix

Power = ability to shape the outcome (resources + legitimacy + network + information advantage). Interest = how directly affected and how actively engaged.
Identify which world-model trends are SHIFTING positions. A stakeholder losing power in a rising-trend environment is becoming irrelevant faster than their current score suggests — name that dynamic.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "stakeholders": [
    {"name": "Stakeholder name (must match Step 1)", "power": 4, "interest": 5, "stance": "supporter"}
  ],
  "quadrantAssignments": [
    {"name": "Stakeholder name", "quadrant": "Schlüsselakteure", "strategy": "Engagement strategy [TREND: …]"}
  ],
  "synthesis": "2-3 sentences"
}

quadrant MUST be one of (German labels — the UI localizes): "Schlüsselakteure" | "Zufrieden halten" | "Informiert halten" | "Beobachten"
Minimum 8 stakeholders and 8 quadrant assignments (one per stakeholder).`,

      "coalitions": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Coalitions & Conflict Lines

Coalitions often form around shared threats, not just shared interests. Identify the latent coalition: actors who don't yet cooperate but whose interests align perfectly.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "alliances": [
    {"name": "Coalition name", "members": ["Stakeholder 1", "Stakeholder 2"], "basis": "Shared goal [TREND: …]", "stability": "stable"}
  ],
  "conflicts": [
    {"parties": ["Actor A", "Actor B"], "issue": "Dispute point", "severity": "high"}
  ],
  "influenceChains": [
    {"chain": ["A", "B", "C"], "description": "How A influences C via B [EDGE: …]"}
  ],
  "possibleShifts": [
    {"actor": "Actor", "currentStance": "neutral", "possibleStance": "supporter", "trigger": "What triggers the shift"}
  ],
  "synthesis": "2-3 sentences"
}

stability: "stable" | "fragile" | "forming"
severity: "high" | "medium" | "low"
Minimum 3 each of alliances, conflicts, chains, shifts.`,

      "engagement": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 4: Engagement Strategy

Tailor approach to quadrant position, trajectory, and recent signals. Do not give generic advice. If signals show a stakeholder shifting stance, account for that.

<world_model>
${worldModel}
</world_model>

Output JSON (v0.1-compatible schema):
{
  "strategies": [
    {
      "stakeholder": "Stakeholder name",
      "approach": "General approach [SIGNAL: …]",
      "message": "Core message",
      "timing": "When",
      "channel": "Channel",
      "risk": "Risk of resistance",
      "quickWin": true
    }
  ],
  "weekPlan": [
    {"week": 1, "actions": ["Action 1", "Action 2"]},
    {"week": 2, "actions": ["…"]},
    {"week": 3, "actions": ["…"]},
    {"week": 4, "actions": ["…"]}
  ],
  "synthesis": "2-3 sentences"
}

Minimum 6 strategies (matching Step 1 stakeholders) and all 4 weeks.`,
    };
    return steps[step] || steps["inventory"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.7 DESIGN THINKING — 4 steps (human-centered strategic design)
  // 2026-04-22 Backlog-Task "Design Thinking als Template".
  // Klassisches DT ist 5-phasig (Empathize/Define/Ideate/Prototype/Test).
  // Für eine strategische Intelligence-Frage werden "Prototype" und
  // "Test" zu einer Validierungsphase zusammengefasst, da das Framework
  // nicht auf ein konkretes Produkt-MVP zielt, sondern auf ein
  // überprüfbares Entscheidungs-Artefakt (z.B. Policy, Roadmap, Offer).
  // ═════════════════════════════════════════════════════════════════════
  "design-thinking": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {
      "empathize": `You are a human-centered strategic designer. Topic: "${topic}"

${preamble}

## Task — Step 1: Empathize (stakeholder empathy & jobs-to-be-done)

Identify the human actors who are impacted by this question — not abstract categories like "users" or "the market", but concrete stakeholder groups with names, contexts, motivations and pain points. For each group, articulate the job they are trying to get done, the constraints they work under, and the emotional load they carry. Pull in live signals and trend data where they illuminate what these stakeholders are currently doing / saying / feeling.

<world_model>
${worldModel}
</world_model>

Output JSON:
{
  "stakeholders": [
    {
      "name": "Concrete group (e.g. 'Municipal procurement officers in mid-sized German cities')",
      "jobToBeDone": "The functional + emotional job they are hiring a solution to do",
      "context": "Operating environment, constraints, resources [SIGNAL/TREND: …]",
      "painPoints": ["Concrete pain 1", "Concrete pain 2"],
      "signals": ["What would indicate they are changing?"]
    }
  ],
  "emotionalMap": [
    {"phase": "Awareness", "feeling": "Overwhelm", "trigger": "What causes it"},
    {"phase": "Consideration", "feeling": "…", "trigger": "…"},
    {"phase": "Decision", "feeling": "…", "trigger": "…"}
  ],
  "synthesis": "2-3 sentences naming the central human tension that drives this topic"
}

Minimum 4 distinct stakeholder groups. "Users" or "customers" alone is not enough — name the actor, not the role. Avoid generalities. Cite a signal or trend inline where possible.`,

      "define": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Define (problem reframing)

A good problem statement is small enough to act on and big enough to matter. Take the central human tension from Step 1 and produce 3–5 distinct reframings. Each reframing should start with "How might we…" and name (a) the specific actor, (b) the specific need, (c) the specific constraint. Rank them by (1) strategic leverage, (2) feasibility within the topic's timeframe, (3) blast radius if wrong. Call out hidden assumptions behind each reframing so the team can challenge them.

<world_model>
${worldModel}
</world_model>

Output JSON:
{
  "reframings": [
    {
      "statement": "How might we [verb] [specific actor] to [specific need] despite [specific constraint]",
      "leverage": 4,
      "feasibility": 3,
      "blastRadius": 2,
      "hiddenAssumption": "What we are quietly assuming is true",
      "whyItMatters": "Concrete consequence if we solve this — for whom"
    }
  ],
  "rejectedFrames": [
    {"statement": "A tempting but misleading framing", "whyRejected": "Which evidence defeats it"}
  ],
  "synthesis": "2-3 sentences naming the one reframing most worth pursuing and why"
}

leverage / feasibility / blastRadius on 0–5 scale. Minimum 3 reframings + 2 rejected frames.`,

      "ideate": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Ideate (solution divergence)

For the lead reframing from Step 2, generate 6–10 distinct solution directions. Force diversity by explicitly covering at least: one incremental solution (works in current constraints), one disruptive solution (rewrites a constraint), one non-obvious analog (borrowed from a different domain), one policy/structural solution (not product), one solution that rejects the reframing and insists the real problem is elsewhere. For each, name the core mechanism, a representative early prototype, and the signals that would tell us it is working.

<world_model>
${worldModel}
</world_model>

Output JSON:
{
  "solutions": [
    {
      "name": "Short, concrete name",
      "type": "incremental",
      "mechanism": "How it creates value in one sentence",
      "prototype": "The smallest version that can be tested in 4-8 weeks",
      "earlySignals": ["Signal 1 that would confirm traction"],
      "killSignals": ["Signal that would tell us to stop"],
      "linkedTrends": ["Trend IDs or names this relies on"]
    }
  ],
  "synthesis": "2-3 sentences naming the dominant pattern across the solution set — where the real opportunity lives"
}

type: "incremental" | "disruptive" | "analog" | "structural" | "reframe-challenge"
Minimum 6 solutions, at least one per type.`,

      "validate": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 4: Validate (experiment design)

Pick the 2–3 solutions from Step 3 worth testing first. For each, design a concrete validation experiment that could run in 4–12 weeks: what hypothesis is being tested, what the smallest representative test looks like, which real stakeholders participate, what metric confirms vs. disconfirms, what early-warning signals would abort. Be explicit about invalidation — a validation plan that cannot fail isn't real. End with a decision rubric for what happens next based on results.

<world_model>
${worldModel}
</world_model>

Output JSON:
{
  "experiments": [
    {
      "solutionName": "Solution from Step 3",
      "hypothesis": "If we do X, then Y happens, because Z",
      "smallestTest": "Concrete 4-12 week test, named deliverables",
      "participants": ["Which stakeholders from Step 1 are involved"],
      "successMetric": {"name": "Metric", "threshold": "Value or ratio that counts as confirmation"},
      "killMetric": {"name": "Metric", "threshold": "Value that means stop"},
      "earlyWarnings": ["Signal 1", "Signal 2"],
      "cost": "Rough resource envelope",
      "timeline": "e.g. 6 weeks"
    }
  ],
  "decisionRubric": [
    {"ifOutcome": "Success metric hit", "then": "Scale with plan X"},
    {"ifOutcome": "Kill metric hit", "then": "Retire and pick next reframing"},
    {"ifOutcome": "Ambiguous", "then": "Extend by N weeks with changed variable Y"}
  ],
  "synthesis": "2-3 sentences: what we will know after the experiments we did not know before"
}

Minimum 2 experiments + 3 rubric entries. Each experiment must have both a success and a kill metric — one-sided experiments are not accepted.`,
    };
    return steps[step] || steps["empathize"];
  },

  // ═════════════════════════════════════════════════════════════════════
  // 3.8 PRE-FRAGE — 4 steps (Question Architecture, no answers)
  //
  // 2026-04-23 (Konzept-Diskussion mit Founder, Abend):
  // Während alle anderen Frameworks ANTWORTEN auf Fragen liefern,
  // identifiziert "Pre-Frage" die richtigen FRAGEN — bevor irgendeine
  // Antwort-Suche beginnt. Das adressiert den häufigsten Strategie-
  // Fehler: die falsche Frage perfekt zu beantworten.
  //
  // Methodische Inspiration:
  //   - Hal Gregersen (MIT, "Question Burst")
  //   - Charlie Munger ("Invert, always invert")
  //   - Phil Tetlock (Superforecaster — Decomposition als Schlüsselskill)
  //   - Edgar Schein ("Humble Inquiry")
  //   - Toyota 5 Whys
  //
  // Architektonische Symmetrie zur Iteration-Loop (e7f9699):
  //   - Pass 2 (LLM-Relevance) ist Self-Critique auf der OUTPUT-Seite
  //   - Pre-Frage ist Self-Critique auf der INPUT-Seite
  //   - Beide zusammen = vollständiger Reflection-Loop
  //
  // Output: KEINE Antworten, sondern Hierarchie von Fragen mit
  // Annahmen-Liste, Daten-Gaps und Framework-Anschluss-Empfehlungen.
  // ═════════════════════════════════════════════════════════════════════
  "pre-frage": (topic, step, context, locale, worldModel) => {
    const preamble = buildFrameworkPreamble(locale);
    const steps: Record<string, string> = {

      // ── Step 1: Reframing ──────────────────────────────────────────
      "reframing": `You are a strategic question coach in the tradition of Hal Gregersen (MIT "Question Burst") and Edgar Schein ("Humble Inquiry"). The user has formulated this initial topic / question:

"${topic}"

${preamble}

## Task — Step 1: Reframing

Your job is NOT to answer. Your job is to surface the QUESTION BEHIND THE QUESTION. Most strategic failures come from solving the wrong problem perfectly. Before any analysis, we need to validate that the user is asking the right thing.

Pull live signals and world-model context — they often reveal that the user's question implicitly assumes a frame that the data doesn't support.

<world_model>
${worldModel}
</world_model>

Generate three classes of reframings:

1. **Surface assumptions** — what does the original question implicitly take for granted?
2. **Reframings** — how would different stakeholders / disciplines / time horizons phrase the question?
3. **The deeper question** — if you stripped the original question to its core motivation, what is the user really trying to know?

Output JSON:
{
  "originalQuestion": "Verbatim from user",
  "implicitAssumptions": [
    {"assumption": "X is the right unit of analysis", "whyMatters": "If X is wrong, every answer is wrong [SIGNAL/TREND: …]"}
  ],
  "reframings": [
    {"frame": "Stakeholder lens (e.g. regulator, user, employee)", "reformulated": "Same topic phrased through this lens", "whyDifferent": "What this surfaces that the original misses"}
  ],
  "deeperQuestion": {
    "candidate": "The question behind the question (one sentence)",
    "reasoning": "Why this is more fundamental than what was asked"
  },
  "synthesis": "2-3 sentences on what the reframing exercise revealed"
}

Minimum: 4 implicit assumptions, 4 reframings (different lenses), 1 deeperQuestion candidate. Each entry must reference at least one [SIGNAL/TREND/EDGE] tag where applicable — show that reframings are grounded in observable reality, not vibe-based reformulation.`,

      // ── Step 2: Decomposition + STEEP+V Lenses ─────────────────────
      "decomposition": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 2: Decomposition + STEEP+V Lens Questions

Following Phil Tetlock's superforecaster methodology: any complex question decomposes into MECE sub-questions (Mutually Exclusive, Collectively Exhaustive). Combine that with the SIS STEEP+V framework — for each dimension, generate the question that dimension forces you to ask.

<world_model>
${worldModel}
</world_model>

Output JSON:
{
  "mainQuestion": "The primary question (refined from Step 1's deeperQuestion if applicable)",
  "subQuestions": [
    {
      "question": "MECE sub-question 1",
      "type": "definitional|factual|normative|prognostic|causal|hypothetical",
      "whyEssential": "Why this sub-question must be answered before the main one",
      "addressableBy": "framework-name | live-signals | external-research"
    }
  ],
  "lensQuestions": {
    "social": [{"question": "What does the social lens force us to ask?", "rationale": "Why this matters here [TREND: …]"}],
    "technological": [{"question": "…", "rationale": "…"}],
    "economic": [{"question": "…", "rationale": "…"}],
    "environmental": [{"question": "…", "rationale": "…"}],
    "political": [{"question": "…", "rationale": "…"}],
    "values": [{"question": "What unstated values / ethics are at play?", "rationale": "…"}]
  },
  "timeHorizonQuestions": [
    {"horizon": "now (0-12 months)", "question": "What changes in the next year?"},
    {"horizon": "mid (1-5 years)", "question": "…"},
    {"horizon": "long (5-15 years)", "question": "…"},
    {"horizon": "structural (15+ years)", "question": "…"}
  ],
  "synthesis": "2-3 sentences"
}

subQuestions: minimum 5, no overlap, must collectively cover the mainQuestion.
lensQuestions: minimum 1 question per STEEP+V dimension.
type field MUST be one of the listed values.
addressableBy MUST name a concrete next step (specific framework name like "marktanalyse" / "trend-deep-dive", or "live-signals", or "external-research").`,

      // ── Step 3: Inversion + Provocation ────────────────────────────
      "inversion": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 3: Inversion + Provocation

Charlie Munger: "Invert, always invert." Most strategic blindness comes from refusing to ask the uncomfortable, the taboo, the embarrassing question. Your job here is to find the questions the user does NOT want to ask but should.

<world_model>
${worldModel}
</world_model>

Three modes of provocation:

1. **Inversion** — what would have to be TRUE for the original question to be irrelevant or wrong?
2. **Taboo questions** — what question would the user's biggest critic ask? What would an outsider naively ask that an insider would never voice?
3. **Pre-mortem question** — imagine 5 years from now, the strategy built on the original question has visibly failed. What was the question that should have been asked but wasn't?

Output JSON:
{
  "inversionQuestions": [
    {"question": "What would have to be true for X to NOT matter?", "uncomfortableBecause": "Why people don't usually ask this"}
  ],
  "tabooQuestions": [
    {"question": "The question nobody in the room wants to voice", "tabooReason": "Political, ethical, status-related, etc.", "whyImportant": "What it would surface"}
  ],
  "premortemQuestion": {
    "scenario": "Brief sketch of how the strategy fails in 5 years (3-4 sentences) [SIGNAL/TREND: …]",
    "missedQuestion": "The exact question that would have prevented this if asked now",
    "earlyWarningSignals": ["Observable signal 1 we should monitor", "Signal 2", "Signal 3"]
  },
  "blindSpotQuestions": [
    {"question": "Question about something that's invisible from the user's current vantage point", "vantagePointShift": "What perspective makes this visible (geographic, demographic, disciplinary)"}
  ],
  "synthesis": "2-3 sentences on what provocations revealed"
}

Minimum: 3 inversion questions, 3 taboo questions, 1 premortem scenario with missedQuestion + 3 earlyWarningSignals, 3 blindSpotQuestions. Be uncomfortable. Comfortable provocations are not provocations.`,

      // ── Step 4: Critical Questions + Knowledge-Gap + Handoff ───────
      "critical": `${context}

Topic: "${topic}"

${preamble}

## Task — Step 4: Critical Questions + Knowledge-Gap + Framework Handoff

Synthesize everything from Steps 1-3 into the user's actionable output. The user came expecting answers; they leave with a structured map of questions. Your job is to make that structure useful, not overwhelming.

<world_model>
${worldModel}
</world_model>

Output JSON:
{
  "criticalQuestions": [
    {
      "rank": 1,
      "question": "The single most important question to answer first",
      "whyCritical": "What hinges on the answer; why this question dominates the others",
      "ifNotAnswered": "What goes wrong if we proceed without this answer",
      "addressableBy": {
        "framework": "marktanalyse | trend-deep-dive | pre-mortem | post-mortem | war-gaming | stakeholder | design-thinking | (none — needs external research)",
        "rationale": "Why this framework is the right next tool"
      }
    }
  ],
  "knowledgeGaps": [
    {
      "gap": "What specific data / fact / signal we don't have",
      "couldComeFrom": "SIS connector name OR external source category (e.g. expert interview, primary research)",
      "currentlyAvailable": true,
      "decisiveFor": "Which critical question would this resolve"
    }
  ],
  "frameworkRoadmap": [
    {
      "order": 1,
      "framework": "Specific SIS framework",
      "questionItAddresses": "Which sub-question / critical question this framework will answer",
      "estimatedEffort": "low | medium | high",
      "dependsOn": "What must be known before this step (or 'nothing — start here')"
    }
  ],
  "explicitAssumptionsToTest": [
    {"assumption": "Assumption from Step 1 we are choosing to bracket for now", "testHow": "How we'd validate this later"}
  ],
  "honestStateOfKnowledge": "2-4 sentences: what we know, what we don't, what's most uncertain. NO false confidence.",
  "synthesis": "Short executive summary: 'Before answering X, we need to first answer A, B, C — here's the order.'"
}

Minimum: 3 criticalQuestions (top-3, ranked, with framework handoff for each), 4 knowledgeGaps, 2-3 frameworkRoadmap entries showing the recommended sequence, 2 explicitAssumptionsToTest. Every criticalQuestion MUST reference a concrete next-step framework or external-research category — no dead ends.`,
    };
    return steps[step] || steps["reframing"];
  },
};

// ── Model fallback chain ─────────────────────────────────────────────────────
// Try each model in order if the previous one is overloaded.
const MODEL_CHAIN = [
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
] as const;

interface StreamResult {
  ok: true;
  fullText: string;
  modelUsed: string;
}

interface StreamError {
  ok: false;
  error: string;
  overloaded?: boolean;
  httpStatus?: number;
}

/**
 * Call Anthropic streaming API with proper SSE parsing including error events.
 * Returns either collected text or a structured error.
 */
async function callAnthropicStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onDelta: (text: string) => void,
): Promise<StreamResult | StreamError> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const overloaded = res.status === 529 || errText.toLowerCase().includes("overload");
    return { ok: false, error: errText, overloaded, httpStatus: res.status };
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let lineBuffer = "";
  let streamError: { overloaded: boolean; message: string } | null = null;

  const processLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === "[DONE]") return;
    try {
      const event = JSON.parse(jsonStr);
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        fullText += event.delta.text;
        onDelta(event.delta.text);
      } else if (event.type === "error") {
        const msg = event.error?.message || "Unknown stream error";
        const overloaded = event.error?.type === "overloaded_error" || msg.toLowerCase().includes("overload");
        streamError = { overloaded, message: msg };
      } else if (event.type === "message_delta" && event.delta?.stop_reason === "refusal") {
        streamError = { overloaded: false, message: "Model refused" };
      }
    } catch {}
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  }
  if (lineBuffer.trim()) processLine(lineBuffer.trim());

  if (streamError) {
    const err = streamError as { overloaded: boolean; message: string };
    return { ok: false, error: err.message, overloaded: err.overloaded, httpStatus: 200 };
  }
  return { ok: true, fullText, modelUsed: model };
}

export async function POST(req: Request) {
  // SEC audit 2026-04: previously anonymous. Anthropic API costs are
  // real; rate-limit by IP alone is not enough to stop an attacker
  // from burning tokens. Requiring a tenant context ties calls to an
  // identifiable user and allows per-tenant billing later.
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  // SEC-11: Rate limit LLM endpoints — 20 requests per IP per hour
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`framework-analyze:${clientIp}`, 20, 3_600_000)) {
    return tooManyRequests("Rate limit exceeded for analysis endpoint. Try again later.");
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null as null | Record<string, unknown>);
  if (!body) {
    return NextResponse.json({ error: "Invalid or empty JSON body" }, { status: 400 });
  }
  const { frameworkId, topic, step, context, locale } = body as {
    frameworkId?: string; topic?: string; step?: string;
    context?: unknown; locale?: string;
  };

  if (!frameworkId || !topic || !step) {
    return NextResponse.json({ error: "Missing frameworkId, topic, or step" }, { status: 400 });
  }

  const promptBuilder = FRAMEWORK_PROMPTS[frameworkId];
  if (!promptBuilder) {
    return NextResponse.json({ error: `Unknown framework: ${frameworkId}` }, { status: 400 });
  }

  // Validate step against known steps for this framework
  const VALID_STEPS: Record<string, string[]> = {
    "marktanalyse": ["market-structure", "competitor-radar", "trends-regulation", "benchmarking"],
    "war-gaming": ["actors", "moves", "responses", "red-team"],
    "pre-mortem": ["risks", "assessment", "mitigation"],
    "post-mortem": ["timeline", "causes", "lessons"],
    "trend-deep-dive": ["definition", "evidence", "drivers", "impact", "actions"],
    "stakeholder": ["inventory", "power-matrix", "coalitions", "engagement"],
    "design-thinking": ["empathize", "define", "ideate", "validate"],
    "pre-frage": ["reframing", "decomposition", "inversion", "critical"],
  };
  const allowedSteps = VALID_STEPS[frameworkId];
  if (allowedSteps && !allowedSteps.includes(step)) {
    return NextResponse.json(
      { error: `Unknown step "${step}" for framework "${frameworkId}". Valid steps: ${allowedSteps.join(", ")}` },
      { status: 422 }
    );
  }

  // ── SEC-05: Sanitize user-provided inputs before prompt interpolation ──
  // Strip XML-like tags and role markers that could hijack the LLM prompt.
  const sanitizeForPrompt = (input: string): string => {
    if (!input) return "";
    return input
      // Strip XML-style tags (e.g. <system>, </user>, <|im_start|>)
      .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
      // Strip role markers used in chat prompts
      .replace(/\b(system|user|assistant|human)\s*:/gi, "")
      // Strip control characters (except newline/tab)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
  };

  const safeTopic = sanitizeForPrompt(String(topic ?? ""));
  // `context` is typed `unknown` after the defensive JSON parse above.
  const contextText =
    typeof context === "string" ? context
      : context == null ? ""
      : JSON.stringify(context);
  const safeContext = sanitizeForPrompt(contextText);

  // v0.2: load the trend catalog and build the world-model block. This
  // lets the framework prompt cite specific trends/edges/regulations
  // by name via [TREND: …] / [EDGE: …] / [REG: …] tags instead of
  // inventing labels from thin air.
  const trends = loadTrendsFromDB();
  const worldModel = buildWorldModelBlock(trends);

  const userPrompt = promptBuilder(
    safeTopic,
    step as string,
    safeContext,
    locale || "de",
    worldModel,
  );

  // Datum-Kontext verhindert, dass Framework-Analysen (z.B. Pre-Mortem,
  // War-Gaming) mit einem stillschweigenden Training-Cutoff-„heute"
  // Zukunftsprognosen aus der Vergangenheit ziehen.
  const dateBlock = buildDateContext((locale === "en" ? "en" : "de") as "de" | "en");
  const systemPrompt = `${dateBlock}

You are a senior strategy advisor in the Strategic Intelligence System (SIS). You deliver structured, data-grounded analyses. ALWAYS respond with valid JSON — no markdown fences, no prose before or after, ONLY the JSON object. Be concrete: name real companies, real numbers, real regulations. Tag every claim with [SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]. Temporal validity applies: every recommendation must be forward-dated relative to CURRENT_DATE.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      try {
        let lastError: StreamError | null = null;
        let result: StreamResult | null = null;

        // Try each model in the fallback chain
        for (let i = 0; i < MODEL_CHAIN.length; i++) {
          const model = MODEL_CHAIN[i];
          send({ type: "status", message: `Using ${model}${i > 0 ? " (fallback)" : ""}…` });

          const attempt = await callAnthropicStream(
            apiKey, model, systemPrompt, userPrompt,
            (text) => send({ type: "delta", text }),
          );

          if (attempt.ok) {
            result = attempt;
            break;
          }

          lastError = attempt;
          // Only fall through to next model on overload/5xx
          if (!attempt.overloaded && (attempt.httpStatus || 0) < 500) {
            break;
          }
        }

        if (!result) {
          const errMsg = lastError?.error || "Alle Modelle überlastet. Bitte erneut versuchen.";
          send({ type: "error", error: errMsg });
          controller.close();
          return;
        }

        const parsed = extractJSON(result.fullText);
        if (parsed) {
          send({ type: "complete", result: parsed, modelUsed: result.modelUsed });
        } else if (result.fullText.trim().length > 20) {
          // Fallback: wrap prose in JSON structure so the client always receives parseable JSON
          send({
            type: "complete",
            result: { type: "prose", content: result.fullText.slice(0, 6000) },
            modelUsed: result.modelUsed,
          });
        } else {
          send({ type: "error", error: "Leere Antwort vom Modell. Bitte erneut versuchen." });
        }
        controller.close();
      } catch (err: any) {
        console.error("POST /api/v1/frameworks/analyze stream error:", err);
        send({ type: "error", error: "Analysis failed. Please try again." });
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
