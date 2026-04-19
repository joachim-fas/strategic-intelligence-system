/**
 * CommandLine — the floating chat-bar input at the bottom of the
 * canvas used to start a new analysis or add a note.
 *
 * Stateless w.r.t. canvas data: receives a `prefill` initial string,
 * emits `onSubmit(query)` when the user hits Enter, and `onClose()`
 * when Escape or outside-click dismisses it. Owns only the local
 * input draft + textarea ref.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work.
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import BlockCursor from "@/components/common/BlockCursor";

export function CommandLine({
  onSubmit, onClose, locale, prefill, contextLabel,
}: {
  onSubmit: (q: string) => void;
  onClose: () => void;
  locale: "de" | "en";
  prefill?: string;
  contextLabel?: string;
}) {
  const [value, setValue] = useState(prefill ?? "");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tl = (key: TranslationKey) => translate(locale as Locale, key);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); setFocused(true); }, []);
  useEffect(() => { setValue(prefill ?? ""); }, [prefill]);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setValue("");
  };

  const SLASH_COMMANDS = [
    { cmd: '/trend',    desc: tl('commandLine.slashTrend')    },
    { cmd: '/scenario', desc: tl('commandLine.slashScenario') },
    { cmd: '/signal',   desc: tl('commandLine.slashSignal')   },
    { cmd: '/clear',    desc: tl('commandLine.slashClear')    },
    { cmd: '/export',   desc: tl('commandLine.slashExport')   },
  ];
  const showSlashHints = value.startsWith('/') && value.length < 12;
  const filteredSlash = showSlashHints
    ? SLASH_COMMANDS.filter(c => c.cmd.startsWith(value.toLowerCase().split(' ')[0]))
    : [];

  return (
    <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {contextLabel && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 20, padding: "3px 12px", maxWidth: 460, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ↳ {tl("commandLine.followUpOn")} <em>{contextLabel}</em>
        </div>
      )}
      <div style={{ position: "relative", width: 520, maxWidth: "90vw" }}>
        {showSlashHints && filteredSlash.length > 0 && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, background: 'var(--color-surface, rgba(255,255,255,0.98))', border: '1px solid var(--color-border, #ddd)', borderRadius: 10, padding: '8px 10px', fontSize: 12, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tl('commandLine.slashHintsHeading')}:</div>
            {filteredSlash.map(c => (
              <div key={c.cmd}
                onClick={() => { setValue(c.cmd + ' '); inputRef.current?.focus(); }}
                style={{ padding: '3px 4px', color: 'var(--color-text-secondary)', cursor: 'pointer', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-page-bg, #f5f5f5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontWeight: 700, fontFamily: "var(--font-code, 'JetBrains Mono'), monospace", color: 'var(--color-text-heading)' }}>{c.cmd}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{c.desc}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "2px solid #0A0A0A", borderRadius: 14, padding: "8px 10px 8px 14px", boxShadow: "0 12px 48px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)" }}>
          <span style={{ fontSize: 15, color: "var(--color-text-muted)", flexShrink: 0 }}>⌕</span>
          {/*
            Wrapper for the BlockCursor (DOS-style terminal cursor with
            invert-glyph, matching the hero Home search and the framework
            topic inputs). position:relative is required so the cursor's
            absolute-positioned block can sit precisely over the caret.
          */}
          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={tl("commandLine.placeholder")}
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none",
                fontSize: 15, color: "var(--color-text-primary)", fontFamily: "inherit",
                // Hide the thin native caret — BlockCursor owns the visible cursor.
                caretColor: "transparent",
              }}
            />
            <BlockCursor
              targetRef={inputRef}
              value={value}
              focused={focused}
              color="#E4FF97"
              // Glyph behält seine normale Textfarbe (Default des
              // BlockCursors = computed color des Inputs). Der lime
              // Block ist reiner Highlight-Hintergrund; der Buchstabe
              // bleibt lesbar, ohne negativ zu werden.
            />
          </div>
          <button onClick={submit} style={{ flexShrink: 0, padding: "6px 16px", borderRadius: 8, background: "#E4FF97", border: "1px solid rgba(0,0,0,0.1)", color: "#0A0A0A", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {tl("commandLine.analyze")} ↵
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
        Esc {tl("commandLine.footerEsc")} · ↵ {tl("commandLine.footerRun")} · / {tl("commandLine.footerCommands")}
      </div>
    </div>
  );
}
