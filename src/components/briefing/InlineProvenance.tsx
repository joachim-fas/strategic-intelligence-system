"use client";

/**
 * InlineProvenance — rendert einen beliebigen Text-String und ersetzt
 * darin die Provenance-Marker aus dem LLM-Briefing-Prompt durch kleine
 * farbige Pills mit Tooltip.
 *
 * Der Parser wurde ursprünglich in `SynthesisBlock.tsx` eingebaut (für
 * den Haupt-Text eines Briefings). Die gleichen Marker tauchen aber
 * auch in `keyInsights`, `causalChain`, `regulatoryContext` und
 * anderen Feldern auf — wenn wir sie dort NICHT parsen, bleiben die
 * Klammer-Marker als Debug-Text im UI stehen. Deshalb gibt's ihn jetzt
 * als wiederverwendbare Komponente.
 *
 * Unterstützt die vier vom System-Prompt definierten Tag-Typen:
 *   [SIGNAL: <quelle>, <datum>]     → gelb, Radio-Icon
 *   [TREND: <name>]                 → grün, TrendingUp-Icon
 *   [REG: <kürzel>]                 → blau, FileText-Icon
 *   [LLM-Einschätzung|-Einschaetzung|-Assessment|LLM]  → grau, Brain-Icon
 *
 * Unbekannte `[…]`-Klammern bleiben als Plain-Text stehen (inkl. der
 * Klammern), damit keine Information verschluckt wird.
 */

import React from "react";
import { Radio, TrendingUp, FileText, Brain } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { Locale } from "@/lib/i18n";

export type ProvenanceKind = "signal" | "trend" | "reg" | "llm";

interface Segment {
  kind: "text" | "tag";
  text: string;
  tagKind?: ProvenanceKind;
  tagDetail?: string;
}

const TAG_META: Record<ProvenanceKind, {
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

export function parseProvenanceSegments(text: string): Segment[] {
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
    let tagKind: ProvenanceKind | null = null;
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
      out.push({ kind: "text", text: m[0] });
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    out.push({ kind: "text", text: text.slice(lastIdx) });
  }
  return out;
}

export function ProvenanceTag({ tagKind, detail, locale }: {
  tagKind: ProvenanceKind;
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

/**
 * Drop-in-Ersatz für `{text}` in einem `<p>` oder Listen-Item, wenn
 * Provenance-Tags dekoriert werden sollen.
 */
export function InlineProvenance({ text, locale }: { text: string; locale: Locale }) {
  const segs = parseProvenanceSegments(text);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "text" ? (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        ) : (
          <ProvenanceTag
            key={i}
            tagKind={s.tagKind!}
            detail={s.tagDetail}
            locale={locale}
          />
        ),
      )}
    </>
  );
}
