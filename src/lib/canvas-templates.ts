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

/**
 * Optional structured field shown in the Framework Modal as a secondary input
 * below the main topic line. The collected values are appended to the topic
 * string so the existing queryTemplates receive richer context without schema
 * changes to the canvas state.
 */
export interface FrameworkField {
  key: string;            // stable identifier (not shown to user)
  labelDe: string;
  labelEn: string;
  placeholderDe: string;
  placeholderEn: string;
  type?: "text" | "textarea"; // default "text"
}

/**
 * User-facing guidance about what a good framework input looks like.
 * Rendered by the Framework Modal on the Home page. All fields are optional
 * so frameworks without explicit guidance still work.
 */
export interface FrameworkGuidance {
  /** One to two sentences describing the SHAPE of a good input. */
  questionShape: { de: string; en: string };
  /**
   * Reference topics that illustrate the shape — NOT rendered as clickable
   * copy-paste chips (per UX decision). Kept on the definition for potential
   * future use (dev docs, admin preview, prompt-tuning).
   */
  examples?: Array<{ de: string; en: string }>;
  /** Optional short warning about common bad inputs ("so NICHT"). */
  antiExample?: { de: string; en: string };
  /** Optional secondary input fields for required context. */
  fields?: FrameworkField[];
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
  /** User-facing guidance for the creation modal. Optional for backwards compat. */
  guidance?: FrameworkGuidance;
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
    guidance: {
      questionShape: {
        de: "Formuliere eine konkrete Frage zu einem abgegrenzten Markt oder einer Produktkategorie — mit Region, Zeithorizont und idealerweise deiner eigenen Position. Ein einzelnes Stichwort reicht nicht.",
        en: "Ask a concrete question about a defined market or product category — with region, time horizon and ideally your own position. A single keyword is not enough.",
      },
      examples: [
        { de: "Elektroauto-Markt in DACH bis 2027", en: "Electric vehicle market in DACH by 2027" },
        { de: "Mikro-Mobilität (E-Scooter, E-Bikes) in deutschen Großstädten", en: "Micro-mobility (e-scooters, e-bikes) in major German cities" },
        { de: "B2B-SaaS für Supply-Chain-Visibility in Europa", en: "B2B SaaS for supply chain visibility in Europe" },
      ],
      antiExample: {
        de: "Zu generisch (\"Automotive\") oder zu eng (\"Firma XY\") — beides liefert schwache Ergebnisse.",
        en: "Too generic (\"Automotive\") or too narrow (\"Company XY\") — both produce weak results.",
      },
      fields: [
        { key: "position", labelDe: "Eigene Position (optional)", labelEn: "Your position (optional)", placeholderDe: "z.B. Tier-1-Zulieferer mit Sitz in Stuttgart", placeholderEn: "e.g. Tier-1 supplier based in Stuttgart", type: "text" },
      ],
    },
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
    guidance: {
      questionShape: {
        de: "Formuliere eine konkrete strategische Frage mit benannten Akteuren, bei der die Zukunft wirklich offen ist. Eine Wie-reagieren-wir-auf-X-Frage mit klarem Gegner funktioniert am besten. Ein einzelnes Stichwort reicht nicht.",
        en: "Ask a concrete strategic question with named actors where the future is genuinely open. A How-do-we-respond-to-X question with a clear opponent works best. A single keyword is not enough.",
      },
      examples: [
        { de: "Wie reagieren wir auf die Preiskampfstrategie von Temu im DACH-E-Commerce?", en: "How do we respond to Temu's pricing attack in DACH e-commerce?" },
        { de: "Europäische Cloud-Souveränität: SAP + Deutsche Telekom gegen AWS", en: "European cloud sovereignty: SAP + Deutsche Telekom vs AWS" },
        { de: "Zukunft der deutschen Stahlindustrie: grüner Wasserstoff vs. chinesische Importe", en: "Future of German steel: green hydrogen vs Chinese imports" },
      ],
      antiExample: {
        de: "Keine offenen Fragen ohne Akteure (\"Wie wird KI die Welt verändern?\") — dafür ist Trend Deep-Dive besser.",
        en: "Not open questions without actors (\"How will AI change the world?\") — use Trend Deep-Dive for that.",
      },
      fields: [
        { key: "antagonist", labelDe: "Wer ist der Gegner / Wettbewerber?", labelEn: "Who is the opponent / competitor?", placeholderDe: "z.B. Temu, chinesische Stahlproduzenten, BYD", placeholderEn: "e.g. Temu, Chinese steel producers, BYD", type: "text" },
        { key: "horizon", labelDe: "Zeithorizont (optional)", labelEn: "Time horizon (optional)", placeholderDe: "z.B. 24 Monate, bis Q4 2027", placeholderEn: "e.g. 24 months, by Q4 2027", type: "text" },
      ],
    },
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
    guidance: {
      questionShape: {
        de: "Formuliere eine konkrete Frage zu einem Vorhaben, das noch NICHT gestartet ist — mit Zielzeitpunkt und Erfolgskriterium. Ohne greifbares Ziel kann auch kein prospektives Scheitern gedacht werden. Ein einzelnes Stichwort reicht nicht.",
        en: "Ask a concrete question about an initiative that hasn't started yet — with target date and success criterion. Without a tangible goal, no prospective failure can be imagined. A single keyword is not enough.",
      },
      examples: [
        { de: "Markteintritt in den USA mit unserer B2B-SaaS bis Q4 2026", en: "US market entry with our B2B SaaS by Q4 2026" },
        { de: "Migration unserer Kern-IT zu SAP S/4HANA innerhalb von 18 Monaten", en: "Migration of our core IT to SAP S/4HANA within 18 months" },
        { de: "Umstellung der gesamten Dienstwagenflotte auf vollelektrisch bis 2028", en: "Full electrification of our company fleet by 2028" },
      ],
      antiExample: {
        de: "Keine vergangenen Ereignisse (dafür Post-Mortem) und keine schwammigen Absichten (\"Irgendwas mit KI machen\").",
        en: "No past events (use Post-Mortem) and no vague intentions (\"Do something with AI\").",
      },
      fields: [
        { key: "targetDate", labelDe: "Zielzeitpunkt", labelEn: "Target date", placeholderDe: "z.B. Q4 2026, März 2027, in 18 Monaten", placeholderEn: "e.g. Q4 2026, March 2027, in 18 months", type: "text" },
        { key: "successCriterion", labelDe: "Was bedeutet Erfolg konkret?", labelEn: "What does \"success\" mean concretely?", placeholderDe: "z.B. 100 Kunden, 10M € ARR, Go-Live ohne Downtime", placeholderEn: "e.g. 100 customers, €10M ARR, go-live without downtime", type: "text" },
      ],
    },
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
    guidance: {
      questionShape: {
        de: "Formuliere eine konkrete Frage zu einem abgeschlossenen Ereignis oder Projekt mit bekanntem Outcome — meistens einem Scheitern. Die Faktenlage sollte öffentlich oder dir zugänglich sein. Ein einzelnes Stichwort reicht nicht.",
        en: "Ask a concrete question about a completed event or project with a known outcome — usually a failure. The facts should be public or accessible to you. A single keyword is not enough.",
      },
      examples: [
        { de: "Scheitern der Opel-Übernahme durch PSA im Kontext der Elektro-Strategie", en: "Failure of PSA's Opel takeover in the context of electric strategy" },
        { de: "Wirecard-Kollaps: Was ist strukturell bei der BaFin schiefgelaufen?", en: "Wirecard collapse: What went structurally wrong at BaFin?" },
        { de: "Warum Volkswagens Software-Einheit CARIAD die Termine reißt", en: "Why VW's software unit CARIAD keeps missing deadlines" },
      ],
      antiExample: {
        de: "Keine laufenden oder prospektiven Situationen — dafür gibt es Pre-Mortem oder War-Gaming.",
        en: "No ongoing or prospective situations — use Pre-Mortem or War-Gaming for those.",
      },
      fields: [
        { key: "timeframe", labelDe: "Zeitraum des Ereignisses (optional)", labelEn: "Timeframe of the event (optional)", placeholderDe: "z.B. 2019–2022, März 2024", placeholderEn: "e.g. 2019–2022, March 2024", type: "text" },
      ],
    },
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
    guidance: {
      questionShape: {
        de: "Formuliere eine konkrete Frage zu einem benannten Trend, einer Technologie oder Entwicklung. Je präziser die Eingrenzung, desto tiefer die Analyse. Ein einzelnes Stichwort reicht nicht.",
        en: "Ask a concrete question about a named trend, technology, or development. The more precise the scope, the deeper the analysis. A single keyword is not enough.",
      },
      examples: [
        { de: "Agentic AI im Enterprise-Software-Markt", en: "Agentic AI in the enterprise software market" },
        { de: "Rückbau der EU-Solarindustrie durch chinesische Überproduktion", en: "Decline of the EU solar industry due to Chinese overproduction" },
        { de: "MiCA-Regulierung und tokenisierte Assets in der EU", en: "MiCA regulation and tokenized assets in the EU" },
      ],
      antiExample: {
        de: "Zu breit (\"Digitalisierung\") oder zu normativ (\"Warum KI gefährlich ist\") — beides erzeugt Schlagwort-Salat.",
        en: "Too broad (\"digitalization\") or too normative (\"Why AI is dangerous\") — both produce buzzword salad.",
      },
      fields: [
        { key: "industryLens", labelDe: "Branchen-Linse (optional)", labelEn: "Industry lens (optional)", placeholderDe: "z.B. aus Sicht eines deutschen Mittelständlers im Maschinenbau", placeholderEn: "e.g. from the perspective of a German machinery SME", type: "text" },
      ],
    },
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
    guidance: {
      questionShape: {
        de: "Formuliere eine konkrete Frage zu einer Initiative, Entscheidung oder Veränderung mit identifizierbarem Kreis von Interessengruppen und klarem Entscheidungshorizont. Ein einzelnes Stichwort reicht nicht.",
        en: "Ask a concrete question about an initiative, decision, or change with an identifiable group of stakeholders and a clear decision horizon. A single keyword is not enough.",
      },
      examples: [
        { de: "Genehmigung für einen Offshore-Windpark in der Nordsee vor Rügen", en: "Permitting an offshore wind farm in the North Sea near Rügen" },
        { de: "Umstellung der Innenstadt München auf Null-Emissions-Zone bis 2028", en: "Converting Munich's city center to a zero-emission zone by 2028" },
        { de: "Fusion zweier mittelständischer Familienunternehmen in DACH", en: "Merger of two mid-sized family businesses in DACH" },
      ],
      antiExample: {
        de: "Keine reinen Marktanalysen oder Trendthemen — dafür sind Marktanalyse und Trend Deep-Dive besser.",
        en: "Not pure market analyses or trend topics — use Market Analysis or Trend Deep-Dive for those.",
      },
      fields: [
        { key: "decisionType", labelDe: "Art der Entscheidung (optional)", labelEn: "Type of decision (optional)", placeholderDe: "z.B. regulatorische Genehmigung, politische Mehrheit, Vorstandsentscheidung", placeholderEn: "e.g. regulatory approval, political majority, board decision", type: "text" },
        { key: "horizon", labelDe: "Entscheidungshorizont (optional)", labelEn: "Decision horizon (optional)", placeholderDe: "z.B. nächste 6 Monate, bis Herbst 2026", placeholderEn: "e.g. next 6 months, by fall 2026", type: "text" },
      ],
    },
  },

  // ═══ 7. DESIGN THINKING (Human-Centered Strategic Design) ═══
  // 2026-04-22 (Backlog: neues Template). 4-Schritt-Variante statt
  // klassischer 5-Phasen-Form (Empathize/Define/Ideate/Prototype/Test):
  // „Prototype" und „Test" werden zu einer Validate-Phase verdichtet,
  // weil strategische Fragen meist kein Produkt-MVP brauchen, sondern
  // ein überprüfbares Entscheidungsartefakt (Policy, Roadmap, Offer).
  // Der Prompt-Handler liegt in src/app/api/v1/frameworks/analyze/route.ts.
  {
    id: "design-thinking", icon: "🧭",
    name: "Design Thinking", nameEn: "Design Thinking",
    methodology: "Human-centered strategic design (IDEO / Stanford d.school, 1991→). 4-Schritt-Adaption für strategische Intelligence-Fragen: Empathize → Define → Ideate → Validate. Jede Phase liefert ein überprüfbares Artefakt; Validate-Phase verlangt Success- UND Kill-Metrik.",
    methodologyEn: "Human-centered strategic design (IDEO / Stanford d.school, 1991→). 4-step adaptation for strategic intelligence questions: Empathize → Define → Ideate → Validate. Each phase produces a testable artifact; Validate requires both success AND kill metrics.",
    description: "Empathie → Problem reframen → Lösungsraum divergieren → Validieren",
    descriptionEn: "Empathize → Reframe problem → Diverge solution space → Validate",
    steps: [
      { title: "Empathize", description: "Stakeholder-Jobs-to-be-done & Emotionale Landkarte", queryTemplate: "Stakeholder-Empathie für '{topic}': benenne 4+ konkrete Stakeholder-Gruppen (nicht nur 'User'), deren Job-to-be-done, Kontext/Constraints, 2-3 Pain-Points und Early-Signals für Veränderung. Baue zusätzlich eine Emotional-Map über Awareness/Consideration/Decision mit Feeling + Trigger pro Phase.", dependsOn: [] },
      { title: "Define", description: "3-5 How-might-we-Reframings mit Hidden-Assumption", queryTemplate: "{context}\n\nReframe das Kernspannungsfeld bei '{topic}' in 3-5 Varianten der Form 'How might we [verb] [spezifischer Akteur] to [Bedürfnis] despite [Constraint]'. Bewerte jede auf Hebel (0-5), Machbarkeit (0-5), Blast-Radius (0-5). Benenne die Hidden-Assumption jedes Framings + eine knappe Warum-wichtig-Zeile. Plus: 2 verworfene Reframings mit Begründung.", dependsOn: [0] },
      { title: "Ideate", description: "6-10 Lösungen, mindestens eine pro Typ", queryTemplate: "{context}\n\nFür das stärkste Reframing aus Step 2: generiere 6-10 Lösungen mit mindestens einer pro Typ (incremental / disruptive / analog / structural / reframe-challenge). Pro Lösung: Name, Mechanismus (1 Satz), kleinster Prototyp (4-8 Wochen testbar), 1-3 Early-Signals die Traction bestätigen, 1+ Kill-Signal. Zusätzlich: benannte Trends/Edges aus dem Weltmodell, auf die die Lösung aufsetzt.", dependsOn: [1] },
      { title: "Validate", description: "2-3 Experimente mit Success- UND Kill-Metrik", queryTemplate: "{context}\n\nValidierungs-Plan für 2-3 der Lösungen aus Step 3. Pro Experiment: Hypothese (wenn X dann Y weil Z), kleinster Test (4-12 Wochen), benannte Stakeholder-Teilnehmer aus Step 1, Success-Metrik mit Schwellwert, Kill-Metrik mit Schwellwert, 1-2 Early-Warning-Signale, Kostenrahmen, Timeline. Plus: 3-Zeilen-Entscheidungs-Rubrik (Success/Kill/Ambiguous).", dependsOn: [2] },
    ],
    guidance: {
      questionShape: {
        de: "Formuliere eine strategische Frage mit einem konkreten menschlichen Stakeholder-Kreis und einem überprüfbaren Entscheidungs-Artefakt am Ende. Nicht 'Wie entwickelt sich X?', sondern 'Wie gestalten wir X für wen damit Y messbar wird?'.",
        en: "Ask a strategic question with a concrete human stakeholder set and a testable decision artifact at the end. Not just 'How does X evolve?' — rather 'How do we design X for whom so Y becomes measurable?'.",
      },
      examples: [
        { de: "Wie bauen wir ein Onboarding-Programm für Quereinsteiger:innen in die Elektromobilitäts-Industrie, das Fachkräftemangel spürbar dämpft?", en: "How do we design an onboarding program for career-changers entering the electromobility industry that measurably alleviates the skills shortage?" },
        { de: "Welche Bürger-Interaktions-Schnittstelle lässt klassische Kommunen Open-Data-Plattformen wirklich nutzen statt nur betreiben?", en: "Which citizen-interaction surface would make classic municipalities actually use open-data platforms rather than just operate them?" },
        { de: "Wie muss ein EU-Förderprogramm für grünen Wasserstoff aussehen, damit KMUs tatsächlich Anträge stellen können — und wie messen wir Erfolg?", en: "What shape must an EU green-hydrogen funding programme take so SMEs can actually apply — and how do we measure success?" },
      ],
      antiExample: {
        de: "Reine Trend- oder Prognosefragen passen besser in Trend Deep-Dive. Reine Risiko-Fragen passen besser in Pre-Mortem.",
        en: "Pure trend or forecast questions fit Trend Deep-Dive better. Pure risk questions fit Pre-Mortem better.",
      },
      fields: [
        { key: "targetUser", labelDe: "Zielgruppe (optional)", labelEn: "Target user group (optional)", placeholderDe: "z.B. kommunale Energie-Beauftragte in DACH-Städten < 100k EW", placeholderEn: "e.g. municipal energy officers in DACH cities < 100k inhabitants", type: "text" },
        { key: "horizon", labelDe: "Zeithorizont für Validierung (optional)", labelEn: "Validation horizon (optional)", placeholderDe: "z.B. 8 Wochen bis 6 Monate", placeholderEn: "e.g. 8 weeks to 6 months", type: "text" },
      ],
    },
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
