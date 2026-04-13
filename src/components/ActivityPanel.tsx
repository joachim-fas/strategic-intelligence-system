/**
 * ActivityPanel — Fly-in panel that shows live system activity & quality KPIs.
 *
 * Opens from the right edge (400px, glass background).
 * Toggle via: AppHeader button, Ctrl+M, or custom DOM event "sis-toggle-activity-panel".
 *
 * Sections:
 * 1. Quality Dashboard — Signal freshness, source coverage, confidence, DB size
 * 2. Live Activity Feed — Streaming event log from server-side activity bus
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useActivityStream } from "@/lib/use-activity-stream";
import type { ActivityEvent } from "@/lib/use-activity-stream";
import { useLocale } from "@/lib/locale-context";
import Link from "next/link";

// ── Monitor API response shape ────────────────────────────────────────────
interface MonitorData {
  signals: {
    total: number;
    oldestHours: number;
    newestHours: number;
    bySource: Array<{ source: string; count: number }>;
  };
  knowledgeBase: {
    megaTrends: number;
    causalEdges: number;
    regulations: number;
    connectors: number;
  };
  system: {
    dbSizeKB: number;
    nodeVersion: string;
    uptime: number;
  };
}

// ── Visual mapping ────────────────────────────────────────────────────────
const PHASE_ICONS: Record<string, string> = {
  start: "\u25B6",       // ▶
  sanitize: "\u26E8",    // ⛨
  signals: "\u25CE",     // ◎
  "llm-call": "\u2726",  // ✦
  validation: "\u2713",  // ✓
  complete: "\u2714",    // ✔
  error: "\u2716",       // ✖
  fetch: "\u21E9",       // ⇩
};

const TYPE_COLORS: Record<string, string> = {
  query: "#4F46E5",     // Indigo
  pipeline: "#059669",  // Emerald
  system: "#6B7280",    // Gray
};

// ── Helpers ───────────────────────────────────────────────────────────────
function formatTime(iso: string, locale = "de-DE"): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function freshnessColor(hours: number): string {
  if (hours <= 6) return "#059669";   // green
  if (hours <= 24) return "#D97706";  // amber
  return "#DC2626";                   // red
}

function freshnessLabel(hours: number): string {
  if (hours <= 1) return `${Math.round(hours * 60)}m`;
  if (hours <= 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatMeta(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : (v as number).toFixed(2);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// ── Component ─────────────────────────────────────────────────────────────
export function ActivityPanel() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [open, setOpen] = useState(false);
  const { events, connected, clearEvents } = useActivityStream(open);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Toggle listener (from AppHeader or keyboard) ──────────────────────
  useEffect(() => {
    const toggleHandler = () => setOpen((p) => !p);
    window.addEventListener("sis-toggle-activity-panel", toggleHandler);

    const keyHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "m") {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", keyHandler);

    return () => {
      window.removeEventListener("sis-toggle-activity-panel", toggleHandler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, []);

  // ── Fetch monitor KPIs when open ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const fetchData = () => {
      fetch("/api/v1/monitor")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setMonitorData(d); })
        .catch(() => {});
    };
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [open]);

  // ── Track last confidence from events ─────────────────────────────────
  useEffect(() => {
    const latest = events.find(
      (e) => e.phase === "complete" && e.meta?.confidence != null
    );
    if (latest?.meta?.confidence != null) {
      setLastConfidence(latest.meta.confidence as number);
    }
  }, [events]);

  // ── Close on Escape ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  // ── Derived KPIs ──────────────────────────────────────────────────────
  const newestHours = monitorData?.signals?.newestHours ?? null;
  const totalSignals = monitorData?.signals?.total ?? 0;
  const sourceCount = monitorData?.signals?.bySource?.length ?? 0;
  const totalConnectors = monitorData?.knowledgeBase?.connectors ?? 57;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 998,
          background: "rgba(0,0,0,0.12)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          transition: "opacity 0.3s",
        }}
      />

      {/* Slide-in panel */}
      <aside
        role="complementary"
        aria-label="Activity Monitor"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 400, maxWidth: "100vw", zIndex: 999,
          background: "var(--volt-surface-raised, rgba(255,255,255,0.92))",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid var(--color-border, #E8E8E8)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column",
          fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
          animation: "sis-slide-in-right 0.25s ease-out",
          overflow: "hidden",
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border, #E8E8E8)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: connected ? "#059669" : "#DC2626",
              boxShadow: connected ? "0 0 6px rgba(5,150,105,0.4)" : "none",
              transition: "all 0.3s",
            }} />
            <span style={{
              fontSize: 15, fontWeight: 700,
              color: "var(--color-text-heading, #0A0A0A)",
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            }}>
              Activity Monitor
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/monitor"
              title={de ? "Vollständiger Monitor" : "Full Monitor"}
              onClick={() => setOpen(false)}
              style={{
                fontSize: 11, color: "var(--color-text-muted, #6B6B6B)",
                textDecoration: "none", padding: "4px 8px", borderRadius: 6,
                border: "1px solid var(--color-border)", background: "transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget).style.background = "rgba(228,255,151,0.5)"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.background = "transparent"; }}
            >
              Detail →
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label={de ? "Schließen" : "Close"}
              style={{
                width: 28, height: 28, borderRadius: 6, border: "none",
                background: "transparent", cursor: "pointer", fontSize: 16,
                color: "var(--color-text-muted, #6B6B6B)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget).style.background = "rgba(0,0,0,0.05)"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.background = "transparent"; }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Quality Dashboard (2×2 KPI grid) ─────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10, padding: "16px 20px",
          borderBottom: "1px solid var(--color-border, #E8E8E8)",
          flexShrink: 0,
        }}>
          {/* Signal Freshness */}
          <KPICard label={de ? "Signal-Frische" : "Signal Freshness"}>
            {newestHours !== null ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{
                  fontSize: 20, fontWeight: 700,
                  color: freshnessColor(newestHours),
                  fontFamily: "var(--volt-font-display)",
                }}>
                  {freshnessLabel(newestHours)}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  ({totalSignals})
                </span>
              </div>
            ) : (
              <Placeholder />
            )}
          </KPICard>

          {/* Source Coverage */}
          <KPICard label={de ? "Quellen-Abdeckung" : "Source Coverage"}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{
                fontSize: 20, fontWeight: 700,
                color: sourceCount > 0 ? "var(--color-text-heading, #0A0A0A)" : "var(--color-text-muted)",
                fontFamily: "var(--volt-font-display)",
              }}>
                {sourceCount}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                / {totalConnectors}
              </span>
            </div>
            {/* Coverage bar */}
            <div style={{
              marginTop: 4, height: 3, borderRadius: 2,
              background: "var(--color-border, #E8E8E8)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.min(100, (sourceCount / totalConnectors) * 100)}%`,
                background: sourceCount / totalConnectors > 0.5 ? "#059669" : "#D97706",
                transition: "width 0.5s",
              }} />
            </div>
          </KPICard>

          {/* Last Query Confidence */}
          <KPICard label={de ? "Letzte Konfidenz" : "Last Confidence"}>
            {lastConfidence !== null ? (
              <span style={{
                fontSize: 20, fontWeight: 700,
                color: lastConfidence >= 0.7 ? "#059669" : lastConfidence >= 0.4 ? "#D97706" : "#DC2626",
                fontFamily: "var(--volt-font-display)",
              }}>
                {(lastConfidence * 100).toFixed(0)}%
              </span>
            ) : (
              <Placeholder />
            )}
          </KPICard>

          {/* DB / System */}
          <KPICard label={de ? "Datenbank" : "Database"}>
            {monitorData ? (
              <div>
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: "var(--color-text-heading, #0A0A0A)",
                  fontFamily: "var(--volt-font-display)",
                }}>
                  {monitorData.system.dbSizeKB >= 1024
                    ? `${(monitorData.system.dbSizeKB / 1024).toFixed(1)} MB`
                    : `${monitorData.system.dbSizeKB} KB`}
                </span>
                <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {monitorData.knowledgeBase.megaTrends} Trends · {monitorData.knowledgeBase.causalEdges} Edges
                </div>
              </div>
            ) : (
              <Placeholder />
            )}
          </KPICard>
        </div>

        {/* ── Live Feed header ─────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px 8px", flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: "var(--color-text-heading, #0A0A0A)",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {de ? "Live-Aktivität" : "Live Activity"}
            {events.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 500,
                color: "var(--color-text-muted)",
              }}>
                ({events.length})
              </span>
            )}
          </span>
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              style={{
                fontSize: 11, color: "var(--color-text-muted, #6B6B6B)",
                background: "transparent", border: "none",
                cursor: "pointer", padding: "2px 6px",
              }}
            >
              {de ? "Löschen" : "Clear"}
            </button>
          )}
        </div>

        {/* ── Live Feed (scrollable) ───────────────────────────────────── */}
        <div
          ref={feedRef}
          style={{
            flex: 1, overflowY: "auto", padding: "0 20px 16px",
            display: "flex", flexDirection: "column", gap: 6,
          }}
        >
          {events.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 0",
              color: "var(--color-text-muted, #6B6B6B)", fontSize: 13,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◎</div>
              <div>{de ? "Warte auf Aktivität…" : "Waiting for activity…"}</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                {de ? "Starte eine Abfrage oder Pipeline" : "Start a query or pipeline"}
              </div>
            </div>
          ) : (
            events.map((event) => <EventRow key={event.id} event={event} />)
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{
          padding: "8px 20px",
          borderTop: "1px solid var(--color-border, #E8E8E8)",
          fontSize: 10, color: "var(--color-text-muted, #999)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span>{de ? "Ctrl+M zum Umschalten" : "Ctrl+M to toggle"}</span>
          <span>{connected ? (de ? "● Verbunden" : "● Connected") : (de ? "○ Getrennt" : "○ Disconnected")}</span>
        </div>
      </aside>

      {/* Animation keyframes */}
      <style>{`
        @keyframes sis-slide-in-right {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function KPICard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: "var(--color-muted, #F7F7F7)",
      border: "1px solid var(--color-border, #E8E8E8)",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: "var(--color-text-muted, #6B6B6B)",
        textTransform: "uppercase", letterSpacing: "0.05em",
        marginBottom: 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Placeholder() {
  return (
    <span style={{ fontSize: 14, color: "var(--color-text-muted, #999)" }}>—</span>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const isError = event.phase === "error";
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 6,
      background: isError ? "rgba(220,38,38,0.06)" : "rgba(0,0,0,0.02)",
      border: `1px solid ${isError ? "rgba(220,38,38,0.15)" : "rgba(0,0,0,0.04)"}`,
      fontSize: 12,
    }}>
      {/* Event header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 12, lineHeight: 1, width: 14, textAlign: "center" }}>
          {PHASE_ICONS[event.phase] || "•"}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          color: TYPE_COLORS[event.type] || "#6B6B6B",
          letterSpacing: "0.04em",
        }}>
          {event.type}
        </span>
        <span style={{
          fontSize: 10, color: "var(--color-text-muted, #aaa)",
          background: "rgba(0,0,0,0.04)", padding: "1px 5px",
          borderRadius: 3,
        }}>
          {event.phase}
        </span>
        <span style={{
          fontSize: 10, color: "var(--color-text-muted, #999)",
          fontFamily: "var(--volt-font-mono, monospace)",
          marginLeft: "auto",
        }}>
          {formatTime(event.timestamp)}
        </span>
      </div>

      {/* Message */}
      <div style={{
        color: "var(--color-text-primary, #333)", lineHeight: 1.4,
        paddingLeft: 20,
      }}>
        {event.message}
      </div>

      {/* Meta tags */}
      {event.meta && Object.keys(event.meta).length > 0 && (
        <div style={{
          marginTop: 4, paddingLeft: 20,
          display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          {Object.entries(event.meta).map(([k, v]) => (
            <span
              key={k}
              style={{
                fontSize: 10, padding: "1px 5px", borderRadius: 4,
                background: "rgba(79,70,229,0.08)", color: "#4F46E5",
                fontFamily: "var(--volt-font-mono, monospace)",
              }}
            >
              {k}: {formatMeta(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
