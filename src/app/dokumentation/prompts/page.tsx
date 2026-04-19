/**
 * /dokumentation/prompts — Live-Ansicht aller SIS-System-Prompts.
 *
 * Liest direkt aus `src/lib/system-prompts-registry.ts` und rendert ALLE
 * Einträge vollständig als One-Pager. Keine Expand/Collapse-Klicks, kein
 * Sprach-Toggle, kein Link-zum-Detail — der User wollte expliziert einen
 * einzelnen Pager, auf dem alles direkt sichtbar ist (2026-04-19).
 *
 * Die Registry ist die Single Source of Truth. Bei jeder Prompt-Änderung
 * im Code bleibt diese Seite automatisch synchron.
 *
 * Sprach-Strategie: Template-EN ist die Code-Wahrheit (so läuft's an den
 * LLM), wird prominent gerendert. Template-DE ist nur bei wenigen Einträgen
 * vorhanden (Redaktions-Referenz) — die wird kompakt darunter gezeigt.
 */

"use client";

import { AppHeader } from "@/components/AppHeader";
import { SYSTEM_PROMPTS, DATE_CONTEXT_TEMPLATE_DE, DATE_CONTEXT_TEMPLATE_EN, groupPromptsByCategory } from "@/lib/system-prompts-registry";
import { FileText, Info } from "lucide-react";

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
            Claude (primär) oder OpenRouter (Fallback) schickt —
            <strong> vollständig auf einer Seite, keine Klicks, kein Ausklappen</strong>.
            Inhalte kommen live aus <code style={{ fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--color-muted)", padding: "1px 6px", borderRadius: 4 }}>src/lib/system-prompts-registry.ts</code>.
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

        {/* Liste aller Prompts — gruppiert nach Kategorie (v0.2 Notion Blueprint) */}
        <section>
          <h2 className="volt-heading" style={{ margin: "0 0 14px" }}>
            Prompt-Inventar · {SYSTEM_PROMPTS.length} Einträge
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {groupPromptsByCategory().map((group) => (
              <div key={group.category}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: "var(--volt-text-faint, #9B9B9B)",
                  }}
                >
                  {group.label} · {group.entries.length}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {group.entries.map((p) => (
                    <PromptCard key={p.id} entry={p} />
                  ))}
                </div>
              </div>
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

/**
 * PromptCard — One-Pager-Rendering: alle Meta-Infos + Template-Text
 * direkt sichtbar, kein Expand/Collapse, kein Sprach-Toggle.
 *
 * User-Regel (2026-04-19): "die komplette Doku muss vollständig auf
 * einem one-pager abgebildet sein". Ergo: der Anker-Link aus der TOC
 * scrollt einfach zur Karte und der gesamte Inhalt ist bereits da.
 *
 * Sprache: EN ist die Code-Wahrheit und steht prominent. DE ist die
 * seltene Redaktions-Referenz (nur 3 Einträge haben sie) und wird
 * darunter als kompakte Sekundär-Section gerendert — nicht versteckt,
 * nur visuell untergeordnet.
 */
function PromptCard({ entry }: { entry: (typeof SYSTEM_PROMPTS)[number] }) {
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
      {/* Header — rein visuell, kein Button mehr. Scroll-Anker via
           article#id + TOC-Links übernehmen die Navigation. */}
      <header
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-page-bg, #FAFAFA)",
        }}
      >
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
        {/* Wiring-Badge: zeigt dem Reviewer sofort, ob der Prompt wirklich
             läuft, ob er nur in einem bestimmten Flag-Modus läuft (opt-in),
             oder ob er nur als Template für künftiges Routing existiert. */}
        {entry.wiring && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9.5,
            padding: "2px 7px", borderRadius: 6,
            background:
              entry.wiring === "wired"
                ? "rgba(26, 158, 90, 0.12)"
                : entry.wiring === "opt-in"
                  ? "rgba(245, 198, 80, 0.18)"
                  : "rgba(107, 107, 107, 0.10)",
            color:
              entry.wiring === "wired"
                ? "#0F6038"
                : entry.wiring === "opt-in"
                  ? "#7A5C00"
                  : "#6B6B6B",
            border: `1px solid ${
              entry.wiring === "wired"
                ? "rgba(26, 158, 90, 0.30)"
                : entry.wiring === "opt-in"
                  ? "rgba(245, 198, 80, 0.45)"
                  : "rgba(107, 107, 107, 0.25)"
            }`,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
          }}>
            {entry.wiring === "wired" ? "live" : entry.wiring === "opt-in" ? "opt-in" : "template"}
          </span>
        )}
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
      </header>

      {/* Body — immer gerendert, alle Meta-Informationen + beide
           Template-Sprachen untereinander. */}
      <div style={{ padding: "18px" }}>
        <Meta label="Zweck" value={entry.purpose} />
        <Meta label="Code-Location" value={entry.location} mono />
        {entry.apiRoute && <Meta label="API-Route" value={entry.apiRoute} mono />}
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
            {entry.injectedContext.length > 0
              ? entry.injectedContext.map((c, i) => <li key={i}>{c}</li>)
              : <li style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>— (reine Prompt-Fragment, kein dynamischer Kontext)</li>}
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

        {/* Template-EN — die Code-Wahrheit, prominent. */}
        {entry.templateEn && (
          <div style={{ marginTop: 18 }}>
            <CodeBlock label="Template · English (im Code aktiv)" content={entry.templateEn} />
          </div>
        )}

        {/* Template-DE — nur wenn vorhanden, als redaktionelle Referenz.
             Kompakter Stil, damit EN visuell dominiert. */}
        {entry.templateDe && (
          <div style={{ marginTop: 12 }}>
            <CodeBlock label="Template · Deutsche Redaktions-Referenz (nicht im Code)" content={entry.templateDe} />
          </div>
        )}

        {/* Fallback: wenn weder EN noch DE vorhanden — sehr selten, aber
             die Registry erlaubt es technisch. */}
        {!entry.templateEn && !entry.templateDe && (
          <div style={{
            marginTop: 18, padding: "10px 12px",
            fontSize: 12, color: "var(--color-text-muted)",
            background: "var(--color-muted)", borderRadius: 6,
            fontStyle: "italic",
          }}>
            (Kein Template registriert — reiner Referenz-Eintrag)
          </div>
        )}
      </div>
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
