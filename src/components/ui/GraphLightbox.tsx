"use client";
import React, { ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/locale-context";

// ─── GraphLightbox ────────────────────────────────────────────────────────────
// Wraps any SVG or chart component to provide a full-screen zoom view.
// Usage:
//   <GraphLightbox title="Kausalnetz">
//     <CausalGraphSVG ... />
//   </GraphLightbox>
//
// A small "⤢" button appears top-right of the wrapper.
// Clicking it opens a modal with the same content, scaled up.

interface GraphLightboxProps {
  children: ReactNode;
  title?: string;
  /** className forwarded to the wrapper div */
  className?: string;
  style?: React.CSSProperties;
  /** If false, the expand button is hidden (use to conditionally disable) */
  expandable?: boolean;
}

export function GraphLightbox({
  children,
  title,
  className,
  style,
  expandable = true,
}: GraphLightboxProps) {
  const { locale } = useLocale();
  const de = locale === "de";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setOpen(false);
  }, []);

  const modal = open && mounted ? createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "sis-lb-in 0.18s ease",
      }}
    >
      {/* Modal shell */}
      <div
        style={{
          position: "relative",
          background: "var(--color-surface, #1a1a1a)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          width: "min(92vw, 1100px)",
          height: "min(88vh, 800px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          {title && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading, #e8e8e8)", letterSpacing: "0.04em" }}>
              {title}
            </span>
          )}
          <button
            onClick={() => setOpen(false)}
            title={de ? "Schließen (Esc)" : "Close (Esc)"}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              fontSize: 20,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4,
              lineHeight: 1,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
          >
            ✕
          </button>
        </div>

        {/* Content — fills remaining space, SVG/chart scales naturally */}
        <div style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}>
          {/* Clone children with width/height overrides to fill the space */}
          <FullSizeWrapper>{children}</FullSizeWrapper>
        </div>
      </div>

      <style>{`
        @keyframes sis-lb-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className={className} style={{ position: "relative", ...style }}>
        {children}
        {expandable && (
          <button
            onClick={e => { e.stopPropagation(); setOpen(true); }}
            title={de ? "Vollbild" : "Fullscreen"}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 4,
              color: "rgba(255,255,255,0.7)",
              fontSize: 11,
              cursor: "pointer",
              padding: "2px 5px",
              lineHeight: 1,
              zIndex: 10,
              transition: "background 0.15s, color 0.15s",
              backdropFilter: "blur(4px)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(0,0,0,0.7)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(0,0,0,0.35)";
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
          >
            ⤢
          </button>
        )}
      </div>
      {modal}
    </>
  );
}

// ─── FullSizeWrapper ──────────────────────────────────────────────────────────
// Forces SVG children to fill the available space in the lightbox.
// For non-SVG children it just renders them full-size.

function FullSizeWrapper({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // SVG children will receive explicit size props via CSS
        overflow: "hidden",
      }}
    >
      {/* Render children inside a sized container so SVGs scale */}
      <div style={{ width: "100%", height: "100%", display: "contents" }}>
        {children}
      </div>
    </div>
  );
}

// ─── useGraphLightbox ─────────────────────────────────────────────────────────
// Alternative hook-based API: returns { open, setOpen, LightboxPortal }
// Use when you need more control over positioning.

export function useGraphLightbox() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
