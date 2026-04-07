"use client";

import { useState } from "react";
import { Locale } from "@/lib/i18n";

export function EigenerGedanke({ locale, context, onSubmit }: {
  locale: Locale;
  context: { query: string; synthesis: string; scenarios?: any[]; causalChain?: string[] };
  onSubmit: (query: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const de = locale === "de";

  const handleSubmit = () => {
    if (!text.trim()) return;
    const scenarioNames = context.scenarios?.map((s: any) => s.name).join(", ") || "";
    const prompt = de
      ? `Meine These/Gedanke: "${text.trim()}"

Kontext aus vorheriger Analyse zu "${context.query}":
Synthesis (Auszug): ${context.synthesis.slice(0, 300)}...
${scenarioNames ? `Szenarien: ${scenarioNames}` : ""}
${context.causalChain?.length ? `Kausalketten: ${context.causalChain.slice(0, 3).join(" | ")}` : ""}

Bewerte meinen Gedanken kritisch: Wo hat er recht, wo liegt er falsch? Welche Daten stützen oder widerlegen ihn? Was übersehe ich?`
      : `My hypothesis/thought: "${text.trim()}"

Context from previous analysis on "${context.query}":
Synthesis (excerpt): ${context.synthesis.slice(0, 300)}...
${scenarioNames ? `Scenarios: ${scenarioNames}` : ""}
${context.causalChain?.length ? `Causal chains: ${context.causalChain.slice(0, 3).join(" | ")}` : ""}

Critically evaluate my thought: Where is it right, where is it wrong? What data supports or refutes it? What am I missing?`;

    onSubmit(prompt);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          border: "1px dashed #DEDEDE", borderRadius: 8, background: "transparent",
          cursor: "pointer", width: "100%", textAlign: "left", transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--volt-lime, #E4FF97)";
          (e.currentTarget as HTMLElement).style.background = "var(--volt-surface-raised, #FDFFF5)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#DEDEDE";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span style={{ fontSize: 14, color: "var(--volt-text-faint, #BDBDBD)" }}>✏</span>
        <span style={{ fontSize: 12, color: "var(--volt-text-faint, #9B9B9B)" }}>
          {de ? "Eigenen Gedanken einbringen…" : "Add your own thought…"}
        </span>
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid var(--volt-lime, #E4FF97)", borderRadius: 8, overflow: "hidden", background: "var(--volt-surface-raised, #FDFFF5)" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--volt-lime, #E4FF97)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--volt-text, #0A0A0A)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {de ? "Eigener Gedanke" : "Your thought"}
        </span>
        <span style={{ fontSize: 11, color: "var(--volt-text-muted, #6B6B6B)", fontWeight: 400 }}>
          {de ? "— wird kritisch gegen die Analyse geprüft" : "— critically tested against the analysis"}
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--volt-text-faint, #9B9B9B)", fontSize: 14, lineHeight: 1 }}
        >✕</button>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleSubmit(); }}
        placeholder={de
          ? "Deine These, Hypothese oder Einschätzung… (⌘↵ zum Absenden)"
          : "Your thesis, hypothesis, or perspective… (⌘↵ to submit)"}
        style={{
          width: "100%", border: "none", outline: "none", resize: "none",
          padding: "12px", fontSize: 14, lineHeight: 1.6, color: "var(--volt-text, #0A0A0A)",
          background: "transparent", fontFamily: "var(--font-sans)",
          minHeight: 80, boxSizing: "border-box",
        }}
      />
      <div style={{ padding: "8px 12px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--volt-lime, #E4FF97)" }}>
        <button
          onClick={() => { setOpen(false); setText(""); }}
          style={{ fontSize: 12, color: "var(--volt-text-faint, #9B9B9B)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
        >
          {de ? "Abbrechen" : "Cancel"}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={{
            fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6,
            background: text.trim() ? "var(--volt-text, #0A0A0A)" : "var(--volt-border, #E8E8E8)",
            color: text.trim() ? "var(--volt-lime, #E4FF97)" : "var(--volt-text-faint, #9B9B9B)",
            border: "none", cursor: text.trim() ? "pointer" : "default", transition: "all 0.15s",
          }}
        >
          {de ? "Einbringen →" : "Submit →"}
        </button>
      </div>
    </div>
  );
}
