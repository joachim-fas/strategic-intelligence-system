"use client";

import { DEMO_BRIEFINGS } from "@/lib/demo-briefings";

/**
 * /briefing — Print-optimized intelligence briefing
 *
 * Renders the first demo briefing as a clean, printable page.
 * Use Cmd+P to export as PDF.
 */
export default function BriefingPage() {
  const entry = DEMO_BRIEFINGS[0];
  if (!entry) return <div>Kein Briefing verfügbar</div>;

  const b = entry.briefing as any;
  const conf = b.confidence ? Math.round(b.confidence * 100) : 0;
  const date = new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto", padding: "48px 40px 80px",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#0A0A0A", lineHeight: 1.7, fontSize: 14,
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, paddingBottom: 16, borderBottom: "2px solid #E4FF97" }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#999", marginBottom: 4 }}>
            Strategic Intelligence System
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, color: "#BBB" }}>
            Intelligence Briefing · {date}
          </div>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: 8,
          background: "#E4FF97", color: "#0A0A0A",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
        }}>
          {conf}% Konfidenz
        </div>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
        margin: "0 0 8px", lineHeight: 1.15,
      }}>
        {entry.query}
      </h1>
      <p style={{ fontSize: 12, color: "#999", margin: "0 0 32px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
        STEEP+V · EU-Fokus · 50 Echtzeit-Quellen · 39 Trends
      </p>

      {/* Synthesis */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#0A0A0A" }}>
          Synthese
        </h2>
        <div style={{ fontSize: 15, lineHeight: 1.75 }}>
          {b.synthesis}
        </div>
      </section>

      {/* Scenarios */}
      {b.scenarios?.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
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
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666" }}>
                      {c.label}
                    </span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
                      {Math.round(s.probability * 100)}%
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                    {s.description?.slice(0, 200)}{s.description?.length > 200 ? "..." : ""}
                  </div>
                  {s.timeframe && (
                    <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#999" }}>
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
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Erkenntnisse
          </h2>
          {b.keyInsights.map((insight: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "#E4FF97", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
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
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Kausale Zusammenhänge
          </h2>
          {(b.causalAnalysis ?? b.causalChain)?.map((chain: string, i: number) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid #E4FF97" }}>
              {chain}
            </div>
          ))}
        </section>
      )}

      {/* Decision Framework */}
      {b.decisionFramework && (
        <section style={{ marginBottom: 32, padding: "16px 20px", borderRadius: 10, background: "#FFF8F0", border: "1px solid #F0D4A8" }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#955A20" }}>
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
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Quellen
          </h2>
          {b.references.map((ref: any, i: number) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
              <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1A4A8A", textDecoration: "none" }}>
                {ref.title} ↗
              </a>
              {ref.relevance && <span style={{ color: "#999", marginLeft: 8 }}>— {ref.relevance}</span>}
            </div>
          ))}
        </section>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #E8E8E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#BBB" }}>
          Strategic Intelligence System · {date} · Vertraulich
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#BBB" }}>
          {conf}% Konfidenz · STEEP+V · EU-Fokus
        </div>
      </div>

      {/* Print button */}
      <div className="no-print" style={{ marginTop: 32, textAlign: "center" }}>
        <button
          onClick={() => window.print()}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
            padding: "10px 24px", borderRadius: 10,
            background: "#0A0A0A", color: "#fff", border: "none", cursor: "pointer",
          }}
        >
          Als PDF exportieren (Cmd+P)
        </button>
      </div>
    </div>
  );
}
