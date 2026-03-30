"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SOURCE_REGISTRY, getSourcesByCategory } from "@/lib/trend-sources";

interface ConnectorStatus {
  name: string;
  displayName: string;
  signalCount: number;
  lastFetch: string | null;
  newestHours: number | null;
  status: "ok" | "stale" | "inactive";
}

interface StatusData {
  connectors: ConnectorStatus[];
  totalSignals: number;
  healthy: number;
  stale: number;
  inactive: number;
}

function timeAgo(hours: number | null, de: boolean): string {
  if (hours === null) return de ? "Noch keine Daten" : "No data yet";
  if (hours < 1) return de ? "Gerade eben" : "Just now";
  if (hours < 24) return de ? `vor ${Math.round(hours)}h` : `${Math.round(hours)}h ago`;
  return de ? `vor ${Math.round(hours / 24)}d` : `${Math.round(hours / 24)}d ago`;
}

// Signal colors are semantic — kept as fixed values, not theme tokens
const SIG_GREEN  = "#1A9E5A";
const SIG_AMBER  = "#F5A623";
const SIG_MUTED  = "var(--color-text-muted)";

export default function SourcesPage() {
  const [tab, setTab] = useState<"connectors" | "sources">("connectors");
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locale, setLocale] = useState<"de" | "en">("de");
  const de = locale === "de";

  const sourcesByCategory = getSourcesByCategory();
  const sourceCount = Object.keys(SOURCE_REGISTRY).length;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/sources/status");
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    try {
      const stored = localStorage.getItem("sis-locale");
      if (stored === "en") setLocale("en");
    } catch {}
  }, [fetchStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/v1/signals", { method: "POST" });
      await fetchStatus();
    } catch {}
    setRefreshing(false);
  };

  const statusColor = (s: ConnectorStatus["status"]) =>
    s === "ok" ? SIG_GREEN : s === "stale" ? SIG_AMBER : SIG_MUTED;

  const statusLabel = (s: ConnectorStatus["status"]) =>
    ({ ok: de ? "Aktiv" : "Active", stale: de ? "Veraltet" : "Stale", inactive: de ? "Inaktiv" : "Inactive" }[s]);

  const accessColor = (access?: string) =>
    ({ free: SIG_GREEN, freemium: SIG_AMBER, paid: "#E8402A" }[access ?? ""] ?? "var(--color-text-muted)");

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-surface)", color: "var(--color-text-primary)" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logo mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "var(--radius-sm)",
              background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--color-brand-text)", letterSpacing: "0.05em",
            }}>SIS</div>
            <Link href="/"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"}
            >
              ← {de ? "Zurück" : "Back"}
            </Link>
          </div>

          <span style={{ color: "var(--color-border-strong)", fontSize: 16 }}>|</span>

          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-heading)" }}>
            {de ? "Datenquellen & Connectors" : "Data Sources & Connectors"}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {(["de", "en"] as const).map(l => (
              <button key={l} onClick={() => { setLocale(l); try { localStorage.setItem("sis-locale", l); } catch {} }}
                style={{
                  padding: "3px 10px", borderRadius: "var(--radius-full)",
                  border: `1px solid ${locale === l ? "rgba(0,0,0,0.12)" : "var(--color-border)"}`,
                  background: locale === l ? "var(--color-brand-light)" : "transparent",
                  color: locale === l ? "var(--color-brand)" : "var(--color-text-muted)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                }}
              >{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex" }}>
          {[
            { key: "connectors", label: `Live-Connectors${data ? ` (${data.connectors.length})` : ""}` },
            { key: "sources",    label: `${de ? "Institutionelle Quellen" : "Institutional Sources"} (${sourceCount})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              style={{
                padding: "12px 20px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "var(--color-text-heading)" : "var(--color-text-muted)",
                borderBottom: tab === t.key ? "2px solid var(--color-brand-light)" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* ══ TAB 1: Live Connectors ══════════════════════════════ */}
        {tab === "connectors" && (
          <>
            {/* Summary + refresh bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
              {data && (
                <>
                  <StatPill label={de ? "Aktiv" : "Active"}   value={data.healthy}  color={SIG_GREEN} />
                  <StatPill label={de ? "Veraltet" : "Stale"} value={data.stale}    color={SIG_AMBER} />
                  <StatPill label={de ? "Inaktiv" : "Inactive"} value={data.inactive} color="var(--color-text-muted)" />
                  <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    <span style={{ color: "var(--color-text-heading)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {data.totalSignals.toLocaleString()}
                    </span>
                    {" "}{de ? "Signale (72h)" : "signals (72h)"}
                  </span>
                </>
              )}
              <div style={{ marginLeft: "auto" }}>
                <button onClick={handleRefresh} disabled={refreshing}
                  style={{
                    padding: "7px 16px", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "transparent",
                    color: refreshing ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                    fontSize: 12, fontWeight: 600,
                    cursor: refreshing ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                  onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-brand-light)"; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
                >
                  <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
                  {refreshing ? (de ? "Aktualisiere…" : "Refreshing…") : (de ? "Jetzt aktualisieren" : "Refresh now")}
                </button>
              </div>
            </div>

            {/* Connector grid */}
            {loading ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 13, padding: "48px 0", textAlign: "center" }}>
                {de ? "Lade Status…" : "Loading status…"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                {(data?.connectors ?? []).map(c => (
                  <div key={c.name} style={{
                    padding: "14px 16px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = "var(--color-border-strong)";
                      el.style.boxShadow = "var(--shadow-sm)";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = "var(--color-border)";
                      el.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: statusColor(c.status), flexShrink: 0,
                        boxShadow: c.status === "ok" ? `0 0 5px ${SIG_GREEN}55` : "none",
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.displayName}
                      </span>
                      {c.signalCount > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          background: "var(--color-brand-light)", color: "var(--color-brand-text)",
                          borderRadius: "var(--radius-full)", padding: "1px 8px", flexShrink: 0,
                        }}>
                          {c.signalCount}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{timeAgo(c.newestHours, de)}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: statusColor(c.status) }}>{statusLabel(c.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ TAB 2: Institutional Sources ════════════════════════ */}
        {tab === "sources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {Object.entries(sourcesByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, sources]) => (
              <div key={category}>
                <div className="section-label" style={{ marginBottom: 12 }}>
                  {category}
                  <span style={{ color: "var(--color-text-muted)", fontWeight: 400, marginLeft: 6 }}>({sources.length})</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                  {sources.map(s => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{
                        padding: "12px 14px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        textDecoration: "none", display: "block",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = "var(--color-brand-light)";
                        el.style.boxShadow = "var(--shadow-sm)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = "var(--color-border)";
                        el.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, overflow: "hidden", flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-heading)", flexShrink: 0 }}>{s.shortName}</span>
                          <span style={{ fontSize: 12, color: "var(--color-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                        </div>
                        {s.access && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, flexShrink: 0,
                            color: accessColor(s.access),
                            background: accessColor(s.access) + "18",
                            border: `1px solid ${accessColor(s.access)}33`,
                            borderRadius: "var(--radius-full)", padding: "1px 7px",
                          }}>
                            {s.access === "free" ? "Free" : s.access === "freemium" ? "Freemium" : "Paid"}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.description}
                        </div>
                      )}
                      {s.geoFocus && (
                        <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>🌍 {s.geoFocus}</div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
        <span style={{ color: "var(--color-text-heading)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {" "}{label}
      </span>
    </div>
  );
}
