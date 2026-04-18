"use client";

import React from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis, StepResult } from "@/lib/use-framework-analysis";
import { StepCard } from "@/components/frameworks/StepCard";
import { ScenarioCards } from "@/components/frameworks/ScenarioCards";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";

const ACCENT = "#7C1A9E";
const BORDER = "#D8A8F0";

export default function TrendDeepDivePage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("trend-deep-dive")}>
      {({ topic, locale, de }) => (
        <TrendDeepDiveContent topic={topic} locale={locale} de={de} />
      )}
    </FrameworkShell>
  );
}

/* ── Content ─────────────────────────────────────────────── */

function TrendDeepDiveContent({ topic, locale, de }: { topic: string; locale: string; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const { steps, runStep } = useFrameworkAnalysis("trend-deep-dive");

  const previousData = (ids: string[]) => {
    const out: Record<string, any> = {};
    ids.forEach(id => { if (steps[id]?.data) out[id] = steps[id].data; });
    return out;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Step 1 */}
      <StepCard
        stepId="definition"
        title={tl("trendDeepDive.step1Title")}
        description={tl("trendDeepDive.step1Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.definition}
        onRun={() => runStep("definition", topic, locale)}
        de={de}
      >
        <DefinitionViz data={steps.definition?.data} de={de} />
      </StepCard>

      {/* Step 2 */}
      <StepCard
        stepId="evidence"
        title={tl("trendDeepDive.step2Title")}
        description={tl("trendDeepDive.step2Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.evidence}
        onRun={() => runStep("evidence", topic, locale, previousData(["definition"]))}
        disabled={steps.definition?.status !== "done"}
        de={de}
      >
        <EvidenceViz data={steps.evidence?.data} de={de} />
      </StepCard>

      {/* Step 3 */}
      <StepCard
        stepId="drivers"
        title={tl("trendDeepDive.step3Title")}
        description={tl("trendDeepDive.step3Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.drivers}
        onRun={() => runStep("drivers", topic, locale, previousData(["definition", "evidence"]))}
        disabled={steps.evidence?.status !== "done"}
        de={de}
      >
        <DriversViz data={steps.drivers?.data} de={de} />
      </StepCard>

      {/* Step 4 */}
      <StepCard
        stepId="impact"
        title={tl("trendDeepDive.step4Title")}
        description={tl("trendDeepDive.step4Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.impact}
        onRun={() => runStep("impact", topic, locale, previousData(["definition", "evidence", "drivers"]))}
        disabled={steps.drivers?.status !== "done"}
        de={de}
      >
        <ImpactViz data={steps.impact?.data} de={de} />
      </StepCard>

      {/* Step 5 */}
      <StepCard
        stepId="actions"
        title={tl("trendDeepDive.step5Title")}
        description={tl("trendDeepDive.step5Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.actions}
        onRun={() => runStep("actions", topic, locale, previousData(["definition", "evidence", "drivers", "impact"]))}
        disabled={steps.impact?.status !== "done"}
        de={de}
      >
        <ActionsViz data={steps.actions?.data} de={de} />
      </StepCard>

    </div>
  );
}

/* ── Step 1: Definition & Status ─────────────────────────── */

function DefinitionViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const definition: string = data.definition || data.synthesis || "";
  const metrics: { name: string; value: string; trend?: string }[] = Array.isArray(data.metrics) ? data.metrics : [];
  const sCurvePosition: number = typeof data.sCurvePosition === "number" ? data.sCurvePosition : (typeof data.s_curve_position === "number" ? data.s_curve_position : -1);
  const steepCategories: string[] = Array.isArray(data.steepCategories) ? data.steepCategories : (Array.isArray(data.steep_categories) ? data.steep_categories : []);
  const keyActors: { name: string; role?: string }[] = Array.isArray(data.keyActors) ? data.keyActors : (Array.isArray(data.key_actors) ? data.key_actors : []);

  const trendArrow = (t?: string) => {
    if (!t) return "";
    const low = t.toLowerCase();
    if (low === "up" || low === "rising" || low === "steigend") return " \u2191";
    if (low === "down" || low === "falling" || low === "fallend") return " \u2193";
    if (low === "stable" || low === "stabil") return " \u2192";
    return "";
  };

  const roleColor = (role?: string): string => {
    if (!role) return "#6b7280";
    const r = role.toLowerCase();
    if (r === "pioneer" || r === "pionier") return "#7C1A9E";
    if (r === "leader" || r === "leader") return "#1A4A8A";
    if (r === "follower" || r === "folger") return "#6b7280";
    if (r === "regulator" || r === "regulierer") return "#A0244A";
    return "#6b7280";
  };

  const sCurveLabels = de
    ? ["Emergent", "Wachsend", "Mainstream", "Rückläufig"]
    : ["Emerging", "Growing", "Mainstream", "Declining"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Definition text */}
      {definition && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {definition}
        </p>
      )}

      {/* Key metrics */}
      {metrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "10px 14px",
              background: "#FBF0FF",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                {m.name}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT, marginTop: 2, fontFamily: "var(--font-display)" }}>
                {m.value}{trendArrow(m.trend)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* S-Curve Position */}
      {sCurvePosition >= 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.sCurvePosition")}
          </div>
          <div style={{ position: "relative", height: 32, background: "#F3E8FF", borderRadius: 8, overflow: "hidden" }}>
            {/* Track gradient */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to right, #E9D5FF 0%, #C084FC 35%, #7C3AED 65%, #A78BFA 100%)",
              opacity: 0.3, borderRadius: 8,
            }} />
            {/* Marker */}
            <div style={{
              position: "absolute",
              left: `${Math.min(Math.max(sCurvePosition, 2), 98)}%`,
              top: 2, bottom: 2,
              width: 4, borderRadius: 2,
              background: ACCENT,
              transform: "translateX(-50%)",
              boxShadow: `0 0 6px ${ACCENT}80`,
            }} />
          </div>
          {/* Labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {sCurveLabels.map((label, i) => (
              <span key={i} style={{ fontSize: 9, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* STEEP categories */}
      {steepCategories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {steepCategories.map((cat, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
              background: "#F0D4FF", color: ACCENT, fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Key actors */}
      {keyActors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.keyActors")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {keyActors.map((a, i) => {
              const rc = roleColor(a.role);
              return (
                <div key={i} style={{
                  border: `1px solid ${rc}30`,
                  borderRadius: 10, padding: "10px 14px",
                  background: `${rc}08`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{a.name}</div>
                  {a.role && (
                    <span style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: `${rc}20`, color: rc,
                      textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
                    }}>
                      {a.role}
                    </span>
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

/* ── Step 2: Evidence & Data ─────────────────────────────── */

function EvidenceViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const signals: { text: string; strength?: string; source?: string }[] = Array.isArray(data.signals) ? data.signals : [];
  const quantitative: { metric: string; value: string; change?: string }[] = Array.isArray(data.quantitative) ? data.quantitative : (Array.isArray(data.quantitativeData) ? data.quantitativeData : []);
  const counterEvidence: string = data.counterEvidence || data.counter_evidence || "";
  const dataGaps: string = data.dataGaps || data.data_gaps || "";

  const strengthDot = (s?: string) => {
    if (!s) return null;
    const low = s.toLowerCase();
    let color = "#6b7280";
    if (low === "strong" || low === "stark") color = "#16a34a";
    else if (low === "moderate" || low === "mittel") color = "#d97706";
    else if (low === "weak" || low === "schwach") color = "#ef4444";
    return (
      <span style={{
        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        background: color, flexShrink: 0,
      }} />
    );
  };

  const changeBadge = (ch?: string) => {
    if (!ch) return null;
    const isPositive = ch.startsWith("+") || ch.toLowerCase().includes("up") || ch.toLowerCase().includes("steig");
    const isNegative = ch.startsWith("-") || ch.toLowerCase().includes("down") || ch.toLowerCase().includes("fall");
    const bg = isPositive ? "#DCFCE7" : isNegative ? "#FEE2E2" : "#F3F4F6";
    const color = isPositive ? "#16a34a" : isNegative ? "#ef4444" : "#6b7280";
    return (
      <span style={{
        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
        background: bg, color, fontFamily: "var(--font-mono)",
      }}>
        {ch}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Signals */}
      {signals.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.signals")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {signals.map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                fontSize: 12, lineHeight: 1.6, color: "var(--foreground)",
                padding: "8px 12px", borderRadius: 8,
                background: "var(--muted)",
              }}>
                {strengthDot(s.strength)}
                <div style={{ flex: 1 }}>
                  <span>{s.text}</span>
                  {s.source && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                      ({s.source})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quantitative data */}
      {quantitative.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.quantitativeData")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {quantitative.map((q, i) => (
              <div key={i} style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "10px 14px",
                background: "#FBF0FF",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                  {q.metric}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT, fontFamily: "var(--font-display)" }}>
                    {q.value}
                  </span>
                  {changeBadge(q.change)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter-evidence */}
      {counterEvidence && (
        <div style={{
          border: "1px solid #FCD34D",
          borderRadius: 10, padding: "12px 16px",
          background: "#FFFBEB",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>&#9888;</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {tl("trendDeepDive.counterEvidence")}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "#78350F", margin: 0 }}>
              {counterEvidence}
            </p>
          </div>
        </div>
      )}

      {/* Data gaps */}
      {dataGaps && (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 16px",
          background: "var(--muted)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 14, color: "var(--muted-foreground)", flexShrink: 0 }}>&#9432;</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {tl("trendDeepDive.dataGaps")}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted-foreground)", margin: 0 }}>
              {dataGaps}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Drivers & Brakers ───────────────────────────── */

function DriversViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const drivers: { name: string; strength: number; category?: string }[] = Array.isArray(data.drivers) ? data.drivers : [];
  const brakers: { name: string; strength: number; category?: string }[] = Array.isArray(data.brakers) ? data.brakers : (Array.isArray(data.brakers || data.blockers) ? (data.brakers || data.blockers) : []);
  const connectedTrends: { name: string; relationship?: string; description?: string }[] = Array.isArray(data.connectedTrends) ? data.connectedTrends : (Array.isArray(data.connected_trends) ? data.connected_trends : []);
  const tippingPoints: { description: string; probability?: string; timeframe?: string }[] = Array.isArray(data.tippingPoints) ? data.tippingPoints : (Array.isArray(data.tipping_points) ? data.tipping_points : []);

  const relColor = (rel?: string): string => {
    if (!rel) return "#6b7280";
    const r = rel.toLowerCase();
    if (r === "reinforcing" || r === "verstärkend") return "#16a34a";
    if (r === "counteracting" || r === "gegenläufig") return "#ef4444";
    if (r === "enabling" || r === "ermöglichend") return "#2563EB";
    return "#6b7280";
  };

  const barRow = (item: { name: string; strength: number; category?: string }, color: string) => {
    const pct = Math.min(Math.max((item.strength / 5) * 100, 5), 100);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 130, fontSize: 12, fontWeight: 500, color: "var(--foreground)", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </div>
        <div style={{ flex: 1, height: 14, background: "var(--muted)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 4,
            background: color, transition: "width 0.3s",
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "var(--font-mono)", width: 18, textAlign: "right", flexShrink: 0 }}>
          {item.strength}
        </span>
        {item.category && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: `${color}15`, color, fontFamily: "var(--font-mono)",
            textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
          }}>
            {item.category}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Two-column: Drivers vs Brakers */}
      {(drivers.length > 0 || brakers.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Drivers column */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "#16a34a", marginBottom: 10 }}>
              {tl("trendDeepDive.drivers")}
            </div>
            {drivers.map((d, i) => (
              <React.Fragment key={i}>{barRow(d, "#16a34a")}</React.Fragment>
            ))}
            {drivers.length === 0 && (
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                {tl("trendDeepDive.noDrivers")}
              </span>
            )}
          </div>
          {/* Brakers column */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "#ef4444", marginBottom: 10 }}>
              {tl("trendDeepDive.brakers")}
            </div>
            {brakers.map((b, i) => (
              <React.Fragment key={i}>{barRow(b, "#ef4444")}</React.Fragment>
            ))}
            {brakers.length === 0 && (
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                {tl("trendDeepDive.noBrakers")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Connected trends */}
      {connectedTrends.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.connectedTrends")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {connectedTrends.map((t, i) => {
              const rc = relColor(t.relationship);
              return (
                <div key={i} style={{
                  border: `1px solid ${rc}30`,
                  borderRadius: 10, padding: "10px 14px",
                  background: `${rc}08`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{t.name}</span>
                    {t.relationship && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: `${rc}20`, color: rc,
                        textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)",
                      }}>
                        {t.relationship}
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p style={{ fontSize: 11, lineHeight: 1.5, color: "var(--muted-foreground)", margin: 0 }}>
                      {t.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tipping points */}
      {tippingPoints.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.tippingPoints")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tippingPoints.map((tp, i) => (
              <div key={i} style={{
                border: "1px solid #FCA5A5",
                borderRadius: 10, padding: "10px 14px",
                background: "#FEF2F2",
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, color: "#DC2626" }}>&#9888;</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: "#7F1D1D", margin: 0 }}>
                    {tp.description}
                  </p>
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    {tp.probability && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626", fontFamily: "var(--font-mono)" }}>
                        {tl("trendDeepDive.probShort")}: {tp.probability}
                      </span>
                    )}
                    {tp.timeframe && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#991B1B", fontFamily: "var(--font-mono)" }}>
                        {tl("trendDeepDive.timeframe")}: {tp.timeframe}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 4: Impact Analysis ─────────────────────────────── */

function ImpactViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const economicImpacts: { sector: string; type?: string; magnitude?: string; timeframe?: string }[] = Array.isArray(data.economicImpacts) ? data.economicImpacts : (Array.isArray(data.economic_impacts) ? data.economic_impacts : []);
  const winners: string[] = Array.isArray(data.winners) ? data.winners : [];
  const losers: string[] = Array.isArray(data.losers) ? data.losers : [];
  const scenarios: any[] = Array.isArray(data.scenarios) ? data.scenarios : [];

  const impactTypeBadge = (type?: string) => {
    if (!type) return null;
    const colors: Record<string, { bg: string; text: string }> = {
      "disruption": { bg: "#FEE2E2", text: "#991B1B" },
      "opportunity": { bg: "#DCFCE7", text: "#166534" },
      "risk": { bg: "#FEF3C7", text: "#92400E" },
      "transformation": { bg: "#E0E7FF", text: "#3730A3" },
    };
    const lower = type.toLowerCase();
    const c = colors[lower] || { bg: "#F3F4F6", text: "#374151" };
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
        background: c.bg, color: c.text,
        textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)",
      }}>
        {type}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Economic impact table */}
      {economicImpacts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.economicImpacts")}
          </div>
          <div style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 1fr",
              padding: "8px 14px", background: "#FBF0FF",
              fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
              color: ACCENT, borderBottom: `1px solid ${BORDER}`,
            }}>
              <span>{tl("trendDeepDive.sector")}</span>
              <span>{tl("trendDeepDive.typeCol")}</span>
              <span>{tl("trendDeepDive.magnitude")}</span>
              <span>{tl("trendDeepDive.timeframe")}</span>
            </div>
            {/* Rows */}
            {economicImpacts.map((e, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 1fr",
                padding: "8px 14px", alignItems: "center",
                borderBottom: i < economicImpacts.length - 1 ? `1px solid ${BORDER}30` : "none",
                fontSize: 12,
              }}>
                <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{e.sector}</span>
                <span>{impactTypeBadge(e.type)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-mono)" }}>{e.magnitude || "-"}</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{e.timeframe || "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social: Winners & Losers */}
      {(winners.length > 0 || losers.length > 0) && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {tl("trendDeepDive.socialImpact")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Winners */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", marginBottom: 6, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {tl("trendDeepDive.winners")}
              </div>
              {winners.length > 0 ? winners.map((w, i) => (
                <div key={i} style={{
                  fontSize: 12, padding: "6px 10px", marginBottom: 4,
                  borderRadius: 6, background: "#DCFCE7", color: "#166534",
                }}>
                  {w}
                </div>
              )) : (
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>-</span>
              )}
            </div>
            {/* Losers */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {tl("trendDeepDive.losers")}
              </div>
              {losers.length > 0 ? losers.map((l, i) => (
                <div key={i} style={{
                  fontSize: 12, padding: "6px 10px", marginBottom: 4,
                  borderRadius: 6, background: "#FEE2E2", color: "#991B1B",
                }}>
                  {l}
                </div>
              )) : (
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>-</span>
              )}
            </div>
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

/* ── Step 5: Action Recommendations ──────────────────────── */

const RING_COLORS: Record<string, { bg: string; text: string }> = {
  adopt:  { bg: "#DCFCE7", text: "#166534" },
  trial:  { bg: "#DBEAFE", text: "#1E40AF" },
  assess: { bg: "#FEF3C7", text: "#92400E" },
  hold:   { bg: "#F3F4F6", text: "#374151" },
};

const PRIORITY_SECTIONS = [
  { key: "immediate", emoji: "\uD83D\uDD34", labelDe: "SOFORT", labelEn: "IMMEDIATE" },
  { key: "short-term", emoji: "\uD83D\uDFE1", labelDe: "KURZFRISTIG", labelEn: "SHORT-TERM" },
  { key: "monitoring", emoji: "\uD83D\uDFE2", labelDe: "MONITORING", labelEn: "MONITORING" },
] as const;

function ActionsViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const ringClassification: string = data.ringClassification || data.ring_classification || "";
  const confidence: number = typeof data.confidence === "number" ? data.confidence : -1;
  const actions: Record<string, { title: string; description?: string; target?: string; effort?: string; impact?: string; ring?: string }[]> = data.actions || {};

  // Normalize: accept flat array or grouped object
  const grouped: Record<string, typeof actions[string]> = {};
  if (Array.isArray(data.actions)) {
    for (const a of data.actions as any[]) {
      const p = (a.priority || "monitoring").toLowerCase().replace(/\s/g, "-");
      if (!grouped[p]) grouped[p] = [];
      grouped[p].push(a);
    }
  } else if (typeof data.actions === "object" && data.actions) {
    Object.assign(grouped, data.actions);
  }

  const ringBadge = (ring?: string) => {
    if (!ring) return null;
    const r = ring.toLowerCase();
    const c = RING_COLORS[r] || RING_COLORS.hold;
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
        background: c.bg, color: c.text,
        textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
      }}>
        {ring}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Top-level ring classification badge */}
      {ringClassification && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tl("trendDeepDive.ringClassification")}:
          </span>
          {ringBadge(ringClassification)}
        </div>
      )}

      {/* Confidence bar */}
      {confidence >= 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {tl("trendDeepDive.confidence")}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: "var(--font-mono)" }}>
              {Math.round(confidence * (confidence > 1 ? 1 : 100))}%
            </span>
          </div>
          <div style={{ height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: ACCENT,
              width: `${Math.round(confidence * (confidence > 1 ? 1 : 100))}%`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Priority sections */}
      {PRIORITY_SECTIONS.map(section => {
        const items = grouped[section.key];
        if (!items || items.length === 0) return null;
        return (
          <div key={section.key}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              fontFamily: "var(--font-mono)", color: "var(--foreground)", marginBottom: 10,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{section.emoji}</span>
              <span>{de ? section.labelDe : section.labelEn}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((action, i) => (
                <div key={i} style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: "12px 16px",
                  background: "#FBF0FF",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      {action.title}
                    </span>
                    {ringBadge(action.ring)}
                  </div>
                  {action.description && (
                    <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted-foreground)", margin: 0, marginBottom: 8 }}>
                      {action.description}
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--muted-foreground)" }}>
                    {action.target && (
                      <span>
                        <span style={{ fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          {tl("trendDeepDive.target")}:
                        </span>{" "}
                        {action.target}
                      </span>
                    )}
                    {action.effort && (
                      <span>
                        <span style={{ fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          {tl("trendDeepDive.effort")}:
                        </span>{" "}
                        {action.effort}
                      </span>
                    )}
                    {action.impact && (
                      <span>
                        <span style={{ fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          Impact:
                        </span>{" "}
                        {action.impact}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
