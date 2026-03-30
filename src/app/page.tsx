"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TrendDot } from "@/types";
import { dummyTrends } from "@/lib/dummy-data";
import { queryIntelligenceAsync } from "@/lib/intelligence-engine";
import { classifyTrends } from "@/lib/classify";
import { useLocale } from "@/lib/locale-context";
import TrendDetailPanel from "@/components/radar/TrendDetailPanel";
import { parseContextFromText, applyContextProfile, PRESET_PROFILES, ContextProfile } from "@/lib/context-profiles";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { connectors } from "@/connectors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BriefingResult, HistoryEntry } from "@/components/briefing/BriefingResult";
import {
  saveHistoryToStorage,
  loadHistoryFromStorage,
  clearHistoryStorage,
  downloadSessionMarkdown,
} from "@/lib/briefing-export";

type OverlayPanel = "sources" | "connectors" | null;

// Lazy load heavy components only when needed
import dynamic from "next/dynamic";
const RadarView = dynamic(() => import("@/components/radar/RadarView"), { ssr: false });
const CausalGraphView = dynamic(() => import("@/components/radar/CausalGraphView"), { ssr: false });
const IntelligenceFeed = dynamic(() => import("@/components/radar/IntelligenceFeed"), { ssr: false });
export default function Home() {
  const { locale, toggleLocale } = useLocale();
  const [baseTrends, setBaseTrends] = useState<TrendDot[]>(dummyTrends);
  const [activePanel, setActivePanel] = useState<OverlayPanel>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contextProfile, setContextProfile] = useState<ContextProfile | null>(null);
  const trends = contextProfile ? applyContextProfile(baseTrends, contextProfile) : baseTrends;

  // Load trends from DB on mount — fall back to hardcoded data
  useEffect(() => {
    fetch("/api/v1/trends")
      .then((res) => res.json())
      .then((data) => {
        if (data.trends?.length > 0) {
          setBaseTrends(classifyTrends(data.trends as TrendDot[]));
        }
      })
      .catch(() => { /* keep dummyTrends */ });
  }, []);

  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);
  const [sessionExported, setSessionExported] = useState(false);

  // Load persisted history and active project on mount
  useEffect(() => {
    const stored = loadHistoryFromStorage();
    if (stored.length > 0) setHistory(stored);
    const storedProject = localStorage.getItem("sis-active-project");
    if (storedProject) setActiveProjectId(storedProject);
    // Re-run from /projects page
    const urlQ = new URLSearchParams(window.location.search).get("q");
    if (urlQ) {
      setQuery(decodeURIComponent(urlQ));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Persist history on every change (debounced via completed entries only)
  useEffect(() => {
    saveHistoryToStorage(history);
  }, [history]);
  const [showFullRadar, setShowFullRadar] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on load
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = useCallback((overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    // ── Special commands ──
    if (q === "/radar" || q === "/r") { setShowFullRadar(true); setShowGraph(false); setQuery(""); return; }
    if (q === "/graph" || q === "/g") { setShowGraph(true); setShowFullRadar(false); setQuery(""); return; }
    if (q === "/close" || q === "/c") { setShowFullRadar(false); setShowGraph(false); setQuery(""); return; }

    if (q === "/live") {
      fetch("/api/v1/pipeline", { method: "POST" });
      setHistory((prev) => [{
        query: "/live",
        briefing: {
          query: "/live", matchedTrends: [],
          synthesis: locale === "de" ? "Live-Daten werden geladen..." : "Fetching live data...",
          keyInsights: [], regulatoryContext: [], causalChain: [], reasoningChains: [],
          signalSummary: "", confidence: 0, dataPoints: 0,
        },
        timestamp: new Date(),
      }, ...prev]);
      setQuery(""); return;
    }

    if (q === "/en" || q === "/de") { toggleLocale(); setQuery(""); return; }

    if (q === "/help" || q === "/h") {
      setHistory((prev) => [{
        query: "/help",
        briefing: {
          query: "/help", matchedTrends: [],
          synthesis: "",
          keyInsights: locale === "de" ? [
            "Tippe ein Stichwort oder eine Frage — z.B. 'AI', 'Klimawandel', 'Taiwan', 'Cybersecurity'",
            "/radar oder /r — Vollständiges Radar öffnen",
            "/close oder /c — Radar schließen",
            "/live — Live-Daten von allen Quellen laden",
            "/en oder /de — Sprache wechseln",
            "/clear — Verlauf löschen",
            "Klicke auf einen Trend-Chip um Details zu sehen",
          ] : [
            "Type a keyword or question — e.g. 'AI', 'climate change', 'Taiwan', 'cybersecurity'",
            "/radar or /r — Open full radar view",
            "/close or /c — Close radar view",
            "/live — Fetch live data from all sources",
            "/en or /de — Switch language",
            "/clear — Clear history",
            "Click any trend chip to see details",
          ],
          regulatoryContext: [], causalChain: [], reasoningChains: [],
          signalSummary: "", confidence: 1, dataPoints: 0,
        },
        timestamp: new Date(),
      }, ...prev]);
      setQuery(""); return;
    }

    if (q === "/clear") { setHistory([]); clearHistoryStorage(); setQuery(""); return; }

    // ── /context command ──
    if (q.startsWith("/context")) {
      const contextText = q.replace("/context", "").trim();

      if (!contextText) {
        const presetList = PRESET_PROFILES.map((p) => `  ${p.id}: ${p.role} / ${p.industry} / ${p.region}`).join("\n");
        setHistory((prev) => [{
          query: "/context",
          briefing: {
            query: "/context", matchedTrends: [],
            synthesis: contextProfile
              ? `${locale === "de" ? "Aktueller Kontext" : "Current context"}: ${contextProfile.role} / ${contextProfile.industry} / ${contextProfile.region}`
              : (locale === "de" ? "Kein Kontext gesetzt." : "No context set."),
            keyInsights: locale === "de" ? [
              "Beschreibe deinen Kontext: /context CTO Automotive DACH",
              "Oder nutze ein Preset: /context cto-automotive-dach",
              "Kontext zurücksetzen: /context reset",
              `Verfügbare Presets:\n${presetList}`,
            ] : [
              "Describe your context: /context CTO Automotive DACH",
              "Or use a preset: /context cto-automotive-dach",
              "Reset context: /context reset",
              `Available presets:\n${presetList}`,
            ],
            regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }

      if (contextText === "reset") {
        setContextProfile(null);
        setHistory((prev) => [{
          query: "/context reset",
          briefing: {
            query: "/context reset", matchedTrends: [],
            synthesis: locale === "de" ? "Kontext zurückgesetzt. Neutrale Perspektive." : "Context reset. Neutral perspective.",
            keyInsights: [], regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }

      const preset = PRESET_PROFILES.find((p) => p.id === contextText);
      if (preset) {
        setContextProfile(preset);
        setHistory((prev) => [{
          query: `/context ${contextText}`,
          briefing: {
            query: `/context ${contextText}`, matchedTrends: [],
            synthesis: locale === "de"
              ? `Kontext gesetzt: ${preset.role} / ${preset.industry} / ${preset.region}. Alle Scores werden durch diese Linse rekalibriert.`
              : `Context set: ${preset.role} / ${preset.industry} / ${preset.region}. All scores recalibrated through this lens.`,
            keyInsights: [`${locale === "de" ? "Regulatorischer Fokus" : "Regulatory focus"}: ${preset.regulationFocus.join(", ")}`],
            regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }

      const parsed = parseContextFromText(contextText);
      if (parsed.role || parsed.industry || parsed.region) {
        const newProfile: ContextProfile = {
          id: "custom",
          role: parsed.role || "General",
          industry: parsed.industry || "Cross-Industry",
          region: parsed.region || "Global",
          orgSize: parsed.orgSize,
          trendWeights: {},
          regulationFocus: parsed.region === "DACH" || parsed.region === "EU" ? ["EU", "Global"] : [parsed.region || "Global"],
          sourcePreferences: {},
        };
        setContextProfile(newProfile);
        setHistory((prev) => [{
          query: `/context ${contextText}`,
          briefing: {
            query: `/context ${contextText}`, matchedTrends: [],
            synthesis: locale === "de"
              ? `Kontext erkannt: ${newProfile.role} / ${newProfile.industry} / ${newProfile.region}${newProfile.orgSize ? ` / ${newProfile.orgSize}` : ""}. Perspektive angepasst.`
              : `Context detected: ${newProfile.role} / ${newProfile.industry} / ${newProfile.region}${newProfile.orgSize ? ` / ${newProfile.orgSize}` : ""}. Perspective adjusted.`,
            keyInsights: [], regulatoryContext: [], causalChain: [], reasoningChains: [],
            signalSummary: "", confidence: 1, dataPoints: 0,
          },
          timestamp: new Date(),
        }, ...prev]);
        setQuery(""); return;
      }
    }

    // ── Real query — start loading ──
    const entryId = `${q}-${Date.now()}`;
    setHistory((prev) => [{
      id: entryId,
      query: q,
      isLoading: true,
      briefing: {
        query: q, matchedTrends: [],
        synthesis: "",
        reasoningChains: [], keyInsights: [], regulatoryContext: [], causalChain: [],
        signalSummary: "", confidence: 0, dataPoints: 0,
      },
      timestamp: new Date(),
    }, ...prev]);
    setQuery("");

    const ctxProfile = contextProfile
      ? { role: contextProfile.role, industry: contextProfile.industry, region: contextProfile.region }
      : undefined;

    // Stream synthesis tokens in real-time
    let streamedSynthesis = "";
    const onSynthesisChunk = (chunk: string) => {
      streamedSynthesis += chunk;
      setHistory((prev) => prev.map((e) =>
        e.id === entryId
          ? { ...e, isLoading: true, briefing: { ...e.briefing, synthesis: streamedSynthesis } }
          : e
      ));
    };

    queryIntelligenceAsync(q, trends, locale, ctxProfile, onSynthesisChunk)
      .then((llmBriefing) => {
        if (llmBriefing && llmBriefing.synthesis && llmBriefing.synthesis.length > 20) {
          // ✅ LLM succeeded — full structured briefing
          setHistory((prev) => prev.map((e) =>
            e.id === entryId
              ? { ...e, isLoading: false, error: undefined, briefing: llmBriefing, showRadar: llmBriefing.matchedTrends.length > 2 }
              : e
          ));
        } else {
          // ❌ LLM returned null or empty synthesis — show error, no silent fallback
          setHistory((prev) => prev.map((e) =>
            e.id === entryId
              ? { ...e, isLoading: false, error: locale === "de"
                  ? "Die KI-Analyse hat keine verwertbare Antwort geliefert. Möglicherweise ist die Anfrage zu kurz oder das System überlastet."
                  : "The AI analysis returned no usable response. The query may be too short or the system is overloaded." }
              : e
          ));
        }
      })
      .catch((err: unknown) => {
        // ❌ Network or API error — show specific error, no silent fallback
        const msg = err instanceof Error ? err.message : String(err);
        setHistory((prev) => prev.map((e) =>
          e.id === entryId
            ? { ...e, isLoading: false, error: locale === "de"
                ? `Verbindungsfehler: ${msg}. Bitte erneut versuchen.`
                : `Connection error: ${msg}. Please try again.` }
            : e
        ));
      });
  }, [query, trends, locale, toggleLocale, contextProfile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  };

  const suggestions = locale === "de"
    ? ["AI Regulierung", "Klimawandel", "Taiwan", "Cybersecurity", "Zukunft der Arbeit", "Geopolitik"]
    : ["AI regulation", "climate change", "Taiwan", "cybersecurity", "future of work", "geopolitics"];

  const isFirstVisit = history.length === 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-page-bg)", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-xs)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-md)",
              background: "#E4FF97", border: "1.5px solid rgba(0,0,0,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.05em",
            }}>SIS</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-heading)" }}>Strategic Intelligence System</span>
            {contextProfile && (
              <Badge className="bg-[#FDE2FF] text-[#7C1A9E] border-[#D4A0F0] text-[11px]">
                {contextProfile.role} · {contextProfile.industry}
              </Badge>
            )}
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button variant="ghost" size="sm" asChild className="text-[13px] font-normal text-[#6B6B6B] hover:text-[#0A0A0A]">
              <a href="/trends">{trends.length} Trends ↗</a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-[13px] font-normal text-[#6B6B6B] hover:text-[#0A0A0A]">
              <a href="/sources">{locale === "de" ? "Quellen & Connectors ↗" : "Sources & Connectors ↗"}</a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-[13px] font-normal text-[#6B6B6B] hover:text-[#0A0A0A]">
              <a href="/canvas">{locale === "de" ? "Canvas ↗" : "Canvas ↗"}</a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-[13px] font-normal text-[#6B6B6B] hover:text-[#0A0A0A]">
              <a href="/projects">{activeProjectId ? "◆ " : ""}{locale === "de" ? "Projekte ↗" : "Projects ↗"}</a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-[13px] font-normal text-[#6B6B6B] hover:text-[#0A0A0A]">
              <a href="/how-to">How-to</a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-[13px] font-normal text-[#6B6B6B] hover:text-[#0A0A0A]">
              <a href="/style-guide">Design System</a>
            </Button>
            <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
            {history.length > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  downloadSessionMarkdown(history, locale);
                  setSessionExported(true);
                  setTimeout(() => setSessionExported(false), 2500);
                }}
                className={cn(
                  "text-[12px] font-normal",
                  sessionExported ? "text-[#1A9E5A]" : "text-[#6B6B6B] hover:text-[#0A0A0A]"
                )}
                title={locale === "de" ? `${history.length} Analysen als Markdown exportieren` : `Export ${history.length} analyses as Markdown`}
              >
                {sessionExported ? "✓" : "↑"} {locale === "de" ? "Session" : "Session"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={toggleLocale} className="text-[12px] font-semibold text-[#6B6B6B] hover:text-[#0A0A0A]">
              {locale.toUpperCase()}
            </Button>
            {!showFullRadar ? (
              <Button onClick={() => setShowFullRadar(true)} size="sm" className="ml-1 text-[13px] bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]">
                Radar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setShowFullRadar(false)} size="sm" className="ml-1 text-[13px]">
                {locale === "de" ? "Schließen" : "Close"}
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* ── Overlay Panels ──────────────────────────────────────── */}


      {/* ── Full Radar / Graph ───────────────────────────────────── */}
      {showFullRadar && (
        <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <RadarView trends={trends} onTrendClick={setSelectedTrend} locale={locale} />
        </div>
      )}
      {showGraph && (
        <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <CausalGraphView trends={trends} onTrendClick={setSelectedTrend} locale={locale} highlightTrendId={selectedTrend?.id} />
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>

        {/* Welcome — only on first visit */}
        {isFirstVisit && !showFullRadar && (
          <div style={{ padding: "48px 24px 32px", maxWidth: 960, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#E4FF97", color: "#0A0A0A",
                borderRadius: 9999, padding: "4px 12px",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                border: "1px solid rgba(0,0,0,0.08)",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0A0A0A", flexShrink: 0 }} />
                {locale === "de" ? "Strategische Intelligenz" : "Strategic Intelligence"}
              </span>
              <span style={{ fontSize: 12, color: "#9B9B9B" }}>
                {Object.keys(SOURCE_REGISTRY).length} {locale === "de" ? "Quellen" : "sources"} · {connectors.length} Connectors · {trends.length} Trends
              </span>
            </div>
            <h1 style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1,
              color: "#0A0A0A", margin: "0 0 10px",
            }}>
              {locale === "de" ? (
                <>Welche strategische Frage<br /><em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>beschäftigt dich gerade?</em></>
              ) : (
                <>What strategic question<br /><em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>are you working on?</em></>
              )}
            </h1>
            <p style={{ fontSize: 14, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
              {locale === "de"
                ? "Stelle eine Frage — das SIS analysiert Trends, Quellen und Zusammenhänge."
                : "Ask a question — SIS analyzes trends, sources, and causal relationships."}
            </p>
          </div>
        )}

        {/* Search input */}
        <div style={{
          maxWidth: 960, margin: "0 auto", width: "100%",
          padding: isFirstVisit && !showFullRadar ? "24px 24px 0" : "20px 24px 0",
        }}>
          <div className="search-bar">
            <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={locale === "de" ? "Frage stellen oder Stichwort eingeben…" : "Ask a question or drop a keyword…"}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: "var(--color-text-primary)" }}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <Button onClick={() => handleSubmit()} size="sm"
                className="text-[13px] px-5 bg-[#0A0A0A] text-white hover:bg-[#2A2A2A] font-semibold">
                {locale === "de" ? "Analysieren" : "Analyze"} →
              </Button>
            )}
          </div>

          {/* Quick suggestions — only on first visit */}
          {isFirstVisit && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => handleSubmit(s)}
                  style={{ fontSize: 13, padding: "5px 12px", borderRadius: 9999, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-brand)"; (e.currentTarget as HTMLElement).style.background = "var(--color-brand-light)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px", maxWidth: 960, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map((entry, i) => (
            <BriefingResult
              key={`${entry.query}-${i}`}
              entry={entry}
              locale={locale}
              trendCount={trends.length}
              onTrendClick={setSelectedTrend}
              activeProjectId={activeProjectId}
              onFollowUp={(q) => { setQuery(q); handleSubmit(q); }}
            />
          ))}
        </div>
      </div>

      {/* Intelligence Feed */}
      <IntelligenceFeed trends={trends} locale={locale} onTrendClick={setSelectedTrend} />

      {/* Trend Detail Panel */}
      {selectedTrend && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)", zIndex: 30 }} onClick={() => setSelectedTrend(null)} />
          <TrendDetailPanel trend={selectedTrend} onClose={() => setSelectedTrend(null)} />
        </>
      )}
    </div>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────
function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-heading)", margin: 0 }}>{title}</h2>
      <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-[#9B9B9B] hover:text-[#0A0A0A]">✕</Button>
    </div>
  );
}
