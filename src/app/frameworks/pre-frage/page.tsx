"use client";

/**
 * Pre-Frage / Pre-Question Framework UI — v0.2 (Topic → Question Atlas)
 *
 * 2026-04-23 v0.2 (Founder-Korrektur):
 * v0.1 hatte das Framework als "Question-Coaching" implementiert (User
 * gibt vage Frage → System schärft sie). Das war falsch. Korrekt:
 *
 *   Input  = ein THEMENFELD (kein Frage-Stub)
 *   Output = ein FRAGE-ATLAS, kuratiert auf 7-9 Core-Fragen + 2-3
 *            Provokante + 1-3 Open-Research, plus Top-3 Starter-Sequenz
 *
 * UI-Philosophie: bewusst KEINE Charts/Matrizen — nur ruhige, lesbare
 * Karten-Listen. Frage-Hierarchien lesen sich besser als Text als als
 * Diagramm. Visueller Unterschied signalisiert kognitiven Unterschied:
 * dieses Framework ist anders.
 *
 * Drei Schritte:
 *  1. Topic-Mapping        → Facetten, Stakeholder, Welt-Modell-Anknüpfung
 *  2. Question-Atlas       → Core + Provokant + Open-Research
 *  3. Starter-Sequenz      → Top-3 + Alternativen + ehrliche Unsicherheit
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
const ACCENT_DARK = "#3F2A5C";

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
        stepId="topic-mapping"
        title={tl("preFrage.step1Title")}
        description={tl("preFrage.step1Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["topic-mapping"]}
        onRun={() => runStep("topic-mapping", topic, locale)}
        de={de}
      >
        <TopicMappingViz data={steps["topic-mapping"]?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="question-atlas"
        title={tl("preFrage.step2Title")}
        description={tl("preFrage.step2Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["question-atlas"]}
        onRun={() => runStep("question-atlas", topic, locale, previousResults(["topic-mapping"]))}
        disabled={steps["topic-mapping"]?.status !== "done"}
        de={de}
      >
        <QuestionAtlasViz data={steps["question-atlas"]?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="starter-sequence"
        title={tl("preFrage.step3Title")}
        description={tl("preFrage.step3Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps["starter-sequence"]}
        onRun={() => runStep("starter-sequence", topic, locale, previousResults(["topic-mapping", "question-atlas"]))}
        disabled={steps["question-atlas"]?.status !== "done"}
        de={de}
      >
        <StarterSequenceViz data={steps["starter-sequence"]?.data} de={de} />
      </StepCard>
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#6B5B95",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 12,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Synthesis({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 12px",
        background: "#F4EEFF",
        borderRadius: 6,
        fontSize: 13,
        fontStyle: "italic",
        color: ACCENT_DARK,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function HonestStateCallout({ text, de }: { text?: string; de: boolean }) {
  if (!text) return null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        background: "#FEF9E7",
        border: "1px solid #F0D970",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#7A5C00", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {de ? "Ehrlicher Wissensstand" : "Honest State of Knowledge"}
      </div>
      <div style={{ fontSize: 13, color: "#7A5C00", lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function Tag({ label, color = ACCENT }: { label: string; color?: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        padding: "2px 6px",
        whiteSpace: "nowrap",
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {label}
    </span>
  );
}

// ─── Step 1 — Topic-Mapping ──────────────────────────────────────────────────
function TopicMappingViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const facets: any[] = Array.isArray(data.facets) ? data.facets : [];
  const inScope: string[] = Array.isArray(data.boundaries?.inScope) ? data.boundaries.inScope : [];
  const outOfScope: string[] = Array.isArray(data.boundaries?.outOfScope) ? data.boundaries.outOfScope : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.topicReformulation && (
        <div
          style={{
            background: PANEL_BG,
            border: `2px solid ${ACCENT}`,
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT_DARK, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            {tl("preFrage.topicReformulation")}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#1F2937", lineHeight: 1.45 }}>
            {data.topicReformulation}
          </div>
        </div>
      )}

      {facets.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.facets")} ({facets.length})</SectionHeader>
          {facets.map((f, i) => (
            <div
              key={`f-${i}`}
              style={{
                background: "#fff",
                border: `1px solid ${BORDER}`,
                borderLeft: `3px solid ${ACCENT}`,
                borderRadius: 6,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1F2937", lineHeight: 1.4 }}>
                {f.name}
              </div>
              {f.scope && (
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  {f.scope}
                </div>
              )}
              {Array.isArray(f.stakeholders) && f.stakeholders.length > 0 && (
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
                  <strong>{tl("preFrage.stakeholders")}:</strong> {f.stakeholders.join(" · ")}
                </div>
              )}
              {(Array.isArray(f.connectedTrends) && f.connectedTrends.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                  {f.connectedTrends.map((t: string, j: number) => (
                    <Tag key={`t-${j}`} label={`TREND: ${t}`} color="#3F2A5C" />
                  ))}
                </div>
              )}
              {(Array.isArray(f.connectedRegulations) && f.connectedRegulations.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {f.connectedRegulations.map((r: string, j: number) => (
                    <Tag key={`r-${j}`} label={`REGS: ${r}`} color="#955A20" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {(inScope.length > 0 || outOfScope.length > 0) && (
        <>
          <SectionHeader>{tl("preFrage.boundaries")}</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {inScope.length > 0 && (
              <div style={{ background: "#EEFAF4", border: "1px solid #90DCA8", borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6038", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  ✓ {tl("preFrage.inScope")}
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  {inScope.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
                </ul>
              </div>
            )}
            {outOfScope.length > 0 && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  ✗ {tl("preFrage.outOfScope")}
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  {outOfScope.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
          {data.boundaries?.rationale && (
            <div style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic", marginTop: 4 }}>
              {data.boundaries.rationale}
            </div>
          )}
        </>
      )}

      <Synthesis text={data.synthesis} />
    </div>
  );
}

// ─── Step 2 — Question Atlas ─────────────────────────────────────────────────
function QuestionAtlasViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const core: any[] = Array.isArray(data.coreQuestions) ? data.coreQuestions : [];
  const provocative: any[] = Array.isArray(data.provocativeQuestions) ? data.provocativeQuestions : [];
  const open: any[] = Array.isArray(data.openResearch) ? data.openResearch : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {core.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.coreQuestions")} ({core.length})</SectionHeader>
          {core.map((q, i) => (
            <div
              key={`c-${i}`}
              style={{
                background: "#fff",
                border: `1px solid ${BORDER}`,
                borderLeft: `4px solid ${ACCENT}`,
                borderRadius: 6,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    minWidth: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: ACCENT,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {q.rank ?? i + 1}
                </div>
                <div style={{ fontWeight: 500, fontSize: 14, color: "#1F2937", lineHeight: 1.5 }}>
                  {q.question}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {q.class && <Tag label={q.class} />}
                {q.facetReference && <Tag label={q.facetReference} color="#6B7280" />}
                {q.dataAvailability && (
                  <Tag
                    label={`${tl("preFrage.dataAvailability")}: ${q.dataAvailability}`}
                    color={q.dataAvailability === "live-signals" ? "#0F6038" : q.dataAvailability === "research-needed" ? "#991B1B" : "#955A20"}
                  />
                )}
              </div>
              {q.whyMatters && (
                <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5 }}>
                  <strong>{tl("preFrage.whyMatters")}:</strong> {q.whyMatters}
                </div>
              )}
              {q.addressableBy?.framework && (
                <div
                  style={{
                    fontSize: 12,
                    color: ACCENT_DARK,
                    padding: "6px 10px",
                    background: PANEL_BG,
                    borderRadius: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div>
                    <strong>→ {tl("preFrage.addressableBy")}:</strong>{" "}
                    <code style={{ background: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>
                      {q.addressableBy.framework}
                    </code>
                  </div>
                  {q.addressableBy.rationale && (
                    <div style={{ fontStyle: "italic", color: "#6B7280" }}>{q.addressableBy.rationale}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {provocative.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.provocativeQuestions")} ({provocative.length})</SectionHeader>
          {provocative.map((q, i) => (
            <div
              key={`p-${i}`}
              style={{
                background: "#fff",
                border: "1px solid #F4B8C8",
                borderLeft: "4px solid #A02A6E",
                borderRadius: 6,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: "#1F2937", lineHeight: 1.5 }}>
                  {q.question}
                </div>
                {q.type && <Tag label={q.type} color="#A02A6E" />}
              </div>
              {q.whyProvocative && (
                <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5, fontStyle: "italic" }}>
                  {q.whyProvocative}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {open.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.openResearch")} ({open.length})</SectionHeader>
          {open.map((o, i) => (
            <div
              key={`o-${i}`}
              style={{
                background: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: 6,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: "#78350F", lineHeight: 1.5 }}>
                {o.topic}
              </div>
              {o.wouldNeed && (
                <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
                  <strong>{tl("preFrage.wouldNeed")}:</strong> {o.wouldNeed}
                </div>
              )}
              {o.whyNoFramework && (
                <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5, fontStyle: "italic" }}>
                  {o.whyNoFramework}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <Synthesis text={data.synthesis} />
    </div>
  );
}

// ─── Step 3 — Starter Sequence ───────────────────────────────────────────────
function StarterSequenceViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const seq: any[] = Array.isArray(data.starterSequence) ? data.starterSequence : [];
  const alts: any[] = Array.isArray(data.alternativeStarters) ? data.alternativeStarters : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {seq.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.starterSequence")}</SectionHeader>
          {seq.map((s, i) => (
            <div
              key={`seq-${i}`}
              style={{
                background: "#fff",
                border: `2px solid ${ACCENT}`,
                borderRadius: 8,
                padding: "14px 16px",
                display: "flex",
                gap: 12,
              }}
            >
              <div
                style={{
                  minWidth: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: ACCENT,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {s.order ?? i + 1}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#1F2937", lineHeight: 1.45 }}>
                  {s.question}
                </div>
                {s.questionRef && (
                  <div style={{ fontSize: 11, color: "#6B7280" }}>
                    <code style={{ background: PANEL_BG, padding: "1px 5px", borderRadius: 3 }}>{s.questionRef}</code>
                  </div>
                )}
                {s.framework && (
                  <div style={{ fontSize: 12, color: ACCENT_DARK }}>
                    <strong>→ Framework:</strong>{" "}
                    <code style={{ background: PANEL_BG, padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>
                      {s.framework}
                    </code>
                  </div>
                )}
                {s.rationale && (
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                    <strong>{tl("preFrage.rationale")}:</strong> {s.rationale}
                  </div>
                )}
                {s.expectedOutput && (
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
                    <strong>{tl("preFrage.expectedOutput")}:</strong> {s.expectedOutput}
                  </div>
                )}
                {s.enables && (
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, fontStyle: "italic" }}>
                    <strong>{tl("preFrage.enables")}:</strong> {s.enables}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {alts.length > 0 && (
        <>
          <SectionHeader>{tl("preFrage.alternativeStarters")}</SectionHeader>
          {alts.map((a, i) => (
            <div
              key={`alt-${i}`}
              style={{
                background: PANEL_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 13,
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.scenario}</div>
              {a.alternativeFirstQuestion && (
                <div style={{ fontSize: 12, color: ACCENT_DARK, marginBottom: 4 }}>
                  → <code style={{ background: "#fff", padding: "1px 5px", borderRadius: 3 }}>{a.alternativeFirstQuestion}</code>
                </div>
              )}
              {a.rationale && (
                <div style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>{a.rationale}</div>
              )}
            </div>
          ))}
        </>
      )}

      <HonestStateCallout text={data.honestStateOfKnowledge} de={de} />
      <Synthesis text={data.synthesis} />
    </div>
  );
}
