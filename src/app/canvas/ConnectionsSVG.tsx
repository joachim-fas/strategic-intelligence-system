/**
 * ConnectionsSVG — renders the entire edge layer of the canvas
 * (pipeline arrows, derived-from arrows, user-drawn semantic edges).
 *
 * Computes anchor points from each connection's endpoint nodes,
 * applies density-adaptive + zoom-adaptive opacity so a 50-edge
 * canvas stays readable while a 5-edge canvas looks deliberate, and
 * fades edges whose endpoints are filtered out by the active tag or
 * group filter.
 *
 * Receives its host state (nodes/connections + selection + filter
 * state + render mode) as props; owns no state of its own.
 *
 * Extracted from `page.tsx` as the next slice after the seed-data
 * extraction (2026-04-18, audit A5-H7).
 */

"use client";

import { useMemo } from "react";
import { getNodeHeight, getNodeWidth } from "./utils";
import type { CanvasNode, Connection } from "./types";

// ── ConnectionsSVG ────────────────────────────────────────────────────────

export function ConnectionsSVG({ nodes, connections, pipelineChain, selectedId: selId, zoom, activeTagFilter, nodeTagMap, nodeGroupMap, connVisMode, de }: {
  nodes: CanvasNode[]; connections: Connection[]; pipelineChain?: Set<string>; selectedId?: string | null;
  zoom: number; activeTagFilter: string | null; nodeTagMap: Map<string, string[]>; nodeGroupMap: Map<string, string>; connVisMode: "auto" | "show" | "hide"; de: boolean;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Pre-compute direct edges from selected node (once, before map loop)
  const directEdges = useMemo(() => {
    const set = new Set<string>();
    if (selId) {
      connections.forEach(c => {
        if (c.from === selId || c.to === selId) set.add(`${c.from}-${c.to}`);
      });
    }
    return set;
  }, [selId, connections]);

  // Density-adaptive base opacity — few connections stay clearly readable,
  // large meshes (50+) fade to background so cards dominate.
  const density = connections.length <= 20 ? "low"
    : connections.length <= 50 ? "med"
    : "high";

  // Zoom-adaptive dampening factor — keep floor at 0.55 so lines stay readable
  // at typical zoom (50–70%). Only very zoomed-out views fade further.
  const zoomFactor = zoom >= 0.8 ? 1.0
    : zoom >= 0.5 ? 0.75 + (zoom - 0.5) / 0.3 * 0.25
    : zoom >= 0.3 ? 0.55 + (zoom - 0.3) / 0.2 * 0.20
    : 0.3;

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <marker id="arr-q" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#64748B" />
        </marker>
        <marker id="arr-d" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#64748B" />
        </marker>
        <marker id="arr-r" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#F5A62388" />
        </marker>
        <marker id="arr-builds" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#1A9E5A" />
        </marker>
        <marker id="arr-contradicts" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#E8402A" />
        </marker>
        <marker id="arr-validates" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#2563EB" />
        </marker>
      </defs>
      {connections.map(c => {
        const from = nodeMap.get(c.from);
        const to = nodeMap.get(c.to);
        if (!from || !to) return null;

        const x1 = from.x + getNodeWidth(from);
        const y1 = from.y + getNodeHeight(from) / 2;
        const x2 = to.x;
        const y2 = to.y + getNodeHeight(to) / 2;
        const cp = Math.min(Math.abs(x2 - x1) * 0.45, 120);

        // Density-adaptive base opacity — high density needs lower baseline
        // so 70+ connections don't turn the canvas into moiré. Low density
        // (this project has 10) keeps lines clearly readable by default.
        const baseByDensity = density === "high"
          ? { direct: 1.0, chain: 0.55, orphan: 0.08, sameGroup: 0.30, crossGroup: 0.18 }
          : density === "med"
          ? { direct: 1.0, chain: 0.65, orphan: 0.15, sameGroup: 0.50, crossGroup: 0.35 }
          : { direct: 1.0, chain: 0.75, orphan: 0.30, sameGroup: 0.70, crossGroup: 0.55 };

        // 4-tier opacity: direct edge (strongest), pipeline-chain, orphan, default by group
        let baseOpacity: number;
        if (selId) {
          const isDirect = directEdges.has(`${c.from}-${c.to}`);
          const inChain = pipelineChain?.has(c.from) || pipelineChain?.has(c.to);
          baseOpacity = isDirect ? baseByDensity.direct : inChain ? baseByDensity.chain : baseByDensity.orphan;
        } else if (pipelineChain && (pipelineChain.has(c.from) || pipelineChain.has(c.to))) {
          // Pipeline chain is highlighted even without selection — derivation flow stays visible
          baseOpacity = baseByDensity.chain;
        } else {
          const sameGroup = nodeGroupMap.get(c.from) && nodeGroupMap.get(c.from) === nodeGroupMap.get(c.to);
          baseOpacity = sameGroup ? baseByDensity.sameGroup : baseByDensity.crossGroup;
        }

        // Tag-filter propagation to connections
        if (activeTagFilter) {
          const fromOk = (nodeTagMap.get(c.from) ?? []).includes(activeTagFilter);
          const toOk = (nodeTagMap.get(c.to) ?? []).includes(activeTagFilter);
          if (!fromOk && !toOk) baseOpacity = 0;
          else if (!fromOk || !toOk) baseOpacity = 0.06;
        }

        // Apply zoom dampening + visibility mode
        const finalOpacity = connVisMode === "hide" ? 0
          : connVisMode === "show" ? Math.max(baseOpacity, 0.65)
          : baseOpacity * zoomFactor;

        if (finalOpacity <= 0.02) return null;

        // Connection type colors — coherent semantic palette:
        //   derived  → slate (neutral flow, the most common type, stays calm)
        //   refreshed → amber (temporal re-run)
        //   builds-on → emerald (positive support)
        //   contradicts → red (conflict)
        //   validates → blue (confirmation)
        const ct = c.connectionType;
        const CONN_STYLES: Record<string, { stroke: string; dash: string; width: number; marker: string; label: string; labelColor: string }> = {
          "derived":      { stroke: "#64748B", dash: "",    width: 1.4, marker: "url(#arr-d)",          label: "",                             labelColor: "" },
          "refreshed":    { stroke: "#F5A623", dash: "6 4", width: 1.2, marker: "url(#arr-r)",          label: "↻",                            labelColor: "#F5A623" },
          "builds-on":    { stroke: "#1A9E5A", dash: "",    width: 2.0, marker: "url(#arr-builds)",     label: de ? "baut auf" : "builds on",  labelColor: "#1A9E5A" },
          "contradicts":  { stroke: "#E8402A", dash: "3 2", width: 1.8, marker: "url(#arr-contradicts)",label: de ? "widerspricht" : "contradicts", labelColor: "#E8402A" },
          "validates":    { stroke: "#2563EB", dash: "",    width: 1.8, marker: "url(#arr-validates)",  label: de ? "bestätigt" : "validates", labelColor: "#2563EB" },
        };

        const cStyle = ct ? CONN_STYLES[ct] ?? CONN_STYLES.derived
          : c.refreshed ? CONN_STYLES.refreshed
          : c.derived   ? CONN_STYLES.derived
          : { stroke: "#64748B", dash: "", width: 1.4, marker: "url(#arr-q)", label: "", labelColor: "" };

        // Semantic (non-derived) connections get higher minimum opacity — they carry argumentative weight
        const isSemanticType = ct && ct !== "derived";
        // Parent→child derivation edges (QUERY → insights/scenarios/decisions/causalgraph/…)
        // are the backbone of the derivation tree. Even in dense canvases they must
        // stay readable, otherwise the "where did this come from" story is lost.
        const isQueryChildEdge = from.nodeType === "query" && to.parentId === from.id;
        let effectiveOpacity = isSemanticType ? Math.max(finalOpacity, 0.5) : finalOpacity;
        if (isQueryChildEdge && connVisMode !== "hide") {
          effectiveOpacity = Math.max(effectiveOpacity, 0.38);
        }

        // Midpoint for label positioning (on the Bézier curve at t=0.5)
        const mx = 0.125 * x1 + 0.375 * (x1 + cp) + 0.375 * (x2 - cp) + 0.125 * x2;
        const my = 0.125 * y1 + 0.375 * y1 + 0.375 * y2 + 0.125 * y2;
        const showLabel = cStyle.label && effectiveOpacity > 0.2 && zoom >= 0.5;

        return (
          <g key={`${c.from}-${c.to}`}>
            <path
              d={`M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`}
              fill="none" stroke={cStyle.stroke} strokeWidth={cStyle.width} strokeLinecap="round"
              strokeDasharray={cStyle.dash || "none"}
              markerEnd={cStyle.marker} opacity={effectiveOpacity}
              style={{ transition: "opacity 0.2s" }}
            />
            {showLabel && (
              <text x={mx} y={my - 6} textAnchor="middle" fill={cStyle.labelColor} opacity={Math.min(effectiveOpacity + 0.2, 1)} fontSize={9} fontWeight={600} fontFamily="var(--font-code, 'JetBrains Mono'), monospace" style={{ pointerEvents: "none" }}>
                {cStyle.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
