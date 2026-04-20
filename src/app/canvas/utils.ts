/**
 * Canvas utilities — pure functions for size/layout/time calculations.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition step
 * of the 18.04.2026 audit (A5-H7). These functions are stateless and
 * side-effect free; they never touch React, DOM, or IO.
 */

import {
  CAUSAL_GRAPH_CARD_H,
  DERIVED_W,
  DIMENSIONS_CARD_H,
  FILE_NODE_H,
  FILE_NODE_W,
  LIST_NODE_W,
  QUERY_NODE_H,
  QUERY_NODE_W,
} from "./constants";
import type {
  CanvasNode,
  DerivedNode,
  DerivedType,
  QueryNode,
} from "./types";

// ── Time helpers ──────────────────────────────────────────────────

export function formatNodeTime(ms: number): string {
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function nodeAge(ms: number): "fresh" | "aging" | "stale" {
  const d = Date.now() - ms;
  if (d < 2 * 86400000) return "fresh"; // < 2 days
  if (d < 7 * 86400000) return "aging"; // 2–7 days
  return "stale"; // > 7 days
}

// ── Card-size estimation ──────────────────────────────────────────

/**
 * Estimate the rendered height of a derived card from its content.
 * Layout code needs this to place cards without overlap before React
 * has had a chance to measure them.
 *
 * **Kalibrierung 2026-04-21 (User-Feedback "Karten zu lang, ineffizient"):**
 * Die alte Schätzung addierte bei jeder Card einen FOOTER (44) und ein
 * TIMESTAMP-Feld (18), die es in DerivedNodeCard.tsx gar nicht gibt —
 * der Card-Body endet ohne Footer, Content-Padding ist `10px 12px 0`
 * (kein Bottom-Padding). Plus CHARS_PER_LINE=32 war zu konservativ für
 * eine Kartenbreite von ~280px und 12px Font; realistisch passen ~46
 * Zeichen pro Zeile. Und `Math.max(DERIVED_W, h)` erzwang die Breite
 * als Mindesthöhe — ein 1-Zeiler war damit quadratisch 280×280 mit
 * >200px Leerraum unten.
 *
 * Neuer Estimator:
 * - HEADER = 36 (tatsächliche Header-Höhe)
 * - Content-Pad = 14 (10 top + 4 Sicherheits-Puffer zu Resize-Handle)
 * - kein Footer, kein Timestamp (nicht gerendert)
 * - SOURCES nur wenn explizit vorhanden, und nur ~22px (kompakte Badge-Zeile)
 * - Scenario-Extras: 3 (Probability-Bar) + ~36 (Label-Zeile) + 8 (Drivers-Pills) = 47
 * - BUFFER = 14 (Fade-Gradient-Kaschierung)
 * - CHARS_PER_LINE = 46 für DERIVED_W ≈ 280px
 * - Mindesthöhe: 120 (statt Breite als Höhe)
 */
export function estimateCardHeight(
  type: DerivedType,
  content: string,
  label?: string,
  hasSources = false,
): number {
  if (type === "dimensions") return DIMENSIONS_CARD_H;
  if (type === "causalgraph") return CAUSAL_GRAPH_CARD_H;
  const CHARS_PER_LINE = 46;
  const LINE_H = 20;
  const contentLines = Math.max(1, Math.ceil(content.length / CHARS_PER_LINE));
  const labelLines = label ? Math.min(3, Math.ceil(label.length / CHARS_PER_LINE)) : 0;

  const HEADER = 36;
  const CONTENT_PAD = 14;
  const SOURCES = hasSources ? 22 : 0;
  const BUFFER = 14;

  let h: number;
  if (type === "scenario") {
    // Probability-Bar (3) + Label-Block (labelLines * ~16 + 5 margin) + Driver-Pills (8)
    const scenarioExtras = 3 + labelLines * 16 + 5 + 8;
    h = HEADER + CONTENT_PAD + scenarioExtras + contentLines * LINE_H + SOURCES + BUFFER;
  } else if (type === "decision") {
    // Decision-Karten haben oft 3–5-Punkt-Frameworks. ~10% extra Puffer,
    // kein Multiplikator mehr — der alte 1.2x war bei realer Höhe overkill.
    h = Math.ceil((HEADER + CONTENT_PAD + contentLines * LINE_H + SOURCES + BUFFER) * 1.1);
  } else {
    h = HEADER + CONTENT_PAD + contentLines * LINE_H + SOURCES + BUFFER;
  }
  // Mindesthöhe 120 — genug für einen 1-Zeiler plus Header. Wichtig:
  // NICHT mehr DERIVED_W (Breite) als Höhen-Minimum, das erzwang
  // quadratische Karten mit sinnloser Leerfläche.
  return Math.max(120, h);
}

// ── Universal node dimension helpers (used by layout algorithms) ──

export function getNodeWidth(n: CanvasNode): number {
  if (n.customWidth) return n.customWidth;
  if (n.nodeType === "query") return QUERY_NODE_W;
  if (n.nodeType === "list") return LIST_NODE_W;
  if (n.nodeType === "note") return 280;
  if (n.nodeType === "idea") return 300;
  if (n.nodeType === "file") return FILE_NODE_W;
  return DERIVED_W;
}

/**
 * Content-aware query-card height.
 *
 * Without this, all QUERY cards would share the 420 px square default,
 * which looks uniform/boxy at scale and wastes vertical space for
 * queries with short or empty synthesis. We cap at QUERY_NODE_H so
 * cards never grow taller than the square base — taller than square
 * is unreadable in the canvas.
 */
export function estimateQueryHeight(n: QueryNode): number {
  const synthesis = n.synthesis ?? "";
  const HEADER = 44;
  const PAD_Y = 24;
  // fingerprint / signals / tags / fade area
  const EXTRAS = 60;
  const CHARS_PER_LINE = 44;
  const LINE_H = 20;
  if (!synthesis) {
    // No synthesis yet — either loading or a placeholder card.
    // Give just enough room for the compact derivation summary block.
    return 180;
  }
  const lines = Math.min(14, Math.ceil(synthesis.length / CHARS_PER_LINE));
  const h = HEADER + PAD_Y + lines * LINE_H + EXTRAS;
  return Math.max(220, Math.min(QUERY_NODE_H, h));
}

// ── File-size formatting ──────────────────────────────────────────

/**
 * Byte count → human-readable string. Used by FileNodeCard and by
 * the DetailPanel's file branch. Extracted here because both live in
 * different files now.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getNodeHeight(n: CanvasNode): number {
  if (n.customHeight) return n.customHeight;
  if (n.nodeType === "query") return estimateQueryHeight(n as QueryNode);
  if (n.nodeType === "dimensions") return DIMENSIONS_CARD_H;
  if (n.nodeType === "causalgraph") return CAUSAL_GRAPH_CARD_H;
  if (n.nodeType === "list") return 200;
  if (n.nodeType === "note") return 160;
  if (n.nodeType === "idea") return 300;
  if (n.nodeType === "file") return FILE_NODE_H;
  // Derived nodes: use content-based estimation.
  const dn = n as DerivedNode;
  const hasSrc = (dn.sources?.length ?? 0) > 0;
  return estimateCardHeight(dn.nodeType as DerivedType, dn.content || "", dn.label, hasSrc);
}
