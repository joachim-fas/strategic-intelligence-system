"use client";

import { useState, useCallback } from "react";
import { TrendDot, DEFAULT_QUADRANTS, Ring } from "@/types";
import { dummyTrends, dummyConfig } from "./dummy-data";

export interface RadarInstance {
  id: string;
  name: string;
  description: string;
  quadrants: string[];
  trends: TrendDot[];
  scope: {
    categories?: string[];
    tags?: string[];
    trendTypes?: string[];
  };
  createdAt: string;
}

const DEFAULT_RADAR: RadarInstance = {
  id: "default",
  name: "Tech Trends 2026",
  description: "Vollständige Technologie-Landschaft",
  quadrants: DEFAULT_QUADRANTS,
  trends: dummyTrends,
  scope: {},
  createdAt: new Date().toISOString(),
};

const PRESET_RADARS: Omit<RadarInstance, "trends" | "createdAt">[] = [
  {
    id: "ai-focus",
    name: "AI & Automation",
    description: "Künstliche Intelligenz, ML, Agents, Generative AI",
    quadrants: ["Foundation Models", "AI Tools", "AI Applications", "AI Infrastructure"],
    scope: { tags: ["ai", "automation", "llm", "agents", "generative", "machine-learning"] },
  },
  {
    id: "sustainability",
    name: "Sustainability & Climate",
    description: "Nachhaltigkeit, Klimawandel, Energie, Circular Economy",
    quadrants: ["Energy", "Circular Economy", "Green Tech", "Policy & Governance"],
    scope: { tags: ["sustainability", "climate", "energy", "green", "circular", "esg"] },
  },
  {
    id: "digital-transformation",
    name: "Digital Transformation",
    description: "Cloud, Data, Cybersecurity, Platform Economy",
    quadrants: ["Cloud & Infrastructure", "Data & Analytics", "Security", "Platforms"],
    scope: { tags: ["digital", "cloud", "data", "security", "platform", "api"] },
  },
  {
    id: "society-work",
    name: "Society & Future of Work",
    description: "Arbeitswelt, Bildung, Gesundheit, Demografischer Wandel",
    quadrants: ["Work Models", "Education & Skills", "Health & Biotech", "Demographics"],
    scope: { tags: ["work", "education", "health", "demographics", "skills", "identity"] },
  },
];

function filterTrendsForScope(
  allTrends: TrendDot[],
  scope: RadarInstance["scope"]
): TrendDot[] {
  if (!scope.tags?.length && !scope.categories?.length && !scope.trendTypes?.length) {
    return allTrends;
  }

  return allTrends.filter((t) => {
    if (scope.categories?.length) {
      if (scope.categories.includes(t.category)) return true;
    }
    if (scope.tags?.length) {
      if (t.tags.some((tag) => scope.tags!.some((s) => tag.toLowerCase().includes(s)))) return true;
      if (scope.tags.some((s) => t.name.toLowerCase().includes(s))) return true;
    }
    if (scope.trendTypes?.length) {
      if (scope.trendTypes.includes(t.category)) return true;
    }
    return false;
  });
}

export function useRadarStore() {
  const [radars, setRadars] = useState<RadarInstance[]>([DEFAULT_RADAR]);
  const [activeRadarId, setActiveRadarId] = useState("default");

  const activeRadar = radars.find((r) => r.id === activeRadarId) || radars[0];

  const createRadar = useCallback(
    (presetId?: string) => {
      if (presetId) {
        const preset = PRESET_RADARS.find((p) => p.id === presetId);
        if (!preset) return;

        const allTrends = radars.find((r) => r.id === "default")?.trends || dummyTrends;
        const filteredTrends = filterTrendsForScope(allTrends, preset.scope);

        const newRadar: RadarInstance = {
          ...preset,
          trends: filteredTrends,
          createdAt: new Date().toISOString(),
        };

        setRadars((prev) => [...prev, newRadar]);
        setActiveRadarId(newRadar.id);
      }
    },
    [radars]
  );

  const updateRadarTrends = useCallback(
    (radarId: string, trends: TrendDot[]) => {
      setRadars((prev) =>
        prev.map((r) => {
          if (r.id !== radarId) return r;
          if (r.scope.tags?.length || r.scope.categories?.length) {
            return { ...r, trends: filterTrendsForScope(trends, r.scope) };
          }
          return { ...r, trends };
        })
      );
    },
    []
  );

  const updateTrendRing = useCallback(
    (trendId: string, newRing: Ring) => {
      setRadars((prev) =>
        prev.map((r) => {
          if (r.id !== activeRadarId) return r;
          return {
            ...r,
            trends: r.trends.map((t) =>
              t.id === trendId ? { ...t, ring: newRing, userOverride: true } : t
            ),
          };
        })
      );
    },
    [activeRadarId]
  );

  const deleteRadar = useCallback(
    (radarId: string) => {
      if (radarId === "default") return; // Can't delete default
      setRadars((prev) => prev.filter((r) => r.id !== radarId));
      if (activeRadarId === radarId) setActiveRadarId("default");
    },
    [activeRadarId]
  );

  return {
    radars,
    activeRadar,
    activeRadarId,
    setActiveRadarId,
    createRadar,
    updateRadarTrends,
    updateTrendRing,
    deleteRadar,
    presets: PRESET_RADARS,
  };
}
