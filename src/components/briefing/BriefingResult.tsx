"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useActiveTenantId } from "@/lib/tenant-context";
import { tenantStorage, TENANT_STORAGE_KEYS } from "@/lib/tenant-storage";
import { IntelligenceBriefing } from "@/lib/intelligence-engine";
import { TrendDot } from "@/types";
import { Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { VoltBadge, VoltButton } from "@/components/volt";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReasoningTrace } from "./ReasoningTrace";
import { SequentialPipeline, type PipelineStageMap } from "./SequentialPipeline";
import { SynthesisBlock } from "./SynthesisBlock";
import { InlineProvenance } from "./InlineProvenance";
import { EigenerGedanke } from "./EigenerGedanke";
import { CausalOrbit } from "./CausalOrbit";
import { ScenarioSelector } from "./ScenarioSelector";
import { BriefingExport } from "./BriefingExport";
import {
  VoltInfoBlock,
  VoltSectionLabel,
  VoltMetaRow,
  VoltReferencePill,
  VoltKpiCard,
  VoltSectionCard,
  VoltIconBox,
  VoltInsightChip,
} from "@/components/verstehen/VoltPrimitives";
import {
  Target,
  Zap,
  BookOpen,
  Gauge,
  Network,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  Radio,
  Scale,
  ArrowRight,
  Newspaper,
  Compass,
  FileText as DocIcon,
  MessageSquare,
  LayoutGrid,
  Check as CheckIcon,
  RotateCcw,
  Loader2,
  CornerDownRight,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

const BalancedScorecard = dynamic(() => import("@/components/radar/BalancedScorecard"), { ssr: false });

// ── Shared type for history entries ──────────────────────────────────────────
export interface HistoryEntry {
  id?: string;
  query: string;
  briefing: IntelligenceBriefing;
  timestamp: Date;
  showRadar?: boolean;
  isLoading?: boolean; // explicit flag — never rely on synthesis string comparison
  error?: string;      // set when LLM call failed, shown with retry option
  parentQuery?: string; // if this is a follow-up, the original query text
  pipelineStages?: PipelineStageMap; // live progress of the 7-stage reveal (while loading)
}

// ── BriefingResult ────────────────────────────────────────────────────────────
export function BriefingResult({ entry, locale, trendCount, onTrendClick, activeProjectId, onFollowUp, onProjectCreated }: {
  entry: HistoryEntry;
  locale: Locale;
  trendCount: number;
  onTrendClick: (trend: TrendDot) => void;
  activeProjectId?: string | null;
  onFollowUp?: (query: string) => void;
  /** Optional: Callback wenn beim Speichern automatisch ein neues
   *  Projekt angelegt wurde. Parent setzt damit seinen activeProjectId,
   *  sodass folgende Briefings in dasselbe Projekt wandern. */
  onProjectCreated?: (projectId: string) => void;
}) {
  const { briefing } = entry;
  const isHelp = entry.query === "/help";
  const isLoading = entry.isLoading ?? false; // explicit boolean — not a string comparison
  const b = briefing as any; // Extended fields from LLM
  // Tenant-Scope fuer den /canvas-Handoff via localStorage.
  const activeTenantId = useActiveTenantId();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSignals, setShowSignals] = useState(true); // default OPEN for transparency

  // ── Topisch relevante Signale herausfiltern (Fix 2026-04-21) ──────────────
  //
  // `b.usedSignals` kommt als gemergter Pool aus Retrieval (1. Pass) + Trend-
  // Namen-basierter Anreicherung (2. Pass). Ohne Filter landen Bluesky-
  // Personal-Posts und Al-Jazeera-Geopolitik-Stories in der „Live-Signale"-
  // Sektion, obwohl sie mit der Frage nichts zu tun haben. Der Filter zieht
  // pro Signal den besten verfügbaren Topic-Score (LLM queryRelevance →
  // keyword overlap → konservativer Default) und gated auf 0.25. Social-
  // Tier-Signale müssen 0.5 schaffen.
  //
  // Die Kachel „Live-Signale N" zählt jetzt die GEFILTERTE Menge, damit
  // UI-Zahl und inhaltliche Aussage konsistent sind (LLM sagt „keine
  // direkten Signale" ⇒ Kachel zeigt 0 statt 13).
  const rawSignals: any[] = Array.isArray(b.usedSignals) ? b.usedSignals : [];
  const relevantSignals = rawSignals.filter((s: any) => {
    const topic = typeof s.queryRelevance === "number"
      ? s.queryRelevance
      : typeof s.keywordOverlap === "number"
        ? s.keywordOverlap
        : 0.3;
    if (s.sourceTier === "social") return topic >= 0.5;
    return topic >= 0.25;
  }).sort((a: any, b2: any) => {
    const ta = typeof a.queryRelevance === "number" ? a.queryRelevance : (a.keywordOverlap ?? 0);
    const tb = typeof b2.queryRelevance === "number" ? b2.queryRelevance : (b2.keywordOverlap ?? 0);
    return tb - ta;
  });
  const hiddenSignalCount = rawSignals.length - relevantSignals.length;

  const saveToProject = async () => {
    // Allow retry after a previous failure — but guard against repeated
    // clicks while a save is in flight or after a successful save.
    if (saving || saved) return;
    setSaving(true);
    setSaveError(null);
    try {
      // **Auto-Create-Logik (Audit-Fix 2026-04-19):**
      //
      // Früher war der Button `disabled={!activeProjectId}`, der Tooltip
      // versprach aber trotzdem „Projekt wird automatisch angelegt" —
      // widersprüchlich und bug-anfällig. Fix: wenn noch kein Projekt
      // aktiv ist, erzeugen wir jetzt tatsächlich eins, benennen es nach
      // der Query (erste 60 Zeichen), und speichern das Briefing dort
      // rein. Der Parent bekommt den neuen projectId via Callback, sodass
      // Folge-Briefings ins gleiche Projekt wandern.
      let projectId = activeProjectId;
      if (!projectId) {
        const projName = (entry.query ?? "Neues Projekt").trim().slice(0, 60);
        const createRes = await fetchWithTimeout("/api/v1/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projName }),
        }, 30_000);
        if (!createRes.ok) {
          let m = `HTTP ${createRes.status}`;
          try { const b = await createRes.json(); if (b?.error?.message) m = b.error.message; } catch {}
          throw new Error(locale === "de" ? `Projekt-Anlage fehlgeschlagen: ${m}` : `Project creation failed: ${m}`);
        }
        const createJson = await createRes.json();
        const newId = createJson?.data?.canvas?.id ?? createJson?.canvas?.id;
        if (!newId) {
          throw new Error(locale === "de" ? "Projekt-Anlage ohne ID zurückgekommen" : "Project creation returned no ID");
        }
        projectId = newId;
        onProjectCreated?.(newId);
      }
      // Briefing payloads are heavy (synthesis + chains + scenarios +
      // references) and on a cold dev-server the target route takes
      // 30-60 s to compile. Give this POST a 90 s budget instead of the
      // default 30 s so first-save after a restart actually completes.
      const res = await fetchWithTimeout(`/api/v1/projects/${projectId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: entry.query,
          result: {
            synthesis: briefing.synthesis,
            reasoningChains: briefing.reasoningChains,
            keyInsights: briefing.keyInsights,
            regulatoryContext: briefing.regulatoryContext,
            causalChain: briefing.causalChain,
            scenarios: b.scenarios,
            interpretation: b.interpretation,
            references: b.references,
            followUpQuestions: b.followUpQuestions,
            newsContext: b.newsContext,
            decisionFramework: b.decisionFramework,
            confidence: briefing.confidence,
          },
          locale,
        }),
      }, 90_000);
      if (!res.ok) {
        // Try to surface the server's error message if the envelope carries one.
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error?.message) message = body.error.message;
          else if (body?.error) message = String(body.error);
        } catch { /* non-JSON body */ }
        throw new Error(message);
      }
      setSaved(true);
    } catch (err) {
      // Previously the catch was empty — "Projekte werden nicht
      // gespeichert" had zero signal in the UI. Now we surface both
      // to the console (developer) and an inline error banner (user).
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[saveToProject]", err);
      setSaveError(locale === "de" ? `Speichern fehlgeschlagen: ${msg}` : `Save failed: ${msg}`);
    }
    setSaving(false);
  };

  /**
   * Open this briefing in the Node-Canvas.
   *
   * Hands the briefing off via localStorage under `sis-transfer-to-canvas`
   * — `/canvas` already has a receiver that picks this up on mount,
   * builds a QueryNode at (80, 80), runs it through `computeDerivedNodes`
   * (which produces the insight / scenario / decision / follow-up cards),
   * and renders the whole tree as nodes. The receiver removes the key
   * after reading, so this is a one-shot transfer — refreshing the
   * canvas afterward falls back to the user's normal active canvas.
   *
   * Field names are mapped to the canvas's `QueryResult` interface:
   *   briefing.causalChain     → result.causalAnalysis
   *   briefing.matchedTrends   → result.matchedTrends (shape flattened)
   *   briefing.matchedEdges    → result.matchedEdges  (passed through)
   *
   * The briefing wraps each trend in a `{ trend, queryRelevance, ... }`
   * envelope, while the canvas's `MatchedTrend` type is flat. We flatten
   * it here so the canvas's OrbitDerivationView, dimensions card, and
   * causalgraph card all see non-empty arrays and light up their counts
   * (SIGNALE / TRENDS / KAUSAL) correctly. Without this mapping the Orbit
   * Stage-3 (Trends) column stayed at 0 even when the briefing clearly
   * had trends — because qr.matchedTrends was undefined after transfer.
   */
  const openInCanvas = () => {
    try {
      // Flatten the briefing's {trend, queryRelevance, ...} envelope to the
      // canvas's flat MatchedTrend shape. The briefing can also expose the
      // shape already flat (older responses) — handle both.
      const flatTrends = Array.isArray(b.matchedTrends)
        ? b.matchedTrends.map((m: any) => {
            const t = m?.trend ?? m; // unwrap envelope or pass through
            if (!t || !t.id) return null;
            return {
              id: t.id,
              name: t.name ?? t.id,
              category: t.category ?? "other",
              tags: Array.isArray(t.tags) ? t.tags : [],
              relevance: typeof t.relevance === "number" ? t.relevance : 0.5,
              confidence: typeof t.confidence === "number" ? t.confidence : 0.5,
              impact: typeof t.impact === "number" ? t.impact : 0.5,
              velocity: t.velocity ?? "stable",
              ring: t.ring ?? "assess",
              signalCount: typeof t.signalCount === "number" ? t.signalCount : 0,
              queryRelevance: typeof m?.queryRelevance === "number"
                ? m.queryRelevance
                : (typeof t.queryRelevance === "number" ? t.queryRelevance : undefined),
            };
          }).filter(Boolean)
        : [];

      // matchedEdges may or may not exist on the briefing — pass through if so.
      const edges = Array.isArray((b as any).matchedEdges)
        ? (b as any).matchedEdges
        : Array.isArray((briefing as any).matchedEdges)
          ? (briefing as any).matchedEdges
          : [];

      const result = {
        synthesis: briefing.synthesis,
        reasoningChains: briefing.reasoningChains,
        keyInsights: briefing.keyInsights,
        scenarios: b.scenarios,
        decisionFramework: b.decisionFramework,
        references: b.references,
        followUpQuestions: b.followUpQuestions,
        confidence: briefing.confidence,
        interpretation: b.interpretation,
        newsContext: b.newsContext,
        regulatoryContext: briefing.regulatoryContext,
        causalAnalysis: briefing.causalChain,
        usedSignals: b.usedSignals ?? briefing.usedSignals,
        matchedTrends: flatTrends,
        matchedEdges: edges,
      };
      if (activeTenantId) {
        // Fix 2026-04-21: `projectId` mit in die Transfer-Payload. Home hat
        // via syncToCanvasDb bereits ein Projekt angelegt (oder das Briefing
        // gehört zu einem bestehenden Projekt), der Canvas-Handoff soll
        // diesen Kontext erben statt eine zweite "Kein Projekt"-Session
        // aufzumachen. Ohne diesen Pfad zeigt der Canvas-Header "Kein
        // Projekt" und der User muss das Canvas manuell einem Projekt
        // zuordnen — obwohl das Projekt bereits existiert.
        tenantStorage.set(
          activeTenantId,
          TENANT_STORAGE_KEYS.transferToCanvas,
          JSON.stringify({
            query: entry.query,
            result,
            projectId: activeProjectId ?? null,
          }),
        );
      }
      window.location.href = "/canvas";
    } catch (e) {
      console.error("[openInCanvas]", e);
    }
  };

  return (
    <article className="card volt-texture">

      {/* Thread indicator */}
      {entry.parentQuery && (
        <div style={{ padding: "6px 14px 0", display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--volt-orchid, #D98AE8)", fontFamily: "var(--volt-font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <CornerDownRight size={11} strokeWidth={2.25} />
          <span style={{ fontWeight: 700 }}>{locale === "de" ? "Folgefrage zu" : "Follow-up to"}</span>
          <Tooltip content={entry.parentQuery} placement="bottom">
            <span style={{ color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300, textTransform: "none", letterSpacing: 0 }}>
              {entry.parentQuery}
            </span>
          </Tooltip>
        </div>
      )}

      {/* ── Card header ────────────────────────────────────────── */}
      {/* Query-Titel frueher "whiteSpace: nowrap" + ellipsis. Bei langen
           Fragen wurde der Titel auf "Wie entwickelt sich die Mobilit..."
           abgeschnitten — die eigentliche Frage war versteckt. Jetzt
           wrappen auf max 2 Zeilen (-webkit-line-clamp) mit klarer
           Display-Typografie, damit der Kopf des Briefings tatsaechlich
           zeigt, worum es geht. */}
      <div className="card-header">
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            color: "var(--volt-text)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            wordBreak: "break-word",
          }}
          title={entry.query}
        >
          {entry.query}
        </span>
        {isLoading && (
          <span style={{ fontSize: 12, color: "var(--volt-text-muted)", flexShrink: 0 }}>
            {locale === "de" ? "Analysiere…" : "Analyzing…"}
          </span>
        )}
        {/* Audit finding A1-H2 (18.04.2026): Save button used to be
             gated on `activeProjectId &&`. But `activeProjectId` is
             set by syncToCanvasDb which runs with `.catch(() => {})`.
             If the DB write fails silently the button never appears
             and the user assumes persistence succeeded. Now the
             button always renders when a briefing synthesis exists;
             if there's no active project yet, the click is disabled
             and the tooltip explains why. */}
        {!isLoading && !isHelp && briefing.synthesis && (
          <Tooltip
            content={saveError
              ? saveError
              : saved
                ? (locale === "de" ? "Im Projekt gespeichert" : "Saved to project")
                : !activeProjectId
                  // Neue Auto-Create-Logik — Tooltip deckt jetzt den Fall
                  // „kein aktives Projekt" mit einer klaren Ansage statt
                  // dem alten „wird automatisch angelegt"-Disclaimer bei
                  // disabled Button.
                  ? (locale === "de" ? "Neues Projekt anlegen und Briefing darin speichern" : "Create a new project and save the briefing there")
                  : (locale === "de" ? "Briefing im aktiven Projekt speichern" : "Save briefing to active project")}
            placement="bottom"
          >
            <Button
              variant="ghost" size="sm"
              onClick={saveToProject}
              // Button ist NICHT mehr disabled wenn activeProjectId fehlt
              // — wir legen das Projekt in `saveToProject` automatisch an.
              disabled={saved || saving}
              className={cn(
                "text-[12px] px-3 h-7 gap-1.5",
                saved ? "text-[#1A9E5A]" : saveError ? "text-[#D93636]" : "text-[#9B9B9B]",
              )}
            >
              {saved ? (
                <>
                  <CheckIcon size={13} strokeWidth={2.5} />
                  {locale === "de" ? "Gespeichert" : "Saved"}
                </>
              ) : saving ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : saveError ? (
                locale === "de" ? "Erneut versuchen" : "Try again"
              ) : (
                locale === "de" ? "Speichern" : "Save"
              )}
            </Button>
          </Tooltip>
        )}
        {!isLoading && !isHelp && briefing.synthesis && briefing.synthesis.length > 20 && (
          <Tooltip
            content={locale === "de"
              ? "Dieses Briefing als Node-Canvas öffnen — volle strategische Arbeitsfläche"
              : "Open this briefing in the Node Canvas — full strategic workspace"}
            placement="bottom"
          >
            <Button
              variant="ghost" size="sm"
              onClick={openInCanvas}
              className="text-[12px] px-3 h-7 text-[#9B9B9B] hover:text-[#0A0A0A] gap-1.5"
              aria-label={locale === "de" ? "Im Node Canvas öffnen" : "Open in Node Canvas"}
            >
              <LayoutGrid size={13} />
              Canvas
            </Button>
          </Tooltip>
        )}
        {!isLoading && !isHelp && briefing.synthesis && briefing.synthesis.length > 20 && (
          <BriefingExport entry={entry} locale={locale} />
        )}
        {briefing.confidence > 0 && !isLoading && (() => {
          /*
            Notion-Plan P3-3 (#17): Confidence Decay. Eine 30 Tage alte
            gespeicherte Analyse verliert Wert; der angezeigte Score
            sinkt entsprechend ab (exp(-0.03 * days_elapsed) pro Tag).
            Der UNDECAYED-Wert bleibt im Tooltip + als Titel für
            Transparenz.
          */
          const ageDays = Math.max(0, (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24));
          const decayFactor = Math.exp(-0.03 * ageDays);
          const decayedConf = briefing.confidence * decayFactor;
          const showDecay = ageDays >= 1; // erst nach 1 Tag anzeigen
          const displayConf = showDecay ? decayedConf : briefing.confidence;
          const confPct = Math.round(displayConf * 100);
          const isStale = showDecay && decayFactor < 0.7; // >12 Tage ≈ 30% Verlust
          const tooltipBase = locale === "de"
            ? `Konfidenz ${confPct}% — basiert auf ${relevantSignals.length} topisch relevanten Signalen und ${b.references?.length ?? 0} Quellen.`
            : `Confidence ${confPct}% — based on ${relevantSignals.length} topically relevant signals and ${b.references?.length ?? 0} sources.`;
          const tooltipDecay = showDecay
            ? (locale === "de"
              ? ` Alter ${ageDays.toFixed(1)} Tage — ursprünglich ${Math.round(briefing.confidence * 100)}%, mit 3%/Tag Decay.`
              : ` Age ${ageDays.toFixed(1)} days — original ${Math.round(briefing.confidence * 100)}%, with 3%/day decay.`)
            : "";
          return (
            <Badge
              variant="outline"
              title={tooltipBase + tooltipDecay}
              className={cn(
                "text-[11px] cursor-help",
                displayConf > 0.7 ? "bg-[var(--pastel-mint)] text-[var(--pastel-mint-text)] border-[var(--pastel-mint-border)]" :
                displayConf > 0.4 ? "bg-[var(--pastel-butter)] text-[var(--pastel-butter-text)] border-[var(--pastel-butter-border)]" :
                "bg-[var(--signal-negative-light)] text-[var(--signal-negative-text)] border-[var(--signal-negative-border)]"
              )}
            >
              {confPct}%{isStale && <span style={{ opacity: 0.7, marginLeft: 3 }}>↓</span>}
            </Badge>
          );
        })()}
        {/* VAL-01: Data quality warnings from validation pipeline */}
        {!isLoading && (b as any)._repaired && (
          <Badge variant="outline" className="text-[10px] cursor-help bg-[var(--pastel-butter)] text-[var(--pastel-butter-text)] border-[var(--pastel-butter-border)]"
            title={locale === "de" ? "Antwort war unvollständig und wurde repariert — Ergebnisse können lückenhaft sein." : "Response was incomplete and was repaired — results may be partial."}>
            {locale === "de" ? "Repariert" : "Repaired"}
          </Badge>
        )}
        {!isLoading && (b as any)._dataQualityWarnings?.length > 0 && (
          <Badge variant="outline" className="text-[10px] cursor-help bg-[var(--pastel-butter)] text-[var(--pastel-butter-text)] border-[var(--pastel-butter-border)]"
            title={(b as any)._dataQualityWarnings.join("\n")}>
            {locale === "de" ? "Datenhinweis" : "Data notice"}
          </Badge>
        )}
        <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>
          {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* ── Error state ────────────────────────────────────────── */}
      {entry.error && !isLoading && (
        <div className="card-body">
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
            background: "var(--volt-negative-light)", border: "1px solid var(--volt-negative-border)", borderRadius: "var(--volt-radius-md)",
            fontFamily: "var(--font-ui)",
          }}>
            <AlertTriangle size={16} strokeWidth={2.25} color="var(--volt-negative-text)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 13, fontWeight: 600, color: "var(--volt-negative-text)", marginBottom: 4 }}>
                {locale === "de" ? "Analyse fehlgeschlagen" : "Analysis failed"}
              </div>
              <div style={{ fontSize: 12, color: "var(--signal-negative-text, #7F1D1D)", lineHeight: 1.5 }}>{entry.error}</div>
            </div>
            <Tooltip content={locale === "de" ? "Analyse mit derselben Frage erneut starten" : "Retry with the same query"} placement="top">
              <VoltButton variant="destructive" size="sm" onClick={() => onFollowUp?.(entry.query)}>
                <RotateCcw size={13} style={{ marginRight: 6 }} />
                {locale === "de" ? "Wiederholen" : "Retry"}
              </VoltButton>
            </Tooltip>
          </div>
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────── */}
      {isLoading && (
        <div className="card-body">
          {entry.pipelineStages ? (
            <SequentialPipeline stages={entry.pipelineStages} query={entry.query} locale={locale} />
          ) : (
            <ReasoningTrace query={entry.query} trendCount={trendCount} locale={locale} />
          )}
        </div>
      )}

      {/* ── Completed state (Volt UI Dashboard structure) ──────── */}
      {!isLoading && (
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ═══ LEVEL 1: SYNTHESIS + KPI HERO ═══ */}

          {/* 1a. Synthesis — the main answer */}
          {briefing.synthesis && (
            <SynthesisBlock text={briefing.synthesis} locale={locale} isHelp={isHelp} />
          )}

          {/* 1b. KPI Hero Grid — Volt UI Dashboard pattern (4 cards) */}
          {!isHelp && (rawSignals.length > 0 || b.references?.length > 0 || briefing.confidence > 0 || b.scenarios?.length > 0) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              {briefing.confidence > 0 && (
                <VoltKpiCard
                  variant={briefing.confidence > 0.7 ? "lime" : "light"}
                  label={locale === "de" ? "Konfidenz" : "Confidence"}
                  value={`${Math.round(briefing.confidence * 100)}%`}
                  subLabel={briefing.confidence > 0.7
                    ? (locale === "de" ? "Breite Datenbasis, starke Übereinstimmung" : "Broad data basis, strong agreement")
                    : briefing.confidence > 0.4
                    ? (locale === "de" ? "Mittlere Verlässlichkeit" : "Moderate reliability")
                    : (locale === "de" ? "Geringe Datenbasis" : "Limited data basis")
                  }
                  icon={<Gauge size={16} />}
                />
              )}
              {rawSignals.length > 0 && (
                <VoltKpiCard
                  variant="light"
                  label={locale === "de" ? "Live-Signale" : "Live Signals"}
                  value={relevantSignals.length}
                  subLabel={
                    relevantSignals.length === 0
                      ? (locale === "de" ? `0 topisch relevant (${hiddenSignalCount} gefiltert)` : `0 topically relevant (${hiddenSignalCount} filtered)`)
                      : hiddenSignalCount > 0
                        ? (locale === "de" ? `thematisch relevant · ${hiddenSignalCount} ausgefiltert` : `topically relevant · ${hiddenSignalCount} filtered out`)
                        : (locale === "de" ? "Aus aktiven Connectors" : "From active connectors")
                  }
                  icon={<Radio size={16} />}
                />
              )}
              {b.references?.length > 0 && (
                <VoltKpiCard
                  variant="light"
                  label={locale === "de" ? "Quellen" : "Sources"}
                  value={b.references.length}
                  subLabel={locale === "de" ? "Authoritative Referenzen" : "Authoritative references"}
                  icon={<BookOpen size={16} />}
                />
              )}
              {b.scenarios?.length > 0 && (
                <VoltKpiCard
                  variant="dark"
                  label={locale === "de" ? "Szenarien" : "Scenarios"}
                  value={b.scenarios.length}
                  subLabel={locale === "de" ? "Optimistisch · Basis · Pessimistisch" : "Optimistic · Base · Pessimistic"}
                  icon={<Compass size={16} />}
                />
              )}
            </div>
          )}

          {/* ═══ LEVEL 2: MAIN SECTION CARDS ═══ */}

          {/* 2. Scenarios in Section Card */}
          {b.scenarios?.length > 0 && (
            <VoltSectionCard
              icon={<Compass size={18} />}
              iconVariant="blue"
              title={locale === "de" ? "Zukunftsszenarien" : "Future Scenarios"}
              subtitle={locale === "de"
                ? `${b.scenarios.length} Szenarien modelliert — wähle eine Karte für Aktionen`
                : `${b.scenarios.length} scenarios modeled — pick a card for actions`}
            >
              <ScenarioSelector
                scenarios={b.scenarios}
                query={entry.query}
                locale={locale}
                onFollowUp={onFollowUp}
                hideHeader
              />
            </VoltSectionCard>
          )}

          {/* 3. Key Insights in Section Card */}
          {briefing.keyInsights?.length > 0 && !isHelp && (
            <VoltSectionCard
              icon={<Lightbulb size={18} />}
              iconVariant="lime"
              title={locale === "de" ? "Wichtigste Erkenntnisse" : "Key Insights"}
              subtitle={locale === "de"
                ? `${briefing.keyInsights.length} strategische Punkte`
                : `${briefing.keyInsights.length} strategic points`}
            >
              {/* Audit finding A1-H3 (18.04.2026): previously
                   sliced to 3 and dumped insights 4..N into the
                   Regulatory Context accordion with a Sparkles icon —
                   wrong section, collapsed by default, easy to miss.
                   Now all insights render here in order. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {briefing.keyInsights.map((insight: string, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <VoltIconBox
                      icon={<span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{String(i + 1).padStart(2, "0")}</span>}
                      variant="lime"
                      size={32}
                      rounded="full"
                    />
                    <p
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "var(--foreground)",
                        margin: 0,
                        fontFamily: "var(--font-ui)",
                        flex: 1,
                        paddingTop: 5,
                      }}
                    >
                      <InlineProvenance text={insight} locale={locale} />
                    </p>
                  </div>
                ))}
              </div>
            </VoltSectionCard>
          )}

          {/* 4. Causal Orbit in Section Card */}
          {briefing.causalChain?.length > 0 && (
            <VoltSectionCard
              icon={<Network size={18} />}
              iconVariant="orchid"
              title={locale === "de" ? "Kausalnetz" : "Causal Network"}
              subtitle={locale === "de"
                ? `${briefing.causalChain.length} Ketten visualisiert`
                : `${briefing.causalChain.length} chains visualized`}
            >
              {/* Klick auf Kausal-Netz-Knoten wurde in der ersten Ergebnis-
                   ansicht deaktiviert: User-Feedback war, dass der direkte
                   "Analysiere diesen Knoten"-Follow-up an dieser Stelle
                   verwirrt — das Briefing soll sich erst setzen, bevor
                   eine neue Query losgefeuert wird. Follow-up-Queries auf
                   Knoten passieren weiterhin im Orbit / Canvas / Detail-
                   Panel, dort ist der Kontext ausreichend. */}
              <CausalOrbit
                chains={briefing.causalChain}
                locale={locale}
              />
            </VoltSectionCard>
          )}

          {/* 5. Balanced Scorecard in Section Card */}
          {b.balancedScorecard?.perspectives?.length > 0 && (
            <VoltSectionCard
              icon={<Target size={18} />}
              iconVariant="mint"
              title={locale === "de" ? "Strategische Dimensionen" : "Strategic Dimensions"}
              subtitle={locale === "de"
                ? "Balanced Scorecard — 4 Perspektiven"
                : "Balanced Scorecard — 4 perspectives"}
            >
              <BalancedScorecard
                data={b.balancedScorecard}
                locale={locale}
                onRating={(perspectiveId, rating) => {
                  const queryHash = btoa(entry.query.slice(0, 64) + entry.timestamp.toISOString().slice(0, 16))
                    .replace(/[^a-z0-9]/gi, "").slice(0, 32);
                  fetchWithTimeout("/api/v1/bsc-ratings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ queryHash, perspectiveId, rating }),
                  }).catch(() => {});
                }}
              />
            </VoltSectionCard>
          )}

          {/*
            STEEP+V Analyse-Kacheln — Notion-Plan P3-2 (2026-04-20)
            Der System-Prompt fragt seit v0.2 ein steepV-Objekt mit je 6
            Dimensionen (S/T/E_economy/E_environment/P/V) ab. Hier als
            machine-readable + UI-sichtbar: 6 Kacheln nebeneinander, NULL-
            Werte als neutraler Platzhalter. Macht die gedanklich wichtigste
            analytische Achse des Briefings direkt scanbar — ohne dass der
            User durch die synthesis lesen muss.
          */}
          {(briefing.steepV && typeof briefing.steepV === "object") && (() => {
            const sv = briefing.steepV as Record<string, string | null | undefined>;
            const dims: Array<{ key: string; label: { de: string; en: string }; value: string | null }> = [
              { key: "S",           label: { de: "Society",     en: "Society" },     value: sv.S ?? null },
              { key: "T",           label: { de: "Technology",  en: "Technology" },  value: sv.T ?? null },
              { key: "E_economy",   label: { de: "Economy",     en: "Economy" },     value: sv.E_economy ?? null },
              { key: "E_environment", label: { de: "Environment", en: "Environment" }, value: sv.E_environment ?? null },
              { key: "P",           label: { de: "Politics",    en: "Politics" },    value: sv.P ?? null },
              { key: "V",           label: { de: "Values",      en: "Values" },      value: sv.V ?? null },
            ];
            const activeCount = dims.filter((d) => d.value && d.value.trim().length > 0).length;
            if (activeCount === 0) return null;
            return (
              <VoltSectionCard
                icon={<LayoutGrid size={18} />}
                iconVariant="blue"
                title={locale === "de" ? "STEEP+V Dimensionen" : "STEEP+V Dimensions"}
                subtitle={locale === "de"
                  ? `${activeCount} von 6 Dimensionen relevant für diese Frage`
                  : `${activeCount} of 6 dimensions relevant to this question`}
              >
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}>
                  {dims.map((d) => {
                    const hasContent = d.value && d.value.trim().length > 0;
                    return (
                      <div
                        key={d.key}
                        style={{
                          padding: "10px 12px",
                          background: hasContent ? "var(--color-surface, #FAFAFA)" : "transparent",
                          border: `1px solid ${hasContent ? "var(--color-border)" : "rgba(0,0,0,0.06)"}`,
                          borderRadius: 8,
                          opacity: hasContent ? 1 : 0.45,
                        }}
                      >
                        <div style={{
                          fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                          letterSpacing: "0.10em", textTransform: "uppercase",
                          color: "var(--volt-text-faint, #9B9B9B)",
                          marginBottom: 5,
                        }}>
                          {d.key} · {locale === "de" ? d.label.de : d.label.en}
                        </div>
                        <div style={{
                          fontSize: 13, lineHeight: 1.55,
                          color: "var(--color-text-primary)",
                          fontFamily: "var(--font-ui)",
                        }}>
                          {hasContent
                            ? <InlineProvenance text={d.value!} locale={locale} />
                            : <span style={{ fontStyle: "italic" }}>
                                {locale === "de" ? "— nicht relevant" : "— not relevant"}
                              </span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </VoltSectionCard>
            );
          })()}

          {/* Trend chips — scales from 1 to N, each chip carries ring + velocity cues */}
          {briefing.matchedTrends.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--color-text-muted)",
                marginRight: 4,
              }}>
                {locale === "de"
                  ? `${briefing.matchedTrends.length} verwandte Trends`
                  : `${briefing.matchedTrends.length} related trends`}
              </span>
              {briefing.matchedTrends.map((m: any) => {
                const t = m.trend;
                const ring: string | undefined = t.ring;
                const velDot = t.velocity === "rising" ? "var(--color-success)"
                  : t.velocity === "falling" ? "var(--color-danger)"
                  : "var(--color-text-muted)";
                return (
                  <button key={t.id} onClick={() => onTrendClick(t)} className="chip chip-brand" title={ring ? `Ring: ${ring}` : undefined}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: velDot,
                    }} />
                    {t.name}
                    {ring && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "var(--color-text-muted)",
                        marginLeft: 4,
                      }}>{ring}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ═══ LEVEL 3: CONTEXT INFOBLOCKS ═══
               Frueher: 3-spaltig bei minmax(300px, 1fr) — hat auf dem
               Briefing-Container (max ~960px) drei Blocks nebeneinander
               gequetscht. Drei enge Spalten mit je ~30 Zeichen pro Zeile
               ergeben schlechten Lesefluss, vor allem bei zusammen-
               haengenden Absaetzen wie "Strategische Interpretation".
               Jetzt: Single-Column bis mindestens 900px Container-Breite,
               zwei Spalten nur auf sehr breiten Layouts. Ergebnis: jeder
               Block liest sich als eigenstaendiger Absatz mit 60-80
               Zeichen pro Zeile — Lesbarkeit statt Dichte. */}
          {(b.interpretation || b.newsContext || b.decisionFramework) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
                gap: 14,
              }}
            >
              {b.interpretation && (
                <VoltInfoBlock
                  variant="brand"
                  label={locale === "de" ? "Strategische Interpretation" : "Strategic Interpretation"}
                >
                  {b.interpretation}
                </VoltInfoBlock>
              )}
              {b.newsContext && (
                <VoltInfoBlock
                  variant="warning"
                  label={locale === "de" ? "Aktueller Kontext" : "Current Context"}
                >
                  {b.newsContext}
                </VoltInfoBlock>
              )}
              {b.decisionFramework && (
                <VoltInfoBlock
                  variant="success"
                  label={locale === "de" ? "Entscheidungshilfe" : "Decision Framework"}
                >
                  {b.decisionFramework}
                </VoltInfoBlock>
              )}
            </div>
          )}

          {/* ═══ LEVEL 4: SOURCES + FOLLOW-UPS + DETAILS ═══ */}

          {/* Suggested Tags ("LLM-Tags") — Sprung-Einstiege aus dem LLM /
               lokaler Tag-Wolke. Vorher wurden sie gerendert, aber der
               async-LLM-Pfad setzte `suggestedTags` nicht, deshalb blieb
               die Zeile auf Home leer. Fix in intelligence-engine.ts —
               hier nur die Click-Robustheit: statt des bruechigen
               input[type=text]-DOM-Hacks nutzen wir den durchgereichten
               onFollowUp-Callback, so dass ein Klick sauber eine neue
               Query triggert. */}
          {b.suggestedTags?.length > 0 && (
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
              aria-label={locale === "de" ? "Verwandte Begriffe" : "Related tags"}
            >
              <span
                style={{
                  fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                  textTransform: "uppercase" as const,
                  color: "var(--volt-text-faint, #AAA)",
                  marginRight: 2,
                }}
              >
                {locale === "de" ? "Verwandt" : "Related"}
              </span>
              {b.suggestedTags.map((tag: string, i: number) => (
                <button
                  key={i}
                  className="chip chip-neutral"
                  title={locale === "de" ? `Nachfrage zu "${tag}"` : `Follow up on "${tag}"`}
                  onClick={() => {
                    if (onFollowUp) {
                      onFollowUp(
                        locale === "de"
                          ? `Was bedeutet "${tag}" im Kontext von: ${entry.query}`
                          : `What does "${tag}" mean in the context of: ${entry.query}`,
                      );
                      return;
                    }
                    // Fallback: versuche sowohl input als auch textarea zu
                    // finden, weil Home + Canvas unterschiedliche Elemente
                    // verwenden.
                    const field = (document.querySelector('textarea') as HTMLTextAreaElement | null)
                      ?? (document.querySelector('input[type="text"]') as HTMLInputElement | null);
                    if (field) {
                      const proto = field instanceof HTMLTextAreaElement
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype;
                      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                      setter?.call(field, tag);
                      field.dispatchEvent(new Event("input", { bubbles: true }));
                      field.focus();
                    }
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Sources — References.
               Backlog-Task 1.5 (2026-04-21): Wenn gar keine externen
               Referenzen zitiert wurden, zeigen wir das jetzt sichtbar als
               Datenlage-Hinweis (nicht mehr nur als Klein-Italic). Der
               Server-Validator in query/route.ts meldet zusätzlich eine
               Warnung in _dataQualityWarnings, wenn die Synthese keine
               Provenance-Tags trägt — so entsteht eine doppelte Sicherung
               (Inline-Tag-Disziplin im Prompt + Ref-Anwesenheit im UI). */}
          {(!b.references || b.references.length === 0) && !isHelp && briefing.synthesis && (() => {
            const synth = briefing.synthesis ?? "";
            const hasTags = /\[\s*(SIGNAL|TREND|REG|EDGE|LLM[-\s]?(KNOWLEDGE|Einsch[äa]tzung|Einschaetzung|Assessment))[^\]]*\]/i.test(synth);
            return (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px",
                background: hasTags ? "var(--pastel-butter, rgba(245, 198, 80, 0.12))" : "var(--volt-negative-light, rgba(217, 54, 54, 0.08))",
                border: `1px solid ${hasTags ? "var(--pastel-butter-border, rgba(245, 198, 80, 0.35))" : "var(--volt-negative-border, rgba(217, 54, 54, 0.35))"}`,
                borderRadius: 8,
                fontSize: 12,
                color: hasTags ? "var(--pastel-butter-text, #7A5C00)" : "var(--volt-negative-text, #7F1D1D)",
                lineHeight: 1.5,
              }}>
                <AlertTriangle size={14} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {hasTags
                      ? (locale === "de" ? "Keine externen Quellen zitiert" : "No external sources cited")
                      : (locale === "de" ? "Antwort ohne Quellenbelege" : "Unsourced response")}
                  </div>
                  <div>
                    {hasTags
                      ? (locale === "de"
                          ? "Die Antwort stützt sich auf Trend-Wissen und Inline-Provenance-Tags, aber nennt keine verlinkbaren Referenzen. Kritisch gegenprüfen."
                          : "This answer relies on trend knowledge and inline provenance tags but cites no linkable references. Cross-check critically.")
                      : (locale === "de"
                          ? "Weder externe Referenzen noch Inline-Quellen-Tags. Die Aussagen sind reine LLM-Einschätzung — bitte nicht als belegte Fakten behandeln."
                          : "Neither external references nor inline source tags. The statements are pure LLM assessment — do not treat as verified facts.")
                    }
                  </div>
                </div>
              </div>
            );
          })()}
          {b.references?.length > 0 && (
            <VoltSectionCard
              icon={<BookOpen size={18} />}
              iconVariant="light"
              title={locale === "de" ? "Quellen" : "Sources"}
              subtitle={(() => {
                // Critical-Fix-Plan P1-2 (Notion 2026-04-20): Verifizierte
                // vs unverifizierte Quellen getrennt ausweisen. Der Validator
                // setzt `verified: true` für Refs auf bekannten, autoritativen
                // Domains (EU, UN, Research, Connector-Backends). Alles andere
                // gilt als "AI-suggested, domain not on verified allowlist".
                const refs = b.references as Array<{ url?: string; verified?: boolean }>;
                const verifiedCount = refs.filter((r) => r.verified).length;
                const total = refs.length;
                if (verifiedCount === 0) {
                  return locale === "de"
                    ? `${total} Referenzen — von KI vorgeschlagen, nicht auf Allowlist`
                    : `${total} references — AI-suggested, not on allowlist`;
                }
                if (verifiedCount === total) {
                  return locale === "de"
                    ? `${total} Referenzen · alle aus verifizierten Domains`
                    : `${total} references · all from verified domains`;
                }
                return locale === "de"
                  ? `${total} Referenzen · ${verifiedCount} verifiziert, ${total - verifiedCount} unverifiziert`
                  : `${total} references · ${verifiedCount} verified, ${total - verifiedCount} unverified`;
              })()}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.references.map((ref: { title: string; url: string; relevance?: string; verified?: boolean }, i: number) => (
                  <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <VoltReferencePill
                      href={ref.url}
                      title={ref.title}
                      externalTitle={ref.relevance}
                    />
                    {/* Verifikations-Indikator: grüner Punkt für
                         bekannte Domain, gelbes "?" für unverifizierte.
                         Klickbar-Detail: Domain-Info im Tooltip. */}
                    {ref.url && (
                      <span
                        title={ref.verified
                          ? (locale === "de" ? "Domain auf Allowlist (Autoritätsquelle)" : "Domain on allowlist (authoritative source)")
                          : (locale === "de" ? "Domain nicht verifiziert — prüfen" : "Domain not verified — review")}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          width: 14,
                          height: 14,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          background: ref.verified ? "rgba(26, 158, 90, 0.14)" : "rgba(245, 198, 80, 0.18)",
                          color: ref.verified ? "#0F6038" : "#7A5C00",
                          border: `1px solid ${ref.verified ? "rgba(26, 158, 90, 0.35)" : "rgba(245, 198, 80, 0.45)"}`,
                          cursor: "help",
                        }}
                      >
                        {ref.verified ? "✓" : "?"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </VoltSectionCard>
          )}

          {/* Follow-up Questions */}
          {b.followUpQuestions?.length > 0 && (
            <VoltSectionCard
              icon={<MessageSquare size={18} />}
              iconVariant="light"
              title={locale === "de" ? "Weiterführende Fragen" : "Follow-up Questions"}
              subtitle={locale === "de" ? "Klicke eine Frage zum Vertiefen" : "Click a question to dive deeper"}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {b.followUpQuestions.map((q: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => onFollowUp?.(q)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: "var(--muted, #F7F7F7)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      color: "var(--foreground)",
                      transition: "all 0.15s",
                      lineHeight: 1.45,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "var(--card)";
                      e.currentTarget.style.borderColor = "var(--foreground)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "var(--muted, #F7F7F7)";
                      e.currentTarget.style.borderColor = "var(--color-border)";
                    }}
                  >
                    <VoltIconBox
                      icon={<ArrowRight size={14} />}
                      variant="light"
                      size={28}
                      rounded="full"
                    />
                    <span style={{ flex: 1 }}>{q}</span>
                  </button>
                ))}
              </div>
            </VoltSectionCard>
          )}

          {/* Live Signals as Activity-List inside Section Card.
               Fix 2026-04-21: Sektion zeigt jetzt NUR noch topisch relevante
               Signale (relevantSignals), nicht den gesamten Retrieval-Pool.
               Subtitle trägt die Filter-Info, damit transparent bleibt, wie
               viele Kandidaten rausgefallen sind. Bei 0 relevanten aber >0
               Kandidaten → ehrlicher Empty-State, der NICHT dem LLM-Synthese-
               Text widerspricht („keine direkten Signale"). */}
          {rawSignals.length > 0 && (
            <VoltSectionCard
              icon={<Radio size={18} />}
              iconVariant="mint"
              title={locale === "de" ? "Live-Signale" : "Live Signals"}
              subtitle={relevantSignals.length === 0
                ? (locale === "de"
                  ? `Keine topisch relevanten Signale (${hiddenSignalCount} Kandidaten ausgefiltert)`
                  : `No topically relevant signals (${hiddenSignalCount} candidates filtered out)`)
                : hiddenSignalCount > 0
                  ? (locale === "de"
                    ? `${relevantSignals.length} thematisch relevant · ${hiddenSignalCount} ausgefiltert`
                    : `${relevantSignals.length} topically relevant · ${hiddenSignalCount} filtered out`)
                  : (locale === "de"
                    ? `${relevantSignals.length} aggregierte Signale`
                    : `${relevantSignals.length} aggregated signals`)
              }
              action={relevantSignals.length > 0 ? (
                <button
                  onClick={() => setShowSignals((v) => !v)}
                  style={{
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--muted-foreground)",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {showSignals ? (locale === "de" ? "Einklappen" : "Collapse") : (locale === "de" ? "Ausklappen" : "Expand")}
                </button>
              ) : undefined}
            >
              {relevantSignals.length === 0 ? (
                <div style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  fontStyle: "italic",
                  lineHeight: 1.55,
                  padding: "4px 0",
                }}>
                  {locale === "de"
                    ? "Die aktiven Connectors lieferten aktuell keine Signale, die direkt zur Frage passen. Die Synthese stützt sich auf strukturelle Trends und Fachwissen."
                    : "The active connectors did not return any signals that directly match this question. The synthesis is grounded in structural trends and domain knowledge."}
                </div>
              ) : showSignals && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {relevantSignals.map((s: any, i: number) => {
                    const sourceIconVariant: "blue" | "mint" | "orchid" | "peach" | "butter" | "rose" =
                      s.source.toLowerCase().includes("arxiv") || s.source.toLowerCase().includes("crossref") ? "orchid"
                      : s.source.toLowerCase().includes("github") ? "light" as any
                      : s.source.toLowerCase().includes("news") || s.source.toLowerCase().includes("guardian") ? "rose"
                      : s.source.toLowerCase().includes("reddit") || s.source.toLowerCase().includes("social") ? "peach"
                      : s.source.toLowerCase().includes("gdelt") || s.source.toLowerCase().includes("acled") ? "butter"
                      : "mint";
                    const SourceIcon = s.source.toLowerCase().includes("arxiv") || s.source.toLowerCase().includes("crossref") || s.source.toLowerCase().includes("openalex") ? DocIcon
                      : s.source.toLowerCase().includes("news") || s.source.toLowerCase().includes("guardian") || s.source.toLowerCase().includes("nyt") ? Newspaper
                      : Radio;
                    // Zeige die Topic-Score-Badge, damit der User nachvollziehen kann,
                    // WARUM dieses Signal hier auftaucht — und in welcher Stärke.
                    const topic = typeof s.queryRelevance === "number"
                      ? s.queryRelevance
                      : typeof s.keywordOverlap === "number" ? s.keywordOverlap : null;
                    const topicSource: "llm" | "keyword" | null = typeof s.queryRelevance === "number"
                      ? "llm"
                      : typeof s.keywordOverlap === "number" ? "keyword" : null;
                    return (
                      <a
                        key={i}
                        href={s.url || undefined}
                        target={s.url ? "_blank" : undefined}
                        rel={s.url ? "noopener noreferrer" : undefined}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "12px 0",
                          borderBottom: i < relevantSignals.length - 1 ? "1px solid var(--color-border)" : "none",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <VoltIconBox
                          icon={<SourceIcon size={14} />}
                          variant={sourceIconVariant as any}
                          size={32}
                          rounded="full"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "var(--font-ui)",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "var(--foreground)",
                              lineHeight: 1.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.title}
                          </div>
                          {typeof s.snippet === "string" && s.snippet.length > 0 && (
                            <div
                              style={{
                                fontFamily: "var(--font-ui)",
                                fontSize: 12,
                                color: "var(--muted-foreground)",
                                lineHeight: 1.45,
                                marginTop: 4,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical" as const,
                                overflow: "hidden",
                              }}
                            >
                              {s.snippet}
                            </div>
                          )}
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--muted-foreground)",
                              marginTop: 3,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span>{s.source}</span>
                            {topic !== null && (
                              <span
                                title={topicSource === "llm"
                                  ? (locale === "de" ? "Topischer Bezug laut LLM-Einschätzung" : "Topical relevance rated by LLM")
                                  : (locale === "de" ? "Topischer Bezug aus Keyword-Überschneidung" : "Topical relevance from keyword overlap")}
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: 8,
                                  background: topic >= 0.6 ? "rgba(26, 158, 90, 0.12)" : topic >= 0.4 ? "rgba(245, 200, 122, 0.18)" : "rgba(0,0,0,0.05)",
                                  color: topic >= 0.6 ? "#0F6038" : topic >= 0.4 ? "#7A5C00" : "var(--muted-foreground)",
                                  fontWeight: 600,
                                  letterSpacing: "0.02em",
                                }}
                              >
                                {Math.round(topic * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </VoltSectionCard>
          )}

          {/* Regulatory context in expandable details */}
          {briefing.regulatoryContext?.length > 0 && (
            <details>
              <summary style={{
                fontSize: 11, color: "var(--muted-foreground)", cursor: "pointer",
                listStyle: "none", display: "flex", alignItems: "center", gap: 8, userSelect: "none",
                fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
                padding: "8px 0",
              }}>
                <Scale size={14} />
                <span>{locale === "de" ? "Regulierung" : "Regulation"}</span>
                <span style={{ opacity: 0.6 }}>({briefing.regulatoryContext.length})</span>
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, paddingLeft: 22 }}>
                {briefing.regulatoryContext.map((reg: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                    <InlineProvenance text={reg} locale={locale} />
                  </div>
                ))}
                {/* Insights > 3 used to be appended here with a Sparkles
                     icon — wrong section and hidden by default. Removed
                     in the A1-H3 audit fix; all insights now render in
                     the Key Insights section above. */}
              </div>
            </details>
          )}

          {/*
            Anomaly Signals (v0.2 Notion spec)
            ----------------------------------
            When a live signal contradicts the dominant trend direction,
            the LLM surfaces it here with an interpretation. This is the
            single most valuable diagnostic a user can get — a curated
            list of "things that don't fit the narrative". Lives between
            Regulatory Context and Eigener Gedanke because it's another
            form of provenance-grade context, not an action section.
          */}
          {((b as any).anomalySignals?.length ?? 0) > 0 && (
            <details>
              <summary style={{
                fontSize: 11, color: "var(--muted-foreground)", cursor: "pointer",
                listStyle: "none", display: "flex", alignItems: "center", gap: 8, userSelect: "none",
                fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
                padding: "8px 0",
              }}>
                <AlertTriangle size={14} />
                <span>{locale === "de" ? "Anomalien im Signalbild" : "Anomaly signals"}</span>
                <span style={{ opacity: 0.6 }}>({(b as any).anomalySignals.length})</span>
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12, paddingLeft: 22 }}>
                {(b as any).anomalySignals.map((a: { signal: string; contradicts: string; interpretation: string }, i: number) => (
                  <div key={i} style={{
                    padding: 10,
                    background: "rgba(245, 158, 11, 0.04)",
                    borderLeft: "2px solid rgba(245, 158, 11, 0.35)",
                    borderRadius: 4,
                  }}>
                    <div style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, lineHeight: 1.5 }}>
                      <InlineProvenance text={a.signal} locale={locale} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                      <strong style={{ fontWeight: 600 }}>{locale === "de" ? "Widerspricht: " : "Contradicts: "}</strong>
                      <InlineProvenance text={a.contradicts} locale={locale} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, fontStyle: "italic" }}>
                      <InlineProvenance text={a.interpretation} locale={locale} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/*
            Data Quality badge (v0.2 Notion spec)
            -------------------------------------
            Tiny metadata line showing how wide and fresh the signal
            coverage was for this answer. Helps users quickly gauge
            whether the analysis rests on a recent signal base or is
            mostly LLM knowledge. Rendered inline, not as a Section Card
            — the goal is "glance, don't read".
          */}
          {(b as any).dataQuality && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                fontSize: 11,
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                background: "rgba(0, 0, 0, 0.02)",
                borderRadius: 4,
                border: "1px solid var(--color-border, #E5E5E5)",
              }}
            >
              <span style={{ fontWeight: 700, textTransform: "uppercase" }}>
                {locale === "de" ? "Datenlage" : "Data quality"}
              </span>
              {typeof (b as any).dataQuality.signalCount === "number" && (
                <span>
                  {(b as any).dataQuality.signalCount}{" "}
                  {locale === "de" ? "Signale" : "signals"}
                </span>
              )}
              {(b as any).dataQuality.newestSignalAge && (
                <span>
                  {locale === "de" ? "neuestes: " : "newest: "}
                  {(b as any).dataQuality.newestSignalAge}
                </span>
              )}
              {(b as any).dataQuality.dominantSourceType && (
                <span>
                  {locale === "de" ? "Basis: " : "basis: "}
                  {(b as any).dataQuality.dominantSourceType}
                </span>
              )}
              {((b as any).dataQuality.coverageGaps?.length ?? 0) > 0 && (
                <span title={(b as any).dataQuality.coverageGaps.join("\n")}>
                  {(b as any).dataQuality.coverageGaps.length}{" "}
                  {locale === "de" ? "Lücken" : "gaps"}
                </span>
              )}
            </div>
          )}

          {/* Eigener Gedanke */}
          {!isHelp && briefing.synthesis && (
            <EigenerGedanke
              locale={locale}
              context={{
                query: entry.query,
                synthesis: briefing.synthesis,
                scenarios: b.scenarios,
                causalChain: briefing.causalChain,
              }}
              onSubmit={(thought) => onFollowUp?.(thought)}
            />
          )}

        </div>
      )}
    </article>
  );
}
