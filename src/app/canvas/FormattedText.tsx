/**
 * FormattedText — structured text rendering with paragraphs and
 * inline provenance tags ([SIGNAL: …], [TREND: …], [LLM-Einschätzung],
 * [Source, Date], **bold**).
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice 2
 * (18.04.2026 audit A5-H7). Pure — no state, no effects. The smart-
 * paragraph split runs on every render; fine because it's cheap and
 * the input is bounded by the card height.
 */

import React from "react";

export function FormattedText({
  text,
  fontSize = 13,
  lineHeight = 1.65,
  color = "var(--color-text-secondary)",
  maxLines,
  compact,
}: {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  maxLines?: number;
  compact?: boolean;
}) {
  if (!text) return null;

  // Smart paragraph splitting: if text has no \n\n but is long,
  // insert breaks at sentence boundaries.
  const ensureParagraphs = (raw: string): string => {
    // Already has paragraph breaks → use as-is.
    if (raw.includes("\n\n")) return raw;
    // Short text → no splitting needed.
    if (raw.length < 300) return raw;
    // Split at sentence boundaries (period/! /? followed by space + uppercase).
    const sentences = raw.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
    if (sentences.length <= 3) return raw;
    // Group into paragraphs of ~3 sentences each.
    const paras: string[] = [];
    let current: string[] = [];
    for (const s of sentences) {
      current.push(s);
      if (current.length >= 3 || current.join(" ").length > 400) {
        paras.push(current.join(" "));
        current = [];
      }
    }
    if (current.length > 0) paras.push(current.join(" "));
    return paras.join("\n\n");
  };
  const processedText = ensureParagraphs(text);

  // Parse inline provenance tags and bold markers into React elements.
  // v0.2 tag-Taxonomie (siehe src/components/briefing/InlineProvenance.tsx):
  //   [SIGNAL: …]                 → blau (external evidence)
  //   [TREND: …]                  → grün (curated trend)
  //   [REG: …]                    → navy (regulation)
  //   [EDGE: A → B]               → violett (causal edge)
  //   [LLM-KNOWLEDGE|LLM-Einschätzung|LLM-Einschaetzung|LLM-Assessment|LLM] → orange
  //   [Quelle, Datum]             → grau (generische Zitation)
  //   **bold**                    → fett
  // Fix 2026-04-20: vorher kannte der Parser nur `[LLM-Einschätzung]` (alte DE
  // Variante); die v0.2-Prompts schreiben aber `[LLM-KNOWLEDGE]` → Tag landete
  // als roher Text auf der Card. Jetzt via gemeinsamem Head-Match wie in
  // InlineProvenance.
  const pillStyle = (bg: string, fg: string, border: string): React.CSSProperties => ({
    fontSize: compact ? 7 : 9,
    fontWeight: 600,
    padding: "0px 4px",
    borderRadius: 4,
    background: bg,
    color: fg,
    border: `1px solid ${border}`,
    fontFamily: "var(--font-code, monospace)",
    whiteSpace: "nowrap",
  });

  const renderInline = (line: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    // Greedy: any [..] bracket first (we dispatch by head inside), then **bold**.
    const regex = /(\[[^\]]+\]|\*\*[^*]+\*\*)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(line.slice(lastIdx, match.index));
      }
      const m = match[0];

      if (m.startsWith("**") && m.endsWith("**")) {
        parts.push(
          <strong key={`${keyPrefix}-${i}`} style={{ fontWeight: 700, color: "var(--color-text-heading)" }}>
            {m.slice(2, -2)}
          </strong>,
        );
      } else if (m.startsWith("[") && m.endsWith("]")) {
        const inner = m.slice(1, -1).trim();
        const lower = inner.toLowerCase();
        const colonIdx = inner.indexOf(":");
        const head = (colonIdx >= 0 ? inner.slice(0, colonIdx) : inner).trim().toLowerCase();
        const rest = colonIdx >= 0 ? inner.slice(colonIdx + 1).trim() : "";

        if (head === "signal") {
          parts.push(
            <span key={`${keyPrefix}-${i}`} style={pillStyle("#2563EB10", "#2563EB", "#2563EB20")}>
              SIGNAL{rest ? `: ${rest}` : ""}
            </span>,
          );
        } else if (head === "trend") {
          parts.push(
            <span key={`${keyPrefix}-${i}`} style={pillStyle("#1A9E5A10", "#1A9E5A", "#1A9E5A20")}>
              TREND{rest ? `: ${rest}` : ""}
            </span>,
          );
        } else if (head === "reg" || head === "regulation") {
          parts.push(
            <span key={`${keyPrefix}-${i}`} style={pillStyle("rgba(26,74,138,0.08)", "#1A4A8A", "rgba(26,74,138,0.30)")}>
              REG{rest ? `: ${rest}` : ""}
            </span>,
          );
        } else if (head === "edge") {
          // Normalize "->" / "–>" to the unicode arrow for display parity with InlineProvenance.
          const arrow = rest.replace(/\s*->\s*/g, " → ").replace(/\s*–>\s*/g, " → ");
          parts.push(
            <span key={`${keyPrefix}-${i}`} style={pillStyle("rgba(107,63,160,0.10)", "#6B3FA0", "rgba(107,63,160,0.32)")}>
              EDGE{arrow ? `: ${arrow}` : ""}
            </span>,
          );
        } else if (
          lower === "llm-knowledge" ||
          lower === "llm-einschätzung" ||
          lower === "llm-einschaetzung" ||
          lower === "llm-assessment" ||
          lower === "llm"
        ) {
          parts.push(
            <span key={`${keyPrefix}-${i}`} style={pillStyle("#F5A62310", "#F5A623", "#F5A62320")}>
              LLM
            </span>,
          );
        } else if (/^[A-Za-zÄÖÜäöüß][^\]]{1,40},\s*\d{2,4}/.test(inner)) {
          // Citation fallback: [Source, Date]
          parts.push(
            <span
              key={`${keyPrefix}-${i}`}
              style={{
                fontSize: compact ? 7 : 9,
                fontWeight: 500,
                padding: "0px 3px",
                borderRadius: 3,
                background: "var(--color-page-bg)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
                whiteSpace: "nowrap",
              }}
            >
              {inner}
            </span>,
          );
        } else {
          // Unknown bracket content — keep verbatim (incl. brackets) so no info is lost.
          parts.push(m);
        }
      }
      lastIdx = match.index + m.length;
      i++;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    return parts;
  };

  // Split into paragraphs by double newline.
  const paragraphs = processedText.split(/\n\n+/).filter((p) => p.trim());

  // Compact mode (card previews): render as a single clamped block.
  if (compact && maxLines) {
    return (
      <p
        style={{
          fontSize,
          lineHeight,
          color,
          margin: 0,
          overflow: "hidden",
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical" as const,
        }}
      >
        {renderInline(processedText.replace(/\n\n+/g, " — ").replace(/\n/g, " "), "c")}
      </p>
    );
  }

  return (
    <div style={{ fontSize, lineHeight, color }}>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim();
        // Check for heading-like lines (short, no period, possibly bold).
        const isHeading = trimmed.length < 80 && !trimmed.endsWith(".") && !trimmed.endsWith(":") && !trimmed.includes("[") && pi > 0;
        if (isHeading && !compact) {
          return (
            <div
              key={pi}
              style={{
                fontWeight: 700,
                fontSize: fontSize + 1,
                color: "var(--color-text-heading)",
                marginTop: pi > 0 ? 14 : 0,
                marginBottom: 4,
              }}
            >
              {renderInline(trimmed, `h${pi}`)}
            </div>
          );
        }
        // Split by single newlines within paragraph for soft line breaks.
        const lines = trimmed.split(/\n/);
        return (
          <p key={pi} style={{ margin: pi > 0 ? "10px 0 0" : 0 }}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, `p${pi}l${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
