/**
 * QueryNodeCard — the root card of every analysis. Handles three
 * status modes (loading, streaming, done/error), renders the live
 * streaming phase indicator, the synthesis preview, a causal
 * fingerprint row, signal sparkline, child-count summary, tag pills,
 * and the three-dot CardActionsMenu with a "copy synthesis" entry.
 *
 * Extracted from `page.tsx` as the final slice (4c) of the
 * canvas-decomposition task (18.04.2026 audit A5-H7). The
 * SignalSparkline helper was used only here and is co-located as a
 * private component in this file.
 */

"use client";

import React from "react";
import { useT } from "@/lib/locale-context";
import { CardActionsMenu } from "../CardActionsMenu";
import { FormattedText } from "../FormattedText";
import { NODE_STATUS_META, QUERY_NODE_W } from "../constants";
import { estimateQueryHeight, nodeAge } from "../utils";
import type { CardBaseProps, NodeStatus, QueryNode } from "../types";
import type { UsedSignal } from "@/types";

// ── SignalSparkline (mini timeline from signal dates) ─────────────

function SignalSparkline({
  signals,
  width = 80,
  height = 20,
}: {
  signals: UsedSignal[];
  width?: number;
  height?: number;
}) {
  const dated = signals.filter(s => s.date).map(s => new Date(s.date!).getTime()).sort();
  if (dated.length < 2) return null;
  const min = dated[0];
  const max = dated[dated.length - 1];
  const range = max - min || 1;
  const bins = new Array(8).fill(0);
  dated.forEach(d => { const idx = Math.min(7, Math.floor(((d - min) / range) * 8)); bins[idx]++; });
  const maxBin = Math.max(...bins, 1);
  const barW = (width - 2) / 8;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bins.map((v, i) => {
        const h = (v / maxBin) * (height - 2);
        return (
          <rect key={i} x={1 + i * barW} y={height - 1 - h} width={barW - 1} height={h}
            rx={1} fill="#2563EB" fillOpacity={0.15 + (v / maxBin) * 0.55} />
        );
      })}
    </svg>
  );
}

// ── QueryNodeCard ────────────────────────────────────────────────

interface QueryNodeCardProps extends CardBaseProps {
  node: QueryNode;
  de: boolean;
  onFollowUp: (id: string, prefill?: string) => void;
  onFollowUpQ: (id: string, q: string) => void;
  onToggleCollapse: (id: string) => void;
  onRefresh: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  causalFingerprint?: string[];
  /** Counts of derived children — fallback when synthesis is empty
   *  or zoom is too low for the full body. */
  childCounts?: { insights: number; scenarios: number; decisions: number; followups: number; causal: number };
  /** If this query shares text with siblings, 1,2,3… in createdAt
   *  order. 0/undefined means unique, no badge. */
  duplicateIndex?: number;
}

export function QueryNodeCard({
  node, de, selected, onSelect, onDragStart, onDelete, onResizeStart, onIterate: _onIterate, onPortDragStart, nodeW, dimmed, zoom: cardZoom, causalFingerprint, childCounts, duplicateIndex,
  // unused in compact view (handled by DetailPanel) — kept for API compatibility:
  onFollowUp: _onFollowUp, onFollowUpQ: _onFollowUpQ, onToggleCollapse: _onToggleCollapse, onRefresh: _onRefresh,
  onAddTag, onSetStatus,
}: QueryNodeCardProps) {
  const { t } = useT();
  const isLoading = node.status === "loading" || node.status === "streaming";
  const age = nodeAge(node.createdAt);
  const staleAccent = age === "stale" ? "#F5A623" : age === "aging" ? "rgba(245,166,35,0.5)" : null;
  const accentColorForStatus = node.nodeStatus && node.nodeStatus !== "open" ? NODE_STATUS_META[node.nodeStatus].color : null;

  if (cardZoom !== undefined && cardZoom < 0.45) {
    return (
      <div
        onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          position: "absolute", left: node.x, top: node.y, width: nodeW,
          height: 28, overflow: "hidden", background: "var(--color-surface)",
          border: `1px solid ${selected ? "#0A0A0A" : staleAccent ?? "var(--color-border)"}`,
          borderRadius: 8, userSelect: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
          opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s",
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: node.status === "done" ? "#1A9E5A" : node.status === "error" ? "#E8402A" : "#F5A623" }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.query}</span>
        {accentColorForStatus && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} />}
      </div>
    );
  }

  const queryTypeColor = "#E4FF97";
  const statusCls = !selected && (node.status === "streaming" || node.status === "loading") ? "nc-run"
    : !selected && node.status === "done" ? "nc-success"
    : !selected && node.status === "error" ? "nc-error"
    : "";
  const cardH = node.customHeight ?? estimateQueryHeight(node);

  return (
    // Wrapper: positioning + ports
    <div
      onPointerDown={e => { e.stopPropagation(); onSelect(node.id); }}
      style={{ position: "absolute", left: node.x, top: node.y, width: nodeW, height: cardH, overflow: "visible", userSelect: "none", cursor: "pointer", opacity: dimmed ? 0.18 : 1, transition: "opacity 0.2s" }}
    >
      {/* Left input port */}
      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--color-surface)", border: "2px solid rgba(0,0,0,0.35)", zIndex: 2, pointerEvents: "auto" }} />
      {/* Right output port */}
      <div
        onPointerDown={e => { e.stopPropagation(); onPortDragStart(e, node.id); }}
        title="→ Folgefrage / Vertiefung"
        style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", border: "2.5px solid #E4FF97", boxShadow: "0 0 8px rgba(228,255,151,0.6)", zIndex: 2, pointerEvents: "auto", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 14px rgba(228,255,151,0.9), 0 0 0 3px rgba(228,255,151,0.3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 8px rgba(228,255,151,0.6)"; }}
      />
      {/* Card body */}
      <div
        className={statusCls}
        style={{
          position: "relative", width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          background: "var(--color-surface)",
          border: `1.5px solid ${selected ? "#0A0A0A" : staleAccent ?? "var(--color-border, #E8E8E8)"}`,
          borderRadius: 12, overflow: "hidden",
          ...(selected ? { boxShadow: "0 0 0 3px rgba(228,255,151,0.65), 0 4px 20px rgba(0,0,0,0.1)" } :
            (!isLoading && node.status !== "done" && node.status !== "error") ? { boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.05)" } : {}),
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      >
        {/* Header */}
        <div
          onPointerDown={e => { e.stopPropagation(); onDragStart(e, node.id); }}
          style={{
            height: 44, padding: "0 14px", cursor: "grab", flexShrink: 0,
            background: isLoading ? "linear-gradient(90deg, rgba(228,255,151,0.10) 0%, rgba(0,0,0,0.04) 100%)" : "rgba(0,0,0,0.04)",
            borderBottom: "1px solid rgba(0,0,0,0.12)",
            borderTopLeftRadius: 11, borderTopRightRadius: 11,
            display: "flex", alignItems: "center", gap: 7,
          }}
        >
          <span style={{
            flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
            color: "#0A0A0A", background: queryTypeColor, border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 5, padding: "2px 7px",
          }}>QUERY</span>
          <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif", color: "var(--color-text-heading)", lineHeight: 1.3, letterSpacing: "-0.02em", display: "-webkit-box", WebkitLineClamp: cardZoom !== undefined && cardZoom < 0.6 ? 1 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {node.query}
          </p>
          {duplicateIndex !== undefined && duplicateIndex > 0 && (
            <span
              title={t("queryCard.duplicateTitle", { n: String(duplicateIndex) })}
              style={{
                flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.02em",
                fontFamily: "var(--font-code, 'JetBrains Mono'), monospace",
                color: "rgba(0,0,0,0.65)", background: "rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.12)", borderRadius: 5, padding: "2px 6px",
              }}
            >#{duplicateIndex}</span>
          )}
          {accentColorForStatus && <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColorForStatus, flexShrink: 0 }} title={NODE_STATUS_META[node.nodeStatus!].label} />}
          {(cardZoom === undefined || cardZoom >= 0.6) && (
            <CardActionsMenu
              nodeId={node.id}
              nodeType="query"
              de={de}
              onDelete={onDelete}
              onSetStatus={onSetStatus}
              onAddTag={onAddTag}
              onFollowUp={_onFollowUp}
              // Parity with DetailPanel footer: query cards now expose
              // a "Copy synthesis" shortcut straight from the card's
              // three-dot menu, not only from inside the detail panel.
              onCopy={node.synthesis ? () => {
                void navigator.clipboard.writeText(node.synthesis ?? "");
              } : undefined}
              currentStatus={node.nodeStatus}
            />
          )}
        </div>
        {/* Content */}
        <div style={{ padding: "12px 14px 0", flex: 1, overflow: "hidden", position: "relative" }}>
          {/* Full-body content — shown at zoom ≥ 0.6. Below that, the compact
              derivation summary takes over (see block below). The progressive
              collapse is: <0.45 strip · 0.45–0.6 derivation summary ·
              ≥0.6 full synthesis + signals + fingerprint + tags. */}
          {node.synthesis && (cardZoom === undefined || cardZoom >= 0.6) && (
            <>
              {/* Source attribution badges */}
              {node.result?.usedSignals && node.result.usedSignals.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }}>
                  {[...new Set(node.result.usedSignals.map(s => s.source))].slice(0, 5).map((src, i) => (
                    <span key={i} style={{
                      fontSize: 8, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                      background: "#2563EB08", border: "1px solid #2563EB20", color: "#2563EB",
                      fontFamily: "var(--font-code, monospace)", whiteSpace: "nowrap",
                    }}>{src}</span>
                  ))}
                  <span style={{ fontSize: 8, color: "var(--color-text-muted)", alignSelf: "center" }}>
                    {node.result.usedSignals.length} {t("queryCard.signalsLabel")}
                  </span>
                </div>
              )}
              <FormattedText text={node.synthesis ?? ""} fontSize={12.5} lineHeight={1.65} compact maxLines={Math.max(4, Math.floor(((node.customHeight ?? estimateQueryHeight(node)) - 140) / 20))} />
              {/* Causal fingerprint pills */}
              {causalFingerprint && causalFingerprint.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 8 }}>
                  <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.06em", marginRight: 2, alignSelf: "center" }}>⬡</span>
                  {causalFingerprint.map((t, i) => (
                    <span key={i} style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: "#1A9E5A10", border: "1px solid #1A9E5A30", color: "#1A9E5A", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {t.length > 18 ? t.slice(0, 18) + "…" : t}
                    </span>
                  ))}
                </div>
              )}
              {/* Signal sparkline — timeline of used signals */}
              {node.result?.usedSignals && node.result.usedSignals.length >= 2 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 7, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.06em" }}>SIGNALE</span>
                  <SignalSparkline signals={node.result.usedSignals} width={80} height={16} />
                </div>
              )}
              {/* Tag pills on card surface */}
              {node.tags && node.tags.length > 0 && (cardZoom === undefined || cardZoom >= 0.6) && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
                  {node.tags.slice(0, 3).map((tag, i) => {
                    const hue = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
                    return (
                      <span key={i} style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: `hsl(${hue}, 55%, 94%)`, border: `1px solid hsl(${hue}, 45%, 82%)`, color: `hsl(${hue}, 55%, 38%)`, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {tag.length > 14 ? tag.slice(0, 14) + "…" : tag}
                      </span>
                    );
                  })}
                  {node.tags.length > 3 && <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 500, alignSelf: "center" }}>+{node.tags.length - 3}</span>}
                </div>
              )}
              {/* Fade gradient at bottom to signal more content */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: "linear-gradient(to bottom, transparent, var(--color-surface))", pointerEvents: "none" }} />
            </>
          )}
          {/* Fallback derivation summary — shown when synthesis is empty/missing
              (so the card doesn't render as an empty 420×420 box). Covers two
              cases: (a) query has children but no saved synthesis yet; (b) zoom
              is below the synthesis threshold (≥0.6). */}
          {(!node.synthesis || (cardZoom !== undefined && cardZoom < 0.6)) && !isLoading && node.status !== "error" && childCounts && (childCounts.insights + childCounts.scenarios + childCounts.decisions + childCounts.followups + childCounts.causal) > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                {t("queryCard.derivedHeading")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {childCounts.insights > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(26,158,90,0.08)", color: "#1A9E5A", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.insights} {t("queryCard.insightsLabel")}
                  </span>
                )}
                {childCounts.scenarios > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(37,99,235,0.08)", color: "#2563EB", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.scenarios} {t("queryCard.scenariosLabel")}
                  </span>
                )}
                {childCounts.decisions > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(124,26,158,0.08)", color: "#7C1A9E", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.decisions} {t("queryCard.decisionsLabel")}
                  </span>
                )}
                {childCounts.followups > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(245,166,35,0.10)", color: "#955A20", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {childCounts.followups} {t("queryCard.followupsLabel")}
                  </span>
                )}
                {childCounts.causal > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(26,158,90,0.12)", color: "#1A9E5A", fontWeight: 600, whiteSpace: "nowrap", border: "1px solid rgba(26,158,90,0.25)" }}>
                    {t("queryCard.causalGraphLabel")}
                  </span>
                )}
              </div>
              {causalFingerprint && causalFingerprint.length > 0 && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.06em", marginRight: 2, alignSelf: "center" }}>⬡</span>
                  {causalFingerprint.map((t, i) => (
                    <span key={i} style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: "#1A9E5A10", border: "1px solid #1A9E5A30", color: "#1A9E5A", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {t.length > 18 ? t.slice(0, 18) + "…" : t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {isLoading && !node.synthesis && (() => {
            const phases = [
              t("queryCard.phaseReadSignals"),
              t("queryCard.phaseSynthesis"),
              t("queryCard.phaseCausalChains"),
              t("queryCard.phaseScenarios"),
              t("queryCard.phaseInsights"),
              t("queryCard.phaseFinishing"),
            ];
            const phase = node.streamingPhase ?? 0;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#F5A623", fontWeight: 500 }}>{phases[phase]}</span>
                <div style={{ flex: 1, height: 2, background: "var(--color-border)", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(phase / 5) * 100}%`, background: "#F5A623", borderRadius: 1, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })()}
          {node.status === "error" && <span style={{ fontSize: 11, color: "#E8402A" }}>⚠ {node.errorMsg?.slice(0, 60) ?? "Fehler"}</span>}
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e, node.id, nodeW, node.customHeight ?? QUERY_NODE_W, "both"); }}
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
