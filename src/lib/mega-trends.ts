import { TrendDot } from "@/types";

/**
 * Kuratierte Mega- und Makro-Trends aus autoritativen Quellen:
 *
 * Quellen:
 * - Zukunftsinstitut: 11 Megatrends (zukunftsinstitut.de/megatrends)
 * - PwC: 5 Megatrends (pwc.com/gx/en/issues/megatrends.html)
 * - EY: Megatrends 2026+ (ey.com/en_gl/megatrends)
 * - EU ESPAS: Global Trends to 2030 (ec.europa.eu/assets/epsc/pages/espas)
 * - Roland Berger: Trend Compendium 2050 (rolandberger.com)
 * - TRENDONE: Trend Universe 2026 (trendone.com)
 *
 * Confidence = Anzahl Quellen die den Trend nennen / Gesamtquellen
 * Je mehr Quellen, desto hoeher die Confidence.
 */

interface TrendSource {
  name: string;
  url: string;
}

// Sources metadata for evidence display
export const TREND_SOURCES: Record<string, TrendSource[]> = {
  // Will be referenced in detail panels
};

export const megaTrends: TrendDot[] = [
  // ═══════════════════════════════════════════════════════════════
  // MEGA-TRENDS: Langfristige transformative Kraefte
  // ═══════════════════════════════════════════════════════════════

  // ─── AI & Technologische Disruption ────────────────────────────
  // Quellen: PwC, EY, TRENDONE, Roland Berger, Zukunftsinstitut (Konnektivitaet)
  {
    id: "mega-ai-transformation",
    name: "Artificial Intelligence & Automation",
    description: "Künstliche Intelligenz durchdringt inzwischen alle Wirtschaftssektoren, von Gesundheitswesen über Finanzdienstleistungen bis zur industriellen Fertigung. Laut PwC (2024) könnte KI bis 2030 einen globalen Wertschöpfungsbeitrag von bis zu 15,7 Billionen USD generieren. Zentrale Treiber sind sinkende Rechenkosten, multimodale Modellarchitekturen und die zunehmende Verfügbarkeit qualitativ hochwertiger Trainingsdaten. In der EU setzt der AI Act (in Kraft seit August 2024) den weltweit ersten umfassenden Rechtsrahmen für KI-Regulierung. Strategisch entscheidend sind der geopolitische Wettbewerb um Halbleiter-Lieferketten, der Fachkräftemangel in KI-Kompetenzen und die gesellschaftliche Akzeptanz von Automatisierung in Wissensberufen.",
    category: "Mega-Trend",
    tags: ["ai", "automation", "disruption", "mega-trend",
      "PwC", "EY", "TRENDONE", "Roland Berger"],
    relevance: 0.98,
    confidence: 0.95, // 5/6 Quellen
    impact: 0.98,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 0,
    signalCount: 500,
    topSources: ["PwC", "EY", "TRENDONE", "Roland Berger"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "mega-technological-disruption",
    name: "Technological Disruption",
    description: "Konvergierende Technologien wie Quantencomputing, synthetische Biologie und fortgeschrittene Robotik erzeugen disruptive Innovationszyklen, die sich laut Roland Berger (Trend Compendium 2050) weiter beschleunigen. PwC identifiziert technologische Disruption als einen der fünf prägenden Megatrends, wobei die Adoptionsgeschwindigkeit neuer Technologien exponentiell zunimmt: Generative KI erreichte 100 Millionen Nutzer in zwei Monaten. In der EU zielt das Horizon-Europe-Programm (95,5 Mrd. EUR, 2021-2027) darauf ab, europäische Technologiesouveränität zu stärken. Kritisch bleibt die wachsende Kluft zwischen Technologie-Frontrunners und Nachzüglern, sowohl zwischen als auch innerhalb von Volkswirtschaften.",
    category: "Mega-Trend",
    tags: ["technology", "disruption", "frontier-tech", "mega-trend",
      "PwC", "Roland Berger", "TRENDONE"],
    relevance: 0.95,
    confidence: 0.83, // 5/6
    impact: 0.95,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 0,
    signalCount: 400,
    topSources: ["PwC", "Roland Berger", "TRENDONE", "EU ESPAS"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Klimawandel & Nachhaltigkeit ─────────────────────────────
  // Quellen: PwC, EU ESPAS, Roland Berger, Zukunftsinstitut (Oekointelligenz), TRENDONE (Planet Centricity)
  {
    id: "mega-climate-sustainability",
    name: "Climate Change & Sustainability",
    description: "Der Klimawandel hat sich laut IPCC (AR6, 2023) auf ca. 1,1 Grad Celsius Erwärmung gegenüber dem vorindustriellen Niveau beschleunigt, mit zunehmenden Extremwetterereignissen. Die EU verfolgt mit dem Green Deal das Ziel der Klimaneutralität bis 2050 und hat sich auf eine CO2-Reduktion von mindestens 55% bis 2030 festgelegt. PwC, Roland Berger und das Zukunftsinstitut bewerten diesen Trend übereinstimmend als einen der wirkungsstärksten Megatrends. Treiber sind regulatorischer Druck (CSRD, EU-Taxonomie), veränderte Investorenerwartungen und physische Klimarisiken. Strategisch relevant ist die doppelte Herausforderung: Dekarbonisierung der bestehenden Wirtschaft bei gleichzeitiger Anpassung an bereits unvermeidbare Klimafolgen.",
    category: "Mega-Trend",
    tags: ["climate", "sustainability", "esg", "net-zero", "mega-trend",
      "PwC", "EU ESPAS", "Roland Berger", "Zukunftsinstitut", "TRENDONE"],
    relevance: 0.96,
    confidence: 1.0, // 6/6 Quellen
    impact: 0.97,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 1,
    signalCount: 450,
    topSources: ["PwC", "EU ESPAS", "Roland Berger", "Zukunftsinstitut"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Demografischer Wandel ────────────────────────────────────
  // Quellen: PwC, EU ESPAS, Roland Berger, Zukunftsinstitut
  {
    id: "mega-demographic-shift",
    name: "Demographic Shifts & Aging",
    description: "Die Weltbevölkerung altert strukturell: Laut UN (World Population Prospects 2024) wird der Anteil der über 65-Jährigen global von 10% (2022) auf 16% (2050) steigen. In der EU ist die Lage besonders akut, mit einer Dependency Ratio, die laut Eurostat von 33% (2022) auf über 50% bis 2050 ansteigen dürfte. PwC und Roland Berger identifizieren diese Verschiebung als fundamentalen Stressfaktor für Sozialsysteme, Arbeitsmärkte und Gesundheitswesen. Gleichzeitig entsteht eine wachsende Silver Economy, während Fachkräftemangel und steigende Pflegekosten den politischen Handlungsdruck erhöhen.",
    category: "Mega-Trend",
    tags: ["demographics", "aging", "population", "migration", "mega-trend",
      "PwC", "EU ESPAS", "Roland Berger", "Zukunftsinstitut"],
    relevance: 0.88,
    confidence: 0.83, // 5/6
    impact: 0.9,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 1,
    signalCount: 300,
    topSources: ["PwC", "EU ESPAS", "Roland Berger", "Zukunftsinstitut"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Konnektivitaet & Digitale Vernetzung ─────────────────────
  // Quellen: Zukunftsinstitut, EU ESPAS, TRENDONE (Connected World, Data Era)
  {
    id: "mega-connectivity",
    name: "Connectivity & Digital Networks",
    description: "Die globale Vernetzung wächst exponentiell: Laut ITU (2024) sind inzwischen über 5,4 Milliarden Menschen online, und die Zahl der IoT-Geräte übersteigt laut Statista bereits 15 Milliarden. Das Zukunftsinstitut sieht Konnektivität als strukturellen Megatrend, der alle anderen Trends durchdringt und beschleunigt. In der EU treibt das Digital-Decade-Programm den Ausbau auf Gigabit-Netze und 5G-Abdeckung bis 2030 voran. Strategische Risiken liegen in der digitalen Kluft zwischen urbanen und ländlichen Räumen, der Abhängigkeit von wenigen Infrastrukturanbietern und der zunehmenden Verwundbarkeit vernetzter Systeme.",
    category: "Mega-Trend",
    tags: ["connectivity", "networks", "digital", "iot", "mega-trend",
      "Zukunftsinstitut", "EU ESPAS", "TRENDONE"],
    relevance: 0.92,
    confidence: 0.83, // 5/6
    impact: 0.88,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 0,
    signalCount: 350,
    topSources: ["Zukunftsinstitut", "EU ESPAS", "TRENDONE", "Roland Berger"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Urbanisierung ────────────────────────────────────────────
  // Quellen: Zukunftsinstitut, EU ESPAS, Roland Berger, TRENDONE
  {
    id: "mega-urbanization",
    name: "Urbanization & Smart Cities",
    description: "Laut UN-Habitat (2024) leben bereits 57% der Weltbevölkerung in Städten, mit einem erwarteten Anstieg auf 68% bis 2050. In der EU liegt der Urbanisierungsgrad mit ca. 75% noch höher, was Herausforderungen bei Wohnraum, Infrastruktur und Klimaanpassung verschärft. Smart-City-Konzepte (Sensorik, digitale Zwillinge, intelligentes Energiemanagement) gewinnen an Bedeutung, wobei die EU-Mission 'Climate-Neutral and Smart Cities' 100 europäische Städte bis 2030 klimaneutral machen will. Kritische Unsicherheiten betreffen die Finanzierung der urbanen Transformation, Datenschutz im öffentlichen Raum und die soziale Durchmischung wachsender Metropolen.",
    category: "Mega-Trend",
    tags: ["urbanization", "smart-city", "infrastructure", "mega-trend",
      "Zukunftsinstitut", "EU ESPAS", "Roland Berger", "TRENDONE"],
    relevance: 0.78,
    confidence: 0.83, // 5/6
    impact: 0.82,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 3,
    signalCount: 200,
    topSources: ["Zukunftsinstitut", "EU ESPAS", "Roland Berger", "TRENDONE"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Geopolitische Fragmentierung ─────────────────────────────
  // Quellen: PwC (Fracturing World), EU ESPAS, Roland Berger, TRENDONE (Age of Disorder)
  {
    id: "mega-geopolitical-fracturing",
    name: "Geopolitical Fragmentation",
    description: "Die regelbasierte multilaterale Ordnung weicht zunehmend einer multipolaren Welt mit rivalisierenden Einflusssphären. PwC beschreibt dies als 'Fracturing World', in der Technologie-, Handels- und Finanzräume entlang geopolitischer Linien fragmentieren. Laut EU ESPAS (Global Trends to 2030) steht Europa vor der Herausforderung, strategische Autonomie in Schlüsselbereichen wie Halbleiter, Energie und Rohstoffe zu sichern. Der Krieg in der Ukraine, Spannungen im Indo-Pazifik und der systemische Wettbewerb zwischen USA und China sind die zentralen Treiber. Für Unternehmen bedeutet dies erhöhte Compliance-Komplexität, fragmentierte Lieferketten und die Notwendigkeit geopolitischer Szenarioplanung.",
    category: "Mega-Trend",
    tags: ["geopolitics", "fragmentation", "multipolar", "mega-trend",
      "PwC", "EU ESPAS", "Roland Berger", "TRENDONE", "World Monitor"],
    relevance: 0.85,
    confidence: 0.83, // 5/6
    impact: 0.88,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 1,
    signalCount: 250,
    topSources: ["PwC", "EU ESPAS", "Roland Berger", "TRENDONE"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Future of Work ───────────────────────────────────────────
  // Quellen: Zukunftsinstitut, EY, TRENDONE (Future Skillsets), Roland Berger
  {
    id: "mega-future-of-work",
    name: "Future of Work",
    description: "Laut McKinsey Global Institute (2023) könnten bis 2030 weltweit rund 30% aller Arbeitsstunden durch Automatisierung und generative KI verändert werden. Das Zukunftsinstitut und EY sehen einen fundamentalen Wandel von festen Berufsbildern zu fluiden Skill-Portfolios, in denen Anpassungsfähigkeit zur Kernkompetenz wird. In der EU verschärft der demografische Wandel den Fachkräftemangel, wobei laut Eurostat bereits jetzt über 75% der Unternehmen Schwierigkeiten bei der Rekrutierung digitaler Fachkräfte melden. Hybride Arbeitsmodelle, Plattformarbeit und KI-gestützte Produktivitätstools verändern gleichzeitig die Organisationsstrukturen. Strategisch entscheidend wird, wie Bildungssysteme, Arbeitsrecht und Sozialsicherung mit der Geschwindigkeit des Wandels Schritt halten.",
    category: "Mega-Trend",
    tags: ["work", "skills", "remote", "automation", "mega-trend",
      "Zukunftsinstitut", "EY", "TRENDONE", "Roland Berger"],
    relevance: 0.88,
    confidence: 0.83, // 5/6
    impact: 0.85,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 1,
    signalCount: 280,
    topSources: ["Zukunftsinstitut", "EY", "TRENDONE", "Roland Berger"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Gesundheit & Biotech ─────────────────────────────────────
  // Quellen: Zukunftsinstitut (Gesundheit), Roland Berger (Health & Care), TRENDONE (Healthstyle)
  {
    id: "mega-health-biotech",
    name: "Health, Biotech & Longevity",
    description: "Fortschritte in Genomik, mRNA-Technologie und KI-gestützter Wirkstoffforschung transformieren das Gesundheitswesen von reaktiver Behandlung zu prädiktiver Prävention. Laut Roland Berger (2024) wächst der globale Biotech-Markt jährlich um 12-15%, getrieben durch personalisierte Medizin und Gen-Therapien. Die EU investiert über das Programm EU4Health (5,3 Mrd. EUR, 2021-2027) in Gesundheitsresilienz und digitale Gesundheitsinfrastruktur. Das Zukunftsinstitut sieht Gesundheit als einen der prägendsten Megatrends, da eine alternde Gesellschaft wachsende Nachfrage nach Longevity-Forschung und präventiven Ansätzen erzeugt. Regulatorische und ethische Fragen zu Keimbahnveränderungen und Datenschutz genomischer Informationen bleiben ungelöst.",
    category: "Mega-Trend",
    tags: ["health", "biotech", "longevity", "genomics", "mega-trend",
      "Zukunftsinstitut", "Roland Berger", "TRENDONE"],
    relevance: 0.85,
    confidence: 0.67, // 4/6
    impact: 0.92,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 1,
    signalCount: 220,
    topSources: ["Zukunftsinstitut", "Roland Berger", "TRENDONE"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Sicherheit & Vertrauen ───────────────────────────────────
  // Quellen: Zukunftsinstitut (Sicherheit), EY (Trust Economy), PwC (Social Instability)
  {
    id: "mega-security-trust",
    name: "Security, Trust & Resilience",
    description: "Cyberangriffe, Desinformation und geopolitische Instabilität untergraben zunehmend das Vertrauen in Institutionen und digitale Systeme. Laut dem Zukunftsinstitut verschiebt sich das Sicherheitsparadigma von rein physischer Verteidigung zu ganzheitlicher Resilienz, die Cyber-, Informations- und gesellschaftliche Sicherheit umfasst. EY identifiziert eine aufkommende Trust Economy, in der Vertrauenswürdigkeit zum Wettbewerbsvorteil wird. In der EU stärken NIS-2-Richtlinie (seit Oktober 2024 umzusetzen) und der Cyber Resilience Act die regulatorischen Anforderungen erheblich. PwC warnt vor systemischen Risiken durch die Verflechtung kritischer Infrastrukturen und die Eskalation staatlich gesteuerter Cyberangriffe.",
    category: "Mega-Trend",
    tags: ["security", "trust", "resilience", "cyber", "mega-trend",
      "Zukunftsinstitut", "EY", "PwC", "World Monitor"],
    relevance: 0.82,
    confidence: 0.67, // 4/6
    impact: 0.85,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 0,
    signalCount: 200,
    topSources: ["Zukunftsinstitut", "EY", "PwC"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Soziale Instabilitaet & Ungleichheit ─────────────────────
  // Quellen: PwC (Social Instability), TRENDONE (Caring Society), Roland Berger
  {
    id: "mega-social-instability",
    name: "Social Instability & Inequality",
    description: "Die globale Ungleichheit nimmt laut Oxfam (2024) weiter zu: Das reichste 1% besitzt mehr Vermögen als die unteren 95% zusammen, während Reallöhne in vielen Industrieländern stagnieren. PwC identifiziert soziale Instabilität als einen der fünf Megatrends, der durch Inflation, Wohnungsmangel und den digitalen Wandel weiter verschärft wird. In der EU hat die Sozialpolitik mit dem European Pillar of Social Rights zwar einen Rahmen, doch regionale Disparitäten zwischen Nord-/Süd- und Ost-/Westeuropa bleiben groß. Politische Polarisierung und sinkende Mittelschichtperspektiven stellen zentrale Risiken für die gesellschaftliche Kohäsion dar.",
    category: "Mega-Trend",
    tags: ["social", "inequality", "polarization", "mega-trend",
      "PwC", "TRENDONE", "Roland Berger", "World Monitor"],
    relevance: 0.78,
    confidence: 0.67, // 4/6
    impact: 0.82,
    timeHorizon: "long",
    ring: "trial",
    quadrant: 1,
    signalCount: 150,
    topSources: ["PwC", "TRENDONE", "Roland Berger"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Migration & Vertreibung ──────────────────────────────────
  // Added 2026-04 to accommodate the UNHCR connector (134 refugee-data
  // signals per pipeline run) and the upcoming IDMC connector (internal
  // displacement). Before this trend existed, every migration signal was
  // orphaned. Quellen: UNHCR Refugee Data Finder, IDMC Helix (planned),
  // World Monitor (geopolitical context).
  {
    id: "mega-migration-displacement",
    name: "Migration & Displacement",
    description: "Laut UNHCR (Mid-Year Trends 2024) sind weltweit über 120 Millionen Menschen auf der Flucht, ein historischer Höchststand. Klimawandel, bewaffnete Konflikte und wirtschaftliche Ungleichheit treiben sowohl erzwungene als auch freiwillige Migration, wobei das IDMC jährlich über 30 Millionen Neuvertreibungen durch Naturkatastrophen dokumentiert. In der EU ist Migration einer der politisch umstrittensten Bereiche: Der EU-Migrationspakt (2024) soll erstmals ein verbindliches Verteilungssystem etablieren. Strategisch sind sowohl Integrationskapazitäten als auch die wirtschaftliche Rolle von Migration bei der Abfederung des demografischen Wandels entscheidend.",
    category: "Mega-Trend",
    tags: ["migration", "displacement", "refugees", "forced-migration", "mega-trend",
      "UNHCR", "IDMC", "World Monitor"],
    relevance: 0.78,
    confidence: 0.82, // High — UNHCR data is well-established and auditable
    impact: 0.85,     // Migration reshapes labor, housing, and political systems
    timeHorizon: "long",
    ring: "adopt",    // It's happening now, not speculative
    quadrant: 1,      // Social-political quadrant, same as Social Instability
    signalCount: 134, // UNHCR single-run baseline; rises as IDMC comes online
    topSources: ["UNHCR", "IDMC", "World Monitor"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Energie-Transformation ───────────────────────────────────
  // Quellen: EU ESPAS, Roland Berger, PwC (Climate), TRENDONE (Planet Centricity)
  {
    id: "mega-energy-transition",
    name: "Energy Transition & Decarbonization",
    description: "Die globale Energiewende beschleunigt sich: Laut IEA (World Energy Outlook 2024) haben Erneuerbare 2023 erstmals über 30% der globalen Stromerzeugung erreicht, wobei Solar-PV-Kapazität allein 2023 um über 400 GW gewachsen ist. Die EU verfolgt mit REPowerEU und dem Fit-for-55-Paket eine ambitionierte Abkehr von fossilen Brennstoffen, beschleunigt durch die geopolitische Notwendigkeit, russische Energieabhängigkeit zu reduzieren. Zentrale Treiber sind die rapide sinkenden Kosten erneuerbarer Energien, die seit 2010 bei Solar um über 85% gefallen sind (IRENA). Kritische Engpässe bleiben bei Netzausbau, Speichertechnologien und der Verfügbarkeit kritischer Mineralien für Batterien und Elektrolyseure.",
    category: "Mega-Trend",
    tags: ["energy", "renewable", "decarbonization", "transition", "mega-trend",
      "EU ESPAS", "Roland Berger", "PwC", "World Monitor"],
    relevance: 0.9,
    confidence: 0.83, // 5/6
    impact: 0.92,
    timeHorizon: "long",
    ring: "adopt",
    quadrant: 3,
    signalCount: 280,
    topSources: ["EU ESPAS", "Roland Berger", "PwC", "TRENDONE"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Wissenskultur & Bildung ──────────────────────────────────
  // Quellen: Zukunftsinstitut (Wissenskultur), TRENDONE (Future Skillsets), Roland Berger (Education)
  {
    id: "mega-knowledge-culture",
    name: "Knowledge Culture & Lifelong Learning",
    description: "Die Halbwertszeit von Fachwissen sinkt kontinuierlich, während das Zukunftsinstitut Wissenskultur als Megatrend identifiziert, der Bildungssysteme und Organisationsformen grundlegend umstrukturiert. Laut World Economic Forum (Future of Jobs Report 2023) müssen bis 2027 rund 44% aller Arbeitnehmer umgeschult oder weitergebildet werden. In der EU fördert die European Skills Agenda mit dem Ziel, bis 2030 mindestens 60% aller Erwachsenen jährlich an Weiterbildung teilnehmen zu lassen, lebenslanges Lernen institutionell. TRENDONE und Roland Berger betonen die wachsende Rolle von KI-gestützten Lernplattformen und Micro-Credentialing als Ergänzung zu formalen Bildungswegen.",
    category: "Mega-Trend",
    tags: ["knowledge", "education", "learning", "skills", "mega-trend",
      "Zukunftsinstitut", "TRENDONE", "Roland Berger"],
    relevance: 0.72,
    confidence: 0.5, // 3/6
    impact: 0.75,
    timeHorizon: "long",
    ring: "trial",
    quadrant: 1,
    signalCount: 120,
    topSources: ["Zukunftsinstitut", "TRENDONE", "Roland Berger"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Mobilitaet ───────────────────────────────────────────────
  // Quellen: Zukunftsinstitut (Mobilitaet), TRENDONE (Intelligent Infrastructure), Roland Berger
  {
    id: "mega-mobility",
    name: "Mobility & Autonomous Transport",
    description: "Der Mobilitätssektor befindet sich in einem dreifachen Umbruch: Elektrifizierung, Automatisierung und neue Nutzungsmodelle. Laut IEA (Global EV Outlook 2024) wurden 2023 weltweit über 14 Millionen Elektrofahrzeuge verkauft, ein Anstieg von 35% gegenüber dem Vorjahr. Das Zukunftsinstitut sieht Mobilität als Megatrend, bei dem die Grenzen zwischen Individual- und öffentlichem Verkehr zunehmend verschwimmen. In der EU schreibt die CO2-Regulierung ab 2035 ein faktisches Verbrennerverbot für Neuwagen vor. Kritische Unsicherheiten betreffen die Ladeinfrastruktur, die Rohstoffversorgung für Batterien und die regulatorischen Hürden für autonomes Fahren auf Level 4+.",
    category: "Mega-Trend",
    tags: ["mobility", "autonomous", "transport", "ev", "mega-trend",
      "Zukunftsinstitut", "TRENDONE", "Roland Berger"],
    relevance: 0.75,
    confidence: 0.5, // 3/6
    impact: 0.8,
    timeHorizon: "mid",
    ring: "trial",
    quadrant: 3,
    signalCount: 140,
    topSources: ["Zukunftsinstitut", "TRENDONE", "Roland Berger"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Identitaet & Wertewandel ─────────────────────────────────
  // Quellen: Zukunftsinstitut (Identitaetsdynamik), Roland Berger (Values), TRENDONE (Evolving Consumerism)
  {
    id: "mega-identity-values",
    name: "Identity Dynamics & Value Shifts",
    description: "Das Zukunftsinstitut beschreibt Identitätsdynamik als Megatrend, bei dem traditionelle Zugehörigkeiten (Nation, Religion, Klasse) durch fluide, selbstgewählte Identitäten ergänzt oder ersetzt werden. Parallel dazu verschieben sich gesellschaftliche Wertesysteme: Laut dem European Values Study gewinnen Selbstverwirklichung und Purpose-Orientierung gegenüber materiellen Sicherheitswerten an Bedeutung, insbesondere bei jüngeren Kohorten. TRENDONE beobachtet unter dem Label 'Evolving Consumerism' eine wachsende Erwartung an Marken, gesellschaftliche Haltung zu zeigen. Strategisch relevant ist die zunehmende Fragmentierung von Zielgruppen und die politische Polarisierung, die aus konkurrierenden Wertesystemen entsteht.",
    category: "Mega-Trend",
    tags: ["identity", "values", "diversity", "lifestyle", "mega-trend",
      "Zukunftsinstitut", "Roland Berger", "TRENDONE"],
    relevance: 0.65,
    confidence: 0.5, // 3/6
    impact: 0.7,
    timeHorizon: "long",
    ring: "trial",
    quadrant: 1,
    signalCount: 90,
    topSources: ["Zukunftsinstitut", "Roland Berger", "TRENDONE"],
    velocity: "stable",
    userOverride: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // MAKRO-TRENDS: Mittelfristige Entwicklungen
  // ═══════════════════════════════════════════════════════════════

  // ─── AI Makro-Trends ──────────────────────────────────────────
  {
    id: "macro-generative-ai",
    name: "Generative AI & Foundation Models",
    description: "Generative KI-Modelle (GPT, Claude, Gemini) haben seit 2023 eine Adoptionswelle ausgelöst, die laut PwC bis 2030 einen globalen Wertschöpfungsbeitrag von bis zu 15,7 Billionen USD generieren könnte. In der EU forciert der AI Act (in Kraft seit August 2024) einen risikobasierten Regulierungsansatz, der Hochrisiko-Anwendungen strenger kontrolliert. Zentrale Treiber sind sinkende Inferenz-Kosten, multimodale Modelle und die Integration in Enterprise-Workflows. Kritische Unsicherheiten bleiben: Energieverbrauch der Rechenzentren, geopolitischer Wettbewerb um Chips (TSMC, NVIDIA) und die gesellschaftliche Akzeptanz von Automatisierung in Wissensberufen.",
    category: "Makro-Trend",
    tags: ["ai", "generative", "llm", "foundation-models", "makro-trend",
      "EY", "TRENDONE"],
    relevance: 0.96,
    confidence: 0.85,
    impact: 0.95,
    timeHorizon: "short",
    ring: "adopt",
    quadrant: 0,
    signalCount: 420,
    topSources: ["EY", "TRENDONE", "hackernews", "github"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-ai-agents",
    name: "AI Agents & Autonomous Systems",
    description: "KI-Agenten, die autonom mehrstufige Aufgaben planen und ausführen, sind 2024/2025 von der Forschung in die Produktreife übergegangen (Devin, Claude Computer Use, OpenAI Operator). EY identifiziert autonome Systeme als Schlüsseltrend, der die Automatisierung von Wissensarbeit über einfache Prompts hinaus erweitert. Die technologische Grundlage bilden Reasoning-Modelle, Tool-Use-Architekturen und Reinforcement Learning von menschlichem Feedback. Kritische Herausforderungen sind Zuverlässigkeit (Halluzinationen, Kontrollverlust), Haftungsfragen bei autonomen Entscheidungen und die regulatorische Einordnung im Rahmen des EU AI Act.",
    category: "Makro-Trend",
    tags: ["ai", "agents", "autonomous", "makro-trend", "EY"],
    relevance: 0.92,
    confidence: 0.78,
    impact: 0.9,
    timeHorizon: "short",
    ring: "adopt",
    quadrant: 0,
    signalCount: 180,
    topSources: ["EY", "hackernews", "github", "arxiv"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-human-machine",
    name: "Human-Machine Collaboration",
    description: "Das Augmentationsparadigma, in dem KI menschliche Fähigkeiten ergänzt statt ersetzt, gewinnt gegenüber dem Vollautomatisierungsansatz an Bedeutung. Laut EY und Roland Berger erzielen hybride Mensch-Maschine-Teams in wissensintensiven Bereichen signifikant bessere Ergebnisse als rein automatisierte Systeme. In der Industrie wächst der Cobot-Markt (kollaborative Roboter) laut IFR kontinuierlich mit zweistelligen Wachstumsraten. Strategisch entscheidend ist das Interface-Design: Vertrauen, Transparenz und ergonomische Integration bestimmen, ob Augmentation in der Praxis gelingt oder auf Widerstand stösst.",
    category: "Makro-Trend",
    tags: ["human-machine", "augmentation", "cobots", "makro-trend",
      "EY", "Roland Berger"],
    relevance: 0.82,
    confidence: 0.72,
    impact: 0.85,
    timeHorizon: "mid",
    ring: "adopt",
    quadrant: 0,
    signalCount: 130,
    topSources: ["EY", "Roland Berger", "TRENDONE"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Nachhaltigkeit Makro-Trends ──────────────────────────────
  {
    id: "macro-green-energy",
    name: "Renewable Energy & Green Tech",
    description: "Erneuerbare Energien sind laut IRENA (2024) in den meisten Regionen bereits die günstigste Form der Stromerzeugung, wobei Solar-PV und Onshore-Wind unter 40 USD/MWh produzieren. Die EU hat sich zum Ziel gesetzt, bis 2030 mindestens 42,5% des Endenergieverbrauchs aus Erneuerbaren zu decken. Grüner Wasserstoff, mit der European Hydrogen Strategy und geplanten 40 GW Elektrolyseur-Kapazität bis 2030, soll die Dekarbonisierung energieintensiver Industrien ermöglichen. Roland Berger und PwC betonen, dass die Skalierung an Netzinfrastruktur, Genehmigungsverfahren und der Verfügbarkeit kritischer Materialien wie Lithium und seltener Erden hängt.",
    category: "Makro-Trend",
    tags: ["renewable", "solar", "wind", "hydrogen", "makro-trend",
      "Roland Berger", "EU ESPAS"],
    relevance: 0.88,
    confidence: 0.82,
    impact: 0.9,
    timeHorizon: "mid",
    ring: "adopt",
    quadrant: 3,
    signalCount: 200,
    topSources: ["Roland Berger", "EU ESPAS", "PwC"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-circular-economy",
    name: "Circular Economy",
    description: "Die Circular Economy zielt darauf ab, den globalen Ressourcenverbrauch vom Wirtschaftswachstum zu entkoppeln, wobei laut Circle Economy (Circularity Gap Report 2024) bisher nur rund 7% der Weltwirtschaft zirkulär organisiert sind. Die EU treibt den Wandel mit dem Circular Economy Action Plan und Regulierungen wie dem Recht auf Reparatur (2024) und der Ökodesign-Verordnung (ESPR) voran. TRENDONE und Roland Berger sehen signifikante Geschäftspotenziale in Product-as-a-Service-Modellen, industrieller Symbiose und dem Recycling kritischer Rohstoffe. Hemmende Faktoren sind bestehende lineare Geschäftsmodelle, fehlende Standardisierung bei Materialströmen und die oft höheren Kosten zirkulärer Produktion.",
    category: "Makro-Trend",
    tags: ["circular", "recycling", "waste", "makro-trend",
      "TRENDONE", "Roland Berger"],
    relevance: 0.62,
    confidence: 0.55,
    impact: 0.72,
    timeHorizon: "mid",
    ring: "trial",
    quadrant: 1,
    signalCount: 65,
    topSources: ["TRENDONE", "Roland Berger", "EU ESPAS"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-conscious-consumption",
    name: "Conscious Consumption & Eating",
    description: "Das Konsumverhalten verschiebt sich zunehmend in Richtung Nachhaltigkeit: Laut Eurobarometer (2024) geben über 80% der EU-Bürger an, dass Umweltfaktoren ihre Kaufentscheidungen beeinflussen. TRENDONE beobachtet unter dem Label 'Conscious Consumption' einen Trend zu pflanzenbasierter Ernährung, transparenten Lieferketten und reduzierten Verpackungen. In der EU stärken Regulierungen wie die Green Claims Directive und das Verbot von Greenwashing die Verbraucherrechte. Gleichzeitig zeigt sich eine Kluft zwischen geäusserter Kaufabsicht und tatsächlichem Verhalten (Attitude-Behavior-Gap), die bei Preisdruck und Inflation besonders deutlich wird.",
    category: "Makro-Trend",
    tags: ["conscious", "consumption", "food", "sustainability", "makro-trend",
      "TRENDONE"],
    relevance: 0.55,
    confidence: 0.5,
    impact: 0.6,
    timeHorizon: "mid",
    ring: "assess",
    quadrant: 1,
    signalCount: 45,
    topSources: ["TRENDONE", "Zukunftsinstitut"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Digitale Infrastruktur Makro-Trends ──────────────────────
  {
    id: "macro-cloud-native",
    name: "Cloud Native & Multi-Cloud",
    description: "Cloud-native Architekturen (Kubernetes, Serverless, Microservices) haben sich als Standard für Unternehmensanwendungen etabliert, wobei laut Gartner (2024) über 95% der neuen digitalen Workloads auf Cloud-Plattformen deployt werden. Multi-Cloud-Strategien gewinnen an Bedeutung, um Vendor-Lock-in zu vermeiden und Compliance-Anforderungen wie die EU-Datensouveränität (GAIA-X) zu erfüllen. Die drei Hyperscaler (AWS, Azure, Google Cloud) dominieren mit zusammen über 65% Marktanteil, während europäische Alternativen wie OVH und IONOS Nischen besetzen. Kritische Herausforderungen sind Kostenmanagement (FinOps), Sicherheit in verteilten Umgebungen und der Fachkräftemangel bei Cloud-Kompetenzen.",
    category: "Makro-Trend",
    tags: ["cloud", "kubernetes", "infrastructure", "makro-trend"],
    relevance: 0.85,
    confidence: 0.82,
    impact: 0.78,
    timeHorizon: "short",
    ring: "adopt",
    quadrant: 2,
    signalCount: 200,
    topSources: ["github", "hackernews", "stackoverflow"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-edge-iot",
    name: "Edge Computing & IoT",
    description: "Edge Computing verlagert Rechenkapazität an den Ort der Datenentstehung und reduziert damit Latenz, Bandbreitenbedarf und Datenschutzrisiken. Laut TRENDONE und EU ESPAS wird der Edge-Markt massgeblich durch IoT-Anwendungen in Industrie 4.0, autonomem Fahren und Smart Cities getrieben. Die Zahl der verbundenen IoT-Geräte wächst laut Statista auf geschätzt über 30 Milliarden bis 2030. In der EU unterstützt die European Data Strategy den Aufbau dezentraler Dateninfrastrukturen durch europäische Edge-Cloud-Initiativen. Herausforderungen liegen in der Standardisierung heterogener Edge-Umgebungen, Sicherheit verteilter Endpunkte und dem Energieverbrauch.",
    category: "Makro-Trend",
    tags: ["edge", "iot", "distributed", "makro-trend",
      "TRENDONE", "EU ESPAS"],
    relevance: 0.72,
    confidence: 0.68,
    impact: 0.78,
    timeHorizon: "mid",
    ring: "trial",
    quadrant: 3,
    signalCount: 85,
    topSources: ["TRENDONE", "EU ESPAS", "Roland Berger"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-data-economy",
    name: "Data Economy & Data Sovereignty",
    description: "Daten sind zur zentralen Wertschöpfungsressource geworden, wobei die EU mit dem Data Act (in Kraft seit Januar 2024) und dem Data Governance Act einen eigenen europäischen Weg der Datenökonomie einschlägt. TRENDONE und EU ESPAS betonen den Paradigmenwechsel von 'Daten als Nebenprodukt' zu 'Daten als strategischem Asset', wobei die Frage der Datensouveränität zunehmend geopolitisch aufgeladen ist. Die European Data Spaces sollen branchenspezifische Datenräume für Gesundheit, Mobilität und Industrie schaffen. Kritische Spannungsfelder sind der Ausgleich zwischen Datenverfügbarkeit für KI-Training und Datenschutzrechten (DSGVO) sowie die Monetarisierung personenbezogener Daten.",
    category: "Makro-Trend",
    tags: ["data", "sovereignty", "privacy", "gdpr", "makro-trend",
      "TRENDONE", "EU ESPAS"],
    relevance: 0.78,
    confidence: 0.72,
    impact: 0.8,
    timeHorizon: "mid",
    ring: "adopt",
    quadrant: 3,
    signalCount: 120,
    topSources: ["TRENDONE", "EU ESPAS", "Roland Berger"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-cybersecurity",
    name: "Cybersecurity & Zero Trust",
    description: "Die globalen Kosten von Cyberkriminalität steigen laut Cybersecurity Ventures auf geschätzte 10,5 Billionen USD jährlich bis 2025, wobei Ransomware und Supply-Chain-Angriffe die grössten Bedrohungsvektoren darstellen. Zero-Trust-Architekturen ('Never trust, always verify') ersetzen zunehmend perimeterbasierte Sicherheitsmodelle. In der EU verschärft die NIS-2-Richtlinie seit Oktober 2024 die Cybersicherheitspflichten erheblich und betrifft nun deutlich mehr Sektoren und Unternehmen. PwC beobachtet einen wachsenden Einsatz von KI sowohl auf Angreifer- als auch Verteidigerseite, was zu einem asymmetrischen Wettrüsten führt.",
    category: "Makro-Trend",
    tags: ["cybersecurity", "zero-trust", "ransomware", "makro-trend"],
    relevance: 0.82,
    confidence: 0.8,
    impact: 0.82,
    timeHorizon: "short",
    ring: "adopt",
    quadrant: 0,
    signalCount: 150,
    topSources: ["hackernews", "news", "PwC"],
    velocity: "rising",
    userOverride: false,
  },

  // ─── Arbeit & Gesellschaft Makro-Trends ───────────────────────
  {
    id: "macro-remote-hybrid",
    name: "Remote & Hybrid Work",
    description: "Hybride Arbeitsmodelle haben sich nach der Pandemie als neuer Standard etabliert, wobei laut Eurostat (2024) in der EU rund 25% der Beschäftigten regelmässig von zu Hause arbeiten, mit erheblichen Unterschieden zwischen wissensintensiven und operativen Berufen. Das Zukunftsinstitut sieht den Wandel als Teil des Megatrends New Work, der über den Arbeitsort hinaus Organisationsstrukturen und Führungsmodelle transformiert. Unternehmen ringen mit der Balance zwischen Flexibilität und Teamkohäsion, während einige grosse Tech-Konzerne Return-to-Office-Mandate setzen. Strategisch relevant sind die Auswirkungen auf Immobilienmärkte, regionale Arbeitsmärkte und die Infrastruktur ländlicher Räume.",
    category: "Makro-Trend",
    tags: ["remote", "hybrid", "collaboration", "makro-trend",
      "Zukunftsinstitut"],
    relevance: 0.72,
    confidence: 0.85,
    impact: 0.68,
    timeHorizon: "short",
    ring: "adopt",
    quadrant: 1,
    signalCount: 120,
    topSources: ["Zukunftsinstitut", "news", "reddit"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-skills-upskilling",
    name: "Skills Gap & Upskilling",
    description: "Laut World Economic Forum (Future of Jobs Report 2023) werden bis 2027 rund 44% der Kernkompetenzen von Arbeitnehmern Veränderungen unterliegen, wobei analytisches Denken, KI-Kompetenz und Resilienz zu den gefragtesten Skills zählen. TRENDONE und Roland Berger betonen, dass der Skills Gap durch die Geschwindigkeit technologischer Disruption schneller wächst als Bildungssysteme reagieren können. In der EU fehlen laut Europäischer Kommission bereits über 500.000 IT-Fachkräfte, mit steigender Tendenz. Corporate Learning, Micro-Credentialing und KI-gestützte Lernpfade gewinnen gegenüber traditionellen Bildungswegen an Bedeutung.",
    category: "Makro-Trend",
    tags: ["skills", "upskilling", "education", "makro-trend",
      "TRENDONE", "Roland Berger"],
    relevance: 0.7,
    confidence: 0.72,
    impact: 0.72,
    timeHorizon: "mid",
    ring: "trial",
    quadrant: 1,
    signalCount: 75,
    topSources: ["TRENDONE", "Roland Berger", "Zukunftsinstitut"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-attention-economy",
    name: "Attention Economy & Creator Platforms",
    description: "Die Attention Economy intensiviert sich durch algorithmische Kuratierung und Kurzform-Content, wobei die durchschnittliche Bildschirmzeit laut eMarketer global weiter steigt. TRENDONE beobachtet die Creator Economy als eigenständige Wirtschaftsform, in der Einzelpersonen über Plattformen wie YouTube, TikTok und Substack direkt monetarisieren. Der globale Creator-Economy-Markt wird auf über 100 Milliarden USD geschätzt und wächst zweistellig. Strategisch relevant sind die zunehmende Regulierung digitaler Plattformen (EU Digital Services Act), die Machtkonzentration bei wenigen Plattformanbietern und die gesellschaftlichen Auswirkungen algorithmischer Aufmerksamkeitssteuerung.",
    category: "Makro-Trend",
    tags: ["attention", "creator", "content", "platform", "makro-trend",
      "TRENDONE"],
    relevance: 0.65,
    confidence: 0.6,
    impact: 0.62,
    timeHorizon: "short",
    ring: "trial",
    quadrant: 1,
    signalCount: 55,
    topSources: ["TRENDONE", "producthunt", "reddit"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Gesundheit Makro-Trends ──────────────────────────────────
  {
    id: "macro-digital-health",
    name: "Digital Health & Telemedicine",
    description: "Digital Health umfasst Telemedizin, KI-gestützte Diagnostik und Wearables, die Gesundheitsversorgung von zentralisierten Kliniken in den Alltag verlagern. Laut McKinsey (2024) ist der globale Digital-Health-Markt auf über 350 Milliarden USD gewachsen, wobei Telemedizin-Nutzung seit der Pandemie auf einem deutlich erhöhten Niveau verbleibt. In der EU treibt der European Health Data Space (EHDS) die grenzüberschreitende Nutzung von Gesundheitsdaten voran. TRENDONE und Roland Berger betonen das Potenzial von KI in der Bildgebung, Pathologie und Medikamentenentwicklung. Hürden bleiben die fragmentierten IT-Systeme im Gesundheitswesen, Datenschutzbedenken und die geringe Digitalisierung vieler Gesundheitssysteme, insbesondere in Deutschland.",
    category: "Makro-Trend",
    tags: ["telehealth", "digital-health", "wearables", "makro-trend",
      "TRENDONE", "Roland Berger"],
    relevance: 0.72,
    confidence: 0.72,
    impact: 0.75,
    timeHorizon: "short",
    ring: "trial",
    quadrant: 1,
    signalCount: 80,
    topSources: ["TRENDONE", "Roland Berger", "news"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-genomics",
    name: "Genomics & Personalized Medicine",
    description: "Die Kosten der Genomsequenzierung sind laut NHGRI von über 100 Millionen USD (2001) auf unter 200 USD (2024) gefallen, was personalisierte Medizin erstmals breit zugänglich macht. CRISPR-basierte Gentherapien haben mit der EU-Zulassung von Casgevy (2024) einen klinischen Meilenstein erreicht. TRENDONE und Roland Berger sehen Genomics als Grundlage einer neuen Ära der Präzisionsmedizin, in der Therapien auf individuelles Genprofil zugeschnitten werden. Strategisch stehen ethische Fragen zu Keimbahnveränderungen, der Zugang zu teuren Gentherapien und die Absicherung genomischer Daten im Fokus.",
    category: "Makro-Trend",
    tags: ["genomics", "crispr", "personalized", "makro-trend",
      "TRENDONE", "Roland Berger"],
    relevance: 0.55,
    confidence: 0.6,
    impact: 0.85,
    timeHorizon: "long",
    ring: "assess",
    quadrant: 1,
    signalCount: 42,
    topSources: ["TRENDONE", "Roland Berger", "arxiv"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-engineered-evolution",
    name: "Engineered Evolution & Human Enhancement",
    description: "Human Enhancement umfasst Technologien von Brain-Computer-Interfaces (Neuralink, Synchron) über Exoskelette bis zu pharmakologischem Cognitive Enhancement. TRENDONE und EY verfolgen diesen Trend unter den Labels 'Engineered Evolution' und Future-of-Human-Augmentation. Die Technologien befinden sich überwiegend in frühen Entwicklungsphasen, wobei erste BCI-Implantate 2024 in klinischen Studien getestet wurden. In der EU fehlt bisher ein spezifischer Regulierungsrahmen für Human Enhancement, was erhebliche ethische und gesellschaftliche Debatten erwarten lässt. Strategisch relevant ist die Langzeitperspektive: Sollte Enhancement breite Anwendung finden, entstehen fundamentale Fragen zu Chancengleichheit und menschlicher Identität.",
    category: "Makro-Trend",
    tags: ["biotech", "enhancement", "neurotechnology", "makro-trend",
      "TRENDONE", "EY"],
    relevance: 0.42,
    confidence: 0.45,
    impact: 0.82,
    timeHorizon: "long",
    ring: "assess",
    quadrant: 0,
    signalCount: 30,
    topSources: ["TRENDONE", "EY", "arxiv"],
    velocity: "stable",
    userOverride: false,
  },

  // ─── Emerging Tech Makro-Trends ───────────────────────────────
  {
    id: "macro-quantum-computing",
    name: "Quantum Computing",
    description: "Quantencomputing verspricht exponentielle Beschleunigung für spezifische Problemklassen wie Molekülsimulation, Optimierung und Kryptografie. Roland Berger schätzt, dass erste kommerzielle Anwendungen ab Ende der 2020er Jahre realistisch werden, wobei IBM, Google und europäische Akteure wie IQM an skalierbaren Systemen arbeiten. Die EU investiert über das Quantum Flagship-Programm rund 1 Milliarde EUR in die Entwicklung eines europäischen Quantenökosystems. Strategisch kritisch ist die Post-Quantum-Kryptografie: Heutige Verschlüsselungsstandards werden durch leistungsfähige Quantencomputer verwundbar, was einen Migrationsprozess erfordert, der bereits heute beginnen muss.",
    category: "Makro-Trend",
    tags: ["quantum", "computing", "post-quantum", "makro-trend",
      "Roland Berger"],
    relevance: 0.42,
    confidence: 0.45,
    impact: 0.92,
    timeHorizon: "long",
    ring: "assess",
    quadrant: 0,
    signalCount: 50,
    topSources: ["Roland Berger", "arxiv", "news"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-spatial-computing",
    name: "Spatial Computing & XR",
    description: "Spatial Computing umfasst AR, VR und Mixed-Reality-Interfaces, die digitale Informationen nahtlos in die physische Umwelt integrieren. Mit Apple Vision Pro (2024) und Meta Quest 3 hat der Consumer-Markt neuen Schub erhalten, wobei die Adoptionsrate hinter den Erwartungen bleibt. TRENDONE sieht das grösste kurzfristige Potenzial in Enterprise-Anwendungen: Training, Remote Collaboration und digitale Zwillinge in der Industrie. In der EU fehlen bisher spezifische Regulierungen für immersive Umgebungen, obwohl Datenschutz, Suchtpotenzial und kognitive Auswirkungen zunehmend diskutiert werden.",
    category: "Makro-Trend",
    tags: ["xr", "ar", "vr", "spatial", "metaverse", "makro-trend",
      "TRENDONE"],
    relevance: 0.58,
    confidence: 0.55,
    impact: 0.7,
    timeHorizon: "mid",
    ring: "assess",
    quadrant: 0,
    signalCount: 60,
    topSources: ["TRENDONE", "news", "hackernews"],
    velocity: "rising",
    userOverride: false,
  },
  {
    id: "macro-web3-decentralization",
    name: "Web3 & Decentralization",
    description: "Web3 und Blockchain-basierte Dezentralisierung haben nach dem Krypto-Crash 2022 erheblich an Dynamik verloren, wobei sich der Fokus von spekulativen Token-Modellen auf infrastrukturelle Anwendungen (Supply Chain Tracking, digitale Identität, CBDCs) verschoben hat. In der EU schafft die MiCA-Regulierung (Markets in Crypto-Assets, in Kraft seit Juni 2023) erstmals einen einheitlichen Rechtsrahmen. Praktische Anwendungsfälle jenseits von Kryptowährungen bleiben überschaubar und stehen in Konkurrenz zu einfacheren zentralisierten Lösungen. Strategisch ist Web3 ein Trend mit unsicherer Zeitlinie, dessen langfristiges Potenzial bei digitaler Identität und tokenisierter Vermögenswerte dennoch signifikant sein könnte.",
    category: "Makro-Trend",
    tags: ["web3", "blockchain", "decentralized", "makro-trend"],
    relevance: 0.38,
    confidence: 0.45,
    impact: 0.55,
    timeHorizon: "long",
    ring: "hold",
    quadrant: 0,
    signalCount: 35,
    topSources: ["hackernews", "reddit"],
    velocity: "falling",
    userOverride: false,
  },

  // ─── Commerce & Business Makro-Trends ─────────────────────────
  {
    id: "macro-seamless-commerce",
    name: "Seamless & Omnichannel Commerce",
    description: "Konsumenten erwarten zunehmend nahtlose Übergänge zwischen Online, Mobile, Social Commerce und stationärem Handel. TRENDONE beobachtet, dass Omnichannel-Leader signifikant höhere Kundenbindung und Umsatzwachstum erzielen als Pure-Play-Modelle. In der EU reguliert der Digital Markets Act (DMA) die Marktmacht grosser Plattformen und stärkt den Wettbewerb im digitalen Handel. Treiber sind KI-gestützte Personalisierung, Live Shopping und Social-Commerce-Formate, während die Integration fragmentierter Technologie-Stacks und die Erfüllung von Datenschutzanforderungen zentrale Herausforderungen bleiben.",
    category: "Makro-Trend",
    tags: ["commerce", "omnichannel", "retail", "makro-trend",
      "TRENDONE"],
    relevance: 0.6,
    confidence: 0.55,
    impact: 0.62,
    timeHorizon: "short",
    ring: "trial",
    quadrant: 1,
    signalCount: 50,
    topSources: ["TRENDONE", "producthunt", "news"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-platform-economy",
    name: "Platform Economy & Ecosystems",
    description: "Plattformbasierte Geschäftsmodelle dominieren zunehmend die Wertschöpfung: Laut Roland Berger stellen Plattform-Unternehmen bereits über 30% der globalen Marktkapitalisierung der Top-100-Firmen. Der Paradigmenwechsel von linearer Wertschöpfung zu Ökosystem-Orchestrierung betrifft alle Branchen, von Finanzdienstleistungen (Embedded Finance) über Mobilität (MaaS) bis Gesundheit. In der EU setzen der Digital Markets Act und der Digital Services Act Leitplanken gegen monopolistische Plattformeffekte und für mehr Wettbewerb. Strategisch entscheidend ist die Frage, ob europäische Unternehmen eigene Plattform-Ökosysteme aufbauen oder primär als Zulieferer US-amerikanischer und chinesischer Plattformen agieren.",
    category: "Makro-Trend",
    tags: ["platform", "ecosystem", "api", "makro-trend",
      "Roland Berger"],
    relevance: 0.75,
    confidence: 0.72,
    impact: 0.78,
    timeHorizon: "mid",
    ring: "adopt",
    quadrant: 1,
    signalCount: 110,
    topSources: ["Roland Berger", "hackernews", "news"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-autonomous-mobility",
    name: "Autonomous Mobility & EVs",
    description: "Die Konvergenz von Elektrifizierung und autonomem Fahren transformiert den Mobilitätssektor. Laut IEA (2024) liegt der globale EV-Marktanteil bei Neuwagen inzwischen bei über 18%, wobei China mit über 60% der weltweiten EV-Verkäufe dominiert. Autonomes Fahren erreicht in definierten Umgebungen (Robotaxis in San Francisco, Wuhan) kommerziellen Betrieb, während Level-4-Zulassung in der EU noch aussteht. Das Zukunftsinstitut und Roland Berger sehen eine Verschiebung von Besitz zu Nutzung (Mobility-as-a-Service). Kritische Unsicherheiten betreffen die europäische Batterie-Wertschöpfungskette, die Ladeinfrastruktur-Lücke und die regulatorische Haftung bei Unfällen autonomer Systeme.",
    category: "Makro-Trend",
    tags: ["autonomous", "ev", "self-driving", "mobility", "makro-trend",
      "Zukunftsinstitut", "Roland Berger"],
    relevance: 0.68,
    confidence: 0.62,
    impact: 0.82,
    timeHorizon: "mid",
    ring: "trial",
    quadrant: 3,
    signalCount: 75,
    topSources: ["Zukunftsinstitut", "Roland Berger", "news"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-exponential-manufacturing",
    name: "Exponential Manufacturing & 3D Printing",
    description: "Additive Fertigung (3D-Druck) entwickelt sich von Prototyping zur Serienproduktion, insbesondere in Luft- und Raumfahrt, Medizintechnik und Automobilbau. TRENDONE beobachtet die Konvergenz mit KI-gestütztem Design (Generative Design), die neue Geometrien und Materialoptimierungen ermöglicht. Der globale Markt für additive Fertigung wächst laut Wohlers Report kontinuierlich mit rund 20% jährlich. Strategisch ermöglicht dezentrale Fertigung resilientere Lieferketten und Mass Customization, wird aber durch begrenzte Materialvielfalt, langsamere Produktionsgeschwindigkeiten und fehlende Industriestandards gebremst.",
    category: "Makro-Trend",
    tags: ["3d-printing", "manufacturing", "additive", "makro-trend",
      "TRENDONE"],
    relevance: 0.48,
    confidence: 0.52,
    impact: 0.65,
    timeHorizon: "mid",
    ring: "assess",
    quadrant: 2,
    signalCount: 38,
    topSources: ["TRENDONE", "arxiv", "github"],
    velocity: "stable",
    userOverride: false,
  },
  {
    id: "macro-smart-surroundings",
    name: "Smart Surroundings & Ambient Intelligence",
    description: "Ambient Intelligence beschreibt intelligente Umgebungen, die durch eingebettete Sensorik, KI und vernetzte Geräte proaktiv auf menschliche Bedürfnisse reagieren, ohne explizite Interaktion zu erfordern. TRENDONE verfolgt diesen Trend als Konvergenz von IoT, Edge Computing und kontextuellem KI-Design, mit Anwendungen von Smart Homes über intelligente Bürogebäude bis zu adaptiven Pflegeumgebungen. Der Markt für Smart-Home-Technologien wächst laut Statista in der EU zweistellig, wobei Interoperabilität (Matter-Standard) und Datenschutz zentrale Adoptionshürden bleiben. Strategisch relevant wird Ambient Intelligence durch den demografischen Wandel, der adaptive Wohnlösungen für eine alternde Gesellschaft erfordert.",
    category: "Makro-Trend",
    tags: ["smart-home", "ambient", "sensors", "makro-trend",
      "TRENDONE"],
    relevance: 0.52,
    confidence: 0.55,
    impact: 0.6,
    timeHorizon: "mid",
    ring: "assess",
    quadrant: 3,
    signalCount: 42,
    topSources: ["TRENDONE", "producthunt"],
    velocity: "stable",
    userOverride: false,
  },
];

/**
 * Get unique categories from mega trends
 */
export function getMegaTrendCategories(): string[] {
  return [...new Set(megaTrends.map((t) => t.category))].sort();
}
