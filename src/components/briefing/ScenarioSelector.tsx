"use client";

import { useState } from "react";
import {
  Search as DeepIcon,
  GitBranch as WhatIfIcon,
  ShieldAlert as ChallengeIcon,
  Compass as StrategyIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Plus as PlusIcon,
  Merge as MergeIcon,
} from "lucide-react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { Locale } from "@/lib/i18n";
import { useT } from "@/lib/locale-context";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";
import { VoltSectionLabel } from "@/components/verstehen/VoltPrimitives";

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
// Single strong color per type — used for top accent strip + percentage + hover
const TYPE_CONFIG: Record<string, {
  color: string;
  tintBg: string;     // very subtle background when selected
  labelDe: string; labelEn: string;
}> = {
  optimistic:  { color: "#1A9E5A", tintBg: "rgba(26,158,90,0.04)",  labelDe: "Optimistisch",  labelEn: "Optimistic"  },
  baseline:    { color: "#1D4ED8", tintBg: "rgba(29,78,216,0.04)",  labelDe: "Basisfall",      labelEn: "Baseline"    },
  pessimistic: { color: "#B91C1C", tintBg: "rgba(185,28,28,0.04)",  labelDe: "Pessimistisch", labelEn: "Pessimistic" },
  wildcard:    { color: "#B45309", tintBg: "rgba(180,83,9,0.04)",   labelDe: "Wildcard",       labelEn: "Wildcard"    },
};

const DEFAULT_TYPE = { color: "#1D4ED8", tintBg: "rgba(29,78,216,0.04)", labelDe: "Szenario", labelEn: "Scenario" };

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

// ── Action definitions (icons + labels + tooltip) ─────────────────────────────
type ActionId = "deep" | "whatif" | "challenge" | "strategy";

const ACTION_DEFS: {
  id: ActionId;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  labelDe: string; labelEn: string;
  tipDe: string; tipEn: string;
}[] = [
  { id: "deep",      Icon: DeepIcon,      labelDe: "Vertiefen",  labelEn: "Deep dive",  tipDe: "Vertiefen — detaillierte Analyse der Bedingungen und Frühwarnindikatoren",   tipEn: "Deep dive — detailed analysis of conditions and early warning indicators" },
  { id: "whatif",    Icon: WhatIfIcon,    labelDe: "Was wenn",   labelEn: "What if",    tipDe: "Was wenn — 3–5 konkrete Handlungsoptionen, sofort/mittel/langfristig",      tipEn: "What if — 3–5 concrete action options across immediate/mid/long term" },
  { id: "challenge", Icon: ChallengeIcon, labelDe: "Angreifen",  labelEn: "Challenge",  tipDe: "Angreifen — Stress-Test der Annahmen: was wird übersehen?",                 tipEn: "Challenge — stress test of assumptions: what is being overlooked?" },
  { id: "strategy",  Icon: StrategyIcon,  labelDe: "Strategie",  labelEn: "Strategy",   tipDe: "Strategie — Spielplan mit Akteuren, Koalitionen und Positionierung",        tipEn: "Strategy — playbook with actors, coalitions and positioning" },
];

// ── ScenarioCard ──────────────────────────────────────────────────────────────
function ScenarioCard({
  s, isSelected, onToggle, onAction, de, query,
}: {
  s: Scenario; i: number; isSelected: boolean;
  onToggle: () => void;
  onAction: (a: ActionId) => void;
  de: boolean;
  query?: string;
}) {
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const saveToBuilder = async () => {
    if (saved) return;
    try {
      await fetchWithTimeout("/api/v1/scenarios", {
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

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderRadius: 10,
      border: `1px solid ${isSelected ? cfg.color : "var(--color-border)"}`,
      background: isSelected ? cfg.tintBg : "var(--color-surface)",
      transition: "all 0.15s",
      overflow: "hidden",
      fontFamily: "var(--font-ui)",
      position: "relative",
    }}>
      {/* Top accent strip — single color indicator for scenario type */}
      <div style={{ height: 3, background: cfg.color, flexShrink: 0 }} />

      {/* ── Clickable body ─────────────────────────── */}
      <div onClick={onToggle} style={{ padding: "14px 16px 12px", cursor: "pointer", flex: 1 }}>

        {/* Meta line: type · timeframe · percentage (aligned, all subtle) */}
        <div style={{
          display: "flex", alignItems: "baseline", gap: 8,
          marginBottom: 8, minWidth: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <span style={{ fontWeight: 700, color: cfg.color, flexShrink: 0 }}>{label}</span>
          {s.timeframe && (
            <span style={{
              color: "var(--color-text-muted)", fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>· {s.timeframe}</span>
          )}
          <span style={{
            marginLeft: "auto",
            fontFamily: "var(--font-display)",
            fontSize: 16, fontWeight: 700,
            color: cfg.color, lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            textTransform: "none",
            flexShrink: 0,
          }}>{pct}%</span>
        </div>

        {/* Name — primary hierarchy */}
        <h4 style={{
          fontFamily: "var(--font-heading)",
          fontSize: 15, fontWeight: 700, lineHeight: 1.3,
          color: "var(--color-text-heading)",
          margin: "0 0 8px",
          letterSpacing: "-0.01em",
          display: "flex", alignItems: "flex-start", gap: 6,
        }}>
          {isSelected && <CheckIcon size={13} strokeWidth={2.5} color={cfg.color} style={{ marginTop: 3, flexShrink: 0 }} />}
          <span>{s.name}</span>
        </h4>

        {/* Description — capped at 4 lines */}
        <p style={{
          fontFamily: "var(--font-ui)",
          fontSize: 12, color: "var(--color-text-subtle)",
          lineHeight: 1.55, margin: "0 0 10px",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {s.description}
        </p>

        {/* Key drivers — plain bulleted list (no colored boxes) */}
        {s.keyDrivers && s.keyDrivers.length > 0 && (
          <ul style={{
            margin: 0, padding: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            {s.keyDrivers.slice(0, 4).map((d, j) => (
              <li key={j} style={{
                fontFamily: "var(--font-ui)",
                fontSize: 11.5,
                color: "var(--color-text-secondary)",
                lineHeight: 1.45,
                display: "flex", alignItems: "flex-start", gap: 7,
              }}>
                <span style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: cfg.color, flexShrink: 0, marginTop: 6,
                }} />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer row: subtle icon actions + save ─────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "6px 8px 6px 10px",
        borderTop: "1px solid var(--color-border)",
        gap: 2,
      }}>
        {ACTION_DEFS.map((a) => (
          <ActionBtn
            key={a.id}
            Icon={a.Icon}
            label={de ? a.labelDe : a.labelEn}
            tip={de ? a.tipDe : a.tipEn}
            hoverColor={cfg.color}
            onClick={(e) => { e.stopPropagation(); onAction(a.id); }}
          />
        ))}
        <span style={{ flex: 1 }} />
        <Tooltip content={saved ? t("scenarioSelector.saveTooltipSaved") : t("scenarioSelector.saveTooltip")} placement="top">
          <button
            onClick={(e) => { e.stopPropagation(); saveToBuilder(); }}
            aria-label={t("scenarioSelector.saveAriaLabel")}
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: "none",
              background: "transparent",
              color: saved ? "#1A9E5A" : "var(--color-text-muted)",
              cursor: saved ? "default" : "pointer", flexShrink: 0,
              transition: "all 0.12s",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={e => { if (!saved) (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {saved ? <CheckIcon size={13} strokeWidth={2.5} /> : <SaveIcon size={12} strokeWidth={2} />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function ActionBtn({
  Icon, label, tip, hoverColor, onClick,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  tip: string;
  hoverColor: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = hovered ? hoverColor : "var(--color-text-muted)";
  return (
    <Tooltip content={tip} placement="top">
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={label}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          width: 28, height: 26, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.12s",
        }}
      >
        <Icon size={14} color={color} strokeWidth={2} />
      </button>
    </Tooltip>
  );
}

// ── ScenarioSelector ──────────────────────────────────────────────────────────
export function ScenarioSelector({ scenarios, query, locale, onFollowUp, hideHeader = false }: {
  scenarios: Scenario[];
  query: string;
  locale: Locale;
  onFollowUp?: (q: string) => void;
  hideHeader?: boolean;
}) {
  const { t } = useT();
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
    <div style={{ fontFamily: "var(--font-ui)" }}>
      {/* Header row — Volt UI SectionLabel with hint + actions */}
      {!hideHeader && (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <VoltSectionLabel
              hint={t("scenarioSelector.headerHint")}
            >
              {t("scenarioSelector.header")}
            </VoltSectionLabel>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {selected.size > 1 && (
              <Tooltip content={t("scenarioSelector.combineTooltip")} placement="top">
                <Button onClick={combineSelected} size="sm"
                  className="text-[12px] bg-[#E4FF97] text-[#0A0A0A] hover:bg-[#D4F080] border border-black/10 font-semibold gap-1.5">
                  <MergeIcon size={13} />
                  {t("scenarioSelector.combineButton", { n: String(selected.size) })}
                </Button>
              </Tooltip>
            )}
            <Tooltip content={t("scenarioSelector.generateMoreTooltip")} placement="top">
              <Button variant="outline" onClick={generateMore} size="sm" className="text-[12px] gap-1.5">
                <PlusIcon size={13} />
                {t("scenarioSelector.generateMoreButton")}
              </Button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 12,
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
    </div>
  );
}
