"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import {
  TrendDot,
  Ring,
  RING_COLORS,
  TIME_HORIZON_COLORS,
  TimeHorizon,
} from "@/types";
import { useLocale } from "@/lib/locale-context";
import { t, getRingLabel } from "@/lib/i18n";

interface RadarChartProps {
  trends: TrendDot[];
  quadrants: string[];
  width?: number;
  height?: number;
  onTrendClick?: (trend: TrendDot) => void;
  onTrendDrag?: (trendId: string, newRing: Ring) => void;
  selectedTrendId?: string | null;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

const RINGS: Ring[] = ["adopt", "trial", "assess", "hold"];
const RING_RADII = [0.25, 0.5, 0.72, 1.0];

function ringFromDistance(d: number): Ring {
  if (d <= RING_RADII[0]) return "adopt";
  if (d <= RING_RADII[1]) return "trial";
  if (d <= RING_RADII[2]) return "assess";
  return "hold";
}

/**
 * Spread dots more within a quadrant using TWO independent jitter values
 * (one for angle, one for radius offset) to avoid clustering.
 */
function jitterSeed(id: string, salt = 0): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function getAngleForQuadrant(quadrant: number, jitter: number): number {
  const baseAngle = (quadrant * Math.PI) / 2 + Math.PI / 4;
  // Wider spread: use 85% of the quadrant arc
  return baseAngle + (jitter - 0.5) * (Math.PI / 2.2);
}

function getRadiusForRing(ring: Ring, relevance: number, radiusJitter: number): number {
  const ringIndex = RINGS.indexOf(ring);
  const innerR = ringIndex === 0 ? 0.06 : RING_RADII[ringIndex - 1] + 0.02;
  const outerR = RING_RADII[ringIndex] - 0.02;
  // Mix relevance with jitter so dots don't all sit on one line
  const base = 1 - relevance;
  const jittered = base * 0.7 + radiusJitter * 0.3;
  return innerR + Math.max(0, Math.min(1, jittered)) * (outerR - innerR);
}

/** Small dots: 3–8px radius based on impact */
function getDotSize(impact: number): number {
  return 3.5 + impact * 5;
}

function getDotOpacity(confidence: number): number {
  return 0.4 + confidence * 0.6;
}

function getDotColor(timeHorizon: TimeHorizon): string {
  return TIME_HORIZON_COLORS[timeHorizon];
}

// Label collision avoidance
function avoidLabelCollisions(
  labels: { x: number; y: number; text: string; priority: number }[]
): boolean[] {
  const sorted = labels
    .map((l, i) => ({ ...l, idx: i }))
    .sort((a, b) => b.priority - a.priority);

  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const show = new Array(labels.length).fill(false);

  for (const item of sorted) {
    const estW = item.text.length * 5 + 8;
    const estH = 14;
    const rect = { x: item.x - estW / 2, y: item.y, w: estW, h: estH };

    const overlaps = placed.some(
      (p) =>
        rect.x < p.x + p.w + 4 &&
        rect.x + rect.w + 4 > p.x &&
        rect.y < p.y + p.h + 2 &&
        rect.y + rect.h + 2 > p.y
    );

    if (!overlaps) {
      show[item.idx] = true;
      placed.push(rect);
    }
  }
  return show;
}

export default function RadarChart({
  trends,
  quadrants,
  width: propWidth,
  height: propHeight,
  onTrendClick,
  onTrendDrag,
  selectedTrendId,
  svgRef: externalSvgRef,
}: RadarChartProps) {
  const { locale } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef || internalSvgRef;
  const [tooltip, setTooltip] = useState<{
    trend: TrendDot;
    x: number;
    y: number;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      const size = Math.min(width, 900);
      setDimensions({ width: size, height: size });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const width = propWidth ?? dimensions.width;
  const height = propHeight ?? dimensions.height;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy) - 70;

  const drawRadar = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // ── Background layer (zooms with content) ──
    const zoomG = svg.append("g").attr("class", "zoom-layer");
    const bgG = zoomG.append("g").attr("transform", `translate(${cx},${cy})`);

    // ── Dot layer (zooms position but NOT size — semantic zoom) ──
    const dotLayer = zoomG.append("g").attr("transform", `translate(${cx},${cy})`);

    // ── Current zoom scale (for inverse-scaling dots) ──
    let currentK = 1;

    // Background grid pattern (Volt-style)
    const gridStep = 40;
    for (let gx = -maxR; gx <= maxR; gx += gridStep) {
      bgG.append("line")
        .attr("x1", gx).attr("y1", -maxR)
        .attr("x2", gx).attr("y2", maxR)
        .attr("stroke", "rgba(0,0,0,0.04)").attr("stroke-width", 0.5);
    }
    for (let gy = -maxR; gy <= maxR; gy += gridStep) {
      bgG.append("line")
        .attr("x1", -maxR).attr("y1", gy)
        .attr("x2", maxR).attr("y2", gy)
        .attr("stroke", "rgba(0,0,0,0.04)").attr("stroke-width", 0.5);
    }

    // Ring backgrounds
    RING_RADII.slice()
      .reverse()
      .forEach((r, i) => {
        const ringIndex = RINGS.length - 1 - i;
        bgG.append("circle")
          .attr("r", r * maxR)
          .attr("fill", RING_COLORS[RINGS[ringIndex]])
          .attr("fill-opacity", 0.06);
        bgG.append("circle")
          .attr("r", r * maxR)
          .attr("fill", "none")
          .attr("stroke", RING_COLORS[RINGS[ringIndex]])
          .attr("stroke-opacity", 0.15)
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3 5");
      });

    // Ring labels
    RINGS.forEach((ring, i) => {
      const labelR = i === 0 ? RING_RADII[0] / 2 : (RING_RADII[i - 1] + RING_RADII[i]) / 2;
      const labelText = getRingLabel(locale, ring).toUpperCase();
      const tw = labelText.length * 5.5 + 14;

      bgG.append("rect")
        .attr("x", -tw / 2).attr("y", -labelR * maxR - 7)
        .attr("width", tw).attr("height", 14).attr("rx", 7)
        .attr("fill", "var(--color-surface, #fff)").attr("fill-opacity", 0.9);

      bgG.append("text")
        .attr("x", 0).attr("y", -labelR * maxR)
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("fill", RING_COLORS[ring]).attr("fill-opacity", 0.65)
        .attr("font-size", "10px").attr("font-weight", "700")
        .attr("letter-spacing", "0.06em")
        .text(labelText);
    });

    // Quadrant dividers
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      bgG.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", Math.cos(angle) * maxR * 1.05)
        .attr("y2", Math.sin(angle) * maxR * 1.05)
        .attr("stroke", "var(--color-border, #ddd)")
        .attr("stroke-width", 1).attr("stroke-dasharray", "4,4");
    }

    // Quadrant labels
    quadrants.forEach((label, i) => {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const lr = maxR * 0.85;
      const lx = Math.cos(angle) * lr;
      const ly = Math.sin(angle) * lr;
      const tw = label.length * 5.5 + 16;

      bgG.append("rect")
        .attr("x", lx - tw / 2).attr("y", ly - 9)
        .attr("width", tw).attr("height", 18).attr("rx", 9)
        .attr("fill", "var(--color-surface, #fff)").attr("fill-opacity", 0.92)
        .attr("stroke", "var(--color-border, #ddd)").attr("stroke-opacity", 0.4);

      bgG.append("text")
        .attr("x", lx).attr("y", ly)
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("fill", "var(--color-text-secondary, #555)")
        .attr("font-size", "11px").attr("font-weight", "600")
        .text(label);
    });

    // ── Compute dot positions ──
    const positions = trends.map((d) => {
      const angleJ = jitterSeed(d.id, 0);
      const radiusJ = jitterSeed(d.id, 42);
      const angle = getAngleForQuadrant(d.quadrant, angleJ);
      const radius = getRadiusForRing(d.ring, d.relevance, radiusJ) * maxR;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });

    // Label collision avoidance
    const labelCandidates = trends.map((d, i) => ({
      x: positions[i].x,
      y: positions[i].y + getDotSize(d.impact) + 12,
      text: d.name.length > 20 ? d.name.slice(0, 18) + "…" : d.name,
      priority: d.impact + (d.id === selectedTrendId ? 2 : 0),
    }));
    const showLabel = avoidLabelCollisions(labelCandidates);

    // ── Radial gradients (Volt-style pastell) ──
    const defs = zoomG.append("defs");
    trends.forEach((d) => {
      const color = getDotColor(d.timeHorizon);
      const gradId = `grad-${d.id.replace(/[^a-z0-9]/gi, "-")}`;
      const grad = defs.append("radialGradient")
        .attr("id", gradId)
        .attr("cx", "35%").attr("cy", "30%").attr("r", "72%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", "#FFFFFF").attr("stop-opacity", "0.60");
      grad.append("stop").attr("offset", "40%").attr("stop-color", color + "EE").attr("stop-opacity", "0.90");
      grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", "0.70");
    });

    // ── Draw dots ──
    const dots = dotLayer
      .selectAll<SVGGElement, TrendDot>(".trend-dot")
      .data(trends, (d) => d.id)
      .join("g")
      .attr("class", "trend-dot")
      .style("cursor", "pointer");

    dots.each(function (d, i) {
      const dotG = d3.select(this);
      const { x, y } = positions[i];
      const size = getDotSize(d.impact);
      const opacity = getDotOpacity(d.confidence);
      const color = getDotColor(d.timeHorizon);
      const isSelected = d.id === selectedTrendId;
      const gradId = `grad-${d.id.replace(/[^a-z0-9]/gi, "-")}`;

      dotG.attr("transform", `translate(${x},${y})`);

      // Selection glow
      if (isSelected) {
        dotG.append("circle")
          .attr("r", size + 4).attr("fill", "none")
          .attr("stroke", color).attr("stroke-width", 2)
          .attr("stroke-opacity", 0.5).classed("glow", true);
      }

      // Velocity ring (rising = dashed outer ring)
      if (d.velocity === "rising") {
        dotG.append("circle")
          .attr("r", size + 2).attr("fill", "none")
          .attr("stroke", color).attr("stroke-width", 1)
          .attr("stroke-opacity", 0.35).attr("stroke-dasharray", "2,2");
      }

      // Main dot — Volt-style radial gradient
      dotG.append("circle")
        .attr("r", size)
        .attr("fill", `url(#${gradId})`)
        .attr("fill-opacity", opacity)
        .attr("stroke", isSelected ? "var(--volt-black, #0A0A0A)" : "rgba(0,0,0,0.12)")
        .attr("stroke-width", isSelected ? 2 : 1)
        .attr("stroke-opacity", isSelected ? 1 : 0.35)
        .classed("main-dot", true);

      // Label
      if (showLabel[i] || isSelected) {
        const text = labelCandidates[i].text;
        const tw = text.length * 4.5 + 6;
        dotG.append("rect")
          .attr("x", -tw / 2).attr("y", size + 4)
          .attr("width", tw).attr("height", 13).attr("rx", 3)
          .attr("fill", "var(--color-surface, #fff)")
          .attr("fill-opacity", 0.88)
          .classed("label-bg", true);
        dotG.append("text")
          .attr("y", size + 13).attr("text-anchor", "middle")
          .attr("fill", "var(--color-text-secondary, #555)")
          .attr("font-size", "9px")
          .attr("font-weight", isSelected ? "700" : "500")
          .classed("label-text", true)
          .text(text);
      }
    });

    // ── Semantic zoom: space grows, dots stay small ──
    function applySemanticZoom(k: number) {
      currentK = k;
      const invK = 1 / k;
      dots.each(function () {
        // Counter-scale each dot group so it stays the same visual size
        const el = d3.select(this);
        const currentTransform = el.attr("transform");
        // Extract translate values
        const match = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
        if (match) {
          el.attr("transform", `translate(${match[1]},${match[2]}) scale(${invK})`);
        }
      });
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 8])
      .on("zoom", (event) => {
        zoomG.attr("transform", event.transform.toString());
        applySemanticZoom(event.transform.k);
      });

    svg.call(zoom);
    svg.on("dblclick.zoom", () => {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    });

    // ── Interactions ──

    // Hover: raise to front + enlarge slightly
    dots.on("mouseenter", function (event, d) {
      // Raise this dot to the top of the stack
      (this as SVGGElement).parentNode?.appendChild(this as SVGGElement);

      const [mx, my] = d3.pointer(event, svgEl);
      setTooltip({ trend: d, x: mx, y: my });

      const size = getDotSize(d.impact);
      d3.select(this).select(".main-dot")
        .transition().duration(120)
        .attr("r", size + 2)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.8);
    });

    dots.on("mouseleave", function (_event, d) {
      setTooltip(null);
      const size = getDotSize(d.impact);
      const isSelected = d.id === selectedTrendId;
      d3.select(this).select(".main-dot")
        .transition().duration(120)
        .attr("r", size)
        .attr("stroke-width", isSelected ? 2 : 0.8)
        .attr("stroke-opacity", isSelected ? 1 : 0.4);
    });

    dots.on("click", function (_event, d) {
      onTrendClick?.(d);
    });

    // Drag to change ring
    if (onTrendDrag) {
      const drag = d3.drag<SVGGElement, TrendDot>()
        .on("drag", function (event) {
          d3.select(this).attr("transform", `translate(${event.x},${event.y}) scale(${1 / currentK})`);
        })
        .on("end", function (event, d) {
          const dist = Math.sqrt(event.x ** 2 + event.y ** 2) / maxR;
          const newRing = ringFromDistance(dist);
          onTrendDrag(d.id, newRing);
        });
      dots.call(drag);
    }

    // Zoom hint
    svg.append("text")
      .attr("x", width - 12).attr("y", height - 10)
      .attr("text-anchor", "end")
      .attr("fill", "var(--color-text-muted, #999)")
      .attr("font-size", "10px").attr("opacity", 0.5)
      .text("Scroll = Zoom · Doppelklick = Reset")
      .transition().delay(5000).duration(2000).attr("opacity", 0).remove();

  }, [trends, quadrants, width, height, cx, cy, maxR, selectedTrendId, onTrendClick, onTrendDrag, locale, svgRef]);

  useEffect(() => { drawRadar(); }, [drawRadar]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", margin: "0 auto", cursor: "grab" }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltip.x + 16, width - 280),
            top: Math.max(tooltip.y - 10, 0),
            maxWidth: 260,
            pointerEvents: "none",
            zIndex: 50,
            background: "rgba(255,255,255,0.98)",
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: "var(--volt-radius-md, 10px)",
            padding: "10px 14px",
            boxShadow: "var(--volt-shadow-lg, 0 12px 32px rgba(0,0,0,0.10))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: getDotColor(tooltip.trend.timeHorizon), flexShrink: 0,
            }} />
            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-heading)" }}>
              {tooltip.trend.name}
            </span>
            {tooltip.trend.velocity === "rising" && (
              <span style={{ color: "#16a34a", fontSize: 10, fontWeight: 600 }}>▲</span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 8px", fontSize: 10 }}>
            {[
              { label: t(locale, "relevance"), val: tooltip.trend.relevance, color: "#3b82f6" },
              { label: t(locale, "confidence"), val: tooltip.trend.confidence, color: "#22c55e" },
              { label: t(locale, "impact"), val: tooltip.trend.impact, color: "#f59e0b" },
            ].map(({ label, val, color }) => (
              <>
                <span key={label + "l"} style={{ color: "var(--color-text-muted)" }}>{label}</span>
                <div key={label + "v"} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--color-border)", borderRadius: 2 }}>
                    <div style={{ height: 4, borderRadius: 2, background: color, width: `${val * 100}%` }} />
                  </div>
                  <span style={{ color: "var(--color-text-secondary)", fontWeight: 600, minWidth: 26, textAlign: "right" }}>
                    {(val * 100).toFixed(0)}%
                  </span>
                </div>
              </>
            ))}
            <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "timeHorizon")}</span>
            <span style={{
              display: "inline-block", padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 600,
              background: getDotColor(tooltip.trend.timeHorizon) + "18",
              color: getDotColor(tooltip.trend.timeHorizon),
            }}>
              {tooltip.trend.timeHorizon === "short" ? t(locale, "horizonShort")
                : tooltip.trend.timeHorizon === "mid" ? t(locale, "horizonMid")
                : t(locale, "horizonLong")}
            </span>
          </div>

          <div style={{
            marginTop: 6, paddingTop: 6,
            borderTop: "1px solid var(--color-border)",
            fontSize: 9, color: "var(--color-text-muted)",
            display: "flex", gap: 4,
          }}>
            <span>{tooltip.trend.signalCount} {t(locale, "signals")}</span>
            <span>·</span>
            <span>{tooltip.trend.topSources.slice(0, 3).join(", ")}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: 16, marginTop: 10, fontSize: 10, color: "var(--color-text-muted)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{t(locale, "horizon")}</span>
          {(["short", "mid", "long"] as TimeHorizon[]).map((h) => (
            <span key={h} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: TIME_HORIZON_COLORS[h], display: "inline-block" }} />
              {t(locale, h)}
            </span>
          ))}
        </div>
        <span>● Größe = Impact</span>
        <span>◐ Deckkraft = Konfidenz</span>
      </div>
    </div>
  );
}
