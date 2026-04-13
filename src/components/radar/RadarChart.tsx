"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { select, pointer } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { drag } from "d3-drag";
import "d3-transition";
import {
  TrendDot,
  Ring,
  RING_COLORS,
  TIME_HORIZON_COLORS,
  TimeHorizon,
} from "@/types";
import { useLocale } from "@/lib/locale-context";
import { t, getRingLabel } from "@/lib/i18n";
import { cascadeDepthCount, getDrivers, getEffects } from "@/lib/causal-graph";

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
  const zoomLayerRef = useRef<SVGGElement>(null);
  const dotLayerRef = useRef<SVGGElement>(null);
  const [tooltip, setTooltip] = useState<{
    trend: TrendDot;
    x: number;
    y: number;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
  const [showZoomHint, setShowZoomHint] = useState(true);
  const currentKRef = useRef(1);

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

  // Fade out zoom hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowZoomHint(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  const width = propWidth ?? dimensions.width;
  const height = propHeight ?? dimensions.height;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy) - 70;

  // ── Memoized grid lines ──
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const gridStep = 40;
    for (let gx = -maxR; gx <= maxR; gx += gridStep) {
      lines.push({ x1: gx, y1: -maxR, x2: gx, y2: maxR });
    }
    for (let gy = -maxR; gy <= maxR; gy += gridStep) {
      lines.push({ x1: -maxR, y1: gy, x2: maxR, y2: gy });
    }
    return lines;
  }, [maxR]);

  // ── Memoized ring data ──
  const ringData = useMemo(() => {
    // Reversed for painting order (outer first so inner overlaps)
    return RING_RADII.slice()
      .reverse()
      .map((r, i) => {
        const ringIndex = RINGS.length - 1 - i;
        const ring = RINGS[ringIndex];
        return { r: r * maxR, ring, color: RING_COLORS[ring] };
      });
  }, [maxR]);

  // ── Memoized ring labels ──
  const ringLabels = useMemo(() => {
    return RINGS.map((ring, i) => {
      const labelR = i === 0 ? RING_RADII[0] / 2 : (RING_RADII[i - 1] + RING_RADII[i]) / 2;
      const labelText = getRingLabel(locale, ring).toUpperCase();
      const tw = labelText.length * 5.5 + 14;
      return { ring, y: -labelR * maxR, text: labelText, tw, color: RING_COLORS[ring] };
    });
  }, [maxR, locale]);

  // ── Memoized quadrant dividers ──
  const quadrantDividers = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const angle = (i * Math.PI) / 2;
      return {
        x2: Math.cos(angle) * maxR * 1.05,
        y2: Math.sin(angle) * maxR * 1.05,
      };
    });
  }, [maxR]);

  // ── Memoized quadrant labels ──
  const quadrantLabelData = useMemo(() => {
    return quadrants.map((label, i) => {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const lr = maxR * 0.85;
      const lx = Math.cos(angle) * lr;
      const ly = Math.sin(angle) * lr;
      const tw = label.length * 5.5 + 16;
      return { label, lx, ly, tw };
    });
  }, [quadrants, maxR]);

  // ── Memoized dot positions and labels ──
  const { positions, labelCandidates, showLabel } = useMemo(() => {
    const pos = trends.map((d) => {
      const angleJ = jitterSeed(d.id, 0);
      const radiusJ = jitterSeed(d.id, 42);
      const angle = getAngleForQuadrant(d.quadrant, angleJ);
      const radius = getRadiusForRing(d.ring, d.relevance, radiusJ) * maxR;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });

    const candidates = trends.map((d, i) => ({
      x: pos[i].x,
      y: pos[i].y + getDotSize(d.impact) + 12,
      text: d.name.length > 20 ? d.name.slice(0, 18) + "\u2026" : d.name,
      priority: d.impact + (d.id === selectedTrendId ? 2 : 0),
    }));
    const show = avoidLabelCollisions(candidates);

    return { positions: pos, labelCandidates: candidates, showLabel: show };
  }, [trends, maxR, selectedTrendId]);

  // ── Memoized gradient defs ──
  const gradientDefs = useMemo(() => {
    return trends.map((d) => {
      const color = getDotColor(d.timeHorizon);
      const gradId = `grad-${d.id.replace(/[^a-z0-9]/gi, "-")}`;
      return { gradId, color };
    });
  }, [trends]);

  // ── D3 zoom behavior (imperative — must manipulate DOM transforms) ──
  useEffect(() => {
    const svgEl = svgRef.current;
    const zoomLayer = zoomLayerRef.current;
    if (!svgEl || !zoomLayer) return;

    const svg = select(svgEl);

    function applySemanticZoom(k: number) {
      currentKRef.current = k;
      if (!dotLayerRef.current) return;
      const invK = 1 / k;
      // Counter-scale each dot group so they stay the same visual size
      select(dotLayerRef.current)
        .selectAll<SVGGElement, unknown>(".trend-dot")
        .each(function () {
          const el = select(this);
          const currentTransform = el.attr("transform");
          const match = currentTransform?.match(/translate\(([^,]+),([^)]+)\)/);
          if (match) {
            el.attr("transform", `translate(${match[1]},${match[2]}) scale(${invK})`);
          }
        });
    }

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 8])
      .on("zoom", (event) => {
        select(zoomLayer).attr("transform", event.transform.toString());
        applySemanticZoom(event.transform.k);
      });

    svg.call(zoomBehavior);
    svg.on("dblclick.zoom", () => {
      svg.transition().duration(400).call(zoomBehavior.transform, zoomIdentity);
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("dblclick.zoom", null);
    };
  }, [svgRef, width, height]);

  // ── D3 drag behavior (imperative — must manipulate individual dot transforms) ──
  useEffect(() => {
    if (!onTrendDrag || !dotLayerRef.current) return;

    const dotGroups = select(dotLayerRef.current)
      .selectAll<SVGGElement, TrendDot>(".trend-dot");

    const dragBehavior = drag<SVGGElement, TrendDot>()
      .on("drag", function (event) {
        select(this).attr("transform", `translate(${event.x},${event.y}) scale(${1 / currentKRef.current})`);
      })
      .on("end", function (event, d) {
        const dist = Math.sqrt(event.x ** 2 + event.y ** 2) / maxR;
        const newRing = ringFromDistance(dist);
        onTrendDrag(d.id, newRing);
      });

    dotGroups.data(trends).call(dragBehavior);

    return () => {
      dotGroups.on(".drag", null);
    };
  }, [onTrendDrag, trends, maxR]);

  // ── Hover handlers (keep D3-transitions for smooth enter/leave) ──
  const handleDotMouseEnter = useCallback((event: React.MouseEvent<SVGGElement>, d: TrendDot) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const el = event.currentTarget;

    // Raise to front
    el.parentNode?.appendChild(el);

    const [mx, my] = pointer(event.nativeEvent, svgEl);
    setTooltip({ trend: d, x: mx, y: my });

    const size = getDotSize(d.impact);
    select(el).select(".main-dot")
      .transition().duration(120)
      .attr("r", size + 2)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.8);
  }, [svgRef]);

  const handleDotMouseLeave = useCallback((_event: React.MouseEvent<SVGGElement>, d: TrendDot) => {
    const el = _event.currentTarget;
    setTooltip(null);
    const size = getDotSize(d.impact);
    const isSelected = d.id === selectedTrendId;
    select(el).select(".main-dot")
      .transition().duration(120)
      .attr("r", size)
      .attr("stroke-width", isSelected ? 2 : 0.8)
      .attr("stroke-opacity", isSelected ? 1 : 0.4);
  }, [selectedTrendId]);

  const handleDotClick = useCallback((_event: React.MouseEvent<SVGGElement>, d: TrendDot) => {
    onTrendClick?.(d);
  }, [onTrendClick]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", margin: "0 auto", cursor: "grab" }}
      >
        <g ref={zoomLayerRef} className="zoom-layer">
          {/* ── Background layer ── */}
          <g transform={`translate(${cx},${cy})`}>
            {/* Grid */}
            {gridLines.map((l, i) => (
              <line
                key={i}
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="var(--color-border, rgba(0,0,0,0.04))"
                strokeWidth={0.5}
                strokeOpacity={0.25}
              />
            ))}

            {/* Ring backgrounds */}
            {ringData.map(({ r, ring, color }) => (
              <React.Fragment key={ring}>
                <circle r={r} fill={color} fillOpacity={0.06} />
                <circle
                  r={r} fill="none"
                  stroke={color} strokeOpacity={0.15}
                  strokeWidth={1} strokeDasharray="3 5"
                />
              </React.Fragment>
            ))}

            {/* Ring labels */}
            {ringLabels.map(({ ring, y, text, tw, color }) => (
              <React.Fragment key={ring}>
                <rect
                  x={-tw / 2} y={y - 7}
                  width={tw} height={14} rx={7}
                  fill="var(--color-surface, #fff)" fillOpacity={0.9}
                />
                <text
                  x={0} y={y}
                  textAnchor="middle" dy="0.35em"
                  fill={color} fillOpacity={0.65}
                  fontSize="10px" fontWeight="700"
                  letterSpacing="0.06em"
                >
                  {text}
                </text>
              </React.Fragment>
            ))}

            {/* Quadrant dividers */}
            {quadrantDividers.map((d, i) => (
              <line
                key={i}
                x1={0} y1={0} x2={d.x2} y2={d.y2}
                stroke="var(--color-border, #ddd)"
                strokeWidth={1} strokeDasharray="4,4"
              />
            ))}

            {/* Quadrant labels */}
            {quadrantLabelData.map(({ label, lx, ly, tw }) => (
              <React.Fragment key={label}>
                <rect
                  x={lx - tw / 2} y={ly - 9}
                  width={tw} height={18} rx={9}
                  fill="var(--color-surface, #fff)" fillOpacity={0.92}
                  stroke="var(--color-border, #ddd)" strokeOpacity={0.4}
                />
                <text
                  x={lx} y={ly}
                  textAnchor="middle" dy="0.35em"
                  fill="var(--color-text-secondary, #555)"
                  fontSize="11px" fontWeight="600"
                >
                  {label}
                </text>
              </React.Fragment>
            ))}
          </g>

          {/* ── Gradient defs ── */}
          <defs>
            {gradientDefs.map(({ gradId, color }) => (
              <radialGradient key={gradId} id={gradId} cx="35%" cy="30%" r="72%">
                <stop offset="0%" stopColor="var(--color-surface, #FFFFFF)" stopOpacity="0.60" />
                <stop offset="40%" stopColor={color + "EE"} stopOpacity="0.90" />
                <stop offset="100%" stopColor={color} stopOpacity="0.70" />
              </radialGradient>
            ))}
          </defs>

          {/* ── Dot layer ── */}
          <g ref={dotLayerRef} transform={`translate(${cx},${cy})`}>
            {trends.map((d, i) => {
              const { x, y } = positions[i];
              const size = getDotSize(d.impact);
              const opacity = getDotOpacity(d.confidence);
              const color = getDotColor(d.timeHorizon);
              const isSelected = d.id === selectedTrendId;
              const gradId = `grad-${d.id.replace(/[^a-z0-9]/gi, "-")}`;
              const live = d.signalCount72h ?? 0;
              const labelVisible = showLabel[i] || isSelected;
              const labelText = labelCandidates[i].text;
              const labelTw = labelText.length * 4.5 + 6;

              return (
                <g
                  key={d.id}
                  className="trend-dot"
                  transform={`translate(${x},${y})`}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => handleDotMouseEnter(e, d)}
                  onMouseLeave={(e) => handleDotMouseLeave(e, d)}
                  onClick={(e) => handleDotClick(e, d)}
                >
                  {/* Selection glow */}
                  {isSelected && (
                    <circle
                      className="glow"
                      r={size + 4} fill="none"
                      stroke={color} strokeWidth={2} strokeOpacity={0.5}
                    />
                  )}

                  {/* Live-signal heat glow */}
                  {live > 0 && (
                    <circle
                      className="heat-glow"
                      r={size + 4 + Math.min(14, Math.log2(1 + live) * 3)}
                      fill={color}
                      fillOpacity={0.10 + Math.min(0.25, live / 200)}
                      stroke="none"
                    />
                  )}

                  {/* Velocity ring */}
                  {d.velocity === "rising" && (
                    <circle
                      r={size + 2} fill="none"
                      stroke="#1A9E5A" strokeWidth={1.4}
                      strokeOpacity={0.6} strokeDasharray="2,2"
                    />
                  )}
                  {d.velocity === "falling" && (
                    <circle
                      r={size + 2} fill="none"
                      stroke="#E8402A" strokeWidth={1.2}
                      strokeOpacity={0.55}
                    />
                  )}

                  {/* Main dot */}
                  <circle
                    className="main-dot"
                    r={size}
                    fill={`url(#${gradId})`}
                    fillOpacity={opacity}
                    stroke={isSelected ? "var(--foreground, #0A0A0A)" : "var(--color-border, rgba(0,0,0,0.12))"}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeOpacity={isSelected ? 1 : 0.35}
                  />

                  {/* Label */}
                  {labelVisible && (
                    <>
                      <rect
                        className="label-bg"
                        x={-labelTw / 2} y={size + 4}
                        width={labelTw} height={13} rx={3}
                        fill="var(--color-surface, #fff)"
                        fillOpacity={0.88}
                      />
                      <text
                        className="label-text"
                        y={size + 13} textAnchor="middle"
                        fill="var(--color-text-secondary, #555)"
                        fontSize="9px"
                        fontWeight={isSelected ? "700" : "500"}
                      >
                        {labelText}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </g>

        {/* Zoom hint (fades out via CSS transition) */}
        <text
          x={width - 12} y={height - 10}
          textAnchor="end"
          fill="var(--color-text-muted, #999)"
          fontSize="10px"
          opacity={showZoomHint ? 0.5 : 0}
          style={{ transition: "opacity 2s ease" }}
        >
          Scroll = Zoom · Doppelklick = Reset
        </text>
      </svg>

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
            background: "var(--volt-surface, rgba(255,255,255,0.98))",
            border: "1px solid var(--volt-border, rgba(0,0,0,0.10))",
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
              <span style={{ color: "var(--signal-positive, #16a34a)", fontSize: 10, fontWeight: 600 }}>▲</span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 8px", fontSize: 10 }}>
            {[
              { label: t(locale, "relevance"), val: tooltip.trend.relevance, color: "var(--pastel-sky-text, #3b82f6)" },
              { label: t(locale, "confidence"), val: tooltip.trend.confidence, color: "var(--signal-positive, #22c55e)" },
              { label: t(locale, "impact"), val: tooltip.trend.impact, color: "var(--pastel-amber-text, #f59e0b)" },
            ].map(({ label, val, color }) => (
              <React.Fragment key={label}>
                <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--color-border)", borderRadius: 2 }}>
                    <div style={{ height: 4, borderRadius: 2, background: color, width: `${val * 100}%` }} />
                  </div>
                  <span style={{ color: "var(--color-text-secondary)", fontWeight: 600, minWidth: 26, textAlign: "right" }}>
                    {(val * 100).toFixed(0)}%
                  </span>
                </div>
              </React.Fragment>
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

          {/* ── Live signal block — only when /api/v1/feed has data ── */}
          {(tooltip.trend.signalCount72h ?? 0) > 0 && (
            <div style={{
              marginTop: 6, paddingTop: 6,
              borderTop: "1px solid var(--color-border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, fontSize: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  color: "var(--signal-positive, #1A9E5A)",
                  fontWeight: 700,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A9E5A", boxShadow: "0 0 4px rgba(26,158,90,0.7)" }} />
                  {tooltip.trend.signalCount72h} {locale === "de" ? "Live-Signale (72h)" : "live signals (72h)"}
                </span>
                {tooltip.trend.avgStrength != null && (
                  <span style={{ color: "var(--color-text-muted)" }}>
                    ⌀ {(tooltip.trend.avgStrength * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {tooltip.trend.sparkline && tooltip.trend.sparkline.length === 7 && (
                <Sparkline values={tooltip.trend.sparkline} />
              )}
            </div>
          )}

          {/* ── Causal-graph block: drivers, effects, cascade depth ── */}
          <div style={{
            marginTop: 6, paddingTop: 6,
            borderTop: "1px solid var(--color-border)",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px 8px",
            fontSize: 9, color: "var(--color-text-muted)",
          }}>
            <CausalStat
              label={locale === "de" ? "Treiber" : "Drivers"}
              value={getDrivers(tooltip.trend.id).length}
            />
            <CausalStat
              label={locale === "de" ? "Effekte" : "Effects"}
              value={getEffects(tooltip.trend.id).length}
            />
            <CausalStat
              label={locale === "de" ? "Kaskade" : "Cascade"}
              value={cascadeDepthCount(tooltip.trend.id, 3)}
              suffix={locale === "de" ? " Trends" : " trends"}
            />
          </div>

          <div style={{
            marginTop: 6, paddingTop: 6,
            borderTop: "1px solid var(--color-border)",
            fontSize: 9, color: "var(--color-text-muted)",
            display: "flex", gap: 4, flexWrap: "wrap",
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

// ── Tooltip sub-components ──────────────────────────────────────────────────

function CausalStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: value > 0 ? "var(--color-text-heading)" : "var(--color-text-muted)",
      }}>
        {value}{suffix && value > 0 ? suffix : ""}
      </span>
      <span style={{ fontSize: 8, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const w = 110;
  const h = 22;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ marginTop: 4 }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        {/* Baseline */}
        <line x1={0} y1={h - 1} x2={w} y2={h - 1} stroke="var(--color-border, #ddd)" strokeWidth={0.5} />
        {/* Area fill */}
        <polyline
          points={`0,${h - 1} ${points} ${w},${h - 1}`}
          fill="rgba(26,158,90,0.12)"
          stroke="none"
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#1A9E5A"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Latest point dot */}
        {values.length > 0 && (() => {
          const lastV = values[values.length - 1];
          const lastX = w;
          const lastY = h - (lastV / max) * (h - 2) - 1;
          return <circle cx={lastX} cy={lastY} r={2} fill="#1A9E5A" />;
        })()}
      </svg>
    </div>
  );
}
