"use client";

import { useState } from "react";
import { Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

// ── Scenario type ─────────────────────────────────────────────────────────────
interface Scenario {
  type?: "optimistic" | "baseline" | "pessimistic" | "wildcard";
  name: string;
  description: string;
  probability: number;
  timeframe?: string;
  keyDrivers?: string[];
}

// ── Type config ────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  color: string; bg: string; border: string;
  labelDe: string; labelEn: string;
}> = {
  optimistic:  { color: "var(--pastel-mint-text, #0F6038)", bg: "var(--pastel-mint-light, #E8F8EF)", border: "var(--pastel-mint-border, #7DD4A8)", labelDe: "Optimistisch",  labelEn: "Optimistic"  },
  baseline:    { color: "var(--pastel-sky-text, #1D4ED8)", bg: "var(--pastel-sky-light, #EFF6FF)", border: "var(--pastel-sky-border, #93C5FD)", labelDe: "Basisfall",      labelEn: "Baseline"    },
  pessimistic: { color: "var(--signal-negative, #B91C1C)", bg: "var(--pastel-rose-light, #FEF2F2)", border: "var(--pastel-rose-border, #FCA5A5)", labelDe: "Pessimistisch", labelEn: "Pessimistic" },
  wildcard:    { color: "var(--pastel-butter-text, #92400E)", bg: "var(--pastel-butter-light, #FFFBEB)", border: "var(--pastel-butter-border, #FDE68A)", labelDe: "Wildcard",       labelEn: "Wildcard"    },
};

const DEFAULT_TYPE = { color: "var(--pastel-sky-text, #1D4ED8)", bg: "var(--pastel-sky-light, #EFF6FF)", border: "var(--pastel-sky-border, #93C5FD)", labelDe: "Szenario", labelEn: "Scenario" };

function getTypeConfig(type?: string) {
  return TYPE_CONFIG[type ?? ""] ?? DEFAULT_TYPE;
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildPrompt(
  action: "deep" | "whatif" | "challenge" | "strategy",
  s: Scenario, query: string, de: boolean
): string {
  const pct = (s.probability * 100).toFixed(0);
  if (action === "deep") return de
    ? `Analysiere Szenario "${s.name}" zu "${query}" im Detail. Welche Bedingungen müssen eintreten? Welche Frühwarnindikatoren gibt es? Wie realistisch ist die ${pct}%-Einschätzung? Belege mit konkreten Daten.`
    : `Analyze scenario "${s.name}" for "${query}" in depth. What exact conditions must occur? What are early warning indicators? How realistic is the ${pct}% estimate? Back with concrete data.`;
  if (action === "whatif") return de
    ? `Szenario "${s.name}" tritt ein (${pct}%, Kontext: "${query}"). Was sind die 3–5 konkreten Handlungsoptionen? Was muss sofort, mittelfristig und langfristig getan werden?`
    : `Scenario "${s.name}" materializes (${pct}%, context: "${query}"). What are the 3–5 concrete action options? What must happen immediately, mid-term, and long-term?`;
  if (action === "challenge") return de
    ? `Stress-Test: Welche Argumente sprechen GEGEN Szenario "${s.name}" zu "${query}"? Welche Annahmen sind fragwürdig? Was wird übersehen?`
    : `Stress test: What arguments speak AGAINST scenario "${s.name}" for "${query}"? Which assumptions are questionable? What is being overlooked?`;
  return de
    ? `Strategischer Spielplan für Szenario "${s.name}" zu "${query}": Entscheidende Akteure, Koalitionen, optimale Positionierung?`
    : `Strategic playbook for scenario "${s.name}" in context of "${query}": Decisive actors, coalitions, optimal positioning?`;
}

// ── ScenarioCard ──────────────────────────────────────────────────────────────
function ScenarioCard({
  s, i, isSelected, onToggle, onAction, de, query,
}: {
  s: Scenario; i: number; isSelected: boolean;
  onToggle: () => void;
  onAction: (a: "deep" | "whatif" | "challenge" | "strategy") => void;
  de: boolean;
  query?: string;
}) {
  const [saved, setSaved] = useState(false);
  const saveToBuilder = async () => {
    if (saved) return;
    try {
      await fetch("/api/v1/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          description: s.description,
          type: s.type ?? "custom",
          probability: s.probability,
          timeframe: s.timeframe,
          key_drivers: s.keyDrivers ?? [],
          source: "llm",
          source_query: query,
        }),
      });
      setSaved(true);
    } catch { /* silent */ }
  };
  const cfg   = getTypeConfig(s.type);
  const pct   = (s.probability * 100).toFixed(0);
  const label = de ? cfg.labelDe : cfg.labelEn;

  const ACTIONS: { id: "deep" | "whatif" | "challenge" | "strategy"; labelDe: string; labelEn: string; icon: string }[] = [
    { id: "deep",      labelDe: "Vertiefen",  labelEn: "Deep dive",  icon: "↓" },
    { id: "whatif",    labelDe: "Was wenn",   labelEn: "What if",    icon: "→" },
    { id: "challenge", labelDe: "Angreifen",  labelEn: "Challenge",  icon: "⚡" },
    { id: "strategy",  labelDe: "Strategie",  labelEn: "Strategy",   icon: "◈" },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderRadius: "var(--radius-lg)",
      border: `1px solid ${isSelected ? cfg.border : "var(--color-border)"}`,
      borderLeft: `3px solid ${cfg.color}`,
      background: isSelected ? cfg.bg : "var(--color-surface)",
      boxShadow: isSelected ? `0 0 0 2px ${cfg.color}20` : "var(--shadow-xs)",
      transition: "all 0.15s",
      overflow: "hidden",
    }}>

      {/* ── Clickable body ─────────────────────────── */}
      <div onClick={onToggle} style={{ padding: "13px 14px 12px", cursor: "pointer", flex: 1 }}>

        {/* Row 1: type badge + timeframe + probability */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            color: cfg.color, background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: "var(--radius-full)", padding: "2px 8px", flexShrink: 0,
          }}>{label}</span>

          {s.timeframe && (
            <span style={{
              fontSize: 10, color: "var(--color-text-muted)",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-full)", padding: "2px 7px", flexShrink: 0,
            }}>{s.timeframe}</span>
          )}

          <span style={{
            marginLeft: "auto", fontSize: 22, fontWeight: 800,
            color: cfg.color, lineHeight: 1, flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}>{pct}%</span>

          {/* Save to scenario builder */}
          <button
            onClick={(e) => { e.stopPropagation(); saveToBuilder(); }}
            title={de ? "Im Szenario-Builder speichern" : "Save to scenario builder"}
            style={{
              fontSize: 11, padding: "2px 6px", borderRadius: 6,
              border: saved ? "1px solid var(--signal-positive, #1A9E5A)" : "1px solid var(--color-border)",
              background: saved ? "var(--pastel-mint, #C3F4D3)" : "transparent",
              color: saved ? "var(--pastel-mint-text)" : "var(--color-text-muted)",
              cursor: saved ? "default" : "pointer", flexShrink: 0, marginLeft: 4,
              transition: "all 0.15s",
            }}
          >{saved ? "✓" : "💾"}</button>
        </div>

        {/* Probability bar */}
        <div style={{
          height: 4, borderRadius: 2,
          background: "var(--color-surface-2)",
          marginBottom: 10, overflow: "hidden",
        }}>
          <div style={{
            height: 4, borderRadius: 2,
            width: `${s.probability * 100}%`,
            background: cfg.color,
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Name */}
        <p style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.35,
          color: "var(--color-text-heading)",
          margin: "0 0 8px",
        }}>
          {isSelected && <span style={{ color: cfg.color, marginRight: 4 }}>✓</span>}
          {s.name}
        </p>

        {/* Description — capped at 4 lines */}
        <p style={{
          fontSize: 12, color: "var(--color-text-subtle)",
          lineHeight: 1.6, margin: "0 0 10px",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {s.description}
        </p>

        {/* Key drivers */}
        {s.keyDrivers && s.keyDrivers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {s.keyDrivers.slice(0, 4).map((d, j) => (
              <span key={j} style={{
                fontSize: 10, fontWeight: 500,
                color: cfg.color,
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: "var(--radius-full)",
                padding: "2px 8px",
              }}>{d}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Action row ─────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        borderTop: `1px solid ${isSelected ? cfg.border : "var(--color-border)"}`,
        background: isSelected ? cfg.bg + "88" : "var(--color-page-bg)",
      }}>
        {ACTIONS.map((a, idx) => (
          <ActionBtn
            key={a.id}
            icon={a.icon}
            label={de ? a.labelDe : a.labelEn}
            hoverBg={cfg.bg}
            hoverColor={cfg.color}
            borderRight={idx < 3}
            onClick={(e) => { e.stopPropagation(); onAction(a.id); }}
          />
        ))}
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, hoverBg, hoverColor, borderRight, onClick,
}: {
  icon: string; label: string; hoverBg: string; hoverColor: string;
  borderRight: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: "none",
        borderRight: borderRight ? "1px solid var(--color-border)" : "none",
        background: hovered ? hoverBg : "transparent",
        cursor: "pointer",
        padding: "8px 4px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        transition: "background 0.12s",
      }}
    >
      <span style={{
        fontSize: 12, lineHeight: 1,
        color: hovered ? hoverColor : "var(--color-text-muted)",
      }}>{icon}</span>
      <span style={{
        fontSize: 9, fontWeight: 600,
        color: hovered ? hoverColor : "var(--color-text-muted)",
        letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1,
        whiteSpace: "nowrap",
      }}>{label}</span>
    </button>
  );
}

// ── ScenarioSelector ──────────────────────────────────────────────────────────
export function ScenarioSelector({ scenarios, query, locale, onFollowUp }: {
  scenarios: Scenario[];
  query: string;
  locale: Locale;
  onFollowUp?: (q: string) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const de = locale === "de";

  const toggle = (i: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const combineSelected = () => {
    if (selected.size < 2 || !onFollowUp) return;
    const list = [...selected].map(i => scenarios[i]);
    const text = list.map(s => `"${s.name}" (${(s.probability * 100).toFixed(0)}%): ${s.description}`).join("\n");
    onFollowUp(de
      ? `Ausgehend von "${query}" — kombiniere folgende Szenarien und analysiere ihre Wechselwirkungen:\n${text}\n\nWelche übergreifenden Dynamiken entstehen? Was sind die robustesten Handlungsoptionen die in mehreren Szenarien funktionieren?`
      : `Based on "${query}" — combine these scenarios and analyze their interactions:\n${text}\n\nWhat overarching dynamics emerge? What are the most robust actions that work across multiple scenarios?`
    );
    setSelected(new Set());
  };

  const generateMore = () => {
    if (!onFollowUp) return;
    onFollowUp(de
      ? `Zu "${query}" — bisherige Szenarien: ${scenarios.map(s => s.name).join(", ")}. Generiere 3 WEITERE, fundamental andere Szenarien: unkonventionell, disruptiv, andere Akteure oder Zeiträume.`
      : `For "${query}" — existing scenarios: ${scenarios.map(s => s.name).join(", ")}. Generate 3 MORE fundamentally different scenarios: unconventional, disruptive, different actors or timeframes.`
    );
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="section-label">{de ? "Zukunftsszenarien" : "Future Scenarios"}</div>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {de ? "Karte wählen · Aktionen unten" : "Select card · Actions below"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {selected.size > 1 && (
            <Button onClick={combineSelected} size="sm"
              className="text-[12px] bg-[#E4FF97] text-[#0A0A0A] hover:bg-[#D4F080] border border-black/10 font-semibold">
              {de ? `${selected.size} kombinieren →` : `Combine ${selected.size} →`}
            </Button>
          )}
          <Button variant="outline" onClick={generateMore} size="sm" className="text-[12px]">
            {de ? "+ Weitere" : "+ More"}
          </Button>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}>
        {scenarios.map((s, i) => (
          <ScenarioCard
            key={i}
            s={s} i={i}
            isSelected={selected.has(i)}
            onToggle={() => toggle(i)}
            onAction={(a) => onFollowUp?.(buildPrompt(a, s, query, de))}
            de={de}
            query={query}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, paddingLeft: 2 }}>
        {[
          { icon: "↓", label: de ? "Vertiefen — detaillierte Analyse" : "Deep dive — detailed analysis" },
          { icon: "→", label: de ? "Was wenn — Handlungsoptionen"     : "What if — action options" },
          { icon: "⚡", label: de ? "Angreifen — Annahmen testen"     : "Challenge — test assumptions" },
          { icon: "◈", label: de ? "Strategie — Spielplan bauen"      : "Strategy — build playbook" },
        ].map(l => (
          <span key={l.icon} style={{ fontSize: 10, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontWeight: 700 }}>{l.icon}</span> {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
