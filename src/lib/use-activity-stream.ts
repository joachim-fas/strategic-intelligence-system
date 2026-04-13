/**
 * useActivityStream — Client-side React hook for live activity events.
 *
 * Opens an EventSource to /api/v1/monitor/stream when `enabled` is true.
 * Returns the event list, connection status, and a clear function.
 *
 * IMPORTANT: Client-side only — uses "use client" directive.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/** Mirror of the server-side ActivityEvent shape */
export interface ActivityEvent {
  id: string;
  type: "query" | "pipeline" | "system";
  phase: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const MAX_EVENTS = 100;

export function useActivityStream(enabled: boolean) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setConnected(false);
      }
      return;
    }

    const es = new EventSource("/api/v1/monitor/stream");
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as ActivityEvent;
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // Ignore malformed messages (keepalive comments, etc.)
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects — no manual retry needed
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}
