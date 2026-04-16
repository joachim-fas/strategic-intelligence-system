/**
 * Shared helpers for API route handlers.
 *
 * NOTE: Superseded by auth-guard.ts for auth. Consider consolidating.
 */

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
    // Ensure the dev-user row exists so routes that INSERT with a FK to
    // users.id (radars.owner_id, tenant_audit_log.actor_user_id, etc.)
    // don't fail on first use in a fresh DB.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSqliteHandle } = require("@/db");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ensureDevUser } = require("@/db/sqlite-helpers");
      ensureDevUser(getSqliteHandle());
    } catch { /* DB not ready — caller will surface any real error */ }
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

// ---------------------------------------------------------------------------
// Multi-tenant auth helpers
// ---------------------------------------------------------------------------

/** Pro-Tenant Rolle, wie sie in tenant_memberships.role gespeichert ist. */
export type TenantRole = "owner" | "admin" | "member" | "viewer";

const TENANT_ROLE_RANK: Record<TenantRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

/** Minimal-Shape eines Memberships, wie es die Session liefert. */
export interface TenantMembershipLite {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
}

export interface TenantContext {
  /** Auth-Session User (id, email, role = system-rolle). */
  user: {
    id: string;
    email: string;
    role: string; // "admin" | "member" = system-rolle
  };
  /** ID des aktiven Tenants fuer diesen Request. */
  tenantId: string;
  /** Rolle des Users in diesem Tenant. */
  role: TenantRole;
  /** Alle Memberships des Users — nuetzlich fuer Switcher + UI-Gates. */
  memberships: TenantMembershipLite[];
  /** Bei Fehler ein fertig-gerenderter NextResponse, sonst null. */
  errorResponse: NextResponse | null;
}

/**
 * Fordert einen gueltigen Tenant-Scope fuer den Request.
 *
 * Resolution-Reihenfolge fuer den aktiven Tenant:
 *   1. Header `X-Tenant-Id` (Client hat explizit gewaehlt)
 *   2. Query-Param `?tenant=<id>` (Legacy / direkte Links)
 *   3. Session-Default `session.user.activeTenantId` (persistierter Wert aus
 *      users.last_active_tenant_id, gepflegt durch /api/v1/auth/switch-tenant)
 *
 * In allen Faellen MUSS der User Membership in dem gewuenschten Tenant haben,
 * sonst 403. In der Dev-Mode-Umgebung (NODE_ENV=development) wird auf den
 * Default-Tenant mit Rolle "owner" zurueckgefallen, damit lokale Entwicklung
 * ohne Login weiterhin funktioniert.
 */
export async function requireTenantContext(request?: Request): Promise<TenantContext> {
  // ── Dev-Mode-Bypass (gleiches Verhalten wie requireAuth) ────────────
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSqliteHandle } = require("@/db");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDefaultTenantId, ensureDevUser, DEV_USER_ID, DEV_USER_EMAIL } = require("@/db/sqlite-helpers");
    let tenantId: string;
    let userId: string = DEV_USER_ID;
    try {
      const db = getSqliteHandle();
      tenantId = getDefaultTenantId(db);
      // Materialise the dev-user row on first hit so INSERTs with
      // owner_id / actor_user_id FKs to users.id don't fail. Cheap +
      // idempotent.
      userId = ensureDevUser(db);
    } catch {
      // Falls DB in manchen Pfaden (z.B. Edge) nicht verfuegbar ist —
      // Request bleibt ohne Tenant. Die Routes sollten das nicht treffen.
      tenantId = "default-dev-tenant";
    }
    return {
      user: { id: userId, email: DEV_USER_EMAIL, role: "admin" },
      tenantId,
      role: "owner",
      memberships: [{ id: tenantId, name: "Default Workspace", slug: "default", role: "owner" }],
      errorResponse: null,
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return emptyTenantContextWithError(
      NextResponse.json({ ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 }),
    );
  }

  // Der SQLite-Adapter + Session-Callback liefert diese Felder (siehe
  // src/lib/auth.ts: enrichUser und src/lib/auth.config.ts). Bei JWT-
  // basierten Sessions koennte `tenants` fehlen — defensiv handeln.
  const user = session.user as unknown as {
    id: string;
    email: string;
    role: string;
    tenants?: TenantMembershipLite[];
    activeTenantId?: string | null;
  };
  const memberships: TenantMembershipLite[] = Array.isArray(user.tenants) ? user.tenants : [];

  if (memberships.length === 0) {
    return emptyTenantContextWithError(
      NextResponse.json(
        { ok: false, error: { message: "No tenant memberships", code: "NO_TENANT_MEMBERSHIPS" } },
        { status: 403 },
      ),
    );
  }

  // Tenant-Auswahl: Header > Query-Param > Session-Default > erstes Membership
  const url = request ? new URL(request.url) : null;
  const headerTenant = request?.headers.get("x-tenant-id") ?? null;
  const queryTenant = url?.searchParams.get("tenant") ?? null;
  const sessionTenant = user.activeTenantId ?? null;
  const requestedTenantId = headerTenant || queryTenant || sessionTenant || memberships[0].id;

  const match = memberships.find((m) => m.id === requestedTenantId);
  if (!match) {
    return emptyTenantContextWithError(
      NextResponse.json(
        { ok: false, error: { message: "Tenant not authorized", code: "TENANT_NOT_AUTHORIZED" } },
        { status: 403 },
      ),
    );
  }

  return {
    user: { id: user.id, email: user.email, role: user.role ?? "member" },
    tenantId: match.id,
    role: match.role,
    memberships,
    errorResponse: null,
  };
}

/**
 * Ueberprueft, dass der aktuelle Request-Benutzer mindestens eine bestimmte
 * Rolle im aktiven Tenant hat. Baut auf requireTenantContext auf.
 *
 * Usage:
 *   const ctx = await requireTenantRole(request, "admin");
 *   if (ctx.errorResponse) return ctx.errorResponse;
 *   // ab hier ist ctx.role entweder "owner" oder "admin"
 */
export async function requireTenantRole(request: Request | undefined, minRole: TenantRole): Promise<TenantContext> {
  const ctx = await requireTenantContext(request);
  if (ctx.errorResponse) return ctx;
  if (TENANT_ROLE_RANK[ctx.role] < TENANT_ROLE_RANK[minRole]) {
    return {
      ...ctx,
      errorResponse: NextResponse.json(
        { ok: false, error: { message: "Insufficient tenant role", code: "INSUFFICIENT_TENANT_ROLE", required: minRole, actual: ctx.role } },
        { status: 403 },
      ),
    };
  }
  return ctx;
}

/**
 * Fordert einen System-Admin (users.role = "admin") — orthogonal zu den
 * Tenant-Rollen. Verwendet fuer /api/v1/admin/tenants/* etc.
 */
export async function requireSystemAdmin(): Promise<{
  session: { user: { id: string; email: string; role: string } } | null;
  errorResponse: NextResponse | null;
}> {
  // Dev-Mode-Bypass — gleiche Logik wie requireAuth, aber immer "admin".
  if (process.env.NODE_ENV === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSqliteHandle } = require("@/db");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ensureDevUser } = require("@/db/sqlite-helpers");
      ensureDevUser(getSqliteHandle());
    } catch { /* DB not ready */ }
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
        { ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        { status: 401 },
      ),
    };
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { ok: false, error: { message: "System admin required", code: "FORBIDDEN" } },
        { status: 403 },
      ),
    };
  }
  return {
    session: {
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        role: (session.user as { role?: string }).role ?? "member",
      },
    },
    errorResponse: null,
  };
}

function emptyTenantContextWithError(errorResponse: NextResponse): TenantContext {
  return {
    user: { id: "", email: "", role: "member" },
    tenantId: "",
    role: "viewer",
    memberships: [],
    errorResponse,
  };
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
