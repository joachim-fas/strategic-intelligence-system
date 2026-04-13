"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import {
  VoltButton,
  VoltCard, VoltCardHeader, VoltCardTitle, VoltCardDescription, VoltCardContent, VoltCardFooter,
  VoltBadge,
  VoltInput,
  VoltAlert,
  VoltProgress,
  VoltToggle,
  VoltTabs,
  VoltStat,
} from "@/components/volt";
import { VoltKbd } from "@/components/volt/VoltKbd";
import { VoltSeparator } from "@/components/volt/VoltSeparator";

/* ── Showcase Section wrapper ── */
function Section({ id, title, description, children }: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2 style={{
        fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
        fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em",
        color: "var(--color-text-heading, #0A0A0A)",
        marginBottom: 4,
      }}>{title}</h2>
      <p style={{
        fontSize: 13, color: "var(--color-text-muted, #6B6B6B)",
        marginBottom: 20, lineHeight: 1.5,
      }}>{description}</p>
      <div style={{
        padding: 24, borderRadius: 12,
        border: "1px solid var(--color-border, #E8E8E8)",
        background: "var(--volt-surface-raised, #fff)",
      }}>
        {children}
      </div>
    </section>
  );
}

/* ── Inline code display ── */
function CodeSnippet({ code }: { code: string }) {
  return (
    <pre style={{
      marginTop: 16, padding: "12px 16px",
      borderRadius: 8,
      background: "var(--color-surface, #F7F7F7)",
      border: "1px solid var(--color-border, #E8E8E8)",
      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 11, lineHeight: 1.6,
      color: "var(--color-text-primary, #333)",
      overflowX: "auto",
      whiteSpace: "pre-wrap",
    }}>
      {code}
    </pre>
  );
}

/* ── Table of contents nav ── */
const TOC = [
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "cards", label: "Cards" },
  { id: "inputs", label: "Inputs" },
  { id: "alerts", label: "Alerts" },
  { id: "progress", label: "Progress" },
  { id: "toggles", label: "Toggles" },
  { id: "tabs", label: "Tabs" },
  { id: "stats", label: "Stats" },
  { id: "kbd", label: "Keyboard" },
  { id: "separator", label: "Separator" },
  { id: "icons", label: "Icons" },
];

export default function KomponentenPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [inputValue, setInputValue] = useState("");
  const [toggleOn, setToggleOn] = useState(false);
  const [activeTab, setActiveTab] = useState("tab1");
  const [alertVisible, setAlertVisible] = useState(true);

  return (
    <>
      <AppHeader />
      <div style={{
        display: "flex",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 32px 120px",
        gap: 40,
      }}>
        {/* Sidebar TOC */}
        <nav style={{
          width: 180, flexShrink: 0,
          position: "sticky", top: 80, alignSelf: "flex-start",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--color-text-muted, #999)",
            marginBottom: 8,
          }}>
            Komponenten
          </div>
          {TOC.map(item => (
            <a key={item.id} href={`#${item.id}`}
              style={{
                fontSize: 13, color: "var(--color-text-muted, #6B6B6B)",
                textDecoration: "none", padding: "4px 10px",
                borderRadius: 6, transition: "all 0.12s",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              }}
              onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading)"; (e.currentTarget).style.background = "rgba(228,255,151,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; (e.currentTarget).style.background = "transparent"; }}
            >{item.label}</a>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Page header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{
              display: "inline-block",
              padding: "3px 10px", borderRadius: 20,
              background: "rgba(228,255,151,0.3)",
              border: "1px solid rgba(228,255,151,0.5)",
              fontSize: 11, fontWeight: 600,
              color: "#5A6B20",
              marginBottom: 12,
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              letterSpacing: "0.05em",
            }}>
              VOLT UI DESIGN SYSTEM
            </div>
            <h1 style={{
              fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
              fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em",
              color: "var(--color-text-heading, #0A0A0A)",
              marginBottom: 8,
            }}>
              {de ? "Komponenten-Bibliothek" : "Component Library"}
            </h1>
            <p style={{
              fontSize: 15, color: "var(--color-text-muted, #6B6B6B)",
              lineHeight: 1.6, maxWidth: 600,
            }}>
              {de
                ? "Alle UI-Komponenten des SIS Design Systems. Basierend auf VoltUI mit Tailwind CSS, class-variance-authority und Lucide Icons."
                : "All UI components of the SIS design system. Based on VoltUI with Tailwind CSS, class-variance-authority and Lucide Icons."}
            </p>
          </div>

          {/* ═══════════ BUTTONS ═══════════ */}
          <Section id="buttons"
            title="VoltButton"
            description={de ? "Primär-Aktion mit Ripple-Effekt, Shimmer-Sweep und Magnetic-Lift. 8 Varianten, 5 Größen." : "Primary action with ripple effect, shimmer sweep and magnetic lift. 8 variants, 5 sizes."}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <VoltButton variant="primary">Primary</VoltButton>
              <VoltButton variant="solid">Solid</VoltButton>
              <VoltButton variant="outline">Outline</VoltButton>
              <VoltButton variant="ghost">Ghost</VoltButton>
              <VoltButton variant="glass">Glass</VoltButton>
              <VoltButton variant="secondary">Secondary</VoltButton>
              <VoltButton variant="destructive">Destructive</VoltButton>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
              <VoltButton size="sm">Small</VoltButton>
              <VoltButton size="md">Medium</VoltButton>
              <VoltButton size="lg">Large</VoltButton>
              <VoltButton size="xl">Extra Large</VoltButton>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <VoltButton loading>Loading</VoltButton>
              <VoltButton disabled>Disabled</VoltButton>
            </div>
            <CodeSnippet code={`<VoltButton variant="primary" size="md">Analyse starten</VoltButton>
<VoltButton variant="outline" loading>Loading...</VoltButton>`} />
          </Section>

          {/* ═══════════ BADGES ═══════════ */}
          <Section id="badges"
            title="VoltBadge"
            description={de ? "Status-Labels mit Kontrast-Garantie. Signal-Farben (positive/negative/neutral) für semantische Zustände." : "Status labels with contrast guarantee. Signal colors for semantic states."}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <VoltBadge variant="default">Default</VoltBadge>
              <VoltBadge variant="solid">Solid</VoltBadge>
              <VoltBadge variant="outline">Outline</VoltBadge>
              <VoltBadge variant="muted">Muted</VoltBadge>
              <VoltBadge variant="glass">Glass</VoltBadge>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <VoltBadge variant="positive" dot>{de ? "Aktiv" : "Active"}</VoltBadge>
              <VoltBadge variant="negative" dot>{de ? "Fehler" : "Error"}</VoltBadge>
              <VoltBadge variant="neutral" dot>Idle</VoltBadge>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <VoltBadge size="sm">Small</VoltBadge>
              <VoltBadge size="md">Medium</VoltBadge>
              <VoltBadge size="lg">Large</VoltBadge>
            </div>
            <CodeSnippet code={`<VoltBadge variant="positive" dot>Aktiv</VoltBadge>
<VoltBadge variant="outline" size="sm">v2.1</VoltBadge>`} />
          </Section>

          {/* ═══════════ CARDS ═══════════ */}
          <Section id="cards"
            title="VoltCard"
            description={de ? "Container-Komponente mit 7 Varianten. Tiefe durch Farbe und Borders, nicht durch Schatten." : "Container component with 7 variants. Depth through color and borders, not shadows."}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              <VoltCard variant="default">
                <VoltCardHeader>
                  <VoltCardTitle>Default</VoltCardTitle>
                  <VoltCardDescription>{de ? "Standard-Container" : "Standard container"}</VoltCardDescription>
                </VoltCardHeader>
                <VoltCardContent>
                  <p className="text-sm text-muted-foreground">{de ? "Inhalt hier." : "Content here."}</p>
                </VoltCardContent>
              </VoltCard>
              <VoltCard variant="elevated">
                <VoltCardHeader>
                  <VoltCardTitle>Elevated</VoltCardTitle>
                  <VoltCardDescription>{de ? "Hervorgehobene Karte" : "Elevated card"}</VoltCardDescription>
                </VoltCardHeader>
                <VoltCardContent>
                  <p className="text-sm text-muted-foreground">{de ? "Mit Ring-Akzent." : "With ring accent."}</p>
                </VoltCardContent>
              </VoltCard>
              <VoltCard variant="interactive">
                <VoltCardHeader>
                  <VoltCardTitle>Interactive</VoltCardTitle>
                  <VoltCardDescription>{de ? "Klickbare Karte" : "Clickable card"}</VoltCardDescription>
                </VoltCardHeader>
                <VoltCardContent>
                  <p className="text-sm text-muted-foreground">Hover me!</p>
                </VoltCardContent>
              </VoltCard>
              <VoltCard variant="subtle">
                <VoltCardHeader>
                  <VoltCardTitle>Subtle</VoltCardTitle>
                  <VoltCardDescription>{de ? "Dezenter Container" : "Subtle container"}</VoltCardDescription>
                </VoltCardHeader>
              </VoltCard>
            </div>
            <CodeSnippet code={`<VoltCard variant="elevated">
  <VoltCardHeader>
    <VoltCardTitle>Titel</VoltCardTitle>
    <VoltCardDescription>Beschreibung</VoltCardDescription>
  </VoltCardHeader>
  <VoltCardContent>...</VoltCardContent>
</VoltCard>`} />
          </Section>

          {/* ═══════════ INPUTS ═══════════ */}
          <Section id="inputs"
            title="VoltInput"
            description={de ? "Text-Eingabefeld mit Label, Fehlerzustand und Hilfetext." : "Text input with label, error state and help text."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
              <VoltInput
                label={de ? "Suchbegriff" : "Search term"}
                placeholder={de ? "z.B. Künstliche Intelligenz" : "e.g. Artificial Intelligence"}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
              <VoltInput
                label="E-Mail"
                type="email"
                placeholder="name@example.com"
                hint={de ? "Wird nicht gespeichert." : "Will not be stored."}
              />
              <VoltInput
                label="API Key"
                error={de ? "Ungültiger API Key" : "Invalid API key"}
                value="sk-invalid..."
                onChange={() => {}}
              />
              <VoltInput
                label={de ? "Deaktiviert" : "Disabled"}
                disabled
                value="Read-only"
                onChange={() => {}}
              />
            </div>
            <CodeSnippet code={`<VoltInput
  label="Suchbegriff"
  placeholder="z.B. KI"
  value={value}
  onChange={e => setValue(e.target.value)}
  hint="Optional"
/>`} />
          </Section>

          {/* ═══════════ ALERTS ═══════════ */}
          <Section id="alerts"
            title="VoltAlert"
            description={de ? "Kontextuelle Benachrichtigungen mit 4 Varianten: info, success, warning, error." : "Contextual notifications with 4 variants: info, success, warning, error."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <VoltAlert variant="info" title="Info">
                {de ? "Das System hat 56 Quellen erfolgreich synchronisiert." : "The system successfully synchronized 56 sources."}
              </VoltAlert>
              <VoltAlert variant="success" title={de ? "Analyse abgeschlossen" : "Analysis complete"}>
                {de ? "3 Szenarien und 5 Erkenntnisse generiert." : "3 scenarios and 5 insights generated."}
              </VoltAlert>
              <VoltAlert variant="warning" title={de ? "Rate-Limit" : "Rate limit"}>
                {de ? "API-Kontingent bei 85%. Nächstes Reset in 4 Stunden." : "API quota at 85%. Next reset in 4 hours."}
              </VoltAlert>
              {alertVisible && (
                <VoltAlert variant="error" title={de ? "Verbindungsfehler" : "Connection error"} dismissible onDismiss={() => setAlertVisible(false)}>
                  {de ? "Anthropic API nicht erreichbar. Bitte erneut versuchen." : "Anthropic API unreachable. Please retry."}
                </VoltAlert>
              )}
              {!alertVisible && (
                <button onClick={() => setAlertVisible(true)}
                  style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer", background: "none", border: "none", textDecoration: "underline" }}
                >{de ? "Error-Alert wieder anzeigen" : "Show error alert again"}</button>
              )}
            </div>
            <CodeSnippet code={`<VoltAlert variant="success" title="Fertig" dismissible onDismiss={handleDismiss}>
  Analyse abgeschlossen.
</VoltAlert>`} />
          </Section>

          {/* ═══════════ PROGRESS ═══════════ */}
          <Section id="progress"
            title="VoltProgress"
            description={de ? "Fortschrittsanzeige mit Label und optionalem Prozentwert." : "Progress indicator with label and optional percentage."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
              <VoltProgress value={25} label={de ? "Datenquellen" : "Data sources"} />
              <VoltProgress value={68} label={de ? "Analyse" : "Analysis"} />
              <VoltProgress value={100} label={de ? "Abgeschlossen" : "Complete"} />
            </div>
            <CodeSnippet code={`<VoltProgress value={68} label="Analyse" />`} />
          </Section>

          {/* ═══════════ TOGGLES ═══════════ */}
          <Section id="toggles"
            title="VoltToggle"
            description={de ? "An/Aus-Schalter für binäre Einstellungen." : "On/off switch for binary settings."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VoltToggle checked={toggleOn} onChange={() => setToggleOn(!toggleOn)} />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
                  {toggleOn ? (de ? "Aktiviert" : "Enabled") : (de ? "Deaktiviert" : "Disabled")}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VoltToggle checked={true} onChange={() => {}} />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
                  {de ? "Immer an" : "Always on"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VoltToggle checked={false} disabled onChange={() => {}} />
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {de ? "Deaktiviert (disabled)" : "Disabled"}
                </span>
              </div>
            </div>
            <CodeSnippet code={`<VoltToggle checked={isActive} onChange={() => setIsActive(!isActive)} />`} />
          </Section>

          {/* ═══════════ TABS ═══════════ */}
          <Section id="tabs"
            title="VoltTabs"
            description={de ? "Tab-Navigation für Inhalts-Gruppierung." : "Tab navigation for content grouping."}
          >
            <VoltTabs
              tabs={[
                { id: "tab1", label: de ? "Übersicht" : "Overview" },
                { id: "tab2", label: de ? "Details" : "Details" },
                { id: "tab3", label: de ? "Einstellungen" : "Settings" },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "var(--color-surface, #F7F7F7)", fontSize: 13 }}>
              {activeTab === "tab1" && (de ? "Übersicht-Inhalt: Zusammenfassung aller Metriken." : "Overview content: Summary of all metrics.")}
              {activeTab === "tab2" && (de ? "Detail-Ansicht: Aufschlüsselung nach Kategorien." : "Detail view: Breakdown by categories.")}
              {activeTab === "tab3" && (de ? "Einstellungen: Konfiguration und Präferenzen." : "Settings: Configuration and preferences.")}
            </div>
            <CodeSnippet code={`<VoltTabs
  tabs={[{ id: "overview", label: "Übersicht" }, { id: "details", label: "Details" }]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>`} />
          </Section>

          {/* ═══════════ STATS ═══════════ */}
          <Section id="stats"
            title="VoltStat"
            description={de ? "KPI-Anzeige mit Label, Wert und optionalem Trend." : "KPI display with label, value and optional trend."}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <VoltStat label={de ? "Quellen" : "Sources"} value="56" />
              <VoltStat label="Trends" value="40" change={12} />
              <VoltStat label={de ? "Analysen" : "Analyses"} value="128" change={-3} />
              <VoltStat label="Confidence" value="87%" />
            </div>
            <CodeSnippet code={`<VoltStat label="Trends" value="40" change={12} />`} />
          </Section>

          {/* ═══════════ KBD ═══════════ */}
          <Section id="kbd"
            title="VoltKbd"
            description={de ? "Tastatur-Kürzel Anzeige." : "Keyboard shortcut display."}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <VoltKbd>Ctrl</VoltKbd> + <VoltKbd>M</VoltKbd>
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>Activity Monitor</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <VoltKbd>Esc</VoltKbd>
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "Schließen" : "Close"}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <VoltKbd>Del</VoltKbd>
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "Löschen" : "Delete"}</span>
              </span>
            </div>
            <CodeSnippet code={`<VoltKbd>Ctrl</VoltKbd> + <VoltKbd>M</VoltKbd>`} />
          </Section>

          {/* ═══════════ SEPARATOR ═══════════ */}
          <Section id="separator"
            title="VoltSeparator"
            description={de ? "Visuelle Trennung von Inhalten." : "Visual content divider."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13 }}>{de ? "Inhalt oben" : "Content above"}</div>
              <VoltSeparator />
              <div style={{ fontSize: 13 }}>{de ? "Inhalt unten" : "Content below"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, height: 40 }}>
                <span style={{ fontSize: 13 }}>Links</span>
                <VoltSeparator orientation="vertical" />
                <span style={{ fontSize: 13 }}>Rechts</span>
              </div>
            </div>
            <CodeSnippet code={`<VoltSeparator />
<VoltSeparator orientation="vertical" />`} />
          </Section>

          {/* ═══════════ ICONS ═══════════ */}
          <Section id="icons"
            title={de ? "Icon-Bibliothek" : "Icon Library"}
            description={de ? "SVG-Icons aus dem VoltUI Design System. Organisiert nach Kategorien: Datenquellen und Analyse-Methoden." : "SVG icons from the VoltUI design system. Organized by categories: data sources and analysis methods."}
          >
            {/* Analysis methods */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "var(--color-text-muted, #999)",
                marginBottom: 10,
              }}>{de ? "Analyse-Methoden" : "Analysis Methods"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {[
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/marktanalyse/marktanalyse-layout-grid.svg", label: "Marktanalyse" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/war-gaming/war-gaming-swords.svg", label: "War-Gaming" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/pre-mortem/pre-mortem-triangle-alert.svg", label: "Pre-Mortem" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/post-mortem/post-mortem-search.svg", label: "Post-Mortem" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/trend-deep-dive/trend-deep-dive-microscope.svg", label: "Deep-Dive" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/stakeholder/stakeholder-users-round.svg", label: "Stakeholder" },
                ].map(icon => (
                  <div key={icon.src} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "12px 8px", borderRadius: 8,
                    border: "1px solid var(--color-border, #E8E8E8)",
                    background: "var(--color-surface, #FAFAFA)",
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.src} alt={icon.label} width={24} height={24} style={{ opacity: 0.75 }} />
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.2 }}>{icon.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data sources sample */}
            <div>
              <div style={{
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "var(--color-text-muted, #999)",
                marginBottom: 10,
              }}>{de ? "Datenquellen (Auswahl)" : "Data Sources (selection)"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {[
                  { src: "/icons/volt/quellen-methoden/datenquellen/news-medien/news-medien-newspaper.svg", label: "News" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/wissenschaft-forschung/wissenschaft-forschung-microscope.svg", label: de ? "Forschung" : "Research" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/finanzen-maerkte/finanzen-maerkte-trending-up.svg", label: de ? "Finanzen" : "Finance" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/geopolitik-konflikte/geopolitik-konflikte-globe.svg", label: de ? "Geopolitik" : "Geopolitics" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/klima-umwelt/klima-umwelt-leaf.svg", label: de ? "Klima" : "Climate" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/innovation-patente/innovation-patente-lightbulb.svg", label: "Innovation" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/social-community/social-community-users.svg", label: "Social" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/daten-statistik/daten-statistik-bar-chart.svg", label: de ? "Statistik" : "Statistics" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/prediction-markets/prediction-markets-target.svg", label: "Prediction" },
                  { src: "/icons/volt/quellen-methoden/datenquellen/foresight-szenarien/foresight-szenarien-compass.svg", label: "Foresight" },
                ].map(icon => (
                  <div key={icon.src} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "12px 8px", borderRadius: 8,
                    border: "1px solid var(--color-border, #E8E8E8)",
                    background: "var(--color-surface, #FAFAFA)",
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.src} alt={icon.label} width={24} height={24} style={{ opacity: 0.75 }} />
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.2 }}>{icon.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <CodeSnippet code={`<img src="/icons/volt/quellen-methoden/analyse-methoden/marktanalyse/marktanalyse-layout-grid.svg" width={24} height={24} />

// Kategorien:
// /icons/volt/quellen-methoden/datenquellen/  → 11 Quell-Kategorien
// /icons/volt/quellen-methoden/analyse-methoden/ → 6 Frameworks
// /icons/volt/skeuomorphic/ → Dekorative Icons`} />
          </Section>
        </main>
      </div>
    </>
  );
}
