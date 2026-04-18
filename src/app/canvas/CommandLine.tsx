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
  const inputRef = useRef<HTMLInputElement>(null);
  const de = locale === "de";

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  useEffect(() => { setValue(prefill ?? ""); }, [prefill]);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setValue("");
  };

  const SLASH_COMMANDS = [
    { cmd: '/trend', desc: de ? 'Trend analysieren' : 'Analyze trend' },
    { cmd: '/scenario', desc: de ? 'Szenarien entwickeln' : 'Develop scenarios' },
    { cmd: '/signal', desc: de ? 'Schwache Signale finden' : 'Find weak signals' },
    { cmd: '/clear', desc: de ? 'Canvas leeren' : 'Clear canvas' },
    { cmd: '/export', desc: de ? 'Als Markdown exportieren' : 'Export as Markdown' },
  ];
  const showSlashHints = value.startsWith('/') && value.length < 12;
  const filteredSlash = showSlashHints
    ? SLASH_COMMANDS.filter(c => c.cmd.startsWith(value.toLowerCase().split(' ')[0]))
    : [];

  return (
    <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {contextLabel && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 20, padding: "3px 12px", maxWidth: 460, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ↳ {de ? "Folge-Analyse:" : "Follow-up on:"} <em>{contextLabel}</em>
        </div>
      )}
      <div style={{ position: "relative", width: 520, maxWidth: "90vw" }}>
        {showSlashHints && filteredSlash.length > 0 && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, background: 'var(--color-surface, rgba(255,255,255,0.98))', border: '1px solid var(--color-border, #ddd)', borderRadius: 10, padding: '8px 10px', fontSize: 12, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{de ? 'Befehle' : 'Commands'}:</div>
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
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
            placeholder={de ? "Frage, Thema oder /befehl…" : "Question, topic or /command…"}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, color: "var(--color-text-primary)", fontFamily: "inherit" }}
          />
          <button onClick={submit} style={{ flexShrink: 0, padding: "6px 16px", borderRadius: 8, background: "#E4FF97", border: "1px solid rgba(0,0,0,0.1)", color: "#0A0A0A", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {de ? "Analysieren" : "Analyze"} ↵
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
        Esc {de ? "schließen" : "to close"} · ↵ {de ? "ausführen" : "to run"} · / {de ? "Befehle" : "commands"}
      </div>
    </div>
  );
}
