/**
 * TagInlineInput — reusable inline tag adder for detail panels.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice 2
 * (18.04.2026 audit A5-H7). Local state only; parent owns the tag
 * list and handles deduplication.
 */

import { useState } from "react";

export function TagInlineInput({
  nodeId,
  de,
  onAddTag,
}: {
  nodeId: string;
  de: boolean;
  onAddTag: (id: string, tag: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAddTag(nodeId, value);
            setValue("");
          }
        }}
        placeholder={de ? "Neuen Tag eingeben…" : "Add new tag…"}
        style={{
          flex: 1,
          fontSize: 12,
          padding: "4px 10px",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          outline: "none",
        }}
      />
      <button
        onClick={() => {
          if (value.trim()) {
            onAddTag(nodeId, value);
            setValue("");
          }
        }}
        disabled={!value.trim()}
        style={{
          fontSize: 11,
          padding: "4px 10px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: value.trim() ? "#E4FF97" : "transparent",
          color: value.trim() ? "#0A0A0A" : "var(--color-text-muted)",
          cursor: value.trim() ? "pointer" : "default",
          fontWeight: 600,
        }}
      >
        {de ? "Hinzufügen" : "Add"}
      </button>
    </div>
  );
}
