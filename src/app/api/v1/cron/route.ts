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
import { ensureEnvLoaded } from "@/lib/env";
import { runPipeline } from "@/lib/pipeline";

// .env.local may define CRON_SECRET — make sure it's loaded before the
// header comparison fires (the bootstrap only runs once per process).
ensureEnvLoaded();

export const maxDuration = 300; // 5 minutes max for Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET — required in production. In development we allow
  // loopback traffic (localhost / 127.0.0.1) without a secret so a plain
  // `curl http://localhost:3000/api/v1/cron` from the user's machine kicks
  // the pipeline for live-reload testing. Production (anything without
  // NODE_ENV=development) still fails closed.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isDev = process.env.NODE_ENV !== "production";
  const host = request.headers.get("host") ?? "";
  const isLoopback = isDev && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const authOk = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!authOk && !isLoopback) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
