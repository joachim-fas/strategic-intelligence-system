/**
 * Command registry for the Cmd+K palette.
 *
 * Each command is a pure descriptor: id, bilingual label, keyword aliases for
 * fuzzy matching, category, optional icon, and a `run(ctx)` closure that
 * receives the runtime context (router, locale toggle, etc.) when the user
 * picks the command.
 *
 * Keywords are case-insensitive and matched against the user's input with a
 * cheap contains-check — good enough for ≤ 50 commands and zero deps.
 *
 * Borrowed structurally from Worldmonitor's `src/config/commands.ts` (see
 * Deep-Dive doc 2026-04-18). Categories deliberately sparse — SIS adds them
 * as features grow, not upfront.
 */

import type { Locale } from "@/lib/i18n";

/** Runtime handles a command receives at execution time. */
export interface CommandContext {
  /** Navigate to a route. Thin wrapper over Next's router. */
  navigate: (href: string) => void;
  /** Toggle DE ↔ EN. */
  toggleLocale: () => void;
  /** Current locale at command-run time. */
  locale: Locale;
  /** Dispatch a DOM event. Used for the activity monitor toggle. */
  dispatchEvent: (name: string, detail?: unknown) => void;
}

export type CommandCategory =
  | "nav"      // Navigate to a main app section
  | "actions"  // Dispatch a runtime action (toggle, sign out, open panel)
  | "tenant"   // Tenant-scoped navigation
  | "admin";   // System-admin-only commands

export interface CommandDescriptor {
  id: string;
  /** Primary display label. Bilingual. */
  labelDe: string;
  labelEn: string;
  /** Optional secondary line (one-line hint shown under the label). */
  hintDe?: string;
  hintEn?: string;
  /** Lowercase keywords used for fuzzy matching, in addition to the label. */
  keywords: string[];
  category: CommandCategory;
  /** Optional emoji or short glyph shown left of the label. Kept text-only
   *  so we don't bind to a specific icon library; rendering is up to the
   *  component. */
  glyph?: string;
  /** True = only show when the current user is a system admin. */
  systemAdminOnly?: boolean;
  /** The handler. Pure side-effect; no return value used. */
  run: (ctx: CommandContext) => void;
}

/**
 * The canonical SIS command list. Grouped by category; `category` field
 * drives the section headers in the palette. Add new commands here — do NOT
 * scatter them across feature files.
 */
export const COMMANDS: CommandDescriptor[] = [
  // ── Navigation ──────────────────────────────────────────────────────────
  {
    id: "nav.home",
    labelDe: "Start",
    labelEn: "Home",
    keywords: ["home", "start", "dashboard", "startseite"],
    category: "nav",
    glyph: "⌂",
    run: (ctx) => ctx.navigate("/"),
  },
  {
    id: "nav.projects",
    labelDe: "Projekte",
    labelEn: "Projects",
    hintDe: "Alle aktiven Analyse-Projekte",
    hintEn: "All active analysis projects",
    keywords: ["projects", "projekte", "sessions", "briefings"],
    category: "nav",
    glyph: "◫",
    run: (ctx) => ctx.navigate("/projects"),
  },
  {
    id: "nav.projects.archive",
    labelDe: "Projekt-Archiv",
    labelEn: "Projects Archive",
    keywords: ["archive", "archiv", "projekte", "projects"],
    category: "nav",
    glyph: "⏾",
    run: (ctx) => ctx.navigate("/projects/archive"),
  },
  {
    id: "nav.cockpit",
    labelDe: "Knowledge Cockpit",
    labelEn: "Knowledge Cockpit",
    hintDe: "Radar, Trends, Signale, Quellen",
    hintEn: "Radar, trends, signals, sources",
    keywords: ["cockpit", "knowledge", "radar", "trends", "signals", "signale"],
    category: "nav",
    glyph: "◎",
    run: (ctx) => ctx.navigate("/cockpit"),
  },
  {
    id: "nav.canvas",
    labelDe: "Canvas",
    labelEn: "Canvas",
    hintDe: "Offener Analyse-Arbeitsbereich",
    hintEn: "Open analysis workspace",
    keywords: ["canvas", "workspace", "board"],
    category: "nav",
    glyph: "▦",
    run: (ctx) => ctx.navigate("/canvas"),
  },
  {
    id: "nav.monitor",
    labelDe: "Signal-Monitor",
    labelEn: "Signal Monitor",
    hintDe: "Pipeline + Datenquellen-Gesundheit",
    hintEn: "Pipeline + data source health",
    keywords: ["monitor", "pipeline", "sources", "quellen", "health", "gesundheit"],
    category: "nav",
    glyph: "◉",
    run: (ctx) => ctx.navigate("/monitor"),
  },
  {
    id: "nav.clusters",
    labelDe: "Cluster-Historie",
    labelEn: "Cluster History",
    hintDe: "Wie sich Themen-Cluster über Zeit entwickeln",
    hintEn: "How topic clusters evolve over time",
    keywords: ["cluster", "history", "historie", "snapshots", "foresight", "vorausschau"],
    category: "nav",
    glyph: "◷",
    run: (ctx) => ctx.navigate("/clusters"),
  },
  {
    id: "nav.forecasts",
    labelDe: "Prognosen",
    labelEn: "Forecasts",
    hintDe: "Team-Wahrscheinlichkeits-Einschätzungen (beta)",
    hintEn: "Team probability estimates (beta)",
    keywords: ["forecasts", "prognosen", "prediction", "vorhersage", "calibration", "kalibrierung"],
    category: "nav",
    glyph: "◨",
    run: (ctx) => ctx.navigate("/forecasts"),
  },

  // ── Tenant-scoped navigation ────────────────────────────────────────────
  {
    id: "tenant.settings",
    labelDe: "Mandanten-Einstellungen",
    labelEn: "Tenant settings",
    keywords: ["tenant", "mandant", "settings", "einstellungen", "org"],
    category: "tenant",
    glyph: "⚙",
    run: (ctx) => ctx.navigate("/settings/tenant"),
  },

  // ── Runtime actions ─────────────────────────────────────────────────────
  {
    id: "actions.toggleLocale",
    labelDe: "Sprache: DE → EN",
    labelEn: "Language: EN → DE",
    keywords: ["language", "sprache", "locale", "de", "en", "english", "deutsch"],
    category: "actions",
    glyph: "⇌",
    run: (ctx) => ctx.toggleLocale(),
  },
  {
    id: "actions.activityMonitor",
    labelDe: "Activity Monitor",
    labelEn: "Activity Monitor",
    hintDe: "Rechts-Panel mit Live-Pipeline-Events",
    hintEn: "Right-side panel with live pipeline events",
    keywords: ["activity", "aktivität", "panel", "events", "live"],
    category: "actions",
    glyph: "◌",
    run: (ctx) => ctx.dispatchEvent("sis-toggle-activity-panel"),
  },

  // ── System-admin-only ───────────────────────────────────────────────────
  {
    id: "admin.tenants",
    labelDe: "Mandanten verwalten",
    labelEn: "Manage tenants",
    keywords: ["admin", "tenants", "mandanten", "verwalten"],
    category: "admin",
    systemAdminOnly: true,
    glyph: "◈",
    run: (ctx) => ctx.navigate("/admin/tenants"),
  },
  {
    id: "admin.audit",
    labelDe: "Audit-Log",
    labelEn: "Audit log",
    keywords: ["admin", "audit", "log", "protokoll"],
    category: "admin",
    systemAdminOnly: true,
    glyph: "☰",
    run: (ctx) => ctx.navigate("/admin/audit"),
  },
];

/** Fuzzy-match a query against a command. Returns `true` if the command
 *  should be shown for the given query. Empty query = show everything.
 *
 *  Matching is: every whitespace-separated token in the query must appear as
 *  a substring of at least one of {label(DE), label(EN), hint(DE), hint(EN),
 *  any keyword}. This is forgiving enough that "sig mon" finds "Signal
 *  Monitor", but strict enough that unrelated commands don't leak in.
 */
export function matchesCommand(
  cmd: CommandDescriptor,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    cmd.labelDe,
    cmd.labelEn,
    cmd.hintDe ?? "",
    cmd.hintEn ?? "",
    ...cmd.keywords,
  ]
    .join(" ")
    .toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

/** Section label for the palette, bilingual. */
export function categoryLabel(
  category: CommandCategory,
  locale: Locale,
): string {
  const de = locale === "de";
  switch (category) {
    case "nav":     return de ? "Navigation" : "Navigate";
    case "tenant":  return de ? "Mandant"    : "Tenant";
    case "actions": return de ? "Aktionen"   : "Actions";
    case "admin":   return de ? "System-Admin" : "System admin";
  }
}
