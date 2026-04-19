"use client";

/**
 * DataGapHint — Worldmonitor-style "show what you can't see" transparency.
 *
 * Welle B Item 4 of the 4-app Deep-Dive. When the user lands on an empty
 * state (no signals, no matches, no trends), the app should be honest
 * about *why*: are we genuinely looking at a quiet news cycle, or is the
 * source pipeline broken? Worldmonitor's 31-source "fresh / stale /
 * no_data / error / disabled" UI is the reference.
 *
 * Implementation keeps this cheap:
 *   - Single fetch to `/api/v1/sources/status` on mount.
 *   - Caches per page-view via useEffect([]) — the endpoint itself is
 *     short-cache, so two consumers on the same page will hit the
 *     browser cache on the second mount.
 *   - Renders nothing until the fetch completes; then a compact one-line
 *     summary with a deep-link to /monitor for the full dashboard.
 *   - Silent when everything is healthy — no visual noise on the happy
 *     path. The component's whole reason to exist is the gap case.
 *
 * Usage: drop into any empty-state card, e.g. LiveSignalStream's
 * "no signals at 7 days" branch or the Cockpit's "no trends" state.
 */

import React, { useEffect, useState } from "react";
import { useT } from "@/lib/locale-context";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface SourcesStatus {
  totalSignals: number;
  healthy: number;
  stale: number;
  inactive: number;
  needsKey: number;
  connectors: Array<{ name: string; status: string; signalCount: number }>;
}

export function DataGapHint({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const [data, setData] = useState<SourcesStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithTimeout("/api/v1/sources/status", {}, 4000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json.data ?? json);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Silent on the happy path — Worldmonitor's rule: only show the gap
  // tracker when there's actually a gap to show.
  if (error || !data) return null;
  const hasGap = data.stale > 0 || data.inactive > 0 || data.needsKey > 0;
  if (!hasGap) return null;

  // Build the three-part summary. Each fragment appears only if there
  // are actually that many items in that bucket — so the line stays
  // honest and doesn't list "0 silent" when silence is not a concern.
  const parts: string[] = [];
  if (data.needsKey > 0) parts.push(t("gapHint.missingKey", { n: data.needsKey }));
  if (data.stale > 0) parts.push(t("gapHint.stale", { n: data.stale }));
  if (data.inactive > 0) parts.push(t("gapHint.silent", { n: data.inactive }));

  const summary = parts.join(" · ");
  const prefixLabel = t("gapHint.prefixLabel");
  const actionLabel = t("gapHint.actionLabel");

  if (compact) {
    // Inline single-line variant for empty-state cards that can't
    // afford a second block. Mono font + subtle color so it doesn't
    // fight with the primary empty-state copy.
    return (
      <div style={{
        fontSize: 10,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        color: "var(--volt-text-faint, #737373)",
        display: "flex", alignItems: "center", gap: 6,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
          {prefixLabel}
        </span>
        <span>{summary}</span>
        <a href="/monitor" style={{
          color: "var(--volt-text-muted, #6B6B6B)",
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}>
          {actionLabel}
        </a>
      </div>
    );
  }

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      borderRadius: 10,
      background: "var(--pastel-butter-light, #FFF8F0)",
      border: "1px solid var(--pastel-butter-border, #F0D4A8)",
      fontSize: 12,
      color: "var(--pastel-butter-text, #955A20)",
      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      flexWrap: "wrap",
    }}>
      <span aria-hidden style={{ fontSize: 13 }}>⚠</span>
      <span>
        <strong style={{ fontWeight: 600 }}>{prefixLabel}:</strong>{" "}
        {summary}
      </span>
      <a href="/monitor" style={{
        fontSize: 11, fontWeight: 600,
        color: "inherit",
        textDecoration: "underline",
        textUnderlineOffset: 2,
      }}>
        {actionLabel}
      </a>
    </div>
  );
}

export default DataGapHint;
