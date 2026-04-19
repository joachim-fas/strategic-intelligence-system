/**
 * GET /api/v1/openapi.json — OpenAPI 3.1 spec (API-19).
 *
 * Unauthenticated, short-cache. Serves the hand-curated spec in
 * `src/lib/openapi-spec.ts`. Paste-compatible with Swagger UI,
 * Redoc, Postman import, Orval, openapi-typescript etc.
 *
 * The spec covers the most-integrator-relevant endpoints
 * (/health, /clusters/*, /forecasts/*). Internal admin routes are
 * deliberately out of scope — they're subject to change and not
 * meant for external integration.
 */

import { NextResponse } from "next/server";
import { OPENAPI_DOC } from "@/lib/openapi-spec";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(OPENAPI_DOC, {
    status: 200,
    headers: {
      // Short cache — the spec is essentially static but we might
      // update it on a release, so a 5-minute TTL is the right
      // balance between discoverability and freshness.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
