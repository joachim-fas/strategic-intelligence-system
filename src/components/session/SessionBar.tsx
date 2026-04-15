"use client";

/**
 * SessionBar — Persistent session indicator on the home page.
 *
 * Phase 1+2 features:
 * - Only visible when history has 2+ entries (single-shot users are never distracted)
 * - Shows session title + clickable node chips for navigation
 * - "+ Neu" starts a fresh session
 * - "Canvas öffnen" pulls the user into spatial view (with pulse animation at 3+ nodes)
 * - "Zusammenfassung" navigates to meta-summary view
 *
 * Phase 5 polish:
 * - Editable session title (click to edit)
 * - Session-picker dropdown to switch between past sessions
 *
 * Philosophy: Make the session visible without imposing it.
 */

import React, { useState, useRef, useEffect } from "react";
import { VoltIconBox } from "@/components/verstehen/VoltPrimitives";
import { Tooltip } from "@/components/ui/Tooltip";
import { GitBranch, Sparkles, Layers, Plus, ChevronDown, Pencil, ArrowRight } from "lucide-react";

/**
 * Produce a short, meaningful label from a raw user query.
 *
 * Problems with naive truncation (e.g. `q.slice(0, 20) + "…"`):
 *   "Wie wird sich das Klima in Zentraleuropa…"  → "Wie wird sich das Kl…"  (cut mid-word)
 *   "Analysiere den Knoten 'erhöhte Sterblichkeit'"  → "Analysiere den Knot…"  (cut loses the interesting noun)
 *
 * Strategy:
 *   1. Prefer quoted substrings — they are always the most specific noun phrase
 *   2. Strip question/action leaders in DE + EN (Wie, Was, Analysiere, How, Analyze, …)
 *   3. Strip trailing punctuation
 *   4. Break at word boundaries, never mid-word
 */
function shortenQuery(q: string, maxChars = 28): string {
  if (!q) return "";
  let text = q.trim().replace(/[?!.]+$/, "");

  // If the query contains a quoted phrase, prefer it — it's almost always the topic
  const quoted = text.match(/["„»›]([^"„»›"«‹‚]+)["«»‹‚"]/);
  if (quoted && quoted[1].length >= 3) {
    text = quoted[1];
  } else {
    // Strip leading question / command words
    const leadRe = /^(wie|was|warum|wann|wo|welche[rsn]?|wieso|weshalb|analysiere|analysiert|erkläre|erklär|betrachte|zeige|bewerte|vergleiche|beschreibe|bedenke|how|what|why|when|where|which|analyze|explain|describe|show|evaluate|compare|consider)\s+/i;
    while (leadRe.test(text)) text = text.replace(leadRe, "");
    // Strip very common function words from the start
    text = text.replace(/^(sich\s+|das\s+|der\s+|die\s+|den\s+|dem\s+|des\s+|ein\s+|eine\s+|einen\s+|einem\s+|einer\s+|the\s+|a\s+|an\s+|it\s+|this\s+|that\s+)+/i, "");
  }

  // Capitalize
  if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1);

  if (text.length <= maxChars) return text;
  // Word-boundary truncation — never cut mid-word
  const hardCut = text.slice(0, maxChars);
  const lastSpace = hardCut.lastIndexOf(" ");
  const clean = lastSpace > maxChars * 0.5 ? hardCut.slice(0, lastSpace) : hardCut;
  return clean.replace(/[,;:\-–—]\s*$/, "") + "…";
}

export interface SessionBarNode {
  id: string;
  query: string;
  isLoading?: boolean;
  hasError?: boolean;
}

export interface SessionBarSession {
  id: string;
  name: string;
  nodeCount: number;
  updatedAt?: string;
}

interface SessionBarProps {
  sessionTitle: string;
  nodes: SessionBarNode[];
  activeNodeId: string | null;
  onNodeClick: (id: string) => void;
  onNewSession: () => void;
  onOpenCanvas: () => void;
  onOpenSummary: () => void;
  onTitleChange?: (newTitle: string) => void;
  pastSessions?: SessionBarSession[];
  onPickSession?: (id: string) => void;
  de: boolean;
}

export function SessionBar({
  sessionTitle,
  nodes,
  activeNodeId,
  onNodeClick,
  onNewSession,
  onOpenCanvas,
  onOpenSummary,
  onTitleChange,
  pastSessions = [],
  onPickSession,
  de,
}: SessionBarProps) {
  const showPulse = nodes.length >= 3;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(sessionTitle);
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitleDraft(sessionTitle); }, [sessionTitle]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== sessionTitle && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setTitleDraft(sessionTitle);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        zIndex: pickerOpen ? 1000 : "auto",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 16px",
        borderRadius: 12,
        background: "var(--color-surface, rgba(255,255,255,0.98))",
        border: "1px solid var(--color-border)",
        backdropFilter: "blur(12px) saturate(160%)",
        maxWidth: 960,
        margin: "0 auto 16px",
        fontFamily: "var(--font-ui)",
        flexWrap: "wrap",
      }}
    >
      {/* Session brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, minWidth: 0, position: "relative" }} ref={pickerRef}>
        <VoltIconBox icon={<GitBranch size={13} />} variant="lime" size={26} rounded="md" />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "var(--muted-foreground)",
            }}
          >
            {de ? "Aktives Projekt" : "Active Project"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === "Enter") commitTitle();
                  if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(sessionTitle); }
                }}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                  color: "var(--foreground, #0A0A0A)",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  padding: "1px 6px",
                  outline: "none",
                  width: 240,
                }}
              />
            ) : (
              <Tooltip content={sessionTitle !== shortenQuery(sessionTitle, 28) ? sessionTitle : (onTitleChange ? (de ? "Projekt-Titel bearbeiten" : "Edit project title") : (de ? "Projekt wechseln" : "Switch project"))} placement="bottom">
                <button
                  onClick={() => onTitleChange ? setEditingTitle(true) : (pastSessions.length > 0 ? setPickerOpen(o => !o) : null)}
                  aria-label={sessionTitle}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "-0.015em",
                    color: "var(--foreground, #0A0A0A)",
                    maxWidth: 260,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{shortenQuery(sessionTitle, 28)}</span>
                  {onTitleChange && <Pencil size={9} style={{ opacity: 0.4 }} />}
                </button>
              </Tooltip>
            )}
            {pastSessions.length > 0 && !editingTitle && (
              <button
                onClick={() => setPickerOpen(o => !o)}
                title={de ? "Anderes Projekt öffnen" : "Open another project"}
                style={{
                  background: "transparent", border: "none",
                  padding: 1, cursor: "pointer",
                  color: "var(--muted-foreground)",
                  display: "inline-flex", alignItems: "center",
                }}
              >
                <ChevronDown size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Session-Picker Dropdown */}
        {pickerOpen && pastSessions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 10000,
              minWidth: 320,
              maxHeight: 420,
              overflowY: "auto",
              background: "var(--card, #fff)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              boxShadow: "0 20px 56px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.08)",
              padding: 6,
            }}
          >
            <div style={{
              padding: "6px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "var(--muted-foreground)",
            }}>
              {de ? "Letzte Projekte" : "Recent Projects"} ({pastSessions.length})
            </div>
            {pastSessions.map(s => (
              <button
                key={s.id}
                onClick={() => { onPickSession?.(s.id); setPickerOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--muted, #F7F7F7)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 2,
                }}>
                  {s.name || (de ? "Unbenanntes Projekt" : "Untitled project")}
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.04em",
                }}>
                  {s.nodeCount} {de ? (s.nodeCount === 1 ? "Karte" : "Karten") : (s.nodeCount === 1 ? "card" : "cards")}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 26, background: "var(--color-border)", flexShrink: 0 }} />

      {/* Node chips — scrollable if many */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flex: 1,
          minWidth: 0,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
        className="sis-scroll-hidden"
      >
        {nodes.map((node, i) => {
          const isActive = activeNodeId === node.id;
          const num = String(i + 1).padStart(2, "0");
          const label = shortenQuery(node.query, 26);
          return (
            <Tooltip key={node.id} content={node.query} placement="bottom">
              <button
                onClick={() => onNodeClick(node.id)}
                aria-label={node.query}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 28,
                  padding: "0 12px",
                  borderRadius: 9999,
                  border: isActive
                    ? "1.5px solid var(--foreground, #0A0A0A)"
                    : "1px solid var(--color-border)",
                  background: isActive ? "var(--foreground, #0A0A0A)" : "transparent",
                  color: isActive
                    ? "var(--background, #fff)"
                    : node.hasError
                    ? "var(--destructive, #E8402A)"
                    : "var(--muted-foreground, #6B6B6B)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.12s",
                  flexShrink: 0,
                  maxWidth: 240,
                  lineHeight: 1,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--foreground, #0A0A0A)";
                    e.currentTarget.style.color = "var(--foreground, #0A0A0A)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                    e.currentTarget.style.color = node.hasError
                      ? "var(--destructive, #E8402A)"
                      : "var(--muted-foreground, #6B6B6B)";
                  }
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 700,
                    opacity: isActive ? 0.85 : 0.6,
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {num}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {label}
                </span>
                {node.isLoading && (
                  <span
                    className="animate-pulse"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--volt-lime, #E4FF97)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Tooltip content={de ? "Neues Projekt starten" : "Start new project"} placement="bottom">
          <button
            onClick={onNewSession}
            aria-label={de ? "Neues Projekt starten" : "Start new project"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 30,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--muted-foreground)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.12s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--foreground)";
              e.currentTarget.style.color = "var(--foreground)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--muted-foreground)";
            }}
          >
            <Plus size={12} />
            <span>{de ? "Neu" : "New"}</span>
          </button>
        </Tooltip>

        <Tooltip content={de ? "Projekt im Node Canvas öffnen" : "Open project in Node Canvas"} placement="bottom">
          <button
            onClick={onOpenCanvas}
            aria-label={de ? "Projekt im Node Canvas öffnen" : "Open project in Node Canvas"}
            className={showPulse ? "sis-session-pulse" : ""}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--muted, #F7F7F7)",
              color: "var(--foreground)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.12s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--volt-lime, #E4FF97)";
              e.currentTarget.style.borderColor = "var(--volt-lime, #E4FF97)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "var(--muted, #F7F7F7)";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          >
            <Layers size={12} />
            <span>Node Canvas</span>
            <ArrowRight size={11} style={{ opacity: 0.55 }} />
          </button>
        </Tooltip>

        <Tooltip
          content={
            nodes.length < 2
              ? de
                ? "Mindestens 2 Analysen nötig"
                : "At least 2 analyses needed"
              : de
              ? "Meta-Synthese dieses Projekts"
              : "Meta-synthesis of this project"
          }
          placement="bottom"
        >
          <button
            onClick={onOpenSummary}
            disabled={nodes.length < 2}
            aria-label={de ? "Zusammenfassung" : "Summary"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 30,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: nodes.length < 2 ? "var(--muted-foreground)" : "var(--foreground)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              fontWeight: 600,
              cursor: nodes.length < 2 ? "not-allowed" : "pointer",
              opacity: nodes.length < 2 ? 0.5 : 1,
              transition: "all 0.12s",
            }}
            onMouseEnter={e => {
              if (nodes.length >= 2) {
                e.currentTarget.style.borderColor = "var(--foreground)";
                e.currentTarget.style.background = "var(--muted, #F7F7F7)";
              }
            }}
            onMouseLeave={e => {
              if (nodes.length >= 2) {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <Sparkles size={12} />
            <span>{de ? "Zusammenfassung" : "Summary"}</span>
          </button>
        </Tooltip>
      </div>

      <style>{`
        .sis-scroll-hidden::-webkit-scrollbar { display: none; }
        @keyframes sis-session-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(228,255,151,0.0); }
          50%       { box-shadow: 0 0 0 4px rgba(228,255,151,0.5); }
        }
        .sis-session-pulse {
          animation: sis-session-pulse 2.5s ease-out 1;
        }
      `}</style>
    </div>
  );
}
