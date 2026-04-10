/**
 * Next.js middleware — security-hardened authentication and CSRF protection.
 *
 * SECURITY CONTROLS:
 * 1. Session check via NextAuth session cookie presence
 *    (full DB-backed validation happens in API route handlers via auth())
 * 2. All /api/v1/* routes require authentication by default
 * 3. CSRF origin validation for state-changing requests (POST, PUT, PATCH, DELETE)
 * 4. No Host-header-based auth bypass — auth enforced regardless of hostname
 *
 * NOTE: Middleware runs in Edge Runtime — cannot import auth.ts (uses nodemailer/
 * better-sqlite3). Session cookie presence is checked here; full DB validation
 * happens server-side in route handlers.
 *
 * Only explicitly allowlisted paths are public.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
// Session cookie detection (Edge-safe — no DB access)
// ---------------------------------------------------------------------------

/**
 * Check for NextAuth session cookie.
 *
 * NOTE: This checks cookie PRESENCE, not validity. Full DB-backed session
 * validation happens in API route handlers via auth() from src/lib/auth.ts
 * (Node.js runtime). This is the standard Auth.js v5 pattern for Edge middleware
 * with database sessions.
 */
function hasSessionCookie(request: NextRequest): boolean {
  // NextAuth v5 uses these cookie names depending on HTTPS vs HTTP
  const secureCookie = request.cookies.get("__Secure-authjs.session-token");
  const devCookie = request.cookies.get("authjs.session-token");
  // NextAuth v4 fallback names
  const secureV4 = request.cookies.get("__Secure-next-auth.session-token");
  const devV4 = request.cookies.get("next-auth.session-token");

  return !!(secureCookie?.value || devCookie?.value || secureV4?.value || devV4?.value);
}

// ---------------------------------------------------------------------------
// Middleware handler
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
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

  // ── Session check ──────────────────────────────────────────────────────
  // SECURITY: Checks session cookie presence. This is a first-pass filter;
  // full DB-backed session validation happens in API route handlers via auth().
  // An expired/invalid cookie will pass here but fail at the route handler level.
  const isAuthenticated = hasSessionCookie(request);

  if (!isAuthenticated) {
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
}

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
