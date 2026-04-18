"use client";

import React from "react";
import { FrameworkShell } from "@/components/frameworks/FrameworkShell";
import { getFrameworkMeta } from "@/types/frameworks";
import { useFrameworkAnalysis } from "@/lib/use-framework-analysis";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { StepCard } from "@/components/frameworks/StepCard";

const ACCENT = "#0F6038";
const BORDER = "#90DCA8";

const EVENT_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  decision:    { bg: "#DBEAFE", fg: "#1E40AF" },
  external:    { bg: "#F3F4F6", fg: "#4B5563" },
  trigger:     { bg: "#FFF7ED", fg: "#C2410C" },
  consequence: { bg: "#FEE2E2", fg: "#B91C1C" },
};

const EVENT_TYPE_LABELS_DE: Record<string, string> = {
  decision: "Entscheidung", external: "Extern", trigger: "Auslöser", consequence: "Konsequenz",
};
const EVENT_TYPE_LABELS_EN: Record<string, string> = {
  decision: "Decision", external: "External", trigger: "Trigger", consequence: "Consequence",
};

const SIG_SIZE: Record<string, number> = { high: 14, medium: 10, low: 6 };

const PRIORITY_COLORS: Record<string, string> = { high: "#DC2626", medium: "#EAB308", low: "#9CA3AF" };

const FIXABILITY_COLORS: Record<string, string> = { hard: "#DC2626", medium: "#EAB308", easy: "#16A34A" };

export default function PostMortemPage() {
  return (
    <FrameworkShell meta={getFrameworkMeta("post-mortem")}>
      {({ topic, locale, de }) => (
        <PostMortemContent topic={topic} locale={locale} de={de} />
      )}
    </FrameworkShell>
  );
}

function PostMortemContent({ topic, locale, de }: { topic: string; locale: string; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  const { steps, runStep } = useFrameworkAnalysis("post-mortem");

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
        stepId="timeline"
        title={tl("postMortem.step1Title")}
        description={tl("postMortem.step1Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.timeline}
        onRun={() => runStep("timeline", topic, locale)}
        de={de}
      >
        <TimelineViz data={steps.timeline?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="causes"
        title={tl("postMortem.step2Title")}
        description={tl("postMortem.step2Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.causes}
        onRun={() => runStep("causes", topic, locale, previousResults(["timeline"]))}
        disabled={steps.timeline?.status !== "done"}
        de={de}
      >
        <CausesViz data={steps.causes?.data} de={de} />
      </StepCard>

      <StepCard
        stepId="lessons"
        title={tl("postMortem.step3Title")}
        description={tl("postMortem.step3Desc")}
        accentColor={ACCENT}
        borderColor={BORDER}
        result={steps.lessons}
        onRun={() => runStep("lessons", topic, locale, previousResults(["timeline", "causes"]))}
        disabled={steps.causes?.status !== "done"}
        de={de}
      >
        <LessonsViz data={steps.lessons?.data} de={de} />
      </StepCard>
    </div>
  );
}

/* ─────────────────────── Step 1 — Timeline ──────────────────────── */
function TimelineViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const events: any[] = Array.isArray(data.timeline) ? data.timeline : (Array.isArray(data.events) ? data.events : []);
  const turningPoints: any[] = Array.isArray(data.keyTurningPoints) ? data.keyTurningPoints : [];
  const synthesis: string = data.synthesis || "";

  if (events.length === 0 && !synthesis) return null;
  const typeLabels = de ? EVENT_TYPE_LABELS_DE : EVENT_TYPE_LABELS_EN;

  // Mark turning points by date match
  const tpDates = new Set(turningPoints.map(t => t.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {synthesis && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: `${ACCENT}08`, border: `1px solid ${BORDER}40`,
          fontSize: 13, lineHeight: 1.7, color: "var(--foreground)",
        }}>
          {synthesis}
        </div>
      )}

      {events.length > 0 && (
        <div style={{ position: "relative", paddingLeft: 28 }}>
          <div style={{
            position: "absolute", left: 9, top: 6, bottom: 6,
            width: 2, background: BORDER, borderRadius: 1,
          }} />
          {events.map((ev, i) => {
            const sig = ev.significance || "medium";
            const dotSize = SIG_SIZE[sig] ?? 10;
            const typeColor = EVENT_TYPE_COLORS[ev.type] ?? EVENT_TYPE_COLORS.external;
            const isTP = tpDates.has(ev.date);
            const tp = turningPoints.find(t => t.date === ev.date);

            return (
              <div key={i} style={{ position: "relative", marginBottom: 14 }}>
                <div style={{
                  position: "absolute",
                  left: -28 + 10 - dotSize / 2,
                  top: 8,
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: isTP ? ACCENT : BORDER,
                  border: isTP ? `2px solid ${ACCENT}` : `2px solid ${BORDER}`,
                  zIndex: 1,
                }} />
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  border: isTP ? `1.5px solid ${ACCENT}` : "1px solid var(--border)",
                  background: isTP ? `${ACCENT}08` : "var(--card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                      {ev.date}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                      background: typeColor.bg, color: typeColor.fg,
                    }}>
                      {typeLabels[ev.type] ?? ev.type}
                    </span>
                    {isTP && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: ACCENT,
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        ★ {tl("postMortem.turningPoint")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}>
                    {ev.event}
                  </div>
                  {Array.isArray(ev.actors) && ev.actors.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                      {ev.actors.map((a: string, j: number) => (
                        <span key={j} style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          background: "var(--muted)", color: "var(--muted-foreground)",
                          fontFamily: "var(--font-mono)",
                        }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {isTP && tp?.whatIfAlternative && (
                    <div style={{
                      marginTop: 8, padding: "8px 12px", borderRadius: 8,
                      background: `${ACCENT}0A`, border: `1px dashed ${BORDER}`,
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: ACCENT,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        marginBottom: 3,
                      }}>
                        {tl("postMortem.whatIf")}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--muted-foreground)" }}>
                        {tp.whatIfAlternative}
                      </div>
                    </div>
                  )}
                  {isTP && tp?.description && !tp?.whatIfAlternative && (
                    <div style={{
                      marginTop: 8, padding: "8px 12px", borderRadius: 8,
                      background: `${ACCENT}0A`, border: `1px dashed ${BORDER}`,
                      fontSize: 12, lineHeight: 1.5, color: "var(--muted-foreground)",
                    }}>
                      {tp.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Step 2 — Causes ──────────────────────── */
function CausesViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) => translate(tlocale, key, vars);
  if (!data) return null;
  const structural: any[] = Array.isArray(data.structural) ? data.structural : [];
  const cyclical: any[] = Array.isArray(data.cyclical) ? data.cyclical : [];
  const situational: any[] = Array.isArray(data.situational) ? data.situational : [];
  const causalChains: any[] = Array.isArray(data.causalChains) ? data.causalChains : [];
  const fiveWhys: any[] = Array.isArray(data.fiveWhys) ? data.fiveWhys : [];
  const synthesis: string = data.synthesis || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {synthesis && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: `${ACCENT}08`, border: `1px solid ${BORDER}40`,
          fontSize: 13, lineHeight: 1.7, color: "var(--foreground)",
        }}>
          {synthesis}
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
      }}>
        <CauseColumn label={tl("postMortem.structural")} color="#7C3AED" causes={structural} de={de} />
        <CauseColumn label={tl("postMortem.cyclical")} color="#2563EB" causes={cyclical} de={de} />
        <CauseColumn label={tl("postMortem.situational")} color="#EA580C" causes={situational} de={de} />
      </div>

      {causalChains.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.causalChains")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {causalChains.map((chain, i) => <CausalChainViz key={i} chain={chain} />)}
          </div>
        </div>
      )}

      {fiveWhys.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.fiveWhys")} />
          <div style={{ position: "relative" }}>
            {fiveWhys.map((lv, i) => (
              <div key={i} style={{ marginLeft: i * 18, position: "relative", marginBottom: 8 }}>
                {i > 0 && (
                  <div style={{
                    position: "absolute",
                    left: -10, top: -8, width: 10, height: 16,
                    borderLeft: `2px solid ${BORDER}`,
                    borderBottom: `2px solid ${BORDER}`,
                    borderBottomLeftRadius: 6,
                  }} />
                )}
                <div style={{
                  padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${i === fiveWhys.length - 1 ? ACCENT : "var(--border)"}`,
                  background: i === fiveWhys.length - 1 ? `${ACCENT}0A` : "var(--card)",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: ACCENT,
                    fontFamily: "var(--font-mono)", marginBottom: 2,
                  }}>
                    {`${tl("postMortem.whyPrefix")}${lv.level || i + 1}`}
                  </div>
                  {lv.question && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>
                      {lv.question}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    {lv.answer}
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

function CauseColumn({ label, color, causes, de }: { label: string; color: string; causes: any[]; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (causes.length === 0) return null;
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color,
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 8, fontFamily: "var(--font-mono)",
        borderBottom: `2px solid ${color}`, paddingBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {causes.map((c, i) => (
          <div key={i} style={{
            padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${color}30`, background: `${color}08`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
              {c.cause}
            </div>
            {c.evidence && (
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: 6 }}>
                {c.evidence}
              </div>
            )}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {c.fixability && (
                <Badge label={`${tl("postMortem.fixablePrefix")} ${c.fixability}`} color={FIXABILITY_COLORS[c.fixability] || "#9CA3AF"} />
              )}
              {c.predictable != null && (
                <Badge label={c.predictable ? tl("postMortem.predictable") : tl("postMortem.unpredictable")} color={c.predictable ? "#16A34A" : "#9CA3AF"} />
              )}
              {c.avoidable != null && (
                <Badge label={c.avoidable ? tl("postMortem.avoidable") : tl("postMortem.unavoidable")} color={c.avoidable ? "#16A34A" : "#9CA3AF"} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CausalChainViz({ chain }: { chain: any }) {
  const steps: string[] = Array.isArray(chain.chain) ? chain.chain : (Array.isArray(chain.steps) ? chain.steps : []);
  const criticalLink: string = chain.criticalLink || "";
  if (steps.length === 0) return null;

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
        {steps.map((step, i) => {
          const isCritical = criticalLink && (step === criticalLink || step.includes(criticalLink) || criticalLink.includes(step));
          return (
            <React.Fragment key={i}>
              <span style={{
                fontSize: 12, padding: "5px 10px", borderRadius: 6,
                background: isCritical ? `${ACCENT}18` : "var(--muted)",
                color: isCritical ? ACCENT : "var(--foreground)",
                fontWeight: isCritical ? 700 : 400,
                border: isCritical ? `1.5px solid ${ACCENT}` : "1px solid var(--border)",
              }}>
                {step}
              </span>
              {i < steps.length - 1 && (
                <span style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "0 4px" }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {criticalLink && (
        <div style={{
          marginTop: 4, fontSize: 10, color: ACCENT,
          fontFamily: "var(--font-mono)", fontWeight: 700,
        }}>
          ⚡ {criticalLink}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Step 3 — Lessons ──────────────────────── */
function LessonsViz({ data, de }: { data?: any; de: boolean }) {
  const tlocale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(tlocale, key);
  if (!data) return null;
  const couldHaveKnown: any[] = Array.isArray(data.couldHaveKnown) ? data.couldHaveKnown : [];
  const couldHaveDone: any[] = Array.isArray(data.couldHaveDone) ? data.couldHaveDone : (Array.isArray(data.couldHaveDoneDifferently) ? data.couldHaveDoneDifferently : []);
  const systemicChanges: any[] = Array.isArray(data.systemicChanges) ? data.systemicChanges : [];
  const patternMatches: any[] = Array.isArray(data.patternMatches) ? data.patternMatches : [];
  const modelUpdates: any[] = Array.isArray(data.modelUpdates) ? data.modelUpdates : [];
  const synthesis: string = data.synthesis || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {synthesis && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: `${ACCENT}08`, border: `1px solid ${BORDER}40`,
          fontSize: 13, lineHeight: 1.7, color: "var(--foreground)",
        }}>
          {synthesis}
        </div>
      )}

      {couldHaveKnown.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.couldHaveKnown")} />
          <ItemList items={couldHaveKnown} />
        </div>
      )}

      {couldHaveDone.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.couldHaveDone")} />
          <ItemList items={couldHaveDone} />
        </div>
      )}

      {systemicChanges.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.systemicChanges")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {systemicChanges.map((sc, i) => {
              const title: string = sc.change || sc.title || "";
              const desc: string = sc.description || sc.effort || "";
              const priority: string = sc.priority || "medium";
              const prioColor = PRIORITY_COLORS[priority] || "#9CA3AF";
              return (
                <div key={i} style={{
                  padding: "10px 14px", borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", flex: 1 }}>
                      {title}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: `${prioColor}18`, color: prioColor,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {priority}
                    </span>
                  </div>
                  {desc && (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                      {desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {patternMatches.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.patternMatches")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {patternMatches.map((pm, i) => {
              const sim: any = pm.similarity;
              const simNum = typeof sim === "number" ? sim : null;
              return (
                <div key={i} style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${BORDER}`, background: `${ACCENT}06`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      {pm.historicalEvent || pm.event}
                    </span>
                    {sim != null && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        fontFamily: "var(--font-mono)", color: ACCENT,
                      }}>
                        {typeof sim === "string" ? sim : `${Math.round(simNum! * (simNum! > 1 ? 1 : 100))}%`}
                      </span>
                    )}
                  </div>
                  {simNum != null && (
                    <div style={{
                      height: 4, borderRadius: 2,
                      background: "var(--muted)", marginBottom: 8, overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        width: `${Math.min(Math.round(simNum * (simNum > 1 ? 1 : 100)), 100)}%`,
                        background: ACCENT,
                      }} />
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)", marginRight: 4 }}>
                      {tl("postMortem.lesson")}
                    </span>
                    {pm.lesson}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modelUpdates.length > 0 && (
        <div>
          <SectionLabel text={tl("postMortem.modelUpdates")} />
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {modelUpdates.map((mu, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", marginBottom: 4 }}>
                {typeof mu === "string" ? mu : (mu.update || JSON.stringify(mu))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ItemList({ items }: { items: any[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => {
        const text = typeof it === "string" ? it : (it.item || it.text || JSON.stringify(it));
        const detail = typeof it === "object" ? (it.detail || it.evidence) : null;
        return (
          <div key={i} style={{
            padding: "8px 12px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--card)",
          }}>
            <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
              {text}
            </div>
            {detail && (
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
                {detail}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
      background: `${color}18`, color,
      fontFamily: "var(--font-mono)",
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: ACCENT,
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 8, fontFamily: "var(--font-mono)",
    }}>
      {text}
    </div>
  );
}
