/**
 * GET /api/v1/monitor/stream — Server-Sent Events for live activity.
 *
 * Streams ActivityEvent objects from the server-side event bus to any
 * connected client (the fly-in ActivityPanel). Includes a 15s keepalive.
 *
 * No auth required — diagnostic data only, no secrets exposed.
 */

import { onActivity } from "@/lib/activity-bus";
import type { ActivityEvent } from "@/lib/activity-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // BUFFER-FLUSH PADDING (observed 2026-04): Next.js 15 dev server
      // holds back small initial SSE writes until ~2 KB accumulates or
      // several seconds elapse. A plain 13-byte ": connected\n\n" comment
      // was not enough, so EventSource.onopen never fired in the
      // ActivityPanel and the indicator stayed "Getrennt" forever.
      // SSE lines starting with ":" are ignored by clients (comments),
      // so padding the first chunk with 2 KB of colons is safe and
      // forces the dev server to flush immediately. Downstream proxies
      // / nginx already receive `X-Accel-Buffering: no`; this handles
      // the Node-level buffering that's only present in dev.
      const padding = ":" + " ".repeat(2048) + "\n";
      controller.enqueue(encoder.encode(padding));
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to activity events
      cleanup = onActivity((event: ActivityEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream was closed by client — ignore
        }
      });

      // Keepalive every 15s to prevent proxy/browser timeout
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          if (keepaliveInterval) clearInterval(keepaliveInterval);
        }
      }, 15_000);
    },

    cancel() {
      // Client disconnected — clean up listeners
      if (cleanup) cleanup();
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
