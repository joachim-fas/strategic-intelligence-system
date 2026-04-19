/**
 * CardActionsMenu — three-dot dropdown rendered on every canvas node
 * card. Exposes Follow-up (query nodes), Copy synthesis (query nodes
 * with text), Status toggle, Tag add, Delete.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice 2
 * (18.04.2026 audit A5-H7). Local state only — the dropdown's open/
 * close is handled by the Volt dropdown primitive.
 */

import { useState } from "react";
import { MoreHorizontal, MessageSquarePlus, Copy, TagIcon, Trash2 } from "lucide-react";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import {
  VoltDropdownMenu,
  VoltDropdownMenuTrigger,
  VoltDropdownMenuContent,
  VoltDropdownMenuItem,
  VoltDropdownMenuSeparator,
  VoltDropdownMenuLabel,
} from "@/components/volt/VoltDropdownMenu";
import { StatusIcon } from "./StatusIcon";
import { NODE_STATUS_META } from "./constants";
import type { NodeStatus } from "./types";

export function CardActionsMenu({
  nodeId,
  nodeType: _nodeType,
  de,
  onDelete,
  onSetStatus,
  onAddTag,
  onFollowUp,
  onCopy,
  currentStatus,
}: {
  nodeId: string;
  nodeType: string;
  de: boolean;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onAddTag: (id: string, tag: string) => void;
  onFollowUp?: (id: string, prefill?: string) => void;
  /** When provided, adds a "Copy" entry next to "Follow-up". Used on
   *  query cards so the three-dot menu matches the DetailPanel footer. */
  onCopy?: (id: string) => void;
  currentStatus?: NodeStatus;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  // Local translator — `de` is a prop (card menu is used inside
  // many different parent components).
  const locale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(locale, key);

  return (
    <VoltDropdownMenu>
      <VoltDropdownMenuTrigger asChild>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </VoltDropdownMenuTrigger>
      <VoltDropdownMenuContent align="end" side="bottom" className="min-w-[180px]">
        <VoltDropdownMenuLabel>{tl("cardActions.actionsHeading")}</VoltDropdownMenuLabel>
        {onFollowUp && (
          <VoltDropdownMenuItem onClick={() => onFollowUp(nodeId)}>
            <MessageSquarePlus size={14} />
            {tl("cardActions.followUp")}
          </VoltDropdownMenuItem>
        )}
        {onCopy && (
          <VoltDropdownMenuItem onClick={() => onCopy(nodeId)}>
            <Copy size={14} />
            {tl("cardActions.copySynthesis")}
          </VoltDropdownMenuItem>
        )}
        <VoltDropdownMenuSeparator />
        <VoltDropdownMenuLabel>{tl("cardActions.statusHeading")}</VoltDropdownMenuLabel>
        {(["open", "active", "decided", "pinned"] as NodeStatus[]).map((s) => (
          <VoltDropdownMenuItem key={s} onClick={() => onSetStatus(nodeId, s)}>
            <StatusIcon status={s} size={14} />
            <span style={{ flex: 1 }}>{NODE_STATUS_META[s].label}</span>
            {currentStatus === s && (
              <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>●</span>
            )}
          </VoltDropdownMenuItem>
        ))}
        <VoltDropdownMenuSeparator />
        {!showTagInput ? (
          <VoltDropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setShowTagInput(true);
            }}
          >
            <TagIcon size={14} />
            {tl("cardActions.addTag")}
          </VoltDropdownMenuItem>
        ) : (
          <div
            style={{ padding: "4px 8px" }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  onAddTag(nodeId, tagInput);
                  setTagInput("");
                  setShowTagInput(false);
                }
                if (e.key === "Escape") setShowTagInput(false);
              }}
              placeholder={tl("cardActions.tagPlaceholder")}
              style={{
                width: "100%",
                fontSize: 12,
                padding: "4px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
        )}
        <VoltDropdownMenuSeparator />
        <VoltDropdownMenuItem variant="destructive" onClick={() => onDelete(nodeId)}>
          <Trash2 size={14} />
          {tl("cardActions.delete")}
        </VoltDropdownMenuItem>
      </VoltDropdownMenuContent>
    </VoltDropdownMenu>
  );
}
