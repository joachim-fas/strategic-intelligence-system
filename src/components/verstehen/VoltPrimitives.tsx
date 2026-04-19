"use client";

/**
 * Volt UI Primitives for Verstehen page
 *
 * All reusable sub-components that follow the Volt UI design system specs
 * from https://grainui-jddpkx7p.manus.space/
 *
 * Explicitly named in Volt UI catalogue:
 * - VoltStatusDot  (for group headers like "● TRIAL (8)")
 * - VoltStatusPill (for adopt/trial/assess/hold pills)
 * - VoltFilterPill (for horizon/category filter chips)
 * - VoltTypeBadge  (for LIVE-SIGNAL / FORSCHUNG / SOCIAL)
 * - VoltTrendCard  (for the Trend-Übersicht grid)
 * - VoltTrendDirection (arrow indicator ↑ → ↓)
 * - VoltSignalBar  (horizontal color bar)
 */

import React from "react";
import { Key as KeyIcon } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";

// ─── StatusRing: adopt / trial / assess / hold ─────────────────────────
// Color mapping is SEMANTIC — matches Volt UI pastel spec exactly.
export type Ring = "adopt" | "trial" | "assess" | "hold";

export const RING_STYLE: Record<Ring, {
  bg: string;
  bgLight: string;
  border: string;
  text: string;
  textStrong: string;
  labelDe: string;
  labelEn: string;
}> = {
  adopt:  {
    bg: "var(--pastel-mint, #C3F4D3)",
    bgLight: "color-mix(in srgb, var(--pastel-mint, #C3F4D3) 50%, transparent)",
    border: "#7DD4A8",
    text: "#0F6038",
    textStrong: "#0A3A20",
    labelDe: "Übernehmen",
    labelEn: "Adopt",
  },
  trial: {
    bg: "var(--pastel-blue, #D4E8FF)",
    bgLight: "color-mix(in srgb, var(--pastel-blue, #D4E8FF) 50%, transparent)",
    border: "#80B8F0",
    text: "#1A4A8A",
    textStrong: "#0F3060",
    labelDe: "Testen",
    labelEn: "Trial",
  },
  assess: {
    bg: "var(--pastel-butter, #FFF5BA)",
    bgLight: "color-mix(in srgb, var(--pastel-butter, #FFF5BA) 50%, transparent)",
    border: "#E8D870",
    text: "#7A5C00",
    textStrong: "#4A3800",
    labelDe: "Bewerten",
    labelEn: "Assess",
  },
  hold: {
    bg: "var(--color-surface-2, #F0F2F7)",
    bgLight: "var(--color-surface-2, #F0F2F7)",
    border: "var(--color-border, #E8E8E8)",
    text: "#6B7A9A",
    textStrong: "#3A4560",
    labelDe: "Beobachten",
    labelEn: "Hold",
  },
};

// ─── VoltStatusDot ────────────────────────────────────────────────────
// Used in: Group headers like "● TRIAL (8)"
// Spec: 8px circle + uppercase mono label + optional count
export function VoltStatusDot({
  ring,
  count,
  de,
  size = 10,
}: {
  ring: Ring;
  count?: number;
  de?: boolean;
  size?: number;
}) {
  const s = RING_STYLE[ring];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: s.text,
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: s.border,
          flexShrink: 0,
        }}
      />
      <span>{de ? s.labelDe : s.labelEn}</span>
      {count != null && (
        <span style={{ opacity: 0.7, fontWeight: 600 }}>({count})</span>
      )}
    </div>
  );
}

// ─── VoltStatusPill ────────────────────────────────────────────────────
// Used in: Trend cards, Ranked list, Detail panel
// Spec: Small rounded pill with colored bg + text. NOT the dot version.
export function VoltStatusPill({
  ring,
  de,
  size = "md",
}: {
  ring: Ring;
  de?: boolean;
  size?: "sm" | "md";
}) {
  const s = RING_STYLE[ring];
  const label = de ? s.labelDe : s.labelEn;
  const rawLabel = ring; // english short key like "adopt"
  const shown = size === "sm" ? rawLabel : label.toLowerCase();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        borderRadius: 9999,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.textStrong,
        fontFamily: "var(--font-ui)",
        fontSize: size === "sm" ? 10 : 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
        textTransform: "lowercase",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {shown}
    </span>
  );
}

// ─── VoltFilterPill ────────────────────────────────────────────────────
// Used in: Radar filter (Alle/Kurz/Mittel/Lang), Quellen filter
// Spec: Rounded-full pill, "Alle" = black active, others = outline
// On active: black bg + white text
// Inactive: transparent + border + muted text
export function VoltFilterPill({
  active,
  onClick,
  dotColor,
  size = "md",
  children,
}: {
  active: boolean;
  onClick: () => void;
  dotColor?: string;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  const isSmall = size === "sm";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 4 : 6,
        padding: isSmall ? "3px 10px" : "6px 14px",
        borderRadius: 9999,
        border: active
          ? "1px solid var(--foreground, #0A0A0A)"
          : "1px solid var(--color-border, #E8E8E8)",
        background: active ? "var(--foreground, #0A0A0A)" : "var(--card, #fff)",
        color: active ? "var(--background, #fff)" : "var(--muted-foreground, #6B6B6B)",
        fontFamily: "var(--font-ui)",
        fontSize: isSmall ? 11 : 12,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
          e.currentTarget.style.color = "var(--foreground, #0A0A0A)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--color-border, #E8E8E8)";
          e.currentTarget.style.color = "var(--muted-foreground, #6B6B6B)";
        }
      }}
    >
      {dotColor && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      <span>{children}</span>
    </button>
  );
}

// ─── VoltTypeBadge ─────────────────────────────────────────────────────
// Used in: Quellen-Tabelle "Typ" column (LIVE-SIGNAL, FORSCHUNG, SOCIAL)
// Spec: Small rounded-md badge, mono uppercase, colored background
export type TypeBadgeKind = "live-signal" | "forschung" | "social" | "prognose";

const TYPE_STYLES: Record<TypeBadgeKind, { bg: string; text: string; label: string }> = {
  "live-signal": {
    bg: "var(--pastel-mint, #C3F4D3)",
    text: "#0F6038",
    label: "LIVE-SIGNAL",
  },
  forschung: {
    bg: "var(--pastel-blue, #D4E8FF)",
    text: "#1A4A8A",
    label: "FORSCHUNG",
  },
  social: {
    bg: "var(--pastel-peach, #FFECD2)",
    text: "#955A20",
    label: "SOCIAL",
  },
  prognose: {
    bg: "var(--pastel-orchid, #FDE2FF)",
    text: "#7C1A9E",
    label: "PROGNOSE",
  },
};

export function VoltTypeBadge({ kind }: { kind: TypeBadgeKind }) {
  const s = TYPE_STYLES[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 4,
        background: s.bg,
        color: s.text,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── VoltStatusBadge ───────────────────────────────────────────────────
// Used in: Quellen-Tabelle "Status" column.
//   aktiv/inaktiv/fehler → state of a LIVE connector
//   geplant              → planned connector on the roadmap, next up
//   backlog              → planned but deferred (grey, italic)
//   needs-key            → planned but waiting on a user-provided API key
//                          (butter + key icon)
//   frei/key             → legacy "Auth" column (kept for backwards compat)
export type StatusKind =
  | "aktiv"
  | "inaktiv"
  | "geplant"
  | "backlog"
  | "needs-key"
  | "frei"
  | "key"
  | "fehler";

interface StatusStyle {
  bg: string;
  text: string;
  label: string;
  italic?: boolean;
  withKeyIcon?: boolean;
}

const STATUS_STYLES: Record<StatusKind, StatusStyle> = {
  aktiv:       { bg: "var(--pastel-mint, #C3F4D3)",    text: "#0F6038", label: "AKTIV" },
  inaktiv:     { bg: "var(--color-surface-2, #F0F2F7)", text: "#6B7A9A", label: "INAKTIV" },
  geplant:     { bg: "var(--pastel-butter, #FFF5BA)",  text: "#7A5C00", label: "GEPLANT" },
  backlog:     { bg: "var(--color-surface-2, #F0F2F7)", text: "#6B7A9A", label: "Backlog", italic: true },
  "needs-key": { bg: "var(--pastel-butter, #FFF5BA)",  text: "#7A5C00", label: "KEY", withKeyIcon: true },
  frei:        { bg: "var(--color-surface-2, #F0F2F7)", text: "#6B7A9A", label: "FREI" },
  key:         { bg: "var(--pastel-butter, #FFF5BA)",  text: "#7A5C00", label: "KEY" },
  fehler:      { bg: "var(--pastel-rose, #FFD6E0)",    text: "#A0244A", label: "FEHLER" },
};

export function VoltStatusBadge({ kind }: { kind: StatusKind }) {
  const s = STATUS_STYLES[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.withKeyIcon ? 4 : 0,
        padding: "3px 8px",
        borderRadius: 4,
        background: s.bg,
        color: s.text,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        fontStyle: s.italic ? "italic" : "normal",
        letterSpacing: "0.05em",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {s.withKeyIcon && <KeyIcon size={10} strokeWidth={2.5} />}
      {s.label}
    </span>
  );
}

// ─── VoltTrendDirection ────────────────────────────────────────────────
// Used in: Trend cards, Ranked list
// Spec: Arrow glyph in signal color — ↑ rising, → stable, ↓ falling
export function VoltTrendDirection({
  direction,
  size = 14,
}: {
  direction: "rising" | "stable" | "falling";
  size?: number;
}) {
  const cfg = {
    rising:  { symbol: "▲", color: "var(--signal-positive, #1A9E5A)" },
    stable:  { symbol: "→", color: "var(--signal-neutral, #6B7A9A)" },
    falling: { symbol: "▼", color: "var(--signal-negative, #E8402A)" },
  }[direction];

  return (
    <span
      style={{
        color: cfg.color,
        fontSize: size,
        lineHeight: 1,
        fontFamily: "var(--font-mono)",
      }}
    >
      {cfg.symbol}
    </span>
  );
}

// ─── VoltTrendCard ─────────────────────────────────────────────────────
// Used in: Trend-Übersicht grid (Signale tab)
// Spec per Volt UI:
//   - Title (truncated) + arrow-right icon top-right
//   - MAKRO/META label (tiny mono uppercase) + status pill
//   - Footer: "X sig." + "Y%"
export function VoltTrendCard({
  title,
  meta,
  ring,
  direction,
  signalCount,
  score,
  onClick,
  selected = false,
  de,
}: {
  title: string;
  meta: string;
  ring: Ring;
  direction: "rising" | "stable" | "falling";
  signalCount: number;
  score: number;
  onClick?: () => void;
  selected?: boolean;
  de?: boolean;
}) {
  const s = RING_STYLE[ring];
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 12,
        border: selected
          ? `1.5px solid var(--foreground, #0A0A0A)`
          : `1px solid var(--color-border, #E8E8E8)`,
        background: "var(--card, #fff)",
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "var(--font-ui)",
        minHeight: 110,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "var(--color-border, #E8E8E8)";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--foreground, #0A0A0A)",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            flex: 1,
          }}
        >
          {title}
        </span>
        <VoltTrendDirection direction={direction} size={12} />
      </div>

      {/* Meta row: MAKRO label + status pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "auto" }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
            color: "var(--muted-foreground, #6B6B6B)",
          }}
        >
          {meta}
        </span>
        <VoltStatusPill ring={ring} size="sm" />
      </div>

      {/* Footer: signal count + score.
          The score renders as a tiered ConfidenceBadge (Welle A Item 2)
          so low-confidence trends are immediately readable. `score` is
          a 0..1 value; ConfidenceBadge auto-detects the range. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid var(--color-border, #E8E8E8)",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--muted-foreground, #6B6B6B)",
        }}
      >
        {/* "sig." is identical DE + EN — previous ternary was a
             no-op and just noise. `de` prop kept so the caller
             API doesn't change. */}
        <span>{signalCount} sig.</span>
        <ConfidenceBadge value={score} size="xs" showLabel={false} />
      </div>
    </button>
  );
}

// ─── VoltLegendRow ─────────────────────────────────────────────────────
// Used in: Radar (encoding legend) and Netzwerk (edge-type legend)
// Spec: Small uppercase mono labels with colored markers inline
export function VoltLegendRow({
  items,
  align = "start",
}: {
  items: Array<{ label: string; color?: string; marker?: "dot" | "line" | "dashed-line" }>;
  align?: "start" | "center" | "end";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start",
        alignItems: "center",
        gap: 16,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.03em",
        color: "var(--muted-foreground, #6B6B6B)",
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {item.marker === "dot" && item.color && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
          )}
          {item.marker === "line" && item.color && (
            <span style={{ width: 14, height: 2, background: item.color, display: "inline-block", borderRadius: 1 }} />
          )}
          {item.marker === "dashed-line" && item.color && (
            <span
              style={{
                width: 14,
                height: 0,
                borderTop: `2px dashed ${item.color}`,
                display: "inline-block",
              }}
            />
          )}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Result content primitives (used by BriefingResult)
// These match Volt UI → Alert-Varianten, Badge-Varianten, Typografie-System.
// ═══════════════════════════════════════════════════════════════════════

// ─── VoltSectionLabel ──────────────────────────────────────────────────
// Used: "ZUKUNFTSSZENARIEN" / "KAUSALNETZ" / "STRATEGISCHE DIMENSIONEN" / "QUELLEN"
// Spec: Caption style (mono uppercase + wide letter spacing + muted color).
// Optional inline hint text on the right (e.g. "Karte wählen").
export function VoltSectionLabel({
  children,
  hint,
  style,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted-foreground, #6B6B6B)",
          lineHeight: 1,
        }}
      >
        {children}
      </span>
      {hint && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted-foreground, #6B6B6B)",
            opacity: 0.7,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── VoltInfoBlock ─────────────────────────────────────────────────────
// Used: "Strategische Interpretation" / "Aktueller Kontext" / "Entscheidungshilfe"
// Spec per Volt UI Alert-Varianten — info/success/warning/error with icon + label + body.
// Pastel background + matching border, NO colored left-stripe.
export type InfoBlockVariant = "info" | "success" | "warning" | "error" | "brand";

const INFO_VARIANTS: Record<InfoBlockVariant, { bg: string; border: string; text: string; icon: string }> = {
  info: {
    bg: "var(--pastel-blue, #D4E8FF)",
    border: "#80B8F0",
    text: "#1A4A8A",
    icon: "ⓘ",
  },
  success: {
    bg: "var(--pastel-mint, #C3F4D3)",
    border: "#7DD4A8",
    text: "#0F6038",
    icon: "✓",
  },
  warning: {
    bg: "var(--pastel-butter, #FFF5BA)",
    border: "#E8D870",
    text: "#7A5C00",
    icon: "⚠",
  },
  error: {
    bg: "var(--pastel-rose, #FFD6E0)",
    border: "#F4A090",
    text: "#A0244A",
    icon: "⊘",
  },
  brand: {
    // Volt-Lime brand variant — the distinctive Volt accent
    bg: "color-mix(in srgb, var(--volt-lime, #E4FF97) 35%, transparent)",
    border: "color-mix(in srgb, var(--volt-lime, #E4FF97) 80%, transparent)",
    text: "#2A3A00",
    icon: ">_",
  },
};

export function VoltInfoBlock({
  variant = "info",
  label,
  children,
}: {
  variant?: InfoBlockVariant;
  label: string;
  children: React.ReactNode;
}) {
  const cfg = INFO_VARIANTS[variant];
  return (
    <div
      style={{
        padding: "14px 16px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: variant === "brand" ? "var(--font-mono)" : "inherit",
            fontSize: variant === "brand" ? 12 : 14,
            color: cfg.text,
            lineHeight: 1,
            fontWeight: 700,
          }}
        >
          {cfg.icon}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: cfg.text,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.65,
          color: "var(--foreground, #0A0A0A)",
          fontFamily: "var(--font-ui)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── VoltMetaRow ───────────────────────────────────────────────────────
// Used: "DATENGRUNDLAGE  12 Live-Signale  5 Quellen  72% Konfidenz   STEEP+V · EU-Fokus"
// Spec: Mono uppercase label on left, stats inline, optional trailing note right-aligned.
export function VoltMetaRow({
  label,
  items,
  trailing,
}: {
  label: string;
  items: Array<{ text: string; color?: string }>;
  trailing?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        background: "var(--muted, #F7F7F7)",
        borderRadius: 8,
        flexWrap: "wrap",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted-foreground, #6B6B6B)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            color: item.color || "var(--foreground, #0A0A0A)",
            fontWeight: item.color ? 600 : 500,
            whiteSpace: "nowrap",
          }}
        >
          {item.text}
        </span>
      ))}
      {trailing && (
        <span
          style={{
            marginLeft: "auto",
            color: "var(--muted-foreground, #6B6B6B)",
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
          }}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}

// ─── VoltReferencePill ─────────────────────────────────────────────────
// Used: External source references as pill-shaped outline badges
// Spec per Volt UI Badge-Varianten → Outline
export function VoltReferencePill({
  href,
  title,
  icon = "↗",
  externalTitle,
}: {
  href?: string;
  title: string;
  icon?: string;
  externalTitle?: string;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 12px",
    borderRadius: 9999,
    border: "1px solid var(--color-border, #E8E8E8)",
    background: "transparent",
    color: "var(--foreground, #0A0A0A)",
    fontFamily: "var(--font-ui)",
    fontSize: 11,
    fontWeight: 500,
    textDecoration: "none",
    whiteSpace: "nowrap",
    maxWidth: 220,
    overflow: "hidden",
    transition: "all 0.15s",
    cursor: href ? "pointer" : "default",
  };

  const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
    e.currentTarget.style.background = "var(--muted, #F7F7F7)";
  };
  const onMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = "var(--color-border, #E8E8E8)";
    e.currentTarget.style.background = "transparent";
  };

  const content = (
    <>
      <span style={{ fontSize: 9, opacity: 0.7 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={externalTitle}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {content}
      </a>
    );
  }
  return (
    <span style={style} title={externalTitle}>
      {content}
    </span>
  );
}

// ─── VoltScenarioType ──────────────────────────────────────────────────
// Type-safe helper that returns the Volt-pastel config for a scenario type.
// Used by ScenarioSelector and anywhere scenario cards appear.
export type ScenarioType = "optimistic" | "baseline" | "pessimistic" | "wildcard";

export const SCENARIO_STYLE: Record<ScenarioType, {
  bg: string;
  bgSoft: string;
  border: string;
  text: string;
  labelDe: string;
  labelEn: string;
}> = {
  optimistic: {
    bg: "var(--pastel-mint, #C3F4D3)",
    bgSoft: "color-mix(in srgb, var(--pastel-mint, #C3F4D3) 30%, transparent)",
    border: "#7DD4A8",
    text: "#0F6038",
    labelDe: "Optimistisch",
    labelEn: "Optimistic",
  },
  baseline: {
    bg: "var(--pastel-blue, #D4E8FF)",
    bgSoft: "color-mix(in srgb, var(--pastel-blue, #D4E8FF) 30%, transparent)",
    border: "#80B8F0",
    text: "#1A4A8A",
    labelDe: "Basisfall",
    labelEn: "Baseline",
  },
  pessimistic: {
    bg: "var(--pastel-rose, #FFD6E0)",
    bgSoft: "color-mix(in srgb, var(--pastel-rose, #FFD6E0) 30%, transparent)",
    border: "#F4A090",
    text: "#A0244A",
    labelDe: "Pessimistisch",
    labelEn: "Pessimistic",
  },
  wildcard: {
    bg: "var(--pastel-butter, #FFF5BA)",
    bgSoft: "color-mix(in srgb, var(--pastel-butter, #FFF5BA) 30%, transparent)",
    border: "#E8D870",
    text: "#7A5C00",
    labelDe: "Wildcard",
    labelEn: "Wildcard",
  },
};

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD-PATTERN PRIMITIVES
// These match Volt UI → Analytics Dashboard template exactly.
// They enforce clear visual hierarchy: Display XL/L titles, round icon
// boxes on cards, KPI hero-card pattern, and card-based section containers.
// ═══════════════════════════════════════════════════════════════════════

// ─── VoltIconBox ───────────────────────────────────────────────────────
// Used: Top-right of every KPI-Card, Activity-List items, Page-Header
// Spec: Perfectly round/rounded-square colored container with centered Lucide icon.
// Variants: "lime" (hero), "dark" (primary), "light" (neutral), or pastel colors.
export type IconBoxVariant =
  | "lime"
  | "dark"
  | "light"
  | "mint"
  | "blue"
  | "rose"
  | "butter"
  | "orchid"
  | "peach";

const ICON_BOX_VARIANTS: Record<IconBoxVariant, { bg: string; fg: string; border?: string }> = {
  lime:   { bg: "var(--volt-lime, #E4FF97)", fg: "#0A0A0A" },
  dark:   { bg: "#0A0A0A", fg: "#fff" },
  light:  { bg: "var(--muted, #F7F7F7)", fg: "#0A0A0A", border: "var(--color-border, #E8E8E8)" },
  mint:   { bg: "var(--pastel-mint, #C3F4D3)", fg: "#0F6038" },
  blue:   { bg: "var(--pastel-blue, #D4E8FF)", fg: "#1A4A8A" },
  rose:   { bg: "var(--pastel-rose, #FFD6E0)", fg: "#A0244A" },
  butter: { bg: "var(--pastel-butter, #FFF5BA)", fg: "#7A5C00" },
  orchid: { bg: "var(--pastel-orchid, #FDE2FF)", fg: "#7C1A9E" },
  peach:  { bg: "var(--pastel-peach, #FFECD2)", fg: "#955A20" },
};

export function VoltIconBox({
  icon,
  variant = "light",
  size = 40,
  rounded = "lg",
}: {
  icon: React.ReactNode;
  variant?: IconBoxVariant;
  size?: number;
  rounded?: "full" | "lg" | "md";
}) {
  const v = ICON_BOX_VARIANTS[variant];
  const radius = rounded === "full" ? "50%" : rounded === "lg" ? 12 : 8;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: radius,
        background: v.bg,
        color: v.fg,
        border: v.border ? `1px solid ${v.border}` : undefined,
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
}

// ─── VoltKpiCard ───────────────────────────────────────────────────────
// Used: Hero KPI grid at the top of pages (Verstehen, BriefingResult header)
// Spec per Volt UI Analytics Dashboard:
//   Mono-Label  + Icon-Box(top-right)
//   Display-XL value (large number/currency)
//   Delta + context line (sub-label)
//
// Variants: "lime" (hero), "dark" (secondary), "light" (default)
export function VoltKpiCard({
  label,
  value,
  delta,
  subLabel,
  icon,
  variant = "light",
}: {
  label: string;
  value: React.ReactNode;
  delta?: {
    value: string;
    direction?: "up" | "down" | "neutral";
  };
  subLabel?: string;
  icon: React.ReactNode;
  variant?: "lime" | "dark" | "light";
}) {
  const isLime = variant === "lime";
  const isDark = variant === "dark";
  const bg = isLime ? "var(--volt-lime, #E4FF97)" : isDark ? "#0A0A0A" : "var(--card, #fff)";
  const fg = isDark ? "#fff" : "#0A0A0A";
  const labelColor = isDark ? "rgba(255,255,255,0.6)" : "var(--muted-foreground, #6B6B6B)";
  const border = isLime || isDark ? "none" : "1px solid var(--color-border, #E8E8E8)";

  const deltaColor = delta?.direction === "up"
    ? "var(--signal-positive, #1A9E5A)"
    : delta?.direction === "down"
    ? "var(--signal-negative, #E8402A)"
    : isDark ? "rgba(255,255,255,0.7)" : "var(--muted-foreground, #6B6B6B)";

  const deltaGlyph = delta?.direction === "up" ? "↗" : delta?.direction === "down" ? "↘" : "→";

  return (
    <div
      style={{
        background: bg,
        color: fg,
        border,
        borderRadius: 16,
        padding: "22px 24px 20px",
        display: "flex",
        flexDirection: "column",
        minHeight: 164,
      }}
    >
      {/* Top row: label + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: labelColor,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <VoltIconBox
          icon={icon}
          variant={isLime ? "dark" : isDark ? "lime" : "light"}
          size={36}
          rounded="full"
        />
      </div>

      {/* Display XL value */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
          marginBottom: delta || subLabel ? 10 : 0,
        }}
      >
        {value}
      </div>

      {/* Delta */}
      {delta && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontFamily: "var(--font-ui)",
            marginBottom: subLabel ? 6 : 0,
          }}
        >
          <span style={{ color: deltaColor, fontWeight: 700 }}>
            {deltaGlyph} {delta.value}
          </span>
        </div>
      )}

      {/* Sub label */}
      {subLabel && (
        <div
          style={{
            fontSize: 11,
            color: isDark ? "rgba(255,255,255,0.55)" : "var(--muted-foreground, #6B6B6B)",
            fontFamily: "var(--font-ui)",
            marginTop: "auto",
          }}
        >
          {subLabel}
        </div>
      )}
    </div>
  );
}

// ─── VoltSectionCard ───────────────────────────────────────────────────
// Used: Major content sections on the results page
// Spec per Volt UI Dashboard Card pattern:
//   [Icon-Box]  Title (Display-M)          [Action Button right]
//               Subtitle                    [e.g. "Alle anzeigen >"]
//   ────────────────────────────────────
//   [Inline insight chips optional]
//   [Content]
export function VoltSectionCard({
  icon,
  iconVariant = "light",
  title,
  subtitle,
  action,
  chips,
  children,
  padding = "default",
}: {
  icon?: React.ReactNode;
  iconVariant?: IconBoxVariant;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  chips?: React.ReactNode;
  children: React.ReactNode;
  padding?: "default" | "none";
}) {
  return (
    <section
      style={{
        background: "var(--card, #fff)",
        border: "1px solid var(--color-border, #E8E8E8)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "22px 24px 16px",
        }}
      >
        {icon && (
          <VoltIconBox icon={icon} variant={iconVariant} size={40} rounded="lg" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              color: "var(--foreground, #0A0A0A)",
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: "var(--muted-foreground, #6B6B6B)",
                margin: "4px 0 0",
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>

      {/* Optional inline insight chips */}
      {chips && (
        <div style={{ padding: "0 24px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: padding === "none" ? 0 : "0 24px 22px" }}>
        {children}
      </div>
    </section>
  );
}

// ─── VoltInsightChip ───────────────────────────────────────────────────
// Used: Highlight insight pills above charts / inside section headers
// Spec per Volt UI Dashboard: mint pill with arrow icon + short insight text
export function VoltInsightChip({
  icon = "↗",
  children,
  variant = "mint",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: "mint" | "butter" | "rose" | "blue";
}) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    mint:   { bg: "var(--pastel-mint, #C3F4D3)", text: "#0F6038", border: "#7DD4A8" },
    butter: { bg: "var(--pastel-butter, #FFF5BA)", text: "#7A5C00", border: "#E8D870" },
    rose:   { bg: "var(--pastel-rose, #FFD6E0)", text: "#A0244A", border: "#F4A090" },
    blue:   { bg: "var(--pastel-blue, #D4E8FF)", text: "#1A4A8A", border: "#80B8F0" },
  };
  const s = styles[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 9999,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.3,
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1 }}>{icon}</span>
      <span>{children}</span>
    </span>
  );
}

// ─── VoltPageHeader ────────────────────────────────────────────────────
// Used: Top of content pages with Display-L title + subtitle + optional actions
// Spec per Volt UI: big Display title, gray subtitle, primary+secondary actions top-right
export function VoltPageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
        {icon && <VoltIconBox icon={icon} variant="lime" size={44} rounded="lg" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              color: "var(--foreground, #0A0A0A)",
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--muted-foreground, #6B6B6B)",
                margin: "6px 0 0",
                lineHeight: 1.55,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── VoltMetricRow ─────────────────────────────────────────────────────
// Used: Inside section cards for ranked metrics with progress bars
// Spec per Volt UI "Monatsziele" card:
//   [Label]                        [Value]
//   [Sub-label]                    [/ Total]
//   [Progress bar]
//   [Percent] — — — — — — — — — — [Status Badge]
export function VoltMetricRow({
  label,
  subLabel,
  value,
  target,
  percent,
  status,
  color = "var(--signal-positive, #1A9E5A)",
}: {
  label: string;
  subLabel?: string;
  value: string | number;
  target?: string | number;
  percent: number;
  status?: { text: string; variant: "success" | "warning" | "danger" };
  color?: string;
}) {
  const statusStyle = {
    success: { bg: "transparent", text: "var(--signal-positive, #1A9E5A)", icon: "✓" },
    warning: { bg: "transparent", text: "#7A5C00", icon: "⚠" },
    danger:  { bg: "transparent", text: "var(--signal-negative, #E8402A)", icon: "⚠" },
  }[status?.variant || "success"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 0", borderBottom: "1px solid var(--color-border, #E8E8E8)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--foreground, #0A0A0A)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--foreground, #0A0A0A)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
      {(subLabel || target) && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground, #6B6B6B)", fontFamily: "var(--font-mono)" }}>
          <span>{subLabel}</span>
          {target && <span>/ {target}</span>}
        </div>
      )}
      <div style={{ height: 3, background: "var(--muted, #F7F7F7)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, percent))}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      {status && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 2 }}>
          <span style={{ color: "var(--muted-foreground, #6B6B6B)" }}>{Math.round(percent)}%</span>
          <span style={{ color: statusStyle.text, fontWeight: 600 }}>{statusStyle.icon} {status.text}</span>
        </div>
      )}
    </div>
  );
}

// ─── VoltActivityItem ──────────────────────────────────────────────────
// Used: Activity-style feed/signal list items
// Spec per Volt UI Dashboard "Aktivitäten" card:
//   [Round icon-box]  Title                                    [Timestamp]
//                     Sub-text
export function VoltActivityItem({
  icon,
  iconVariant = "light",
  title,
  subtitle,
  trailing,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  iconVariant?: IconBoxVariant;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid var(--color-border, #E8E8E8)",
        cursor: href || onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      <VoltIconBox icon={icon} variant={iconVariant} size={36} rounded="full" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--foreground, #0A0A0A)",
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--muted-foreground, #6B6B6B)",
              marginTop: 2,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {trailing && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted-foreground, #6B6B6B)",
            flexShrink: 0,
            textAlign: "right",
            lineHeight: 1.4,
          }}
        >
          {trailing}
        </div>
      )}
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {content}
      </a>
    );
  }
  return content;
}
