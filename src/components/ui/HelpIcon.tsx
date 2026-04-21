"use client";

import { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip } from "./Tooltip";

/**
 * Inline contextual help — a "?"-Icon next to a label / field that reveals
 * a 1–3-sentence explanation on hover. Backlog task 2.5 (2026-04-22):
 * strategic terms (Confidence, Ring, Velocity, STEEP+V, Topic-Score,
 * Provenance-Tags, Scenario probabilities) show up in the UI without
 * definition — first-time users have to guess. The HelpIcon gives them
 * a one-look anchor: hover → get the definition, no separate help window.
 *
 * Design choices:
 *  - Never focusable in the default flow — auxiliary, not a CTA.
 *  - Subtle `opacity: 0.6` so it doesn't visually compete with the label.
 *  - Tooltip-delay matches the app-wide default so it doesn't pop up
 *    on accidental hover.
 *  - `content` accepts `ReactNode` so callers can pass multi-line JSX
 *    with bullets / emphasis / code when the term deserves it.
 *
 * Usage:
 *
 *   <span>Konfidenz <HelpIcon content="..." /></span>
 */
export function HelpIcon({
  content,
  size = 13,
  placement = "top",
  maxWidth = 320,
  ariaLabel,
}: {
  content: ReactNode;
  size?: number;
  placement?: "top" | "bottom" | "left" | "right" | "top-start" | "top-end";
  maxWidth?: number;
  ariaLabel?: string;
}) {
  return (
    <Tooltip content={content} placement={placement} maxWidth={maxWidth}>
      <span
        role="img"
        aria-label={ariaLabel ?? "Erklärung anzeigen"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
          marginLeft: 5,
          color: "var(--muted-foreground)",
          opacity: 0.6,
          cursor: "help",
          transition: "opacity 120ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
      >
        <HelpCircle size={size} strokeWidth={2} />
      </span>
    </Tooltip>
  );
}
