/**
 * Trend Clustering — Thematic grouping of mega/macro trends
 *
 * Groups 39 trends into 8 STEEP+V-aligned clusters.
 * Each trend belongs to exactly one primary cluster.
 * Clusters provide thematic context beyond ring/category grouping.
 */

import { TrendDot } from "@/types";
import { TREND_EDGES } from "./causal-graph";

// ── Types ────────────────────────────────────────────────────────────────────

export type SteepDimension = "S" | "T" | "E_env" | "E_eco" | "P" | "V";

export interface TrendCluster {
  id: string;
  name: string;
  nameDe: string;
  icon: string;
  color: string;
  steep: SteepDimension[];
  description: string;
  descriptionDe: string;
}

// ── Cluster Definitions ──────────────────────────────────────────────────────

export const TREND_CLUSTERS: TrendCluster[] = [
  {
    id: "digital",
    name: "AI & Digital Transformation",
    nameDe: "KI & Digitale Transformation",
    icon: "◈",
    color: "#7AB8F5",  // Volt Sky
    steep: ["T"],
    description: "The convergence of artificial intelligence, cloud infrastructure, and platform economics reshaping every industry.",
    descriptionDe: "Die Konvergenz von KI, Cloud-Infrastruktur und Plattformökonomie, die jede Branche umgestaltet.",
  },
  {
    id: "green",
    name: "Green Transformation",
    nameDe: "Grüne Transformation",
    icon: "🌱",
    color: "#6DDBA0",  // Volt Mint
    steep: ["E_env"],
    description: "Climate action, energy transition, and circular economy driving systemic change in production and consumption.",
    descriptionDe: "Klimaschutz, Energiewende und Kreislaufwirtschaft als systemische Veränderung von Produktion und Konsum.",
  },
  {
    id: "geopolitics",
    name: "Geopolitical Reordering",
    nameDe: "Geopolitische Neuordnung",
    icon: "🌐",
    color: "#D98AE8",  // Volt Orchid
    steep: ["P"],
    description: "Fragmentation of the global order, new governance models, and the tension between regulation and innovation.",
    descriptionDe: "Fragmentierung der Weltordnung, neue Governance-Modelle und die Spannung zwischen Regulierung und Innovation.",
  },
  {
    id: "work-society",
    name: "Work & Society",
    nameDe: "Arbeit & Gesellschaft",
    icon: "👥",
    color: "#F5C87A",  // Volt Amber
    steep: ["S"],
    description: "Demographic shifts, future of work, migration, and the changing social contract between individuals and institutions.",
    descriptionDe: "Demografischer Wandel, Zukunft der Arbeit, Migration und der sich verändernde Gesellschaftsvertrag.",
  },
  {
    id: "economy",
    name: "Economic Disruption",
    nameDe: "Wirtschaftliche Umbrüche",
    icon: "📊",
    color: "#F4A0B5",  // Volt Rose
    steep: ["E_eco"],
    description: "New economic models, decentralization, platform shifts, and the reshaping of global value chains.",
    descriptionDe: "Neue Wirtschaftsmodelle, Dezentralisierung, Plattform-Verschiebungen und die Neugestaltung globaler Wertschöpfungsketten.",
  },
  {
    id: "trust-values",
    name: "Trust & Values",
    nameDe: "Vertrauen & Werte",
    icon: "⚖",
    color: "#F0956A",  // Volt Peach
    steep: ["V"],
    description: "Erosion of institutional trust, polarization, identity shifts, and the struggle for shared values in fragmented societies.",
    descriptionDe: "Vertrauenserosion, Polarisierung, Identitätsverschiebungen und der Kampf um gemeinsame Werte in fragmentierten Gesellschaften.",
  },
  {
    id: "health-bio",
    name: "Health & Biosciences",
    nameDe: "Gesundheit & Biowissenschaften",
    icon: "🧬",
    color: "#5ECECE",  // Volt Aqua
    steep: ["S", "T"],
    description: "Biotech breakthroughs, digital health, genomics, and the expansion of human capabilities through science.",
    descriptionDe: "Biotech-Durchbrüche, digitale Gesundheit, Genomik und die Erweiterung menschlicher Fähigkeiten durch Wissenschaft.",
  },
  {
    id: "urban-mobility",
    name: "Urban Futures & Mobility",
    nameDe: "Urbane Zukunft & Mobilität",
    icon: "🏙",
    color: "#E8C840",  // Volt Yellow
    steep: ["S", "E_env"],
    description: "Smart cities, autonomous mobility, spatial computing, and the redesign of physical infrastructure for sustainability.",
    descriptionDe: "Smart Cities, autonome Mobilität, räumliches Computing und die Neugestaltung physischer Infrastruktur für Nachhaltigkeit.",
  },
];

// ── Trend → Cluster Mapping ──────────────────────────────────────────────────

export const TREND_CLUSTER_MAP: Record<string, string> = {
  // Cluster: digital (KI & Digitale Transformation)
  "mega-ai-transformation": "digital",
  "mega-technological-disruption": "digital",
  "mega-connectivity": "digital",
  "macro-generative-ai": "digital",
  "macro-ai-agents": "digital",
  "macro-human-machine": "digital",
  "macro-cloud-native": "digital",
  "macro-edge-iot": "digital",
  "macro-cybersecurity": "digital",
  "macro-quantum-computing": "digital",

  // Cluster: green (Grüne Transformation)
  "mega-climate-sustainability": "green",
  "mega-energy-transition": "green",
  "macro-green-energy": "green",
  "macro-circular-economy": "green",
  "macro-conscious-consumption": "green",

  // Cluster: geopolitics (Geopolitische Neuordnung)
  "mega-geopolitical-fracturing": "geopolitics",
  "mega-security-trust": "geopolitics",

  // Cluster: work-society (Arbeit & Gesellschaft)
  "mega-demographic-shift": "work-society",
  "mega-future-of-work": "work-society",
  "mega-social-instability": "work-society",
  "macro-remote-hybrid": "work-society",
  "macro-skills-upskilling": "work-society",
  "macro-attention-economy": "work-society",

  // Cluster: economy (Wirtschaftliche Umbrüche)
  "macro-data-economy": "economy",
  "macro-web3-decentralization": "economy",
  "macro-seamless-commerce": "economy",
  "macro-platform-economy": "economy",
  "macro-exponential-manufacturing": "economy",

  // Cluster: trust-values (Vertrauen & Werte)
  "mega-identity-values": "trust-values",
  "mega-knowledge-culture": "trust-values",

  // Cluster: health-bio (Gesundheit & Biowissenschaften)
  "mega-health-biotech": "health-bio",
  "macro-digital-health": "health-bio",
  "macro-genomics": "health-bio",
  "macro-engineered-evolution": "health-bio",

  // Cluster: urban-mobility (Urbane Zukunft & Mobilität)
  "mega-urbanization": "urban-mobility",
  "mega-mobility": "urban-mobility",
  "macro-spatial-computing": "urban-mobility",
  "macro-autonomous-mobility": "urban-mobility",
  "macro-smart-surroundings": "urban-mobility",
};

// ── Helper Functions ─────────────────────────────────────────────────────────

/** Get the cluster a trend belongs to */
export function getClusterForTrend(trendId: string): TrendCluster | null {
  const clusterId = TREND_CLUSTER_MAP[trendId];
  if (!clusterId) return null;
  return TREND_CLUSTERS.find((c) => c.id === clusterId) ?? null;
}

/** Get all trends that belong to a cluster */
export function getTrendsForCluster(clusterId: string, trends: TrendDot[]): TrendDot[] {
  const trendIds = Object.entries(TREND_CLUSTER_MAP)
    .filter(([, cid]) => cid === clusterId)
    .map(([tid]) => tid);
  return trends.filter((t) => trendIds.includes(t.id));
}

/** Get causal edges within a cluster */
export function getIntraClusterEdges(clusterId: string) {
  const trendIds = new Set(
    Object.entries(TREND_CLUSTER_MAP)
      .filter(([, cid]) => cid === clusterId)
      .map(([tid]) => tid)
  );
  return TREND_EDGES.filter((e) => trendIds.has(e.from) && trendIds.has(e.to));
}

/** Get causal edges between clusters */
export function getInterClusterEdges(clusterIdA: string, clusterIdB: string) {
  const idsA = new Set(
    Object.entries(TREND_CLUSTER_MAP)
      .filter(([, cid]) => cid === clusterIdA)
      .map(([tid]) => tid)
  );
  const idsB = new Set(
    Object.entries(TREND_CLUSTER_MAP)
      .filter(([, cid]) => cid === clusterIdB)
      .map(([tid]) => tid)
  );
  return TREND_EDGES.filter(
    (e) => (idsA.has(e.from) && idsB.has(e.to)) || (idsB.has(e.from) && idsA.has(e.to))
  );
}

/** Compute stats for a cluster */
export function getClusterStats(clusterId: string, trends: TrendDot[]) {
  const clusterTrends = getTrendsForCluster(clusterId, trends);
  if (clusterTrends.length === 0) return null;

  const avgRelevance = clusterTrends.reduce((s, t) => s + t.relevance, 0) / clusterTrends.length;
  const avgImpact = clusterTrends.reduce((s, t) => s + t.impact, 0) / clusterTrends.length;
  const risingCount = clusterTrends.filter((t) => t.velocity === "rising").length;
  const intraEdges = getIntraClusterEdges(clusterId);

  const dominantVelocity: "rising" | "stable" | "falling" =
    risingCount > clusterTrends.length / 2
      ? "rising"
      : clusterTrends.filter((t) => t.velocity === "falling").length > clusterTrends.length / 2
      ? "falling"
      : "stable";

  return {
    count: clusterTrends.length,
    avgRelevance: Math.round(avgRelevance * 100),
    avgImpact: Math.round(avgImpact * 100),
    risingCount,
    dominantVelocity,
    intraEdgeCount: intraEdges.length,
    trends: clusterTrends,
    edges: intraEdges,
  };
}
