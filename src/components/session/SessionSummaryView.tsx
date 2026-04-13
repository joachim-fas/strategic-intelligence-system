"use client";

/**
 * SessionSummaryView — The brilliant killer feature.
 *
 * Renders a LLM-generated meta-synthesis of all queries in a session:
 * - Real question behind the questions
 * - Red thread (implicit system)
 * - Cross-query patterns
 * - Tensions & contradictions
 * - Meta decision framework
 * - Open flanks (what the user DIDN'T ask)
 * - Honest critique of session quality
 *
 * Uses Volt UI primitives throughout for consistency.
 */

import React, { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import {
  VoltSectionCard,
  VoltIconBox,
  VoltKpiCard,
  VoltPageHeader,
  VoltSectionLabel,
  VoltInfoBlock,
} from "@/components/verstehen/VoltPrimitives";
import {
  Sparkles,
  Target,
  GitBranch,
  AlertTriangle,
  Compass,
  HelpCircle,
  MessageSquare,
  Gauge,
  RefreshCw,
  ArrowLeft,
  Layers,
  Download,
} from "lucide-react";

interface SummaryData {
  sessionTitle: string;
  realQuestion: string;
  redThread: string;
  crossQueryPatterns: Array<{ pattern: string; explanation: string; queryRefs: number[] }>;
  tensions: Array<{ tension: string; between: number[]; implication: string }>;
  metaDecisionFramework: Array<{ principle: string; rationale: string }>;
  openFlanks: Array<{ question: string; why: string }>;
  confidence: number;
  critique: string;
}

interface QueryPreview {
  index: number;
  query: string;
}

interface SessionSummaryViewProps {
  projectId: string;
}

export default function SessionSummaryView({ projectId }: SessionSummaryViewProps) {
  const { locale } = useLocale();
  const de = locale === "de";

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [queryCount, setQueryCount] = useState(0);
  const [queries, setQueries] = useState<QueryPreview[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [loadingState, setLoadingState] = useState<"init" | "loading" | "generating" | "ready" | "error">("init");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [streamingText, setStreamingText] = useState<string>("");

  // Load initial state: cached summary + canvas metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingState("loading");
      try {
        // Load canvas name
        const canvasRes = await fetch(`/api/v1/canvas/${projectId}`);
        if (canvasRes.ok) {
          const json = await canvasRes.json();
          const canvasData = (json.data ?? json);
          if (!cancelled) setProjectName(canvasData.canvas?.name || "");
          // Extract queries from canvas state for reference display
          try {
            const state = canvasData.canvas?.canvas_state ? JSON.parse(canvasData.canvas.canvas_state) : null;
            const qs: QueryPreview[] = [];
            if (state?.nodes) {
              const queryNodes = state.nodes
                .filter((n: any) => n.nodeType === "query" && n.query)
                .sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
              queryNodes.forEach((n: any, i: number) => qs.push({ index: i, query: n.query }));
            }
            if (!cancelled) setQueries(qs);
          } catch {}
        }

        // Load cached summary
        const summaryRes = await fetch(`/api/v1/canvas/${projectId}/summary`);
        if (!summaryRes.ok) {
          if (!cancelled) {
            setError(de ? "Projekt nicht gefunden" : "Project not found");
            setLoadingState("error");
          }
          return;
        }
        const json = await summaryRes.json();
        if (cancelled) return;
        setQueryCount(json.queryCount || 0);
        if (json.summary) {
          setSummary(json.summary);
          setLoadingState("ready");
        } else {
          setLoadingState("init");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load");
          setLoadingState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, de]);

  // Navigate to home and load this query as the active node.
  // The home page reads ?node= and matches against localStorage history.
  const navigateToQuery = useCallback((queryText: string) => {
    const encoded = encodeURIComponent(queryText);
    window.location.href = `/?node=${encoded}`;
  }, []);

  // Export the meta-synthesis as Markdown
  const exportMarkdown = useCallback(() => {
    if (!summary) return;
    const lines: string[] = [];
    lines.push(`# ${summary.sessionTitle || projectName || "Session"}`);
    lines.push("");
    lines.push(`> Meta-Synthese · ${queryCount} ${de ? "Analysen" : "Analyses"} · ${Math.round((summary.confidence || 0.7) * 100)}% ${de ? "Konfidenz" : "Confidence"}`);
    lines.push("");
    if (summary.realQuestion) {
      lines.push(`## ${de ? "Die eigentliche Frage" : "The Real Question"}`);
      lines.push("");
      lines.push(`**${summary.realQuestion}**`);
      lines.push("");
    }
    if (summary.redThread) {
      lines.push(`## ${de ? "Roter Faden" : "Red Thread"}`);
      lines.push("");
      lines.push(summary.redThread);
      lines.push("");
    }
    if (summary.crossQueryPatterns?.length) {
      lines.push(`## ${de ? "Cross-Query Muster" : "Cross-Query Patterns"}`);
      lines.push("");
      summary.crossQueryPatterns.forEach((p, i) => {
        lines.push(`### ${String(i + 1).padStart(2, "0")}. ${p.pattern}`);
        lines.push("");
        lines.push(p.explanation);
        if (p.queryRefs?.length) {
          lines.push("");
          const refStr = p.queryRefs.map(r => {
            const q = queries[r];
            return q ? `Q${String(r + 1).padStart(2, "0")} (${q.query})` : `Q${String(r + 1).padStart(2, "0")}`;
          }).join(", ");
          lines.push(`*${de ? "Verweist auf" : "References"}: ${refStr}*`);
        }
        lines.push("");
      });
    }
    if (summary.tensions?.length) {
      lines.push(`## ${de ? "Spannungen & Widersprüche" : "Tensions & Contradictions"}`);
      lines.push("");
      summary.tensions.forEach((t) => {
        lines.push(`### ⚡ ${t.tension}`);
        lines.push("");
        if (t.implication) lines.push(t.implication);
        if (t.between?.length) {
          lines.push("");
          const refStr = t.between.map(r => `Q${String(r + 1).padStart(2, "0")}`).join(" ↔ ");
          lines.push(`*${de ? "Zwischen" : "Between"}: ${refStr}*`);
        }
        lines.push("");
      });
    }
    if (summary.metaDecisionFramework?.length) {
      lines.push(`## ${de ? "Meta-Entscheidungsrahmen" : "Meta Decision Framework"}`);
      lines.push("");
      summary.metaDecisionFramework.forEach((d, i) => {
        lines.push(`### ${String(i + 1).padStart(2, "0")}. ${d.principle}`);
        lines.push("");
        lines.push(d.rationale);
        lines.push("");
      });
    }
    if (summary.openFlanks?.length) {
      lines.push(`## ${de ? "Offene Flanken" : "Open Flanks"}`);
      lines.push("");
      summary.openFlanks.forEach((f) => {
        lines.push(`### → ${f.question}`);
        lines.push("");
        lines.push(f.why);
        lines.push("");
      });
    }
    if (summary.critique) {
      lines.push(`## ${de ? "Ehrliche Einschätzung" : "Honest Assessment"}`);
      lines.push("");
      lines.push(`> ${summary.critique}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
    lines.push(`*${de ? "Generiert von" : "Generated by"} Strategic Intelligence System · ${new Date().toLocaleString(de ? "de-DE" : "en-US")}*`);

    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (summary.sessionTitle || projectName || "session").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
    a.href = url;
    a.download = `${safeName}-meta-synthese.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [summary, projectName, queryCount, queries, de]);

  const generate = useCallback(async () => {
    setLoadingState("generating");
    setStreamingText("");
    setStatus("");
    setError("");
    try {
      const res = await fetch(`/api/v1/canvas/${projectId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const err = await res.text();
        setError(err);
        setLoadingState("error");
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";
      let streamedText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n\n");
        lineBuffer = lines.pop() ?? "";
        for (const chunk of lines) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6).trim());
            if (event.type === "delta") {
              streamedText += event.text;
              setStreamingText(streamedText);
            } else if (event.type === "status") {
              setStatus(event.message);
            } else if (event.type === "complete") {
              setSummary(event.result);
              setQueryCount(event.queryCount || queryCount);
              setLoadingState("ready");
            } else if (event.type === "error") {
              setError(event.error);
              setLoadingState("error");
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
      setLoadingState("error");
    }
  }, [projectId, locale, queryCount]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <AppHeader />

      <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", padding: "32px 24px 60px" }}>
        {/* Page Header */}
        <VoltPageHeader
          icon={<Sparkles size={22} />}
          title={summary?.sessionTitle || projectName || (de ? "Zusammenfassung" : "Summary")}
          subtitle={de
            ? `Meta-Synthese aller Analysen in dieser Session — identifiziert den roten Faden, Muster, Widersprüche und offene Flanken.`
            : `Meta-synthesis of all analyses in this session — identifies the red thread, patterns, contradictions and open flanks.`
          }
          actions={
            <>
              {summary && (
                <button
                  onClick={exportMarkdown}
                  title={de ? "Als Markdown exportieren" : "Export as Markdown"}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 10,
                    border: "1px solid var(--color-border)", background: "transparent",
                    fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)",
                    cursor: "pointer", fontFamily: "var(--font-ui)",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--foreground)"; e.currentTarget.style.color = "var(--foreground)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
                >
                  <Download size={14} />
                  <span>{de ? "Export .md" : "Export .md"}</span>
                </button>
              )}
              <button
                onClick={() => { window.location.href = `/canvas`; }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 14px", borderRadius: 10,
                  border: "1px solid var(--color-border)", background: "transparent",
                  fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)",
                  cursor: "pointer", fontFamily: "var(--font-ui)",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--foreground)"; e.currentTarget.style.color = "var(--foreground)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
              >
                <Layers size={14} />
                <span>Node Canvas</span>
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 14px", borderRadius: 10,
                  border: "1px solid var(--color-border)", background: "transparent",
                  fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)",
                  cursor: "pointer", fontFamily: "var(--font-ui)",
                }}
              >
                <ArrowLeft size={14} />
                <span>{de ? "Zurück" : "Back"}</span>
              </button>
            </>
          }
        />

        {/* ─── State: Loading initial data ─── */}
        {loadingState === "loading" && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <div className="animate-pulse">{de ? "Session wird geladen…" : "Loading session…"}</div>
          </div>
        )}

        {/* ─── State: Error ─── */}
        {loadingState === "error" && (
          <VoltInfoBlock variant="error" label={de ? "Fehler" : "Error"}>
            {error || (de ? "Ein unbekannter Fehler ist aufgetreten." : "An unknown error occurred.")}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={generate}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--destructive)", background: "transparent",
                  color: "var(--destructive)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {de ? "Erneut versuchen" : "Try again"}
              </button>
            </div>
          </VoltInfoBlock>
        )}

        {/* ─── State: Init (no cached summary, waiting to generate) ─── */}
        {loadingState === "init" && (
          <div style={{ marginTop: 20 }}>
            {queryCount < 2 ? (
              <VoltInfoBlock variant="info" label={de ? "Noch zu wenig Daten" : "Not enough data"}>
                {de
                  ? `Diese Session enthält ${queryCount} Analyse${queryCount === 1 ? "" : "n"}. Eine Meta-Synthese benötigt mindestens 2 Queries, um Muster und Widersprüche erkennen zu können.`
                  : `This session contains ${queryCount} analys${queryCount === 1 ? "is" : "es"}. A meta-synthesis requires at least 2 queries to identify patterns and contradictions.`
                }
              </VoltInfoBlock>
            ) : (
              <div style={{
                padding: "40px 32px",
                borderRadius: 16,
                border: "1px solid var(--color-border)",
                background: "color-mix(in srgb, var(--volt-lime, #E4FF97) 12%, transparent)",
                textAlign: "center",
              }}>
                <div style={{ display: "inline-flex", marginBottom: 16 }}>
                  <VoltIconBox icon={<Sparkles size={22} />} variant="lime" size={52} rounded="full" />
                </div>
                <h2 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
                  color: "var(--foreground)",
                  margin: "0 0 8px",
                }}>
                  {de ? `Meta-Synthese für ${queryCount} Analysen` : `Meta-Synthesis for ${queryCount} Analyses`}
                </h2>
                <p style={{
                  fontSize: 14, lineHeight: 1.6, color: "var(--muted-foreground)",
                  maxWidth: 540, margin: "0 auto 20px",
                  fontFamily: "var(--font-ui)",
                }}>
                  {de
                    ? "Das System liest alle Analysen, identifiziert Cross-Query-Muster, deckt Widersprüche auf und zeigt dir, welche Fragen du nicht gestellt hast, aber hättest stellen müssen. Das dauert etwa 30 Sekunden."
                    : "The system reads all analyses, identifies cross-query patterns, uncovers contradictions, and shows you which questions you didn't ask but should have. Takes about 30 seconds."
                  }
                </p>
                <button
                  onClick={generate}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "12px 24px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--foreground, #0A0A0A)",
                    color: "var(--background, #fff)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 13, fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <Sparkles size={14} />
                  <span>{de ? "Meta-Synthese generieren" : "Generate Meta-Synthesis"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── State: Generating (streaming) ─── */}
        {loadingState === "generating" && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              padding: "32px",
              borderRadius: 16,
              border: "1px solid var(--color-border)",
              background: "var(--card)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <VoltIconBox icon={<Sparkles size={18} className="animate-pulse" />} variant="lime" size={40} rounded="full" />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>
                    {de ? "Analysiere Muster zwischen Queries…" : "Analyzing patterns between queries…"}
                  </div>
                  {status && (
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase" as const,
                      color: "var(--muted-foreground)", marginTop: 4,
                    }}>
                      ⚡ {status}
                    </div>
                  )}
                </div>
              </div>
              {streamingText && (
                <div style={{
                  fontSize: 11, lineHeight: 1.7,
                  color: "var(--muted-foreground)",
                  fontFamily: "var(--font-mono)",
                  maxHeight: 240, overflow: "auto",
                  whiteSpace: "pre-wrap",
                  padding: "12px 14px",
                  background: "var(--muted, #F7F7F7)",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                }}>
                  <span className="animate-pulse" style={{ marginRight: 6 }}>●</span>
                  {streamingText.slice(-500)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── State: Ready (summary loaded) ─── */}
        {loadingState === "ready" && summary && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>

            {/* KPI Hero Row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 10,
            }}>
              <VoltKpiCard
                variant="lime"
                label={de ? "Konfidenz" : "Confidence"}
                value={`${Math.round((summary.confidence || 0.7) * 100)}%`}
                subLabel={de ? "Meta-Synthese-Qualität" : "Meta-synthesis quality"}
                icon={<Gauge size={16} />}
              />
              <VoltKpiCard
                variant="light"
                label={de ? "Analysen" : "Analyses"}
                value={queryCount}
                subLabel={de ? "Queries synthetisiert" : "Queries synthesized"}
                icon={<MessageSquare size={16} />}
              />
              <VoltKpiCard
                variant="light"
                label={de ? "Muster" : "Patterns"}
                value={summary.crossQueryPatterns?.length || 0}
                subLabel={de ? "Cross-Query Beobachtungen" : "Cross-query observations"}
                icon={<GitBranch size={16} />}
              />
              <VoltKpiCard
                variant="dark"
                label={de ? "Offene Flanken" : "Open Flanks"}
                value={summary.openFlanks?.length || 0}
                subLabel={de ? "Fehlende kritische Fragen" : "Missing critical questions"}
                icon={<HelpCircle size={16} />}
              />
            </div>

            {/* Real Question — the sharpest cut */}
            {summary.realQuestion && (
              <div style={{
                padding: "28px 32px",
                borderRadius: 16,
                background: "color-mix(in srgb, var(--volt-lime, #E4FF97) 20%, transparent)",
                border: "1px solid color-mix(in srgb, var(--volt-lime, #E4FF97) 60%, transparent)",
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase" as const,
                  color: "#2A3A00", marginBottom: 10,
                }}>
                  {de ? "Die eigentliche Frage" : "The real question"}
                </div>
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22, fontWeight: 700,
                  letterSpacing: "-0.02em", lineHeight: 1.3,
                  color: "var(--foreground)",
                  margin: 0,
                }}>
                  {summary.realQuestion}
                </p>
              </div>
            )}

            {/* Red Thread */}
            {summary.redThread && (
              <VoltSectionCard
                icon={<Target size={18} />}
                iconVariant="lime"
                title={de ? "Roter Faden" : "Red Thread"}
                subtitle={de ? "Was die Queries zusammen erzählen" : "What the queries tell together"}
              >
                <p style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 15, lineHeight: 1.7,
                  color: "var(--foreground)",
                  margin: 0,
                }}>
                  {summary.redThread}
                </p>
              </VoltSectionCard>
            )}

            {/* Cross-Query Patterns */}
            {summary.crossQueryPatterns && summary.crossQueryPatterns.length > 0 && (
              <VoltSectionCard
                icon={<GitBranch size={18} />}
                iconVariant="blue"
                title={de ? "Cross-Query Muster" : "Cross-Query Patterns"}
                subtitle={de
                  ? `${summary.crossQueryPatterns.length} strukturelle Beobachtungen über mehrere Queries`
                  : `${summary.crossQueryPatterns.length} structural observations across multiple queries`
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {summary.crossQueryPatterns.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <VoltIconBox
                        icon={<span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{String(i + 1).padStart(2, "0")}</span>}
                        variant="blue"
                        size={30}
                        rounded="full"
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 15, fontWeight: 700,
                          color: "var(--foreground)",
                          marginBottom: 4,
                          letterSpacing: "-0.01em",
                        }}>
                          {p.pattern}
                        </div>
                        <p style={{
                          fontSize: 13, lineHeight: 1.6,
                          color: "var(--muted-foreground)",
                          margin: "0 0 8px",
                          fontFamily: "var(--font-ui)",
                        }}>
                          {p.explanation}
                        </p>
                        {p.queryRefs && p.queryRefs.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {p.queryRefs.map(ref => {
                              const q = queries[ref];
                              if (!q) return null;
                              return (
                                <button
                                  key={ref}
                                  onClick={() => navigateToQuery(q.query)}
                                  title={de ? `Zur Analyse springen: ${q.query}` : `Jump to analysis: ${q.query}`}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px", borderRadius: 9999,
                                    background: "var(--muted, #F7F7F7)",
                                    border: "1px solid var(--color-border)",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 9, fontWeight: 600,
                                    color: "var(--muted-foreground)",
                                    maxWidth: 200,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    cursor: "pointer",
                                    transition: "all 0.12s",
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = "var(--foreground)";
                                    e.currentTarget.style.color = "var(--foreground)";
                                    e.currentTarget.style.background = "var(--card, #fff)";
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = "var(--color-border)";
                                    e.currentTarget.style.color = "var(--muted-foreground)";
                                    e.currentTarget.style.background = "var(--muted, #F7F7F7)";
                                  }}
                                >
                                  <span style={{ opacity: 0.6 }}>Q{String(ref + 1).padStart(2, "0")}</span>
                                  <span>{q.query.length > 20 ? q.query.slice(0, 18) + "…" : q.query}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </VoltSectionCard>
            )}

            {/* Tensions */}
            {summary.tensions && summary.tensions.length > 0 && (
              <VoltSectionCard
                icon={<AlertTriangle size={18} />}
                iconVariant="rose"
                title={de ? "Spannungen & Widersprüche" : "Tensions & Contradictions"}
                subtitle={de
                  ? `${summary.tensions.length} Trade-offs aufgedeckt`
                  : `${summary.tensions.length} trade-offs uncovered`
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {summary.tensions.map((t, i) => (
                    <div key={i} style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "var(--pastel-rose, #FFD6E0)",
                      border: "1px solid #F4A090",
                    }}>
                      <div style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 14, fontWeight: 700,
                        color: "#A0244A",
                        marginBottom: 6,
                        letterSpacing: "-0.01em",
                      }}>
                        ⚡ {t.tension}
                      </div>
                      {t.implication && (
                        <p style={{
                          fontSize: 12, lineHeight: 1.6,
                          color: "#7A1A3A",
                          margin: "0 0 8px",
                          fontFamily: "var(--font-ui)",
                        }}>
                          {t.implication}
                        </p>
                      )}
                      {t.between && t.between.length > 0 && (
                        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 9,
                            color: "#A0244A", opacity: 0.7, fontWeight: 700,
                            letterSpacing: "0.06em", textTransform: "uppercase" as const,
                          }}>
                            {de ? "Zwischen" : "Between"}
                          </span>
                          {t.between.map(ref => {
                            const q = queries[ref];
                            return (
                              <button
                                key={ref}
                                onClick={() => q && navigateToQuery(q.query)}
                                disabled={!q}
                                title={q ? (de ? `Zur Analyse springen: ${q.query}` : `Jump to analysis: ${q.query}`) : ""}
                                style={{
                                  padding: "2px 7px", borderRadius: 9999,
                                  background: "rgba(160,36,74,0.12)",
                                  border: "1px solid rgba(160,36,74,0.2)",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 9, fontWeight: 700,
                                  color: "#A0244A",
                                  cursor: q ? "pointer" : "default",
                                  transition: "all 0.12s",
                                }}
                                onMouseEnter={e => {
                                  if (q) e.currentTarget.style.background = "rgba(160,36,74,0.22)";
                                }}
                                onMouseLeave={e => {
                                  if (q) e.currentTarget.style.background = "rgba(160,36,74,0.12)";
                                }}
                              >
                                Q{String(ref + 1).padStart(2, "0")}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </VoltSectionCard>
            )}

            {/* Meta Decision Framework */}
            {summary.metaDecisionFramework && summary.metaDecisionFramework.length > 0 && (
              <VoltSectionCard
                icon={<Compass size={18} />}
                iconVariant="mint"
                title={de ? "Meta-Entscheidungsrahmen" : "Meta Decision Framework"}
                subtitle={de
                  ? "Nicht-verhandelbare Handlungsmaximen, die aus dem Muster folgen"
                  : "Non-negotiable action principles emerging from the pattern"
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {summary.metaDecisionFramework.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <VoltIconBox
                        icon={<span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{String(i + 1).padStart(2, "0")}</span>}
                        variant="mint"
                        size={30}
                        rounded="full"
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 15, fontWeight: 700,
                          color: "var(--foreground)",
                          marginBottom: 4,
                          letterSpacing: "-0.01em",
                        }}>
                          {d.principle}
                        </div>
                        <p style={{
                          fontSize: 13, lineHeight: 1.6,
                          color: "var(--muted-foreground)",
                          margin: 0,
                          fontFamily: "var(--font-ui)",
                        }}>
                          {d.rationale}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </VoltSectionCard>
            )}

            {/* Open Flanks — the sharpest cut */}
            {summary.openFlanks && summary.openFlanks.length > 0 && (
              <VoltSectionCard
                icon={<HelpCircle size={18} />}
                iconVariant="butter"
                title={de ? "Offene Flanken" : "Open Flanks"}
                subtitle={de
                  ? "Fragen, die du nicht gestellt hast, aber hättest stellen müssen"
                  : "Questions you didn't ask but should have"
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {summary.openFlanks.map((f, i) => (
                    <div key={i} style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "var(--pastel-butter, #FFF5BA)",
                      border: "1px solid #E8D870",
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      <div style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 14, fontWeight: 700,
                        color: "#4A3800",
                        marginBottom: 6,
                        letterSpacing: "-0.01em",
                      }}>
                        → {f.question}
                      </div>
                      <p style={{
                        fontSize: 12, lineHeight: 1.6,
                        color: "#7A5C00",
                        margin: 0,
                        fontFamily: "var(--font-ui)",
                      }}>
                        {f.why}
                      </p>
                    </div>
                  ))}
                </div>
              </VoltSectionCard>
            )}

            {/* Critique — the honest assessment */}
            {summary.critique && (
              <VoltInfoBlock
                variant="info"
                label={de ? "Ehrliche Einschätzung" : "Honest Assessment"}
              >
                {summary.critique}
              </VoltInfoBlock>
            )}

            {/* Regenerate button */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 24px" }}>
              <button
                onClick={generate}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  color: "var(--muted-foreground)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--foreground)"; e.currentTarget.style.color = "var(--foreground)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
              >
                <RefreshCw size={12} />
                <span>{de ? "Meta-Synthese neu generieren" : "Regenerate meta-synthesis"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
