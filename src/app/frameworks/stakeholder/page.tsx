"use client";

import React from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { StepCard } from "@/components/frameworks/StepCard";
import { MatrixChart } from "@/components/frameworks/MatrixChart";

const ACCENT = "#7A5C00";
const BORDER = "#E8D870";

/* ---------- type helpers ---------- */

interface Stakeholder {
  name: string;
  type: "decisionMaker" | "influencer" | "affected" | "observer";
  primaryInterest: string;
  secondaryInterest?: string;
  power: number;
  interest: number;
  stance: "supporter" | "opponent" | "neutral";
}

interface QuadrantEntry {
  name: string;
  quadrant: string;
  strategy: string;
}

interface Alliance {
  name: string;
  members: string[];
  basis: string;
  stability: "stable" | "fragile" | "forming";
}

interface Conflict {
  parties: string[];
  issue: string;
  severity: "high" | "medium" | "low";
}

interface InfluenceChain {
  chain: string[];
  description?: string;
}

interface PossibleShift {
  actor: string;
  currentStance: string;
  possibleStance: string;
  trigger: string;
}

interface EngagementStrategy {
  stakeholder: string;
  approach: string;
  message: string;
  timing: string;
  channel: string;
  risk: string;
  quickWin?: boolean;
}

interface WeekPlan {
  week: number;
  actions: string[];
}

/* ---------- label maps ---------- */

const TYPE_LABELS: Record<string, { de: string; en: string; color: string }> = {
  decisionMaker: { de: "Entscheider", en: "Decision Maker", color: "#B91C1C" },
  influencer: { de: "Einflussnehmer", en: "Influencer", color: "#7C3AED" },
  affected: { de: "Betroffener", en: "Affected", color: "#0369A1" },
  observer: { de: "Beobachter", en: "Observer", color: "#6B7280" },
};

const STABILITY_LABELS: Record<string, { de: string; en: string; color: string }> = {
  stable: { de: "Stabil", en: "Stable", color: "#16a34a" },
  fragile: { de: "Fragil", en: "Fragile", color: "#ea580c" },
  forming: { de: "Im Aufbau", en: "Forming", color: "#ca8a04" },
};

const SEVERITY_LABELS: Record<string, { de: string; en: string; color: string }> = {
  high: { de: "Hoch", en: "High", color: "#dc2626" },
  medium: { de: "Mittel", en: "Medium", color: "#ea580c" },
  low: { de: "Niedrig", en: "Low", color: "#6B7280" },
};

const QUADRANT_LABELS_DE: [string, string, string, string] = [
  "Zufrieden halten",
  "Schlüsselakteure",
  "Beobachten",
  "Informiert halten",
];

const QUADRANT_LABELS_EN: [string, string, string, string] = [
  "Keep Satisfied",
  "Key Players",
  "Monitor",
  "Keep Informed",
];

/* ---------- page ---------- */

export default function StakeholderPage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("stakeholder")}>
      {({ topic, locale, de }) => (
        <StakeholderContent topic={topic} locale={locale} de={de} />
      )}
    </FrameworkShell>
  );
}

/* ---------- content component ---------- */

function StakeholderContent({ topic, locale, de }: { topic: string; locale: string; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  const { steps, runStep } = useFrameworkAnalysis("stakeholder");

  const previousData = (ids: string[]) => {
    const out: Record<string, any> = {};
    for (const id of ids) {
      if (steps[id]?.status === "done" && steps[id]?.data) out[id] = steps[id].data;
    }
    return out;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Step 1 -- Stakeholder identifizieren */}
      <StepCard
        stepId="inventory"
        title={tl("stakeholder.step1Title")}
        description={tl("stakeholder.step1Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["inventory"]}
        onRun={() => runStep("inventory", topic, locale)}
        de={de}
      >
        {steps["inventory"]?.data && (
          <InventoryViz data={steps["inventory"].data} de={de} />
        )}
      </StepCard>

      {/* Step 2 -- Macht & Einfluss bewerten */}
      <StepCard
        stepId="power-matrix"
        title={tl("stakeholder.step2Title")}
        description={tl("stakeholder.step2Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["power-matrix"]}
        onRun={() => runStep("power-matrix", topic, locale, previousData(["inventory"]))}
        disabled={steps["inventory"]?.status !== "done"}
        de={de}
      >
        {steps["power-matrix"]?.data && (
          <PowerMatrixViz data={steps["power-matrix"].data} de={de} />
        )}
      </StepCard>

      {/* Step 3 -- Dynamiken & Koalitionen */}
      <StepCard
        stepId="coalitions"
        title={tl("stakeholder.step3Title")}
        description={tl("stakeholder.step3Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["coalitions"]}
        onRun={() => runStep("coalitions", topic, locale, previousData(["inventory", "power-matrix"]))}
        disabled={steps["power-matrix"]?.status !== "done"}
        de={de}
      >
        {steps["coalitions"]?.data && (
          <CoalitionsViz data={steps["coalitions"].data} de={de} />
        )}
      </StepCard>

      {/* Step 4 -- Engagement-Strategie */}
      <StepCard
        stepId="engagement"
        title={tl("stakeholder.step4Title")}
        description={tl("stakeholder.step4Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["engagement"]}
        onRun={() => runStep("engagement", topic, locale, previousData(["inventory", "power-matrix", "coalitions"]))}
        disabled={steps["coalitions"]?.status !== "done"}
        de={de}
      >
        {steps["engagement"]?.data && (
          <EngagementViz data={steps["engagement"].data} de={de} />
        )}
      </StepCard>
    </div>
  );
}

/* ============================================================
   STEP 1 -- Stakeholder Inventory
   ============================================================ */

function InventoryViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const stakeholders: Stakeholder[] = Array.isArray(data?.stakeholders) ? data.stakeholders : [];
  if (stakeholders.length === 0) return <FallbackSynthesis text={data?.synthesis} />;

  const grouped: Record<string, Stakeholder[]> = {};
  for (const s of stakeholders) {
    const key = s.type || "observer";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  const typeOrder: string[] = ["decisionMaker", "influencer", "affected", "observer"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {typeOrder.map(type => {
        const group = grouped[type];
        if (!group || group.length === 0) return null;
        const meta = TYPE_LABELS[type] || TYPE_LABELS.observer;
        return (
          <div key={type}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: meta.color,
              textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 8, fontFamily: "var(--font-mono)",
            }}>
              {de ? meta.de : meta.en} ({group.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {group.map((s, i) => (
                <StakeholderCard key={i} s={s} de={de} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StakeholderCard({ s, de }: { s: Stakeholder; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const typeMeta = TYPE_LABELS[s.type] || TYPE_LABELS.observer;
  const stanceIcon = s.stance === "supporter"
    ? { symbol: "\u2713", color: "#16a34a" }
    : s.stance === "opponent"
      ? { symbol: "\u2717", color: "#dc2626" }
      : { symbol: "\u2014", color: "#9ca3af" };

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: "12px 14px",
      background: "var(--card)",
    }}>
      {/* Header: name + type badge + stance */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
            {s.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 6px",
            borderRadius: 4, color: "#fff", background: typeMeta.color,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {de ? typeMeta.de : typeMeta.en}
          </span>
        </div>
        <span style={{
          fontSize: 16, fontWeight: 700, color: stanceIcon.color,
          lineHeight: 1,
        }}>
          {stanceIcon.symbol}
        </span>
      </div>

      {/* Interests */}
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
          {tl("stakeholder.primary")}:
        </span>{" "}
        {s.primaryInterest || "-"}
        {s.secondaryInterest && (
          <>
            <br />
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
              {tl("stakeholder.secondary")}:
            </span>{" "}
            {s.secondaryInterest}
          </>
        )}
      </div>

      {/* Power / Interest bars */}
      <div style={{ display: "flex", gap: 12 }}>
        <MiniBar label={tl("stakeholder.power")} value={s.power} max={5} color={ACCENT} />
        <MiniBar label={tl("stakeholder.interest")} value={s.interest} max={5} color={ACCENT} />
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3, color: "var(--muted-foreground)" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}/{max}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--muted)" }}>
        <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: color, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

/* ============================================================
   STEP 2 -- Power-Interest Matrix
   ============================================================ */

function PowerMatrixViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const stakeholders: Stakeholder[] = Array.isArray(data?.stakeholders) ? data.stakeholders : [];
  const quadrantAssignments: QuadrantEntry[] = Array.isArray(data?.quadrantAssignments) ? data.quadrantAssignments : [];

  if (stakeholders.length === 0 && quadrantAssignments.length === 0) {
    return <FallbackSynthesis text={data?.synthesis} />;
  }

  const points = stakeholders.map(s => ({
    name: s.name,
    x: s.interest ?? 2.5,
    y: s.power ?? 2.5,
    color: ACCENT,
  }));

  const quadLabels = de ? QUADRANT_LABELS_DE : QUADRANT_LABELS_EN;

  // Group assignments by quadrant for the table
  const byQuadrant: Record<string, QuadrantEntry[]> = {};
  for (const q of quadrantAssignments) {
    const key = q.quadrant || "Monitor";
    if (!byQuadrant[key]) byQuadrant[key] = [];
    byQuadrant[key].push(q);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Matrix Chart */}
      {points.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <MatrixChart
            points={points}
            xLabel={tl("stakeholder.interest")}
            yLabel={tl("stakeholder.power")}
            xLow={tl("stakeholder.low")}
            xHigh={tl("stakeholder.high")}
            yLow={tl("stakeholder.low")}
            yHigh={tl("stakeholder.high")}
            accentColor={ACCENT}
            quadrantLabels={quadLabels}
          />
        </div>
      )}

      {/* Quadrant Assignment Table */}
      {quadrantAssignments.length > 0 && (
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: ACCENT,
            marginBottom: 8, fontFamily: "var(--font-display)",
          }}>
            {tl("stakeholder.quadrantAssignments")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {quadLabels.map((label, qi) => {
              const entries = byQuadrant[label] || byQuadrant[QUADRANT_LABELS_EN[qi]] || [];
              if (entries.length === 0) return null;
              return (
                <div key={qi} style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: "10px 14px",
                  background: qi === 1 ? `${ACCENT}08` : "var(--card)",
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: qi === 1 ? ACCENT : "var(--muted-foreground)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    marginBottom: 8, fontFamily: "var(--font-mono)",
                  }}>
                    {label}
                  </div>
                  {entries.map((e, ei) => (
                    <div key={ei} style={{
                      fontSize: 12, color: "var(--foreground)", marginBottom: 6, lineHeight: 1.5,
                    }}>
                      <span style={{ fontWeight: 600 }}>{e.name}</span>
                      {e.strategy && (
                        <span style={{ color: "var(--muted-foreground)" }}> -- {e.strategy}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STEP 3 -- Coalitions & Dynamics
   ============================================================ */

function CoalitionsViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const alliances: Alliance[] = Array.isArray(data?.alliances) ? data.alliances : [];
  const conflicts: Conflict[] = Array.isArray(data?.conflicts) ? data.conflicts : [];
  const influenceChains: InfluenceChain[] = Array.isArray(data?.influenceChains) ? data.influenceChains : [];
  const possibleShifts: PossibleShift[] = Array.isArray(data?.possibleShifts) ? data.possibleShifts : [];

  if (alliances.length === 0 && conflicts.length === 0 && influenceChains.length === 0 && possibleShifts.length === 0) {
    return <FallbackSynthesis text={data?.synthesis} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Alliances */}
      {alliances.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.alliances")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {alliances.map((a, i) => {
              const stab = STABILITY_LABELS[a.stability] || STABILITY_LABELS.forming;
              return (
                <div key={i} style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: "12px 14px",
                  background: "var(--card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      {a.name || tl("stakeholder.allianceFallback")}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px",
                      borderRadius: 4, color: "#fff", background: stab.color,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {de ? stab.de : stab.en}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                      {tl("stakeholder.members")}:
                    </span>{" "}
                    {a.members.join(", ")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                      {tl("stakeholder.basis")}:
                    </span>{" "}
                    {a.basis}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.conflicts")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {conflicts.map((c, i) => {
              const sev = SEVERITY_LABELS[c.severity] || SEVERITY_LABELS.medium;
              return (
                <div key={i} style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: "12px 14px",
                  background: "var(--card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      {Array.isArray(c.parties) ? c.parties.join(" vs. ") : String(c.parties)}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px",
                      borderRadius: 4, color: "#fff", background: sev.color,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {de ? sev.de : sev.en}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                      {tl("stakeholder.issue")}:
                    </span>{" "}
                    {c.issue}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Influence Chains */}
      {influenceChains.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.influenceChains")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {influenceChains.map((ic, i) => (
              <div key={i} style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "10px 14px",
                background: "var(--card)",
                display: "flex", alignItems: "center", gap: 0,
                flexWrap: "wrap",
              }}>
                {Array.isArray(ic.chain) && ic.chain.map((node, ni) => (
                  <React.Fragment key={ni}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: "var(--foreground)",
                      padding: "3px 10px", background: `${ACCENT}12`,
                      borderRadius: 6, border: `1px solid ${BORDER}`,
                      whiteSpace: "nowrap",
                    }}>
                      {node}
                    </span>
                    {ni < ic.chain.length - 1 && (
                      <span style={{
                        fontSize: 14, color: ACCENT, margin: "0 6px",
                        fontWeight: 700,
                      }}>
                        {"\u2192"}
                      </span>
                    )}
                  </React.Fragment>
                ))}
                {ic.description && (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 12 }}>
                    {ic.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Possible Shifts */}
      {possibleShifts.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.possibleShifts")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {possibleShifts.map((ps, i) => (
              <div key={i} style={{
                border: `1px solid #f59e0b`,
                borderRadius: 10, padding: "12px 14px",
                background: "#fffbeb",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
                  {"\u26A0"} {ps.actor}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                    {tl("stakeholder.current")}:
                  </span>{" "}
                  {ps.currentStance}
                  <span style={{ margin: "0 6px", color: ACCENT, fontWeight: 700 }}>{"\u2192"}</span>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                    {tl("stakeholder.possible")}:
                  </span>{" "}
                  {ps.possibleStance}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: 4 }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                    {tl("stakeholder.trigger")}:
                  </span>{" "}
                  {ps.trigger}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STEP 4 -- Engagement Strategy
   ============================================================ */

function EngagementViz({ data, de }: { data: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  const strategies: EngagementStrategy[] = Array.isArray(data?.strategies) ? data.strategies : [];
  const weekPlan: WeekPlan[] = Array.isArray(data?.weekPlan) ? data.weekPlan : [];

  if (strategies.length === 0 && weekPlan.length === 0) {
    return <FallbackSynthesis text={data?.synthesis} />;
  }

  const quickWins = strategies.filter(s => s.quickWin);
  const regular = strategies.filter(s => !s.quickWin);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.quickWins")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {quickWins.map((s, i) => (
              <StrategyCard key={i} s={s} de={de} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Strategy Cards */}
      {regular.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.engagementPerStakeholder")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {regular.map((s, i) => (
              <StrategyCard key={i} s={s} de={de} />
            ))}
          </div>
        </div>
      )}

      {/* 4-Week Plan */}
      {weekPlan.length > 0 && (
        <div>
          <SectionLabel text={tl("stakeholder.fourWeekPlan")} />
          <div style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: 12, fontFamily: "var(--font-ui)",
            }}>
              <thead>
                <tr style={{ background: `${ACCENT}0A` }}>
                  <th style={{
                    padding: "8px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: ACCENT,
                    borderBottom: `1px solid ${BORDER}`,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    width: 100,
                  }}>
                    {tl("stakeholder.weekLabel")}
                  </th>
                  <th style={{
                    padding: "8px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: ACCENT,
                    borderBottom: `1px solid ${BORDER}`,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {tl("stakeholder.actionsLabel")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekPlan.map((wp, i) => (
                  <tr key={i} style={{
                    borderBottom: i < weekPlan.length - 1 ? `1px solid ${BORDER}40` : "none",
                  }}>
                    <td style={{
                      padding: "10px 14px", verticalAlign: "top",
                      fontWeight: 700, color: ACCENT,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}>
                      {tl("stakeholder.weekRow", { n: wp.week })}
                    </td>
                    <td style={{ padding: "10px 14px", verticalAlign: "top", color: "var(--foreground)", lineHeight: 1.6 }}>
                      {Array.isArray(wp.actions) && wp.actions.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {wp.actions.map((action, ai) => (
                            <li key={ai} style={{ marginBottom: 2 }}>{action}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "var(--muted-foreground)" }}>-</span>
                      )}
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

function StrategyCard({ s, de, highlight }: { s: EngagementStrategy; de: boolean; highlight?: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  return (
    <div style={{
      border: `1px solid ${highlight ? "#16a34a" : BORDER}`,
      borderRadius: 10, padding: "12px 14px",
      background: highlight ? "#f0fdf4" : "var(--card)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          {s.stakeholder}
        </span>
        {highlight && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 6px",
            borderRadius: 4, color: "#fff", background: "#16a34a",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            Quick Win
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
            {tl("stakeholder.approach")}:
          </span>{" "}
          {s.approach}
        </div>

        {s.message && (
          <div style={{
            marginBottom: 4, fontStyle: "italic",
            padding: "6px 10px", border: `1px solid ${ACCENT}20`,
            background: `${ACCENT}08`, borderRadius: 6,
          }}>
            &ldquo;{s.message}&rdquo;
          </div>
        )}

        <div style={{ marginBottom: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
            {tl("stakeholder.timing")}:
          </span>{" "}
          {s.timing}
        </div>

        <div style={{ marginBottom: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
            {tl("stakeholder.channel")}:
          </span>{" "}
          {s.channel}
        </div>

        {s.risk && (
          <div>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
              {tl("stakeholder.risk")}:
            </span>{" "}
            {s.risk}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Shared helpers
   ============================================================ */

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: ACCENT,
      marginBottom: 8, fontFamily: "var(--font-display)",
    }}>
      {text}
    </div>
  );
}

function FallbackSynthesis({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
      {text}
    </p>
  );
}
