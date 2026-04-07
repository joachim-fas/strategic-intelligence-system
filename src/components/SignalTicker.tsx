"use client";

import { useState, useEffect } from "react";

interface TickerSignal {
  id: string;
  source: string;
  title: string;
  url: string | null;
  hoursAgo: number;
}

const SOURCE_DOT: Record<string, string> = {
  hackernews: "#FF6600", github: "#333", reddit: "#FF5700",
  arxiv: "#B31B1B", gdelt: "#1A4A8A", polymarket: "#6366F1",
  guardian: "#052962", nyt: "#111", newsdata: "#0EA5E9",
};

function ageLabel(h: number): string {
  return h < 1 ? "<1h" : h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
}

export default function SignalTicker() {
  const [signals, setSignals] = useState<TickerSignal[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/v1/feed")
      .then(r => r.json())
      .then(data => {
        const top = (data.topSignals ?? []).slice(0, 8).map((s: any) => ({
          id: s.id, source: s.source, title: s.title, url: s.url,
          hoursAgo: s.hoursAgo ?? 0,
        }));
        setSignals(top);
      })
      .catch(() => {});
  }, []);

  // Hide ticker when rendered inside an iframe (e.g. Canvas embedded in Werkstatt)
  const [isIframe, setIsIframe] = useState(false);
  useEffect(() => {
    try { setIsIframe(window.self !== window.top); } catch { setIsIframe(true); }
  }, []);

  if (signals.length === 0 || isIframe) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
      background: "var(--volt-surface-raised, #fff)",
      borderTop: "1px solid var(--volt-border, #E8E8E8)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      transition: "height 200ms ease",
    }}>
      {/* Collapsed: single line */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "6px 16px", cursor: "pointer",
          maxWidth: 1200, margin: "0 auto",
          overflow: "hidden",
        }}
      >
        <span style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const,
          color: "var(--signal-positive, #1A9E5A)", flexShrink: 0,
        }}>
          ● LIVE
        </span>

        <div style={{
          flex: 1, overflow: "hidden", display: "flex", gap: 20,
          maskImage: "linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%)",
        }}>
          {signals.slice(0, expanded ? 8 : 5).map(s => {
            const dot = SOURCE_DOT[s.source] ?? "#999";
            return (
              <a
                key={s.id}
                href={s.url ?? "#"}
                target={s.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, color: "var(--volt-text-muted, #6B6B6B)",
                  textDecoration: "none", whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{
                  fontFamily: "var(--volt-font-mono)", fontSize: 9,
                  color: "var(--volt-text-faint, #AAA)", minWidth: 20,
                }}>{ageLabel(s.hoursAgo)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{s.title}</span>
              </a>
            );
          })}
        </div>

        <span style={{
          fontFamily: "var(--volt-font-mono)", fontSize: 9,
          color: "var(--volt-text-faint, #AAA)", flexShrink: 0,
        }}>
          {expanded ? "▼" : "▲"} {signals.length}
        </span>
      </div>

      {/* Expanded: full list */}
      {expanded && (
        <div style={{
          padding: "0 16px 8px", maxWidth: 1200, margin: "0 auto",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {signals.slice(3).map(s => {
            const dot = SOURCE_DOT[s.source] ?? "#999";
            return (
              <a
                key={s.id}
                href={s.url ?? "#"}
                target={s.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "3px 0", fontSize: 11,
                  color: "var(--volt-text-muted)", textDecoration: "none",
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 9, color: "var(--volt-text-faint)", minWidth: 24 }}>{ageLabel(s.hoursAgo)}</span>
                <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 9, color: dot, minWidth: 60 }}>{s.source}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                {s.url && <span style={{ fontSize: 9, color: "var(--volt-text-faint)" }}>↗</span>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
