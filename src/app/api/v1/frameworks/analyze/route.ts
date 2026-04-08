import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

function resolveEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const line = raw.split("\n").find(l => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch { return undefined; }
}

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

const FRAMEWORK_PROMPTS: Record<string, (topic: string, step: string, context: string, locale: string) => string> = {
  "marktanalyse": (topic, step, context, locale) => {
    const de = locale === "de";
    const lang = de ? "deutsch" : "english";
    const steps: Record<string, string> = {
      "market-structure": `Marktstruktur-Analyse für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema (alle Felder belegen):
{
  "tam": "z.B. 450 Mrd USD",
  "sam": "z.B. 80 Mrd USD",
  "som": "z.B. 12 Mrd USD",
  "tamLabel": "TAM (Global)",
  "samLabel": "SAM (Europa)",
  "somLabel": "SOM (DACH)",
  "cagr": 0.18,
  "segments": [
    {"name": "Segment-Name", "share": 35},
    {"name": "Segment-Name", "share": 25}
  ],
  "keyPlayers": [
    {"name": "Echtes Unternehmen", "marketShare": 28, "strength": "Was sie stark macht"}
  ],
  "synthesis": "2-3 Sätze zur Marktlage"
}

Mindestens 4-6 Segmente und 5-8 echte Unternehmen.`,

      "competitor-radar": `${context}

Wettbewerber-Radar für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "positioning": [
    {"name": "Echter Name", "x": 4.2, "y": 3.8},
    {"name": "Echter Name", "x": 2.5, "y": 4.5}
  ],
  "xLabel": "Marktstärke",
  "yLabel": "Innovationskraft",
  "xLow": "Schwach",
  "xHigh": "Stark",
  "yLow": "Niedrig",
  "yHigh": "Hoch",
  "quadrantLabels": ["Visionäre", "Marktführer", "Nischen", "Herausforderer"],
  "competitors": [
    {
      "name": "Echtes Unternehmen",
      "threatLevel": "high",
      "description": "Was sie tun und warum sie eine Bedrohung sind",
      "strengths": ["Stärke 1", "Stärke 2"],
      "weaknesses": ["Schwäche 1"]
    }
  ],
  "synthesis": "2-3 Sätze zur Wettbewerbslage"
}

Mindestens 6 Wettbewerber. x/y zwischen 0 und 5. threatLevel: "high"|"medium"|"low".`,

      "trends-regulation": `${context}

Trends, Regulierung und Szenarien für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "megatrends": [
    {"name": "Trend-Name", "category": "technological", "description": "Kurze Beschreibung"}
  ],
  "regulations": [
    {"name": "EU AI Act", "status": "active", "description": "Was es regelt", "jurisdiction": "EU"}
  ],
  "scenarios": [
    {"type": "optimistic", "title": "Best Case", "description": "Was passiert", "probability": 0.25, "timeframe": "3 Jahre", "keyDrivers": ["Treiber 1", "Treiber 2"]},
    {"type": "probable", "title": "Wahrscheinlich", "description": "...", "probability": 0.55, "timeframe": "3 Jahre", "keyDrivers": [...]},
    {"type": "pessimistic", "title": "Worst Case", "description": "...", "probability": 0.20, "timeframe": "3 Jahre", "keyDrivers": [...]}
  ],
  "synthesis": "2-3 Sätze"
}

category MUSS sein: "social"|"technological"|"economic"|"environmental"|"political"
status MUSS sein: "active"|"planned"|"draft"
Mind. 5 Megatrends, 4 echte Regulierungen, 3 Szenarien.`,

      "benchmarking": `${context}

Benchmarking für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "metrics": ["Umsatz 2024", "Mitarbeiter", "F&E-Quote", "EBITDA-Marge"],
  "players": [
    {"name": "Echtes Unternehmen", "Umsatz 2024": "12.4 Mrd EUR", "Mitarbeiter": "45.000", "F&E-Quote": "8%", "EBITDA-Marge": "22%"}
  ],
  "caption": "Vergleich der wichtigsten Marktteilnehmer",
  "synthesis": "2-3 Sätze"
}

WICHTIG: Die Schlüssel in "players[]" MÜSSEN exakt mit den Strings in "metrics" übereinstimmen.
Mindestens 5 Kennzahlen und 5-7 echte Unternehmen.`,
    };
    return steps[step] || steps["market-structure"];
  },

  "war-gaming": (topic, step, context, locale) => {
    const de = locale === "de";
    const lang = de ? "deutsch" : "english";
    const steps: Record<string, string> = {
      "actors": `Modelliere strategische Akteure für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "actors": [
    {
      "name": "Echtes Unternehmen / Behörde",
      "type": "competitor",
      "resources": ["Kapital", "Patente", "Marktzugang"],
      "goals": ["Marktanteil verteidigen", "Vertikale Integration"],
      "threatLevel": "high"
    }
  ],
  "synthesis": "2-3 Sätze"
}

type MUSS sein: "competitor"|"regulator"|"partner"|"disruptor"|"customer"
threatLevel MUSS sein: "high"|"medium"|"low"
Mindestens 6 Akteure, gemischter Typ.`,

      "moves": `${context}

Spielzug-Simulation für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "moves": [
    {
      "actor": "Echter Akteur-Name (muss mit Step 1 übereinstimmen)",
      "move": "Konkreter Spielzug, was sie tun werden",
      "probability": 0.65,
      "impact": "high",
      "cascadeEffects": ["Folge 1", "Folge 2", "Folge 3"]
    }
  ],
  "synthesis": "2-3 Sätze"
}

probability: 0-1. impact: "high"|"medium"|"low"
Mindestens 6 Züge, verteilt auf verschiedene Akteure.`,

      "responses": `${context}

Reaktionsmatrix für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "responses": [
    {
      "opponentMove": "Kurze Beschreibung des gegnerischen Zugs",
      "bestResponse": "Beste Antwort",
      "alternative": "Alternative Antwort",
      "riskOfInaction": "Was passiert wenn nichts getan wird",
      "priority": "immediate"
    }
  ],
  "counterStrategies": [
    {"name": "Strategie-Name", "description": "Was die Strategie macht", "targetActor": "Gegen wen"}
  ],
  "synthesis": "2-3 Sätze"
}

priority MUSS sein: "immediate"|"short-term"|"medium-term"
Mindestens 5 responses und 4 counterStrategies.`,

      "red-team": `${context}

Red-Team-Analyse für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "vulnerabilities": [
    {
      "name": "Verwundbarkeit-Name",
      "severity": "critical",
      "exploitScenario": "Wie ein Gegner die Lücke ausnutzt",
      "currentDefense": "Was aktuell schützt (oder nicht)",
      "recommendation": "Was getan werden sollte"
    }
  ],
  "worstCaseScenario": "Was im schlimmsten Fall passiert",
  "immediateActions": ["Sofortmaßnahme 1", "Sofortmaßnahme 2"],
  "synthesis": "2-3 Sätze"
}

severity MUSS sein: "critical"|"high"|"medium"|"low"
Mindestens 5 Verwundbarkeiten, schonungslos ehrlich.`,
    };
    return steps[step] || steps["actors"];
  },

  "pre-mortem": (topic, step, context, locale) => {
    const de = locale === "de";
    const lang = de ? "deutsch" : "english";
    const steps: Record<string, string> = {
      "risks": `Pre-Mortem für "${topic}". Stell dir vor: das Vorhaben ist gescheitert. Warum? Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "risks": [
    {
      "name": "Konkretes Risiko",
      "category": "technology",
      "description": "Was genau passiert",
      "probability": 4,
      "impact": 5,
      "riskScore": 20,
      "earlyWarnings": ["Warnsignal 1", "Warnsignal 2"]
    }
  ],
  "blindSpots": ["Blinder Fleck 1", "Blinder Fleck 2"],
  "synthesis": "2-3 Sätze"
}

category MUSS sein: "technology"|"market"|"regulation"|"organization"|"financial"|"social"
probability/impact: 1-5. riskScore = probability * impact.
Mindestens 8 Risiken, verschiedene Kategorien.`,

      "assessment": `${context}

Risiko-Bewertung für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "risks": [
    {"name": "Risiko-Name (passend zu Step 1)", "probability": 4, "impact": 5}
  ],
  "topRisks": [
    {"name": "Risiko-Name", "whyCritical": "Detaillierte Begründung warum kritisch"}
  ],
  "synthesis": "2-3 Sätze"
}

probability/impact: 0-5. Mindestens 8 risks und 3-5 topRisks.`,

      "mitigation": `${context}

Risiko-Mitigation für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "mitigations": [
    {
      "riskName": "Risiko-Name",
      "prevention": {"action": "Präventionsmaßnahme", "cost": "z.B. 50k EUR", "timeline": "3 Monate"},
      "contingency": {"action": "Notfallplan", "trigger": "Wenn X eintritt"},
      "monitoring": {"indicator": "Was beobachten", "threshold": "Schwellwert", "frequency": "wöchentlich"}
    }
  ],
  "earlyWarningSystem": [
    {"signal": "Was beobachten", "source": "Datenquelle", "threshold": "Schwellwert", "action": "Was dann tun"}
  ],
  "synthesis": "2-3 Sätze"
}

Mindestens 5 mitigations und 6 early warnings.`,
    };
    return steps[step] || steps["risks"];
  },

  "post-mortem": (topic, step, context, locale) => {
    const de = locale === "de";
    const lang = de ? "deutsch" : "english";
    const steps: Record<string, string> = {
      "timeline": `Rekonstruiere die Chronologie von "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "timeline": [
    {
      "date": "2023-04",
      "event": "Was genau passiert ist",
      "type": "decision",
      "actors": ["Akteur 1", "Akteur 2"],
      "significance": "high"
    }
  ],
  "keyTurningPoints": [
    {"date": "2023-04", "description": "Warum dies ein Wendepunkt war", "whatIfAlternative": "Was wäre wenn anders entschieden worden wäre"}
  ],
  "synthesis": "2-3 Sätze"
}

type MUSS sein: "decision"|"external"|"trigger"|"consequence"
significance MUSS sein: "high"|"medium"|"low"
Mindestens 10 Ereignisse, 3-5 Wendepunkte. Wendepunkt-date MUSS exakt mit einem timeline-date matchen.`,

      "causes": `${context}

Ursachenanalyse von "${topic}" auf 3 Ebenen. Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "structural": [
    {"cause": "Strukturelle Ursache", "evidence": "Belege", "fixability": "hard"}
  ],
  "cyclical": [
    {"cause": "Konjunkturelle Ursache", "evidence": "Belege", "predictable": true}
  ],
  "situational": [
    {"cause": "Situative Ursache", "evidence": "Belege", "avoidable": true}
  ],
  "causalChains": [
    {"chain": ["Ursache A", "führt zu B", "führt zu C", "Ergebnis"], "criticalLink": "führt zu B"}
  ],
  "fiveWhys": [
    {"level": 1, "question": "Warum?", "answer": "Weil..."},
    {"level": 2, "question": "Warum X?", "answer": "Weil..."}
  ],
  "synthesis": "2-3 Sätze"
}

fixability: "hard"|"medium"|"easy". Mind. 3 Ursachen pro Ebene, 2 Kausalketten, 5 Whys.`,

      "lessons": `${context}

Lessons Learned aus "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "couldHaveKnown": ["Erkenntnis 1", "Erkenntnis 2"],
  "couldHaveDone": ["Was anders gemacht werden sollte 1", "..."],
  "systemicChanges": [
    {"change": "Systemische Änderung", "priority": "high", "effort": "Aufwandsschätzung"}
  ],
  "patternMatches": [
    {"historicalEvent": "Vergleichbares Ereignis", "similarity": "Konkrete Ähnlichkeit", "lesson": "Erkenntnis daraus"}
  ],
  "modelUpdates": ["Was im Modell angepasst werden sollte 1", "..."],
  "synthesis": "2-3 Sätze"
}

priority: "high"|"medium"|"low". Mind. 5 in jeder Liste.`,
    };
    return steps[step] || steps["timeline"];
  },

  "trend-deep-dive": (topic, step, context, locale) => {
    const de = locale === "de";
    const lang = de ? "deutsch" : "english";
    const steps: Record<string, string> = {
      "definition": `Trend Deep-Dive: Definition & Status für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "definition": "Was der Trend genau ist (3-4 Sätze)",
  "metrics": [
    {"name": "Marktgröße", "value": "12 Mrd EUR", "trend": "rising"}
  ],
  "sCurvePosition": 35,
  "steepCategories": ["technological", "social"],
  "keyActors": [
    {"name": "Echtes Unternehmen", "role": "leader"}
  ],
  "synthesis": "2-3 Sätze"
}

sCurvePosition: 0-100 (0=Innovation, 100=Decline)
steepCategories: ["social"|"technological"|"economic"|"environmental"|"political"]
role: "pioneer"|"leader"|"follower"|"regulator"
trend: "rising"|"stable"|"declining"
Mind. 6 Metriken und 6 Akteure.`,

      "evidence": `${context}

Evidenz für den Trend "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "signals": [
    {"text": "Konkretes Signal", "strength": "strong", "source": "z.B. arXiv, Bloomberg, EU"}
  ],
  "quantitative": [
    {"metric": "Patente 2024", "value": "12.500", "change": "+45% YoY"}
  ],
  "counterEvidence": "Welche Belege gegen den Trend sprechen",
  "dataGaps": "Welche Daten fehlen / Unsicherheiten",
  "synthesis": "2-3 Sätze"
}

strength: "strong"|"moderate"|"weak"
Mind. 8 Signale und 6 Quant-Datenpunkte.`,

      "drivers": `${context}

Treiber & Bremser für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "drivers": [
    {"name": "Treiber-Name", "strength": 4, "category": "technology"}
  ],
  "brakers": [
    {"name": "Bremser-Name", "strength": 3, "category": "regulation"}
  ],
  "connectedTrends": [
    {"name": "Verbundener Trend", "relationship": "reinforcing", "description": "Wie sie sich beeinflussen"}
  ],
  "tippingPoints": [
    {"description": "Was den Kipppunkt auslöst", "probability": "hoch", "timeframe": "2-3 Jahre"}
  ],
  "synthesis": "2-3 Sätze"
}

strength: 0-5. relationship: "reinforcing"|"counteracting"|"enabling"
category: "technology"|"economy"|"regulation"|"society"|"environment"
Mind. 5 driver, 4 brakers, 4 connected, 3 tipping points.`,

      "impact": `${context}

Impact-Analyse für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "economicImpacts": [
    {"sector": "Healthcare", "type": "disruption", "magnitude": "high", "timeframe": "5 Jahre"}
  ],
  "winners": ["Wer gewinnt 1", "Wer gewinnt 2"],
  "losers": ["Wer verliert 1", "Wer verliert 2"],
  "scenarios": [
    {"type": "optimistic", "title": "Best Case", "description": "...", "probability": 0.25, "timeframe": "5 Jahre", "keyDrivers": ["Treiber 1"]},
    {"type": "probable", "title": "Wahrscheinlich", "description": "...", "probability": 0.55, "timeframe": "5 Jahre", "keyDrivers": ["..."]},
    {"type": "pessimistic", "title": "Worst Case", "description": "...", "probability": 0.20, "timeframe": "5 Jahre", "keyDrivers": ["..."]}
  ],
  "synthesis": "2-3 Sätze"
}

economicImpacts.type MUSS sein: "disruption"|"opportunity"|"risk"|"transformation"
magnitude: "high"|"medium"|"low".
winners/losers sind Arrays von Strings (Personen, Berufsgruppen, Branchen).
Mind. 6 Sektoren, je 5 Winner/Loser, 3 Szenarien.`,

      "actions": `${context}

Handlungsoptionen für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema (achte auf die exakten Keys "immediate", "short-term", "monitoring"):
{
  "ringClassification": "trial",
  "confidence": 0.78,
  "actions": {
    "immediate": [
      {"title": "Sofortmaßnahme", "description": "Was tun", "target": "Wer", "effort": "Aufwand", "impact": "Erwarteter Effekt", "ring": "trial"}
    ],
    "short-term": [
      {"title": "...", "description": "...", "target": "...", "effort": "...", "impact": "...", "ring": "assess"}
    ],
    "monitoring": [
      {"title": "...", "description": "...", "target": "...", "effort": "...", "impact": "...", "ring": "hold"}
    ]
  },
  "synthesis": "2-3 Sätze"
}

WICHTIG: der Key "short-term" MUSS mit Bindestrich geschrieben sein.
ringClassification: "adopt"|"trial"|"assess"|"hold"
confidence: 0-1
ring (per action): "adopt"|"trial"|"assess"|"hold"
Mind. 3 actions in jeder Kategorie.`,
    };
    return steps[step] || steps["definition"];
  },

  "stakeholder": (topic, step, context, locale) => {
    const de = locale === "de";
    const lang = de ? "deutsch" : "english";
    const steps: Record<string, string> = {
      "inventory": `Stakeholder-Inventar für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "stakeholders": [
    {
      "name": "Echter Akteur",
      "type": "decisionMaker",
      "primaryInterest": "Was sie wollen",
      "secondaryInterest": "Was sie befürchten",
      "power": 4,
      "interest": 5,
      "stance": "supporter"
    }
  ],
  "synthesis": "2-3 Sätze"
}

type: "decisionMaker"|"influencer"|"affected"|"observer"
power/interest: 0-5
stance: "supporter"|"opponent"|"neutral"
Mind. 8 Stakeholder, gemischt.`,

      "power-matrix": `${context}

Macht-Interesse-Matrix für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "stakeholders": [
    {"name": "Stakeholder-Name (passend zu Step 1)", "power": 4, "interest": 5, "stance": "supporter"}
  ],
  "quadrantAssignments": [
    {"name": "Stakeholder-Name", "quadrant": "Schlüsselakteure", "strategy": "Engagement-Strategie"}
  ],
  "synthesis": "2-3 Sätze"
}

quadrant: "Schlüsselakteure"|"Zufrieden halten"|"Informiert halten"|"Beobachten"
Mind. 8 stakeholders und 8 quadrant assignments (1 pro Stakeholder).`,

      "coalitions": `${context}

Koalitionen & Konflikte für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "alliances": [
    {"name": "Koalitions-Name", "members": ["Stakeholder 1", "Stakeholder 2"], "basis": "Gemeinsames Ziel", "stability": "stable"}
  ],
  "conflicts": [
    {"parties": ["Akteur A", "Akteur B"], "issue": "Streitpunkt", "severity": "high"}
  ],
  "influenceChains": [
    {"chain": ["A", "B", "C"], "description": "Wie A über B auf C wirkt"}
  ],
  "possibleShifts": [
    {"actor": "Akteur", "currentStance": "neutral", "possibleStance": "supporter", "trigger": "Was den Wechsel auslöst"}
  ],
  "synthesis": "2-3 Sätze"
}

stability: "stable"|"fragile"|"forming"
severity: "high"|"medium"|"low"
Mind. 3 alliances, 3 conflicts, 3 chains, 3 shifts.`,

      "engagement": `${context}

Engagement-Strategie für "${topic}". Sprache: ${lang}.

Antworte als JSON in EXAKT diesem Schema:
{
  "strategies": [
    {
      "stakeholder": "Stakeholder-Name",
      "approach": "Genereller Ansatz",
      "message": "Kernbotschaft",
      "timing": "Wann",
      "channel": "Kanal",
      "risk": "Risiko bei Widerstand",
      "quickWin": true
    }
  ],
  "weekPlan": [
    {"week": 1, "actions": ["Aktion 1", "Aktion 2"]},
    {"week": 2, "actions": ["..."]},
    {"week": 3, "actions": ["..."]},
    {"week": 4, "actions": ["..."]}
  ],
  "synthesis": "2-3 Sätze"
}

Mind. 6 Strategien (passend zu Stakeholdern aus Step 1) und alle 4 Wochen.`,
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
  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { frameworkId, topic, step, context, locale } = body;

  if (!frameworkId || !topic || !step) {
    return NextResponse.json({ error: "Missing frameworkId, topic, or step" }, { status: 400 });
  }

  const promptBuilder = FRAMEWORK_PROMPTS[frameworkId];
  if (!promptBuilder) {
    return NextResponse.json({ error: `Unknown framework: ${frameworkId}` }, { status: 400 });
  }

  const userPrompt = promptBuilder(topic, step, context || "", locale || "de");

  const systemPrompt = `Du bist ein Senior-Strategieberater im Strategic Intelligence System (SIS). Du lieferst strukturierte, datengestützte Analysen. Antworte IMMER als valides JSON — kein Markdown-Codefence, kein Fließtext davor/danach, NUR das JSON-Objekt. Sei konkret: nenne echte Unternehmen, echte Zahlen, echte Regulierungen. Sprache: ${locale === "de" ? "Deutsch" : "English"}.`;

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
          // Fallback: prose response
          send({
            type: "complete",
            result: { synthesis: result.fullText.slice(0, 6000), _raw: true },
            modelUsed: result.modelUsed,
          });
        } else {
          send({ type: "error", error: "Leere Antwort vom Modell. Bitte erneut versuchen." });
        }
        controller.close();
      } catch (err: any) {
        send({ type: "error", error: err.message || "Unknown error" });
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
