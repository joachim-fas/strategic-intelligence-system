"use client";

import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { VoltButton } from "@/components/volt";

// ── Types ────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  type: string;
  probability: number;
  timeframe: string | null;
  key_drivers: string[];
  impacts: { trendId: string; effect: string; magnitude: number }[];
  source: string;
  source_query: string | null;
  created_at: string;
  updated_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  optimistic: { bg: "#C3F4D3", color: "#0F6038", label: "Optimistisch" },
  baseline: { bg: "#D4E8FF", color: "#1A4A8A", label: "Wahrscheinlich" },
  pessimistic: { bg: "#FDEEE9", color: "#B91C1C", label: "Pessimistisch" },
  wildcard: { bg: "#FFF5BA", color: "#7A5C00", label: "Wildcard" },
  custom: { bg: "#F3F4F6", color: "#4B5563", label: "Eigenes" },
};

const SOURCE_LABELS: Record<string, string> = {
  user: "Eigenes Szenario",
  llm: "Aus Analyse importiert",
  template: "Vorlage",
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const h = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return "gerade eben";
  if (h < 24) return `vor ${h}h`;
  const days = Math.floor(h / 24);
  return days === 1 ? "gestern" : `vor ${days} Tagen`;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SzenarienPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");

  // Editor state
  const [edName, setEdName] = useState("");
  const [edDesc, setEdDesc] = useState("");
  const [edType, setEdType] = useState("custom");
  const [edProb, setEdProb] = useState(0.5);
  const [edTimeframe, setEdTimeframe] = useState("");
  const [edDrivers, setEdDrivers] = useState("");

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/scenarios");
      if (!res.ok) return;
      const data = await res.json();
      setScenarios(data.scenarios ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchScenarios(); }, [fetchScenarios]);

  const openEditor = (s?: Scenario) => {
    if (s) {
      setEditingId(s.id);
      setEdName(s.name);
      setEdDesc(s.description ?? "");
      setEdType(s.type);
      setEdProb(s.probability);
      setEdTimeframe(s.timeframe ?? "");
      setEdDrivers((s.key_drivers ?? []).join(", "));
    } else {
      setEditingId(null);
      setEdName("");
      setEdDesc("");
      setEdType("custom");
      setEdProb(0.5);
      setEdTimeframe("");
      setEdDrivers("");
    }
    setShowEditor(true);
  };

  const saveScenario = async () => {
    const payload = {
      name: edName.trim(),
      description: edDesc.trim() || null,
      type: edType,
      probability: edProb,
      timeframe: edTimeframe.trim() || null,
      key_drivers: edDrivers.split(",").map((s) => s.trim()).filter(Boolean),
      source: "user",
    };

    if (!payload.name) return;

    if (editingId) {
      await fetch(`/api/v1/scenarios/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/v1/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setShowEditor(false);
    fetchScenarios();
  };

  const deleteScenario = async (id: string) => {
    if (!window.confirm(de ? "Szenario wirklich löschen?" : "Really delete scenario?")) return;
    await fetch(`/api/v1/scenarios/${id}`, { method: "DELETE" });
    setCompareIds((prev) => prev.filter((x) => x !== id));
    fetchScenarios();
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
        ? [...prev, id]
        : [prev[1], id]
    );
  };

  const filtered = filter === "all" ? scenarios : scenarios.filter((s) => s.type === filter);
  const compareA = scenarios.find((s) => s.id === compareIds[0]);
  const compareB = scenarios.find((s) => s.id === compareIds[1]);

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main className="volt-container" style={{ padding: "32px 24px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 className="volt-display-md" style={{ color: "var(--color-text-heading)", margin: "0 0 4px" }}>
              {de ? "Szenarien" : "Scenarios"}
            </h1>
            <p className="volt-body-sm" style={{ color: "var(--color-text-muted)", margin: 0 }}>
              {de
                ? `${scenarios.length} Szenarien gespeichert. Erstelle eigene oder importiere aus Analysen.`
                : `${scenarios.length} scenarios saved. Create your own or import from analyses.`}
            </p>
          </div>
          <button
            onClick={() => openEditor()}
            className="volt-btn volt-btn-solid"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            + {de ? "Erstellen" : "Create"}
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[
            { key: "all", label: de ? "Alle" : "All" },
            ...Object.entries(TYPE_STYLES).map(([key, v]) => ({ key, label: v.label })),
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "volt-btn volt-btn-solid volt-btn-sm" : "volt-btn volt-btn-outline volt-btn-sm"}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Scenario cards */}
        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>Laden...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            border: "2px dashed var(--color-border)", borderRadius: 16,
            color: "var(--color-text-muted)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 8 }}>
              {de ? "Noch keine Szenarien" : "No scenarios yet"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>
              {de
                ? "Erstelle ein eigenes Szenario oder importiere eines aus einer Analyse."
                : "Create your own scenario or import one from an analysis."}
            </div>
            <button onClick={() => openEditor()} className="volt-btn volt-btn-solid">
              + {de ? "Erstes Szenario erstellen" : "Create first scenario"}
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map((s) => {
            const ts = TYPE_STYLES[s.type] ?? TYPE_STYLES.custom;
            const isComparing = compareIds.includes(s.id);

            return (
              <div
                key={s.id}
                className="volt-card volt-texture"
                style={{
                  padding: "16px 18px",
                  ...(isComparing ? { border: `2px solid ${ts.color}` } : {}),
                  transition: "all 0.12s",
                  position: "relative",
                }}
              >
                {/* Type badge + probability */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span className="volt-badge" style={{ background: ts.bg, color: ts.color }}>
                    {ts.label}
                  </span>
                  <span className="volt-label" style={{ color: "var(--color-text-heading)" }}>
                    {Math.round(s.probability * 100)}%
                  </span>
                  {s.timeframe && (
                    <span className="volt-body-sm" style={{ color: "var(--color-text-muted)", marginLeft: "auto" }}>
                      {s.timeframe}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="volt-body" style={{ fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 4 }}>
                  {s.name}
                </div>

                {/* Description */}
                {s.description && (
                  <div className="volt-body-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 8, maxHeight: 60, overflow: "hidden" }}>
                    {s.description}
                  </div>
                )}

                {/* Key drivers */}
                {s.key_drivers?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    {s.key_drivers.slice(0, 4).map((d, i) => (
                      <span key={i} className="volt-badge volt-badge-muted">
                        {d}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="volt-divider" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--color-text-muted)", marginTop: 8, paddingTop: 8 }}>
                  <span>{SOURCE_LABELS[s.source] ?? s.source}</span>
                  <span>·</span>
                  <span>{timeAgo(s.updated_at)}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button onClick={() => toggleCompare(s.id)}
                      className={isComparing ? "volt-btn volt-btn-solid volt-btn-sm" : "volt-btn volt-btn-ghost volt-btn-sm"}
                      style={isComparing ? { background: ts.bg, color: ts.color, borderColor: ts.color } : {}}
                    >
                      {isComparing ? "✓" : "⇄"}
                    </button>
                    <button onClick={() => openEditor(s)} className="volt-btn volt-btn-ghost volt-btn-sm">✎</button>
                    <button onClick={() => deleteScenario(s.id)} className="volt-btn volt-btn-danger volt-btn-sm">✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Comparison View ──────────────────────────────────── */}
        {compareA && compareB && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span className="volt-label" style={{ color: "var(--color-text-muted)" }}>
                {de ? "Vergleich" : "Comparison"}
              </span>
              <button onClick={() => setCompareIds([])} className="volt-btn volt-btn-ghost volt-btn-sm">✕ {de ? "Schließen" : "Close"}</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[compareA, compareB].map((s) => {
                const ts = TYPE_STYLES[s.type] ?? TYPE_STYLES.custom;
                return (
                  <div key={s.id} className="volt-card volt-texture" style={{ padding: "18px 20px", border: `2px solid ${ts.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span className="volt-badge" style={{ background: ts.bg, color: ts.color }}>{ts.label}</span>
                      <span className="volt-label" style={{ fontSize: 16, color: "var(--color-text-heading)" }}>{Math.round(s.probability * 100)}%</span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-heading)", margin: "0 0 8px" }}>{s.name}</h3>

                    {s.description && (
                      <p className="volt-body-sm" style={{ color: "var(--color-text-secondary)", margin: "0 0 12px" }}>{s.description}</p>
                    )}

                    {s.timeframe && (
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>
                        {de ? "Zeitrahmen" : "Timeframe"}: <strong>{s.timeframe}</strong>
                      </div>
                    )}

                    {s.key_drivers?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div className="volt-label" style={{ color: "var(--color-text-muted)", marginBottom: 4 }}>
                          {de ? "Treiber" : "Key Drivers"}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {s.key_drivers.map((d, i) => (
                            <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: ts.bg, color: ts.color }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 8 }}>
                      {SOURCE_LABELS[s.source] ?? s.source} · {timeAgo(s.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {compareIds.length === 1 && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 8,
            background: "var(--color-surface-2, #f5f5f5)", fontSize: 12, color: "var(--color-text-muted)",
            textAlign: "center",
          }}>
            {de ? "Wähle ein zweites Szenario zum Vergleichen (⇄ Button)." : "Select a second scenario to compare (⇄ button)."}
          </div>
        )}
      </main>

      {/* ── Editor Modal ──────────────────────────────────────── */}
      {showEditor && (
        <>
          <div onClick={() => setShowEditor(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(12px)", zIndex: 40 }} />
          <div className="volt-card-elevated" style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 41, width: "100%", maxWidth: 520,
            padding: "28px 32px", maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-heading)", margin: 0 }}>
                {editingId ? (de ? "Szenario bearbeiten" : "Edit Scenario") : (de ? "Neues Szenario" : "New Scenario")}
              </h2>
              <button onClick={() => setShowEditor(false)} className="volt-btn volt-btn-ghost volt-btn-sm" style={{ fontSize: 18 }}>✕</button>
            </div>

            {/* Name */}
            <label className="volt-label-text" style={{ display: "block", marginBottom: 4 }}>
              {de ? "Name" : "Name"} *
            </label>
            <input value={edName} onChange={(e) => setEdName(e.target.value)} placeholder={de ? "z.B. Beschleunigte KI-Regulierung" : "e.g. Accelerated AI Regulation"}
              className="volt-input" style={{ width: "100%", marginBottom: 14 }}
            />

            {/* Type + Probability */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="volt-label-text" style={{ display: "block", marginBottom: 4 }}>Typ</label>
                <select value={edType} onChange={(e) => setEdType(e.target.value)}
                  className="volt-select" style={{ width: "100%" }}>
                  {Object.entries(TYPE_STYLES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="volt-label-text" style={{ display: "block", marginBottom: 4 }}>
                  {de ? "Wahrscheinlichkeit" : "Probability"}: {Math.round(edProb * 100)}%
                </label>
                <input type="range" min={0} max={1} step={0.05} value={edProb} onChange={(e) => setEdProb(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: (TYPE_STYLES[edType] ?? TYPE_STYLES.custom).color }} />
              </div>
            </div>

            {/* Description */}
            <label className="volt-label-text" style={{ display: "block", marginBottom: 4 }}>
              {de ? "Beschreibung" : "Description"}
            </label>
            <textarea value={edDesc} onChange={(e) => setEdDesc(e.target.value)} rows={4}
              placeholder={de ? "Was passiert in diesem Szenario? Welche Bedingungen müssen eintreten?" : "What happens in this scenario? What conditions must be met?"}
              className="volt-textarea" style={{ width: "100%", resize: "vertical", marginBottom: 14 }}
            />

            {/* Timeframe */}
            <label className="volt-label-text" style={{ display: "block", marginBottom: 4 }}>
              {de ? "Zeitrahmen" : "Timeframe"}
            </label>
            <input value={edTimeframe} onChange={(e) => setEdTimeframe(e.target.value)} placeholder="z.B. 2025–2028"
              className="volt-input" style={{ width: "100%", marginBottom: 14 }}
            />

            {/* Key Drivers */}
            <label className="volt-label-text" style={{ display: "block", marginBottom: 4 }}>
              {de ? "Treiber (kommagetrennt)" : "Key Drivers (comma-separated)"}
            </label>
            <input value={edDrivers} onChange={(e) => setEdDrivers(e.target.value)} placeholder={de ? "Regulierung, Wettbewerb, Technologiesprung" : "Regulation, Competition, Tech breakthrough"}
              className="volt-input" style={{ width: "100%", marginBottom: 20 }}
            />

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowEditor(false)}
                className="volt-btn volt-btn-outline">
                {de ? "Abbrechen" : "Cancel"}
              </button>
              <button onClick={saveScenario} disabled={!edName.trim()}
                className="volt-btn volt-btn-solid"
                style={{
                  cursor: edName.trim() ? "pointer" : "not-allowed",
                  opacity: edName.trim() ? 1 : 0.5,
                }}>
                {editingId ? (de ? "Speichern" : "Save") : (de ? "Erstellen" : "Create")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
