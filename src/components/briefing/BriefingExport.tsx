"use client";

import { useState } from "react";
import { Check, Upload, Clipboard, Download, FileCode2 } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { Locale } from "@/lib/i18n";
import type { HistoryEntry } from "./BriefingResult";
import {
  copyBriefingToClipboard,
  downloadBriefingMarkdown,
  downloadBriefingJSON,
} from "@/lib/briefing-export";

export function BriefingExport({ entry, locale }: { entry: HistoryEntry; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const de = locale === "de";

  const handleCopy = async () => {
    await copyBriefingToClipboard(entry, locale);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  const handleDownloadMd = () => {
    downloadBriefingMarkdown(entry, locale);
    setOpen(false);
  };

  const handleDownloadJson = () => {
    downloadBriefingJSON(entry);
    setOpen(false);
  };

  const buttonBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "8px 12px",
    border: "none", background: "transparent", cursor: "pointer",
    fontFamily: "var(--font-ui)",
    fontSize: 13, color: "var(--color-text-secondary)",
    textAlign: "left", borderRadius: "var(--radius-sm)",
    transition: "background 0.1s",
  };

  const iconStyle: React.CSSProperties = {
    width: 16, display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "var(--color-text-muted)",
    flexShrink: 0,
  };

  return (
    <div style={{ position: "relative" }}>
      <Tooltip content={copied ? (de ? "In Zwischenablage kopiert" : "Copied to clipboard") : (de ? "Briefing exportieren (Markdown, JSON)" : "Export briefing (Markdown, JSON)")} placement="bottom">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={de ? "Exportieren" : "Export"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            height: 28,
            padding: "0 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: open ? "var(--color-surface-2)" : "transparent",
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: copied ? "#1A9E5A" : "var(--color-text-muted)",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-brand)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
        >
          {copied ? <Check size={13} strokeWidth={2.5} /> : <Upload size={13} strokeWidth={2} />}
          <span>{copied ? (de ? "Kopiert" : "Copied") : (de ? "Export" : "Export")}</span>
        </button>
      </Tooltip>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            minWidth: 220,
            overflow: "hidden",
            fontFamily: "var(--font-ui)",
          }}>
            <div style={{
              padding: "6px 12px 4px",
              fontFamily: "var(--font-mono)",
              fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--color-text-muted)",
            }}>
              {de ? "Diese Analyse" : "This analysis"}
            </div>
            <button
              style={buttonBase}
              onClick={handleCopy}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <span style={iconStyle}><Clipboard size={14} strokeWidth={2} /></span>
              <span>{de ? "Markdown kopieren" : "Copy as Markdown"}</span>
            </button>
            <button
              style={buttonBase}
              onClick={handleDownloadMd}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <span style={iconStyle}><Download size={14} strokeWidth={2} /></span>
              <span>{de ? "Als .md speichern" : "Save as .md"}</span>
            </button>
            <button
              style={buttonBase}
              onClick={handleDownloadJson}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <span style={iconStyle}><FileCode2 size={14} strokeWidth={2} /></span>
              <span>{de ? "Als .json speichern" : "Save as .json"}</span>
            </button>
            <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
            <div style={{ padding: "4px 12px 6px", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              {de
                ? "Weiterverarbeiten in Notion, Obsidian, Word…"
                : "Use in Notion, Obsidian, Word…"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
