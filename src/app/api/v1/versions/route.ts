/**
 * GET  /api/v1/versions?nodeId=... — list versions for a canvas node
 * POST /api/v1/versions — save a new version (called by canvas after query completes)
 * GET  /api/v1/versions?nodeIds=a,b,c — batch version counts
 */
import { NextResponse } from "next/server";
import { saveQueryVersion, getVersionsForNode, getVersionCounts } from "@/lib/query-versions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const nodeIds = url.searchParams.get("nodeIds");

  if (nodeIds) {
    const ids = nodeIds.split(",").filter(Boolean).slice(0, 100);
    const counts = getVersionCounts(ids);
    return NextResponse.json({ counts });
  }

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  }

  const versions = getVersionsForNode(nodeId);
  return NextResponse.json({ versions });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { canvasNodeId, radarId, queryText, locale, result } = body;
    if (!canvasNodeId || !queryText || !result) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const id = saveQueryVersion({
      canvasNodeId,
      radarId: radarId ?? null,
      queryText,
      locale: locale ?? "de",
      result,
      confidence: result.confidence ?? null,
      matchedTrendCount: Array.isArray(result.matchedTrends) ? result.matchedTrends.length : null,
      signalCount: Array.isArray(result.usedSignals) ? result.usedSignals.length : null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
