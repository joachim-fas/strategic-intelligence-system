"use client";

/**
 * /clusters — cluster history viewer.
 *
 * Welle B Item 2 read surface. Two-pane layout: catalogue list on
 * the left (from /api/v1/clusters) and a selected cluster's
 * snapshot timeline on the right (/api/v1/clusters/[id]/history).
 *
 * Intentionally plain — no dedicated design system primitives, just
 * inline styles consistent with the Volt UI tokens. The value is
 * transparency: if the pipeline is writing snapshots (and if the
 * operator has enabled CLUSTER_DIFF_LLM_ENABLED or
 * CLUSTER_FORESIGHT_LLM_ENABLED), this page is where the evolution
 * becomes visible.
 *
 * When there are no snapshots (fresh install), the page shows the
 * DataGapHint so the user understands the cause rather than seeing
 * an enigmatic blank screen.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useT } from "@/lib/locale-context";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { DataGapHint } from "@/components/ui/DataGapHint";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";

interface ClusterCatalogEntry {
  clusterId: string;
  topic: string;
  latestAt: string;
  snapshotCount: number;
  latestSignalCount: number;
}

interface ClusterSnapshotDto {
  id: string;
  triggeredAt: string;
  signalCount: number;
  signalIds: string[];
  summary: string;
  changelog: string | null;
  foresight:
    | Array<{ scenario: string; confidence: number; drivers: string[] }>
    | null;
}

interface HistoryPayload {
  clusterId: string;
  topic: string | null;
  count: number;
  snapshots: ClusterSnapshotDto[];
}

function ClustersInner() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const urlClusterId = params.get("id");

  const [catalog, setCatalog] = useState<ClusterCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [selected, setSelected] = useState<string | null>(urlClusterId);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Fetch catalog once on mount. Silent on cache misses — if the
  // endpoint isn't ready yet (fresh clone), catalog stays null and
  // the empty-state renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithTimeout("/api/v1/clusters", {}, 5000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setCatalog(json.data?.clusters ?? []);
      } catch {
        if (!cancelled) setCatalogError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-select the first cluster if the URL didn't pin one and the
  // catalogue has data. Keeps the right pane non-empty on first
  // landing.
  useEffect(() => {
    if (!selected && catalog && catalog.length > 0) {
      setSelected(catalog[0].clusterId);
    }
  }, [catalog, selected]);

  // Fetch history whenever the selected cluster changes. Aborts the
  // in-flight request via cancelled-closure pattern so fast
  // left-pane clicks don't race.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    (async () => {
      try {
        const res = await fetchWithTimeout(
          `/api/v1/clusters/${encodeURIComponent(selected)}/history?limit=50`,
          {},
          5000,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setHistory(json.data);
      } catch (err) {
        if (!cancelled) setHistoryError(String(err));
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  // Push the selected cluster to the URL so the page is shareable +
  // browser-back works. `router.replace` — no extra history entry
  // per click.
  useEffect(() => {
    if (!selected) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("id") !== selected) {
      u.searchParams.set("id", selected);
      router.replace(u.pathname + u.search);
    }
  }, [selected, router]);

  const emptyCatalog = catalog !== null && catalog.length === 0;

  const selectedCatalogEntry = useMemo(
    () => catalog?.find((c) => c.clusterId === selected) ?? null,
    [catalog, selected],
  );

  return (
    <div style={{
      maxWidth: 1360,
      margin: "0 auto",
      padding: "40px 24px 80px",
      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      color: "var(--color-text-primary)",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
          textTransform: "uppercase", color: "var(--color-text-faint)",
          marginBottom: 6,
        }}>
          {t("clusters.caption")}
        </div>
        <h1 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em",
          margin: 0,
        }}>
          {t("clusters.heading")}
        </h1>
        <p style={{
          fontSize: 13, color: "var(--color-text-muted)",
          margin: "6px 0 0", maxWidth: 680, lineHeight: 1.55,
        }}>
          {t("clusters.body")}
        </p>
      </div>

      {/* Empty state */}
      {catalogError && (
        <div style={{ padding: 16, color: "var(--volt-negative-text)" }}>
          {t("clusters.catalogLoadFailed")}
        </div>
      )}
      {emptyCatalog && (
        <div style={{
          padding: "32px 24px", textAlign: "center",
          border: "1px dashed var(--color-border)",
          borderRadius: 10,
          fontSize: 13, color: "var(--color-text-muted)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>◷</span>
          <span>
            {t("clusters.emptyCatalog")}
          </span>
          <DataGapHint compact />
        </div>
      )}

      {/* Two-pane layout */}
      {catalog && catalog.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 320px) 1fr",
          gap: 20,
        }}>
          {/* Left: catalogue list */}
          <aside style={{
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            overflow: "hidden",
            maxHeight: "calc(100vh - 220px)",
            overflowY: "auto",
          }}>
            <div style={{
              padding: "10px 14px",
              background: "var(--color-surface-2, #FAFAFA)",
              borderBottom: "1px solid var(--color-border)",
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
              textTransform: "uppercase" as const,
              color: "var(--color-text-faint)",
            }}>
              {catalog.length} {t("clusters.clustersLabel")}
            </div>
            {catalog.map((c) => {
              const active = c.clusterId === selected;
              return (
                <button
                  key={c.clusterId}
                  type="button"
                  onClick={() => setSelected(c.clusterId)}
                  style={{
                    display: "block", width: "100%", textAlign: "left" as const,
                    padding: "10px 14px", border: "none",
                    borderBottom: "1px solid var(--color-border)",
                    background: active ? "rgba(228,255,151,0.35)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit", color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, marginBottom: 2 }}>
                    {c.topic}
                  </div>
                  <div style={{
                    fontSize: 10, color: "var(--color-text-muted)",
                    fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    letterSpacing: "0.02em",
                  }}>
                    {c.snapshotCount} {t("clusters.snapshotsLabel")} · {c.latestSignalCount} {t("clusters.signalsLabel")}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Right: snapshot timeline */}
          <section>
            {selectedCatalogEntry && (
              <div style={{ marginBottom: 16 }}>
                <h2 style={{
                  fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                  fontSize: 22, fontWeight: 700, margin: 0,
                }}>
                  {selectedCatalogEntry.topic}
                </h2>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  {t("clusters.lastUpdated")}:{" "}
                  {new Date(selectedCatalogEntry.latestAt).toLocaleString()}
                </div>
              </div>
            )}

            {historyLoading && (
              <div style={{ padding: 14, color: "var(--color-text-muted)", fontSize: 13 }}>
                {t("clusters.loadingHistory")}
              </div>
            )}
            {historyError && (
              <div style={{ padding: 14, color: "var(--volt-negative-text)" }}>
                {t("clusters.errorLabel")} {historyError}
              </div>
            )}

            {history && history.snapshots.length === 0 && !historyLoading && (
              <div style={{ padding: 14, fontSize: 13, color: "var(--color-text-muted)" }}>
                {t("clusters.noSnapshotsForCluster")}
              </div>
            )}

            {/* Snapshot timeline */}
            {history && history.snapshots.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.snapshots.map((s, i) => (
                  <article
                    key={s.id}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      background: "var(--volt-surface-raised, #fff)",
                    }}
                  >
                    {/* Timeline header: timestamp + signal count */}
                    <header style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 8,
                      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                    }}>
                      <span style={{
                        padding: "2px 7px", borderRadius: 10,
                        background: i === 0 ? "rgba(228,255,151,0.45)" : "var(--color-surface-2, #F5F5F5)",
                        color: i === 0 ? "#1A3A00" : "var(--color-text-muted)",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                      }}>
                        {i === 0 ? t("clusters.latestBadge") : `#${history.snapshots.length - i}`}
                      </span>
                      <span>{new Date(s.triggeredAt).toLocaleString()}</span>
                      <span style={{ marginLeft: "auto" }}>
                        {s.signalCount} {t("clusters.signalsLabel")}
                      </span>
                    </header>

                    {/* Changelog — only when present (i.e. LLM flag is on
                         and previous snapshot differed). */}
                    {s.changelog && (
                      <div style={{
                        fontSize: 13, lineHeight: 1.55,
                        padding: "8px 10px",
                        background: "rgba(228,255,151,0.20)",
                        border: "1px solid rgba(184,210,117,0.45)",
                        borderRadius: 6,
                        marginBottom: 8,
                      }}>
                        <span style={{
                          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                          textTransform: "uppercase" as const, marginRight: 6,
                          color: "#4A5F00",
                        }}>
                          {t("clusters.changeBadge")}
                        </span>
                        {s.changelog}
                      </div>
                    )}

                    {/* Summary — always present. */}
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-primary)" }}>
                      {s.summary}
                    </div>

                    {/* Foresight scenarios — only when generated. */}
                    {s.foresight && s.foresight.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                          textTransform: "uppercase" as const,
                          color: "var(--color-text-faint)",
                          marginBottom: 6,
                        }}>
                          {t("clusters.foresightBadge")}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {s.foresight.map((f, k) => (
                            <div key={k} style={{
                              padding: "6px 10px",
                              border: "1px solid var(--color-border)",
                              borderRadius: 6,
                              display: "flex", alignItems: "center", gap: 8,
                              flexWrap: "wrap",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{f.scenario}</span>
                              <ConfidenceBadge value={f.confidence} size="xs" showLabel={false} />
                              {f.drivers.length > 0 && (
                                <span style={{
                                  fontSize: 11, color: "var(--color-text-muted)",
                                  marginLeft: "auto",
                                }}>
                                  {f.drivers.join(" · ")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function ClustersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <ClustersInner />
    </Suspense>
  );
}
