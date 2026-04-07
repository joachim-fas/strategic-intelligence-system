"use client";

import { useState } from "react";
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
    <div>
      <p className="text-body" style={{ color: "var(--color-text-secondary)", margin: 0 }}>{shown}</p>
      {hasMore && !isHelp && (
        <button onClick={() => setExpanded(e => !e)} style={{
          marginTop: 6, fontSize: 12, color: "var(--volt-text-faint, #9B9B9B)", background: "none", border: "none",
          cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4,
        }}>
          {expanded
            ? (locale === "de" ? "↑ Weniger" : "↑ Less")
            : (locale === "de" ? `↓ ${sentences.length} Sätze` : `↓ ${sentences.length} sentences`)}
        </button>
      )}
    </div>
  );
}
