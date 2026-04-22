/**
 * Framework Types — Shared types for all 6 SIS analysis frameworks.
 */

export type FrameworkId =
  | "marktanalyse"
  | "war-gaming"
  | "pre-mortem"
  | "post-mortem"
  | "trend-deep-dive"
  | "stakeholder"
  | "design-thinking"
  | "pre-frage";

export interface FrameworkMeta {
  id: FrameworkId;
  slug: string;
  icon: string;
  iconSvg: string;
  name: { de: string; en: string };
  subtitle: { de: string; en: string };
  color: { card: string; icon: string; border: string; accent: string };
  llmIntensity: "low" | "medium" | "high" | "very-high";
  timeHorizon: { de: string; en: string };
}

export const FRAMEWORK_META: FrameworkMeta[] = [
  {
    id: "marktanalyse", slug: "marktanalyse",
    icon: "◈", iconSvg: "/icons/methoden/marktanalyse/marktanalyse-layout-grid.svg",
    name: { de: "Marktanalyse", en: "Market Analysis" },
    subtitle: { de: "Marktposition · Wettbewerbsdynamik", en: "Market Position · Competitive Dynamics" },
    color: { card: "#EEF5FF", icon: "#D4E8FF", border: "#C0D8F4", accent: "#1A4A8A" },
    llmIntensity: "medium", timeHorizon: { de: "Gegenwart + 1–5 Jahre", en: "Present + 1–5 years" },
  },
  {
    id: "war-gaming", slug: "war-gaming",
    icon: "⚔", iconSvg: "/icons/methoden/war-gaming/war-gaming-swords.svg",
    name: { de: "War-Gaming", en: "War Gaming" },
    subtitle: { de: "Gegnermodelle · Strategische Reaktion", en: "Opponent Models · Strategic Response" },
    color: { card: "#FFF0F4", icon: "#FFD6E0", border: "#F4B8C8", accent: "#A0244A" },
    llmIntensity: "high", timeHorizon: { de: "Kurzfristig (0–12 Monate)", en: "Short-term (0–12 months)" },
  },
  {
    id: "pre-mortem", slug: "pre-mortem",
    icon: "⚠", iconSvg: "/icons/methoden/pre-mortem/pre-mortem-triangle-alert.svg",
    name: { de: "Pre-Mortem", en: "Pre-Mortem" },
    subtitle: { de: "Risiken · Proaktive Risikoanalyse", en: "Risks · Proactive Risk Analysis" },
    color: { card: "#FFF8F0", icon: "#FFECD2", border: "#F0D4A8", accent: "#955A20" },
    llmIntensity: "high", timeHorizon: { de: "Zukunft (proaktiv)", en: "Future (proactive)" },
  },
  {
    id: "post-mortem", slug: "post-mortem",
    icon: "🔍", iconSvg: "/icons/methoden/post-mortem/post-mortem-search.svg",
    name: { de: "Post-Mortem", en: "Post-Mortem" },
    subtitle: { de: "Ursachen · Systematische Lernschleifen", en: "Root Causes · Systematic Learning" },
    color: { card: "#EEFAF4", icon: "#C3F4D3", border: "#90DCA8", accent: "#0F6038" },
    llmIntensity: "medium", timeHorizon: { de: "Vergangenheit (reaktiv)", en: "Past (reactive)" },
  },
  {
    id: "trend-deep-dive", slug: "trend-deep-dive",
    icon: "🔬", iconSvg: "/icons/methoden/trend-deep-dive/trend-deep-dive-microscope.svg",
    name: { de: "Trend Deep-Dive", en: "Trend Deep-Dive" },
    subtitle: { de: "Treiber · Systemische Trendanalyse", en: "Drivers · Systemic Trend Analysis" },
    color: { card: "#FBF0FF", icon: "#F0D4FF", border: "#D8A8F0", accent: "#7C1A9E" },
    llmIntensity: "very-high", timeHorizon: { de: "Alle Horizonte", en: "All horizons" },
  },
  {
    id: "stakeholder", slug: "stakeholder",
    icon: "👥", iconSvg: "/icons/methoden/stakeholder/stakeholder-users-round.svg",
    name: { de: "Stakeholder", en: "Stakeholder" },
    subtitle: { de: "Akteure · Koalitionen · Dynamiken", en: "Actors · Coalitions · Dynamics" },
    color: { card: "#FFFDE8", icon: "#FFF5BA", border: "#E8D870", accent: "#7A5C00" },
    llmIntensity: "medium", timeHorizon: { de: "Gegenwart + Entwicklung", en: "Present + Evolution" },
  },
  {
    // 2026-04-22 (Backlog: „Design Thinking / weitere Analyse-Methoden"):
    // Human-centered strategic design — vier Schritte von Stakeholder-
    // Empathie über Problem-Reframing und Solution-Divergenz bis zum
    // konkreten Validierungsplan. Kein klassisches 5-Phasen-DT (Empathize/
    // Define/Ideate/Prototype/Test), sondern auf strategische Fragen
    // zugeschnitten: „Prototype" verschwindet, „Validate" übernimmt die
    // letzte Phase und tritt als konkreter Test-Plan an.
    id: "design-thinking", slug: "design-thinking",
    icon: "🧭", iconSvg: "/icons/methoden/stakeholder/stakeholder-users-round.svg",
    name: { de: "Design Thinking", en: "Design Thinking" },
    subtitle: { de: "Empathie · Reframing · Lösungsraum · Validierung", en: "Empathy · Reframing · Solution Space · Validation" },
    color: { card: "#FFF4E6", icon: "#FFE1C1", border: "#F0C088", accent: "#B45309" },
    llmIntensity: "high", timeHorizon: { de: "Gegenwart + 6–18 Monate", en: "Present + 6–18 months" },
  },
  {
    // 2026-04-23 (Konzept-Diskussion mit Founder, Abend):
    // Während alle anderen Frameworks ANTWORTEN auf Fragen liefern,
    // identifiziert "Pre-Frage" die richtigen FRAGEN — bevor irgendeine
    // Antwort-Suche beginnt. Inspiration: Hal Gregersen (MIT, Question
    // Burst), Charlie Munger (Inversion), Phil Tetlock (Decomposition),
    // Edgar Schein (Humble Inquiry), Toyota 5 Whys.
    //
    // Vier Schritte:
    //  1. Reframing — welche Frage steckt hinter der Frage?
    //  2. Decomposition + STEEP+V Lenses — strukturierte Sub-Fragen
    //  3. Inversion + Provokation — was wäre unbequem zu fragen?
    //  4. Kritische Fragen + Daten-Gap + Framework-Anschluss
    //
    // Output: KEINE Antworten, sondern eine Hierarchie von Fragen mit
    // Annahmen-Liste, Daten-Gaps und Framework-Empfehlungen.
    //
    // Symmetrie zur Iteration-Loop-Architektur (e7f9699): Pass 2 ist
    // Self-Critique auf der OUTPUT-Seite, Pre-Frage ist Self-Critique
    // auf der INPUT-Seite. Beide zusammen ergeben einen vollständigen
    // Reflection-Loop.
    id: "pre-frage", slug: "pre-frage",
    icon: "❓", iconSvg: "/icons/methoden/stakeholder/stakeholder-users-round.svg",
    name: { de: "Pre-Frage", en: "Pre-Question" },
    subtitle: { de: "Reframing · Lenses · Inversion · Critical Questions", en: "Reframing · Lenses · Inversion · Critical Questions" },
    color: { card: "#F4EEFF", icon: "#E0D0FF", border: "#C0A8F0", accent: "#5A2A9E" },
    llmIntensity: "medium", timeHorizon: { de: "Vor jeder Analyse", en: "Before any analysis" },
  },
];

export function getFrameworkMeta(id: FrameworkId): FrameworkMeta {
  return FRAMEWORK_META.find(f => f.id === id)!;
}

/** A single step in a framework analysis */
export interface FrameworkStep {
  id: string;
  title: { de: string; en: string };
  description: { de: string; en: string };
  status: "pending" | "running" | "done" | "error";
  result?: FrameworkStepResult;
}

export interface FrameworkStepResult {
  synthesis: string;
  structured?: Record<string, unknown>;
  confidence: number;
}

/** Analysis session state */
export interface FrameworkSession {
  id: string;
  frameworkId: FrameworkId;
  topic: string;
  context?: string;
  steps: FrameworkStep[];
  createdAt: number;
  scenario: "optimistic" | "probable" | "pessimistic";
}
