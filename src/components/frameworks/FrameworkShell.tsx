"use client";


import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AppHeader } from "@/components/AppHeader";
import { useLocale, useT } from "@/lib/locale-context";
import { FrameworkMeta } from "@/types/frameworks";
import BlockCursor from "@/components/common/BlockCursor";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface FrameworkShellProps {
  meta: FrameworkMeta;
  children: (props: { topic: string; locale: string; de: boolean; projectId?: string | null }) => React.ReactNode;
}

export function FrameworkShell({ meta, children }: FrameworkShellProps) {
  const { locale } = useLocale();
  const { t } = useT();
  const de = locale === "de";
  const [topic, setTopic] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [topicFocused, setTopicFocused] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const name = de ? meta.name.de : meta.name.en;
  const subtitle = de ? meta.subtitle.de : meta.subtitle.en;

  /**
   * User-Regel (2026-04-19): jede Eingabe in einem Framework soll sofort
   * ein Projekt anlegen, das auch persistiert wird — damit der Framework-
   * Lauf in der Projekt-Liste erscheint und später in der Zusammenfassung
   * aufgefunden werden kann.
   *
   * Der Projekt-Name kombiniert Framework-Name + Topic (80 Zeichen cap,
   * analog zur Home-Logik in HomeClient.syncToCanvasDb). Der erste Call
   * feuert POST /api/v1/canvas; die Folge-Writes (Step-Ergebnisse) können
   * später in `project_queries` landen — das übernimmt die Framework-
   * Analyse-Schicht eigenständig, sobald sie die `projectId` kennt.
   *
   * Fail-safe: wenn die Projekt-Anlage fehlschlägt (Netzwerk, 500), läuft
   * das Framework trotzdem weiter mit `projectId = null`. Der User sieht
   * das Framework-Ergebnis, nur ohne Persistenz. Kein Blocking.
   */
  const handleSubmit = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setActiveTopic(trimmed);

    // Nur beim ersten Submit ein neues Projekt anlegen — weitere
    // Submits auf derselben Seite (z.B. User ändert Topic und drückt
    // nochmal Enter) verwenden das bestehende Projekt wieder.
    if (!projectId) {
      try {
        const projName = `${name}: ${trimmed}`.slice(0, 80);
        const res = await fetchWithTimeout("/api/v1/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projName }),
        }, 30_000);
        if (res.ok) {
          const json = await res.json();
          const pid = (json?.data?.canvas ?? json?.canvas)?.id;
          if (pid) {
            setProjectId(pid);
            // First Query-Row: das Topic selbst + welches Framework läuft.
            // Die step-spezifischen Ergebnisse werden später dort abgelegt
            // wo die Step-Komponenten sitzen (useFrameworkAnalysis).
            fetchWithTimeout(`/api/v1/projects/${pid}/queries`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: trimmed,
                result: {
                  synthesis: `Framework: ${name} — Topic: ${trimmed}`,
                  framework: meta.id,
                  frameworkName: name,
                  topic: trimmed,
                  createdAt: new Date().toISOString(),
                },
                locale,
              }),
            }, 60_000).catch((e) => {
              console.warn("[framework] Topic-Query-Persist fehlgeschlagen", e);
            });
          }
        } else {
          console.warn("[framework] Projekt-Anlage fehlgeschlagen", res.status);
        }
      } catch (err) {
        console.warn("[framework] Projekt-Anlage Fehler", err);
      }
    }
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
            <Link href="/" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>{t("frameworkShell.breadcrumbHome")}</Link>
            <span style={{ opacity: 0.55 }}>/</span>
            <Link href="/frameworks" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
              {t("frameworkShell.breadcrumbFrameworks")}
            </Link>
            <span style={{ opacity: 0.55 }}>/</span>
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
            {/*
              Wrapper must be position:relative so the BlockCursor can
              absolutely-position its block INSIDE this cell. The flex child
              keeps the input at its original 1fr width.
            */}
            <div style={{ position: "relative", flex: 1 }}>
              <input
                ref={inputRef}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = meta.color.accent;
                  setTopicFocused(true);
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = meta.color.border;
                  setTopicFocused(false);
                }}
                placeholder={t("frameworkShell.topicPlaceholder")}
                style={{
                  width: "100%", height: 42, padding: "0 14px",
                  fontSize: 14, fontFamily: "var(--font-ui)",
                  border: `1.5px solid ${meta.color.border}`,
                  borderRadius: 10,
                  // The input's own background is the framework card colour;
                  // the BlockCursor uses the same colour as its invert-glyph
                  // so the cursor appears to "cut through" the input and let
                  // the framework accent shine, with the character ghosted
                  // in the card tint.
                  background: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  // Hide the native thin caret — BlockCursor takes over.
                  caretColor: "transparent",
                }}
              />
              {/*
                Per-framework accent as cursor fill. The glyph under the
                cursor keeps its original text colour (default of
                BlockCursor) so it stays readable on top of the lime /
                pastel highlight block — no invert, no colour jump as
                the cursor blinks.
              */}
              <BlockCursor
                targetRef={inputRef}
                value={topic}
                focused={topicFocused}
                color={meta.color.accent}
              />
            </div>
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
              {t("frameworkShell.analyzeButton")} →
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
  const { t } = useT();
  // Framework name comes from FRAMEWORK_META, which carries both translations
  // per entry. The locale choice drives the empty-state heading.
  const name = de ? meta.name.de : meta.name.en;
  const timeHorizon = de ? meta.timeHorizon.de : meta.timeHorizon.en;
  const intensityLabels = {
    low: t("frameworksList.intensityLow"),
    medium: t("frameworksList.intensityMedium"),
    high: t("frameworksList.intensityHigh"),
    "very-high": t("frameworksList.intensityVeryHigh"),
  };

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
        {t("frameworkShell.emptyStateStart", { name })}
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 400, lineHeight: 1.6 }}>
        {t("frameworkShell.emptyStateBody")}
      </p>
      <div style={{
        display: "flex", gap: 16, marginTop: 20,
        fontSize: 11, color: "var(--color-text-muted)",
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        <span>{t("frameworkShell.horizonLabel")}: {timeHorizon}</span>
        <span>|</span>
        <span>LLM: {intensityLabels[meta.llmIntensity]}</span>
      </div>
    </div>
  );
}
