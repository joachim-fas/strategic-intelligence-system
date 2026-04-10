import { NextResponse } from "next/server";

// === Unified Error Envelope ===
export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export function apiSuccess<T>(data: T, status = 200, meta?: ApiResponse["meta"]): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, meta }, { status });
}

export function apiCreated<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function apiError(
  code: string,
  message: string,
  status: number
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: { code, message, status } },
    { status }
  );
}

// Common error responses
export function notFound(resource = "Resource"): NextResponse<ApiResponse<never>> {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

export function unauthorized(message = "Authentication required"): NextResponse<ApiResponse<never>> {
  return apiError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Access denied"): NextResponse<ApiResponse<never>> {
  return apiError("FORBIDDEN", message, 403);
}

export function badRequest(message: string): NextResponse<ApiResponse<never>> {
  return apiError("BAD_REQUEST", message, 400);
}

export function validationError(message: string): NextResponse<ApiResponse<never>> {
  return apiError("VALIDATION_ERROR", message, 422);
}

export function tooManyRequests(message = "Rate limit exceeded"): NextResponse<ApiResponse<never>> {
  return apiError("RATE_LIMITED", message, 429);
}

export function serverError(error: unknown): NextResponse<ApiResponse<never>> {
  // SECURITY: Never leak internal error details to client
  const message = "An internal error occurred";
  console.error("[API Error]", error instanceof Error ? error.message : error);
  return apiError("INTERNAL_ERROR", message, 500);
}

// === Rate Limiting (simple in-memory) ===
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= maxRequests) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

// Cleanup stale entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }, 60_000);
}

// TODO: SEC-19 — Add sanitizeConnectorResponse() to validate/sanitize all connector API responses (strip HTML from titles, validate URLs, limit string lengths)

// === Safe error logging (strips sensitive data) ===
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove API keys from query params
    const sensitiveParams = ["key", "apiKey", "api_key", "token", "access_token", "secret"];
    for (const param of sensitiveParams) {
      if (u.searchParams.has(param)) {
        u.searchParams.set(param, "[REDACTED]");
      }
    }
    return u.toString();
  } catch {
    return "[INVALID_URL]";
  }
}
