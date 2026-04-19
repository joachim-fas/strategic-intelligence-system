"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { provenanceCoverage } from "@/lib/causal-graph";

// ── Types ────────────────────────────────────────────────────────────────────

interface MonitorData {
  timestamp: string;
  signals: {
    total: number;
    oldestHours: number;
    newestHours: number;
    bySource: Array<{
      source: string;
      count: number;
      latest: string;
      avg_strength: number;
      // Welle B Item 3 — per-source anomaly tier from the Welford
      // baseline. `tier: null` = warming up (<10 samples) OR within
      // 1.5σ of the baseline mean. `z` null ⇒ same reason.
      anomaly?: { tier: "low" | "medium" | "high" | null; z: number | null; n: number };
    }>;
    timeline: Array<{ day: string; count: number }>;
  };
  trends: {
    total: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  knowledgeBase: {
    megaTrends: number;
    causalEdges: number;
    regulations: number;
    connectors: number;
  };
  connectors: Array<{ name: string; displayName: string }>;
  pipeline: {
    success: boolean;
    signalCount: number;
    sources: string[];
    errors: string[];
    duration: number;
    fetchedAt: string;
  } | null;
  recentQueries: Array<{ query: string; timestamp: string; canvasId: string }>;
  system: {
    dbSizeKB: number;
    nodeVersion: string;
    uptime: number;
  };
}

interface ActivityLogEntry {
  time: string;
  type: "fetch" | "pipeline" | "error" | "info";
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatHoursAgo(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

// ── Components ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "var(--volt-surface-raised, #fff)",
      border: "1px solid var(--color-border, #E8E8E8)",
      borderRadius: 12, padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "var(--color-text-heading)", fontFamily: "var(--volt-font-display)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{sub}</div>}
    </div>
  );
}

function SourceBar({
  name,
  count,
  maxCount,
  anomaly,
  de,
}: {
  name: string;
  count: number;
  maxCount: number;
  anomaly?: { tier: "low" | "medium" | "high" | null; z: number | null; n: number };
  de: boolean;
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  // Welle B Item 3 — tier → color map. Signed z matters: above-mean
  // anomalies are green (more signal than usual), below-mean are red
  // (a source has gone quiet). Matches the Welford anomaly semantic
  // where both directions are signal-worthy.
  const tier = anomaly?.tier ?? null;
  const z = anomaly?.z ?? null;
  const signPositive = z != null && z >= 0;
  const tierColor: Record<string, string> = {
    low:    signPositive ? "#A3C850" : "#E89B5A",
    medium: signPositive ? "#58A82E" : "#D95738",
    high:   signPositive ? "#1A9E5A" : "#C4241B",
  };
  const tierBg: Record<string, string> = {
    low:    signPositive ? "rgba(163,200,80,0.18)" : "rgba(232,155,90,0.18)",
    medium: signPositive ? "rgba(88,168,46,0.22)"  : "rgba(217,87,56,0.20)",
    high:   signPositive ? "rgba(26,158,90,0.25)"  : "rgba(196,36,27,0.22)",
  };
  const tierLabelDe: Record<string, string> = { low: "auffällig", medium: "stark", high: "kritisch" };
  const tierLabelEn: Record<string, string> = { low: "anomalous", medium: "strong", high: "critical" };
  const tierTitle = tier
    ? `z = ${z?.toFixed(2)} (n=${anomaly?.n ?? 0}) · ${de ? tierLabelDe[tier] : tierLabelEn[tier]}`
    : anomaly && anomaly.n < 10
    ? de ? `Baseline warming up (n=${anomaly.n})` : `Baseline warming up (n=${anomaly.n})`
    : undefined;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }} title={tierTitle}>
      <div style={{ width: 120, fontWeight: 600, color: "var(--color-text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </div>
      <div style={{ flex: 1, height: 8, background: "var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#E4FF97", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div style={{ width: 40, textAlign: "right", color: "var(--color-text-muted)", fontFamily: "var(--volt-font-mono)", fontSize: 11 }}>
        {count}
      </div>
      {tier && z != null && (
        <span
          style={{
            fontFamily: "var(--volt-font-mono)",
            fontSize: 9, fontWeight: 700,
            padding: "1px 6px", borderRadius: 10,
            background: tierBg[tier],
            color: tierColor[tier],
            minWidth: 36, textAlign: "center" as const,
            flexShrink: 0,
          }}
        >
          {signPositive ? "+" : ""}{z.toFixed(1)}σ
        </span>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: ActivityLogEntry }) {
  const colors: Record<string, string> = {
    fetch: "#1A9E5A",
    pipeline: "#3B82F6",
    error: "#E8402A",
    info: "var(--color-text-muted)",
  };
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--color-border)", fontFamily: "var(--volt-font-mono)" }}>
      <span style={{ width: 60, color: "var(--color-text-muted)", flexShrink: 0 }}>{entry.time}</span>
      <span style={{ width: 60, fontWeight: 600, color: colors[entry.type] || "var(--color-text-muted)", flexShrink: 0, textTransform: "uppercase", fontSize: 10 }}>
        {entry.type}
      </span>
      <span style={{ color: "var(--color-text-primary)", flex: 1 }}>{entry.message}</span>
    </div>
  );
}

// Konfigurations-Status eines Connectors, wie von
// /api/v1/sources/status geliefert. Spiegelt src/lib/connector-config.ts.
interface SourceConfigStatus {
  name: string;
  displayName: string;
  signalCount: number;
  lastFetch: string | null;
  newestHours: number | null;
  status: "ok" | "stale" | "inactive";
  config: {
    status: "ok" | "missing-required" | "missing-optional";
    missing: string[];
    registerUrl: string | null;
    note: string | null;
  };
}

interface SourcesStatusPayload {
  connectors: SourceConfigStatus[];
  totalSignals: number;
  healthy: number;
  stale: number;
  inactive: number;
  needsKey: number;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const { t, de } = useT();
  const [data, setData] = useState<MonitorData | null>(null);
  const [sources, setSources] = useState<SourcesStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const addLog = useCallback((type: ActivityLogEntry["type"], message: string) => {
    setActivityLog((prev) => [
      { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), type, message },
      ...prev.slice(0, 99),
    ]);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Zwei Calls parallel: der klassische /monitor-Report plus die
      // neue /sources/status-Route mit Config-Status pro Connector.
      // So bleibt die /monitor-Route unveraendert und wir bekommen
      // gleichzeitig den Konfigurations-Einblick.
      const [monitorRes, sourcesRes] = await Promise.all([
        fetchWithTimeout("/api/v1/monitor"),
        fetchWithTimeout("/api/v1/sources/status"),
      ]);
      if (!monitorRes.ok) throw new Error(`HTTP ${monitorRes.status}`);
      const json = await monitorRes.json();
      const d = json.data ?? json;
      setData(d);
      if (sourcesRes.ok) {
        const sJson = await sourcesRes.json();
        const payload = (sJson.data ?? sJson) as SourcesStatusPayload;
        setSources(payload);
      }
      setError(null);
      setLastRefresh(new Date());
      addLog("fetch", `Monitor-Daten geladen: ${d.signals.total} Signale, ${d.trends.total} Trends`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out");
        addLog("error", "Monitor-Timeout: Server antwortet nicht");
      } else {
        setError(String(err));
        addLog("error", `Monitor-Fehler: ${err}`);
      }
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const runPipeline = async () => {
    setPipelineRunning(true);
    addLog("pipeline", "Pipeline gestartet...");
    try {
      const res = await fetchWithTimeout("/api/v1/pipeline", { method: "POST" }, 120_000);
      const d = await res.json();
      if (d.success) {
        addLog("pipeline", `Pipeline fertig: ${d.signalCount} Signale aus ${d.sources?.length} Quellen in ${d.duration}ms`);
        if (d.errors?.length > 0) {
          addLog("error", `${d.errors.length} Connector-Fehler: ${d.errors.slice(0, 3).join(", ")}`);
        }
      } else {
        addLog("error", `Pipeline: ${d.error?.message || "Fehler"}`);
      }
      await fetchData();
    } catch (err) {
      addLog("error", `Pipeline-Fehler: ${err}`);
    } finally {
      setPipelineRunning(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--volt-font-display)", color: "var(--color-text-heading)", margin: 0, letterSpacing: "-0.02em" }}>
              {t("monitor.pageTitle")}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              {t("monitor.pageSubtitle")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {lastRefresh && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {t("monitor.updated")}: {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                border: "1px solid var(--color-border)", cursor: "pointer",
                background: autoRefresh ? "#E4FF97" : "transparent",
                color: autoRefresh ? "#0A0A0A" : "var(--color-text-muted)",
              }}
            >
              {autoRefresh ? t("monitor.autoRefreshOn") : t("monitor.autoRefreshOff")}
            </button>
            <button
              onClick={runPipeline}
              disabled={pipelineRunning}
              style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                border: "none", cursor: pipelineRunning ? "wait" : "pointer",
                background: "#0A0A0A", color: "#fff",
                opacity: pipelineRunning ? 0.5 : 1,
              }}
            >
              {pipelineRunning ? t("monitor.pipelineRunning") : t("monitor.runPipeline")}
            </button>
          </div>
        </div>

        {loading && !data && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
            {t("monitor.loadingSystem")}
          </div>
        )}

        {error && !data && (
          <div style={{ padding: 20, background: "var(--signal-negative-light)", border: "1px solid var(--signal-negative-border)", borderRadius: 8, color: "var(--signal-negative-text)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {data && (
          <>
            {/* ── KPI Cards ─────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
              <StatCard
                label={t("monitor.liveSignals")}
                value={data.signals.total}
                sub={data.signals.newestHours < 999 ? `${t("monitor.newest")}: ${formatHoursAgo(data.signals.newestHours)}` : t("monitor.noSignalsStat")}
                color={data.signals.total > 0 ? "#1A9E5A" : "#E8402A"}
              />
              <StatCard
                label={t("monitor.trends")}
                value={data.trends.total}
                sub={`${data.knowledgeBase.megaTrends} Mega-/Makro-Trends`}
              />
              <StatCard
                label={t("monitor.connectors")}
                value={data.knowledgeBase.connectors}
                sub={data.pipeline ? `${data.pipeline.sources?.length || 0} ${t("monitor.activeShort")}` : t("monitor.notRunYet")}
              />
              <StatCard
                label={t("monitor.causalEdges")}
                value={data.knowledgeBase.causalEdges}
                // Welle B Item 1: surface edge-provenance coverage so
                // analysts can see at a glance how much of the causal
                // graph carries citations. The goal is 100 % over time
                // — this tile makes progress visible without blocking
                // any single PR on full coverage.
                sub={(() => {
                  const cov = provenanceCoverage();
                  if (cov.partialPct === 0) {
                    return `${data.knowledgeBase.regulations} ${t("monitor.regulations")} · ${de ? "0 % mit Quelle" : "0 % w/ source"}`;
                  }
                  const label = de ? "mit Quelle" : "w/ source";
                  return `${cov.fullPct} % ${label} (${cov.full}/${cov.total})`;
                })()}
              />
              <StatCard
                label={t("monitor.database")}
                value={`${(data.system.dbSizeKB / 1024).toFixed(1)} MB`}
                sub={`Node ${data.system.nodeVersion}`}
              />
              <StatCard
                label="Uptime"
                value={formatDuration(data.system.uptime)}
                sub={t("monitor.serverUptime")}
              />
            </div>

            {/* ── Pipeline Status ────────────────────────────────── */}
            {data.pipeline && (
              <div style={{
                background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
                borderRadius: 12, padding: 20, marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                  {t("monitor.lastPipelineRun")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{t("monitor.timeLabel")}</span>
                    <strong>{new Date(data.pipeline.fetchedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{t("monitor.durationLabel")}</span>
                    <strong>{data.pipeline.duration}ms</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{t("monitor.signalsLabel")}</span>
                    <strong>{data.pipeline.signalCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{t("monitor.sourcesLabel")}</span>
                    <strong>{data.pipeline.sources?.length || 0}</strong>
                  </div>
                </div>
                {data.pipeline.errors?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#E8402A", marginBottom: 4 }}>
                      {data.pipeline.errors.length} {t("monitor.errorsLabel")}:
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--volt-font-mono)", maxHeight: 120, overflow: "auto" }}>
                      {data.pipeline.errors.map((e: string, i: number) => (
                        <div key={i} style={{ padding: "2px 0" }}>{e}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Two Column: Signals by Source + Recent Queries ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Signals by Source */}
              <div style={{
                background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                  {t("monitor.signalsBySource")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.signals.bySource.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                      {t("monitor.noSignalsRunPipeline")}
                    </div>
                  )}
                  {data.signals.bySource.map((s) => (
                    <SourceBar
                      key={s.source}
                      name={s.source}
                      count={s.count}
                      maxCount={data.signals.bySource[0]?.count || 1}
                      anomaly={s.anomaly}
                      de={de}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Queries */}
              <div style={{
                background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                  {t("monitor.recentQueries")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {data.recentQueries.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                      {t("monitor.noQueriesYet")}
                    </div>
                  )}
                  {data.recentQueries.map((q, i) => (
                    <div key={i} style={{
                      fontSize: 12, padding: "6px 8px", borderRadius: 6,
                      background: "var(--volt-surface)", border: "1px solid var(--color-border)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ color: "var(--color-text-heading)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                        {q.query}
                      </span>
                      {q.timestamp && (
                        <span style={{ fontSize: 10, color: "var(--color-text-muted)", flexShrink: 0 }}>
                          {new Date(q.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Datenquellen-Gesundheit: Konfigurations-Luecken ──
                 Zeigt welche Connectors aktuell KEINE Signale liefern und
                 warum. Wichtigster Fall: `missing-required` — eine Quelle
                 bleibt stumm weil ihr API-Key fehlt. Der Monitor zeigt
                 direkt welche ENV-Variable fehlt und wo man sich fuer
                 den Key registriert. Zweiter Fall: `missing-optional` —
                 Quelle laeuft, aber mit Rate-Limit-Drossel (z.B. GitHub
                 ohne Token). Gruene Pille = alles ok. */}
            {sources && (
              <div style={{
                background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
                borderRadius: 12, padding: 20, marginBottom: 20,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)" }}>
                    {t("monitor.sourcesHealthHeading")}
                  </div>
                  <div style={{
                    fontFamily: "var(--volt-font-mono)", fontSize: 11,
                    color: "var(--color-text-muted)", letterSpacing: "0.04em",
                  }}>
                    <span style={{ color: "#1A9E5A", fontWeight: 600 }}>{sources.healthy}</span> ok
                    {" · "}<span style={{ color: "#F5A623", fontWeight: 600 }}>{sources.stale}</span> stale
                    {" · "}<span style={{ color: "#9B9B9B", fontWeight: 600 }}>{sources.inactive}</span> inaktiv
                    {sources.needsKey > 0 && (
                      <>{" · "}<span style={{ color: "#E8402A", fontWeight: 700 }}>{sources.needsKey}</span> {t("monitor.missingKeyShort")}</>
                    )}
                  </div>
                </div>

                {/* Kritische Luecken: fehlende erforderliche Keys */}
                {sources.connectors.filter(c => c.config.status === "missing-required").length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      color: "#E8402A", marginBottom: 8,
                    }}>
                      {t("monitor.activationRequired")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {sources.connectors.filter(c => c.config.status === "missing-required").map(c => (
                        <div key={c.name} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px",
                          background: "var(--signal-negative-light)",
                          border: "1px solid var(--signal-negative-border)",
                          borderRadius: 6, fontSize: 12,
                        }}>
                          <span style={{ fontWeight: 600, color: "var(--color-text-primary)", minWidth: 110 }}>{c.displayName}</span>
                          <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, color: "var(--signal-negative-text)" }}>
                            {c.config.missing.join(" + ")}
                          </span>
                          {c.config.note && (
                            <span style={{ flex: 1, color: "var(--color-text-muted)", fontSize: 11 }}>{c.config.note}</span>
                          )}
                          {c.config.registerUrl && (
                            <a href={c.config.registerUrl} target="_blank" rel="noopener noreferrer" style={{
                              fontSize: 11, fontWeight: 600,
                              padding: "3px 10px", borderRadius: 5,
                              background: "#0A0A0A", color: "#fff",
                              textDecoration: "none", flexShrink: 0,
                            }}>
                              {t("monitor.getKey")}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nicht kritisch: optionale Keys fehlen (Rate-Limit) */}
                {sources.connectors.filter(c => c.config.status === "missing-optional").length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      color: "#F5A623", marginBottom: 8,
                    }}>
                      {t("monitor.rateLimitWarn")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {sources.connectors.filter(c => c.config.status === "missing-optional").map(c => (
                        <div key={c.name} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "6px 12px",
                          background: "var(--pastel-butter)",
                          border: "1px solid var(--pastel-butter-border)",
                          borderRadius: 6, fontSize: 12,
                        }}>
                          <span style={{ fontWeight: 600, color: "var(--color-text-primary)", minWidth: 110 }}>{c.displayName}</span>
                          <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, color: "var(--pastel-butter-text)" }}>
                            {c.config.missing.join(" + ")}
                          </span>
                          {c.config.note && (
                            <span style={{ flex: 1, color: "var(--color-text-muted)", fontSize: 11 }}>{c.config.note}</span>
                          )}
                          {c.config.registerUrl && (
                            <a href={c.config.registerUrl} target="_blank" rel="noopener noreferrer" style={{
                              fontSize: 11, fontWeight: 600,
                              padding: "3px 10px", borderRadius: 5,
                              background: "transparent", color: "var(--color-text-primary)",
                              border: "1px solid var(--color-border)",
                              textDecoration: "none", flexShrink: 0,
                            }}>
                              {t("monitor.getKey")}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inaktive Sources OHNE Config-Problem: Connector laeuft aber liefert 0 Signale */}
                {sources.connectors.filter(c => c.status === "inactive" && c.config.status === "ok").length > 0 && (
                  <div>
                    <div style={{
                      fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      color: "var(--color-text-muted)", marginBottom: 8,
                    }}>
                      {t("monitor.silentSourceWarn")}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sources.connectors.filter(c => c.status === "inactive" && c.config.status === "ok").map(c => (
                        <span key={c.name} style={{
                          fontSize: 11, padding: "3px 8px", borderRadius: 5,
                          fontFamily: "var(--volt-font-mono)",
                          background: "var(--volt-surface)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-muted)",
                        }}>
                          {c.displayName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alles gut — kein Handlungsbedarf */}
                {sources.needsKey === 0 && sources.inactive === 0 && (
                  <div style={{
                    fontSize: 12, color: "#1A9E5A", fontWeight: 500,
                    padding: "10px 12px", background: "var(--pastel-mint)",
                    borderRadius: 6,
                  }}>
                    {t("monitor.allHealthyMark")}
                  </div>
                )}
              </div>
            )}

            {/* ── Connector Registry ────────────────────────────── */}
            <div style={{
              background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
              borderRadius: 12, padding: 20, marginBottom: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                {`${t("monitor.connectorRegistry")} (${data.connectors.length})`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.connectors.map((c) => {
                  const isActive = data.pipeline?.sources?.includes(c.name);
                  const hasError = data.pipeline?.errors?.some((e: string) => e.includes(c.name));
                  return (
                    <span key={c.name} style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 5,
                      fontFamily: "var(--volt-font-mono)",
                      background: hasError ? "var(--signal-negative-light)" : isActive ? "#E4FF9730" : "var(--volt-surface)",
                      border: `1px solid ${hasError ? "var(--signal-negative-border)" : isActive ? "#E4FF9770" : "var(--color-border)"}`,
                      color: hasError ? "var(--signal-negative-text)" : isActive ? "#0A0A0A" : "var(--color-text-muted)",
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {hasError ? "\u26A0 " : isActive ? "\u2713 " : ""}{c.displayName}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* ── Activity Log ──────────────────────────────────── */}
            <div style={{
              background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                {t("monitor.activityLog")}
              </div>
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                {activityLog.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    {t("monitor.waitingForActivity")}
                  </div>
                )}
                {activityLog.map((entry, i) => (
                  <LogLine key={i} entry={entry} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
