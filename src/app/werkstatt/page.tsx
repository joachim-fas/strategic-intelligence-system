"use client";

import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { VoltButton, VoltCard } from "@/components/volt";

interface Project {
  id: string;
  name: string;
  description?: string;
  query_count: number;
  note_count: number;
  created_at: string;
  updated_at: string;
}

function timeAgo(dateStr: string, de: boolean): string {
  const d = new Date(dateStr);
  const h = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return de ? "gerade eben" : "just now";
  if (h < 24) return de ? `vor ${h}h` : `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? (de ? "gestern" : "yesterday") : (de ? `vor ${days} Tagen` : `${days} days ago`);
}

export default function WerkstattPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/projects");
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const createProject = async () => {
    const name = window.prompt(de ? "Projektname:" : "Project name:");
    if (!name?.trim()) return;
    await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    loadProjects();
  };

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main className="volt-container" style={{ padding: "24px 24px 80px" }}>

        {/* ── Active project: header + Canvas iframe ── */}
        {activeProject && (
          <div>
            {/* Project header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button
                onClick={() => setActiveProject(null)}
                style={{
                  background: "none", border: "1px solid var(--color-border)",
                  borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                  fontSize: 13, color: "var(--color-text-muted)",
                }}
              >
                {de ? "\u2190 Zur\u00fcck" : "\u2190 Back"}
              </button>
              <div>
                <h1 className="volt-display-md" style={{ margin: 0 }}>
                  {activeProject.name}
                </h1>
                {activeProject.description && (
                  <div className="volt-body-sm" style={{ color: "var(--color-text-muted)", marginTop: 2 }}>
                    {activeProject.description}
                  </div>
                )}
              </div>
            </div>

            {/* Canvas embed */}
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <iframe
                src="/canvas?embedded=1"
                style={{ width: "100%", height: "calc(100vh - 160px)", border: "none" }}
              />
            </div>
          </div>
        )}

        {/* ── No active project: project list ── */}
        {!activeProject && (
          <div>
            {/* Page header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h1 className="volt-display-md" style={{ margin: 0 }}>
                Werkstatt
              </h1>
              <VoltButton variant="solid" size="sm" onClick={createProject}>
                + {de ? "Neues Projekt" : "New Project"}
              </VoltButton>
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                {de ? "Lade..." : "Loading..."}
              </div>
            )}

            {/* Empty state */}
            {!loading && projects.length === 0 && (
              <div className="volt-card" style={{ padding: "48px 24px", textAlign: "center", border: "2px dashed var(--color-border)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
                <div className="volt-body" style={{ fontWeight: 600, marginBottom: 8 }}>
                  {de ? "Noch keine Projekte" : "No projects yet"}
                </div>
                <div className="volt-body-sm" style={{ marginBottom: 16 }}>
                  {de ? "Projekte helfen dir, Analysen zu sammeln und wiederzufinden." : "Projects help you collect and revisit analyses."}
                </div>
                <button onClick={createProject} className="volt-btn volt-btn-solid">
                  + {de ? "Erstes Projekt erstellen" : "Create first project"}
                </button>
              </div>
            )}

            {/* Project card grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {projects.map(p => (
                <div key={p.id} onClick={() => setActiveProject(p)} style={{ cursor: "pointer" }}>
                  <VoltCard variant="elevated" className="cursor-pointer hover:-translate-y-0.5 transition-transform">
                    <div className="font-display font-semibold text-sm mb-1">{p.name}</div>
                    {p.description && (
                      <div className="text-muted-foreground text-xs mb-2">{p.description}</div>
                    )}
                    <div className="text-muted-foreground text-xs mb-2">
                      {p.query_count} {de ? "Analysen" : "analyses"} · {p.note_count} {de ? "Notizen" : "notes"}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{timeAgo(p.updated_at, de)}</div>
                  </VoltCard>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
