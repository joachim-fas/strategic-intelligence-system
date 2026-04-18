/**
 * Persistence — canvas-state localStorage helpers.
 *
 *   - `saveToStorage` filters out in-flight query nodes (loading /
 *     streaming) before serializing so a mid-refresh doesn't rehydrate
 *     a half-finished analysis. If the quota is exceeded it retries
 *     once after clearing the legacy `sis-canvas-history` key.
 *   - `loadFromStorage` only accepts the current schema version (v2)
 *     and returns null for anything older or corrupt, letting the
 *     caller fall back to a fresh canvas.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work.
 */

"use client";

import { STORAGE_KEY } from "./constants";
import type { CanvasNode, Connection } from "./types";

export function saveToStorage(nodes: CanvasNode[], conns: Connection[], pan: { x: number; y: number }, zoom: number) {
  try {
    const saveable = nodes.filter(n =>
      n.nodeType !== "query" || (n.status === "done" || n.status === "error")
    );
    const value = JSON.stringify({ nodes: saveable, conns, pan, zoom, v: 2 });
    localStorage.setItem(STORAGE_KEY, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old data');
      try { localStorage.removeItem('sis-canvas-history'); localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, conns, pan, zoom, v: 2 })); } catch {}
    }
  }
}

export function loadFromStorage(): { nodes: CanvasNode[]; conns: Connection[]; pan: { x: number; y: number }; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== 2) return null;
    return { nodes: d.nodes, conns: d.conns ?? [], pan: d.pan, zoom: d.zoom };
  } catch { return null; }
}
