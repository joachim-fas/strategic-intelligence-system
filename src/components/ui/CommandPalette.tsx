"use client";

/**
 * CommandPalette — the Cmd+K / Ctrl+K navigation overlay.
 *
 * Pattern borrowed structurally from Worldmonitor's command palette (see
 * 4-app deep-dive 2026-04-18). The command registry lives in
 * `@/lib/commands`; this component is the surface.
 *
 * Keyboard model:
 *   - Cmd+K / Ctrl+K anywhere on the page opens it.
 *   - Typing filters; matches are contains-tokens across label + keywords.
 *   - ↑ / ↓ navigate the highlighted row.
 *   - Enter runs the highlighted command. Esc or outside-click closes.
 *   - The palette is keyboard-first — no explicit close button inside the
 *     search row because Esc is universal and the cancel area is the
 *     backdrop itself.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/locale-context";
import { useTenant } from "@/lib/tenant-context";
import {
  COMMANDS,
  categoryLabel,
  matchesCommand,
  type CommandCategory,
  type CommandDescriptor,
} from "@/lib/commands";

export function CommandPalette() {
  const { t, locale } = useT();
  const { toggleLocale } = useLocale();
  const { isSystemAdmin } = useTenant();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter + group commands for the current query. `useMemo` because we
  // re-run this on every keystroke and the shape drives the whole render.
  const filteredByCategory = useMemo(() => {
    const filtered = COMMANDS.filter((c) => {
      if (c.systemAdminOnly && !isSystemAdmin) return false;
      return matchesCommand(c, query);
    });
    const groups = new Map<CommandCategory, CommandDescriptor[]>();
    for (const c of filtered) {
      const arr = groups.get(c.category) ?? [];
      arr.push(c);
      groups.set(c.category, arr);
    }
    return groups;
  }, [query, isSystemAdmin]);

  // Flatten the grouped view into the order the rows are rendered. Needed
  // so ↑/↓ can step through the list consistently regardless of grouping.
  const flatList = useMemo(() => {
    const order: CommandCategory[] = ["nav", "tenant", "actions", "admin"];
    const out: CommandDescriptor[] = [];
    for (const cat of order) {
      const cmds = filteredByCategory.get(cat);
      if (cmds) out.push(...cmds);
    }
    return out;
  }, [filteredByCategory]);

  // ── Global Cmd+K / Ctrl+K listener — attached once, not re-bound ──────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Skip if the user is typing into a contenteditable or input+shift
        // — though Cmd+K itself is rarely bound by other inputs.
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus the search input + reset state when the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Defer focus so the input is actually in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp the cursor if the filtered list shrinks below it.
  useEffect(() => {
    if (cursor >= flatList.length) setCursor(Math.max(0, flatList.length - 1));
  }, [flatList.length, cursor]);

  // Scroll the highlighted row into view when navigating with arrow keys.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${cursor}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  function runCommand(cmd: CommandDescriptor) {
    setOpen(false);
    cmd.run({
      navigate: (href) => router.push(href),
      toggleLocale,
      locale,
      dispatchEvent: (name, detail) =>
        window.dispatchEvent(new CustomEvent(name, { detail })),
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, flatList.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) =>
        (c - 1 + Math.max(1, flatList.length)) % Math.max(1, flatList.length),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatList[cursor];
      if (cmd) runCommand(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  if (!open) return null;

  // Render order: `nav` → `tenant` → `actions` → `admin`. Indices for the
  // keyboard cursor accumulate across sections so the arrow keys traverse
  // the whole list, not just one section.
  const sectionOrder: CommandCategory[] = ["nav", "tenant", "actions", "admin"];
  let globalIdx = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={locale === "de" ? "Befehlspalette" : "Command palette"}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: "12vh", padding: "12vh 16px 16px",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(10, 10, 10, 0.35)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Palette panel */}
      <div
        style={{
          position: "relative",
          width: "100%", maxWidth: 560,
          background: "var(--volt-surface-raised, #fff)",
          border: "1px solid var(--color-border, #E8E8E8)",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Search input */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--color-border, #E8E8E8)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span aria-hidden style={{ fontSize: 16, color: "var(--color-text-muted)" }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder={locale === "de"
              ? "Befehl oder Seite suchen…"
              : "Search commands or pages…"}
            aria-label={locale === "de" ? "Befehl suchen" : "Search command"}
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent",
              fontSize: 15, fontWeight: 500,
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              color: "var(--color-text-primary)",
            }}
          />
          <kbd style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 600,
            padding: "3px 7px", borderRadius: 5,
            background: "var(--color-surface-2, #F5F5F5)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border, #E8E8E8)",
          }}>ESC</kbd>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          style={{
            flex: 1, overflowY: "auto",
            padding: "6px 0",
          }}
        >
          {flatList.length === 0 && (
            <div style={{
              padding: "24px 18px",
              color: "var(--color-text-muted)",
              fontSize: 13, textAlign: "center" as const,
            }}>
              {locale === "de" ? "Keine Treffer." : "No matches."}
            </div>
          )}
          {sectionOrder.map((cat) => {
            const cmds = filteredByCategory.get(cat);
            if (!cmds || cmds.length === 0) return null;
            return (
              <div key={cat} style={{ padding: "4px 0 6px" }}>
                <div style={{
                  padding: "6px 18px 4px",
                  fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: "var(--color-text-faint, #AAA)",
                }}>
                  {categoryLabel(cat, locale)}
                </div>
                {cmds.map((cmd) => {
                  const idx = globalIdx++;
                  const active = idx === cursor;
                  return (
                    <button
                      key={cmd.id}
                      data-cmd-index={idx}
                      type="button"
                      onClick={() => runCommand(cmd)}
                      onMouseEnter={() => setCursor(idx)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        width: "100%",
                        padding: "9px 18px",
                        border: "none", background: active
                          ? "rgba(228,255,151,0.50)"
                          : "transparent",
                        textAlign: "left" as const,
                        cursor: "pointer",
                        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <span aria-hidden style={{
                        width: 22, textAlign: "center" as const,
                        fontSize: 14, color: "var(--color-text-muted)",
                        flexShrink: 0,
                      }}>{cmd.glyph ?? "·"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: "block",
                          fontSize: 14, fontWeight: 500,
                          color: "var(--color-text-primary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {locale === "de" ? cmd.labelDe : cmd.labelEn}
                        </span>
                        {(locale === "de" ? cmd.hintDe : cmd.hintEn) && (
                          <span style={{
                            display: "block",
                            fontSize: 11, color: "var(--color-text-muted)",
                            marginTop: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {locale === "de" ? cmd.hintDe : cmd.hintEn}
                          </span>
                        )}
                      </span>
                      {active && (
                        <kbd style={{
                          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                          fontSize: 10, fontWeight: 600,
                          padding: "2px 6px", borderRadius: 4,
                          background: "rgba(0,0,0,0.06)",
                          color: "var(--color-text-muted)",
                        }}>↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "8px 18px",
          borderTop: "1px solid var(--color-border, #E8E8E8)",
          background: "var(--color-surface-2, #FAFAFA)",
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, color: "var(--color-text-muted)",
          display: "flex", gap: 14, flexWrap: "wrap",
        }}>
          <span>↑↓ {t("common.next").toLowerCase()}</span>
          <span>↵ {locale === "de" ? "ausführen" : "run"}</span>
          <span>esc {locale === "de" ? "schließen" : "close"}</span>
          <span style={{ marginLeft: "auto" }}>
            {flatList.length} {locale === "de" ? "Treffer" : "results"}
          </span>
        </div>
      </div>
    </div>
  );
}

