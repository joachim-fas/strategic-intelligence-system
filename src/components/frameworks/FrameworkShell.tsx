"use client";

// TODO: UX-16 — Color contrast issues: pastel badges, light gray text fail WCAG AA (4.5:1).
// FIX: Run contrast audit, darken light text, increase badge text contrast.

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { FrameworkMeta } from "@/types/frameworks";

interface FrameworkShellProps {
  meta: FrameworkMeta;
  children: (props: { topic: string; locale: string; de: boolean }) => React.ReactNode;
}

export function FrameworkShell({ meta, children }: FrameworkShellProps) {
  const { locale } = useLocale();
  const de = locale === "de";
  const [topic, setTopic] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const name = de ? meta.name.de : meta.name.en;
  const subtitle = de ? meta.subtitle.de : meta.subtitle.en;

  const handleSubmit = () => {
    if (topic.trim()) setActiveTopic(topic.trim());
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <AppHeader />

      {/* Framework Header */}
      <div style={{
        background: meta.color.card,
        borderBottom: `1px solid ${meta.color.border}`,
        padding: "24px 24px 20px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Breadcrumb */}
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>SIS</Link>
            <span style={{ opacity: 0.4 }}>/</span>
            <Link href="/frameworks" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
              {de ? "Frameworks" : "Frameworks"}
            </Link>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: meta.color.accent, fontWeight: 600 }}>{name}</span>
          </div>

          {/* Title Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 10,
              background: meta.color.icon,
              border: `1px solid ${meta.color.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Image src={meta.iconSvg} alt="" width={20} height={20} style={{ opacity: 0.8 }} />
            </span>
            <div>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
                color: "var(--color-text-heading)",
                margin: 0, lineHeight: 1.2,
              }}>
                {name}
              </h1>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, marginTop: 2 }}>
                {subtitle}
              </p>
            </div>
          </div>

          {/* Topic Input */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, maxWidth: 640 }}>
            <input
              ref={inputRef}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              placeholder={de ? "Thema eingeben — z.B. \"KI im Gesundheitswesen\"" : "Enter topic — e.g. \"AI in Healthcare\""}
              style={{
                flex: 1, height: 42, padding: "0 14px",
                fontSize: 14, fontFamily: "var(--font-ui)",
                border: `1.5px solid ${meta.color.border}`,
                borderRadius: 10, background: "var(--background)",
                color: "var(--foreground)",
                outline: "none",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = meta.color.accent; }}
              onBlur={e => { e.currentTarget.style.borderColor = meta.color.border; }}
            />
            <button
              onClick={handleSubmit}
              disabled={!topic.trim()}
              style={{
                height: 42, padding: "0 20px",
                fontSize: 13, fontWeight: 600,
                fontFamily: "var(--font-ui)",
                borderRadius: 10, border: "none",
                background: topic.trim() ? meta.color.accent : "var(--border)",
                color: topic.trim() ? "#fff" : "var(--muted-foreground)",
                cursor: topic.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {de ? "Analysieren" : "Analyze"} →
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "24px" }}>
        {activeTopic ? (
          children({ topic: activeTopic, locale, de })
        ) : (
          <EmptyState meta={meta} de={de} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ meta, de }: { meta: FrameworkMeta; de: boolean }) {
  const timeHorizon = de ? meta.timeHorizon.de : meta.timeHorizon.en;
  const intensity = { low: "Niedrig", medium: "Mittel", high: "Hoch", "very-high": "Sehr hoch" };
  const intensityEn = { low: "Low", medium: "Medium", high: "High", "very-high": "Very high" };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 300, textAlign: "center", padding: 40,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: meta.color.icon,
        border: `1px solid ${meta.color.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}>
        <Image src={meta.iconSvg} alt="" width={28} height={28} style={{ opacity: 0.7 }} />
      </div>
      <h2 style={{
        fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
        color: "var(--color-text-heading)", marginBottom: 8,
      }}>
        {de ? `${meta.name.de} starten` : `Start ${meta.name.en}`}
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 400, lineHeight: 1.6 }}>
        {de
          ? "Gib oben ein Thema ein, um die Analyse zu starten. Das Framework führt dich Schritt für Schritt durch die Analyse."
          : "Enter a topic above to start the analysis. The framework guides you through each step."
        }
      </p>
      <div style={{
        display: "flex", gap: 16, marginTop: 20,
        fontSize: 11, color: "var(--color-text-muted)",
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        <span>{de ? "Zeithorizont" : "Horizon"}: {timeHorizon}</span>
        <span>|</span>
        <span>LLM: {de ? intensity[meta.llmIntensity] : intensityEn[meta.llmIntensity]}</span>
      </div>
    </div>
  );
}
