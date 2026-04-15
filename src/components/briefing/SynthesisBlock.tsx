"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Locale } from "@/lib/i18n";

export function SynthesisBlock({ text, locale, isHelp }: {
  text: string;
  locale: Locale;
  isHelp: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const truncated = sentences.slice(0, 2).join(" ").trim();
  const hasMore = sentences.length > 2;
  const shown = (expanded || isHelp || !hasMore) ? text : truncated;

  return (
    <div style={{ fontFamily: "var(--font-ui)" }}>
      {/* Synthesis ist der Hero-Text des Briefings — die eigentliche
           Antwort. Frueher mit --color-text-secondary gerendert, was den
           wichtigsten Text gegenueber Section-Headers abschwaechte.
           Jetzt: --color-text-primary + 16px mit 1.7 line-height fuer
           komfortables Lesen mehrerer Saetze, und max-width 72ch als
           Lesbarkeits-Guard (Briefings sind Text, keine Zeitungsspalten
           — 72 Zeichen pro Zeile ist der klassische Lesbarkeits-Korridor). */}
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
        {shown}
      </p>
      {hasMore && !isHelp && (
        <button onClick={() => setExpanded(e => !e)} style={{
          marginTop: 8,
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
              {locale === "de" ? `${sentences.length} Sätze` : `${sentences.length} sentences`}
            </>
          )}
        </button>
      )}
    </div>
  );
}
