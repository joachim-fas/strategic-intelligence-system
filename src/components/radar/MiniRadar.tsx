"use client";

import { useRef, useEffect } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { TrendDot, RING_COLORS, TIME_HORIZON_COLORS, Ring } from "@/types";

interface MiniRadarProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
  width?: number;
  height?: number;
}

const RINGS: Ring[] = ["adopt", "trial", "assess", "hold"];
const RING_RADII = [0.28, 0.52, 0.75, 1.0];

/**
 * Compact inline radar visualization.
 * Shows matched trends from a query as a small interactive radar.
 * Designed to fit within a CLI result card.
 */
export default function MiniRadar({ trends, onTrendClick, width = 320, height = 320 }: MiniRadarProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy) - 30;

  useEffect(() => {
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    // Rings
    RING_RADII.forEach((r, i) => {
      g.append("circle")
        .attr("r", r * maxR)
        .attr("fill", RING_COLORS[RINGS[i]])
        .attr("fill-opacity", 0.03)
        .attr("stroke", RING_COLORS[RINGS[i]])
        .attr("stroke-opacity", 0.2)
        .attr("stroke-width", 0.5);
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
        .attr("fill-opacity", 0.4)
        .attr("font-size", "8px")
        .text(ring.toUpperCase());
    });

    // Crosshairs
    g.append("line").attr("x1", -maxR).attr("x2", maxR).attr("y1", 0).attr("y2", 0).attr("stroke", "var(--muted-foreground, #6B6B6B)").attr("stroke-width", 0.5);
    g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -maxR).attr("y2", maxR).attr("stroke", "var(--muted-foreground, #6B6B6B)").attr("stroke-width", 0.5);

    // Place trends
    const jitter = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
      return (Math.abs(h) % 1000) / 1000;
    };

    trends.forEach((trend) => {
      const ringIdx = RINGS.indexOf(trend.ring);
      const innerR = ringIdx === 0 ? 0.08 : RING_RADII[ringIdx - 1] + 0.03;
      const outerR = RING_RADII[ringIdx] - 0.03;
      const radius = (innerR + (1 - trend.relevance) * (outerR - innerR)) * maxR;
      const angle = jitter(trend.id) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const size = 4 + trend.impact * 8;

      const dot = g.append("g")
        .attr("transform", `translate(${x},${y})`)
        .style("cursor", "pointer");

      // Dot
      dot.append("circle")
        .attr("r", size)
        .attr("fill", TIME_HORIZON_COLORS[trend.timeHorizon])
        .attr("fill-opacity", 0.3 + trend.confidence * 0.5)
        .attr("stroke", RING_COLORS[trend.ring])
        .attr("stroke-width", 1);

      // Velocity indicator
      if (trend.velocity === "rising") {
        dot.append("circle")
          .attr("r", size + 2)
          .attr("fill", "none")
          .attr("stroke", TIME_HORIZON_COLORS[trend.timeHorizon])
          .attr("stroke-width", 0.5)
          .attr("stroke-opacity", 0.3)
          .attr("stroke-dasharray", "2,2");
      }

      // Label
      dot.append("text")
        .attr("y", size + 10)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--volt-text-faint, #999)")
        .attr("font-size", "7px")
        .text(trend.name.length > 20 ? trend.name.slice(0, 18) + "…" : trend.name);

      // Click
      dot.on("click", () => onTrendClick(trend));

      // Hover
      dot.on("mouseenter", function () {
        select(this).select("circle").transition().duration(100).attr("r", size + 2);
      });
      dot.on("mouseleave", function () {
        select(this).select("circle").transition().duration(100).attr("r", size);
      });
    });
  }, [trends, cx, cy, maxR, onTrendClick]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto"
    />
  );
}
