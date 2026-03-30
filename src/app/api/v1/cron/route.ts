/**
 * GET /api/v1/cron
 *
 * External cron endpoint for Vercel Cron or any external scheduler.
 * Protected by CRON_SECRET header validation (not by session auth).
 *
 * Vercel Cron config goes in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/v1/cron",
 *     "schedule": "0 *\/6 * * *"
 *   }]
 * }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300; // 5 minutes max for Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runPipeline();

    return NextResponse.json({
      success: result.success,
      signalCount: result.signalCount,
      trendCount: result.trendCount,
      sources: result.sources,
      errors: result.errors,
      durationMs: result.durationMs,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error("[cron] Pipeline failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
