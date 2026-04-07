/**
 * SIS — Central Color Definitions
 *
 * Single source of truth for ALL semantic colors used across
 * Canvas, Board, Timeline, Orbit, Briefing, Scenarios, Tags.
 *
 * Import from here instead of hardcoding colors in components.
 */

// ── Node-Typ-Farben (Canvas/Board/Timeline/Orbit + Briefing) ────────────

export const NODE_COLORS: Record<string, { color: string; label: string; labelEn: string }> = {
  query:      { color: "#1A9E5A", label: "Frage",         labelEn: "Query" },
  insight:    { color: "#6B7A00", label: "Erkenntnis",     labelEn: "Insight" },
  scenario:   { color: "#1D4ED8", label: "Szenario",       labelEn: "Scenario" },
  decision:   { color: "#1A9E5A", label: "Entscheidung",   labelEn: "Decision" },
  followup:   { color: "#6B7280", label: "Folgefrage",     labelEn: "Follow-up" },
  dimensions: { color: "#3B82F6", label: "Analyse",        labelEn: "Analysis" },
  causalgraph:{ color: "#3B82F6", label: "Kausal-Graph",   labelEn: "Causal Graph" },
  note:       { color: "#F5A623", label: "Notiz",          labelEn: "Note" },
  idea:       { color: "#F5A623", label: "Idee",           labelEn: "Idea" },
  list:       { color: "#F5A623", label: "Liste",          labelEn: "List" },
  file:       { color: "#8B5CF6", label: "Datei",          labelEn: "File" },
};

// ── Szenario-Typ-Farben ─────────────────────────────────────────────────

export const SCENARIO_COLORS: Record<string, {
  bg: string; text: string; border: string;
  labelDe: string; labelEn: string;
}> = {
  optimistic: {
    bg: "var(--pastel-mint, #C3F4D3)",
    text: "var(--pastel-mint-text, #0F6038)",
    border: "var(--pastel-mint-border, #7DD4A8)",
    labelDe: "Optimistisch",
    labelEn: "Optimistic",
  },
  baseline: {
    bg: "var(--pastel-sky, #D4E8FF)",
    text: "var(--pastel-sky-text, #1A4A8A)",
    border: "var(--pastel-sky-border, #93C5FD)",
    labelDe: "Basisfall",
    labelEn: "Baseline",
  },
  pessimistic: {
    bg: "var(--pastel-rose, #FDEEE9)",
    text: "var(--signal-negative, #B91C1C)",
    border: "var(--pastel-rose-border, #FCA5A5)",
    labelDe: "Pessimistisch",
    labelEn: "Pessimistic",
  },
  wildcard: {
    bg: "var(--pastel-butter, #FFF5BA)",
    text: "var(--pastel-butter-text, #7A5C00)",
    border: "var(--pastel-butter-border, #FDE68A)",
    labelDe: "Wildcard",
    labelEn: "Wildcard",
  },
  custom: {
    bg: "var(--color-surface-2, #F3F4F6)",
    text: "var(--volt-text-muted, #4B5563)",
    border: "var(--volt-border, #E8E8E8)",
    labelDe: "Eigenes",
    labelEn: "Custom",
  },
};

// ── Status-Tag-Farben ───────────────────────────────────────────────────

export const TAG_COLORS: Record<string, { color: string; bg: string; icon: string; labelDe: string; labelEn: string }> = {
  open:     { color: "#9CA3AF", bg: "#F3F4F6", icon: "▫", labelDe: "Offen",       labelEn: "Open" },
  active:   { color: "#2563EB", bg: "#EFF6FF", icon: "●", labelDe: "Aktiv",       labelEn: "Active" },
  decided:  { color: "#1A9E5A", bg: "#F0FDF6", icon: "✓", labelDe: "Entschieden", labelEn: "Decided" },
  pinned:   { color: "#F59E0B", bg: "#FFFBEB", icon: "★", labelDe: "Gepinnt",     labelEn: "Pinned" },
};

// ── Board-Spalten (Kanban) ──────────────────────────────────────────────

export const BOARD_COLUMNS: { key: string; types: string[]; color: string; labelDe: string; labelEn: string }[] = [
  { key: "query",     types: ["query"],                          color: "#1A9E5A", labelDe: "Fragen",         labelEn: "Queries" },
  { key: "insights",  types: ["insight"],                        color: "#6B7A00", labelDe: "Erkenntnisse",   labelEn: "Insights" },
  { key: "scenarios", types: ["scenario"],                       color: "#1D4ED8", labelDe: "Szenarien",      labelEn: "Scenarios" },
  { key: "decisions", types: ["decision"],                       color: "#1A9E5A", labelDe: "Entscheidungen", labelEn: "Decisions" },
  { key: "followups", types: ["followup"],                       color: "#6B7280", labelDe: "Folgefragen",    labelEn: "Follow-ups" },
  { key: "analysis",  types: ["dimensions", "causalgraph"],      color: "#3B82F6", labelDe: "Analyse",        labelEn: "Analysis" },
  { key: "notes",     types: ["note", "idea", "list", "file"],   color: "#F5A623", labelDe: "Notizen",        labelEn: "Notes" },
];

// ── Ring-Farben (Radar/Cockpit) ─────────────────────────────────────────
// Note: Canonical ring colors are in src/types.ts (RING_COLORS).
// This re-export provides pastel background variants.

export const RING_PASTEL: Record<string, { color: string; bg: string }> = {
  adopt:  { color: "var(--pastel-mint-text, #0F6038)", bg: "var(--pastel-mint, #C3F4D3)" },
  trial:  { color: "var(--pastel-sky-text, #1A4A8A)",  bg: "var(--pastel-sky, #D4E8FF)" },
  assess: { color: "var(--pastel-butter-text, #7A5C00)", bg: "var(--pastel-butter, #FFF5BA)" },
  hold:   { color: "var(--volt-text-muted, #6B7280)",  bg: "var(--color-surface-2, #F3F4F6)" },
};

// ── Kausal-Edge-Farben ──────────────────────────────────────────────────

export const EDGE_STYLE: Record<string, { color: string; labelDe: string; labelEn: string }> = {
  drives:     { color: "#1A9E5A", labelDe: "treibt",      labelEn: "drives" },
  amplifies:  { color: "#1A4A8A", labelDe: "verstaerkt",  labelEn: "amplifies" },
  dampens:    { color: "#E8402A", labelDe: "daempft",      labelEn: "dampens" },
  correlates: { color: "#C8820A", labelDe: "korreliert",   labelEn: "correlates" },
};
