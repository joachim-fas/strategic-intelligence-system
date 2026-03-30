import { useState } from "react";

// ─── Data Types ───────────────────────────────────────────────────────────────

export interface BSCPerspective {
  id: string;
  label: string;
  score: number;
  trend: "rising" | "stable" | "declining" | "uncertain";
  summary: string;
  keyFactors: string[];
  connectedTrendIds: string[];
  impacts: Record<string, number>;
}

export interface BalancedScorecardData {
  perspectives: BSCPerspective[];
  overallReadiness: number;
  criticalTension?: string;
}

// ─── Component Interface ──────────────────────────────────────────────────────

interface BalancedScorecardProps {
  data: BalancedScorecardData;
  locale: "de" | "en";
  onRating?: (perspectiveId: string, rating: "up" | "down" | null) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Grain UI Pastell-Palette — Baby Blue · Mint · Butter · Orchid
const PERSPECTIVE_COLORS = [
  { color: "#1A4A8A", bg: "#D4E8FF" },  // Baby Blue
  { color: "#0F6038", bg: "#C3F4D3" },  // Mint Green
  { color: "#7A5C00", bg: "#FFF5BA" },  // Butter Yellow
  { color: "#7C1A9E", bg: "#FDE2FF" },  // Soft Orchid
];

const TREND_ICONS: Record<BSCPerspective["trend"], string> = {
  rising: "↑",
  stable: "→",
  declining: "↓",
  uncertain: "?",
};

const TREND_COLORS: Record<BSCPerspective["trend"], string> = {
  rising:    "var(--signal-positive)",
  stable:    "var(--signal-neutral)",
  declining: "var(--signal-negative)",
  uncertain: "#C8820A",
};

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  p1: { x: 120, y: 100 },
  p2: { x: 480, y: 100 },
  p3: { x: 120, y: 220 },
  p4: { x: 480, y: 220 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPerspectiveColor(index: number) {
  return PERSPECTIVE_COLORS[index] ?? PERSPECTIVE_COLORS[0];
}

function computedScore(
  p: BSCPerspective,
  perspectives: BSCPerspective[],
  deltas: Record<string, number>
): number {
  let score = p.score + (deltas[p.id] ?? 0);
  for (const [otherId, delta] of Object.entries(deltas)) {
    if (otherId !== p.id) {
      const otherP = perspectives.find((x) => x.id === otherId);
      if (otherP?.impacts[p.id]) {
        score += delta * otherP.impacts[p.id] * 0.5;
      }
    }
  }
  return Math.max(0, Math.min(1, score));
}

function overallColor(pct: number): string {
  if (pct > 60) return "var(--signal-positive)";   // Smaragd
  if (pct > 35) return "var(--color-warning)";      // Butter
  return "var(--signal-negative)";                  // Koralle
}

function splitLabel(label: string): [string, string] {
  const words = label.split(" ");
  if (words.length <= 2) return [label, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PerspectiveCardProps {
  p: BSCPerspective;
  index: number;
  locale: "de" | "en";
  perspectives: BSCPerspective[];
  deltas: Record<string, number>;
  whatIfMode: boolean;
  expanded: string | null;
  ratings: Record<string, "up" | "down" | null>;
  onExpand: (id: string) => void;
  onDeltaChange: (id: string, value: number) => void;
  onRatingClick: (id: string, r: "up" | "down") => void;
}

function PerspectiveCard({
  p,
  index,
  locale,
  perspectives,
  deltas,
  whatIfMode,
  expanded,
  ratings,
  onExpand,
  onDeltaChange,
  onRatingClick,
}: PerspectiveCardProps) {
  const { color } = getPerspectiveColor(index);
  const score = computedScore(p, perspectives, whatIfMode ? deltas : {});
  const trendIcon = TREND_ICONS[p.trend] ?? "?";
  const trendColor = TREND_COLORS[p.trend] ?? "#6B7280";
  const deltaVal = deltas[p.id] ?? 0;
  const isExpanded = expanded === p.id;

  return (
    <div
      onClick={() => onExpand(p.id)}
      style={{
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${color}`,
        background: "var(--color-surface)",
        padding: "12px 14px",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-heading)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            marginRight: 8,
          }}
        >
          {p.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: trendColor }}>{trendIcon}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color }}>
            {(score * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "var(--color-border)",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: color,
            width: `${score * 100}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-primary)",
              margin: "0 0 8px",
              lineHeight: 1.6,
            }}
          >
            {p.summary}
          </p>
          {p.keyFactors.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <span style={{ color, flexShrink: 0, fontSize: 12 }}>·</span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-subtle)",
                  lineHeight: 1.5,
                }}
              >
                {f}
              </span>
            </div>
          ))}
        </>
      )}

      {/* What-If slider */}
      {whatIfMode && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              What-If
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: deltaVal !== 0 ? color : "var(--color-text-muted)",
              }}
            >
              {deltaVal > 0
                ? `+${(deltaVal * 100).toFixed(0)}%`
                : deltaVal < 0
                ? `${(deltaVal * 100).toFixed(0)}%`
                : "±0%"}
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            value={Math.round(deltaVal * 100)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onDeltaChange(p.id, parseInt(e.target.value) / 100);
            }}
            style={{ width: "100%", accentColor: color }}
          />
        </div>
      )}

      {/* Bottom bar: rating + expand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 6,
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {(["up", "down"] as const).map((r) => (
            <button
              key={r}
              onClick={(e) => {
                e.stopPropagation();
                onRatingClick(p.id, r);
              }}
              style={{
                fontSize: 12,
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid transparent",
                cursor: "pointer",
                background:
                  ratings[p.id] === r
                    ? r === "up"
                      ? "#ECFDF5"
                      : "#FEF2F2"
                    : "transparent",
                color:
                  ratings[p.id] === r
                    ? r === "up"
                      ? "var(--color-success)"
                      : "var(--color-danger)"
                    : "var(--color-text-muted)",
              }}
            >
              {r === "up" ? "👍" : "👎"}
            </button>
          ))}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand(p.id);
          }}
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isExpanded
            ? locale === "de"
              ? "▴ weniger"
              : "▴ less"
            : locale === "de"
            ? "▾ mehr"
            : "▾ more"}
        </button>
      </div>
    </div>
  );
}

interface NodeViewProps {
  perspectives: BSCPerspective[];
  deltas: Record<string, number>;
  whatIfMode: boolean;
  overallReadiness: number;
  locale: "de" | "en";
}

function NodeView({
  perspectives,
  deltas,
  whatIfMode,
  overallReadiness,
  locale,
}: NodeViewProps) {
  // Collect all edges
  const edges: Array<{
    fromId: string;
    toId: string;
    impact: number;
    fromPos: { x: number; y: number };
    toPos: { x: number; y: number };
  }> = [];

  for (const p of perspectives) {
    const fromPos = NODE_POSITIONS[p.id];
    if (!fromPos) continue;
    for (const [otherId, impact] of Object.entries(p.impacts)) {
      if (Math.abs(impact) > 0.1) {
        const toPos = NODE_POSITIONS[otherId];
        if (toPos) {
          edges.push({ fromId: p.id, toId: otherId, impact, fromPos, toPos });
        }
      }
    }
  }

  // Compute effective overall in what-if mode
  const effectiveOverall = whatIfMode
    ? perspectives.reduce(
        (sum, p) => sum + computedScore(p, perspectives, deltas),
        0
      ) / Math.max(perspectives.length, 1)
    : overallReadiness;

  const overallPct = Math.round(effectiveOverall * 100);
  const centerLabel = locale === "de" ? "Gesamt" : "Overall";

  return (
    <svg
      viewBox="0 0 600 300"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: 300, display: "block" }}
    >
      {/* Edges */}
      {edges.map((edge, i) => {
        const strokeColor =
          edge.impact > 0 ? "#1A9E5A" : "#E8402A";
        const opacity = Math.min(Math.abs(edge.impact), 1);
        return (
          <line
            key={i}
            x1={edge.fromPos.x}
            y1={edge.fromPos.y}
            x2={edge.toPos.x}
            y2={edge.toPos.y}
            stroke={strokeColor}
            strokeOpacity={opacity}
            strokeWidth={2}
            strokeDasharray={edge.impact < 0 ? "5,4" : undefined}
          />
        );
      })}

      {/* Center: overall readiness */}
      <text
        x={300}
        y={152}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fill="#6B7280"
      >
        {centerLabel}
      </text>
      <text
        x={300}
        y={168}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={18}
        fontWeight={700}
        fill={
          effectiveOverall > 0.6
            ? "#1A9E5A"
            : effectiveOverall > 0.35
            ? "#C8820A"
            : "#E8402A"
        }
      >
        {overallPct}%
      </text>

      {/* Nodes */}
      {perspectives.map((p, index) => {
        const pos = NODE_POSITIONS[p.id] ?? { x: 300, y: 160 };
        const { color, bg } = getPerspectiveColor(index);
        const score = computedScore(p, perspectives, whatIfMode ? deltas : {});
        const [line1, line2] = splitLabel(p.label);

        return (
          <g key={p.id}>
            {/* Node circle */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={30}
              fill={bg}
              stroke={color}
              strokeWidth={2}
            />
            {/* Score arc indicator — simple fill arc using stroke-dasharray trick */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={26}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeOpacity={0.25}
            />
            <circle
              cx={pos.x}
              cy={pos.y}
              r={26}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeDasharray={`${score * 163.4} 163.4`}
              strokeLinecap="round"
              transform={`rotate(-90 ${pos.x} ${pos.y})`}
              style={{ transition: "stroke-dasharray 0.3s ease" }}
            />
            {/* Label inside node */}
            {line2 ? (
              <>
                <text
                  x={pos.x}
                  y={pos.y - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fontWeight={600}
                  fill={color}
                >
                  {line1}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fontWeight={600}
                  fill={color}
                >
                  {line2}
                </text>
              </>
            ) : (
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight={600}
                fill={color}
              >
                {line1}
              </text>
            )}
            {/* Score label below circle */}
            <text
              x={pos.x}
              y={pos.y + 40}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              fill={color}
            >
              {(score * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BalancedScorecard({
  data,
  locale,
  onRating,
}: BalancedScorecardProps) {
  const [view, setView] = useState<"grid" | "nodes">("grid");
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [ratings, setRatings] = useState<Record<string, "up" | "down" | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const perspectives = data.perspectives ?? [];

  function handleRating(perspectiveId: string, r: "up" | "down") {
    const current = ratings[perspectiveId];
    const newRating = current === r ? null : r;
    setRatings((prev) => ({ ...prev, [perspectiveId]: newRating }));
    onRating?.(perspectiveId, newRating);
  }

  function handleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function handleDeltaChange(id: string, value: number) {
    setDeltas((prev) => ({ ...prev, [id]: value }));
  }

  // Overall readiness
  const effectiveOverall = whatIfMode
    ? perspectives.reduce(
        (sum, p) => sum + computedScore(p, perspectives, deltas),
        0
      ) / Math.max(perspectives.length, 1)
    : data.overallReadiness ?? 0;

  const overallPct = Math.round(effectiveOverall * 100);
  const overallBarColor = overallColor(overallPct);

  const sectionLabel = locale === "de" ? "Strategische Dimensionen" : "Strategic Dimensions";
  const viewToggleStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 14,
    padding: "4px 8px",
    borderRadius: "var(--radius-md)",
    border: `1px solid ${active ? "var(--color-brand)" : "var(--color-border)"}`,
    background: active ? "var(--color-brand-light)" : "transparent",
    color: active ? "var(--color-brand)" : "var(--color-text-subtle)",
    cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* Section header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-subtle)",
          }}
        >
          {sectionLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* What-If button */}
          <button
            onClick={() => {
              setWhatIfMode(!whatIfMode);
              if (whatIfMode) setDeltas({});
            }}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${whatIfMode ? "var(--color-brand)" : "var(--color-border)"}`,
              background: whatIfMode ? "var(--color-brand-light)" : "transparent",
              color: whatIfMode ? "var(--color-brand)" : "var(--color-text-subtle)",
              cursor: "pointer",
            }}
          >
            {whatIfMode
              ? locale === "de"
                ? "What-If aktiv ✦"
                : "What-If active ✦"
              : "What-If"}
          </button>
          {/* Grid/Nodes toggle */}
          <button onClick={() => setView("grid")} style={viewToggleStyle(view === "grid")}>
            ⊞
          </button>
          <button onClick={() => setView("nodes")} style={viewToggleStyle(view === "nodes")}>
            ◉
          </button>
        </div>
      </div>

      {/* Critical tension box */}
      {data.criticalTension && (
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            marginBottom: 12,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 13, color: "#D97706", flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
            {data.criticalTension}
          </span>
        </div>
      )}

      {/* Grid view */}
      {view === "grid" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {perspectives.map((p, index) => (
            <PerspectiveCard
              key={p.id}
              p={p}
              index={index}
              locale={locale}
              perspectives={perspectives}
              deltas={deltas}
              whatIfMode={whatIfMode}
              expanded={expanded}
              ratings={ratings}
              onExpand={handleExpand}
              onDeltaChange={handleDeltaChange}
              onRatingClick={handleRating}
            />
          ))}
        </div>
      )}

      {/* Node view */}
      {view === "nodes" && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-surface)",
            overflow: "hidden",
          }}
        >
          <NodeView
            perspectives={perspectives}
            deltas={deltas}
            whatIfMode={whatIfMode}
            overallReadiness={data.overallReadiness ?? 0}
            locale={locale}
          />
        </div>
      )}

      {/* Overall readiness bar */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            flexShrink: 0,
          }}
        >
          {locale === "de" ? "Gesamtbewertung" : "Overall Readiness"}
        </span>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: "var(--color-border)",
          }}
        >
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: overallBarColor,
              width: `${overallPct}%`,
              transition: "width 0.3s",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: overallBarColor,
            flexShrink: 0,
          }}
        >
          {overallPct}%
        </span>
      </div>
    </div>
  );
}
