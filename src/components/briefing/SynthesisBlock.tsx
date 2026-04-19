"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Locale } from "@/lib/i18n";
import { InlineProvenance } from "./InlineProvenance";

/**
 * SynthesisBlock — Haupt-Text eines Briefings.
 *
 * **Zwei Aufgaben:**
 *  1. **Absätze:** Der LLM wird im System-Prompt angewiesen, die Synthesis
 *     in 2–3 Absätze (getrennt durch `\n\n`) zu gliedern. Das rendern wir
 *     als separate `<p>`-Blocks statt als einen Einzeltext — Screenshots
 *     vom User zeigten die alte Variante als eine Textwand ohne Absätze,
 *     weil der Text mit `{shown}` direkt in einen einzigen `<p>` gesetzt
 *     wurde und Browser `\n` in `<p>` als Leerzeichen rendern.
 *
 *  2. **Provenance-Tags:** Der System-Prompt lässt den LLM Quellen inline
 *     markieren — z.B. `[SIGNAL: Eurostat, 2026-03]`, `[TREND: Geopol.
 *     Fragmentierung]`, `[REG: AI Act Art. 5]`, `[LLM-Einschaetzung]`.
 *     Früher erschienen diese Marker als Plain-Text mitten im Fließtext
 *     und sahen aus wie vergessene Debug-Ausgaben. Jetzt parsen wir sie
 *     und rendern kleine, farbige Pills mit Icon + Tooltip, der erklärt,
 *     **woher** die Behauptung stammt.
 *
 * **Erkannte Tag-Formen** (case-insensitive):
 *   - `[SIGNAL: <quelle>, <datum>]` → gelb, Radio-Icon
 *   - `[TREND: <name>]`             → grün, TrendingUp-Icon
 *   - `[REG: <kürzel>]`             → blau, FileText-Icon
 *   - `[LLM-Einschaetzung]`         → grau, Brain-Icon (Alias: -ä-, LLM-Assessment)
 *
 * Unbekannte Klammer-Ausdrücke bleiben als Plain-Text stehen (inklusive
 * der eckigen Klammern), damit keine Information verschluckt wird.
 */

// Parser + Renderer leben jetzt in `./InlineProvenance` — damit sie auch
// außerhalb der Synthesis nutzbar sind (Key Insights, Causal Chains, …).

export function SynthesisBlock({ text, locale, isHelp }: {
  text: string;
  locale: Locale;
  isHelp: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // 1. Absätze am Doppel-Newline splitten und jedem eine Überschrift
  //    zuordnen. Der System-Prompt gibt dem LLM eine feste Gliederung vor:
  //      Absatz 1 → Kernaussage und aktueller Stand
  //      Absatz 2 → Treibende Kräfte und Dynamiken
  //      Absatz 3 → Implikationen und Unsicherheiten
  //
  //    Der LLM darf zusätzlich eine Markdown-Überschrift (`## Titel`) als
  //    erste Zeile eines Absatzes setzen — die übernehmen wir dann
  //    wörtlich. Falls keine Custom-Heading vorliegt, fallen wir auf
  //    positionsbasierte Default-Labels zurück.
  const defaultHeadings = useMemo(() => {
    if (locale === "de") return ["Kernaussage", "Treibende Dynamiken", "Implikationen & Ausblick"];
    return ["Core finding", "Driving dynamics", "Implications & outlook"];
  }, [locale]);

  const allParagraphs = useMemo(() => {
    const blocks = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Pro Block: Custom-Heading extrahieren (optional), Rest bleibt Body.
    // Erkennt `## Titel`, `### Titel`, `**Titel**` am Start.
    return blocks.map((raw, i) => {
      const firstLineMatch = raw.match(/^(#{2,4}\s*|(\*\*))([^\n]+?)(\*\*)?\s*\n([\s\S]*)$/);
      if (firstLineMatch) {
        const heading = firstLineMatch[3].trim().replace(/\*+$/, "").replace(/^\*+/, "");
        const body = firstLineMatch[5].trim();
        if (heading && body) return { heading, body };
      }
      // Kein Custom-Heading → Default-Label nach Position. Ab Absatz 4
      // (kommt selten vor) lassen wir die Überschrift leer.
      return {
        heading: i < defaultHeadings.length ? defaultHeadings[i] : null,
        body: raw,
      };
    });
  }, [text, defaultHeadings]);

  // 2. Collapsed-Modus: zeigt nur den ersten Absatz. /help ist immer voll.
  const hasMore = allParagraphs.length > 1;
  const shownParagraphs = (expanded || isHelp || !hasMore)
    ? allParagraphs
    : allParagraphs.slice(0, 1);

  return (
    <div style={{ fontFamily: "var(--font-ui)" }}>
      {shownParagraphs.map((para, i) => (
        <section key={i} style={{ marginTop: i === 0 ? 0 : 22 }}>
          {/* Zwischenüberschrift — klein, mono, als Marker über dem Absatz.
           * Stilistisch wie ein Section-Label, nicht wie eine Hero-H2. Die
           * eigentliche Hierarchie (H1 = Frage, H2 = Synthesis-Überschrift
           * des Briefings) bleibt dem Parent überlassen. */}
          {para.heading && (
            <h4
              style={{
                margin: "0 0 8px",
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--volt-text-faint, #9B9B9B)",
              }}
            >
              {para.heading}
            </h4>
          )}
          <p
            style={{
              color: "var(--color-text-primary)",
              margin: 0,
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              lineHeight: 1.7,
              fontWeight: 400,
              letterSpacing: "-0.005em",
              maxWidth: "72ch",
            }}
          >
            <InlineProvenance text={para.body} locale={locale} />
          </p>
        </section>
      ))}
      {hasMore && !isHelp && (
        <button onClick={() => setExpanded(e => !e)} style={{
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          fontWeight: 600,
          color: "var(--volt-text-faint, #9B9B9B)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          {expanded ? (
            <>
              <ChevronUp size={12} strokeWidth={2} />
              {locale === "de" ? "Weniger" : "Less"}
            </>
          ) : (
            <>
              <ChevronDown size={12} strokeWidth={2} />
              {locale === "de"
                ? `${allParagraphs.length - 1} weitere Absätze`
                : `${allParagraphs.length - 1} more paragraphs`}
            </>
          )}
        </button>
      )}
    </div>
  );
}
