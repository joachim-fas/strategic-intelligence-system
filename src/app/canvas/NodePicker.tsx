/**
 * NodePicker — dropdown menu triggered by the canvas command-line's
 * "+" affordance (or double-click on empty canvas). Lets the user
 * add one of nine card types: five KI-Analyse kinds (Abfrage,
 * Erkenntnisse, Szenarien, Empfehlung, Folgefragen) and four Karten
 * kinds (Notiz, Idee, Liste, Datei).
 *
 * The picker itself is tiny — input + two sections of option rows —
 * and has no coupling to canvas state. Keyboard-navigable with /
 * autofocus on the search input.
 *
 * Extracted from `page.tsx` as the next slice after ConnectionsSVG
 * (2026-04-18, audit A5-H7).
 */

"use client";

import React, { useEffect, useRef, useState } from "react";

export type NewNodeType =
  | "query"
  | "insights" | "scenarios" | "decision" | "followups"
  | "note" | "idea" | "list" | "file";

interface NodePickerOption {
  type: NewNodeType;
  icon: string;
  label: string;
  desc: string;
  bg: string;
  color: string;
  section: "analyse" | "karte";
}

const NODE_PICKER_OPTIONS: NodePickerOption[] = [
  // ── KI-Analyse ──────────────────────────────────────────────────────────
  { type: "query",    icon: "⌕", label: "Abfrage",       desc: "Vollständige KI-Analyse starten",        bg: "var(--color-lime)",       color: "var(--color-text-heading)",  section: "analyse" },
  { type: "insights", icon: "◉", label: "Erkenntnisse",  desc: "Kernaussagen & Muster extrahieren",       bg: "var(--pastel-mint)",       color: "var(--pastel-mint-text)",   section: "analyse" },
  { type: "scenarios",icon: "◈", label: "Szenarien",     desc: "Optimist. / wahrsch. / pessim. Zukunft",  bg: "var(--pastel-orchid)",     color: "var(--pastel-orchid-text)", section: "analyse" },
  { type: "decision", icon: "◆", label: "Empfehlung",    desc: "Konkreten Handlungsrahmen ableiten",      bg: "var(--pastel-aqua)",       color: "var(--pastel-aqua-text)",   section: "analyse" },
  { type: "followups",icon: "◎", label: "Folgefragen",   desc: "Offene Fragen & nächste Schritte",        bg: "var(--pastel-butter)",     color: "var(--pastel-butter-text)", section: "analyse" },
  // ── Karten ──────────────────────────────────────────────────────────────
  { type: "note",  icon: "✎", label: "Notiz",   desc: "Freitext, Beobachtung, Quelle",       bg: "var(--pastel-butter)",  color: "var(--pastel-butter-text)",  section: "karte" },
  { type: "idea",  icon: "◇", label: "Idee",    desc: "Hypothese, Ansatz, These",            bg: "var(--pastel-peach)",   color: "var(--pastel-peach-text)",   section: "karte" },
  { type: "list",  icon: "≡", label: "Liste",   desc: "Strukturierte Aufzählung",            bg: "var(--pastel-mint)",    color: "var(--pastel-mint-text)",    section: "karte" },
  { type: "file",  icon: "📎", label: "Datei",   desc: "Dokument, Bild oder Text hochladen", bg: "var(--pastel-blue)",    color: "var(--pastel-blue-text)",    section: "karte" },
];

const SECTION_LABELS: Record<"analyse" | "karte", string> = {
  analyse: "KI-Analyse",
  karte:   "Karte",
};

export function NodePicker({ onSelect, onClose, hasContext }: {
  onSelect: (t: NewNodeType) => void;
  onClose: () => void;
  hasContext?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allOptions = NODE_PICKER_OPTIONS;
  const filtered = search.trim()
    ? allOptions.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.desc.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  useEffect(() => { setCursor(0); }, [search]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && filtered[cursor]) { onSelect(filtered[cursor].type); }
    if (e.key === "Escape") onClose();
  };

  // Group by section (only when not filtering)
  const sections = search.trim()
    ? null
    : (["analyse", "karte"] as const).map(sec => ({
        key: sec,
        label: SECTION_LABELS[sec],
        items: filtered.filter(o => o.section === sec),
      })).filter(s => s.items.length > 0);

  // Flat index mapping for cursor (sections view)
  const flatItems = sections ? sections.flatMap(s => s.items) : filtered;

  const renderItem = (item: NodePickerOption, flatIdx: number) => (
    <div key={item.type}
      onClick={() => onSelect(item.type)}
      onMouseEnter={() => setCursor(flatIdx)}
      title={item.desc}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8,
        cursor: "pointer", transition: "background 0.1s",
        background: cursor === flatIdx ? "var(--color-page-bg)" : "transparent",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 7, flexShrink: 0,
        background: item.bg, border: "1px solid rgba(0,0,0,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, color: item.color, fontWeight: 700,
      }}>
        {item.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)" }}>{item.label}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
      </div>
      {item.section === "analyse" && (
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", color: item.color, background: item.bg, border: `1px solid ${item.color}33`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>KI</span>
      )}
    </div>
  );

  return (
    <div onPointerDown={e => e.stopPropagation()}
      style={{ width: 340, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ padding: "10px 14px 9px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>⌕</span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKey}
            placeholder={hasContext ? "Iteration auswählen…" : "Typ auswählen…"}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--color-text-primary)", fontFamily: "inherit" }}
          />
        </div>
        {hasContext && (
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 5, paddingLeft: 21 }}>
            KI-Typen verwenden den Kontext der Eltern-Karte als Ausgangspunkt
          </div>
        )}
      </div>

      {/* Items — sectioned or flat */}
      <div style={{ padding: "6px 6px 4px", maxHeight: 380, overflowY: "auto" }}>
        {sections ? (
          sections.map(sec => (
            <div key={sec.key}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", padding: "6px 10px 3px", fontFamily: "var(--font-code, 'JetBrains Mono'), monospace" }}>
                {sec.label}
              </div>
              {sec.items.map(item => renderItem(item, flatItems.indexOf(item)))}
            </div>
          ))
        ) : (
          filtered.length > 0
            ? filtered.map((item, i) => renderItem(item, i))
            : <div style={{ padding: "16px 10px", textAlign: "center", fontSize: 12, color: "var(--color-text-muted)" }}>Keine Ergebnisse</div>
        )}
      </div>

      {/* Hints */}
      <div style={{ padding: "7px 14px 9px", borderTop: "1px solid var(--color-border)", display: "flex", gap: 14 }}>
        {[["↑↓", "Navigieren"], ["↩", "Einfügen"], ["Esc", "Schließen"]].map(([k, l]) => (
          <span key={k} style={{ fontSize: 10, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "var(--color-page-bg)", border: "1px solid var(--color-border)", fontFamily: "inherit" }}>{k}</kbd>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
