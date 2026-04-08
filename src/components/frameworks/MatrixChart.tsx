"use client";

import React from "react";

interface MatrixPoint {
  name: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
}

interface MatrixChartProps {
  points: MatrixPoint[];
  xLabel: string;
  yLabel: string;
  xLow?: string;
  xHigh?: string;
  yLow?: string;
  yHigh?: string;
  accentColor?: string;
  quadrantLabels?: [string, string, string, string]; // TL, TR, BL, BR
  width?: number;
  height?: number;
}

export function MatrixChart({
  points, xLabel, yLabel, xLow, xHigh, yLow, yHigh,
  accentColor = "#1A4A8A",
  quadrantLabels,
  width = 500, height = 400,
}: MatrixChartProps) {
  const pad = { top: 30, right: 30, bottom: 40, left: 50 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  return (
    <svg width={width} height={height} style={{ fontFamily: "var(--font-ui)", overflow: "visible" }}>
      {/* Background quadrants */}
      <rect x={pad.left} y={pad.top} width={w / 2} height={h / 2} fill="var(--muted)" opacity={0.3} />
      <rect x={pad.left + w / 2} y={pad.top} width={w / 2} height={h / 2} fill={`${accentColor}10`} />
      <rect x={pad.left} y={pad.top + h / 2} width={w / 2} height={h / 2} fill="var(--background)" />
      <rect x={pad.left + w / 2} y={pad.top + h / 2} width={w / 2} height={h / 2} fill="var(--muted)" opacity={0.15} />

      {/* Quadrant labels */}
      {quadrantLabels && (
        <>
          <text x={pad.left + w * 0.25} y={pad.top + h * 0.1} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontWeight={600} opacity={0.5}>{quadrantLabels[0]}</text>
          <text x={pad.left + w * 0.75} y={pad.top + h * 0.1} textAnchor="middle" fontSize={9} fill={accentColor} fontWeight={600} opacity={0.6}>{quadrantLabels[1]}</text>
          <text x={pad.left + w * 0.25} y={pad.top + h * 0.95} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontWeight={600} opacity={0.4}>{quadrantLabels[2]}</text>
          <text x={pad.left + w * 0.75} y={pad.top + h * 0.95} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontWeight={600} opacity={0.5}>{quadrantLabels[3]}</text>
        </>
      )}

      {/* Axes */}
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke="var(--border)" strokeWidth={1} />
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke="var(--border)" strokeWidth={1} />

      {/* Center lines */}
      <line x1={pad.left + w / 2} y1={pad.top} x2={pad.left + w / 2} y2={pad.top + h} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4 4" />
      <line x1={pad.left} y1={pad.top + h / 2} x2={pad.left + w} y2={pad.top + h / 2} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4 4" />

      {/* Axis labels */}
      <text x={pad.left + w / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="var(--foreground)" fontWeight={600}>{xLabel}</text>
      <text x={12} y={pad.top + h / 2} textAnchor="middle" fontSize={11} fill="var(--foreground)" fontWeight={600} transform={`rotate(-90, 12, ${pad.top + h / 2})`}>{yLabel}</text>

      {/* Low/High labels */}
      {xLow && <text x={pad.left} y={height - 4} fontSize={9} fill="var(--muted-foreground)">{xLow}</text>}
      {xHigh && <text x={pad.left + w} y={height - 4} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">{xHigh}</text>}
      {yLow && <text x={pad.left - 6} y={pad.top + h} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">{yLow}</text>}
      {yHigh && <text x={pad.left - 6} y={pad.top + 10} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">{yHigh}</text>}

      {/* Points */}
      {points.map((p, i) => {
        const cx = pad.left + (p.x / 5) * w;
        const cy = pad.top + h - (p.y / 5) * h;
        const r = p.size || 18;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill={p.color || accentColor} opacity={0.15} />
            <circle cx={cx} cy={cy} r={r * 0.4} fill={p.color || accentColor} />
            <text x={cx} y={cy - r - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--foreground)">
              {p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
