"use client";

import Image from "next/image";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { FRAMEWORK_META, FrameworkMeta } from "@/types/frameworks";

export default function FrameworksPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <AppHeader />

      {/* Hero */}
      <div style={{
        background: "var(--muted)",
        borderBottom: "1px solid var(--border)",
        padding: "40px 24px 36px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 12,
          }}>
            Strategic Intelligence System
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
            color: "var(--foreground)", margin: 0, lineHeight: 1.2,
          }}>
            {de ? "Analyse-Frameworks" : "Analysis Frameworks"}
          </h1>
          <p style={{
            fontSize: 14, lineHeight: 1.7, color: "var(--muted-foreground)",
            marginTop: 10, maxWidth: 520, margin: "10px auto 0",
          }}>
            {de
              ? "Sechs spezialisierte Denk- und Analysemodi — mit eigenem Erkenntnisziel, eigenen Datenquellen und Visualisierungen."
              : "Six specialized analysis modes — each with its own purpose, data sources, and visualizations."
            }
          </p>
        </div>
      </div>

      {/* Framework Grid */}
      <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", padding: "32px 24px 60px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {FRAMEWORK_META.map(fw => (
            <FrameworkCard key={fw.id} fw={fw} de={de} />
          ))}
        </div>

        {/* Shared Infrastructure Note */}
        <div style={{
          marginTop: 48, padding: "24px 28px",
          border: "1px solid var(--border)",
          borderRadius: 14, background: "var(--card)",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 10,
          }}>
            {de ? "Gemeinsame Infrastruktur" : "Shared Infrastructure"}
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 8,
          }}>
            {[
              { icon: "⇄", label: de ? "Kausal-Graph" : "Causal Graph", desc: de ? "Jedes Framework liest & erweitert Kausalketten" : "Every framework reads & extends causal chains" },
              { icon: "⚡", label: de ? "Signal-Pipeline" : "Signal Pipeline", desc: de ? "Alle Live-Connectors für alle Frameworks" : "All live connectors for all frameworks" },
              { icon: "◎", label: "STEEP+V", desc: de ? "Einheitliche Kategorisierung" : "Unified categorization" },
              { icon: "≡", label: de ? "3-Szenarien-Modell" : "3-Scenario Model", desc: de ? "Optimistisch / Wahrscheinlich / Pessimistisch" : "Optimistic / Probable / Pessimistic" },
              { icon: "▸", label: "Intelligence Terminal", desc: de ? "Natürlichsprachliche Abfragen" : "Natural language queries" },
              { icon: "◻", label: de ? "Rollen-Kontext" : "Role Context", desc: de ? "Outputs je Nutzerrolle adaptiert" : "Outputs adapted by user role" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{
                  fontSize: 14, width: 28, height: 28, borderRadius: 6,
                  background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FrameworkCard({ fw, de }: { fw: FrameworkMeta; de: boolean }) {
  const name = de ? fw.name.de : fw.name.en;
  const subtitle = de ? fw.subtitle.de : fw.subtitle.en;
  const timeHorizon = de ? fw.timeHorizon.de : fw.timeHorizon.en;
  const intensityLabels = { low: "Low", medium: "Medium", high: "High", "very-high": "Sehr hoch" };

  return (
    <a
      href={`/frameworks/${fw.slug}`}
      style={{
        display: "block", textDecoration: "none",
        border: `1px solid ${fw.color.border}`,
        borderRadius: 14, background: fw.color.card,
        padding: "20px 22px",
        transition: "all 0.2s",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-2px)";
        el.style.borderColor = fw.color.accent;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.borderColor = fw.color.border;
      }}
    >
      {/* Icon + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 10,
          background: fw.color.icon,
          border: `1px solid ${fw.color.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Image src={fw.iconSvg} alt="" width={20} height={20} style={{ opacity: 0.8 }} />
        </span>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700,
            letterSpacing: "-0.01em", color: "var(--foreground)", lineHeight: 1.2,
          }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{
        display: "flex", gap: 12, marginTop: 12,
        fontSize: 10, fontFamily: "var(--font-mono)",
        color: "var(--muted-foreground)",
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        <span>{timeHorizon}</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span>LLM: {intensityLabels[fw.llmIntensity]}</span>
      </div>

      {/* Arrow */}
      <div style={{
        marginTop: 14, fontSize: 12, fontWeight: 600,
        color: fw.color.accent,
        fontFamily: "var(--font-ui)",
      }}>
        {de ? "Framework öffnen" : "Open framework"} →
      </div>
    </a>
  );
}
