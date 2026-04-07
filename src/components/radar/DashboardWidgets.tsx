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
      <div className="rounded-xl border p-4" style={{ background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3"
          style={{ fontFamily: "var(--volt-font-mono, monospace)", color: "var(--volt-text-faint, #9B9B9B)" }}>
          {locale === "de" ? "Uebersicht" : "Overview"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--pastel-orchid-text, #7C1A9E)" }}>{megaCount}</div>
            <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>Mega-Trends</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--pastel-sky-text, #1A4A8A)" }}>{macroCount}</div>
            <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>Makro-Trends</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--signal-positive, #1A9E5A)" }}>{risingCount}</div>
            <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>{locale === "de" ? "Steigend" : "Rising"}</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--pastel-mint-text, #0F6038)" }}>{adoptCount}</div>
            <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>{getRingLabel(locale, "adopt")}</div>
          </div>
        </div>
      </div>

      {/* Rising Trends */}
      <div className="rounded-xl border p-4" style={{ background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
          style={{ color: "var(--pastel-mint-text, #0F6038)", fontFamily: "var(--volt-font-mono, monospace)" }}>
          <span>▲</span>
          {locale === "de" ? "Steigende Trends" : "Rising Trends"}
        </h3>
        <div className="space-y-1.5">
          {risingTrends.map((trend) => (
            <button
              key={trend.id}
              onClick={() => onTrendClick(trend)}
              className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-2, #F5F5F5)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: TIME_HORIZON_COLORS[trend.timeHorizon] }}
              />
              <span className="text-xs truncate flex-1" style={{ color: "var(--volt-text, #1A1A1A)" }}>{trend.name}</span>
              <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: "var(--signal-positive, #1A9E5A)" }}>
                {(trend.relevance * 100).toFixed(0)}%
              </span>
            </button>
          ))}
          {risingTrends.length === 0 && (
            <div className="text-xs italic" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
              {locale === "de" ? "Keine steigenden Trends" : "No rising trends"}
            </div>
          )}
        </div>
      </div>

      {/* Watch List */}
      <div className="rounded-xl border p-4" style={{ background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
          style={{ color: "var(--pastel-butter-text, #7A5C00)", fontFamily: "var(--volt-font-mono, monospace)" }}>
          <span>⚠</span>
          {locale === "de" ? "Beobachten" : "Watch List"}
        </h3>
        <div className="space-y-1.5">
          {needsAttention.map((trend) => (
            <button
              key={trend.id}
              onClick={() => onTrendClick(trend)}
              className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-2, #F5F5F5)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: TIME_HORIZON_COLORS[trend.timeHorizon] }}
              />
              <span className="text-xs truncate flex-1" style={{ color: "var(--volt-text, #1A1A1A)" }}>{trend.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] font-semibold" style={{ color: "var(--pastel-amber-text, #C8820A)" }}>
                  {(trend.impact * 100).toFixed(0)}%
                </span>
                <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #C0C0C0)" }}>
                  / {(trend.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          ))}
          {needsAttention.length === 0 && (
            <div className="text-xs italic" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
              {locale === "de" ? "Alle Trends gut abgesichert" : "All trends well-covered"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
