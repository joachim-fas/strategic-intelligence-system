"use client";

/**
 * TrendOverview — Implements the Volt UI "Trend-Übersicht" template.
 *
 * Spec from https://grainui-jddpkx7p.manus.space/ (Templates & Visualisierung):
 *   "Vollständiges Layout einer Trend-Intelligence-Plattform — Trend-Grid mit
 *    Statusgruppen, Detail-Panel und Intelligence Feed."
 *
 * Used as the "Signale" tab in /verstehen.
 *
 * Layout:
 *   [Status Group Header: ● ADOPT (8)]
 *   [4-col grid of VoltTrendCards]
 *   [Status Group Header: ● TRIAL (12)]
 *   [4-col grid]
 *   [Status Group Header: ● ASSESS (7)]
 *   [Status Group Header: ● HOLD (1)]
 */

import React, { useMemo } from "react";
import { TrendDot } from "@/types";
import { Locale } from "@/lib/i18n";
import { VoltStatusDot, VoltTrendCard, Ring } from "./VoltPrimitives";

interface TrendOverviewProps {
  trends: TrendDot[];
  locale: Locale;
  onTrendClick: (trend: TrendDot) => void;
  selectedId?: string | null;
}

const RING_ORDER: Ring[] = ["adopt", "trial", "assess", "hold"];

export default function TrendOverview({
  trends,
  locale,
  onTrendClick,
  selectedId,
}: TrendOverviewProps) {
  const de = locale === "de";

  // Group trends by ring, then sort by relevance within group
  const grouped = useMemo(() => {
    const groups: Record<Ring, TrendDot[]> = {
      adopt: [],
      trial: [],
      assess: [],
      hold: [],
    };
    for (const t of trends) {
      const ring = (t.ring || "assess") as Ring;
      if (groups[ring]) groups[ring].push(t);
    }
    for (const k of Object.keys(groups) as Ring[]) {
      groups[k].sort((a, b) => b.relevance - a.relevance);
    }
    return groups;
  }, [trends]);

  const getMetaLabel = (t: TrendDot): string => {
    const cat = t.category?.toLowerCase() || "";
    if (cat.includes("mega")) return "MEGA";
    if (cat.includes("makro") || cat.includes("macro")) return "MAKRO";
    if (cat.includes("mikro") || cat.includes("micro")) return "MIKRO";
    return "TREND";
  };

  const getDirection = (t: TrendDot): "rising" | "stable" | "falling" => {
    if (t.velocity === "rising") return "rising";
    if (t.velocity === "falling") return "falling";
    return "stable";
  };

  return (
    <div style={{ padding: "20px 24px 60px", display: "flex", flexDirection: "column", gap: 28 }}>
      {RING_ORDER.map((ring) => {
        const items = grouped[ring];
        if (!items || items.length === 0) return null;

        return (
          <section key={ring}>
            {/* Group header */}
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <VoltStatusDot ring={ring} count={items.length} de={de} />
            </div>

            {/* 4-column grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {items.map((t) => (
                <VoltTrendCard
                  key={t.id}
                  title={t.name}
                  meta={getMetaLabel(t)}
                  ring={ring}
                  direction={getDirection(t)}
                  signalCount={t.signalCount || 0}
                  score={t.relevance}
                  selected={selectedId === t.id}
                  onClick={() => onTrendClick(t)}
                  de={de}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
