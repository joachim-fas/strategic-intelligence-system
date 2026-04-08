"use client";

import React from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { StepCard } from "@/components/frameworks/StepCard";

const ACCENT = "#A0244A";
const BORDER = "#F4B8C8";

/* ---------- type helpers for parsed data ---------- */

interface Actor {
  name?: string;
  type?: string;
  resources?: string[];
  goals?: string[];
  threatLevel?: string;
}

interface Move {
  actor?: string;
  move?: string;
  probability?: number;
  impact?: string;
  cascadeEffects?: string[];
}

interface ResponseRow {
  opponentMove?: string;
  bestResponse?: string;
  alternative?: string;
  riskOfInaction?: string;
  priority?: string;
}

interface CounterStrategy {
  name?: string;
  description?: string;
  targetActor?: string;
}

interface Vulnerability {
  name?: string;
  severity?: string;
  exploitScenario?: string;
  currentDefense?: string;
  recommendation?: string;
}

/* ---------- colour maps ---------- */

const ACTOR_TYPE_COLORS: Record<string, string> = {
  competitor: "#DC2626",
  wettbewerber: "#DC2626",
  regulator: "#2563EB",
  regulierer: "#2563EB",
  partner: "#16A34A",
  disruptor: "#EA580C",
  customer: "#9333EA",
  kunde: "#9333EA",
};

const THREAT_DOT: Record<string, string> = {
  high: "#DC2626",
  hoch: "#DC2626",
  medium: "#EAB308",
  mittel: "#EAB308",
  low: "#16A34A",
  niedrig: "#16A34A",
};

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#FEE2E2", fg: "#DC2626" },
  kritisch: { bg: "#FEE2E2", fg: "#DC2626" },
  high: { bg: "#FFF7ED", fg: "#EA580C" },
  hoch: { bg: "#FFF7ED", fg: "#EA580C" },
  medium: { bg: "#FEFCE8", fg: "#CA8A04" },
  mittel: { bg: "#FEFCE8", fg: "#CA8A04" },
  low: { bg: "#F3F4F6", fg: "#6B7280" },
  niedrig: { bg: "#F3F4F6", fg: "#6B7280" },
};

/* ---------- page ---------- */

export default function WarGamingPage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("war-gaming")}>
      {({ topic, locale, de }) => (
        <WarGamingContent topic={topic} locale={locale} de={de} />
      )}
    </FrameworkShell>
  );
}

/* ---------- content ---------- */

function WarGamingContent({
  topic,
  locale,
  de,
}: {
  topic: string;
  locale: string;
  de: boolean;
}) {
  const { steps, runStep } = useFrameworkAnalysis("war-gaming");

  const prev = (ids: string[]): Record<string, any> => {
    const out: Record<string, any> = {};
    ids.forEach((id) => {
      if (steps[id]?.data) out[id] = steps[id].data;
    });
    return out;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Step 1 -- Akteurs-Modellierung */}
      <StepCard
        stepId="actors"
        title={de ? "Akteurs-Modellierung" : "Actor Modeling"}
        description={
          de
            ? "Akteurprofile: Wettbewerber, Regulierer, Partner, Disruptoren"
            : "Actor profiles: competitors, regulators, partners, disruptors"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.actors}
        onRun={() => runStep("actors", topic, locale)}
        de={de}
      >
        {steps.actors?.data && <ActorsViz data={steps.actors.data} de={de} />}
      </StepCard>

      {/* Step 2 -- Spielzug-Simulation */}
      <StepCard
        stepId="moves"
        title={de ? "Spielzug-Simulation" : "Move Simulation"}
        description={
          de
            ? "Simulation: Was Akteure als Nächstes tun könnten"
            : "What actors might do next"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.moves}
        onRun={() => runStep("moves", topic, locale, prev(["actors"]))}
        disabled={steps.actors?.status !== "done"}
        de={de}
      >
        {steps.moves?.data && <MovesViz data={steps.moves.data} de={de} />}
      </StepCard>

      {/* Step 3 -- Reaktionsmatrix */}
      <StepCard
        stepId="responses"
        title={de ? "Reaktionsmatrix" : "Response Matrix"}
        description={
          de
            ? "Reaktionsmatrix & Gegenstrategien"
            : "Response matrix & counter-strategies"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.responses}
        onRun={() =>
          runStep("responses", topic, locale, prev(["actors", "moves"]))
        }
        disabled={steps.moves?.status !== "done"}
        de={de}
      >
        {steps.responses?.data && (
          <ResponsesViz data={steps.responses.data} de={de} />
        )}
      </StepCard>

      {/* Step 4 -- Red-Team-Modus */}
      <StepCard
        stepId="red-team"
        title={de ? "Red-Team-Modus" : "Red Team Mode"}
        description={
          de
            ? "Schwachstellen & Verwundbarkeitsanalyse"
            : "Vulnerabilities & red team analysis"
        }
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["red-team"]}
        onRun={() =>
          runStep(
            "red-team",
            topic,
            locale,
            prev(["actors", "moves", "responses"]),
          )
        }
        disabled={steps.responses?.status !== "done"}
        de={de}
      >
        {steps["red-team"]?.data && (
          <RedTeamViz data={steps["red-team"].data} de={de} />
        )}
      </StepCard>
    </div>
  );
}

/* ================================================================
   Step 1 — Actor profile cards
   ================================================================ */

function ActorsViz({ data, de }: { data: any; de: boolean }) {
  const actors: Actor[] = Array.isArray(data?.actors)
    ? data.actors
    : Array.isArray(data?.items)
      ? data.items
      : [];

  if (actors.length === 0) return <FallbackSynthesis text={data?.synthesis} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", marginBottom: 4 }}>
          {data.synthesis}
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {actors.map((actor, i) => {
          const typeLower = (actor.type || "").toLowerCase();
          const badgeColor =
            ACTOR_TYPE_COLORS[typeLower] || ACCENT;
          const threatDot =
            THREAT_DOT[(actor.threatLevel || "").toLowerCase()] || "#9CA3AF";

          return (
            <div
              key={i}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: 14,
                background: "#FFFBFC",
              }}
            >
              {/* Name + type badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "var(--font-display)",
                    color: "var(--foreground)",
                  }}
                >
                  {actor.name || `${de ? "Akteur" : "Actor"} ${i + 1}`}
                </span>
                {actor.type && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: `${badgeColor}18`,
                      color: badgeColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {actor.type}
                  </span>
                )}
              </div>

              {/* Resources */}
              {Array.isArray(actor.resources) && actor.resources.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                    {de ? "Ressourcen" : "Resources"}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                    {actor.resources.map((r, j) => (
                      <span
                        key={j}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals */}
              {Array.isArray(actor.goals) && actor.goals.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                    {de ? "Ziele" : "Goals"}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                    {actor.goals.map((g, j) => (
                      <span
                        key={j}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: `${ACCENT}10`,
                          color: ACCENT,
                        }}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Threat level */}
              {actor.threatLevel && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: threatDot,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {de ? "Bedrohungslevel" : "Threat level"}: {actor.threatLevel}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   Step 2 — Move timeline cards
   ================================================================ */

function MovesViz({ data, de }: { data: any; de: boolean }) {
  const moves: Move[] = Array.isArray(data?.moves)
    ? data.moves
    : Array.isArray(data?.items)
      ? data.items
      : [];

  if (moves.length === 0) return <FallbackSynthesis text={data?.synthesis} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", marginBottom: 4 }}>
          {data.synthesis}
        </p>
      )}
      {moves.map((m, i) => {
        const prob = typeof m.probability === "number" ? m.probability : null;
        const impactColor =
          (m.impact || "").toLowerCase() === "high" ||
          (m.impact || "").toLowerCase() === "hoch"
            ? "#DC2626"
            : (m.impact || "").toLowerCase() === "medium" ||
                (m.impact || "").toLowerCase() === "mittel"
              ? "#CA8A04"
              : "#16A34A";

        return (
          <div
            key={i}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 14,
              background: "#FFFBFC",
            }}
          >
            {/* Actor + move */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {m.actor && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: `${ACCENT}15`,
                    color: ACCENT,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {m.actor}
                </span>
              )}
              {m.impact && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: `${impactColor}15`,
                    color: impactColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {de ? "Auswirkung" : "Impact"}: {m.impact}
                </span>
              )}
            </div>

            {/* Move description */}
            {m.move && (
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)", margin: "0 0 8px" }}>
                {m.move}
              </p>
            )}

            {/* Probability bar */}
            {prob !== null && (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 3,
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {de ? "Wahrscheinlichkeit" : "Probability"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, fontFamily: "var(--font-mono)" }}>
                    {Math.round(prob * 100)}%
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
                      width: `${Math.min(Math.round(prob * 100), 100)}%`,
                      background: ACCENT,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Cascade effects */}
            {Array.isArray(m.cascadeEffects) && m.cascadeEffects.length > 0 && (
              <div>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                  {de ? "Kaskadeneffekte" : "Cascade Effects"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                  {m.cascadeEffects.map((c, j) => (
                    <div
                      key={j}
                      style={{
                        fontSize: 12,
                        color: "var(--foreground)",
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: `${ACCENT}08`,
                        border: `1px solid ${ACCENT}20`,
                      }}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   Step 3 — Response matrix + counter-strategies
   ================================================================ */

function ResponsesViz({ data, de }: { data: any; de: boolean }) {
  const rows: ResponseRow[] = Array.isArray(data?.responses)
    ? data.responses
    : Array.isArray(data?.matrix)
      ? data.matrix
      : Array.isArray(data?.items)
        ? data.items
        : [];

  const counterStrategies: CounterStrategy[] = Array.isArray(
    data?.counterStrategies,
  )
    ? data.counterStrategies
    : [];

  if (rows.length === 0 && counterStrategies.length === 0)
    return <FallbackSynthesis text={data?.synthesis} />;

  const priorityColor = (p: string) => {
    const l = p.toLowerCase();
    if (l === "high" || l === "hoch") return { bg: "#FEE2E2", fg: "#DC2626" };
    if (l === "medium" || l === "mittel") return { bg: "#FEFCE8", fg: "#CA8A04" };
    return { bg: "#F0FDF4", fg: "#16A34A" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", marginBottom: 2 }}>
          {data.synthesis}
        </p>
      )}

      {/* Matrix table */}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              fontFamily: "var(--font-ui)",
            }}
          >
            <thead>
              <tr>
                {[
                  de ? "Gegenzug" : "Opponent Move",
                  de ? "Beste Antwort" : "Best Response",
                  de ? "Alternative" : "Alternative",
                  de ? "Risiko bei Passivität" : "Risk of Inaction",
                  de ? "Priorität" : "Priority",
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderBottom: `2px solid ${BORDER}`,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: ACCENT,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pc = row.priority
                  ? priorityColor(row.priority)
                  : null;
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: `1px solid ${BORDER}40`,
                      background: i % 2 === 0 ? "transparent" : `${BORDER}15`,
                    }}
                  >
                    <td style={{ padding: "8px 10px", color: "var(--foreground)", fontWeight: 600 }}>
                      {row.opponentMove || "—"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--foreground)" }}>
                      {row.bestResponse || "—"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--muted-foreground)" }}>
                      {row.alternative || "—"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--muted-foreground)" }}>
                      {row.riskOfInaction || "—"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {row.priority && pc ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: pc.bg,
                            color: pc.fg,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {row.priority}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Counter-strategy cards */}
      {counterStrategies.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              marginBottom: 8,
            }}
          >
            {de ? "Gegenstrategien" : "Counter-Strategies"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {counterStrategies.map((cs, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: 12,
                  background: "#FFFBFC",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                  {cs.name || `${de ? "Strategie" : "Strategy"} ${i + 1}`}
                </div>
                {cs.targetActor && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 5,
                      background: `${ACCENT}12`,
                      color: ACCENT,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      marginBottom: 4,
                      display: "inline-block",
                    }}
                  >
                    {de ? "Ziel" : "Target"}: {cs.targetActor}
                  </span>
                )}
                {cs.description && (
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
                    {cs.description}
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

/* ================================================================
   Step 4 — Red Team / Vulnerability cards
   ================================================================ */

function RedTeamViz({ data, de }: { data: any; de: boolean }) {
  const vulns: Vulnerability[] = Array.isArray(data?.vulnerabilities)
    ? data.vulnerabilities
    : Array.isArray(data?.items)
      ? data.items
      : [];

  const worstCase: string | undefined =
    data?.worstCaseScenario || data?.worstCase;

  if (vulns.length === 0 && !worstCase)
    return <FallbackSynthesis text={data?.synthesis} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data?.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", marginBottom: 4 }}>
          {data.synthesis}
        </p>
      )}

      {/* Vulnerability cards */}
      {vulns.map((v, i) => {
        const sevKey = (v.severity || "").toLowerCase();
        const sev = SEVERITY_COLORS[sevKey] || { bg: "#F3F4F6", fg: "#6B7280" };

        return (
          <div
            key={i}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 14,
              background: "#FFFBFC",
            }}
          >
            {/* Name + severity */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                {v.name || `${de ? "Schwachstelle" : "Vulnerability"} ${i + 1}`}
              </span>
              {v.severity && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: sev.bg,
                    color: sev.fg,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {v.severity}
                </span>
              )}
            </div>

            {/* Exploit scenario */}
            {v.exploitScenario && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                  {de ? "Angriffsszenario" : "Exploit Scenario"}
                </span>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--foreground)", margin: "3px 0 0" }}>
                  {v.exploitScenario}
                </p>
              </div>
            )}

            {/* Current defense */}
            {v.currentDefense && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                  {de ? "Aktuelle Verteidigung" : "Current Defense"}
                </span>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--foreground)", margin: "3px 0 0" }}>
                  {v.currentDefense}
                </p>
              </div>
            )}

            {/* Recommendation */}
            {v.recommendation && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: `${ACCENT}08`,
                  border: `1px solid ${ACCENT}20`,
                }}
              >
                <span style={{ fontSize: 10, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  {de ? "Empfehlung" : "Recommendation"}
                </span>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--foreground)", margin: "3px 0 0" }}>
                  {v.recommendation}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Worst case scenario highlight */}
      {worstCase && (
        <div
          style={{
            border: `2px solid #DC2626`,
            borderRadius: 12,
            padding: 16,
            background: "#FEF2F2",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#DC2626",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              !
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#DC2626",
                fontFamily: "var(--font-mono)",
              }}
            >
              {de ? "Worst-Case-Szenario" : "Worst Case Scenario"}
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#7F1D1D", margin: 0 }}>
            {worstCase}
          </p>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Shared fallback
   ================================================================ */

function FallbackSynthesis({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)" }}>
      {text}
    </p>
  );
}
