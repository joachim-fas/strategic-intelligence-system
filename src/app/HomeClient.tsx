"use client";

// TODO: PERF-02 — ~200KB of static data compiled into JS bundle.
// planned-connectors.ts, causal-graph.ts edges, country lists should be JSON files loaded on demand.

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { queryIntelligenceAsync, type PipelineStageEvent } from "@/lib/intelligence-engine";
import { defaultPipelineStages, type PipelineStageMap } from "@/components/briefing/SequentialPipeline";
import { classifyTrends } from "@/lib/classify";
import { useLocale } from "@/lib/locale-context";
import TrendDetailPanel from "@/components/radar/TrendDetailPanel";
import { parseContextFromText, applyContextProfile, PRESET_PROFILES, ContextProfile } from "@/lib/context-profiles";
import { FRAMEWORKS } from "@/lib/canvas-templates";
import { SOURCE_REGISTRY } from "@/lib/trend-sources";
import { connectors } from "@/connectors";
import { BriefingResult, HistoryEntry } from "@/components/briefing/BriefingResult";
import { SessionBar } from "@/components/session/SessionBar";
import { GrainCard } from "@/components/grain/GrainCard";
import { GrainBadge } from "@/components/grain/GrainBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  clearHistoryStorage,
} from "@/lib/briefing-export";
// Demo briefings moved to /beispiele page

// Lazy load heavy components only when needed
import dynamic from "next/dynamic";
const RadarView = dynamic(() => import("@/components/radar/RadarView"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#999" }}>Radar laden…</div> });
const CausalGraphView = dynamic(() => import("@/components/radar/CausalGraphView"), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#999" }}>Kausalnetz laden…</div> });
export default function HomeClient() {
  const { locale, toggleLocale } = useLocale();
  const [baseTrends, setBaseTrends] = useState<TrendDot[]>(megaTrends);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contextProfile, setContextProfile] = useState<ContextProfile | null>(null);
  const trends = contextProfile ? applyContextProfile(baseTrends, contextProfile) : baseTrends;

  // Load trends from DB on mount — fall back to hardcoded data
  useEffect(() => {
    fetchWithTimeout("/api/v1/trends")
      .then((res) => res.json())
      .then((data) => {
        const trends = data.data?.trends ?? data.trends;
        if (trends?.length > 0) {
          setBaseTrends(classifyTrends(trends as TrendDot[]));
        }
      })
      .catch(() => { /* keep megaTrends as fallback */ });
  }, []);

  const [query, setQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Phase 1+2: Active node within the session. Null = latest. Non-null = user has picked a specific node.
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  // Phase 5: Custom session title override (otherwise auto-generated from first query)
  const [customSessionTitle, setCustomSessionTitle] = useState<string | null>(null);
  // Phase 5: Past sessions for the picker dropdown
  const [pastSessions, setPastSessions] = useState<Array<{ id: string; name: string; nodeCount: number; updatedAt?: string }>>([]);
  const activeProjectIdRef = useRef<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);
  // Live stats for the hero mono line — fetched on mount, loading state until ready
  const [liveStats, setLiveStats] = useState<{ sources: number; trends: number; sessions: number } | null>(null);
  useEffect(() => {
    Promise.all([
      fetchWithTimeout("/api/v1/trends").then(r => r.json()).then(d => (d.data?.trends ?? d.trends)?.length ?? 0).catch(() => 0),
      fetchWithTimeout("/api/v1/canvas").then(r => r.json()).then(d => (d.data?.canvases ?? d.canvases ?? []).length).catch(() => 0),
    ]).then(([trendCount, sessionCount]) => {
      setLiveStats({ sources: connectors.length, trends: trendCount, sessions: sessionCount });
    });
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  // FE-09: Dark mode toggle consolidated into AppHeader — removed duplicate
  // state and effect. AppHeader handles sis-theme persistence and class toggling.
  const [frameworkModal, setFrameworkModal] = useState<{ icon: string; label: string; desc: string; templateId: string; p: { card: string; icon: string; border: string; type: string; typeBright: string } } | null>(null);
  const [frameworkTopic, setFrameworkTopic] = useState("");
  const [frameworkLoading, setFrameworkLoading] = useState(false);
  const [frameworkTopicFocused, setFrameworkTopicFocused] = useState(false);
  // Phase 1 guidance: values of optional structured fields per framework.
  // Keys match FrameworkField.key in canvas-templates.ts. Cleared whenever
  // the modal opens for a new framework.
  const [frameworkFieldValues, setFrameworkFieldValues] = useState<Record<string, string>>({});
  // Textarea (multi-line, auto-growing) replaces the legacy single-line
  // input to prevent horizontal text overflow for longer questions.
  const frameworkTopicRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to fit its content on every change.
  useEffect(() => {
    const el = frameworkTopicRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [frameworkTopic, frameworkModal]);

  // Close framework modal on Escape key
  useEffect(() => {
    if (!frameworkModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFrameworkModal(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [frameworkModal]);
  // demoTab removed — demos moved to /beispiele

  // Load past sessions for the picker on mount
  useEffect(() => {
    fetchWithTimeout("/api/v1/canvas")
      .then(r => r.json())
      .then(data => {
        const list = (data?.data?.canvases ?? data?.canvases ?? []) as Array<any>;
        const sessions = list
          .filter((c: any) => (c.queryCount || 0) > 0)
          .slice(0, 8)
          .map((c: any) => ({
            id: c.id,
            name: c.name || "Unbenannt",
            nodeCount: c.queryCount || 0,
            updatedAt: c.updated_at,
          }));
        setPastSessions(sessions);
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    // Re-run from /projects page
    const urlQ = params.get("q");
    if (urlQ) {
      setQuery(decodeURIComponent(urlQ));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
  // project so Canvas/Board/Orbit views show the same data as Standard view.
  //
  // Critical: the `result` field must match the QueryResult shape the canvas
  // consumes — flat `MatchedTrend[]` for `matchedTrends`, separate `matchedEdges`
  // array, and `usedSignals`. Previously we stored the wrapper-shaped briefing
  // directly which left the Orbit Signale/Trends/Kausal columns at 0.
  const syncToCanvasDb = useCallback(async (query: string, briefing: any, entryId: string) => {
    try {
      const now = Date.now();
      const uid = () => Math.random().toString(36).slice(2, 10);
      const QX = 80, DX = 580;

      // ── Build a canvas-compatible QueryResult from the briefing ──────────
      // briefing.matchedTrends is TrendMatch[] (wrapper), but the canvas reads
      // QueryResult.matchedTrends as MatchedTrend[] (flat). Prefer the raw API
      // array when queryIntelligenceAsync passed it through.
      const rawMatchedTrends = Array.isArray(briefing.matchedTrendsRaw) && briefing.matchedTrendsRaw.length > 0
        ? briefing.matchedTrendsRaw
        : (briefing.matchedTrends ?? []).map((m: any) => {
            const t = m?.trend ?? m;
            return {
              id: t?.id, name: t?.name, category: t?.category,
              tags: t?.tags ?? [], relevance: t?.relevance ?? 0,
              confidence: t?.confidence ?? 0, impact: t?.impact ?? 0,
              velocity: t?.velocity ?? "stable", ring: t?.ring ?? "",
              signalCount: t?.signalCount ?? 0,
            };
          }).filter((t: any) => !!t.id);

      const matchedEdges = Array.isArray(briefing.matchedEdges) ? briefing.matchedEdges : [];

      const canvasResult = {
        synthesis: briefing.synthesis,
        reasoningChains: briefing.reasoningChains,
        matchedTrendIds: rawMatchedTrends.map((t: any) => t.id),
        keyInsights: briefing.keyInsights,
        scenarios: briefing.scenarios,
        decisionFramework: briefing.decisionFramework,
        references: briefing.references,
        followUpQuestions: briefing.followUpQuestions,
        confidence: briefing.confidence,
        interpretation: briefing.interpretation,
        newsContext: briefing.newsContext,
        regulatoryContext: briefing.regulatoryContext,
        causalAnalysis: briefing.causalChain,
        usedSignals: briefing.usedSignals,
        matchedTrends: rawMatchedTrends,
        matchedEdges,
      };

      // Create QueryNode
      const qId = `sync-${entryId}`;
      const qNode = {
        id: qId, nodeType: "query", x: QX, y: 80,
        query, locale: "de", status: "done",
        synthesis: briefing.synthesis ?? "",
        result: canvasResult, collapsed: false, createdAt: now,
      };

      // Create DerivedNodes (layout mirrors canvas computeDerivedNodes:
      // Col A = insights + decision + followups, Col B = scenarios,
      // Col C = causalgraph — so Orbit "KAUSAL" column fills when edges exist)
      const derived: any[] = [];
      const conns: any[] = [];
      const colA_X = DX, colB_X = DX + 320, colC_X = DX + 640;
      let colA_Y = 80;

      // Col A: Insights
      (briefing.keyInsights ?? []).slice(0, 3).forEach((ins: string) => {
        const id = uid();
        derived.push({ id, nodeType: "insight", x: colA_X, y: colA_Y, parentId: qId, content: ins, queryText: ins, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        colA_Y += 180;
      });

      // Col B: Scenarios
      let scenarioY = 80;
      (briefing.scenarios ?? []).slice(0, 4).forEach((s: any) => {
        const id = uid();
        derived.push({ id, nodeType: "scenario", x: colB_X, y: scenarioY, parentId: qId, content: s.description, label: s.name, colorKey: s.type ?? "baseline", probability: s.probability, keyDrivers: s.keyDrivers, queryText: s.name, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        scenarioY += 200;
      });

      // Col A (continued): Decision
      if (briefing.decisionFramework) {
        const id = uid();
        derived.push({ id, nodeType: "decision", x: colA_X, y: colA_Y, parentId: qId, content: briefing.decisionFramework, queryText: "Entscheidungsrahmen", createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        colA_Y += 180;
      }

      // Col A (continued): Follow-ups
      (briefing.followUpQuestions ?? []).slice(0, 3).forEach((fq: string) => {
        const id = uid();
        derived.push({ id, nodeType: "followup", x: colA_X, y: colA_Y, parentId: qId, content: fq, queryText: fq, createdAt: now });
        conns.push({ from: qId, to: id, derived: true });
        colA_Y += 140;
      });

      // Col C: Causalgraph — only when we have at least 2 edges between matched trends
      if (matchedEdges.length >= 2) {
        const trendNameMap: Record<string, string> = {};
        rawMatchedTrends.forEach((t: any) => { if (t.id) trendNameMap[t.id] = t.name; });
        const id = uid();
        derived.push({
          id, nodeType: "causalgraph",
          x: colC_X, y: 80, parentId: qId,
          content: "Kausalnetz", label: "KAUSALNETZ",
          queryText: "Vertiefen: Kausalnetz — welche Treiber sind am wirkungsmächtigsten?",
          causalEdges: matchedEdges,
          causalTrendNames: trendNameMap,
          createdAt: now,
        });
        conns.push({ from: qId, to: id, derived: true });
      }

      const allNodes = [qNode, ...derived];

      // Get or create a canvas project
      let projectId = activeProjectIdRef.current;

      if (!projectId) {
        // Create new canvas project
        const res = await fetchWithTimeout("/api/v1/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Aktuelles Projekt" }),
        });
        if (!res.ok) return;
        const json = await res.json();
        projectId = json.canvas?.id;
        if (!projectId) return;
        activeProjectIdRef.current = projectId;
        setActiveProjectId(projectId);
      }

      // Load existing canvas state, append new nodes
      const existingRes = await fetchWithTimeout(`/api/v1/canvas/${projectId}`);
      let existingNodes: any[] = [];
      let existingConns: any[] = [];
      if (existingRes.ok) {
        const json = await existingRes.json();
        if (json.canvas?.canvas_state) {
          const state = JSON.parse(json.canvas.canvas_state);
          existingNodes = state.nodes ?? [];
          existingConns = state.conns ?? [];
          // Offset new nodes below existing ones
          // Find the maximum Y + estimated card height to prevent overlap
          const maxY = existingNodes.reduce((max: number, n: any) => Math.max(max, (n.y ?? 0) + 250), 0);
          const yShift = maxY + 80;
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

      await fetchWithTimeout(`/api/v1/canvas/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: mergedState }),
      });
    } catch (e) {
      console.error("[syncToCanvasDb]", e);
    }
  }, []);

  const handleSubmit = useCallback(async (overrideQuery?: string, prevCtx?: { query: string; synthesis: string }) => {
    const q = (overrideQuery ?? query).trim();
    if (!q || isAnalyzing) return;

    // ── Special commands ──
    if (q === "/radar" || q === "/r") { window.location.href = "/verstehen"; return; }
    if (q === "/graph" || q === "/g") { window.location.href = "/verstehen?tab=netzwerk"; return; }
    if (q === "/close" || q === "/c") { setShowFullRadar(false); setShowGraph(false); setQuery(""); return; }

    // ── Query Shortcuts (Bloomberg Learning 1) ──
    if (q.startsWith("TREND:") || q.startsWith("trend:")) {
      const trendName = q.slice(6).trim();
      window.location.href = `/verstehen?tab=radar&q=${encodeURIComponent(trendName)}`;
      return;
    }
    if (q.startsWith("SIGNAL:") || q.startsWith("signal:")) {
      const filter = q.slice(7).trim();
      window.location.href = `/verstehen?tab=signale&q=${encodeURIComponent(filter)}`;
      return;
    }
    if (q.startsWith("SCENARIO:") || q.startsWith("scenario:") || q.startsWith("SZENARIO:") || q.startsWith("szenario:")) {
      const topic = q.substring(q.indexOf(":") + 1).trim();
      if (topic) {
        try {
          const res = await fetchWithTimeout("/api/v1/canvas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `Szenario: ${topic.substring(0, 50)}` }),
          });
          const json = await res.json();
          const pid = json.canvas?.id;
          if (pid) {
            activeProjectIdRef.current = pid;
            setActiveProjectId(pid);
            window.location.href = `/canvas?project=${pid}`;
            return;
          }
        } catch {}
      }
      window.location.href = "/canvas";
      return;
    }

    if (q === "/live") {
      fetchWithTimeout("/api/v1/pipeline", { method: "POST" });
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
      const cid = activeProjectIdRef.current;
      if (cid) fetchWithTimeout(`/api/v1/canvas/${cid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canvasState: JSON.stringify({ nodes: [], conns: [], pan: { x: 0, y: 0 }, zoom: 1, v: 2 }) }) }).catch(() => {});
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
      pipelineStages: defaultPipelineStages(),
    }, ...prev]);
    // New query always becomes the active node in the session
    setActiveNodeId(entryId);
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

    // Track pipeline stage transitions. Mutate a ref-like local map so each
    // callback flips exactly one stage; React commits the updated copy per call.
    const localStages: PipelineStageMap = defaultPipelineStages();
    const onStage = (ev: PipelineStageEvent) => {
      const prev = localStages[ev.stage];
      localStages[ev.stage] = {
        status: ev.status === "done" ? "done" : "active",
        count: ev.count ?? prev.count,
      };
      // Clone so React sees a new object reference.
      const snapshot: PipelineStageMap = {
        frage: { ...localStages.frage },
        signale: { ...localStages.signale },
        trends: { ...localStages.trends },
        kausal: { ...localStages.kausal },
        erkenntnisse: { ...localStages.erkenntnisse },
        szenarien: { ...localStages.szenarien },
        empfehlungen: { ...localStages.empfehlungen },
      };
      setHistory((prevH) => prevH.map((e) =>
        e.id === entryId ? { ...e, pipelineStages: snapshot } : e
      ));
    };

    queryIntelligenceAsync(q, trends, locale, ctxProfile, onSynthesisChunk, prevCtx, onStage)
      .then((llmBriefing) => {
        if (llmBriefing && llmBriefing.synthesis && llmBriefing.synthesis.length > 20) {
          // ✅ LLM succeeded — full structured briefing
          setHistory((prev) => prev.map((e) =>
            e.id === entryId
              ? { ...e, isLoading: false, error: undefined, briefing: llmBriefing, showRadar: llmBriefing.matchedTrends.length > 2 }
              : e
          ));

          setIsAnalyzing(false);
          // ── Sync to Canvas DB so Canvas/Board views show the same data ──
          // Run AFTER setIsAnalyzing(false) so a canvas sync error doesn't block the UI
          syncToCanvasDb(q, llmBriefing, entryId).catch(() => {});
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <AppHeader />

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

      {/* ── Main (Briefing) View ─────────────────────────────────── */}
      {/* First-visit: vertically center the framework+command-line+projects block
          so it stays in the optical middle regardless of viewport height.
          Session/history state anchors to the top as before. */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: isFirstVisit && !showFullRadar ? "center" : "flex-start",
        paddingTop: 0,
        paddingBottom: isFirstVisit && !showFullRadar ? 60 : 0,
        position: "relative",
      }}>

        {/* Hero + Search — only render the command line here when NOT first visit */}
        <div style={{
          maxWidth: 700, margin: "0 auto", width: "100%",
          padding: isFirstVisit && !showFullRadar ? "0" : "20px 24px 0",
          position: "relative",
        }}>
          {/* Command line for session state (history exists) — stays at top */}
          {(!isFirstVisit || showFullRadar) && (
            <div
              style={{
                display: "flex", alignItems: "center",
                padding: "0 22px",
                height: 56,
                borderRadius: "var(--volt-radius-lg, 14px)",
                border: inputFocused ? "1.5px solid var(--volt-text, #0A0A0A)" : "1.5px solid var(--volt-border, #E8E8E8)",
                transition: "border-color 150ms ease",
                background: "var(--volt-surface-raised, #fff)",
                position: "relative",
              }}
              onClick={() => inputRef.current?.focus()}
            >
              <span ref={measureRef} style={{
                position: "absolute", visibility: "hidden", whiteSpace: "pre",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 15,
              }} />
              {!isAnalyzing && (query || inputFocused) && (
                <span className="sis-blink-cursor" style={{
                  position: "absolute",
                  left: 22 + cursorLeft,
                  top: "50%", transform: "translateY(-50%)",
                  width: 10, height: 20,
                  background: "var(--volt-text, #0A0A0A)",
                  zIndex: 2,
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
                placeholder={inputFocused ? "" : (locale === "de" ? "Projekt vertiefen oder neue Frage stellen…" : "Deepen project or ask a new question…")}
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
                    background: isAnalyzing ? "var(--volt-surface, #F7F7F7)" : "var(--volt-lime, #E4FF97)",
                    color: isAnalyzing ? "var(--volt-text-muted)" : "#0A0A0A",
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
                border: `1px solid ${frameworkModal.p.border}`,
                padding: "28px 32px",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: frameworkModal.p.icon,
                    border: `1px solid ${frameworkModal.p.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Image src={frameworkModal.icon} alt="" width={22} height={22} style={{ opacity: 0.85 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: frameworkModal.p.type }}>
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

                {/* ── Phase 1: Framework-specific question guidance ───────
                     Pulls the guidance object from FRAMEWORKS by templateId
                     and renders a shape explainer + clickable example chips
                     + optional structured field inputs. If no guidance is
                     defined for a framework, the modal falls back to the
                     legacy single-input layout. */}
                {(() => {
                  const fw = FRAMEWORKS.find(f => f.id === frameworkModal.templateId);
                  const guidance = fw?.guidance;
                  if (!guidance) return null;
                  return (
                    <div style={{ marginBottom: 18 }}>
                      {/* Shape explainer — the only guidance now.
                           Examples were removed per user feedback: they led
                           to copy-paste instead of users formulating their
                           own specific question. */}
                      <div style={{
                        padding: "12px 14px",
                        borderRadius: "var(--volt-radius-md, 10px)",
                        background: frameworkModal.p.card,
                        border: `1px solid ${frameworkModal.p.border}`,
                      }}>
                        <div style={{
                          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: frameworkModal.p.type,
                          marginBottom: 6,
                        }}>
                          {locale === "de" ? "So muss deine Frage aussehen" : "How your question should look"}
                        </div>
                        <div style={{
                          fontSize: 12, lineHeight: 1.55,
                          color: "var(--volt-text, #0A0A0A)",
                        }}>
                          {locale === "de" ? guidance.questionShape.de : guidance.questionShape.en}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Question Input — force concrete question formulation.
                     Topic keywords ("KI", "Automotive") are explicitly
                     discouraged by label + placeholder + shape explainer. */}
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 8 }}>
                  {locale === "de" ? "Stelle deine konkrete Frage" : "Ask your concrete question"}
                </label>
                {/* Auto-growing textarea container — vertical stack so long
                     questions wrap and the container grows with the content.
                     Submit button sits at the bottom-right, only shown when
                     the textarea has text. Enter submits, Shift+Enter = new
                     line. */}
                <div
                  style={{
                    display: "flex", flexDirection: "column",
                    padding: "14px 18px",
                    minHeight: 52,
                    borderRadius: "var(--volt-radius-lg, 14px)",
                    border: frameworkTopicFocused ? "1.5px solid var(--volt-text, #0A0A0A)" : "1.5px solid var(--volt-border, #E8E8E8)",
                    transition: "border-color 150ms ease",
                    background: "var(--volt-surface-raised, #fff)",
                    position: "relative",
                  }}
                  onClick={() => frameworkTopicRef.current?.focus()}
                >
                  <textarea
                    ref={frameworkTopicRef}
                    value={frameworkTopic}
                    rows={1}
                    onChange={(e) => {
                      setFrameworkTopic(e.target.value);
                      // Immediate auto-grow on input — effect also fires,
                      // but inline makes the transition feel tighter.
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onKeyDown={async (e) => {
                      // Enter submits, Shift+Enter inserts a newline
                      if (e.key === "Enter" && !e.shiftKey && frameworkTopic.trim() && !frameworkLoading) {
                        e.preventDefault();
                        setFrameworkLoading(true);
                        try {
                          const { TEMPLATES, FRAMEWORKS: FWS } = await import("@/lib/canvas-templates");
                          const tmpl = TEMPLATES.find(x => x.id === frameworkModal.templateId);
                          if (!tmpl) { setFrameworkLoading(false); return; }
                          // Compose a richer topic string with optional field values.
                          // Canvas NAME keeps the framework label prefix + main topic
                          // (so framework-detect by name prefix keeps working).
                          // Canvas QUERIES receive the enriched topic with appended context.
                          const fw = FWS.find(f => f.id === frameworkModal.templateId);
                          const fieldParts: string[] = [];
                          if (fw?.guidance?.fields) {
                            for (const f of fw.guidance.fields) {
                              const v = frameworkFieldValues[f.key]?.trim();
                              if (v) fieldParts.push(`${locale === "de" ? f.labelDe : f.labelEn}: ${v}`);
                            }
                          }
                          const mainTopic = frameworkTopic.trim();
                          const enrichedTopic = fieldParts.length
                            ? `${mainTopic} (${fieldParts.join("; ")})`
                            : mainTopic;
                          const result = tmpl.build(enrichedTopic);
                          const res = await fetchWithTimeout("/api/v1/canvas", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: `${frameworkModal.label}: ${mainTopic}` }),
                          });
                          if (!res.ok) { setFrameworkLoading(false); return; }
                          const json = await res.json();
                          const pid = json.canvas?.id;
                          if (!pid) { setFrameworkLoading(false); return; }
                          await fetchWithTimeout(`/api/v1/canvas/${pid}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ canvasState: { nodes: result.nodes, conns: result.conns, pan: { x: 0, y: 0 }, zoom: 0.7, v: 2 } }),
                          });
                          activeProjectIdRef.current = pid;
                          setActiveProjectId(pid);
                          setFrameworkLoading(false);
                          setFrameworkModal(null);
                          window.location.href = `/canvas?project=${pid}`;
                        } catch (err) {
                          setFrameworkLoading(false);
                          console.error(err);
                        }
                      }
                    }}
                    onFocus={() => setFrameworkTopicFocused(true)}
                    onBlur={() => setFrameworkTopicFocused(false)}
                    placeholder={locale === "de" ? "Formuliere eine vollständige, konkrete Frage…" : "Formulate a complete, concrete question…"}
                    style={{
                      width: "100%",
                      minHeight: 24,
                      resize: "none",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "var(--volt-text, #0A0A0A)",
                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                      fontSize: 15,
                      lineHeight: 1.5,
                      overflow: "hidden",
                      padding: 0,
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* ── Phase 1: Optional structured fields + anti-example + submit ─
                     Group fields under an "Optionaler Kontext" header so users
                     immediately see they're not required. Submit button lives at
                     the absolute bottom of the modal (not inside the textarea)
                     so the flow is: shape → question → context → warning → submit. */}
                {(() => {
                  const fw = FRAMEWORKS.find(f => f.id === frameworkModal.templateId);
                  const guidance = fw?.guidance;
                  return (
                    <>
                      {guidance?.fields && guidance.fields.length > 0 && (
                        <div style={{ marginTop: 22 }}>
                          {/* Group header — signals these are optional refinements */}
                          <div style={{
                            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--volt-text-faint, #999)",
                            marginBottom: 10,
                            display: "flex", alignItems: "center", gap: 8,
                          }}>
                            <span>{locale === "de" ? "Optionaler Kontext" : "Optional context"}</span>
                            <span style={{ flex: 1, height: 1, background: "var(--volt-border, #EEE)" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {guidance.fields.map(field => {
                              // Strip "(optional)" from labels — now redundant because the whole group is labeled Optional
                              const labelRaw = locale === "de" ? field.labelDe : field.labelEn;
                              const label = labelRaw.replace(/\s*\((optional|optional)\)\s*$/i, "");
                              return (
                                <div key={field.key}>
                                  <label style={{
                                    display: "block",
                                    fontSize: 11, fontWeight: 600,
                                    color: "var(--volt-text-muted, #6B6B6B)",
                                    marginBottom: 4,
                                    fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                                  }}>
                                    {label}
                                  </label>
                                  <input
                                    type="text"
                                    value={frameworkFieldValues[field.key] ?? ""}
                                    onChange={(e) => setFrameworkFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); /* prevent accidental submit from a field */ }}
                                    placeholder={locale === "de" ? field.placeholderDe : field.placeholderEn}
                                    style={{
                                      width: "100%",
                                      padding: "8px 12px",
                                      fontSize: 13,
                                      border: "1px solid var(--volt-border, #E8E8E8)",
                                      borderRadius: "var(--volt-radius-sm, 8px)",
                                      background: "var(--volt-surface-raised, #fff)",
                                      color: "var(--volt-text, #0A0A0A)",
                                      outline: "none",
                                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                                      boxSizing: "border-box",
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--volt-text, #0A0A0A)"; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {guidance?.antiExample && (
                        <p style={{
                          fontSize: 11,
                          color: "var(--volt-text-muted, #6B6B6B)",
                          margin: "18px 0 0",
                          lineHeight: 1.5,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                        }}>
                          <span style={{ flexShrink: 0, color: "var(--volt-text-faint, #BBB)" }}>⚠</span>
                          <span>{locale === "de" ? guidance.antiExample.de : guidance.antiExample.en}</span>
                        </p>
                      )}

                      {/* Workflow explanation — always visible so users know what happens next */}
                      <p style={{ fontSize: 11, color: "var(--volt-text-muted, #6B6B6B)", margin: "14px 0 0", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ flexShrink: 0, fontSize: 12, opacity: 0.5 }}>→</span>
                        <span>
                          {locale === "de"
                            ? "Erstellt eine strukturierte Analyse im Canvas: Frage, Insights, Szenarien und Handlungsempfehlung — in einem geführten Workflow."
                            : "Creates a structured analysis in the Canvas: question, insights, scenarios, and recommendations — in a guided workflow."}
                        </span>
                      </p>

                      {/* ── Absolute bottom: Submit button row ──────────
                           Divider + right-aligned Analyse button. Button is
                           disabled until the main question has text — optional
                           context fields don't gate activation. */}
                      <div style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: "1px solid var(--volt-border, #EEE)",
                        display: "flex",
                        justifyContent: "flex-end",
                      }}>
                        <button
                          onClick={async () => {
                            if (!frameworkTopic.trim() || frameworkLoading) return;
                            setFrameworkLoading(true);
                            try {
                              const { TEMPLATES, FRAMEWORKS: FWS } = await import("@/lib/canvas-templates");
                              const tmpl = TEMPLATES.find(x => x.id === frameworkModal.templateId);
                              if (!tmpl) { setFrameworkLoading(false); return; }
                              const fwInner = FWS.find(f => f.id === frameworkModal.templateId);
                              const fieldParts: string[] = [];
                              if (fwInner?.guidance?.fields) {
                                for (const f of fwInner.guidance.fields) {
                                  const v = frameworkFieldValues[f.key]?.trim();
                                  if (v) fieldParts.push(`${locale === "de" ? f.labelDe : f.labelEn}: ${v}`);
                                }
                              }
                              const mainTopic = frameworkTopic.trim();
                              const enrichedTopic = fieldParts.length
                                ? `${mainTopic} (${fieldParts.join("; ")})`
                                : mainTopic;
                              const result = tmpl.build(enrichedTopic);
                              const res = await fetchWithTimeout("/api/v1/canvas", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: `${frameworkModal.label}: ${mainTopic}` }),
                              });
                              if (!res.ok) { setFrameworkLoading(false); alert(locale === "de" ? "Projekt konnte nicht erstellt werden." : "Could not create project."); return; }
                              const json = await res.json();
                              const pid = json.canvas?.id;
                              if (!pid) { setFrameworkLoading(false); return; }
                              await fetchWithTimeout(`/api/v1/canvas/${pid}`, {
                                method: "PATCH", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ canvasState: { nodes: result.nodes, conns: result.conns, pan: { x: 0, y: 0 }, zoom: 0.7, v: 2 } }),
                              });
                              activeProjectIdRef.current = pid;
                              setActiveProjectId(pid);
                              setFrameworkLoading(false);
                              setFrameworkModal(null);
                              window.location.href = `/canvas?project=${pid}`;
                            } catch (err) {
                              setFrameworkLoading(false);
                              console.error(err);
                              alert(locale === "de" ? "Fehler beim Erstellen der Analyse." : "Error creating analysis.");
                            }
                          }}
                          disabled={frameworkLoading || !frameworkTopic.trim()}
                          className={frameworkLoading || !frameworkTopic.trim() ? "" : "sis-shimmer-btn"}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            height: 40,
                            padding: "0 22px",
                            borderRadius: "var(--volt-radius-md, 10px)",
                            background: frameworkLoading
                              ? "var(--volt-surface, #F7F7F7)"
                              : !frameworkTopic.trim()
                                ? "var(--volt-surface, #F0F0F0)"
                                : "var(--volt-lime, #E4FF97)",
                            color: frameworkLoading || !frameworkTopic.trim()
                              ? "var(--volt-text-faint, #BBB)"
                              : "#0A0A0A",
                            border: "none",
                            cursor: frameworkLoading
                              ? "wait"
                              : !frameworkTopic.trim()
                                ? "not-allowed"
                                : "pointer",
                            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                            transition: "background-color 160ms ease, color 160ms ease",
                          }}
                        >
                          {frameworkLoading
                            ? (locale === "de" ? "Projekt wird erstellt…" : "Creating project…")
                            : (locale === "de" ? "Analyse starten →" : "Start analysis →")}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}

        </div>

        {/* Framework grid — empty state primary entry point.
             Outer div holds the viewport-edge padding (24px) so it sits OUTSIDE
             the 700px maxWidth — matching the command line container below so
             the framework buttons and the command line have the same total width. */}
        {isFirstVisit && !showFullRadar && (
          <div style={{ paddingLeft: 24, paddingRight: 24 }}>
            <div style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}>
            <div style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: "var(--volt-text-faint, #BBB)",
              marginBottom: 12, textAlign: "center",
            }}>
              {locale === "de" ? "Starte mit einem Framework" : "Start with a framework"}
            </div>
            <div className="sis-framework-grid">
              {([
                {
                  icon: "/icons/methoden/marktanalyse/marktanalyse-layout-grid.svg",
                  type: locale === "de" ? "Analyse" : "Analysis",
                  label: locale === "de" ? "Marktanalyse" : "Market Analysis",
                  desc: locale === "de" ? "Marktposition · Wettbewerbsdynamik" : "Market position · Competitive dynamics",
                  tip: locale === "de"
                    ? "Systematische SWOT+PESTEL-Analyse zu Marktposition und Wettbewerbsdynamik. Verbindet interne Stärken/Schwächen mit externen Chancen/Risiken."
                    : "Systematic SWOT+PESTEL analysis on market position and competitive dynamics. Connects internal strengths/weaknesses with external opportunities/risks.",
                  flow: locale === "de"
                    ? "Kontext → Intern → Extern → Optionen → Priorisierung"
                    : "Context → Internal → External → Options → Prioritization",
                  templateId: "market-analysis",
                  // `type` is tuned for pastel-card backgrounds; `typeBright` is
                  // the high-contrast variant for the dark tooltip background.
                  p: { card: "#EEF5FF", icon: "#D4E8FF", border: "#C0D8F4", type: "#1A4A8A", typeBright: "#8EC5FF" },
                },
                {
                  icon: "/icons/methoden/war-gaming/war-gaming-swords.svg",
                  type: locale === "de" ? "Strategie" : "Strategy",
                  label: "War-Gaming",
                  desc: locale === "de" ? "Gegnermodelle · Strategische Reaktion" : "Opponent models · Strategic response",
                  tip: locale === "de"
                    ? "Szenario-basierte Strategieplanung (RAND, Shell). Prämisse: Die Zukunft ist nicht vorhersagbar — entwickelt robuste Strategien für mehrere mögliche Zukünfte."
                    : "Scenario-based strategy (RAND, Shell). Premise: the future isn't predictable — build strategies robust across multiple futures.",
                  flow: locale === "de" ? "Driving Forces → 3 Szenarien → Robuste Strategie" : "Driving Forces → 3 Scenarios → Robust Strategy",
                  templateId: "war-gaming",
                  p: { card: "#FFF0F4", icon: "#FFD6E0", border: "#F4B8C8", type: "#A0244A", typeBright: "#FF9AB3" },
                },
                {
                  icon: "/icons/methoden/pre-mortem/pre-mortem-triangle-alert.svg",
                  type: locale === "de" ? "Früherkennung" : "Prevention",
                  label: "Pre-Mortem",
                  desc: locale === "de" ? "Risiken · Proaktive Risikoanalyse" : "Risks · Proactive failure analysis",
                  tip: locale === "de"
                    ? "Prospective Hindsight (Gary Klein, 1989). Teams identifizieren nachweislich 30% mehr Risiken, wenn sie sich das Scheitern als bereits eingetreten vorstellen."
                    : "Prospective hindsight (Gary Klein, 1989). Teams identify ~30% more risks when imagining failure as already occurred.",
                  flow: locale === "de"
                    ? "Scheitern vorstellen → Risiken bewerten → Gegenmaßnahmen"
                    : "Imagine failure → Assess risks → Countermeasures",
                  templateId: "pre-mortem",
                  p: { card: "#FFF8F0", icon: "#FFECD2", border: "#F0D4A8", type: "#955A20", typeBright: "#FFC078" },
                },
                {
                  icon: "/icons/methoden/post-mortem/post-mortem-search.svg",
                  type: locale === "de" ? "Retrospektive" : "Retrospective",
                  label: "Post-Mortem",
                  desc: locale === "de" ? "Ursachen · Systematische Lernschleifen" : "Root causes · Systematic learning",
                  tip: locale === "de"
                    ? "Ursachenanalyse mit 5-Whys (Toyota) und Ishikawa-Diagramm. Trennt strukturelle, konjunkturelle und situative Ursachen statt sie zu verwechseln."
                    : "Root cause analysis with 5-Whys (Toyota) and Ishikawa. Separates structural, cyclical and situational causes rather than conflating them.",
                  flow: locale === "de"
                    ? "Chronologie → 3-Ebenen-Ursachen → Lessons Learned"
                    : "Timeline → 3-layer causes → Lessons learned",
                  templateId: "post-mortem",
                  p: { card: "#EEFAF4", icon: "#C3F4D3", border: "#90DCA8", type: "#0F6038", typeBright: "#6EE0A5" },
                },
                {
                  icon: "/icons/methoden/trend-deep-dive/trend-deep-dive-microscope.svg",
                  type: locale === "de" ? "Intelligence" : "Intelligence",
                  label: "Trend Deep-Dive",
                  desc: locale === "de" ? "Treiber · Systemische Trendanalyse" : "Drivers · Systemic trend analysis",
                  tip: locale === "de"
                    ? "STEEP+V-Framework angewendet auf einen einzelnen Trend. Referenz: EU JRC 14 Megatrends der Europäischen Kommission."
                    : "STEEP+V framework applied to a single trend. Reference: EU JRC 14 Megatrends of the European Commission.",
                  flow: locale === "de"
                    ? "Definition → Evidenz → Treiber → Impact → Handlung"
                    : "Definition → Evidence → Drivers → Impact → Action",
                  templateId: "trend-deep-dive",
                  p: { card: "#FBF0FF", icon: "#F0D4FF", border: "#D8A8F0", type: "#7C1A9E", typeBright: "#DCA0FF" },
                },
                {
                  icon: "/icons/methoden/stakeholder/stakeholder-users-round.svg",
                  type: locale === "de" ? "Mapping" : "Mapping",
                  label: "Stakeholder",
                  desc: locale === "de" ? "Akteure · Koalitionen · Dynamiken" : "Actors · Coalitions · Power dynamics",
                  tip: locale === "de"
                    ? "Mitchell Salience Model (1997): Power × Legitimacy × Urgency, kombiniert mit Interest/Influence-Matrix. Zeigt, wer Entscheidungen wirklich bewegt."
                    : "Mitchell Salience Model (1997): Power × Legitimacy × Urgency, combined with Interest/Influence matrix. Reveals who actually moves decisions.",
                  flow: locale === "de"
                    ? "Identifizieren → Bewerten → Dynamiken → Engagement"
                    : "Identify → Assess → Dynamics → Engagement",
                  templateId: "stakeholder-mapping",
                  p: { card: "#FFFDE8", icon: "#FFF5BA", border: "#E8D870", type: "#7A5C00", typeBright: "#F5DC5C" },
                },
              ] as { icon: string; type: string; label: string; desc: string; tip: string; flow: string; templateId: string; p: { card: string; icon: string; border: string; type: string; typeBright: string } }[]).map(t => (
                <Tooltip
                  key={t.templateId}
                  placement="top"
                  maxWidth={320}
                  content={
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: t.p.typeBright, marginBottom: 4 }}>
                        {t.type} · {t.label}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>{t.tip}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.4, color: "rgba(255,255,255,0.65)", fontFamily: "var(--volt-font-mono, monospace)" }}>
                        {t.flow}
                      </div>
                    </div>
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.label} — ${t.desc}`}
                    onClick={() => { setFrameworkModal(t); setFrameworkTopic(""); setFrameworkFieldValues({}); setTimeout(() => frameworkTopicRef.current?.focus(), 100); }}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { setFrameworkModal(t); setFrameworkTopic(""); setFrameworkFieldValues({}); setTimeout(() => frameworkTopicRef.current?.focus(), 100); } }}
                    className="sis-framework-btn cursor-pointer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      height: 32,
                      padding: "0 14px 0 8px",
                      background: t.p.icon,
                      border: "none",
                      borderRadius: 8, outline: "none",
                      transition: "transform 140ms ease, filter 140ms ease",
                    }}
                  >
                    <span
                      style={{
                        width: 20, height: 20, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Image src={t.icon} alt="" width={16} height={16} style={{ opacity: 0.9 }} />
                    </span>
                    <div className="font-display font-bold tracking-tight" style={{ fontSize: 13, color: "var(--volt-text, #0A0A0A)", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.label}
                    </div>
                  </div>
                </Tooltip>
              ))}
            </div>

            </div>
          </div>
        )}

        {/* Empty-state command line — sits directly below the framework grid.
             The lime gradient glow is rendered separately as a fixed element at the
             very bottom of the viewport, above the ticker. */}
        {isFirstVisit && !showFullRadar && (
          <div style={{
            position: "relative",
            marginTop: 56,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 24,
            paddingRight: 24,
            zIndex: 2,
          }}>
            <div style={{
              maxWidth: 700, margin: "0 auto", width: "100%",
              position: "relative", zIndex: 1,
            }}>
              <div
                style={{
                  display: "flex", alignItems: "center",
                  padding: "0 22px",
                  height: 56,
                  borderRadius: "var(--volt-radius-lg, 14px)",
                  border: inputFocused ? "1.5px solid var(--volt-text, #0A0A0A)" : "1.5px solid var(--volt-border, #E8E8E8)",
                  transition: "border-color 150ms ease, box-shadow 150ms ease",
                  background: "var(--volt-surface-raised, #fff)",
                  boxShadow: inputFocused ? "0 6px 24px rgba(228,255,151,0.35), 0 2px 8px rgba(0,0,0,0.06)" : "0 4px 16px rgba(0,0,0,0.04)",
                  position: "relative",
                }}
                onClick={() => inputRef.current?.focus()}
              >
                <span ref={measureRef} style={{
                  position: "absolute", visibility: "hidden", whiteSpace: "pre",
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 15,
                }} />
                {!isAnalyzing && (query || inputFocused) && (
                  <span className="sis-blink-cursor" style={{
                    position: "absolute",
                    left: 22 + cursorLeft,
                    top: "50%", transform: "translateY(-50%)",
                    width: 10, height: 20,
                    background: "var(--volt-text, #0A0A0A)",
                    zIndex: 2,
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
                  placeholder={inputFocused ? "" : (locale === "de" ? "Oder frage direkt etwas Strategisches…" : "Or ask something strategic directly…")}
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
                      background: isAnalyzing ? "var(--volt-surface, #F7F7F7)" : "var(--volt-lime, #E4FF97)",
                      color: isAnalyzing ? "var(--volt-text-muted)" : "#0A0A0A",
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

              {/* Letzte Projekte — compact list directly below the command line */}
              {pastSessions.length > 0 && (
                <div style={{ marginTop: 72 }}>
                  <div style={{
                    fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const,
                    color: "var(--volt-text-faint, #BBB)",
                    marginBottom: 8, textAlign: "center",
                  }}>
                    {locale === "de" ? "Letzte Projekte" : "Recent Projects"}
                  </div>
                  <ul style={{
                    listStyle: "none", margin: 0, padding: 0,
                    borderTop: "1px solid var(--volt-border, #E8E8E8)",
                  }}>
                    {pastSessions.slice(0, 6).map((s) => (
                      <li key={s.id} style={{ borderBottom: "1px solid var(--volt-border, #E8E8E8)" }}>
                        <a
                          href={`/canvas?project=${s.id}`}
                          onClick={() => { activeProjectIdRef.current = s.id; setActiveProjectId(s.id); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                            padding: "10px 8px",
                            textDecoration: "none",
                            color: "var(--volt-text, #0A0A0A)",
                            transition: "background-color 120ms ease",
                            cursor: "pointer",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--volt-lime, #E4FF97)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <span style={{
                            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                            fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            flex: 1, minWidth: 0,
                          }}>
                            {s.name}
                          </span>
                          <span style={{
                            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                            fontSize: 10, color: "var(--volt-text-faint, #AAA)",
                            letterSpacing: "0.04em",
                            display: "flex", alignItems: "center", gap: 10,
                            flexShrink: 0,
                          }}>
                            <span>{s.nodeCount} Nodes</span>
                            {s.updatedAt && (
                              <span>{new Date(s.updatedAt).toLocaleDateString(locale === "de" ? "de-DE" : "en-US", { month: "short", day: "numeric" })}</span>
                            )}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results — Phase 1+2: Session Bar + Active Node rendering. Only rendered when there is content, so the empty-state gradient command line can claim the full flex space. Bottom padding clears the fixed SignalTicker. */}
        {!isFirstVisit && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 60px", maxWidth: 960, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Session Bar: only when history has 2+ entries. The single-shot experience stays clean. */}
          {history.length >= 2 && (() => {
            // Ensure the active entry is valid; default to latest (index 0, since history is newest-first).
            const resolvedActiveId = activeNodeId && history.find(h => (h.id ?? h.query) === activeNodeId)
              ? activeNodeId
              : (history[0].id ?? history[0].query);
            const autoTitle = history[history.length - 1]?.query ?? "Projekt";
            const sessionTitle = customSessionTitle || autoTitle;
            return (
              <SessionBar
                sessionTitle={sessionTitle}
                nodes={[...history].reverse().map(h => ({
                  id: h.id ?? h.query,
                  query: h.query,
                  isLoading: h.isLoading,
                  hasError: !!h.error,
                }))}
                activeNodeId={resolvedActiveId}
                onNodeClick={(id) => setActiveNodeId(id)}
                onNewSession={() => {
                  if (!window.confirm(locale === "de" ? "Aktuelles Projekt beenden und neues starten?" : "End current project and start new?")) return;
                  clearHistoryStorage();
                  setHistory([]);
                  setActiveNodeId(null);
                  setCustomSessionTitle(null);
                  activeProjectIdRef.current = null;
                  setActiveProjectId(null);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                onOpenCanvas={() => {
                  const pid = activeProjectIdRef.current;
                  window.location.href = pid ? `/canvas?project=${pid}` : "/canvas";
                }}
                onOpenSummary={() => {
                  const pid = activeProjectIdRef.current;
                  if (pid) {
                    window.location.href = `/canvas/${pid}/zusammenfassung`;
                  } else {
                    window.location.href = "/canvas";
                  }
                }}
                onTitleChange={(newTitle) => {
                  setCustomSessionTitle(newTitle);
                  // Also rename the canvas project so it's reflected in the picker and elsewhere
                  const pid = activeProjectIdRef.current;
                  if (pid) {
                    fetchWithTimeout(`/api/v1/canvas/${pid}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newTitle }),
                    }).catch(() => {});
                  }
                }}
                pastSessions={pastSessions}
                onPickSession={(id) => {
                  // Switch to selected canvas project — navigate for direct access
                  activeProjectIdRef.current = id;
                  setActiveProjectId(id);
                  window.location.href = `/canvas?project=${id}`;
                }}
                de={locale === "de"}
              />
            );
          })()}

          {/* Active Briefing: show only the currently-focused entry with crossfade animation */}
          {history.length > 0 && (() => {
            const entries = history;
            const activeEntry = activeNodeId
              ? entries.find(h => (h.id ?? h.query) === activeNodeId) ?? entries[0]
              : entries[0];
            const i = entries.indexOf(activeEntry);
            return (
              <div
                key={`active-${activeEntry.id ?? activeEntry.query}`}
                style={{ animation: "sis-brief-fade 220ms ease-out" }}
              >
                <BriefingResult
                  entry={activeEntry}
                  locale={locale}
                  trendCount={trends.length}
                  onTrendClick={setSelectedTrend}
                  activeProjectId={activeProjectId}
                  onFollowUp={(q) => {
                    setQuery(q);
                    const ctxMessages: { query: string; synthesis: string }[] = [];
                    if (activeEntry.parentQuery) {
                      const parent = history.find(h => h.query === activeEntry.parentQuery && h.briefing?.synthesis);
                      if (parent?.briefing?.synthesis) {
                        ctxMessages.push({ query: parent.query, synthesis: parent.briefing.synthesis.slice(0, 2000) });
                      }
                    }
                    if (activeEntry.briefing?.synthesis && activeEntry.briefing.synthesis.length > 50) {
                      ctxMessages.push({ query: activeEntry.query, synthesis: activeEntry.briefing.synthesis.slice(0, 2000) });
                    }
                    const prevCtx = ctxMessages.length > 0 ? ctxMessages[ctxMessages.length - 1] : undefined;
                    handleSubmit(q, prevCtx);
                  }}
                />
              </div>
            );
          })()}
        </div>
        )}
        <style>{`
          @keyframes sis-brief-fade {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0);   }
          }
        `}</style>
      </div>


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

