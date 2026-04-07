"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types (minimal subset from feed API) ────────────────────────────────────

interface TeaserSignal {
  id: string; source: string; title: string; url: string | null;
  strength: number; hoursAgo: number;
}

interface TeaserTrend {
  id: string; name: string; ring: string;
  velocity: "rising" | "stable" | "falling";
  signalCount72h: number; trendType: string;
  sparkline: number[];
}

interface TeaserData {
  topSignals: TeaserSignal[];
  trends: TeaserTrend[];
  meta: { freshSignals: number; totalSignals: number };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  hackernews: "#FF6600", github: "#333", reddit: "#FF5700", news: "#1A73E8",
  arxiv: "#B31B1B", wikipedia: "#636466", polymarket: "#6366F1",
};

const VEL = {
  rising:  { sym: "↑", color: "var(--signal-positive, #1A9E5A)" },
  stable:  { sym: "→", color: "var(--volt-text-faint, #9CA3AF)" },
  falling: { sym: "↓", color: "var(--signal-negative, #E8402A)" },
};

function ageLabel(h: number): string { return h < 1 ? "<1h" : h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`; }

function MiniSparkline({ data, color = "#3B82F6" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <svg width={40} height={12} viewBox="0 0 40 12" style={{ display: "block", flexShrink: 0 }}>
      {data.map((v, i) => {
        const h = (v / max) * 10;
        const bw = 40 / data.length;
        return <rect key={i} x={i * bw} y={11 - h} width={bw - 1} height={Math.max(h, 0.5)} rx={1} fill={color} fillOpacity={0.25 + (v / max) * 0.55} />;
      })}
    </svg>
  );
}

// ─── FeedTeaser ──────────────────────────────────────────────────────────────

export default function FeedTeaser({ locale }: { locale: "de" | "en" }) {
  const de = locale === "de";
  const [data, setData] = useState<TeaserData | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/feed");
      if (!res.ok) return;
      setData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  if (!data) return null;

  // Pick top 3 most dynamic trends (rising first, then by relevance)
  const hotTrends = [...data.trends]
    .sort((a, b) => {
      const vScore = (v: string) => v === "rising" ? 2 : v === "falling" ? 0 : 1;
      return vScore(b.velocity) - vScore(a.velocity) || b.signalCount72h - a.signalCount72h;
    })
    .slice(0, 4);

  // Pick top 3 signals
  const topSignals = data.topSignals.slice(0, 3);

  return (
    <div style={{
      borderTop: "1px solid var(--color-border)",
      padding: "14px 0 10px",
      marginTop: 8,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
        <span style={{ fontSize: 8, color: "var(--signal-positive)" }}>●</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
          {de ? "Was sich gerade bewegt" : "What's moving now"}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", opacity: 0.6 }}>
          {data.meta.freshSignals} {de ? "Signale" : "signals"}
        </span>
        <Link href="/wissen#signale" style={{
          marginLeft: "auto", fontSize: 10, fontWeight: 600,
          color: "var(--color-text-muted)", textDecoration: "none",
          padding: "2px 8px", borderRadius: 10,
          border: "1px solid var(--color-border)",
          transition: "all 0.12s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-heading)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; }}
        >
          {de ? "Signal-Radar öffnen →" : "Open Signal Radar →"}
        </Link>
      </div>

      {/* Two-part layout: Hot Trends | Fresh Signals */}
      <div style={{ display: "flex", gap: 16, alignItems: "start" }}>

        {/* Hot Trends (left) */}
        <div style={{ flex: 1, display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {hotTrends.map(t => {
            const vel = VEL[t.velocity];
            return (
              <Link key={t.id} href="/wissen#signale" className="volt-card" style={{
                flexShrink: 0, width: 160, padding: "8px 10px",
                textDecoration: "none", color: "inherit",
                transition: "border-color 0.12s, transform 0.12s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = vel.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--volt-border, var(--color-border))"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-heading)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: vel.color, flexShrink: 0 }}>{vel.sym}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: t.trendType === "megatrend" ? "var(--pastel-butter, #FFF5BA)" : "var(--color-surface-2, #F3F4F6)", color: t.trendType === "megatrend" ? "var(--pastel-butter-text)" : "var(--volt-text-faint, #9CA3AF)" }}>
                    {t.trendType === "megatrend" ? "MEGA" : "MAKRO"}
                  </span>
                  <MiniSparkline data={t.sparkline} color={vel.color} />
                  <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{t.ring}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--color-border)", flexShrink: 0 }} />

        {/* Fresh Signals (right) */}
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 2 }}>
            {de ? "Frische Signale" : "Fresh Signals"}
          </span>
          {topSignals.map(s => {
            const srcColor = SOURCE_COLORS[s.source] ?? "var(--volt-text-muted, #666)";
            const ageBg = s.hoursAgo < 24 ? "var(--signal-positive)" : s.hoursAgo < 72 ? "var(--pastel-amber-text, #F5A623)" : "var(--volt-text-faint, #9CA3AF)";
            return (
              <a key={s.id} href={s.url ?? "/wissen#signale"} target={s.url ? "_blank" : "_self"} rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "3px 6px",
                  borderRadius: 5, textDecoration: "none", color: "inherit",
                  transition: "background 0.1s", fontSize: 11,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 8, color: ageBg, fontFamily: "monospace", width: 22, textAlign: "right", flexShrink: 0 }}>{ageLabel(s.hoursAgo)}</span>
                <span style={{ fontSize: 8, fontWeight: 600, padding: "0px 4px", borderRadius: 3, background: `${srcColor}14`, color: srcColor, flexShrink: 0, fontFamily: "var(--font-code, monospace)" }}>{s.source}</span>
                <span style={{ color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                {s.url && <span style={{ fontSize: 9, color: "var(--color-text-muted)", opacity: 0.4, flexShrink: 0 }}>↗</span>}
              </a>
            );
          })}
          <Link href="/wissen#signale" style={{ fontSize: 10, color: "var(--color-text-muted)", textDecoration: "none", marginTop: 2, paddingLeft: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-heading)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
          >{de ? "Alle Signale →" : "All signals →"}</Link>
        </div>
      </div>
    </div>
  );
}
