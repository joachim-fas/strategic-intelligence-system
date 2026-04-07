"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DEMO_BRIEFINGS } from "@/lib/demo-briefings";

/**
 * /briefing — Print-optimized intelligence briefing
 *
 * Supports ?id=0, ?id=1, ?id=2 for different demo briefings.
 * Use Cmd+P to export as PDF.
 */
function BriefingContent() {
  const params = useSearchParams();
  const idx = parseInt(params.get("id") ?? "0", 10);
  const entry = DEMO_BRIEFINGS[Math.min(idx, DEMO_BRIEFINGS.length - 1)];
  if (!entry) return <div>Kein Briefing verfügbar</div>;

  const b = entry.briefing as any;
  const conf = b.confidence ? Math.round(b.confidence * 100) : 0;
  const date = new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });

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
          {conf}% Konfidenz
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
        STEEP+V · EU-Fokus · 50 Echtzeit-Quellen · 39 Trends
      </p>

      {/* Synthesis */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--volt-text, #0A0A0A)" }}>
          Synthese
        </h2>
        <div style={{ fontSize: 15, lineHeight: 1.75 }}>
          {b.synthesis}
        </div>
      </section>

      {/* Scenarios */}
      {b.scenarios?.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Szenarien
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: b.scenarios.length > 2 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
            {b.scenarios.map((s: any, i: number) => {
              const colors: Record<string, { bg: string; border: string; label: string }> = {
                optimistic: { bg: "#F0FDF6", border: "#7DD4A8", label: "Optimistisch" },
                baseline: { bg: "#EFF6FF", border: "#93C5FD", label: "Basisfall" },
                pessimistic: { bg: "#FEF2F2", border: "#FCA5A5", label: "Pessimistisch" },
              };
              const c = colors[s.type] ?? { bg: "#F9FAFB", border: "#E5E7EB", label: s.type };
              return (
                <div key={i} style={{
                  padding: "14px 16px", borderRadius: 10,
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666" }}>
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
            Erkenntnisse
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
            Kausale Zusammenhänge
          </h2>
          {(b.causalAnalysis ?? b.causalChain)?.map((chain: string, i: number) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid var(--volt-lime, #E4FF97)" }}>
              {chain}
            </div>
          ))}
        </section>
      )}

      {/* Decision Framework */}
      {b.decisionFramework && (
        <section style={{ marginBottom: 32, padding: "16px 20px", borderRadius: 10, background: "var(--pastel-butter-light, #FFF8F0)", border: "1px solid var(--pastel-butter-border, #F0D4A8)" }}>
          <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#955A20" }}>
            Entscheidungshilfe
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
            Quellen
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
          Strategic Intelligence System · {date} · Vertraulich
        </div>
        <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, color: "var(--volt-text-faint, #BBB)" }}>
          {conf}% Konfidenz · STEEP+V · EU-Fokus
        </div>
      </div>

      {/* Print + Navigation */}
      <div className="no-print" style={{ marginTop: 32, textAlign: "center" }}>
        <button
          onClick={() => window.print()}
          style={{
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", fontSize: 14, fontWeight: 600,
            padding: "10px 24px", borderRadius: 10,
            background: "var(--volt-text, #0A0A0A)", color: "#fff", border: "none", cursor: "pointer",
            marginBottom: 24,
          }}
        >
          Als PDF exportieren (Cmd+P)
        </button>

        {/* Other briefings */}
        {DEMO_BRIEFINGS.length > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {DEMO_BRIEFINGS.map((d, i) => (
              <a
                key={d.id}
                href={`/briefing?id=${i}`}
                style={{
                  fontSize: 12, padding: "6px 14px", borderRadius: 8,
                  border: i === idx ? "1.5px solid var(--volt-text, #0A0A0A)" : "1px solid var(--volt-border, #E8E8E8)",
                  background: i === idx ? "#F7F7F7" : "transparent",
                  color: i === idx ? "var(--volt-text, #0A0A0A)" : "#999",
                  textDecoration: "none", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                }}
              >
                {d.query}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BriefingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Lade Briefing...</div>}>
      <BriefingContent />
    </Suspense>
  );
}
