"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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

const MiniRadar = dynamic(() => import("@/components/radar/MiniRadar"), { ssr: false });
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
export function BriefingResult({ entry, locale, trendCount, onTrendClick, activeProjectId, onFollowUp, onOpenInCanvas }: {
  entry: HistoryEntry;
  locale: Locale;
  trendCount: number;
  onTrendClick: (trend: TrendDot) => void;
  activeProjectId?: string | null;
  onFollowUp?: (query: string) => void;
  onOpenInCanvas?: (entry: HistoryEntry) => void;
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
      const res = await fetch(`/api/v1/projects/${activeProjectId}/queries`, {
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

  return (
    <article className="card volt-texture" style={{ borderLeft: entry.parentQuery ? "3px solid var(--volt-sky, #7AB8F5)" : "3px solid var(--volt-lime, #E4FF97)" }}>

      {/* Thread indicator */}
      {entry.parentQuery && (
        <div style={{ padding: "6px 14px 0", display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--volt-orchid, #D98AE8)", fontFamily: "var(--volt-font-mono)" }}>
          <span style={{ fontSize: 12 }}>↳</span>
          <span style={{ fontWeight: 500 }}>{locale === "de" ? "Folgefrage zu" : "Follow-up to"}: </span>
          <span style={{ color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
            {entry.parentQuery}
          </span>
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
          <Button
            variant="ghost" size="sm"
            onClick={saveToProject}
            disabled={saved || saving}
            className={cn("text-[12px] px-3 h-7", saved ? "text-[#1A9E5A]" : "text-[#9B9B9B]")}
          >
            {saved ? "✓ Gespeichert" : saving ? "…" : "Speichern"}
          </Button>
        )}
        {!isLoading && !isHelp && briefing.synthesis && briefing.synthesis.length > 20 && (
          <BriefingExport entry={entry} locale={locale} />
        )}
        {!isLoading && !isHelp && briefing.synthesis && onOpenInCanvas && (
          <VoltButton variant="outline" size="sm" onClick={() => onOpenInCanvas(entry)}>
            ⊞ Canvas
          </VoltButton>
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
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--volt-negative-text)", marginBottom: 4 }}>
                {locale === "de" ? "Analyse fehlgeschlagen" : "Analysis failed"}
              </div>
              <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.5 }}>{entry.error}</div>
            </div>
            <button
              onClick={() => onFollowUp?.(entry.query)}
              style={{
                flexShrink: 0, fontSize: 12, fontWeight: 600, padding: "5px 12px",
                borderRadius: "var(--radius-sm)", border: "1px solid #EF4444",
                background: "white", color: "#DC2626", cursor: "pointer",
              }}
            >
              {locale === "de" ? "Wiederholen" : "Retry"} ↺
            </button>
          </div>
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────── */}
      {isLoading && (
        <div className="card-body">
          <ReasoningTrace query={entry.query} trendCount={trendCount} locale={locale} />
        </div>
      )}

      {/* ── Completed state ────────────────────────────────────── */}
      {!isLoading && (
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 1. Synthesis — truncated by default */}
          {briefing.synthesis && (
            <SynthesisBlock text={briefing.synthesis} locale={locale} isHelp={isHelp} />
          )}

          {/* 1b. Section preview chips */}
          {!isHelp && (b.scenarios?.length > 0 || briefing.causalChain?.length > 0 || b.balancedScorecard || briefing.keyInsights?.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {b.scenarios?.length > 0 && (
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 9999, background: "var(--volt-surface)", color: "var(--volt-text-muted)", fontWeight: 500 }}>
                  ◈ {b.scenarios.length} {locale === "de" ? "Szenarien" : "Scenarios"}
                </span>
              )}
              {briefing.causalChain?.length > 0 && (
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 9999, background: "var(--volt-surface)", color: "var(--volt-text-muted)", fontWeight: 500 }}>
                  ⬡ Kausalnetz
                </span>
              )}
              {b.balancedScorecard?.perspectives?.length > 0 && (
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 9999, background: "var(--volt-surface)", color: "var(--volt-text-muted)", fontWeight: 500 }}>
                  ◉ Scorecard
                </span>
              )}
              {briefing.keyInsights?.length > 0 && (
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 9999, background: "var(--volt-surface)", color: "var(--volt-text-muted)", fontWeight: 500 }}>
                  → {briefing.keyInsights.length} {locale === "de" ? "Erkenntnisse" : "Insights"}
                </span>
              )}
              {b.followUpQuestions?.length > 0 && (
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 9999, background: "var(--volt-surface)", color: "var(--volt-text-muted)", fontWeight: 500 }}>
                  ↺ {b.followUpQuestions.length} {locale === "de" ? "Folgefragen" : "Follow-ups"}
                </span>
              )}
            </div>
          )}

          {/* 1c. Transparency indicator — shows data sources used */}
          {!isHelp && !isLoading && (b.usedSignals?.length > 0 || b.references?.length > 0 || briefing.confidence > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(37,99,235,0.04)", borderRadius: 8, border: "1px solid rgba(37,99,235,0.1)" }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "#2563EB", textTransform: "uppercase" }}>
                {locale === "de" ? "Datengrundlage" : "Data Basis"}
              </span>
              {b.usedSignals?.length > 0 && (
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                  {b.usedSignals.length} {locale === "de" ? "Live-Signale" : "live signals"}
                </span>
              )}
              {b.references?.length > 0 && (
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                  {b.references.length} {locale === "de" ? "Quellen" : "sources"}
                </span>
              )}
              {briefing.confidence > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: briefing.confidence > 0.7 ? "var(--signal-positive)" : briefing.confidence > 0.4 ? "#F5A623" : "var(--signal-negative)" }}>
                  {Math.round(briefing.confidence * 100)}% {locale === "de" ? "Konfidenz" : "confidence"}
                </span>
              )}
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: "auto" }}>
                STEEP+V · EU-Fokus
              </span>
            </div>
          )}

          {/* 2. Scenarios */}
          {b.scenarios?.length > 0 && (
            <ScenarioSelector
              scenarios={b.scenarios}
              query={entry.query}
              locale={locale}
              onFollowUp={onFollowUp}
            />
          )}

          {/* 3. Causal Orbit */}
          {briefing.causalChain?.length > 0 && (
            <CausalOrbit
              chains={briefing.causalChain}
              locale={locale}
              onNodeClick={(node) => onFollowUp?.(
                locale === "de"
                  ? `Analysiere den Knoten "${node}" im Kontext von: ${entry.query}`
                  : `Analyze the node "${node}" in the context of: ${entry.query}`
              )}
            />
          )}

          {/* 4. Balanced Scorecard */}
          {b.balancedScorecard?.perspectives?.length > 0 && (
            <BalancedScorecard
              data={b.balancedScorecard}
              locale={locale}
              onRating={(perspectiveId, rating) => {
                const queryHash = btoa(entry.query.slice(0, 64) + entry.timestamp.toISOString().slice(0, 16))
                  .replace(/[^a-z0-9]/gi, "").slice(0, 32);
                fetch("/api/v1/bsc-ratings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ queryHash, perspectiveId, rating }),
                }).catch(() => {});
              }}
            />
          )}

          {/* 5. Key Insights (first 3) */}
          {briefing.keyInsights?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {briefing.keyInsights.slice(0, isHelp ? undefined : 3).map((insight: string, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    background: isHelp ? "#F7F7F7" : "#E4FF97",
                    fontSize: 10, fontWeight: 700, color: "#0A0A0A",
                  }}>{isHelp ? "·" : "→"}</span>
                  <span style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{insight}</span>
                </div>
              ))}
            </div>
          )}

          {/* 6. Strategic Interpretation */}
          {b.interpretation && (
            <div className="info-block info-block-brand">
              <div className="section-label" style={{ color: "var(--color-brand)", marginBottom: 6 }}>
                {locale === "de" ? "Strategische Interpretation" : "Strategic Interpretation"}
              </div>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>{b.interpretation}</p>
            </div>
          )}

          {/* 7. Mini Radar (≥3 matched trends) */}
          {briefing.matchedTrends.length > 2 && (
            <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", overflow: "hidden", background: "var(--color-page-bg)" }}>
              <MiniRadar
                trends={briefing.matchedTrends.map((m: any) => m.trend)}
                onTrendClick={onTrendClick}
                width={640} height={280}
              />
            </div>
          )}

          {/* Trend chips (≤2 matched trends) */}
          {briefing.matchedTrends.length > 0 && briefing.matchedTrends.length <= 2 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {briefing.matchedTrends.map((m: any) => (
                <button key={m.trend.id} onClick={() => onTrendClick(m.trend)} className="chip chip-brand">
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: m.trend.velocity === "rising" ? "var(--color-success)"
                      : m.trend.velocity === "falling" ? "var(--color-danger)"
                      : "var(--color-text-muted)",
                  }} />
                  {m.trend.name}
                </button>
              ))}
            </div>
          )}

          {/* 8. Suggested Tags (pre-fills input, does not submit) */}
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

          {/* 9. News Context */}
          {b.newsContext && (
            <div className="info-block info-block-warning">
              <div className="section-label" style={{ color: "var(--color-warning)", marginBottom: 6 }}>
                {locale === "de" ? "Aktueller Kontext" : "Current Context"}
              </div>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>{b.newsContext}</p>
            </div>
          )}

          {/* 10. Decision Framework */}
          {b.decisionFramework && (
            <div className="info-block info-block-success">
              <div className="section-label" style={{ color: "var(--color-success)", marginBottom: 6 }}>
                {locale === "de" ? "Entscheidungshilfe" : "Decision Framework"}
              </div>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>{b.decisionFramework}</p>
            </div>
          )}

          {/* 10b. References — always visible; fallback if none */}
          {(!b.references || b.references.length === 0) && !isHelp && briefing.synthesis && (
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic", padding: "4px 0" }}>
              {locale === "de"
                ? "Keine externen Quellen zitiert — Antwort basiert auf strukturellem Trend-Wissen und Live-Signalen."
                : "No external sources cited — response is based on structural trend knowledge and live signals."}
            </div>
          )}
          {b.references?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                {locale === "de" ? "Quellen" : "Sources"}
              </span>
              {b.references.map((ref: { title: string; url: string; relevance?: string }, i: number) => (
                <a
                  key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                  title={ref.relevance}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, color: "var(--color-brand)", textDecoration: "none",
                    padding: "2px 8px", borderRadius: "var(--radius-full)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    transition: "background 0.12s, border-color 0.12s",
                    whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--color-brand-light)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                  }}
                >
                  <span style={{ fontSize: 10 }}>↗</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ref.title}</span>
                </a>
              ))}
            </div>
          )}

          {/* 11. Follow-up Questions */}
          {b.followUpQuestions?.length > 0 && (
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>
                {locale === "de" ? "Weiterführende Fragen" : "Follow-up Questions"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {b.followUpQuestions.map((q: string, i: number) => (
                  <button key={i} onClick={() => onFollowUp?.(q)} className="chip chip-brand">
                    → {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 12. Expandable details (extra insights + regulation) */}
          {(briefing.regulatoryContext?.length > 0 || briefing.keyInsights?.length > 3) && (
            <details>
              <summary style={{
                fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer",
                listStyle: "none", display: "flex", alignItems: "center", gap: 6, userSelect: "none",
              }}>
                <span>▸</span>
                <span>{locale === "de" ? "Details" : "Details"}</span>
                {briefing.keyInsights?.length > 3 && <span>+{briefing.keyInsights.length - 3}</span>}
              </summary>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {briefing.keyInsights?.length > 3 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {briefing.keyInsights.slice(3).map((insight: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }}>→</span>
                        <span style={{ fontSize: 14, color: "var(--color-text-subtle)", lineHeight: 1.55 }}>{insight}</span>
                      </div>
                    ))}
                  </div>
                )}
                {briefing.regulatoryContext?.length > 0 && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 6 }}>
                      {locale === "de" ? "Regulierung" : "Regulation"}
                    </div>
                    {briefing.regulatoryContext.map((reg: string, i: number) => (
                      <div key={i} style={{ fontSize: 13, color: "var(--color-text-subtle)", marginBottom: 4 }}>⚖ {reg}</div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* 13. Live Signals */}
          {b.usedSignals?.length > 0 && (
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
              <button
                onClick={() => setShowSignals((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <span style={{ fontSize: 9, display: "inline-block", transform: showSignals ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
                <span>{locale === "de" ? "Live-Signale" : "Live signals"}</span>
                <Badge variant="secondary" className="text-[11px] h-5 px-2">{b.usedSignals.length}</Badge>
              </button>
              {showSignals && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16, borderLeft: "2px solid var(--color-border)" }}>
                  {b.usedSignals.map((s: { source: string; title: string; url: string | null; strength: number | null; date: string }, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--color-text-muted)", flexShrink: 0, width: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.source}
                      </span>
                      {s.url ? (
                        <a
                          href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--color-brand)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                        >
                          {s.title}
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--color-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {s.title}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 14. Eigener Gedanke */}
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
