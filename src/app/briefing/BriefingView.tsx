"use client";

/**
 * BriefingView — the rendering layer for a single briefing.
 *
 * Extracted from the old `src/app/briefing/page.tsx` during Welle A
 * Item 3 (deep-linkable briefing URLs). Both the legacy query-param
 * route (`/briefing?id=N`) and the new slug-hash route
 * (`/briefing/{slug}-{hash}`) render this component with the same
 * `HistoryEntry` data — the URL lookup is the only thing that
 * differs between them.
 *
 * Print-optimised: Cmd+P exports as PDF with page margins defined
 * inline. All copy is bilingual through `locale-context.useLocale()`
 * — future migration to `useT()` is a separate i18n sweep.
 */

import { useLocale, useT } from "@/lib/locale-context";
import { connectors } from "@/connectors";
import { megaTrends } from "@/lib/mega-trends";
import { briefingUrl } from "@/lib/briefing-url";
import type { DEMO_BRIEFINGS } from "@/lib/demo-briefings";

type Entry = (typeof DEMO_BRIEFINGS)[number];

export function BriefingView({ entry, siblings }: {
  entry: Entry;
  /** Other briefings to list in the navigator at the bottom.
   *  If absent, the navigator is hidden. */
  siblings?: Entry[];
}) {
  const { locale } = useLocale();
  const { t } = useT();
  const de = locale === "de";

  const b = entry.briefing as any;
  const conf = b.confidence ? Math.round(b.confidence * 100) : 0;
  const date = new Date().toLocaleDateString(de ? "de-DE" : "en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto", padding: "48px 40px 80px",
      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      color: "var(--volt-text, #0A0A0A)", lineHeight: 1.7, fontSize: 14,
    }}>
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; background-image: none !important; }
          .no-print { display: none !important; }
          @page { margin: 2cm; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, paddingBottom: 16, borderBottom: "2px solid var(--volt-lime, #E4FF97)" }}>
        <div>
          <div style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--volt-text-faint, #999)", marginBottom: 4 }}>
            Strategic Intelligence System
          </div>
          <div style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 10, color: "var(--volt-text-faint, #BBB)" }}>
            Intelligence Briefing · {date}
          </div>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: 8,
          background: "var(--volt-lime, #E4FF97)", color: "var(--volt-text, #0A0A0A)",
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 11, fontWeight: 700,
        }}>
          {conf}% {t("briefingView.confidence")}
        </div>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
        fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
        margin: "0 0 8px", lineHeight: 1.15,
      }}>
        {entry.query}
      </h1>
      <p style={{ fontSize: 12, color: "var(--volt-text-faint, #999)", margin: "0 0 32px", fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", letterSpacing: "0.04em" }}>
        {/* Source + trend counts used to be hardcoded "50" / "39". With
             ~100 connectors and a growing trend registry those numbers
             were lying. Use the live registry so the sub-header is
             always honest. */}
        STEEP+V · {t("briefingView.euFocus")} · {connectors.length} {t("briefingView.subheaderSources")} · {megaTrends.length} {t("briefingView.subheaderTrends")}
      </p>

      {/* Synthesis */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--volt-text, #0A0A0A)" }}>
          {t("briefingView.synthesisHeading")}
        </h2>
        <div style={{ fontSize: 15, lineHeight: 1.75 }}>
          {b.synthesis}
        </div>
      </section>

      {/* Scenarios */}
      {b.scenarios?.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {t("briefingView.scenariosHeading")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: b.scenarios.length > 2 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
            {b.scenarios.map((s: any, i: number) => {
              const colors: Record<string, { bg: string; border: string; label: string }> = {
                optimistic: { bg: "var(--pastel-mint-light, #F0FDF6)", border: "var(--pastel-mint-border, #7DD4A8)", label: t("briefingView.scenarioOptimistic") },
                baseline: { bg: "var(--pastel-sky-light, #EFF6FF)", border: "var(--pastel-sky-border, #93C5FD)", label: t("briefingView.scenarioBaseline") },
                pessimistic: { bg: "var(--pastel-rose-light, #FEF2F2)", border: "var(--pastel-rose-border, #FCA5A5)", label: t("briefingView.scenarioPessimistic") },
              };
              const c = colors[s.type] ?? { bg: "var(--color-surface, #F9FAFB)", border: "var(--volt-border, #E5E7EB)", label: s.type };
              return (
                <div key={i} style={{
                  padding: "14px 16px", borderRadius: 10,
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--volt-text-muted, #666)" }}>
                      {c.label}
                    </span>
                    <span style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 18, fontWeight: 700 }}>
                      {Math.round(s.probability * 100)}%
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--volt-text-muted, #555)", lineHeight: 1.5 }}>
                    {s.description?.slice(0, 200)}{s.description?.length > 200 ? "..." : ""}
                  </div>
                  {s.timeframe && (
                    <div style={{ marginTop: 8, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 10, color: "var(--volt-text-faint, #999)" }}>
                      {s.timeframe}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Key Insights */}
      {b.keyInsights?.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {t("briefingView.keyInsightsHeading")}
          </h2>
          {b.keyInsights.map((insight: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--volt-lime, #E4FF97)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6 }}>{insight}</span>
            </div>
          ))}
        </section>
      )}

      {/* Causal chains */}
      {(b.causalChain?.length > 0 || b.causalAnalysis?.length > 0) && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {t("briefingView.causalHeading")}
          </h2>
          {(b.causalAnalysis ?? b.causalChain)?.map((chain: string, i: number) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12 }}>
              {chain}
            </div>
          ))}
        </section>
      )}

      {/* Decision Framework */}
      {b.decisionFramework && (
        <section style={{ marginBottom: 32, padding: "16px 20px", borderRadius: 10, background: "var(--pastel-butter-light, #FFF8F0)", border: "1px solid var(--pastel-butter-border, #F0D4A8)" }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--pastel-butter-text, #955A20)" }}>
            {t("briefingView.decisionFrameworkHeading")}
          </h2>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            {b.decisionFramework}
          </div>
        </section>
      )}

      {/* References */}
      {b.references?.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {t("briefingView.sourcesHeading")}
          </h2>
          {b.references.map((ref: any, i: number) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
              <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pastel-sky-text, #1A4A8A)", textDecoration: "none" }}>
                {ref.title} ↗
              </a>
              {ref.relevance && <span style={{ color: "var(--volt-text-faint, #999)", marginLeft: 8 }}>— {ref.relevance}</span>}
            </div>
          ))}
        </section>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid var(--volt-border, #E8E8E8)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--volt-text-faint, #BBB)" }}>
          Strategic Intelligence System · {date} · {t("briefingView.confidential")}
        </div>
        <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, color: "var(--volt-text-faint, #BBB)" }}>
          {conf}% {t("briefingView.confidence")} · STEEP+V · {t("briefingView.euFocus")}
        </div>
      </div>

      {/* Print + Navigation */}
      <div className="no-print" style={{ marginTop: 32, textAlign: "center" }}>
        <button
          onClick={() => window.print()}
          style={{
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 14, fontWeight: 600,
            padding: "10px 24px", borderRadius: 10,
            background: "var(--volt-text, #0A0A0A)", color: "var(--volt-surface, #fff)", border: "none", cursor: "pointer",
            marginBottom: 24,
          }}
        >
          {t("briefingView.exportPdfButton")}
        </button>

        {/* Other briefings.
             Links use the new slug-hash URLs (Welle A Item 3, Theia-pattern)
             — each briefing's URL is built from its own content so shared
             links are stable against id-reordering and content changes
             are detectable via hash mismatch. */}
        {siblings && siblings.length > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {siblings.map((d) => {
              const href = briefingUrl(d);
              const isActive = d.id === entry.id;
              return (
                <a
                  key={d.id}
                  href={href}
                  style={{
                    fontSize: 12, padding: "6px 14px", borderRadius: 8,
                    border: isActive ? "1.5px solid var(--volt-text, #0A0A0A)" : "1px solid var(--volt-border, #E8E8E8)",
                    background: isActive ? "var(--color-surface, #F7F7F7)" : "transparent",
                    color: isActive ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-faint, #999)",
                    textDecoration: "none", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  }}
                >
                  {d.query}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default BriefingView;
