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
const RING_RADII = [0.25, 0.5, 0.72, 1.0]; // proportional to chart radius

function ringFromDistance(d: number): Ring {
  if (d <= RING_RADII[0]) return "adopt";
  if (d <= RING_RADII[1]) return "trial";
  if (d <= RING_RADII[2]) return "assess";
  return "hold";
}

function getAngleForQuadrant(quadrant: number, jitter: number): number {
  const baseAngle = (quadrant * Math.PI) / 2 + Math.PI / 4;
  return baseAngle + (jitter - 0.5) * (Math.PI / 2.5);
}

function getRadiusForRing(ring: Ring, relevance: number): number {
  const ringIndex = RINGS.indexOf(ring);
  const innerR = ringIndex === 0 ? 0.08 : RING_RADII[ringIndex - 1] + 0.03;
  const outerR = RING_RADII[ringIndex] - 0.03;
  // Higher relevance → closer to center within the ring
  const t = 1 - relevance;
  return innerR + t * (outerR - innerR);
}

function getDotSize(impact: number): number {
  return 5 + impact * 12;
}

function getDotOpacity(confidence: number): number {
  return 0.3 + confidence * 0.7;
}

function getDotColor(timeHorizon: TimeHorizon): string {
  return TIME_HORIZON_COLORS[timeHorizon];
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

  // Responsive sizing
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
  const maxR = Math.min(cx, cy) - 60;

  const drawRadar = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${cx},${cy})`);

    // Draw rings
    RING_RADII.slice()
      .reverse()
      .forEach((r, i) => {
        const ringIndex = RINGS.length - 1 - i;
        g.append("circle")
          .attr("r", r * maxR)
          .attr("fill", "none")
          .attr("stroke", RING_COLORS[RINGS[ringIndex]])
          .attr("stroke-opacity", 0.25)
          .attr("stroke-width", 1);

        // Ring fill (very subtle)
        g.append("circle")
          .attr("r", r * maxR)
          .attr("fill", RING_COLORS[RINGS[ringIndex]])
          .attr("fill-opacity", 0.03);
      });

    // Ring labels
    RINGS.forEach((ring, i) => {
      const labelR = i === 0 ? RING_RADII[0] / 2 : (RING_RADII[i - 1] + RING_RADII[i]) / 2;
      g.append("text")
        .attr("x", 0)
        .attr("y", -labelR * maxR)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", RING_COLORS[ring])
        .attr("fill-opacity", 0.5)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.05em")
        .text(getRingLabel(locale, ring).toUpperCase());
    });

    // Quadrant dividers
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", Math.cos(angle) * maxR)
        .attr("y2", Math.sin(angle) * maxR)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");
    }

    // Quadrant labels
    quadrants.forEach((label, i) => {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const labelR = maxR + 30;
      g.append("text")
        .attr("x", Math.cos(angle) * labelR * 0.6)
        .attr("y", Math.sin(angle) * labelR * 0.6)
        .attr("text-anchor", "middle")
        .attr("fill", "#666")
        .attr("font-size", "10px")
        .attr("font-weight", "500")
        .text(label);
    });

    // Use deterministic jitter based on trend id
    const jitterSeed = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h + id.charCodeAt(i)) | 0;
      }
      return (Math.abs(h) % 1000) / 1000;
    };

    // Draw trend dots
    const dots = g
      .selectAll<SVGGElement, TrendDot>(".trend-dot")
      .data(trends, (d) => d.id)
      .join("g")
      .attr("class", "trend-dot")
      .style("cursor", "pointer");

    dots.each(function (d) {
      const dotG = d3.select(this);
      const jitter = jitterSeed(d.id);
      const angle = getAngleForQuadrant(d.quadrant, jitter);
      const radius = getRadiusForRing(d.ring, d.relevance) * maxR;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const size = getDotSize(d.impact);
      const opacity = getDotOpacity(d.confidence);
      const color = getDotColor(d.timeHorizon);
      const isSelected = d.id === selectedTrendId;

      dotG.attr("transform", `translate(${x},${y})`);

      // Glow for selected
      if (isSelected) {
        dotG
          .append("circle")
          .attr("r", size + 4)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.6);
      }

      // Velocity indicator
      if (d.velocity === "rising") {
        dotG
          .append("circle")
          .attr("r", size + 2)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.3)
          .attr("stroke-dasharray", "2,2");
      }

      // Main dot
      dotG
        .append("circle")
        .attr("r", size)
        .attr("fill", color)
        .attr("fill-opacity", opacity)
        .attr("stroke", isSelected ? "#fff" : color)
        .attr("stroke-width", isSelected ? 2 : 1)
        .attr("stroke-opacity", isSelected ? 1 : 0.6);

      // Override indicator
      if (d.userOverride) {
        dotG
          .append("circle")
          .attr("r", 3)
          .attr("cx", size - 2)
          .attr("cy", -size + 2)
          .attr("fill", "#fff");
      }

      // Label (only for larger dots or selected)
      if (d.impact > 0.6 || isSelected) {
        dotG
          .append("text")
          .attr("y", size + 14)
          .attr("text-anchor", "middle")
          .attr("fill", "#ccc")
          .attr("font-size", "10px")
          .attr("font-weight", isSelected ? "600" : "400")
          .text(d.name.length > 18 ? d.name.slice(0, 16) + "..." : d.name);
      }
    });

    // Interactions
    dots.on("mouseenter", function (event, d) {
      const [mx, my] = d3.pointer(event, svgRef.current);
      setTooltip({ trend: d, x: mx, y: my });
      d3.select(this).select("circle:nth-child(2), circle:first-child").transition().duration(150).attr("r", getDotSize(d.impact) + 3);
    });

    dots.on("mouseleave", function (_event, d) {
      setTooltip(null);
      d3.select(this).selectAll("circle").filter(function() {
        return !d3.select(this).classed("glow");
      }).transition().duration(150).attr("r", function() {
        return getDotSize(d.impact);
      });
    });

    dots.on("click", function (_event, d) {
      onTrendClick?.(d);
    });

    // Drag to change ring
    if (onTrendDrag) {
      const drag = d3
        .drag<SVGGElement, TrendDot>()
        .on("drag", function (event) {
          const dx = event.x;
          const dy = event.y;
          d3.select(this).attr("transform", `translate(${dx},${dy})`);
        })
        .on("end", function (event, d) {
          const dist = Math.sqrt(event.x ** 2 + event.y ** 2) / maxR;
          const newRing = ringFromDistance(dist);
          onTrendDrag(d.id, newRing);
        });

      dots.call(drag);
    }
  }, [trends, quadrants, width, height, cx, cy, maxR, selectedTrendId, onTrendClick, onTrendDrag, locale]);

  useEffect(() => {
    drawRadar();
  }, [drawRadar]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ maxWidth: 900 }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg px-4 py-3 shadow-xl"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 10,
            maxWidth: 280,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: getDotColor(tooltip.trend.timeHorizon) }}
            />
            <span className="font-semibold text-sm">{tooltip.trend.name}</span>
            {tooltip.trend.velocity === "rising" && (
              <span className="text-green-400 text-xs">&#9650; {t(locale, "velocityRising")}</span>
            )}
            {tooltip.trend.velocity === "falling" && (
              <span className="text-red-400 text-xs">&#9660; {t(locale, "velocityFalling")}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="text-[#888]">{t(locale, "relevance")}</div>
            <div className="flex items-center gap-1">
              <div className="h-1.5 bg-[#333] rounded-full flex-1">
                <div
                  className="h-1.5 rounded-full bg-blue-400"
                  style={{ width: `${tooltip.trend.relevance * 100}%` }}
                />
              </div>
              <span>{(tooltip.trend.relevance * 100).toFixed(0)}%</span>
            </div>

            <div className="text-[#888]">{t(locale, "confidence")}</div>
            <div className="flex items-center gap-1">
              <div className="h-1.5 bg-[#333] rounded-full flex-1">
                <div
                  className="h-1.5 rounded-full bg-green-400"
                  style={{ width: `${tooltip.trend.confidence * 100}%` }}
                />
              </div>
              <span>{(tooltip.trend.confidence * 100).toFixed(0)}%</span>
            </div>

            <div className="text-[#888]">{t(locale, "impact")}</div>
            <div className="flex items-center gap-1">
              <div className="h-1.5 bg-[#333] rounded-full flex-1">
                <div
                  className="h-1.5 rounded-full bg-amber-400"
                  style={{ width: `${tooltip.trend.impact * 100}%` }}
                />
              </div>
              <span>{(tooltip.trend.impact * 100).toFixed(0)}%</span>
            </div>

            <div className="text-[#888]">{t(locale, "timeHorizon")}</div>
            <div>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: getDotColor(tooltip.trend.timeHorizon) + "20",
                  color: getDotColor(tooltip.trend.timeHorizon),
                }}
              >
                {tooltip.trend.timeHorizon === "short"
                  ? t(locale, "horizonShort")
                  : tooltip.trend.timeHorizon === "mid"
                  ? t(locale, "horizonMid")
                  : t(locale, "horizonLong")}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-[#2a2a4a] flex items-center gap-2 text-[10px] text-[#666]">
            <span>{tooltip.trend.signalCount} {t(locale, "signals")}</span>
            <span>&middot;</span>
            <span>{tooltip.trend.topSources.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-6 mt-4 text-xs text-[#888]">
        <div className="flex items-center gap-4">
          <span className="font-medium text-[#666]">{t(locale, "horizon")}</span>
          {(["short", "mid", "long"] as TimeHorizon[]).map((h) => (
            <span key={h} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: TIME_HORIZON_COLORS[h] }}
              />
              {t(locale, h)}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#666]">{t(locale, "sizeIsImpact")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#666]">{t(locale, "opacityIsConfidence")}</span>
        </div>
      </div>
    </div>
  );
}
