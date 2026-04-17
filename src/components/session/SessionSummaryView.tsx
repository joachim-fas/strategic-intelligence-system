"use client";

/**
 * SessionSummaryView — linear read of every briefing in a project.
 *
 * History: this view used to render an LLM-generated meta-synthesis
 * (red thread, cross-query patterns, tensions). User feedback on
 * 2026-04 was clear — they wanted the raw reading, not another layer
 * of interpretation: "Eigentlich sollten nur alle Ergebnisse der
 * jeweiligen Projekte/Analysen linear auf einer Seite lesbar sein."
 *
 * Current behaviour: fetch every query attached to this project
 * (canvas nodes + project_queries rows, deduped + chronologically
 * ordered) and render each briefing as a clean stacked section —
 * question, synthesis, key insights, scenarios, decision framework,
 * follow-ups, references. Print-friendly for Cmd+P. Download as
 * Markdown preserved from the previous version.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { VoltInfoBlock } from "@/components/verstehen/VoltPrimitives";
import {
  ArrowLeft,
  Download,
  Printer,
  HelpCircle,
  Target,
  Compass,
  Layers,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  FileText,
  CircleDot,
} from "lucide-react";

// ── Wire shape from GET /api/v1/canvas/[id]/summary ────────────────────────

interface RegulatoryItem {
  title?: string;
  description?: string;
  framework?: string;
}

interface Reference {
  title?: string;
  url?: string;
  source?: string;
}

interface Scenario {
  name: string;
  description: string;
  probability?: number;
}

interface Briefing {
  query: string;
  synthesis: string;
  keyInsights: string[];
  scenarios: Scenario[];
  interpretation?: string;
  decisionFramework?: string;
  regulatoryContext: Array<string | RegulatoryItem>;
  references: Reference[];
  followUpQuestions: string[];
  confidence?: number;
  createdAt?: string;
  source?: "canvas" | "project";
}

interface SessionSummaryViewProps {
  projectId: string;
}

// ── Presentation ────────────────────────────────────────────────────────────

export default function SessionSummaryView({ projectId }: SessionSummaryViewProps) {
  const { locale } = useLocale();
  const de = locale === "de";

  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [canvasRes, summaryRes] = await Promise.all([
          fetchWithTimeout(`/api/v1/canvas/${projectId}`),
          fetchWithTimeout(`/api/v1/canvas/${projectId}/summary`),
        ]);
        if (cancelled) return;
        if (canvasRes.ok) {
          const json = await canvasRes.json();
          setProjectName((json.data ?? json).canvas?.name || "");
        }
        if (!summaryRes.ok) {
          setError(de ? "Projekt nicht gefunden." : "Project not found.");
          setLoading(false);
          return;
        }
        const sj = await summaryRes.json();
        const bs = Array.isArray(sj.briefings) ? (sj.briefings as Briefing[]) : [];
        setBriefings(bs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, de]);

  const exportMarkdown = useCallback(() => {
    const lines: string[] = [];
    lines.push(`# ${projectName || (de ? "Projekt" : "Project")}`);
    lines.push("");
    lines.push(`> ${briefings.length} ${de ? "Analysen" : "analyses"} · ${new Date().toLocaleString(de ? "de-DE" : "en-US")}`);
    lines.push("");
    briefings.forEach((b, i) => {
      lines.push(`## ${String(i + 1).padStart(2, "0")}. ${b.query}`);
      if (b.createdAt) {
        lines.push(`_${new Date(b.createdAt).toLocaleString(de ? "de-DE" : "en-US")}_`);
      }
      lines.push("");
      if (b.synthesis) {
        lines.push(`### ${de ? "Synthese" : "Synthesis"}`);
        lines.push("");
        lines.push(b.synthesis);
        lines.push("");
      }
      if (b.keyInsights.length > 0) {
        lines.push(`### ${de ? "Erkenntnisse" : "Key Insights"}`);
        lines.push("");
        b.keyInsights.forEach((k) => lines.push(`- ${k}`));
        lines.push("");
      }
      if (b.scenarios.length > 0) {
        lines.push(`### ${de ? "Szenarien" : "Scenarios"}`);
        lines.push("");
        b.scenarios.forEach((s) => {
          const pct = s.probability != null ? ` (${Math.round(s.probability * 100)}%)` : "";
          lines.push(`**${s.name}${pct}** — ${s.description}`);
          lines.push("");
        });
      }
      if (b.interpretation) {
        lines.push(`### ${de ? "Interpretation" : "Interpretation"}`);
        lines.push("");
        lines.push(b.interpretation);
        lines.push("");
      }
      if (b.decisionFramework) {
        lines.push(`### ${de ? "Entscheidungsrahmen" : "Decision Framework"}`);
        lines.push("");
        lines.push(b.decisionFramework);
        lines.push("");
      }
      if (b.regulatoryContext.length > 0) {
        lines.push(`### ${de ? "Regulatorischer Kontext" : "Regulatory Context"}`);
        lines.push("");
        b.regulatoryContext.forEach((r) => {
          if (typeof r === "string") lines.push(`- ${r}`);
          else lines.push(`- **${r.title ?? r.framework ?? "—"}** — ${r.description ?? ""}`);
        });
        lines.push("");
      }
      if (b.followUpQuestions.length > 0) {
        lines.push(`### ${de ? "Folgefragen" : "Follow-up Questions"}`);
        lines.push("");
        b.followUpQuestions.forEach((q) => lines.push(`- ${q}`));
        lines.push("");
      }
      if (b.references.length > 0) {
        lines.push(`### ${de ? "Quellen" : "References"}`);
        lines.push("");
        b.references.forEach((r) => {
          if (r.url) lines.push(`- [${r.title ?? r.url}](${r.url})${r.source ? ` — _${r.source}_` : ""}`);
          else if (r.title) lines.push(`- ${r.title}${r.source ? ` — _${r.source}_` : ""}`);
        });
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    });
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (projectName || "project").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
    a.href = url;
    a.download = `${safeName}-zusammenfassung.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [briefings, projectName, de]);

  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {briefings.length > 0 && (
        <>
          <button
            onClick={() => window.print()}
            title={de ? "Drucken (Cmd+P)" : "Print (Cmd+P)"}
            style={headerBtnStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,255,151,0.5)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Printer size={13} strokeWidth={2} />
            <span>{de ? "Drucken" : "Print"}</span>
          </button>
          <button
            onClick={exportMarkdown}
            title={de ? "Als Markdown exportieren" : "Export as Markdown"}
            style={headerBtnStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,255,151,0.5)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Download size={13} strokeWidth={2} />
            <span>.md</span>
          </button>
        </>
      )}
      <Link
        href={`/canvas?project=${projectId}`}
        style={{ ...headerBtnStyle, textDecoration: "none" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,255,151,0.5)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <ArrowLeft size={13} strokeWidth={2} />
        <span>Canvas</span>
      </Link>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <AppHeader />

      {/* Print-only overrides: hide the chrome so Cmd+P produces a clean doc. */}
      <style>{`
        @media print {
          header, .sis-nav, .no-print { display: none !important; }
          body { background: white !important; background-image: none !important; }
          @page { margin: 2cm; }
          .sis-briefing-section { break-inside: avoid; }
        }
      `}</style>

      <main style={{ maxWidth: 860, margin: "0 auto", width: "100%", padding: "32px 24px 96px" }}>
        {/* ─── Hero ─── */}
        <div style={{ marginBottom: 28 }} className="no-print-actions">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--color-text-muted, #6B6B6B)",
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                marginBottom: 8,
              }}>
                <FileText size={11} strokeWidth={2} />
                {de ? "Zusammenfassung" : "Summary"}
              </div>
              <h1 style={{
                margin: 0,
                fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
                color: "var(--color-text-heading, #0A0A0A)",
                lineHeight: 1.15,
              }}>
                {projectName || (de ? "Projekt" : "Project")}
              </h1>
              <p style={{
                margin: "6px 0 0", fontSize: 13,
                color: "var(--color-text-muted)",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              }}>
                {loading
                  ? (de ? "Lade Analysen …" : "Loading analyses…")
                  : briefings.length === 0
                    ? (de ? "Keine Analysen in diesem Projekt." : "No analyses in this project yet.")
                    : (de
                        ? `${briefings.length} ${briefings.length === 1 ? "Analyse" : "Analysen"} · chronologisch`
                        : `${briefings.length} ${briefings.length === 1 ? "analysis" : "analyses"} · chronological`)}
              </p>
            </div>
            {headerActions}
          </div>
        </div>

        {/* ─── Error state ─── */}
        {error && !loading && (
          <VoltInfoBlock variant="error" label={de ? "Fehler" : "Error"}>
            {error}
          </VoltInfoBlock>
        )}

        {/* ─── Empty state ─── */}
        {!loading && !error && briefings.length === 0 && (
          <VoltInfoBlock variant="info" label={de ? "Noch keine Analysen" : "No analyses yet"}>
            {de
              ? "In diesem Projekt ist noch keine Analyse gespeichert. Starte eine Abfrage auf der Startseite oder im Node-Canvas — sobald ein Briefing erstellt wird, erscheint es hier."
              : "No analyses saved to this project yet. Run a query on the home page or in the node canvas — as soon as a briefing lands, it shows up here."}
          </VoltInfoBlock>
        )}

        {/* ─── Linear briefing stack ─── */}
        {!loading && briefings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {briefings.map((b, i) => (
              <BriefingSection key={i} briefing={b} index={i} de={de} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Briefing section ───────────────────────────────────────────────────────

function BriefingSection({ briefing, index, de }: { briefing: Briefing; index: number; de: boolean }) {
  const b = briefing;
  const confPct = b.confidence != null ? Math.round(b.confidence * 100) : null;

  return (
    <section
      className="sis-briefing-section"
      style={{
        border: "1px solid var(--color-border, #E8E8E8)",
        borderRadius: 12,
        padding: "24px 28px",
        background: "var(--volt-surface-raised, #FFFFFF)",
      }}
    >
      {/* Question + meta */}
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 16, marginBottom: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--color-text-muted)",
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        }}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{de ? "Abfrage" : "Query"}</span>
          {confPct != null && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "1px 6px", borderRadius: 3,
                background: "#E4FF97", color: "#0A0A0A",
              }}>
                {confPct}% {de ? "Konfidenz" : "Confidence"}
              </span>
            </>
          )}
          {b.createdAt && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{new Date(b.createdAt).toLocaleDateString(de ? "de-DE" : "en-US", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </>
          )}
        </div>
        <h2 style={{
          margin: 0,
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em",
          color: "var(--color-text-heading, #0A0A0A)",
          lineHeight: 1.25,
        }}>
          {b.query}
        </h2>
      </header>

      {/* Synthesis */}
      {b.synthesis && (
        <Block icon={<Target size={13} strokeWidth={2.25} />} label={de ? "Synthese" : "Synthesis"}>
          <p style={bodyTextStyle}>{b.synthesis}</p>
        </Block>
      )}

      {/* Key Insights */}
      {b.keyInsights.length > 0 && (
        <Block icon={<Compass size={13} strokeWidth={2.25} />} label={de ? "Erkenntnisse" : "Key Insights"}>
          <ul style={bulletListStyle}>
            {b.keyInsights.map((k, i) => (
              <li key={i} style={bulletItemStyle}>{k}</li>
            ))}
          </ul>
        </Block>
      )}

      {/* Scenarios */}
      {b.scenarios.length > 0 && (
        <Block icon={<Layers size={13} strokeWidth={2.25} />} label={de ? "Szenarien" : "Scenarios"}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {b.scenarios.map((s, i) => (
              <div key={i} style={{
                padding: "12px 14px", borderRadius: 10,
                border: "1px solid var(--color-border)",
                background: "var(--volt-surface, #FAFAFA)",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: "var(--color-text-heading)",
                    fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                  }}>{s.name || (de ? "Szenario" : "Scenario")}</span>
                  {s.probability != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    }}>
                      {Math.round(s.probability * 100)}%
                    </span>
                  )}
                </div>
                {s.description && (
                  <p style={{ ...bodyTextStyle, margin: 0, fontSize: 12.5 }}>{s.description}</p>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* Interpretation */}
      {b.interpretation && (
        <Block icon={<HelpCircle size={13} strokeWidth={2.25} />} label={de ? "Interpretation" : "Interpretation"}>
          <p style={bodyTextStyle}>{b.interpretation}</p>
        </Block>
      )}

      {/* Decision Framework */}
      {b.decisionFramework && (
        <Block icon={<CircleDot size={13} strokeWidth={2.25} />} label={de ? "Entscheidungsrahmen" : "Decision Framework"}>
          <p style={bodyTextStyle}>{b.decisionFramework}</p>
        </Block>
      )}

      {/* Regulatory Context */}
      {b.regulatoryContext.length > 0 && (
        <Block icon={<AlertTriangle size={13} strokeWidth={2.25} />} label={de ? "Regulatorischer Kontext" : "Regulatory Context"}>
          <ul style={bulletListStyle}>
            {b.regulatoryContext.map((r, i) => {
              if (typeof r === "string") return <li key={i} style={bulletItemStyle}>{r}</li>;
              return (
                <li key={i} style={bulletItemStyle}>
                  <strong style={{ color: "var(--color-text-heading)" }}>
                    {r.title ?? r.framework ?? "—"}
                  </strong>
                  {r.description ? ` — ${r.description}` : ""}
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      {/* Follow-up Questions */}
      {b.followUpQuestions.length > 0 && (
        <Block icon={<HelpCircle size={13} strokeWidth={2.25} />} label={de ? "Folgefragen" : "Follow-up Questions"}>
          <ul style={bulletListStyle}>
            {b.followUpQuestions.map((q, i) => (
              <li key={i} style={bulletItemStyle}>{q}</li>
            ))}
          </ul>
        </Block>
      )}

      {/* References */}
      {b.references.length > 0 && (
        <Block icon={<BookOpen size={13} strokeWidth={2.25} />} label={de ? "Quellen" : "References"}>
          <ul style={{ ...bulletListStyle, gap: 6 }}>
            {b.references.map((r, i) => (
              <li key={i} style={{ ...bulletItemStyle, display: "flex", alignItems: "baseline", gap: 6 }}>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--color-text-heading)",
                      textDecoration: "none",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    {r.title ?? r.url}
                  </a>
                ) : (
                  <span>{r.title ?? "—"}</span>
                )}
                {r.url && <ExternalLink size={10} strokeWidth={1.8} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />}
                {r.source && (
                  <em style={{ fontStyle: "normal", color: "var(--color-text-muted)", fontSize: 11 }}>
                    — {r.source}
                  </em>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </section>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────

function Block({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--color-text-muted, #6B6B6B)",
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        marginBottom: 8,
      }}>
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
  fontSize: 14,
  lineHeight: 1.65,
  color: "var(--color-text-primary, #1A1A1A)",
};

const bulletListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--color-text-primary, #1A1A1A)",
};

const bulletItemStyle: React.CSSProperties = {
  paddingLeft: 2,
};

const headerBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 11px", borderRadius: 8,
  border: "1px solid var(--color-border)", background: "transparent",
  fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)",
  cursor: "pointer", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
  transition: "all 0.12s",
};
