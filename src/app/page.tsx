"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { queryIntelligenceAsync } from "@/lib/intelligence-engine";
import { classifyTrends } from "@/lib/classify";
import { useLocale } from "@/lib/locale-context";
import TrendDetailPanel from "@/components/radar/TrendDetailPanel";
import { parseContextFromText, applyContextProfile, PRESET_PROFILES, ContextProfile } from "@/lib/context-profiles";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { connectors } from "@/connectors";
import { BriefingResult, HistoryEntry } from "@/components/briefing/BriefingResult";
import { GrainCard } from "@/components/grain/GrainCard";
import { GrainBadge } from "@/components/grain/GrainBadge";
import {
  saveHistoryToStorage,
  loadHistoryFromStorage,
  clearHistoryStorage,
  downloadSessionMarkdown,
} from "@/lib/briefing-export";
// Demo briefings moved to /beispiele page

// Lazy load heavy components only when needed
import dynamic from "next/dynamic";
const RadarView = dynamic(() => import("@/components/radar/RadarView"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#999" }}>Radar laden…</div> });
const CausalGraphView = dynamic(() => import("@/components/radar/CausalGraphView"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#999" }}>Kausalnetz laden…</div> });
const FeedTeaser = dynamic(() => import("@/components/radar/FeedTeaser"), { ssr: false });
// Canvas is embedded via iframe to avoid Next.js PageProps conflicts
function CanvasEmbed() {
  return <iframe src="/canvas" style={{ width: "100%", height: "100%", border: "none" }} />;
}

type ProjectView = "standard" | "canvas" | "board";

export default function Home() {
  const { locale, toggleLocale } = useLocale();
  const [baseTrends, setBaseTrends] = useState<TrendDot[]>(megaTrends);
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
      .catch(() => { /* keep megaTrends as fallback */ });
  }, []);

  const [projectView, setProjectView] = useState<ProjectView>("standard");
  const [query, setQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);
  const [sessionExported, setSessionExported] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const stored = (() => { try { return localStorage.getItem("sis-theme"); } catch { return null; } })();
    if (stored === "dark") { setDarkMode(true); document.documentElement.classList.add("volt-dark"); }
  }, []);
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) { document.documentElement.classList.add("volt-dark"); localStorage.setItem("sis-theme", "dark"); }
    else { document.documentElement.classList.remove("volt-dark"); localStorage.setItem("sis-theme", "light"); }
  };
  const [frameworkModal, setFrameworkModal] = useState<{ icon: string; label: string; desc: string; templateId: string } | null>(null);
  const [frameworkTopic, setFrameworkTopic] = useState("");
  const [frameworkLoading, setFrameworkLoading] = useState(false);
  const frameworkTopicRef = useRef<HTMLInputElement>(null);
  // demoTab removed — demos moved to /beispiele

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
  const measureRef = useRef<HTMLSpanElement>(null);
  const [cursorLeft, setCursorLeft] = useState(0);

  // Measure text width to position block cursor
  useEffect(() => {
    if (measureRef.current) {
      measureRef.current.textContent = query || "";
      setCursorLeft(measureRef.current.offsetWidth);
    }
  }, [query]);

  // Focus input on load
  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Sync analysis results to Canvas DB ─────────────────────────────────
  // Creates a QueryNode + DerivedNodes and saves them to the active canvas
  // project so Canvas/Board views show the same data as Standard view.
  const syncToCanvasDb = useCallback(async (query: string, briefing: any, entryId: string) => {
    try {
      const now = Date.now();
      const uid = () => Math.random().toString(36).slice(2, 10);
      const QX = 80, DX = 580;

      // Create QueryNode
      const qId = `sync-${entryId}`;
      const qNode = {
        id: qId, nodeType: "query", x: QX, y: 80,
        query, locale: "de", status: "done",
        synthesis: briefing.synthesis ?? "",
        result: briefing, collapsed: false, createdAt: now,
      };

      // Create DerivedNodes (simplified version of computeDerivedNodes)
      const derived: any[] = [];
      const conns: any[] = [];
      let yOff = 80;

      // Insights
      (briefing.keyInsights ?? []).slice(0, 3).forEach((ins: string) => {
        const id = uid();
        derived.push({ id, nodeType: "insight", x: DX, y: yOff, parentId: qId, content: ins, queryText: ins, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        yOff += 180;
      });

      // Scenarios
      (briefing.scenarios ?? []).slice(0, 4).forEach((s: any) => {
        const id = uid();
        derived.push({ id, nodeType: "scenario", x: DX + 320, y: derived.length * 200 + 80, parentId: qId, content: s.description, label: s.name, colorKey: s.type ?? "baseline", probability: s.probability, keyDrivers: s.keyDrivers, queryText: s.name, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
      });

      // Decision
      if (briefing.decisionFramework) {
        const id = uid();
        derived.push({ id, nodeType: "decision", x: DX, y: yOff, parentId: qId, content: briefing.decisionFramework, queryText: "Entscheidungsrahmen", createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        yOff += 180;
      }

      // Follow-ups
      (briefing.followUpQuestions ?? []).slice(0, 3).forEach((fq: string) => {
        const id = uid();
        derived.push({ id, nodeType: "followup", x: DX, y: yOff, parentId: qId, content: fq, queryText: fq, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        yOff += 140;
      });

      const allNodes = [qNode, ...derived];

      // Get or create a canvas project
      let projectId = (() => { try { return localStorage.getItem("sis-active-canvas"); } catch { return null; } })();

      if (!projectId) {
        // Create new canvas project
        const res = await fetch("/api/v1/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Aktuelle Session" }),
        });
        if (!res.ok) return;
        const json = await res.json();
        projectId = json.canvas?.id;
        if (!projectId) return;
        try { localStorage.setItem("sis-active-canvas", projectId); } catch {}
      }

      // Load existing canvas state, append new nodes
      const existingRes = await fetch(`/api/v1/canvas/${projectId}`);
      let existingNodes: any[] = [];
      let existingConns: any[] = [];
      if (existingRes.ok) {
        const json = await existingRes.json();
        if (json.canvas?.canvas_state) {
          const state = JSON.parse(json.canvas.canvas_state);
          existingNodes = state.nodes ?? [];
          existingConns = state.conns ?? [];
          // Offset new nodes below existing ones
          const maxY = existingNodes.reduce((max: number, n: any) => Math.max(max, n.y ?? 0), 0);
          const yShift = maxY + 500;
          qNode.y += yShift;
          derived.forEach((d: any) => { d.y += yShift; });
        }
      }

      // Merge and save
      const mergedState = {
        nodes: [...existingNodes, ...allNodes],
        conns: [...existingConns, ...conns],
        pan: { x: 0, y: 0 },
        zoom: 0.7,
        v: 2,
      };

      await fetch(`/api/v1/canvas/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: mergedState }),
      });
    } catch (e) {
      console.error("[syncToCanvasDb]", e);
    }
  }, []);

  const handleSubmit = useCallback((overrideQuery?: string, prevCtx?: { query: string; synthesis: string }) => {
    const q = (overrideQuery ?? query).trim();
    if (!q || isAnalyzing) return;

    // ── Special commands ──
    if (q === "/radar" || q === "/r") { window.location.href = "/wissen"; return; }
    if (q === "/graph" || q === "/g") { window.location.href = "/wissen"; return; }
    if (q === "/close" || q === "/c") { setShowFullRadar(false); setShowGraph(false); setQuery(""); return; }

    // ── Query Shortcuts (Bloomberg Learning 1) ──
    if (q.startsWith("TREND:") || q.startsWith("trend:")) {
      const trendName = q.slice(6).trim();
      window.location.href = `/wissen?q=${encodeURIComponent(trendName)}`;
      return;
    }
    if (q.startsWith("SIGNAL:") || q.startsWith("signal:")) {
      const filter = q.slice(7).trim();
      window.location.href = `/wissen?signal=${encodeURIComponent(filter)}`;
      return;
    }
    if (q.startsWith("SCENARIO:") || q.startsWith("scenario:")) {
      const topic = q.slice(9).trim();
      window.location.href = `/szenarien?q=${encodeURIComponent(topic)}`;
      return;
    }

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

    if (q === "/clear") {
      setHistory([]); clearHistoryStorage(); setQuery("");
      const cid = (() => { try { return localStorage.getItem("sis-active-canvas"); } catch { return null; } })();
      if (cid) fetch(`/api/v1/canvas/${cid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canvasState: JSON.stringify({ nodes: [], conns: [], pan: { x: 0, y: 0 }, zoom: 1, v: 2 }) }) }).catch(() => {});
      return;
    }

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
    setIsAnalyzing(true);
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
      parentQuery: prevCtx?.query, // link to parent if this is a follow-up
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

    queryIntelligenceAsync(q, trends, locale, ctxProfile, onSynthesisChunk, prevCtx)
      .then((llmBriefing) => {
        if (llmBriefing && llmBriefing.synthesis && llmBriefing.synthesis.length > 20) {
          // ✅ LLM succeeded — full structured briefing
          setHistory((prev) => prev.map((e) =>
            e.id === entryId
              ? { ...e, isLoading: false, error: undefined, briefing: llmBriefing, showRadar: llmBriefing.matchedTrends.length > 2 }
              : e
          ));

          // ── Sync to Canvas DB so Canvas/Board views show the same data ──
          syncToCanvasDb(q, llmBriefing, entryId);
          setIsAnalyzing(false);
        } else {
          setIsAnalyzing(false);
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
        setIsAnalyzing(false);
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
  }, [query, trends, locale, toggleLocale, contextProfile, isAnalyzing, syncToCanvasDb]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  };

  const suggestions = locale === "de"
    ? ["AI Regulierung", "Klimawandel", "Taiwan", "Cybersecurity", "Zukunft der Arbeit", "Geopolitik"]
    : ["AI regulation", "climate change", "Taiwan", "cybersecurity", "future of work", "geopolitics"];

  const isFirstVisit = history.length === 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--volt-surface-raised, var(--color-surface))",
        borderBottom: "1px solid var(--volt-border, var(--color-border))",
        backdropFilter: "blur(12px) saturate(160%)",
        WebkitBackdropFilter: "blur(12px) saturate(160%)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/volt-signet.svg" alt="SIS" style={{ width: 28, height: 18 }} />
            <span className="sis-title-long" style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-heading)" }}>Strategic Intelligence System</span>
            {contextProfile && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: "var(--radius-full)", background: "var(--pastel-orchid)", color: "var(--pastel-orchid-text)", border: "1px solid var(--pastel-orchid-border)" }}>
                {contextProfile.role} · {contextProfile.industry}
              </span>
            )}
          </div>

          {/* Hamburger — Mobile only */}
          <button className="sis-nav-mobile" onClick={() => setMobileMenuOpen(v => !v)}
            style={{ display: "none", alignItems: "center", justifyContent: "center", marginLeft: "auto",
              width: 36, height: 36, border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)", background: "transparent",
              cursor: "pointer", fontSize: 20, color: "var(--color-text-primary)", flexShrink: 0 }}
          >{mobileMenuOpen ? "✕" : "≡"}</button>

          {/* View Toggle — hidden on first visit (no content to view yet) */}
          {!isFirstVisit && (<>
          <div className="sis-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--color-surface-2, #f5f5f5)", borderRadius: "var(--radius-md)", padding: 2 }}>
            {([
              { key: "standard" as ProjectView, icon: "●", label: "Standard" },
              { key: "canvas" as ProjectView, icon: "⊞", label: "Canvas" },
              { key: "board" as ProjectView, icon: "☰", label: "Board" },
            ]).map(v => {
              const active = projectView === v.key;
              return (
                <button key={v.key} onClick={() => setProjectView(v.key)}
                  style={{
                    fontSize: 12, fontWeight: active ? 600 : 400, padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: active ? "var(--color-surface)" : "transparent",
                    color: active ? "var(--color-text-heading)" : "var(--color-text-muted)",
                    cursor: "pointer", transition: "all 0.12s",
                    border: active ? "1px solid var(--volt-border-strong, #D0D0D0)" : "1px solid transparent",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                ><span style={{ fontSize: 10 }}>{v.icon}</span> {v.label}</button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
          </>)}

          {/* Nav — Desktop only */}
          <nav className="sis-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[
              { href: "/verstehen", label: locale === "de" ? "Verstehen" : "Understand" },
              { href: "/arbeiten", label: locale === "de" ? "Arbeiten" : "Work" },
            ].map(({ href, label }) => (
              <a key={href} href={href}
                style={{ fontSize: 13, fontWeight: 400, color: "var(--color-text-subtle)", textDecoration: "none", padding: "4px 10px", borderRadius: "var(--radius-md)", transition: "all 0.15s", whiteSpace: "nowrap" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-surface-2)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-subtle)"; el.style.background = "transparent"; }}
              >{label}</a>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
            {history.length > 0 && (
              <>
                <button
                  onClick={() => { downloadSessionMarkdown(history, locale); setSessionExported(true); setTimeout(() => setSessionExported(false), 2500); }}
                  title={locale === "de" ? `${history.length} Analysen als Markdown exportieren` : `Export ${history.length} analyses as Markdown`}
                  style={{ fontSize: 12, fontWeight: 400, color: sessionExported ? "var(--signal-positive)" : "var(--color-text-subtle)", background: "transparent", border: "none", padding: "4px 10px", borderRadius: "var(--radius-md)", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!sessionExported) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-surface-2)"; } }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = sessionExported ? "var(--signal-positive)" : "var(--color-text-subtle)"; el.style.background = "transparent"; }}
                >
                  {sessionExported ? "✓" : "↑"} {locale === "de" ? "Session" : "Session"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(locale === "de" ? "Gesamte Session löschen? Alle Analysen gehen verloren." : "Clear entire session? All analyses will be lost.")) {
                      setHistory([]);
                      clearHistoryStorage();
                      // Also clear canvas DB so Canvas/Board views are empty too
                      const canvasId = (() => { try { return localStorage.getItem("sis-active-canvas"); } catch { return null; } })();
                      if (canvasId) {
                        fetch(`/api/v1/canvas/${canvasId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ canvasState: JSON.stringify({ nodes: [], conns: [], pan: { x: 0, y: 0 }, zoom: 1, v: 2 }) }),
                        }).catch(() => {});
                      }
                    }
                  }}
                  title={locale === "de" ? "Session löschen und neu starten" : "Clear session and start fresh"}
                  style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-subtle)", background: "transparent", border: "none", padding: "4px 10px", borderRadius: "var(--radius-md)", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--signal-negative)"; el.style.background = "#FEF2F2"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-subtle)"; el.style.background = "transparent"; }}
                >✕ {locale === "de" ? "Löschen" : "Clear"}</button>
              </>
            )}
            <button onClick={toggleDark}
              title={darkMode ? "Light Mode" : "Dark Mode"}
              style={{ fontSize: 14, padding: "2px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.15s", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
            >{darkMode ? "☀" : "☾"}</button>
            <button onClick={toggleLocale}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-subtle)", background: "transparent", border: "none", padding: "4px 10px", borderRadius: "var(--radius-md)", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-surface-2)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-subtle)"; el.style.background = "transparent"; }}
            >{locale.toUpperCase()}</button>
            {/* Radar button removed — Radar is now in /wissen */}
          </nav>
        </div>
      </header>

      {/* ── Mobile Nav Overlay ──────────────────────────────────── */}
      {mobileMenuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 30 }}>
          <div onClick={() => setMobileMenuOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
          <div style={{
            position: "absolute", top: 52, left: 0, right: 0,
            background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)", padding: "8px 0",
          }}>
            {/* View toggles — hidden on first visit */}
            {!isFirstVisit && (<>
            {(["standard", "canvas", "board"] as ProjectView[]).map(v => {
              const icons: Record<ProjectView, string> = { standard: "●", canvas: "⊞", board: "☰" };
              return (
                <button key={v} onClick={() => { setProjectView(v); setMobileMenuOpen(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", fontSize: 15, fontWeight: projectView === v ? 700 : 500, color: projectView === v ? "var(--color-text-heading)" : "var(--color-text-primary)", background: projectView === v ? "var(--color-surface-2)" : "transparent", border: "none", padding: "11px 24px", cursor: "pointer" }}
                >{icons[v]} {v.charAt(0).toUpperCase() + v.slice(1)}</button>
              );
            })}
            <div style={{ borderTop: "1px solid var(--color-border)", margin: "6px 0" }} />
            </>)}
            {[
              { href: "/verstehen", label: locale === "de" ? "Verstehen" : "Understand" },
              { href: "/arbeiten", label: locale === "de" ? "Arbeiten" : "Work" },
            ].map(({ href, label }) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", textDecoration: "none", padding: "11px 24px" }}
              >{label} ↗</a>
            ))}
            <div style={{ borderTop: "1px solid var(--color-border)", margin: "6px 0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
              <button onClick={() => { toggleLocale(); setMobileMenuOpen(false); }}
                style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--radius-full)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
              >{locale === "de" ? "EN" : "DE"}</button>
              <button onClick={() => { setShowFullRadar(v => !v); setMobileMenuOpen(false); }}
                style={{ fontSize: 13, fontWeight: 600, padding: "5px 14px", borderRadius: "var(--radius-md)", background: "var(--color-text-primary)", color: "white", border: "none", cursor: "pointer" }}
              >Radar</button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Canvas / Board View ──────────────────────────────────── */}
      {projectView !== "standard" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
          <iframe
            key={`canvas-${projectView}`}
            src={`/canvas?embedded=1&view=${projectView}`}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      )}

      {/* ── Standard (Briefing) View ─────────────────────────────── */}
      {projectView === "standard" && (<>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>

        {/* Hero + Search */}
        <div style={{
          maxWidth: 700, margin: "0 auto", width: "100%",
          padding: isFirstVisit && !showFullRadar ? "80px 24px 0" : "20px 24px 0",
          position: "relative",
        }}>
          {/* Subtle lime radial gradient orb behind search area */}
          {isFirstVisit && !showFullRadar && (
            <div style={{
              position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
              width: 600, height: 400,
              background: "radial-gradient(ellipse at center, rgba(228,255,151,0.08) 0%, transparent 70%)",
              pointerEvents: "none", zIndex: 0,
            }} />
          )}
          {/* Headline — only on first visit */}
          {isFirstVisit && !showFullRadar && (
            <div style={{ textAlign: "center", marginBottom: 32, position: "relative", zIndex: 1 }}>
              <h1 style={{
                fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2,
                color: "var(--volt-text, #0A0A0A)", margin: "0 0 8px",
              }}>
                {locale === "de"
                  ? "Welche strategische Frage beschäftigt dich?"
                  : "What strategic question are you working on?"}
              </h1>
              <p style={{
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const,
                color: "var(--volt-text-faint, #AAA)", margin: 0,
              }}>
                50 {locale === "de" ? "Quellen" : "Sources"} · 39 Trends · STEEP+V · EU-Fokus
              </p>
            </div>
          )}
          <div
            style={{
              display: "flex", alignItems: "center",
              padding: "0 22px",
              height: 56,
              borderRadius: "var(--volt-radius-lg, 14px)",
              border: inputFocused ? "1.5px solid var(--volt-text, #0A0A0A)" : "1.5px solid var(--volt-border, #E8E8E8)",
              transition: "border-color 150ms ease",
              background: "var(--volt-surface-raised, #fff)",
              /* no shadow — Volt depth via border */
              position: "relative",
            }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Hidden span to measure text width */}
            <span ref={measureRef} style={{
              position: "absolute", visibility: "hidden", whiteSpace: "pre",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 15,
            }} />
            {/* Blinking block cursor — follows text, shown on focus or when typing */}
            {(query || inputFocused) && (
              <span className="sis-blink-cursor" style={{
                position: "absolute",
                left: 22 + cursorLeft,
                top: "50%", transform: "translateY(-50%)",
                width: 10, height: 20,
                background: "var(--volt-text, #0A0A0A)",
              }} />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={inputFocused ? "" : (locale === "de" ? "Frage stellen oder Stichwort eingeben…" : "Ask a question or drop a keyword…")}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--volt-text, #0A0A0A)", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 15, caretColor: "transparent" }}
              autoComplete="off"
              spellCheck={false}
            />
            {(query || isAnalyzing) && (
              <button onClick={() => handleSubmit()}
                disabled={isAnalyzing}
                className={isAnalyzing ? "" : "sis-shimmer-btn"}
                style={{
                  fontSize: 13, fontWeight: 600, height: 36, padding: "0 18px",
                  borderRadius: "var(--volt-radius-md, 10px)", flexShrink: 0,
                  background: isAnalyzing ? "var(--volt-surface, #F7F7F7)" : "var(--volt-black, #0A0A0A)",
                  color: isAnalyzing ? "var(--volt-text-muted)" : "var(--volt-white, #fff)",
                  border: "none", cursor: isAnalyzing ? "wait" : "pointer",
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                }}
              >
                {isAnalyzing
                  ? (locale === "de" ? "Analysiere…" : "Analyzing…")
                  : (locale === "de" ? "Analysieren →" : "Analyze →")}
              </button>
            )}
          </div>

          {/* Suggestion chips — only on first visit, when not typing */}
          {isFirstVisit && !query && !isAnalyzing && (
            <div style={{
              display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap",
              marginTop: 12, position: "relative", zIndex: 1,
            }}>
              {(locale === "de"
                ? ["KI-Regulierung EU", "Energiewende 2030", "Zukunft der Arbeit", "Cybersecurity Trends", "Supply Chain Risiken"]
                : ["AI Regulation EU", "Energy Transition 2030", "Future of Work", "Cybersecurity Trends", "Supply Chain Risks"]
              ).map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setQuery(suggestion); inputRef.current?.focus(); }}
                  style={{
                    fontFamily: "var(--volt-font-ui)", fontSize: 11, fontWeight: 500,
                    padding: "5px 12px", borderRadius: 20,
                    border: "1px solid var(--volt-border, #E8E8E8)",
                    background: "var(--volt-surface-raised, #fff)",
                    color: "var(--volt-text-muted, #6B6B6B)",
                    cursor: "pointer", transition: "all 150ms ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--volt-text)"; e.currentTarget.style.color = "var(--volt-text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; e.currentTarget.style.color = "var(--volt-text-muted)"; }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Framework Topic Modal */}
          {frameworkModal && (
            <>
              <div
                onClick={() => setFrameworkModal(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(3px)", zIndex: 40 }}
              />
              <div style={{
                position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                zIndex: 41, width: "100%", maxWidth: 480,
                background: "var(--volt-surface-raised, #fff)", borderRadius: 16,
                border: "1px solid #E8E8E8",
                padding: "28px 32px",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "#F7F7F7", border: "1px solid #E8E8E8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frameworkModal.icon} alt="" style={{ width: 22, height: 22, opacity: 0.7 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-heading)" }}>
                      {frameworkModal.label}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                      {frameworkModal.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => setFrameworkModal(null)}
                    style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: "var(--color-text-muted)", cursor: "pointer", padding: 4 }}
                  >✕</button>
                </div>

                {/* Topic Input */}
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 6 }}>
                  {locale === "de" ? "Welches Thema möchtest du analysieren?" : "What topic do you want to analyze?"}
                </label>
                <input
                  ref={frameworkTopicRef}
                  type="text"
                  value={frameworkTopic}
                  onChange={(e) => setFrameworkTopic(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && frameworkTopic.trim()) {
                      e.preventDefault();
                      // Same logic as before, but from state
                      try {
                        const { TEMPLATES } = await import("@/lib/canvas-templates");
                        const tmpl = TEMPLATES.find(x => x.id === frameworkModal.templateId);
                        if (!tmpl) return;
                        const result = tmpl.build(frameworkTopic.trim());
                        const res = await fetch("/api/v1/canvas", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: `${frameworkModal.label}: ${frameworkTopic.trim()}` }),
                        });
                        if (!res.ok) return;
                        const json = await res.json();
                        const pid = json.canvas?.id;
                        if (!pid) return;
                        await fetch(`/api/v1/canvas/${pid}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ canvasState: { nodes: result.nodes, conns: result.conns, pan: { x: 0, y: 0 }, zoom: 0.7, v: 2 } }),
                        });
                        localStorage.setItem("sis-active-canvas", pid);
                        setFrameworkModal(null);
                        setProjectView("canvas");
                      } catch (err) { console.error(err); }
                    }
                  }}
                  placeholder={locale === "de"
                    ? "z.B. KI-Regulierung in der EU, Energiewende Deutschland, ..."
                    : "e.g. AI regulation in the EU, energy transition, ..."}
                  style={{
                    width: "100%", fontSize: 15, padding: "12px 16px",
                    borderRadius: 10, border: "1px solid var(--color-border)",
                    background: "var(--color-page-bg)", color: "var(--color-text-primary)",
                    outline: "none", transition: "border-color 0.15s",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "var(--color-lime)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--color-border)"}
                />

                {/* Hint */}
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  {locale === "de"
                    ? "Das Framework erstellt eine strukturierte Analyse im Canvas mit geführtem Workflow."
                    : "The framework creates a structured analysis in the Canvas with a guided workflow."}
                </p>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setFrameworkModal(null)}
                    style={{
                      fontSize: 13, fontWeight: 500, padding: "9px 20px", borderRadius: 10,
                      border: "1px solid var(--color-border)", background: "transparent",
                      color: "var(--color-text-secondary)", cursor: "pointer",
                    }}
                  >{locale === "de" ? "Abbrechen" : "Cancel"}</button>
                  <button
                    onClick={async () => {
                      if (!frameworkTopic.trim() || frameworkLoading) return;
                      setFrameworkLoading(true);
                      try {
                        const { TEMPLATES } = await import("@/lib/canvas-templates");
                        const tmpl = TEMPLATES.find(x => x.id === frameworkModal.templateId);
                        if (!tmpl) { setFrameworkLoading(false); return; }
                        const result = tmpl.build(frameworkTopic.trim());
                        const res = await fetch("/api/v1/canvas", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: `${frameworkModal.label}: ${frameworkTopic.trim()}` }),
                        });
                        if (!res.ok) { setFrameworkLoading(false); alert(locale === "de" ? "Projekt konnte nicht erstellt werden." : "Could not create project."); return; }
                        const json = await res.json();
                        const pid = json.canvas?.id;
                        if (!pid) { setFrameworkLoading(false); return; }
                        await fetch(`/api/v1/canvas/${pid}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ canvasState: { nodes: result.nodes, conns: result.conns, pan: { x: 0, y: 0 }, zoom: 0.7, v: 2 } }),
                        });
                        localStorage.setItem("sis-active-canvas", pid);
                        setFrameworkLoading(false);
                        setFrameworkModal(null);
                        setProjectView("canvas");
                      } catch (err) {
                        setFrameworkLoading(false);
                        console.error(err);
                        alert(locale === "de" ? "Fehler beim Erstellen der Analyse." : "Error creating analysis.");
                      }
                    }}
                    disabled={!frameworkTopic.trim() || frameworkLoading}
                    style={{
                      fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 10,
                      border: "none",
                      background: frameworkLoading ? "var(--color-text-muted)" : frameworkTopic.trim() ? "var(--color-text-heading)" : "var(--color-border)",
                      color: frameworkLoading || frameworkTopic.trim() ? "white" : "var(--color-text-muted)",
                      cursor: frameworkLoading ? "wait" : frameworkTopic.trim() ? "pointer" : "not-allowed",
                      transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {frameworkLoading
                      ? (locale === "de" ? "Erstelle…" : "Creating…")
                      : (locale === "de" ? "Analyse starten →" : "Start Analysis →")}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Framework grid — own wider container, outside 640px constraint */}
        {isFirstVisit && !showFullRadar && (
          <div style={{ maxWidth: 700, margin: "0 auto", width: "100%", padding: "32px 24px 0" }}>
            <div style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: "var(--volt-text-faint, #BBB)",
              marginBottom: 12, textAlign: "center",
            }}>
              {locale === "de" ? "Oder starte mit einem Framework" : "Or start with a framework"}
            </div>
            <div className="sis-framework-grid">
              {([
                { icon: "/icons/methoden/marktanalyse/marktanalyse-layout-grid.svg", type: locale === "de" ? "Analyse" : "Analysis", label: locale === "de" ? "Marktanalyse" : "Market Analysis", desc: locale === "de" ? "Marktposition · Wettbewerbsdynamik" : "Market position · Competitive dynamics", templateId: "market-analysis", p: { card: "#EEF5FF", icon: "#D4E8FF", border: "#C0D8F4", type: "#1A4A8A" } },
                { icon: "/icons/methoden/war-gaming/war-gaming-swords.svg", type: locale === "de" ? "Strategie" : "Strategy", label: "War-Gaming", desc: locale === "de" ? "Gegnermodelle · Strategische Reaktion" : "Opponent models · Strategic response", templateId: "war-gaming", p: { card: "#FFF0F4", icon: "#FFD6E0", border: "#F4B8C8", type: "#A0244A" } },
                { icon: "/icons/methoden/pre-mortem/pre-mortem-triangle-alert.svg", type: locale === "de" ? "Früherkennung" : "Prevention", label: "Pre-Mortem", desc: locale === "de" ? "Risiken · Proaktive Risikoanalyse" : "Risks · Proactive failure analysis", templateId: "pre-mortem", p: { card: "#FFF8F0", icon: "#FFECD2", border: "#F0D4A8", type: "#955A20" } },
                { icon: "/icons/methoden/post-mortem/post-mortem-search.svg", type: locale === "de" ? "Retrospektive" : "Retrospective", label: "Post-Mortem", desc: locale === "de" ? "Ursachen · Systematische Lernschleifen" : "Root causes · Systematic learning", templateId: "post-mortem", p: { card: "#EEFAF4", icon: "#C3F4D3", border: "#90DCA8", type: "#0F6038" } },
                { icon: "/icons/methoden/trend-deep-dive/trend-deep-dive-microscope.svg", type: locale === "de" ? "Intelligence" : "Intelligence", label: "Trend Deep-Dive", desc: locale === "de" ? "Treiber · Systemische Trendanalyse" : "Drivers · Systemic trend analysis", templateId: "trend-deep-dive", p: { card: "#FBF0FF", icon: "#F0D4FF", border: "#D8A8F0", type: "#7C1A9E" } },
                { icon: "/icons/methoden/stakeholder/stakeholder-users-round.svg", type: locale === "de" ? "Mapping" : "Mapping", label: "Stakeholder", desc: locale === "de" ? "Akteure · Koalitionen · Dynamiken" : "Actors · Coalitions · Power dynamics", templateId: "stakeholder-mapping", p: { card: "#FFFDE8", icon: "#FFF5BA", border: "#E8D870", type: "#7A5C00" } },
              ] as { icon: string; type: string; label: string; desc: string; templateId: string; p: { card: string; icon: string; border: string; type: string } }[]).map(t => (
                <GrainCard
                  key={t.templateId}
                  variant="elevated"
                  withGrain
                  role="button"
                  tabIndex={0}
                  onClick={() => { setFrameworkModal(t); setFrameworkTopic(""); setTimeout(() => frameworkTopicRef.current?.focus(), 100); }}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { setFrameworkModal(t); setFrameworkTopic(""); setTimeout(() => frameworkTopicRef.current?.focus(), 100); } }}
                  className="cursor-pointer"
                  style={{ background: t.p.card, borderColor: t.p.border }}
                >
                  <div style={{ padding: "10px 12px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: t.p.icon, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.icon} alt="" style={{ width: 16, height: 16, opacity: 0.8 }} />
                    </span>
                    <div>
                      <div className="font-display font-bold tracking-tight" style={{ fontSize: 12, color: "var(--volt-text, #0A0A0A)", marginBottom: 2, lineHeight: 1.2 }}>{t.label}</div>
                      <div className="text-muted-foreground" style={{ fontSize: 10, lineHeight: 1.35 }}>{t.desc}</div>
                    </div>
                  </div>
                </GrainCard>
              ))}
            </div>
          </div>
        )}

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
              onFollowUp={(q) => {
                setQuery(q);
                // Build multi-turn context: collect this entry + its parent (if follow-up chain)
                const ctxMessages: { query: string; synthesis: string }[] = [];
                // Find parent in history if this is itself a follow-up
                if (entry.parentQuery) {
                  const parent = history.find(h => h.query === entry.parentQuery && h.briefing?.synthesis);
                  if (parent?.briefing?.synthesis) {
                    ctxMessages.push({ query: parent.query, synthesis: parent.briefing.synthesis.slice(0, 2000) });
                  }
                }
                // Add current entry
                if (entry.briefing?.synthesis && entry.briefing.synthesis.length > 50) {
                  ctxMessages.push({ query: entry.query, synthesis: entry.briefing.synthesis.slice(0, 2000) });
                }
                // Pass the most recent as previousContext (API supports single-turn for now)
                const prevCtx = ctxMessages.length > 0 ? ctxMessages[ctxMessages.length - 1] : undefined;
                handleSubmit(q, prevCtx);
              }}
              onOpenInCanvas={() => {
                // Data is already synced to canvas DB — just switch view
                setProjectView("canvas");
              }}
            />
          ))}
        </div>
      </div>

      {/* Intelligence Feed */}
      {/* Feed Teaser — compact highlights, links to /wissen#signale */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
        <FeedTeaser locale={locale} />
      </div>

      </>)}

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

