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
import { GitBranch, Sparkles, Layers, Plus, ChevronDown, Pencil } from "lucide-react";

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
            {de ? "Aktive Session" : "Active Session"}
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
              <button
                onClick={() => onTitleChange ? setEditingTitle(true) : (pastSessions.length > 0 ? setPickerOpen(o => !o) : null)}
                title={onTitleChange ? (de ? "Session-Titel bearbeiten" : "Edit session title") : (de ? "Session wechseln" : "Switch session")}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                  color: "var(--foreground, #0A0A0A)",
                  maxWidth: 220,
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
                <span>{sessionTitle}</span>
                {onTitleChange && <Pencil size={9} style={{ opacity: 0.4 }} />}
              </button>
            )}
            {pastSessions.length > 0 && !editingTitle && (
              <button
                onClick={() => setPickerOpen(o => !o)}
                title={de ? "Andere Session öffnen" : "Open another session"}
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
              {de ? "Letzte Sessions" : "Recent Sessions"} ({pastSessions.length})
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
                  {s.name || (de ? "Unbenannte Session" : "Untitled session")}
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.04em",
                }}>
                  {s.nodeCount} {de ? "Nodes" : "nodes"}
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
          return (
            <button
              key={node.id}
              onClick={() => onNodeClick(node.id)}
              title={node.query}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
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
                maxWidth: 180,
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
                  opacity: isActive ? 0.8 : 0.55,
                }}
              >
                {num}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {node.query.length > 22 ? node.query.slice(0, 20) + "…" : node.query}
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
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          onClick={onNewSession}
          title={de ? "Neue Session starten" : "Start new session"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
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

        <button
          onClick={onOpenCanvas}
          title={de ? "Session im Node Canvas öffnen" : "Open session in Node Canvas"}
          className={showPulse ? "sis-session-pulse" : ""}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
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
          <span style={{ opacity: 0.6, fontSize: 10 }}>→</span>
        </button>

        <button
          onClick={onOpenSummary}
          disabled={nodes.length < 2}
          title={
            nodes.length < 2
              ? de
                ? "Mindestens 2 Analysen nötig"
                : "At least 2 analyses needed"
              : de
              ? "Meta-Synthese dieser Session"
              : "Meta-synthesis of this session"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
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
