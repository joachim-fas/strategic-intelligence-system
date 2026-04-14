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

    // Ring labels — placed on the top axis, small and muted so trends dominate
    RINGS.forEach((ring, i) => {
      const labelR = i === 0 ? RING_RADII[0] / 2 : (RING_RADII[i - 1] + RING_RADII[i]) / 2;
      g.append("text")
        .attr("x", 0)
        .attr("y", -labelR * maxR)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", RING_COLORS[ring])
        .attr("fill-opacity", 0.55)
        .attr("font-family", "var(--volt-font-mono, monospace)")
        .attr("font-size", "9px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.08em")
        .text(ring.toUpperCase());
    });

    // Crosshairs
    g.append("line").attr("x1", -maxR).attr("x2", maxR).attr("y1", 0).attr("y2", 0).attr("stroke", "var(--muted-foreground, #6B6B6B)").attr("stroke-width", 0.5).attr("stroke-opacity", 0.3);
    g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -maxR).attr("y2", maxR).attr("stroke", "var(--muted-foreground, #6B6B6B)").attr("stroke-width", 0.5).attr("stroke-opacity", 0.3);

    // Group trends by ring for even angular distribution
    const byRing: Record<Ring, TrendDot[]> = { adopt: [], trial: [], assess: [], hold: [] };
    trends.forEach((t) => {
      if (byRing[t.ring]) byRing[t.ring].push(t);
    });
    // Stable sort within each ring
    (Object.keys(byRing) as Ring[]).forEach((r) => byRing[r].sort((a, b) => a.id.localeCompare(b.id)));

    // Place trends: even angular distribution per ring, relevance controls radial position
    RINGS.forEach((ring, ringIdx) => {
      const ringTrends = byRing[ring];
      const n = ringTrends.length;
      if (n === 0) return;

      const innerR = ringIdx === 0 ? 0.08 : RING_RADII[ringIdx - 1] + 0.04;
      const outerR = RING_RADII[ringIdx] - 0.04;
      // Stagger angular offset per ring so rings don't all line up on the same axis
      const ringOffset = ringIdx * 0.37;

      ringTrends.forEach((trend, i) => {
        const angle = ((i + 0.5) / n) * Math.PI * 2 + ringOffset - Math.PI / 2;
        const radius = (innerR + (1 - trend.relevance) * (outerR - innerR)) * maxR;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const size = 3 + trend.impact * 5;

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

        // Label — positioned radially outward from center so labels fan out
        const labelDist = size + 6;
        const lx = Math.cos(angle) * labelDist;
        const ly = Math.sin(angle) * labelDist;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const textAnchor = Math.abs(cosA) < 0.3 ? "middle" : cosA > 0 ? "start" : "end";
        const dominantBaseline = sinA > 0.3 ? "hanging" : sinA < -0.3 ? "baseline" : "middle";

        dot.append("text")
          .attr("class", "trend-label")
          .attr("x", lx)
          .attr("y", ly)
          .attr("text-anchor", textAnchor)
          .attr("dominant-baseline", dominantBaseline)
          .attr("fill", "var(--color-text-muted, #6B6B6B)")
          .attr("font-family", "var(--volt-font-ui, sans-serif)")
          .attr("font-size", "9px")
          .text(trend.name.length > 24 ? trend.name.slice(0, 22) + "…" : trend.name);

        // Click
        dot.on("click", () => onTrendClick(trend));

        // Hover — raise bubble, emphasize label
        dot.on("mouseenter", function () {
          const sel = select(this);
          sel.raise();
          sel.select("circle").transition().duration(100).attr("r", size + 3);
          sel.select("text.trend-label")
            .transition().duration(100)
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .attr("fill", "var(--color-text-primary, #0A0A0A)");
        });
        dot.on("mouseleave", function () {
          const sel = select(this);
          sel.select("circle").transition().duration(100).attr("r", size);
          sel.select("text.trend-label")
            .transition().duration(100)
            .attr("font-size", "9px")
            .attr("font-weight", "400")
            .attr("fill", "var(--color-text-muted, #6B6B6B)");
        });
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
