"use client";

import { useState } from "react";
import { Locale } from "@/lib/i18n";
import { useT } from "@/lib/locale-context";

export function CausalOrbit({ chains, locale: _locale, onNodeClick }: {
  chains: string[];
  locale: Locale;
  onNodeClick?: (node: string) => void;
}) {
  const { t } = useT();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const parsedChains = chains.map((chain) =>
    chain.split(/\s*[→➜>]\s*/).map((p) => p.trim()).filter(Boolean)
  );

  const allNodes = new Map<string, { count: number; chains: number[] }>();
  parsedChains.forEach((parts, ci) => {
    parts.forEach((p) => {
      const existing = allNodes.get(p) || { count: 0, chains: [] };
      existing.count++;
      existing.chains.push(ci);
      allNodes.set(p, existing);
    });
  });

  const nodeList = [...allNodes.entries()];
  const centerX = 160;
  const centerY = 110;
  const radius = 85;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.10em", textTransform: "uppercase" as const,
        color: "var(--volt-text-faint, #AAA)", marginBottom: 12,
      }}>
        {t("causalOrbit.heading")} · {parsedChains.length} {t("causalOrbit.chainsLabel")} · {allNodes.size} Nodes
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {/* SVG orbit */}
        <div style={{ flexShrink: 0 }}>
          <svg
            width="280" height="200" viewBox="0 0 280 200"
            style={{ background: "var(--color-page-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
          >
            <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4,4" />
            <circle cx={centerX} cy={centerY} r={radius * 0.55} fill="none" stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="2,4" />

            {/* Chain edges */}
            {parsedChains.map((parts, ci) => {
              const points: [number, number][] = parts.map((p) => {
                const idx = nodeList.findIndex(([n]) => n === p);
                const angle = (idx / nodeList.length) * Math.PI * 2 - Math.PI / 2;
                const r = radius * (0.5 + (idx % 3) * 0.2);
                return [centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r];
              });
              const isHovered = hoveredIdx === ci;
              return points.slice(1).map((pt, pi) => (
                <line
                  key={`${ci}-${pi}`}
                  x1={points[pi][0]} y1={points[pi][1]}
                  x2={pt[0]} y2={pt[1]}
                  stroke={isHovered ? "var(--color-warning)" : "var(--color-border-strong)"}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={isHovered ? 1 : 0.7}
                />
              ));
            })}

            {/* Nodes */}
            {nodeList.map(([name, data], i) => {
              const angle = (i / nodeList.length) * Math.PI * 2 - Math.PI / 2;
              const r = radius * (0.5 + (i % 3) * 0.2);
              const x = centerX + Math.cos(angle) * r;
              const y = centerY + Math.sin(angle) * r;
              const isChainHovered = hoveredIdx !== null && data.chains.includes(hoveredIdx);
              const isNodeHovered = hoveredNode === name;
              const nr = 3 + data.count * 2;
              return (
                <g
                  key={name}
                  style={{ cursor: onNodeClick ? "pointer" : "default" }}
                  onMouseEnter={() => setHoveredNode(name)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => onNodeClick?.(name)}
                >
                  <circle
                    cx={x} cy={y}
                    r={nr + (isNodeHovered ? 3 : 0)}
                    fill={isNodeHovered ? "#E4FF97" : isChainHovered ? "var(--color-warning)" : data.count > 1 ? "var(--color-brand)" : "var(--color-border-strong)"}
                    stroke={isNodeHovered ? "var(--volt-text, #0A0A0A)" : "var(--volt-surface, white)"}
                    strokeWidth={1.5}
                  />
                  <text
                    x={x} y={y + nr + 10 + (isNodeHovered ? 3 : 0)}
                    textAnchor="middle"
                    fill={isChainHovered || isNodeHovered ? "var(--color-text-primary)" : "var(--color-text-muted)"}
                    fontSize={isNodeHovered ? "8" : "7"}
                    fontWeight={isNodeHovered ? "600" : "400"}
                    fontFamily="var(--volt-font-ui, sans-serif)"
                  >
                    {name.length > 18 ? name.slice(0, 16) + "…" : name}
                  </text>
                  {isNodeHovered && onNodeClick && (
                    <text
                      x={x} y={y - nr - 4}
                      textAnchor="middle"
                      fill="var(--volt-text, #0A0A0A)" fontSize="7" fontWeight="600" fontFamily="var(--volt-font-ui, sans-serif)"
                    >
                      Analysieren
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Chain list */}
        <div style={{ flex: 1, overflowY: "auto", maxHeight: 200, display: "flex", flexDirection: "column", gap: 2 }}>
          {parsedChains.map((parts, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                padding: "7px 10px", borderRadius: "var(--radius-sm)", cursor: "default", transition: "all 0.1s",
                background: hoveredIdx === i ? "var(--color-warning-light)" : "transparent",
                border: `1px solid ${hoveredIdx === i ? "var(--color-warning-mid)" : "transparent"}`,
              }}
            >
              {parts.map((p, pi) => (
                <span key={pi}>
                  <span style={{
                    fontSize: 12,
                    color: hoveredIdx === i ? "var(--color-text-primary)" : "var(--color-text-subtle)",
                    fontWeight: hoveredIdx === i ? 500 : 400,
                  }}>{p}</span>
                  {pi < parts.length - 1 && (
                    <span style={{ color: "var(--color-warning)", margin: "0 6px", fontSize: 11 }}>→</span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
