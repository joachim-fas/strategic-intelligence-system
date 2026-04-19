# SIS — System-Prompts Inventory (v0.2)

This document mirrors `src/lib/system-prompts-registry.ts`. The registry is the **single source of truth**; this Markdown file is a rendered snapshot for offline review and code audits.

The authoritative live view is `/dokumentation/prompts` inside the app. If the two drift, the registry wins.

## Architecture overview

Based on the Notion blueprint "SIS — Prompt-Bibliothek: System-Prompts, Meta-Prompts & Framework-Prompts (vollständig)". Prompt layers:

| Layer | Type | Count | Code file |
|---|---|---:|---|
| System Prompt | System | 1 | `src/lib/llm.ts` |
| Meta-Prompts | Inline + second-pass | 5 | `src/lib/meta-prompts.ts`, `src/lib/scoring.ts` |
| Framework-Prompts | User / System | 6 (3–5 steps each) | `src/app/api/v1/frameworks/analyze/route.ts` |
| Slash Commands | User template | 2 registered + 4 via expansion | `src/lib/slash-prompts.ts` |
| Canvas Prompts | System | 3 | `src/lib/canvas-prompts.ts` |
| Export Prompts | User | 2 | `src/lib/briefing-export.ts` |
| Context Profile Prefix | System prefix | 1 | `src/lib/context-profiles.ts` |
| Pipeline / Summary | System | 3 | `src/lib/cluster-snapshots.ts`, `src/app/api/v1/canvas/[id]/summary/route.ts` |

**Implementation rule (Claude Code):** Always use the ENGLISH templates when writing or updating code. German templates (where present) are editorial-review only.

**Runtime injections into `buildSystemPrompt()`:**

- `CURRENT_DATE` — ISO date at the top of the context block (temporal validity enforcement).
- `TOP_40_TRENDS_FORMATTED` — from `getTrendContext()` / DB.
- `TOP_42_EDGES_FORMATTED` — from `TREND_EDGES` in `src/lib/causal-graph.ts`.
- `18_REGULATIONS_FORMATTED` — from `GLOBAL_REGULATIONS` in `src/lib/regulations.ts`.
- `RAG_INJECTED_SIGNALS` — from `getRelevantSignals(query)`, formatted via `formatSignalsForPrompt()`.

Without these injections, the model falls back entirely to `[LLM-KNOWLEDGE]` which must never be the sole basis for action recommendations.

---

## Shared: Temporal Context Block

Every prompt prepends this block so the model never treats its training cutoff as "now":

**German:**

```
CURRENT_DATE: <YYYY-MM-DD>
═══ ZEITLICHER KONTEXT ═══
Heute ist <TAG>. <MONAT> <JAHR> (ISO: <YYYY-MM-DD>). Alles vor diesem Datum ist Vergangenheit und wird im Präteritum/Perfekt behandelt. Formuliere Prognosen NUR für Zeiträume, die nach diesem Datum beginnen. Prüfe bei jeder Zeitangabe, ob sie in der Vergangenheit oder Zukunft liegt.
```

**English:**

```
CURRENT_DATE: <YYYY-MM-DD>
═══ TEMPORAL CONTEXT ═══
Today is <MONTH> <DAY>, <YEAR> (ISO: <YYYY-MM-DD>). Everything before this date is past and must be phrased in past tense. Forecasts may only cover time periods starting after this date. Verify every date reference against the current date before writing.
```

Source: `buildDateContext()` in `src/lib/llm.ts`.

---

## 1. System Prompt — Intelligence Terminal

- **File:** `src/lib/llm.ts` → `buildSystemPrompt(trends, locale, liveSignalsContext?)`
- **Model:** `claude-sonnet-4-6` (primary), `max_tokens: 12000`
- **API route:** `POST /api/v1/query` — **wired**
- **Status:** v0.2 Draft

Full English template: see registry entry `briefing-main` in `src/lib/system-prompts-registry.ts`.

Core structure:

1. **Identity** — senior strategy advisor with curated world model
2. **6-step reasoning discipline** before JSON
3. **Live world model** — `<trends>`, `<causal_edges>`, `<regulations>`, `<live_signals>`
4. **Source rules** — inline provenance tags `[SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]`
5. **Source conflict priority** — SIGNAL > TREND > REG > EDGE > LLM-KNOWLEDGE
6. **Temporal validity** — every forward-looking recommendation future-dated
7. **Response contract** — strict JSON combining v0.2 fields and legacy aliases

Output JSON includes both v0.2 (`matchedTrends[]` objects, `causalChain`, `anomalySignals`, `dataQuality`, `usedSources`, scenarios as named object) AND legacy fields (`matchedTrendIds`, `causalAnalysis`, legacy scenario array, `interpretation`, `references`, `steepV`, `balancedScorecard`) for UI backward compatibility.

### Runtime augmentation (v0.2 backend pipeline)

Every `/api/v1/query` response is augmented by three backend passes AFTER the LLM returns its JSON:

- **`dataQuality`** — overrides whatever the LLM guessed. Computed from the actual signal set: `signalCount` (integer), `newestSignalAge` ("12m" / "6h" / "3d"), `dominantSourceType` ("signals" / "trends" / "llm-knowledge" / "mixed") derived from inline provenance tags in the synthesis, `coverageGaps` (translated from the top-3 limiting factors of the calibrated confidence).
- **`_confidenceCalibration`** — the Notion v0.2 weighted formula is executed in `src/lib/scoring.ts → computeCalibratedConfidence()` and OVERWRITES the LLM-self-reported confidence. Exposed on the complete event as `{ score, band, limitingFactors, inputs }`.
- **`_scenarioDivergence`** — pure validator from `src/lib/meta-prompts.ts → checkScenarioDivergence()`. Checks probability sum ≈ 1.0, causal distinctness, falsifiable assumptions, horizon mix, early-indicator presence, actor differentiation. Emitted with verdict + finding list.

Optional (`mode: 'deep'`):

- **`_contradictionReport`** — second-pass Haiku call (`runContradictionCheck`). Surfaces claims that contradict the provided signals; `confidenceAdjustment` is subtracted from the calibrated confidence.
- **`_assumptionReport`** — parallel Sonnet call (`runAssumptionExtraction`). Extracts the implicit foundational assumptions with falsifiability + monitoring signals.

Deep mode adds ~3-6 s per query. Callers opt in via `{ mode: "deep" }` in the request body.

---

## 2. Meta-Prompts (Anti-Hallucination Layer)

Operate on the OUTPUT of the system prompt. Second-pass calls or pure validators.

### 2.1 Provenance Tagging Rule

- **File:** `src/lib/meta-prompts.ts` → `PROVENANCE_TAGGING_PROMPT_EN`
- **Type:** Inline fragment of the main system prompt
- **Purpose:** Every claim tagged `[SIGNAL: Source, Date]` / `[TREND: Name]` / `[REG: Short]` / `[EDGE: A → B]` / `[LLM-KNOWLEDGE]`. `[LLM-KNOWLEDGE]` may never be the sole basis for a forward-looking action recommendation.

### 2.2 Contradiction Detection

- **File:** `src/lib/meta-prompts.ts` → `buildContradictionCheckPrompt()`, `runContradictionCheck()`
- **Model:** `claude-haiku-4-5`, `max_tokens: 2000`
- **Wiring:** `opt-in` — second-pass call when `POST /api/v1/query` has `{ mode: "deep" }` in the body
- **Purpose:** Detects claims that CONTRADICT the provided signals/trends/edges — does not regrade whether an assessment is "correct". Returns `{ contradictions[], structuralIssues[], overallVerdict, confidenceAdjustment }`. When `confidenceAdjustment > 0`, the backend subtracts it from the calibrated confidence before sending the complete event.

### 2.3 Scenario Divergence Check

- **File:** `src/lib/meta-prompts.ts` → `checkScenarioDivergence()`
- **Wiring:** `wired` — runs on every `POST /api/v1/query` after validation
- **Purpose:** Enforces the six Notion rules: probability sum ≈ 1.0, causal distinctness, ≥2 falsifiable assumptions per scenario, mixed horizons, ≥1 early indicator per scenario, actor differentiation. Emitted as `_scenarioDivergence` on the complete event.

### 2.4 Assumption Extraction

- **File:** `src/lib/meta-prompts.ts` → `buildAssumptionExtractionPrompt()`, `runAssumptionExtraction()`
- **Model:** `claude-sonnet-4-5`, `max_tokens: 3000`
- **Wiring:** `opt-in` — parallel to Contradiction Detection when `mode: "deep"`
- **Purpose:** Surfaces implicit foundational assumptions together with `falsifiableBy`, `monitoringSignal`, `timeToFalsification` per assumption. Names the single `criticalAssumption` whose failure breaks everything. Emitted as `_assumptionReport` on the complete event.

### 2.5 Confidence Calibration

- **File:** `src/lib/scoring.ts` → `computeCalibratedConfidence()`
- **Wiring:** `wired` — runs on every `POST /api/v1/query` and OVERWRITES the LLM's self-reported confidence
- **Type:** Algorithmic (no LLM call)
- **Formula:**

```
confidence = (
  signalCoverage    * 0.30 +
  signalRecency     * 0.25 +
  signalStrength    * 0.20 +
  sourceVerification* 0.15 +
  causalCoverage    * 0.10
) * 100
```

Bands: 80–100 high / 60–79 medium / 40–59 low / 0–39 very low. Stored decay: 3 % per day.

---

## 3. Framework Prompts (6 × 3–5 steps)

- **File:** `src/app/api/v1/frameworks/analyze/route.ts` → `FRAMEWORK_PROMPTS[frameworkId](topic, step, context, locale, worldModel)`
- **API route:** `POST /api/v1/frameworks/analyze` — **wired**
- **Model:** `claude-sonnet-4-5` → `claude-haiku-4-5` → `claude-sonnet-4-6` (fallback chain)
- **World model:** Injected into every step via `buildWorldModelBlock()` (top 30 trends, 20 edges, 20 regulations)

### 3.1 Market Analysis (4 steps)

`market-structure` → `competitor-radar` → `trends-regulation` → `benchmarking`

### 3.2 War-Gaming (4 steps)

`actors` → `moves` → `responses` → `red-team`

### 3.3 Pre-Mortem (3 steps)

`risks` → `assessment` → `mitigation`

### 3.4 Post-Mortem (3 steps)

`timeline` → `causes` → `lessons`

### 3.5 Trend Deep-Dive (5 steps)

`definition` → `evidence` → `drivers` → `impact` → `actions`

### 3.6 Stakeholder Analysis (4 steps)

`inventory` → `power-matrix` → `coalitions` → `engagement`

Per-step prompts enforce inline provenance, world-model usage, temporal validity, and the original v0.1 JSON output contracts (so the Canvas UI keeps rendering). Full English templates live in `FRAMEWORK_PROMPTS` in the route file.

---

## 4. Slash-Command Prompts

- **File:** `src/lib/slash-prompts.ts` — `expandSlashCommand()` + dedicated templates

### 4.1 `/trend [topic]`

Dedicated compact template: `TREND_SHORTFORM_PROMPT_EN`. Returns a structured trend briefing (name / oneLiner / ring / velocity / confidence / keyDrivers / topRisks / connectedTrends / latestSignal / regulatoryPressure / recommendedAction).

Currently wired via query-expansion through the main briefing pipeline; a dedicated lightweight route can be built later using the template.

### 4.2 `/scenario [question]`

Dedicated compact template: `SCENARIO_INSTANT_PROMPT_EN`. Returns three scenarios (optimistic / likely / pessimistic) — probabilities sum to 100, each scenario by a DIFFERENT causal mechanism, plus a `dominantUncertainty` field naming the single biggest unknown.

Other slash commands (`/signal`, `/compare`, `/explain`, `/history`, `/context`, `/export`) are handled by the expander or by non-LLM code paths.

---

## 5. Canvas Prompts

- **File:** `src/lib/canvas-prompts.ts`

### 5.1 Node Generation

`CANVAS_NODE_GENERATION_PROMPT_EN` — translates a briefing or framework result into Canvas nodes (insight / trend / risk / actor / scenario / action / question) with causally justified connections. Quality over compression — 15 precise nodes > 5 overloaded ones.

### 5.2 Workflow Step Description

`CANVAS_WORKFLOW_STEP_PROMPT_EN` — guides the user through a framework step inside Canvas. Focus on "what should the user DO next" rather than what the system does.

### 5.3 Derived Node

`CANVAS_DERIVED_NODE_PROMPT_EN` — generates a new node from N selected source nodes by derivation type (SYNTHESIS / IMPLICATION / CONTRADICTION / ACTION / QUESTION). Must be traceable: explain why the derivation follows.

- **API route:** `POST /api/v1/canvas/derive-node` — **wired**
- **Request:** `{ sourceNodes: [{title, content, type?}], derivationType: "SYNTHESIS"|"IMPLICATION"|"CONTRADICTION"|"ACTION"|"QUESTION", worldModelContext?, locale? }`
- **Response:** `{ type, title, content, derivationLogic, worldModelAlignment, confidence, _derivationType, _modelUsed }`

### 5.1 + 5.2 (templates — no route yet)

Node Generation (5.1) and Workflow Step (5.2) remain as source-of-truth templates in `canvas-prompts.ts`; they are NOT wired into a route yet. The UI keeps using `computeDerivedNodes` in `src/app/canvas/derivation.ts` for the in-canvas derivation path.

---

## 6. Export & Briefing Prompts

- **File:** `src/lib/briefing-export.ts`

### 6.1 Executive Summary

`EXECUTIVE_SUMMARY_PROMPT_EN` — polishes a full briefing into a C-level executive summary (max 250 words, first sentence = most important finding, `(Confidence: X%)` appended to heading, concrete recommendation at the end).

- **API route:** `POST /api/v1/export/executive-summary` — **wired**
- **Request:** `{ briefing: object, locale?: "de"|"en" }`
- **Response:** `{ markdown: string, wordCount: number, modelUsed: string }`

### 6.2 Shareable Briefing

`SHAREABLE_BRIEFING_PROMPT_EN` — email/Slack-formatted short briefing: core finding, top 3 insights, one-liner scenarios, data note.

- **API route:** `POST /api/v1/export/shareable-briefing` — **wired**
- **Request:** `{ briefing: object, locale?: "de"|"en" }`
- **Response:** `{ text: string, modelUsed: string }`

### Deterministic Markdown export

Independent of the LLM-backed polishers, `briefingToMarkdown(entry, locale)` in `src/lib/briefing-export.ts` now also renders the v0.2 fields when present:

- **Anomaly Signals** section with signal / contradicts / interpretation per entry
- **Sources Used** structured list from `usedSources` (type, name, date)
- **Data Quality** footer line with signalCount, newestSignalAge, dominantSourceType + coverage gaps

The deterministic export preserves every detail; the LLM polishers compress for a specific audience.

---

## 7. Context Profile Prompt Prefix

- **File:** `src/lib/context-profiles.ts` → `buildContextProfilePrefix()` + `CONTEXT_PROFILE_PREFIX_TEMPLATE_EN`

Prepended to the system prompt when a context profile is active. Calibrates LANGUAGE and RECOMMENDATIONS to the user's decision frame (CTO thinks in tech stack, CFO in EBITDA, Policy Maker in coalition feasibility). Does NOT override source / temporal rules.

- **API route:** `POST /api/v1/query` (when `contextProfile` is set in the body) — **wired**
- **Belt-and-suspenders:** the full prefix is prepended to the system prompt AND a short `[Kontext: role / industry / region]` tag is attached to the user message, so the model sees the calibration from both ends.

---

## 8. Pipeline / Canvas-Summary Prompts

### 8.1 Canvas Summary (single-query sparring)

- **File:** `src/app/api/v1/canvas/[id]/summary/route.ts` → `buildSingleQueryReviewPrompt()`
- **Purpose:** When a project has exactly one query, the summary does NOT rewrite the briefing — it takes the analysis apart as a strategic sparring partner (real question behind the question, tensions, open flanks).

### 8.2 Cluster-Diff

- **File:** `src/lib/cluster-snapshots.ts` → `generateClusterDiff()`
- **Model:** `claude-haiku-4-5`, `max_tokens: 100`
- **Purpose:** Pipeline background — compares two snapshot summaries of the same trend cluster and describes the change in ONE sentence (≤30 words).

### 8.3 Cluster-Foresight

- **File:** `src/lib/cluster-snapshots.ts` → `generateClusterForesight()`
- **Model:** `claude-haiku-4-5`, `max_tokens: 400`
- **Purpose:** Pipeline background — formulates 2–3 forward scenarios (12–24 months) per trend cluster. SIS's differentiator vs retrospective-only news analytics.

---

## Versioning

| Area | Version | Status | Wiring |
|---|---|---|---|
| System Prompt | v0.2 | Draft | **wired** |
| Meta: Provenance Tagging | v0.2 | Draft | **wired** (inline in system prompt) |
| Meta: Contradiction Detection | v0.2 | Draft | `opt-in` (`mode:'deep'`) |
| Meta: Scenario Divergence | v0.2 | Draft | **wired** (post-validate) |
| Meta: Assumption Extraction | v0.2 | Draft | `opt-in` (`mode:'deep'`) |
| Meta: Confidence Calibration | v0.2 | Draft | **wired** (overwrites LLM confidence) |
| Framework Market Analysis | v0.2 | Draft | **wired** |
| Framework War-Gaming | v0.2 | Draft | **wired** |
| Framework Pre-Mortem | v0.2 | Draft | **wired** |
| Framework Post-Mortem | v0.2 | Draft | **wired** |
| Framework Trend Deep-Dive | v0.2 | Draft | **wired** |
| Framework Stakeholder | v0.2 | Draft | **wired** |
| Slash `/trend` | v0.2 | Draft | **wired** (via `expandSlashCommand`) |
| Slash `/scenario` | v0.2 | Draft | **wired** (via `expandSlashCommand`) |
| Canvas Node Generation | v0.2 | Draft | `template` |
| Canvas Workflow Step | v0.2 | Draft | `template` |
| Canvas Derived Node | v0.2 | Draft | **wired** (`/api/v1/canvas/derive-node`) |
| Export Executive Summary | v0.2 | Draft | **wired** (`/api/v1/export/executive-summary`) |
| Export Shareable Briefing | v0.2 | Draft | **wired** (`/api/v1/export/shareable-briefing`) |
| Context Profile Prefix | v0.2 | Draft | **wired** (in `query/route.ts`) |
| Canvas Summary (single-query) | v0.1.1 | Production | **wired** |
| Cluster-Diff | v0.1 | Production | **wired** (pipeline phase 2d) |
| Cluster-Foresight | v0.1 | Production | **wired** (pipeline phase 2d) |

Status lifecycle: Draft → In Review → Production → Deprecated.
Wiring: `wired` = runs on every request · `opt-in` = only under specific flags · `template` = editorial source, no route yet.

---

## Backend augmentation side-effects (v0.2)

The new prompt architecture has downstream effects on everything that consumes the briefing response shape:

- **`BriefingResult.tsx`** renders new blocks when present: an **Anomaly Signals** expandable section, a **Data Quality** meta line (signalCount · newestSignalAge · dominantSourceType · coverage gaps), and lifts the regulatory-context rendering into the InlineProvenance parser so `[SIGNAL/TREND/REG/EDGE]` tags are rendered inside the regulation text too.
- **`briefingToMarkdown`** exports the same three additions so download / copy stays consistent with the UI.
- **Confidence band** shown on the response comes from the calibrated formula, not the LLM — low bands now surface the concrete limiting factors in "Lücken"/"gaps".
- **Deep-mode requests** attach `_contradictionReport` and `_assumptionReport` to the complete event; UIs that want to surface those findings can read them from the final JSON.

---

*Created: 2026-04-19 (v0.2 Notion-blueprint integration) · Updated: 2026-04-19 (backend wiring + routes) · Single source of truth: `src/lib/system-prompts-registry.ts`.*
