/**
 * StatusIcon — tiny status indicator used in the card face, the
 * DetailPanel footer, and the CardActionsMenu.
 *
 * Extracted from `page.tsx` as part of canvas-decomposition slice 2
 * (18.04.2026 audit A5-H7). Pure presentation — no state, no refs,
 * no effects.
 */

import React from "react";
import { Circle, Zap, CheckCircle2, Pin } from "lucide-react";
import { NODE_STATUS_META } from "./constants";
import type { NodeStatus } from "./types";

export function StatusIcon({ status, size = 12 }: { status: NodeStatus; size?: number }) {
  const color = NODE_STATUS_META[status].color;
  const s: React.CSSProperties = { color, flexShrink: 0 };
  switch (status) {
    case "open":
      return <Circle size={size} style={s} />;
    case "active":
      return <Zap size={size} style={s} />;
    case "decided":
      return <CheckCircle2 size={size} style={s} />;
    case "pinned":
      return <Pin size={size} style={s} />;
  }
}
