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

// TODO: FE-13 / PERF-07 — 105+ manual useEffect+fetch patterns without caching.
// No deduplication, no stale-while-revalidate, no error recovery.
// FIX: Introduce SWR or TanStack Query as the standard data fetching layer.

// TODO: PERF-13 — No pagination on any GET endpoint. All results returned at once.
// FIX: Add cursor-based pagination with limit/offset to all list endpoints.


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

// ---------------------------------------------------------------------------
// FE-12: Cache-Control header presets for read-only API endpoints
// ---------------------------------------------------------------------------
export const CACHE_HEADERS = {
  /** Mutation endpoints or real-time data that must never be cached */
  none: { "Cache-Control": "no-store" },
  /** Frequently-changing data (signals, queries, user-specific): 60s TTL */
  short: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" },
  /** Semi-stable reference data (trends, frameworks, categories): 5min TTL */
  medium: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  /** Stable reference data (rarely changes): 1h TTL */
  long: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=300" },
} as const;

// ---------------------------------------------------------------------------
// API-06 + API-07: Standardized response envelope helpers
// ---------------------------------------------------------------------------

/**
 * Return a success response with a consistent `{ ok, data }` envelope.
 */
export function apiSuccess<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(
    { ok: true, data },
    { status, ...(headers ? { headers } : {}) },
  );
}

/**
 * Return an error response with a consistent `{ ok, error: { message, code } }` envelope.
 */
export function apiError(message: string, status = 500, code?: string) {
  return NextResponse.json(
    { ok: false, error: { message, ...(code ? { code } : {}) } },
    { status },
  );
}

/**
 * Require an authenticated session. Returns the session or a 401 response.
 */
export async function requireAuth() {
  // DEV MODE: Skip auth — no email server for magic links in development
  if (process.env.NODE_ENV === "development") {
    return {
      session: { user: { id: "dev-user", email: "dev@localhost", role: "admin" } },
      errorResponse: null,
    };
  }

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
