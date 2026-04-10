/**
 * Reusable server-side auth guard for API route handlers.
 *
 * SECURITY: Uses NextAuth v5 `auth()` to validate the session against the
 * database. This is defense-in-depth — middleware already checks auth, but
 * route handlers should verify independently in case middleware is bypassed
 * (e.g., misconfigured matcher, direct internal calls).
 *
 * Usage in a route handler:
 *   import { requireAuth } from "@/lib/auth-guard";
 *
 *   export async function POST(req: Request) {
 *     const authResult = await requireAuth();
 *     if (!authResult.authorized) return authResult.response;
 *     const { userId, email, role } = authResult;
 *     // ... handle authenticated request
 *   }
 */

import { auth } from "@/lib/auth";

type AuthSuccess = {
  authorized: true;
  userId: string;
  email: string;
  role: string;
};

type AuthFailure = {
  authorized: false;
  response: Response;
};

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Validate the current session and return user info or a 401 response.
 *
 * SECURITY NOTES:
 * - Calls NextAuth v5 `auth()` which validates the session token against
 *   the database (not just cookie presence).
 * - Returns a pre-built 401 Response on failure so callers cannot forget
 *   to handle the unauthenticated case.
 * - Minimal error information — no session details leaked to unauthenticated users.
 */
export async function requireAuth(): Promise<AuthResult> {
  // DEV MODE: Skip auth — no email server for magic links in development
  if (process.env.NODE_ENV === "development") {
    return {
      authorized: true,
      userId: "dev-user",
      email: "dev@localhost",
      role: "admin",
    };
  }

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        authorized: false,
        response: new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        ),
      };
    }

    return {
      authorized: true,
      userId: session.user.id,
      email: session.user.email,
      role: (session.user as { role?: string }).role ?? "member",
    };
  } catch {
    // SECURITY: Do not leak internal errors to the client.
    // Log server-side for debugging but return a generic 401.
    console.error("[auth-guard] Session validation failed");
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }
}

/**
 * Require a specific role in addition to authentication.
 * Returns 403 Forbidden if the user is authenticated but lacks the required role.
 */
export async function requireRole(requiredRole: string): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult;

  if (authResult.role !== requiredRole && authResult.role !== "admin") {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return authResult;
}
