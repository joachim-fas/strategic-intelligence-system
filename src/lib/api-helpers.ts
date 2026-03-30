/**
 * Shared helpers for API route handlers.
 */

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
