/**
 * Orbit-Farbsystem — Single Source of Truth für die Ableitung- und
 * Netzwerk-Ansicht. Vor 2026-04-21 waren die Farben inline in
 * `OrbitDerivationView.tsx` (STAGE_META) und `OrbitGraphView.tsx`
 * (hardcoded `typeColor`) dupliziert und semantisch kollidierend:
 *   - `question` und `trends` waren beide grün (Oliv- und Kräftig-Grün,
 *     vom Nutzer kaum zu unterscheiden)
 *   - `signals`, `insights`, `decisions` waren alle drei in der warmen
 *     Orange-/Amber-Familie → leicht zu verwechseln
 *   - `edges` war blau statt des Canvas-`[EDGE]`-Violett → Inkonsistenz
 *     mit `InlineProvenance.tsx`
 *   - Relevance-Bar am Zeilenlinken Rand nutzte IMMER die Question-Farbe,
 *     unabhängig von der eigentlichen Stage-Zugehörigkeit des Nodes
 *   - Focus-/Selection-Rings kollidierten mit Stage-Farben
 *
 * Das neue Schema trennt zwei orthogonale Dimensionen:
 *
 *   1. **Stage-Kategorie** (was die Node inhaltlich ist):
 *      - Evidenz-Schicht (woher kommt das Wissen):
 *          question  → slate-900  (neutraler Ursprung)
 *          signals   → amber-500  (externe Evidenz — auch [SIGNAL]-Tag)
 *          trends    → green-600  (kuratierter Trend-Graph — auch [TREND])
 *          edges     → violet-700 (kausale Beziehung — auch [EDGE])
 *      - Ableitungs-Schicht (was daraus entsteht):
 *          insights   → yellow-600 (Aha-Erkenntnis)
 *          scenarios  → cyan-600   (zukunftsgewandt, kühl)
 *          decisions  → red-600    (Handlung, warm)
 *
 *   2. **Node-State** (Fokus / Selektion / In-Chain / Dimmed):
 *      - Focus    → volt-lime (brand accent, outline)
 *      - Selected → slate-900 (neutraler Fokus-Ersatz)
 *      - In-Chain → pastel-lime (breiter Hintergrund-Wash)
 *      - Default  → var(--color-border) / surface
 *
 * Die Trennung ist wichtig, damit der Nutzer auf einen Blick BEIDE
 * Informationen ablesen kann: "dieser Node ist ein Trend (grün)" UND
 * "er ist gerade im Fokus (lime-Outline)".
 */

export type OrbitStage =
  | "question"
  | "signals"
  | "trends"
  | "edges"
  | "insights"
  | "scenarios"
  | "decisions";

export interface OrbitStageColor {
  /** Solid brand color for icons, badges, accent bars. */
  solid: string;
  /** 14%-Opacity-Hintergrund für Badges/Pills. */
  bgFaint: string;
  /** 30%-Opacity-Border für Badges/Pills. */
  borderFaint: string;
  /** Konsistenz-Kommentar gegenüber Provenance-Tags (InlineProvenance.tsx). */
  provenanceMatch: "signal" | "trend" | "edge" | null;
}

export const ORBIT_STAGE_COLORS: Record<OrbitStage, OrbitStageColor> = {
  question: {
    // Neutraler Ursprung — die Frage ist kein inhaltliches Element, sondern
    // der Startpunkt der Kette. Slate statt grün löst die Doppel-Grün-
    // Kollision mit `trends` auf.
    solid: "#0F172A",
    bgFaint: "rgba(15, 23, 42, 0.07)",
    borderFaint: "rgba(15, 23, 42, 0.25)",
    provenanceMatch: null,
  },
  signals: {
    // Amber — passt zu [SIGNAL]-Tag in InlineProvenance.tsx (dort
    // rgba(245, 198, 80, …) auf dunkelgelbem Text).
    solid: "#F59E0B",
    bgFaint: "rgba(245, 158, 11, 0.12)",
    borderFaint: "rgba(245, 158, 11, 0.35)",
    provenanceMatch: "signal",
  },
  trends: {
    // Grün — passt zu [TREND]-Tag in InlineProvenance.tsx (#0F6038 auf
    // grünem Hintergrund). Der hier gewählte Ton ist heller/sättigender
    // für den Orbit, damit er in der dichten Spine-Liste auffällt.
    solid: "#1A9E5A",
    bgFaint: "rgba(26, 158, 90, 0.10)",
    borderFaint: "rgba(26, 158, 90, 0.32)",
    provenanceMatch: "trend",
  },
  edges: {
    // Violet — identisch zu [EDGE] in InlineProvenance.tsx (#6B3FA0).
    // Vor 2026-04-21 war edges blau; jetzt canvas-weit konsistent violett.
    solid: "#6B3FA0",
    bgFaint: "rgba(107, 63, 160, 0.10)",
    borderFaint: "rgba(107, 63, 160, 0.32)",
    provenanceMatch: "edge",
  },
  insights: {
    // Yellow-600 (gold/ocker) — warm, "Aha-Moment". Genügend Abstand zum
    // amber-signals-Ton (heller/neutraler gold vs. gesättigtem amber).
    solid: "#CA8A04",
    bgFaint: "rgba(202, 138, 4, 0.10)",
    borderFaint: "rgba(202, 138, 4, 0.32)",
    provenanceMatch: null,
  },
  scenarios: {
    // Cyan-600 — kühl, zukunftsgewandt. Früher violett; violett ist
    // jetzt edges, damit die kausale Beziehung die eindeutige Farbe
    // belegt. Cyan passt auch zu "Zeitlinie / Horizont"-Assoziationen.
    solid: "#0891B2",
    bgFaint: "rgba(8, 145, 178, 0.10)",
    borderFaint: "rgba(8, 145, 178, 0.32)",
    provenanceMatch: null,
  },
  decisions: {
    // Red-600 — Action, must-do. Früher #E8402A (orangerot) — hier auf
    // kräftigeres Rot verschoben, damit Decisions visuell aus dem
    // gelben Feld (insights) herausstechen und als "Ergebnis-Stufe"
    // lesbar sind.
    solid: "#DC2626",
    bgFaint: "rgba(220, 38, 38, 0.09)",
    borderFaint: "rgba(220, 38, 38, 0.30)",
    provenanceMatch: null,
  },
};

/**
 * State-Farben für Node-States (orthogonal zu Stage-Farben). Diese
 * dürfen bewusst KEINE Stage-Farbe verwenden, damit Stage-Zugehörigkeit
 * und Fokus-Status simultan ablesbar bleiben.
 */
export const ORBIT_STATE_COLORS = {
  /** Focus-Ring — volt-brand pastel-lime. */
  focusBorder: "#B8E05B",
  focusRingShadow: "rgba(184, 224, 91, 0.45)",
  focusBg: "#FAFFE5",

  /** Selection — neutraler dunkler Anker, kollidiert mit keiner Stage-Farbe. */
  selectedBorder: "#0F172A",
  selectedRingShadow: "rgba(15, 23, 42, 0.15)",
  selectedBg: "#F8FAFC",

  /** In-Chain (auf dem Pfad von der Frage zum Fokus-Node). */
  inChainBorder: "#E4FF97",
  inChainBg: "#FAFFE5",

  /** Dimmed-Opacity für Nodes außerhalb des aktuellen Chain-Sets. */
  dimmedOpacity: 0.25,
} as const;

/** Shortcut-Getter — der häufigste Zugriff ist "gib mir die Solid-Farbe
 *  dieser Stage". */
export function stageColor(stage: OrbitStage): string {
  return ORBIT_STAGE_COLORS[stage].solid;
}

export function stageBgFaint(stage: OrbitStage): string {
  return ORBIT_STAGE_COLORS[stage].bgFaint;
}

export function stageBorderFaint(stage: OrbitStage): string {
  return ORBIT_STAGE_COLORS[stage].borderFaint;
}
