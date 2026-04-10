"use client";

/**
 * RadarView — Spatial view of trends in the strategic landscape.
 *
 * Sprint 4b expansion: the radar is now backed by the canonical STEEP+V
 * quadrant mapping AND merges live signal counts from /api/v1/feed (sparkline,
 * signalCount72h, avgStrength, derived velocity). A filter bar lets users
 * narrow by velocity, horizon, confidence floor, impact floor, and free-text
 * search. The previous version was a static dot-plot of curated metadata; this
 * version is a live operational view.
 */

import { useRef, useState, useMemo, useEffect } from "react";
import RadarChart from "./RadarChart";
import { TrendDot, TimeHorizon } from "@/types";
import { Locale } from "@/lib/i18n";
import {
  applySteepVQuadrants,
  QUADRANT_LABELS_DE,
  QUADRANT_LABELS_EN,
  QUADRANT_DESCRIPTIONS_DE,
  QUADRANT_DESCRIPTIONS_EN,
} from "@/lib/steep-v-quadrants";

interface RadarViewProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
  locale: Locale;
  filteredTrendIds?: string[];
}

type VelocityFilter = "all" | "rising" | "stable" | "falling";

interface LiveFeedTrend {
  id: string;
  name: string;
  signalCount72h?: number;
  avgStrength?: number;
  sparkline?: number[];
  velocity?: "rising" | "stable" | "falling";
}

export default function RadarView({ trends, onTrendClick, locale, filteredTrendIds }: RadarViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const de = locale === "de";

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [velocityFilter, setVelocityFilter] = useState<VelocityFilter>("all");
  const [horizonFilter, setHorizonFilter] = useState<Set<TimeHorizon>>(
    new Set(["short", "mid", "long"])
  );
  const [minConfidence, setMinConfidence] = useState(0);
  const [minImpact, setMinImpact] = useState(0);

  // ── Live signal overlay from /api/v1/feed ────────────────────────────────
  const [liveTrends, setLiveTrends] = useState<Map<string, LiveFeedTrend> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/feed")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data?.trends ?? []) as LiveFeedTrend[];
        if (Array.isArray(list)) {
          // Build a lookup map keyed by id AND name (lowercase) so we match
          // either way — DB rows can be keyed differently from megaTrends.
          const map = new Map<string, LiveFeedTrend>();
          for (const t of list) {
            if (t.id) map.set(t.id, t);
            if (t.name) map.set(t.name.toLowerCase(), t);
          }
          setLiveTrends(map);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Apply STEEP+V quadrants + live signal merge ──────────────────────────
  const enrichedTrends = useMemo<TrendDot[]>(() => {
    const withQuadrants = applySteepVQuadrants(trends);
    if (!liveTrends) return withQuadrants;
    return withQuadrants.map((t) => {
      const live = liveTrends.get(t.id) ?? liveTrends.get(t.name.toLowerCase());
      if (!live) return t;
      return {
        ...t,
        signalCount72h: live.signalCount72h,
        avgStrength: live.avgStrength,
        sparkline: live.sparkline,
        velocity: live.velocity ?? t.velocity,
      };
    });
  }, [trends, liveTrends]);

  // ── Apply filters ────────────────────────────────────────────────────────
  const filteredTrends = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedTrends.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !(t.description?.toLowerCase().includes(q) ?? false)) {
        return false;
      }
      if (velocityFilter !== "all" && t.velocity !== velocityFilter) return false;
      if (!horizonFilter.has(t.timeHorizon)) return false;
      if (t.confidence < minConfidence) return false;
      if (t.impact < minImpact) return false;
      return true;
    });
  }, [enrichedTrends, search, velocityFilter, horizonFilter, minConfidence, minImpact]);

  const quadrantLabels = de ? QUADRANT_LABELS_DE : QUADRANT_LABELS_EN;
  const quadrantDescriptions = de ? QUADRANT_DESCRIPTIONS_DE : QUADRANT_DESCRIPTIONS_EN;

  const orderedQuadrantLabels = [
    quadrantLabels[0],
    quadrantLabels[1],
    quadrantLabels[2],
    quadrantLabels[3],
  ];

  const totalCount = enrichedTrends.length;
  const filteredCount = filteredTrends.length;
  const liveActiveCount = enrichedTrends.filter((t) => (t.signalCount72h ?? 0) > 0).length;

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1360, margin: "0 auto" }}>
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
        marginBottom: 12,
        padding: "10px 14px",
        background: "var(--volt-surface-raised, #fff)",
        border: "1px solid var(--volt-border, #E8E8E8)",
        borderRadius: 12,
      }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 200px" }}>
          <span style={{ fontSize: 12, color: "var(--volt-text-faint, #999)" }}>⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={de ? "Trend suchen…" : "Search trends…"}
            style={{
              flex: 1, minWidth: 0,
              border: "none", outline: "none", background: "transparent",
              fontSize: 12, fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              color: "var(--volt-text, #0A0A0A)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "transparent", border: "none", color: "var(--volt-text-muted, #6B6B6B)", cursor: "pointer", fontSize: 12 }}
            >
              ✕
            </button>
          )}
        </div>

        <span style={{ width: 1, height: 18, background: "var(--volt-border, #E8E8E8)" }} />

        {/* Velocity */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontFamily: "var(--volt-font-mono, monospace)", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--volt-text-faint, #999)", marginRight: 4,
          }}>
            {de ? "Tempo" : "Velocity"}
          </span>
          {(["all", "rising", "stable", "falling"] as VelocityFilter[]).map((v) => (
            <FilterPill
              key={v}
              active={velocityFilter === v}
              onClick={() => setVelocityFilter(v)}
              label={
                v === "all" ? (de ? "Alle" : "All")
                : v === "rising" ? (de ? "↗ steigt" : "↗ rising")
                : v === "stable" ? (de ? "→ stabil" : "→ stable")
                : (de ? "↘ fällt" : "↘ falling")
              }
            />
          ))}
        </div>

        <span style={{ width: 1, height: 18, background: "var(--volt-border, #E8E8E8)" }} />

        {/* Horizon */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontFamily: "var(--volt-font-mono, monospace)", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--volt-text-faint, #999)", marginRight: 4,
          }}>
            {de ? "Horizont" : "Horizon"}
          </span>
          {(["short", "mid", "long"] as TimeHorizon[]).map((h) => (
            <FilterPill
              key={h}
              active={horizonFilter.has(h)}
              onClick={() => {
                const next = new Set(horizonFilter);
                if (next.has(h)) next.delete(h);
                else next.add(h);
                if (next.size === 0) next.add(h); // never empty
                setHorizonFilter(next);
              }}
              label={de ? (h === "short" ? "kurz" : h === "mid" ? "mittel" : "lang") : h}
            />
          ))}
        </div>

        <span style={{ width: 1, height: 18, background: "var(--volt-border, #E8E8E8)" }} />

        {/* Confidence + Impact sliders */}
        <SliderControl
          label={de ? "Konfidenz ≥" : "Confidence ≥"}
          value={minConfidence}
          onChange={setMinConfidence}
        />
        <SliderControl
          label={de ? "Impact ≥" : "Impact ≥"}
          value={minImpact}
          onChange={setMinImpact}
        />
      </div>

      {/* ── Live signal status row ───────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginBottom: 14,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 10, fontWeight: 500, letterSpacing: "0.04em",
        color: "var(--volt-text-muted, #6B6B6B)",
      }}>
        <span style={{ fontWeight: 700, color: "var(--volt-text-faint, #999)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {filteredCount}/{totalCount} {de ? "Trends" : "Trends"}
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: liveActiveCount > 0 ? "#1A9E5A" : "#9CA3AF",
            boxShadow: liveActiveCount > 0 ? "0 0 6px rgba(26,158,90,0.6)" : "none",
          }} />
          {liveActiveCount} {de ? "mit Live-Signalen (72h)" : "with live signals (72h)"}
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <LegendItem marker="dot-big" label={de ? "Größe = Einfluss" : "Size = Impact"} />
        <LegendItem marker="color" label={de ? "Farbe = Horizont" : "Color = Horizon"} />
        <LegendItem marker="opacity" label={de ? "Deckkraft = Vertrauen" : "Opacity = Confidence"} />
      </div>

      {/* ── Quadrant legend strip ─────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        marginBottom: 14,
      }}>
        {orderedQuadrantLabels.map((label, idx) => (
          <div
            key={idx}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--volt-border, #E8E8E8)",
              borderRadius: 8,
              background: "var(--volt-surface, #FAFAFA)",
            }}
          >
            <div style={{
              fontFamily: "var(--volt-font-mono, monospace)",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--volt-text-faint, #999)",
              marginBottom: 2,
            }}>
              Q{idx + 1}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: "var(--volt-text, #0A0A0A)",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 10, color: "var(--volt-text-muted, #6B6B6B)",
              marginTop: 2, lineHeight: 1.3,
            }}>
              {quadrantDescriptions[idx as 0 | 1 | 2 | 3]}
            </div>
          </div>
        ))}
      </div>

      {/* ── Radar chart (boxed like the Netzwerk graph) ─────────────────── */}
      <div style={{
        border: "1px solid var(--volt-border, #E8E8E8)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--color-surface, #F8F8F6)",
      }}>
        <RadarChart
          trends={filteredTrends}
          quadrants={orderedQuadrantLabels}
          onTrendClick={onTrendClick}
          selectedTrendId={filteredTrendIds?.[0] ?? null}
          svgRef={svgRef}
        />
      </div>

      {/* ── Bottom legend ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
        marginTop: 10, marginBottom: 20,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 9,
        color: "var(--volt-text-faint, #AAA)",
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {de ? "Ringe" : "Rings"}
        </span>
        <span>Adopt → Trial → Assess → Hold ({de ? "innen → außen" : "inner → outer"})</span>
        <span style={{ width: 1, height: 10, background: "var(--volt-border, #E8E8E8)" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px dashed #1A9E5A", display: "inline-block" }} />
          {de ? "steigt" : "rising"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid #E8402A", display: "inline-block" }} />
          {de ? "fällt" : "falling"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(122,184,245,0.35)", display: "inline-block" }} />
          {de ? "Live-Halo = Signal-Aktivität" : "Live halo = Signal activity"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 9 }}>
          {de ? "Klick = Auswahl · Scroll = Zoom · Doppelklick = Reset" : "Click = Select · Scroll = Zoom · Double-click = Reset"}
        </span>
      </div>
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

// ── Filter pill primitive ───────────────────────────────────────────────────

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 999,
        border: active ? "1px solid var(--volt-text, #0A0A0A)" : "1px solid var(--volt-border, #E8E8E8)",
        background: active ? "var(--volt-text, #0A0A0A)" : "var(--volt-surface-raised, #fff)",
        color: active ? "#fff" : "var(--volt-text-muted, #6B6B6B)",
        cursor: "pointer",
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        transition: "all 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

// ── Slider control primitive ────────────────────────────────────────────────

function SliderControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
      <span style={{
        fontFamily: "var(--volt-font-mono, monospace)", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--volt-text-faint, #999)",
      }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 70, accentColor: "var(--volt-text, #0A0A0A)" }}
      />
      <span style={{
        fontFamily: "var(--volt-font-mono, monospace)", fontSize: 10, fontWeight: 600,
        color: "var(--volt-text, #0A0A0A)", minWidth: 28, textAlign: "right",
      }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}
