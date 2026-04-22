"use client";

/**
 * Design Thinking Framework Page
 *
 * Backlog-Task "Design Thinking / weitere Analyse-Methoden als Templates"
 * (2026-04-22). Human-centered strategic design in four steps:
 *
 *   1. Empathize  — Stakeholder-Empathie + Jobs-to-be-done
 *   2. Define     — Problem-Reframing ("How might we …") mit 3–5 Varianten
 *   3. Ideate     — Solution-Divergenz über fünf strukturell verschiedene Typen
 *   4. Validate   — Experiment-Design mit Success + Kill-Metriken
 *
 * Anders als das klassische 5-Phasen-DT (Empathize/Define/Ideate/Prototype/
 * Test) fasst dieses Template Prototype+Test zur Validate-Phase zusammen,
 * weil eine strategische Intelligence-Frage nicht auf ein Produkt-MVP
 * zielt, sondern auf eine überprüfbare Entscheidung (Policy, Roadmap,
 * Offer). Das spart Schritte ohne Prinzipien-Verlust.
 *
 * Prompt-Logik liegt in `/api/v1/frameworks/analyze/route.ts` unter dem
 * `FRAMEWORK_PROMPTS["design-thinking"]`-Handler.
 */

import React from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { StepCard } from "@/components/frameworks/StepCard";

const ACCENT = "#B45309";
const BORDER = "#F0C088";

const SOLUTION_TYPE_COLOR: Record<string, string> = {
  "incremental":         "#1A4A8A",
  "disruptive":          "#B91C1C",
  "analog":              "#7C1A9E",
  "structural":          "#0F6038",
  "reframe-challenge":   "#7A5C00",
};

function scoreBar(value: number, max = 5): React.ReactNode {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ height: 5, borderRadius: 3, background: "var(--muted, #F0F0F0)", overflow: "hidden", minWidth: 60 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: ACCENT, borderRadius: 3 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════ */
export default function DesignThinkingPage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("design-thinking")}>
      {({ topic, locale, de, projectId }) => (
        <DesignThinkingContent topic={topic} locale={locale} de={de} projectId={projectId} />
      )}
    </FrameworkShell>
  );
}

/* ═══════════════════════════════════════════════════════════
   Content — 4 sequential steps
   ═══════════════════════════════════════════════════════════ */
function DesignThinkingContent({
  topic,
  locale,
  de,
  projectId,
}: {
  topic: string;
  locale: string;
  de: boolean;
  projectId?: string | null;
}) {
  const { steps, runStep } = useFrameworkAnalysis("design-thinking", projectId);

  const previousData = (ids: string[]) => {
    const out: Record<string, any> = {};
    for (const id of ids) {
      if (steps[id]?.status === "done" && steps[id]?.data) out[id] = steps[id].data;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Step 1 — Empathize */}
      <StepCard
        stepId="empathize"
        title={de ? "1. Empathie — Wer und welcher Job-to-be-done?" : "1. Empathize — who, and which job-to-be-done?"}
        description={de
          ? "Konkrete Stakeholder-Gruppen mit Namen, Jobs, Pain-Points und emotionaler Landkarte."
          : "Concrete stakeholder groups with names, jobs, pain points and an emotional map."}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["empathize"]}
        onRun={() => runStep("empathize", topic, locale)}
        de={de}
      >
        {steps["empathize"]?.data && <EmpathizeViz data={steps["empathize"].data} de={de} />}
      </StepCard>

      {/* Step 2 — Define */}
      <StepCard
        stepId="define"
        title={de ? "2. Define — Problem reframen" : "2. Define — reframe the problem"}
        description={de
          ? "3–5 „How might we …\"-Varianten, bewertet nach Hebel, Machbarkeit, Blast Radius."
          : "3–5 'How might we …' reframings, rated on leverage, feasibility, and blast radius."}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["define"]}
        onRun={() => runStep("define", topic, locale, previousData(["empathize"]))}
        disabled={steps["empathize"]?.status !== "done"}
        de={de}
      >
        {steps["define"]?.data && <DefineViz data={steps["define"].data} de={de} />}
      </StepCard>

      {/* Step 3 — Ideate */}
      <StepCard
        stepId="ideate"
        title={de ? "3. Ideate — Lösungsraum divergent öffnen" : "3. Ideate — open the solution space"}
        description={de
          ? "6–10 Lösungen, mind. eine pro Typ: inkrementell, disruptiv, Analog, strukturell, Reframe-Challenge."
          : "6–10 solutions, at least one per type: incremental, disruptive, analog, structural, reframe-challenge."}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["ideate"]}
        onRun={() => runStep("ideate", topic, locale, previousData(["empathize", "define"]))}
        disabled={steps["define"]?.status !== "done"}
        de={de}
      >
        {steps["ideate"]?.data && <IdeateViz data={steps["ideate"].data} de={de} />}
      </StepCard>

      {/* Step 4 — Validate */}
      <StepCard
        stepId="validate"
        title={de ? "4. Validate — Experimente mit Kill-Metrik" : "4. Validate — experiments with a kill-metric"}
        description={de
          ? "2–3 Experimente (4–12 Wochen) mit Hypothese, Success- + Kill-Metrik, Entscheidungsrubrik."
          : "2–3 experiments (4–12 weeks) with hypothesis, success + kill metric, decision rubric."}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["validate"]}
        onRun={() => runStep("validate", topic, locale, previousData(["empathize", "define", "ideate"]))}
        disabled={steps["ideate"]?.status !== "done"}
        de={de}
      >
        {steps["validate"]?.data && <ValidateViz data={steps["validate"].data} de={de} />}
      </StepCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 1 — Empathize Visualization
   ═══════════════════════════════════════════════════════════ */
function EmpathizeViz({ data, de }: { data: any; de: boolean }) {
  const stakeholders: any[] = Array.isArray(data.stakeholders) ? data.stakeholders : [];
  const emotionalMap: any[] = Array.isArray(data.emotionalMap) ? data.emotionalMap : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}
      {stakeholders.map((s, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: "12px 16px",
            background: "var(--background)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
            {s.name || `Stakeholder ${i + 1}`}
          </div>
          {s.jobToBeDone && (
            <div style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 8, color: "var(--foreground)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginRight: 6 }}>
                {de ? "Job" : "Job"}:
              </span>
              {s.jobToBeDone}
            </div>
          )}
          {s.context && (
            <div style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 8, color: "var(--muted-foreground)" }}>
              {s.context}
            </div>
          )}
          {Array.isArray(s.painPoints) && s.painPoints.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.55, color: "var(--foreground)" }}>
              {s.painPoints.map((p: string, j: number) => <li key={j}>{p}</li>)}
            </ul>
          )}
          {Array.isArray(s.signals) && s.signals.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {s.signals.map((sig: string, j: number) => (
                <span
                  key={j}
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${ACCENT}12`,
                    color: ACCENT,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {sig}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {emotionalMap.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 6 }}>
            {de ? "Emotionale Landkarte" : "Emotional Map"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {emotionalMap.map((e, i) => (
              <div key={i} style={{ padding: "8px 12px", borderRadius: 8, background: `${ACCENT}0a`, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: ACCENT, marginBottom: 2 }}>
                  {e.phase || `Phase ${i + 1}`}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{e.feeling}</div>
                {e.trigger && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{e.trigger}</div>
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
   Step 2 — Define Visualization
   ═══════════════════════════════════════════════════════════ */
function DefineViz({ data, de }: { data: any; de: boolean }) {
  const reframings: any[] = Array.isArray(data.reframings) ? data.reframings : [];
  const rejected: any[] = Array.isArray(data.rejectedFrames) ? data.rejectedFrames : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}
      {reframings.map((r, i) => (
        <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", background: "var(--background)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--foreground)", lineHeight: 1.4 }}>
            {r.statement || "—"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
            {[
              { label: de ? "Hebel" : "Leverage", value: r.leverage },
              { label: de ? "Machbarkeit" : "Feasibility", value: r.feasibility },
              { label: de ? "Blast Radius" : "Blast Radius", value: r.blastRadius },
            ].map((m, j) => (
              <div key={j}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 4 }}>
                  {m.label} <span style={{ color: ACCENT }}>{typeof m.value === "number" ? `${m.value}/5` : "—"}</span>
                </div>
                {typeof m.value === "number" && scoreBar(m.value)}
              </div>
            ))}
          </div>
          {r.hiddenAssumption && (
            <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, background: "#fef3c7", color: "#78350f", marginBottom: 6 }}>
              <strong style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{de ? "Versteckte Annahme: " : "Hidden assumption: "}</strong>
              {r.hiddenAssumption}
            </div>
          )}
          {r.whyItMatters && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
              {r.whyItMatters}
            </div>
          )}
        </div>
      ))}
      {rejected.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6 }}>
            {de ? "Verworfen" : "Rejected"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rejected.map((r, i) => (
              <div key={i} style={{ padding: "8px 12px", borderRadius: 8, background: "var(--muted, #F5F5F5)" }}>
                <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 2 }}>{r.statement}</div>
                {r.whyRejected && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.whyRejected}</div>
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
   Step 3 — Ideate Visualization
   ═══════════════════════════════════════════════════════════ */
function IdeateViz({ data, de }: { data: any; de: boolean }) {
  const solutions: any[] = Array.isArray(data.solutions) ? data.solutions : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}
      {solutions.map((s, i) => {
        const typeColor = SOLUTION_TYPE_COLOR[s.type] || ACCENT;
        return (
          <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", background: "var(--background)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{s.name}</span>
              {s.type && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: `${typeColor}18`,
                  color: typeColor,
                }}>
                  {s.type}
                </span>
              )}
            </div>
            {s.mechanism && (
              <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 6, lineHeight: 1.55 }}>
                {s.mechanism}
              </div>
            )}
            {s.prototype && (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6, lineHeight: 1.55 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginRight: 6 }}>
                  {de ? "Prototyp" : "Prototype"}:
                </span>
                {s.prototype}
              </div>
            )}
            {(Array.isArray(s.earlySignals) && s.earlySignals.length > 0) || (Array.isArray(s.killSignals) && s.killSignals.length > 0) ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                {Array.isArray(s.earlySignals) && s.earlySignals.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#0F6038", marginBottom: 3 }}>
                      {de ? "Early Signals" : "Early Signals"}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5, color: "var(--foreground)" }}>
                      {s.earlySignals.map((e: string, j: number) => <li key={j}>{e}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(s.killSignals) && s.killSignals.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#B91C1C", marginBottom: 3 }}>
                      {de ? "Kill Signals" : "Kill Signals"}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5, color: "var(--foreground)" }}>
                      {s.killSignals.map((k: string, j: number) => <li key={j}>{k}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
            {Array.isArray(s.linkedTrends) && s.linkedTrends.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {s.linkedTrends.map((t: string, j: number) => (
                  <span key={j} style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "var(--muted, #F5F5F5)",
                    color: "var(--muted-foreground)",
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 4 — Validate Visualization
   ═══════════════════════════════════════════════════════════ */
function ValidateViz({ data, de }: { data: any; de: boolean }) {
  const experiments: any[] = Array.isArray(data.experiments) ? data.experiments : [];
  const rubric: any[] = Array.isArray(data.decisionRubric) ? data.decisionRubric : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.synthesis && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", margin: 0 }}>
          {data.synthesis}
        </p>
      )}
      {experiments.map((e, i) => (
        <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", background: "var(--background)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--foreground)" }}>
            {e.solutionName}
          </div>
          {e.hypothesis && (
            <div style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 8, color: "var(--foreground)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginRight: 6 }}>
                {de ? "Hypothese" : "Hypothesis"}:
              </span>
              {e.hypothesis}
            </div>
          )}
          {e.smallestTest && (
            <div style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 8, color: "var(--foreground)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginRight: 6 }}>
                {de ? "Kleinster Test" : "Smallest Test"}:
              </span>
              {e.smallestTest}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            {e.successMetric && (
              <div style={{ padding: "8px 10px", borderRadius: 6, background: "#EEFAF4", border: "1px solid #90DCA8" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#0F6038", marginBottom: 2 }}>
                  {de ? "Success-Metrik" : "Success Metric"}
                </div>
                <div style={{ fontSize: 12, color: "var(--foreground)" }}>
                  <strong>{e.successMetric.name}</strong>
                  {e.successMetric.threshold && <> — {e.successMetric.threshold}</>}
                </div>
              </div>
            )}
            {e.killMetric && (
              <div style={{ padding: "8px 10px", borderRadius: 6, background: "#FFF0F4", border: "1px solid #F4B8C8" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#A0244A", marginBottom: 2 }}>
                  {de ? "Kill-Metrik" : "Kill Metric"}
                </div>
                <div style={{ fontSize: 12, color: "var(--foreground)" }}>
                  <strong>{e.killMetric.name}</strong>
                  {e.killMetric.threshold && <> — {e.killMetric.threshold}</>}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
            {e.timeline && (
              <span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)" }}>Timeline:</span>{" "}
                {e.timeline}
              </span>
            )}
            {e.cost && (
              <span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)" }}>{de ? "Aufwand" : "Cost"}:</span>{" "}
                {e.cost}
              </span>
            )}
            {Array.isArray(e.participants) && e.participants.length > 0 && (
              <span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)" }}>{de ? "Teilnehmer" : "Participants"}:</span>{" "}
                {e.participants.join(", ")}
              </span>
            )}
          </div>
        </div>
      ))}
      {rubric.length > 0 && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", background: `${ACCENT}0a` }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 8 }}>
            {de ? "Entscheidungs-Rubrik" : "Decision Rubric"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rubric.map((r, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.55, color: "var(--foreground)" }}>
                <strong style={{ color: ACCENT }}>{r.ifOutcome || "—"}</strong> → {r.then || "—"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
