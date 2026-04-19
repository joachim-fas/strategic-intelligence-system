"use client";

import React, { useMemo } from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { StepCard } from "@/components/frameworks/StepCard";
import { MatrixChart } from "@/components/frameworks/MatrixChart";
import { ScenarioCards } from "@/components/frameworks/ScenarioCards";
import { VoltTable } from "@/components/volt";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";

/* ---------- constants ---------- */

const ACCENT = "#1A4A8A";
const BORDER = "#C0D8F4";

const STEEP_COLORS: Record<string, string> = {
  social:        "#6366F1",
  technological: "#0EA5E9",
  economic:      "#F59E0B",
  environmental: "#10B981",
  political:     "#EF4444",
};

const REGULATION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:  { bg: "#DCFCE7", text: "#166534" },
  planned: { bg: "#FEF9C3", text: "#854D0E" },
  draft:   { bg: "#F3F4F6", text: "#6B7280" },
};

/* ---------- helper: safe array ---------- */

function safeArr<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

/* ---------- helper: format large numbers ---------- */

function fmtNum(v: unknown): string {
  if (v == null) return "-";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return n.toLocaleString();
}

/* ---------- page ---------- */

export default function MarktanalysePage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("marktanalyse")}>
      {({ topic, locale, de, projectId }) => (
        <MarktanalyseContent topic={topic} locale={locale} de={de} projectId={projectId} />
      )}
    </FrameworkShell>
  );
}

/* ---------- content ---------- */

interface ContentProps {
  topic: string;
  locale: string;
  de: boolean;
  projectId?: string | null;
}

function MarktanalyseContent({ topic, locale, de, projectId }: ContentProps) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const { steps, runStep } = useFrameworkAnalysis("marktanalyse", projectId);

  /* convenience accessors */
  const s1 = steps["market-structure"];
  const s2 = steps["competitor-radar"];
  const s3 = steps["trends-regulation"];
  const s4 = steps["benchmarking"];

  /* collect previous-step data for context */
  const prevFor2 = useMemo(
    () => s1?.status === "done" ? { "market-structure": s1.data } : undefined,
    [s1],
  );
  const prevFor3 = useMemo(
    () => {
      const out: Record<string, unknown> = {};
      if (s1?.status === "done") out["market-structure"] = s1.data;
      if (s2?.status === "done") out["competitor-radar"] = s2.data;
      return Object.keys(out).length > 0 ? out : undefined;
    },
    [s1, s2],
  );
  const prevForAll = useMemo(
    () => {
      const out: Record<string, unknown> = {};
      if (s1?.status === "done") out["market-structure"] = s1.data;
      if (s2?.status === "done") out["competitor-radar"] = s2.data;
      if (s3?.status === "done") out["trends-regulation"] = s3.data;
      return Object.keys(out).length > 0 ? out : undefined;
    },
    [s1, s2, s3],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ---- Step 1: Marktstruktur ---- */}
      <StepCard
        stepId="market-structure"
        title={tl("marktanalyse.step1Title")}
        description={tl("marktanalyse.step1Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={s1}
        onRun={() => runStep("market-structure", topic, locale)}
        de={de}
      >
        {s1?.status === "done" && s1.data && (
          <MarketStructureViz data={s1.data} de={de} />
        )}
      </StepCard>

      {/* ---- Step 2: Wettbewerber-Radar ---- */}
      <StepCard
        stepId="competitor-radar"
        title={tl("marktanalyse.step2Title")}
        description={tl("marktanalyse.step2Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={s2}
        onRun={() => runStep("competitor-radar", topic, locale, prevFor2)}
        disabled={s1?.status !== "done"}
        de={de}
      >
        {s2?.status === "done" && s2.data && (
          <CompetitorRadarViz data={s2.data} de={de} />
        )}
      </StepCard>

      {/* ---- Step 3: Trends & Regulierung ---- */}
      <StepCard
        stepId="trends-regulation"
        title={tl("marktanalyse.step3Title")}
        description={tl("marktanalyse.step3Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={s3}
        onRun={() => runStep("trends-regulation", topic, locale, prevFor3)}
        disabled={s1?.status !== "done"}
        de={de}
      >
        {s3?.status === "done" && s3.data && (
          <TrendsRegulationViz data={s3.data} de={de} />
        )}
      </StepCard>

      {/* ---- Step 4: Benchmarking ---- */}
      <StepCard
        stepId="benchmarking"
        title="Benchmarking"
        description={tl("marktanalyse.step4Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={s4}
        onRun={() => runStep("benchmarking", topic, locale, prevForAll)}
        disabled={s1?.status !== "done" || s2?.status !== "done" || s3?.status !== "done"}
        de={de}
      >
        {s4?.status === "done" && s4.data && (
          <BenchmarkingViz data={s4.data} de={de} />
        )}
      </StepCard>
    </div>
  );
}

/* ==================================================================
   Step 1 – Market Structure Visualization
   ================================================================== */

interface MarketStructureData {
  tam?: number | string;
  sam?: number | string;
  som?: number | string;
  tamLabel?: string;
  samLabel?: string;
  somLabel?: string;
  cagr?: number | string;
  segments?: { name: string; share: number; color?: string }[];
  keyPlayers?: { name: string; marketShare?: number | string; strength?: string }[];
  synthesis?: string;
}

function MarketStructureViz({ data, de }: { data: MarketStructureData; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const d = data ?? {};
  const segments = safeArr<{ name: string; share: number; color?: string }>(d.segments);
  const players = safeArr<{ name: string; marketShare?: number | string; strength?: string }>(d.keyPlayers);
  const totalShare = segments.reduce((sum, s) => sum + (s.share || 0), 0) || 1;

  const DEFAULT_SEGMENT_COLORS = [
    "#1A4A8A", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE", "#6366F1", "#818CF8", "#A5B4FC",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {d.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {d.synthesis}
        </p>
      )}

      {/* TAM / SAM / SOM stat boxes */}
      <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: d.tamLabel || "TAM", value: d.tam },
          { label: d.samLabel || "SAM", value: d.sam },
          { label: d.somLabel || "SOM", value: d.som },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "10px 18px",
              background: "#EEF5FF",
              minWidth: 110,
              textAlign: "center",
            }}
          >
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--muted-foreground)",
              fontFamily: "var(--font-mono)", marginBottom: 4,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: ACCENT,
              fontFamily: "var(--font-display)", lineHeight: 1.2,
            }}>
              {value != null ? fmtNum(value) : "-"}
            </div>
          </div>
        ))}

        {/* CAGR badge */}
        {d.cagr != null && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: "10px 18px",
            background: "#EEF5FF", minWidth: 90, textAlign: "center",
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)", marginBottom: 4,
              }}>
                CAGR
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: "#0F6038",
                fontFamily: "var(--font-mono)", lineHeight: 1.2,
              }}>
                {typeof d.cagr === "number"
                  ? `${d.cagr > 1 ? d.cagr.toFixed(1) : (d.cagr * 100).toFixed(1)}%`
                  : d.cagr}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Segment bar */}
      {segments.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)", marginBottom: 6,
          }}>
            {tl("marktanalyse.segments")}
          </div>
          <div style={{
            display: "flex", borderRadius: 8, overflow: "hidden",
            height: 28, border: `1px solid ${BORDER}`,
          }}>
            {segments.map((seg, i) => {
              const pct = ((seg.share || 0) / totalShare) * 100;
              const color = seg.color || DEFAULT_SEGMENT_COLORS[i % DEFAULT_SEGMENT_COLORS.length];
              return (
                <div
                  key={i}
                  title={`${seg.name}: ${pct.toFixed(1)}%`}
                  style={{
                    width: `${pct}%`, background: color, minWidth: 2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    fontFamily: "var(--font-mono)", overflow: "hidden",
                    whiteSpace: "nowrap", textOverflow: "ellipsis",
                    padding: "0 4px",
                  }}
                >
                  {pct > 8 ? seg.name : ""}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {segments.map((seg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: seg.color || DEFAULT_SEGMENT_COLORS[i % DEFAULT_SEGMENT_COLORS.length],
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-ui)" }}>
                  {seg.name} ({((seg.share || 0) / totalShare * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key players table */}
      {players.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)", marginBottom: 6,
          }}>
            {tl("marktanalyse.keyPlayers")}
          </div>
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontSize: 12, fontFamily: "var(--font-ui)",
          }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {tl("marktanalyse.nameCol")}
                </th>
                <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {tl("marktanalyse.marketShare")}
                </th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {tl("marktanalyse.strengthCol")}
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}40` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "var(--foreground)" }}>
                    {p.name}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: ACCENT, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                    {p.marketShare != null
                      ? (typeof p.marketShare === "number"
                        ? `${p.marketShare > 1 ? p.marketShare.toFixed(1) : (p.marketShare * 100).toFixed(1)}%`
                        : p.marketShare)
                      : "-"}
                  </td>
                  <td style={{ padding: "6px 10px", color: "var(--muted-foreground)" }}>
                    {p.strength ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================================================================
   Step 2 – Competitor Radar Visualization
   ================================================================== */

interface CompetitorRadarData {
  positioning?: { name: string; x: number; y: number; color?: string; size?: number }[];
  xLabel?: string;
  yLabel?: string;
  xLow?: string;
  xHigh?: string;
  yLow?: string;
  yHigh?: string;
  quadrantLabels?: [string, string, string, string];
  competitors?: { name: string; threatLevel?: string; description?: string; strengths?: string[]; weaknesses?: string[] }[];
  synthesis?: string;
}

const THREAT_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: "#FEE2E2", text: "#991B1B" },
  medium: { bg: "#FEF9C3", text: "#854D0E" },
  low:    { bg: "#DCFCE7", text: "#166534" },
};

function CompetitorRadarViz({ data, de }: { data: CompetitorRadarData; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const d = data ?? {};
  const positioning = safeArr<{ name: string; x: number; y: number; color?: string; size?: number }>(d.positioning);
  const competitors = safeArr<{ name: string; threatLevel?: string; description?: string; strengths?: string[]; weaknesses?: string[] }>(d.competitors);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {d.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {d.synthesis}
        </p>
      )}

      {/* Matrix chart */}
      {positioning.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <MatrixChart
            points={positioning}
            xLabel={d.xLabel || tl("marktanalyse.marketStrength")}
            yLabel={d.yLabel || tl("marktanalyse.innovationPower")}
            xLow={d.xLow}
            xHigh={d.xHigh}
            yLow={d.yLow}
            yHigh={d.yHigh}
            accentColor={ACCENT}
            quadrantLabels={d.quadrantLabels}
          />
        </div>
      )}

      {/* Competitor cards */}
      {competitors.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)", marginBottom: 8,
          }}>
            {tl("marktanalyse.competitorProfiles")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {competitors.map((c, i) => {
              const threat = (c.threatLevel || "medium").toLowerCase();
              const colors = THREAT_COLORS[threat] || THREAT_COLORS.medium;
              return (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: "12px 14px",
                    background: "var(--card)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-display)" }}>
                      {c.name}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                      textTransform: "uppercase", fontFamily: "var(--font-mono)",
                      padding: "2px 8px", borderRadius: 4,
                      background: colors.bg, color: colors.text,
                    }}>
                      {de
                        ? (threat === "high" ? "Hoch" : threat === "medium" ? "Mittel" : "Niedrig")
                        : (threat === "high" ? "High" : threat === "medium" ? "Medium" : "Low")}
                    </span>
                  </div>
                  {c.description && (
                    <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--muted-foreground)", margin: "0 0 6px" }}>
                      {c.description}
                    </p>
                  )}
                  {safeArr<string>(c.strengths).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {safeArr<string>(c.strengths).map((s, j) => (
                        <span key={j} style={{
                          fontSize: 9, padding: "1px 6px", borderRadius: 3,
                          background: "#D4E8FF", color: ACCENT, fontWeight: 600,
                          fontFamily: "var(--font-ui)",
                        }}>
                          + {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {safeArr<string>(c.weaknesses).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {safeArr<string>(c.weaknesses).map((w, j) => (
                        <span key={j} style={{
                          fontSize: 9, padding: "1px 6px", borderRadius: 3,
                          background: "#FEE2E2", color: "#991B1B", fontWeight: 600,
                          fontFamily: "var(--font-ui)",
                        }}>
                          - {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================================================================
   Step 3 – Trends & Regulation Visualization
   ================================================================== */

interface TrendsRegulationData {
  megatrends?: { name: string; category?: string; description?: string }[];
  regulations?: { name: string; status?: string; description?: string; jurisdiction?: string }[];
  scenarios?: { type: string; title: string; description: string; probability?: number; timeframe?: string; keyDrivers?: string[] }[];
  synthesis?: string;
}

function TrendsRegulationViz({ data, de }: { data: TrendsRegulationData; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const d = data ?? {};
  const megatrends = safeArr<{ name: string; category?: string; description?: string }>(d.megatrends);
  const regulations = safeArr<{ name: string; status?: string; description?: string; jurisdiction?: string }>(d.regulations);
  const scenarios = safeArr<{ type: string; title: string; description: string; probability?: number; timeframe?: string; keyDrivers?: string[] }>(d.scenarios);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {d.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {d.synthesis}
        </p>
      )}

      {/* Megatrend badges */}
      {megatrends.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)", marginBottom: 6,
          }}>
            {tl("marktanalyse.megatrendsSteep")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {megatrends.map((t, i) => {
              const cat = (t.category || "").toLowerCase();
              const color = STEEP_COLORS[cat] || ACCENT;
              return (
                <span
                  key={i}
                  title={t.description || t.name}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, fontFamily: "var(--font-ui)",
                    padding: "4px 10px", borderRadius: 6,
                    background: `${color}18`, color,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: color, flexShrink: 0,
                  }} />
                  {t.name}
                  {t.category && (
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase", opacity: 0.7,
                      fontFamily: "var(--font-mono)",
                    }}>
                      {t.category.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Regulation list */}
      {regulations.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)", marginBottom: 6,
          }}>
            {tl("marktanalyse.regulation")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {regulations.map((r, i) => {
              const status = (r.status || "draft").toLowerCase();
              const colors = REGULATION_STATUS_COLORS[status] || REGULATION_STATUS_COLORS.draft;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${BORDER}60`,
                    background: "var(--card)",
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase", fontFamily: "var(--font-mono)",
                    padding: "2px 8px", borderRadius: 4,
                    background: colors.bg, color: colors.text,
                    flexShrink: 0,
                  }}>
                    {de
                      ? (status === "active" ? "Aktiv" : status === "planned" ? "Geplant" : "Entwurf")
                      : (status === "active" ? "Active" : status === "planned" ? "Planned" : "Draft")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-ui)" }}>
                      {r.name}
                      {r.jurisdiction && (
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 400, marginLeft: 6 }}>
                          ({r.jurisdiction})
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: 1 }}>
                        {r.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <ScenarioCards scenarios={scenarios} de={de} />
      )}
    </div>
  );
}

/* ==================================================================
   Step 4 – Benchmarking Visualization
   ================================================================== */

interface BenchmarkingData {
  metrics?: string[];
  players?: Record<string, unknown>[];
  caption?: string;
  synthesis?: string;
}

function BenchmarkingViz({ data, de }: { data: BenchmarkingData; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const d = data ?? {};
  const players = safeArr<Record<string, unknown>>(d.players);
  const metrics = safeArr<string>(d.metrics);

  /* Build VoltTable columns from the metric names */
  const columns = useMemo(() => {
    if (metrics.length === 0 && players.length > 0) {
      /* Fallback: derive columns from first player's keys */
      return Object.keys(players[0]).map((k) => ({
        key: k,
        header: k,
        align: (k === "name" || k === "Name") ? "left" as const : "right" as const,
      }));
    }

    const cols: { key: string; header: string; align: "left" | "right" }[] = [
      { key: "name", header: tl("marktanalyse.playerCol"), align: "left" },
    ];
    for (const m of metrics) {
      cols.push({ key: m, header: m, align: "right" });
    }
    return cols;
  }, [metrics, players, de]);

  if (players.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Synthesis */}
      {d.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {d.synthesis}
        </p>
      )}

      <VoltTable
        columns={columns}
        data={players}
        striped
        compact
        hoverable
        caption={d.caption || tl("marktanalyse.benchmarkingCaption")}
        emptyMessage={tl("marktanalyse.noData")}
      />
    </div>
  );
}
