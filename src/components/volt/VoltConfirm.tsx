"use client";

/**
 * VoltConfirm — App-eigener Bestaetigungs-Dialog statt nativem window.confirm.
 *
 * Problem: window.confirm() oeffnet den OS-nativen Dialog — der haelt sich
 * nicht an Volt-Typografie, Farben oder Spacing. Das bricht die visuelle
 * Kohaerenz genau im kritischen Moment (destruktive Aktion).
 *
 * Loesung: duenner Wrapper um VoltModal mit standardisierten OK/Cancel-
 * Buttons, Escape/Outside-Click zum Abbrechen und optionaler "destructive"-
 * Variante (roter Primary-Button fuer Loesch-Aktionen).
 *
 * Nutzung deklarativ (bevorzugt):
 *
 *   const [confirm, setConfirm] = useState<{ title, body } | null>(null);
 *   ...
 *   <VoltConfirm
 *     open={!!confirm}
 *     title={confirm?.title ?? ""}
 *     message={confirm?.body ?? ""}
 *     confirmLabel="Loeschen"
 *     variant="destructive"
 *     onConfirm={() => { deleteIt(); setConfirm(null); }}
 *     onCancel={() => setConfirm(null)}
 *   />
 *
 * Oder imperativ per Promise (naeher an window.confirm):
 *
 *   const ok = await voltConfirm({ title, message, variant: "destructive" });
 *   if (!ok) return;
 *
 * Der imperative Pfad arbeitet ueber einen globalen Portal-Container —
 * keine Provider-Setup noetig, wie window.confirm.
 */

import React, { useState, useEffect, useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VoltModal } from "./VoltModal";

export type VoltConfirmVariant = "default" | "destructive";

export interface VoltConfirmProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: VoltConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function VoltConfirm({
  open,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Abbrechen",
  variant = "default",
  onConfirm,
  onCancel,
}: VoltConfirmProps) {
  // Enter triggers confirm, Escape is already handled by VoltModal (cancel).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onConfirm]);

  const confirmBg = variant === "destructive" ? "#E8402A" : "#0A0A0A";
  const confirmBgHover = variant === "destructive" ? "#C43220" : "#1F1F1F";

  return (
    <VoltModal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              fontSize: 13, fontWeight: 500,
              padding: "7px 16px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            style={{
              fontSize: 13, fontWeight: 600,
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              background: confirmBg,
              color: "#fff",
              cursor: "pointer",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              transition: "background-color 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = confirmBgHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = confirmBg; }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {message && (
        <div style={{
          fontSize: 14, lineHeight: 1.55,
          color: "var(--color-text-secondary)",
          fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
          whiteSpace: "pre-wrap" as const,
        }}>
          {message}
        </div>
      )}
    </VoltModal>
  );
}

// ── Imperativer Pfad ─────────────────────────────────────────────────────
// `voltConfirm()` arbeitet wie window.confirm() — Promise<boolean> zurueck,
// true bei Bestaetigung, false bei Abbruch. Container wird einmalig im
// document.body erzeugt und pro Aufruf neu gerendert.

let containerRoot: Root | null = null;
let containerEl: HTMLDivElement | null = null;

function ensureContainer(): Root {
  if (containerRoot && containerEl) return containerRoot;
  containerEl = document.createElement("div");
  containerEl.setAttribute("data-volt-confirm-root", "");
  document.body.appendChild(containerEl);
  containerRoot = createRoot(containerEl);
  return containerRoot;
}

export function voltConfirm(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: VoltConfirmVariant;
}): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const root = ensureContainer();
  return new Promise<boolean>((resolve) => {
    function ConfirmHost() {
      const [open, setOpen] = useState(true);
      const handle = useCallback((ok: boolean) => {
        setOpen(false);
        // Delay unmount so the exit animation plays.
        setTimeout(() => {
          root.render(<React.Fragment />);
          resolve(ok);
        }, 220);
      }, []);
      return (
        <VoltConfirm
          open={open}
          title={opts.title}
          message={opts.message}
          confirmLabel={opts.confirmLabel}
          cancelLabel={opts.cancelLabel}
          variant={opts.variant}
          onConfirm={() => handle(true)}
          onCancel={() => handle(false)}
        />
      );
    }
    root.render(<ConfirmHost />);
  });
}
