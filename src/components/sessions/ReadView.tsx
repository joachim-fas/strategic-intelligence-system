"use client";

/**
 * ReadView — linear long-form rendering of every briefing in a project,
 * using the SAME `BriefingResult` component as the home-page result view.
 *
 * History (2026-04-23): User-Feedback war:
 *   "Man kommt, wenn man in den Canvas gewechselt hat, nie wieder zu
 *    dieser Ansicht. Ich fände es ganz praktisch, wenn man sich auch
 *    das komplette Projekt in diesem Layout wieder ansehen könnte —
 *    es liest sich linear besser. Evtl. mit einer kleinen Navi, die
 *    Dokumente können ja doch recht lange werden."
 *
 * Existing alternative: SessionSummaryView (`/zusammenfassung`-Route)
 * gibt eine SIMPLIFIED Stack-Ansicht — nur synthesis/insights/scenarios
 * als Plain-Text. Deutlich schmaler als BriefingResult. Beide Views
 * existieren parallel:
 *   - `/canvas/[id]/zusammenfassung` — kompakt, druckfreundlich
 *   - `/canvas/[id]/lesen` (THIS) — voll feature-rich (KPI-Tiles,
 *     Coverage-Health-Box, Live-Signale, Szenarien-Cards, etc.)
 *
 * Navigation: linke Sidebar mit Sticky-TOC, ein Anker pro Query.
 * Bei vielen Queries (was selten ist — typisch 1-3 pro Projekt) wird
 * Scrolling durch die TOC steuerbar.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { type Locale } from "@/lib/i18n";
import { BriefingResult, type HistoryEntry } from "@/components/briefing/BriefingResult";
import { ArrowLeft, FileText, Printer, ChevronRight } from "lucide-react";

interface ReadViewProps {
  projectId: string;
}

interface QueryRow {
  id: string;
  query: string;
  locale?: string;
  result: any;
  created_at: string;
}

export default function ReadView({ projectId }: ReadViewProps) {
  const { t, locale, de } = useT();
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [activeAnchor, setActiveAnchor] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pj, qs] = await Promise.all([
        fetchWithTimeout(`/api/v1/canvas/${projectId}`, {}, 15_000).then(r => r.ok ? r.json() : null),
        fetchWithTimeout(`/api/v1/projects/${projectId}/queries`, {}, 15_000).then(r => r.ok ? r.json() : null),
      ]);
      if (pj?.canvas?.name) setProjectName(pj.canvas.name);
      const list: QueryRow[] = (qs?.data?.queries ?? qs?.queries ?? []) as QueryRow[];
      // Filter: ignore framework-step rows like "marktanalyse/risks" — they
      // have query strings of the form "<frameworkId>/<stepId>" which
      // BriefingResult would render but their results aren't IntelligenceBriefing
      // shape and would render confusingly. Keep only top-level queries.
      const topLevel = list.filter(q => q.query && !q.query.match(/^[a-z-]+\/[a-z-]+$/));
      // Show oldest first — chronological reading order, matches narrative arc
      topLevel.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      setQueries(topLevel);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll-spy: highlight the TOC entry for the briefing currently in view.
  // Uses IntersectionObserver — cheap, no scroll-handler attached.
  useEffect(() => {
    if (queries.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveAnchor(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    queries.forEach((q) => {
      const el = document.getElementById(`briefing-${q.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [queries]);

  const scrollTo = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Build HistoryEntry per query — BriefingResult expects this shape.
  const entries: HistoryEntry[] = useMemo(() => {
    return queries.map((q) => ({
      id: q.id,
      query: q.query,
      briefing: q.result ?? {
        // Defensive fallback: empty briefing if result is null/missing
        query: q.query,
        matchedTrends: [],
        synthesis: "",
        reasoningChains: [],
        keyInsights: [],
        regulatoryContext: [],
        causalChain: [],
        signalSummary: "",
        confidence: 0,
        dataPoints: 0,
      },
      timestamp: new Date(q.created_at),
      isLoading: false,
    }));
  }, [queries]);

  const formatRelative = (date: Date): string => {
    const ms = Date.now() - date.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return de ? "heute" : "today";
    if (days === 1) return de ? "gestern" : "yesterday";
    if (days < 7) return de ? `vor ${days} Tagen` : `${days}d ago`;
    return date.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", { day: "numeric", month: "short" });
  };

  const totalLocale: Locale = de ? "de" : "en";

  return (
    <>
      <AppHeader />
      <div style={{ display: "flex", minHeight: "calc(100vh - 56px)", background: "var(--background)" }}>
        {/* ─── TOC Sidebar (sticky) ───────────────────────────────────── */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            position: "sticky",
            top: 56,
            alignSelf: "flex-start",
            maxHeight: "calc(100vh - 56px)",
            overflowY: "auto",
            borderRight: "1px solid var(--color-border)",
            background: "var(--background)",
            padding: "24px 18px",
            fontFamily: "var(--font-ui)",
          }}
          aria-label={de ? "Inhaltsverzeichnis" : "Table of Contents"}
        >
          <Link
            href={`/canvas?project=${projectId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--muted-foreground)",
              textDecoration: "none",
              marginBottom: 18,
            }}
          >
            <ArrowLeft size={14} />
            {de ? "zurück zum Canvas" : "back to Canvas"}
          </Link>

          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
                marginBottom: 4,
              }}
            >
              {de ? "Projekt" : "Project"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.35 }}>
              {projectName || (de ? "(unbenannt)" : "(untitled)")}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
              {queries.length} {de ? (queries.length === 1 ? "Briefing" : "Briefings") : (queries.length === 1 ? "briefing" : "briefings")}
            </div>
          </div>

          {/* TOC */}
          {queries.length > 0 && (
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                  marginBottom: 8,
                }}
              >
                {de ? "Briefings" : "Briefings"}
              </div>
              {entries.map((entry, i) => {
                const anchor = `briefing-${entry.id}`;
                const isActive = activeAnchor === anchor;
                return (
                  <button
                    key={entry.id}
                    onClick={() => scrollTo(anchor)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      padding: "8px 10px",
                      background: isActive ? "var(--muted, #F4F4F5)" : "transparent",
                      border: "none",
                      borderLeft: isActive ? "2px solid var(--volt-orchid, #5A2A9E)" : "2px solid transparent",
                      borderRadius: 4,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 100ms ease, border-color 100ms ease",
                      color: "var(--foreground)",
                      fontFamily: "var(--font-ui)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--muted, #F4F4F5)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isActive ? "var(--volt-orchid, #5A2A9E)" : "var(--muted-foreground)",
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          lineHeight: 1.4,
                          fontWeight: isActive ? 600 : 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {entry.query}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                        {formatRelative(entry.timestamp)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              onClick={() => window.print()}
              title={de ? "Drucken oder als PDF speichern" : "Print or save as PDF"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 10px",
                background: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-ui)",
              }}
            >
              <Printer size={12} />
              {de ? "Drucken" : "Print"}
            </button>
            <Link
              href={`/canvas/${projectId}/zusammenfassung`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 10px",
                background: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                fontSize: 12,
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-ui)",
                textDecoration: "none",
              }}
              title={de ? "Kompakte Zusammenfassung statt voller BriefingResult" : "Compact summary view"}
            >
              <FileText size={12} />
              {de ? "Kompakt-Ansicht" : "Compact view"}
              <ChevronRight size={12} style={{ marginLeft: "auto" }} />
            </Link>
          </div>
        </aside>

        {/* ─── Main Content (BriefingResult per query) ───────────────── */}
        <main
          style={{
            flex: 1,
            padding: "24px 32px 80px",
            maxWidth: 1100,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {loading && (
            <div style={{ padding: 48, textAlign: "center", color: "var(--muted-foreground)" }}>
              {de ? "Lade Briefings…" : "Loading briefings…"}
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                padding: 16,
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                borderRadius: 6,
                color: "#991B1B",
                marginBottom: 16,
              }}
            >
              <strong>{de ? "Fehler beim Laden" : "Failed to load"}:</strong> {error}
              <button
                onClick={() => fetchData()}
                style={{
                  marginLeft: 12,
                  padding: "4px 10px",
                  background: "#fff",
                  border: "1px solid #FCA5A5",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {de ? "erneut versuchen" : "retry"}
              </button>
            </div>
          )}

          {!loading && !error && queries.length === 0 && (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--muted-foreground)",
                background: "var(--card)",
                border: "1px dashed var(--color-border)",
                borderRadius: 8,
              }}
            >
              <p style={{ marginBottom: 12, fontSize: 14 }}>
                {de
                  ? "Dieses Projekt enthält noch keine Briefings."
                  : "This project contains no briefings yet."}
              </p>
              <Link
                href={`/canvas?project=${projectId}`}
                style={{ color: "var(--volt-orchid, #5A2A9E)", fontSize: 13, textDecoration: "underline" }}
              >
                {de ? "→ zum Canvas" : "→ go to Canvas"}
              </Link>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <>
              <header style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: "var(--foreground)" }}>
                  {projectName || (de ? "Projekt-Lese-Ansicht" : "Project read view")}
                </h1>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                  {de
                    ? `${entries.length} ${entries.length === 1 ? "Briefing" : "Briefings"} chronologisch — ältestes oben`
                    : `${entries.length} ${entries.length === 1 ? "briefing" : "briefings"} chronological — oldest first`}
                </p>
              </header>

              {entries.map((entry, i) => (
                <section
                  key={entry.id}
                  id={`briefing-${entry.id}`}
                  style={{
                    marginBottom: 48,
                    scrollMarginTop: 80, // so anchor-jumps don't hide behind sticky elements
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      marginBottom: 6,
                      fontFamily: "var(--volt-font-mono, monospace)",
                    }}
                  >
                    {de ? "Briefing" : "Briefing"} {i + 1}
                    {" · "}
                    {entry.timestamp.toLocaleDateString(totalLocale === "de" ? "de-DE" : "en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <BriefingResult
                    entry={entry}
                    locale={totalLocale}
                    trendCount={Array.isArray(entry.briefing?.matchedTrends) ? entry.briefing.matchedTrends.length : 0}
                    onTrendClick={() => { /* no-op in read view */ }}
                    activeProjectId={projectId}
                    // Read-View ist explizit zum Lesen — keine Folge-Queries
                    // direkt von hier auslösbar (würde Navigation in Home/Canvas
                    // erfordern und den Lese-Flow brechen). Wenn der User
                    // Folge-Queries braucht, geht er zurück zum Canvas.
                    onFollowUp={undefined}
                    onRetry={undefined}
                  />
                </section>
              ))}
            </>
          )}
        </main>
      </div>
    </>
  );
}
