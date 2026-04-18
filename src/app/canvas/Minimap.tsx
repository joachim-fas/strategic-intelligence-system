/**
 * Minimap — the small pan-and-zoom overview that lives at the bottom-
 * right of the canvas. Shows every node as a single coloured dot on
 * a 160×90 canvas and the current viewport as a rectangle; clicking
 * a point jumps the main pan so the clicked spot becomes the center.
 *
 * Stateless — receives `nodes` + current pan/zoom/viewport dims as
 * props and emits `onNavigate(panX, panY)` back to the parent.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work.
 */

"use client";

import { NODE_COLORS } from "@/lib/colors";
import type { CanvasNode } from "./types";

const MINIMAP_W = 160;
const MINIMAP_H = 90;
// Node colors from central colors.ts — used in minimap, timeline, orbit.
// Exported so Timeline view in page.tsx can share the exact same palette.
export const NODE_MINIMAP_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_COLORS).map(([k, v]) => [k, v.color])
);

export function Minimap({ nodes, panX, panY, zoom, viewportW, viewportH, onNavigate, rightOffset }: {
  nodes: CanvasNode[];
  panX: number; panY: number; zoom: number;
  viewportW: number; viewportH: number;
  onNavigate: (panX: number, panY: number) => void;
  rightOffset: number;
}) {
  if (nodes.length === 0) return null;

  const PAD = 200;
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const maxX = Math.max(...xs) + PAD;
  const maxY = Math.max(...ys) + PAD;
  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);

  const scaleX = MINIMAP_W / contentW;
  const scaleY = MINIMAP_H / contentH;
  const scale = Math.min(scaleX, scaleY);

  const toMX = (cx: number) => (cx - minX) * scale;
  const toMY = (cy: number) => (cy - minY) * scale;

  const vpLeft = (-panX / zoom - minX) * scale;
  const vpTop = (-panY / zoom - minY) * scale;
  const vpW = (viewportW / zoom) * scale;
  const vpH = (viewportH / zoom) * scale;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasX = mx / scale + minX;
    const canvasY = my / scale + minY;
    onNavigate(-(canvasX - viewportW / zoom / 2) * zoom, -(canvasY - viewportH / zoom / 2) * zoom);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "absolute", bottom: 16, right: rightOffset,
        width: MINIMAP_W, height: MINIMAP_H,
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px) saturate(160%)",
        WebkitBackdropFilter: "blur(12px) saturate(160%)",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        zIndex: 40,
        cursor: "crosshair",
      }}
    >
      {nodes.map(n => (
        <div key={n.id} style={{
          position: "absolute",
          left: toMX(n.x), top: toMY(n.y),
          width: 4, height: 4,
          borderRadius: "50%",
          background: NODE_MINIMAP_COLOR[n.nodeType] ?? "#888",
        }} />
      ))}
      <div style={{
        position: "absolute",
        left: vpLeft, top: vpTop,
        width: Math.max(vpW, 8), height: Math.max(vpH, 8),
        border: "1.5px solid rgba(255,255,255,0.9)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
        borderRadius: 2,
        pointerEvents: "none",
      }} />
    </div>
  );
}
