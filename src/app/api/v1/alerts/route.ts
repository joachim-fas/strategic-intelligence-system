/**
 * GET /api/v1/alerts?nodeIds=a,b,c — batch alert counts for canvas nodes
 */
import { NextResponse } from "next/server";
import { getAlertCounts } from "@/lib/scenario-alerts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nodeIds = url.searchParams.get("nodeIds");
  if (!nodeIds) {
    return NextResponse.json({ error: "nodeIds required" }, { status: 400 });
  }
  const ids = nodeIds.split(",").filter(Boolean).slice(0, 100);
  const counts = getAlertCounts(ids);
  return NextResponse.json({ counts });
}
