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

function stateLabel(state: ForecastState, de: boolean): string {
  const map: Record<ForecastState, [string, string]> = {
    DRAFT:              ["Entwurf",       "Draft"],
    OPEN:               ["Offen",         "Open"],
    CLOSED:             ["Geschlossen",   "Closed"],
    PENDING_RESOLUTION: ["Auflösung läuft","Pending resolution"],
    RESOLVED:           ["Aufgelöst",     "Resolved"],
    CANCELLED:          ["Abgebrochen",   "Cancelled"],
  };
  return de ? map[state][0] : map[state][1];
}

function ForecastsInner() {
  const { de } = useT();
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
          {de ? "Forecasts noch nicht aktiviert" : "Forecasts not yet enabled"}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
          {de
            ? "Dieses Feature steht hinter der ENV-Variable FORECASTS_ENABLED. Setze sie auf 'true' und starte den Server neu, um Prognosen für dein Team zu aktivieren."
            : "This feature is gated behind the FORECASTS_ENABLED env variable. Set it to 'true' and restart the server to activate team forecasts."}
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
          {de ? "Prognosen" : "Forecasts"}
        </div>
        <h1 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em",
          margin: 0,
        }}>
          {de ? "Was glaubt das Team?" : "What does the team believe?"}
        </h1>
        <p style={{
          fontSize: 13, color: "var(--color-text-muted)",
          margin: "6px 0 0", maxWidth: 680, lineHeight: 1.55,
        }}>
          {de
            ? "Jede Frage sammelt individuelle Wahrscheinlichkeits-Einschätzungen der Team-Mitglieder. Auflösung erfordert zwei Unterschriften (Vorschlag + Bestätigung)."
            : "Each question collects individual probability estimates from team members. Resolution requires two signers (proposer + approver)."}
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
              {de ? "Team-Kalibrierung" : "Team Calibration"}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {de
                ? `${leaderboard.length} ${leaderboard.length === 1 ? "Nutzer" : "Nutzer"} mit ≥3 aufgelösten Prognosen`
                : `${leaderboard.length} user${leaderboard.length === 1 ? "" : "s"} with ≥3 resolved predictions`}
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
                    <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>{de ? "Nutzer" : "User"}</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>{de ? "Vorhersagen" : "Predictions"}</th>
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
                {de
                  ? "Niedriger = besser kalibriert. Grün <0.10 / Amber <0.25 / Rot >0.25."
                  : "Lower = better-calibrated. Green <0.10 / Amber <0.25 / Red >0.25."}
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
          {de ? "+ Neue Prognose" : "+ New forecast"}
        </button>
      )}

      {createOpen && (
        <CreateForm
          de={de}
          onCancel={() => setCreateOpen(false)}
          onCreated={(f) => {
            setCreateOpen(false);
            setList((prev) => [f, ...prev.filter((x) => x.id !== f.id)]);
            setSelectedId(f.id);
          }}
        />
      )}

      {/* Two-pane layout */}
      {listLoading && <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{de ? "Lade…" : "Loading…"}</div>}
      {!listLoading && list.length === 0 && !createOpen && (
        <div style={{
          padding: "32px 24px", textAlign: "center" as const,
          border: "1px dashed var(--color-border)", borderRadius: 10,
          color: "var(--color-text-muted)", fontSize: 13,
        }}>
          {de ? "Noch keine Prognosen. Leg die erste an, um zu starten." : "No forecasts yet. Create the first one to get started."}
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
                      {stateLabel(f.state, de)}
                    </span>
                  </div>
                </button>
              );
            })}
          </aside>

          <section>
            {detailLoading && (
              <div style={{ padding: 14, color: "var(--color-text-muted)", fontSize: 13 }}>
                {de ? "Lade Details…" : "Loading details…"}
              </div>
            )}
            {detail && !detailLoading && (
              <DetailPanel
                key={detail.id}
                detail={detail}
                de={de}
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
  de, onCancel, onCreated,
}: {
  de: boolean;
  onCancel: () => void;
  onCreated: (f: Forecast) => void;
}) {
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
        {de ? "Neue Prognose" : "New forecast"}
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={de ? "Frage (max 500 Zeichen)" : "Question (max 500 chars)"}
        required
        maxLength={500}
        style={{ padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={de ? "Beschreibung (optional)" : "Description (optional)"}
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
          {busy ? (de ? "Speichere…" : "Saving…") : (de ? "Anlegen" : "Create")}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
          background: "transparent", cursor: "pointer", fontSize: 12,
        }}>
          {de ? "Abbrechen" : "Cancel"}
        </button>
      </div>
    </form>
  );
}

// ─── Detail panel ───────────────────────────────────────────────
function DetailPanel({
  detail, de, canResolve, canStake, onChange, setError,
}: {
  detail: ForecastDetail;
  de: boolean;
  canResolve: boolean;
  canStake: boolean;
  onChange: () => void;
  setError: (msg: string | null) => void;
}) {
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
          }}>{stateLabel(detail.state, de)}</span>
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
            {de ? "Team-Konsens" : "Team consensus"}
          </span>
          <ConfidenceBadge value={detail.derivedYesProbability} size="sm" showLabel={false} />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: "auto" }}>
            {de ? `aus ${detail.positions.length} Einschätzungen` : `from ${detail.positions.length} positions`}
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
              ? (de ? "Aufgelöst als" : "Resolved as")
              : (de ? "Vorgeschlagen als" : "Proposed as")}
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
        <StakeForm detail={detail} de={de} onStaked={onChange} setError={setError} />
      )}

      {/* Resolve controls */}
      {canResolve && (detail.state === "OPEN" || detail.state === "CLOSED" || detail.state === "PENDING_RESOLUTION") && (
        <ResolveControls detail={detail} de={de} onChanged={onChange} setError={setError} />
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
            {de ? "Einschätzungen" : "Positions"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.positions.map((p) => (
              <PositionRow key={p.id} position={p} tenantForecastId={detail.id} de={de} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Position row with lazy calibration chip + expandable curve ─
function PositionRow({
  position, de,
}: {
  position: ForecastDetail["positions"][number];
  tenantForecastId: string;
  de: boolean;
}) {
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
  const calibTooltip = calibLabel && de
    ? `Durchschnittlicher Brier-Score über ${calib?.totalResolved} aufgelöste Vorhersagen. Klick für Kalibrierungs-Kurve.`
    : calibLabel
      ? `Mean Brier across ${calib?.totalResolved} resolved predictions. Click to see the calibration curve.`
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
  detail, de, onStaked, setError,
}: {
  detail: ForecastDetail;
  de: boolean;
  onStaked: () => void;
  setError: (msg: string | null) => void;
}) {
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
        {de ? "Deine Einschätzung" : "Your estimate"}
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
        placeholder={de ? "Begründung (optional)" : "Rationale (optional)"}
        maxLength={2000}
        style={{ padding: "6px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
      />
      <button type="submit" disabled={busy} style={{
        padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
        background: "var(--volt-lime, #E4FF97)", cursor: busy ? "wait" : "pointer",
        fontWeight: 600, fontSize: 12, alignSelf: "flex-start" as const,
      }}>
        {busy ? (de ? "Speichere…" : "Saving…") : (de ? "Einschätzung speichern" : "Stake")}
      </button>
    </form>
  );
}

// ─── Resolve controls ───────────────────────────────────────────
function ResolveControls({
  detail, de, onChanged, setError,
}: {
  detail: ForecastDetail;
  de: boolean;
  onChanged: () => void;
  setError: (msg: string | null) => void;
}) {
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
          {de
            ? "Warte auf zweite Unterschrift (Vorschlag kann nicht vom selben Nutzer bestätigt werden)."
            : "Awaiting second signer (proposer cannot self-approve)."}
        </span>
        <button type="button" onClick={approve} disabled={busy} style={{
          marginLeft: "auto", padding: "6px 12px", borderRadius: 6,
          border: "1px solid rgba(139,92,246,0.5)",
          background: "rgba(139,92,246,0.15)", cursor: busy ? "wait" : "pointer",
          fontWeight: 600, fontSize: 12,
        }}>
          {busy ? (de ? "Bestätige…" : "Approving…") : (de ? "Bestätigen" : "Approve")}
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
          {de ? "Auflösung vorschlagen" : "Propose resolution"}
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
            placeholder={de ? "Begründung (Pflicht)" : "Rationale (required)"}
            maxLength={2000}
            style={{ padding: "6px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={propose} disabled={busy || !rationale.trim()} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
              background: "var(--volt-lime, #E4FF97)", cursor: busy || !rationale.trim() ? "wait" : "pointer",
              fontWeight: 600, fontSize: 12, opacity: busy || !rationale.trim() ? 0.6 : 1,
            }}>
              {busy ? (de ? "Speichere…" : "Saving…") : (de ? "Vorschlag abgeben" : "Submit proposal")}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
              background: "transparent", cursor: "pointer", fontSize: 12,
            }}>
              {de ? "Abbrechen" : "Cancel"}
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
