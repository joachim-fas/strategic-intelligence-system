/**
 * Framework detection for sessions.
 *
 * Sessions created via the Home page Framework Modal use a name prefix like
 *   "Marktanalyse: My Topic"  or  "War-Gaming: Competitor Move"
 * This helper inspects the session name and returns the matching framework
 * metadata (id, label, chip color, cleaned topic).
 *
 * Sessions without a framework prefix are categorized as "freestyle" —
 * open-ended questions that don't follow a named framework.
 */

export type FrameworkCategoryId =
  | "market-analysis"
  | "war-gaming"
  | "pre-mortem"
  | "post-mortem"
  | "trend-deep-dive"
  | "stakeholder-mapping"
  | "freestyle";

export interface FrameworkCategory {
  id: FrameworkCategoryId;
  labelDe: string;
  labelEn: string;
  /** Background color of the chip (pastel). */
  bg: string;
  /** Border color of the chip. */
  border: string;
  /** Text color of the chip (darker, for contrast). */
  fg: string;
}

// Order matters: Home page framework grid order mirrored here.
export const FRAMEWORK_CATEGORIES: FrameworkCategory[] = [
  { id: "market-analysis",     labelDe: "Marktanalyse",      labelEn: "Market Analysis",  bg: "#EEF5FF", border: "#C0D8F4", fg: "#1A4A8A" },
  { id: "war-gaming",          labelDe: "War-Gaming",        labelEn: "War-Gaming",       bg: "#FFF0F4", border: "#F4B8C8", fg: "#A0244A" },
  { id: "pre-mortem",          labelDe: "Pre-Mortem",        labelEn: "Pre-Mortem",       bg: "#FFF8F0", border: "#F0D4A8", fg: "#955A20" },
  { id: "post-mortem",         labelDe: "Post-Mortem",       labelEn: "Post-Mortem",      bg: "#EEFAF4", border: "#90DCA8", fg: "#0F6038" },
  { id: "trend-deep-dive",     labelDe: "Trend Deep-Dive",   labelEn: "Trend Deep-Dive",  bg: "#FBF0FF", border: "#D8A8F0", fg: "#7C1A9E" },
  { id: "stakeholder-mapping", labelDe: "Stakeholder",       labelEn: "Stakeholder",      bg: "#FFFDE8", border: "#E8D870", fg: "#7A5C00" },
  { id: "freestyle",           labelDe: "Freie Frage",       labelEn: "Freestyle",        bg: "#F4F4F4", border: "#DDDDDD", fg: "#555555" },
];

const CATEGORY_MAP: Record<FrameworkCategoryId, FrameworkCategory> =
  Object.fromEntries(FRAMEWORK_CATEGORIES.map((c) => [c.id, c])) as Record<FrameworkCategoryId, FrameworkCategory>;

/**
 * Ordered prefix patterns. First match wins. Case-insensitive, tolerant of
 * optional whitespace around the colon. Matches variants produced by both the
 * legacy and current creation flows (e.g. "Strategische Marktanalyse").
 */
const PREFIX_PATTERNS: Array<{ id: FrameworkCategoryId; regex: RegExp }> = [
  { id: "market-analysis",     regex: /^\s*(strategische\s+)?marktanalyse\s*:/i },
  { id: "market-analysis",     regex: /^\s*market\s+analysis\s*:/i },
  { id: "war-gaming",          regex: /^\s*war[-\s]?gaming\s*:/i },
  { id: "pre-mortem",          regex: /^\s*pre[-\s]?mortem\s*:/i },
  { id: "post-mortem",         regex: /^\s*post[-\s]?mortem\s*:/i },
  { id: "trend-deep-dive",     regex: /^\s*trend\s+deep[-\s]?dive\s*:/i },
  { id: "stakeholder-mapping", regex: /^\s*stakeholder([-\s]mapping)?\s*:/i },
];

/**
 * Detect the framework category for a session name.
 * Returns 'freestyle' if no framework prefix matches.
 */
export function detectFrameworkCategory(sessionName: string | null | undefined): FrameworkCategory {
  if (!sessionName) return CATEGORY_MAP.freestyle;
  for (const p of PREFIX_PATTERNS) {
    if (p.regex.test(sessionName)) return CATEGORY_MAP[p.id];
  }
  return CATEGORY_MAP.freestyle;
}

/**
 * Strip the framework prefix from a session name for display purposes.
 * "Marktanalyse: Competitor Analysis" → "Competitor Analysis"
 * "How should we respond to X?"       → "How should we respond to X?"
 */
export function cleanSessionTitle(sessionName: string | null | undefined): string {
  if (!sessionName) return "";
  for (const p of PREFIX_PATTERNS) {
    const match = sessionName.match(p.regex);
    if (match) {
      return sessionName.slice(match[0].length).trim();
    }
  }
  return sessionName.trim();
}

export function getCategoryById(id: FrameworkCategoryId): FrameworkCategory {
  return CATEGORY_MAP[id];
}
