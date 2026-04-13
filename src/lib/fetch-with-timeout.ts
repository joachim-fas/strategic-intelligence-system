/**
 * Client-safe fetch wrapper with automatic AbortController timeout.
 *
 * EDGE-21 — Prevents hanging UI when the server is unresponsive.
 * Default timeout: 30 seconds.
 *
 * Usage:
 *   import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
 *   const res = await fetchWithTimeout("/api/v1/foo");
 *   const res = await fetchWithTimeout("/api/v1/bar", { method: "POST", ... });
 *   const res = await fetchWithTimeout("/api/v1/baz", {}, 60_000); // custom 60s
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
