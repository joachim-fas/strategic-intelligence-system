"use client";

import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { VoltButton, VoltCard, VoltTabs } from "@/components/volt";

interface Project {
  id: string;
  name: string;
  description?: string;
  query_count: number;
  note_count: number;
  created_at: string;
  updated_at: string;
}

type WorkTab = "projekte" | "szenarien" | "canvas";

const TABS: { key: WorkTab; iconDe: string; iconEn: string; labelDe: string; labelEn: string }[] = [
  { key: "projekte",  iconDe: "📂", iconEn: "📂", labelDe: "Projekte",  labelEn: "Projects" },
  { key: "szenarien", iconDe: "◈",  iconEn: "◈",  labelDe: "Szenarien", labelEn: "Scenarios" },
  { key: "canvas",    iconDe: "⊞",  iconEn: "⊞",  labelDe: "Canvas",    labelEn: "Canvas" },
];

function timeAgo(dateStr: string, de: boolean): string {
  const d = new Date(dateStr);
  const h = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return de ? "gerade eben" : "just now";
  if (h < 24) return de ? `vor ${h}h` : `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? (de ? "gestern" : "yesterday") : (de ? `vor ${days} Tagen` : `${days} days ago`);
}

export default function ArbeitenPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [tab, setTab] = useState<WorkTab>("projekte");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

      {/* Tab bar */}
      <div style={{ borderBottom: "1px solid var(--color-border)", padding: "0 24px" }}>
        <div className="volt-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <VoltTabs
            variant="underline"
            activeTab={tab}
            onTabChange={(id) => setTab(id as WorkTab)}
            tabs={TABS.map(t => ({
              id: t.key,
              label: de ? t.labelDe : t.labelEn,
              icon: <span>{de ? t.iconDe : t.iconEn}</span>,
            }))}
          />
          {tab === "projekte" && (
            <VoltButton variant="solid" size="sm" onClick={createProject}>
              + {de ? "Neues Projekt" : "New Project"}
            </VoltButton>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="volt-container" style={{ padding: "24px 24px 80px" }}>

        {/* Projekte Tab */}
        {tab === "projekte" && (
          <div>
            {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>{de ? "Lade..." : "Loading..."}</div>}

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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {projects.map(p => (
                <a key={p.id} href={`/projects?id=${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <VoltCard variant="elevated" className="cursor-pointer hover:-translate-y-0.5 transition-transform">
                    <div className="font-display font-semibold text-sm mb-1">{p.name}</div>
                    <div className="text-muted-foreground text-xs mb-2">
                      {p.query_count} {de ? "Analysen" : "analyses"} · {p.note_count} {de ? "Notizen" : "notes"}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{timeAgo(p.updated_at, de)}</div>
                  </VoltCard>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Szenarien Tab */}
        {tab === "szenarien" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div className="volt-body" style={{ fontWeight: 600, marginBottom: 8 }}>
              {de ? "Szenario-Builder" : "Scenario Builder"}
            </div>
            <a href="/szenarien" className="volt-btn volt-btn-solid" style={{ textDecoration: "none" }}>
              {de ? "Szenarien öffnen" : "Open Scenarios"} →
            </a>
          </div>
        )}

        {/* Canvas Tab */}
        {tab === "canvas" && (
          <div style={{ height: "calc(100vh - 160px)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)" }}>
            <iframe
              src="/canvas"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
