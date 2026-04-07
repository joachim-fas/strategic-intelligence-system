"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  description?: string;
  query_count: number;
  note_count: number;
  created_at: string;
  updated_at: string;
}

interface Scenario {
  type?: "optimistic" | "baseline" | "pessimistic" | "wildcard";
  name: string;
  description: string;
  probability: number;
  timeframe?: string;
  keyDrivers?: string[];
}

interface Reference {
  title: string;
  url: string;
  relevance?: string;
}

interface QueryResult {
  synthesis: string;
  reasoningChains?: string[];
  keyInsights?: string[];
  regulatoryContext?: string[];
  causalChain?: string[];
  scenarios?: Scenario[];
  interpretation?: string;
  references?: Reference[];
  followUpQuestions?: string[];
  newsContext?: string;
  decisionFramework?: string;
  confidence?: number;
}

interface SavedQuery {
  id: string;
  query: string;
  locale: string;
  result: QueryResult | null;
  pinned: number;
  created_at: string;
  note_count: number;
}

interface Note {
  id: string;
  content: string;
  query_id?: string;
  created_at: string;
}

// ── Scenario type config ──────────────────────────────────────────────────

const SCENARIO_CONFIG: Record<string, { color: string; bg: string; border: string; labelDe: string; labelEn: string }> = {
  optimistic:  { color: "var(--signal-positive-text)",  bg: "var(--signal-positive-light)",  border: "var(--signal-positive-border)",  labelDe: "Optimistisch", labelEn: "Optimistic" },
  baseline:    { color: "var(--pastel-blue-text)",       bg: "var(--pastel-blue)",             border: "var(--pastel-blue-border)",       labelDe: "Basisfall",    labelEn: "Baseline" },
  pessimistic: { color: "var(--signal-negative-text)",  bg: "var(--signal-negative-light)",  border: "var(--signal-negative-border)",  labelDe: "Pessimistisch", labelEn: "Pessimistic" },
  wildcard:    { color: "var(--pastel-butter-text)",     bg: "var(--pastel-butter)",           border: "var(--pastel-butter-border)",     labelDe: "Wildcard",      labelEn: "Wildcard" },
};

function getScenarioCfg(type?: string) {
  return SCENARIO_CONFIG[type ?? ""] ?? { color: "var(--pastel-blue-text)", bg: "var(--pastel-blue)", border: "var(--pastel-blue-border)", labelDe: "Szenario", labelEn: "Scenario" };
}

// ── Utilities ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string, de: boolean): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 2) return de ? "Gerade eben" : "Just now";
  if (mins < 60) return de ? `vor ${mins}m` : `${mins}m ago`;
  if (mins < 1440) return de ? `vor ${Math.floor(mins / 60)}h` : `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / 1440);
  if (days < 7) return de ? `vor ${days}d` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(de ? "de-DE" : "en-US", { day: "numeric", month: "short" });
}

// ── Sub-components ────────────────────────────────────────────────────────

function ConfidenceBadge({ value, de }: { value: number; de: boolean }) {
  const pct = Math.round(value * 100);
  const s = value > 0.7
    ? { background: "var(--signal-positive-light)", color: "var(--signal-positive-text)", border: "1px solid var(--signal-positive-border)" }
    : value > 0.4
    ? { background: "var(--pastel-butter)", color: "var(--pastel-butter-text)", border: "1px solid var(--pastel-butter-border)" }
    : { background: "var(--signal-negative-light)", color: "var(--signal-negative-text)", border: "1px solid var(--signal-negative-border)" };
  return (
    <span className="volt-badge" style={{ ...s }}>
      {pct}% {de ? "Konfidenz" : "confidence"}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="volt-label" style={{ marginBottom: 8 }}>{children}</div>
  );
}

function ActionBtn({
  onClick,
  children,
  active,
  danger,
  title,
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      className={`volt-btn ${active ? "volt-btn-active" : danger ? "volt-btn-danger" : "volt-btn-ghost"}`}
      onClick={onClick}
      title={title}
      style={{
        fontSize: 12,
        padding: "3px 8px",
        ...(active ? { background: "var(--color-lime)", color: "var(--color-brand-text)", border: "1px solid rgba(0,0,0,0.12)" } : {}),
      }}
    >{children}</button>
  );
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        style={{
          fontSize: 20, fontWeight: 700, color: "var(--color-text-heading)",
          background: "transparent", border: "none",
          borderBottom: "2px solid var(--color-brand-light)",
          outline: "none", width: "100%", padding: "2px 0",
          letterSpacing: "-0.02em",
        }}
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      style={{
        fontSize: 20, fontWeight: 700, color: "var(--color-text-heading)",
        margin: 0, cursor: "text", letterSpacing: "-0.02em",
        display: "flex", alignItems: "center", gap: 8,
      }}
    >
      {value}
      <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 400, opacity: 0.6 }}>✎</span>
    </h2>
  );
}

function QueryCard({
  query,
  notes,
  de,
  projectId,
  onDelete,
  onPin,
  onAddNote,
  onDeleteNote,
}: {
  query: SavedQuery;
  notes: Note[];
  de: boolean;
  projectId: string;
  onDelete: (qid: string) => void;
  onPin: (qid: string, pinned: boolean) => void;
  onAddNote: (content: string, queryId: string) => Promise<void>;
  onDeleteNote: (nid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const queryNotes = notes.filter(n => n.query_id === query.id);
  const result = query.result;
  const isPinned = query.pinned === 1;

  // suppress unused var warning — projectId is available for future use
  void projectId;

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!result?.synthesis) return;
    await navigator.clipboard.writeText(result.synthesis);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    await onAddNote(noteInput.trim(), query.id);
    setNoteInput("");
    setShowNoteInput(false);
  };

  return (
    <div
      className="volt-card"
      style={{
        borderLeft: isPinned ? "3px solid var(--color-lime)" : undefined,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Card header — clickable to expand */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "14px 16px 10px", cursor: "pointer" }}>
        {/* Row 1: chevron + query text + timestamp */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{
            fontSize: 10, color: "var(--color-text-muted)", marginTop: 3,
            flexShrink: 0, transition: "transform 0.15s",
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}>▶</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <p className="volt-body" style={{
                fontWeight: 600,
                margin: 0,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>{query.query}</p>
              <span className="volt-label" style={{ flexShrink: 0, marginTop: 2 }}>
                {timeAgo(query.created_at, de)}
              </span>
            </div>

            {/* Synthesis preview (collapsed only) */}
            {!expanded && result?.synthesis && (
              <p className="volt-body-sm" style={{
                margin: "6px 0 0",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>{result.synthesis}</p>
            )}

            {/* Confidence badge in preview */}
            {!expanded && result?.confidence != null && result.confidence > 0 && (
              <div style={{ marginTop: 5 }}>
                <ConfidenceBadge value={result.confidence} de={de} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action bar — always visible at bottom of collapsed state */}
      <div style={{
        display: "flex", alignItems: "center", gap: 2,
        padding: "4px 16px 8px 36px",
        opacity: hovered || expanded ? 1 : 0.4,
        transition: "opacity 0.15s",
      }}>
        {/* Pin */}
        <ActionBtn
          onClick={(e) => { e.stopPropagation(); onPin(query.id, !isPinned); }}
          active={isPinned}
          title={isPinned ? (de ? "Entpinnen" : "Unpin") : (de ? "Pinnen" : "Pin")}
        >
          {isPinned ? "★" : "☆"}
        </ActionBtn>

        {/* Copy synthesis */}
        {result?.synthesis && (
          <ActionBtn onClick={copyToClipboard} title={de ? "Synthese kopieren" : "Copy synthesis"}>
            {copied ? "✓" : "⎘"}
          </ActionBtn>
        )}

        {/* Re-run */}
        <a
          href={`/?q=${encodeURIComponent(query.query)}`}
          onClick={e => e.stopPropagation()}
          title={de ? "Erneut analysieren" : "Re-run analysis"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, color: "var(--color-text-muted)",
            textDecoration: "none", padding: "3px 8px", borderRadius: "var(--radius-full)",
            border: "1px solid transparent",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
        >
          ↻ {de ? "Wiederholen" : "Re-run"}
        </a>

        {/* Add note */}
        <ActionBtn
          onClick={(e) => { e.stopPropagation(); setShowNoteInput(v => !v); setExpanded(true); }}
          title={de ? "Notiz hinzufügen" : "Add note"}
        >
          📝
        </ActionBtn>

        {/* Delete */}
        <div style={{ marginLeft: "auto" }}>
          <ActionBtn
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(de ? "Abfrage löschen?" : "Delete this query?")) onDelete(query.id);
            }}
            danger
            title={de ? "Löschen" : "Delete"}
          >
            ✕
          </ActionBtn>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && result && (
        <div style={{
          borderTop: "1px solid var(--color-border)",
          padding: "20px 20px 16px 36px",
          display: "flex", flexDirection: "column", gap: 18,
        }}>

          {/* Synthesis */}
          <div>
            <SectionLabel>{de ? "Synthese" : "Synthesis"}</SectionLabel>
            <p className="volt-body" style={{ lineHeight: 1.75, margin: 0 }}>
              {result.synthesis}
            </p>
            {result.confidence != null && result.confidence > 0 && (
              <div style={{ marginTop: 8 }}><ConfidenceBadge value={result.confidence} de={de} /></div>
            )}
          </div>

          {/* Notes for this query */}
          <div>
            {queryNotes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                {queryNotes.map(n => (
                  <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-muted)", flexShrink: 0, marginTop: 1 }}>#</span>
                    <span style={{ flex: 1, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{n.content}</span>
                    <button
                      onClick={() => onDeleteNote(n.id)}
                      style={{ fontSize: 10, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.5"}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            {showNoteInput && (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddNote();
                    if (e.key === "Escape") { setShowNoteInput(false); setNoteInput(""); }
                  }}
                  placeholder={de ? "Notiz zur Abfrage…" : "Note on this query…"}
                  style={{
                    flex: 1, fontSize: 12, padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    outline: "none",
                  }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = "var(--color-text-primary)"}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = "var(--color-border)"}
                />
                <button
                  className="volt-btn"
                  onClick={handleAddNote}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "6px 12px",
                    background: "var(--color-lime)", color: "var(--color-text-primary)",
                    border: "1px solid rgba(0,0,0,0.1)",
                  }}
                >+</button>
              </div>
            )}
          </div>

          {/* Decision Framework */}
          {result.decisionFramework && (
            <div>
              <SectionLabel>{de ? "Entscheidungshilfe" : "Decision Framework"}</SectionLabel>
              <div style={{
                background: "var(--signal-positive-light)", border: "1px solid var(--signal-positive-border)",
                borderRadius: "var(--radius-md)", padding: "12px 14px",
                fontSize: 13, color: "var(--signal-positive-text)", lineHeight: 1.6,
              }}>{result.decisionFramework}</div>
            </div>
          )}

          {/* Scenarios */}
          {result.scenarios && result.scenarios.length > 0 && (
            <div>
              <SectionLabel>{de ? "Szenarien" : "Scenarios"}</SectionLabel>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                gap: 8,
              }}>
                {result.scenarios.map((s, i) => {
                  const cfg = getScenarioCfg(s.type);
                  const pct = (s.probability * 100).toFixed(0);
                  const label = de ? cfg.labelDe : cfg.labelEn;
                  return (
                    <div key={i} style={{
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${cfg.border}`,
                      borderLeft: `3px solid ${cfg.color}`,
                      background: cfg.bg,
                      padding: "12px 12px 10px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span className="volt-badge" style={{
                          color: cfg.color, background: "white", border: `1px solid ${cfg.border}`,
                        }}>{label}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: cfg.color, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                      </div>
                      {/* Probability bar */}
                      <div style={{ height: 3, borderRadius: 2, background: "rgba(0,0,0,0.08)", marginBottom: 8, overflow: "hidden" }}>
                        <div style={{ height: 3, width: `${s.probability * 100}%`, borderRadius: 2, background: cfg.color }} />
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: "0 0 4px", lineHeight: 1.3 }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: cfg.color, margin: 0, lineHeight: 1.5, opacity: 0.85 }}>{s.description}</p>
                      {s.timeframe && (
                        <span style={{ marginTop: 6, display: "inline-block", fontSize: 10, color: cfg.color, opacity: 0.7 }}>{s.timeframe}</span>
                      )}
                      {s.keyDrivers && s.keyDrivers.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                          {s.keyDrivers.slice(0, 3).map((d, j) => (
                            <span key={j} className="volt-badge" style={{
                              color: cfg.color,
                              background: "rgba(255,255,255,0.7)", border: `1px solid ${cfg.border}`,
                            }}>{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Insights */}
          {result.keyInsights && result.keyInsights.length > 0 && (
            <div>
              <SectionLabel>{de ? "Erkenntnisse" : "Key Insights"}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {result.keyInsights.map((insight, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span className="volt-badge" style={{
                      background: "var(--color-lime)", color: "var(--color-text-primary)",
                      flexShrink: 0, marginTop: 2,
                    }}>→</span>
                    <span className="volt-body-sm" style={{ lineHeight: 1.55 }}>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interpretation */}
          {result.interpretation && (
            <div>
              <SectionLabel>{de ? "Interpretation" : "Interpretation"}</SectionLabel>
              <div style={{
                background: "var(--pastel-blue)", border: "1px solid var(--pastel-blue-border)",
                borderRadius: "var(--radius-md)", padding: "12px 14px",
                fontSize: 13, color: "var(--pastel-blue-text)", lineHeight: 1.6,
              }}>{result.interpretation}</div>
            </div>
          )}

          {/* References */}
          {result.references && result.references.length > 0 && (
            <div>
              <SectionLabel>{de ? "Quellen" : "Sources"}</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ref.relevance}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 11, color: "var(--color-brand)", textDecoration: "none",
                      padding: "3px 9px", borderRadius: "var(--radius-full)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      transition: "border-color 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-primary)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
                  >
                    <span>↗</span><span>{ref.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up questions */}
          {result.followUpQuestions && result.followUpQuestions.length > 0 && (
            <div>
              <SectionLabel>{de ? "Folgefragen" : "Follow-up Questions"}</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.followUpQuestions.map((q, i) => (
                  <a
                    key={i}
                    href={`/?q=${encodeURIComponent(q)}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, color: "var(--color-text-secondary)", textDecoration: "none",
                      padding: "4px 10px", borderRadius: "var(--radius-full)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      transition: "all 0.12s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-primary)";
                      (e.currentTarget as HTMLElement).style.color = "var(--color-text-heading)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                      (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
                    }}
                  >→ {q}</a>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [newProjectName, setNewProjectName] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "pinned">("newest");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [projectNewNote, setProjectNewNote] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [canvasProjectId, setCanvasProjectId] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Suppress unused var warnings — kept for future use
  void generatingSummary;
  void summary;

  const de = locale === "de";

  // ── Init ──────────────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/v1/projects");
    const data = await res.json();
    setProjects(data.projects || []);
  }, []);

  const loadProjectDetail = useCallback(async (projectId: string) => {
    const [qRes, nRes] = await Promise.all([
      fetch(`/api/v1/projects/${projectId}/queries`),
      fetch(`/api/v1/projects/${projectId}/notes`),
    ]);
    const qData = await qRes.json();
    const nData = await nRes.json();
    const rawQueries: SavedQuery[] = (qData.queries || []).map((q: SavedQuery & { result_json?: string }) => ({
      ...q,
      result: q.result ?? (q.result_json ? JSON.parse(q.result_json as string) : null),
    }));
    setQueries(rawQueries);
    setNotes(nData.notes || []);
  }, []);

  useEffect(() => {
    try {
      const l = localStorage.getItem("sis-locale");
      if (l === "en") setLocale("en");
      const ap = localStorage.getItem("sis-active-project");
      if (ap) setActiveProjectId(ap);
      const cp = localStorage.getItem("sis-active-canvas");
      if (cp) setCanvasProjectId(cp);
    } catch {}
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedId) loadProjectDetail(selectedId);
  }, [selectedId, loadProjectDetail]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const createProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName.trim() }),
    });
    const data = await res.json();
    setNewProjectName("");
    await loadProjects();
    setSelectedId(data.project.id);
    setSummary(null);
  }, [newProjectName, loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    await fetch(`/api/v1/projects/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    if (activeProjectId === id) {
      setActiveProjectId(null);
      try { localStorage.removeItem("sis-active-project"); } catch {}
    }
    await loadProjects();
  }, [selectedId, activeProjectId, loadProjects]);

  const renameProject = useCallback(async (id: string, name: string) => {
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    await fetch(`/api/v1/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    loadProjects();
  }, [loadProjects]);

  const setActiveProject = useCallback((id: string) => {
    setActiveProjectId(id);
    try { localStorage.setItem("sis-active-project", id); } catch {}
  }, []);

  const deleteQuery = useCallback(async (qid: string) => {
    if (!selectedId) return;
    await fetch(`/api/v1/projects/${selectedId}/queries?qid=${qid}`, { method: "DELETE" });
    loadProjectDetail(selectedId);
    loadProjects();
  }, [selectedId, loadProjectDetail, loadProjects]);

  const pinQuery = useCallback(async (qid: string, pinned: boolean) => {
    if (!selectedId) return;
    // Optimistic update
    setQueries(prev => prev.map(q => q.id === qid ? { ...q, pinned: pinned ? 1 : 0 } : q));
    await fetch(`/api/v1/projects/${selectedId}/queries?qid=${qid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
  }, [selectedId]);

  const addNote = useCallback(async (content: string, queryId?: string) => {
    if (!selectedId || !content.trim()) return;
    await fetch(`/api/v1/projects/${selectedId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), queryId }),
    });
    loadProjectDetail(selectedId);
  }, [selectedId, loadProjectDetail]);

  const deleteNote = useCallback(async (nid: string) => {
    if (!selectedId) return;
    await fetch(`/api/v1/projects/${selectedId}/notes?nid=${nid}`, { method: "DELETE" });
    loadProjectDetail(selectedId);
  }, [selectedId, loadProjectDetail]);

  const addProjectNote = useCallback(async () => {
    if (!projectNewNote.trim()) return;
    await addNote(projectNewNote.trim());
    setProjectNewNote("");
  }, [projectNewNote, addNote]);

  const exportProject = useCallback(() => {
    const selectedProject = projects.find(p => p.id === selectedId);
    const data = { project: selectedProject, queries, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sis-project-${selectedProject?.name ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projects, selectedId, queries, notes]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredQueries = useMemo(() => {
    let q = [...queries];
    if (showPinnedOnly) q = q.filter(x => x.pinned === 1);
    if (search.trim()) {
      const s = search.toLowerCase();
      q = q.filter(x => x.query.toLowerCase().includes(s) || x.result?.synthesis?.toLowerCase().includes(s));
    }
    if (sortOrder === "newest") q.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortOrder === "oldest") q.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else q.sort((a, b) => (b.pinned ?? 0) - (a.pinned ?? 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return q;
  }, [queries, search, sortOrder, showPinnedOnly]);

  const pinnedQueries = filteredQueries.filter(q => q.pinned === 1);
  const unpinnedQueries = filteredQueries.filter(q => q.pinned !== 1);
  const projectNotes = notes.filter(n => !n.query_id);
  const selectedProject = projects.find(p => p.id === selectedId);
  const isActive = activeProjectId === selectedId;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      {/* Body: left rail + main content */}
      <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="sis-sidebar-btn"
            onClick={() => setSidebarOpen(false)}
            style={{ display: "none", position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.25)" }}
          />
        )}

        {/* LEFT RAIL */}
        <aside className={`sis-sidebar${sidebarOpen ? "" : " closed"}`} style={{
          width: 280, flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Create input */}
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createProject()}
                placeholder={de ? "Neues Projekt…" : "New project…"}
                style={{
                  flex: 1, fontSize: 12, padding: "7px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-page-bg)",
                  color: "var(--color-text-primary)",
                  outline: "none", transition: "border-color 0.15s",
                }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = "var(--color-text-primary)"}
                onBlur={e => (e.target as HTMLElement).style.borderColor = "var(--color-border)"}
              />
              <button
                className="volt-btn"
                onClick={createProject}
                style={{
                  padding: "7px 12px",
                  background: "var(--color-lime)", color: "var(--color-text-primary)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  fontSize: 14, fontWeight: 700,
                }}
              >+</button>
            </div>
          </div>

          {/* Project list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {projects.length === 0 ? (
              <div style={{ padding: "32px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                <p className="volt-body-sm" style={{ marginBottom: 14 }}>
                  {de
                    ? "Noch keine Projekte. Projekte helfen dir, Analysen über Zeit zu sammeln und wiederzufinden."
                    : "No projects yet. Projects let you collect and revisit saved analyses over time."}
                </p>
              </div>
            ) : (
              projects.map(p => {
                const isSelected = selectedId === p.id;
                const isPActive = activeProjectId === p.id;
                const isInCanvas = canvasProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); loadProjectDetail(p.id); setSummary(null); }}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${isSelected ? "rgba(0,0,0,0.15)" : "transparent"}`,
                      background: isSelected ? "var(--color-lime)" : "transparent",
                      marginBottom: 2,
                      cursor: "pointer", transition: "all 0.12s",
                      position: "relative",
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2, #F5F5F5)"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)" }}>
                        {isPActive && <span style={{ marginRight: 5 }}>◆</span>}{p.name}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{timeAgo(p.updated_at, de)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-muted)" }}>
                      <span>{p.query_count} {de ? "Abfr." : "queries"}</span>
                      <span>·</span>
                      <span>{p.note_count} {de ? "Notiz." : "notes"}</span>
                      {isInCanvas && (
                        <span className="volt-badge" style={{ marginLeft: "auto", background: "#D4E8FF", color: "#1A4A8A" }}>
                          ⊞ CANVAS
                        </span>
                      )}
                      {isPActive && !isInCanvas && (
                        <span className="volt-badge" style={{ marginLeft: "auto", background: "var(--pastel-mint)", color: "var(--pastel-mint-text)" }}>
                          {de ? "AKTIV" : "ACTIVE"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, overflowY: "auto", background: "var(--color-page-bg)" }}>
          {!selectedId ? (
            /* Empty state */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
              <h3 className="volt-display-md" style={{ fontSize: 18, margin: "0 0 8px" }}>
                {de ? "Projekt auswählen" : "Select a project"}
              </h3>
              <p className="volt-body-sm" style={{ textAlign: "center", maxWidth: 320 }}>
                {de
                  ? "Wähle ein Projekt aus der linken Liste oder erstelle ein neues."
                  : "Select a project from the left, or create a new one."}
              </p>
            </div>
          ) : (
            <div className="volt-container" style={{ maxWidth: 860, margin: "0 auto", padding: "28px 32px 60px" }}>

              {/* Project Header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {selectedProject && (
                      <EditableTitle
                        value={selectedProject.name}
                        onSave={name => renameProject(selectedId, name)}
                      />
                    )}
                  </div>
                  {isActive ? (
                    <span className="volt-badge" style={{
                      background: "var(--pastel-mint)", color: "var(--pastel-mint-text)", border: "1px solid var(--pastel-mint-border)",
                      padding: "3px 10px",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>◆ {de ? "Aktiv" : "Active"}</span>
                  ) : (
                    <button
                      className="volt-btn volt-btn-outline"
                      onClick={() => setActiveProject(selectedId)}
                      style={{
                        fontSize: 11, fontWeight: 600, flexShrink: 0,
                        padding: "3px 10px",
                      }}
                    >{de ? "Als aktiv setzen" : "Set as active"}</button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <span className="volt-label">
                    {queries.length} {de ? "Abfragen" : "queries"} · {projectNotes.length} {de ? "Notizen" : "notes"}
                    {selectedProject && <> · {de ? "Aktualisiert" : "Updated"} {timeAgo(selectedProject.updated_at, de)}</>}
                  </span>
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <a
                      className="volt-btn volt-btn-outline"
                      href="/canvas"
                      onClick={() => {
                        if (selectedId) {
                          try {
                            localStorage.setItem("sis-canvas-project", selectedId);
                            localStorage.setItem("sis-active-canvas", selectedId);
                            localStorage.setItem("sis-active-project", selectedId);
                          } catch {}
                        }
                      }}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "4px 10px",
                        border: "1px solid #1A9E5A44", background: "#1A9E5A0C",
                        color: "#1A9E5A",
                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >⊞ {de ? "Im Canvas öffnen" : "Open in Canvas"}</a>
                    <button
                      className="volt-btn volt-btn-outline"
                      onClick={exportProject}
                      style={{ fontSize: 11, padding: "4px 10px" }}
                    >{de ? "Export JSON" : "Export JSON"}</button>
                    <button
                      className="volt-btn volt-btn-danger"
                      onClick={() => {
                        if (window.confirm(de ? `Projekt "${selectedProject?.name}" löschen?` : `Delete project "${selectedProject?.name}"?`))
                          deleteProject(selectedId);
                      }}
                      style={{ fontSize: 11, padding: "4px 10px" }}
                    >{de ? "Projekt löschen" : "Delete project"}</button>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "var(--color-border)", marginBottom: 16, opacity: 0.6 }} />

              {/* Toolbar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", fontSize: 12, pointerEvents: "none" }}>⌕</span>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={de ? "Abfragen durchsuchen…" : "Search queries…"}
                    style={{
                      width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                      borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
                      background: "var(--color-surface)", color: "var(--color-text-primary)",
                      fontSize: 12, outline: "none", transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = "var(--color-text-primary)"}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = "var(--color-border)"}
                  />
                </div>
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                  style={{
                    fontSize: 12, padding: "6px 10px", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)", background: "var(--color-surface)",
                    color: "var(--color-text-secondary)", cursor: "pointer", outline: "none",
                  }}
                >
                  <option value="newest">{de ? "Neueste zuerst" : "Newest first"}</option>
                  <option value="oldest">{de ? "Älteste zuerst" : "Oldest first"}</option>
                  <option value="pinned">{de ? "Gepinnte zuerst" : "Pinned first"}</option>
                </select>
                <button
                  className={`volt-btn ${showPinnedOnly ? "volt-btn-active" : "volt-btn-outline"}`}
                  onClick={() => setShowPinnedOnly(v => !v)}
                  style={{
                    fontSize: 12, padding: "5px 10px",
                    ...(showPinnedOnly ? { background: "var(--color-lime)", color: "var(--color-brand-text)", border: "1px solid rgba(0,0,0,0.12)", fontWeight: 600 } : {}),
                  }}
                >★ {de ? "Nur Pins" : "Pinned only"}</button>
              </div>

              {/* Query list */}
              {queries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                  <p className="volt-body" style={{ fontWeight: 600, marginBottom: 6 }}>
                    {de ? "Noch keine gespeicherten Abfragen" : "No saved queries yet"}
                  </p>
                  <p className="volt-body-sm" style={{ maxWidth: 340, margin: "0 auto 16px" }}>
                    {de
                      ? "Stelle eine Frage auf der Hauptseite — wenn dieses Projekt aktiv ist, erscheint ein \"Speichern\" Button."
                      : "Ask a question on the main page — when this project is active, a \"Save\" button will appear."}
                  </p>
                  <a className="volt-btn" href="/" style={{
                    fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
                    background: "var(--color-lime)", border: "1px solid rgba(0,0,0,0.1)",
                    padding: "8px 16px",
                    textDecoration: "none", display: "inline-block",
                  }}>
                    {de ? "Zur Hauptseite →" : "Go to main page →"}
                  </a>
                </div>
              ) : filteredQueries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-muted)", fontSize: 13 }}>
                  {de ? "Keine Ergebnisse für" : "No results for"} „{search}"
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

                  {/* Pinned section */}
                  {pinnedQueries.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span className="volt-label">
                          ★ {de ? "Gepinnt" : "Pinned"} ({pinnedQueries.length})
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pinnedQueries.map(q => (
                          <QueryCard
                            key={q.id}
                            query={q}
                            notes={notes}
                            de={de}
                            projectId={selectedId}
                            onDelete={deleteQuery}
                            onPin={pinQuery}
                            onAddNote={addNote}
                            onDeleteNote={deleteNote}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All / unpinned queries */}
                  {unpinnedQueries.length > 0 && (
                    <div>
                      {pinnedQueries.length > 0 && (
                        <div className="volt-label" style={{ marginBottom: 10 }}>
                          {de ? "Alle Abfragen" : "All Queries"} ({unpinnedQueries.length})
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {unpinnedQueries.map(q => (
                          <QueryCard
                            key={q.id}
                            query={q}
                            notes={notes}
                            de={de}
                            projectId={selectedId}
                            onDelete={deleteQuery}
                            onPin={pinQuery}
                            onAddNote={addNote}
                            onDeleteNote={deleteNote}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Project Notes — collapsible */}
              <div style={{ marginTop: 40 }}>
                <details open={projectNotes.length > 0}>
                  <summary className="volt-label" style={{
                    cursor: "pointer", userSelect: "none",
                    listStyle: "none", display: "flex", alignItems: "center", gap: 8,
                    paddingBottom: 12, borderBottom: "1px solid var(--color-border)",
                    marginBottom: 12,
                  }}>
                    <span>▸</span>
                    <span>{de ? "Projektnotizen" : "Project Notes"}</span>
                    {projectNotes.length > 0 && (
                      <span className="volt-badge" style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}>
                        {projectNotes.length}
                      </span>
                    )}
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                    {projectNotes.map(n => (
                      <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ color: "var(--color-text-muted)", fontSize: 13, flexShrink: 0 }}>#</span>
                        <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{n.content}</span>
                        <button
                          onClick={() => deleteNote(n.id)}
                          style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", opacity: 0.5 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.5"}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={projectNewNote}
                      onChange={e => setProjectNewNote(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addProjectNote()}
                      placeholder={de ? "Notiz zum Projekt…" : "Project note…"}
                      style={{
                        flex: 1, fontSize: 12, padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)", color: "var(--color-text-primary)",
                        outline: "none", transition: "border-color 0.15s",
                      }}
                      onFocus={e => (e.target as HTMLElement).style.borderColor = "var(--color-text-primary)"}
                      onBlur={e => (e.target as HTMLElement).style.borderColor = "var(--color-border)"}
                    />
                    <button
                      className="volt-btn"
                      onClick={addProjectNote}
                      style={{
                        padding: "7px 12px",
                        background: "var(--color-lime)", color: "var(--color-text-primary)",
                        border: "1px solid rgba(0,0,0,0.1)",
                        fontSize: 14, fontWeight: 700,
                      }}
                    >+</button>
                  </div>
                </details>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
