"use client";

import { useState, useMemo, useRef } from "react";
import RadarChart from "./RadarChart";
import { TrendDot, Ring, RING_COLORS } from "@/types";
import { getRingLabel } from "@/lib/i18n";
import { Locale } from "@/lib/i18n";

interface RadarViewProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
  locale: Locale;
  filteredTrendIds?: string[];
}

const DEFAULT_QUADRANTS = [
  "Technology & AI",
  "Business & Society",
  "Development & Engineering",
  "Data & Infrastructure",
];

export default function RadarView({ trends, onTrendClick, locale, filteredTrendIds }: RadarViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const displayTrends = useMemo(() => {
    if (!filteredTrendIds) return trends;
    return trends;
  }, [trends, filteredTrendIds]);

  const filteredListTrends = useMemo(() => {
    if (!searchQuery.trim()) return displayTrends;
    const q = searchQuery.toLowerCase();
    return displayTrends.filter(t => t.name.toLowerCase().includes(q));
  }, [displayTrends, searchQuery]);

  return (
    <div style={{ padding: "16px 24px", maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        {/* Radar Chart — large */}
        <RadarChart
          trends={displayTrends}
          quadrants={DEFAULT_QUADRANTS}
          onTrendClick={(t) => {
            setSelectedId(t.id);
            onTrendClick(t);
          }}
          selectedTrendId={selectedId}
          svgRef={svgRef}
        />

        {/* Sidebar: Trend list */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            overflow: "hidden",
            maxHeight: 600,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
            <input
              type="text"
              placeholder="Trend suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Ring groups */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {(["adopt", "trial", "assess", "hold"] as Ring[]).map((ring) => {
              const ringTrends = filteredListTrends
                .filter((t) => t.ring === ring)
                .sort((a, b) => b.relevance - a.relevance);
              if (ringTrends.length === 0) return null;
              return (
                <div key={ring}>
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: RING_COLORS[ring],
                      position: "sticky",
                      top: 0,
                      background: "var(--color-surface)",
                      borderBottom: "1px solid var(--color-border)",
                      zIndex: 1,
                    }}
                  >
                    {getRingLabel(locale, ring)} ({ringTrends.length})
                  </div>
                  {ringTrends.slice(0, 12).map((trend) => {
                    const isActive = trend.id === selectedId;
                    return (
                      <button
                        key={trend.id}
                        onClick={() => {
                          setSelectedId(trend.id);
                          onTrendClick(trend);
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          textAlign: "left",
                          fontSize: 12,
                          border: "none",
                          background: isActive
                            ? "var(--color-lime, #E4FF97)" + "22"
                            : "transparent",
                          cursor: "pointer",
                          transition: "background 0.1s",
                          borderLeft: isActive
                            ? `3px solid ${RING_COLORS[ring]}`
                            : "3px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive)
                            e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: RING_COLORS[ring],
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            color: "var(--color-text-primary)",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {trend.name}
                        </span>
                        {trend.velocity === "rising" && (
                          <span style={{ color: "var(--signal-positive, #16a34a)", fontSize: 10, flexShrink: 0 }}>▲</span>
                        )}
                        <span
                          style={{
                            color: "var(--color-text-muted)",
                            fontSize: 10,
                            flexShrink: 0,
                            fontWeight: 600,
                          }}
                        >
                          {(trend.relevance * 100).toFixed(0)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div
            style={{
              padding: "8px 12px",
              borderTop: "1px solid var(--color-border)",
              fontSize: 10,
              color: "var(--color-text-muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{displayTrends.length} Trends</span>
            <span>
              {displayTrends.filter((t) => t.velocity === "rising").length} steigend
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
