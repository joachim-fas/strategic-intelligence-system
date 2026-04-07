"use client";

import { useState, useEffect, useCallback } from "react";
import { Locale } from "@/lib/i18n";

interface Project {
  id: string;
  name: string;
  description?: string;
  query_count: number;
  note_count: number;
  created_at: string;
  updated_at: string;
}

interface SavedQuery {
  id: string;
  query: string;
  locale: string;
  result: any;
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

interface ProjectPanelProps {
  locale: Locale;
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onClose: () => void;
}

export default function ProjectPanel({ locale, activeProjectId, onSelectProject, onClose }: ProjectPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(activeProjectId);
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">(activeProjectId ? "detail" : "list");

  const de = locale === "de";

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
    setQueries(qData.queries || []);
    setNotes(nData.notes || []);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (selectedProject) {
      loadProjectDetail(selectedProject);
      setView("detail");
    }
  }, [selectedProject, loadProjectDetail]);

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName.trim() }),
    });
    const data = await res.json();
    setNewProjectName("");
    await loadProjects();
    setSelectedProject(data.project.id);
    onSelectProject(data.project.id);
  };

  const deleteQuery = async (qid: string) => {
    if (!selectedProject) return;
    await fetch(`/api/v1/projects/${selectedProject}/queries?qid=${qid}`, { method: "DELETE" });
    loadProjectDetail(selectedProject);
  };

  const addNote = async (queryId?: string) => {
    if (!selectedProject || !newNote.trim()) return;
    await fetch(`/api/v1/projects/${selectedProject}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote.trim(), queryId }),
    });
    setNewNote("");
    loadProjectDetail(selectedProject);
  };

  const deleteNote = async (nid: string) => {
    if (!selectedProject) return;
    await fetch(`/api/v1/projects/${selectedProject}/notes?nid=${nid}`, { method: "DELETE" });
    loadProjectDetail(selectedProject);
  };

  const exportProject = () => {
    const project = projects.find((p) => p.id === selectedProject);
    const data = { project, queries, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sis-project-${project?.name || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedProjectData = projects.find((p) => p.id === selectedProject);

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[400px] z-40 flex flex-col shadow-xl"
      style={{ background: "var(--color-surface, #FAFAFA)", borderLeft: "1px solid var(--volt-border, #E8E8E8)" }}>

      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{ background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}>
        {view === "detail" && selectedProjectData ? (
          <>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setView("list"); setSelectedProject(null); onSelectProject(null); }}
                className="text-xs transition-colors"
                style={{ color: "var(--volt-text-faint, #9B9B9B)" }}
              >
                ←
              </button>
              <span className="text-sm font-semibold" style={{ color: "var(--volt-text, #1A1A1A)" }}>{selectedProjectData.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "var(--pastel-mint, #C3F4D3)", color: "var(--pastel-mint-text, #0F6038)" }}>
                {de ? "Aktiv" : "Active"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportProject}
                className="text-[11px] px-2.5 py-1 rounded-full border transition-colors"
                style={{ borderColor: "var(--volt-border, #E0E0E0)", background: "var(--volt-surface, white)", color: "var(--volt-text-muted, #6B6B6B)" }}
              >
                Export
              </button>
              <button onClick={onClose} className="text-sm transition-colors" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>✕</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--volt-text, #1A1A1A)" }}>{de ? "Projekte" : "Projects"}</span>
              {projects.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium"
                  style={{ background: "var(--color-surface-2, #F0F2F7)", color: "var(--volt-text-muted, #6B7A9A)" }}>
                  {projects.length}
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-sm transition-colors" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>✕</button>
          </>
        )}
      </div>

      {/* Project List */}
      {view === "list" && (
        <div className="flex-1 overflow-y-auto">
          {/* Create new project */}
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--volt-border, #F0F0F0)" }}>
            <div className="flex gap-2">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                placeholder={de ? "Neues Projekt..." : "New project..."}
                className="flex-1 text-xs px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{
                  background: "var(--color-surface-2, #F5F5F5)",
                  border: "1px solid var(--volt-border, #E8E8E8)",
                  color: "var(--volt-text, #1A1A1A)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--volt-text, #1A1A1A)"; e.currentTarget.style.background = "var(--volt-surface, #FFFFFF)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; e.currentTarget.style.background = "var(--color-surface-2, #F5F5F5)"; }}
              />
              <button
                onClick={createProject}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: "var(--volt-lime, #E4FF97)", color: "var(--volt-text, #0A0A0A)", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                +
              </button>
            </div>
          </div>

          {/* Project cards */}
          <div className="px-5 py-4 space-y-2.5">
            {projects.length === 0 && (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">📁</div>
                <p className="text-xs" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                  {de ? "Noch keine Projekte. Erstelle dein erstes oben." : "No projects yet. Create your first above."}
                </p>
              </div>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProject(p.id); onSelectProject(p.id); }}
                className="w-full text-left p-3.5 rounded-xl border transition-all"
                style={activeProjectId === p.id
                  ? { background: "var(--pastel-mint, #C3F4D3)", borderColor: "var(--pastel-mint-border, #6FD99A)" }
                  : { background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--volt-text, #1A1A1A)" }}>{p.name}</span>
                  <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>{timeAgo(p.updated_at)}</span>
                </div>
                {p.description && (
                  <p className="text-[11px] mb-1.5 line-clamp-1" style={{ color: "var(--volt-text-muted, #6B6B6B)" }}>{p.description}</p>
                )}
                <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                  <span>{p.query_count} {de ? "Abfragen" : "queries"}</span>
                  <span>·</span>
                  <span>{p.note_count} {de ? "Notizen" : "notes"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Project Detail */}
      {view === "detail" && selectedProject && (
        <div className="flex-1 overflow-y-auto">
          {/* Stats bar */}
          <div className="px-5 py-2.5 border-b flex items-center gap-3 text-[11px]"
            style={{ borderColor: "var(--volt-border, #F0F0F0)", background: "var(--color-surface, #FAFAFA)", color: "var(--volt-text-faint, #9B9B9B)" }}>
            <span>{queries.length} {de ? "Abfragen" : "queries"}</span>
            <span>·</span>
            <span>{notes.filter((n) => !n.query_id).length} {de ? "Notizen" : "notes"}</span>
          </div>

          {/* General notes */}
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--volt-border, #F0F0F0)" }}>
            <div className="flex gap-2">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder={de ? "Notiz hinzufuegen..." : "Add note..."}
                className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg focus:outline-none"
                style={{ background: "var(--color-surface-2, #F5F5F5)", border: "1px solid var(--volt-border, #E8E8E8)", color: "var(--volt-text, #1A1A1A)" }}
              />
              <button
                onClick={() => addNote()}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: "var(--volt-lime, #E4FF97)", color: "var(--volt-text, #0A0A0A)", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                +
              </button>
            </div>
            {notes.filter((n) => !n.query_id).map((n) => (
              <div key={n.id} className="flex items-start gap-2 mt-2 group">
                <span className="text-[10px] mt-0.5" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>📝</span>
                <span className="text-[11px] flex-1 leading-relaxed" style={{ color: "var(--volt-text, #3A3A3A)" }}>{n.content}</span>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: "var(--volt-text-faint, #C0C0C0)" }}
                >✕</button>
              </div>
            ))}
          </div>

          {/* Saved queries */}
          <div className="px-5 py-4 space-y-2.5">
            {queries.length === 0 && (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">💬</div>
                <p className="text-[11px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                  {de
                    ? "Noch keine gespeicherten Abfragen. Stelle eine Frage und klicke 'Speichern'."
                    : "No saved queries yet. Ask a question and click 'Save'."}
                </p>
              </div>
            )}
            {queries.map((q) => {
              const isExpanded = expandedQuery === q.id;
              return (
                <div key={q.id} className="rounded-xl border overflow-hidden transition-all"
                  style={{ borderColor: isExpanded ? "var(--volt-border, #D0D0D0)" : "var(--volt-border, #E8E8E8)", background: "var(--volt-surface, #FFFFFF)" }}>
                  {/* Query header */}
                  <button
                    onClick={() => setExpandedQuery(isExpanded ? null : q.id)}
                    className="w-full text-left px-3.5 py-3 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium truncate flex-1" style={{ color: "var(--volt-text, #1A1A1A)" }}>{q.query}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>{timeAgo(q.created_at)}</span>
                        <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #C0C0C0)" }}>{isExpanded ? "▾" : "▸"}</span>
                      </div>
                    </div>
                    {q.result?.synthesis && (
                      <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-left" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                        {q.result.synthesis}
                      </p>
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && q.result && (
                    <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: "var(--volt-border, #F0F0F0)" }}>
                      {/* Full synthesis */}
                      <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: "var(--volt-text, #3A3A3A)" }}>{q.result.synthesis}</p>

                      {/* Scenarios */}
                      {q.result.scenarios?.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>
                            {de ? "Szenarien" : "Scenarios"}
                          </div>
                          {q.result.scenarios.map((s: any, i: number) => {
                            const pct = s.probability * 100;
                            const color = pct > 40
                              ? { bg: "var(--pastel-mint, #C3F4D3)", text: "var(--pastel-mint-text, #0F6038)" }
                              : pct > 25
                              ? { bg: "var(--pastel-butter, #FFF5BA)", text: "var(--pastel-butter-text, #7A5C00)" }
                              : { bg: "var(--pastel-rose, #FDEEE9)", text: "var(--signal-negative, #C0341D)" };
                            return (
                              <div key={i} className="flex items-center gap-2 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: color.bg, color: color.text }}>
                                  {pct.toFixed(0)}%
                                </span>
                                <span className="font-medium" style={{ color: "var(--volt-text, #3A3A3A)" }}>{s.name}:</span>
                                <span className="truncate" style={{ color: "var(--volt-text-muted, #6B6B6B)" }}>{s.description?.slice(0, 60)}...</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Key insights */}
                      {q.result.keyInsights?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {q.result.keyInsights.slice(0, 3).map((insight: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-[10px]">
                              <span className="rounded px-1 font-bold flex-shrink-0 mt-0.5" style={{ color: "var(--volt-lime, #E4FF97)", background: "var(--volt-text, #0A0A0A)" }}>→</span>
                              <span className="leading-relaxed" style={{ color: "var(--volt-text-muted, #6B6B6B)" }}>{insight}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Query-specific notes */}
                      {notes.filter((n) => n.query_id === q.id).map((n) => (
                        <div key={n.id} className="flex items-start gap-1.5 mt-2 group">
                          <span className="text-[10px]" style={{ color: "var(--volt-text-faint, #9B9B9B)" }}>📝</span>
                          <span className="text-[10px] flex-1" style={{ color: "var(--volt-text, #3A3A3A)" }}>{n.content}</span>
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                            style={{ color: "var(--volt-text-faint, #C0C0C0)" }}
                          >✕</button>
                        </div>
                      ))}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-3 pt-2 border-t" style={{ borderColor: "var(--volt-border, #F0F0F0)" }}>
                        <button
                          onClick={() => deleteQuery(q.id)}
                          className="text-[10px] transition-colors"
                          style={{ color: "var(--volt-text-faint, #9B9B9B)" }}
                        >
                          {de ? "Loeschen" : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
