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
  const renderInline = (line: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\[SIGNAL:\s*[^\]]+\]|\[TREND:\s*[^\]]+\]|\[LLM-Einschätzung\]|\[[A-Za-zÄÖÜäöüß][^\]]{1,40},\s*\d{2,4}[^\]]*\]|\*\*[^*]+\*\*)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(line.slice(lastIdx, match.index));
      }
      const m = match[0];
      if (m.startsWith("[SIGNAL:")) {
        parts.push(
          <span
            key={`${keyPrefix}-${i}`}
            style={{
              fontSize: compact ? 7 : 9,
              fontWeight: 600,
              padding: "0px 4px",
              borderRadius: 4,
              background: "#2563EB10",
              color: "#2563EB",
              border: "1px solid #2563EB20",
              fontFamily: "var(--font-code, monospace)",
              whiteSpace: "nowrap",
            }}
          >
            {m.slice(1, -1)}
          </span>,
        );
      } else if (m.startsWith("[TREND:")) {
        parts.push(
          <span
            key={`${keyPrefix}-${i}`}
            style={{
              fontSize: compact ? 7 : 9,
              fontWeight: 600,
              padding: "0px 4px",
              borderRadius: 4,
              background: "#1A9E5A10",
              color: "#1A9E5A",
              border: "1px solid #1A9E5A20",
              fontFamily: "var(--font-code, monospace)",
              whiteSpace: "nowrap",
            }}
          >
            {m.slice(1, -1)}
          </span>,
        );
      } else if (m === "[LLM-Einschätzung]") {
        parts.push(
          <span
            key={`${keyPrefix}-${i}`}
            style={{
              fontSize: compact ? 7 : 9,
              fontWeight: 600,
              padding: "0px 4px",
              borderRadius: 4,
              background: "#F5A62310",
              color: "#F5A623",
              border: "1px solid #F5A62320",
              fontFamily: "var(--font-code, monospace)",
              whiteSpace: "nowrap",
            }}
          >
            LLM
          </span>,
        );
      } else if (m.startsWith("[") && m.endsWith("]")) {
        // Citation: [Source, Date]
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
            {m.slice(1, -1)}
          </span>,
        );
      } else if (m.startsWith("**") && m.endsWith("**")) {
        parts.push(
          <strong key={`${keyPrefix}-${i}`} style={{ fontWeight: 700, color: "var(--color-text-heading)" }}>
            {m.slice(2, -2)}
          </strong>,
        );
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
