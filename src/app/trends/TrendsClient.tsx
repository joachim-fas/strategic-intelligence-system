"use client";

/**
 * /trends — Trend-Übersicht (Client)
 *
 * Standalone page that shows ALL tracked trends grouped by Tech-Radar ring
 * (Adopt / Trial / Assess / Hold), sorted by relevance within each group.
 * Users arrive here from the Home page "Trends anzeigen" link or by typing
 * /trends directly — it's intentionally a flat, scannable grid, not the
 * multi-tab Knowledge Cockpit at /verstehen.
 *
 * Data flow mirrors /verstehen: start from the static `megaTrends` baseline
 * and overlay DB-stored relevance/impact/confidence/ring/velocity/signalCount
 * by trend name. If the /api/v1/trends call fails, the static baseline stays
 * and the page still renders usefully.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AppHeader } from "@/components/AppHeader";
import { TrendDot } from "@/types";
import { megaTrends } from "@/lib/mega-trends";
import { classifyTrends } from "@/lib/classify";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useLocale } from "@/lib/locale-context";
import TrendOverview from "@/components/verstehen/TrendOverview";

const TrendDetailPanel = dynamic(() => import("@/components/radar/TrendDetailPanel"), {
  ssr: false,
});

export default function TrendsClient() {
  const { locale } = useLocale();
  const de = locale === "de";

  const [trends, setTrends] = useState<TrendDot[]>(megaTrends);
  const [selectedTrend, setSelectedTrend] = useState<TrendDot | null>(null);

  // Trends load — same merge strategy as /verstehen so both pages stay in sync.
  useEffect(() => {
    fetchWithTimeout("/api/v1/trends")
      .then(r => r.json())
      .then((data) => {
        const list = data?.data?.trends ?? data?.trends;
        if (!Array.isArray(list) || list.length === 0) return;
        const dbByName = new Map(
          (list as TrendDot[]).map((t) => [t.name.toLowerCase(), t]),
        );
        const merged = megaTrends.map((mt) => {
          const db = dbByName.get(mt.name.toLowerCase());
          if (!db) return mt;
          return {
            ...mt,
            relevance: db.relevance,
            confidence: db.confidence,
            impact: db.impact,
            ring: db.ring,
            velocity: db.velocity ?? mt.velocity,
            signalCount: db.signalCount ?? mt.signalCount,
          };
        });
        setTrends(classifyTrends(merged));
      })
      .catch(() => {
        /* keep megaTrends as fallback */
      });
  }, []);

  // Group counts per ring for the hero stats line.
  const counts = useMemo(() => {
    const c = { adopt: 0, trial: 0, assess: 0, hold: 0 };
    trends.forEach((t) => {
      const ring = (t.ring || "assess") as keyof typeof c;
      if (ring in c) c[ring] += 1;
    });
    return c;
  }, [trends]);

  const handleTrendClick = useCallback((trend: TrendDot) => {
    setSelectedTrend((prev) => (prev?.id === trend.id ? null : trend));
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        color: "var(--color-text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppHeader />

      {/* ── Hero — title + mono stats strip ──────────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid var(--volt-border, #E8E8E8)",
          background: "var(--volt-surface-raised, #fff)",
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "28px 24px 20px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--volt-text-faint, #BBB)",
              marginBottom: 10,
            }}
          >
            {de ? "Trend-Intelligence" : "Trend Intelligence"}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--volt-text, #0A0A0A)",
            }}
          >
            {de ? "Trends im Überblick" : "Trends Overview"}
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              color: "var(--volt-text-muted, #6B6B6B)",
              maxWidth: 640,
              lineHeight: 1.5,
            }}
          >
            {de
              ? "Alle beobachteten Trends gruppiert nach Tech-Radar-Ring (Adopt · Trial · Assess · Hold). Klick auf einen Trend öffnet das Detailpanel mit Signalen, Kausalverbindungen und Quellen."
              : "All tracked trends grouped by Tech-Radar ring (Adopt · Trial · Assess · Hold). Click a trend to open the detail panel with signals, causal links and sources."}
          </p>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 22,
              flexWrap: "wrap",
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 11,
              letterSpacing: "0.06em",
              color: "var(--volt-text-muted, #6B6B6B)",
            }}
          >
            <span>
              <strong style={{ color: "var(--volt-text, #0A0A0A)" }}>{trends.length}</strong> {de ? "Trends" : "Trends"}
            </span>
            <span>
              <strong style={{ color: "#0F6038" }}>{counts.adopt}</strong> Adopt
            </span>
            <span>
              <strong style={{ color: "#1A4A8A" }}>{counts.trial}</strong> Trial
            </span>
            <span>
              <strong style={{ color: "#7A5C00" }}>{counts.assess}</strong> Assess
            </span>
            <span>
              <strong style={{ color: "#6B7280" }}>{counts.hold}</strong> Hold
            </span>
          </div>
        </div>
      </div>

      {/* ── Main: Trend Grid ────────────────────────────────────────────── */}
      <div style={{ flex: 1, maxWidth: 1360, width: "100%", margin: "0 auto" }}>
        <TrendOverview
          trends={trends}
          locale={locale}
          onTrendClick={handleTrendClick}
          selectedId={selectedTrend?.id ?? null}
        />
      </div>

      {/* ── Detail panel overlay ────────────────────────────────────────── */}
      {selectedTrend && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.4)",
              backdropFilter: "blur(2px)",
              zIndex: 30,
            }}
            onClick={() => setSelectedTrend(null)}
          />
          <TrendDetailPanel trend={selectedTrend} onClose={() => setSelectedTrend(null)} />
        </>
      )}
    </div>
  );
}
