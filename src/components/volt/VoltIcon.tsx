"use client";

/**
 * VoltIcon — zentraler Icon-Adapter fuer das Volt-UI-Komponentenset.
 *
 * Warum es das gibt
 * ─────────────────
 * Die App importierte bisher Icons direkt aus `lucide-react` — an ca. 40
 * Stellen, mit uneinheitlichen Groessen (10–24px) und uneinheitlichen
 * Strichstaerken (1.5 / 2 / 2.25 / 2.5). Das erschwert drei Dinge:
 *   1. Ein konsistentes optisches Gewicht quer durch die App.
 *   2. Einen spaeteren Austausch des Icon-Sets (z.B. auf Volt-eigene SVGs
 *      oder Phosphor/Tabler) — muesste 40 Imports umbiegen.
 *   3. Einfache visuelle Harmonie mit den Volt-Primitives.
 *
 * VoltIcon ist deshalb ein duenner Wrapper mit:
 *   - standardisierten Groessen-Presets ("xs" | "sm" | "md" | "lg" | "xl")
 *   - normalisierter Strichstaerke (2 fuer UI-Icons, 2.25 fuer Ornamente)
 *   - currentColor als Default-Farbe (uebernimmt die Umgebung)
 *   - 1-zu-1-Swap-Pfad: Wenn wir einmal Volt-eigene SVG-Icons haben, wird
 *     nur die interne Render-Funktion in dieser Datei getauscht; die 40
 *     Call-Sites bleiben unveraendert.
 *
 * Migration
 * ─────────
 * Schritt 1 (diese Datei): VoltIcon-Wrapper + Re-Export der Top-20
 *   Icons aus lucide-react als benannte Volt-Icons (`VIconX`-Prefix).
 * Schritt 2 (folgend, schrittweise): Call-Sites migrieren — statt
 *   `import { X, Check, TrendingUp } from "lucide-react"` →
 *   `import { VIconX, VIconCheck, VIconTrendingUp } from "@/components/volt"`.
 * Schritt 3 (optional, spaeter): Wenn Volt-eigene SVGs verfuegbar sind,
 *   die Re-Exports auf diese umstellen. Alle Call-Sites uebernehmen
 *   automatisch.
 *
 * Verwendung
 * ──────────
 *   <VoltIcon icon={TrendingUp} size="sm" />          // explizit
 *   <VIconTrendingUp size="sm" />                      // kurz, ueber Alias
 *   <VoltIcon icon={Check} size="md" color="var(--color-success)" />
 */

import * as React from "react";
import {
  X, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Loader2, Pencil, Minus, Plus,
  AlertCircle, AlertTriangle, Info, CheckCircle2, Circle,
  TrendingUp, TrendingDown,
  Sparkles, ThumbsUp, ThumbsDown,
  LayoutGrid, Columns3, Clock, Hexagon,
  Gauge, Radio, BookOpen, Compass, Target,
  Search, RotateCcw, ExternalLink, Copy,
  GitBranch, TreePine, Tag, Layers, Group, MoreHorizontal, Trash2, RefreshCw,
  MessageSquarePlus, Pin, Zap, ArrowDown, ArrowRight, ShieldAlert,
  type LucideIcon,
} from "lucide-react";

// ── Size & Stroke Presets ────────────────────────────────────────────────
// Groessen-Scala orientiert sich an der Typo-Scale: xs = inline 10px,
// sm = Labels / Chips 12px, md = Buttons 14–16px, lg = Panels 20px,
// xl = Hero 24px. Strokewidth 2 fuer UI-Icons, 2.25 nur fuer ornamental
// (grosse Illustrations-Icons).
const SIZE_MAP = { xs: 10, sm: 12, md: 14, lg: 18, xl: 24 } as const;

export type VoltIconSize = keyof typeof SIZE_MAP | number;

export interface VoltIconProps {
  /** Das Icon-Komponente (lucide-react oder kompatibel). */
  icon: LucideIcon;
  /** Groessen-Preset oder Pixel-Wert. Default "md" (14px). */
  size?: VoltIconSize;
  /** Strichstaerke — default 2 fuer UI-Icons. */
  strokeWidth?: number;
  /** Farbe — default currentColor (uebernimmt Umgebungs-Farbe). */
  color?: string;
  /** Zusaetzliche CSS-Klasse fuer Layout (z.B. "shrink-0"). */
  className?: string;
  /** Accessibility-Label. Wenn gesetzt, wird aria-hidden="false" und role="img". */
  label?: string;
  /** Inline-Style-Uebersteuerung. */
  style?: React.CSSProperties;
}

export function VoltIcon({
  icon: Icon,
  size = "md",
  strokeWidth = 2,
  color,
  className,
  label,
  style,
}: VoltIconProps) {
  const px = typeof size === "number" ? size : SIZE_MAP[size];
  return (
    <Icon
      size={px}
      strokeWidth={strokeWidth}
      color={color}
      className={className}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

// ── Named Volt-Icon Re-Exports ───────────────────────────────────────────
// Jedes re-exportierte Icon ist einfach ein Alias auf den lucide-Komponent.
// Call-Sites schreiben `import { VIconX } from "@/components/volt"` statt
// direkt gegen lucide — damit ein spaeterer Set-Swap hier zentral stattfindet.
// Wenn Volt eigenes SVG fuer z.B. TrendingUp liefert, ersetzt man die
// entsprechende Zeile; die Call-Site aendert sich nicht.

export const VIconX = X;
export const VIconCheck = Check;
export const VIconChevronDown = ChevronDown;
export const VIconChevronUp = ChevronUp;
export const VIconChevronLeft = ChevronLeft;
export const VIconChevronRight = ChevronRight;
export const VIconLoader = Loader2;
export const VIconEdit = Pencil;
export const VIconMinus = Minus;
export const VIconPlus = Plus;
export const VIconAlertCircle = AlertCircle;
export const VIconAlertTriangle = AlertTriangle;
export const VIconInfo = Info;
export const VIconCheckCircle = CheckCircle2;
export const VIconCircle = Circle;
export const VIconTrendingUp = TrendingUp;
export const VIconTrendingDown = TrendingDown;
export const VIconSparkles = Sparkles;
export const VIconThumbsUp = ThumbsUp;
export const VIconThumbsDown = ThumbsDown;
export const VIconLayout = LayoutGrid;
export const VIconBoard = Columns3;
export const VIconClock = Clock;
export const VIconHexagon = Hexagon;
export const VIconGauge = Gauge;
export const VIconRadio = Radio;
export const VIconBook = BookOpen;
export const VIconCompass = Compass;
export const VIconTarget = Target;
export const VIconSearch = Search;
export const VIconReset = RotateCcw;
export const VIconExternal = ExternalLink;
export const VIconCopy = Copy;
export const VIconBranch = GitBranch;
export const VIconTree = TreePine;
export const VIconTag = Tag;
export const VIconLayers = Layers;
export const VIconGroup = Group;
export const VIconMore = MoreHorizontal;
export const VIconTrash = Trash2;
export const VIconRefresh = RefreshCw;
export const VIconMessagePlus = MessageSquarePlus;
export const VIconPin = Pin;
export const VIconZap = Zap;
export const VIconArrowDown = ArrowDown;
export const VIconArrowRight = ArrowRight;
export const VIconShieldAlert = ShieldAlert;

// Re-export LucideIcon type so call sites can type their own icon props
// without depending on lucide-react directly.
export type { LucideIcon };
