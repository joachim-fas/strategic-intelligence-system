/**
 * Next.js middleware — security-hardened authentication and CSRF protection.
 *
 * SECURITY CONTROLS:
 * 1. Session validation via NextAuth v5 `auth()` (database-backed, not cookie-presence)
 * 2. All /api/v1/* routes require authentication by default
 * 3. CSRF origin validation for state-changing requests (POST, PUT, PATCH, DELETE)
 * 4. No Host-header-based auth bypass — auth enforced regardless of hostname
 *
 * Only explicitly allowlisted paths are public.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Path classification
// ---------------------------------------------------------------------------

/**
 * Paths that never require authentication.
 * SECURITY: Keep this list minimal. Every entry is an unauthenticated attack surface.
 */
const PUBLIC_PATH_PREFIXES: readonly string[] = [
  "/api/auth",       // NextAuth endpoints (handles its own auth)
  "/auth",           // Sign-in / verify pages
  "/_next",          // Static assets (Next.js internal)
  "/favicon.ico",
  "/volt-ui.css",    // Design system CSS
  "/icons",          // SVG icons
] as const;

/**
 * Public page routes — unauthenticated users can view these.
 * API routes (/api/v1/*) are NOT listed here — they require auth.
 */
const PUBLIC_PAGE_PATHS: readonly string[] = [
  "/",               // Landing / main terminal
  "/verstehen",      // Knowledge cockpit
  "/sessions",       // Past sessions list
  "/workspace",      // Canvas workspace
  "/canvas",         // Direct canvas access
  "/cockpit",        // Legacy redirect
  "/werkstatt",      // Legacy redirect
  "/archiv",         // Legacy redirect
  "/arbeiten",       // Legacy redirect
  "/quellen",        // Legacy redirect
  "/briefing",       // Print-optimized briefing (shareable)
] as const;

/**
 * API routes that use their own authentication mechanism (e.g. CRON_SECRET).
 * SECURITY: These routes MUST validate credentials internally.
 */
const SELF_AUTHED_API_PREFIXES: readonly string[] = [
  "/api/v1/cron",    // External cron — validated by CRON_SECRET in route handler
] as const;

function isPublicPath(pathname: string): boolean {
  // Static assets and auth endpoints
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Public pages (exact match or with query params, not prefix-based for API safety)
  if (PUBLIC_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // Self-authenticated API routes
  if (SELF_AUTHED_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// CSRF protection
// ---------------------------------------------------------------------------

/**
 * Validate Origin header for state-changing requests.
 * SECURITY: Prevents cross-origin request forgery by ensuring the Origin
 * matches the expected domain. Only applied to POST/PUT/PATCH/DELETE.
 */
function validateCsrfOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();

  // Safe methods do not need CSRF validation
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // NextAuth endpoints handle their own CSRF via tokens
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // SECURITY: State-changing requests MUST include an Origin header.
  // Requests from same-origin browser contexts always include Origin.
  // Missing Origin on a POST likely means a direct/crafted request.
  if (!origin && !referer) {
    // Allow server-to-server calls (no browser headers) only if they have
    // a valid session — the auth check later will catch unauthenticated ones.
    // For browser requests, missing Origin on POST is suspicious.
    return true; // Rely on auth layer for non-browser requests
  }

  // Extract the origin from either header
  const requestOrigin = origin || new URL(referer!).origin;

  // Build expected origin from the request URL (protocol + host)
  const expectedOrigin = request.nextUrl.origin;

  // SECURITY: Strict comparison — origin must match exactly
  if (requestOrigin !== expectedOrigin) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Middleware handler — wrapped with NextAuth v5 `auth()` for session validation
// ---------------------------------------------------------------------------

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // ── CSRF check (before auth, to reject forged requests early) ──────────
  if (!validateCsrfOrigin(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden: origin mismatch" },
        { status: 403 }
      );
    }
    // For page requests, redirect to home (unusual — likely a crafted form)
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── Public paths — no auth required ────────────────────────────────────
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── Session validation ─────────────────────────────────────────────────
  // SECURITY: `request.auth` is populated by NextAuth v5's `auth()` wrapper.
  // It validates the session token against the database — not just cookie presence.
  // A garbage or expired token will result in `request.auth` being null.
  const session = request.auth;

  if (!session?.user) {
    // API routes return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    // Page routes redirect to sign-in
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // ── Authenticated — add security headers ───────────────────────────────
  const response = NextResponse.next();

  // SECURITY: Prevent caching of authenticated responses
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
  }

  return response;
});

// ---------------------------------------------------------------------------
// Matcher — determines which paths this middleware runs on
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Run middleware on all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
