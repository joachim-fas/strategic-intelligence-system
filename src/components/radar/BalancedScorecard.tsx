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

// Volt UI Pastell-Palette — Baby Blue · Mint · Butter · Orchid
const PERSPECTIVE_COLORS = [
  { color: "var(--pastel-sky-text, #1A4A8A)", bg: "var(--pastel-sky, #D4E8FF)" },  // Baby Blue
  { color: "var(--pastel-mint-text, #0F6038)", bg: "var(--pastel-mint, #C3F4D3)" },  // Mint Green
  { color: "var(--pastel-butter-text, #7A5C00)", bg: "var(--pastel-butter, #FFF5BA)" },  // Butter Yellow
  { color: "var(--pastel-orchid-text, #7C1A9E)", bg: "#FDE2FF" },  // Soft Orchid
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
  uncertain: "var(--pastel-amber-text, #C8820A)",
};

// Node positions on 700×380 canvas — corners with breathing room
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  p1: { x: 160, y: 110 },
  p2: { x: 540, y: 110 },
  p3: { x: 160, y: 270 },
  p4: { x: 540, y: 270 },
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
  const trendColor = TREND_COLORS[p.trend] ?? "var(--volt-text-muted, #6B7280)";
  const deltaVal = deltas[p.id] ?? 0;
  const isExpanded = expanded === p.id;

  return (
    <div
      onClick={() => onExpand(p.id)}
      style={{
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
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
                      ? "var(--pastel-mint, #ECFDF5)"
                      : "var(--pastel-rose, #FEF2F2)"
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

  const NODE_R = 48; // circle radius
  const ARC_C = 2 * Math.PI * (NODE_R - 7); // circumference for progress ring

  return (
    <svg
      viewBox="0 0 700 380"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: 380, display: "block" }}
    >
      <defs>
        <marker id="arrow-pos" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="var(--signal-positive, #1A9E5A)" fillOpacity="0.7" />
        </marker>
        <marker id="arrow-neg" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="var(--signal-negative, #E8402A)" fillOpacity="0.7" />
        </marker>
      </defs>

      {/* Subtle background grid lines */}
      <line x1={350} y1={40} x2={350} y2={340} stroke="rgba(0,0,0,0.05)" strokeWidth={1} />
      <line x1={60} y1={190} x2={640} y2={190} stroke="rgba(0,0,0,0.05)" strokeWidth={1} />

      {/* Edges */}
      {edges.map((edge, i) => {
        const strokeColor = edge.impact > 0 ? "var(--signal-positive, #1A9E5A)" : "var(--signal-negative, #E8402A)";
        const sw = 1.5 + Math.abs(edge.impact) * 2.5;
        // Offset endpoints to node border
        const dx = edge.toPos.x - edge.fromPos.x;
        const dy = edge.toPos.y - edge.fromPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const x1 = edge.fromPos.x + (dx / dist) * (NODE_R + 4);
        const y1 = edge.fromPos.y + (dy / dist) * (NODE_R + 4);
        const x2 = edge.toPos.x - (dx / dist) * (NODE_R + 10);
        const y2 = edge.toPos.y - (dy / dist) * (NODE_R + 10);
        // Slight curve
        const qx = (x1 + x2) / 2 + (dy / dist) * 20 * (i % 2 === 0 ? 1 : -1);
        const qy = (y1 + y2) / 2 - (dx / dist) * 20 * (i % 2 === 0 ? 1 : -1);
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`}
            stroke={strokeColor}
            strokeOpacity={0.6 + Math.abs(edge.impact) * 0.3}
            strokeWidth={sw}
            strokeDasharray={edge.impact < 0 ? "6 4" : undefined}
            fill="none"
            markerEnd={`url(#arrow-${edge.impact > 0 ? "pos" : "neg"})`}
          />
        );
      })}

      {/* Center hub: overall readiness */}
      <circle cx={350} cy={190} r={36} fill="var(--volt-surface, #FFFFFF)" stroke="rgba(0,0,0,0.1)" strokeWidth={1.5} />
      <circle cx={350} cy={190} r={32} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4} />
      <circle
        cx={350} cy={190} r={32}
        fill="none"
        stroke={effectiveOverall > 0.6 ? "var(--signal-positive, #1A9E5A)" : effectiveOverall > 0.35 ? "var(--pastel-amber-text, #C8820A)" : "var(--signal-negative, #E8402A)"}
        strokeWidth={4}
        strokeDasharray={`${effectiveOverall * 201} 201`}
        strokeLinecap="round"
        transform="rotate(-90 350 190)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text x={350} y={184} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--volt-text-faint, #9CA3AF)" fontFamily="inherit">
        {centerLabel}
      </text>
      <text x={350} y={200} textAnchor="middle" dominantBaseline="middle" fontSize={20} fontWeight={800}
        fill={effectiveOverall > 0.6 ? "var(--signal-positive, #1A9E5A)" : effectiveOverall > 0.35 ? "var(--pastel-amber-text, #C8820A)" : "var(--signal-negative, #E8402A)"}
        fontFamily="inherit"
      >
        {overallPct}%
      </text>

      {/* Nodes */}
      {perspectives.map((p, index) => {
        const pos = NODE_POSITIONS[p.id] ?? { x: 350, y: 190 };
        const { color, bg } = getPerspectiveColor(index);
        const score = computedScore(p, perspectives, whatIfMode ? deltas : {});
        const pct = Math.round(score * 100);
        const trendIcon = TREND_ICONS[p.trend] ?? "?";
        const trendColor = TREND_COLORS[p.trend] ?? "var(--volt-text-muted, #6B7280)";
        // Label position: push outward from center
        const isLeft = pos.x < 350;
        const isTop = pos.y < 190;

        return (
          <g key={p.id}>
            {/* Node background circle */}
            <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={bg} stroke={color} strokeWidth={2} />
            {/* Progress ring track */}
            <circle cx={pos.x} cy={pos.y} r={NODE_R - 7} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.18} />
            {/* Progress ring fill */}
            <circle
              cx={pos.x} cy={pos.y} r={NODE_R - 7}
              fill="none" stroke={color} strokeWidth={5}
              strokeDasharray={`${score * ARC_C} ${ARC_C}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${pos.x} ${pos.y})`}
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
            {/* Score inside */}
            <text x={pos.x} y={pos.y - 4} textAnchor="middle" dominantBaseline="middle"
              fontSize={18} fontWeight={800} fill={color} fontFamily="inherit">
              {pct}%
            </text>
            {/* Trend icon */}
            <text x={pos.x} y={pos.y + 14} textAnchor="middle" dominantBaseline="middle"
              fontSize={12} fill={trendColor} fontFamily="inherit">
              {trendIcon}
            </text>

            {/* Label outside the circle */}
            <text
              x={isLeft ? pos.x - NODE_R - 10 : pos.x + NODE_R + 10}
              y={isTop ? pos.y - 12 : pos.y + 12}
              textAnchor={isLeft ? "end" : "start"}
              dominantBaseline="middle"
              fontSize={13} fontWeight={700} fill={color} fontFamily="inherit"
            >
              {p.label.split(" ").slice(0, 2).join(" ")}
            </text>
            {p.label.split(" ").length > 2 && (
              <text
                x={isLeft ? pos.x - NODE_R - 10 : pos.x + NODE_R + 10}
                y={isTop ? pos.y + 4 : pos.y + 28}
                textAnchor={isLeft ? "end" : "start"}
                dominantBaseline="middle"
                fontSize={13} fontWeight={700} fill={color} fontFamily="inherit"
              >
                {p.label.split(" ").slice(2).join(" ")}
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(20, 358)">
        <line x1={0} y1={4} x2={18} y2={4} stroke="var(--signal-positive, #1A9E5A)" strokeWidth={2} />
        <polygon points="16,1 16,7 22,4" fill="var(--signal-positive, #1A9E5A)" fillOpacity="0.7" />
        <text x={26} y={8} fontSize={10} fill="var(--volt-text-muted, #6B7280)" fontFamily="inherit">{locale === "de" ? "verstärkt" : "amplifies"}</text>
        <line x1={90} y1={4} x2={108} y2={4} stroke="var(--signal-negative, #E8402A)" strokeWidth={2} strokeDasharray="5 3" />
        <polygon points="106,1 106,7 112,4" fill="var(--signal-negative, #E8402A)" fillOpacity="0.7" />
        <text x={116} y={8} fontSize={10} fill="var(--volt-text-muted, #6B7280)" fontFamily="inherit">{locale === "de" ? "hemmt" : "dampens"}</text>
      </g>
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
            background: "var(--pastel-butter, #FFFBEB)",
            border: "1px solid var(--pastel-butter, #FDE68A)",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            marginBottom: 12,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--pastel-amber-text, #D97706)", flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 12, color: "var(--pastel-amber-text, #92400E)", lineHeight: 1.5 }}>
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
