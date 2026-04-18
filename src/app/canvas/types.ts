/**
 * Canvas types — single source of truth for all node shapes, view
 * modes, and connection metadata that the canvas page renders.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition step
 * of the 18.04.2026 audit (A5-H7). Zero runtime impact: these are
 * pure type aliases + interfaces, consumed by every slice of the
 * canvas code.
 */

import type {
  UsedSignal,
  MatchedEdge,
  DimensionEntry,
  QueryResult,
} from "@/types";

// ── Node status ────────────────────────────────────────────────────

export type NodeStatus = "open" | "active" | "decided" | "pinned";

// ── Layer types ────────────────────────────────────────────────────

export type CanvasLayer = "analyse" | "karte" | "datei";

// ── View modes ─────────────────────────────────────────────────────

export type ViewMode = "canvas" | "board" | "timeline" | "orbit";
export type SortMode = "tree" | "time" | "type" | "status";

// ── Groups ─────────────────────────────────────────────────────────

export interface CanvasGroup {
  id: string;
  nodeIds: string[];
  label: string;
  color: string;
  bounds: { x: number; y: number; w: number; h: number };
}

// ── Node shapes ────────────────────────────────────────────────────

export interface QueryNode {
  id: string;
  nodeType: "query";
  x: number;
  y: number;
  query: string;
  locale: string;
  status: "loading" | "streaming" | "done" | "error";
  synthesis: string;
  result: QueryResult | null;
  collapsed: boolean;
  parentId?: string;
  errorMsg?: string;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  /** Streaming phase index: 0=loading 1=synthesis 2=reasoning 3=scenarios 4=insights 5=done */
  streamingPhase?: number;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

export type DerivedType =
  | "insight"
  | "scenario"
  | "decision"
  | "followup"
  | "dimensions"
  | "causalgraph";

export interface DerivedNode {
  id: string;
  nodeType: DerivedType;
  x: number;
  y: number;
  parentId: string;
  content: string;
  label?: string;
  colorKey?: string;
  probability?: number;
  queryText: string;
  /** Top signals carried over from the parent query node. */
  sources?: UsedSignal[];
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  nodeStatus?: NodeStatus;
  // Enriched fields (all optional — backwards-compatible)
  /** For scenario cards. */
  keyDrivers?: string[];
  /** For dimensions cards. */
  dimensionData?: DimensionEntry[];
  /** For causalgraph cards. */
  causalEdges?: MatchedEdge[];
  /** id→name lookup for causal-edge trends. */
  causalTrendNames?: Record<string, string>;
  tags?: string[];
}

export interface NoteNode {
  id: string;
  nodeType: "note";
  x: number;
  y: number;
  content: string;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

export interface IdeaNode {
  id: string;
  nodeType: "idea";
  x: number;
  y: number;
  title: string;
  content: string;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

export interface ListNode {
  id: string;
  nodeType: "list";
  x: number;
  y: number;
  title: string;
  items: string[];
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

export interface FileNode {
  id: string;
  nodeType: "file";
  x: number;
  y: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  textContent?: string;
  loading?: boolean;
  createdAt: number;
  customWidth?: number;
  customHeight?: number;
  parentId?: string;
  nodeStatus?: NodeStatus;
  tags?: string[];
}

export type CanvasNode =
  | QueryNode
  | DerivedNode
  | NoteNode
  | IdeaNode
  | ListNode
  | FileNode;

// ── Connections ────────────────────────────────────────────────────

export type ConnectionType =
  | "derived"
  | "builds-on"
  | "contradicts"
  | "validates"
  | "refreshed";

export interface Connection {
  from: string;
  to: string;
  derived?: boolean;
  /** Temporal chain: re-run of same query. */
  refreshed?: boolean;
  connectionType?: ConnectionType;
  /** Optional edge annotation. */
  note?: string;
}

// ── Project list item ──────────────────────────────────────────────

export interface CanvasProject {
  id: string;
  name: string;
  hasState: boolean;
  updated_at: string;
}

// ── Shared card-renderer props ─────────────────────────────────────

/**
 * Props common to every canvas node-card renderer. Decomposition
 * slice 4 (18.04.2026 audit A5-H7) pulls card renderers into
 * `src/app/canvas/nodes/` — this type keeps their signatures from
 * drifting. Each card type extends this with its own mutation
 * callbacks (onUpdate for note/idea/list, onAnalyze for file, etc.).
 */
export interface CardBaseProps {
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
  onResizeStart: (
    e: React.PointerEvent,
    id: string,
    currentW: number,
    currentH: number,
    dir?: "h" | "v" | "both",
  ) => void;
  onIterate: (nodeId: string, prefill: string) => void;
  onPortDragStart: (e: React.PointerEvent, nodeId: string) => void;
  nodeW: number;
  dimmed?: boolean;
  zoom?: number;
}
