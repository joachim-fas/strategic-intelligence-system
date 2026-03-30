"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TrendDot } from "@/types";
import { queryIntelligence, IntelligenceBriefing } from "@/lib/intelligence-engine";
import { useLocale } from "@/lib/locale-context";
import { Locale } from "@/lib/i18n";

interface IntelligenceBarProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
}

interface HistoryEntry {
  query: string;
  briefing: IntelligenceBriefing;
  timestamp: Date;
}

function BriefingCard({ briefing, locale, onTrendClick, trends }: {
  briefing: IntelligenceBriefing;
  locale: Locale;
  onTrendClick: (trend: TrendDot) => void;
  trends: TrendDot[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <span className="text-blue-400 text-sm">&#9670;</span>
        <span className="text-sm font-medium text-[#ddd] flex-1">
          {briefing.query}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#555]">{briefing.dataPoints} {locale === "de" ? "Datenpunkte" : "data points"}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            briefing.confidence > 0.7 ? "bg-green-500/15 text-green-400"
            : briefing.confidence > 0.4 ? "bg-amber-500/15 text-amber-400"
            : "bg-red-500/15 text-red-400"
          }`}>
            {(briefing.confidence * 100).toFixed(0)}% {locale === "de" ? "Konfidenz" : "confidence"}
          </span>
          <span className="text-[#444] text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Synthesis */}
          <p className="text-sm text-[#ccc] leading-relaxed">{briefing.synthesis}</p>

          {/* Matched trends as clickable chips */}
          {briefing.matchedTrends.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {briefing.matchedTrends.slice(0, 6).map((m) => (
                <button
                  key={m.trend.id}
                  onClick={() => onTrendClick(m.trend)}
                  className="px-2 py-1 rounded text-[11px] bg-[#1a1a2a] border border-[#2a2a4a] text-blue-300 hover:bg-[#222] transition-colors flex items-center gap-1"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    m.trend.velocity === "rising" ? "bg-green-400"
                    : m.trend.velocity === "falling" ? "bg-red-400"
                    : "bg-gray-500"
                  }`} />
                  {m.trend.name}
                  <span className="text-[#555] ml-1">{(m.trend.relevance * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          )}

          {/* Key Insights */}
          {briefing.keyInsights.length > 0 && (
            <div>
              <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">
                {locale === "de" ? "Erkenntnisse" : "Insights"}
              </div>
              <ul className="space-y-1">
                {briefing.keyInsights.map((insight, i) => (
                  <li key={i} className="text-xs text-[#999] flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">→</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Causal Chains */}
          {briefing.causalChain.length > 0 && (
            <div>
              <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">
                {locale === "de" ? "Kausalketten" : "Causal Chains"}
              </div>
              <ul className="space-y-1">
                {briefing.causalChain.map((chain, i) => (
                  <li key={i} className="text-xs text-[#888] font-mono">{chain}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Regulatory Context */}
          {briefing.regulatoryContext.length > 0 && (
            <div>
              <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">
                {locale === "de" ? "Regulatorischer Kontext" : "Regulatory Context"}
              </div>
              <ul className="space-y-1">
                {briefing.regulatoryContext.map((reg, i) => (
                  <li key={i} className="text-xs text-[#888]">⚖️ {reg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Signal Summary */}
          <div className="text-[10px] text-[#555] pt-1 border-t border-[#1a1a1a]">
            {briefing.signalSummary}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelligenceBar({ trends, onTrendClick }: IntelligenceBarProps) {
  const { locale } = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;

    const briefing = queryIntelligence(query.trim(), trends, locale);
    setHistory((prev) => [{ query: query.trim(), briefing, timestamp: new Date() }, ...prev]);
    setQuery("");
    setIsExpanded(true);
  }, [query, trends, locale]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Quick query suggestions
  const suggestions = locale === "de"
    ? ["AI Regulierung", "Klimawandel", "Cybersecurity", "Geopolitik", "Zukunft der Arbeit", "Energie", "Blockchain", "Gesundheit"]
    : ["AI regulation", "climate change", "cybersecurity", "geopolitics", "future of work", "energy", "blockchain", "health"];

  // Auto-scroll to top on new entry
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [history.length]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
      isExpanded ? "h-[45vh]" : "h-14"
    }`}>
      {/* Backdrop */}
      {isExpanded && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0aee] to-transparent pointer-events-none" />
      )}

      <div className="relative h-full flex flex-col bg-[#0a0a0a] border-t border-[#222]">
        {/* Input Bar — always visible */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-400 hover:text-blue-300 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <span className="text-lg">{isExpanded ? "▼" : "▲"}</span>
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsExpanded(true)}
              placeholder={locale === "de"
                ? "Frage stellen oder Stichwort eingeben... (z.B. 'AI Regulierung', 'Klimawandel', 'Taiwan')"
                : "Ask a question or drop a keyword... (e.g. 'AI regulation', 'climate change', 'Taiwan')"
              }
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className="px-4 py-2.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {locale === "de" ? "Analysieren" : "Analyze"}
          </button>

          <div className="flex items-center gap-2 text-[10px] text-[#444]">
            <span>{trends.length} Trends</span>
            <span>·</span>
            <span>{history.length} {locale === "de" ? "Abfragen" : "queries"}</span>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {/* Quick suggestions (show when no history) */}
            {history.length === 0 && (
              <div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">
                  {locale === "de" ? "Vorschläge" : "Suggestions"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setQuery(s);
                        const briefing = queryIntelligence(s, trends, locale);
                        setHistory((prev) => [{ query: s, briefing, timestamp: new Date() }, ...prev]);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs bg-[#111] border border-[#222] text-[#888] hover:text-white hover:border-[#444] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {history.map((entry, i) => (
              <BriefingCard
                key={`${entry.query}-${i}`}
                briefing={entry.briefing}
                locale={locale}
                onTrendClick={onTrendClick}
                trends={trends}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
