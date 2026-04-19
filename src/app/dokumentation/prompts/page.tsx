/**
 * /dokumentation/prompts — Live-Ansicht aller SIS-System-Prompts.
 *
 * Liest direkt aus `src/lib/system-prompts-registry.ts` und rendert die
 * Einträge als ausklappbare Sektionen. Die Seite existiert, weil der User
 * ausdrücklich Transparenz über die LLM-Prompts wollte („Das ist für die
 * Entwicklung und für mein Verständnis essenziell"). Die Registry ist die
 * Single Source of Truth — sowohl diese UI als auch SYSTEM_PROMPTS.md im
 * Repo-Root ziehen aus ihr. Die UI ist damit immer synchron mit dem
 * deployten Code.
 *
 * Kein i18n — Developer-Doku, Inhalt ist bilingual (Templates haben DE + EN).
 */

"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SYSTEM_PROMPTS, DATE_CONTEXT_TEMPLATE_DE, DATE_CONTEXT_TEMPLATE_EN } from "@/lib/system-prompts-registry";
import { ChevronDown, ChevronRight, FileText, Info } from "lucide-react";

export default function PromptsDocPage() {
  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main className="volt-container" style={{ padding: "32px 24px 80px", maxWidth: 960 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--volt-text-faint, #AAA)", marginBottom: 10,
          }}>
            Developer · Dokumentation
          </div>
          <h1 className="volt-display-md" style={{ margin: "0 0 12px" }}>
            System-Prompts
          </h1>
          <p className="volt-body" style={{ margin: 0, maxWidth: "70ch" }}>
            Vollständige Liste aller LLM-System-Prompts, die SIS aktuell an
            Claude (primär) oder OpenRouter (Fallback) schickt. Inhalte
            kommen live aus <code style={{ fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--color-muted)", padding: "1px 6px", borderRadius: 4 }}>src/lib/system-prompts-registry.ts</code>.
            Bei jeder Prompt-Änderung im Code bleibt diese Seite automatisch synchron.
          </p>
        </div>

        <div style={{
          padding: "14px 16px", marginBottom: 24,
          background: "var(--pastel-butter-light, #FFF7ED)",
          border: "1px solid var(--pastel-butter-border, #F0D4A8)",
          borderRadius: 10,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <Info size={18} style={{ color: "#7A5C00", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "var(--pastel-butter-text, #7A5C00)", lineHeight: 1.55 }}>
            <strong>Template vs. Runtime.</strong> Gezeigt sind die
            statischen Templates. Zur Laufzeit werden dynamische Blöcke
            injiziert (Trend-Liste, Live-Signale, Kausal-Edges, Regulierungen,
            Zeit-Kontext). Die Felder „Injected Context" pro Prompt listen
            genau welche.
          </div>
        </div>

        {/* Gemeinsamer Zeit-Kontext-Block */}
        <section style={{ marginBottom: 32 }}>
          <h2 className="volt-heading" style={{ margin: "0 0 10px" }}>
            Gemeinsamer Baustein: Zeitlicher Kontext
          </h2>
          <p className="volt-body" style={{ margin: "0 0 14px", maxWidth: "70ch" }}>
            Jeder SIS-Prompt bekommt folgenden Block vorangestellt. Ohne
            ihn würde Claude sein Training-Cutoff (~Q4 2024) stillschweigend
            als „jetzt" behandeln und Prognosen für längst vergangene
            Zeiträume ausgeben (Real-Bug vom 19.04.2026, Commit
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--color-muted)", padding: "1px 5px", borderRadius: 3, margin: "0 3px" }}>fd74cd3</code>).
          </p>
          <CodeBlock label="Deutsch" content={DATE_CONTEXT_TEMPLATE_DE} />
          <div style={{ height: 10 }} />
          <CodeBlock label="English" content={DATE_CONTEXT_TEMPLATE_EN} />
        </section>

        {/* Liste aller Prompts */}
        <section>
          <h2 className="volt-heading" style={{ margin: "0 0 14px" }}>
            Prompt-Inventar · {SYSTEM_PROMPTS.length} Einträge
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SYSTEM_PROMPTS.map((p) => (
              <PromptCard key={p.id} entry={p} />
            ))}
          </div>
        </section>

        <div style={{
          marginTop: 40, padding: "14px 16px",
          fontSize: 12, color: "var(--color-text-muted)",
          borderTop: "1px solid var(--color-border)",
          lineHeight: 1.6,
        }}>
          Die Markdown-Variante dieser Doku liegt im Repo unter
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--color-muted)", padding: "1px 5px", borderRadius: 3, margin: "0 3px" }}>SYSTEM_PROMPTS.md</code>
          (für Offline-Review und Code-Audits). Die verlässliche Quelle
          ist immer diese Seite hier, weil sie direkt aus dem Code rendert.
        </div>
      </main>
    </div>
  );
}

// ─── Unter-Komponenten ────────────────────────────────────────────

function PromptCard({ entry }: { entry: (typeof SYSTEM_PROMPTS)[number] }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"de" | "en">("de");

  return (
    <article
      id={entry.id}
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        background: "var(--card, #fff)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left" as const,
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-page-bg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {open ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--volt-text-faint, #9B9B9B)",
            marginBottom: 2,
          }}>
            {entry.id}
          </div>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: "var(--color-text-heading)",
            fontFamily: "var(--font-display)",
          }}>
            {entry.name}
          </div>
        </div>
        {entry.modelConfig?.model && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            padding: "2px 8px", borderRadius: 6,
            background: "var(--color-muted)", color: "var(--color-text-muted)",
            fontWeight: 600,
          }}>
            {entry.modelConfig.model}
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--color-border)" }}>
          <Meta label="Zweck" value={entry.purpose} />
          <Meta label="Code-Location" value={entry.location} mono />
          <Meta label="Trigger" value={entry.trigger} />
          <Meta label="Response-Form" value={entry.responseShape} />

          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--volt-text-faint, #9B9B9B)",
              marginBottom: 6,
            }}>
              Injected Context (zur Laufzeit)
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: "var(--color-text-primary)" }}>
              {entry.injectedContext.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {entry.modelConfig && (
            <div style={{ marginTop: 14, display: "flex", gap: 14, fontSize: 12, color: "var(--color-text-muted)" }}>
              <span>
                <strong style={{ color: "var(--color-text-primary)" }}>max_tokens:</strong>{" "}
                {entry.modelConfig.maxTokens ?? "default"}
              </span>
              {entry.modelConfig.temperature !== undefined && (
                <span>
                  <strong style={{ color: "var(--color-text-primary)" }}>temperature:</strong>{" "}
                  {entry.modelConfig.temperature}
                </span>
              )}
            </div>
          )}

          {/* Template mit Sprach-Umschalter */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{
                fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--volt-text-faint, #9B9B9B)",
              }}>
                Template
              </div>
              {entry.templateEn !== null && (
                <div style={{ display: "inline-flex", gap: 1, padding: 2, background: "var(--color-muted)", borderRadius: 6 }}>
                  {(["de", "en"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11, fontWeight: 600,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        background: lang === l ? "var(--card, #fff)" : "transparent",
                        color: lang === l ? "var(--color-text-heading)" : "var(--color-text-muted)",
                        boxShadow: lang === l ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase" as const,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <CodeBlock
              content={lang === "de" ? entry.templateDe : entry.templateEn ?? entry.templateDe}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--volt-text-faint, #9B9B9B)",
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, lineHeight: 1.55,
        color: "var(--color-text-primary)",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
      }}>
        {value}
      </div>
    </div>
  );
}

function CodeBlock({ content, label }: { content: string; label?: string }) {
  return (
    <div style={{
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      background: "var(--color-page-bg, #FAFAFA)",
      overflow: "hidden",
    }}>
      {label && (
        <div style={{
          padding: "6px 12px",
          fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--volt-text-faint, #9B9B9B)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <FileText size={11} strokeWidth={2} />
          {label}
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: "12px 14px",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 12,
        lineHeight: 1.55,
        color: "var(--color-text-primary)",
        whiteSpace: "pre-wrap" as const,
        wordBreak: "break-word" as const,
        overflowX: "auto" as const,
      }}>
        {content}
      </pre>
    </div>
  );
}
