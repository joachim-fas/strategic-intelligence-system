"use client";

import React, { useState } from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { StepCard } from "@/components/frameworks/StepCard";
import { MatrixChart } from "@/components/frameworks/MatrixChart";

/* ── Colors ── */
const ACCENT = "#955A20";
const BORDER = "#F0D4A8";

/* ── Category colors ── */
const CATEGORY_COLORS: Record<string, string> = {
  technology: "#3b82f6",
  market: "#22c55e",
  regulation: "#6366f1",
  organization: "#f59e0b",
  financial: "#ec4899",
  social: "#8b5cf6",
};

/* ── Severity color helper ── */
function severityColor(score: number): string {
  if (score >= 4) return "#ef4444";
  if (score >= 3) return "#f97316";
  if (score >= 2) return "#eab308";
  return "#22c55e";
}

/* ═══════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════ */
export default function PreMortemPage() {
  const meta = getFrameworkMeta("pre-mortem");

  return (
    <FrameworkShell meta={meta}>
      {({ topic, locale, de }) => (
        <PreMortemContent topic={topic} locale={locale} de={de} />
      )}
    </FrameworkShell>
  );
}

/* ═══════════════════════════════════════════════════════════
   Content — 3 analysis steps
   ═══════════════════════════════════════════════════════════ */
function PreMortemContent({
  topic,
  locale,
  de,
}: {
  topic: string;
  locale: string;
  de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const { steps, runStep } = useFrameworkAnalysis("pre-mortem");

  /* ── Helpers to gather previous‑step data for context ── */
  const prevData = (ids: string[]) => {
    const out: Record<string, any> = {};
    ids.forEach((id) => {
      if (steps[id]?.status === "done" && steps[id]?.data) {
        out[id] = steps[id].data;
      }
    });
    return Object.keys(out).length > 0 ? out : undefined;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ───── Step 1: Risiko-Inventar ───── */}
      <StepCard
        stepId="risks"
        title={tl("preMortem.step1Title")}
        description={
          de
            ? "Alle Risiken identifizieren und kategorisieren"
            : "Identify and categorize all risks"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.risks}
        onRun={() => runStep("risks", topic, locale)}
        de={de}
      >
        <RiskInventoryViz data={steps.risks?.data} de={de} />
      </StepCard>

      {/* ───── Step 2: Risiko-Bewertung ───── */}
      <StepCard
        stepId="assessment"
        title={tl("preMortem.step2Title")}
        description={
          de
            ? "Wahrscheinlichkeit x Impact Matrix"
            : "Probability x Impact Matrix"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.assessment}
        onRun={() => runStep("assessment", topic, locale, prevData(["risks"]))}
        disabled={steps.risks?.status !== "done"}
        de={de}
      >
        <RiskAssessmentViz data={steps.assessment?.data} de={de} />
      </StepCard>

      {/* ───── Step 3: Risiko-Mitigation ───── */}
      <StepCard
        stepId="mitigation"
        title={tl("preMortem.step3Title")}
        description={
          de
            ? "Mitigationsplaene + Fruehwarnsystem"
            : "Mitigation plans + Early warning system"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.mitigation}
        onRun={() =>
          runStep(
            "mitigation",
            topic,
            locale,
            prevData(["risks", "assessment"]),
          )
        }
        disabled={steps.assessment?.status !== "done"}
        de={de}
      >
        <MitigationViz data={steps.mitigation?.data} de={de} />
      </StepCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 1 — Risk Inventory Visualization
   ═══════════════════════════════════════════════════════════ */
function RiskInventoryViz({
  data,
  de,
}: {
  data: any;
  de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const risks: any[] = Array.isArray(data.risks) ? data.risks : [];
  const blindSpots: string[] = Array.isArray(data.blindSpots)
    ? data.blindSpots
    : [];

  /* Sort by riskScore descending */
  const sorted = [...risks].sort(
    (a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--foreground)",
            marginBottom: 4,
          }}
        >
          {data.synthesis}
        </p>
      )}

      {/* Risk cards */}
      {sorted.map((risk, i) => {
        const cat = (risk.category || "").toLowerCase();
        const catColor = CATEGORY_COLORS[cat] || "var(--muted-foreground)";
        const probability = risk.probability ?? 0;
        const impact = risk.impact ?? 0;
        const earlyWarnings: string[] = Array.isArray(risk.earlyWarnings)
          ? risk.earlyWarnings
          : [];

        return (
          <div
            key={i}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "12px 16px",
              background: "var(--background)",
            }}
          >
            {/* Name + Category badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                {risk.name || `Risk ${i + 1}`}
              </span>
              {risk.category && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: `${catColor}18`,
                    color: catColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {risk.category}
                </span>
              )}
            </div>

            {/* Description */}
            {risk.description && (
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--muted-foreground)",
                  margin: "0 0 10px 0",
                }}
              >
                {risk.description}
              </p>
            )}

            {/* Probability + Impact bars */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: earlyWarnings.length > 0 ? 10 : 0,
              }}
            >
              {/* Probability */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                    marginBottom: 4,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {tl("preMortem.probabilityShort")}{" "}
                  <span style={{ color: ACCENT }}>
                    {probability.toFixed(1)}/5
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(probability / 5) * 100}%`,
                      borderRadius: 3,
                      background: ACCENT,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              {/* Impact */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                    marginBottom: 4,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Impact{" "}
                  <span style={{ color: ACCENT }}>{impact.toFixed(1)}/5</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(impact / 5) * 100}%`,
                      borderRadius: 3,
                      background: severityColor(impact),
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Early warnings */}
            {earlyWarnings.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {earlyWarnings.map((w, wi) => (
                  <span
                    key={wi}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: `${ACCENT}12`,
                      color: ACCENT,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Blind spots */}
      {blindSpots.length > 0 && (
        <div
          style={{
            marginTop: 4,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#fef3c7",
            border: "1px solid #fde68a",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#92400e",
              marginBottom: 8,
              fontFamily: "var(--font-display)",
            }}
          >
            {tl("preMortem.blindSpots")}
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {blindSpots.map((bs, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "#78350f",
                }}
              >
                {bs}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 2 — Risk Assessment / Matrix Visualization
   ═══════════════════════════════════════════════════════════ */
function RiskAssessmentViz({
  data,
  de,
}: {
  data: any;
  de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const risks: any[] = Array.isArray(data.risks) ? data.risks : [];
  const topRisks: any[] = Array.isArray(data.topRisks) ? data.topRisks : [];

  /* Build matrix points */
  const points = risks.map((r) => ({
    name: r.name || "",
    x: r.probability ?? 0,
    y: r.impact ?? 0,
    color: severityColor(
      ((r.probability ?? 0) + (r.impact ?? 0)) / 2,
    ),
    size: 18,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--foreground)",
          }}
        >
          {data.synthesis}
        </p>
      )}

      {/* Matrix chart */}
      {points.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <MatrixChart
            points={points}
            xLabel={tl("preMortem.probabilityLabel")}
            yLabel="Impact"
            xLow={tl("preMortem.low")}
            xHigh={tl("preMortem.high")}
            yLow={tl("preMortem.low")}
            yHigh={tl("preMortem.high")}
            accentColor={ACCENT}
            quadrantLabels={
              de
                ? [
                    "Beobachten",
                    "Kritisch",
                    "Akzeptieren",
                    "Planen",
                  ]
                : ["Monitor", "Critical", "Accept", "Plan"]
            }
          />
        </div>
      )}

      {/* Top risks highlighted */}
      {topRisks.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: ACCENT,
              marginBottom: 10,
            }}
          >
            {tl("preMortem.criticalRisks")}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {topRisks.map((tr, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: `${ACCENT}06`,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    marginBottom: 4,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {tr.name || `Risk ${i + 1}`}
                </div>
                {tr.whyCritical && (
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--muted-foreground)",
                      margin: 0,
                    }}
                  >
                    {tr.whyCritical}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 3 — Mitigation Visualization
   ═══════════════════════════════════════════════════════════ */
function MitigationViz({
  data,
  de,
}: {
  data: any;
  de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;

  const mitigations: any[] = Array.isArray(data.mitigations)
    ? data.mitigations
    : [];
  const earlyWarningSystem: any[] = Array.isArray(data.earlyWarningSystem)
    ? data.earlyWarningSystem
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Synthesis */}
      {data.synthesis && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--foreground)",
          }}
        >
          {data.synthesis}
        </p>
      )}

      {/* Mitigation cards */}
      {mitigations.map((m, i) => (
        <MitigationCard key={i} mitigation={m} index={i} de={de} />
      ))}

      {/* Early warning system table */}
      {earlyWarningSystem.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: ACCENT,
              marginBottom: 10,
            }}
          >
            {tl("preMortem.earlyWarningSystem")}
          </div>
          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                fontFamily: "var(--font-ui)",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: `${ACCENT}0a`,
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: ACCENT,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {tl("preMortem.signalLabel")}
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: ACCENT,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {tl("preMortem.sourceLabel")}
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: ACCENT,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {tl("preMortem.thresholdLabel")}
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: ACCENT,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {tl("preMortem.actionLabel")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {earlyWarningSystem.map((ew, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        i < earlyWarningSystem.length - 1
                          ? `1px solid ${BORDER}40`
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--foreground)",
                        fontWeight: 500,
                      }}
                    >
                      {ew.signal || "-"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {ew.source || "-"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {ew.threshold || "-"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {ew.action || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Expandable Mitigation Card ── */
function MitigationCard({
  mitigation,
  index,
  de,
}: {
  mitigation: any;
  index: number;
  de: boolean;
}) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const [expanded, setExpanded] = useState(true);
  const m = mitigation;

  const prevention = m.prevention || {};
  const contingency = m.contingency || {};
  const monitoring = m.monitoring || {};

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--background)",
      }}
    >
      {/* Header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "10px 14px",
          border: "none",
          background: expanded ? `${ACCENT}06` : "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-display)",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--foreground)",
          }}
        >
          {m.riskName || m.name || `${tl("preMortem.riskFallback")} ${index + 1}`}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--muted-foreground)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div
          style={{
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            borderTop: `1px solid ${BORDER}40`,
          }}
        >
          {/* Prevention */}
          <MitigationSection
            label={tl("preMortem.preventionLabel")}
            color="#22c55e"
          >
            {prevention.action && (
              <MitigationRow
                label={tl("preMortem.measureLabel")}
                value={prevention.action}
              />
            )}
            {prevention.cost && (
              <MitigationRow
                label={tl("preMortem.costLabel")}
                value={prevention.cost}
              />
            )}
            {prevention.timeline && (
              <MitigationRow label="Timeline" value={prevention.timeline} />
            )}
          </MitigationSection>

          {/* Contingency */}
          <MitigationSection
            label={tl("preMortem.contingencyLabel")}
            color="#f97316"
          >
            {contingency.action && (
              <MitigationRow
                label={tl("preMortem.measureLabel")}
                value={contingency.action}
              />
            )}
            {contingency.trigger && (
              <MitigationRow label="Trigger" value={contingency.trigger} />
            )}
          </MitigationSection>

          {/* Monitoring */}
          <MitigationSection label="Monitoring" color="#3b82f6">
            {monitoring.indicator && (
              <MitigationRow
                label={tl("preMortem.indicatorLabel")}
                value={monitoring.indicator}
              />
            )}
            {monitoring.threshold && (
              <MitigationRow
                label={tl("preMortem.thresholdLabel")}
                value={monitoring.threshold}
              />
            )}
            {monitoring.frequency && (
              <MitigationRow
                label={tl("preMortem.frequencyLabel")}
                value={monitoring.frequency}
              />
            )}
          </MitigationSection>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components for mitigation sections ── */
function MitigationSection({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: color,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingLeft: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MitigationRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5 }}>
      <span
        style={{
          fontWeight: 600,
          color: "var(--muted-foreground)",
          minWidth: 80,
          flexShrink: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        {label}:
      </span>
      <span style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}
