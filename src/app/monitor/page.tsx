"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";

// ── Types ────────────────────────────────────────────────────────────────────

interface MonitorData {
  timestamp: string;
  signals: {
    total: number;
    oldestHours: number;
    newestHours: number;
    bySource: Array<{ source: string; count: number; latest: string; avg_strength: number }>;
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

function SourceBar({ name, count, maxCount }: { name: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <div style={{ width: 120, fontWeight: 600, color: "var(--color-text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </div>
      <div style={{ flex: 1, height: 8, background: "var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#E4FF97", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div style={{ width: 40, textAlign: "right", color: "var(--color-text-muted)", fontFamily: "var(--volt-font-mono)", fontSize: 11 }}>
        {count}
      </div>
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [data, setData] = useState<MonitorData | null>(null);
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
      const res = await fetchWithTimeout("/api/v1/monitor");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
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
              {de ? "Aktivitaetsmonitor" : "Activity Monitor"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              {de ? "Echtzeit-Systemstatus, Pipeline-Aktivitaet und Datenqualitaet" : "Real-time system status, pipeline activity and data quality"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {lastRefresh && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {de ? "Aktualisiert" : "Updated"}: {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
              {autoRefresh ? (de ? "Auto-Refresh AN" : "Auto-refresh ON") : (de ? "Auto-Refresh AUS" : "Auto-refresh OFF")}
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
              {pipelineRunning ? (de ? "Pipeline laeuft..." : "Pipeline running...") : (de ? "Pipeline starten" : "Run Pipeline")}
            </button>
          </div>
        </div>

        {loading && !data && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
            {de ? "Lade Systemdaten..." : "Loading system data..."}
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
                label={de ? "Live-Signale" : "Live Signals"}
                value={data.signals.total}
                sub={data.signals.newestHours < 999 ? `${de ? "Neueste" : "Newest"}: ${formatHoursAgo(data.signals.newestHours)}` : de ? "Keine Signale" : "No signals"}
                color={data.signals.total > 0 ? "#1A9E5A" : "#E8402A"}
              />
              <StatCard
                label={de ? "Trends" : "Trends"}
                value={data.trends.total}
                sub={`${data.knowledgeBase.megaTrends} Mega-/Makro-Trends`}
              />
              <StatCard
                label={de ? "Connectors" : "Connectors"}
                value={data.knowledgeBase.connectors}
                sub={data.pipeline ? `${data.pipeline.sources?.length || 0} ${de ? "aktiv" : "active"}` : de ? "Noch nicht gelaufen" : "Not run yet"}
              />
              <StatCard
                label={de ? "Kausale Kanten" : "Causal Edges"}
                value={data.knowledgeBase.causalEdges}
                sub={`${data.knowledgeBase.regulations} ${de ? "Regulierungen" : "Regulations"}`}
              />
              <StatCard
                label={de ? "Datenbank" : "Database"}
                value={`${(data.system.dbSizeKB / 1024).toFixed(1)} MB`}
                sub={`Node ${data.system.nodeVersion}`}
              />
              <StatCard
                label="Uptime"
                value={formatDuration(data.system.uptime)}
                sub={de ? "Server-Laufzeit" : "Server uptime"}
              />
            </div>

            {/* ── Pipeline Status ────────────────────────────────── */}
            {data.pipeline && (
              <div style={{
                background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
                borderRadius: 12, padding: 20, marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                  {de ? "Letzte Pipeline-Ausfuehrung" : "Last Pipeline Run"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{de ? "Zeitpunkt: " : "Time: "}</span>
                    <strong>{new Date(data.pipeline.fetchedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{de ? "Dauer: " : "Duration: "}</span>
                    <strong>{data.pipeline.duration}ms</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{de ? "Signale: " : "Signals: "}</span>
                    <strong>{data.pipeline.signalCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{de ? "Quellen: " : "Sources: "}</span>
                    <strong>{data.pipeline.sources?.length || 0}</strong>
                  </div>
                </div>
                {data.pipeline.errors?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#E8402A", marginBottom: 4 }}>
                      {data.pipeline.errors.length} {de ? "Fehler" : "Errors"}:
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
                  {de ? "Signale nach Quelle" : "Signals by Source"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.signals.bySource.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                      {de ? "Keine Signale vorhanden — Pipeline ausfuehren" : "No signals — run the pipeline"}
                    </div>
                  )}
                  {data.signals.bySource.map((s) => (
                    <SourceBar key={s.source} name={s.source} count={s.count} maxCount={data.signals.bySource[0]?.count || 1} />
                  ))}
                </div>
              </div>

              {/* Recent Queries */}
              <div style={{
                background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                  {de ? "Letzte Abfragen" : "Recent Queries"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {data.recentQueries.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                      {de ? "Noch keine Abfragen" : "No queries yet"}
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

            {/* ── Connector Registry ────────────────────────────── */}
            <div style={{
              background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
              borderRadius: 12, padding: 20, marginBottom: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--color-text-heading)" }}>
                {de ? `Connector-Registry (${data.connectors.length})` : `Connector Registry (${data.connectors.length})`}
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
                {de ? "Aktivitaetsprotokoll" : "Activity Log"}
              </div>
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                {activityLog.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    {de ? "Warte auf Aktivitaet..." : "Waiting for activity..."}
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
