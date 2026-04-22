"use client";

// TODO: PERF-02 — ~200KB of static data compiled into JS bundle.
// planned-connectors.ts, causal-graph.ts edges, country lists should be JSON files loaded on demand.

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { queryIntelligenceAsync, type PipelineStageEvent } from "@/lib/intelligence-engine";
import { defaultPipelineStages, type PipelineStageMap } from "@/components/briefing/SequentialPipeline";
import { classifyTrends } from "@/lib/classify";
import { useLocale } from "@/lib/locale-context";
import TrendDetailPanel from "@/components/radar/TrendDetailPanel";
import { parseContextFromText, applyContextProfile, PRESET_PROFILES, ContextProfile } from "@/lib/context-profiles";
import { FRAMEWORKS } from "@/lib/canvas-templates";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { connectors } from "@/connectors";
import { BriefingResult, HistoryEntry } from "@/components/briefing/BriefingResult";
// SessionBar wurde aus der Home-Session-Ansicht entfernt — die Briefing-
// Ansicht zeigt nur noch das aktive Ergebnis. Zusammenfassung/Canvas-
// Wechsel leben in der Canvas-Toolbar (/canvas). Projektwahl passiert
// ueber die "Letzte Projekte"-Liste auf dem Hero.
import { GrainCard } from "@/components/grain/GrainCard";
import { GrainBadge } from "@/components/grain/GrainBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import BlockCursor from "@/components/common/BlockCursor";
import {
  clearHistoryStorage,
} from "@/lib/briefing-export";
// Demo briefings moved to /beispiele page

// Lazy load heavy components only when needed
import dynamic from "next/dynamic";
const RadarView = dynamic(() => import("@/components/radar/RadarView"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#999" }}>Radar laden…</div> });
const CausalGraphView = dynamic(() => import("@/components/radar/CausalGraphView"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#999" }}>Kausalnetz laden…</div> });

/**
 * Build a query string enriched with framework-specific directives. The LLM
 * sees the framework name + methodology + any captured context fields as a
 * bracketed prefix followed by the actual question. The briefing that comes
 * back runs through the SAME 7-stage pipeline as a regular hero query — the
 * framework only shapes WHAT the LLM produces, not the reveal mechanics.
 *
 * Kept as a top-level helper (not a hook) so both the textarea Enter handler
 * and the click handler in the modal can call it without duplicating logic.
 */
function buildFrameworkQuery(
  fw: {
    name: string; nameEn: string;
    methodology: string; methodologyEn: string;
    guidance?: { fields?: Array<{ key: string; labelDe: string; labelEn: string }> };
  },
  topic: string,
  fieldValues: Record<string, string>,
  locale: "de" | "en",
): string {
  const name = locale === "de" ? fw.name : fw.nameEn;
  const method = locale === "de" ? fw.methodology : fw.methodologyEn;
  const lines: string[] = [];
  lines.push(`[${locale === "de" ? "Strategisches Framework" : "Strategic framework"}: ${name}]`);
  lines.push(`[${locale === "de" ? "Methodik" : "Methodology"}: ${method}]`);
  if (fw.guidance?.fields) {
    for (const f of fw.guidance.fields) {
      const v = fieldValues[f.key]?.trim();
      if (!v) continue;
      const rawLabel = locale === "de" ? f.labelDe : f.labelEn;
      // Strip "(optional)" so the LLM sees a clean key: value line.
      const cleanLabel = rawLabel.replace(/\s*\((optional|optional)\)\s*$/i, "");
      lines.push(`[${cleanLabel}: ${v}]`);
    }
  }
  lines.push("");
  lines.push(`${locale === "de" ? "Frage" : "Question"}: ${topic.trim()}`);
  return lines.join("\n");
}

/**
 * Tiny 8-bit character drawn in true side-view profile (like classic
 * platformer sprites) that paces across the walkway between the
 * "Reasoning läuft" label and the mm:ss timer. Mario-inspired colouring:
 * red cap with a visor brim pointing in the walk direction, brown hair
 * peeking out at the back, skin-tone face with a single pixel eye facing
 * the walk direction, red shirt with gray shoulder pads, one visible
 * near-arm, black belt, red pants, two legs in mid-stride, black boots
 * with toes pointing forward.
 *
 * Side-view design choices that matter for the animation:
 *   - Default orientation faces LEFT (the walk direction). The eye and
 *     hat brim are on the left side of the sprite so it "reads" left.
 *   - Direction flips for the look-around dwell via scaleX(-1) on the
 *     .pm-facing wrapper — see sis-pm-facing keyframes in globals.css.
 *     This replaces the earlier head-rotation trick with an honest
 *     right-facing side view.
 *   - Two legs in profile (back leg + front leg) alternate heights via
 *     pm-leg-l/-r to make a retro 2-frame walk cycle.
 *   - The near-arm (.pm-arm-r) raises up-forward to the head during the
 *     two scratch dwells.
 *   - Rare blink on .pm-eye keeps the stare from feeling frozen.
 *
 * Wrapper structure:
 *   <div.sis-pixel-man>          — owns position + left walk animation
 *     <div.pm-facing>            — owns the scaleX flip for look-around
 *       <svg>                    — the actual pixel art
 *
 * Pixel grid is 10x14 (viewBox), rendered at 20x28 CSS px (2x scale) —
 * ~55% of the earlier character's footprint so the figure doesn't
 * dominate the reasoning card any more. `shapeRendering="crispEdges"`
 * plus `image-rendering: pixelated` in CSS keeps blocks sharp.
 */
function PixelMan() {
  // Palette next to the art so tweaking stays in one place.
  const RED = "#D43A2F";       // hat, shirt, pants
  const BROWN = "#5A2F14";     // hair
  const SKIN = "#F4C49B";      // face
  const EYE = "#0A0A0A";       // pupil
  const GRAY = "#8E8E8E";      // shoulder pads, sleeves, hands
  const BLACK = "#0A0A0A";     // belt, boots
  return (
    <div className="sis-pixel-man" aria-hidden="true">
      {/* Direction wrapper — scaleX(-1) during the look-around dwell flips
           the whole profile sprite to face right, then back to left. */}
      <div className="pm-facing">
        <svg width="20" height="28" viewBox="0 0 10 14" shapeRendering="crispEdges">
          {/* HEAD — hat, hair, face. Single eye on the LEFT side (walk dir). */}
          <g className="pm-head">
            {/* Row 0: hat crown */}
            <rect x="3" y="0" width="4" height="1" fill={RED} />
            {/* Row 1: hat main */}
            <rect x="1" y="1" width="7" height="1" fill={RED} />
            {/* Row 2: hat brim — extends 1px LEFT as a visor pointing the walk direction */}
            <rect x="0" y="2" width="7" height="1" fill={RED} />
            {/* Row 3: front hair wisp + red hat band + back hair */}
            <rect x="1" y="3" width="2" height="1" fill={BROWN} />
            <rect x="3" y="3" width="3" height="1" fill={RED} />
            <rect x="6" y="3" width="3" height="1" fill={BROWN} />
            {/* Row 4: sideburn + face front + eye + face back + back hair */}
            <rect x="1" y="4" width="1" height="1" fill={BROWN} />
            <rect x="2" y="4" width="1" height="1" fill={SKIN} />
            <rect className="pm-eye" x="3" y="4" width="1" height="1" fill={EYE} />
            <rect x="4" y="4" width="2" height="1" fill={SKIN} />
            <rect x="6" y="4" width="3" height="1" fill={BROWN} />
            {/* Row 5: face + hair back */}
            <rect x="2" y="5" width="4" height="1" fill={SKIN} />
            <rect x="6" y="5" width="2" height="1" fill={BROWN} />
            {/* Row 6: chin / neck */}
            <rect x="3" y="6" width="3" height="1" fill={SKIN} />
          </g>

          {/* TORSO — shoulders, shirt body, belt. Both shoulder pads show in
               profile because the pad caps the shoulder joint on each side. */}
          {/* Row 7: shoulder pads + shirt */}
          <rect x="1" y="7" width="2" height="1" fill={GRAY} />
          <rect x="3" y="7" width="4" height="1" fill={RED} />
          <rect x="7" y="7" width="2" height="1" fill={GRAY} />
          {/* Row 8: shirt body (near arm is its own group below) */}
          <rect x="2" y="8" width="5" height="1" fill={RED} />
          {/* Row 9: shirt body */}
          <rect x="2" y="9" width="5" height="1" fill={RED} />
          {/* Row 10: belt */}
          <rect x="2" y="10" width="5" height="1" fill={BLACK} />

          {/* NEAR-ARM GROUP — the arm closest to the viewer in profile view.
               Drawn hanging at the side by default; the scratch animation
               lifts it up-forward to the head during dwells. Two pixels:
               forearm + hand. */}
          <g className="pm-arm-r">
            <rect x="0" y="8" width="2" height="1" fill={GRAY} />
            <rect x="1" y="9" width="1" height="1" fill={GRAY} />
          </g>

          {/* PANTS + LEGS + FEET — side-view walk stance. Back leg and front
               leg are separated by the waist gap; alternating vertical
               offsets animate the step cycle. Feet extend one pixel
               forward (LEFT in the default facing) as toes. */}
          {/* Row 11: pants waist */}
          <rect x="2" y="11" width="5" height="1" fill={RED} />
          {/* Row 12: legs in stride — back leg (left side of sprite) + front leg */}
          <rect className="pm-leg-l" x="2" y="12" width="1" height="1" fill={RED} />
          <rect className="pm-leg-r" x="5" y="12" width="2" height="1" fill={RED} />
          {/* Row 13: boots — back boot (heel) + front boot (with forward toe) */}
          <rect className="pm-foot-l" x="1" y="13" width="2" height="1" fill={BLACK} />
          <rect className="pm-foot-r" x="4" y="13" width="3" height="1" fill={BLACK} />
        </svg>
      </div>
    </div>
  );
}

/**
 * PacMan — Reasoning-Animation, die den Slot zwischen „Reasoning"-Label
 * und mm:ss-Clock füllt, solange die Pipeline läuft.
 *
 * **Warum Pac-Man:** User wünsch dir's, nach dem Wurm-Experiment.
 * Pac-Man hat als Metapher perfekt zu „System denkt" gepasst — er
 * frisst sich durch etwas. Hier: Dots, die als Reihe auf der Bühne
 * liegen.
 *
 * **Visuals:**
 *   - Gelber Pac-Man-Kreis mit chomp-Animation (Mund öffnet/schließt,
 *     Keilwinkel oszilliert zwischen ~55° geöffnet und 0° geschlossen)
 *   - Eine Reihe kleiner Dots auf Höhe des Pac-Man-Zentrums
 *   - Pac-Man wandert langsam von links nach rechts, frisst dabei die
 *     Dots (Dot verschwindet sobald seine x-Position erreicht ist).
 *   - Am rechten Rand: Richtung flipt, Dots werden neu generiert, Pac-
 *     Man frisst sich zurück nach links.
 *
 * **Rendering:** Canvas mit `requestAnimationFrame`. HiDPI-bewusst
 * (DPR-Scaling), `imageSmoothingEnabled = true` (anders als beim
 * Pixel-Wurm) — Pac-Man darf kantenweich sein, das ist keine Pixel-
 * art.
 *
 * **Reduced Motion:** einmal mit offenem Mund rendern, keinen RAF-
 * Loop starten.
 */
function PacMan() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Farben ────────────────────────────────────────────────────────
    // Invertierte Palette (User-Feedback): Pac-Man + Dots in der Haupt-
    // Ink-Farbe der Seite, Auge als neongelber Akzent. Macht das Auge
    // zum deutlich lesbaren Hingucker gegen die schwarze Silhouette.
    const BODY = "#0A0A0A";      // Pac-Man & Dots — schwarz
    const EYE = "#F0FF00";       // Auge — neongelb

    // ── Geometrie-Konstanten ──────────────────────────────────────────
    // Feste Werte, die nicht von der Bühnenbreite abhängen.
    const PAC_R = 9;                    // Pac-Man-Radius
    const DOT_R = 1.6;                  // Dot-Radius
    const DOT_SPACING = 28;             // gleichmäßiger Abstand zwischen Dots
    const EDGE_PADDING = 8;             // Abstand zu den Text-Rändern links/rechts
    const CHOMP_HZ = 5;                 // 5 Mund-Öffnungen pro Sekunde

    // Scroll-Geschwindigkeit statt Halbzyklus-Zeit: der Pac-Man läuft
    // immer gleich schnell, egal wie breit der Container ist. Vorher
    // dauerte ein Durchlauf fix 5.5 s — bei doppelter Breite wäre der
    // Wurm doppelt so schnell gewesen, bei halber doppelt so langsam.
    const SPEED_PX_PER_S = 55;          // ~9 s pro 500 px Halbzyklus

    // ── Dynamische Bühnen-Dimensionen ─────────────────────────────────
    // Das Canvas skaliert mit der Container-Breite. ResizeObserver
    // passt die Auflösung bei jedem Layout-Change neu an.
    let cssW = 0;
    let cssH = 36;
    let leftX = 0;
    let rightX = 0;
    let pathLen = 0;
    let midY = cssH / 2;
    let dotXs: number[] = [];

    const setup = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      cssW = Math.max(60, parent.clientWidth - EDGE_PADDING * 2);
      cssH = 36;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;

      // Layout-Werte für diese Breite neu berechnen
      midY = cssH / 2;
      leftX = PAC_R + 2;
      rightX = cssW - PAC_R - 2;
      pathLen = rightX - leftX;

      // Dots so viele wie reinpassen, gleichmäßig zentriert in der Bahn
      const dotsAvailable = pathLen - PAC_R * 2 - 16;
      const dotCount = Math.max(1, Math.floor(dotsAvailable / DOT_SPACING));
      const dotsStart = (cssW - (dotCount - 1) * DOT_SPACING) / 2;
      dotXs = Array.from({ length: dotCount }, (_, i) => dotsStart + i * DOT_SPACING);
    };

    setup();
    const ro = new ResizeObserver(() => setup());
    ro.observe(parent);

    const drawFrame = (tSec: number) => {
      const W = cssW;
      const H = cssH;
      ctx.clearRect(0, 0, W, H);

      // Halbzyklus-Dauer aus aktueller Breite + konstanter Speed.
      // Das hält die Geschwindigkeit unabhängig vom Viewport stabil.
      const halfS = Math.max(1.5, pathLen / SPEED_PX_PER_S);
      const cycleT = tSec % (halfS * 2);
      const goingRight = cycleT < halfS;
      const u = (goingRight ? cycleT : cycleT - halfS) / halfS;
      const pacX = goingRight
        ? leftX + u * pathLen
        : rightX - u * pathLen;

      // ── Dots zeichnen ───────────────────────────────────────────────
      // Sichtbar sind nur Dots, die der Pac-Man in der aktuellen
      // Halbzyklus-Richtung noch NICHT überfahren hat. Bei jeder
      // Richtungsumkehr erscheinen sie wieder frisch (neue Halbzyklus-
      // Iteration) — klassisches Pac-Man-Respawn.
      ctx.fillStyle = BODY;
      for (const dx of dotXs) {
        const eaten = goingRight ? dx < pacX - PAC_R * 0.5 : dx > pacX + PAC_R * 0.5;
        if (eaten) continue;
        ctx.beginPath();
        ctx.arc(dx, midY, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Pac-Man zeichnen ────────────────────────────────────────────
      const MAX_OPEN = 0.9;
      const mouth = Math.abs(Math.sin(tSec * Math.PI * CHOMP_HZ)) * MAX_OPEN;
      const facing = goingRight ? 0 : Math.PI;

      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.moveTo(pacX, midY);
      ctx.arc(pacX, midY, PAC_R, facing + mouth, facing + Math.PI * 2 - mouth);
      ctx.closePath();
      ctx.fill();

      // ── Auge ────────────────────────────────────────────────────────
      const eyeDx = Math.cos(facing) * PAC_R * 0.15;
      const eyeDy = -PAC_R * 0.45;
      ctx.fillStyle = EYE;
      ctx.beginPath();
      ctx.arc(pacX + eyeDx, midY + eyeDy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    };

    // Reduced-Motion: Eine statische Pose, kein Loop.
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (prefersReduced) {
      drawFrame(0);
      ro.disconnect();
      return;
    }

    const startT = performance.now();
    let rafId = 0;
    const frame = (now: number) => {
      drawFrame((now - startT) / 1000);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="sis-pac-man" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

/**
 * Placeholder that takes over the hero command-line slot while the pipeline
 * is running. Shows an animated shimmer bar + pulsing sonar + label + pixel-
 * man walking across the middle + mm:ss clock. The SequentialPipeline card
 * still renders inside the history column below with full per-stage detail —
 * this one's just a compact "we're thinking" marker that keeps the hero slot
 * busy so the input doesn't look idle while the LLM streams. Identical look
 * is used at both render sites (session + first-visit) so reasoning feels
 * the same everywhere.
 *
 * Horizontal layout reads left-to-right:
 *   [sonar dot] [ "Reasoning läuft..." ] [ pixel-man walkway ] [ mm:ss ]
 * The walkway is an explicit flex:1 strip between label and timer — that's
 * where the tiny 8-bit character paces back and forth. Confining it to this
 * strip (rather than letting it roam the whole card) keeps it out of the way
 * of the text while giving it enough room for entrances, exits and dwells.
 */
function ReasoningIndicator({ elapsedMs, locale }: { elapsedMs: number; locale: "de" | "en" }) {
  const seconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  // Each visual layer here has a narrow job so the whole thing reads as "the
  // system is actively thinking" without getting noisy:
  //   - sonar rings radiate from the lime dot (spatial pulse = "scanning")
  //   - the top shimmer sweeps (linear time = "still running")
  //   - the bottom progress pill glides (indeterminate = "work in flight")
  //   - the typing dots after the label animate in sequence (language model = "composing")
  //   - the card glow breathes (ambient = "alive")
  //   - a tiny pixel-art character paces in the middle walkway, pausing to
  //     scratch its head or look around (long-running idle fun)
  // The stagger between them (1.8s / 2.4s / 2.0s / 1.5s / 2.8s / 10s) keeps
  // the rhythm asymmetric and organic — synced loops would read as a single
  // blinking mass.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={locale === "de" ? `Reasoning läuft, ${mm} Minuten ${ss} Sekunden` : `Reasoning in progress, ${mm} minutes ${ss} seconds`}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 22px",
        // Die Box muss hoch genug sein, damit der Canvas (36 px) mit dem
        // Padding (14 oben/unten) ohne Clipping reinpasst — und damit die
        // 3-Pixel-Progress-Pill unten sichtbar bleibt ohne Überlappung mit
        // dem Inhalt. 72 px reicht genau dafür.
        minHeight: 72,
        borderRadius: "var(--volt-radius-lg, 14px)",
        border: "1.5px solid var(--volt-border, #E8E8E8)",
        background: "var(--volt-surface-raised, #fff)",
        position: "relative", overflow: "hidden",
        animation: "sis-reasoning-breathe 2.8s ease-in-out infinite",
      }}
    >
      {/* Thin shimmer sweep pinned to the top edge. Clipped by overflow:hidden. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 0%, #E4FF97 50%, transparent 100%)",
          animation: "sis-reasoning-shimmer 1.8s linear infinite",
        }}
      />
      {/* Sonar wrapper: a stacked pile of rings that emanate outward while the
           solid dot pulses in place. The wrapper reserves the space so the
           layout doesn't reflow as rings grow. */}
      <span
        aria-hidden="true"
        style={{
          position: "relative", width: 14, height: 14,
          flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Two offset rings for a continuous "scanning" feel. */}
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1.5px solid #E4FF97",
          animation: "sis-reasoning-ripple 2.4s ease-out infinite",
        }} />
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1.5px solid #E4FF97",
          animation: "sis-reasoning-ripple 2.4s ease-out 1.2s infinite",
        }} />
        {/* Solid lime dot at the origin — the "emitter". */}
        <span style={{
          position: "relative", zIndex: 1,
          width: 10, height: 10, borderRadius: "50%",
          background: "var(--volt-lime, #E4FF97)",
          border: "1px solid rgba(0,0,0,0.18)",
          animation: "sis-reasoning-pulse 1.6s ease-in-out infinite",
        }} />
      </span>
      <span style={{
        display: "inline-flex", alignItems: "baseline", gap: 2,
        // No flex:1 any more — the walkway below claims the remaining space so
        // the pixel-man has somewhere to stroll. Label keeps its natural width.
        flexShrink: 0,
        fontSize: 14, fontWeight: 600,
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        color: "var(--volt-text, #0A0A0A)",
        letterSpacing: "-0.01em",
      }}>
        {locale === "de" ? "Reasoning läuft" : "Reasoning in progress"}
        {/* Typing dots — staggered so they fill left-to-right, then all clear
             at once and restart. Keeps the phrase feeling unfinished. */}
        <span aria-hidden="true" style={{ animation: "sis-reasoning-dot-1 1.5s infinite" }}>.</span>
        <span aria-hidden="true" style={{ animation: "sis-reasoning-dot-2 1.5s infinite" }}>.</span>
        <span aria-hidden="true" style={{ animation: "sis-reasoning-dot-3 1.5s infinite" }}>.</span>
      </span>
      {/* Pac-Man walkway — the explicit strip between label and timer where
           Pac-Man chomps through a row of dots. Anchored `position: relative`
           so the absolutely-positioned <canvas> centres itself against this
           parent. `overflow: hidden` keeps the character clipped at the
           walkway's left/right edges, `minWidth` keeps the strip usable on
           narrow cards. */}
      <div
        aria-hidden="true"
        style={{
          flex: 1,
          position: "relative",
          // `alignSelf: stretch` war hier falsch — das zog den Walkway auf
          // volle Container-Höhe und hat die Flex-Zentrierung der Nachbarn
          // (Label/Timer) visuell gegen diesen stretched Block verschoben.
          // Ohne stretch nimmt der Walkway nur die Canvas-Höhe (36 px) ein
          // und wird per alignItems: "center" des Parent-Flex sauber mit
          // Label/Timer auf einer Linie zentriert.
          height: 36,
          display: "flex", alignItems: "center",
          overflow: "hidden",
          minWidth: 120,
        }}
      >
        <PacMan />
      </div>
      <span style={{
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 13, fontWeight: 600,
        color: "var(--volt-text-muted, #6B6B6B)",
        letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}>
        {mm}:{ss}
      </span>
      {/* Indeterminate progress pill — a slim lime capsule that glides across
           the full width. Purely ambient: signals "work is flowing", not any
           specific percentage. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          overflow: "hidden",
          background: "rgba(228,255,151,0.15)",
        }}
      >
        <span style={{
          display: "block", height: "100%",
          background: "linear-gradient(90deg, transparent 0%, #E4FF97 35%, #E4FF97 65%, transparent 100%)",
          animation: "sis-reasoning-progress 2.0s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          borderRadius: 2,
        }} />
      </span>
    </div>
  );
}

export default function HomeClient() {
  const { locale, toggleLocale } = useLocale();
  const [baseTrends, setBaseTrends] = useState<TrendDot[]>(megaTrends);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contextProfile, setContextProfile] = useState<ContextProfile | null>(null);
  const trends = contextProfile ? applyContextProfile(baseTrends, contextProfile) : baseTrends;

  // Load trends from DB on mount — fall back to hardcoded data
  useEffect(() => {
    fetchWithTimeout("/api/v1/trends")
      .then((res) => res.json())
      .then((data) => {
        const trends = data.data?.trends ?? data.trends;
        if (trends?.length > 0) {
          setBaseTrends(classifyTrends(trends as TrendDot[]));
        }
      })
      .catch(() => { /* keep megaTrends as fallback */ });
  }, []);

  const [query, setQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Reasoning timer: tracks how long the current analysis has been running.
  // The indicator that replaces the command-line while reasoning is active
  // renders this as an mm:ss clock next to the shimmer animation.
  const [reasoningElapsedMs, setReasoningElapsedMs] = useState(0);
  useEffect(() => {
    if (!isAnalyzing) { setReasoningElapsedMs(0); return; }
    const startedAt = Date.now();
    setReasoningElapsedMs(0);
    const id = setInterval(() => setReasoningElapsedMs(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [isAnalyzing]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Phase 1+2: Active node within the session. Null = latest. Non-null = user has picked a specific node.
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  // Phase 5: Custom session title override (otherwise auto-generated from first query)
  // customSessionTitle — state aus der alten SessionBar entfernt. Canvas
  // verwaltet Projektnamen jetzt eigenstaendig ueber /api/v1/canvas/:id.
  // Phase 5: Past sessions for the picker dropdown
  const [pastSessions, setPastSessions] = useState<Array<{ id: string; name: string; nodeCount: number; queryCount: number; cardCount: number; updatedAt?: string }>>([]);
  const activeProjectIdRef = useRef<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [frameworkModal, setFrameworkModal] = useState<{ icon: string; label: string; desc: string; templateId: string; p: { card: string; icon: string; border: string; type: string; typeBright: string } } | null>(null);
  const [frameworkTopic, setFrameworkTopic] = useState("");
  const [frameworkLoading, setFrameworkLoading] = useState(false);
  // Audit A1-M3 (18.04.2026): framework-launch failures used to pop
  // `window.alert()` which breaks the modal aesthetic and is blocked
  // in some iframe contexts. Render an inline error banner at the
  // bottom of the modal instead.
  const [frameworkError, setFrameworkError] = useState<string | null>(null);
  const [frameworkTopicFocused, setFrameworkTopicFocused] = useState(false);
  // Phase 1 guidance: values of optional structured fields per framework.
  // Keys match FrameworkField.key in canvas-templates.ts. Cleared whenever
  // the modal opens for a new framework.
  const [frameworkFieldValues, setFrameworkFieldValues] = useState<Record<string, string>>({});
  // Textarea (multi-line, auto-growing) replaces the legacy single-line
  // input to prevent horizontal text overflow for longer questions.
  const frameworkTopicRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to fit its content on every change.
  useEffect(() => {
    const el = frameworkTopicRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [frameworkTopic, frameworkModal]);

  // Close framework modal on Escape key
  useEffect(() => {
    if (!frameworkModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFrameworkModal(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [frameworkModal]);
  // demoTab removed — demos moved to /beispiele

  // Load past sessions for the picker on mount
  useEffect(() => {
    fetchWithTimeout("/api/v1/canvas")
      .then(r => r.json())
      .then(data => {
        const list = (data?.data?.canvases ?? data?.canvases ?? []) as Array<any>;
        // Zeige alle benannten Canvases. Frueher wurden leere Projekte
        // (queryCount === 0) gefiltert, damit die Liste "echte" Sessions
        // zeigt. Nutzer erwarten aber "zuletzt geoeffnet" — auch wenn noch
        // keine Query gelaufen ist. Wir behalten nur den Schutz gegen
        // namenslose Geister-Canvases aus fehlgeschlagenen Creates.
        const sessions = list
          .filter((c: any) => !!(c.name && String(c.name).trim()))
          .slice(0, 8)
          .map((c: any) => ({
            id: c.id,
            name: c.name || "Unbenannt",
            // Previously this mapped queryCount into nodeCount, so the Home
            // list showed "6 Nodes" for a project with 6 queries but 65 cards.
            // API now also returns `cardCount` (nodes minus queries) so the
            // "Karten"-label on Home matches the canvas toolbar exactly,
            // instead of one view counting queries as cards and the other not.
            nodeCount: c.nodeCount || 0,
            queryCount: c.queryCount || 0,
            cardCount: typeof c.cardCount === "number"
              ? c.cardCount
              : Math.max(0, (c.nodeCount || 0) - (c.queryCount || 0)),
            updatedAt: c.updated_at,
          }));
        setPastSessions(sessions);
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    // ── URL-Param-Routing vom Trend-Detail-Panel (und /projects) ─────
    //   q=<query>           → nur vorbefuellen, User muss noch klicken
    //   q=... & autostart=1 → Query sofort losschicken (neues Projekt)
    //   q=... & project=<id>→ in bestehendes Projekt als Follow-up
    // Die URL wird nach Auslesen wieder sauber geraeumt (replaceState),
    // damit ein Reload nicht dieselbe Action nochmal triggert.
    const urlQ = params.get("q");
    const urlAutostart = params.get("autostart") === "1";
    const urlProject = params.get("project");
    if (urlQ) {
      const decoded = decodeURIComponent(urlQ);
      setQuery(decoded);
      window.history.replaceState({}, "", window.location.pathname);

      if (urlProject) {
        // In bestehendes Projekt: activeProjectId setzen + als Follow-up
        // starten. handleSubmit liest den aktuellen query-State.
        activeProjectIdRef.current = urlProject;
        setActiveProjectId(urlProject);
        // kurz warten, bis state durch ist, dann submit
        setTimeout(() => {
          try { handleSubmit(decoded); } catch {}
        }, 40);
      } else if (urlAutostart) {
        // Neues Projekt aus dieser Query — bestehendes Verhalten von
        // handleSubmit() erzeugt on-first-submit automatisch einen
        // Canvas, wenn activeProjectIdRef.current leer ist.
        setTimeout(() => {
          try { handleSubmit(decoded); } catch {}
        }, 40);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showFullRadar, setShowFullRadar] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  // Hero command-line is a multi-line textarea (was single-line input) so long
  // questions wrap + the row grows vertically instead of scrolling horizontally
  // and cropping characters on the left edge. Same ref used from both render
  // sites (session-state top bar and first-visit hero) — only one is mounted
  // at a time because of the isFirstVisit gate.
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to match content height on every query change.
  // Reset to "auto" first so it can shrink when text is deleted — otherwise
  // scrollHeight sticks at the previous max.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [query]);

  // Focus input on load, and again whenever a reasoning cycle finishes so
  // the user can immediately type a follow-up. The textarea is unmounted
  // while isAnalyzing is true (ReasoningIndicator takes its slot), so we
  // refocus after it remounts.
  useEffect(() => { if (!isAnalyzing) inputRef.current?.focus(); }, [isAnalyzing]);

  // ── Sync analysis results to Canvas DB ─────────────────────────────────
  // Creates a QueryNode + DerivedNodes and saves them to the active canvas
  // project so Canvas/Board/Orbit views show the same data as Standard view.
  //
  // Critical: the `result` field must match the QueryResult shape the canvas
  // consumes — flat `MatchedTrend[]` for `matchedTrends`, separate `matchedEdges`
  // array, and `usedSignals`. Previously we stored the wrapper-shaped briefing
  // directly which left the Orbit Signale/Trends/Kausal columns at 0.
  /**
   * Persist a home-page briefing into the canvas DB.
   *
   * Project-per-query contract (user request 2026-04):
   * Every new home-page query gets its own `radars` row, named after
   * the query. Follow-ups (prevCtx != null → `isFollowUp === true`)
   * reuse the currently-active project so the follow-up chain stays
   * together.
   *
   * Bonus: we ALSO write a row to `project_queries` so the briefing
   * becomes visible to the Zusammenfassung route (which merges canvas
   * nodes + project_queries). Without this, a home-page query that
   * never gets opened on the canvas would not surface in the
   * per-project summary.
   */
  const syncToCanvasDb = useCallback(async (
    query: string,
    briefing: any,
    entryId: string,
    isFollowUp: boolean,
  ) => {
    try {
      const now = Date.now();
      const uid = () => Math.random().toString(36).slice(2, 10);
      const QX = 80, DX = 580;

      // ── Build a canvas-compatible QueryResult from the briefing ──────────
      // briefing.matchedTrends is TrendMatch[] (wrapper), but the canvas reads
      // QueryResult.matchedTrends as MatchedTrend[] (flat). Prefer the raw API
      // array when queryIntelligenceAsync passed it through.
      const rawMatchedTrends = Array.isArray(briefing.matchedTrendsRaw) && briefing.matchedTrendsRaw.length > 0
        ? briefing.matchedTrendsRaw
        : (briefing.matchedTrends ?? []).map((m: any) => {
            const t = m?.trend ?? m;
            return {
              id: t?.id, name: t?.name, category: t?.category,
              tags: t?.tags ?? [], relevance: t?.relevance ?? 0,
              confidence: t?.confidence ?? 0, impact: t?.impact ?? 0,
              velocity: t?.velocity ?? "stable", ring: t?.ring ?? "",
              signalCount: t?.signalCount ?? 0,
            };
          }).filter((t: any) => !!t.id);

      const matchedEdges = Array.isArray(briefing.matchedEdges) ? briefing.matchedEdges : [];

      const canvasResult = {
        synthesis: briefing.synthesis,
        reasoningChains: briefing.reasoningChains,
        matchedTrendIds: rawMatchedTrends.map((t: any) => t.id),
        keyInsights: briefing.keyInsights,
        scenarios: briefing.scenarios,
        decisionFramework: briefing.decisionFramework,
        references: briefing.references,
        followUpQuestions: briefing.followUpQuestions,
        confidence: briefing.confidence,
        interpretation: briefing.interpretation,
        newsContext: briefing.newsContext,
        regulatoryContext: briefing.regulatoryContext,
        causalAnalysis: briefing.causalChain,
        usedSignals: briefing.usedSignals,
        matchedTrends: rawMatchedTrends,
        matchedEdges,
      };

      // Create QueryNode
      const qId = `sync-${entryId}`;
      const qNode = {
        id: qId, nodeType: "query", x: QX, y: 80,
        query, locale: "de", status: "done",
        synthesis: briefing.synthesis ?? "",
        result: canvasResult, collapsed: false, createdAt: now,
      };

      // Create DerivedNodes (layout mirrors canvas computeDerivedNodes:
      // Col A = insights + decision + followups, Col B = scenarios,
      // Col C = causalgraph — so Orbit "KAUSAL" column fills when edges exist)
      const derived: any[] = [];
      const conns: any[] = [];
      const colA_X = DX, colB_X = DX + 320, colC_X = DX + 640;
      let colA_Y = 80;

      // Col A: Insights
      (briefing.keyInsights ?? []).slice(0, 3).forEach((ins: string) => {
        const id = uid();
        derived.push({ id, nodeType: "insight", x: colA_X, y: colA_Y, parentId: qId, content: ins, queryText: ins, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        colA_Y += 180;
      });

      // Col B: Scenarios
      let scenarioY = 80;
      (briefing.scenarios ?? []).slice(0, 4).forEach((s: any) => {
        const id = uid();
        derived.push({ id, nodeType: "scenario", x: colB_X, y: scenarioY, parentId: qId, content: s.description, label: s.name, colorKey: s.type ?? "baseline", probability: s.probability, keyDrivers: s.keyDrivers, queryText: s.name, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        scenarioY += 200;
      });

      // Col A (continued): Decision
      if (briefing.decisionFramework) {
        const id = uid();
        derived.push({ id, nodeType: "decision", x: colA_X, y: colA_Y, parentId: qId, content: briefing.decisionFramework, queryText: "Entscheidungsrahmen", createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        colA_Y += 180;
      }

      // Col A (continued): Follow-ups
      (briefing.followUpQuestions ?? []).slice(0, 3).forEach((fq: string) => {
        const id = uid();
        derived.push({ id, nodeType: "followup", x: colA_X, y: colA_Y, parentId: qId, content: fq, queryText: fq, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        colA_Y += 140;
      });

      // Col C: Causalgraph — only when we have at least 2 edges between matched trends
      if (matchedEdges.length >= 2) {
        const trendNameMap: Record<string, string> = {};
        rawMatchedTrends.forEach((t: any) => { if (t.id) trendNameMap[t.id] = t.name; });
        const id = uid();
        derived.push({
          id, nodeType: "causalgraph",
          x: colC_X, y: 80, parentId: qId,
          content: "Kausalnetz", label: "KAUSALNETZ",
          queryText: "Vertiefen: Kausalnetz — welche Treiber sind am wirkungsmächtigsten?",
          causalEdges: matchedEdges,
          causalTrendNames: trendNameMap,
          createdAt: now,
        });
        conns.push({ from: qId, to: id, derived: true });
      }

      const allNodes = [qNode, ...derived];

      // Get or create a canvas project
      // API-Envelope-Fix: Alle /api/v1/canvas-Responses laufen durch
      // apiSuccess() → { ok: true, data: { canvas } }. Alter Code las
      // json.canvas direkt und bekam immer undefined zurueck — projectId
      // blieb leer, die nachfolgende PATCH wurde per `if (!projectId)
      // return` uebersprungen, und der canvas_state blieb NULL. Das
      // erklaert den User-Report "Projekte werden nicht gespeichert und
      // sind alle leer". Unwrap defensiv: beide Shapes akzeptieren, falls
      // irgendwo noch ein alter Handler unverpackt antwortet.
      const unwrapCanvas = (json: any) => json?.data?.canvas ?? json?.canvas;

      // Follow-ups continue in the current project; fresh queries get
      // their own brand-new project, even if an active id is still set.
      // This implements the "jede Abfrage via der Startseite = eigenes
      // Projekt" contract.
      let projectId = isFollowUp ? activeProjectIdRef.current : null;
      // Track whether we just created this row so we can clean it up if the
      // subsequent state-write fails. Without cleanup, a failed PATCH leaves
      // an empty-state row in the project list (user-visible symptom: "meine
      // Projekte-Liste quillt mit 'Aktuelles Projekt' ohne Inhalt ueber").
      let createdInThisCall = false;

      if (!projectId) {
        // Derive a meaningful project name from the query. Trim, cap at 80
        // chars (matches the validateStringLength limit in the rename route),
        // strip trailing punctuation. Fallback for pathological inputs.
        const rawName = query.trim().replace(/\s+/g, " ").slice(0, 80).replace(/[.,;:!?\-—–]+$/u, "");
        const name = rawName.length >= 3 ? rawName : (locale === "de" ? "Neue Abfrage" : "New query");

        const res = await fetchWithTimeout("/api/v1/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          console.error("[syncToCanvasDb] POST /api/v1/canvas failed", res.status);
          return;
        }
        const json = await res.json();
        projectId = unwrapCanvas(json)?.id;
        if (!projectId) {
          console.error("[syncToCanvasDb] canvas id missing in response", json);
          return;
        }
        activeProjectIdRef.current = projectId;
        setActiveProjectId(projectId);
        createdInThisCall = true;
      }

      // Load existing canvas state, append new nodes
      const existingRes = await fetchWithTimeout(`/api/v1/canvas/${projectId}`);
      let existingNodes: any[] = [];
      let existingConns: any[] = [];
      if (existingRes.ok) {
        const json = await existingRes.json();
        const existingCanvas = unwrapCanvas(json);
        if (existingCanvas?.canvas_state) {
          const state = JSON.parse(existingCanvas.canvas_state);
          existingNodes = state.nodes ?? [];
          existingConns = state.conns ?? [];
          // Offset new nodes below existing ones
          // Find the maximum Y + estimated card height to prevent overlap
          const maxY = existingNodes.reduce((max: number, n: any) => Math.max(max, (n.y ?? 0) + 250), 0);
          const yShift = maxY + 80;
          qNode.y += yShift;
          derived.forEach((d: any) => { d.y += yShift; });
        }
      }

      // Merge and save
      const mergedState = {
        nodes: [...existingNodes, ...allNodes],
        conns: [...existingConns, ...conns],
        pan: { x: 0, y: 0 },
        zoom: 0.7,
        v: 2,
      };

      const patchRes = await fetchWithTimeout(`/api/v1/canvas/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: mergedState }),
      });
      if (!patchRes.ok) {
        console.error("[syncToCanvasDb] PATCH canvas_state failed", patchRes.status);
        // If we created the row moments ago and the state write failed, we
        // have an empty "Aktuelles Projekt" row with no content. Best-effort
        // cleanup: delete the orphaned row and drop our local refs so the
        // next query starts fresh instead of appending to a dead id.
        if (createdInThisCall) {
          try {
            await fetchWithTimeout(`/api/v1/canvas/${projectId}`, { method: "DELETE" });
          } catch {}
          activeProjectIdRef.current = null;
          setActiveProjectId(null);
        }
        return;
      }

      // Also persist the briefing into `project_queries` so the
      // Zusammenfassung route sees it. The canvas_state write above
      // covers the canvas/board/orbit views; this second write covers
      // the project-detail + per-project summary views. Both writes
      // failing independently is tolerated — the canvas payload is
      // the source of truth and the Zusammenfassung merger de-dupes.
      //
      // Give this POST a 90 s budget (same as BriefingResult) because
      // the /queries route can take 30-60 s on a cold dev-server
      // compile and a premature abort would drop the briefing.
      fetchWithTimeout(`/api/v1/projects/${projectId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          result: {
            synthesis: briefing.synthesis,
            reasoningChains: briefing.reasoningChains,
            keyInsights: briefing.keyInsights,
            regulatoryContext: briefing.regulatoryContext,
            causalChain: briefing.causalChain,
            scenarios: briefing.scenarios,
            interpretation: briefing.interpretation,
            references: briefing.references,
            followUpQuestions: briefing.followUpQuestions,
            newsContext: briefing.newsContext,
            decisionFramework: briefing.decisionFramework,
            confidence: briefing.confidence,
            matchedTrends: rawMatchedTrends,
            usedSignals: briefing.usedSignals,
          },
          locale,
        }),
      }, 90_000).catch((err) => {
        console.warn("[syncToCanvasDb] project_queries write failed", err);
      });
    } catch (e) {
      console.error("[syncToCanvasDb]", e);
    }
  }, [locale]);

  const handleSubmit = useCallback(async (
    overrideQuery?: string,
    prevCtx?: { query: string; synthesis: string },
    // Callers that pre-create a project (framework launch, "open in
    // canvas" handoff) need to keep that project instead of spawning a
    // fresh one. Set `reuseActiveProject: true` in that case.
    opts?: { reuseActiveProject?: boolean },
  ) => {
    const q = (overrideQuery ?? query).trim();
    if (!q || isAnalyzing) return;

    // ── Special commands ──
    if (q === "/radar" || q === "/r") { window.location.href = "/cockpit"; return; }
    if (q === "/graph" || q === "/g") { window.location.href = "/cockpit?tab=netzwerk"; return; }
    if (q === "/close" || q === "/c") { setShowFullRadar(false); setShowGraph(false); setQuery(""); return; }

    // Backlog-Task 2.4 (2026-04-22): weitere Power-User-Shortcuts zum
    // Öffnen zentraler Views ohne Umweg über Menüs. Die Liste deckt die
    // am häufigsten angesprungenen Oberflächen ab — Quellen-Tabelle,
    // Dokumentation, Frameworks, Projekt-Liste. Konsistent zu den
    // schon existierenden /radar, /graph, /live, /help, /context.
    if (q === "/sources" || q === "/q" || q === "/quellen") { window.location.href = "/cockpit?tab=quellen"; return; }
    if (q === "/docs" || q === "/d") { window.location.href = "/dokumentation"; return; }
    if (q === "/frameworks" || q === "/f") { window.location.href = "/frameworks"; return; }
    if (q === "/projects" || q === "/p") { window.location.href = "/projects"; return; }
    if (q === "/monitor" || q === "/m") { window.location.href = "/monitor"; return; }

    // ── Query Shortcuts (Bloomberg Learning 1) ──
    if (q.startsWith("TREND:") || q.startsWith("trend:")) {
      const trendName = q.slice(6).trim();
      window.location.href = `/cockpit?tab=radar&q=${encodeURIComponent(trendName)}`;
      return;
    }
    if (q.startsWith("SIGNAL:") || q.startsWith("signal:")) {
      const filter = q.slice(7).trim();
      window.location.href = `/cockpit?tab=signale&q=${encodeURIComponent(filter)}`;
      return;
    }
    if (q.startsWith("SOURCE:") || q.startsWith("source:") || q.startsWith("QUELLE:") || q.startsWith("quelle:")) {
      const sourceName = q.substring(q.indexOf(":") + 1).trim();
      window.location.href = `/cockpit?tab=quellen&q=${encodeURIComponent(sourceName)}`;
      return;
    }
    if (q.startsWith("FRAMEWORK:") || q.startsWith("framework:")) {
      const topic = q.substring(q.indexOf(":") + 1).trim();
      window.location.href = `/frameworks?topic=${encodeURIComponent(topic)}`;
      return;
    }
    if (q.startsWith("SCENARIO:") || q.startsWith("scenario:") || q.startsWith("SZENARIO:") || q.startsWith("szenario:")) {
      const topic = q.substring(q.indexOf(":") + 1).trim();
      if (topic) {
        try {
          const res = await fetchWithTimeout("/api/v1/canvas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `Szenario: ${topic.substring(0, 50)}` }),
          });
          const json = await res.json();
          // API-Envelope-Fix (apiSuccess wrappt alles in { ok, data }).
          const pid = (json?.data?.canvas ?? json?.canvas)?.id;
          if (pid) {
            activeProjectIdRef.current = pid;
            setActiveProjectId(pid);
            window.location.href = `/canvas?project=${pid}`;
            return;
          }
        } catch {}
      }
      window.location.href = "/canvas";
      return;
    }

    if (q === "/live") {
      fetchWithTimeout("/api/v1/pipeline", { method: "POST" });
      setHistory((prev) => [{
        query: "/live",
        briefing: {
          query: "/live", matchedTrends: [],
          synthesis: locale === "de" ? "Live-Daten werden geladen..." : "Fetching live data...",
          keyInsights: [], regulatoryContext: [], causalChain: [], reasoningChains: [],
          signalSummary: "", confidence: 0, dataPoints: 0,
        },
        timestamp: new Date(),
      }, ...prev]);
      setQuery(""); return;
    }

    if (q === "/en" || q === "/de") { toggleLocale(); setQuery(""); return; }

    if (q === "/help" || q === "/h") {
      setHistory((prev) => [{
        query: "/help",
        briefing: {
          query: "/help", matchedTrends: [],
          synthesis: "",
          keyInsights: locale === "de" ? [
            "Tippe ein Stichwort oder eine Frage — z.B. 'AI', 'Klimawandel', 'Taiwan', 'Cybersecurity'",
            "Navigation: /radar (/r) · /graph (/g) · /sources (/q) · /docs (/d) · /frameworks (/f) · /projects (/p) · /monitor (/m)",
            "Shortcut-Suchen: TREND:AI · SIGNAL:rising · SOURCE:Guardian · SCENARIO:Wintersport Europa · FRAMEWORK:war-gaming",
            "/close oder /c — Radar/Graph schließen",
            "/live — Live-Daten von allen Quellen laden",
            "/context — Persona/Kontext setzen (z. B. /context cto-automotive-dach)",
            "/en oder /de — Sprache wechseln",
            "/clear — Verlauf löschen",
            "Klicke auf einen Trend-Chip um Details zu sehen",
          ] : [
            "Type a keyword or question — e.g. 'AI', 'climate change', 'Taiwan', 'cybersecurity'",
            "Navigation: /radar (/r) · /graph (/g) · /sources (/q) · /docs (/d) · /frameworks (/f) · /projects (/p) · /monitor (/m)",
            "Shortcut searches: TREND:AI · SIGNAL:rising · SOURCE:Guardian · SCENARIO:Winter Sports Europe · FRAMEWORK:war-gaming",
            "/close or /c — Close radar/graph view",
            "/live — Fetch live data from all sources",
            "/context — Set persona/context (e.g. /context cto-automotive-dach)",
            "/en or /de — Switch language",
            "/clear — Clear history",
            "Click any trend chip to see details",
          ],
          regulatoryContext: [], causalChain: [], reasoningChains: [],
          signalSummary: "", confidence: 1, dataPoints: 0,
        },
        timestamp: new Date(),
      }, ...prev]);
      setQuery(""); return;
    }

    if (q === "/clear") {
      setHistory([]); clearHistoryStorage(); setQuery("");
      const cid = activeProjectIdRef.current;
      if (cid) fetchWithTimeout(`/api/v1/canvas/${cid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canvasState: JSON.stringify({ nodes: [], conns: [], pan: { x: 0, y: 0 }, zoom: 1, v: 2 }) }) }).catch(() => {});
      return;
    }

    // ── /context command ──
    if (q.startsWith("/context")) {
      const contextText = q.replace("/context", "").trim();

      if (!contextText) {
        const presetList = PRESET_PROFILES.map((p) => `  ${p.id}: ${p.role} / ${p.industry} / ${p.region}`).join("\n");
        setHistory((prev) => [{
          query: "/context",
          briefing: {
            query: "/context", matchedTrends: [],
            synthesis: contextProfile
              ? `${locale === "de" ? "Aktueller Kontext" : "Current context"}: ${contextProfile.role} / ${contextProfile.industry} / ${contextProfile.region}`
              : (locale === "de" ? "Kein Kontext gesetzt." : "No context set."),
            keyInsights: locale === "de" ? [
              "Beschreibe deinen Kontext: /context CTO Automotive DACH",
              "Oder nutze ein Preset: /context cto-automotive-dach",
              "Kontext zurücksetzen: /context reset",
              `Verfügbare Presets:\n${presetList}`,
            ] : [
              "Describe your context: /context CTO Automotive DACH",
              "Or use a preset: /context cto-automotive-dach",
              "Reset context: /context reset",
              `Available presets:\n${presetList}`,
            ],
            regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }

      if (contextText === "reset") {
        setContextProfile(null);
        setHistory((prev) => [{
          query: "/context reset",
          briefing: {
            query: "/context reset", matchedTrends: [],
            synthesis: locale === "de" ? "Kontext zurückgesetzt. Neutrale Perspektive." : "Context reset. Neutral perspective.",
            keyInsights: [], regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }

      const preset = PRESET_PROFILES.find((p) => p.id === contextText);
      if (preset) {
        setContextProfile(preset);
        setHistory((prev) => [{
          query: `/context ${contextText}`,
          briefing: {
            query: `/context ${contextText}`, matchedTrends: [],
            synthesis: locale === "de"
              ? `Kontext gesetzt: ${preset.role} / ${preset.industry} / ${preset.region}. Alle Scores werden durch diese Linse rekalibriert.`
              : `Context set: ${preset.role} / ${preset.industry} / ${preset.region}. All scores recalibrated through this lens.`,
            keyInsights: [`${locale === "de" ? "Regulatorischer Fokus" : "Regulatory focus"}: ${preset.regulationFocus.join(", ")}`],
            regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }

      const parsed = parseContextFromText(contextText);
      if (parsed.role || parsed.industry || parsed.region) {
        const newProfile: ContextProfile = {
          id: "custom",
          role: parsed.role || "General",
          industry: parsed.industry || "Cross-Industry",
          region: parsed.region || "Global",
          orgSize: parsed.orgSize,
          trendWeights: {},
          regulationFocus: parsed.region === "DACH" || parsed.region === "EU" ? ["EU", "Global"] : [parsed.region || "Global"],
          sourcePreferences: {},
        };
        setContextProfile(newProfile);
        setHistory((prev) => [{
          query: `/context ${contextText}`,
          briefing: {
            query: `/context ${contextText}`, matchedTrends: [],
            synthesis: locale === "de"
              ? `Kontext erkannt: ${newProfile.role} / ${newProfile.industry} / ${newProfile.region}${newProfile.orgSize ? ` / ${newProfile.orgSize}` : ""}. Perspektive angepasst.`
              : `Context detected: ${newProfile.role} / ${newProfile.industry} / ${newProfile.region}${newProfile.orgSize ? ` / ${newProfile.orgSize}` : ""}. Perspective adjusted.`,
            keyInsights: [], regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }
    }

    // ── Real query — start loading ──
    setIsAnalyzing(true);
    const entryId = `${q}-${Date.now()}`;
    setHistory((prev) => [{
      id: entryId,
      query: q,
      isLoading: true,
      briefing: {
        query: q, matchedTrends: [],
        synthesis: "",
        reasoningChains: [], keyInsights: [], regulatoryContext: [], causalChain: [],
        signalSummary: "", confidence: 0, dataPoints: 0,
      },
      timestamp: new Date(),
      parentQuery: prevCtx?.query, // link to parent if this is a follow-up
      pipelineStages: defaultPipelineStages(),
    }, ...prev]);
    // New query always becomes the active node in the session
    setActiveNodeId(entryId);
    setQuery("");

    const ctxProfile = contextProfile
      ? { role: contextProfile.role, industry: contextProfile.industry, region: contextProfile.region }
      : undefined;

    // Stream synthesis tokens in real-time
    let streamedSynthesis = "";
    const onSynthesisChunk = (chunk: string) => {
      streamedSynthesis += chunk;
      setHistory((prev) => prev.map((e) =>
        e.id === entryId
          ? { ...e, isLoading: true, briefing: { ...e.briefing, synthesis: streamedSynthesis } }
          : e
      ));
    };

    // Track pipeline stage transitions. Mutate a ref-like local map so each
    // callback flips exactly one stage; React commits the updated copy per call.
    const localStages: PipelineStageMap = defaultPipelineStages();
    const onStage = (ev: PipelineStageEvent) => {
      const prev = localStages[ev.stage];
      localStages[ev.stage] = {
        status: ev.status === "done" ? "done" : "active",
        count: ev.count ?? prev.count,
      };
      // Clone so React sees a new object reference.
      const snapshot: PipelineStageMap = {
        frage: { ...localStages.frage },
        signale: { ...localStages.signale },
        trends: { ...localStages.trends },
        kausal: { ...localStages.kausal },
        erkenntnisse: { ...localStages.erkenntnisse },
        szenarien: { ...localStages.szenarien },
        empfehlungen: { ...localStages.empfehlungen },
      };
      setHistory((prevH) => prevH.map((e) =>
        e.id === entryId ? { ...e, pipelineStages: snapshot } : e
      ));
    };

    queryIntelligenceAsync(q, trends, locale, ctxProfile, onSynthesisChunk, prevCtx, onStage)
      .then((llmBriefing) => {
        if (llmBriefing && llmBriefing.synthesis && llmBriefing.synthesis.length > 20) {
          // ✅ LLM succeeded — full structured briefing
          setHistory((prev) => prev.map((e) =>
            e.id === entryId
              ? { ...e, isLoading: false, error: undefined, briefing: llmBriefing, showRadar: llmBriefing.matchedTrends.length > 2 }
              : e
          ));

          setIsAnalyzing(false);
          // ── Sync to Canvas DB so Canvas/Board views show the same data ──
          // Run AFTER setIsAnalyzing(false) so a canvas sync error doesn't
          // block the UI. `prevCtx != null` means this query was triggered
          // as a follow-up from an earlier briefing — keep it in the same
          // project. A fresh top-level query spawns a new project.
          syncToCanvasDb(q, llmBriefing, entryId, !!prevCtx || !!opts?.reuseActiveProject).catch(() => {});
        } else {
          setIsAnalyzing(false);
          // ❌ LLM returned null or empty synthesis — show error, no silent fallback
          setHistory((prev) => prev.map((e) =>
            e.id === entryId
              ? { ...e, isLoading: false, error: locale === "de"
                  ? "Die KI-Analyse hat keine verwertbare Antwort geliefert. Möglicherweise ist die Anfrage zu kurz oder das System überlastet."
                  : "The AI analysis returned no usable response. The query may be too short or the system is overloaded." }
              : e
          ));
        }
      })
      .catch((err: unknown) => {
        setIsAnalyzing(false);
        // ❌ Network or API error — show specific error, no silent fallback
        const msg = err instanceof Error ? err.message : String(err);
        setHistory((prev) => prev.map((e) =>
          e.id === entryId
            ? { ...e, isLoading: false, error: locale === "de"
                ? `Verbindungsfehler: ${msg}. Bitte erneut versuchen.`
                : `Connection error: ${msg}. Please try again.` }
            : e
        ));
      });
  }, [query, trends, locale, toggleLocale, contextProfile, isAnalyzing, syncToCanvasDb]);

  // Framework submit: route framework-modal topics through the same 7-stage
  // pipeline as hero queries, with a framework-specific directive prefix so the
  // LLM shapes its synthesis/scenarios/decisionFramework around that method.
  //
  // The canvas is created UP FRONT with a framework-prefixed name so it shows
  // up in the project list right away; handleSubmit's syncToCanvasDb then
  // reuses that same canvas via activeProjectIdRef.current. No template build
  // is run — the LLM produces the real content, no placeholder query cards.
  const launchFrameworkAnalysis = useCallback(async () => {
    if (!frameworkModal || !frameworkTopic.trim() || frameworkLoading) return;
    setFrameworkLoading(true);
    try {
      const fw = FRAMEWORKS.find(f => f.id === frameworkModal.templateId);
      if (!fw) { setFrameworkLoading(false); return; }
      const mainTopic = frameworkTopic.trim();
      const enrichedQuery = buildFrameworkQuery(fw, mainTopic, frameworkFieldValues, locale);

      // Create the canvas so it carries the framework label and lands in the
      // project list even if the user navigates away before the pipeline ends.
      // Pipeline output gets appended into this canvas via syncToCanvasDb.
      const res = await fetchWithTimeout("/api/v1/canvas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${frameworkModal.label}: ${mainTopic}` }),
      });
      if (!res.ok) {
        setFrameworkLoading(false);
        setFrameworkError(locale === "de" ? "Projekt konnte nicht erstellt werden." : "Could not create project.");
        return;
      }
      const json = await res.json();
      // API-Envelope-Fix: apiSuccess → { ok, data: { canvas } }.
      const pid = (json?.data?.canvas ?? json?.canvas)?.id;
      if (!pid) { setFrameworkLoading(false); return; }
      activeProjectIdRef.current = pid;
      setActiveProjectId(pid);

      // Close the modal, clear its state, then run the hero-query pipeline
      // with the enriched query — user now watches the SequentialPipeline
      // reveal on Home exactly as a normal hero query would.
      setFrameworkModal(null);
      setFrameworkTopic("");
      setFrameworkFieldValues({});
      setFrameworkLoading(false);
      // Reuse the canvas we just created; without this flag the new
      // project-per-query rule would spawn a SECOND canvas and leave
      // the framework-named one empty.
      await handleSubmit(enrichedQuery, undefined, { reuseActiveProject: true });
    } catch (err) {
      setFrameworkLoading(false);
      console.error("[launchFrameworkAnalysis]", err);
      setFrameworkError(locale === "de" ? "Fehler beim Starten der Analyse." : "Error starting analysis.");
    }
  }, [frameworkModal, frameworkTopic, frameworkLoading, frameworkFieldValues, locale, handleSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter submits; Shift+Enter inserts a newline (textarea default). Matches
    // the framework-modal textarea behavior so the hero and modal feel alike.
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const suggestions = locale === "de"
    ? ["AI Regulierung", "Klimawandel", "Taiwan", "Cybersecurity", "Zukunft der Arbeit", "Geopolitik"]
    : ["AI regulation", "climate change", "Taiwan", "cybersecurity", "future of work", "geopolitics"];

  const isFirstVisit = history.length === 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <AppHeader />

      {/* ── Full Radar / Graph ───────────────────────────────────── */}
      {showFullRadar && (
        <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <RadarView trends={trends} onTrendClick={setSelectedTrend} locale={locale} />
        </div>
      )}
      {showGraph && (
        <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <CausalGraphView trends={trends} onTrendClick={setSelectedTrend} locale={locale} highlightTrendId={selectedTrend?.id} />
        </div>
      )}

      {/* ── Main (Briefing) View ─────────────────────────────────── */}
      {/* First-visit: vertically center the framework+command-line+projects block
          so it stays in the optical middle regardless of viewport height.
          Session/history state anchors to the top as before. */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: isFirstVisit && !showFullRadar ? "center" : "flex-start",
        paddingTop: 0,
        paddingBottom: isFirstVisit && !showFullRadar ? 60 : 0,
        position: "relative",
      }}>

        {/* Hero + Search — only render the command line here when NOT first visit */}
        <div style={{
          maxWidth: 700, margin: "0 auto", width: "100%",
          padding: isFirstVisit && !showFullRadar ? "0" : "20px 24px 0",
          position: "relative",
        }}>
          {/* Session-state follow-up command-line removed: during an active
               session the only query entry point is the hero command-line on
               first visit. While a pipeline runs, the ReasoningIndicator
               (with its pixel-man walkway) is the sole active UI element
               above the pipeline card. */}

          {/* Framework Topic Modal */}
          {frameworkModal && (
            <>
              <div
                onClick={() => setFrameworkModal(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(3px)", zIndex: 40 }}
              />
              <div style={{
                position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                zIndex: 41, width: "100%", maxWidth: 480,
                background: "var(--volt-surface-raised, #fff)", borderRadius: 16,
                border: `1px solid ${frameworkModal.p.border}`,
                padding: "28px 32px",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: frameworkModal.p.icon,
                    border: `1px solid ${frameworkModal.p.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Image src={frameworkModal.icon} alt="" width={22} height={22} style={{ opacity: 0.85 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: frameworkModal.p.type }}>
                      {frameworkModal.label}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                      {frameworkModal.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => setFrameworkModal(null)}
                    style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: "var(--color-text-muted)", cursor: "pointer", padding: 4 }}
                  >✕</button>
                </div>

                {/* ── Phase 1: Framework-specific question guidance ───────
                     Pulls the guidance object from FRAMEWORKS by templateId
                     and renders a shape explainer + clickable example chips
                     + optional structured field inputs. If no guidance is
                     defined for a framework, the modal falls back to the
                     legacy single-input layout. */}
                {(() => {
                  const fw = FRAMEWORKS.find(f => f.id === frameworkModal.templateId);
                  const guidance = fw?.guidance;
                  if (!guidance) return null;
                  return (
                    <div style={{ marginBottom: 18 }}>
                      {/* Shape explainer — the only guidance now.
                           Examples were removed per user feedback: they led
                           to copy-paste instead of users formulating their
                           own specific question. */}
                      <div style={{
                        padding: "12px 14px",
                        borderRadius: "var(--volt-radius-md, 10px)",
                        background: frameworkModal.p.card,
                        border: `1px solid ${frameworkModal.p.border}`,
                      }}>
                        <div style={{
                          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: frameworkModal.p.type,
                          marginBottom: 6,
                        }}>
                          {locale === "de" ? "So muss deine Frage aussehen" : "How your question should look"}
                        </div>
                        <div style={{
                          fontSize: 12, lineHeight: 1.55,
                          color: "var(--volt-text, #0A0A0A)",
                        }}>
                          {locale === "de" ? guidance.questionShape.de : guidance.questionShape.en}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Question Input — force concrete question formulation.
                     Topic keywords ("KI", "Automotive") are explicitly
                     discouraged by label + placeholder + shape explainer. */}
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 8 }}>
                  {locale === "de" ? "Stelle deine konkrete Frage" : "Ask your concrete question"}
                </label>
                {/* Auto-growing textarea container — vertical stack so long
                     questions wrap and the container grows with the content.
                     Submit button sits at the bottom-right, only shown when
                     the textarea has text. Enter submits, Shift+Enter = new
                     line. */}
                <div
                  style={{
                    display: "flex", flexDirection: "column",
                    padding: "14px 18px",
                    minHeight: 52,
                    borderRadius: "var(--volt-radius-lg, 14px)",
                    border: frameworkTopicFocused ? "1.5px solid var(--volt-text, #0A0A0A)" : "1.5px solid var(--volt-border, #E8E8E8)",
                    transition: "border-color 150ms ease",
                    background: "var(--volt-surface-raised, #fff)",
                    position: "relative",
                  }}
                  // Clicking anywhere in the padded container forwards focus
                  // to the textarea — both focus and placeholder-hide are
                  // then driven by the native focus event.
                  onClick={() => frameworkTopicRef.current?.focus()}
                >
                  <textarea
                    ref={frameworkTopicRef}
                    value={frameworkTopic}
                    rows={1}
                    onChange={(e) => {
                      setFrameworkTopic(e.target.value);
                      // Immediate auto-grow on input — effect also fires,
                      // but inline makes the transition feel tighter.
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onKeyDown={async (e) => {
                      // Enter submits, Shift+Enter inserts a newline
                      if (e.key === "Enter" && !e.shiftKey && frameworkTopic.trim() && !frameworkLoading) {
                        e.preventDefault();
                        await launchFrameworkAnalysis();
                      }
                    }}
                    onFocus={() => setFrameworkTopicFocused(true)}
                    onBlur={() => setFrameworkTopicFocused(false)}
                    // Placeholder and cursor are mutually exclusive: while
                    // the field is unfocused the preview text is visible
                    // and the BlockCursor is hidden; clicking (or tabbing)
                    // in switches both — placeholder clears and cursor
                    // appears. This exactly mirrors the user spec "Cursor
                    // und Vorschautext dürfen nicht zeitgleich in der
                    // Command-Line stehen".
                    placeholder={
                      frameworkTopicFocused
                        ? ""
                        : locale === "de"
                          ? "Formuliere eine vollständige, konkrete Frage…"
                          : "Formulate a complete, concrete question…"
                    }
                    style={{
                      width: "100%",
                      minHeight: 24,
                      resize: "none",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "var(--volt-text, #0A0A0A)",
                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                      fontSize: 15,
                      lineHeight: 1.5,
                      overflow: "hidden",
                      padding: 0,
                      caretColor: "transparent",
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <BlockCursor
                    targetRef={frameworkTopicRef}
                    value={frameworkTopic}
                    focused={frameworkTopicFocused}
                    // Cursor picks up the framework's pastel button colour
                    // (same token used for the tile background at line 1353)
                    // so each framework signals its identity right down to
                    // the blinking caret.
                    color={frameworkModal.p.icon}
                  />
                </div>

                {/* ── Phase 1: Optional structured fields + anti-example + submit ─
                     Group fields under an "Optionaler Kontext" header so users
                     immediately see they're not required. Submit button lives at
                     the absolute bottom of the modal (not inside the textarea)
                     so the flow is: shape → question → context → warning → submit. */}
                {(() => {
                  const fw = FRAMEWORKS.find(f => f.id === frameworkModal.templateId);
                  const guidance = fw?.guidance;
                  return (
                    <>
                      {guidance?.fields && guidance.fields.length > 0 && (
                        <div style={{ marginTop: 22 }}>
                          {/* Group header — signals these are optional refinements */}
                          <div style={{
                            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--volt-text-faint, #999)",
                            marginBottom: 10,
                            display: "flex", alignItems: "center", gap: 8,
                          }}>
                            <span>{locale === "de" ? "Optionaler Kontext" : "Optional context"}</span>
                            <span style={{ flex: 1, height: 1, background: "var(--volt-border, #EEE)" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {guidance.fields.map(field => {
                              // Strip "(optional)" from labels — now redundant because the whole group is labeled Optional
                              const labelRaw = locale === "de" ? field.labelDe : field.labelEn;
                              const label = labelRaw.replace(/\s*\((optional|optional)\)\s*$/i, "");
                              return (
                                <div key={field.key}>
                                  <label style={{
                                    display: "block",
                                    fontSize: 11, fontWeight: 600,
                                    color: "var(--volt-text-muted, #6B6B6B)",
                                    marginBottom: 4,
                                    fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                                  }}>
                                    {label}
                                  </label>
                                  <input
                                    type="text"
                                    value={frameworkFieldValues[field.key] ?? ""}
                                    onChange={(e) => setFrameworkFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); /* prevent accidental submit from a field */ }}
                                    placeholder={locale === "de" ? field.placeholderDe : field.placeholderEn}
                                    style={{
                                      width: "100%",
                                      padding: "8px 12px",
                                      fontSize: 13,
                                      border: "1px solid var(--volt-border, #E8E8E8)",
                                      borderRadius: "var(--volt-radius-sm, 8px)",
                                      background: "var(--volt-surface-raised, #fff)",
                                      color: "var(--volt-text, #0A0A0A)",
                                      outline: "none",
                                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                                      boxSizing: "border-box",
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--volt-text, #0A0A0A)"; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {guidance?.antiExample && (
                        <p style={{
                          fontSize: 11,
                          color: "var(--volt-text-muted, #6B6B6B)",
                          margin: "18px 0 0",
                          lineHeight: 1.5,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                        }}>
                          <span style={{ flexShrink: 0, color: "var(--volt-text-faint, #BBB)" }}>⚠</span>
                          <span>{locale === "de" ? guidance.antiExample.de : guidance.antiExample.en}</span>
                        </p>
                      )}

                      {/* Workflow explanation — always visible so users know what happens next */}
                      <p style={{ fontSize: 11, color: "var(--volt-text-muted, #6B6B6B)", margin: "14px 0 0", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ flexShrink: 0, fontSize: 12, opacity: 0.5 }}>→</span>
                        <span>
                          {locale === "de"
                            ? "Erstellt eine strukturierte Analyse im Canvas: Frage, Insights, Szenarien und Handlungsempfehlung — in einem geführten Workflow."
                            : "Creates a structured analysis in the Canvas: question, insights, scenarios, and recommendations — in a guided workflow."}
                        </span>
                      </p>

                      {/* Audit A1-M3 (18.04.2026): inline error banner
                           replaces the old `alert()` on framework-
                           launch failure. */}
                      {frameworkError && (
                        <div
                          role="alert"
                          style={{
                            marginTop: 16,
                            padding: "9px 12px",
                            borderRadius: 8,
                            background: "var(--signal-negative-light, #FDEDEA)",
                            border: "1px solid var(--signal-negative, #C0341D)",
                            color: "var(--signal-negative, #C0341D)",
                            fontSize: 13, display: "flex", gap: 8, alignItems: "center",
                          }}
                        >
                          <span style={{ flex: 1 }}>{frameworkError}</span>
                          <button
                            onClick={() => setFrameworkError(null)}
                            aria-label={locale === "de" ? "Schließen" : "Close"}
                            style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
                          >✕</button>
                        </div>
                      )}
                      {/* ── Absolute bottom: Submit button row ──────────
                           Divider + right-aligned Analyse button. Button is
                           disabled until the main question has text — optional
                           context fields don't gate activation. */}
                      <div style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: "1px solid var(--volt-border, #EEE)",
                        display: "flex",
                        justifyContent: "flex-end",
                      }}>
                        <button
                          onClick={launchFrameworkAnalysis}
                          disabled={frameworkLoading || !frameworkTopic.trim()}
                          className={frameworkLoading || !frameworkTopic.trim() ? "" : "sis-shimmer-btn"}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            height: 40,
                            padding: "0 22px",
                            borderRadius: "var(--volt-radius-md, 10px)",
                            background: frameworkLoading
                              ? "var(--volt-surface, #F7F7F7)"
                              : !frameworkTopic.trim()
                                ? "var(--volt-surface, #F0F0F0)"
                                : "var(--volt-lime, #E4FF97)",
                            color: frameworkLoading || !frameworkTopic.trim()
                              ? "var(--volt-text-faint, #BBB)"
                              : "#0A0A0A",
                            border: "none",
                            cursor: frameworkLoading
                              ? "wait"
                              : !frameworkTopic.trim()
                                ? "not-allowed"
                                : "pointer",
                            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                            transition: "background-color 160ms ease, color 160ms ease",
                          }}
                        >
                          {frameworkLoading
                            ? (locale === "de" ? "Analyse wird gestartet…" : "Starting analysis…")
                            : (locale === "de" ? "Analyse starten →" : "Start analysis →")}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}

        </div>

        {/* Framework grid — empty state primary entry point.
             Outer div holds the viewport-edge padding (24px) so it sits OUTSIDE
             the 700px maxWidth — matching the command line container below so
             the framework buttons and the command line have the same total width. */}
        {isFirstVisit && !showFullRadar && (
          <div style={{ paddingLeft: 24, paddingRight: 24 }}>
            <div style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}>
            <div style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: "var(--volt-text-faint, #BBB)",
              marginBottom: 12, textAlign: "center",
            }}>
              {locale === "de" ? "Starte mit einem Framework" : "Start with a framework"}
            </div>
            <div className="sis-framework-grid">
              {([
                {
                  icon: "/icons/methoden/marktanalyse/marktanalyse-layout-grid.svg",
                  type: locale === "de" ? "Analyse" : "Analysis",
                  label: locale === "de" ? "Marktanalyse" : "Market Analysis",
                  desc: locale === "de" ? "Marktposition · Wettbewerbsdynamik" : "Market position · Competitive dynamics",
                  tip: locale === "de"
                    ? "Systematische SWOT+PESTEL-Analyse zu Marktposition und Wettbewerbsdynamik. Verbindet interne Stärken/Schwächen mit externen Chancen/Risiken."
                    : "Systematic SWOT+PESTEL analysis on market position and competitive dynamics. Connects internal strengths/weaknesses with external opportunities/risks.",
                  flow: locale === "de"
                    ? "Kontext → Intern → Extern → Optionen → Priorisierung"
                    : "Context → Internal → External → Options → Prioritization",
                  templateId: "market-analysis",
                  // `type` is tuned for pastel-card backgrounds; `typeBright` is
                  // the high-contrast variant for the dark tooltip background.
                  p: { card: "#EEF5FF", icon: "#D4E8FF", border: "#C0D8F4", type: "#1A4A8A", typeBright: "#8EC5FF" },
                },
                {
                  icon: "/icons/methoden/war-gaming/war-gaming-swords.svg",
                  type: locale === "de" ? "Strategie" : "Strategy",
                  label: "War-Gaming",
                  desc: locale === "de" ? "Gegnermodelle · Strategische Reaktion" : "Opponent models · Strategic response",
                  tip: locale === "de"
                    ? "Szenario-basierte Strategieplanung (RAND, Shell). Prämisse: Die Zukunft ist nicht vorhersagbar — entwickelt robuste Strategien für mehrere mögliche Zukünfte."
                    : "Scenario-based strategy (RAND, Shell). Premise: the future isn't predictable — build strategies robust across multiple futures.",
                  flow: locale === "de" ? "Driving Forces → 3 Szenarien → Robuste Strategie" : "Driving Forces → 3 Scenarios → Robust Strategy",
                  templateId: "war-gaming",
                  p: { card: "#FFF0F4", icon: "#FFD6E0", border: "#F4B8C8", type: "#A0244A", typeBright: "#FF9AB3" },
                },
                {
                  icon: "/icons/methoden/pre-mortem/pre-mortem-triangle-alert.svg",
                  type: locale === "de" ? "Früherkennung" : "Prevention",
                  label: "Pre-Mortem",
                  desc: locale === "de" ? "Risiken · Proaktive Risikoanalyse" : "Risks · Proactive failure analysis",
                  tip: locale === "de"
                    ? "Prospective Hindsight (Gary Klein, 1989). Teams identifizieren nachweislich 30% mehr Risiken, wenn sie sich das Scheitern als bereits eingetreten vorstellen."
                    : "Prospective hindsight (Gary Klein, 1989). Teams identify ~30% more risks when imagining failure as already occurred.",
                  flow: locale === "de"
                    ? "Scheitern vorstellen → Risiken bewerten → Gegenmaßnahmen"
                    : "Imagine failure → Assess risks → Countermeasures",
                  templateId: "pre-mortem",
                  p: { card: "#FFF8F0", icon: "#FFECD2", border: "#F0D4A8", type: "#955A20", typeBright: "#FFC078" },
                },
                {
                  icon: "/icons/methoden/post-mortem/post-mortem-search.svg",
                  type: locale === "de" ? "Retrospektive" : "Retrospective",
                  label: "Post-Mortem",
                  desc: locale === "de" ? "Ursachen · Systematische Lernschleifen" : "Root causes · Systematic learning",
                  tip: locale === "de"
                    ? "Ursachenanalyse mit 5-Whys (Toyota) und Ishikawa-Diagramm. Trennt strukturelle, konjunkturelle und situative Ursachen statt sie zu verwechseln."
                    : "Root cause analysis with 5-Whys (Toyota) and Ishikawa. Separates structural, cyclical and situational causes rather than conflating them.",
                  flow: locale === "de"
                    ? "Chronologie → 3-Ebenen-Ursachen → Lessons Learned"
                    : "Timeline → 3-layer causes → Lessons learned",
                  templateId: "post-mortem",
                  p: { card: "#EEFAF4", icon: "#C3F4D3", border: "#90DCA8", type: "#0F6038", typeBright: "#6EE0A5" },
                },
                {
                  icon: "/icons/methoden/trend-deep-dive/trend-deep-dive-microscope.svg",
                  type: locale === "de" ? "Intelligence" : "Intelligence",
                  label: "Trend Deep-Dive",
                  desc: locale === "de" ? "Treiber · Systemische Trendanalyse" : "Drivers · Systemic trend analysis",
                  tip: locale === "de"
                    ? "STEEP+V-Framework angewendet auf einen einzelnen Trend. Referenz: EU JRC 14 Megatrends der Europäischen Kommission."
                    : "STEEP+V framework applied to a single trend. Reference: EU JRC 14 Megatrends of the European Commission.",
                  flow: locale === "de"
                    ? "Definition → Evidenz → Treiber → Impact → Handlung"
                    : "Definition → Evidence → Drivers → Impact → Action",
                  templateId: "trend-deep-dive",
                  p: { card: "#FBF0FF", icon: "#F0D4FF", border: "#D8A8F0", type: "#7C1A9E", typeBright: "#DCA0FF" },
                },
                {
                  icon: "/icons/methoden/stakeholder/stakeholder-users-round.svg",
                  type: locale === "de" ? "Mapping" : "Mapping",
                  label: "Stakeholder",
                  desc: locale === "de" ? "Akteure · Koalitionen · Dynamiken" : "Actors · Coalitions · Power dynamics",
                  tip: locale === "de"
                    ? "Mitchell Salience Model (1997): Power × Legitimacy × Urgency, kombiniert mit Interest/Influence-Matrix. Zeigt, wer Entscheidungen wirklich bewegt."
                    : "Mitchell Salience Model (1997): Power × Legitimacy × Urgency, combined with Interest/Influence matrix. Reveals who actually moves decisions.",
                  flow: locale === "de"
                    ? "Identifizieren → Bewerten → Dynamiken → Engagement"
                    : "Identify → Assess → Dynamics → Engagement",
                  templateId: "stakeholder-mapping",
                  p: { card: "#FFFDE8", icon: "#FFF5BA", border: "#E8D870", type: "#7A5C00", typeBright: "#F5DC5C" },
                },
                {
                  // 2026-04-22 (Backlog: neues 7. Framework „Design Thinking").
                  // Die Home-Liste war bisher hardcoded auf 6 Einträge; Design
                  // Thinking existiert zwar in FRAMEWORK_META + /frameworks-
                  // Grid, blieb aber auf der Startseite unsichtbar. Hier als
                  // siebte Kachel nachgetragen, Farbe an orange-Akzent
                  // angelehnt (konsistent mit types/frameworks.ts).
                  icon: "/icons/methoden/stakeholder/stakeholder-users-round.svg",
                  type: locale === "de" ? "Human-Centered" : "Human-Centered",
                  label: "Design Thinking",
                  desc: locale === "de" ? "Empathie · Reframing · Lösungsraum" : "Empathy · Reframing · Solution space",
                  tip: locale === "de"
                    ? "Human-centered Strategic Design in 4 Schritten: Empathize → Define → Ideate → Validate. Jede Phase liefert ein überprüfbares Artefakt, Validate-Phase verlangt Success- UND Kill-Metrik."
                    : "Human-centered strategic design in 4 steps: Empathize → Define → Ideate → Validate. Each phase produces a testable artifact; Validate requires both a success AND a kill metric.",
                  flow: locale === "de"
                    ? "Empathie → Problem reframen → Divergent ideieren → Validieren"
                    : "Empathize → Reframe problem → Diverge → Validate",
                  templateId: "design-thinking",
                  p: { card: "#FFF4E6", icon: "#FFE1C1", border: "#F0C088", type: "#B45309", typeBright: "#FFB87A" },
                },
              ] as { icon: string; type: string; label: string; desc: string; tip: string; flow: string; templateId: string; p: { card: string; icon: string; border: string; type: string; typeBright: string } }[]).map(t => (
                <Tooltip
                  key={t.templateId}
                  placement="top"
                  maxWidth={320}
                  content={
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: t.p.typeBright, marginBottom: 4 }}>
                        {t.type} · {t.label}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>{t.tip}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.4, color: "rgba(255,255,255,0.65)", fontFamily: "var(--volt-font-mono, monospace)" }}>
                        {t.flow}
                      </div>
                    </div>
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.label} — ${t.desc}`}
                    onClick={() => { setFrameworkModal(t); setFrameworkTopic(""); setFrameworkFieldValues({}); }}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { setFrameworkModal(t); setFrameworkTopic(""); setFrameworkFieldValues({}); } }}
                    className="sis-framework-btn cursor-pointer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      height: 32,
                      padding: "0 14px 0 8px",
                      background: t.p.icon,
                      border: "none",
                      borderRadius: 8, outline: "none",
                      transition: "transform 140ms ease, filter 140ms ease",
                    }}
                  >
                    <span
                      style={{
                        width: 20, height: 20, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Image src={t.icon} alt="" width={16} height={16} style={{ opacity: 0.9 }} />
                    </span>
                    <div className="font-display font-bold tracking-tight" style={{ fontSize: 13, color: "var(--volt-text, #0A0A0A)", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.label}
                    </div>
                  </div>
                </Tooltip>
              ))}
            </div>

            </div>
          </div>
        )}

        {/* Empty-state command line — sits directly below the framework grid.
             The lime gradient glow is rendered separately as a fixed element at the
             very bottom of the viewport, above the ticker. */}
        {isFirstVisit && !showFullRadar && (
          <div style={{
            position: "relative",
            marginTop: 56,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 24,
            paddingRight: 24,
            zIndex: 2,
          }}>
            <div style={{
              maxWidth: 700, margin: "0 auto", width: "100%",
              position: "relative", zIndex: 1,
            }}>
              {isAnalyzing ? (
                <ReasoningIndicator elapsedMs={reasoningElapsedMs} locale={locale} />
              ) : (
                <div
                  style={{
                    display: "flex", alignItems: "flex-end", gap: 10,
                    padding: "10px 10px 10px 22px",
                    minHeight: 56,
                    borderRadius: "var(--volt-radius-lg, 14px)",
                    border: inputFocused ? "1.5px solid var(--volt-text, #0A0A0A)" : "1.5px solid var(--volt-border, #E8E8E8)",
                    transition: "border-color 150ms ease, box-shadow 150ms ease",
                    background: "var(--volt-surface-raised, #fff)",
                    boxShadow: inputFocused ? "0 6px 24px rgba(228,255,151,0.35), 0 2px 8px rgba(0,0,0,0.06)" : "0 4px 16px rgba(0,0,0,0.04)",
                    position: "relative",
                  }}
                  onClick={() => inputRef.current?.focus()}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder={inputFocused ? "" : (locale === "de" ? "Oder stelle eine Frage …" : "Or ask a question …")}
                    style={{
                      flex: 1, border: "none", outline: "none", background: "transparent",
                      color: "var(--volt-text, #0A0A0A)",
                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 15,
                      lineHeight: 1.5,
                      resize: "none", overflow: "hidden",
                      padding: "7px 0",
                      caretColor: "transparent",
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <BlockCursor targetRef={inputRef} value={query} focused={inputFocused} />
                  {query && (
                    <button onClick={() => handleSubmit()}
                      className="sis-shimmer-btn"
                      style={{
                        fontSize: 13, fontWeight: 600, height: 36, padding: "0 18px",
                        borderRadius: "var(--volt-radius-md, 10px)", flexShrink: 0,
                        background: "var(--volt-lime, #E4FF97)", color: "#0A0A0A",
                        border: "none", cursor: "pointer",
                        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                      }}
                    >
                      {locale === "de" ? "Analysieren →" : "Analyze →"}
                    </button>
                  )}
                </div>
              )}

              {/* Letzte Projekte — compact list directly below the command line.
                   marginTop was 72 (too big for the centered flex layout → list
                   got clipped below the viewport on shorter screens); reduced to
                   28 so the block reliably sits above the SignalTicker.
                   Slice is 5 instead of 6 for the same reason. Row padding is
                   7/10 instead of 10/8 — still comfortable to click on but
                   buys ~15px of vertical space without feeling cramped. */}
              {pastSessions.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <div style={{
                    fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const,
                    color: "var(--volt-text-faint, #BBB)",
                    marginBottom: 8, textAlign: "center",
                  }}>
                    {locale === "de" ? "Letzte Projekte" : "Recent Projects"}
                  </div>
                  <ul style={{
                    listStyle: "none", margin: 0, padding: 0,
                    borderTop: "1px solid var(--volt-border, #E8E8E8)",
                  }}>
                    {pastSessions.slice(0, 5).map((s) => (
                      <li key={s.id} style={{ borderBottom: "1px solid var(--volt-border, #E8E8E8)" }}>
                        <a
                          href={`/canvas?project=${s.id}`}
                          onClick={() => { activeProjectIdRef.current = s.id; setActiveProjectId(s.id); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                            padding: "7px 10px",
                            textDecoration: "none",
                            color: "var(--volt-text, #0A0A0A)",
                            transition: "background-color 120ms ease",
                            cursor: "pointer",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--volt-lime, #E4FF97)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <span style={{
                            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                            fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            flex: 1, minWidth: 0,
                          }}>
                            {s.name}
                          </span>
                          <span style={{
                            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                            fontSize: 10, color: "var(--volt-text-faint, #AAA)",
                            letterSpacing: "0.04em",
                            display: "flex", alignItems: "center", gap: 10,
                            flexShrink: 0,
                          }}>
                            <span>
                              {s.queryCount} {locale === "de" ? (s.queryCount === 1 ? "Abfrage" : "Abfragen") : (s.queryCount === 1 ? "Query" : "Queries")}
                              {" · "}
                              {s.cardCount} {locale === "de" ? (s.cardCount === 1 ? "Karte" : "Karten") : (s.cardCount === 1 ? "Card" : "Cards")}
                            </span>
                            {s.updatedAt && (
                              <span>{new Date(s.updatedAt).toLocaleDateString(locale === "de" ? "de-DE" : "en-US", { month: "short", day: "numeric" })}</span>
                            )}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top-Trends entfernt — Trends leben ausschliesslich im
                   Knowledge Cockpit (/cockpit) bzw. unter /trends. Die
                   Startseite zeigt stattdessen nur noch die Letzte-Projekte-
                   Liste, damit das Centered-Hero ruhig bleibt. */}
            </div>
          </div>
        )}

        {/* Results — Phase 1+2: Session Bar + Active Node rendering. Only rendered when there is content, so the empty-state gradient command line can claim the full flex space. Bottom padding clears the fixed SignalTicker. */}
        {!isFirstVisit && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 60px", maxWidth: 960, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {/*
            Kein Command-Line-Feld über der Antwort (User-Regel, 2026-04-19).
            Der frühere A1-H1-Fix vom 18.04. hatte hier ein "Nächste Frage …"-
            Textfeld eingefügt — das widerspricht der älteren Design-Regel
            "keine Command-Line über einer Antwort". Follow-up-Einstiege
            leben jetzt:
              1. Unten im Briefing: die EigenerGedanke-Komponente
              2. In der Canvas-Toolbar: Command-Line (nächste Frage)
              3. Auf der Home-Seite: wenn der User zurück zum Empty-State
                 scrollt (Briefing entfernen), erscheint die Hero-Eingabe
                 wieder.
          */}

          {/* Session Bar removed: the step-pill bar (with Zusammenfassung /
               Canvas shortcuts) was intentionally dropped from the briefing
               view so each result stands on its own. Project switching and
               the "Zusammenfassung" entry point live in /canvas now (next to
               the Orbit toggle), not here. */}

          {/* Active Briefing: show only the currently-focused entry with crossfade animation */}
          {history.length > 0 && (() => {
            const entries = history;
            const activeEntry = activeNodeId
              ? entries.find(h => (h.id ?? h.query) === activeNodeId) ?? entries[0]
              : entries[0];
            const i = entries.indexOf(activeEntry);
            return (
              <div
                key={`active-${activeEntry.id ?? activeEntry.query}`}
                style={{ animation: "sis-brief-fade 220ms ease-out" }}
              >
                <BriefingResult
                  entry={activeEntry}
                  locale={locale}
                  trendCount={trends.length}
                  onTrendClick={setSelectedTrend}
                  activeProjectId={activeProjectId}
                  onProjectCreated={(pid) => {
                    // Wenn der Save-Button ein Projekt auto-angelegt hat,
                    // übernehmen wir den neuen projectId in unseren State
                    // (+ Ref für Follow-up-Queries). So landen weitere
                    // Briefings im selben Projekt ohne dass der User nochmal
                    // manuell anlegen muss.
                    setActiveProjectId(pid);
                    activeProjectIdRef.current = pid;
                  }}
                  onFollowUp={(q) => {
                    // Follow-ups feuern direkt gegen den LLM, mit dem
                    // aktuellen Briefing als `prevCtx` — so bleibt der
                    // Gedankenfaden erhalten und syncToCanvasDb erkennt
                    // die Query als Follow-up (isFollowUp = true) und
                    // hängt das Ergebnis ans SELBE Projekt statt ein
                    // neues anzulegen.
                    //
                    // Früher (A1-H4 vom 18.04.2026) wurde der Query nur
                    // in eine Top-Command-Line vorgefüllt und der User
                    // musste Enter drücken. Diese Command-Line wurde
                    // am 19.04.2026 auf User-Wunsch entfernt ("keine
                    // Command-Line über einer Antwort"). Der explizite
                    // Klick auf einen Follow-up-Button ist bewusste
                    // Intent — kein versehentlicher Tastendruck — also
                    // ist direktes Auslösen hier sicherer als ein
                    // toter Klick, der nur State setzt und nichts tut.
                    void handleSubmit(q, {
                      query: activeEntry.query,
                      synthesis: activeEntry.briefing?.synthesis ?? "",
                    });
                  }}
                />
              </div>
            );
          })()}

          {/* Reasoning indicator — rendered BELOW the pipeline card so the
               command line at the top stays free for queueing the next
               question while reasoning is still running. The old placement
               (replacing the command line) blocked that flow. */}
          {isAnalyzing && (
            <div style={{ animation: "sis-brief-fade 220ms ease-out" }}>
              <ReasoningIndicator elapsedMs={reasoningElapsedMs} locale={locale} />
            </div>
          )}
        </div>
        )}
        <style>{`
          @keyframes sis-brief-fade {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0);   }
          }
        `}</style>
      </div>


      {/* Trend Detail Panel */}
      {selectedTrend && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)", zIndex: 30 }} onClick={() => setSelectedTrend(null)} />
          <TrendDetailPanel trend={selectedTrend} onClose={() => setSelectedTrend(null)} />
        </>
      )}
    </div>
  );
}

