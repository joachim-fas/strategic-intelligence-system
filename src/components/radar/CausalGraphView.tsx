"use client";


import { useRef, useEffect, useCallback, useState, useMemo, type ChangeEvent } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { select } from "d3-selection";
import type { Selection } from "d3-selection";
import { zoom } from "d3-zoom";
import { drag } from "d3-drag";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import { TrendDot, RING_COLORS, TIME_HORIZON_COLORS } from "@/types";
import {
  TREND_EDGES,
  TrendEdge,
  EdgeType,
  findShortestPath,
  findHubs,
  degreeCentrality,
  getComponents,
  networkDensity,
} from "@/lib/causal-graph";
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

const EDGE_COLORS: Record<EdgeType, string> = {
  drives: "#1A9E5A",
  amplifies: "#1A4A8A",
  dampens: "#E8402A",
  correlates: "#C8820A",
};

const EDGE_LABELS: Record<EdgeType, Record<string, string>> = {
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
  hold:   { de: "Hold",   en: "Hold",   color: "#737373" },
};

// Live signal payload shape — same structure /api/v1/feed returns.
// Duplicated here (not imported) to avoid pulling the route module into client
// bundle. Any drift is caught by runtime guards below.
interface LiveFeedTrend {
  id?: string;
  name: string;
  signalCount72h?: number;
  avgStrength?: number;
  sparkline?: number[];
}

interface LiveFeedResponse {
  trends?: LiveFeedTrend[];
}

export default function CausalGraphView({ trends, onTrendClick, locale, highlightTrendId }: CausalGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const prevDimsRef = useRef<{ width: number; height: number } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<TrendEdge | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(highlightTrendId || null);
  const [ringFilter, setRingFilter] = useState<RingFilter>("all");
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<Set<EdgeType>>(
    () => new Set<EdgeType>(["drives", "amplifies", "dampens", "correlates"])
  );
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const searchDebounceRef = useRef<NodeJS.Timeout>(undefined);
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalSearch(v);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(v), 250);
  }, []);
  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);
  // Path-mode: Shift+Click two nodes to compute the shortest path between them.
  // `pathAnchor` is the first picked node; once the second is picked `pathIds`
  // holds the resolved BFS path. A non-Shift click clears the whole thing.
  const [pathAnchor, setPathAnchor] = useState<string | null>(null);
  const [pathIds, setPathIds] = useState<string[] | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [liveTrends, setLiveTrends] = useState<Map<string, LiveFeedTrend>>(() => new Map());

  // Fetch live-feed overlay data from /api/v1/feed. Keyed on BOTH the canonical
  // id and the lowercase name so that trend IDs like "mega-ai-transformation"
  // match even when the feed payload returns a slightly different id shape.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithTimeout("/api/v1/feed", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LiveFeedResponse;
        if (cancelled || !data.trends) return;
        const map = new Map<string, LiveFeedTrend>();
        for (const t of data.trends) {
          if (t.id) map.set(t.id, t);
          if (t.name) map.set(t.name.toLowerCase(), t);
        }
        setLiveTrends(map);
      } catch {
        // Soft-fail — network view still renders without live overlay.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Enrich trends with live signal overlay. Lookups try id first, then name.
  const enrichedTrends = useMemo(() => {
    if (liveTrends.size === 0) return trends;
    return trends.map((t) => {
      const hit = liveTrends.get(t.id) ?? liveTrends.get(t.name.toLowerCase());
      if (!hit) return t;
      return {
        ...t,
        signalCount72h: hit.signalCount72h ?? t.signalCount72h,
        avgStrength: hit.avgStrength ?? t.avgStrength,
        sparkline: hit.sparkline ?? t.sparkline,
      };
    });
  }, [trends, liveTrends]);

  // Top-5 hubs by degree centrality — cached, since the edge set is static per
  // module load. We also derive a "hub bonus" to enlarge hub nodes visually.
  const hubIds = useMemo(() => {
    const hubs = findHubs(5).map(([id]) => id);
    return new Set<string>(hubs);
  }, []);
  const degreeMap = useMemo(() => degreeCentrality(), []);

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(400, width), height: Math.max(440, Math.min(720, width * 0.65)) });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const { width, height } = dimensions;

  // Resize-only handler: when only dimensions change and a simulation already
  // exists, update the SVG viewBox and re-center the force without tearing
  // down the entire graph. This avoids restarting the force layout on every
  // browser resize event.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim || !prevDimsRef.current) return;
    const prev = prevDimsRef.current;
    if (prev.width === width && prev.height === height) return;
    // Update center force to new midpoint
    sim.force("center", forceCenter(width / 2, height / 2));
    sim.alpha(0.15).restart();
    // Update SVG viewBox attribute
    if (svgRef.current) {
      svgRef.current.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    prevDimsRef.current = { width, height };
  }, [width, height]);

  // Compute path-highlighted edges as a Set<string> of "from→to" keys so the
  // draw callback can O(1)-test whether a link belongs to the current path.
  const pathEdgeKeys = useMemo(() => {
    if (!pathIds || pathIds.length < 2) return new Set<string>();
    const keys = new Set<string>();
    for (let i = 0; i < pathIds.length - 1; i++) {
      const a = pathIds[i];
      const b = pathIds[i + 1];
      // Path is undirected — add both directions so the matching is edge-agnostic.
      keys.add(`${a}→${b}`);
      keys.add(`${b}→${a}`);
    }
    return keys;
  }, [pathIds]);

  const pathNodeSet = useMemo(() => new Set<string>(pathIds ?? []), [pathIds]);

  const draw = useCallback(() => {
    // Stop any existing simulation before rebuilding
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const trendMap = new Map(enrichedTrends.map((t) => [t.id, t]));
    const searchTrim = search.trim().toLowerCase();

    // Ring filter + search both narrow the subgraph. Search matches on
    // name/tags/id case-insensitively; if a node matches, its direct neighbors
    // are kept so the user sees the context around the hit.
    const matchesRingFilter = (id: string): boolean => {
      if (ringFilter === "all") return true;
      const t = trendMap.get(id);
      return t?.ring === ringFilter;
    };

    const searchHits = new Set<string>();
    if (searchTrim) {
      for (const t of enrichedTrends) {
        if (
          t.name.toLowerCase().includes(searchTrim) ||
          t.id.toLowerCase().includes(searchTrim) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchTrim))
        ) {
          searchHits.add(t.id);
        }
      }
    }

    const nodeIds = new Set<string>();
    const links: GraphLink[] = [];
    for (const edge of TREND_EDGES) {
      if (!trendMap.has(edge.from) || !trendMap.has(edge.to)) continue;
      if (!edgeTypeFilter.has(edge.type)) continue;
      if (ringFilter !== "all") {
        if (!matchesRingFilter(edge.from) && !matchesRingFilter(edge.to)) continue;
      }
      if (searchTrim) {
        // Keep edge if either endpoint is a search hit — this pulls in the
        // 1-hop neighborhood around the hit so the user sees relationships.
        if (!searchHits.has(edge.from) && !searchHits.has(edge.to)) continue;
      }
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
      links.push({ source: edge.from, target: edge.to, edge });
    }

    // When there's an active search we also want to include matching nodes
    // that have no surviving edges (e.g. terminal sinks) as orphan dots so
    // the user can still see they matched.
    if (searchTrim) {
      for (const id of searchHits) nodeIds.add(id);
    }

    const nodes: GraphNode[] = [...nodeIds].map((id) => ({
      id,
      name: trendMap.get(id)!.name,
      trend: trendMap.get(id)!,
    }));

    if (nodes.length === 0) {
      // Empty state text so the svg doesn't render as a blank box
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-family", "var(--volt-font-mono, 'JetBrains Mono', monospace)")
        .attr("font-size", 11)
        .attr("fill", "var(--volt-text-faint, #737373)")
        .text(locale === "de" ? "Keine Treffer für diesen Filter" : "No matches for this filter");
      return;
    }

    // Arrow markers — one per edge type × opacity variant. The `path` variant
    // is a thicker orange used for the shortest-path overlay.
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
          .attr("fill-opacity", opacity === "full" ? 1 : 0.12)
          .attr("d", "M0,-5L10,0L0,5");
      }
    }
    // Path overlay marker (orange, thick)
    defs.append("marker")
      .attr("id", "arrow-path")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#F0956A")
      .attr("d", "M0,-5L10,0L0,5");

    const g = svg.append("g");

    // Zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    (svg as unknown as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior);

    // Force simulation — distance slightly longer when there are few nodes so
    // the graph breathes; charge stays strong to keep labels legible.
    const linkDistance = nodes.length < 15 ? 170 : 140;
    const simulation = forceSimulation(nodes as SimulationNodeDatum[])
      .force("link", forceLink(links).id((d: any) => d.id).distance(linkDistance))
      .force("charge", forceManyBody().strength(-520))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius(48));
    simulationRef.current = simulation;
    prevDimsRef.current = { width, height };

    // Focus/connection helpers — decide which elements get full opacity.
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

    // Helper: effective node radius — base impact scaling plus live-signal
    // boost plus a small hub bonus. This is the single source of truth so
    // collision padding and label offsets agree with the rendered circle.
    const nodeRadius = (trend: TrendDot): number => {
      const base = 8 + trend.impact * 14;
      const liveBoost = trend.signalCount72h
        ? Math.min(10, Math.log2(1 + trend.signalCount72h) * 2.2)
        : 0;
      const hubBonus = hubIds.has(trend.id) ? 2 : 0;
      return base + liveBoost + hubBonus;
    };

    // Links ────────────────────────────────────────────────────────────────
    const link = g.selectAll<SVGLineElement, GraphLink>(".link")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("stroke", (d) => {
        const key = `${typeof d.source === "string" ? d.source : d.source.id}→${typeof d.target === "string" ? d.target : d.target.id}`;
        return pathEdgeKeys.has(key) ? "#F0956A" : EDGE_COLORS[d.edge.type];
      })
      .attr("stroke-opacity", (d) => {
        const key = `${typeof d.source === "string" ? d.source : d.source.id}→${typeof d.target === "string" ? d.target : d.target.id}`;
        if (pathEdgeKeys.has(key)) return 0.95;
        return isConnected(d) ? d.edge.strength * 0.7 : 0.05;
      })
      .attr("stroke-width", (d) => {
        const key = `${typeof d.source === "string" ? d.source : d.source.id}→${typeof d.target === "string" ? d.target : d.target.id}`;
        if (pathEdgeKeys.has(key)) return 4;
        return isConnected(d) ? 1.5 + d.edge.strength * 2.5 : 0.5;
      })
      .attr("marker-end", (d) => {
        const key = `${typeof d.source === "string" ? d.source : d.source.id}→${typeof d.target === "string" ? d.target : d.target.id}`;
        if (pathEdgeKeys.has(key)) return "url(#arrow-path)";
        return `url(#arrow-${d.edge.type}-${isConnected(d) ? "full" : "dim"})`;
      })
      .style("stroke-dasharray", (d) => d.edge.type === "dampens" ? "5,3" : "none")
      .style("cursor", "pointer")
      .on("mouseenter", (_event, d) => setHoveredEdge(d.edge))
      .on("mouseleave", () => setHoveredEdge(null));

    // Edge labels — always visible on connected edges in focus mode, and on
    // every edge of the resolved shortest path.
    const labeledLinks = links.filter((l) => {
      const key = `${typeof l.source === "string" ? l.source : l.source.id}→${typeof l.target === "string" ? l.target : l.target.id}`;
      return isConnected(l) || pathEdgeKeys.has(key);
    });
    const edgeLabel = g.selectAll<SVGTextElement, GraphLink>(".edge-label")
      .data(labeledLinks)
      .join("text")
      .attr("class", "edge-label")
      .attr("text-anchor", "middle")
      .attr("fill", (d) => {
        const key = `${typeof d.source === "string" ? d.source : d.source.id}→${typeof d.target === "string" ? d.target : d.target.id}`;
        return pathEdgeKeys.has(key) ? "#C25522" : EDGE_COLORS[d.edge.type];
      })
      .attr("fill-opacity", 0.78)
      .attr("font-size", "8px")
      .attr("font-weight", (d) => {
        const key = `${typeof d.source === "string" ? d.source : d.source.id}→${typeof d.target === "string" ? d.target : d.target.id}`;
        return pathEdgeKeys.has(key) ? "700" : "400";
      })
      .text((d) => EDGE_LABELS[d.edge.type]?.[locale] || d.edge.type);

    // Nodes ────────────────────────────────────────────────────────────────
    const node = g.selectAll<SVGGElement, GraphNode>(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .style("opacity", (d) => {
        if (pathNodeSet.size > 0) return pathNodeSet.has(d.id) ? 1 : 0.15;
        return isNodeConnected(d.id) ? 1 : 0.15;
      })
      .call(drag<SVGGElement, GraphNode>()
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

    // Live-signal heat glow — subtle outer halo whose radius and opacity scale
    // with signalCount72h. Rendered BEHIND the main circle so text stays crisp.
    node.filter((d) => (d.trend.signalCount72h ?? 0) > 0)
      .append("circle")
      .attr("r", (d) => nodeRadius(d.trend) + 6 + Math.min(12, Math.log2(1 + (d.trend.signalCount72h ?? 0)) * 2.2))
      .attr("fill", (d) => TIME_HORIZON_COLORS[d.trend.timeHorizon])
      .attr("fill-opacity", (d) => 0.10 + Math.min(0.28, (d.trend.signalCount72h ?? 0) / 180))
      .attr("stroke", "none");

    // Hub outer ring — gold dotted ring on top-5 degree centrality hubs
    node.filter((d) => hubIds.has(d.id))
      .append("circle")
      .attr("r", (d) => nodeRadius(d.trend) + 4)
      .attr("fill", "none")
      .attr("stroke", "#E8C840")
      .attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "2,2")
      .attr("stroke-opacity", 0.85);

    // Node circles
    node.append("circle")
      .attr("r", (d) => nodeRadius(d.trend))
      .attr("fill", (d) => TIME_HORIZON_COLORS[d.trend.timeHorizon])
      .attr("fill-opacity", (d) => 0.28 + d.trend.confidence * 0.45)
      .attr("stroke", (d) => {
        if (pathNodeSet.has(d.id)) return "#C25522";
        if (d.id === focusedNode) return "var(--volt-text, #0A0A0A)";
        if (pathAnchor === d.id) return "#F0956A";
        return RING_COLORS[d.trend.ring];
      })
      .attr("stroke-width", (d) => {
        if (pathNodeSet.has(d.id) || d.id === focusedNode || pathAnchor === d.id) return 2.5;
        return 1.5;
      });

    // Glow for focused node
    if (focusedNode) {
      node.filter((d) => d.id === focusedNode)
        .append("circle")
        .attr("r", (d) => nodeRadius(d.trend) + 4)
        .attr("fill", "none")
        .attr("stroke", "var(--volt-text, #0A0A0A)")
        .attr("stroke-opacity", 0.14)
        .attr("stroke-width", 2);
    }

    // Node labels
    node.append("text")
      .attr("dy", (d) => nodeRadius(d.trend) + 12)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => {
        if (pathNodeSet.has(d.id)) return "#C25522";
        return d.id === focusedNode ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-muted, #6B6B6B)";
      })
      .attr("font-size", (d) => (d.id === focusedNode || pathNodeSet.has(d.id)) ? "11px" : "10px")
      .attr("font-weight", (d) => (d.id === focusedNode || hubIds.has(d.id) || pathNodeSet.has(d.id)) ? "600" : "400")
      .text((d) => d.name.length > 40 ? d.name.slice(0, 38) + "…" : d.name);

    // Ring + live-signal indicator inside the node
    node.append("text")
      .attr("dy", 3)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => RING_COLORS[d.trend.ring])
      .attr("font-size", "8px")
      .attr("font-weight", "bold")
      .text((d) => d.trend.ring.charAt(0).toUpperCase());

    // Click handlers: Shift+Click = path-mode pick; plain click = focus
    node.on("click", (event: MouseEvent, d) => {
      if (event.shiftKey) {
        if (pathAnchor == null) {
          setPathAnchor(d.id);
          setPathIds(null);
        } else if (pathAnchor === d.id) {
          // Shift-click on anchor again → cancel
          setPathAnchor(null);
          setPathIds(null);
        } else {
          const path = findShortestPath(pathAnchor, d.id);
          if (path) {
            setPathIds(path);
          } else {
            // No path: flash a short console warning, clear anchor
            // eslint-disable-next-line no-console
            console.warn(`[Netzwerk] No path between ${pathAnchor} and ${d.id}`);
            setPathAnchor(null);
            setPathIds(null);
          }
        }
        event.stopPropagation();
        return;
      }
      // Plain click: toggle focus, clear any active path, AND open detail panel
      if (pathIds || pathAnchor) {
        setPathAnchor(null);
        setPathIds(null);
      }
      if (focusedNode === d.id) {
        setFocusedNode(null);
      } else {
        setFocusedNode(d.id);
        // Also open the detail panel — consistent with Radar's single-click UX
        onTrendClick(d.trend);
      }
    });

    // Double-click: also open detail panel (kept for discoverability)
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
  // Note: width/height are intentionally excluded — resize is handled by a
  // separate useEffect that updates the center force without rebuilding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedTrends, focusedNode, locale, onTrendClick, ringFilter, edgeTypeFilter, search, pathAnchor, pathEdgeKeys, pathNodeSet, pathIds, hubIds]);

  useEffect(() => { draw(); }, [draw]);

  // Statistics — computed from the full (unfiltered) edge set since the panel
  // reports system-level health, not the current view's filtered slice.
  const trendMap = useMemo(() => new Map(enrichedTrends.map((t) => [t.id, t])), [enrichedTrends]);
  const stats = useMemo(() => {
    const activeEdges = TREND_EDGES.filter((e) => trendMap.has(e.from) && trendMap.has(e.to));
    const connectedNodes = new Set(activeEdges.flatMap((e) => [e.from, e.to]));
    const components = getComponents().filter((c) => c.some((id) => trendMap.has(id)));
    const density = networkDensity();
    const topHubs = findHubs(5)
      .filter(([id]) => trendMap.has(id))
      .map(([id, degree]) => ({
        id,
        degree,
        name: trendMap.get(id)?.name ?? id,
      }));
    const liveActive = enrichedTrends.filter((t) => (t.signalCount72h ?? 0) > 0).length;
    return { edges: activeEdges.length, nodes: connectedNodes.size, components: components.length, density, topHubs, liveActive };
  }, [trendMap, enrichedTrends]);

  const toggleEdgeType = (type: EdgeType) => {
    setEdgeTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      // Guard: never allow empty — reset to all
      if (next.size === 0) return new Set<EdgeType>(["drives", "amplifies", "dampens", "correlates"]);
      return next;
    });
  };

  const clearPath = () => {
    setPathAnchor(null);
    setPathIds(null);
  };

  const pathAnchorName = pathAnchor ? trendMap.get(pathAnchor)?.name ?? pathAnchor : null;
  const pathHopCount = pathIds ? pathIds.length - 1 : 0;

  return (
    <div ref={containerRef} style={{ padding: "0 4px" }}>
      {/* Intro — explains what the network visualises and how to interact */}
      <div style={{
        padding: "12px 16px",
        marginBottom: 12,
        borderRadius: 10,
        background: "var(--volt-surface, #FAFAFA)",
        border: "1px solid var(--volt-border, #EEE)",
        fontSize: 12, lineHeight: 1.55,
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        color: "var(--volt-text-muted, #6B6B6B)",
      }}>
        <strong style={{ color: "var(--volt-text, #0A0A0A)" }}>
          {locale === "de" ? "Kausalnetz" : "Causal Network"}
        </strong>{" · "}
        {locale === "de"
          ? "Jede Kante zeigt einen kausalen Zusammenhang zwischen zwei Trends. Grüne Pfeile (treibt) verstärken die Zielrichtung, blaue (verstärkt) eskalieren Effekte, rot gestrichelte (dämpft) wirken bremsend, und gelbe (korreliert) zeigen parallele Bewegungen. Größere Knoten = höherer Impact · Goldringe = Top-Hubs mit den meisten Verbindungen · Farbige Halos = aktive Live-Signale der letzten 72 h."
          : "Each edge shows a causal relationship between two trends. Green arrows (drives) push the target direction, blue (amplifies) escalate effects, red dashed (dampens) act as brakes, and amber (correlates) show parallel movement. Larger nodes = higher impact · Gold rings = top hubs with most connections · Colored halos = active live signals in the last 72 h."}
      </div>

      {/* Row 1 — Ring filter pills */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: "var(--volt-text-faint, #737373)",
          marginRight: 6,
        }}>
          {locale === "de" ? "Ring" : "Ring"}
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
                color: active ? "var(--background, #fff)" : "var(--volt-text-muted, #6B6B6B)",
                cursor: "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                transition: "all 120ms ease",
              }}
            >
              {r !== "all" && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: active ? "var(--background, #fff)" : def.color,
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

      {/* Row 2 — Edge-type toggles */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: "var(--volt-text-faint, #737373)",
          marginRight: 6,
        }}>
          {locale === "de" ? "Kanten" : "Edges"}
        </span>
        {(Object.keys(EDGE_COLORS) as EdgeType[]).map((type) => {
          const active = edgeTypeFilter.has(type);
          const color = EDGE_COLORS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleEdgeType(type)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                border: active ? `1px solid ${color}` : "1px solid var(--volt-border, #E8E8E8)",
                background: active ? color : "var(--volt-surface-raised, #fff)",
                color: active ? "var(--background, #fff)" : "var(--volt-text-muted, #6B6B6B)",
                cursor: "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                transition: "all 120ms ease",
                opacity: active ? 1 : 0.72,
              }}
            >
              <span style={{
                width: 16, height: 2, borderRadius: 1,
                background: active ? "var(--background, #fff)" : color,
                display: "inline-block",
                ...(type === "dampens" ? { height: 0, borderTop: `2px dashed ${active ? "var(--background, #fff)" : color}` } : {}),
              }} />
              {EDGE_LABELS[type]?.[locale]}
            </button>
          );
        })}

        {/* Search box aligned to the right */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={locale === "de" ? "Suche…" : "Search…"}
            style={{
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--volt-border, #E8E8E8)",
              background: "var(--volt-surface-raised, #fff)",
              color: "var(--volt-text, #0A0A0A)",
              minWidth: 160,
              outline: "none",
            }}
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(""); setSearch(""); clearTimeout(searchDebounceRef.current); }}
              style={{
                fontSize: 10, cursor: "pointer",
                background: "transparent", border: "none",
                color: "var(--volt-text-muted, #6B6B6B)",
              }}
              aria-label="clear search"
            >✕</button>
          )}
        </div>
      </div>

      {/* Row 3 — Stats strip */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14,
        marginBottom: 10,
        padding: "8px 12px",
        borderRadius: 10,
        background: "var(--volt-surface, #FAFAFA)",
        border: "1px solid var(--volt-border, #EEE)",
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 10,
        color: "var(--volt-text-muted, #6B6B6B)",
      }}>
        <StatChip label={locale === "de" ? "Knoten" : "Nodes"} value={stats.nodes} />
        <StatChip label={locale === "de" ? "Kanten" : "Edges"} value={stats.edges} />
        <StatChip label={locale === "de" ? "Komponenten" : "Components"} value={stats.components} highlight={stats.components === 1 ? "good" : "warn"} />
        <StatChip label={locale === "de" ? "Dichte" : "Density"} value={`${(stats.density * 100).toFixed(1)}%`} />
        {stats.liveActive > 0 && (
          <StatChip
            label={locale === "de" ? "Live aktiv" : "Live"}
            value={stats.liveActive}
            highlight="good"
          />
        )}
        <span style={{ width: 1, height: 14, background: "var(--volt-border, #E8E8E8)" }} />
        <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--volt-text-faint, #737373)" }}>
          {locale === "de" ? "Top Hubs" : "Top Hubs"}
        </span>
        {stats.topHubs.map((h, i) => (
          <button
            key={h.id}
            onClick={() => setFocusedNode(h.id)}
            title={`${h.degree} ${locale === "de" ? "Verbindungen" : "connections"}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 8px",
              borderRadius: 999,
              background: focusedNode === h.id ? "#E8C840" : "rgba(232,200,64,0.18)",
              border: `1px solid ${focusedNode === h.id ? "#C89E0A" : "rgba(232,200,64,0.4)"}`,
              color: focusedNode === h.id ? "#3B2E00" : "var(--volt-text-muted, #6B6B6B)",
              cursor: "pointer",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <span style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, opacity: 0.65 }}>#{i + 1}</span>
            {h.name.length > 22 ? h.name.slice(0, 20) + "…" : h.name}
            <span style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, opacity: 0.7 }}>·{h.degree}</span>
          </button>
        ))}
      </div>

      {/* Row 4 — Interaction hint + Path mode status */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14,
        marginBottom: 10,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 10,
        color: "var(--volt-text-faint, #737373)",
      }}>
        <span>
          {locale === "de"
            ? "Klick = Fokus + Details · Shift+Klick zwei Knoten = Kürzester Pfad"
            : "Click = Focus + Details · Shift+Click two nodes = Shortest path"}
        </span>

        {pathAnchor && !pathIds && (
          <span style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(240,149,106,0.18)",
            border: "1px solid rgba(240,149,106,0.5)",
            color: "#C25522",
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            fontSize: 10,
            fontWeight: 600,
          }}>
            {locale === "de" ? "Anker gesetzt: " : "Anchor: "}
            <strong style={{ fontWeight: 700 }}>{pathAnchorName}</strong>
            {locale === "de" ? " — Shift+Klick zweiten Knoten" : " — Shift+Click second node"}
            <button onClick={clearPath} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 11, marginLeft: 4 }}>✕</button>
          </span>
        )}

        {pathIds && (
          <span style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(240,149,106,0.22)",
            border: "1px solid #F0956A",
            color: "#7A3214",
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            fontSize: 10,
            fontWeight: 600,
          }}>
            {locale === "de" ? `Pfad: ${pathHopCount} Schritt${pathHopCount === 1 ? "" : "e"}` : `Path: ${pathHopCount} hop${pathHopCount === 1 ? "" : "s"}`}
            <button onClick={clearPath} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 11, marginLeft: 4 }}>✕</button>
          </span>
        )}
      </div>

      {/* Edge tooltip */}
      {hoveredEdge && (
        <div className="mb-2 px-3 py-1.5 rounded text-xs font-sans shadow-sm" style={{ background: "var(--volt-surface, white)", border: "1px solid var(--volt-border, #E8E8E8)" }}>
          <span style={{ color: EDGE_COLORS[hoveredEdge.type], fontWeight: 600 }}>{EDGE_LABELS[hoveredEdge.type]?.[locale]}</span>
          {hoveredEdge.description && (
            <span className="ml-2" style={{ color: "var(--volt-text-muted, #6B6B6B)" }}>{hoveredEdge.description}</span>
          )}
          <span className="ml-2" style={{ color: "var(--volt-text-faint, #737373)" }}>({(hoveredEdge.strength * 100).toFixed(0)}%)</span>
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: "var(--color-surface, #F8F8F6)", border: "1px solid var(--volt-border, #E8E8E8)", borderRadius: 12 }}
      />

      {/* Legend — below the graph so it doesn't compete with the stats row */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
        marginTop: 10,
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 9,
        color: "var(--volt-text-faint, #737373)",
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          {locale === "de" ? "Knoten" : "Nodes"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.4px dashed #E8C840", display: "inline-block" }} />
          {locale === "de" ? "Top-5 Hub" : "Top-5 Hub"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(122,184,245,0.35)", display: "inline-block" }} />
          {locale === "de" ? "Live-Halo = signalCount72h" : "Live halo = signalCount72h"}
        </span>
        <span style={{ width: 1, height: 10, background: "var(--volt-border, #E8E8E8)" }} />
        <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          {locale === "de" ? "Kanten" : "Edges"}
        </span>
        {(Object.keys(EDGE_COLORS) as EdgeType[]).map((type) => (
          <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 18, height: 2, borderRadius: 1, background: EDGE_COLORS[type],
              display: "inline-block",
              ...(type === "dampens" ? { height: 0, borderTop: `2px dashed ${EDGE_COLORS[type]}` } : {}),
            }} />
            {EDGE_LABELS[type]?.[locale]}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 18, height: 3, background: "#F0956A", display: "inline-block", borderRadius: 1 }} />
          {locale === "de" ? "Pfad" : "Path"}
        </span>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatChip({ label, value, highlight }: { label: string; value: number | string; highlight?: "good" | "warn" }) {
  const bg = highlight === "good"
    ? "rgba(26,158,90,0.14)"
    : highlight === "warn"
    ? "rgba(232,64,42,0.14)"
    : "var(--volt-surface-raised, #fff)";
  const border = highlight === "good"
    ? "rgba(26,158,90,0.4)"
    : highlight === "warn"
    ? "rgba(232,64,42,0.4)"
    : "var(--volt-border, #E8E8E8)";
  const color = highlight === "good"
    ? "#1A9E5A"
    : highlight === "warn"
    ? "#C2311C"
    : "var(--volt-text, #0A0A0A)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px",
      borderRadius: 6,
      background: bg,
      border: `1px solid ${border}`,
    }}>
      <span style={{ fontWeight: 700, color, fontSize: 11 }}>{value}</span>
      <span style={{
        fontSize: 8, textTransform: "uppercase" as const, letterSpacing: "0.1em",
        color: "var(--volt-text-faint, #737373)",
      }}>
        {label}
      </span>
    </span>
  );
}
