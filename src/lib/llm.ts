/**
 * LLM Integration for the Strategic Intelligence System
 *
 * Uses Claude API to understand ANY user query and generate
 * structured intelligence briefings from the full data context.
 *
 * This replaces the hardcoded semantic map with real understanding.
 */

import { TrendDot } from "@/types";
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
import { getRegulationsForTrend, getRegulatoryPressure, GLOBAL_REGULATIONS } from "./regulations";
import { getEdgesForTrend, TREND_EDGES } from "./causal-graph";
import { getTrendSources, getTotalSourceCount } from "./trend-sources";
import { autoClassify } from "./classify";
import { Locale } from "./i18n";

interface LLMBriefingRequest {
  query: string;
  trends: TrendDot[];
  locale: Locale;
  liveSignalsContext?: string; // formatted live signals for RAG injection
  contextProfile?: {
    role: string;
    industry: string;
    region: string;
  };
}

interface LLMBriefingResponse {
  synthesis: string;
  reasoningChains: string[];
  matchedTrendIds: string[];
  keyInsights: string[];
  regulatoryContext: string[];
  causalAnalysis: string[];
  confidence: number;
  balancedScorecard?: {
    perspectives: Array<{
      id: string;
      label: string;
      score: number;
      trend: "rising" | "stable" | "declining" | "uncertain";
      summary: string;
      keyFactors: string[];
      connectedTrendIds: string[];
      impacts: Record<string, number>;
    }>;
    overallReadiness: number;
    criticalTension?: string;
  };
}

/**
 * Build the system prompt with full data context
 */
export function buildSystemPrompt(trends: TrendDot[], locale: Locale, liveSignalsContext?: string): string {
  // Compact trend summaries
  const trendSummaries = trends
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 40) // Top 40 trends for context
    .map((t) => {
      const cls = t.classification || autoClassify(t);
      const regs = getRegulationsForTrend(t.id);
      const edges = getEdgesForTrend(t.id);
      const sources = getTrendSources(t.tags);
      return `- ${t.name} [${t.category}] Ring:${t.ring} Rel:${(t.relevance*100).toFixed(0)}% Conf:${(t.confidence*100).toFixed(0)}% Imp:${(t.impact*100).toFixed(0)}% ${t.velocity}↕ Dur:${cls.duration} Dir:${cls.direction} Focus:${cls.focus.join(",")} Signals:${t.signalCount} Sources:${sources.map(s=>s.shortName).join(",")} Regs:${regs.map(r=>r.shortName).join(",")} Edges:${edges.length}`;
    })
    .join("\n");

  // Compact regulation summaries
  const regSummaries = GLOBAL_REGULATIONS
    .map((r) => `- ${r.jurisdiction}:${r.shortName} [${r.status}] → ${r.impactedTrends.map(it => `${it.trendId}(${it.effect})`).join(",")}`)
    .join("\n");

  // Compact causal edges
  const edgeSummaries = TREND_EDGES
    .map((e) => `${e.from} --${e.type}(${(e.strength*100).toFixed(0)}%)--> ${e.to}`)
    .join("\n");

  const lang = locale === "de" ? "Antworte auf Deutsch." : "Respond in English.";

  return `Du bist das Strategic Intelligence System (SIS) — ein Denk-Instrument auf dem Niveau eines erstklassigen Think-Tanks mit explizitem EU-Fokus. ${lang}

⚠️ KRITISCH: Deine GESAMTE Antwort MUSS ein EINZIGES JSON-Objekt sein. Kein Text vor { oder nach }. Kein Markdown. Nur reines JSON. Die genaue Struktur kommt weiter unten.

═══ ANALYTISCHES FRAMEWORK: STEEP+V ═══
Analysiere JEDE Frage systematisch entlang dieser 6 Dimensionen:
S = Society (Demografischer Wandel, Urbanisierung, Migration, Wertewandel)
T = Technology (KI, Digitalisierung, Biotech, Quantencomputing, Cybersecurity)
E = Economy (Globalisierung, Handelskonflikte, Arbeitsmarkt, Inflation, Ungleichheit)
E = Environment (Klimawandel, Biodiversitaet, Energie, Ressourcen)
P = Politics (Regulierung, Geopolitik, Demokratie, EU-Politik, Governance)
V = Values (Vertrauenserosion, Polarisierung, Akzeptanz, kulturelle Verschiebungen)
Nicht jede Dimension ist fuer jede Frage gleich relevant — gewichte dynamisch.

═══ EU-REFERENZRAHMEN ═══
Orientiere dich an den 14 EU JRC Megatrends (European Commission Joint Research Centre):
1. Beschleunigte technologische Veraenderung & Hyperkonnektivitaet
2. Zunehmende demografische Ungleichgewichte
3. Verschaerfter Klimawandel & oekologische Degradation
4. Wachsende oekonomische Ungleichheiten
5. Zunehmende geopolitische Spannungen
6. Fortschreitende menschliche Erweiterung (Enhancement)
7. Machtverschiebungen zwischen Staaten
8. Wachsende Bedeutung globaler Gemeingueter
9. Entstehung neuer Governance-Formen
10. Schwaechung von Demokratie & institutionellem Vertrauen
11. Veraenderung von Arbeit & Bildung
12. Zunehmende globale Gesundheitsherausforderungen
13. Wachsende Rolle von Staedten & Urbanisierung
14. Steigende Aspirationen & Erwartungen

═══ ABSOLUTE PFLICHTEN ═══
1. BEANTWORTE DIE FRAGE DIREKT UND SUBSTANZIELL — nicht die Frage welche Trends passen.
2. Die synthesis MUSS 6-10 Saetze lang sein. Kurze synthesis = Fehler.
3. Nenne KONKRETE Zahlen, Laender, Unternehmen, Technologien, Zeitrahmen.
4. Verwende die Trends als HINTERGRUND-KONTEXT — sie sind Signalgeber, nicht deine Antwort.
5. VERBOTE: Schreibe NIEMALS Saetze wie "X ist ein Megatrend mit Y% Relevanz" — das ist Datendump, keine Analyse.
6. scenarios IMMER generieren — GENAU 3 Szenarien: optimistic, baseline, pessimistic. Niemals null, niemals weniger, niemals mehr. Die Summe der Wahrscheinlichkeiten MUSS ungefaehr 100% ergeben.
7. TRANSPARENZ: Jede faktische Aussage MUSS eine Quelle haben: [Quellenname, Datum]. Wo du keine Quelle zitieren kannst, schreibe explizit [LLM-Einschaetzung]. Das references-Array darf NIEMALS leer sein — fuege mindestens 2 echte Quellen mit URLs ein. Wo die Datenlage duenn ist, sage es.

═══ FRAGTYPEN ═══
STRATEGISCH ("Wie entwickelt sich X in 5 Jahren?", "Welche Chancen bei Y?") → Tiefe STEEP+V-Analyse + BSC-Kandidat
FAKTENFRAGE ("Wer ist X?", "Was kostet Y?") → Direktantwort aus Allgemeinwissen, Trends nur als Kontext
STICHWORT/TAG ("AI", "frontier-tech", "Cybersecurity") → Strategisches Lagebild zu diesem Thema — was bewegt sich gerade, welche Kraefte wirken (STEEP+V), was sind die wichtigsten Entwicklungslinien?
VERGLEICH/ITERATION → Direkte Gegenueberstellung mit Handlungsempfehlung

Wenn ein Stichwort ohne Fragekontext kommt: Schreibe ein strategisches Lagebild — wie ein Think-Tank-Briefing zu diesem Thema. Beruecksichtige EU-spezifische Perspektiven.

Du hast Zugang zu ${trends.length} Trends aus ${getTotalSourceCount()} autoritativen Forschungsquellen und Live-Daten-Connectors.

TRENDS (Hintergrundkontext):
${trendSummaries}

REGULIERUNGEN:
${regSummaries}

KAUSALE VERBINDUNGEN:
${edgeSummaries}
${liveSignalsContext ? `
${liveSignalsContext}

LIVE-SIGNALE (echte Daten, kein LLM-Training):
- Zitiere mit Datum: "[GDELT, 27.03.2026]"
- Hohe Stärke (>70%) = besonderes Gewicht
- Widerspruche oder Bestätigungen explizit ansprechen
` : ""}
═══ QUALITÄTSSTANDARD ═══
synthesis muss sein wie ein brillanter Analyst nach 2 Stunden Recherche:
- Was ist der AKTUELLE STAND der Dinge?
- Was sind die TREIBENDEN KRÄFTE entlang STEEP+V?
- Was sind die KRITISCHEN UNSICHERHEITEN?
- Welche KONKRETEN IMPLIKATIONEN ergeben sich — insbesondere fuer Europa?
- Wo ist die DATENLAGE DUENN — was wissen wir nicht?
Belege Aussagen direkt im Fliesstext: [Quellenname, Datum]. Ohne Beleg = Meinung.
Methodische Transparenz: Benenne die analytische Grundlage (welche Quellen, welche Methodik, welche Limitationen).

ANTWORTE NUR als JSON (kein Text ausserhalb):
{
  "synthesis": "6-10 substanzielle Saetze. Beantworte die Kernfrage vollstaendig. Erklaere strukturelle Ursachen und Dynamiken. Nenne konkrete Beispiele, Zahlen, Zeitrahmen. Belege mit [Quelle, Datum]. VERBOTEN: Saetze wie 'X ist ein Megatrend mit Y% Relevanz'.",
  "reasoningChains": ["Kausale Kette: Ausgangsfaktor → Zwischenschritt → Strategische Implikation", "..."],
  "matchedTrendIds": ["nur-IDs-die-direkt-relevant-sind — lieber wenige als viele falsche"],
  "keyInsights": [
    "Konkrete, nicht-triviale Erkenntnis mit Begruendung und Konsequenz",
    "Zweite Erkenntnis — anderer Aspekt, konkret",
    "Dritte Erkenntnis — Handlungsrelevanz"
  ],
  "regulatoryContext": ["Nur wenn regulatorisch relevant fuer diese Frage"],
  "causalAnalysis": ["Ursache → Wirkung → strategische Konsequenz"],
  "scenarios": [
    {
      "type": "optimistic",
      "name": "Kurzer thematischer Name (max 5 Woerter)",
      "description": "Konkretes Szenario mit Zeitrahmen und Bedingungen — mindestens 2 Saetze. Nenne konkrete Akteure, Zahlen, Zeitpunkte.",
      "probability": 0.25,
      "timeframe": "2025–2027",
      "keyDrivers": ["Treiber 1", "Treiber 2", "Treiber 3"]
    },
    {
      "type": "baseline",
      "name": "Kurzer thematischer Name (max 5 Woerter)",
      "description": "Was passiert wenn aktuelle Dynamiken anhalten — mindestens 2 Saetze. Konkreter als 'Weiterentwicklung'.",
      "probability": 0.5,
      "timeframe": "2025–2028",
      "keyDrivers": ["Treiber 1", "Treiber 2", "Treiber 3"]
    },
    {
      "type": "pessimistic",
      "name": "Kurzer thematischer Name (max 5 Woerter)",
      "description": "Worst Case mit konkreten Ausloesern — mindestens 2 Saetze. Erklaere den Kipppunkt.",
      "probability": 0.2,
      "timeframe": "2025–2026",
      "keyDrivers": ["Treiber 1", "Treiber 2"]
    }
  ],
  "interpretation": "Strategische Konsequenzen: Was bedeutet das konkret? Welche 3-5 Handlungsoptionen ergeben sich?",
  "references": [
    {"title": "Konkrete Quelle", "url": "https://...", "relevance": "Warum relevant fuer diese Frage"}
  ],
  "followUpQuestions": [
    "Vertiefende Folgefrage die einen Kernaspekt praezisiert",
    "Frage zu einem anderen Winkel der Problematik",
    "Handlungsorientierte Frage die zur Entscheidung fuehrt"
  ],
  "newsContext": "Konkrete aktuelle Ereignisse oder Entwicklungen die die Frage beleuchten (wenn vorhanden)",
  "decisionFramework": "Konkreter 3-5-Punkte Entscheidungsrahmen: Was tun wann und warum?",
  "balancedScorecard": null,
  "confidence": 0.0
}

═══ BALANCED SCORECARD ═══
Standard: null. Generiere BSC NUR bei strategischen Analyse-Fragen ("Wie entwickelt sich X?", "Chancen/Risiken von Y?", "Strategie fuer Z?").
NICHT bei Faktenfragen, Politik, Namen, historischen Ereignissen.
Wenn BSC: themenspezifische Dimensionen (NICHT generisch). Format:
{"perspectives":[{"id":"p1","label":"3 Woerter max","score":0.0-1.0,"trend":"rising|stable|declining|uncertain","summary":"1-2 Saetze Analyse dieser Dimension","keyFactors":["Faktor 1","Faktor 2","Faktor 3"],"connectedTrendIds":[],"impacts":{"p2":0.4,"p3":-0.2,"p4":0.1}},{"id":"p2",...},{"id":"p3",...},{"id":"p4",...}],"overallReadiness":0.0-1.0,"criticalTension":"Die Kernspannung in 1 Satz"}
scores 0-1, impacts -1 bis +1 (0 = keine Verbindung)

confidence: 0.0-1.0 basierend auf Datenlage und Sicherheit der Aussagen

ERINNERUNG: Antworte AUSSCHLIESSLICH mit dem JSON-Objekt. Kein erklaernder Text. Kein Markdown. Nur { ... }.`;
}

/**
 * Query the LLM with the full data context
 */
export async function queryLLM(request: LLMBriefingRequest): Promise<LLMBriefingResponse | null> {
  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const systemPrompt = buildSystemPrompt(request.trends, request.locale, request.liveSignalsContext);

  let userMessage = request.query;
  if (request.contextProfile) {
    userMessage += `\n\n[Kontext: ${request.contextProfile.role} / ${request.contextProfile.industry} / ${request.contextProfile.region}]`;
  }

  const MAX_RETRIES = 3;
  const callAPI = async (attempt: number): Promise<Response | null> => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 12000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    // Retry on 429 (rate limit) or 529 (overloaded)
    if ((res.status === 429 || res.status === 529) && attempt < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
      await new Promise((r) => setTimeout(r, delay));
      return callAPI(attempt + 1);
    }

    return res.ok ? res : null;
  };

  try {
    const res = await callAPI(0);
    if (!res) return null;

    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as LLMBriefingResponse;
  } catch {
    return null;
  }
}

/**
 * Create an API route handler for LLM queries
 */
export function buildLLMQueryPayload(query: string, trends: TrendDot[], locale: Locale, contextProfile?: { role: string; industry: string; region: string }) {
  return { query, locale, contextProfile, trendCount: trends.length };
}
