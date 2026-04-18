/**
 * Canvas constants — design tokens, semantic maps, and magic numbers
 * that were previously hardcoded at the top of `page.tsx`.
 *
 * Extracted as part of the canvas-decomposition step of the
 * 18.04.2026 audit (A5-H7). Zero runtime impact — these are
 * read-only lookup tables.
 */

import type { CanvasLayer, NodeStatus } from "./types";

// ── Node status metadata ──────────────────────────────────────────

export const NODE_STATUS_META: Record<NodeStatus, { color: string; label: string }> = {
  open: { color: "var(--color-text-muted)", label: "Offen" },
  active: { color: "#2563EB", label: "Aktiv" },
  decided: { color: "#1A9E5A", label: "Entschieden" },
  pinned: { color: "#F5A623", label: "Gepinnt" },
};

// ── Layer mapping ─────────────────────────────────────────────────

export const NODE_LAYER: Record<string, CanvasLayer> = {
  query: "analyse",
  insight: "analyse",
  scenario: "analyse",
  decision: "analyse",
  followup: "analyse",
  dimensions: "analyse",
  causalgraph: "analyse",
  note: "karte",
  idea: "karte",
  list: "karte",
  file: "datei",
};

// The "karte" layer groups user-created free-form items (note/idea/list).
// The label was renamed from "Karten" to "Notizen" to avoid colliding
// with the stats counter on the same toolbar row ("X Abfragen · Y
// Karten") which uses "Karten" in a different sense (total cards).
export const LAYER_LABELS: Record<CanvasLayer, { de: string; color: string }> = {
  analyse: { de: "Analyse", color: "#1A9E5A" },
  karte: { de: "Notizen", color: "#F97316" },
  datei: { de: "Dateien", color: "#4A6CF7" },
};

// ── Size tokens ───────────────────────────────────────────────────

export const QUERY_NODE_W = 420;
/** Query node default height = width (square base). */
export const QUERY_NODE_H = QUERY_NODE_W;
export const DERIVED_W = 300;
export const LIST_NODE_W = 280;
export const FILE_NODE_W = 300;
/** Default height matches width for square-ish file cards. */
export const FILE_NODE_H = 300;
export const DERIVED_COL_GAP_X = 64;
export const DERIVED_COL_GAP = 32;
export const DERIVED_ROW_GAP = 36;
export const DIMENSIONS_CARD_H = 192;
export const CAUSAL_GRAPH_CARD_H = 222;

// ── Persistence ───────────────────────────────────────────────────

export const STORAGE_KEY = "sis-canvas-v2";
/** EDGE-08: schema version for canvas state migration. */
export const CANVAS_SCHEMA_VERSION = 1;

// ── Scenario colours ──────────────────────────────────────────────

export const SCEN: Record<
  string,
  { color: string; bg: string; border: string; label: string; labelEn: string }
> = {
  optimistic: {
    color: "var(--pastel-mint-text)",
    bg: "var(--signal-positive-light)",
    border: "var(--signal-positive-border)",
    label: "Optimistisch",
    labelEn: "Optimistic",
  },
  baseline: {
    color: "var(--pastel-blue-text)",
    bg: "var(--pastel-blue)",
    border: "var(--pastel-blue-border)",
    label: "Basisfall",
    labelEn: "Baseline",
  },
  pessimistic: {
    color: "var(--signal-negative-text)",
    bg: "var(--signal-negative-light)",
    border: "var(--signal-negative-border)",
    label: "Pessimistisch",
    labelEn: "Pessimistic",
  },
  wildcard: {
    color: "var(--pastel-butter-text)",
    bg: "var(--pastel-butter)",
    border: "var(--pastel-butter-border)",
    label: "Wildcard",
    labelEn: "Wildcard",
  },
};
