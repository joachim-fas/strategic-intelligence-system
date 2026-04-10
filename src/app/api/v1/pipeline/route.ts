// TODO: ARC-06 — DUAL PIPELINE IMPLEMENTATIONS
// pipeline/route.ts: Promise.allSettled, parallel, stores in-memory
// pipeline.ts: for-loop (now with concurrency), stores in DB
// Completely different behavior depending on call path.
// FIX: Consolidate into one pipeline implementation.

import { NextResponse } from "next/server";
import { ensureEnvLoaded } from "@/lib/env";
import { connectors } from "@/connectors";

// Bootstrap .env.local for paths with spaces (e.g. "Meine Ablage")
ensureEnvLoaded();
import { processSignals } from "@/lib/scoring";
import { RawSignal } from "@/connectors/types";
import { megaTrends } from "@/lib/mega-trends";
import { TrendDot } from "@/types";

// WARNING: In-memory state — lost on serverless cold start. Consider persisting to DB.
let lastFetchResult: {
  trends: TrendDot[];
  signalCount: number;
  sources: string[];
  fetchedAt: string;
  errors: string[];
  duration: number;
} | null = null;

// Simple in-memory lock to prevent concurrent pipeline runs
let isRunning = false;

function mergeTrends(megaBase: TrendDot[], liveTrends: TrendDot[]): TrendDot[] {
  const merged = new Map<string, TrendDot>();
  for (const mt of megaBase) merged.set(mt.name.toLowerCase(), { ...mt });
  for (const lt of liveTrends) {
    const key = lt.name.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        signalCount: existing.signalCount + lt.signalCount,
        relevance: Math.min(1, existing.relevance * 0.6 + lt.relevance * 0.4),
        confidence: Math.min(1, existing.confidence * 0.6 + lt.confidence * 0.4 + 0.05),
        impact: Math.min(1, existing.impact * 0.6 + lt.impact * 0.4),
        velocity: lt.velocity === "rising" ? "rising" : existing.velocity,
        topSources: [...new Set([...existing.topSources, ...lt.topSources])].slice(0, 4),
      });
    } else {
      merged.set(key, lt);
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.relevance - a.relevance);
}

export async function POST() {
  if (isRunning) {
    return NextResponse.json(
      { success: false, error: { code: "CONFLICT", message: "Pipeline is already running", status: 409 } },
      { status: 409 }
    );
  }

  isRunning = true;
  try {
    const start = Date.now();
    const allSignals: RawSignal[] = [];
    const errors: string[] = [];
    const activeSources: string[] = [];

    const results = await Promise.allSettled(
      connectors.map(async (connector) => {
        try {
          const signals = await connector.fetchSignals();
          return { name: connector.name, signals };
        } catch (err) {
          throw new Error(`${connector.name}: ${err}`);
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allSignals.push(...result.value.signals);
        activeSources.push(result.value.name);
      } else {
        errors.push(String(result.reason));
      }
    }

    const liveTrends = processSignals(allSignals);
    const trends = mergeTrends(megaTrends, liveTrends);
    const duration = Date.now() - start;

    lastFetchResult = {
      trends,
      signalCount: allSignals.length,
      sources: activeSources,
      fetchedAt: new Date().toISOString(),
      errors,
      duration,
    };

    return NextResponse.json({
      success: true,
      trendCount: trends.length,
      signalCount: allSignals.length,
      sources: activeSources,
      errors,
      duration,
      fetchedAt: lastFetchResult.fetchedAt,
    });
  } finally {
    isRunning = false;
  }
}

export async function GET() {
  if (!lastFetchResult) {
    return NextResponse.json(
      { success: false, message: "POST to /api/v1/pipeline first" },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, ...lastFetchResult });
}
