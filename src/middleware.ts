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
  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  const publicPaths = [
    "/",             // Main CLI interface — always accessible
    "/api/auth",     // NextAuth endpoints
    "/auth",         // Sign-in pages
    "/api/v1/cron",  // External cron (validated by CRON_SECRET in the route)
    "/api/v1/query", // LLM query endpoint
    "/api/v1/pipeline", // Pipeline endpoint (for live data)
    "/api/v1/trends",   // Trends endpoint
    "/_next",        // Static assets
    "/favicon.ico",
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
