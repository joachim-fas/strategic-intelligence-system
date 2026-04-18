"use client";

// ── Canvas decomposition status (audit ARC-01 / FE-14, updated 2026-04-18)
//
// This file started at ~9015 lines with 40+ useState hooks, 20+ useEffect,
// 20 internal components, 500+ inline styles. It's now ~4350 lines. The
// remaining weight is the `CanvasPage` component itself — state + event
// handlers + view-mode switching. Presentational components and pure-logic
// helpers have been extracted; the component split below is deliberately
// paused until there's a concrete UX reason to keep cutting (hook-based
// refactoring is a different class of change than function extraction).
//
// DONE (extracted into sibling files of this file):
//   - nodes/*            — 8 per-type card renderers (Note/Idea/List/File,
//                          Query/Derived, Dimensions, CausalGraph)
//   - DetailPanel.tsx    — the single-card inspector with all sub-helpers
//   - OrbitGraphView.tsx + OrbitDerivationView.tsx — Orbit views
//   - ConnectionsSVG.tsx — edge-layer renderer
//   - NodePicker.tsx     — "+ card" dropdown + type list
//   - Minimap.tsx        — bottom-right pan overview (+ NODE_MINIMAP_COLOR)
//   - CommandLine.tsx    — floating query-input bar
//   - derivation.ts      — computeDerivedNodes, buildDimensionData, uid
//   - streamQuery.ts     — SSE client + retry/reconnect (EDGE-17 2026-04-18)
//   - storage.ts         — localStorage save/load helpers
//   - seedData.ts        — test + demo fixtures
//   - utils.ts           — shared helpers (formatFileSize, node sizing, …)
//   - types.ts, constants.ts — shared shapes + size tokens
//
// STILL HERE (remainder of this file):
//   - CanvasPage main component: state (40+ useState/useRef), global pointer
//     + keyboard handlers, view-mode rendering (Canvas/Board/Timeline/Orbit),
//     all the handlers that mutate nodes/connections, the toolbar strip.
//
// NOT YET EXTRACTED (hook-extraction territory, paused):
//   - hooks/useCanvasState — nodes/connections/selection/undo/redo
//   - hooks/useCanvasKeyboard — keyboard shortcuts
//   - hooks/useCanvasPersistence — DB save/BroadcastChannel
//   - components/canvas/CanvasToolbar — view-mode switcher
//   - components/canvas/CanvasModals — delete-confirm, project-switcher

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { GraphLightbox } from "@/components/ui/GraphLightbox";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TEMPLATES, FRAMEWORKS, type TemplateResult } from "@/lib/canvas-templates";
import { BOARD_COLUMNS, NODE_COLORS, EDGE_STYLE } from "@/lib/colors";
import { AppHeader } from "@/components/AppHeader";
import { WorkflowPanel, type WorkflowState, type WorkflowStep } from "@/components/canvas/WorkflowPanel";
import { OrbitGraphView } from "./OrbitGraphView";
import { OrbitDerivationView, type DerivCanvasNode } from "./OrbitDerivationView";
import { VoltIconBox } from "@/components/verstehen/VoltPrimitives";
import {
  VoltDropdownMenu,
  VoltDropdownMenuTrigger,
  VoltDropdownMenuContent,
  VoltDropdownMenuItem,
  VoltDropdownMenuSeparator,
  VoltDropdownMenuLabel,
} from "@/components/volt/VoltDropdownMenu";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useLocale } from "@/lib/locale-context";
import { useActiveTenantId } from "@/lib/tenant-context";
import { tenantStorage, TENANT_STORAGE_KEYS } from "@/lib/tenant-storage";
import {
  GitBranch, LayoutGrid, Columns3, Clock, Hexagon,
  TreePine, Tag, Layers, X, Group, MoreHorizontal, Trash2, RefreshCw, MessageSquarePlus, TagIcon, Pin, CheckCircle2, Circle, CircleDot, Plus, Zap,
  ArrowDown, ArrowRight, ChevronDown, ChevronUp, ShieldAlert, Compass, ExternalLink, Copy, Check, Search, RotateCcw,
} from "lucide-react";
// Sparkles laeuft ueber den Volt-Adapter. Die uebrigen Icons in dieser
// Datei bleiben bis zum Icon-Set-Swap vorerst auf lucide — eine
// Komplett-Migration der Canvas-Toolbar ist ein eigener Task.
import { VIconSparkles } from "@/components/volt";
import type {
  UsedSignal, Scenario, Reference, MatchedTrend,
  MatchedEdge, DimensionEntry, QueryResult,
} from "@/types";

// Decomposition step 1 (18.04.2026 audit A5-H7): types, design
// tokens, and pure size/time utilities previously inlined at the top
// of this file now live in sibling modules. Behavioural parity — the
// moved code is unchanged, only its location. Keeps the page file
// focused on React state + render logic.
import {
  NODE_STATUS_META,
  NODE_LAYER,
  LAYER_LABELS,
  QUERY_NODE_W,
  QUERY_NODE_H,
  DERIVED_W,
  LIST_NODE_W,
  FILE_NODE_W,
  FILE_NODE_H,
  DERIVED_COL_GAP_X,
  DERIVED_COL_GAP,
  DERIVED_ROW_GAP,
  DIMENSIONS_CARD_H,
  CAUSAL_GRAPH_CARD_H,
  STORAGE_KEY,
  CANVAS_SCHEMA_VERSION,
  SCEN,
} from "./constants";
import type {
  CanvasGroup,
  CanvasLayer,
  CanvasNode,
  CanvasProject,
  Connection,
  ConnectionType,
  DerivedNode,
  DerivedType,
  FileNode,
  IdeaNode,
  ListNode,
  NodeStatus,
  NoteNode,
  QueryNode,
  SortMode,
  ViewMode,
} from "./types";
import {
  formatNodeTime,
  nodeAge,
  estimateCardHeight,
  estimateQueryHeight,
  getNodeHeight,
  getNodeWidth,
  formatFileSize,
} from "./utils";

// Slice 2 extraction: StatusIcon, CardActionsMenu, FormattedText
// and TagInlineInput now live in their own sibling files. Re-imported
// here so the rest of page.tsx stays unchanged.
import { StatusIcon } from "./StatusIcon";
import { CardActionsMenu } from "./CardActionsMenu";
import { FormattedText } from "./FormattedText";
import { TagInlineInput } from "./TagInlineInput";

// ── Persistence (localStorage) ────────────────────────────────────────────
// storage helpers moved to ./storage (2026-04-18)
import { saveToStorage, loadFromStorage } from "./storage";


// ── Streaming ─────────────────────────────────────────────────────────────
// streaming helpers moved to ./streamQuery (2026-04-18)
import { extractSynthesisDelta, detectStreamingPhase, streamQuery } from "./streamQuery";
// ── Canvas derivation ─────────────────────────────────────────────────────
// Moved to ./derivation (2026-04-18):
//   buildDimensionData, uid, computeDerivedNodes
import { buildDimensionData, uid, computeDerivedNodes } from "./derivation";


// ── Test Dataset + Demo Project ───────────────────────────────────────────
// buildTestDataset / buildDemoProject moved to ./seedData.ts
import { buildTestDataset } from "./seedData";


// ConfidenceBadge moved to ./DetailPanel (slice 3) — only consumer.
// ConfidenceGauge removed 2026-04-18 — orphan, no call sites anywhere.
// SignalSparkline removed 2026-04-18 — live copy lives privately in
//   ./nodes/QueryNodeCard.tsx (slice 4c); this one had no consumers.

// SourceChips moved to ./DetailPanel (slice 3) — only consumer.

// DimensionsNodeCard + CausalGraphNodeCard moved to ./nodes/* (slice 4b).
import { DimensionsNodeCard } from "./nodes/DimensionsNodeCard";
import { CausalGraphNodeCard } from "./nodes/CausalGraphNodeCard";

// ── CommandLine ───────────────────────────────────────────────────────────
// CommandLine moved to ./CommandLine (2026-04-18)
import { CommandLine } from "./CommandLine";


// ── ConnectionsSVG ────────────────────────────────────────────────────────
// ConnectionsSVG moved to ./ConnectionsSVG (2026-04-18)
import { ConnectionsSVG } from "./ConnectionsSVG";


// ── TagInlineInput (reusable inline tag adder for detail panels) ─────────

// TagInlineInput moved to ./TagInlineInput (slice 2).

// ── CardActionsMenu (shared action dropdown for all node cards) ──────────

// CardActionsMenu moved to ./CardActionsMenu (slice 2).

// ── FormattedText — structured text rendering with paragraphs & provenance ──

// FormattedText moved to ./FormattedText (slice 2).

// DerivedNodeCard moved to ./nodes/DerivedNodeCard (slice 4c).
import { DerivedNodeCard } from "./nodes/DerivedNodeCard";

// ── QueryNodeCard (compact) ───────────────────────────────────────────────
// QueryNodeCard moved to ./nodes/QueryNodeCard (slice 4c).
import { QueryNodeCard } from "./nodes/QueryNodeCard";

// ── NodePicker ────────────────────────────────────────────────────────────
// NodePicker + NewNodeType moved to ./NodePicker (2026-04-18)
import { NodePicker, type NewNodeType } from "./NodePicker";


// NoteNodeCard, IdeaNodeCard, ListNodeCard, FileNodeCard — and the
// local fileIcon() helper — moved to ./nodes/* (slice 4a). Editing
// and actions still live in the DetailPanel; these renderers are
// pure read-only card faces.
import { NoteNodeCard } from "./nodes/NoteNodeCard";
import { IdeaNodeCard } from "./nodes/IdeaNodeCard";
import { ListNodeCard } from "./nodes/ListNodeCard";
import { FileNodeCard } from "./nodes/FileNodeCard";

// CollapsibleSection moved to ./DetailPanel (slice 3) — only consumer.

// RadarChart, CausalGraphSVG, ScenarioComparisonChart, DetailPanel
// (and its Props interface) all moved to ./DetailPanel (slice 3).
// They were the largest block in this file — ~1760 lines — and had
// no consumers outside the DetailPanel render tree. DimensionRadar
// re-exported because DimensionsNodeCard (still in this file) also
// renders it as a mini inline chart.
import { DetailPanel, DimensionRadar } from "./DetailPanel";
// ── Minimap ────────────────────────────────────────────────────────────────
// Minimap moved to ./Minimap (2026-04-18)
import { Minimap, NODE_MINIMAP_COLOR } from "./Minimap";


// ── Main Page ──────────────────────────────────────────────────────────────

export default function CanvasPage() {
  // Check URL params for embedded mode — must be in useEffect to avoid hydration mismatch
  const [embedded, setEmbedded] = useState(false);
  const [hydrated, setHydrated] = useState(false); // prevents flash of empty-state before embedded check
  const [initialView, setInitialView] = useState<"canvas" | "board">("canvas");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embedded") === "1") setEmbedded(true);
    if (params.get("view") === "board") {
      setInitialView("board");
      setViewMode("board");
    }
    setHydrated(true);
  }, []);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const { locale } = useLocale();
  // Tenant-Scope fuer Client-localStorage. Der Hook ist SSR-hydratisiert, aber
  // wir spiegeln in einen Ref, damit Callbacks (onSave, loadProject, delete,
  // Init-Effect) den aktuellen Tenant sehen, ohne bei jedem Rerender neu
  // erzeugt zu werden.
  const activeTenantId = useActiveTenantId();
  const tenantIdRef = useRef<string | null>(activeTenantId);
  useEffect(() => { tenantIdRef.current = activeTenantId; }, [activeTenantId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orbitSubMode, setOrbitSubMode] = useState<"ableitung" | "netzwerk">("ableitung");
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cmdVisible, setCmdVisible] = useState(false);
  const [cmdParentId, setCmdParentId] = useState<string | null>(null);
  const [cmdPrefill, setCmdPrefill] = useState("");
  const [nodePickerVisible, setNodePickerVisible] = useState(false);
  const [iterateCtx, setIterateCtx] = useState<{ parentId: string; prefill: string } | null>(null);
  const iterateCtxRef = useRef<{ parentId: string; prefill: string } | null>(null);

  // ── Template picker + Workflow ───────────────────────────────────────────
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  // Audit finding A2-H2 (18.04.2026): when a template tile is clicked
  // we used to call `window.prompt()` to collect the topic. Native
  // prompt breaks the glass-morphism modal aesthetic and may be
  // suppressed in some iframe contexts. Now we stage the click in
  // this state, reveal an inline topic input inside the modal, and
  // only run the template-build after the user confirms.
  const [pendingTemplate, setPendingTemplate] = useState<{ id: string; labelDe: string; labelEn: string } | null>(null);
  const [pendingTopic, setPendingTopic] = useState("");
  const [templateTopic, setTemplateTopic] = useState("");
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowState | null>(null);

  // ── Project state ─────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectOp, setProjectOp] = useState<"creating" | "deleting" | "loading" | null>(null);

  const [hiddenLayers, setHiddenLayers] = useState<Set<CanvasLayer>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(initialView ?? "canvas");
  const [viewportSize, setViewportSize] = useState({ w: 1200, h: 800 });
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingText, setBriefingText] = useState("");
  const [briefingLoading, setBriefingLoading] = useState(false);

  // FIXED: DAT-08 / EDGE-09 — Concurrent tab detection via BroadcastChannel
  const [concurrentTabWarning, setConcurrentTabWarning] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return; // SSR / unsupported browser guard
    const channel = new BroadcastChannel("sis-canvas");
    const tabId = Date.now();
    channel.postMessage({ type: "tab-active", tabId });
    channel.onmessage = (e) => {
      if (e.data?.type === "tab-active" && e.data.tabId !== tabId) {
        setConcurrentTabWarning(true);
      }
    };
    return () => channel.close();
  }, []);

  // UX-11: Snap-to-grid toggle
  const [snapToGrid, setSnapToGrid] = useState(false);

  // UX-12: Copy/paste clipboard for nodes
  const clipboardRef = useRef<CanvasNode[]>([]);

  // Feature: Sort/Arrange dropdown
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Feature: Manual groups + multi-select
  const [userGroups, setUserGroups] = useState<CanvasGroup[]>([]);
  const userGroupsRef = useRef(userGroups);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const shiftHeldRef = useRef(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Feature: Tag filter
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [connVisMode, setConnVisMode] = useState<"auto" | "show" | "hide">("auto");

  const de = locale === "de";
  const queryNodes = useMemo(() => nodes.filter((n): n is QueryNode => n.nodeType === "query"), [nodes]);
  const isEmpty = nodes.length === 0;

  // Refs for pointer events and DB save
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const nodesRef = useRef(nodes);
  const isDirtyRef = useRef(false);
  const connectionsRef = useRef(connections);
  const projectIdRef = useRef(projectId);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; panYRef.current = panY; }, [panX, panY]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { iterateCtxRef.current = iterateCtx; }, [iterateCtx]);
  useEffect(() => { userGroupsRef.current = userGroups; }, [userGroups]);
  // UX-11: Snap-to-grid ref for pointer handler closure
  const snapToGridRef = useRef(snapToGrid);
  useEffect(() => { snapToGridRef.current = snapToGrid; }, [snapToGrid]);

  // ── Per-view-mode pan/zoom transforms ────────────────────────────────────
  const viewTransformsRef = useRef<Record<string, { x: number; y: number; z: number }>>({});

  const draggingRef  = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizingRef  = useRef<{ id: string; dir: "h" | "v" | "both"; startX: number; startW: number; startY: number; startH: number } | null>(null);
  const panningRef   = useRef<{ sx: number; sy: number; opx: number; opy: number } | null>(null);
  const viewportRef  = useRef<HTMLDivElement>(null);
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Auto-naming: track whether session has been auto-renamed after first query ──
  const hasAutoNamedRef = useRef(false);

  // ── Active stream abort controllers (keyed by node ID) ────────────────────
  const activeStreamsRef = useRef<Map<string, AbortController>>(new Map());

  // ── File upload refs ──────────────────────────────────────────────────────
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const fileUploadPosRef = useRef<{ x: number; y: number } | null>(null);
  const fileUploadParentRef = useRef<string | null>(null);

  // ── Port drag refs ─────────────────────────────────────────────────────────
  const portDragRef = useRef<{
    nodeId: string;
    prefill: string;
    sourceCanvasX: number;
    sourceCanvasY: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const [portDragPreview, setPortDragPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const portDropCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const [nodePickerPos, setNodePickerPos] = useState<{ x: number; y: number } | null>(null); // viewport coords
  const nextQueryPosOverrideRef = useRef<{ x: number; y: number } | null>(null);

  // ── Undo / Redo history ─────────────────────────────────────────────────
  const historyRef = useRef<{ nodes: CanvasNode[]; connections: Connection[] }[]>([]);
  const historyIndexRef = useRef(-1);
  const MAX_HISTORY = 50;

  const pushHistory = useCallback(() => {
    const snapshot = { nodes: [...nodesRef.current], connections: [...connectionsRef.current] };
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    isDirtyRef.current = true;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const snapshot = historyRef.current[historyIndexRef.current];
      setNodes(snapshot.nodes);
      setConnections(snapshot.connections);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const snapshot = historyRef.current[historyIndexRef.current];
      setNodes(snapshot.nodes);
      setConnections(snapshot.connections);
    }
  }, []);

  // ── Project API functions ─────────────────────────────────────────────────

  const showProjectError = useCallback((msg: string) => {
    setProjectError(msg);
    console.error("[SIS Canvas]", msg);
    setTimeout(() => setProjectError(null), 6000);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetchWithTimeout("/api/v1/canvas");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProjects((json.data ?? json).canvases ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        showProjectError(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        showProjectError(de ? `Projekte laden fehlgeschlagen: ${(e as Error).message}` : `Failed to load projects: ${(e as Error).message}`);
      }
    }
  }, [de, showProjectError]);

  const saveCanvasToDb = useCallback(async (id: string) => {
    setSaveStatus("saving");
    try {
      const state = {
        nodes: nodesRef.current.filter(n =>
          n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error"
        ),
        conns: connectionsRef.current,
        pan: { x: panXRef.current, y: panYRef.current },
        zoom: zoomRef.current,
        v: 2,
        _schemaVersion: CANVAS_SCHEMA_VERSION, // FIXED: EDGE-08 — Include schema version in saved state
        userGroups: userGroupsRef.current.length > 0 ? userGroupsRef.current : undefined,
      };
      // BUGFIX: previously `await fetchWithTimeout(...)` without an .ok check —
      // a 401/403/404/500 response would still resolve the promise, fall
      // through to setSaveStatus("saved") and clear isDirtyRef. The user
      // thought their work was persisted while the canvas_state column
      // stayed empty in the DB. Now we surface the error instead.
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: state }),
      });
      if (!res.ok) {
        console.error("[saveCanvasToDb] PATCH failed", res.status);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus(null), 4000);
        return;
      }
      setSaveStatus("saved");
      isDirtyRef.current = false;
      // Refresh project list to update updated_at
      setProjects(prev => prev.map(p =>
        p.id === id ? { ...p, updated_at: new Date().toISOString(), hasState: true } : p
      ));
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 4000);
    }
  }, []);

  const createNewProject = useCallback(async () => {
    // Skip the native window.prompt (design-system mismatch + blocked in
    // some contexts). Create with a timestamped placeholder name and
    // auto-open the in-header rename input so the user can type the real
    // name inline — consistent with the rest of the app's UX.
    const now = new Date();
    const stamp = now.toLocaleDateString(de ? "de-DE" : "en-US", { day: "2-digit", month: "2-digit" })
      + " " + now.toLocaleTimeString(de ? "de-DE" : "en-US", { hour: "2-digit", minute: "2-digit" });
    const placeholder = `${de ? "Neues Projekt" : "New project"} · ${stamp}`;
    setProjectOp("creating");
    try {
      const res = await fetchWithTimeout("/api/v1/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: placeholder }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const newCanvas = (json.data ?? json).canvas;
      if (!newCanvas?.id) throw new Error("API returned no canvas ID");
      setProjectId(newCanvas.id);
      setProjectName(placeholder);
      setNodes([]); setConnections([]);
      setPanX(0); setPanY(0); setZoom(1);
      setSelectedId(null); setCmdVisible(false);
      setSaveStatus(null);
      hasAutoNamedRef.current = false;
      const tid0 = tenantIdRef.current;
      if (tid0) tenantStorage.set(tid0, TENANT_STORAGE_KEYS.activeCanvas, newCanvas.id);
      try { window.history.replaceState(null, "", `/canvas?project=${newCanvas.id}`); } catch {}
      await loadProjects();
      // Focus the inline rename so the user can type the real name
      // immediately — replaces the old window.prompt flow.
      setEditingName(true);
      // Template picker opens after the rename commits (or cancels).
      setShowTemplatePicker(true);
      setTemplateTopic("");
    } catch (e) {
      showProjectError(de ? `Projekt erstellen fehlgeschlagen: ${(e as Error).message}` : `Failed to create project: ${(e as Error).message}`);
    } finally {
      setProjectOp(null);
    }
  }, [de, loadProjects, showProjectError]);

  const loadProject = useCallback(async (id: string) => {
    // FIXED: DAT-07 — Check for unsaved changes before switching projects
    if (dbSaveTimerRef.current && projectIdRef.current && projectIdRef.current !== id) {
      const confirmSwitch = window.confirm(
        de ? "Ungespeicherte Änderungen. Trotzdem wechseln?" : "Unsaved changes. Switch anyway?"
      );
      if (!confirmSwitch) return;
      // FIXED: DAT-06 — Flush pending save before project switch
      clearTimeout(dbSaveTimerRef.current);
      dbSaveTimerRef.current = undefined;
      // Save old project immediately before switching
      await saveCanvasToDb(projectIdRef.current);
    }
    setProjectOp("loading");
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`);
      if (res.status === 404) {
        // Project was deleted — clear stale references
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        {
          const tid404 = tenantIdRef.current;
          if (tid404) tenantStorage.remove(tid404, TENANT_STORAGE_KEYS.activeCanvas);
        }
        try { localStorage.removeItem("sis-history-v2"); } catch {}
        setProjectId(null); setProjectName(""); setSaveStatus(null);
        setNodes([]); setConnections([]);
        setPanX(0); setPanY(0); setZoom(1);
        setProjects(prev => prev.filter(p => p.id !== id));
        // Clear stale ?project= from URL so reload doesn't retry a dead ID
        try { window.history.replaceState(null, "", "/canvas"); } catch {}
        showProjectError(de ? "Projekt existiert nicht mehr." : "Project no longer exists.");
        setProjectOp(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const canvas = (json.data ?? json).canvas;
      if (!canvas) throw new Error("Canvas not found");
      setProjectId(id);
      setProjectName(canvas.name);
      setSaveStatus(null);
      // Reset auto-naming flag so the next first-query can rename this session
      hasAutoNamedRef.current = false;
      {
        const tidL = tenantIdRef.current;
        if (tidL) tenantStorage.set(tidL, TENANT_STORAGE_KEYS.activeCanvas, id);
      }
      // Keep URL in sync so bookmarks / refresh / back-button all work
      try { window.history.replaceState(null, "", `/canvas?project=${id}`); } catch {}
      const canvasState = canvas.canvas_state;
      if (!canvasState || canvasState === 'null' || canvasState === '{}' || canvasState.trim() === '') {
        setNodes([]); setConnections([]);
        setPanX(0); setPanY(0); setZoom(1);
      } else {
        try {
          const state = JSON.parse(canvasState);
          if (!state || typeof state !== "object") throw new Error("Invalid canvas state structure");
          if (state.v !== 2) {
            setNodes([]); setConnections([]);
            setPanX(0); setPanY(0); setZoom(1);
          } else {
            // FIXED: EDGE-08 — Schema version mismatch check
            if (state._schemaVersion !== undefined && state._schemaVersion !== CANVAS_SCHEMA_VERSION) {
              console.warn("[SIS Canvas] Schema version mismatch:", state._schemaVersion, "->", CANVAS_SCHEMA_VERSION);
              // TODO: EDGE-08 — Add migration functions for schema version upgrades
            }
            if (Array.isArray(state.nodes)) setNodes(state.nodes); else setNodes([]);
            if (Array.isArray(state.conns)) setConnections(state.conns); else setConnections([]);
            if (state.pan) { setPanX(state.pan.x); setPanY(state.pan.y); }
            if (state.zoom) setZoom(state.zoom);
            if (Array.isArray(state.userGroups)) setUserGroups(state.userGroups); else setUserGroups([]);
          }
        } catch (parseErr) {
          console.error("[SIS Canvas] Failed to parse canvas_state:", parseErr);
          setNodes([]); setConnections([]);
          setPanX(0); setPanY(0); setZoom(1);
        }
      }
      setProjectDropdownOpen(false);
    } catch (e) {
      showProjectError(de ? `Projekt laden fehlgeschlagen: ${(e as Error).message}` : `Failed to load project: ${(e as Error).message}`);
    } finally {
      setProjectOp(null);
    }
  }, [de, showProjectError]);

  const saveProjectName = useCallback(async () => {
    setEditingName(false);
    if (!projectId || !projectName.trim()) return;
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: projectName.trim() } : p));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        showProjectError(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        showProjectError(de ? `Umbenennen fehlgeschlagen: ${(e as Error).message}` : `Rename failed: ${(e as Error).message}`);
      }
    }
  }, [projectId, projectName, de, showProjectError]);

  const deleteProject = useCallback(async (id: string) => {
    if (!window.confirm(de ? "Projekt unwiderruflich löschen?" : "Delete project permanently?")) return;
    setProjectOp("deleting");
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (projectId === id) {
        setProjectId(null); setProjectName(""); setSaveStatus(null);
        setNodes([]); setConnections([]);
        {
          const tidD = tenantIdRef.current;
          if (tidD) tenantStorage.remove(tidD, TENANT_STORAGE_KEYS.activeCanvas);
        }
        // Clear ?project= from URL so refresh shows empty state, not a dead ID
        try { window.history.replaceState(null, "", "/canvas"); } catch {}
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        showProjectError(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        showProjectError(de ? `Löschen fehlgeschlagen: ${(e as Error).message}` : `Delete failed: ${(e as Error).message}`);
      }
    } finally {
      setProjectOp(null);
    }
  }, [de, projectId, showProjectError]);

  // ── Init ──────────────────────────────────────────────────────────────────
  // Gate Init auf `activeTenantId`: ohne aktiven Tenant koennen wir die
  // tenant-scoped Keys nicht lesen. Beim ersten Lauf wandern vorhandene
  // Legacy-Keys per `migrateLegacy` in den Scope, damit bestehende Nutzer
  // ihren zuletzt offenen Canvas behalten. `initRanRef` verhindert, dass
  // der Effect bei spaeteren Tenant-Wechseln erneut zuschlaegt — der
  // harte Reload in `switchTenant` nimmt sich dieser Faelle an.
  //
  // `initDone` als State (nicht nur Ref) triggert das Re-Render nachdem
  // das Init abgeschlossen ist. Es fixt den "Willkommen im Canvas"-Flash,
  // den User beim Seitenwechsel sahen: zwischen Mount und der Resolution
  // von activeTenantId ist projectOp=null und nodes=[], also erfüllt das
  // Empty-State-Rendering seine Bedingungen — obwohl wir gleich ein
  // Projekt laden werden. Jetzt gate-en wir das Empty-State auf
  // initDone && !projectOp, sodass vor dem ersten Init-Durchlauf gar
  // nichts gerendert wird statt des irreführenden Willkommensbildschirms.
  const initRanRef = useRef(false);
  const [initDone, setInitDone] = useState(false);
  useEffect(() => {
    if (initRanRef.current) return;
    if (!activeTenantId) return; // wait until tenant is known
    initRanRef.current = true;

    // Einmalige Migration der 4 Legacy-Keys in den Tenant-Scope. Idempotent:
    // wenn die gescopten Keys schon gesetzt sind, tut migrateLegacy nichts.
    tenantStorage.migrateLegacy(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);
    tenantStorage.migrateLegacy(activeTenantId, TENANT_STORAGE_KEYS.canvasHistory);
    tenantStorage.migrateLegacy(activeTenantId, TENANT_STORAGE_KEYS.transferToCanvas);
    tenantStorage.migrateLegacy(activeTenantId, TENANT_STORAGE_KEYS.canvasProject);

    loadProjects();

    // Check if transferring an analysis from main page
    const transferRaw = (() => {
      const v = tenantStorage.get(activeTenantId, TENANT_STORAGE_KEYS.transferToCanvas);
      tenantStorage.remove(activeTenantId, TENANT_STORAGE_KEYS.transferToCanvas);
      return v;
    })();
    if (transferRaw) {
      try {
        const { query, result } = JSON.parse(transferRaw);
        if (query && result) {
          const id = `transfer-${Date.now()}`;
          const qNode: QueryNode = {
            id, nodeType: "query", x: 80, y: 80,
            query, locale: "de", status: "done",
            synthesis: result.synthesis ?? "",
            result, collapsed: false, createdAt: Date.now(),
          };
          const derived = computeDerivedNodes(id, 80, 80, result);
          const conns: Connection[] = derived.map(d => ({ from: id, to: d.id, derived: true }));
          setNodes([qNode, ...derived]);
          setConnections(conns);
          setZoom(0.7);
          return; // skip all other init paths
        }
      } catch { /* ignore malformed transfer data */ }
    }

    // Resolve which project to load: URL param > one-shot tenant-scoped storage > persisted active canvas
    const urlProjectId = (() => { try { return new URLSearchParams(window.location.search).get("project"); } catch { return null; } })();
    const fromProjects = (() => {
      const v = tenantStorage.get(activeTenantId, TENANT_STORAGE_KEYS.canvasProject);
      tenantStorage.remove(activeTenantId, TENANT_STORAGE_KEYS.canvasProject);
      return v;
    })();
    const activeId = urlProjectId ?? fromProjects ?? tenantStorage.get(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);

    if (activeId) {
      // Persist immediately so the tenant-scoped key is in sync with the URL param
      tenantStorage.set(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas, activeId);
      // Use the proper loadProject function which handles schema versions,
      // error states, 404 cleanup, and localStorage persistence correctly.
      loadProject(activeId);
    } else {
      // No project to load — try localStorage node cache or show empty state
      const saved = loadFromStorage();
      if (saved && saved.nodes.length > 0) {
        setNodes(saved.nodes); setConnections(saved.conns);
        setPanX(saved.pan.x); setPanY(saved.pan.y); setZoom(saved.zoom);
      } else {
        setNodes([]);
        setConnections([]);
        setZoom(1);
      }
    }
    // Signal "we've evaluated the init pathway" — the welcome empty
    // state is only allowed to render after this flips.
    setInitDone(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  // Seed the undo history with the initial state once nodes are loaded
  const historySeededRef = useRef(false);
  useEffect(() => {
    if (!historySeededRef.current && nodesRef.current.length > 0) {
      historySeededRef.current = true;
      pushHistory();
    }
  }, [nodes, pushHistory]);

  // Viewport size tracking (for Minimap)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(() => {
      setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleLayer = useCallback((layer: CanvasLayer) => {
    setHiddenLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer); else next.add(layer);
      return next;
    });
  }, []);

  const handleSetNodeStatus = useCallback((id: string, status: NodeStatus) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, nodeStatus: status } : n));
  }, []);

  const handleSetTags = useCallback((id: string, tags: string[]) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, tags } : n));
  }, []);

  const handleAddTag = useCallback((id: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const existing = (n as CanvasNode & { tags?: string[] }).tags ?? [];
      if (existing.includes(trimmed)) return n;
      return { ...n, tags: [...existing, trimmed] };
    }));
  }, []);

  const handleRemoveTag = useCallback((id: string, tag: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const existing = (n as CanvasNode & { tags?: string[] }).tags ?? [];
      return { ...n, tags: existing.filter(t => t !== tag) };
    }));
  }, []);

  const pipelineChain = useMemo<Set<string>>(() => {
    if (!selectedId) return new Set();
    const visited = new Set<string>();
    const queue = [selectedId];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      connections.forEach(c => {
        if (c.from === id && !visited.has(c.to)) queue.push(c.to);
        if (c.to === id && !visited.has(c.from)) queue.push(c.from);
      });
    }
    return visited;
  }, [selectedId, connections]);

  const visibleNodes = useMemo(() =>
    nodes.filter(n => !hiddenLayers.has(NODE_LAYER[n.nodeType] ?? "karte")),
  [nodes, hiddenLayers]);

  // Collect all unique tags across all nodes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach(n => { (n.tags ?? []).forEach(t => tagSet.add(t)); });
    return Array.from(tagSet).sort();
  }, [nodes]);

  const canvasGroups = useMemo<CanvasGroup[]>(() => {
    const doneQueries = queryNodes.filter(n => n.status === "done" && (n.result?.matchedTrendIds?.length ?? 0) > 0);
    if (doneQueries.length < 2) return [];

    const groups: Set<string>[] = [];
    doneQueries.forEach(q => {
      const myIds = new Set(q.result!.matchedTrendIds!);
      let merged = false;
      for (const g of groups) {
        const gNodes = [...g].map(id => doneQueries.find(n => n.id === id)!).filter(Boolean);
        const gIds = new Set(gNodes.flatMap(n => n.result!.matchedTrendIds!));
        const shared = [...myIds].filter(id => gIds.has(id)).length;
        if (shared >= 2) { g.add(q.id); merged = true; break; }
      }
      if (!merged) groups.push(new Set([q.id]));
    });

    const colors = ["#1A9E5A", "#2563EB", "#8B5CF6", "#F97316", "#0369A1"];
    return groups.filter(g => g.size >= 2).map((g, i) => {
      const gNodeIds = [...g];
      // Bounds must cover the queries AND every descendant (insights,
      // scenarios, decisions, causalgraph, …). Otherwise the group outline
      // ends at the query row while the actual derived cards sit outside.
      // `nodeIds` stays query-only (used for tag dimming / membership checks),
      // but `boundsNodeIds` includes transitive children.
      const boundsNodeIds = new Set<string>(gNodeIds);
      let added = true;
      while (added) {
        added = false;
        for (const n of nodes) {
          if (n.parentId && boundsNodeIds.has(n.parentId) && !boundsNodeIds.has(n.id)) {
            boundsNodeIds.add(n.id);
            added = true;
          }
        }
      }
      const gNodes = Array.from(boundsNodeIds).map(id => nodes.find(n => n.id === id)!).filter(Boolean);
      const xs = gNodes.map(n => n.x);
      const ys = gNodes.map(n => n.y);
      const PAD = 40;
      const bounds = {
        x: Math.min(...xs) - PAD,
        y: Math.min(...ys) - PAD,
        w: Math.max(...gNodes.map(n => n.x + getNodeWidth(n))) - Math.min(...xs) + PAD * 2,
        h: Math.max(...gNodes.map(n => n.y + getNodeHeight(n))) - Math.min(...ys) + PAD * 2,
      };
      const allIds = gNodeIds.flatMap(id => {
        const q = doneQueries.find(n => n.id === id);
        return q?.result?.matchedTrendIds ?? [];
      });
      const freq: Record<string, number> = {};
      allIds.forEach(id => { freq[id] = (freq[id] ?? 0) + 1; });
      const topTrend = Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "";
      const label = topTrend.replace("mega-","").replace("macro-","").replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()).slice(0,24);
      return { id: `group-${i}`, nodeIds: gNodeIds, label, color: colors[i % colors.length], bounds };
    });
  }, [queryNodes, nodes]);

  // Merged group lookup: nodeId → group color (auto + user groups)
  const nodeGroupColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of canvasGroups) { for (const id of g.nodeIds) map.set(id, g.color); }
    // User groups override auto groups
    for (const g of userGroups) { for (const id of g.nodeIds) map.set(id, g.color); }
    return map;
  }, [canvasGroups, userGroups]);

  // Tag + group membership maps for ConnectionsSVG and group dimming
  const nodeTagMap = useMemo(() => {
    const m = new Map<string, string[]>();
    nodes.forEach(n => m.set(n.id, n.tags ?? []));
    return m;
  }, [nodes]);

  const nodeGroupMap = useMemo(() => {
    const m = new Map<string, string>();
    [...canvasGroups, ...userGroups].forEach(g => {
      g.nodeIds.forEach(id => m.set(id, g.id));
    });
    return m;
  }, [canvasGroups, userGroups]);

  // Duplicate query-title index: if two queries share the same text
  // (common when iterating or re-running), assign each a small "#N" suffix
  // (1,2,3…) ordered by createdAt so headers stay distinguishable.
  // Unique queries get 0 (rendered as nothing).
  const queryDupIndex = useMemo(() => {
    const m = new Map<string, number>();
    const buckets = new Map<string, QueryNode[]>();
    nodes.forEach(n => {
      if (n.nodeType !== "query") return;
      const q = n as QueryNode;
      const key = (q.query ?? "").trim().toLowerCase();
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(q);
    });
    buckets.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => a.createdAt - b.createdAt);
      list.forEach((q, i) => m.set(q.id, i + 1));
    });
    return m;
  }, [nodes]);

  // ── Canvas Export ────────────────────────────────────────────────────────

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const exportCanvas = useCallback((format: "markdown" | "json" | "pdf") => {
    setExportMenuOpen(false);
    if (format === "json") {
      const state = { nodes, conns: connections, pan: { x: panX, y: panY }, zoom, v: 2 };
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sis-canvas-${projectName || "export"}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    // Markdown export
    const doneQs = nodes.filter(n => n.nodeType === "query" && (n as QueryNode).synthesis) as QueryNode[];
    const lines: string[] = [
      `# SIS Canvas Export`,
      `_${new Date().toLocaleString("de-DE")} · ${projectName || "Canvas"} · ${doneQs.length} ${de ? "Analysen" : "analyses"}_`,
      "", "---", "",
    ];
    doneQs.forEach((q, idx) => {
      lines.push(`## ${idx + 1}. ${q.query}`, "");
      if (q.synthesis) lines.push(q.synthesis, "");
      // Insights
      const insights = nodes.filter(n => n.parentId === q.id && n.nodeType === "insight") as DerivedNode[];
      if (insights.length) {
        lines.push(`### ${de ? "Erkenntnisse" : "Insights"}`, "");
        insights.forEach(ins => lines.push(`- ${ins.content}`, ""));
      }
      // Scenarios
      const scenarios = nodes.filter(n => n.parentId === q.id && n.nodeType === "scenario") as DerivedNode[];
      if (scenarios.length) {
        lines.push(`### ${de ? "Szenarien" : "Scenarios"}`, "");
        scenarios.forEach(sc => {
          const prob = sc.probability != null ? ` (${Math.round(sc.probability * 100)}%)` : "";
          lines.push(`- **${sc.label || sc.content.slice(0, 60)}**${prob}: ${sc.content}`, "");
        });
      }
      // Decisions
      const decisions = nodes.filter(n => n.parentId === q.id && n.nodeType === "decision") as DerivedNode[];
      if (decisions.length) {
        lines.push(`### ${de ? "Empfehlungen" : "Decisions"}`, "");
        decisions.forEach(dec => lines.push(`- ${dec.content}`, ""));
      }
      lines.push("---", "");
    });
    const md = lines.join("\n");

    if (format === "pdf") {
      // PDF export: render markdown as styled HTML, open print dialog
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>SIS Export</title><style>
          body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; font-size: 13px; }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 16px; font-weight: 700; margin-top: 28px; border-bottom: 1px solid #E8E8E8; padding-bottom: 6px; }
          h3 { font-size: 13px; font-weight: 700; margin-top: 16px; color: #555; }
          hr { border: none; border-top: 1px solid #E8E8E8; margin: 20px 0; }
          ul { padding-left: 20px; }
          li { margin-bottom: 6px; }
          em { color: #777; font-size: 11px; }
          @media print { body { margin: 0; } }
        </style></head><body>${md
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/^---$/gm, "<hr>")
          .replace(/^_(.+)_$/gm, "<p><em>$1</em></p>")
          .replace(/^- \*\*(.+?)\*\*(.*)$/gm, "<li><strong>$1</strong>$2</li>")
          .replace(/^- (.+)$/gm, "<li>$1</li>")
          .replace(/\n\n/g, "</p><p>")
        }</body></html>`);
        printWin.document.close();
        setTimeout(() => printWin.print(), 400);
      }
      return;
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sis-canvas-${projectName || "export"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [nodes, connections, panX, panY, zoom, projectName, de]);

  const generateBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingOpen(true);
    setBriefingText("");

    const qNodes = queryNodes.filter(n => n.status === "done");
    const chain = qNodes.map(q => {
      const insights = nodes.filter(n => n.nodeType === "insight" && (n as DerivedNode).parentId === q.id) as DerivedNode[];
      const decisions = nodes.filter(n => n.nodeType === "decision" && (n as DerivedNode).parentId === q.id) as DerivedNode[];
      return `FRAGE: ${q.query}\nSYNTHESE: ${q.synthesis?.slice(0,400) ?? ""}\nERKENNTNISSE: ${insights.map(i => i.content).join("; ")}\nEMPFEHLUNG: ${decisions.map(d => d.content).join("; ")}`;
    }).join("\n\n---\n\n");

    try {
      const res = await fetch("/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Erstelle ein prägnantes strategisches Briefing-Memo (max 500 Wörter) aus folgendem Canvas-Kontext. Struktur: Executive Summary (2-3 Sätze), Kernerkenntnisse (3-5 Bullet Points), Handlungsempfehlungen (3 konkrete Schritte), Kritische Unsicherheiten (2-3 Punkte).\n\nCanvas-Kontext:\n${chain}`,
          locale,
        }),
      });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6).trim());
            if (evt.type === "complete" && evt.result?.synthesis) {
              setBriefingText(evt.result.synthesis);
            }
          } catch {}
        }
      }
    } catch (e) {
      setBriefingText(String(e));
    } finally {
      setBriefingLoading(false);
    }
  }, [queryNodes, nodes, locale]);

  // Debounced localStorage persist
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const doneNodes = nodes.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
      if (doneNodes.length > 0) saveToStorage(doneNodes, connections, { x: panX, y: panY }, zoom);
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, connections, panX, panY, zoom]);

  // FIXED: DAT-06 — Flush pending save before project switch to prevent saving old nodes to new project
  const prevProjectIdRef = useRef<string | null>(projectId);
  useEffect(() => {
    if (prevProjectIdRef.current && prevProjectIdRef.current !== projectId) {
      // Project changed — flush any pending DB save for the OLD project immediately
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
        dbSaveTimerRef.current = undefined;
        // Note: we do NOT call saveCanvasToDb here because nodes/connections
        // state may already be reset to the new project's data. The loadProject
        // function handles this (see DAT-07 below).
      }
    }
    prevProjectIdRef.current = projectId;
  }, [projectId]);

  // Debounced DB persist (only when a project is active)
  useEffect(() => {
    if (!projectId) return;
    if (nodesRef.current.length === 0) return; // don't save empty canvas
    clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(() => {
      saveCanvasToDb(projectId);
    }, 2000);
    return () => clearTimeout(dbSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, connections, panX, panY, zoom, projectId, userGroups]);

  // Flush pending DB save immediately (used by unload, visibility, and unmount handlers)
  const flushPendingSave = useCallback(() => {
    const pid = projectIdRef.current;
    if (!pid || nodesRef.current.length === 0) return;
    if (dbSaveTimerRef.current) {
      clearTimeout(dbSaveTimerRef.current);
      dbSaveTimerRef.current = undefined;
    }
    const doneNodes = nodesRef.current.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
    if (doneNodes.length === 0) return;
    // Synchronous localStorage save as last resort
    saveToStorage(doneNodes, connectionsRef.current, { x: panXRef.current, y: panYRef.current }, zoomRef.current);
    // Best-effort DB save via sendBeacon (works even during unload)
    const state = { nodes: doneNodes, conns: connectionsRef.current, pan: { x: panXRef.current, y: panYRef.current }, zoom: zoomRef.current, v: 2, userGroups: userGroupsRef.current.length > 0 ? userGroupsRef.current : undefined };
    try { navigator.sendBeacon(`/api/v1/canvas/${pid}`, new Blob([JSON.stringify({ canvasState: state })], { type: "application/json" })); } catch {}
  }, []);

  // Save on browser close / tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
      flushPendingSave();
    };
    // Save when tab becomes hidden (covers Alt+Tab, switching tabs, mobile backgrounding)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSave();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingSave]);

  // Flush pending save on component unmount (Next.js client-side navigation)
  useEffect(() => {
    return () => {
      // On unmount, flush any pending debounced save so SPA navigation doesn't lose data
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
        dbSaveTimerRef.current = undefined;
        const pid = projectIdRef.current;
        if (pid && nodesRef.current.length > 0) {
          const doneNodes = nodesRef.current.filter(n => n.nodeType !== "query" || (n as QueryNode).status === "done" || (n as QueryNode).status === "error");
          if (doneNodes.length > 0) {
            const state = { nodes: doneNodes, conns: connectionsRef.current, pan: { x: panXRef.current, y: panYRef.current }, zoom: zoomRef.current, v: 2 };
            try { navigator.sendBeacon(`/api/v1/canvas/${pid}`, new Blob([JSON.stringify({ canvasState: state })], { type: "application/json" })); } catch {}
          }
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global pointer events ─────────────────────────────────────────────────
  //
  // INVARIANT (was EDGE-18, resolved 2026-04-18):
  // The `move` and `up` handlers below are attached **once** via
  // `useEffect(() => ..., [])` with empty deps. This is deliberate — attaching
  // global `pointermove`/`pointerup` listeners on every render would leak
  // handlers and fire race conditions during drag.
  //
  // Because the effect runs once, the handlers close over the **initial**
  // render's values. Every piece of mutable state they need at event time
  // therefore has to come from a ref, not from a React state variable or
  // a closure-captured prop. Current live refs used here:
  //   draggingRef, resizingRef, panningRef, portDragRef, portDropCanvasPosRef,
  //   zoomRef, panXRef, panYRef, snapToGridRef, viewportRef, nodesRef.
  // State *setters* (setNodes, setPanX, …) are React-stable and safe to call
  // directly; `pushHistory` is a `useCallback([])` so its reference is also
  // stable. If you add a new piece of state that these handlers need to read
  // live, add a ref alongside the useState and update it in a mirror useEffect
  // — do NOT add the value to the deps array, that will re-attach the handlers
  // on every change and break drag continuity.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (draggingRef.current) {
        const { id, sx, sy, ox, oy } = draggingRef.current;
        const dx = (e.clientX - sx) / zoomRef.current;
        const dy = (e.clientY - sy) / zoomRef.current;
        // FIXED: UX-11 — Optional snap-to-grid (20px grid)
        const rawX = ox + dx;
        const rawY = oy + dy;
        const finalX = snapToGridRef.current ? Math.round(rawX / 20) * 20 : rawX;
        const finalY = snapToGridRef.current ? Math.round(rawY / 20) * 20 : rawY;
        setNodes(prev => prev.map(n => n.id === id ? { ...n, x: finalX, y: finalY } : n));
      } else if (resizingRef.current) {
        const { id, dir, startX, startW, startY, startH } = resizingRef.current;
        if (dir === "h" || dir === "both") {
          const dx = (e.clientX - startX) / zoomRef.current;
          const newW = Math.max(200, Math.min(900, Math.round(startW + dx)));
          setNodes(prev => prev.map(n => n.id === id ? { ...n, customWidth: newW } : n));
        }
        if (dir === "v" || dir === "both") {
          const dy = (e.clientY - startY) / zoomRef.current;
          const newH = Math.max(60, Math.min(1400, Math.round(startH + dy)));
          setNodes(prev => prev.map(n => n.id === id ? { ...n, customHeight: newH } : n));
        }
      } else if (panningRef.current) {
        const { sx, sy, opx, opy } = panningRef.current;
        setPanX(opx + e.clientX - sx);
        setPanY(opy + e.clientY - sy);
      } else if (portDragRef.current) {
        const rect2 = viewportRef.current?.getBoundingClientRect();
        if (rect2) {
          const cx = (e.clientX - rect2.left - panXRef.current) / zoomRef.current;
          const cy = (e.clientY - rect2.top - panYRef.current) / zoomRef.current;
          setPortDragPreview({
            x1: portDragRef.current.sourceCanvasX,
            y1: portDragRef.current.sourceCanvasY,
            x2: cx, y2: cy,
          });
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (draggingRef.current || resizingRef.current) pushHistory();
      draggingRef.current = null; resizingRef.current = null; panningRef.current = null;
      if (portDragRef.current) {
        const { nodeId, prefill, startClientX, startClientY } = portDragRef.current;
        const didDrag = Math.abs(e.clientX - startClientX) > 12 || Math.abs(e.clientY - startClientY) > 12;
        portDragRef.current = null;
        setPortDragPreview(null);
        const rect2 = viewportRef.current?.getBoundingClientRect();
        if (didDrag && rect2) {
          const dropCanvasX = (e.clientX - rect2.left - panXRef.current) / zoomRef.current;
          const dropCanvasY = (e.clientY - rect2.top - panYRef.current) / zoomRef.current;
          portDropCanvasPosRef.current = { x: dropCanvasX, y: dropCanvasY };
          setNodePickerPos({ x: e.clientX - rect2.left, y: e.clientY - rect2.top });
        } else {
          portDropCanvasPosRef.current = null;
          setNodePickerPos(null);
        }
        setIterateCtx({ parentId: nodeId, prefill });
        setNodePickerVisible(true);
        setSelectedId(nodeId);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  // Ref for deleteNode to avoid block-scoping issue in keyboard handler
  const deleteNodeRef = useRef<(id: string) => void>(() => {});

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCmdVisible(false); setCmdPrefill(""); setProjectDropdownOpen(false); setNodePickerVisible(false); setIterateCtx(null); setDetailNodeId(null); setDeleteConfirmId(null); setNodePickerPos(null); portDropCanvasPosRef.current = null; portDragRef.current = null; setPortDragPreview(null); setSortMenuOpen(false); setMultiSelectedIds(new Set()); setEditingGroupId(null); setActiveTagFilter(null);
        // Also abort any active streams on Escape
        activeStreamsRef.current.forEach(ctrl => ctrl.abort());
        activeStreamsRef.current.clear();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !cmdVisible) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        setDeleteConfirmId(selectedId);
      }
      if (e.key === "Enter" && deleteConfirmId) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        deleteNodeRef.current(deleteConfirmId);
        setDeleteConfirmId(null);
      }
      // Undo: Ctrl/Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault(); undo();
      }
      // Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault(); redo();
      }
      // FIXED: UX-12 — Copy/paste for canvas nodes
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedId) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        const selected = nodesRef.current.filter(n => n.id === selectedId);
        if (selected.length > 0) {
          clipboardRef.current = selected.map(n => ({ ...n }));
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboardRef.current.length > 0) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        pushHistory();
        const pasted = clipboardRef.current.map(n => ({
          ...n,
          id: uid(),
          x: n.x + 40,
          y: n.y + 40,
          createdAt: Date.now(),
        }));
        setNodes(prev => [...prev, ...pasted]);
      }
    };
    const trackShiftDown = (e: KeyboardEvent) => { if (e.key === "Shift") shiftHeldRef.current = true; };
    const trackShiftUp = (e: KeyboardEvent) => { if (e.key === "Shift") shiftHeldRef.current = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keydown", trackShiftDown);
    window.addEventListener("keyup", trackShiftUp);
    window.addEventListener("blur", () => { shiftHeldRef.current = false; });
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keydown", trackShiftDown); window.removeEventListener("keyup", trackShiftUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, cmdVisible, deleteConfirmId, undo, redo, pushHistory]);

  // ── Positioning ───────────────────────────────────────────────────────────

  const getNextQueryPos = useCallback((parentId?: string): { x: number; y: number } => {
    if (nextQueryPosOverrideRef.current) {
      const p = nextQueryPosOverrideRef.current;
      nextQueryPosOverrideRef.current = null;
      return p;
    }
    if (parentId) {
      const parent = nodesRef.current.find(n => n.id === parentId);
      if (parent) {
        const parentW = parent.customWidth ?? (
          parent.nodeType === "query" ? QUERY_NODE_W :
          parent.nodeType === "list"  ? LIST_NODE_W  :
          parent.nodeType === "file"  ? FILE_NODE_W  : DERIVED_W
        );
        const siblings = nodesRef.current.filter(n => n.parentId === parentId && n.nodeType === "query");
        return { x: parent.x + parentW + 80, y: parent.y + siblings.length * (QUERY_NODE_H + 40) };
      }
    }
    if (nodesRef.current.length === 0) {
      const vp = viewportRef.current?.getBoundingClientRect();
      if (vp) return { x: (vp.width / 2 - QUERY_NODE_W / 2 - panXRef.current) / zoomRef.current, y: (vp.height / 2 - 150 - panYRef.current) / zoomRef.current };
      return { x: 80, y: 80 };
    }
    const last = [...nodesRef.current].filter(n => n.nodeType === "query").sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!last) return { x: 80, y: 80 };
    return { x: last.x, y: last.y + getNodeHeight(last) + 60 };
  }, []);

  // ── Query submission ──────────────────────────────────────────────────────

  const submitQuery = useCallback((query: string, parentId?: string, opts?: { refreshed?: boolean }) => {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    // ── Slash commands ───────────────────────────────────────────────────
    if (lower === "/clear") {
      if (!window.confirm(de ? 'Gesamtes Canvas löschen? Diese Aktion kann nicht rückgängig gemacht werden.' : 'Clear entire canvas? This action cannot be undone.')) {
        setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
        return;
      }
      pushHistory();
      setNodes([]); setConnections([]);
      setPanX(0); setPanY(0); setZoom(1);
      setSelectedId(null); setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      if (projectIdRef.current) {
        fetchWithTimeout(`/api/v1/canvas/${projectIdRef.current}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canvasState: null }),
        }).catch(() => {});
      }
      return;
    }
    if (lower === "/export") {
      exportCanvas("markdown");
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      return;
    }
    if (lower.startsWith("/trend ") || lower === "/trend") {
      const topic = trimmed.slice(6).trim();
      const q = topic
        ? `Analysiere den Trend: ${topic} — Entwicklung, Treiber, Auswirkungen und Zeithorizont.`
        : "Welche Megatrends prägen die strategische Landschaft aktuell?";
      // Fall through to normal query with the generated query text
      pushHistory();
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      const id2 = uid();
      const pos2 = getNextQueryPos(parentId);
      const qNode2: QueryNode = {
        id: id2, nodeType: "query", x: pos2.x, y: pos2.y, query: q, locale,
        status: "loading", synthesis: "", result: null, collapsed: false,
        parentId, createdAt: Date.now(),
      };
      setNodes(prev => [...prev, qNode2]);
      if (parentId) setConnections(prev => [...prev, { from: parentId, to: id2, derived: false }]);
      setSelectedId(id2);
      const abortCtrl2 = new AbortController();
      activeStreamsRef.current.set(id2, abortCtrl2);
      streamQuery(q, locale,
        (chunk) => setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
        (result) => {
          activeStreamsRef.current.delete(id2);
          setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, status: "done", synthesis: result.synthesis || (n as QueryNode).synthesis, result } as QueryNode : n));
          const derived = computeDerivedNodes(id2, pos2.x, pos2.y, result);
          derived.forEach((d, i) => { setTimeout(() => { setNodes(prev => [...prev, d]); setConnections(prev => [...prev, { from: id2, to: d.id, derived: true }]); }, 200 + i * 90); });
        },
        (msg) => { activeStreamsRef.current.delete(id2); setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n)); },
        (phase) => setNodes(prev => prev.map(n => n.id === id2 && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
        abortCtrl2.signal,
      );
      return;
    }
    if (lower.startsWith("/scenario") || lower.startsWith("/signal")) {
      const isScenario = lower.startsWith("/scenario");
      const topic = trimmed.slice(isScenario ? 9 : 7).trim();
      const q = isScenario
        ? (topic
          ? `Entwickle optimistische, wahrscheinliche und pessimistische Szenarien für: ${topic}`
          : "Entwickle Szenarien für die wichtigsten strategischen Unsicherheiten.")
        : (topic
          ? `Identifiziere schwache Signale und Frühwarnzeichen für: ${topic}`
          : "Welche schwachen Signale und Frühwarnzeichen gibt es aktuell?");
      pushHistory();
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      const id3 = uid();
      const pos3 = getNextQueryPos(parentId);
      const qNode3: QueryNode = {
        id: id3, nodeType: "query", x: pos3.x, y: pos3.y, query: q, locale,
        status: "loading", synthesis: "", result: null, collapsed: false,
        parentId, createdAt: Date.now(),
      };
      setNodes(prev => [...prev, qNode3]);
      if (parentId) setConnections(prev => [...prev, { from: parentId, to: id3, derived: false }]);
      setSelectedId(id3);
      const abortCtrl3 = new AbortController();
      activeStreamsRef.current.set(id3, abortCtrl3);
      streamQuery(q, locale,
        (chunk) => setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
        (result) => {
          activeStreamsRef.current.delete(id3);
          setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, status: "done", synthesis: result.synthesis || (n as QueryNode).synthesis, result } as QueryNode : n));
          const derived = computeDerivedNodes(id3, pos3.x, pos3.y, result);
          derived.forEach((d, i) => { setTimeout(() => { setNodes(prev => [...prev, d]); setConnections(prev => [...prev, { from: id3, to: d.id, derived: true }]); }, 200 + i * 90); });
        },
        (msg) => { activeStreamsRef.current.delete(id3); setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n)); },
        (phase) => setNodes(prev => prev.map(n => n.id === id3 && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
        abortCtrl3.signal,
      );
      return;
    }

    // ── Test-Modus: "test" in Command-Line eingeben ───────────────────────
    if (lower === "test" && !parentId) {
      pushHistory();
      const { nodes: testNodes, conns: testConns } = buildTestDataset();
      setNodes(testNodes);
      setConnections(testConns);
      setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);
      setPanX(0); setPanY(0); setZoom(0.72);
      setSelectedId(null);
      return;
    }

    pushHistory();
    const id = uid();
    const pos = getNextQueryPos(parentId);
    const qNode: QueryNode = {
      id, nodeType: "query", x: pos.x, y: pos.y, query, locale,
      status: "loading", synthesis: "", result: null, collapsed: false,
      parentId, createdAt: Date.now(),
    };
    setNodes(prev => [...prev, qNode]);
    if (parentId) setConnections(prev => [...prev, { from: parentId, to: id, derived: false, refreshed: opts?.refreshed }]);
    setSelectedId(id);
    setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null);

    // ── Context passing: include parent synthesis so follow-up steps can build on previous results
    let queryWithContext = query;
    if (parentId) {
      const parentNode = nodesRef.current.find(n => n.id === parentId);
      if (parentNode) {
        const parentText = parentNode.nodeType === "query"
          ? (parentNode as QueryNode).synthesis
          : (parentNode as DerivedNode).content;
        if (parentText && parentText.length > 20) {
          queryWithContext = `KONTEXT AUS VORHERIGEM ANALYSESCHRITT:\n${parentText.slice(0, 2000)}\n\n---\n\n${query}`;
        }
      }
    }

    // Create an AbortController for this stream so it can be cancelled
    const abortController = new AbortController();
    activeStreamsRef.current.set(id, abortController);

    streamQuery(
      queryWithContext, locale,
      (chunk) => setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
      (result) => {
        activeStreamsRef.current.delete(id);
        setNodes(prev => prev.map(n =>
          n.id === id && n.nodeType === "query"
            ? { ...n, status: "done", synthesis: result.synthesis || (n as QueryNode).synthesis, result } as QueryNode
            : n
        ));
        const derived = computeDerivedNodes(id, pos.x, pos.y, result);
        derived.forEach((d, i) => {
          setTimeout(() => {
            setNodes(prev => [...prev, d]);
            setConnections(prev => [...prev, { from: id, to: d.id, derived: true }]);
          }, 200 + i * 90);
        });

        // Auto-rename session after first successful query if still has default name
        const pid = projectIdRef.current;
        if (pid && !hasAutoNamedRef.current) {
          // BUGFIX: "Aktuelles Projekt" (what Home's syncToCanvasDb uses when it
          // creates a canvas on-the-fly) was missing — so Home-created canvases
          // kept the generic name forever and piled up as duplicates in the
          // project list. "New Project" (capital P) added to mirror /projects/page.tsx.
          const DEFAULT_NAMES = ["Aktuelle Session", "Neue Session", "Neues Projekt", "Aktuelles Projekt", "New project", "New Project"];
          // Use a function updater pattern: read current name from state
          setProjectName(prevName => {
            if (DEFAULT_NAMES.includes(prevName) || !prevName.trim()) {
              hasAutoNamedRef.current = true;
              const autoName = query.substring(0, 60);
              // Fire-and-forget rename API call
              fetchWithTimeout(`/api/v1/canvas/${pid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: autoName }),
              }).catch(() => {});
              // Update project list too
              setProjects(prev => prev.map(p => p.id === pid ? { ...p, name: autoName } : p));
              return autoName;
            }
            // Name was already customized — mark as done and don't rename
            hasAutoNamedRef.current = true;
            return prevName;
          });
        }
      },
      (msg) => {
        activeStreamsRef.current.delete(id);
        setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, status: "error", errorMsg: msg } as QueryNode : n));
      },
      (phase) => setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
      abortController.signal,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, getNextQueryPos, setPanX, setPanY, setZoom, pushHistory, de, exportCanvas]);

  // ── Node actions ──────────────────────────────────────────────────────────

  const DERIVED_TYPES = new Set(["insight","scenario","decision","followup","dimensions","causalgraph"]);
  const deleteNode = useCallback((id: string) => {
    pushHistory();
    // Cancel any active stream writing to this node before deleting
    const streamController = activeStreamsRef.current.get(id);
    if (streamController) {
      streamController.abort();
      activeStreamsRef.current.delete(id);
    }
    // Only cascade-delete auto-generated derived children; preserve user-created nodes (note/idea/list/file/query)
    setNodes(prev => prev.filter(n => n.id !== id && !(n.parentId === id && DERIVED_TYPES.has(n.nodeType))));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    setSelectedId(prev => prev === id ? null : prev);
    setDetailNodeId(prev => prev === id ? null : prev);
  }, [pushHistory]);
  deleteNodeRef.current = deleteNode;

  const handleSelectNode = useCallback((id: string) => {
    if (shiftHeldRef.current) {
      // Multi-select mode
      setMultiSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }
    // Normal select — clear multi-select
    setMultiSelectedIds(new Set());
    setSelectedId(id);
    setDetailNodeId(id);
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "query" ? { ...n, collapsed: !n.collapsed } as QueryNode : n));
  }, []);

  const handleFollowUp = useCallback((nodeId: string, prefill?: string) => {
    setCmdParentId(nodeId); setCmdPrefill(prefill ?? ""); setCmdVisible(true); setSelectedId(nodeId);
  }, []);

  const handleExplore = useCallback((nodeId: string, queryText: string) => {
    const n = nodesRef.current.find(x => x.id === nodeId);
    if (!n || n.nodeType === "query") return;
    const dNode = n as DerivedNode;
    const derivedType = dNode.nodeType;
    if (derivedType === "followup") {
      handleFollowUp(nodeId, queryText);
    } else if (derivedType === "dimensions" || derivedType === "causalgraph") {
      // Use the owning query as parentId so the new query attaches to the
      // correct level of the tree, not to the derived card itself.
      submitQuery(queryText, dNode.parentId);
    } else {
      submitQuery(queryText, nodeId);
    }
  }, [handleFollowUp, submitQuery]);

  const handleRefresh = useCallback((nodeId: string) => {
    const n = nodesRef.current.find(x => x.id === nodeId);
    if (!n || n.nodeType !== "query") return;
    submitQuery((n as QueryNode).query, nodeId, { refreshed: true });
  }, [submitQuery]);

  const handleUpdateNote = useCallback((id: string, content: string) => {
    pushHistory();
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "note" ? { ...n, content } : n));
  }, [pushHistory]);

  const handleUpdateIdea = useCallback((id: string, title: string, content: string) => {
    pushHistory();
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "idea" ? { ...n, title, content } : n));
  }, [pushHistory]);

  const handlePromoteIdea = useCallback((query: string) => {
    submitQuery(query);
  }, [submitQuery]);

  const handleUpdateList = useCallback((id: string, title: string, items: string[]) => {
    pushHistory();
    setNodes(prev => prev.map(n => n.id === id && n.nodeType === "list" ? { ...n, title, items } : n));
  }, [pushHistory]);

  const handlePromoteNote = useCallback((query: string) => {
    submitQuery(query);
  }, [submitQuery]);

  // ── View mode switching with per-view transform save/restore ──────────────
  const switchViewMode = useCallback((nextMode: ViewMode) => {
    // Save current transform for the active view
    viewTransformsRef.current[viewMode] = { x: panX, y: panY, z: zoom };
    // Restore transform for the target view (or reset)
    const saved = viewTransformsRef.current[nextMode];
    if (saved) {
      setPanX(saved.x); setPanY(saved.y); setZoom(saved.z);
    } else {
      setPanX(0); setPanY(0); setZoom(1);
    }
    // FIXED: EDGE-13 — Preserve selectedId and detailNodeId across view transitions
    // (Previously these would be implicitly cleared; now we intentionally keep them)
    setViewMode(nextMode);
  }, [viewMode, panX, panY, zoom]);

  // ── File upload ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, pos: { x: number; y: number }, parentId?: string) => {
    const id = uid();
    const placeholderNode: FileNode = {
      id, nodeType: "file", x: pos.x, y: pos.y,
      fileName: file.name, fileSize: file.size, fileType: file.type || "application/octet-stream",
      fileUrl: "", loading: true, createdAt: Date.now(), parentId,
    };
    setNodes(prev => [...prev, placeholderNode]);
    if (parentId) setConnections(prev => [...prev, { from: parentId, to: id, derived: true }]);
    setSelectedId(id);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetchWithTimeout("/api/v1/canvas/upload", { method: "POST", body: formData }, 60_000);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setNodes(prev => prev.map(n =>
        n.id === id && n.nodeType === "file"
          ? { ...n, fileUrl: json.fileUrl, textContent: json.textContent, loading: false }
          : n
      ));
    } catch {
      setNodes(prev => prev.filter(n => n.id !== id));
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    const pos = fileUploadPosRef.current ?? getNextQueryPos();
    const parentId = fileUploadParentRef.current ?? undefined;
    fileUploadPosRef.current = null;
    fileUploadParentRef.current = null;
    uploadFile(file, pos, parentId);
  }, [uploadFile, getNextQueryPos]);

  const triggerFileUpload = useCallback((pos: { x: number; y: number }, parentId?: string) => {
    fileUploadPosRef.current = pos;
    fileUploadParentRef.current = parentId ?? null;
    fileInputRef.current?.click();
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - panXRef.current) / zoomRef.current;
    const y = (e.clientY - rect.top - panYRef.current) / zoomRef.current;
    uploadFile(file, { x, y });
  }, [uploadFile]);

  const handleIterateFromNode = useCallback((nodeId: string, prefill: string) => {
    setIterateCtx({ parentId: nodeId, prefill });
    setNodePickerVisible(true);
    setSelectedId(nodeId);
  }, []);

  const handleNodeTypeSelect = useCallback((type: NewNodeType) => {
    setNodePickerVisible(false);
    const ctx = iterateCtxRef.current;
    setIterateCtx(null);

    // ── KI-Analyse types: open CommandBox with focused prefill ──────────────
    const ANALYSIS_PREFIXES: Partial<Record<NewNodeType, string>> = {
      query:     "",
      insights:  "Extrahiere die wichtigsten Erkenntnisse und Muster zu: ",
      scenarios: "Entwickle optimistische, wahrscheinliche und pessimistische Szenarien für: ",
      decision:  "Leite einen konkreten Handlungsrahmen und Empfehlungen ab für: ",
      followups: "Welche offenen Fragen und nächsten Schritte ergeben sich aus: ",
    };

    if (type in ANALYSIS_PREFIXES) {
      const prefix = ANALYSIS_PREFIXES[type] ?? "";
      const prefill = ctx ? `${prefix}${ctx.prefill}` : "";
      const parentId = ctx?.parentId ?? null;
      if (portDropCanvasPosRef.current) {
        nextQueryPosOverrideRef.current = {
          x: portDropCanvasPosRef.current.x - QUERY_NODE_W / 2,
          y: portDropCanvasPosRef.current.y - QUERY_NODE_H / 2,
        };
        portDropCanvasPosRef.current = null;
      }
      setCmdParentId(parentId); setCmdPrefill(prefill); setCmdVisible(true);
      setNodePickerPos(null);
      return;
    }

    // Position near parent if we have context — stack siblings vertically
    const getCtxPos = () => {
      if (portDropCanvasPosRef.current) {
        const p = portDropCanvasPosRef.current;
        portDropCanvasPosRef.current = null;
        return { x: p.x - DERIVED_W / 2, y: p.y - 60 };
      }
      if (!ctx) return getNextQueryPos();
      const parent = nodesRef.current.find(n => n.id === ctx.parentId);
      if (!parent) return getNextQueryPos();
      const parentW = parent.nodeType === "query"
        ? ((parent as QueryNode).customWidth ?? QUERY_NODE_W)
        : parent.nodeType === "list"
        ? ((parent as ListNode).customWidth ?? LIST_NODE_W)
        : parent.nodeType === "file"
        ? ((parent as FileNode).customWidth ?? FILE_NODE_W)
        : ((parent as DerivedNode | NoteNode | IdeaNode).customWidth ?? DERIVED_W);
      // Count existing non-query siblings to stack vertically with 30px gap
      const siblings = nodesRef.current.filter(n => n.parentId === ctx.parentId && n.nodeType !== "query");
      let yOffset = 0;
      for (const sib of siblings) {
        yOffset += getNodeHeight(sib) + 30;
      }
      return { x: parent.x + parentW + 64, y: parent.y + yOffset };
    };

    const pos = getCtxPos();
    const id = uid();
    pushHistory();

    if (type === "note") {
      const node: NoteNode = {
        id, nodeType: "note", x: pos.x, y: pos.y,
        content: ctx?.prefill ?? "", createdAt: Date.now(),
        parentId: ctx?.parentId,
      };
      setNodes(prev => [...prev, node]);
      if (ctx?.parentId) setConnections(prev => [...prev, { from: ctx.parentId, to: id, derived: true }]);
    } else if (type === "idea") {
      const node: IdeaNode = {
        id, nodeType: "idea", x: pos.x, y: pos.y,
        title: ctx?.prefill ? ctx.prefill.slice(0, 80) : "",
        content: "", createdAt: Date.now(),
        parentId: ctx?.parentId,
      };
      setNodes(prev => [...prev, node]);
      if (ctx?.parentId) setConnections(prev => [...prev, { from: ctx.parentId, to: id, derived: true }]);
    } else if (type === "list") {
      const node: ListNode = {
        id, nodeType: "list", x: pos.x, y: pos.y,
        title: ctx?.prefill ? ctx.prefill.slice(0, 80) : "",
        items: [""],
        createdAt: Date.now(),
        parentId: ctx?.parentId,
      };
      setNodes(prev => [...prev, node]);
      if (ctx?.parentId) setConnections(prev => [...prev, { from: ctx.parentId, to: id, derived: true }]);
    } else if (type === "file") {
      // Open file picker — upload will create the node
      triggerFileUpload(pos, ctx?.parentId);
      return; // node creation happens asynchronously in handleFileInputChange
    }
    setSelectedId(id);
    setNodePickerPos(null);
  }, [getNextQueryPos, triggerFileUpload]);

  const clearCanvas = useCallback(() => {
    if (!window.confirm(de ? "Gesamtes Canvas löschen? Diese Aktion kann nicht rückgängig gemacht werden." : "Clear entire canvas? This action cannot be undone.")) return;
    pushHistory();
    setNodes([]); setConnections([]);
    setPanX(0); setPanY(0); setZoom(1);
    setSelectedId(null); setCmdVisible(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    if (projectIdRef.current) {
      fetchWithTimeout(`/api/v1/canvas/${projectIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: null }),
      }).catch(() => {});
    }
  }, [de, pushHistory]);

  // ── Auto-reorganize layout ────────────────────────────────────────────────

  const reorganizeCanvas = useCallback((mode: SortMode = "tree") => {
    const ns = nodesRef.current;
    const conns = connectionsRef.current;
    if (ns.length === 0) return;

    // ── Time-based layout ──
    if (mode === "time") {
      // Group-aware: keep grouped nodes adjacent, then sort by time
      const allGroups = [...(canvasGroups ?? []), ...userGroupsRef.current];
      const nodeToGroupIdx = new Map<string, number>();
      allGroups.forEach((g, i) => { g.nodeIds.forEach(id => nodeToGroupIdx.set(id, i)); });
      const sorted = [...ns].sort((a, b) => {
        const gA = nodeToGroupIdx.get(a.id) ?? 999;
        const gB = nodeToGroupIdx.get(b.id) ?? 999;
        if (gA !== gB) return gA - gB;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });
      const COL_W = 460;
      const ROW_GAP = 30;
      const GROUP_GAP = 40;
      const COLS = Math.max(3, Math.ceil(Math.sqrt(sorted.length)));
      const colYs = Array(COLS).fill(80);
      const newPos = new Map<string, { x: number; y: number }>();
      let prevGroupIdx = -1;
      for (const n of sorted) {
        const curGroupIdx = nodeToGroupIdx.get(n.id) ?? -1;
        let bestCol = 0;
        for (let c = 1; c < COLS; c++) { if (colYs[c] < colYs[bestCol]) bestCol = c; }
        if (prevGroupIdx >= 0 && curGroupIdx !== prevGroupIdx && curGroupIdx >= 0) {
          colYs[bestCol] += GROUP_GAP;
        }
        newPos.set(n.id, { x: 80 + bestCol * COL_W, y: colYs[bestCol] });
        colYs[bestCol] += getNodeHeight(n) + ROW_GAP;
        prevGroupIdx = curGroupIdx;
      }
      setNodes(prev => prev.map(n => { const p = newPos.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
      setPanX(20); setPanY(20);
      setZoom(Math.min(0.85, window.innerWidth / (COLS * COL_W + 160)));
      return;
    }

    // ── Type-based layout (columns by nodeType) ──
    if (mode === "type") {
      const TYPE_ORDER: string[] = ["query", "insight", "decision", "scenario", "followup", "dimensions", "causalgraph", "note", "idea", "list", "file"];
      const groups = new Map<string, CanvasNode[]>();
      for (const n of ns) {
        const t = n.nodeType;
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t)!.push(n);
      }
      const ROW_GAP = 30;
      const COL_GAP = 40;
      let colX = 80;
      const newPos = new Map<string, { x: number; y: number }>();
      for (const t of TYPE_ORDER) {
        const items = groups.get(t);
        if (!items || items.length === 0) continue;
        // Group-aware sort: grouped nodes stay together within each column
        const allGrps = [...(canvasGroups ?? []), ...userGroupsRef.current];
        const toGIdx = new Map<string, number>();
        allGrps.forEach((g, i) => { g.nodeIds.forEach(id => toGIdx.set(id, i)); });
        items.sort((a, b) => {
          const gA = toGIdx.get(a.id) ?? 999;
          const gB = toGIdx.get(b.id) ?? 999;
          if (gA !== gB) return gA - gB;
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        });
        const colW = Math.max(...items.map(n => getNodeWidth(n)));
        let y = 80;
        let prevGIdx = -1;
        for (const n of items) {
          const gIdx = toGIdx.get(n.id) ?? -1;
          if (prevGIdx >= 0 && gIdx !== prevGIdx && gIdx >= 0) y += 40;
          newPos.set(n.id, { x: colX, y });
          y += getNodeHeight(n) + ROW_GAP;
          prevGIdx = gIdx;
        }
        colX += colW + COL_GAP;
      }
      setNodes(prev => prev.map(n => { const p = newPos.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
      setPanX(20); setPanY(20);
      setZoom(Math.min(0.85, window.innerWidth / (colX + 80)));
      return;
    }

    // ── Status-based layout (columns by nodeStatus) ──
    if (mode === "status") {
      const STATUS_ORDER: NodeStatus[] = ["active", "open", "decided", "pinned"];
      const ROW_GAP = 30;
      const COL_GAP = 40;
      const allGrps = [...(canvasGroups ?? []), ...userGroupsRef.current];
      const toGIdx = new Map<string, number>();
      allGrps.forEach((g, i) => { g.nodeIds.forEach(id => toGIdx.set(id, i)); });
      let colX = 80;
      const newPos = new Map<string, { x: number; y: number }>();
      for (const status of STATUS_ORDER) {
        const items = ns.filter(n => (n.nodeStatus ?? "open") === status);
        if (items.length === 0) continue;
        items.sort((a, b) => {
          const gA = toGIdx.get(a.id) ?? 999;
          const gB = toGIdx.get(b.id) ?? 999;
          if (gA !== gB) return gA - gB;
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        });
        const colW = Math.max(...items.map(n => getNodeWidth(n)));
        let y = 80;
        let prevGIdx = -1;
        for (const n of items) {
          const gIdx = toGIdx.get(n.id) ?? -1;
          if (prevGIdx >= 0 && gIdx !== prevGIdx && gIdx >= 0) y += 40;
          newPos.set(n.id, { x: colX, y });
          y += getNodeHeight(n) + ROW_GAP;
          prevGIdx = gIdx;
        }
        colX += colW + COL_GAP;
      }
      setNodes(prev => prev.map(n => { const p = newPos.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
      setPanX(20); setPanY(20);
      setZoom(Math.min(0.85, window.innerWidth / (colX + 80)));
      return;
    }

    // ── Tree layout (default, original code) ──

    const nodeMap = new Map(ns.map(n => [n.id, n]));
    const allIds  = new Set(ns.map(n => n.id));

    // Build: parentId → [childId]
    const childMap = new Map<string, string[]>();
    for (const c of conns) {
      if (!childMap.has(c.from)) childMap.set(c.from, []);
      childMap.get(c.from)!.push(c.to);
    }

    // Root query nodes = query nodes with no parent in canvas
    const rootQNodes = ns
      .filter((n): n is QueryNode => n.nodeType === "query" && (!n.parentId || !allIds.has(n.parentId)))
      .sort((a, b) => a.createdAt - b.createdAt);

    const MARGIN_X   = 80;
    const TREE_GAP_Y = 80;
    const curQW      = QUERY_NODE_W;
    const curDW      = DERIVED_W;

    const newPos = new Map<string, { x: number; y: number }>();
    let globalY = 80;

    function layoutTree(rootId: string, startX: number, startY: number): number {
      const root = nodeMap.get(rootId);
      if (!root) return startY + 200;
      newPos.set(rootId, { x: startX, y: startY });

      const children = (childMap.get(rootId) ?? [])
        .map(id => nodeMap.get(id)).filter(Boolean) as CanvasNode[];

      const derived     = children.filter(n => n.nodeType !== "query") as DerivedNode[];
      const childQNodes = children.filter((n): n is QueryNode => n.nodeType === "query")
        .sort((a, b) => a.createdAt - b.createdAt);

      const insights   = derived.filter(n => n.nodeType === "insight");
      const decisions  = derived.filter(n => n.nodeType === "decision");
      const scenarios  = derived.filter(n => n.nodeType === "scenario");
      const followups  = derived.filter(n => n.nodeType === "followup");
      const dimensions = derived.filter(n => n.nodeType === "dimensions");
      const causalgraphs = derived.filter(n => n.nodeType === "causalgraph");
      const hasSrc     = derived.some(n => (n as DerivedNode).sources?.length);

      const colA_X = startX + curQW + DERIVED_COL_GAP_X;
      const colB_X = colA_X + curDW + DERIVED_COL_GAP;
      const colC_X = colB_X + curDW + DERIVED_COL_GAP;
      let colA_Y   = startY;
      let colB_Y   = startY;
      let colC_Y   = startY;

      for (const n of insights) {
        newPos.set(n.id, { x: colA_X, y: colA_Y });
        colA_Y += estimateCardHeight("insight", n.content, undefined, hasSrc) + DERIVED_ROW_GAP;
      }
      if (insights.length > 0) colA_Y += 10;
      for (const n of decisions) {
        newPos.set(n.id, { x: colA_X, y: colA_Y });
        colA_Y += estimateCardHeight("decision", n.content, undefined, hasSrc) + DERIVED_ROW_GAP;
      }
      for (const n of scenarios) {
        newPos.set(n.id, { x: colB_X, y: colB_Y });
        colB_Y += estimateCardHeight("scenario", n.content, n.label, hasSrc) + DERIVED_ROW_GAP;
      }
      for (const n of dimensions) {
        newPos.set(n.id, { x: colC_X, y: colC_Y });
        colC_Y += DIMENSIONS_CARD_H + DERIVED_ROW_GAP;
      }
      for (const n of causalgraphs) {
        newPos.set(n.id, { x: colC_X, y: colC_Y });
        colC_Y += CAUSAL_GRAPH_CARD_H + DERIVED_ROW_GAP;
      }
      const rowY = Math.max(colA_Y, colB_Y, colC_Y) + 20;
      followups.forEach((n, i) => {
        newPos.set(n.id, { x: colA_X + i * (curDW + DERIVED_COL_GAP), y: rowY });
      });

      let clusterBottom = Math.max(
        startY + 160,
        colA_Y, colB_Y, colC_Y,
        followups.length > 0 ? rowY + 130 : 0
      );

      // Lay out child query nodes below this cluster (slightly indented)
      if (childQNodes.length > 0) {
        let childY = clusterBottom + TREE_GAP_Y;
        const childX = startX + 60;
        for (const cq of childQNodes) {
          const bottom = layoutTree(cq.id, childX, childY);
          childY = bottom + TREE_GAP_Y;
        }
        clusterBottom = childY - TREE_GAP_Y;
      }

      return clusterBottom;
    }

    for (const root of rootQNodes) {
      const bottom = layoutTree(root.id, MARGIN_X, globalY);
      globalY = bottom + TREE_GAP_Y;
    }

    // Orphaned nodes (no position assigned yet) — use actual heights
    const orphans = ns.filter(n => !newPos.has(n.id));
    const ORPHAN_COLS = 3;
    const orphanColYs = Array(ORPHAN_COLS).fill(globalY);
    orphans.forEach(n => {
      let bestCol = 0;
      for (let c = 1; c < ORPHAN_COLS; c++) { if (orphanColYs[c] < orphanColYs[bestCol]) bestCol = c; }
      newPos.set(n.id, { x: MARGIN_X + bestCol * (curQW + 60), y: orphanColYs[bestCol] });
      orphanColYs[bestCol] += getNodeHeight(n) + DERIVED_ROW_GAP;
    });

    // Apply positions
    setNodes(prev => prev.map(n => {
      const p = newPos.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    }));

    // Fit: show everything from origin
    setPanX(20);
    setPanY(20);
    setZoom(Math.min(0.85, window.innerWidth / (curQW + curDW * 2 + DERIVED_COL_GAP_X + DERIVED_COL_GAP + 200)));
  }, [canvasGroups]);

  // ── Drag / pan / zoom ────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.PointerEvent, id: string) => {
    const n = nodesRef.current.find(x => x.id === id);
    if (!n) return;
    draggingRef.current = { id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, id: string, currentW: number, currentH: number, dir: "h" | "v" | "both" = "both") => {
    e.stopPropagation();
    resizingRef.current = { id, dir, startX: e.clientX, startW: currentW, startY: e.clientY, startH: currentH };
  }, []);

  const handlePortDragStart = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const nw = node.nodeType === "query" ? ((node as QueryNode).customWidth ?? QUERY_NODE_W) :
      node.nodeType === "list" ? ((node as ListNode).customWidth ?? LIST_NODE_W) :
      node.nodeType === "file" ? ((node as FileNode).customWidth ?? FILE_NODE_W) :
      ((node as DerivedNode | NoteNode | IdeaNode).customWidth ?? DERIVED_W);
    const nh = node.nodeType === "query" ? ((node as QueryNode).customHeight ?? QUERY_NODE_H) :
      node.nodeType === "dimensions" ? DIMENSIONS_CARD_H :
      node.nodeType === "causalgraph" ? CAUSAL_GRAPH_CARD_H :
      ((node as DerivedNode | NoteNode | IdeaNode).customHeight ?? DERIVED_W);
    const prefill = node.nodeType === "query" ? (node as QueryNode).query :
      "queryText" in node ? (node as DerivedNode).queryText :
      node.nodeType === "note" ? (node as NoteNode).content :
      node.nodeType === "idea" ? (node as IdeaNode).title :
      node.nodeType === "list" ? (node as ListNode).title :
      node.nodeType === "file" ? (node as FileNode).fileName : "";
    const sourceCanvasX = node.x + nw;
    const sourceCanvasY = node.y + nh / 2;
    portDragRef.current = { nodeId, prefill, sourceCanvasX, sourceCanvasY, startClientX: e.clientX, startClientY: e.clientY };
    setPortDragPreview({ x1: sourceCanvasX, y1: sourceCanvasY, x2: sourceCanvasX, y2: sourceCanvasY });
  }, []);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== viewportRef.current) return;
    setProjectDropdownOpen(false);
    setSortMenuOpen(false);
    panningRef.current = { sx: e.clientX, sy: e.clientY, opx: panXRef.current, opy: panYRef.current };
    setSelectedId(null);
    setDetailNodeId(null);
    setMultiSelectedIds(new Set());
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(2.5, Math.max(0.2, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const cmdContextLabel = useMemo(() => {
    if (!cmdParentId) return undefined;
    const n = nodes.find(x => x.id === cmdParentId);
    if (!n) return undefined;
    if (n.nodeType === "query") return (n as QueryNode).query;
    if (n.nodeType === "file") return (n as FileNode).fileName ?? "Datei";
    if (n.nodeType === "list") return (n as ListNode).title ?? "Liste";
    if (n.nodeType === "note") return ((n as NoteNode).content ?? "").slice(0, 80);
    if (n.nodeType === "idea") return ((n as IdeaNode).title || (n as IdeaNode).content || "").slice(0, 80);
    return (n as DerivedNode).content?.slice(0, 80) ?? "";
  }, [cmdParentId, nodes]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--color-page-bg)" }}>

      {/* Backdrop for dropdown */}
      {projectDropdownOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setProjectDropdownOpen(false)} />
      )}

      {/* ── Global Header (hidden when embedded) ────────── */}
      {!embedded && hydrated && <AppHeader />}

      {/* ── Canvas Toolbar — Row 1: Project Bar ────────── */}
      {!embedded && hydrated && (<>
      <div style={{ height: 44, flexShrink: 0, zIndex: 190, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface, rgba(255,255,255,0.95))", backdropFilter: "blur(12px) saturate(160%)" }}>

        {/* ── LEFT: Project management ─────────────────────────────── */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, zIndex: 200, flexShrink: 0 }}>
          {/* Editable project name */}
          {editingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={saveProjectName}
              onKeyDown={e => { if (e.key === "Enter") saveProjectName(); if (e.key === "Escape") { setEditingName(false); } }}
              style={{ fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 8px", color: "var(--color-text-heading)", outline: "none", minWidth: 140 }}
            />
          ) : projectId ? (
            <span
              onClick={() => setEditingName(true)}
              title={de ? "Klicken zum Umbenennen" : "Click to rename"}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", cursor: "text", padding: "2px 4px", borderRadius: 4, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >{projectName || (de ? "Unbenanntes Projekt" : "Untitled")}</span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {de ? "Kein Projekt" : "No project"}
            </span>
          )}

          {/* Dropdown toggle — chevron from lucide instead of Unicode ▴/▾
               so the button matches the rest of the app's icon set. */}
          <button
            onClick={() => setProjectDropdownOpen(o => !o)}
            aria-label={de ? "Projektliste öffnen" : "Open project list"}
            aria-expanded={projectDropdownOpen}
            style={{ padding: "3px 5px", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer", color: "var(--color-text-muted)", transition: "all 0.12s", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.3)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
          >{projectDropdownOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</button>

          {/* Save status */}
          {projectId && saveStatus && (
            <span style={{ fontSize: 10, color: saveStatus === "saved" ? "#1A9E5A" : saveStatus === "error" ? "#E8402A" : "var(--color-text-muted)", minWidth: 80, transition: "opacity 0.5s" }}>
              {saveStatus === "saving" ? (de ? "↑ Speichert…" : "↑ Saving…")
                : saveStatus === "saved" ? (de ? "✓ Gespeichert" : "✓ Saved")
                : (de ? "! Fehler beim Speichern" : "! Save error")}
            </span>
          )}

          {/* Project dropdown — with "+ Neu" as first item */}
          {projectDropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              minWidth: 280, maxHeight: 320, overflowY: "auto",
            }}>
              {/* New project — always first item in dropdown */}
              <button
                onClick={() => { createNewProject(); setProjectDropdownOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "9px 14px", border: "none", borderBottom: "1px solid var(--color-border)",
                  background: "transparent", color: "var(--color-text-secondary)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-secondary)"; }}
              >
                <Plus size={14} strokeWidth={2} style={{ color: "#1A9E5A", flexShrink: 0 }} />
                {de ? "Neues Projekt erstellen" : "Create new project"}
              </button>
              {projects.length === 0 ? (
                <div style={{ padding: "16px 16px", fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                  {de ? "Noch keine Projekte" : "No projects yet"}
                </div>
              ) : (
                projects.map((p, i) => (
                  <div key={p.id}
                    style={{
                      padding: "9px 14px", display: "flex", alignItems: "center", gap: 8,
                      cursor: "pointer",
                      borderBottom: i < projects.length - 1 ? "1px solid var(--color-border)" : "none",
                      background: p.id === projectId ? "var(--color-page-bg)" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onClick={() => loadProject(p.id)}
                    onMouseEnter={e => { if (p.id !== projectId) (e.currentTarget as HTMLElement).style.background = "var(--color-page-bg)"; }}
                    onMouseLeave={e => { if (p.id !== projectId) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* Lucide icons replace the old Unicode glyphs (◆◈○)
                         — matches the rest of the app's design language:
                         active project = CheckCircle2 in brand lime,
                         project with content = CircleDot,
                         empty project = outlined Circle. */}
                    {p.id === projectId ? (
                      <CheckCircle2 size={13} strokeWidth={2.25} style={{ color: "#1A9E5A", flexShrink: 0 }} />
                    ) : p.hasState ? (
                      <CircleDot size={13} strokeWidth={2} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
                    ) : (
                      <Circle size={13} strokeWidth={1.75} style={{ color: "var(--color-text-muted)", flexShrink: 0, opacity: 0.6 }} />
                    )}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: p.id === projectId ? 600 : 400, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--color-text-muted)", flexShrink: 0 }}>
                      {new Date(p.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                      aria-label={de ? "Projekt löschen" : "Delete project"}
                      style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "2px 5px", color: "var(--color-text-muted)", borderRadius: 4, opacity: 0.6, display: "inline-flex", alignItems: "center" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
                    ><X size={12} strokeWidth={2} /></button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: View mode tabs (primary navigation) ─────────────── */}
        {/* Canvas / Board / Timeline / Orbit bleiben in der Segmented-Group,
             weil sie echte View-Modi sind (Umschalten, nicht Navigieren).
             Die "Zusammenfassung" ist eine Navigation in den Briefing-Mode
             und lebt deshalb daneben — nicht IM Pill-Switch, aber visuell
             angegliedert, damit der Einstieg weg von der Startseite hier
             zentral verfuegbar bleibt. */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            padding: 3,
            background: "var(--muted, #F7F7F7)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}>
            {(["canvas","board","timeline","orbit"] as ViewMode[]).map(mode => {
              const icons: Record<ViewMode, React.ReactNode> = {
                canvas: <LayoutGrid className="w-3.5 h-3.5" />,
                board: <Columns3 className="w-3.5 h-3.5" />,
                timeline: <Clock className="w-3.5 h-3.5" />,
                orbit: <Hexagon className="w-3.5 h-3.5" />,
              };
              const labels: Record<ViewMode, string> = { canvas: "Canvas", board: "Board", timeline: de ? "Zeitlinie" : "Timeline", orbit: "Orbit" };
              const tips: Record<ViewMode, string> = {
                canvas: de ? "Freie Karten-Ansicht zum Denken und Analysieren" : "Free-form card layout for thinking and analysis",
                board: de ? "Strukturierte Spalten-Ansicht nach Node-Typ" : "Structured column view by node type",
                timeline: de ? "Chronologische Ansicht aller Analysen" : "Chronological view of all analyses",
                orbit: de ? "Orbit: Netzwerk & Evidenzketten" : "Orbit: Network & Evidence chains",
              };
              const isActive = viewMode === mode;
              return (
                <Tooltip key={mode} content={tips[mode]} placement="bottom">
                  <button
                    onClick={() => switchViewMode(mode)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11, padding: "5px 11px",
                      borderRadius: 6, border: "none",
                      background: isActive ? "var(--card, #fff)" : "transparent",
                      color: isActive ? "var(--foreground, #0A0A0A)" : "var(--muted-foreground, #6B6B6B)",
                      cursor: "pointer",
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: "var(--font-ui)",
                      boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.12s",
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; }}
                  >
                    {icons[mode]}
                    <span>{labels[mode]}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {/* Zusammenfassung — separate Navigations-Button direkt neben der
               View-Group. Frueher lag dieser Einstieg in der SessionBar auf
               der Startseite; die SessionBar wurde entfernt, damit die
               Briefing-Ansicht ruhig bleibt. Der Button ist IMMER sichtbar,
               damit der Einstieg ins Briefing nicht verschwindet, wenn der
               User auf /canvas landet bevor ein Projekt gesetzt ist — ohne
               projectId leitet der Klick zur Projektliste weiter. */}
          <Tooltip
            content={
              projectId
                ? (de ? "Zusammenfassung: Ergebnisse des Projekts als Briefing" : "Summary: project results as briefing")
                : (de ? "Kein aktives Projekt — zur Projektliste" : "No active project — go to projects")
            }
            placement="bottom"
          >
            <button
              onClick={() => {
                window.location.href = projectId
                  ? `/canvas/${projectId}/zusammenfassung`
                  : "/projects";
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600, padding: "5px 11px",
                borderRadius: 8, border: "1px solid var(--color-border)",
                background: "transparent",
                color: projectId ? "var(--color-text-secondary)" : "var(--color-text-muted)",
                cursor: "pointer", transition: "all 0.12s",
                fontFamily: "var(--font-ui)",
                opacity: projectId ? 1 : 0.75,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = projectId ? "var(--color-text-secondary)" : "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
            >
              <VIconSparkles size={12} />
              <span>{de ? "Zusammenfassung" : "Summary"}</span>
            </button>
          </Tooltip>
        </div>

        {/* ── RIGHT: Compact action buttons ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* + Add node */}
          <button
            onClick={() => { setIterateCtx(null); setNodePickerVisible(true); }}
            title={de ? "Neue Karte hinzufügen (Abfrage, Notiz, Idee, Liste)" : "Add new card (query, note, idea, list)"}
            style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", transition: "all 0.12s", display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-secondary)"; el.style.borderColor = "var(--color-border)"; }}
          >
            <span style={{ fontSize: 15, fontWeight: 300, lineHeight: 1 }}>+</span>
            {de ? "Neu" : "Add"}
          </button>

          {/* Sort/Arrange dropdown */}
          {nodes.length > 1 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setSortMenuOpen(v => !v)}
                title={de ? "Karten sortieren und anordnen" : "Sort and arrange cards"}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: sortMenuOpen ? "var(--color-page-bg)" : "transparent", color: sortMenuOpen ? "var(--color-text-heading)" : "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                onMouseLeave={e => { if (!sortMenuOpen) { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; } }}
              ><LayoutGrid className="w-3 h-3 inline-block mr-1 -mt-px" /> {de ? "Ordnen" : "Arrange"} ▾</button>
              {sortMenuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setSortMenuOpen(false)} />
                  <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 160, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 300, padding: "4px 0", fontFamily: "var(--font-ui)" }}>
                    {/* ── Layout modes ── */}
                    <div style={{ padding: "2px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{de ? "Anordnen" : "Layout"}</div>
                    {([
                      { mode: "tree" as SortMode, icon: <TreePine className="w-3.5 h-3.5" />, label: de ? "Baum (Standard)" : "Tree (Default)" },
                      { mode: "time" as SortMode, icon: <Clock className="w-3.5 h-3.5" />, label: de ? "Zeitlich" : "By Time" },
                      { mode: "type" as SortMode, icon: <Layers className="w-3.5 h-3.5" />, label: de ? "Nach Typ" : "By Type" },
                      { mode: "status" as SortMode, icon: <Tag className="w-3.5 h-3.5" />, label: de ? "Nach Status" : "By Status" },
                    ] as const).map(item => (
                      <button key={item.mode}
                        onClick={() => { reorganizeCanvas(item.mode); setSortMenuOpen(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", border: "none", background: "transparent", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-page-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"; }}
                      >
                        <span className="flex-shrink-0 opacity-60">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}

                    {/* ── Gruppen-Sektion ── */}
                    <div style={{ height: 1, background: "var(--color-border)", margin: "6px 0" }} />
                    <div style={{ padding: "2px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{de ? "Gruppen" : "Groups"}</div>

                    {/* Hinweis auf Multi-Select */}
                    {multiSelectedIds.size < 2 && (
                      <div style={{ padding: "4px 14px 6px", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                        {de ? `⇧ Shift + Klick auf 2+ Karten, dann „Gruppieren"` : `⇧ Shift + click 2+ cards, then "Group"`}
                      </div>
                    )}

                    {/* Gruppieren-Button wenn Multi-Select aktiv */}
                    {multiSelectedIds.size >= 2 && (
                      <button
                        onClick={() => {
                          const ids = [...multiSelectedIds];
                          const gNodes = nodes.filter(n => ids.includes(n.id));
                          if (gNodes.length < 2) return;
                          const xs = gNodes.map(n => n.x);
                          const ys = gNodes.map(n => n.y);
                          const PAD = 40;
                          const colors = ["#2563EB", "#8B5CF6", "#F97316", "#1A9E5A", "#0369A1", "#D4A017"];
                          const newGroup: CanvasGroup = {
                            id: `ug-${Date.now()}`,
                            nodeIds: ids,
                            label: de ? "Neue Gruppe" : "New Group",
                            color: colors[userGroups.length % colors.length],
                            bounds: { x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD, w: Math.max(...gNodes.map(n => n.x + getNodeWidth(n))) - Math.min(...xs) + PAD * 2, h: Math.max(...gNodes.map(n => n.y + getNodeHeight(n))) - Math.min(...ys) + PAD * 2 },
                          };
                          setUserGroups(prev => [...prev, newGroup]);
                          setMultiSelectedIds(new Set());
                          setEditingGroupId(newGroup.id);
                          setSortMenuOpen(false);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", border: "none", background: "#2563EB0C", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2563EB18"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563EB0C"; }}
                      >
                        <Group className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{de ? `${multiSelectedIds.size} Karten gruppieren` : `Group ${multiSelectedIds.size} cards`}</span>
                      </button>
                    )}

                    {/* Bestehende Gruppen auflisten */}
                    {[...canvasGroups, ...userGroups].length > 0 && (
                      <>
                        {[...canvasGroups, ...userGroups].map(g => {
                          const isUser = userGroups.some(ug => ug.id === g.id);
                          return (
                            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 11, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                              <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{g.nodeIds.length}</span>
                              {isUser && (
                                <button
                                  onClick={() => { setUserGroups(prev => prev.filter(ug => ug.id !== g.id)); }}
                                  title={de ? "Gruppe auflösen" : "Remove group"}
                                  style={{ fontSize: 9, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; }}
                                >✕</button>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Alle Gruppen auflösen */}
                    {userGroups.length > 0 && (
                      <>
                        <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
                        <button
                          onClick={() => { setUserGroups([]); setSortMenuOpen(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", border: "none", background: "transparent", color: "#E8402A", fontSize: 11, fontWeight: 500, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <Trash2 className="w-3 h-3 flex-shrink-0" />
                          <span>{de ? "Alle Gruppen auflösen" : "Remove all groups"}</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Briefing button (icon-only with tooltip) */}
          {nodes.length >= 2 && (
            <Tooltip content={de ? "Strategisches Memo aus allen Analysen generieren" : "Generate strategic memo from all analyses"} placement="bottom">
              <button
                onClick={generateBriefing}
                disabled={briefingLoading}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontWeight: 500, opacity: briefingLoading ? 0.5 : 1, transition: "all 0.12s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E4FF97"; el.style.color = "#0A0A0A"; el.style.borderColor = "rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-muted)"; el.style.borderColor = "var(--color-border)"; }}
              >{briefingLoading ? "..." : "Briefing"}</button>
            </Tooltip>
          )}

          {/* Export dropdown */}
          {nodes.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setExportMenuOpen(prev => !prev)}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: exportMenuOpen ? "var(--volt-surface-raised, #fff)" : "transparent", color: exportMenuOpen ? "var(--color-text-heading)" : "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s", fontWeight: 500 }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(0,0,0,0.3)"; el.style.color = "var(--color-text-heading)"; }}
                onMouseLeave={e => { if (!exportMenuOpen) { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border)"; el.style.color = "var(--color-text-muted)"; }}}
              >Export ▾</button>
              {exportMenuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setExportMenuOpen(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200,
                    background: "var(--volt-surface-raised, #fff)", border: "1px solid var(--color-border)",
                    borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 150,
                    padding: "4px 0", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  }}>
                    {([
                      { label: "Markdown (.md)", format: "markdown" as const },
                      { label: "JSON (.json)", format: "json" as const },
                      { label: "PDF (.pdf)", format: "pdf" as const },
                    ]).map(opt => (
                      <button key={opt.format} onClick={() => exportCanvas(opt.format)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 14px", fontSize: 12, background: "transparent", border: "none", color: "var(--color-text-primary, #333)", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(228,255,151,0.4)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas Toolbar — Row 2: Filter Bar (only when nodes exist) ────────── */}
      {nodes.length > 0 && (
      <div style={{ height: 32, flexShrink: 0, zIndex: 189, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, borderBottom: "1px solid var(--color-border)", background: "var(--color-page-bg)", fontSize: 11 }}>

        {/* LEFT: Stats */}
        <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>
          {queryNodes.length} {de ? "Abfragen" : "queries"} · {nodes.length - queryNodes.length} {de ? "Karten" : "cards"}
          {connections.length > 0 && ` · ${connections.length} ${de ? "Verb." : "links"}`}
        </span>

        {/* RIGHT: Layer toggles + Tag filters + Gruppieren */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Layer toggles — with counts and eye icon for clear affordance */}
          {(["analyse", "karte", "datei"] as CanvasLayer[]).map(layer => {
            const count = nodes.filter(n => NODE_LAYER[n.nodeType] === layer).length;
            if (count === 0) return null;
            const hidden = hiddenLayers.has(layer);
            return (
              <button key={layer}
                onClick={() => toggleLayer(layer)}
                title={de
                  ? `${LAYER_LABELS[layer].de} (${count}) ${hidden ? "einblenden" : "ausblenden"} — Klicken zum Umschalten`
                  : `${LAYER_LABELS[layer].de} (${count}) ${hidden ? "show" : "hide"} — Click to toggle`}
                style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 20, display: "flex", alignItems: "center", gap: 3,
                  border: `1px solid ${hidden ? "var(--color-border)" : LAYER_LABELS[layer].color}`,
                  background: hidden ? "transparent" : `${LAYER_LABELS[layer].color}18`,
                  color: hidden ? "var(--color-text-muted)" : LAYER_LABELS[layer].color,
                  cursor: "pointer", transition: "all 0.12s", fontWeight: 600,
                  opacity: hidden ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 10 }}>{hidden ? "◻" : "◼"}</span>
                {LAYER_LABELS[layer].de}
                <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}

          {/* Connection visibility toggle — 3 modes, each with a distinct visual
              state so the user never has to read the label to know what's on:
                auto → neutral pill (connections follow zoom/selection heuristics)
                show → filled dark pill with dot indicator (all connections forced on)
                hide → strike-through muted pill with dashed border (all off) */}
          {connections.length > 0 && (() => {
            const modeColor = connVisMode === "show"
              ? "#0A0A0A"
              : connVisMode === "hide"
              ? "#9CA3AF"
              : "#4B5563";
            const isShow = connVisMode === "show";
            const isHide = connVisMode === "hide";
            return (
              <button
                onClick={() => setConnVisMode(prev => prev === "auto" ? "show" : prev === "show" ? "hide" : "auto")}
                title={de ? "Verbindungslinien: auto → ein → aus" : "Connection lines: auto → show → hide"}
                style={{
                  fontSize: 10, padding: "1px 8px 1px 7px", borderRadius: 20,
                  border: isHide
                    ? `1px dashed ${modeColor}`
                    : isShow
                    ? `1px solid ${modeColor}`
                    : "1px solid var(--color-border)",
                  background: isShow
                    ? modeColor
                    : isHide
                    ? "transparent"
                    : "transparent",
                  color: isShow ? "#FFFFFF" : modeColor,
                  cursor: "pointer", transition: "all 0.12s", fontWeight: 600,
                  textDecoration: isHide ? "line-through" : "none",
                  opacity: isHide ? 0.75 : 1,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  boxShadow: isShow ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
                }}
              >
                {/* Mode indicator glyph — encodes the state beyond just the label */}
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isShow
                    ? "#E4FF97"
                    : isHide
                    ? "transparent"
                    : modeColor,
                  border: isHide ? `1.5px solid ${modeColor}` : "none",
                  flexShrink: 0,
                }} />
                {de
                  ? (connVisMode === "auto" ? "Verb. auto" : connVisMode === "show" ? "Verb. ein" : "Verb. aus")
                  : (connVisMode === "auto" ? "Links auto" : connVisMode === "show" ? "Links on" : "Links off")}
              </button>
            );
          })()}

          {/* Tag filter pills */}
          {allTags.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "nowrap", overflow: "hidden" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 1, flexShrink: 0 }}>Tags</span>
              {allTags.slice(0, 8).map(tag => {
                const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                const isActive = activeTagFilter === tag;
                return (
                  <button key={tag}
                    onClick={() => setActiveTagFilter(prev => prev === tag ? null : tag)}
                    style={{
                      fontSize: 9, padding: "1px 7px", borderRadius: 10, border: `1px solid ${isActive ? `hsl(${hue}, 55%, 50%)` : `hsl(${hue}, 45%, 80%)`}`,
                      background: isActive ? `hsl(${hue}, 55%, 92%)` : `hsl(${hue}, 55%, 96%)`, color: `hsl(${hue}, 55%, ${isActive ? 30 : 45}%)`,
                      fontWeight: isActive ? 700 : 500, cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", flexShrink: 0,
                      boxShadow: isActive ? `0 0 0 2px hsl(${hue}, 55%, 80%)` : "none",
                    }}
                  >{tag}</button>
                );
              })}
              {activeTagFilter && (
                <button onClick={() => setActiveTagFilter(null)}
                  style={{ fontSize: 9, padding: "1px 5px", borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.12s" }}
                  title={de ? "Tag-Filter aufheben" : "Clear tag filter"}
                >✕</button>
              )}
            </div>
          )}

          {/* Group button (when multi-selected) */}
          {multiSelectedIds.size >= 2 && (
            <button
              onClick={() => {
                const ids = [...multiSelectedIds];
                const gNodes = nodes.filter(n => ids.includes(n.id));
                if (gNodes.length < 2) return;
                const xs = gNodes.map(n => n.x);
                const ys = gNodes.map(n => n.y);
                const PAD = 40;
                const colors = ["#2563EB", "#8B5CF6", "#F97316", "#1A9E5A", "#0369A1", "#D4A017"];
                const newGroup: CanvasGroup = {
                  id: `ug-${Date.now()}`,
                  nodeIds: ids,
                  label: de ? "Neue Gruppe" : "New Group",
                  color: colors[userGroups.length % colors.length],
                  bounds: { x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD, w: Math.max(...xs) + 460 - Math.min(...xs) + PAD * 2, h: Math.max(...ys) + 200 - Math.min(...ys) + PAD * 2 },
                };
                setUserGroups(prev => [...prev, newGroup]);
                setMultiSelectedIds(new Set());
                setEditingGroupId(newGroup.id);
              }}
              title={de ? "Ausgewählte Karten gruppieren" : "Group selected cards"}
              style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 6, border: "1px solid #2563EB40", background: "#2563EB14", color: "#2563EB", cursor: "pointer", transition: "all 0.12s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2563EB"; el.style.color = "#fff"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2563EB14"; el.style.color = "#2563EB"; }}
            >
              <Group className="w-3 h-3 inline-block mr-0.5 -mt-px" /> {de ? "Gruppieren" : "Group"} ({multiSelectedIds.size})
            </button>
          )}
        </div>
      </div>
      )}
      </>)}

      {/* FIXED: DAT-08 / EDGE-09 — Concurrent tab warning banner */}
      {concurrentTabWarning && (
        <div style={{
          position: "absolute", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 9100,
          padding: "8px 20px", borderRadius: 8, background: "#FFFBEB", border: "1px solid #FCD34D",
          color: "#92400E", fontSize: 12, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          display: "flex", alignItems: "center", gap: 8, maxWidth: 560,
          animation: "sis-tooltip-in 0.15s ease",
        }}>
          <span>&#x26A0;</span>
          <span style={{ flex: 1 }}>
            {de
              ? "Canvas ist in einem anderen Tab ge\u00f6ffnet. \u00c4nderungen k\u00f6nnen verloren gehen (last-write-wins)."
              : "Canvas is open in another tab. Changes may be lost (last-write-wins)."}
          </span>
          <button onClick={() => setConcurrentTabWarning(false)} style={{ background: "none", border: "none", color: "#92400E", cursor: "pointer", fontSize: 14, padding: 0 }}>&#x2715;</button>
        </div>
      )}

      {/* Error banner */}
      {projectError && (
        <div style={{
          position: "absolute", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 9000,
          padding: "8px 20px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5",
          color: "#E8402A", fontSize: 12, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          display: "flex", alignItems: "center", gap: 8, maxWidth: 500,
          animation: "sis-tooltip-in 0.15s ease",
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{projectError}</span>
          <button onClick={() => setProjectError(null)} style={{ background: "none", border: "none", color: "#E8402A", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Loading overlay for project operations */}
      {projectOp && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 8000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)",
          pointerEvents: "all",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><RefreshCw size={20} style={{ animation: "spin 1s linear infinite", color: "var(--color-text-muted)" }} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)" }}>
              {projectOp === "creating" ? (de ? "Erstelle Projekt…" : "Creating project…") :
               projectOp === "deleting" ? (de ? "Lösche Projekt…" : "Deleting project…") :
               (de ? "Lade Projekt…" : "Loading project…")}
            </div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Template Picker Modal (Volt UI Node Canvas style) ────── */}
      {showTemplatePicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowTemplatePicker(false)}
        >
          <div style={{
            background: "var(--color-surface, #fff)",
            borderRadius: 20,
            padding: 0,
            width: "min(880px, 92vw)",
            maxHeight: "90vh",
            overflow: "hidden",
            boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
          }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Modal Header (Volt UI Page-Header pattern) ── */}
            <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <VoltIconBox icon={<GitBranch size={22} />} variant="lime" size={44} rounded="lg" />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: "var(--muted-foreground, #6B6B6B)",
                    marginBottom: 6,
                  }}>
                    {de ? "Workflow-System" : "Workflow System"}
                  </div>
                  <h2 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    color: "var(--foreground, #0A0A0A)",
                    margin: 0,
                    lineHeight: 1.15,
                  }}>
                    Node Canvas
                  </h2>
                  <p style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: "var(--muted-foreground, #6B6B6B)",
                    margin: "8px 0 0",
                    lineHeight: 1.55,
                    maxWidth: 600,
                  }}>
                    {de
                      ? "Ein interaktives Canvas-System für visuelle Workflows, KI-Pipelines und strategische Analysen. Wähle ein Framework zum Start oder beginne mit einem leeren Canvas."
                      : "An interactive canvas system for visual workflows, AI pipelines and strategic analyses. Pick a framework to start or begin with an empty canvas."}
                  </p>
                </div>
                <button onClick={() => setShowTemplatePicker(false)}
                  style={{
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >✕</button>
              </div>
            </div>

            {/* ── Scrollable content ── */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 28px" }}>

              {/* Section label: Pipeline-Templates */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground)",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span>{de ? "Pipeline-Templates" : "Pipeline Templates"}</span>
                <span style={{ opacity: 0.7 }}>({TEMPLATES.length})</span>
              </div>

              {/* Inline topic input — replaces the old window.prompt.
                   Rendered only while a template is staged. On confirm
                   we run the template-build + framework-launch logic
                   that used to live inside the tile onClick. */}
              {pendingTemplate && (
                <div style={{
                  marginBottom: 20,
                  padding: "16px 18px",
                  borderRadius: 12,
                  border: "1px solid var(--volt-text, #0A0A0A)",
                  background: "var(--muted, #FAFAFA)",
                }}>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    color: "var(--muted-foreground)",
                    marginBottom: 6,
                  }}>
                    {(de ? pendingTemplate.labelDe : pendingTemplate.labelEn)} — {de ? "Thema" : "Topic"}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      autoFocus
                      value={pendingTopic}
                      onChange={e => setPendingTopic(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Escape") { setPendingTemplate(null); setPendingTopic(""); }
                        if (e.key === "Enter" && pendingTopic.trim()) {
                          const topic = pendingTopic.trim();
                          const t = TEMPLATES.find(x => x.id === pendingTemplate.id);
                          if (!t) { setPendingTemplate(null); return; }
                          const fw = FRAMEWORKS.find(f => f.id === t.id);
                          if (fw) {
                            const steps: WorkflowStep[] = fw.steps.map((s, i) => ({
                              id: `step-${i}`, title: s.title, description: s.description,
                              status: (i === 0 ? "pending" : "locked") as "pending" | "locked",
                              queryTemplate: s.queryTemplate, dependsOn: s.dependsOn,
                              userInputPrompt: s.userInputPrompt,
                            }));
                            steps.forEach((s, i) => {
                              s.status = fw.steps[i].dependsOn.length === 0 ? "pending" : "locked";
                            });
                            setActiveWorkflow({
                              frameworkId: fw.id,
                              frameworkName: de ? fw.name : fw.nameEn,
                              methodology: de ? fw.methodology : fw.methodologyEn,
                              topic, steps, currentStepIndex: 0,
                            });
                          } else {
                            const result = t.build(topic);
                            setNodes(result.nodes as any[]);
                            setConnections(result.conns as any[]);
                            setZoom(0.7);
                          }
                          setPendingTemplate(null);
                          setPendingTopic("");
                          setShowTemplatePicker(false);
                        }
                      }}
                      placeholder={de ? "Thema eingeben … (Enter zum Starten, Esc zum Abbrechen)" : "Enter topic … (Enter to start, Esc to cancel)"}
                      style={{
                        flex: 1, border: "1px solid var(--color-border)", borderRadius: 8,
                        padding: "9px 12px", fontSize: 14, outline: "none",
                        background: "var(--card, #fff)", color: "var(--foreground)",
                        fontFamily: "var(--font-ui)",
                      }}
                    />
                    <button
                      onClick={() => { setPendingTemplate(null); setPendingTopic(""); }}
                      style={{
                        fontSize: 12, padding: "9px 14px", borderRadius: 8,
                        border: "1px solid var(--color-border)", background: "transparent",
                        color: "var(--muted-foreground)", cursor: "pointer",
                        fontFamily: "var(--font-ui)",
                      }}
                    >{de ? "Abbrechen" : "Cancel"}</button>
                  </div>
                </div>
              )}

              {/* Template Grid — Volt UI Node Canvas card style */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
                {TEMPLATES.map(t => {
                  // Volt UI Node Canvas prefix pill: AI/ETL/LOGIC/MM/CRON style
                  const prefixMap: Record<string, { prefix: string; variant: "lime" | "mint" | "blue" | "orchid" | "butter" | "rose" | "peach" | "light" }> = {
                    "empty":              { prefix: "NEW",  variant: "light"  },
                    "market-analysis":    { prefix: "MKT",  variant: "blue"   },
                    "war-gaming":         { prefix: "WAR",  variant: "rose"   },
                    "pre-mortem":         { prefix: "PRE",  variant: "peach"  },
                    "post-mortem":        { prefix: "POST", variant: "mint"   },
                    "trend-deep-dive":    { prefix: "TRND", variant: "orchid" },
                    "stakeholder-mapping":{ prefix: "STKH", variant: "butter" },
                  };
                  const meta = prefixMap[t.id] || { prefix: "FW", variant: "light" as const };
                  const prefixStyles = {
                    lime:   { bg: "var(--volt-lime, #E4FF97)", text: "#0A0A0A" },
                    light:  { bg: "var(--muted, #F7F7F7)", text: "#6B6B6B" },
                    mint:   { bg: "var(--pastel-mint, #C3F4D3)", text: "#0F6038" },
                    blue:   { bg: "var(--pastel-blue, #D4E8FF)", text: "#1A4A8A" },
                    rose:   { bg: "var(--pastel-rose, #FFD6E0)", text: "#A0244A" },
                    butter: { bg: "var(--pastel-butter, #FFF5BA)", text: "#7A5C00" },
                    orchid: { bg: "var(--pastel-orchid, #FDE2FF)", text: "#7C1A9E" },
                    peach:  { bg: "var(--pastel-peach, #FFECD2)", text: "#955A20" },
                  };
                  const ps = prefixStyles[meta.variant];
                  return (
                    <button key={t.id}
                      onClick={() => {
                        if (t.id === "empty") {
                          setShowTemplatePicker(false);
                          return;
                        }
                        // Stage the click instead of calling
                        // window.prompt — see pendingTemplate state
                        // declaration above for context.
                        setPendingTemplate({ id: t.id, labelDe: t.labelDe, labelEn: t.labelEn });
                        setPendingTopic("");
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--card, #fff)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        fontFamily: "var(--font-ui)",
                        minHeight: 102,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--color-border)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Prefix pill + title row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 7px",
                          borderRadius: 4,
                          background: ps.bg,
                          color: ps.text,
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          lineHeight: 1.2,
                          flexShrink: 0,
                        }}>
                          {meta.prefix}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--foreground, #0A0A0A)",
                          letterSpacing: "-0.01em",
                          lineHeight: 1.2,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {de ? t.labelDe : t.labelEn}
                        </span>
                      </div>
                      {/* Description */}
                      <div style={{
                        fontSize: 11,
                        color: "var(--muted-foreground, #6B6B6B)",
                        lineHeight: 1.5,
                        fontFamily: "var(--font-ui)",
                        flex: 1,
                      }}>
                        {de ? t.descDe : t.descEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Node Canvas Features (Volt UI spec summary) ── */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground)",
                marginBottom: 12,
              }}>
                {de ? "Was drin ist" : "What's inside"}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}>
                {[
                  { label: de ? "Node-Typen" : "Node Types", value: "12", hint: de ? "Query, Insight, Scenario…" : "Query, Insight, Scenario…" },
                  { label: de ? "Edge-Stile" : "Edge Styles", value: "4", hint: "Bezier · Step · Straight · Smooth" },
                  { label: de ? "Status-Zustände" : "Status States", value: "6", hint: de ? "Idle · Running · Done · Error…" : "Idle · Running · Done · Error…" },
                  { label: de ? "Ansichten" : "Views", value: "4", hint: "Canvas · Board · Timeline · Orbit" },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--muted, #F7F7F7)",
                    border: "1px solid var(--color-border)",
                  }}>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase" as const,
                      color: "var(--muted-foreground)",
                      marginBottom: 4,
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--foreground)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      marginBottom: 4,
                    }}>
                      {item.value}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.4,
                      fontFamily: "var(--font-ui)",
                    }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Node-Status Legend (Volt UI Node-Status spec) ── */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground)",
                marginBottom: 10,
              }}>
                {de ? "Node-Status" : "Node Status"}
              </div>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}>
                {[
                  { dot: "#9CA3AF", label: de ? "Idle" : "Idle" },
                  { dot: "var(--volt-lime, #E4FF97)", label: de ? "Running" : "Running" },
                  { dot: "#1A9E5A", label: de ? "Success" : "Success" },
                  { dot: "#E8402A", label: de ? "Error" : "Error" },
                  { dot: "#F5A623", label: de ? "Warning" : "Warning" },
                  { dot: "#D1D5DB", label: de ? "Disabled" : "Disabled" },
                ].map((s, i) => (
                  <span key={i} style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 9999,
                    border: "1px solid var(--color-border)",
                    background: "var(--card, #fff)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                  }}>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: s.dot,
                      border: s.dot.includes("E4FF97") ? "1px solid #C8E873" : "none",
                    }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for NodePicker "Datei" upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/* ── Workflow Panel (right sidebar when active) ────────────── */}
      {activeWorkflow && (
        <div style={{ position: "fixed", right: 0, top: embedded ? 0 : 48, bottom: 0, zIndex: 500 }}>
          <WorkflowPanel
            workflow={activeWorkflow}
            onClose={() => setActiveWorkflow(null)}
            onStartStep={(stepIndex, userContext) => {
              if (!activeWorkflow) return;
              const step = activeWorkflow.steps[stepIndex];
              if (!step) return;

              // Build query from template
              const fw = FRAMEWORKS.find(f => f.id === activeWorkflow.frameworkId);
              if (!fw) return;
              const fwStep = fw.steps[stepIndex];

              // Gather context from dependency steps
              let context = "";
              fwStep.dependsOn.forEach(depIdx => {
                const depStep = activeWorkflow.steps[depIdx];
                if (depStep?.synthesis) {
                  context += `[${depStep.title}]: ${depStep.synthesis}\n\n`;
                }
              });

              let query = fwStep.queryTemplate
                .replace(/\{topic\}/g, activeWorkflow.topic)
                .replace(/\{context\}/g, context);

              // Add user context if provided
              if (userContext?.trim()) {
                query += `\n\nNUTZER-KONTEXT: ${userContext.trim()}`;
              }

              // Update step status to running
              setActiveWorkflow(prev => {
                if (!prev) return null;
                const newSteps = [...prev.steps];
                newSteps[stepIndex] = { ...newSteps[stepIndex], status: "running" };
                return { ...prev, steps: newSteps, currentStepIndex: stepIndex };
              });

              // Submit the query with a generated parent connection
              const parentNodeId = stepIndex > 0
                ? activeWorkflow.steps.find((s, i) => i < stepIndex && s.queryNodeId)?.queryNodeId
                : undefined;

              const nodeId = uid();
              const pos = getNextQueryPos(parentNodeId);
              const qNode: QueryNode = {
                id: nodeId, nodeType: "query", x: pos.x, y: pos.y, query: query.slice(0, 200) + "...", locale,
                status: "loading", synthesis: "", result: null, collapsed: false,
                parentId: parentNodeId, createdAt: Date.now(), tags: [activeWorkflow.frameworkId, `schritt-${stepIndex + 1}`],
              };
              setNodes(prev => [...prev, qNode]);
              if (parentNodeId) setConnections(prev => [...prev, { from: parentNodeId, to: nodeId, connectionType: "builds-on" }]);

              // Store nodeId in workflow
              setActiveWorkflow(prev => {
                if (!prev) return null;
                const newSteps = [...prev.steps];
                newSteps[stepIndex] = { ...newSteps[stepIndex], queryNodeId: nodeId };
                return { ...prev, steps: newSteps };
              });

              // Stream the query
              streamQuery(
                query, locale,
                (chunk) => setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, status: "streaming", synthesis: (n as QueryNode).synthesis + chunk } : n)),
                (result) => {
                  const synthesis = result.synthesis ?? "";
                  setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, status: "done", synthesis, result } as QueryNode : n));

                  // Update workflow: mark step as done, unlock dependents
                  setActiveWorkflow(prev => {
                    if (!prev) return null;
                    const newSteps = [...prev.steps];
                    newSteps[stepIndex] = { ...newSteps[stepIndex], status: "done", synthesis };

                    // Unlock steps whose dependencies are all done
                    newSteps.forEach((s, i) => {
                      if (s.status === "locked") {
                        const deps = fw!.steps[i].dependsOn;
                        if (deps.every(d => newSteps[d]?.status === "done")) {
                          newSteps[i] = { ...newSteps[i], status: "pending" };
                        }
                      }
                    });

                    // Find next pending step
                    const nextPending = newSteps.findIndex(s => s.status === "pending");

                    return { ...prev, steps: newSteps, currentStepIndex: nextPending >= 0 ? nextPending : stepIndex };
                  });

                  // Also generate derived nodes from the result
                  const derived = computeDerivedNodes(nodeId, pos.x, pos.y, result);
                  const derivedConns = derived.map(d => ({ from: nodeId, to: d.id, derived: true }));
                  setTimeout(() => {
                    setNodes(prev => [...prev, ...derived]);
                    setConnections(prev => [...prev, ...derivedConns]);
                  }, 300);
                },
                (errMsg) => {
                  setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, status: "error", errorMsg: errMsg } as QueryNode : n));
                  setActiveWorkflow(prev => {
                    if (!prev) return null;
                    const newSteps = [...prev.steps];
                    newSteps[stepIndex] = { ...newSteps[stepIndex], status: "pending" }; // allow retry
                    return { ...prev, steps: newSteps };
                  });
                },
                (phase) => setNodes(prev => prev.map(n => n.id === nodeId && n.nodeType === "query" ? { ...n, streamingPhase: phase } as QueryNode : n)),
              );
            }}
          />
        </div>
      )}

      {/* ── Canvas viewport ──────────────────────────────────────── */}
      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onWheel={handleWheel}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={handleCanvasDrop}
        style={{
          flex: 1, position: "relative", overflow: "hidden",
          background: "var(--color-page-bg)",
          ...(viewMode === "canvas" ? {
            backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.18) 0.85px, transparent 0.85px)",
            backgroundSize: "24px 24px",
            backgroundAttachment: "fixed",
          } : {}),
        }}
      >
        {/* FIXED: UX-09 — Empty state / onboarding guidance */}
        {nodes.length === 0 && viewMode === "canvas" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: "var(--muted-foreground, #888)", fontFamily: "var(--font-display)", maxWidth: 400, zIndex: 10, pointerEvents: "none" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#x1F9ED;</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--color-text-heading, #333)" }}>Willkommen im Canvas</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Tippe eine Frage ein und dr&uuml;cke Enter, um zu starten.<br/>
              Nutze <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface, #fff)", fontSize: 11 }}>/trend</kbd>, <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface, #fff)", fontSize: 11 }}>/scenario</kbd> oder <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface, #fff)", fontSize: 11 }}>/signal</kbd> f&uuml;r spezifische Analysen.
            </div>
          </div>
        )}

        {/* Canvas transform layer */}
        {viewMode === "canvas" && (
          <ErrorBoundary>
          <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            <ConnectionsSVG nodes={visibleNodes} connections={connections} pipelineChain={pipelineChain} selectedId={selectedId} zoom={zoom} activeTagFilter={activeTagFilter} nodeTagMap={nodeTagMap} nodeGroupMap={nodeGroupMap} connVisMode={connVisMode} de={de} />

            {/* Port drag preview line */}
            {portDragPreview && (
              <svg style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none", zIndex: 100 }}>
                <defs>
                  <marker id="portDragArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="var(--color-brand)" opacity="0.7" />
                  </marker>
                </defs>
                <line
                  x1={portDragPreview.x1} y1={portDragPreview.y1}
                  x2={portDragPreview.x2} y2={portDragPreview.y2}
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  opacity={0.65}
                  markerEnd="url(#portDragArrow)"
                />
                <circle cx={portDragPreview.x2} cy={portDragPreview.y2} r={5} fill="var(--color-brand)" opacity={0.7} />
              </svg>
            )}

            {/* Auto-computed group blobs */}
            {canvasGroups.map(g => {
              const matchRatio = activeTagFilter
                ? g.nodeIds.filter(id => (nodeTagMap.get(id) ?? []).includes(activeTagFilter!)).length / g.nodeIds.length
                : 1;
              const groupOpacity = matchRatio >= 0.3 ? 1 : matchRatio > 0 ? 0.35 : 0.15;
              return (
              <div key={g.id} style={{
                position: "absolute",
                left: g.bounds.x, top: g.bounds.y,
                width: g.bounds.w, height: g.bounds.h,
                background: `${g.color}18`,
                border: `2px solid ${g.color}38`,
                borderRadius: 24,
                pointerEvents: "none",
                boxShadow: `inset 0 0 30px ${g.color}0C, 0 0 0 1px ${g.color}12`,
                opacity: groupOpacity,
                transition: "opacity 0.2s",
              }}>
                <div style={{
                  // Float the label above the group frame so it acts like a
                  // tab-style header — gives clear breathing room between the
                  // label pill and the first card inside the group.
                  position: "absolute", top: -13, left: 14,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                  color: g.color,
                  background: "var(--color-surface, #FFFFFF)",
                  boxShadow: `0 0 0 1px ${g.color}55, 0 1px 2px rgba(0,0,0,0.04)`,
                  padding: "3px 10px",
                  borderRadius: 8,
                  fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                  lineHeight: 1.2,
                }}>{g.label}</div>
              </div>
              );
            })}

            {/* User-created group blobs */}
            {userGroups.map(g => {
              // Recompute bounds dynamically from current node positions AND
              // transitive descendants — otherwise the box only covers the
              // explicitly-grouped queries and misses their derived cards.
              const boundsNodeIds = new Set<string>(g.nodeIds);
              let addedU = true;
              while (addedU) {
                addedU = false;
                for (const n of nodes) {
                  if (n.parentId && boundsNodeIds.has(n.parentId) && !boundsNodeIds.has(n.id)) {
                    boundsNodeIds.add(n.id);
                    addedU = true;
                  }
                }
              }
              const gNodes = Array.from(boundsNodeIds).map(id => nodes.find(n => n.id === id)).filter(Boolean) as CanvasNode[];
              if (gNodes.length < 2) return null;
              const xs = gNodes.map(n => n.x);
              const ys = gNodes.map(n => n.y);
              const PAD = 40;
              const bounds = {
                x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD,
                w: Math.max(...gNodes.map(n => n.x + getNodeWidth(n))) - Math.min(...xs) + PAD * 2,
                h: Math.max(...gNodes.map(n => n.y + getNodeHeight(n))) - Math.min(...ys) + PAD * 2,
              };
              const matchRatio = activeTagFilter
                ? g.nodeIds.filter(id => (nodeTagMap.get(id) ?? []).includes(activeTagFilter!)).length / g.nodeIds.length
                : 1;
              const groupOpacity = matchRatio >= 0.3 ? 1 : matchRatio > 0 ? 0.35 : 0.15;
              return (
                <div key={g.id} style={{
                  position: "absolute",
                  left: bounds.x, top: bounds.y,
                  width: bounds.w, height: bounds.h,
                  background: `${g.color}18`,
                  border: `2px solid ${g.color}38`,
                  boxShadow: `inset 0 0 30px ${g.color}0C, 0 0 0 1px ${g.color}12`,
                  borderRadius: 24,
                  opacity: groupOpacity,
                  transition: "opacity 0.2s",
                }}>
                  {/* Editable label — tab-style header floating above frame */}
                  <div style={{ position: "absolute", top: -13, left: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    {editingGroupId === g.id ? (
                      <input
                        autoFocus
                        defaultValue={g.label}
                        onBlur={e => {
                          setUserGroups(prev => prev.map(gg => gg.id === g.id ? { ...gg, label: e.target.value || g.label } : gg));
                          setEditingGroupId(null);
                        }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setEditingGroupId(null); } }}
                        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: g.color, background: "var(--color-surface, #FFFFFF)", border: `1px solid ${g.color}50`, borderRadius: 8, padding: "3px 10px", outline: "none", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", lineHeight: 1.2 }}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingGroupId(g.id)}
                        style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                          color: g.color, cursor: "pointer",
                          background: "var(--color-surface, #FFFFFF)",
                          boxShadow: `0 0 0 1px ${g.color}55, 0 1px 2px rgba(0,0,0,0.04)`,
                          padding: "3px 10px",
                          borderRadius: 8,
                          lineHeight: 1.2,
                          fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                        }}
                        title={de ? "Klicken zum Umbenennen" : "Click to rename"}
                      >{g.label}</span>
                    )}
                    <button
                      onClick={() => setUserGroups(prev => prev.filter(gg => gg.id !== g.id))}
                      title={de ? "Gruppe auflösen" : "Remove group"}
                      style={{ fontSize: 10, color: `${g.color}88`, background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#E8402A"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = `${g.color}88`; }}
                    >✕</button>
                  </div>
                </div>
              );
            })}

            {/* Multi-select outlines */}
            {multiSelectedIds.size > 0 && visibleNodes.filter(n => multiSelectedIds.has(n.id)).map(n => {
              const nw = n.nodeType === "query" ? ((n as QueryNode).customWidth ?? QUERY_NODE_W) : ((n as DerivedNode).customWidth ?? DERIVED_W);
              const nh = n.nodeType === "query" ? ((n as QueryNode).customHeight ?? QUERY_NODE_W) : ((n as DerivedNode).customHeight ?? DERIVED_W);
              return (
                <div key={`ms-${n.id}`} style={{
                  position: "absolute", left: n.x - 4, top: n.y - 4,
                  width: nw + 8, height: nh + 8,
                  border: "2px dashed #2563EB", borderRadius: 14,
                  pointerEvents: "none",
                  boxShadow: "0 0 0 2px rgba(37,99,235,0.15)",
                }} />
              );
            })}

            {/* Group membership left-border stripes */}
            {visibleNodes.map(n => {
              const grpColor = nodeGroupColor.get(n.id);
              if (!grpColor) return null;
              const isDimmedBySelection = selectedId !== null && !pipelineChain.has(n.id);
              const isDimmedByTag = activeTagFilter !== null && !(n.tags ?? []).includes(activeTagFilter);
              const isDimmed = isDimmedBySelection || isDimmedByTag;
              return (
                <div key={`grp-${n.id}`} style={{
                  position: "absolute", left: n.x - 5, top: n.y + 4,
                  width: 3, height: getNodeHeight(n) - 8,
                  background: grpColor, borderRadius: 2,
                  pointerEvents: "none", opacity: isDimmed ? 0.15 : 0.7,
                  transition: "opacity 0.2s",
                }} />
              );
            })}

            {visibleNodes.map(n => {
              const isDimmedBySelection = selectedId !== null && !pipelineChain.has(n.id);
              const isDimmedByTag = activeTagFilter !== null && !(n.tags ?? []).includes(activeTagFilter);
              const isDimmed = isDimmedBySelection || isDimmedByTag;
              const isMultiSelected = multiSelectedIds.has(n.id);
              if (n.nodeType === "query") {
                const qNode = n as QueryNode;
                return (
                  <QueryNodeCard key={n.id}
                    node={qNode} de={de}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onFollowUp={handleFollowUp}
                    onFollowUpQ={(id, q) => handleFollowUp(id, q)}
                    onDelete={deleteNode}
                    onToggleCollapse={toggleCollapse}
                    onRefresh={handleRefresh}
                    onResizeStart={handleResizeStart}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={qNode.customWidth ?? QUERY_NODE_W}
                    dimmed={isDimmed}
                    zoom={zoom}
                    causalFingerprint={(() => {
                      const cg = nodes.find(c => c.parentId === n.id && c.nodeType === "causalgraph") as DerivedNode | undefined;
                      if (!cg?.causalEdges?.length) return undefined;
                      const names = cg.causalTrendNames ?? {};
                      const counts = new Map<string, number>();
                      cg.causalEdges.forEach(e => {
                        counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
                        counts.set(e.to, (counts.get(e.to) ?? 0) + 1);
                      });
                      return Array.from(counts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([id]) => names[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                    })()}
                    childCounts={(() => {
                      const children = nodes.filter(c => c.parentId === n.id);
                      return {
                        insights:  children.filter(c => c.nodeType === "insight").length,
                        scenarios: children.filter(c => c.nodeType === "scenario").length,
                        decisions: children.filter(c => c.nodeType === "decision").length,
                        followups: children.filter(c => c.nodeType === "followup").length,
                        causal:    children.filter(c => c.nodeType === "causalgraph").length,
                      };
                    })()}
                    duplicateIndex={queryDupIndex.get(n.id) ?? 0}
                    onAddTag={handleAddTag}
                    onSetStatus={handleSetNodeStatus}
                  />
                );
              }
              if (n.nodeType === "note") {
                const nNode = n as NoteNode;
                return (
                  <NoteNodeCard key={n.id}
                    node={nNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onUpdate={handleUpdateNote}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    onPromote={handlePromoteNote}
                    nodeW={nNode.customWidth ?? 280}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              if (n.nodeType === "idea") {
                const iNode = n as IdeaNode;
                return (
                  <IdeaNodeCard key={n.id}
                    node={iNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onUpdate={handleUpdateIdea}
                    onPromote={handlePromoteIdea}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={iNode.customWidth ?? 300}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              if (n.nodeType === "list") {
                const lNode = n as ListNode;
                return (
                  <ListNodeCard key={n.id}
                    node={lNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onUpdate={handleUpdateList}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={lNode.customWidth ?? 280}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              if (n.nodeType === "file") {
                const fNode = n as FileNode;
                return (
                  <FileNodeCard key={n.id}
                    node={fNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onAnalyze={(query, parentId) => submitQuery(query, parentId)}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={fNode.customWidth ?? FILE_NODE_W}
                    dimmed={isDimmed}
                    zoom={zoom}
                  />
                );
              }
              const dNode = n as DerivedNode;
              if (dNode.nodeType === "dimensions") {
                return (
                  <DimensionsNodeCard key={n.id}
                    node={dNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={dNode.customWidth ?? DERIVED_W}
                    dimmed={isDimmed}
                  />
                );
              }
              if (dNode.nodeType === "causalgraph") {
                return (
                  <CausalGraphNodeCard key={n.id}
                    node={dNode}
                    selected={selectedId === n.id}
                    onSelect={handleSelectNode}
                    onDragStart={handleDragStart}
                    onDelete={deleteNode}
                    onResizeStart={handleResizeStart}
                    onIterate={handleIterateFromNode}
                    onPortDragStart={handlePortDragStart}
                    nodeW={dNode.customWidth ?? DERIVED_W}
                    dimmed={isDimmed}
                  />
                );
              }
              return (
                <DerivedNodeCard key={n.id}
                  node={dNode} de={de}
                  selected={selectedId === n.id}
                  onSelect={handleSelectNode}
                  onDragStart={handleDragStart}
                  onExplore={handleExplore}
                  onDelete={deleteNode}
                  onResizeStart={handleResizeStart}
                  onIterate={handleIterateFromNode}
                  onPortDragStart={handlePortDragStart}
                  onAddTag={handleAddTag}
                  onSetStatus={handleSetNodeStatus}
                  nodeW={dNode.customWidth ?? DERIVED_W}
                  dimmed={isDimmed}
                  zoom={zoom}
                />
              );
            })}
          </div>
          </ErrorBoundary>
        )}

        {/* Board mode */}
        {viewMode === "board" && (
          <div style={{ display: "flex", gap: 0, height: "100%", overflowX: "auto" }}>
            {BOARD_COLUMNS.map(col => {
              const allGroups = [...canvasGroups, ...userGroups];
              const colNodes = nodes.filter(n => col.types.includes(n.nodeType))
                .sort((a, b) => {
                  // Group members together, then by createdAt
                  const gA = allGroups.findIndex(g => g.nodeIds.includes(a.id));
                  const gB = allGroups.findIndex(g => g.nodeIds.includes(b.id));
                  if (gA !== gB) return gA - gB;
                  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
                });
              return (
                <div key={col.key} style={{ minWidth: 280, flex: 1, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                    <span className="section-label" style={{ color: col.color, marginBottom: 0 }}>{de ? col.labelDe : col.labelEn}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-page-bg)", padding: "1px 6px", borderRadius: 10, border: "1px solid var(--color-border)" }}>{colNodes.length}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {colNodes.map(n => {
                      const grpColor = nodeGroupColor.get(n.id);
                      return (
                      <div key={n.id}
                        onClick={() => handleSelectNode(n.id)}
                        style={{
                          padding: "10px 12px", borderRadius: 10, border: `1px solid ${selectedId === n.id ? col.color : "var(--color-border)"}`,
                          borderLeft: grpColor ? `3px solid ${grpColor}` : undefined,
                          background: "var(--color-surface)", cursor: "pointer", transition: "all 0.12s",
                          boxShadow: selectedId === n.id ? `0 0 0 2px ${col.color}40` : "0 1px 4px rgba(0,0,0,0.06)",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = col.color}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = selectedId === n.id ? col.color : "var(--color-border)"}
                      >
                        {grpColor && (
                          <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: grpColor, marginBottom: 3, fontFamily: "var(--font-code, monospace)" }}>
                            {allGroups.find(g => g.nodeIds.includes(n.id))?.label}
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)", lineHeight: 1.35, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {n.nodeType === "query" ? (n as QueryNode).query
                           : n.nodeType === "note" ? (n as NoteNode).content.slice(0,80)
                           : n.nodeType === "idea" ? (n as IdeaNode).title || (n as IdeaNode).content.slice(0,80)
                           : n.nodeType === "list" ? (n as ListNode).title || (n as ListNode).items?.[0] || "Liste"
                           : n.nodeType === "file" ? (n as FileNode).fileName
                           : (n as DerivedNode).label || (n as DerivedNode).content?.slice(0,80)}
                        </div>
                        {n.nodeType === "query" && (n as QueryNode).synthesis && (
                          <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(n as QueryNode).synthesis.slice(0,120)}
                          </p>
                        )}
                        {/* Causal fingerprint on query cards */}
                        {n.nodeType === "query" && (() => {
                          const cgChild = nodes.find(c => c.parentId === n.id && c.nodeType === "causalgraph") as DerivedNode | undefined;
                          if (!cgChild?.causalEdges?.length) return null;
                          const fpNames = cgChild.causalTrendNames ?? {};
                          const fpCounts = new Map<string, number>();
                          cgChild.causalEdges.forEach(e => {
                            fpCounts.set(e.from, (fpCounts.get(e.from) ?? 0) + 1);
                            fpCounts.set(e.to, (fpCounts.get(e.to) ?? 0) + 1);
                          });
                          const fingerprint = Array.from(fpCounts.entries())
                            .sort((a, b) => b[1] - a[1]).slice(0, 3)
                            .map(([id]) => fpNames[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                          return fingerprint.length > 0 ? (
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                              {fingerprint.map(t => (
                                <span key={t} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: "#1A9E5A14", color: "#1A9E5A", fontWeight: 600, fontFamily: "var(--font-code, monospace)" }}>{t}</span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        {/* Causal preview on causalgraph cards */}
                        {n.nodeType === "causalgraph" && (() => {
                          const cgNode = n as DerivedNode;
                          const edges = cgNode.causalEdges ?? [];
                          if (!edges.length) return null;
                          const names = cgNode.causalTrendNames ?? {};
                          const topTrends = Array.from(new Set(
                            edges.flatMap(e => [e.from, e.to])
                          )).slice(0, 4).map(id => names[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                          const typeCounts = new Map<string, number>();
                          edges.forEach(e => typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1));
                          return (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ fontSize: 10, color: EDGE_STYLE.drives.color, fontWeight: 600, marginBottom: 2 }}>
                                {edges.length} {de ? "Beziehungen" : "relations"}
                              </div>
                              {topTrends.length > 0 && (
                                <div style={{ fontSize: 10, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                                  {topTrends.join(", ")}
                                </div>
                              )}
                              <div style={{ fontSize: 9, color: "var(--color-text-muted)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {Array.from(typeCounts.entries()).map(([type, count]) => (
                                  <span key={type} style={{ color: EDGE_STYLE[type]?.color ?? "var(--color-text-muted)" }}>
                                    {count}× {de ? (EDGE_STYLE[type]?.labelDe ?? type) : (EDGE_STYLE[type]?.labelEn ?? type)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--color-text-muted)" }}>
                          <span>{formatNodeTime(n.createdAt)}</span>
                          {(n as any).nodeStatus && (n as any).nodeStatus !== "open" && (
                            <span style={{ color: NODE_STATUS_META[(n as any).nodeStatus as NodeStatus]?.color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <StatusIcon status={(n as any).nodeStatus as NodeStatus} size={9} /> {NODE_STATUS_META[(n as any).nodeStatus as NodeStatus]?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline mode */}
        {viewMode === "timeline" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "24px 32px" }}>
            <div className="section-label" style={{ marginBottom: 20 }}>
              {de ? "Gedankenverlauf" : "Thought History"}
            </div>
            {[...nodes].sort((a,b) => a.createdAt - b.createdAt).map((n, i) => {
              const color = NODE_MINIMAP_COLOR[n.nodeType] ?? "#888";
              const grpColor = nodeGroupColor.get(n.id);
              const grpLabel = grpColor ? [...canvasGroups, ...userGroups].find(g => g.nodeIds.includes(n.id))?.label : undefined;
              return (
                <div key={n.id} style={{ display: "flex", gap: 16, marginBottom: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: grpColor || color, flexShrink: 0, marginTop: 4, border: grpColor ? `2px solid ${grpColor}` : undefined }} />
                    {i < nodes.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 20, background: "var(--color-border)", marginTop: 3 }} />}
                  </div>
                  <div
                    // Previously this forced the view to switch to canvas
                    // before opening the detail. That yanked the user out
                    // of the chronological reading mode for every click.
                    // Now the click opens the DetailPanel in place (same
                    // overlay behaviour as Board view) and Timeline stays
                    // on screen behind it.
                    onClick={() => handleSelectNode(n.id)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", borderLeft: grpColor ? `3px solid ${grpColor}` : undefined, background: "var(--color-surface)", cursor: "pointer", marginBottom: 8, transition: "all 0.1s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.background = "var(--color-page-bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{n.nodeType}</span>
                      {grpLabel && (
                        <span style={{ fontSize: 8, padding: "0 5px", borderRadius: 3, background: `${grpColor}18`, color: grpColor, fontWeight: 600, fontFamily: "var(--font-code, monospace)" }}>{grpLabel}</span>
                      )}
                      {n.nodeType === "causalgraph" && ((n as DerivedNode).causalEdges?.length ?? 0) > 0 && (
                        <span style={{ fontSize: 8, padding: "0 5px", borderRadius: 3, background: `${EDGE_STYLE.drives.color}14`, color: EDGE_STYLE.drives.color, fontWeight: 600, fontFamily: "var(--font-code, monospace)" }}>
                          {(n as DerivedNode).causalEdges!.length} {de ? "Kanten" : "edges"}
                        </span>
                      )}
                      {(n as any).nodeStatus && (n as any).nodeStatus !== "open" && (
                        <StatusIcon status={(n as any).nodeStatus as NodeStatus} size={10} />
                      )}
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>{formatNodeTime(n.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-heading)", lineHeight: 1.4 }}>
                      {n.nodeType === "query" ? (n as QueryNode).query
                       : n.nodeType === "note" ? (n as NoteNode).content.slice(0,100)
                       : n.nodeType === "idea" ? (n as IdeaNode).title
                       : n.nodeType === "list" ? (n as ListNode).title
                       : n.nodeType === "causalgraph" && ((n as DerivedNode).causalEdges?.length ?? 0) > 0
                         ? (() => {
                             const cgNames = (n as DerivedNode).causalTrendNames ?? {};
                             const cgEdges = (n as DerivedNode).causalEdges ?? [];
                             const topTrends = Array.from(new Set(cgEdges.flatMap(e => [e.from, e.to])))
                               .slice(0, 3).map(id => cgNames[id] ?? id.replace(/mega-|macro-|micro-/g, "").replace(/-/g, " "));
                             return `${(n as DerivedNode).label || "Kausalnetz"} — ${topTrends.join(", ")}`;
                           })()
                       : (n as DerivedNode).label || (n as DerivedNode).content.slice(0,100)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Orbit view (Ableitung / Netzwerk sub-modes) ────────── */}
        {/* Sub-mode toggle (absolute, renders above OrbitDerivationView / OrbitGraphView) */}
        {viewMode === "orbit" && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 20, display: "inline-flex", gap: 1, padding: 3,
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
            borderRadius: 8, border: "1px solid var(--color-border)",
          }}>
            {(["ableitung", "netzwerk"] as const).map(mode => {
              const isAct = orbitSubMode === mode;
              const Icon = mode === "ableitung" ? GitBranch : Hexagon;
              const label = mode === "ableitung"
                ? (de ? "Ableitung" : "Derivation")
                : (de ? "Netzwerk" : "Network");
              return (
                <button key={mode} onClick={() => setOrbitSubMode(mode)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, padding: "5px 13px", borderRadius: 6, border: "none",
                    background: isAct ? "var(--card, #fff)" : "transparent",
                    color: isAct ? "var(--foreground, #0A0A0A)" : "var(--muted-foreground, #6B6B6B)",
                    fontWeight: isAct ? 700 : 500,
                    fontFamily: "var(--font-ui)",
                    boxShadow: isAct ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  <Icon size={12} strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {viewMode === "orbit" && orbitSubMode === "netzwerk" && (() => {
          // Aggregate all causal edges + trend names from causalgraph nodes
          const cgNodes = nodes.filter(n => n.nodeType === "causalgraph") as DerivedNode[];
          const orbitEdges = cgNodes.flatMap(n => n.causalEdges ?? []);
          const orbitNames: Record<string, string> = {};
          cgNodes.forEach(n => { Object.assign(orbitNames, n.causalTrendNames ?? {}); });
          const trendQueryMap: Record<string, string[]> = {};
          const queryLabels: Record<string, string> = {};
          cgNodes.forEach(cg => {
            const parentQId = cg.parentId;
            if (!parentQId) return;
            const parentQ = nodes.find(n => n.id === parentQId);
            if (parentQ && parentQ.nodeType === "query" && "query" in parentQ) {
              queryLabels[parentQId] = (parentQ as { query?: string }).query ?? parentQId;
            }
            (cg.causalEdges ?? []).forEach(e => {
              [e.from, e.to].forEach(tid => {
                if (!trendQueryMap[tid]) trendQueryMap[tid] = [];
                if (!trendQueryMap[tid].includes(parentQId)) trendQueryMap[tid].push(parentQId);
              });
            });
          });
          return (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
              <OrbitGraphView
                allEdges={orbitEdges}
                allTrendNames={orbitNames}
                trendQueryMap={trendQueryMap}
                queryLabels={queryLabels}
                de={de}
                onSelectQuery={(qId) => {
                  // "Vertiefen" shortcut still has to switch to canvas
                  // because it needs the floating command-line overlay
                  // which only exists in canvas mode.
                  if (qId.startsWith("__orbit_deepen__")) {
                    const trendLabel = qId.replace("__orbit_deepen__", "");
                    setCmdVisible(true);
                    setCmdPrefill(`Vertiefen: ${trendLabel} — Wie beeinflusst dieser Trend andere strategische Bereiche?`);
                    switchViewMode("canvas");
                  } else {
                    // Regular query click — open the DetailPanel in place
                    // so the user can read the analysis without losing
                    // the network view. Same UX as Board/Timeline clicks.
                    handleSelectNode(qId);
                  }
                }}
              />
            </div>
          );
        })()}
        {viewMode === "orbit" && orbitSubMode === "ableitung" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
            <OrbitDerivationView
              nodes={nodes as unknown as DerivCanvasNode[]}
              selectedNodeId={selectedId}
              de={de}
              onNavigateToNode={(nodeId) => {
                // In-place DetailPanel — same rule as Board / Timeline /
                // Orbit-Network. Keeps the derivation chain visible
                // behind the overlay so the user can close the panel
                // and continue navigating the spine.
                handleSelectNode(nodeId);
              }}
            />
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────── */}
        {/* Both the embedded and standalone empty states are now gated
             on `initDone && !projectOp && !projectId`. Without this
             gate the "Willkommen im Canvas" screen flashed briefly on
             every page navigation while the tenant context was still
             resolving and loadProject hadn't fired yet — a real UX
             glitch reported by the user. `initDone` turns true after
             the init effect has evaluated, `projectOp` covers the
             "loading project" state, and `projectId` means "we're in
             a project, don't show welcome even if its state happens
             to be empty right now". */}
        {viewMode === "canvas" && isEmpty && embedded && hydrated && initDone && !projectOp && !projectId && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "var(--color-text-muted)", opacity: 0.5 }}>
              <div style={{ marginBottom: 8 }}><LayoutGrid className="w-7 h-7 mx-auto" /></div>
              <div style={{ fontSize: 12 }}>Starte eine Analyse im Standard-View</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Die Ergebnisse erscheinen hier als Karten</div>
            </div>
          </div>
        )}
        {/* Standalone empty state */}
        {viewMode === "canvas" && isEmpty && !cmdVisible && !embedded && hydrated && initDone && !projectOp && !projectId && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, background: "radial-gradient(ellipse at 30% 40%, rgba(228,255,151,0.14) 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(10,10,10,0.03) 0%, transparent 50%)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-muted)", marginBottom: 28, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>
              {projectId ? projectName : "Intelligence Canvas"}
            </div>
            <CommandLine onSubmit={q => submitQuery(q)} onClose={() => {}} locale={locale} />
            <p style={{ marginTop: 18, fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.6, maxWidth: 460 }}>
              {de
                ? "Stelle eine Frage — die Antwort erscheint als Knoten, flankiert von Erkenntnissen, Szenarien und Empfehlungen als eigenständige Karten."
                : "Ask a question — the answer appears as a node, flanked by insights, scenarios and recommendations as individual cards."}
            </p>
            <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
              {(de ? ["AI Agents 2025", "Wie verändert sich die Arbeitswelt?", "DORA für Finanzdienstleister", "Quanten-Computing 2027"]
                   : ["AI Agents 2025", "Future of work", "DORA regulation", "Quantum computing outlook"]
              ).map(s => (
                <button key={s}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => submitQuery(s)}
                  style={{ fontSize: 12, padding: "5px 13px", borderRadius: 20, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#0A0A0A"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"; }}
                >→ {s}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Floating command line ───────────────────────────────── */}
        {viewMode === "canvas" && cmdVisible && !(embedded && isEmpty) && hydrated && (
          <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
            <CommandLine
              key={cmdPrefill + cmdParentId}
              onSubmit={q => submitQuery(q, cmdParentId ?? undefined)}
              onClose={() => { setCmdVisible(false); setCmdPrefill(""); setCmdParentId(null); }}
              locale={locale}
              prefill={cmdPrefill}
              contextLabel={cmdContextLabel}
            />
          </div>
        )}

        {/* ── NodePicker overlay ──────────────────────────────────── */}
        {viewMode === "canvas" && nodePickerVisible && (
          <>
            {/* Backdrop */}
            <div style={{ position: "absolute", inset: 0, zIndex: 49 }} onPointerDown={() => { setNodePickerVisible(false); setIterateCtx(null); setNodePickerPos(null); portDropCanvasPosRef.current = null; }} />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={de ? "Neuen Knoten hinzufügen" : "Add new node"}
              style={nodePickerPos
                ? { position: "absolute", left: nodePickerPos.x, top: nodePickerPos.y, transform: "translate(-50%, -100%) translateY(-16px)", zIndex: 50 }
                : { position: "absolute", bottom: 84, left: "50%", transform: "translateX(-50%)", zIndex: 50 }
              }
            >
              <NodePicker onSelect={handleNodeTypeSelect} onClose={() => { setNodePickerVisible(false); setIterateCtx(null); setNodePickerPos(null); portDropCanvasPosRef.current = null; }} hasContext={!!iterateCtx} />
            </div>
          </>
        )}

        {/* ── Hints bottom-right ──────────────────────────────────── */}
        {viewMode === "canvas" && (
          <div style={{ position: "absolute", bottom: 14, right: 18, fontSize: 10, color: "var(--color-text-muted)", textAlign: "right", pointerEvents: "none", lineHeight: 1.6 }}>
            <div>{de ? "Scrollen = Zoom · Hintergrund ziehen = Pan" : "Scroll = zoom · Drag background = pan"}</div>
          </div>
        )}

        {/* ── Minimap ──────────────────────────────────────────────── */}
        {viewMode === "canvas" && (
          <Minimap
            nodes={visibleNodes}
            panX={panX} panY={panY} zoom={zoom}
            viewportW={viewportSize.w} viewportH={viewportSize.h}
            onNavigate={(px, py) => { setPanX(px); setPanY(py); }}
            rightOffset={16}
          />
        )}

        {/* ── Volt UI Node Canvas: Zoom Controls (bottom-right) ─────── */}
        {viewMode === "canvas" && !embedded && hydrated && (
          <div style={{
            position: "absolute",
            bottom: 16, right: 16,
            display: "flex",
            alignItems: "center",
            gap: 1,
            padding: "4px",
            background: "var(--color-surface, rgba(255,255,255,0.96))",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            backdropFilter: "blur(12px) saturate(160%)",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}>
            <button
              onClick={() => setZoom(prev => Math.max(0.2, prev * 0.85))}
              title={de ? "Verkleinern" : "Zoom out"}
              style={{
                width: 32, height: 32, borderRadius: 7, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--foreground)", fontSize: 16, fontWeight: 500,
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--muted, #F7F7F7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >−</button>
            <button
              onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
              title={de ? "Zurücksetzen" : "Reset"}
              style={{
                minWidth: 56, height: 32, borderRadius: 7, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--muted-foreground)", fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 600, letterSpacing: "0.02em",
                transition: "background 0.12s",
                fontVariantNumeric: "tabular-nums",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--muted, #F7F7F7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >{Math.round(zoom * 100)}%</button>
            <button
              onClick={() => setZoom(prev => Math.min(2.5, prev * 1.18))}
              title={de ? "Vergrößern" : "Zoom in"}
              style={{
                width: 32, height: 32, borderRadius: 7, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--foreground)", fontSize: 16, fontWeight: 500,
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--muted, #F7F7F7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >+</button>
          </div>
        )}

        {/* ── Volt UI Node Canvas: Node-Status Legend (bottom-left) ─── */}
        {viewMode === "canvas" && !embedded && hydrated && nodes.length > 0 && (
          <div style={{
            position: "absolute",
            // Raised above the floating command line zone so items never clip
            // on shorter viewports and there's visible gap from the bottom
            // edge; horizontal padding inside the pill was too tight against
            // the container edge, so the whole pill shifts 4px in.
            bottom: 20, left: 20,
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            gap: 12,
            padding: "8px 16px",
            maxWidth: "calc(100% - 320px)",
            overflow: "hidden",
            background: "var(--color-surface, rgba(255,255,255,0.96))",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            backdropFilter: "blur(12px) saturate(160%)",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--muted-foreground)",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase" as const, color: "var(--muted-foreground)",
              marginRight: 2, flexShrink: 0,
            }}>
              {de ? "Status" : "Status"}
            </span>
            {[
              { dot: "#1A9E5A", label: de ? "Fertig" : "Done" },
              { dot: "#F5A623", label: de ? "Läuft" : "Running" },
              { dot: "#E8402A", label: de ? "Fehler" : "Error" },
              { dot: "#9CA3AF", label: de ? "Offen" : "Idle" },
            ].map((s, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* FIXED: UX-05 — Ensure text cursor in input/textarea/contentEditable even when parent has cursor:pointer */}
      <style>{`
        @keyframes cur-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        input, textarea, [contenteditable="true"] { cursor: text !important; }
      `}</style>

      {/* ── Detail Panel ────────────────────────────────────────────── */}
      {detailNodeId && (() => {
        const detailNode = nodes.find(n => n.id === detailNodeId);
        if (!detailNode) return null;
        return (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setDetailNodeId(null)}
              style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
            />
            <DetailPanel
              key={detailNodeId}
              node={detailNode}
              de={de}
              allQueryNodes={queryNodes}
              siblingScenarios={detailNode.nodeType === "scenario"
                ? (nodes.filter(n => n.nodeType === "scenario" && (n as DerivedNode).parentId === (detailNode as DerivedNode).parentId) as DerivedNode[])
                : undefined
              }
              onClose={() => setDetailNodeId(null)}
              onFollowUp={handleFollowUp}
              onRefresh={handleRefresh}
              onExplore={handleExplore}
              onDelete={deleteNode}
              onUpdateNote={handleUpdateNote}
              onUpdateIdea={handleUpdateIdea}
              onUpdateList={handleUpdateList}
              onPromoteNote={handlePromoteNote}
              onPromoteIdea={handlePromoteIdea}
              onAnalyzeFile={(query, parentId) => submitQuery(query, parentId)}
              onIterate={handleIterateFromNode}
              onSetStatus={handleSetNodeStatus}
              onUpdateTags={(id, tags) => setNodes(prev => prev.map(n => n.id === id ? { ...n, tags } : n))}
            />
          </>
        );
      })()}

      {/* ── Delete Confirmation Toast ──────────────────────────────── */}
      {/* VERIFIED: UX-07 — deleteConfirmId captures target node ID at dialog-show time,
          so even if selectedId changes between showing dialog and confirming,
          the correct node is always deleted. Both Enter-key and button use deleteConfirmId. */}
      {deleteConfirmId && (() => {
        const dn = nodes.find(n => n.id === deleteConfirmId);
        const label = dn
          ? dn.nodeType === "query" ? `„${(dn as QueryNode).query.slice(0, 42)}${(dn as QueryNode).query.length > 42 ? "…" : ""}"`
          : dn.nodeType === "note" ? "diese Notiz"
          : dn.nodeType === "idea" ? "diese Idee"
          : dn.nodeType === "list" ? "diese Liste"
          : dn.nodeType === "file" ? `„${(dn as FileNode).fileName}"`
          : "diese Karte"
          : "diese Karte";
        return (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sis-delete-confirm-title"
            aria-describedby="sis-delete-confirm-desc"
            style={{
              position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
              background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: "1.5px solid var(--signal-negative-border, #F4A090)",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
              padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
              zIndex: 9999, minWidth: 340,
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: "var(--signal-negative-light, #FDEEE9)",
              border: "1px solid var(--signal-negative-border, #F4A090)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>🗑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p id="sis-delete-confirm-title" style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-heading)", margin: 0, letterSpacing: "-0.01em" }}>{de ? "Karte löschen?" : "Delete card?"}</p>
              <p id="sis-delete-confirm-desc" style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label} · {de ? "nicht rückgängig machbar · Enter zum Bestätigen" : "cannot be undone · press Enter to confirm"}
              </p>
            </div>
            <button
              onClick={() => { deleteNode(deleteConfirmId); setDeleteConfirmId(null); }}
              style={{ background: "var(--signal-negative-light, #FDEEE9)", border: "1.5px solid var(--signal-negative-border, #F4A090)", color: "var(--signal-negative-text, #A01A08)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#E8402A"; el.style.color = "#fff"; el.style.borderColor = "#E8402A"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--signal-negative-light, #FDEEE9)"; el.style.color = "var(--signal-negative-text, #A01A08)"; el.style.borderColor = "var(--signal-negative-border, #F4A090)"; }}
            >{de ? "Löschen" : "Delete"}</button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              style={{ background: "transparent", border: "1.5px solid var(--color-border)", color: "var(--color-text-secondary)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            >{de ? "Abbrechen" : "Cancel"}</button>
          </div>
        );
      })()}

      {/* ── Briefing Modal ─────────────────────────────────────────── */}
      {briefingOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 250 }} onClick={() => setBriefingOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={de ? "Briefing" : "Briefing"}
            style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: "min(680px, 92vw)", maxHeight: "80vh",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 18,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.08)", zIndex: 251,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)" }}>{de ? "Strategisches Briefing" : "Strategic Briefing"}</span>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "generiert aus Canvas" : "generated from canvas"}</span>
              <button onClick={() => setBriefingOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-muted)", padding: "2px 6px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {briefingLoading && !briefingText && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{de ? "Generiere Briefing…" : "Generating briefing…"}</div>
              )}
              {briefingText && (
                <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--color-text-primary)", margin: 0, whiteSpace: "pre-wrap" }}>{briefingText}</p>
              )}
            </div>
            {briefingText && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid var(--color-border)", display: "flex", gap: 8 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(briefingText); }}
                  style={{ fontSize: 12, padding: "5px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", color: "var(--color-text-secondary)" }}
                >{de ? "Kopieren" : "Copy"}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
