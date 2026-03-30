"use client";

import { TrendDot, TIME_HORIZON_COLORS } from "@/types";
import { useLocale } from "@/lib/locale-context";
import { getRingLabel } from "@/lib/i18n";

interface DashboardWidgetsProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
}

export default function DashboardWidgets({ trends, onTrendClick }: DashboardWidgetsProps) {
  const { locale } = useLocale();

  const risingTrends = trends
    .filter((t) => t.velocity === "rising")
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  const needsAttention = trends
    .filter((t) => t.impact > 0.7 && t.confidence < 0.6)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5);

  const megaCount  = trends.filter((t) => t.category === "Mega-Trend").length;
  const macroCount = trends.filter((t) => t.category === "Makro-Trend").length;
  const adoptCount = trends.filter((t) => t.ring === "adopt").length;
  const risingCount = trends.filter((t) => t.velocity === "rising").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

      {/* Overview Stats */}
      <div className="rounded-xl border p-4" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
        <h3 className="text-[10px] font-semibold text-[#9B9B9B] uppercase tracking-wider mb-3"
          style={{ fontFamily: "var(--font-code, monospace)" }}>
          {locale === "de" ? "Übersicht" : "Overview"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-bold" style={{ color: "#7C1A9E" }}>{megaCount}</div>
            <div className="text-[10px] text-[#9B9B9B]">Mega-Trends</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#1A4A8A" }}>{macroCount}</div>
            <div className="text-[10px] text-[#9B9B9B]">Makro-Trends</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#1A9E5A" }}>{risingCount}</div>
            <div className="text-[10px] text-[#9B9B9B]">{locale === "de" ? "Steigend" : "Rising"}</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#0F6038" }}>{adoptCount}</div>
            <div className="text-[10px] text-[#9B9B9B]">{getRingLabel(locale, "adopt")}</div>
          </div>
        </div>
      </div>

      {/* Rising Trends */}
      <div className="rounded-xl border p-4" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
          style={{ color: "#0F6038", fontFamily: "var(--font-code, monospace)" }}>
          <span>▲</span>
          {locale === "de" ? "Steigende Trends" : "Rising Trends"}
        </h3>
        <div className="space-y-1.5">
          {risingTrends.map((trend) => (
            <button
              key={trend.id}
              onClick={() => onTrendClick(trend)}
              className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-[#F5F5F5]"
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: TIME_HORIZON_COLORS[trend.timeHorizon] }}
              />
              <span className="text-xs text-[#1A1A1A] truncate flex-1">{trend.name}</span>
              <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: "#1A9E5A" }}>
                {(trend.relevance * 100).toFixed(0)}%
              </span>
            </button>
          ))}
          {risingTrends.length === 0 && (
            <div className="text-xs text-[#9B9B9B] italic">
              {locale === "de" ? "Keine steigenden Trends" : "No rising trends"}
            </div>
          )}
        </div>
      </div>

      {/* Watch List */}
      <div className="rounded-xl border p-4" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
          style={{ color: "#7A5C00", fontFamily: "var(--font-code, monospace)" }}>
          <span>⚠</span>
          {locale === "de" ? "Beobachten" : "Watch List"}
        </h3>
        <div className="space-y-1.5">
          {needsAttention.map((trend) => (
            <button
              key={trend.id}
              onClick={() => onTrendClick(trend)}
              className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-[#F5F5F5]"
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: TIME_HORIZON_COLORS[trend.timeHorizon] }}
              />
              <span className="text-xs text-[#1A1A1A] truncate flex-1">{trend.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] font-semibold" style={{ color: "#C8820A" }}>
                  {(trend.impact * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-[#C0C0C0]">
                  / {(trend.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          ))}
          {needsAttention.length === 0 && (
            <div className="text-xs text-[#9B9B9B] italic">
              {locale === "de" ? "Alle Trends gut abgesichert" : "All trends well-covered"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
