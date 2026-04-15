"use client";

// TODO: ARC-12 — Namespace collision: src/components/session/ and src/components/sessions/ both active.

/**
 * Shared list of sessions used by both /sessions (active) and /sessions/archiv
 * (archived). Handles data fetching, row actions (archive / restore / delete),
 * framework categorization (chips + filter), and empty/error states.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useActiveTenantId } from "@/lib/tenant-context";
import { tenantStorage, TENANT_STORAGE_KEYS } from "@/lib/tenant-storage";
// voltConfirm ersetzt window.confirm fuer destruktive Aktionen. Der
// native OS-Dialog haelt sich nicht an das Volt-Design und fuehlt sich
// als Fremdkoerper an — jetzt in-app Modal mit konsistenter Typo/Spacing.
import { voltConfirm } from "@/components/volt";
import {
  FRAMEWORK_CATEGORIES,
  type FrameworkCategory,
  type FrameworkCategoryId,
  detectFrameworkCategory,
  cleanSessionTitle,
} from "@/lib/framework-detect";
import { Archive, ArchiveRestore, Pencil, Trash2, Check, X as XIcon, ArrowDownUp } from "lucide-react";

// ── Sort options ────────────────────────────────────────────────────────────
type SortKey = "updated" | "created" | "name-asc" | "name-desc" | "size";
interface SortOption {
  key: SortKey;
  labelDe: string;
  labelEn: string;
}
const SORT_OPTIONS: SortOption[] = [
  { key: "updated",   labelDe: "Zuletzt bearbeitet", labelEn: "Last edited" },
  { key: "created",   labelDe: "Zuletzt erstellt",   labelEn: "Recently created" },
  { key: "name-asc",  labelDe: "Name A → Z",          labelEn: "Name A → Z" },
  { key: "name-desc", labelDe: "Name Z → A",          labelEn: "Name Z → A" },
  { key: "size",      labelDe: "Meiste Nodes",        labelEn: "Most nodes" },
];

export interface SessionRow {
  id: string;
  name: string;
  description: string | null;
  hasState: boolean;
  nodeCount: number;
  queryCount: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

type Mode = "active" | "archived";

interface Props {
  mode: Mode;
  de: boolean;
}

function formatRelative(iso: string, de: boolean): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return de ? "gerade eben" : "just now";
  if (mins < 60) return de ? `vor ${mins} Min` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return de ? `vor ${hrs} Std` : `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return de ? `vor ${days} Tg` : `${days} d ago`;
  return d.toLocaleDateString(de ? "de-DE" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatAbsolute(iso: string, de: boolean): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(de ? "de-DE" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function SessionList({ mode, de }: Props) {
  // Tenant-Scope fuer localStorage-Writes. `activeTenantId` ist SSR-
  // hydratisiert, kann aber `null` sein, wenn die Komponente ohne Session
  // rendert (Logout-Flow). Wir ziehen Alt-Daten einmalig in den Scope, damit
  // Nutzer die gerade offene Session nach dem Tenant-Rollout nicht
  // verlieren.
  const activeTenantId = useActiveTenantId();
  useEffect(() => {
    if (!activeTenantId) return;
    tenantStorage.migrateLegacy(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);
  }, [activeTenantId]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterId, setFilterId] = useState<FrameworkCategoryId | "all">("all");
  // Sort state — default: last edited (matches the mental model users have
  // when returning to sessions). Persisted so the choice survives navigation.
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "updated";
    try {
      const v = localStorage.getItem("sis-sessions-sort");
      if (v && ["updated", "created", "name-asc", "name-desc", "size"].includes(v)) return v as SortKey;
    } catch {}
    return "updated";
  });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sessionScrollRef = useRef<HTMLDivElement>(null);
  // Inline rename state — only one row can be edited at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");

  // Persist sort choice and close the menu on outside click / Escape.
  useEffect(() => {
    try { localStorage.setItem("sis-sessions-sort", sortKey); } catch {}
  }, [sortKey]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortMenuOpen]);

  const load = useCallback(() => {
    setLoading(true);
    const q = mode === "archived" ? "?archived=true" : "";
    fetchWithTimeout(`/api/v1/canvas${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const data = json.data ?? json;
        const list = (data?.canvases ?? []) as SessionRow[];
        setSessions(list);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const archive = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (activeTenantId) {
        const active = tenantStorage.get(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);
        if (active === id) tenantStorage.remove(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        alert(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        console.error("[archive]", e);
        alert(de ? "Archivieren fehlgeschlagen." : "Archive failed.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        alert(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        console.error("[restore]", e);
        alert(de ? "Wiederherstellen fehlgeschlagen." : "Restore failed.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const deleteSession = async (id: string, name: string) => {
    if (busyId) return;
    const confirmed = await voltConfirm({
      title: de ? "Projekt dauerhaft löschen?" : "Permanently delete project?",
      message: de
        ? `„${name}"\n\nDiese Aktion kann nicht rückgängig gemacht werden.`
        : `"${name}"\n\nThis action cannot be undone.`,
      confirmLabel: de ? "Löschen" : "Delete",
      cancelLabel: de ? "Abbrechen" : "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;
    setBusyId(id);
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (activeTenantId) {
        const active = tenantStorage.get(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);
        if (active === id) tenantStorage.remove(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas);
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        alert(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        console.error("[delete]", e);
        alert(de ? "Löschen fehlgeschlagen." : "Delete failed.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const beginRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const commitRename = async () => {
    if (!editingId) return;
    const id = editingId;
    const nextName = editName.trim();
    const current = sessions.find((s) => s.id === id);
    if (!current) { cancelRename(); return; }
    // No-op if nothing changed or empty input
    if (!nextName || nextName === current.name) { cancelRename(); return; }
    setBusyId(id);
    try {
      const res = await fetchWithTimeout(`/api/v1/canvas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name: nextName } : s)));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        alert(de ? "Zeitlimit überschritten." : "Request timed out.");
      } else {
        console.error("[rename]", e);
        alert(de ? "Umbenennen fehlgeschlagen." : "Rename failed.");
      }
    } finally {
      setBusyId(null);
      cancelRename();
    }
  };

  // active canvas id (only relevant in active mode), tenant-scoped so two
  // tenants in the same browser cannot cross-contaminate the "currently
  // open" marker.
  const activeCanvasId = activeTenantId
    ? tenantStorage.get(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas)
    : null;

  // Annotate sessions with their derived framework category.
  const annotated = useMemo(
    () => sessions.map((s) => ({ ...s, category: detectFrameworkCategory(s.name) })),
    [sessions]
  );

  // Count per category for the filter pills (before filtering).
  const categoryCounts = useMemo(() => {
    const counts = new Map<FrameworkCategoryId, number>();
    for (const s of annotated) {
      counts.set(s.category.id, (counts.get(s.category.id) ?? 0) + 1);
    }
    return counts;
  }, [annotated]);

  // Filter by selected framework.
  const filtered = useMemo(
    () => (filterId === "all" ? annotated : annotated.filter((s) => s.category.id === filterId)),
    [annotated, filterId]
  );

  const sorted = useMemo(() => {
    const collator = new Intl.Collator(de ? "de" : "en", { sensitivity: "base", numeric: true });
    const compare = (a: typeof filtered[number], b: typeof filtered[number]): number => {
      switch (sortKey) {
        case "updated":
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name-asc":
          return collator.compare(cleanSessionTitle(a.name), cleanSessionTitle(b.name));
        case "name-desc":
          return collator.compare(cleanSessionTitle(b.name), cleanSessionTitle(a.name));
        case "size":
          // Primary: nodeCount desc. Tiebreaker: most recently edited first.
          if (b.nodeCount !== a.nodeCount) return b.nodeCount - a.nodeCount;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    };
    // Every session — including the active one — participates in the sort.
    // The active session stays visually distinguished via the lime background,
    // the left rail, and the "Aktiv" badge, but its position follows the
    // selected sort key just like every other row.
    return [...filtered].sort(compare);
  }, [filtered, sortKey, de]);

  const sessionVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => sessionScrollRef.current,
    estimateSize: () => 72,
    overscan: 6,
  });

  if (loading) {
    return (
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--volt-text-muted)", padding: "60px 0" }}>
        {de ? "Lade Projekte…" : "Loading projects…"}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{
        padding: "20px 22px",
        background: "var(--volt-negative-light, #FEF2F2)",
        border: "1px solid var(--volt-negative-border, #FECACA)",
        borderRadius: "var(--volt-radius-md, 10px)",
        color: "var(--volt-negative-text, #991B1B)",
        fontSize: 13,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <span>
          {de
            ? "Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut."
            : "Data could not be loaded. Please try again."}
        </span>
        <button
          onClick={load}
          style={{
            alignSelf: "flex-start",
            fontSize: 12, fontWeight: 600, padding: "6px 16px",
            borderRadius: "var(--volt-radius-md, 10px)",
            border: "1px solid var(--volt-negative-border, #FECACA)",
            background: "transparent",
            color: "var(--volt-negative-text, #991B1B)",
            cursor: "pointer",
          }}
        >
          {de ? "Erneut versuchen" : "Retry"}
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    const emptyTitle = mode === "active"
      ? (de ? "Starte deinen ersten strategischen Arbeitsstrang" : "Start your first strategic thread")
      : (de ? "Archiv ist leer" : "Archive is empty");
    const emptyDesc = mode === "active"
      ? (de
          ? "Eröffne ein Projekt direkt über die Startseite — mit einer Frage oder einem Framework."
          : "Open a project from the home page — with a question or a framework.")
      : (de
          ? "Wenn du ein Projekt abschließt, kannst du es hier ablegen, ohne es zu löschen."
          : "When you finish a project, archive it here without deleting.");
    return (
      <div style={{
        textAlign: "center",
        padding: "80px 24px",
        border: "1.5px dashed var(--volt-border, #E8E8E8)",
        borderRadius: "var(--volt-radius-lg, 14px)",
        background: "var(--volt-surface, #FAFAFA)",
      }}>
        <div style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--volt-text-faint, #AAA)", marginBottom: 14,
        }}>
          {mode === "active"
            ? (de ? "Keine Projekte vorhanden" : "No projects yet")
            : (de ? "Keine archivierten Projekte" : "No archived projects")}
        </div>
        <h2 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 22, fontWeight: 700, color: "var(--volt-text, #0A0A0A)",
          margin: "0 0 10px", lineHeight: 1.25,
        }}>
          {emptyTitle}
        </h2>
        <p style={{
          fontSize: 13, color: "var(--volt-text-muted, #6B6B6B)",
          lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 440,
        }}>
          {emptyDesc}
        </p>
        {mode === "active" && (
          <a
            href="/"
            style={{
              display: "inline-block",
              fontSize: 13, fontWeight: 600, padding: "10px 22px",
              borderRadius: "var(--volt-radius-md, 10px)",
              background: "var(--volt-lime, #E4FF97)",
              color: "#0A0A0A",
              textDecoration: "none",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            }}
          >
            {de ? "Zur Startseite →" : "Go to Home →"}
          </a>
        )}
      </div>
    );
  }

  const currentSortOption = SORT_OPTIONS.find(o => o.key === sortKey) ?? SORT_OPTIONS[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter pills + sort dropdown — single row, sort right-aligned */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--volt-text-faint, #999)",
          marginRight: 6,
        }}>
          {de ? "Filter" : "Filter"}
        </span>
        <FilterPill
          label={de ? "Alle" : "All"}
          count={annotated.length}
          active={filterId === "all"}
          onClick={() => setFilterId("all")}
        />
        {FRAMEWORK_CATEGORIES
          .filter((c) => (categoryCounts.get(c.id) ?? 0) > 0)
          .map((c) => (
            <FilterPill
              key={c.id}
              label={de ? c.labelDe : c.labelEn}
              count={categoryCounts.get(c.id) ?? 0}
              active={filterId === c.id}
              onClick={() => setFilterId(c.id)}
              color={c}
            />
          ))
        }

        {/* Sort dropdown — hugs the right edge of the row */}
        <div ref={sortMenuRef} style={{ position: "relative", marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => setSortMenuOpen((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 11, fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--volt-border, #E8E8E8)",
              background: sortMenuOpen ? "var(--volt-surface, #FAFAFA)" : "var(--volt-surface-raised, #fff)",
              color: "var(--volt-text, #0A0A0A)",
              cursor: "pointer",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              transition: "background 120ms ease",
              whiteSpace: "nowrap",
            }}
            aria-haspopup="listbox"
            aria-expanded={sortMenuOpen}
            aria-label={de ? "Sortierung ändern" : "Change sort order"}
          >
            <ArrowDownUp size={12} strokeWidth={2} style={{ color: "var(--volt-text-faint, #999)" }} />
            <span style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--volt-text-faint, #999)",
            }}>
              {de ? "Sortierung" : "Sort"}
            </span>
            <span>{de ? currentSortOption.labelDe : currentSortOption.labelEn}</span>
            <span style={{ fontSize: 8, color: "var(--volt-text-faint, #999)", marginLeft: 2 }}>▼</span>
          </button>

          {sortMenuOpen && (
            <div
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 220,
                background: "var(--volt-surface-raised, #fff)",
                border: "1px solid var(--volt-border, #E8E8E8)",
                borderRadius: "var(--volt-radius-md, 10px)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
                padding: 6,
                zIndex: 40,
                display: "flex", flexDirection: "column", gap: 2,
              }}
            >
              {SORT_OPTIONS.map((opt) => {
                const selected = opt.key === sortKey;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { setSortKey(opt.key); setSortMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: "var(--volt-radius-sm, 8px)",
                      background: selected ? "rgba(228,255,151,0.35)" : "transparent",
                      color: "var(--volt-text, #0A0A0A)",
                      fontSize: 13, fontWeight: selected ? 600 : 400,
                      fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                      cursor: "pointer",
                      transition: "background 100ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "var(--volt-surface, #FAFAFA)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = selected ? "rgba(228,255,151,0.35)" : "transparent";
                    }}
                  >
                    <span style={{
                      width: 14, display: "inline-flex", justifyContent: "center",
                      color: selected ? "var(--volt-text, #0A0A0A)" : "transparent",
                      fontSize: 12,
                    }}>✓</span>
                    <span>{de ? opt.labelDe : opt.labelEn}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 && filterId !== "all" && (
        <div style={{
          padding: "18px 20px",
          border: "1px dashed var(--volt-border, #E8E8E8)",
          borderRadius: "var(--volt-radius-md, 10px)",
          background: "var(--volt-surface, #FAFAFA)",
          fontSize: 13,
          color: "var(--volt-text-muted, #6B6B6B)",
          textAlign: "center",
        }}>
          {de ? "Keine Projekte in dieser Kategorie." : "No projects in this category."}
        </div>
      )}

      {filtered.length > 0 && (
      <div
        className="sis-session-list"
        style={{
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--volt-border, #E8E8E8)",
          borderRadius: 16,
          background: "var(--volt-surface-raised, #fff)",
          overflow: "hidden",
        }}
      >
      {/* Column headers — Volt UI table: font-mono 11px/600, #6B6B6B, bg-muted/30 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1fr) 150px 128px 128px 96px 120px",
        gap: 16,
        padding: "10px 20px",
        background: "rgba(250,250,250,0.3)",
        borderBottom: "1px solid var(--volt-border, #E8E8E8)",
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em",
        color: "var(--volt-text-muted, #6B6B6B)",
      }}>
        <div>{de ? "Projekt" : "Project"}</div>
        <div>{de ? "Framework" : "Framework"}</div>
        <div>{de ? "Gestartet" : "Started"}</div>
        <div>
          {mode === "active"
            ? (de ? "Zuletzt bearbeitet" : "Last edit")
            : (de ? "Archiviert" : "Archived")}
        </div>
        <div>{de ? "Umfang" : "Size"}</div>
        <div style={{ textAlign: "right" }} />
      </div>

      <div ref={sessionScrollRef} style={{ maxHeight: "min(72vh, 800px)", overflowY: "auto" }}>
        <div style={{ height: sessionVirtualizer.getTotalSize(), position: "relative" }}>
          {sessionVirtualizer.getVirtualItems().map((virtualRow) => {
            const idx = virtualRow.index;
            const s = sorted[idx];
            const isActive = mode === "active" && s.id === activeCanvasId;
            const hasContent = s.nodeCount > 0;
            const isLast = idx === sorted.length - 1;
            const isBusy = busyId === s.id;
            const secondDate = mode === "active" ? s.updated_at : (s.archived_at ?? s.updated_at);
            const displayTitle = cleanSessionTitle(s.name) || (de ? "Unbenanntes Projekt" : "Untitled project");
            const activeBg = "rgba(228,255,151,0.16)";
            const hoverBg  = "rgba(228,255,151,0.04)";

            return (
              <div
                key={s.id}
                data-index={idx}
                ref={sessionVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="sis-session-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(280px, 1fr) 150px 128px 128px 96px 120px",
                    gap: 16,
                    alignItems: "center",
                    padding: "12px 20px",
                    borderBottom: isLast ? "none" : "1px solid var(--volt-border, #EEE)",
                    background: isActive ? activeBg : "transparent",
                    transition: "background-color 120ms ease",
                    position: "relative",
                    opacity: isBusy ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    if (!isActive && !isBusy) el.style.background = hoverBg;
                    const actions = el.querySelector<HTMLDivElement>(".sis-session-actions");
                    if (actions) actions.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = isActive ? activeBg : "transparent";
                    const actions = el.querySelector<HTMLDivElement>(".sis-session-actions");
                    if (actions) actions.style.opacity = "0";
                  }}
                >
            {/* Active rail on the left edge */}
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0, top: 0, bottom: 0,
                  width: 3,
                  background: "var(--signal-positive, #1A9E5A)",
                }}
              />
            )}

            {/* Column 1: Session name + active badge + description.
                 When editing, a text input replaces the title; the row is not
                 clickable in that state. */}
            {editingId === s.id ? (
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="text"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                    else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                  }}
                  onBlur={() => { /* keep open; explicit save/cancel icons below */ }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1, minWidth: 0,
                    fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
                    fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
                    color: "var(--volt-text, #0A0A0A)",
                    padding: "8px 12px",
                    border: "1.5px solid var(--volt-text, #0A0A0A)",
                    borderRadius: "var(--volt-radius-md, 10px)",
                    background: "var(--volt-surface-raised, #fff)",
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <a
                href={`/canvas?project=${s.id}`}
                onClick={() => { if (activeTenantId) tenantStorage.set(activeTenantId, TENANT_STORAGE_KEYS.activeCanvas, s.id); }}
                style={{
                  minWidth: 0, overflow: "hidden",
                  textDecoration: "none", color: "inherit",
                }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
                  color: "var(--volt-text, #0A0A0A)",
                  lineHeight: 1.4,
                }}>
                  <span style={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0, flexShrink: 1,
                  }}>
                    {displayTitle}
                  </span>
                  {isActive && (
                    <span style={{
                      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "var(--signal-positive, #1A9E5A)",
                      display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--signal-positive, #1A9E5A)" }} />
                      {de ? "Aktiv" : "Active"}
                    </span>
                  )}
                </div>
                {s.description && (
                  <div style={{
                    fontSize: 12, color: "var(--volt-text-muted, #6B6B6B)",
                    lineHeight: 1.45, marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {s.description}
                  </div>
                )}
              </a>
            )}

            {/* Column 2: Framework chip (own column, no visual separator) */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <FrameworkChip category={s.category} de={de} />
            </div>

            {/* Started */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 2,
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            }}>
              <span style={{ fontSize: 12, color: "var(--volt-text, #0A0A0A)", fontWeight: 500 }}>
                {formatAbsolute(s.created_at, de)}
              </span>
              <span style={{ fontSize: 10, color: "var(--volt-text-faint, #A8A8A8)" }}>
                {formatRelative(s.created_at, de)}
              </span>
            </div>

            {/* Last edit OR Archived date */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 2,
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            }}>
              <span style={{ fontSize: 12, color: "var(--volt-text, #0A0A0A)", fontWeight: 500 }}>
                {formatAbsolute(secondDate, de)}
              </span>
              <span style={{ fontSize: 10, color: "var(--volt-text-faint, #A8A8A8)" }}>
                {formatRelative(secondDate, de)}
              </span>
            </div>

            {/* Size */}
            <div style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 11,
              color: hasContent ? "var(--volt-text-muted, #6B6B6B)" : "var(--volt-text-faint, #BBB)",
            }}>
              {hasContent ? (
                <>
                  <div>{s.nodeCount} {de ? "Nodes" : "nodes"}</div>
                  {s.queryCount > 0 && (
                    <div style={{ fontSize: 10, color: "var(--volt-text-faint, #A8A8A8)" }}>
                      {s.queryCount} {de ? "Fragen" : "queries"}
                    </div>
                  )}
                </>
              ) : (
                <span>{de ? "leer" : "empty"}</span>
              )}
            </div>

            {/* Actions (hover-revealed icon buttons with tooltips).
                 When editing, the action group shows save (✓) and cancel (✕)
                 icons instead of rename/archive/delete. */}
            <div
              className="sis-session-actions"
              style={{
                display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
                // While editing, keep actions permanently visible so the user can save/cancel.
                opacity: editingId === s.id ? 1 : 0,
                transition: "opacity 140ms ease",
              }}
            >
              {editingId === s.id ? (
                <>
                  <IconActionButton
                    title={de ? "Speichern" : "Save"}
                    onClick={() => commitRename()}
                    disabled={isBusy}
                    icon={<Check size={16} strokeWidth={2} />}
                  />
                  <IconActionButton
                    title={de ? "Abbrechen" : "Cancel"}
                    onClick={() => cancelRename()}
                    disabled={isBusy}
                    icon={<XIcon size={16} strokeWidth={2} />}
                  />
                </>
              ) : (
                <>
                  <IconActionButton
                    title={de ? "Umbenennen" : "Rename"}
                    onClick={() => beginRename(s.id, s.name)}
                    disabled={isBusy}
                    icon={<Pencil size={16} strokeWidth={1.75} />}
                  />
                  {mode === "active" ? (
                    <IconActionButton
                      title={de ? "In Archiv verschieben" : "Move to archive"}
                      onClick={() => archive(s.id)}
                      disabled={isBusy}
                      icon={<Archive size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <IconActionButton
                      title={de ? "Aus Archiv wiederherstellen" : "Restore from archive"}
                      onClick={() => restore(s.id)}
                      disabled={isBusy}
                      icon={<ArchiveRestore size={16} strokeWidth={1.75} />}
                    />
                  )}
                  <IconActionButton
                    title={de ? "Endgültig löschen" : "Permanently delete"}
                    onClick={() => deleteSession(s.id, s.name)}
                    disabled={isBusy}
                    destructive
                    icon={<Trash2 size={16} strokeWidth={1.75} />}
                  />
                </>
              )}
              </div>
            </div>
          </div>
        );
      })}
        </div>
      </div>
      </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FilterPill({
  label, count, active, onClick, color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: FrameworkCategory;
}) {
  // Volt UI FilterPill spec: rounded-full, text-[11px], font-mono
  // Active "Alle": bg-foreground (#0A0A0A) text-background (#fff) font-semibold
  // Inactive: transparent bg, border-border, text-muted-foreground
  // Active with color: use framework color
  const bg = active
    ? (color?.bg ?? "#0A0A0A")
    : "transparent";
  const fg = active
    ? (color?.fg ?? "#fff")
    : "var(--volt-text-muted, #6B6B6B)";
  const border = active
    ? (color?.border ?? "#0A0A0A")
    : "var(--volt-border, #E8E8E8)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} (${count})`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 11, fontWeight: active ? 600 : 400,
        padding: "4px 10px",
        borderRadius: 9999,
        border: active ? "none" : `1px solid ${border}`,
        background: bg,
        color: fg,
        cursor: "pointer",
        fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
        transition: "all 150ms ease",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <span style={{
        fontSize: 10,
        opacity: 0.75,
      }}>
        {count}
      </span>
    </button>
  );
}

function FrameworkChip({ category, de }: { category: FrameworkCategory; de: boolean }) {
  return (
    <span
      title={de ? `Framework: ${category.labelDe}` : `Framework: ${category.labelEn}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: category.bg,
        border: `1px solid ${category.border}`,
        color: category.fg,
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        letterSpacing: "0.01em",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {de ? category.labelDe : category.labelEn}
    </span>
  );
}

function IconActionButton({
  title, onClick, disabled, icon, destructive,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        padding: 0,
        borderRadius: 8,
        border: "1px solid transparent",
        background: "transparent",
        color: destructive ? "var(--volt-negative-text, #991B1B)" : "var(--volt-text-muted, #6B6B6B)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget as HTMLButtonElement;
        if (destructive) {
          el.style.background = "var(--volt-negative-light, #FEF2F2)";
          el.style.borderColor = "var(--volt-negative-border, #FECACA)";
        } else {
          el.style.background = "var(--volt-surface, #F4F4F4)";
          el.style.borderColor = "var(--volt-border, #E8E8E8)";
          el.style.color = "var(--volt-text, #0A0A0A)";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "transparent";
        el.style.borderColor = "transparent";
        el.style.color = destructive ? "var(--volt-negative-text, #991B1B)" : "var(--volt-text-muted, #6B6B6B)";
      }}
    >
      {icon}
    </button>
  );
}
