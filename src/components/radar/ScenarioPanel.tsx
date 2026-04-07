"use client";

import { useState } from "react";
import { TrendDot } from "@/types";
import { SCENARIO_TEMPLATES, applyScenario, Scenario, ScenarioResult } from "@/lib/scenarios";
import { useLocale } from "@/lib/locale-context";

interface ScenarioPanelProps {
  trends: TrendDot[];
  onApplyScenario: (modifiedTrends: TrendDot[]) => void;
  onReset: () => void;
}

export default function ScenarioPanel({ trends, onApplyScenario, onReset }: ScenarioPanelProps) {
  const { locale } = useLocale();
  const [activeResult, setActiveResult] = useState<ScenarioResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = (template: typeof SCENARIO_TEMPLATES[0], index: number) => {
    const scenario: Scenario = { ...template, id: `scenario-${index}` };
    const result = applyScenario(trends, scenario);
    setActiveResult(result);
    const trendMap = new Map(trends.map((t) => [t.id, { ...t }]));
    for (const affected of result.affectedTrends) {
      const t = trendMap.get(affected.trendId);
      if (t) {
        t.relevance = affected.relevanceAfter;
        t.confidence = affected.confidenceAfter;
        t.ring = affected.newRing;
      }
    }
    onApplyScenario(Array.from(trendMap.values()));
  };

  const handleReset = () => {
    setActiveResult(null);
    onReset();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
        style={{ background: "var(--pastel-butter, #FFF5BA)", color: "var(--pastel-butter-text, #7A5C00)", border: "1px solid var(--pastel-butter-border, #E0C840)" }}
      >
        {locale === "de" ? "⚡ Szenarien" : "⚡ Scenarios"}
      </button>
    );
  }

  return (
    <div
      className="fixed left-0 top-0 h-full w-[480px] shadow-xl z-40 overflow-y-auto"
      style={{ background: "var(--color-surface, #FAFAFA)", borderRight: "1px solid var(--volt-border, #E8E8E8)" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-4 border-b" style={{ background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--volt-text, #1A1A1A)" }}>
            {locale === "de" ? "⚡ What-If Szenarien" : "⚡ What-If Scenarios"}
          </h2>
          <button onClick={() => setIsOpen(false)} className="text-sm transition-colors" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
            ✕
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
          {locale === "de"
            ? "Wie veraendern sich die Trends wenn ein Ereignis eintritt?"
            : "How do trends shift when an event occurs?"}
        </p>

        {activeResult && (
          <button
            onClick={handleReset}
            className="mt-3 px-3 py-1.5 rounded-full text-xs font-medium w-full transition-colors"
            style={{ background: "var(--pastel-rose, #FDEEE9)", color: "var(--signal-negative, #C0341D)", border: "1px solid var(--pastel-rose-border, #F4A090)" }}
          >
            {locale === "de" ? "↺ Szenario zuruecksetzen" : "↺ Reset scenario"}
          </button>
        )}
      </div>

      {/* Active Result */}
      {activeResult && (
        <div className="px-6 py-4 border-b" style={{ background: "var(--pastel-orchid-light, #FDE2FF)", borderColor: "var(--pastel-orchid-border, #D4A0F0)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--pastel-orchid-text, #7C1A9E)" }}>
            {activeResult.scenario.name}
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="text-lg font-bold" style={{ color: "var(--volt-text, #1A1A1A)" }}>{activeResult.totalAffected}</div>
              <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                {locale === "de" ? "Betroffen" : "Affected"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold" style={{ color: "var(--pastel-butter-text, #7A5C00)" }}>{activeResult.ringChanges}</div>
              <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                {locale === "de" ? "Ring-Wechsel" : "Ring changes"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold" style={{ color: "var(--pastel-orchid-text, #7C1A9E)" }}>
                {(activeResult.scenario.probability * 100).toFixed(0)}%
              </div>
              <div className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                {locale === "de" ? "Wahrscheinl." : "Probability"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {activeResult.affectedTrends.map((at) => {
              const shift = at.relevanceAfter - at.relevanceBefore;
              return (
                <div key={at.trendId} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: at.impactType === "direct" ? "var(--pastel-orchid-text, #7C1A9E)" : "var(--pastel-orchid-border, #D4A0F0)" }}
                  />
                  <span className="flex-1 truncate" style={{ color: "var(--volt-text, #3A3A3A)" }}>{at.trendName}</span>
                  {at.originalRing !== at.newRing && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--pastel-butter, #FFF5BA)", color: "var(--pastel-butter-text, #7A5C00)" }}>
                      {at.originalRing} → {at.newRing}
                    </span>
                  )}
                  <span className="text-[10px] font-mono" style={{
                    color: shift > 0 ? "var(--pastel-mint-text, #0F6038)" : shift < 0 ? "var(--signal-negative, #C0341D)" : "var(--volt-text-faint, #9B9B9B)"
                  }}>
                    {shift > 0 ? "+" : ""}{(shift * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #C0C0C0)" }}>
                    {at.impactType === "cascade" ? "↪" : "●"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scenario Templates */}
      <div className="px-6 py-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
          {locale === "de" ? "Szenarien auswaehlen" : "Select Scenario"}
        </h3>
        <div className="space-y-2.5">
          {SCENARIO_TEMPLATES.map((template, i) => {
            const isActive = activeResult?.scenario.name === template.name;
            const probColor = template.probability > 0.5
              ? { bg: "var(--pastel-mint, #C3F4D3)", color: "var(--pastel-mint-text, #0F6038)" }
              : template.probability > 0.2
              ? { bg: "var(--pastel-butter, #FFF5BA)", color: "var(--pastel-butter-text, #7A5C00)" }
              : { bg: "var(--pastel-rose, #FDEEE9)", color: "var(--signal-negative, #C0341D)" };
            return (
              <button
                key={i}
                onClick={() => handleApply(template, i)}
                className="w-full text-left p-3.5 rounded-xl border transition-all"
                style={isActive
                  ? { background: "var(--pastel-orchid-light, #FDE2FF)", borderColor: "var(--pastel-orchid-border, #D4A0F0)" }
                  : { background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--volt-text, #1A1A1A)" }}>{template.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold"
                    style={{ background: probColor.bg, color: probColor.color }}>
                    {(template.probability * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: "var(--volt-text-muted, #6B6B6B)" }}>{template.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                    {template.directImpacts.length} {locale === "de" ? "direkte Auswirkungen" : "direct impacts"}
                  </span>
                  {template.source && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-surface-2, #F0F2F7)", color: "var(--volt-text-muted, #3A4560)" }}>
                      {template.source}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
