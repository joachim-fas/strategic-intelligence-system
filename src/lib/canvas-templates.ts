/**
 * Canvas-Frameworks — Workflow-Definitionen
 *
 * Jedes Framework definiert eine SEQUENZ von Analyse-Schritten.
 * Das WorkflowPanel führt den User durch die Schritte.
 * Kontext wird automatisch von Schritt zu Schritt weitergegeben.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FrameworkStep {
  title: string;
  description: string;
  queryTemplate: string;  // {topic} und {context} werden ersetzt
  dependsOn: number[];    // Indizes der Schritte die vorher fertig sein müssen
  userInputPrompt?: string; // Optional: Frage an den User für spezifischen Kontext
}

export interface FrameworkDefinition {
  id: string;
  icon: string;
  name: string;
  nameEn: string;
  methodology: string;
  methodologyEn: string;
  description: string;
  descriptionEn: string;
  steps: FrameworkStep[];
}

// ─── Legacy compat: TemplateResult for static node generation ────────────────

interface TemplateNode {
  id: string; nodeType: string; x: number; y: number; createdAt: number;
  query?: string; locale?: string; status?: string; synthesis?: string;
  result?: null; collapsed?: boolean; parentId?: string; content?: string;
  customWidth?: number; customHeight?: number; tags?: string[];
}

interface TemplateConnection {
  from: string; to: string; derived?: boolean; connectionType?: string;
}

export interface TemplateResult {
  nodes: TemplateNode[]; conns: TemplateConnection[];
  autoStartQueryId?: string;
}

export interface TemplateInfo {
  id: string; icon: string;
  labelDe: string; labelEn: string;
  descDe: string; descEn: string;
  build: (topic: string) => TemplateResult;
}

// Legacy: simple node builder for backward compat with template picker
const uid = () => Math.random().toString(36).slice(2, 10);

function buildSimpleFromFramework(fw: FrameworkDefinition, topic: string): TemplateResult {
  const now = Date.now();
  const nodes: TemplateNode[] = [];
  const conns: TemplateConnection[] = [];

  fw.steps.forEach((step, i) => {
    const id = uid();
    const x = 80 + (i % 3) * 480;
    const y = 80 + Math.floor(i / 3) * 500;
    const query = step.queryTemplate.replace(/\{topic\}/g, topic).replace(/\{context\}/g, "");
    nodes.push({
      id, nodeType: "query", x, y, query, locale: "de",
      status: "done", synthesis: "", result: null, collapsed: false,
      createdAt: now, customWidth: 440, tags: [`schritt-${i + 1}`, fw.id],
    });
    // Connect to dependencies
    step.dependsOn.forEach(dep => {
      if (nodes[dep]) conns.push({ from: nodes[dep].id, to: id, connectionType: "builds-on" });
    });
  });

  return { nodes, conns, autoStartQueryId: nodes[0]?.id };
}

// ─── Framework Definitions ───────────────────────────────────────────────────

export const FRAMEWORKS: FrameworkDefinition[] = [
  // ═══ 1. STRATEGISCHE MARKTANALYSE ═══
  {
    id: "market-analysis", icon: "◈",
    name: "Strategische Marktanalyse", nameEn: "Strategic Market Analysis",
    methodology: "Erweiterte SWOT + PESTEL (Humphrey, Stanford 1960er). Analysiert interne Stärken/Schwächen und externe Chancen/Risiken systematisch.",
    methodologyEn: "Extended SWOT + PESTEL (Humphrey, Stanford 1960s). Systematically analyzes internal strengths/weaknesses and external opportunities/risks.",
    description: "5-Schritt SWOT: Kontext → Intern → Extern → Optionen → Priorisierung",
    descriptionEn: "5-step SWOT: Context → Internal → External → Options → Prioritization",
    steps: [
      { title: "Kontextanalyse", description: "Strategisches Lagebild des Marktes erstellen", queryTemplate: "Erstelle ein strategisches Lagebild zu '{topic}': Marktgröße, Wachstumsrate, Top 5 Akteure, regulatorisches Umfeld, technologische Entwicklung. Belege mit Zahlen und Quellen.", dependsOn: [] },
      { title: "Interne Stärken & Schwächen", description: "Kernkompetenzen, Ressourcen und Lücken analysieren", queryTemplate: "{context}\n\nAnalysiere die INTERNEN Faktoren bei '{topic}': Welche Stärken existieren (Kompetenzen, Ressourcen, Partnerschaften)? Welche Schwächen (Lücken, Abhängigkeiten, Widerstände)? Bewerte: Relevanz + Beeinflussbarkeit.", dependsOn: [0], userInputPrompt: "Beschreibe dein Unternehmen/deine Organisation (optional)" },
      { title: "Externe Chancen & Risiken", description: "Marktchancen und Bedrohungen identifizieren", queryTemplate: "{context}\n\nAnalysiere die EXTERNEN Faktoren bei '{topic}': Regulatorische Veränderungen, Technologietrends, Wettbewerbsdynamik, Demografie, Makroökonomie. Bewerte: Wahrscheinlichkeit + Zeitrahmen + Impact.", dependsOn: [0] },
      { title: "Strategische Optionen", description: "3-5 konkrete Handlungsoptionen ableiten", queryTemplate: "{context}\n\nLeite 3-5 strategische Optionen für '{topic}' ab. Für jede: Beschreibung, benötigte Ressourcen, Zeitrahmen, erwarteter ROI, Hauptrisiko. Kategorisiere: Offensiv / Defensiv / Korrigierend.", dependsOn: [1, 2], userInputPrompt: "Gibt es Optionen die du besonders interessant findest?" },
      { title: "Priorisierung", description: "Optionen nach Aufwand × Wirkung ordnen", queryTemplate: "{context}\n\nPriorisiere die strategischen Optionen für '{topic}' in einer Aufwand-Wirkung-Matrix: Quick Wins (sofort) / Strategische Projekte (planen) / Nicht tun. Konkrete Empfehlung für die nächsten 90 Tage.", dependsOn: [3] },
    ],
  },

  // ═══ 2. WAR-GAMING ═══
  {
    id: "war-gaming", icon: "⚡",
    name: "War-Gaming", nameEn: "War Gaming",
    methodology: "Szenario-basierte Strategieplanung (RAND Corporation 1960er, Shell 1970er). Prämisse: Die Zukunft ist nicht vorhersagbar, aber man kann sich auf mehrere Zukünfte vorbereiten.",
    methodologyEn: "Scenario-based strategy planning (RAND 1960s, Shell 1970s). Premise: The future is unpredictable, but you can prepare for multiple futures.",
    description: "Driving Forces → 3 Szenarien → Robuste Strategie",
    descriptionEn: "Driving Forces → 3 Scenarios → Robust Strategy",
    steps: [
      { title: "Driving Forces", description: "Die 5-7 wichtigsten Einflusskräfte identifizieren", queryTemplate: "Identifiziere die 5-7 wichtigsten Einflusskräfte für '{topic}'. Für jede: Richtung, Unsicherheitsgrad, Zeithorizont, STEEP+V-Dimension. Welche 2-3 haben die höchste Unsicherheit bei höchstem Impact?", dependsOn: [], userInputPrompt: "Gibt es bestimmte Kräfte die du berücksichtigt haben möchtest?" },
      { title: "Optimistisches Szenario", description: "Best Case: Was passiert wenn alles gut läuft?", queryTemplate: "{context}\n\nBeschreibe ein optimistisches aber REALISTISCHES Szenario für '{topic}': Welche Driving Forces wirken günstig zusammen? Konkrete Akteure, Zeitpunkte, Zahlen. Wahrscheinlichkeit mit Begründung. Frühwarnsignale.", dependsOn: [0] },
      { title: "Wahrscheinlichstes Szenario", description: "Basis: Was passiert wenn aktuelle Trends anhalten?", queryTemplate: "{context}\n\nBeschreibe das WAHRSCHEINLICHSTE Szenario für '{topic}': Aktuelle Dynamiken halten an. Was passiert in 1, 3, 5 Jahren? Welche Annahmen stecken dahinter? Wahrscheinlichkeit.", dependsOn: [0] },
      { title: "Pessimistisches Szenario", description: "Worst Case: Was passiert wenn es schiefgeht?", queryTemplate: "{context}\n\nBeschreibe ein PESSIMISTISCHES Szenario für '{topic}': Welcher Kipppunkt könnte es auslösen? Kaskadeneffekte? Wer verliert am meisten? Frühwarnsignale? Point of No Return?", dependsOn: [0] },
      { title: "Robuste Strategie", description: "Maßnahmen die in allen Szenarien funktionieren", queryTemplate: "{context}\n\nGegeben die drei Szenarien zu '{topic}': 1) No-Regret-Moves (in ALLEN Szenarien sinnvoll)? 2) Real Options (Flexibilität schaffen)? 3) Signposts (Frühwarnindikatoren überwachen)? Priorisiere: Sofort / Kurzfristig / Mittelfristig. Top 3 Entscheidungen der nächsten 90 Tage.", dependsOn: [1, 2, 3] },
    ],
  },

  // ═══ 3. PRE-MORTEM ═══
  {
    id: "pre-mortem", icon: "⚠",
    name: "Pre-Mortem", nameEn: "Pre-Mortem",
    methodology: "Prospective Hindsight (Gary Klein, 1989). Wissenschaftlich belegt: Menschen identifizieren 30% mehr Risiken wenn sie sich das Scheitern als bereits eingetreten vorstellen.",
    methodologyEn: "Prospective Hindsight (Gary Klein, 1989). Scientifically proven: People identify 30% more risks when imagining failure as already occurred.",
    description: "Scheitern vorstellen → Risiken bewerten → Gegenmaßnahmen planen",
    descriptionEn: "Imagine failure → Assess risks → Plan countermeasures",
    steps: [
      { title: "Pre-Mortem: Scheitern vorstellen", description: "Brutal ehrlich: Warum ist das Vorhaben gescheitert?", queryTemplate: "⚠️ VERSETZE DICH IN DIE ZUKUNFT. Es ist 18 Monate später. '{topic}' ist VOLLSTÄNDIG GESCHEITERT. Schreibe einen schonungslosen Rückblick: 1) Was genau ist passiert? 2) Die 5 Hauptgründe fürs Scheitern 3) Welche Warnsignale wurden ignoriert? 4) Welche Annahmen waren falsch? Sei BRUTAL EHRLICH.", dependsOn: [], userInputPrompt: "Beschreibe das Vorhaben genauer: Ziel, Zeitrahmen, Budget, Beteiligte" },
      { title: "Risiko-Bewertung", description: "Risiken nach Wahrscheinlichkeit × Schaden ordnen", queryTemplate: "{context}\n\nBewerte jedes identifizierte Risiko für '{topic}': Wahrscheinlichkeit (1-5), Schadensausmaß (1-5), Risiko-Score, Frühwarnsignale, erste Gegenidee. Sortiere nach Score (höchste zuerst).", dependsOn: [0] },
      { title: "Risiko-Mitigation", description: "Konkrete Gegenmaßnahmen für die Top-3 Risiken", queryTemplate: "{context}\n\nErstelle einen Mitigationsplan für die Top-3 Risiken bei '{topic}': Für jedes: Prävention (VOR Eintritt), Notfallplan (WENN Eintritt), Verantwortlicher, Frühwarnsignal + Trigger-Punkt. Kosten der Gegenmaßnahmen vs. Kosten des Risikos.", dependsOn: [1] },
    ],
  },

  // ═══ 4. POST-MORTEM ═══
  {
    id: "post-mortem", icon: "🔍",
    name: "Post-Mortem", nameEn: "Post-Mortem",
    methodology: "5-Whys (Toyota, Taiichi Ohno) + Ishikawa-Diagramm. Unterscheidet strukturelle, konjunkturelle und situative Ursachen.",
    methodologyEn: "5-Whys (Toyota, Taiichi Ohno) + Ishikawa diagram. Distinguishes structural, cyclical and situational causes.",
    description: "Chronologie → 3-Ebenen-Ursachen → Lessons Learned",
    descriptionEn: "Timeline → 3-layer causes → Lessons Learned",
    steps: [
      { title: "Chronologie & Fakten", description: "Was ist wann passiert? Wer hat was entschieden?", queryTemplate: "Rekonstruiere die Chronologie von '{topic}': Timeline mit Daten, Schlüsselentscheidungen, externe Auslöser, Fakten und Quellen. Belege jede Aussage.", dependsOn: [], userInputPrompt: "Beschreibe das Ereignis: Was genau ist passiert? Wann? Wer ist betroffen?" },
      { title: "Ursachen auf 3 Ebenen", description: "Strukturell × Konjunkturell × Situativ", queryTemplate: "{context}\n\nAnalysiere die Ursachen von '{topic}' auf drei Ebenen: STRUKTURELL (langfristig, systemisch — Megatrends, Regulierung), KONJUNKTURELL (mittelfristig — Wirtschaftszyklen, Politik), SITUATIV (kurzfristig — Entscheidungen, Personen, Zufall). Zeige Kausalketten.", dependsOn: [0] },
      { title: "Lessons Learned", description: "Was lernen wir daraus? Was ändern wir?", queryTemplate: "{context}\n\nLessons Learned aus '{topic}': 1) Was hätte man WISSEN können? 2) Was hätte man ANDERS machen können? 3) Was bedeutet das für ÄHNLICHE SITUATIONEN? 4) Welche SYSTEMISCHEN VERÄNDERUNGEN sind nötig? 3-5 konkrete Empfehlungen.", dependsOn: [1] },
    ],
  },

  // ═══ 5. TREND DEEP-DIVE ═══
  {
    id: "trend-deep-dive", icon: "🔬",
    name: "Trend Deep-Dive", nameEn: "Trend Deep-Dive",
    methodology: "STEEP+V-Framework angewendet auf einen einzelnen Trend. Referenz: EU JRC 14 Megatrends der Europäischen Kommission.",
    methodologyEn: "STEEP+V framework applied to a single trend. Reference: EU JRC 14 Megatrends of the European Commission.",
    description: "Definition → Evidenz → Treiber → Impact → Handlung",
    descriptionEn: "Definition → Evidence → Drivers → Impact → Action",
    steps: [
      { title: "Definition & Status", description: "Was ist der Trend? Wo stehen wir?", queryTemplate: "Umfassendes Briefing zu '{topic}': Definition, Entstehung, aktueller Stand (Zahlen!), Top 5 Akteure, Geografie, STEEP+V-Einordnung, Position auf der S-Kurve.", dependsOn: [] },
      { title: "Evidenz & Daten", description: "Was sagen die Live-Signale und Daten?", queryTemplate: "{context}\n\nAktuelle Evidenz für '{topic}': Live-Signale der letzten Wochen, quantitative Belege (Markt, Patente, Publikationen), Gegenbeweise/Abschwächung, Datenlücken.", dependsOn: [0] },
      { title: "Treiber & Bremser", description: "Was beschleunigt, was verlangsamt den Trend?", queryTemplate: "{context}\n\nKausale Kräfte hinter '{topic}': TREIBER (Technologie, Ökonomie, Regulierung, Gesellschaft) und BREMSER (Hürden, Kosten, Barrieren, Akzeptanz). Welche anderen Trends verstärken/hemmen?", dependsOn: [1] },
      { title: "Impact-Analyse", description: "Wer gewinnt, wer verliert? Zeitrahmen?", queryTemplate: "{context}\n\nImpact von '{topic}': Wirtschaft (Branchen), Gesellschaft (Gewinner/Verlierer), Geopolitik (Machtverschiebung), Technologie (Folgeinnovationen), Umwelt. Zeitrahmen: kurz/mittel/lang.", dependsOn: [2] },
      { title: "Handlungsoptionen", description: "Was tun? Sofort / Vorbereiten / Beobachten", queryTemplate: "{context}\n\nHandlungsoptionen für '{topic}': Für Unternehmen (Positionierung, Investitionen), Politik (Regulierung, Förderung), Forschung (offene Fragen). Priorisiert: 🔴 SOFORT (90 Tage) / 🟡 VORBEREITEN (6-12 Monate) / 🟢 BEOBACHTEN (Monitoring).", dependsOn: [3], userInputPrompt: "Für welchen Kontext sollen die Handlungsoptionen sein? (Unternehmen, Branche, Rolle)" },
    ],
  },

  // ═══ 6. STAKEHOLDER-MAPPING ═══
  {
    id: "stakeholder-mapping", icon: "👥",
    name: "Stakeholder-Mapping", nameEn: "Stakeholder Mapping",
    methodology: "Mitchell Stakeholder Salience Model (1997): Power × Legitimacy × Urgency. Kombiniert mit Interest/Influence-Matrix.",
    methodologyEn: "Mitchell Stakeholder Salience Model (1997): Power × Legitimacy × Urgency. Combined with Interest/Influence Matrix.",
    description: "Identifizieren → Bewerten → Dynamiken → Engagement",
    descriptionEn: "Identify → Assess → Dynamics → Engagement",
    steps: [
      { title: "Stakeholder identifizieren", description: "Wer sind die 7-10 wichtigsten Akteure?", queryTemplate: "Identifiziere die 7-10 wichtigsten Stakeholder bei '{topic}': Name, Rolle, primäres Interesse (was wollen sie?), sekundäres Interesse (was befürchten sie?). Gruppiere: Entscheider / Beeinflusser / Betroffene / Beobachter.", dependsOn: [], userInputPrompt: "Gibt es bestimmte Stakeholder die du berücksichtigt haben möchtest?" },
      { title: "Macht & Einfluss bewerten", description: "Power-Interest-Matrix erstellen", queryTemplate: "{context}\n\nBewerte jeden Stakeholder bei '{topic}': Macht (1-5), Interesse (1-5), Haltung (Befürworter/Gegner/Neutral), Vorhersagbarkeit. Ordne in Power-Interest-Matrix: Key Players / Keep Satisfied / Keep Informed / Monitor.", dependsOn: [0] },
      { title: "Dynamiken & Koalitionen", description: "Wer beeinflusst wen? Welche Bündnisse?", queryTemplate: "{context}\n\nAnalysiere Beziehungen zwischen Stakeholdern bei '{topic}': Bestehende Allianzen, mögliche neue Koalitionen, Konflikte, Einflussketten (A→B→C), mögliche Positionswechsel.", dependsOn: [1] },
      { title: "Engagement-Strategie", description: "Wer zuerst? Welche Botschaft? Timing?", queryTemplate: "{context}\n\nEngagement-Strategie für '{topic}': Für jeden Key Stakeholder: Kommunikationsansatz, Timing, Kernbotschaft, Risiko bei Widerstand. Gesamtplan: Sequenzierung, Quick Wins, Umgang mit Gegnern. Konkreter 4-Wochen-Plan.", dependsOn: [2] },
    ],
  },
];

// ─── Legacy Template Registry (backward compat with TemplatePicker) ──────────

export const TEMPLATES: TemplateInfo[] = [
  { id: "empty", icon: "⊞", labelDe: "Leerer Canvas", labelEn: "Empty Canvas", descDe: "Starte ohne Vorgaben", descEn: "Start from scratch", build: () => ({ nodes: [], conns: [] }) },
  ...FRAMEWORKS.map(fw => ({
    id: fw.id,
    icon: fw.icon,
    labelDe: fw.name,
    labelEn: fw.nameEn,
    descDe: fw.description,
    descEn: fw.descriptionEn,
    build: (topic: string) => buildSimpleFromFramework(fw, topic),
  })),
];

// ─── Export for Wissen page "Im Canvas analysieren" ──────────────────────────

export function buildTrendDeepDive(topic: string): TemplateResult {
  const fw = FRAMEWORKS.find(f => f.id === "trend-deep-dive")!;
  return buildSimpleFromFramework(fw, topic);
}
