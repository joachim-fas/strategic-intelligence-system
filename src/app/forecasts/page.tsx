"use client";

/**
 * /forecasts — BINARY prediction-market-lite UI (Welle C Item 2, slice 3).
 *
 * Feature-flagged end-to-end: if the backend's FORECASTS_ENABLED
 * isn't set, the list endpoint returns 404 and the page renders a
 * "Feature not enabled" banner instead of the full UI. No leak
 * of button labels / table columns before the operator opts in.
 *
 * Layout: left pane = list + create form, right pane = selected
 * forecast detail with positions, stake form, and resolution
 * controls. Both panes stack vertically on narrow viewports —
 * the DesktopOnlyGate already catches <768 px so we keep the
 * layout two-pane-only.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useT } from "@/lib/locale-context";
import { useTenant } from "@/lib/tenant-context";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { CalibrationCurve, type CalibrationBucketDto } from "@/components/ui/CalibrationCurve";
import type {
  Forecast,
  ForecastDetail,
  ForecastResolution,
  ForecastState,
} from "@/lib/forecasts";

const STATE_COLOR: Record<ForecastState, string> = {
  DRAFT:             "#A0A0A0",
  OPEN:              "#1A9E5A",
  CLOSED:            "#D97706",
  PENDING_RESOLUTION: "#8B5CF6",
  RESOLVED:          "#0B6EB4",
  CANCELLED:         "#737373",
};

// Map a ForecastState enum to its i18n key. The translator is
// passed in because stateLabel is called from sub-components; a
// bound `t` from useT() gets the right strict-typed behaviour.
type Translator = (key: Parameters<ReturnType<typeof useT>["t"]>[0]) => string;

function stateLabel(state: ForecastState, t: Translator): string {
  switch (state) {
    case "DRAFT":              return t("forecasts.stateDraft");
    case "OPEN":               return t("forecasts.stateOpen");
    case "CLOSED":             return t("forecasts.stateClosed");
    case "PENDING_RESOLUTION": return t("forecasts.statePending");
    case "RESOLVED":           return t("forecasts.stateResolved");
    case "CANCELLED":          return t("forecasts.stateCancelled");
  }
}

function ForecastsInner() {
  const { t } = useT();
  const { role } = useTenant();
  const router = useRouter();
  const params = useSearchParams();
  const urlId = params.get("id");

  const canCreate = role === "member" || role === "admin" || role === "owner";
  const canResolve = role === "admin" || role === "owner";

  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [list, setList] = useState<Forecast[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(urlId);
  const [detail, setDetail] = useState<ForecastDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Array<{ userId: string; totalResolved: number; meanBrier: number }> | null>(null);
  const [lbOpen, setLbOpen] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetchWithTimeout("/api/v1/forecasts?limit=100", {}, 5000);
      if (res.status === 404) {
        setFeatureEnabled(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeatureEnabled(true);
      const json = await res.json();
      setList(json.data?.forecasts ?? []);
    } catch {
      setFeatureEnabled(false);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Leaderboard loads separately — it's optional data for the
  // header; a 404 here just means "no one has resolved enough
  // yet", which is fine and the UI absorbs gracefully.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithTimeout("/api/v1/forecasts/calibration", {}, 5000);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setLeaderboard(json.data?.leaderboard ?? []);
      } catch { /* optional data; silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/v1/forecasts/${id}`, {}, 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDetail(json.data);
    } catch (err) {
      setActionError(String(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Auto-select first item on landing, and track selection in URL.
  useEffect(() => {
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
  }, [list, selectedId]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!selectedId) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("id") !== selectedId) {
      u.searchParams.set("id", selectedId);
      router.replace(u.pathname + u.search);
    }
  }, [selectedId, router]);

  // ── Feature-off splash ──────────────────────────────────────────
  if (featureEnabled === false) {
    return (
      <div style={{ maxWidth: 680, margin: "80px auto", padding: 24, textAlign: "center" as const }}>
        <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 16 }}>◧</div>
        <h1 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 20, margin: "0 0 8px" }}>
          {t("forecasts.featureOffHeading")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
          {t("forecasts.featureOffBody")}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 1360, margin: "0 auto", padding: "40px 24px 80px",
      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
          textTransform: "uppercase" as const, color: "var(--color-text-faint)",
          marginBottom: 4,
        }}>
          {t("forecasts.caption")}
        </div>
        <h1 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em",
          margin: 0,
        }}>
          {t("forecasts.heading")}
        </h1>
        <p style={{
          fontSize: 13, color: "var(--color-text-muted)",
          margin: "6px 0 0", maxWidth: 680, lineHeight: 1.55,
        }}>
          {t("forecasts.body")}
        </p>
      </div>

      {/* Team calibration leaderboard — collapsible header strip.
           Only renders when we actually have leaderboard data; a
           fresh tenant with zero resolved forecasts sees no strip
           instead of an empty table. */}
      {leaderboard && leaderboard.length > 0 && (
        <div style={{
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          marginBottom: 20,
          overflow: "hidden",
        }}>
          <button
            type="button"
            onClick={() => setLbOpen((v) => !v)}
            style={{
              width: "100%", textAlign: "left" as const,
              padding: "10px 14px", border: "none",
              background: "var(--color-surface-2, #FAFAFA)",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
              fontFamily: "inherit",
            }}
          >
            <span style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "var(--color-text-muted)",
            }}>
              {t("forecasts.leaderboardHeading")}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {t(
                leaderboard.length === 1 ? "forecasts.leaderboardSubtitleOne" : "forecasts.leaderboardSubtitleMany",
                { n: leaderboard.length },
              )}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-muted)" }}>
              {lbOpen ? "▴" : "▾"}
            </span>
          </button>
          {lbOpen && (
            <div style={{ padding: "8px 14px 12px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--color-text-muted)" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>#</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>{t("forecasts.leaderboardUserCol")}</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>{t("forecasts.leaderboardPredictionsCol")}</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>Ø Brier</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r, i) => (
                    <tr key={r.userId} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "4px 8px", color: "var(--color-text-muted)", fontFamily: "var(--volt-font-mono)" }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: "4px 8px", fontFamily: "var(--volt-font-mono)" }}>
                        {r.userId.slice(0, 8)}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--volt-font-mono)" }}>
                        {r.totalResolved}
                      </td>
                      <td style={{
                        padding: "4px 8px", textAlign: "right",
                        fontFamily: "var(--volt-font-mono)", fontWeight: 700,
                        color: r.meanBrier < 0.10 ? "#1A9E5A"
                          : r.meanBrier < 0.25 ? "#D97706" : "#C4241B",
                      }}>
                        {r.meanBrier.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{
                fontSize: 10, color: "var(--color-text-faint)",
                marginTop: 6, fontFamily: "var(--volt-font-mono)",
              }}>
                {t("forecasts.leaderboardLegend")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create button */}
      {canCreate && !createOpen && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid var(--color-border)",
            background: "var(--volt-lime, #E4FF97)", color: "var(--volt-text, #0A0A0A)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            marginBottom: 20,
          }}
        >
          {t("forecasts.newForecastButton")}
        </button>
      )}

      {createOpen && (
        <CreateForm
          onCancel={() => setCreateOpen(false)}
          onCreated={(f) => {
            setCreateOpen(false);
            setList((prev) => [f, ...prev.filter((x) => x.id !== f.id)]);
            setSelectedId(f.id);
          }}
        />
      )}

      {/* Two-pane layout */}
      {listLoading && <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{t("forecasts.loading")}</div>}
      {!listLoading && list.length === 0 && !createOpen && (
        <div style={{
          padding: "32px 24px", textAlign: "center" as const,
          border: "1px dashed var(--color-border)", borderRadius: 10,
          color: "var(--color-text-muted)", fontSize: 13,
        }}>
          {t("forecasts.emptyList")}
        </div>
      )}

      {list.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 20 }}>
          <aside style={{
            border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden",
            maxHeight: "calc(100vh - 260px)", overflowY: "auto",
          }}>
            {list.map((f) => {
              const active = f.id === selectedId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left" as const,
                    padding: "10px 14px", border: "none",
                    borderBottom: "1px solid var(--color-border)",
                    background: active ? "rgba(228,255,151,0.35)" : "transparent",
                    cursor: "pointer", fontFamily: "inherit", color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, marginBottom: 4, lineHeight: 1.35 }}>
                    {f.question}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase" as const,
                      padding: "1px 6px", borderRadius: 10,
                      background: `${STATE_COLOR[f.state]}22`,
                      color: STATE_COLOR[f.state],
                    }}>
                      {stateLabel(f.state, t)}
                    </span>
                  </div>
                </button>
              );
            })}
          </aside>

          <section>
            {detailLoading && (
              <div style={{ padding: 14, color: "var(--color-text-muted)", fontSize: 13 }}>
                {t("forecasts.loadingDetails")}
              </div>
            )}
            {detail && !detailLoading && (
              <DetailPanel
                key={detail.id}
                detail={detail}
                canResolve={canResolve}
                canStake={canCreate}
                onChange={() => {
                  loadDetail(detail.id);
                  loadList();
                }}
                setError={setActionError}
              />
            )}
            {actionError && (
              <div style={{
                marginTop: 12, padding: 10, fontSize: 12,
                color: "var(--volt-negative-text, #991B1B)",
                background: "var(--volt-negative-light, #FEF2F2)",
                border: "1px solid var(--volt-negative-border, #FECACA)",
                borderRadius: 8,
              }}>
                {actionError}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ─── Create form ────────────────────────────────────────────────
function CreateForm({
  onCancel, onCreated,
}: {
  onCancel: () => void;
  onCreated: (f: Forecast) => void;
}) {
  const { t } = useT();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithTimeout("/api/v1/forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          description: description.trim() || null,
        }),
      }, 5000);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      onCreated(json.data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{
      border: "1px solid var(--color-border)", borderRadius: 10,
      padding: 16, marginBottom: 20,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {t("forecasts.newForecastHeading")}
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t("forecasts.questionPlaceholder")}
        required
        maxLength={500}
        style={{ padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("forecasts.descriptionPlaceholder")}
        rows={3}
        maxLength={4000}
        style={{ padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical" as const }}
      />
      {err && <div style={{ fontSize: 11, color: "var(--volt-negative-text)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy || !question.trim()} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
          background: "var(--volt-lime, #E4FF97)", cursor: busy ? "wait" : "pointer",
          fontWeight: 600, fontSize: 12, opacity: busy || !question.trim() ? 0.6 : 1,
        }}>
          {busy ? t("forecasts.createSaving") : t("forecasts.createSubmit")}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
          background: "transparent", cursor: "pointer", fontSize: 12,
        }}>
          {t("forecasts.cancel")}
        </button>
      </div>
    </form>
  );
}

// ─── Detail panel ───────────────────────────────────────────────
function DetailPanel({
  detail, canResolve, canStake, onChange, setError,
}: {
  detail: ForecastDetail;
  canResolve: boolean;
  canStake: boolean;
  onChange: () => void;
  setError: (msg: string | null) => void;
}) {
  const { t } = useT();
  return (
    <article style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 18 }}>
      <header style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            padding: "1px 7px", borderRadius: 10,
            background: `${STATE_COLOR[detail.state]}22`, color: STATE_COLOR[detail.state],
          }}>{stateLabel(detail.state, t)}</span>
        </div>
        <h2 style={{ fontFamily: "var(--volt-font-display)", fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
          {detail.question}
        </h2>
        {detail.description && (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.55 }}>
            {detail.description}
          </p>
        )}
      </header>

      {/* Derived probability */}
      {detail.derivedYesProbability != null && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 14,
          background: "rgba(228,255,151,0.20)", border: "1px solid rgba(184,210,117,0.40)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {t("forecasts.teamConsensus")}
          </span>
          <ConfidenceBadge value={detail.derivedYesProbability} size="sm" showLabel={false} />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: "auto" }}>
            {t("forecasts.positionCountPrefix")}{detail.positions.length}{t("forecasts.positionCountSuffix")}
          </span>
        </div>
      )}

      {/* Resolution display */}
      {detail.resolution && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 14,
          background: detail.state === "RESOLVED" ? "rgba(11,110,180,0.12)" : "rgba(139,92,246,0.12)",
          border: `1px solid ${detail.state === "RESOLVED" ? "rgba(11,110,180,0.35)" : "rgba(139,92,246,0.40)"}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
            {detail.state === "RESOLVED"
              ? t("forecasts.resolvedAs")
              : t("forecasts.proposedAs")}
            {" "}{detail.resolution}
          </div>
          {detail.resolutionRationale && (
            <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-text-primary)" }}>
              {detail.resolutionRationale}
            </div>
          )}
        </div>
      )}

      {/* Stake form */}
      {detail.state === "OPEN" && canStake && (
        <StakeForm detail={detail} onStaked={onChange} setError={setError} />
      )}

      {/* Resolve controls */}
      {canResolve && (detail.state === "OPEN" || detail.state === "CLOSED" || detail.state === "PENDING_RESOLUTION") && (
        <ResolveControls detail={detail} onChanged={onChange} setError={setError} />
      )}

      {/* Positions list — each row carries a lightweight calibration
          summary for the user (Welle C Item 3). The badge shows
          the user's average Brier across all resolved forecasts
          they've staked on, so viewers can weight each position
          by the historical track record. */}
      {detail.positions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase" as const, color: "var(--color-text-faint)",
            marginBottom: 6,
          }}>
            {t("forecasts.positions")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.positions.map((p) => (
              <PositionRow key={p.id} position={p} tenantForecastId={detail.id} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Position row with lazy calibration chip + expandable curve ─
function PositionRow({
  position,
}: {
  position: ForecastDetail["positions"][number];
  tenantForecastId: string;
}) {
  const { t, de } = useT();
  const [calib, setCalib] = useState<{
    meanBrier: number | null;
    totalResolved: number;
    buckets: CalibrationBucketDto[];
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch once on mount — the endpoint is tenant-scoped + already
  // short-cache-friendly, and we only do one call per row.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithTimeout(
          `/api/v1/forecasts/calibration/${encodeURIComponent(position.userId)}`,
          {},
          4000,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setCalib({
            meanBrier: json.data?.meanBrier ?? null,
            totalResolved: json.data?.totalResolved ?? 0,
            buckets: json.data?.buckets ?? [],
          });
        }
      } catch {
        /* swallow — calibration chip is nice-to-have */
      }
    })();
    return () => { cancelled = true; };
  }, [position.userId]);

  // Render the calibration chip ONLY when the user has at least
  // one resolved prediction; showing "0 resolved" on a fresh tenant
  // would be visual noise.
  const hasCalib = calib && calib.totalResolved > 0 && calib.meanBrier != null;
  const calibLabel = hasCalib
    ? `Brier ${calib!.meanBrier!.toFixed(2)} (${calib!.totalResolved})`
    : null;
  const calibTooltip = calibLabel
    ? t("forecasts.calibrationChipTooltip", { count: String(calib?.totalResolved ?? 0) })
    : undefined;
  // Tier the Brier visually: <0.10 is well-calibrated, 0.10–0.25 is
  // okay, >0.25 is questionable. These thresholds match the
  // Stanford convention referenced in src/lib/forecasts.ts docs.
  const calibColor = calib?.meanBrier == null
    ? "var(--color-text-muted)"
    : calib.meanBrier < 0.10
      ? "#1A9E5A"
      : calib.meanBrier < 0.25
        ? "#D97706"
        : "#C4241B";

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 10px", border: "1px solid var(--color-border)",
        borderRadius: expanded ? "6px 6px 0 0" : 6,
        borderBottom: expanded ? "none" : undefined,
        fontSize: 12,
      }}>
        <span style={{ fontFamily: "var(--volt-font-mono)", color: "var(--color-text-muted)", fontSize: 11 }}>
          {position.userId.slice(0, 8)}
        </span>
        <ConfidenceBadge value={position.yesProbability} size="xs" showLabel={false} />
        {position.rationale && (
          <span style={{ flex: 1, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {position.rationale}
          </span>
        )}
        {calibLabel && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={calibTooltip}
            style={{
              fontFamily: "var(--volt-font-mono)",
              fontSize: 9, fontWeight: 700,
              padding: "1px 6px", borderRadius: 10,
              background: expanded ? "var(--volt-lime, #E4FF97)" : "var(--color-surface-2, #F5F5F5)",
              color: calibColor,
              flexShrink: 0,
              border: "1px solid var(--color-border)",
              cursor: "pointer",
            }}
          >
            {calibLabel} {expanded ? "▴" : "▾"}
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-text-faint)" }}>
          {new Date(position.stakedAt).toLocaleDateString()}
        </span>
      </div>
      {expanded && calib && (
        <div style={{
          border: "1px solid var(--color-border)",
          borderTop: "none",
          borderRadius: "0 0 6px 6px",
          padding: "12px 14px",
          background: "var(--color-surface-2, #FAFAFA)",
          display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap",
        }}>
          <CalibrationCurve
            buckets={calib.buckets}
            totalResolved={calib.totalResolved}
            meanBrier={calib.meanBrier}
            de={de}
            size={220}
          />
        </div>
      )}
    </>
  );
}

// ─── Stake form ─────────────────────────────────────────────────
function StakeForm({
  detail, onStaked, setError,
}: {
  detail: ForecastDetail;
  onStaked: () => void;
  setError: (msg: string | null) => void;
}) {
  const { t } = useT();
  const [prob, setProb] = useState(50);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetchWithTimeout(
        `/api/v1/forecasts/${detail.id}/positions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yesProbability: prob / 100,
            rationale: rationale.trim() || null,
          }),
        },
        5000,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      onStaked();
      setRationale("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{
      padding: "10px 12px", borderRadius: 8, marginBottom: 14,
      background: "var(--color-surface-2, #FAFAFA)",
      border: "1px solid var(--color-border)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--color-text-muted)" }}>
        {t("forecasts.yourEstimate")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="range"
          min={0} max={100} step={1}
          value={prob}
          onChange={(e) => setProb(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 13, fontWeight: 700, width: 52, textAlign: "right" as const }}>
          {prob}% YES
        </span>
      </div>
      <input
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder={t("forecasts.rationalePlaceholder")}
        maxLength={2000}
        style={{ padding: "6px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
      />
      <button type="submit" disabled={busy} style={{
        padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
        background: "var(--volt-lime, #E4FF97)", cursor: busy ? "wait" : "pointer",
        fontWeight: 600, fontSize: 12, alignSelf: "flex-start" as const,
      }}>
        {busy ? t("forecasts.stakeSaving") : t("forecasts.stakeSubmit")}
      </button>
    </form>
  );
}

// ─── Resolve controls ───────────────────────────────────────────
function ResolveControls({
  detail, onChanged, setError,
}: {
  detail: ForecastDetail;
  onChanged: () => void;
  setError: (msg: string | null) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<ForecastResolution>("YES");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);

  async function propose() {
    setBusy(true); setError(null);
    try {
      const res = await fetchWithTimeout(
        `/api/v1/forecasts/${detail.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "propose", resolution, rationale: rationale.trim() }),
        },
        5000,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      onChanged();
      setOpen(false);
      setRationale("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true); setError(null);
    try {
      const res = await fetchWithTimeout(
        `/api/v1/forecasts/${detail.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        },
        5000,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (detail.state === "PENDING_RESOLUTION") {
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8, marginBottom: 14,
        background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.30)",
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 12 }}>
          {t("forecasts.pendingSigSecondSignerHint")}
        </span>
        <button type="button" onClick={approve} disabled={busy} style={{
          marginLeft: "auto", padding: "6px 12px", borderRadius: 6,
          border: "1px solid rgba(139,92,246,0.5)",
          background: "rgba(139,92,246,0.15)", cursor: busy ? "wait" : "pointer",
          fontWeight: 600, fontSize: 12,
        }}>
          {busy ? t("forecasts.resolveApproving") : t("forecasts.resolveApprove")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
          background: "transparent", cursor: "pointer", fontSize: 12,
        }}>
          {t("forecasts.resolvePropose")}
        </button>
      ) : (
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: "var(--color-surface-2, #FAFAFA)",
          border: "1px solid var(--color-border)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["YES", "NO", "PARTIAL", "CANCEL"] as ForecastResolution[]).map((r) => (
              <button key={r} type="button" onClick={() => setResolution(r)} style={{
                padding: "4px 10px", borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: resolution === r ? "var(--volt-lime, #E4FF97)" : "transparent",
                cursor: "pointer", fontSize: 11, fontFamily: "var(--volt-font-mono)",
                fontWeight: 700,
              }}>
                {r}
              </button>
            ))}
          </div>
          <input
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder={t("forecasts.resolveRationalePlaceholder")}
            maxLength={2000}
            style={{ padding: "6px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={propose} disabled={busy || !rationale.trim()} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
              background: "var(--volt-lime, #E4FF97)", cursor: busy || !rationale.trim() ? "wait" : "pointer",
              fontWeight: 600, fontSize: 12, opacity: busy || !rationale.trim() ? 0.6 : 1,
            }}>
              {busy ? t("forecasts.resolveSaving") : t("forecasts.resolveSubmit")}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
              background: "transparent", cursor: "pointer", fontSize: 12,
            }}>
              {t("forecasts.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ForecastsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <ForecastsInner />
    </Suspense>
  );
}
