import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

interface DbTrend {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  tags: string | null;
  status: string;
  agg_relevance: number | null;
  agg_confidence: number | null;
  agg_impact: number | null;
  time_horizon: string | null;
  metadata: string | null;
}

function getLocalDb() {
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET() {
  try {
    const db = getLocalDb();
    const rows = db.prepare("SELECT * FROM trends WHERE status != 'archived'").all() as DbTrend[];
    db.close();

    const trends = rows.map((row) => {
      const tags = row.tags ? JSON.parse(row.tags) : [];
      const meta = row.metadata ? JSON.parse(row.metadata) : {};

      return {
        id: row.id,
        name: row.name,
        description: row.description || "",
        category: row.category,
        tags,
        relevance: row.agg_relevance ?? 0.5,
        confidence: row.agg_confidence ?? 0.5,
        impact: row.agg_impact ?? 0.5,
        timeHorizon: row.time_horizon || "mid",
        ring: meta.ring || deriveRing(row.agg_relevance ?? 0.5, row.agg_confidence ?? 0.5),
        quadrant: meta.quadrant ?? 0,
        signalCount: meta.signalCount ?? 0,
        topSources: meta.topSources ?? [],
        velocity: meta.velocity || "stable",
        userOverride: false,
      };
    });

    return NextResponse.json({ trends, source: "sqlite", count: trends.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to read trends from DB:", message);
    return NextResponse.json({ trends: [], source: "error", error: message }, { status: 500 });
  }
}

function deriveRing(relevance: number, confidence: number): string {
  const score = (relevance + confidence) / 2;
  if (score >= 0.85) return "adopt";
  if (score >= 0.7) return "trial";
  if (score >= 0.5) return "assess";
  return "hold";
}
