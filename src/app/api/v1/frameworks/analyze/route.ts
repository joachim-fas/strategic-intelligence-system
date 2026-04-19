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
