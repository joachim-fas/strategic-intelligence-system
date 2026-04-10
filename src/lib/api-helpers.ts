/**
 * Shared helpers for API route handlers.
 *
 * NOTE: Superseded by auth-guard.ts for auth. Consider consolidating.
 */

// TODO: EDGE-21 — All client-side fetch() calls should use AbortController with 30s timeout.
// Currently no fetch has a timeout, so a hanging server blocks the UI indefinitely.
// FIX: Create a fetchWithTimeout() utility and use it everywhere.

// TODO: FE-10 — Route handler patterns inconsistent across 34 API routes.
// Some use NextRequest/NextResponse, others use Request/Response.
// FIX: Create a standardized API handler wrapper with auth + error handling + response typing.

// TODO: FE-12 — Add Cache-Control headers to read-only API endpoints.
// Example: res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

// TODO: FE-13 / PERF-07 — 105+ manual useEffect+fetch patterns without caching.
// No deduplication, no stale-while-revalidate, no error recovery.
// FIX: Introduce SWR or TanStack Query as the standard data fetching layer.

// TODO: PERF-13 — No pagination on any GET endpoint. All results returned at once.
// FIX: Add cursor-based pagination with limit/offset to all list endpoints.

// TODO: API-06 — 6 different error envelope formats across API routes.
// TODO: API-07 — Response wrappers inconsistent ({data}, {canvases}, {projects}, raw arrays).
// FIX: Define standard envelope: { data, meta, error } and migrate all routes.

// TODO: API-09 — 3 different SSE parsing implementations (query, canvas, frameworks).
// Each has different bugs. FIX: Create shared SSE client utility with [DONE] handling + reconnect.

// TODO: API-19 — No OpenAPI/Swagger documentation for any API route.
// TODO: API-20 — No API versioning mechanism beyond /api/v1/ prefix.

// TODO: ARC-13 — src/lib/ has 36 files with no organization.
// No index.ts, no subdirectories, no server-only vs client-safe boundary.
// FIX: Organize into subdirectories: lib/db/, lib/scoring/, lib/connectors/, lib/auth/.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";

/**
 * Require an authenticated session. Returns the session or a 401 response.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { session, errorResponse: null };
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const raw = await request.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return {
        data: null,
        error: NextResponse.json(
          {
            error: "Validation error",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        ),
      };
    }
    return { data: parsed.data, error: null };
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}
