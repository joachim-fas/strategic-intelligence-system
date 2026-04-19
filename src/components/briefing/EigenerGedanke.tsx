"use client";

import { useState } from "react";
import { Pencil, X, ArrowRight } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { Locale } from "@/lib/i18n";
import { useT } from "@/lib/locale-context";

export function EigenerGedanke({ locale, context, onSubmit }: {
  locale: Locale;
  context: { query: string; synthesis: string; scenarios?: any[]; causalChain?: string[] };
  onSubmit: (query: string) => void;
}) {
  const { t } = useT();
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
      <Tooltip content={t("ownThought.openTooltip")} placement="top">
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            border: "1px dashed var(--volt-border, #DEDEDE)", borderRadius: 8, background: "transparent",
            cursor: "pointer", width: "100%", textAlign: "left", transition: "all 0.15s",
            fontFamily: "var(--font-ui)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--volt-lime, #E4FF97)";
            (e.currentTarget as HTMLElement).style.background = "var(--volt-surface-raised, #FDFFF5)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--volt-border, #DEDEDE)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <Pencil size={13} color="var(--volt-text-faint, #BDBDBD)" strokeWidth={2} />
          <span style={{ fontSize: 12, color: "var(--volt-text-faint, #9B9B9B)", fontFamily: "var(--font-ui)" }}>
            {t("ownThought.openButton")}
          </span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div style={{ border: "1px solid var(--volt-lime, #E4FF97)", borderRadius: 8, overflow: "hidden", background: "var(--volt-surface-raised, #FDFFF5)", fontFamily: "var(--font-ui)" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--volt-lime, #E4FF97)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--volt-text, #0A0A0A)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {t("ownThought.heading")}
        </span>
        <span style={{ fontSize: 11, color: "var(--volt-text-muted, #6B6B6B)", fontWeight: 400, fontFamily: "var(--font-ui)" }}>
          {t("ownThought.subheading")}
        </span>
        <Tooltip content={t("ownThought.close")} placement="top">
          <button
            onClick={() => setOpen(false)}
            aria-label={t("ownThought.close")}
            style={{
              marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
              color: "var(--volt-text-faint, #9B9B9B)",
              width: 22, height: 22, borderRadius: 6,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={13} strokeWidth={2} /></button>
        </Tooltip>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleSubmit(); }}
        placeholder={t("ownThought.placeholder")}
        style={{
          width: "100%", border: "none", outline: "none", resize: "none",
          padding: "12px", fontSize: 14, lineHeight: 1.6, color: "var(--volt-text, #0A0A0A)",
          background: "transparent", fontFamily: "var(--font-ui)",
          minHeight: 80, boxSizing: "border-box",
        }}
      />
      <div style={{ padding: "8px 12px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--volt-lime, #E4FF97)" }}>
        <button
          onClick={() => { setOpen(false); setText(""); }}
          style={{
            fontSize: 12, color: "var(--volt-text-faint, #9B9B9B)",
            background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
            fontFamily: "var(--font-ui)",
          }}
        >
          {t("ownThought.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-ui)",
            fontSize: 12, fontWeight: 600,
            height: 30, padding: "0 14px", borderRadius: 6,
            background: text.trim() ? "var(--volt-text, #0A0A0A)" : "var(--volt-border, #E8E8E8)",
            color: text.trim() ? "var(--volt-lime, #E4FF97)" : "var(--volt-text-faint, #9B9B9B)",
            border: "none", cursor: text.trim() ? "pointer" : "default", transition: "all 0.15s",
          }}
        >
          {t("ownThought.submit")}
          <ArrowRight size={13} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
