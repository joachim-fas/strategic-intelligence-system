/**
 * BlockCursor — wide, DOS-style blinking cursor overlaid on a textarea/input.
 *
 * The native browser caret is always a thin line and can't be styled into a
 * block (the CSS `caret-shape` property is still not broadly supported in
 * 2026). We get a terminal-style block cursor by:
 *
 *   1. Hiding the native caret via `caret-color: transparent` on the target.
 *   2. Maintaining a hidden "mirror" div with identical box-model and
 *      typography as the target. Filling it with text up to `selectionStart`
 *      followed by a marker span lets us read the exact pixel position of
 *      where the caret sits — including after soft wraps in a multi-line
 *      textarea.
 *   3. Drawing a `<div>` at that position as an opaque colored block.
 *
 * ## Glyph-over-highlight (2026-04)
 *
 * When the cursor block sits over a character, the character stays
 * readable THROUGH the block — same text colour as the rest of the
 * input (default: the input's own `color`), painted ON TOP of the
 * cursor's fill. Visually the effect is "text-marker highlight":
 * a lime rectangle behind an unchanged glyph. Cursor blinks → the
 * whole block (fill + glyph copy) flashes out every half-cycle and
 * the normal underlying glyph shines through, so the typist never
 * loses sight of the character they're about to overwrite.
 *
 * (An earlier iteration painted the glyph in the input's BACKGROUND
 * colour to mimic classic DOS inversion — white-on-lime. The project
 * owner rejected that: at SIS we want the glyph to keep its original
 * colour. Same-colour copy it is.)
 *
 * The component renders absolute-positioned children into its nearest
 * positioned ancestor, so the CALLER must wrap the target in a
 * `position: relative` container — which the existing hero / framework
 * inputs already do.
 */
"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface BlockCursorProps {
  /** Ref to the textarea or input to track. */
  targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** Current text content (drives re-measurement). */
  value: string;
  /** Whether the target currently has focus. Cursor only shows when true. */
  focused: boolean;
  /** Cursor fill color. Defaults to the SIS signature electric lime
   *  (#E4FF97). The block is rendered opaque, so any color passed in —
   *  including the pastel framework tints — shows up at full saturation
   *  on white surfaces. */
  color?: string;
  /**
   * Colour of the glyph shown INSIDE the cursor block. Defaults to the
   * input's OWN computed `color` — i.e. the character under the cursor
   * stays its original colour while the lime block highlights behind
   * it. Callers only override when they want a non-standard tint (e.g.
   * a brighter on-dark variant).
   */
  glyphColor?: string;
  /** Minimum cursor width in px — used at end-of-input or over zero-width
   *  characters so the cursor stays visibly clickable. */
  minWidth?: number;
  /** Hide the cursor entirely (e.g. while reasoning is streaming). */
  hidden?: boolean;
}

/** CSS properties that must be copied from the target to the mirror so the
 *  mirror produces byte-for-byte identical text layout. The set covers
 *  everything that affects glyph metrics, wrapping, and box sizing. */
const MIRROR_COPY_PROPS = [
  "boxSizing",
  "width",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
  "fontSizeAdjust", "lineHeight", "fontFamily",
  "textAlign", "textTransform", "textIndent",
  "letterSpacing", "wordSpacing",
  "tabSize", "MozTabSize",
] as const;

/**
 * Font properties we mirror onto the cursor's highlight-glyph span. Pulled
 * into a narrower set than MIRROR_COPY_PROPS because the mirror cares
 * about BOX metrics (padding, border) while the glyph inside the cursor
 * is a one-character centered span that only needs TEXT metrics. The
 * `color` field captures the input's own text colour so we can paint
 * the highlight-glyph copy in exactly the same shade — making the
 * original character appear untouched even while the lime block flashes
 * behind it.
 */
interface CursorFont {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  fontVariant: string;
  letterSpacing: string;
  lineHeight: string;
  textTransform: string;
  color: string;
}

export default function BlockCursor({
  targetRef,
  value,
  focused,
  color = "#E4FF97",
  glyphColor,
  minWidth = 9,
  hidden = false,
}: BlockCursorProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [selStart, setSelStart] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // The character that sits under the cursor (if any) + the font
  // properties needed to render it identically inside the cursor block.
  // Split into two pieces because `rect` re-renders on every measurement
  // but the font rarely changes — React's reference equality keeps the
  // cursor-block re-render cheap.
  const [glyph, setGlyph] = useState<string>("");
  const [font, setFont] = useState<CursorFont | null>(null);

  // Track caret position via any event that can move it. `selectionchange`
  // on document catches arrow-key drags and programmatic changes in
  // browsers that fire it for form elements; the explicit listeners cover
  // the rest. We run the update once on mount to pick up the initial value.
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const update = () => setSelStart(el.selectionStart ?? 0);
    update();
    el.addEventListener("input", update);
    el.addEventListener("keyup", update);
    el.addEventListener("keydown", update);
    el.addEventListener("mouseup", update);
    el.addEventListener("focus", update);
    el.addEventListener("select", update);
    const onDocSelChange = () => {
      if (document.activeElement === el) update();
    };
    document.addEventListener("selectionchange", onDocSelChange);
    return () => {
      el.removeEventListener("input", update);
      el.removeEventListener("keyup", update);
      el.removeEventListener("keydown", update);
      el.removeEventListener("mouseup", update);
      el.removeEventListener("focus", update);
      el.removeEventListener("select", update);
      document.removeEventListener("selectionchange", onDocSelChange);
    };
  }, [targetRef]);

  // Recompute the cursor rect synchronously before paint so the block stays
  // glued to the character as the user types — no one-frame lag.
  useLayoutEffect(() => {
    if (!focused || hidden) { setRect(null); setGlyph(""); return; }
    const el = targetRef.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;

    const cs = window.getComputedStyle(el);
    for (const prop of MIRROR_COPY_PROPS) {
      (mirror.style as unknown as Record<string, string>)[prop] =
        (cs as unknown as Record<string, string>)[prop];
    }
    mirror.style.position = "absolute";
    mirror.style.top = "0";
    mirror.style.left = "-99999px"; // measurement only, never visible
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.overflowWrap = "break-word";
    mirror.style.overflow = "hidden";

    const pos = Math.max(0, Math.min(selStart, value.length));
    const before = value.slice(0, pos);
    mirror.textContent = before;

    const marker = document.createElement("span");
    marker.style.display = "inline-block";
    // If the cursor is at the end of the value or just before a newline, the
    // "next character" is undefined — use a non-breaking space so the marker
    // still has measurable width/height for positioning.
    const nextChar = value[pos];
    const hasRealGlyph = Boolean(nextChar && nextChar !== "\n" && nextChar !== "\r");
    marker.textContent = hasRealGlyph ? (nextChar as string) : "\u00a0";
    mirror.appendChild(marker);

    const mRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    // Position INSIDE the same positioned ancestor the target lives in, so
    // `el.offsetLeft/Top` gives us the right origin. getBoundingClientRect's
    // deltas inside the mirror then slot in the intra-text offset.
    const left = (markerRect.left - mRect.left) + el.offsetLeft - el.scrollLeft;
    const top  = (markerRect.top  - mRect.top ) + el.offsetTop  - el.scrollTop;
    const h = markerRect.height || parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 18;
    const w = Math.max(markerRect.width, minWidth);

    setRect({ left, top, width: w, height: h });
    setGlyph(hasRealGlyph ? (nextChar as string) : "");
    setFont({
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      fontVariant: cs.fontVariant,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      textTransform: cs.textTransform,
      // Capture the input's own text colour so the glyph drawn inside
      // the cursor block keeps the original shade (black on light
      // themes). No "inverted" look — the block is just a highlight.
      color: cs.color,
    });
  }, [focused, value, selStart, hidden, targetRef, minWidth]);

  return (
    <>
      <div
        ref={mirrorRef}
        aria-hidden
        style={{ position: "absolute", pointerEvents: "none", visibility: "hidden" }}
      />
      {focused && !hidden && rect && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            background: color,
            // Inline-flex so the highlight-glyph sits exactly where the
            // underlying character does. `overflow: hidden` keeps a
            // too-wide glyph from escaping (oversized italics, ligatures).
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: "none",
            // The blink cycles the WHOLE block — highlight fill AND
            // glyph copy together. Cursor ON: lime highlight with the
            // character visible in its original colour on top. Cursor
            // OFF: block disappears, the input's own glyph layer
            // remains — so the character never "pops" position or
            // colour during the blink.
            animation: "sis-blink 1s steps(1, end) infinite",
            zIndex: 2,
            // Font metrics mirror exactly so the highlight-glyph sits
            // at the SAME position it would have had as a regular
            // character. Without this the glyph can drift by a subpixel
            // on different font stacks and the user sees a ghosting
            // effect when the cursor blinks off.
            fontFamily: font?.fontFamily,
            fontSize: font?.fontSize,
            fontWeight: font?.fontWeight,
            fontStyle: font?.fontStyle,
            fontVariant: font?.fontVariant,
            letterSpacing: font?.letterSpacing,
            lineHeight: font?.lineHeight,
            textTransform: font?.textTransform as React.CSSProperties["textTransform"],
          }}
        >
          {glyph && (
            <span
              style={{
                // Default: the input's own text colour (captured via
                // getComputedStyle). Override with `glyphColor` only
                // when the caller explicitly wants a different tint.
                color: glyphColor ?? font?.color ?? "currentColor",
                // The glyph inherits all font properties from the block
                // so we don't re-declare them. Whitespace → no span →
                // no ghost artifact.
                userSelect: "none",
              }}
            >
              {glyph}
            </span>
          )}
        </div>
      )}
    </>
  );
}
