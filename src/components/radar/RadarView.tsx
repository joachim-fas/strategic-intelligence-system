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
  filteredTrendIds?: string[]; // highlight specific trends from a query
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

  const displayTrends = useMemo(() => {
    if (!filteredTrendIds) return trends;
    // Show all trends but could highlight filtered ones later
    return trends;
  }, [trends, filteredTrendIds]);

  return (
    <div className="px-6 py-4 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <RadarChart
          trends={displayTrends}
          quadrants={DEFAULT_QUADRANTS}
          onTrendClick={(t) => { setSelectedId(t.id); onTrendClick(t); }}
          selectedTrendId={selectedId}
          svgRef={svgRef}
          height={500}
          width={500}
        />

        {/* Compact trend list */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded overflow-hidden max-h-[500px] overflow-y-auto">
          {(["adopt", "trial", "assess", "hold"] as Ring[]).map((ring) => {
            const ringTrends = displayTrends.filter((t) => t.ring === ring);
            if (ringTrends.length === 0) return null;
            return (
              <div key={ring}>
                <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider sticky top-0 bg-[#111]" style={{ color: RING_COLORS[ring] }}>
                  {getRingLabel(locale, ring)} ({ringTrends.length})
                </div>
                {ringTrends.sort((a, b) => b.relevance - a.relevance).slice(0, 8).map((trend) => (
                  <button
                    key={trend.id}
                    onClick={() => { setSelectedId(trend.id); onTrendClick(trend); }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#1a1a1a] text-left text-[11px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: RING_COLORS[ring] }} />
                    <span className="text-[#ccc] truncate flex-1">{trend.name}</span>
                    {trend.velocity === "rising" && <span className="text-green-500 text-[9px]">▲</span>}
                    <span className="text-[#444] text-[9px]">{(trend.relevance * 100).toFixed(0)}%</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
