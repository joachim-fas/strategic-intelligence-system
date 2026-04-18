/**
 * DerivedNodeCard — renders the four AI-derived card types (insight,
 * scenario, decision, followup) with shared framing and
 * per-type accent color + badge. The actual analysis work happens
 * in the DetailPanel; this card face shows a compact preview.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice
 * 4c (18.04.2026 audit A5-H7).
 */

"use client";

import React, { useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { CardActionsMenu } from "../CardActionsMenu";
import { FormattedText } from "../FormattedText";
import { DERIVED_W, NODE_STATUS_META, SCEN } from "../constants";
import { getNodeHeight } from "../utils";
import type { CanvasNode, CardBaseProps, DerivedNode, NodeStatus } from "../types";

interface DerivedNodeCardProps extends CardBaseProps {
  node: DerivedNode;
  de: boolean;
  onExplore: (id: string, queryText: string) => void;
  /** Opens a follow-up query dialogue for this derived node. Audit
   *  finding A2-H1 (18.04.2026): previously missing on derived cards
   *  so the three-dot menu had no "Folgefrage stellen" entry. */
  onFollowUp?: (id: string, prefill?: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
}

export function DerivedNodeCard({
  node, de, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom,
  onExplore,
  onFollowUp,
  onAddTag, onSetStatus,
}: DerivedNodeCardProps) {
  const type = node.nodeType;
  const isScenario = type === "scenario";
  const isFollowup = type === "followup";
  const scenCfg = isScenario && node.colorKey ? SCEN[node.colorKey] ?? SCEN.baseline : null;

  const cfg = useMemo(() => {
    if (type === "insight")  return { accent: "#6B7A00", accentText: "#6B7A00", bg: "var(--color-lime-light)", badge: de ? "ERKENNTNIS" : "INSIGHT", badgeTip: de ? "Erkenntnis: Wichtige Schlussfolgerung aus der Analyse" : "Insight: Key finding derived from the analysis" };
    if (type === "decision") return { accent: "#1A9E5A", accentText: "#1A9E5A", bg: "var(--signal-positive-light)", badge: de ? "EMPFEHLUNG" : "DECISION", badgeTip: de ? "Empfehlung: Konkrete Handlungsoption mit Entscheidungsrahmen" : "Decision: Concrete action option with decision framework" };
    if (type === "followup") return { accent: "rgba(0,0,0,0.10)", accentText: "var(--color-text-muted)", bg: "var(--color-surface)", badge: de ? "FOLGEFRAGE" : "FOLLOW-UP", badgeTip: de ? "Folgefrage: Weiterführende Analyse auf Basis dieser Ergebnisse" : "Follow-up: Further analysis building on these results" };
    const scen = SCEN[node.colorKey ?? "baseline"] ?? SCEN.baseline;
    const scenTips: Record<string, string> = {
      optimistic: de ? "Optimistisches Szenario: Beste realistische Entwicklung" : "Optimistic scenario: Best realistic outcome",
      baseline:   de ? "Basisszenario: Wahrscheinlichstes Outcome" : "Baseline scenario: Most likely outcome",
      pessimistic: de ? "Pessimistisches Szenario: Ungünstigste realistische Entwicklung" : "Pessimistic scenario: Worst realistic outcome",
      wildcard:   de ? "Wildcard-Szenario: Unwahrscheinlich, aber wirkungsmächtig" : "Wildcard scenario: Unlikely but high-impact possibility",
    };
    return { accent: scen.color, accentText: scen.color, bg: scen.bg, badge: de ? scen.label.toUpperCase() : scen.labelEn.toUpperCase(), badgeTip: scenTips[node.colorKey ?? "baseline"] ?? "" };
  }, [type, node.colorKey, de]);

  const accentColorForStatus = node.nodeStatus && node.nodeStatus !== "open" ? NODE_STATUS_META[node.nodeStatus].color : null;

  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 24, overflow: "hidden",
          background: isScenario ? (scenCfg?.bg ?? "var(--color-surface)") : cfg.bg,
          border: `1px solid ${selected ? "#0A0A0A" : "var(--color-border, rgba(0,0,0,0.08))"}`,
          borderRadius: 6,
          boxShadow: `inset 3px 0 0 ${isScenario ? (scenCfg?.color ?? "#1D4ED8") : isFollowup ? "var(--color-border)" : cfg.accent}`,
          userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4, padding: "0 6px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <Tooltip content={cfg.badgeTip} placement="top" delay={400}>
          <span style={{ fontSize: 7, fontWeight: 800, color: isScenario ? (scenCfg?.color ?? "#1D4ED8") : cfg.accentText, flexShrink: 0, textTransform: "uppercase", cursor: "help" }}>{cfg.badge}</span>
        </Tooltip>
        <span style={{ fontSize: 9, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.label || node.content}</span>
        {accentColorForStatus && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} />}
      </div>
    );
  }

  const typeColorHex = isScenario
    ? (node.colorKey === "optimistic" ? "#1A9E5A" : node.colorKey === "pessimistic" ? "#E8402A" : node.colorKey === "wildcard" ? "#D4A017" : "#3B82F6")
    : type === "insight" ? "#6B7A00" : type === "decision" ? "#1A9E5A" : "#6B7280";
  const cardH = node.customHeight ?? getNodeHeight(node as CanvasNode);

  return (
    // Wrapper: positioning + ports (overflow:visible)
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: cardH, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      {/* Left input port */}
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      {/* Right output port */}
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Weiterführende Analyse"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${typeColorHex}`, boxShadow: `0 0 8px ${typeColorHex}66`, zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${typeColorHex}99, 0 0 0 3px ${typeColorHex}33`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${typeColorHex}66`; }}
      />
      {/* Card body */}
      <div className="nc-derived" style={{
        position: "relative", width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: "var(--color-surface)",
        border: `1.5px ${isFollowup ? "dashed" : "solid"} ${selected ? "#0A0A0A" : "var(--color-border, #E8E8E8)"}`,
        borderRadius: 12, overflow: "hidden",
        boxShadow: selected
          ? `${!isFollowup ? `inset 3px 0 0 ${typeColorHex}, ` : ""}0 0 0 3px rgba(228,255,151,0.65), 0 4px 20px rgba(0,0,0,0.1)`
          : `${!isFollowup ? `inset 3px 0 0 ${typeColorHex}, ` : ""}0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)`,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}>
        {/* Probability bar (scenario only) */}
        {isScenario && node.probability != null && (
          <div style={{ height: 3, background: `${typeColorHex}28`, flexShrink: 0 }}>
            {/* FIXED: EDGE-15 — Clamp probability to [0,1] */}
            <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, node.probability!)) * 100}%`, background: typeColorHex, transition: "width 0.3s" }} />
          </div>
        )}
        {/* Header */}
        <div
          onPointerDown={e => { e.stopPropagation(); onDragStart(e, node.id); }}
          style={{ height: 36, padding: "0 12px", cursor: "grab", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: `${typeColorHex}0C`, borderBottom: `1px solid ${typeColorHex}22`, borderTopLeftRadius: isScenario ? 0 : 11, borderTopRightRadius: 11 }}
        >
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
            color: typeColorHex, background: `${typeColorHex}14`, border: `1px solid ${typeColorHex}30`,
            borderRadius: 6, padding: "4px 10px",
          }}>{cfg.badge}</span>
          {isScenario && node.probability != null && (
            <span style={{ fontSize: 12, fontWeight: 700, color: typeColorHex, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(Math.max(0, Math.min(1, node.probability!)) * 100)}%
            </span>
          )}
          <div style={{ flex: 1 }} />
          {accentColorForStatus && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} title={NODE_STATUS_META[node.nodeStatus!].label} />}
          {(cardZoom === undefined || cardZoom >= 0.6) && (
            <CardActionsMenu
              nodeId={node.id}
              nodeType={node.nodeType}
              de={de}
              onDelete={onDelete}
              onSetStatus={onSetStatus}
              onAddTag={onAddTag}
              // Audit finding A2-H1: wire Follow-up into the three-
              // dot menu on derived cards. For follow-up / decision /
              // dimensions / causalgraph types we use the node's
              // queryText as prefill; for insight / scenario we use
              // its content. onFollowUp is optional so older callers
              // that don't pass it gracefully fall back to onExplore.
              onFollowUp={(id) => {
                const prefill = (node.queryText ?? node.content ?? "").trim();
                if (onFollowUp) onFollowUp(id, prefill);
                else onExplore(id, prefill);
              }}
              currentStatus={node.nodeStatus}
            />
          )}
        </div>
        {/* Content */}
        <div style={{ padding: "10px 12px 0", flex: 1, overflow: "hidden", position: "relative" }}>
          {isScenario && node.label && (
            <div style={{ fontSize: 12, fontWeight: 700, color: typeColorHex, marginBottom: 5, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {node.label}
            </div>
          )}
          <FormattedText
            text={isFollowup ? `→ ${node.content}` : node.content}
            fontSize={12} lineHeight={1.6} compact
            maxLines={Math.max(4, Math.floor((cardH - 80) / 19))}
          />
          {/* Driver pills (scenario only, max 2) */}
          {isScenario && node.keyDrivers && node.keyDrivers.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 7 }}>
              {node.keyDrivers.slice(0, 2).map((d, i) => (
                <span key={i} style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 20,
                  background: `${typeColorHex}12`, border: `1px solid ${typeColorHex}35`,
                  color: typeColorHex, fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110,
                }}>{d}</span>
              ))}
            </div>
          )}
          {/* Tag pills on card surface */}
          {node.tags && node.tags.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
              {node.tags.slice(0, 3).map((tag, i) => {
                const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                return (
                  <span key={i} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 10, background: `hsl(${hue}, 55%, 94%)`, border: `1px solid hsl(${hue}, 45%, 82%)`, color: `hsl(${hue}, 55%, 38%)`, fontWeight: 500, whiteSpace: "nowrap" }}>
                    {tag.length > 12 ? tag.slice(0, 12) + "…" : tag}
                  </span>
                );
              })}
              {node.tags.length > 3 && <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 500, alignSelf: "center" }}>+{node.tags.length - 3}</span>}
            </div>
          )}
          {/* Fade gradient */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 32, background: "linear-gradient(to bottom, transparent, var(--color-surface))", pointerEvents: "none" }} />
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? DERIVED_W, "both"); }}
          style={{ position: "absolute", right: 3, bottom: 3, width: 14, height: 14, cursor: "nwse-resize", zIndex: 11, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 2 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
            <path d="M2 9 L9 2 M5 9 L9 5 M8 9 L9 8" stroke="rgba(0,0,0,0.30)" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );

}
