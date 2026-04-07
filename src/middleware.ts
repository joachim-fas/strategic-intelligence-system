/**
 * Next.js middleware — protects all routes except:
 * - /api/v1/cron (external cron endpoint, uses CRON_SECRET)
 * - /api/auth/* (NextAuth endpoints)
 * - /auth/* (sign-in / verify pages)
 * - /_next/* (static assets)
 * - /favicon.ico, etc.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // MVP mode: skip auth entirely for localhost development
  // To enable auth, remove this early return and uncomment the logic below
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  const publicPaths = [
    "/",              // FRAGEN — main intelligence terminal
    "/verstehen",     // VERSTEHEN — knowledge base (public read)
    "/briefing",      // Print-optimized briefing (shareable)
    "/api/auth",      // NextAuth endpoints
    "/auth",          // Sign-in pages
    "/api/v1/cron",   // External cron (validated by CRON_SECRET in the route)
    "/api/v1/query",  // LLM query endpoint
    "/api/v1/pipeline", // Pipeline endpoint
    "/api/v1/trends", // Trends endpoint (public read)
    "/api/v1/feed",   // Feed endpoint (public read)
    "/_next",         // Static assets
    "/favicon.ico",
    "/volt-ui.css",   // Design system CSS
    "/icons",         // SVG icons
  ];

  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return NextResponse.next();
  }

  // Check for session cookie (NextAuth v5 sets __Secure-authjs.session-token
  // in production and authjs.session-token in dev)
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("next-auth.session-token")?.value;

  if (!sessionToken) {
    // API routes return 401, pages redirect to sign-in
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
