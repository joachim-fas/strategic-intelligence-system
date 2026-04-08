/**
 * Source Taxonomy — single source of truth for connector categorization.
 *
 * Two levels:
 *   1) STEEP+V macro groups (Social/Technological/Economic/Environmental/
 *      Political/Values). Six buckets for fast visual scanning.
 *   2) Fine-grain domain categories ("tech", "klima", "recht", …). 24 keys
 *      that live and planned connectors resolve against.
 *
 * Both live connectors (via CONNECTOR_CATEGORY in QuellenTable.tsx) and
 * planned connectors (via PlannedConnector.category) map onto the same
 * CategoryKey union. The CATEGORY_TO_MACRO table is typed so that a missing
 * mapping becomes a build error — the TypeScript `Record<...>` check won't
 * let a new category land unless someone also assigns a STEEP+V bucket.
 *
 * Pseudo-categories:
 *   - "all"       → the default filter (shows everything).
 *   - "forschung" → switches the table view to the curated research grid.
 *                   Mapped to "values" for macro-filter purposes so it
 *                   shows up under the Values/Foresight chip.
 */

import type { LucideIcon } from "lucide-react";
import { Users, Cpu, TrendingUp, Leaf, Landmark, Telescope } from "lucide-react";

// ─── STEEP+V macro groups ─────────────────────────────────────────────
export type SteepVKey =
  | "social"
  | "technological"
  | "economic"
  | "environmental"
  | "political"
  | "values";

export interface SteepVMeta {
  labelDe: string;
  labelEn: string;
  icon: LucideIcon;
  bg: string;   // pastel token — background when chip is active
  text: string; // matching text token — foreground when chip is active
}

export const STEEP_V_META: Record<SteepVKey, SteepVMeta> = {
  social: {
    labelDe: "Social",
    labelEn: "Social",
    icon: Users,
    bg: "var(--pastel-peach, #FFECD2)",
    text: "var(--pastel-peach-text, #955A20)",
  },
  technological: {
    labelDe: "Technological",
    labelEn: "Technological",
    icon: Cpu,
    bg: "var(--pastel-blue, #D4E8FF)",
    text: "var(--pastel-blue-text, #1A4A8A)",
  },
  economic: {
    labelDe: "Economic",
    labelEn: "Economic",
    icon: TrendingUp,
    bg: "var(--pastel-butter, #FFF5BA)",
    text: "var(--pastel-butter-text, #7A5C00)",
  },
  environmental: {
    labelDe: "Environmental",
    labelEn: "Environmental",
    icon: Leaf,
    bg: "var(--pastel-mint, #C3F4D3)",
    text: "var(--pastel-mint-text, #0F6038)",
  },
  political: {
    labelDe: "Political",
    labelEn: "Political",
    icon: Landmark,
    bg: "var(--pastel-rose, #FFD6E0)",
    text: "var(--pastel-rose-text, #A0244A)",
  },
  values: {
    labelDe: "Values / Foresight",
    labelEn: "Values / Foresight",
    icon: Telescope,
    bg: "var(--pastel-orchid, #FDE2FF)",
    text: "var(--pastel-orchid-text, #7C1A9E)",
  },
};

export const STEEP_V_ORDER: SteepVKey[] = [
  "social",
  "technological",
  "economic",
  "environmental",
  "political",
  "values",
];

// ─── Fine-grain category keys ─────────────────────────────────────────
// 24 domain categories + 2 pseudo keys ("all", "forschung"). This union
// is imported by src/lib/planned-connectors.ts so the two files stay in
// lock-step — adding a new fine category here forces a PR to update the
// CATEGORY_TO_MACRO map below, which in turn fails the build if the
// STEEP+V assignment is missing.
export type CategoryKey =
  | "all"
  | "tech"
  | "wissenschaft"
  | "geopolitik"
  | "makro"
  | "gesellschaft"
  | "news"
  | "klima"
  | "gesundheit"
  | "prognose"
  | "wetten"
  | "kultur"
  | "gaming"
  | "crypto"
  | "cyber"
  | "energie"
  | "recht"
  | "arbeit"
  | "migration"
  | "mobilitaet"
  | "agrar"
  | "supply"
  | "publishing"
  | "foresight"
  | "umfragen"
  | "forschung";

export const CATEGORIES: Record<CategoryKey, { de: string; en: string }> = {
  all:          { de: "Alle",                     en: "All" },
  tech:         { de: "Tech & Developer",         en: "Tech & Developers" },
  wissenschaft: { de: "Wissenschaft",             en: "Science" },
  geopolitik:   { de: "Geopolitik",               en: "Geopolitics" },
  makro:        { de: "Makroökonomie",            en: "Macroeconomics" },
  gesellschaft: { de: "Gesellschaft",             en: "Society" },
  news:         { de: "News & Medien",            en: "News & Media" },
  klima:        { de: "Klima & Umwelt",           en: "Climate & Environment" },
  gesundheit:   { de: "Gesundheit",               en: "Health" },
  prognose:     { de: "Prognosemärkte",           en: "Prediction Markets" },
  wetten:       { de: "Wettmärkte",               en: "Betting Markets" },
  kultur:       { de: "Kultur & Entertainment",   en: "Culture & Entertainment" },
  gaming:       { de: "Gaming",                   en: "Gaming" },
  crypto:       { de: "Finanzen & Crypto",        en: "Finance & Crypto" },
  cyber:        { de: "Cybersecurity",            en: "Cybersecurity" },
  energie:      { de: "Energie & Rohstoffe",      en: "Energy & Commodities" },
  recht:        { de: "Gesetzgebung",             en: "Legislation" },
  arbeit:       { de: "Arbeitsmarkt",             en: "Labor Market" },
  migration:    { de: "Migration",                en: "Migration" },
  mobilitaet:   { de: "Mobilität",                en: "Mobility" },
  agrar:        { de: "Nahrungsmittel & Agrar",   en: "Food & Agriculture" },
  supply:       { de: "Supply Chain",             en: "Supply Chain" },
  publishing:   { de: "Publishing & Podcasts",    en: "Publishing & Podcasts" },
  foresight:    { de: "Foresight",                en: "Foresight" },
  umfragen:     { de: "Umfragen",                 en: "Surveys" },
  forschung:    { de: "Forschung",                en: "Research" },
};

/**
 * Every fine category (except "all") maps to exactly one STEEP+V bucket.
 * "forschung" is mapped to "values" so selecting the Values macro chip
 * keeps the forschung pill visible — even though forschung itself
 * switches the view to the curated research grid.
 *
 * This is typed as a total Record — TypeScript will fail the build if a
 * new CategoryKey is added without also assigning it a macro group here.
 */
export const CATEGORY_TO_MACRO: Record<Exclude<CategoryKey, "all">, SteepVKey> = {
  // ── Social (8) ────────────────────────────────────────────────
  gesellschaft: "social",
  gesundheit:   "social",
  arbeit:       "social",
  migration:    "social",
  kultur:       "social",
  gaming:       "social",
  publishing:   "social",
  umfragen:     "social",
  // ── Technological (3) ─────────────────────────────────────────
  tech:         "technological",
  wissenschaft: "technological",
  cyber:        "technological",
  // ── Economic (5) ──────────────────────────────────────────────
  makro:        "economic",
  crypto:       "economic",
  wetten:       "economic",
  prognose:     "economic",
  supply:       "economic",
  // ── Environmental (4) ─────────────────────────────────────────
  klima:        "environmental",
  agrar:        "environmental",
  energie:      "environmental",
  mobilitaet:   "environmental",
  // ── Political (3) ─────────────────────────────────────────────
  geopolitik:   "political",
  recht:        "political",
  news:         "political",
  // ── Values / Foresight (2) ────────────────────────────────────
  foresight:    "values",
  forschung:    "values",
};

/** Convenience: list of fine-category keys in insertion order (minus "all"). */
export const CATEGORY_KEYS: Exclude<CategoryKey, "all">[] = (
  Object.keys(CATEGORIES) as CategoryKey[]
).filter((k): k is Exclude<CategoryKey, "all"> => k !== "all");
