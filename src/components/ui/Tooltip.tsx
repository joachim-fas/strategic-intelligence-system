"use client";
import React, { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Placement = "top" | "bottom" | "left" | "right" | "top-start" | "top-end";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  placement?: Placement;
  delay?: number;       // ms until tooltip appears (default 320)
  maxWidth?: number;    // px (default 260)
  disabled?: boolean;
  className?: string;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function Tooltip({
  children,
  content,
  placement = "top",
  delay = 320,
  maxWidth = 260,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [shiftX, setShiftX] = useState(0);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // After the tooltip becomes visible, measure it and — for the centered
  // "top"/"bottom" placements — clamp it horizontally so it never overflows
  // the viewport. Without this, a trigger near the right edge (e.g. the
  // DE/EN toggle in the header) causes the tooltip to get pushed off-screen
  // and wrap badly. We nudge the element back with a translateX shift.
  useEffect(() => {
    if (!visible || !tooltipRef.current) return;
    if (placement !== "top" && placement !== "bottom") return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const PAD = 8;
    let shift = 0;
    if (rect.right > window.innerWidth - PAD) shift = (window.innerWidth - PAD) - rect.right;
    else if (rect.left < PAD) shift = PAD - rect.left;
    setShiftX(shift);
  }, [visible, pos.left, pos.top, placement]);

  const show = useCallback(() => {
    if (disabled || !content) return;
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      // display:contents makes getBoundingClientRect() return {0,0,0,0},
      // so measure the first child element instead
      const target = (triggerRef.current.firstElementChild as HTMLElement) || triggerRef.current;
      const rect = target.getBoundingClientRect();
      const GAP = 8;
      let top = 0;
      let left = 0;

      switch (placement) {
        case "top":
          top = rect.top - GAP;
          left = rect.left + rect.width / 2;
          break;
        case "top-start":
          top = rect.top - GAP;
          left = rect.left;
          break;
        case "top-end":
          top = rect.top - GAP;
          left = rect.right;
          break;
        case "bottom":
          top = rect.bottom + GAP;
          left = rect.left + rect.width / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2;
          left = rect.left - GAP;
          break;
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + GAP;
          break;
      }
      setPos({ top, left });
      setVisible(true);
    }, delay);
  }, [disabled, content, delay, placement]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setShiftX(0);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Anchor style by placement
  const anchorStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      zIndex: 9999,
      maxWidth,
      pointerEvents: "none",
    };
    switch (placement) {
      case "top":
        return { ...base, bottom: `calc(100vh - ${pos.top}px)`, left: pos.left, transform: `translateX(calc(-50% + ${shiftX}px))` };
      case "top-start":
        return { ...base, bottom: `calc(100vh - ${pos.top}px)`, left: pos.left };
      case "top-end":
        return { ...base, bottom: `calc(100vh - ${pos.top}px)`, right: `calc(100vw - ${pos.left}px)` };
      case "bottom":
        return { ...base, top: pos.top, left: pos.left, transform: `translateX(calc(-50% + ${shiftX}px))` };
      case "left":
        return { ...base, top: pos.top, right: `calc(100vw - ${pos.left}px)`, transform: "translateY(-50%)" };
      case "right":
        return { ...base, top: pos.top, left: pos.left, transform: "translateY(-50%)" };
    }
  };

  const tooltip = visible && mounted ? createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        ...anchorStyle(),
        background: "rgba(15,15,20,0.96)",
        color: "#e8e8e8",
        fontSize: 12,
        lineHeight: 1.5,
        borderRadius: 6,
        padding: "6px 10px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(6px)",
        // WIDTH FIX (observed 2026-04 — locale switcher tooltip was
        // breaking "Sprache: DE → EN" into one character per line):
        // a fixed-positioned element with `left: <near right edge>` and
        // no explicit `width` lets the browser shrink the box to the
        // available horizontal space. `overflowWrap: anywhere` then
        // broke mid-word. `width: max-content` pins the box to its
        // actual content width (capped by maxWidth), regardless of how
        // close the trigger sits to the viewport edge. The shiftX
        // clamp below measures the true width and nudges it back into
        // view via transform, so the tooltip never clips.
        width: "max-content",
        whiteSpace: "normal",
        wordBreak: "normal",
        // `break-word` only breaks a single unbreakable word when
        // strictly necessary — never mid-word for regular text.
        overflowWrap: "break-word",
        animation: "sis-tooltip-in 0.12s ease",
      }}
    >
      {content}
      <style>{`
        @keyframes sis-tooltip-in {
          from { opacity: 0; transform: scale(0.94) translateX(var(--tt-tx, -50%)); }
          to   { opacity: 1; transform: scale(1) translateX(var(--tt-tx, -50%)); }
        }
      `}</style>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: "contents" }}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}

// ─── Helper: Icon-Button with Tooltip ────────────────────────────────────────

interface TipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tip: ReactNode;
  tipPlacement?: Placement;
}

export function TipButton({ tip, tipPlacement = "top", children, ...props }: TipButtonProps) {
  return (
    <Tooltip content={tip} placement={tipPlacement}>
      <button {...props}>{children}</button>
    </Tooltip>
  );
}
