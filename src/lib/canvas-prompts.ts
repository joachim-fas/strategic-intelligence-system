/**
 * Canvas Prompt Templates (Notion v0.2 — Section 5)
 *
 * Prompt builders for three Canvas-related LLM interactions:
 *
 *  1. Node Generation — translate a briefing or framework result into
 *     Canvas nodes (insight / trend / risk / actor / scenario / action /
 *     question) with connections justified by causal or substantive
 *     relationships from the world model.
 *
 *  2. Workflow Step Description — the "what should you DO next" copy
 *     that guides the user through a framework-driven Canvas workflow.
 *
 *  3. Derived Node — when the user selects N existing Canvas nodes and
 *     asks the system to derive a new node (synthesis / implication /
 *     contradiction / action / question) from them.
 *
 * These prompts are not wired into a dedicated route yet — the current
 * Canvas code uses a simpler derivation path (`computeDerivedNodes` in
 * `src/app/canvas/derivation.ts`) that operates on already-parsed
 * briefing JSON. The Notion v0.2 templates live here as the editorial
 * source of truth and are published via the system-prompts registry +
 * `/dokumentation/prompts`, so that when the richer Canvas pipeline is
 * built, the prompts are ready to drop in.
 */

export const CANVAS_NODE_GENERATION_PROMPT_EN = `You receive an analysis result and must translate it into Canvas nodes.
Each node is a building block in the user's strategic workspace.

<analysis>
BRIEFING_OR_FRAMEWORK_OUTPUT
</analysis>

Generate as many nodes as needed to represent the analysis completely and accurately.
Quality over compression — but never sacrifice completeness for brevity.
If the analysis is complex, 15 precise nodes are better than 5 overloaded ones.

Node generation principles:
- Every node must be independently comprehensible — no external context required to understand it
- type="action" always starts with a concrete verb ("Analyze", "Decide", "Validate", "Monitor")
- type="question" marks deliberately open strategic questions for the next iteration
- type="risk" must include the mechanism (not just the label)
- type="scenario" must include probability
- Connections are directional in concept: from cause to effect, from insight to action
- Only create connections when causally or substantively justified — not decoratively

If the source material has more content than fits naturally in one pass:
- Complete what you can with high quality
- Set iterationNote to describe what remains for the next iteration

Return JSON:
{
  "nodes": [
    {
      "type": "insight|trend|risk|actor|scenario|action|question",
      "title": "string",
      "content": "string",
      "tags": ["string"],
      "priority": "high|medium|low",
      "connections": ["string"],     // Titles of other nodes — only when causally justified
      "sourceRef": "string|null"     // [SIGNAL/TREND/EDGE: ...] if directly derived from world model data
    }
  ],
  "suggestedLayout": "cluster|timeline|matrix|radial",
  "iterationNote": "string|null"
}`;

export const CANVAS_WORKFLOW_STEP_PROMPT_EN = `You are guiding the user through a strategic analysis workflow in the Canvas.
Current step: STEP_NAME
Framework: FRAMEWORK_ID
Previous nodes summary: PREVIOUS_NODES_SUMMARY

Provide a concise, action-guiding description for this step.
Focus on what the user should DO — not what the system will do.

Return JSON:
{
  "stepTitle": "string",
  "instruction": "string",       // What should the user do now? Max 2 sentences.
  "hint": "string",              // One helpful tip for this step
  "expectedOutput": "string",    // What is produced at the end of this step?
  "worldModelRelevance": "string", // What world model data is most useful here?
  "nextStep": "string"
}`;

export const CANVAS_DERIVED_NODE_PROMPT_EN = `The user wants to generate a new derived node from existing Canvas nodes.

<source_nodes>
SELECTED_NODE_CONTENTS
</source_nodes>

<world_model_context>
RELEVANT_TRENDS_AND_EDGES
</world_model_context>

Derivation type: SYNTHESIS|IMPLICATION|CONTRADICTION|ACTION|QUESTION

Generate a new node that logically follows from the source nodes.
The derivation must be traceable: explain clearly why this follows from the sources.
If world model data strengthens or contradicts the derivation, say so.

Return JSON:
{
  "type": "string",
  "title": "string",
  "content": "string",
  "derivationLogic": "string",
  "worldModelAlignment": "string|null",  // Does world model data support or tension this derivation?
  "confidence": 0
}`;
