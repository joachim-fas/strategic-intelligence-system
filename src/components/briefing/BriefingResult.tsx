"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { IntelligenceBriefing } from "@/lib/intelligence-engine";
import { TrendDot } from "@/types";
import { Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { VoltBadge, VoltButton } from "@/components/volt";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReasoningTrace } from "./ReasoningTrace";
import { SynthesisBlock } from "./SynthesisBlock";
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
}

// ── BriefingResult ────────────────────────────────────────────────────────────
export function BriefingResult({ entry, locale, trendCount, onTrendClick, activeProjectId, onFollowUp }: {
  entry: HistoryEntry;
  locale: Locale;
  trendCount: number;
  onTrendClick: (trend: TrendDot) => void;
  activeProjectId?: string | null;
  onFollowUp?: (query: string) => void;
}) {
  const { briefing } = entry;
  const isHelp = entry.query === "/help";
  const isLoading = entry.isLoading ?? false; // explicit boolean — not a string comparison
  const b = briefing as any; // Extended fields from LLM
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSignals, setShowSignals] = useState(true); // default OPEN for transparency

  const saveToProject = async () => {
    if (!activeProjectId || saving || saved) return;
    setSaving(true);
    try {
      const res = await fetchWithTimeout(`/api/v1/projects/${activeProjectId}/queries`, {
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
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
    } catch { /* ignore */ }
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
   *   briefing.causalChain → result.causalAnalysis
   * Shape-incompatible fields (matchedTrends uses {trend, ...} here vs.
   * the canvas's flat {id, name, ...}) are simply omitted — the canvas's
   * dimensions/causalgraph cards render conditionally on those arrays
   * and gracefully skip when absent.
   */
  const openInCanvas = () => {
    try {
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
      };
      localStorage.setItem(
        "sis-transfer-to-canvas",
        JSON.stringify({ query: entry.query, result }),
      );
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
      <div className="card-header">
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", color: "var(--volt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.query}
        </span>
        {isLoading && (
          <span style={{ fontSize: 12, color: "var(--volt-text-muted)", flexShrink: 0 }}>
            {locale === "de" ? "Analysiere…" : "Analyzing…"}
          </span>
        )}
        {activeProjectId && !isLoading && !isHelp && briefing.synthesis && (
          <Tooltip
            content={saved
              ? (locale === "de" ? "Im Projekt gespeichert" : "Saved to project")
              : (locale === "de" ? "Briefing im aktiven Projekt speichern" : "Save briefing to active project")}
            placement="bottom"
          >
            <Button
              variant="ghost" size="sm"
              onClick={saveToProject}
              disabled={saved || saving}
              className={cn("text-[12px] px-3 h-7 gap-1.5", saved ? "text-[#1A9E5A]" : "text-[#9B9B9B]")}
            >
              {saved ? (
                <>
                  <CheckIcon size={13} strokeWidth={2.5} />
                  {locale === "de" ? "Gespeichert" : "Saved"}
                </>
              ) : saving ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
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
              className="text-[12px] px-3 h-7 text-[#9B9B9B] hover:text-[#4A6CF7] gap-1.5"
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
        {briefing.confidence > 0 && !isLoading && (
          <Badge
            variant="outline"
            title={locale === "de"
              ? `Konfidenz ${(briefing.confidence * 100).toFixed(0)}% — basiert auf ${b.usedSignals?.length ?? 0} Live-Signalen und ${b.references?.length ?? 0} Quellen. Hohe Werte = breite, aktuelle Datenbasis.`
              : `Confidence ${(briefing.confidence * 100).toFixed(0)}% — based on ${b.usedSignals?.length ?? 0} live signals and ${b.references?.length ?? 0} sources. High values = broad, current data basis.`}
            className={cn(
              "text-[11px] cursor-help",
              briefing.confidence > 0.7 ? "bg-[var(--pastel-mint)] text-[var(--pastel-mint-text)] border-[var(--pastel-mint-border)]" :
              briefing.confidence > 0.4 ? "bg-[var(--pastel-butter)] text-[var(--pastel-butter-text)] border-[var(--pastel-butter-border)]" :
              "bg-[var(--signal-negative-light)] text-[var(--signal-negative-text)] border-[var(--signal-negative-border)]"
            )}
          >
            {(briefing.confidence * 100).toFixed(0)}%
          </Badge>
        )}
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
          <ReasoningTrace query={entry.query} trendCount={trendCount} locale={locale} />
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
          {!isHelp && (b.usedSignals?.length > 0 || b.references?.length > 0 || briefing.confidence > 0 || b.scenarios?.length > 0) && (
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
              {b.usedSignals?.length > 0 && (
                <VoltKpiCard
                  variant="light"
                  label={locale === "de" ? "Live-Signale" : "Live Signals"}
                  value={b.usedSignals.length}
                  subLabel={locale === "de" ? "Aus aktiven Connectors" : "From active connectors"}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {briefing.keyInsights.slice(0, 3).map((insight: string, i: number) => (
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
                      {insight}
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
              <CausalOrbit
                chains={briefing.causalChain}
                locale={locale}
                onNodeClick={(node) => onFollowUp?.(
                  locale === "de"
                    ? `Analysiere den Knoten "${node}" im Kontext von: ${entry.query}`
                    : `Analyze the node "${node}" in the context of: ${entry.query}`
                )}
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

          {/* ═══ LEVEL 3: CONTEXT INFOBLOCKS (InfoBlocks, side-by-side on wide screens) ═══ */}

          {(b.interpretation || b.newsContext || b.decisionFramework) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 12,
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

          {/* Suggested Tags */}
          {b.suggestedTags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {b.suggestedTags.map((tag: string, i: number) => (
                <button
                  key={i}
                  className="chip chip-neutral"
                  onClick={() => {
                    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (input) {
                      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                      setter?.call(input, tag);
                      input.dispatchEvent(new Event("input", { bubbles: true }));
                      input.focus();
                    }
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Sources — References */}
          {(!b.references || b.references.length === 0) && !isHelp && briefing.synthesis && (
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic", padding: "4px 0" }}>
              {locale === "de"
                ? "Keine externen Quellen zitiert — Antwort basiert auf strukturellem Trend-Wissen und Live-Signalen."
                : "No external sources cited — response is based on structural trend knowledge and live signals."}
            </div>
          )}
          {b.references?.length > 0 && (
            <VoltSectionCard
              icon={<BookOpen size={18} />}
              iconVariant="light"
              title={locale === "de" ? "Quellen" : "Sources"}
              subtitle={locale === "de"
                ? `${b.references.length} Referenzen — von KI vorgeschlagen, nicht redaktionell verifiziert`
                : `${b.references.length} references — AI-suggested, not editorially verified`}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.references.map((ref: { title: string; url: string; relevance?: string }, i: number) => (
                  <VoltReferencePill
                    key={i}
                    href={ref.url}
                    title={ref.title}
                    externalTitle={ref.relevance}
                  />
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

          {/* Live Signals as Activity-List inside Section Card */}
          {b.usedSignals?.length > 0 && (
            <VoltSectionCard
              icon={<Radio size={18} />}
              iconVariant="mint"
              title={locale === "de" ? "Live-Signale" : "Live Signals"}
              subtitle={locale === "de"
                ? `${b.usedSignals.length} aggregierte Signale`
                : `${b.usedSignals.length} aggregated signals`}
              action={
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
              }
            >
              {showSignals && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {b.usedSignals.map((s: { source: string; title: string; url: string | null; strength: number | null; date: string }, i: number) => {
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
                          borderBottom: i < b.usedSignals.length - 1 ? "1px solid var(--color-border)" : "none",
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
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--muted-foreground)",
                              marginTop: 3,
                            }}
                          >
                            {s.source}
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
                    {reg}
                  </div>
                ))}
                {briefing.keyInsights?.length > 3 && briefing.keyInsights.slice(3).map((insight: string, i: number) => (
                  <div key={`ki-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
                    <Sparkles size={12} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 3 }} />
                    <span style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55 }}>{insight}</span>
                  </div>
                ))}
              </div>
            </details>
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
