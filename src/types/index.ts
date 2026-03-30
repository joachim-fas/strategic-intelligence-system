export type Ring = "adopt" | "trial" | "assess" | "hold";
export type TimeHorizon = "short" | "mid" | "long";
export type TrendStatus = "candidate" | "confirmed" | "archived";

export type SourceType =
  | "google_trends"
  | "hackernews"
  | "github"
  | "arxiv"
  | "news"
  | "reddit"
  | "stackoverflow"
  | "npm_pypi"
  | "producthunt"
  | "wikipedia";

// ─── Klassifizierung nach Dauer und Reichweite ──────────────────
export type TrendDuration = "hype" | "trend" | "megatrend";

// ─── Klassifizierung nach Art der Veraenderung ──────────────────
export type TrendDirection = "rising" | "stable" | "falling" | "cyclical";

// ─── Klassifizierung nach Fokus (Inhalt) ────────────────────────
export type TrendFocus =
  | "technology"    // Technologische Trends
  | "market"        // Markttrends
  | "society"       // Gesellschaftliche Trends
  | "environment"   // Oekologische Trends
  | "political"     // Politische/regulatorische Trends
  | "economic";     // Wirtschaftliche Trends

export interface TrendClassification {
  // 1. Dauer und Reichweite
  duration: TrendDuration;
  durationYears: string;        // z.B. "0-2", "3-10", "30+"

  // 2. Art der Veraenderung
  direction: TrendDirection;
  momentum: number;             // -1 bis +1, Staerke der Veraenderung

  // 3. Fokus/Inhalt (kann mehrere haben)
  focus: TrendFocus[];

  // 4. Analyse-Methode
  analysisMethod: ("quantitative" | "qualitative" | "visual")[];
}

export interface TrendDot {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  relevance: number;
  confidence: number;
  impact: number;
  timeHorizon: TimeHorizon;
  ring: Ring;
  quadrant: number;
  signalCount: number;
  topSources: string[];
  velocity: "rising" | "stable" | "falling";
  userOverride: boolean;
  // New: structured classification
  classification?: TrendClassification;
}

export interface RadarConfig {
  id: string;
  name: string;
  description?: string;
  quadrants: string[];
  sourceWeights: Record<SourceType, number>;
  dimensionWeights: {
    relevance: number;
    confidence: number;
    impact: number;
    recency: number;
  };
}

export const RING_LABELS: Record<Ring, string> = {
  adopt: "Adopt",
  trial: "Trial",
  assess: "Assess",
  hold: "Hold",
};

export const RING_COLORS: Record<Ring, string> = {
  adopt: "#22c55e",
  trial: "#3b82f6",
  assess: "#f59e0b",
  hold: "#6b7280",
};

export const TIME_HORIZON_COLORS: Record<TimeHorizon, string> = {
  short: "#ef4444",
  mid: "#3b82f6",
  long: "#8b5cf6",
};

export const DURATION_CONFIG: Record<TrendDuration, { label: { de: string; en: string }; color: string; icon: string }> = {
  hype: { label: { de: "Hype / Mode", en: "Hype / Fad" }, color: "#f97316", icon: "⚡" },
  trend: { label: { de: "Trend", en: "Trend" }, color: "#3b82f6", icon: "📈" },
  megatrend: { label: { de: "Megatrend", en: "Megatrend" }, color: "#8b5cf6", icon: "🌊" },
};

export const DIRECTION_CONFIG: Record<TrendDirection, { label: { de: string; en: string }; color: string; icon: string }> = {
  rising: { label: { de: "Aufwärtstrend", en: "Uptrend" }, color: "#22c55e", icon: "↗" },
  stable: { label: { de: "Seitwärtstrend", en: "Sideways" }, color: "#6b7280", icon: "→" },
  falling: { label: { de: "Abwärtstrend", en: "Downtrend" }, color: "#ef4444", icon: "↘" },
  cyclical: { label: { de: "Zyklustrend", en: "Cyclical" }, color: "#f59e0b", icon: "↻" },
};

export const FOCUS_CONFIG: Record<TrendFocus, { label: { de: string; en: string }; color: string; icon: string }> = {
  technology: { label: { de: "Technologisch", en: "Technology" }, color: "#3b82f6", icon: "💻" },
  market: { label: { de: "Markt", en: "Market" }, color: "#22c55e", icon: "📊" },
  society: { label: { de: "Gesellschaft", en: "Society" }, color: "#f59e0b", icon: "👥" },
  environment: { label: { de: "Ökologie", en: "Environment" }, color: "#10b981", icon: "🌿" },
  political: { label: { de: "Politik/Regulierung", en: "Political" }, color: "#6366f1", icon: "⚖️" },
  economic: { label: { de: "Wirtschaft", en: "Economic" }, color: "#ec4899", icon: "💰" },
};

export const DEFAULT_QUADRANTS = [
  "Technology & AI",
  "Business & Society",
  "Development & Engineering",
  "Data & Infrastructure",
];
