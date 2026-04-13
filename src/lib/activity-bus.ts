/**
 * activity-bus.ts — Server-side event bus for live activity streaming.
 *
 * Uses a global singleton EventEmitter so all API routes (query, pipeline, etc.)
 * can emit events that the SSE endpoint picks up and streams to the client.
 *
 * IMPORTANT: Server-side only — never import from client components.
 */

import { EventEmitter } from "events";

/** Shape of every activity event flowing through the bus */
export interface ActivityEvent {
  id: string;
  type: "query" | "pipeline" | "system";
  phase: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

// ── Global singleton (survives Next.js hot-reload) ────────────────────────
const GLOBAL_KEY = "__sis_activity_bus__";

function getBus(): EventEmitter {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    const bus = new EventEmitter();
    bus.setMaxListeners(50); // allow many concurrent SSE connections
    g[GLOBAL_KEY] = bus;
  }
  return g[GLOBAL_KEY] as EventEmitter;
}

/**
 * Emit an activity event from any server-side code.
 * Auto-generates id and timestamp.
 */
export function emitActivity(
  event: Omit<ActivityEvent, "id" | "timestamp">
): void {
  const full: ActivityEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  getBus().emit("activity", full);
}

/**
 * Subscribe to activity events. Returns an unsubscribe function.
 * Used by the SSE stream endpoint.
 */
export function onActivity(
  handler: (event: ActivityEvent) => void
): () => void {
  getBus().on("activity", handler);
  return () => {
    getBus().off("activity", handler);
  };
}
