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
 *      We render opaque (no mix-blend-mode) so light pastel framework
 *      tints — e.g. #F0D4FF or #D4E8FF — stay visibly on white surfaces.
 *      The glyph under the cursor is hidden while the block is "on" and
 *      reappears each half-cycle when the blink animation takes it to
 *      zero opacity, which is the standard DOS/terminal behaviour.
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

export default function BlockCursor({
  targetRef,
  value,
  focused,
  color = "#E4FF97",
  minWidth = 9,
  hidden = false,
}: BlockCursorProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [selStart, setSelStart] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

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
    if (!focused || hidden) { setRect(null); return; }
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
    marker.textContent = nextChar && nextChar !== "\n" ? nextChar : "\u00a0";
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
            // Opaque block. The blink animation already cycles the cursor
            // between visible and invisible, so glyphs underneath reappear
            // every half-second — we don't need a blend mode to keep them
            // readable, and an opaque block guarantees the chosen color
            // (lime, framework pastel, whatever) is faithfully on-screen.
            pointerEvents: "none",
            animation: "sis-blink 1s steps(1, end) infinite",
            zIndex: 2,
          }}
        />
      )}
    </>
  );
}
