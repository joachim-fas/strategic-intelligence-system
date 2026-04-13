/**
 * GET  /api/v1/versions?nodeId=... — list versions for a canvas node
 * POST /api/v1/versions — save a new version (called by canvas after query completes)
 * GET  /api/v1/versions?nodeIds=a,b,c — batch version counts
 */
import { NextResponse } from "next/server";
import { saveQueryVersion, getVersionsForNode, getVersionCounts } from "@/lib/query-versions";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const nodeIds = url.searchParams.get("nodeIds");

  if (nodeIds) {
    const ids = nodeIds.split(",").filter(Boolean).slice(0, 100);
    const counts = getVersionCounts(ids);
    return apiSuccess({ counts }, 200, CACHE_HEADERS.short);
  }

  if (!nodeId) {
    return apiError("nodeId required", 400, "VALIDATION_ERROR");
  }

  const versions = getVersionsForNode(nodeId);
  return apiSuccess({ versions }, 200, CACHE_HEADERS.short);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { canvasNodeId, radarId, queryText, locale, result } = body;
    if (!canvasNodeId || !queryText || !result) {
      return apiError("Missing required fields", 400, "VALIDATION_ERROR");
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
    return apiSuccess({ id }, 201);
  } catch (err) {
    return apiError(String(err), 500);
  }
}
