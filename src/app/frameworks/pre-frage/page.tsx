"use client";

/**
 * Pre-Frage / Pre-Question Framework UI
 *
 * 2026-04-23 (initial implementation): minimaler aber funktional vollständiger
 * UI-Layer für das vierschrittige Question-Architecture-Framework. Bewusst
 * NICHT die übliche „Antwort"-Visualisierung (Charts, Matrices) — sondern
 * eine ruhige, lesbare Karten-Liste pro Frage-Klasse, weil das Output
 * fundamental anders ist als bei den anderen Frameworks: keine Antworten,
 * nur Fragen.
 *
 * Folgt dem Pattern von post-mortem/page.tsx (FrameworkShell + StepCards
 * pro Schritt + per-Schritt-Visualisierung). Die Visualisierungen sind
 * hier deliberately simple (Listen + Karten), weil Frage-Hierarchien am
 * besten als Text gelesen werden, nicht als Diagramm.
 */

import React from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { StepCard } from "@/components/frameworks/StepCard";

const ACCENT = "#5A2A9E";
const BORDER = "#C0A8F0";
const PANEL_BG = "#FAF7FF";

// ─── Page entry point ────────────────────────────────────────────────────────
export default function PreFragePage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("pre-frage")}>
      {({ topic, locale, de, projectId }) => (
        <PreFrageContent topic={topic} locale={locale} de={de} projectId={projectId} />
      )}
    </FrameworkShell>
  );
}

// ─── Step orchestration ──────────────────────────────────────────────────────
function PreFrageContent({
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
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  const { steps, runStep } = useFrameworkAnalysis("pre-frage", projectId);

  const previousResults = (ids: string[]) => {
    const out: Record<string, any> = {};
    for (const id of ids) {
      if (steps[id]?.status === "done" && steps[id]?.data) {
        out[id] = steps[id].data;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <StepCard
        stepId="reframing"
        title={tl("preFrage.step1Title")}
        description={tl("preFrage.step1Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.reframing}
        onRun={() => runStep("reframing", topic, locale)}
        de={de}
      >
        <ReframingViz data={steps.reframing?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="decomposition"
        title={tl("preFrage.step2Title")}
        description={tl("preFrage.step2Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.decomposition}
        onRun={() => runStep("decomposition", topic, locale, previousResults(["reframing"]))}
        disabled={steps.reframing?.status !== "done"}
        de={de}
      >
        <DecompositionViz data={steps.decomposition?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="inversion"
        title={tl("preFrage.step3Title")}
        description={tl("preFrage.step3Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.inversion}
        onRun={() => runStep("inversion", topic, locale, previousResults(["reframing", "decomposition"]))}
        disabled={steps.decomposition?.status !== "done"}
        de={de}
      >
        <InversionViz data={steps.inversion?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="critical"
        title={tl("preFrage.step4Title")}
        description={tl("preFrage.step4Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.critical}
        onRun={() => runStep("critical", topic, locale, previousResults(["reframing", "decomposition", "inversion"]))}
        disabled={steps.inversion?.status !== "done"}
        de={de}
      >
        <CriticalViz data={steps.critical?.data} de={de} />
      </StepCard>
    </div>
  );
}

// ─── Shared question card (used across all steps) ────────────────────────────
function QuestionCard({
  question,
  meta,
  metaLabel,
  badge,
  accentColor = ACCENT,
}: {
  question: string;
  meta?: string;
  metaLabel?: string;
  badge?: string;
  accentColor?: string;
}) {
  return (
    <div
      style={{
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 6,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
        <div style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.45, color: "#1F2937" }}>
          {question}
        </div>
        {badge ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: accentColor,
              background: "#fff",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {meta ? (
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
          {metaLabel ? <span style={{ fontWeight: 500 }}>{metaLabel}: </span> : null}
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: "#6B5B95", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 }}>
      {children}
    </div>
  );
}

function Synthesis({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div style={{ marginTop: 12, padding: "10px 12px", background: "#F4EEFF", borderRadius: 6, fontSize: 13, fontStyle: "italic", color: "#3F2A5C", lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

// ─── Step 1 — Reframing ──────────────────────────────────────────────────────
function ReframingViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const assumptions: any[] = Array.isArray(data.implicitAssumptions) ? data.implicitAssumptions : [];
  const reframings: any[] = Array.isArray(data.reframings) ? data.reframings : [];
  const deeper = data.deeperQuestion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {deeper?.candidate ? (
        <>
          <SectionHeader>{tl("preFrage.deeperQuestion")}</SectionHeader>
          <QuestionCard
            question={deeper.candidate}
            meta={deeper.reasoning}
            metaLabel={tl("preFrage.rationale")}
            accentColor="#7C2D9E"
          />
        </>
      ) : null}

      {assumptions.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.implicitAssumptions")}</SectionHeader>
          {assumptions.map((a, i) => (
            <QuestionCard
              key={`a-${i}`}
              question={a.assumption}
              meta={a.whyMatters}
              metaLabel={tl("preFrage.whyImportant")}
            />
          ))}
        </>
      )}

      {reframings.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.reframings")}</SectionHeader>
          {reframings.map((r, i) => (
            <QuestionCard
              key={`r-${i}`}
              question={r.reformulated}
              meta={r.whyDifferent}
              badge={r.frame}
            />
          ))}
        </>
      )}

      <Synthesis text={data.synthesis} />
    </div>
  );
}

// ─── Step 2 — Decomposition + STEEP+V ────────────────────────────────────────
function DecompositionViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const subs: any[] = Array.isArray(data.subQuestions) ? data.subQuestions : [];
  const lenses = data.lensQuestions || {};
  const horizons: any[] = Array.isArray(data.timeHorizonQuestions) ? data.timeHorizonQuestions : [];
  const lensOrder = ["social", "technological", "economic", "environmental", "political", "values"] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {subs.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.subQuestions")}</SectionHeader>
          {subs.map((s, i) => (
            <QuestionCard
              key={`s-${i}`}
              question={s.question}
              meta={s.whyEssential}
              metaLabel={tl("preFrage.whyEssential")}
              badge={s.type}
            />
          ))}
        </>
      )}

      <SectionHeader>{tl("preFrage.lensQuestions")}</SectionHeader>
      {lensOrder.map((lens) => {
        const items = Array.isArray(lenses[lens]) ? lenses[lens] : [];
        if (items.length === 0) return null;
        return (
          <div key={lens} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: ACCENT, textTransform: "capitalize" }}>{lens}</div>
            {items.map((q: any, i: number) => (
              <QuestionCard
                key={`${lens}-${i}`}
                question={q.question}
                meta={q.rationale}
                metaLabel={tl("preFrage.rationale")}
              />
            ))}
          </div>
        );
      })}

      {horizons.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.timeHorizonQuestions")}</SectionHeader>
          {horizons.map((h, i) => (
            <QuestionCard key={`h-${i}`} question={h.question} badge={h.horizon} />
          ))}
        </>
      )}

      <Synthesis text={data.synthesis} />
    </div>
  );
}

// ─── Step 3 — Inversion + Provocation ────────────────────────────────────────
function InversionViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const inversions: any[] = Array.isArray(data.inversionQuestions) ? data.inversionQuestions : [];
  const taboos: any[] = Array.isArray(data.tabooQuestions) ? data.tabooQuestions : [];
  const blindSpots: any[] = Array.isArray(data.blindSpotQuestions) ? data.blindSpotQuestions : [];
  const pre = data.premortemQuestion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {inversions.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.inversionQuestions")}</SectionHeader>
          {inversions.map((q, i) => (
            <QuestionCard
              key={`i-${i}`}
              question={q.question}
              meta={q.uncomfortableBecause}
              metaLabel={de ? "Unbequem weil" : "Uncomfortable because"}
            />
          ))}
        </>
      )}

      {taboos.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.tabooQuestions")}</SectionHeader>
          {taboos.map((q, i) => (
            <QuestionCard
              key={`t-${i}`}
              question={q.question}
              meta={`${q.tabooReason || ""} — ${q.whyImportant || ""}`}
              metaLabel={tl("preFrage.whyImportant")}
              accentColor="#A02A6E"
            />
          ))}
        </>
      )}

      {pre?.missedQuestion && (
        <>
          <SectionHeader>{tl("preFrage.premortemQuestion")}</SectionHeader>
          <QuestionCard
            question={pre.missedQuestion}
            meta={pre.scenario}
            metaLabel={de ? "Failure-Szenario" : "Failure scenario"}
            accentColor="#8B1A2A"
          />
          {Array.isArray(pre.earlyWarningSignals) && pre.earlyWarningSignals.length > 0 && (
            <div style={{ marginLeft: 12, fontSize: 12, color: "#6B7280" }}>
              <strong style={{ color: "#3F2A5C" }}>{de ? "Frühwarnsignale:" : "Early warning signals:"}</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {pre.earlyWarningSignals.map((s: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {blindSpots.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.blindSpotQuestions")}</SectionHeader>
          {blindSpots.map((q, i) => (
            <QuestionCard
              key={`b-${i}`}
              question={q.question}
              meta={q.vantagePointShift}
              metaLabel={de ? "Sichtbar aus" : "Visible from"}
            />
          ))}
        </>
      )}

      <Synthesis text={data.synthesis} />
    </div>
  );
}

// ─── Step 4 — Critical Synthesis ─────────────────────────────────────────────
function CriticalViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const critical: any[] = Array.isArray(data.criticalQuestions) ? data.criticalQuestions : [];
  const gaps: any[] = Array.isArray(data.knowledgeGaps) ? data.knowledgeGaps : [];
  const roadmap: any[] = Array.isArray(data.frameworkRoadmap) ? data.frameworkRoadmap : [];
  const explicit: any[] = Array.isArray(data.explicitAssumptionsToTest) ? data.explicitAssumptionsToTest : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {critical.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.criticalQuestions")}</SectionHeader>
          {critical.map((q, i) => (
            <div
              key={`c-${i}`}
              style={{
                background: "#fff",
                border: `2px solid ${ACCENT}`,
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: ACCENT,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {q.rank ?? i + 1}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.45, color: "#1F2937" }}>{q.question}</div>
              </div>
              {q.whyCritical && (
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  <strong>{tl("preFrage.whyCritical")}:</strong> {q.whyCritical}
                </div>
              )}
              {q.ifNotAnswered && (
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
                  <strong>{de ? "Wenn unbeantwortet" : "If unanswered"}:</strong> {q.ifNotAnswered}
                </div>
              )}
              {q.addressableBy?.framework && (
                <div style={{ fontSize: 12, color: "#3F2A5C", padding: "6px 10px", background: PANEL_BG, borderRadius: 4 }}>
                  <strong>→ {tl("preFrage.addressableBy")}:</strong> <code style={{ background: "#fff", padding: "1px 6px", borderRadius: 3 }}>{q.addressableBy.framework}</code>
                  {q.addressableBy.rationale ? <span style={{ marginLeft: 6, fontStyle: "italic" }}>— {q.addressableBy.rationale}</span> : null}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {roadmap.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.frameworkRoadmap")}</SectionHeader>
          {roadmap.map((r, i) => (
            <QuestionCard
              key={`rm-${i}`}
              question={`${r.order ?? i + 1}. ${r.framework}`}
              meta={`${r.questionItAddresses}${r.dependsOn ? ` — ${de ? "Abhängig von" : "Depends on"}: ${r.dependsOn}` : ""}`}
              badge={r.estimatedEffort}
            />
          ))}
        </>
      )}

      {gaps.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.knowledgeGaps")}</SectionHeader>
          {gaps.map((g, i) => (
            <QuestionCard
              key={`g-${i}`}
              question={g.gap}
              meta={`${g.couldComeFrom}${g.decisiveFor ? ` — ${de ? "entscheidend für" : "decisive for"}: ${g.decisiveFor}` : ""}`}
              metaLabel={de ? "Quelle" : "Source"}
              badge={g.currentlyAvailable === false ? (de ? "fehlt" : "missing") : (de ? "vorhanden" : "available")}
            />
          ))}
        </>
      )}

      {explicit.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.explicitAssumptions")}</SectionHeader>
          {explicit.map((a, i) => (
            <QuestionCard
              key={`e-${i}`}
              question={a.assumption}
              meta={a.testHow}
              metaLabel={de ? "Test" : "Test"}
            />
          ))}
        </>
      )}

      {data.honestStateOfKnowledge && (
        <>
          <SectionHeader>{tl("preFrage.honestKnowledge")}</SectionHeader>
          <div
            style={{
              background: "#FEF9E7",
              border: "1px solid #F0D970",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              color: "#7A5C00",
              lineHeight: 1.5,
            }}
          >
            {data.honestStateOfKnowledge}
          </div>
        </>
      )}

      <Synthesis text={data.synthesis} />
    </div>
  );
}
