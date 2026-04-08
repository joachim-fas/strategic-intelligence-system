"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import * as d3 from "d3";
import { TrendDot, RING_COLORS, TIME_HORIZON_COLORS } from "@/types";
import { TREND_EDGES, TrendEdge } from "@/lib/causal-graph";
import { Locale } from "@/lib/i18n";

interface CausalGraphViewProps {
  trends: TrendDot[];
  onTrendClick: (trend: TrendDot) => void;
  locale: Locale;
  highlightTrendId?: string;
}

interface GraphNode {
  id: string;
  name: string;
  trend: TrendDot;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  edge: TrendEdge;
}

const EDGE_COLORS: Record<string, string> = {
  drives: "#1A9E5A",
  amplifies: "#1A4A8A",
  dampens: "#E8402A",
  correlates: "#C8820A",
};

const EDGE_LABELS: Record<string, Record<string, string>> = {
  drives: { de: "treibt", en: "drives" },
  amplifies: { de: "verstärkt", en: "amplifies" },
  dampens: { de: "dämpft", en: "dampens" },
  correlates: { de: "korreliert", en: "correlates" },
};

// Ring filter for the network — lets users focus on only the Adopt-ring
// subgraph, etc. "all" shows every trend. Otherwise we hide nodes that don't
// match the selected ring AND are not directly connected to one that does.
type RingFilter = "all" | "adopt" | "trial" | "assess" | "hold";
const RING_FILTER_LABELS: Record<RingFilter, { de: string; en: string; color: string }> = {
  all:    { de: "Alle",   en: "All",    color: "#0A0A0A" },
  adopt:  { de: "Adopt",  en: "Adopt",  color: "#1A9E5A" },
  trial:  { de: "Trial",  en: "Trial",  color: "#7AB8F5" },
  assess: { de: "Assess", en: "Assess", color: "#F5C87A" },
  hold:   { de: "Hold",   en: "Hold",   color: "#A8A8A8" },
};

export default function CausalGraphView({ trends, onTrendClick, locale, highlightTrendId }: CausalGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<TrendEdge | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(highlightTrendId || null);
  const [ringFilter, setRingFilter] = useState<RingFilter>("all");
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(400, width), height: Math.max(400, Math.min(700, width * 0.65)) });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const { width, height } = dimensions;

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const trendMap = new Map(trends.map((t) => [t.id, t]));

    // Ring filter: keep edges where EITHER endpoint matches the selected ring.
    // This shows the Adopt-subgraph plus its direct neighbors instead of a
    // disconnected island, which is more useful for strategic thinking.
    const matchesRingFilter = (id: string): boolean => {
      if (ringFilter === "all") return true;
      const t = trendMap.get(id);
      return t?.ring === ringFilter;
    };

    const nodeIds = new Set<string>();
    const links: GraphLink[] = [];
    for (const edge of TREND_EDGES) {
      if (!trendMap.has(edge.from) || !trendMap.has(edge.to)) continue;
      if (ringFilter !== "all") {
        if (!matchesRingFilter(edge.from) && !matchesRingFilter(edge.to)) continue;
      }
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
      links.push({ source: edge.from, target: edge.to, edge });
    }

    const nodes: GraphNode[] = [...nodeIds].map((id) => ({
      id,
      name: trendMap.get(id)!.name,
      trend: trendMap.get(id)!,
    }));

    if (nodes.length === 0) return;

    // Arrow markers
    const defs = svg.append("defs");
    for (const [type, color] of Object.entries(EDGE_COLORS)) {
      for (const opacity of ["full", "dim"]) {
        defs.append("marker")
          .attr("id", `arrow-${type}-${opacity}`)
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 25)
          .attr("refY", 0)
          .attr("markerWidth", 6)
          .attr("markerHeight", 6)
          .attr("orient", "auto")
          .append("path")
          .attr("fill", color)
          .attr("fill-opacity", opacity === "full" ? 1 : 0.15)
          .attr("d", "M0,-5L10,0L0,5");
      }
    }

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    (svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoom);

    // Force simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(140))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(45));

    // Helper: is this link connected to the focused node?
    const isConnected = (link: GraphLink) => {
      if (!focusedNode) return true;
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      return src === focusedNode || tgt === focusedNode;
    };

    const isNodeConnected = (nodeId: string) => {
      if (!focusedNode) return true;
      if (nodeId === focusedNode) return true;
      return links.some((l) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return (src === focusedNode && tgt === nodeId) || (tgt === focusedNode && src === nodeId);
      });
    };

    // Links
    const link = g.selectAll<SVGLineElement, GraphLink>(".link")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("stroke", (d) => EDGE_COLORS[d.edge.type])
      .attr("stroke-opacity", (d) => isConnected(d) ? d.edge.strength * 0.7 : 0.05)
      .attr("stroke-width", (d) => isConnected(d) ? 1.5 + d.edge.strength * 2.5 : 0.5)
      .attr("marker-end", (d) => `url(#arrow-${d.edge.type}-${isConnected(d) ? "full" : "dim"})`)
      .style("stroke-dasharray", (d) => d.edge.type === "dampens" ? "5,3" : "none")
      .style("cursor", "pointer")
      .on("mouseenter", (_event, d) => setHoveredEdge(d.edge))
      .on("mouseleave", () => setHoveredEdge(null));

    // Edge labels (on hover via CSS, always rendered but hidden)
    const edgeLabel = g.selectAll<SVGTextElement, GraphLink>(".edge-label")
      .data(links.filter((l) => isConnected(l)))
      .join("text")
      .attr("class", "edge-label")
      .attr("text-anchor", "middle")
      .attr("fill", (d) => EDGE_COLORS[d.edge.type])
      .attr("fill-opacity", 0.7)
      .attr("font-size", "8px")
      .text((d) => EDGE_LABELS[d.edge.type]?.[locale] || d.edge.type);

    // Nodes
    const node = g.selectAll<SVGGElement, GraphNode>(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .style("opacity", (d) => isNodeConnected(d.id) ? 1 : 0.15)
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d: any) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on("end", (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }) as any
      );

    // Node circles
    node.append("circle")
      .attr("r", (d) => 8 + d.trend.impact * 15)
      .attr("fill", (d) => TIME_HORIZON_COLORS[d.trend.timeHorizon])
      .attr("fill-opacity", (d) => 0.25 + d.trend.confidence * 0.45)
      .attr("stroke", (d) => d.id === focusedNode ? "var(--volt-text, #0A0A0A)" : RING_COLORS[d.trend.ring])
      .attr("stroke-width", (d) => d.id === focusedNode ? 2.5 : 1.5);

    // Glow for focused node
    if (focusedNode) {
      node.filter((d) => d.id === focusedNode)
        .append("circle")
        .attr("r", (d) => 12 + d.trend.impact * 15)
        .attr("fill", "none")
        .attr("stroke", "var(--volt-text, #0A0A0A)")
        .attr("stroke-opacity", 0.12)
        .attr("stroke-width", 2);
    }

    // Node labels — limit raised from 26 to 40 characters so names like
    // "Renewable Energy & Green Tech" are actually readable.
    node.append("text")
      .attr("dy", (d) => 12 + d.trend.impact * 15 + 4)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => d.id === focusedNode ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-muted, #6B6B6B)")
      .attr("font-size", (d) => d.id === focusedNode ? "11px" : "10px")
      .attr("font-weight", (d) => d.id === focusedNode ? "600" : "400")
      .text((d) => d.name.length > 40 ? d.name.slice(0, 38) + "…" : d.name);

    // Ring indicator
    node.append("text")
      .attr("dy", 3)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => RING_COLORS[d.trend.ring])
      .attr("font-size", "8px")
      .attr("font-weight", "bold")
      .text((d) => d.trend.ring.charAt(0).toUpperCase());

    // Click: toggle focus
    node.on("click", (_event, d) => {
      if (focusedNode === d.id) {
        setFocusedNode(null);
      } else {
        setFocusedNode(d.id);
      }
    });

    // Double-click: open detail panel
    node.on("dblclick", (_event, d) => {
      onTrendClick(d.trend);
    });

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      edgeLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 4);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
  }, [trends, focusedNode, width, height, locale, onTrendClick, ringFilter]);

  useEffect(() => { draw(); }, [draw]);

  // Stats
  const trendMap = new Map(trends.map((t) => [t.id, t]));
  const activeEdges = TREND_EDGES.filter((e) => trendMap.has(e.from) && trendMap.has(e.to));
  const connectedNodes = new Set(activeEdges.flatMap((e) => [e.from, e.to]));

  return (
    <div ref={containerRef} style={{ padding: "0 4px" }}>
      {/* Ring filter pills — primary interaction for focusing the subgraph */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: "var(--volt-text-faint, #999)",
          marginRight: 6,
        }}>
          {locale === "de" ? "Filter" : "Filter"}
        </span>
        {(Object.keys(RING_FILTER_LABELS) as RingFilter[]).map((r) => {
          const def = RING_FILTER_LABELS[r];
          const active = ringFilter === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRingFilter(r)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                border: active ? `1px solid ${def.color}` : "1px solid var(--volt-border, #E8E8E8)",
                background: active ? def.color : "var(--volt-surface-raised, #fff)",
                color: active ? "#fff" : "var(--volt-text-muted, #6B6B6B)",
                cursor: "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                transition: "all 120ms ease",
              }}
            >
              {r !== "all" && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: active ? "#fff" : def.color,
                }} />
              )}
              {locale === "de" ? def.de : def.en}
            </button>
          );
        })}

        {focusedNode && (
          <button
            onClick={() => setFocusedNode(null)}
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "var(--volt-text-muted, #6B6B6B)",
              background: "var(--volt-surface-raised, #fff)",
              border: "1px solid var(--volt-border, #E8E8E8)",
              borderRadius: 999,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            }}
          >
            {locale === "de" ? "Fokus zurücksetzen" : "Reset focus"} ✕
          </button>
        )}
      </div>

      {/* Edge-type legend + stats + interaction hint, compact row */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14,
        marginBottom: 12,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 10,
        color: "var(--volt-text-muted, #6B6B6B)",
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--volt-text-faint, #999)" }}>
          {connectedNodes.size} {locale === "de" ? "Nodes" : "Nodes"} · {activeEdges.length} Edges
        </span>
        <span style={{ width: 1, height: 12, background: "var(--volt-border, #E8E8E8)" }} />
        {Object.entries(EDGE_COLORS).map(([type, color]) => (
          <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 18, height: 2, borderRadius: 1, background: color,
              display: "inline-block",
              borderTop: type === "dampens" ? "none" : undefined,
              ...(type === "dampens" ? { height: 0, borderTop: `2px dashed ${color}` } : {}),
            }} />
            {EDGE_LABELS[type]?.[locale] || type}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--volt-text-faint, #AAA)", fontSize: 9 }}>
          {locale === "de" ? "Klick = Fokus · Ziehen = Verschieben · Scroll = Zoom" : "Click = Focus · Drag = Move · Scroll = Zoom"}
        </span>
      </div>

      {/* Edge tooltip */}
      {hoveredEdge && (
        <div className="mb-2 px-3 py-1.5 rounded text-xs font-sans shadow-sm" style={{ background: "var(--volt-surface, white)", border: "1px solid var(--volt-border, #E8E8E8)" }}>
          <span style={{ color: EDGE_COLORS[hoveredEdge.type], fontWeight: 600 }}>{EDGE_LABELS[hoveredEdge.type]?.[locale]}</span>
          {hoveredEdge.description && (
            <span className="ml-2" style={{ color: "var(--volt-text-muted, #6B6B6B)" }}>{hoveredEdge.description}</span>
          )}
          <span className="ml-2" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>({(hoveredEdge.strength * 100).toFixed(0)}%)</span>
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: "var(--color-surface, #F8F8F6)", border: "1px solid var(--volt-border, #E8E8E8)", borderRadius: 12 }}
      />
    </div>
  );
}
