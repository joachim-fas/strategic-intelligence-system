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
      <p className="text-body" style={{ color: "var(--color-text-secondary)", margin: 0, fontFamily: "var(--font-ui)" }}>{shown}</p>
      {hasMore && !isHelp && (
        <button onClick={() => setExpanded(e => !e)} style={{
          marginTop: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.03em",
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
