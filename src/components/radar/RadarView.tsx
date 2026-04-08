"use client";

/**
 * RadarView — Spatial view of trends in the strategic landscape.
 *
 * Simplified: the right sidebar list (search + ring-grouped trends) has been
 * removed because it duplicated the Signale tab. The Radar now fills the full
 * width of the available container. Users who want to browse trends as a list
 * go to the Signale tab; users who want to explore them spatially stay here.
 *
 * Click a dot → opens the TrendDetailPanel (controlled by the parent).
 *
 * NOTE: The 4 hardcoded quadrant labels are intentionally unchanged in this
 * pass — the user asked to decide on the dimension mapping separately.
 */

import { useRef } from "react";
import RadarChart from "./RadarChart";
import { TrendDot } from "@/types";
import { Locale } from "@/lib/i18n";

interface RadarViewProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
  locale: Locale;
  filteredTrendIds?: string[];
}

const DEFAULT_QUADRANTS = [
  "Technology & AI",
  "Business & Society",
  "Development & Engineering",
  "Data & Infrastructure",
];

export default function RadarView({ trends, onTrendClick, locale, filteredTrendIds }: RadarViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Inline legend — concise, replaces the mini-stats row that used to live
  // above the radar in the page wrapper.
  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1360, margin: "0 auto" }}>
      {/* Legend strip — size/color/opacity meaning in one row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        flexWrap: "wrap",
        marginBottom: 14,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 10, fontWeight: 500, letterSpacing: "0.04em",
        color: "var(--volt-text-muted, #6B6B6B)",
      }}>
        <LegendItem marker="dot-big" label={locale === "de" ? "Größe = Einfluss" : "Size = Impact"} />
        <LegendItem marker="color" label={locale === "de" ? "Farbe = Horizont" : "Color = Horizon"} />
        <LegendItem marker="opacity" label={locale === "de" ? "Deckkraft = Vertrauen" : "Opacity = Confidence"} />
      </div>

      {/* Radar chart — full width */}
      <RadarChart
        trends={trends}
        quadrants={DEFAULT_QUADRANTS}
        onTrendClick={onTrendClick}
        selectedTrendId={filteredTrendIds?.[0] ?? null}
        svgRef={svgRef}
      />
    </div>
  );
}

// ── Legend sub-component ─────────────────────────────────────────────────────

function LegendItem({ marker, label }: { marker: "dot-big" | "color" | "opacity"; label: string }) {
  let icon: React.ReactNode;
  if (marker === "dot-big") {
    icon = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#6B7A9A" }} />
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#6B7A9A" }} />
      </span>
    );
  } else if (marker === "color") {
    icon = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7AB8F5" }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#9B87F5" }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#F5C87A" }} />
      </span>
    );
  } else {
    icon = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6B7A9A", opacity: 0.3 }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6B7A9A", opacity: 1 }} />
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );
}
