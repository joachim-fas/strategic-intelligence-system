/**
 * LLM Integration for the Strategic Intelligence System
 *
 * Uses Claude API to understand ANY user query and generate
 * structured intelligence briefings from the full data context.
 *
 * This replaces the hardcoded semantic map with real understanding.
 */

import { TrendDot } from "@/types";
import { resolveEnv } from "./env";
import { getRegulationsForTrend, getRegulatoryPressure, GLOBAL_REGULATIONS } from "./regulations";
import { getEdgesForTrend, TREND_EDGES } from "./causal-graph";
import { getTrendSources, getTotalSourceCount } from "./trend-sources";
import { autoClassify } from "./classify";
import { Locale } from "./i18n";

/**
 * Aktuelles Datum als Prompt-Block. Alle SIS-System-Prompts müssen diesen
 * Block einbauen — sonst nimmt der LLM sein Training-Cutoff (typischerweise
 * ~2024) stillschweigend als „jetzt" an und formuliert Prognosen für
 * Zeiträume, die in Wahrheit längst Vergangenheit sind.
 *
 * Beispiel für einen Fehler den dieser Helper verhindert: ein User stellt
 * im April 2026 eine Frage zum Ukraine-Krieg und bekommt die Antwort
 * „Kriegsende vor Ende 2025 ist möglich" — als wäre 2025 noch in der
 * Zukunft.
 */
export function buildDateContext(locale: Locale): string {
  const now = new Date();
  const dateDe = now.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  const dateEn = now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const isoDate = now.toISOString().slice(0, 10);
  return locale === "de"
    ? `═══ ZEITLICHER KONTEXT ═══
Heute ist ${dateDe} (ISO: ${isoDate}). Alles vor diesem Datum ist Vergangenheit und wird im Präteritum/Perfekt behandelt. Formuliere Prognosen NUR für Zeiträume, die nach diesem Datum beginnen. Prüfe bei jeder Zeitangabe, ob sie in der Vergangenheit oder Zukunft liegt.`
    : `═══ TEMPORAL CONTEXT ═══
Today is ${dateEn} (ISO: ${isoDate}). Everything before this date is past and must be phrased in past tense. Forecasts may only cover time periods starting after this date. Verify every date reference against the current date before writing.`;
}

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
  /**
   * Optional per-query relevance map for matched trends: id → [0, 1].
   * When the LLM supplies this, the Orbit derivation spine uses it to
   * filter off-topic matches (e.g. a football trend surfacing on a
   * mobility query because of tag overlap). Absent → consumers fall
   * back to `relevance × confidence` as a proxy.
   */
  matchedTrendRelevance?: Record<string, number>;
  keyInsights: string[];
  regulatoryContext: string[];
  causalAnalysis: string[];
  steepV?: {
    S?: string | null;
    T?: string | null;
    E_economy?: string | null;
    E_environment?: string | null;
    P?: string | null;
    V?: string | null;
  };
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
  // Sort into a new array (avoid mutating the caller's input) and pick the
  // top 40 for the prompt. Also capture the top 3 IDs so the JSON example
  // downstream uses REAL ids from the actual list — hardcoding slug-style
  // ids like "mega-ai-transformation" taught the LLM to emit similar
  // hallucinations that then got dropped by the id-whitelist validator.
  const sortedTrends = [...trends].sort((a, b) => b.relevance - a.relevance);
  const trendSummaries = sortedTrends
    .slice(0, 40)
    .map((t) => {
      const cls = t.classification || autoClassify(t);
      const regs = getRegulationsForTrend(t.id);
      const edges = getEdgesForTrend(t.id);
      const sources = getTrendSources(t.tags);
      return `- ID:"${t.id}" | ${t.name} [${t.category}] Ring:${t.ring} Rel:${(t.relevance*100).toFixed(0)}% Conf:${(t.confidence*100).toFixed(0)}% Imp:${(t.impact*100).toFixed(0)}% ${t.velocity}↕ Dur:${cls.duration} Dir:${cls.direction} Focus:${cls.focus.join(",")} Signals:${t.signalCount} Sources:${sources.map(s=>s.shortName).join(",")} Regs:${regs.map(r=>r.shortName).join(",")} Edges:${edges.length}`;
    })
    .join("\n");
  // Three real IDs for the schema example. Fall back to a generic marker if
  // fewer than 3 trends exist (e.g. in tests).
  const exampleIds: string[] = sortedTrends.slice(0, 3).map((t) => t.id);
  while (exampleIds.length < 3) exampleIds.push("<trend-id-from-list-above>");

  // Compact regulation summaries
  const regSummaries = GLOBAL_REGULATIONS
    .map((r) => `- ${r.jurisdiction}:${r.shortName} [${r.status}] → ${r.impactedTrends.map(it => `${it.trendId}(${it.effect})`).join(",")}`)
    .join("\n");

  // Compact causal edges
  const edgeSummaries = TREND_EDGES
    .map((e) => `${e.from} --${e.type}(${(e.strength*100).toFixed(0)}%)--> ${e.to}`)
    .join("\n");

  const lang = locale === "de" ? "Antworte auf Deutsch." : "Respond in English.";

  // Aktuelles Datum — verhindert, dass der LLM sein Training-Cutoff als
  // „jetzt" behandelt und Prognosen für längst vergangene Zeiträume stellt
  // (z.B. „Kriegsende vor Ende 2025" im April 2026).
  const dateContext = buildDateContext(locale);

  return `Du bist das Strategic Intelligence System (SIS) — ein Denk-Instrument auf dem Niveau eines erstklassigen Think-Tanks mit explizitem EU-Fokus. ${lang}

${dateContext}

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
7. TRANSPARENZ & QUELLENHERKUNFT (Provenance Tagging):
   - Fakten aus Live-Signalen: [SIGNAL: Quellenname, Datum]
   - Fakten aus Trend-Daten: [TREND: Trendname]
   - Eigenes Wissen ohne externe Quelle: [LLM-Einschaetzung]
   - ERFINDE NIEMALS URLs oder Verordnungsnummern. Wenn du eine konkrete URL nicht kennst, lasse sie weg.
   - Das references-Array darf NIEMALS leer sein — fuege mindestens 2 ECHTE, VERIFIZIERTE Quellen ein.
   - Wo die Datenlage duenn ist, sage es explizit.

═══ SZENARIO-WAHRSCHEINLICHKEITEN ═══
KRITISCH: Die drei Szenario-Wahrscheinlichkeiten muessen sich aus der ANALYSE ERGEBEN — NICHT aus einem Default-Schema.
- VERBOTEN: Identische Verteilungen wie 0.20/0.55/0.25 oder 0.25/0.50/0.25 fuer jede Frage
- Wahrscheinlichkeiten MUESSEN themenspezifisch sein. Beispiele:
  * Ein reifer Markt → baseline hoeher (z.B. 0.65), Extremszenarien niedriger
  * Ein volatiles Thema → breitere Verteilung, pessimistic kann hoeher sein
  * Ein politisch getriebenes Thema → baseline niedriger weil unsicherer
- Begruende in der description WARUM du diese Wahrscheinlichkeit vergibst
- Summe muss ~100% sein (95-105% akzeptabel durch Rundung)

═══ TREND-MATCHING (matchedTrendIds + matchedTrendRelevance) ═══
Mappe deine Analyse IMMER zurueck auf konkrete Trend-IDs aus der TRENDS-Liste oben.
- Pruefe JEDEN Trend in der Liste: Ist er DIREKT relevant fuer diese Frage?
- KRITISCH: Kopiere die IDs EXAKT so wie sie in der TRENDS-Liste oben stehen
  (siehe ID:"..."-Feld jeder Zeile). Die IDs sind UUIDs oder aehnliche Strings
  wie "${exampleIds[0]}" — ERFINDE KEINE eigenen slug-artigen IDs wie
  "mega-ai" oder "trend-mobility". Jede erfundene ID wird komplett verworfen.
- Gib NUR die trend-IDs zurueck, NICHT die Namen
- Erwartete Anzahl: 3-8 matched Trends pro Query — nicht 0, nicht alle 40
- FEHLERMELDUNG an dich selbst: matchedTrendIds = [] ist IMMER ein Fehler

Zusaetzlich MUSS fuer JEDEN gematchten Trend eine per-Query-Relevanz in
matchedTrendRelevance geliefert werden — eine Zahl zwischen 0.0 und 1.0,
die angibt wie ZENTRAL dieser Trend fuer DIESE konkrete Frage ist:
- 0.90-1.00: Kernthema der Frage — die Antwort waere ohne diesen Trend unvollstaendig
- 0.60-0.89: Starker Bezug — pragender Einflussfaktor fuer die Frage
- 0.30-0.59: Mittlerer Bezug — relevanter Kontext, aber nicht zentral
- 0.10-0.29: Schwacher Bezug — streift das Thema, ist aber nicht pragend
- Unter 0.10: Nicht matchen, diesen Trend weglassen
WICHTIG: Der globale Trend-Relevance-Score (oben in der Liste) ist NICHT
automatisch die Query-Relevanz. Ein global wichtiger Trend kann fuer diese
spezielle Frage randstaendig sein. Bewerte themenspezifisch.

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

═══ TEXTFORMATIERUNG ═══
KRITISCH: Laengere Texte (synthesis, scenarios.description, interpretation) MUESSEN in ABSAETZE gegliedert sein.
- Verwende \\n\\n zwischen Absaetzen (doppelter Zeilenumbruch im JSON-String)
- synthesis: 2-3 Absaetze (Lage → Dynamiken → Implikationen)
- scenarios.description: 2 Absaetze (Entwicklung → Konsequenzen)
- KEINE Textwuesten — jeder Absatz max. 3-4 Saetze
- Innerhalb eines Absatzes darf \\n fuer weiche Umbrueche verwendet werden
- Welche KONKRETEN IMPLIKATIONEN ergeben sich — insbesondere fuer Europa?
- Wo ist die DATENLAGE DUENN — was wissen wir nicht?
Belege Aussagen direkt im Fliesstext: [Quellenname, Datum]. Ohne Beleg = Meinung.
Methodische Transparenz: Benenne die analytische Grundlage (welche Quellen, welche Methodik, welche Limitationen).

ANTWORTE NUR als JSON (kein Text ausserhalb):
{
  "synthesis": "6-10 substanzielle Saetze, GEGLIEDERT in 2-3 Absaetze (getrennt durch \\n\\n). OPTIONAL: Jeder Absatz darf mit einer Markdown-Ueberschrift beginnen (Format: '## Titel\\n<Absatztext>' — maximal 4 Woerter, themenspezifisch). Wenn keine Ueberschrift gesetzt ist, zeigt das Frontend automatisch die Default-Labels (Kernaussage / Treibende Dynamiken / Implikationen). Erster Absatz: Kernaussage und aktueller Stand. Zweiter Absatz: Treibende Kraefte und Dynamiken. Dritter Absatz: Implikationen und Unsicherheiten. Nenne konkrete Beispiele, Zahlen, Zeitrahmen. Belege mit [Quelle, Datum]. VERBOTEN: Saetze wie 'X ist ein Megatrend mit Y% Relevanz'.",
  "reasoningChains": ["Kausale Kette: Ausgangsfaktor → Zwischenschritt → Strategische Implikation", "..."],
  "steepV": {
    "S": "Society-Dimension: 1-2 Saetze wie diese Frage die Gesellschaft betrifft (oder null wenn irrelevant)",
    "T": "Technology-Dimension: 1-2 Saetze (oder null)",
    "E_economy": "Economy-Dimension: 1-2 Saetze (oder null)",
    "E_environment": "Environment-Dimension: 1-2 Saetze (oder null)",
    "P": "Politics-Dimension: 1-2 Saetze (oder null)",
    "V": "Values-Dimension: 1-2 Saetze (oder null)"
  },
  "matchedTrendIds": ["${exampleIds[0]}", "${exampleIds[1]}", "${exampleIds[2]}"],
  "matchedTrendRelevance": {
    "${exampleIds[0]}": 0.85,
    "${exampleIds[1]}": 0.42,
    "${exampleIds[2]}": 0.18
  },
  "causalAnalysis": ["Ursache → Wirkung → strategische Konsequenz"],
  "keyInsights": [
    "Konkrete, nicht-triviale Erkenntnis mit Begruendung und Konsequenz",
    "Zweite Erkenntnis — anderer Aspekt, konkret",
    "Dritte Erkenntnis — Handlungsrelevanz"
  ],
  "regulatoryContext": ["Nur wenn regulatorisch relevant fuer diese Frage"],
  "scenarios": [
    {
      "type": "optimistic",
      "name": "Kurzer thematischer Name (max 5 Woerter)",
      "description": "Konkretes Szenario mit Zeitrahmen und Bedingungen — mindestens 3-4 Saetze in 2 Absaetzen (getrennt durch \\n\\n). Erster Absatz: Was passiert und warum. Zweiter Absatz: Konkrete Auswirkungen und Akteure. Begruende die Wahrscheinlichkeit.",
      "probability": "<BERECHNE themenspezifisch, NICHT 0.25>",
      "timeframe": "konkreter Zeitraum",
      "keyDrivers": ["Treiber 1", "Treiber 2", "Treiber 3"]
    },
    {
      "type": "baseline",
      "name": "Kurzer thematischer Name (max 5 Woerter)",
      "description": "Was passiert wenn aktuelle Dynamiken anhalten — mindestens 3-4 Saetze in 2 Absaetzen (getrennt durch \\n\\n). Erster Absatz: Verlauf und Dynamik. Zweiter Absatz: Konkrete Konsequenzen. Begruende die Wahrscheinlichkeit.",
      "probability": "<BERECHNE themenspezifisch, NICHT 0.50>",
      "timeframe": "konkreter Zeitraum",
      "keyDrivers": ["Treiber 1", "Treiber 2", "Treiber 3"]
    },
    {
      "type": "pessimistic",
      "name": "Kurzer thematischer Name (max 5 Woerter)",
      "description": "Worst Case mit konkreten Ausloesern — mindestens 3-4 Saetze in 2 Absaetzen (getrennt durch \\n\\n). Erster Absatz: Ausloesende Ereignisse und Kipppunkte. Zweiter Absatz: Folgen und Eskalationsdynamik. Begruende die Wahrscheinlichkeit.",
      "probability": "<BERECHNE themenspezifisch, NICHT 0.20>",
      "timeframe": "konkreter Zeitraum",
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

  // SEC-08: Sanitize contextProfile fields to prevent prompt injection
  let userMessage = request.query;
  if (request.contextProfile) {
    const sf = (v: string | undefined): string =>
      (v || "").slice(0, 100).replace(/[\n\r]/g, " ").replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\b(system|assistant|human)\s*:/gi, "").trim();
    const role = sf(request.contextProfile.role);
    const industry = sf(request.contextProfile.industry);
    const region = sf(request.contextProfile.region);
    if (role || industry || region) {
      userMessage += `\n\n[Kontext: ${role} / ${industry} / ${region}]`;
    }
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
