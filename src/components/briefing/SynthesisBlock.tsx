"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Radio, TrendingUp, FileText, Brain } from "lucide-react";
import { Locale } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

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

type TagKind = "signal" | "trend" | "reg" | "llm";

interface Segment {
  kind: "text" | "tag";
  text: string;
  tagKind?: TagKind;
  tagDetail?: string;
}

const TAG_META: Record<TagKind, {
  short: string;
  fullDe: string;
  fullEn: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = {
  signal: {
    short: "SIGNAL",
    fullDe: "Live-Signal aus externer Datenquelle",
    fullEn: "Live signal from external data source",
    color: "#7A5C00",
    bg: "rgba(245, 198, 80, 0.14)",
    border: "rgba(245, 198, 80, 0.45)",
    Icon: Radio,
  },
  trend: {
    short: "TREND",
    fullDe: "Aus dem kuratierten Trend-Graph",
    fullEn: "From the curated trend graph",
    color: "#0F6038",
    bg: "rgba(26, 158, 90, 0.10)",
    border: "rgba(26, 158, 90, 0.35)",
    Icon: TrendingUp,
  },
  reg: {
    short: "REG",
    fullDe: "Aus der Regulierungs-Datenbank",
    fullEn: "From the regulation registry",
    color: "#1A4A8A",
    bg: "rgba(26, 74, 138, 0.08)",
    border: "rgba(26, 74, 138, 0.30)",
    Icon: FileText,
  },
  llm: {
    short: "LLM",
    fullDe: "Vom Sprachmodell formuliert — kein externer Beleg",
    fullEn: "Authored by the language model — no external citation",
    color: "#6B6B6B",
    bg: "rgba(107, 107, 107, 0.10)",
    border: "rgba(107, 107, 107, 0.30)",
    Icon: Brain,
  },
};

const TAG_RE = /\[([^\]]+)\]/g;

function parseSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push({ kind: "text", text: text.slice(lastIdx, m.index) });
    }
    const inner = m[1].trim();
    const lower = inner.toLowerCase();
    let tagKind: TagKind | null = null;
    let detail = "";

    const colonIdx = inner.indexOf(":");
    const head = (colonIdx >= 0 ? inner.slice(0, colonIdx) : inner).trim().toLowerCase();
    const rest = colonIdx >= 0 ? inner.slice(colonIdx + 1).trim() : "";

    if (head === "signal") {
      tagKind = "signal";
      detail = rest;
    } else if (head === "trend") {
      tagKind = "trend";
      detail = rest;
    } else if (head === "reg" || head === "regulation") {
      tagKind = "reg";
      detail = rest;
    } else if (
      lower === "llm-einschätzung" ||
      lower === "llm-einschaetzung" ||
      lower === "llm-assessment" ||
      lower === "llm"
    ) {
      tagKind = "llm";
    }

    if (tagKind) {
      out.push({ kind: "tag", tagKind, text: TAG_META[tagKind].short, tagDetail: detail });
    } else {
      // Unbekannte Klammer — als Text durchreichen (inkl. der Klammern).
      out.push({ kind: "text", text: m[0] });
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    out.push({ kind: "text", text: text.slice(lastIdx) });
  }
  return out;
}

function ProvenanceTag({ tagKind, detail, locale }: {
  tagKind: TagKind;
  detail?: string;
  locale: Locale;
}) {
  const meta = TAG_META[tagKind];
  const Icon = meta.Icon;
  const tooltipBase = locale === "de" ? meta.fullDe : meta.fullEn;
  const tooltip = detail ? `${tooltipBase} — ${detail}` : tooltipBase;
  return (
    <Tooltip content={tooltip} placement="top">
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "1px 6px 1px 4px",
          margin: "0 2px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          textTransform: "uppercase" as const,
          color: meta.color,
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          borderRadius: 4,
          verticalAlign: "baseline",
          cursor: "help",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }}
      >
        <Icon size={9} strokeWidth={2.25} />
        <span>{meta.short}</span>
        {detail && (
          <span style={{
            fontWeight: 500, textTransform: "none", letterSpacing: 0,
            opacity: 0.85, maxWidth: 180, overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            : {detail}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

export function SynthesisBlock({ text, locale, isHelp }: {
  text: string;
  locale: Locale;
  isHelp: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // 1. Absätze am Doppel-Newline splitten. Zusätzlich single-line-breaks
  //    als weicher Zeilenumbruch beibehalten (seltener, aber vorkommend).
  const allParagraphs = useMemo(
    () =>
      text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [text],
  );

  // 2. Collapsed-Modus: zeigt nur den ersten Absatz. /help ist immer voll.
  const hasMore = allParagraphs.length > 1;
  const shownParagraphs = (expanded || isHelp || !hasMore)
    ? allParagraphs
    : allParagraphs.slice(0, 1);

  return (
    <div style={{ fontFamily: "var(--font-ui)" }}>
      {shownParagraphs.map((para, i) => {
        const segs = parseSegments(para);
        return (
          <p
            key={i}
            style={{
              color: "var(--color-text-primary)",
              margin: i === 0 ? 0 : "14px 0 0",
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              lineHeight: 1.7,
              fontWeight: 400,
              letterSpacing: "-0.005em",
              maxWidth: "72ch",
            }}
          >
            {segs.map((s, j) =>
              s.kind === "text" ? (
                <React.Fragment key={j}>{s.text}</React.Fragment>
              ) : (
                <ProvenanceTag
                  key={j}
                  tagKind={s.tagKind!}
                  detail={s.tagDetail}
                  locale={locale}
                />
              ),
            )}
          </p>
        );
      })}
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
