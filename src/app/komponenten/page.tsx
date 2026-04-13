"use client";

import { useState, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import {
  Search, Mail, Eye, EyeOff, Settings, Trash2, Copy, BarChart3, Globe, Zap,
  Users, TrendingUp, Activity, PieChart, GitBranch, Layers, Target, Info,
  CheckCircle2, Check, Circle, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  VoltButton,
  VoltCard, VoltCardHeader, VoltCardTitle, VoltCardDescription, VoltCardContent,
  VoltBadge,
  VoltInput,
  VoltAlert,
  VoltProgress,
  VoltToggle, VoltCheckbox, VoltRadioGroup,
  VoltTabs,
  VoltStat,
  VoltTable,
  VoltModal,
  VoltToastContainer, useVoltToast, VoltTooltip,
  VoltRankedList,
  VoltTrendCard, VoltTrendDirection, VoltStatusDot, VoltSignalBar,
  VoltAccordion, VoltAccordionItem, VoltAccordionTrigger, VoltAccordionContent,
  VoltAvatar,
  VoltBreadcrumb, VoltBreadcrumbList, VoltBreadcrumbItem, VoltBreadcrumbLink, VoltBreadcrumbPage, VoltBreadcrumbSeparator,
  VoltDialog, VoltDialogContent, VoltDialogHeader, VoltDialogFooter, VoltDialogTitle, VoltDialogDescription,
  VoltDropdownMenu, VoltDropdownMenuTrigger, VoltDropdownMenuContent, VoltDropdownMenuItem, VoltDropdownMenuLabel, VoltDropdownMenuSeparator, VoltDropdownMenuShortcut, VoltDropdownMenuCheckboxItem,
  VoltDropdownSelect, VoltDropdownSelectTrigger, VoltDropdownSelectContent, VoltDropdownSelectItem, VoltDropdownSelectLabel, VoltDropdownSelectSeparator,
  VoltEmpty, VoltEmptyTitle, VoltEmptyDescription,
  VoltFieldSet, VoltField, VoltFieldLabel, VoltFieldDescription, VoltFieldError,
  VoltInputGroup, VoltInputGroupAddon, VoltInputGroupInput,
  VoltLabel,
  VoltPopover, VoltPopoverTrigger, VoltPopoverContent,
  VoltScrollArea,
  VoltSheet, VoltSheetContent, VoltSheetHeader, VoltSheetTitle, VoltSheetDescription,
  VoltSkeleton,
  VoltSpinner,
  VoltToggleGroup, VoltToggleGroupItem,
  VoltCommandBar,
  // Charts (recharts)
  VoltAreaChart, VoltBarChart, VoltLineChart, VoltDonutChart,
  VoltScatterChart, VoltComposedChart, VoltRadialBarChart,
  VoltFunnelChart, VoltTrendChart, VoltStackedAreaChart, VoltStackedBarChart,
  VOLT_PASTEL,
  // Visualization (D3)
  VoltBubbleMap,
  VoltRadarChart,
  // Canvas
  VoltNodeCanvas,
  // Display
  VoltTerminalStatic,
  VoltCodeBlock,
  VoltSidebar,
  VoltCursor,
  // Skeuomorphic Icons
  SKEU_ICONS,
} from "@/components/volt";
import { VoltRadarChart as VoltRadarChartRecharts } from "@/components/volt/VoltChart";
import { VoltKbd } from "@/components/volt/VoltKbd";
import { VoltSeparator } from "@/components/volt/VoltSeparator";
import {
  VoltTableRoot, VoltTableHeader, VoltTableBody, VoltTableRow, VoltTableHead, VoltTableCell,
} from "@/components/volt/VoltTablePrimitive";

/* ===================================================================
   Foundations Data
   =================================================================== */
const colorTokens = [
  { name: "--neon-yellow",     hex: "#E4FF97", role: "Neon Yellow (Leading)", bg: "#E4FF97" },
  { name: "--black",           hex: "#000000", role: "Black (Fundament)",     bg: "#000000" },
  { name: "--signal-positive", hex: "#1A9E5A", role: "Signal Positiv",        bg: "#1A9E5A" },
  { name: "--signal-negative", hex: "#E8402A", role: "Signal Negativ",        bg: "#E8402A" },
  { name: "--signal-neutral",  hex: "#6B7A9A", role: "Signal Neutral",        bg: "#6B7A9A" },
];

const semanticTokens = [
  { name: "--background",  role: "Seitenhintergrund",  bg: "var(--background, #FFFFFF)",   border: true  },
  { name: "--foreground",  role: "Haupttext",           bg: "var(--foreground, #0A0A0A)",   border: false },
  { name: "--primary",     role: "Primaere Aktionen",   bg: "var(--primary, #0A0A0A)",      border: false },
  { name: "--secondary",   role: "Sekundaere Flaechen", bg: "var(--secondary, #F5F5F5)",    border: true  },
  { name: "--muted",       role: "Gedaempfte Flaechen", bg: "var(--muted, #F5F5F5)",        border: true  },
  { name: "--accent",      role: "Akzent / Highlight",  bg: "var(--accent, #F5F5F5)",       border: true  },
  { name: "--destructive", role: "Fehler / Loeschen",   bg: "var(--destructive, #E8402A)",  border: false },
  { name: "--border",      role: "Rahmenlinien",        bg: "var(--border, #E8E8E8)",       border: false },
];

const typeScale = [
  { name: "Display XL",  size: 48, weight: 900, family: "var(--volt-font-display, 'Space Grotesk', sans-serif)", sample: "Volt UI", font: "Space Grotesk" },
  { name: "Display L",   size: 36, weight: 700, family: "var(--volt-font-display, 'Space Grotesk', sans-serif)", sample: "Atmospheric", font: "Space Grotesk" },
  { name: "Display M",   size: 24, weight: 700, family: "var(--volt-font-display, 'Space Grotesk', sans-serif)", sample: "Design System", font: "Space Grotesk" },
  { name: "UI Heading",  size: 20, weight: 600, family: "var(--volt-font-ui, 'DM Sans', sans-serif)",           sample: "Component Library", font: "DM Sans" },
  { name: "UI Body",     size: 16, weight: 500, family: "var(--volt-font-ui, 'DM Sans', sans-serif)",           sample: "Portables Design System", font: "DM Sans" },
  { name: "UI Small",    size: 14, weight: 400, family: "var(--volt-font-body, 'DM Sans', sans-serif)",         sample: "Tiefe durch Schichtung von Volt-Textur, Gradienten und Glasmorphismus.", font: "DM Sans" },
  { name: "Caption",     size: 12, weight: 500, family: "var(--volt-font-ui, 'DM Sans', sans-serif)",           sample: "Subtile Texturen als verbindendes Element", font: "DM Sans" },
  { name: "Mono",        size: 14, weight: 400, family: "var(--volt-font-mono, 'JetBrains Mono', monospace)",   sample: "const volt = oklch(0.95 0.18 120); // Lime", font: "JetBrains Mono" },
];

const patterns = [
  { label: "Dots",     cls: "pattern-dots",  desc: "Radiale Punkte" },
  { label: "Grid",     cls: "pattern-grid",  desc: "Quadratisches Raster" },
  { label: "Diagonal", cls: "pattern-lines", desc: "45-Grad Diagonallinien" },
  { label: "Cross",    cls: "pattern-cross", desc: "Kreuz-Raster" },
];

const gradients: Array<{ label: string; desc: string; style: React.CSSProperties; textDark: boolean }> = [
  { label: "Volt Gradient",   desc: "Lime zu Schwarz (Brand-Verlauf)",     style: { background: "linear-gradient(135deg, #E4FF97 0%, #0A0A0A 100%)" }, textDark: false },
  { label: "Atmospheric",     desc: "Radiale Orbs, Lime-Akzent",           style: { background: "radial-gradient(ellipse at 25% 35%, rgba(228,255,151,0.55) 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(228,255,151,0.25) 0%, transparent 50%), #0A0A0A" }, textDark: false },
  { label: "Hero Background", desc: "Lime-Basis, subtile Orbs",            style: { background: "radial-gradient(ellipse at 20% 50%, rgba(10,10,10,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(10,10,10,0.05) 0%, transparent 50%), #E4FF97" }, textDark: true },
  { label: "Soft Lime",       desc: "Heller Verlauf, UI-Flaechen",         style: { background: "linear-gradient(135deg, #E4FF97 0%, #C8F060 100%)" }, textDark: true },
  { label: "Pastel Blend",    desc: "Rose zu Mint, Datenkodierung",        style: { background: "linear-gradient(135deg, #F9D0D0 0%, #C8F0E0 100%)" }, textDark: true },
  { label: "Deep Dark",       desc: "Schwarz zu Dunkelgrau, Nacht",        style: { background: "linear-gradient(135deg, #0A0A0A 0%, #2A2A2A 100%)" }, textDark: false },
];

const glassVariants = [
  { label: "Glass",        desc: "65% Weiss + Blur 16px",   bg: "rgba(255,255,255,0.65)", blur: 16, dark: false },
  { label: "Glass Strong", desc: "88% Weiss + Blur 24px",   bg: "rgba(255,255,255,0.88)", blur: 24, dark: false },
  { label: "Glass Dark",   desc: "72% Dunkel + Blur 20px",  bg: "rgba(10,10,10,0.72)",    blur: 20, dark: true },
];

/* ===================================================================
   Chart Data (from DataSection reference)
   =================================================================== */
const monthlyData = [
  { name: "Jan", Besucher: 1200, Konversionen: 180, Umsatz: 4200 },
  { name: "Feb", Besucher: 1900, Konversionen: 240, Umsatz: 5800 },
  { name: "Mar", Besucher: 1600, Konversionen: 210, Umsatz: 5100 },
  { name: "Apr", Besucher: 2400, Konversionen: 320, Umsatz: 7600 },
  { name: "Mai", Besucher: 2100, Konversionen: 290, Umsatz: 6900 },
  { name: "Jun", Besucher: 2800, Konversionen: 380, Umsatz: 9200 },
  { name: "Jul", Besucher: 3200, Konversionen: 440, Umsatz: 10800 },
];

const weeklyData = [
  { name: "Mo", Design: 42, Code: 65, Review: 28 },
  { name: "Di", Design: 55, Code: 78, Review: 35 },
  { name: "Mi", Design: 38, Code: 90, Review: 42 },
  { name: "Do", Design: 62, Code: 72, Review: 55 },
  { name: "Fr", Design: 70, Code: 85, Review: 48 },
  { name: "Sa", Design: 25, Code: 30, Review: 18 },
  { name: "So", Design: 15, Code: 20, Review: 10 },
];

const donutData = [
  { name: "Buttons",    value: 28 },
  { name: "Cards",      value: 22 },
  { name: "Forms",      value: 18 },
  { name: "Navigation", value: 15 },
  { name: "Charts",     value: 12 },
  { name: "Sonstiges",  value: 5  },
];

const radarData = [
  { subject: "Performance",   A: 88, B: 72 },
  { subject: "Accessibility", A: 95, B: 80 },
  { subject: "SEO",           A: 76, B: 68 },
  { subject: "Design",        A: 92, B: 85 },
  { subject: "Usability",     A: 84, B: 78 },
  { subject: "Security",      A: 70, B: 90 },
];

const scatterData = Array.from({ length: 24 }, (_, i) => ({
  x: 10 + ((i * 37 + 13) % 80),
  y: 10 + ((i * 53 + 7) % 80),
  z: 60 + ((i * 41 + 19) % 180),
}));

const composedData = [
  { name: "Q1", Budget: 4000, Ausgaben: 2400, Effizienz: 60 },
  { name: "Q2", Budget: 3000, Ausgaben: 1398, Effizienz: 47 },
  { name: "Q3", Budget: 5000, Ausgaben: 4200, Effizienz: 84 },
  { name: "Q4", Budget: 2780, Ausgaben: 3908, Effizienz: 141 },
];

const radialData = [
  { name: "Neon Yellow", value: 88 },
  { name: "Positiv",     value: 72 },
  { name: "Negativ",     value: 65 },
  { name: "Neutral",     value: 54 },
  { name: "Mint",        value: 42 },
];

const funnelData = [
  { name: "Besucher",      value: 10000 },
  { name: "Interessenten", value: 6800  },
  { name: "Leads",         value: 3200  },
  { name: "Qualifiziert",  value: 1500  },
  { name: "Kunden",        value: 620   },
];

const trendData = [
  { name: "KW1", v1: 400, v2: 240, v3: 180 },
  { name: "KW2", v1: 300, v2: 139, v3: 220 },
  { name: "KW3", v1: 600, v2: 380, v3: 290 },
  { name: "KW4", v1: 800, v2: 430, v3: 340 },
  { name: "KW5", v1: 500, v2: 280, v3: 260 },
  { name: "KW6", v1: 900, v2: 520, v3: 410 },
  { name: "KW7", v1: 1100, v2: 680, v3: 490 },
  { name: "KW8", v1: 950, v2: 590, v3: 430 },
];

const stackedAreaData = [
  { name: "Jan", Mobile: 400, Desktop: 800, Tablet: 200 },
  { name: "Feb", Mobile: 500, Desktop: 900, Tablet: 250 },
  { name: "Mar", Mobile: 600, Desktop: 850, Tablet: 280 },
  { name: "Apr", Mobile: 700, Desktop: 1000, Tablet: 320 },
  { name: "Mai", Mobile: 800, Desktop: 1100, Tablet: 350 },
  { name: "Jun", Mobile: 900, Desktop: 1200, Tablet: 380 },
];

const frameworkData = [
  { name: "React",   Nutzung: 85 },
  { name: "Vue",     Nutzung: 62 },
  { name: "Angular", Nutzung: 48 },
  { name: "Svelte",  Nutzung: 35 },
  { name: "Solid",   Nutzung: 22 },
];

const chartTypes: Array<{
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; color: string; when: string; reads: string;
}> = [
  { icon: Activity,    label: "Area Chart",       color: VOLT_PASTEL[0], when: "Zeitreihen mit Volumen",            reads: "Trend + Flaeche unter der Kurve" },
  { icon: BarChart3,   label: "Bar Chart",        color: VOLT_PASTEL[1], when: "Kategorien vergleichen",            reads: "Absolute Werte nebeneinander" },
  { icon: TrendingUp,  label: "Line Chart",       color: VOLT_PASTEL[2], when: "Mehrere Trends vergleichen",        reads: "Richtung und Schnittpunkte" },
  { icon: PieChart,    label: "Donut / Pie",      color: VOLT_PASTEL[3], when: "Anteile eines Ganzen",              reads: "Prozentuale Verteilung" },
  { icon: Target,      label: "Radar Chart",      color: VOLT_PASTEL[4], when: "Multi-dimensionaler Vergleich",     reads: "Staerken und Schwaechen" },
  { icon: GitBranch,   label: "Scatter / Bubble",  color: VOLT_PASTEL[5], when: "Korrelationen sichtbar machen",    reads: "Cluster und Ausreisser" },
  { icon: Layers,      label: "Composed Chart",   color: VOLT_PASTEL[6], when: "Verschiedene Metriken kombinieren", reads: "Bar + Line in einem View" },
  { icon: Activity,    label: "Radial Bar",       color: VOLT_PASTEL[7 % VOLT_PASTEL.length], when: "Fortschritt je Kategorie", reads: "Ringfoermige Fortschrittsanzeige" },
  { icon: BarChart3,   label: "Funnel Chart",     color: VOLT_PASTEL[0], when: "Conversion-Prozesse",              reads: "Verlust zwischen Stufen" },
  { icon: TrendingUp,  label: "Trend Chart",      color: VOLT_PASTEL[1], when: "Langzeit-Trends mit Referenz",      reads: "Abweichung vom Zielwert" },
  { icon: Activity,    label: "Stacked Area",     color: VOLT_PASTEL[2], when: "Zusammensetzung ueber Zeit",        reads: "Anteile + Gesamtentwicklung" },
  { icon: BarChart3,   label: "Stacked Bar",      color: VOLT_PASTEL[3], when: "Zusammensetzung je Kategorie",      reads: "Teile und Ganzes gleichzeitig" },
];

/* ===================================================================
   Helper Components
   =================================================================== */

function Section({ id, title, description, children }: {
  id: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2 style={{
        fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
        fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em",
        color: "var(--color-text-heading, #0A0A0A)", marginBottom: 4,
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

function CodeSnippet({ code }: { code: string }) {
  return (
    <pre style={{
      marginTop: 16, padding: "12px 16px", borderRadius: 8,
      background: "var(--color-surface, #F7F7F7)",
      border: "1px solid var(--color-border, #E8E8E8)",
      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 11, lineHeight: 1.6, color: "var(--color-text-primary, #333)",
      overflowX: "auto", whiteSpace: "pre-wrap",
    }}>
      {code}
    </pre>
  );
}

function CategoryLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
      textTransform: "uppercase", color: "var(--color-text-muted, #999)",
      marginTop: 16, marginBottom: 4, paddingLeft: 10,
    }}>{children}</div>
  );
}

function SubSectionHeader({ number, title, description, badge, insight }: {
  number: string; title: string; description: string; badge?: string; insight?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <p style={{
          fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 4,
        }}>{number}</p>
        <h3 style={{
          fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
          fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em",
          color: "var(--color-text-heading, #0A0A0A)", marginBottom: 4,
        }}>{title}</h3>
        <p style={{ fontSize: 14, color: "var(--color-text-muted, #6B6B6B)", lineHeight: 1.5, maxWidth: 500 }}>{description}</p>
        {insight && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 10, fontWeight: 600, color: "#1A9E5A" }}>
            <Info style={{ width: 12, height: 12 }} />
            {insight}
          </div>
        )}
      </div>
      {badge && <VoltBadge variant="muted" size="sm">{badge}</VoltBadge>}
    </div>
  );
}

/* Inline Pagination */
function InlinePagination({ total, current, onChange }: { total: number; current: number; onChange: (p: number) => void }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "none", background: "transparent", cursor: current === 1 ? "not-allowed" : "pointer",
          color: "var(--color-text-muted, #6B6B6B)", opacity: current === 1 ? 0.4 : 1,
        }}
      >
        <ChevronLeft style={{ width: 16, height: 16 }} />
      </button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600,
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            background: p === current ? "#0A0A0A" : "transparent",
            color: p === current ? "#FFFFFF" : "var(--color-text-muted, #6B6B6B)",
            transition: "all 150ms",
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "none", background: "transparent", cursor: current === total ? "not-allowed" : "pointer",
          color: "var(--color-text-muted, #6B6B6B)", opacity: current === total ? 0.4 : 1,
        }}
      >
        <ChevronRight style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}

/* Inline Stepper */
const stepperSteps = ["Konto", "Profil", "Einstellungen", "Fertig"];
function InlineStepper({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {stepperSteps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: "contents" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700,
                background: done ? "#0A0A0A" : active ? "#E4FF97" : "var(--color-surface, #F5F5F5)",
                color: done ? "#FFFFFF" : "var(--color-text-heading, #0A0A0A)",
                border: !done && !active ? "1px solid var(--color-border, #E8E8E8)" : "none",
                transform: active ? "scale(1.1)" : "scale(1)",
                transition: "all 300ms",
              }}>
                {done ? <Check style={{ width: 16, height: 16 }} /> : active ? <Circle style={{ width: 10, height: 10, fill: "white" }} /> : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: active ? 700 : 600,
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                color: active || done ? "var(--color-text-heading, #0A0A0A)" : "var(--color-text-muted, #6B6B6B)",
                whiteSpace: "nowrap",
              }}>
                {step}
              </span>
            </div>
            {i < stepperSteps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginLeft: 8, marginRight: 8, marginBottom: 20,
                borderRadius: 2,
                background: i < current ? "#0A0A0A" : "var(--color-border, #E8E8E8)",
                transition: "all 500ms",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===================================================================
   Table of Contents
   =================================================================== */
const TOC = [
  { cat: "Foundations", items: [
    { id: "foundations-colors", label: "Farben" },
    { id: "foundations-semantic", label: "Semantik" },
    { id: "foundations-typography", label: "Typografie" },
    { id: "foundations-patterns", label: "Patterns" },
    { id: "foundations-gradients", label: "Gradienten" },
    { id: "foundations-glass", label: "Glass" },
  ]},
  { cat: "Actions", items: [
    { id: "buttons", label: "Button" },
    { id: "badges", label: "Badge" },
    { id: "toggles", label: "Toggle" },
    { id: "toggle-group", label: "ToggleGroup" },
  ]},
  { cat: "Layout", items: [
    { id: "cards", label: "Card" },
    { id: "accordion", label: "Accordion" },
    { id: "separator", label: "Separator" },
    { id: "skeleton", label: "Skeleton" },
    { id: "spinner", label: "Spinner" },
    { id: "scroll-area", label: "ScrollArea" },
    { id: "empty", label: "Empty" },
  ]},
  { cat: "Form", items: [
    { id: "inputs", label: "Input" },
    { id: "label", label: "Label" },
    { id: "field", label: "Field" },
    { id: "input-group", label: "InputGroup" },
    { id: "dropdown-select", label: "Select" },
  ]},
  { cat: "Feedback", items: [
    { id: "alerts", label: "Alert" },
    { id: "progress", label: "Progress" },
    { id: "toast", label: "Toast" },
  ]},
  { cat: "Overlay", items: [
    { id: "dialog", label: "Dialog" },
    { id: "modal", label: "Modal" },
    { id: "sheet", label: "Sheet" },
    { id: "popover", label: "Popover" },
    { id: "dropdown-menu", label: "DropdownMenu" },
  ]},
  { cat: "Navigation", items: [
    { id: "tabs", label: "Tabs" },
    { id: "breadcrumb", label: "Breadcrumb" },
    { id: "pagination", label: "Pagination" },
    { id: "stepper", label: "Stepper" },
    { id: "command-bar", label: "CommandBar" },
  ]},
  { cat: "Data", items: [
    { id: "stats", label: "Stat" },
    { id: "table", label: "Table" },
    { id: "table-primitive", label: "Primitives" },
    { id: "ranked-list", label: "RankedList" },
    { id: "trend-card", label: "TrendCard" },
    { id: "avatar", label: "Avatar" },
  ]},
  { cat: "Charts", items: [
    { id: "chart-overview", label: "Uebersicht" },
    { id: "charts-kpi", label: "KPI Cards" },
    { id: "charts-timeseries", label: "Zeitreihen" },
    { id: "charts-categories", label: "Kategorien" },
    { id: "charts-parts", label: "Anteile" },
    { id: "charts-comparison", label: "Vergleich" },
    { id: "charts-pipeline", label: "Pipeline" },
    { id: "charts-trends", label: "Trends" },
    { id: "charts-stacked", label: "Gestapelt" },
    { id: "charts-table", label: "Tabelle" },
  ]},
  { cat: "Visualisierung", items: [
    { id: "bubble-map", label: "BubbleMap" },
    { id: "radar-chart", label: "RadarChart" },
  ]},
  { cat: "Canvas", items: [
    { id: "node-canvas", label: "NodeCanvas" },
  ]},
  { cat: "Display", items: [
    { id: "terminal", label: "Terminal" },
    { id: "code-block", label: "CodeBlock" },
    { id: "sidebar", label: "Sidebar" },
    { id: "cursor", label: "Cursor" },
  ]},
  { cat: "Misc", items: [
    { id: "kbd", label: "Kbd" },
    { id: "tooltip", label: "Tooltip" },
    { id: "icons", label: "Icons" },
    { id: "skeuomorphic-icons", label: "3D Icons" },
  ]},
];

const totalComponents = TOC.reduce((sum, g) => sum + g.items.length, 0);

/* ===================================================================
   MAIN PAGE
   =================================================================== */
export default function KomponentenPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  const [inputValue, setInputValue] = useState("");
  const [toggleOn, setToggleOn] = useState(false);
  const [activeTab, setActiveTab] = useState("tab1");
  const [alertVisible, setAlertVisible] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectValue, setSelectValue] = useState("");
  const [toggleGroupValue, setToggleGroupValue] = useState("center");
  const [checkboxA, setCheckboxA] = useState(true);
  const [checkboxB, setCheckboxB] = useState(false);
  const [radioValue, setRadioValue] = useState("option1");
  const [showPw, setShowPw] = useState(false);
  const [ddCheckA, setDdCheckA] = useState(true);
  const [ddCheckB, setDdCheckB] = useState(false);
  const { toasts, add: addToast, dismiss: dismissToast } = useVoltToast();
  const [activeChartType, setActiveChartType] = useState<string | null>(null);
  const [paginationPage, setPaginationPage] = useState(3);
  const [stepperStep, setStepperStep] = useState(1);

  const fireToast = useCallback((variant: "success" | "error" | "info" | "warning") => {
    const msgs: Record<string, { title: string; description: string }> = {
      success: { title: de ? "Gespeichert" : "Saved", description: de ? "Aenderungen wurden uebernommen." : "Changes have been applied." },
      error:   { title: "Error", description: de ? "Verbindung fehlgeschlagen." : "Connection failed." },
      info:    { title: "Info", description: de ? "Neue Daten verfuegbar." : "New data available." },
      warning: { title: "Warning", description: de ? "API-Limit bei 90%." : "API limit at 90%." },
    };
    addToast({ variant, ...msgs[variant] });
  }, [de, addToast]);

  return (
    <>
      <AppHeader />
      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto", padding: "32px 32px 120px", gap: 40 }}>
        {/* Sidebar TOC */}
        <nav style={{ width: 180, flexShrink: 0, position: "sticky", top: 80, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 1, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
          <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 8 }}>Komponenten</div>
          {TOC.map(group => (
            <div key={group.cat}>
              <CategoryLabel>{group.cat}</CategoryLabel>
              {group.items.map(item => (
                <a key={item.id} href={`#${item.id}`}
                  style={{ fontSize: 12, color: "var(--color-text-muted, #6B6B6B)", textDecoration: "none", padding: "3px 10px", borderRadius: 6, transition: "all 0.12s", fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)", display: "block" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text-heading)"; e.currentTarget.style.background = "rgba(228,255,151,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted, #6B6B6B)"; e.currentTarget.style.background = "transparent"; }}
                >{item.label}</a>
              ))}
            </div>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Page header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: "rgba(228,255,151,0.3)", border: "1px solid rgba(228,255,151,0.5)", fontSize: 11, fontWeight: 600, color: "#5A6B20", marginBottom: 12, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", letterSpacing: "0.05em" }}>
              {`VOLT UI \u00B7 ${totalComponents} COMPONENTS`}
            </div>
            <h1 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-heading, #0A0A0A)", marginBottom: 8 }}>
              {de ? "Komponenten-Bibliothek" : "Component Library"}
            </h1>
            <p style={{ fontSize: 15, color: "var(--color-text-muted, #6B6B6B)", lineHeight: 1.6, maxWidth: 600 }}>
              {de
                ? "Alle UI-Komponenten des SIS Design Systems. Basierend auf VoltUI mit Tailwind CSS, class-variance-authority und Lucide Icons."
                : "All UI components of the SIS design system. Based on VoltUI with Tailwind CSS, class-variance-authority and Lucide Icons."}
            </p>
          </div>

          {/* ================================================================
             01 - FOUNDATIONS
             ================================================================ */}
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 8 }}>{"01 \u2014 Foundations"}</div>
            <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-heading, #0A0A0A)", marginBottom: 8 }}>{"Design Tokens & Grundlagen"}</h2>
            <p style={{ fontSize: 14, color: "var(--color-text-muted, #6B6B6B)", lineHeight: 1.5, maxWidth: 600, marginBottom: 32 }}>
              Alle Farben, Abstaende und typografischen Werte sind als CSS-Custom-Properties definiert. Die Farbpalette wurde direkt aus dem koernigen Gradienten-Bild extrahiert und in das OKLCH-Farbraum-System uebertragen.
            </p>
          </div>

          {/* Brand Colors */}
          <section id="foundations-colors" style={{ marginBottom: 40 }}>
            <VoltCard>
              <VoltCardHeader><VoltCardTitle>Markenfarben</VoltCardTitle><VoltCardDescription>{"Hauptfarben: Neon Yellow #E4FF97 + Black #000000 \u00B7 Signalfarben: Smaragd \u00B7 Koralle \u00B7 Slate"}</VoltCardDescription></VoltCardHeader>
              <VoltCardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                  {colorTokens.map(token => (
                    <div key={token.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="volt-texture" style={{ height: 80, borderRadius: 12, background: token.bg }} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading, #0A0A0A)" }}>{token.role}</span>
                          <VoltBadge variant="muted" size="sm">{token.hex}</VoltBadge>
                        </div>
                        <p style={{ fontSize: 10, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)", wordBreak: "break-all" }}>{token.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </VoltCardContent>
            </VoltCard>
          </section>

          {/* Semantic Tokens */}
          <section id="foundations-semantic" style={{ marginBottom: 40 }}>
            <VoltCard>
              <VoltCardHeader><VoltCardTitle>Semantische Tokens</VoltCardTitle><VoltCardDescription>Kontextbezogene CSS-Variablen fuer Light- und Dark-Mode</VoltCardDescription></VoltCardHeader>
              <VoltCardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {semanticTokens.map(token => (
                    <div key={token.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ height: 48, borderRadius: 12, background: token.bg, border: token.border ? "1px solid var(--color-border, #E8E8E8)" : "none" }} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading, #0A0A0A)" }}>{token.role}</p>
                        <p style={{ fontSize: 10, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)" }}>{token.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </VoltCardContent>
            </VoltCard>
          </section>

          {/* Typography */}
          <section id="foundations-typography" style={{ marginBottom: 40 }}>
            <VoltCard>
              <VoltCardHeader><VoltCardTitle>Typografie-System</VoltCardTitle><VoltCardDescription>{"Space Grotesk (Display) \u00B7 DM Sans (UI/Body) \u00B7 JetBrains Mono (Code)"}</VoltCardDescription></VoltCardHeader>
              <VoltCardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    { name: "Space Grotesk", role: "Display & Headlines", sample: "Aa", fam: "var(--volt-font-display, 'Space Grotesk', sans-serif)" },
                    { name: "DM Sans", role: "UI, Body & Zahlen", sample: "Aa", fam: "var(--volt-font-ui, 'DM Sans', sans-serif)" },
                    { name: "JetBrains Mono", role: "Code & Mono", sample: "Aa", fam: "var(--volt-font-mono, 'JetBrains Mono', monospace)" },
                  ].map(f => (
                    <div key={f.name} style={{ padding: 16, borderRadius: 12, border: "1px solid var(--color-border, #E8E8E8)", background: "var(--color-surface, #FAFAFA)" }}>
                      <p style={{ fontSize: 36, fontWeight: 700, fontFamily: f.fam, color: "var(--color-text-heading, #0A0A0A)", marginBottom: 8 }}>{f.sample}</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading, #0A0A0A)" }}>{f.name}</p>
                      <p style={{ fontSize: 10, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)" }}>{f.role}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {typeScale.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 16, paddingTop: i > 0 ? 12 : 0, paddingBottom: 12, borderBottom: i < typeScale.length - 1 ? "1px solid var(--color-border, #E8E8E8)" : "none" }}>
                      <div style={{ width: 112, flexShrink: 0 }}>
                        <p style={{ fontSize: 10, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)", lineHeight: 1.3 }}>{t.name}</p>
                        <p style={{ fontSize: 9, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #999)" }}>{t.font}</p>
                      </div>
                      <p style={{ fontSize: t.size, fontWeight: t.weight, fontFamily: t.family, color: "var(--color-text-heading, #0A0A0A)", lineHeight: 1.2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.sample}</p>
                    </div>
                  ))}
                </div>
              </VoltCardContent>
            </VoltCard>
          </section>

          {/* Patterns */}
          <section id="foundations-patterns" style={{ marginBottom: 40 }}>
            <VoltCard>
              <VoltCardHeader><VoltCardTitle>Geometrische Patterns</VoltCardTitle><VoltCardDescription>CSS-basierte Hintergrundmuster</VoltCardDescription></VoltCardHeader>
              <VoltCardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {patterns.map(p => (
                    <div key={p.label} className={p.cls} style={{ height: 112, borderRadius: 12, border: "1px solid var(--color-border, #E8E8E8)", display: "flex", alignItems: "flex-end", padding: 12 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading, #0A0A0A)" }}>{p.label}</p>
                        <p style={{ fontSize: 10, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: "var(--color-text-muted, #6B6B6B)" }}>{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </VoltCardContent>
            </VoltCard>
          </section>

          {/* Gradients */}
          <section id="foundations-gradients" style={{ marginBottom: 40 }}>
            <VoltCard>
              <VoltCardHeader><VoltCardTitle>Gradient-Hintergruende</VoltCardTitle><VoltCardDescription>Atmosphaerische Gradienten fuer verschiedene Einsatzbereiche</VoltCardDescription></VoltCardHeader>
              <VoltCardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {gradients.map(g => (
                    <div key={g.label} className="volt-texture" style={{ ...g.style, height: 112, borderRadius: 12, display: "flex", alignItems: "flex-end", padding: 12 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: g.textDark ? "var(--color-text-heading, #0A0A0A)" : "#FFFFFF" }}>{g.label}</p>
                        <p style={{ fontSize: 10, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", color: g.textDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)" }}>{g.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </VoltCardContent>
            </VoltCard>
          </section>

          {/* Glassmorphism */}
          <section id="foundations-glass" style={{ marginBottom: 56 }}>
            <VoltCard>
              <VoltCardHeader><VoltCardTitle>Glassmorphismus</VoltCardTitle><VoltCardDescription>Backdrop-Filter-Effekte fuer ueberlagerte Elemente</VoltCardDescription></VoltCardHeader>
              <VoltCardContent>
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", minHeight: 200 }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A2A 100%)" }}>
                    <div style={{ position: "absolute", top: -50, left: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, #E4FF97 0%, #A8D840 55%, transparent 100%)", opacity: 0.9 }} />
                    <div style={{ position: "absolute", bottom: -60, right: -30, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, #60A5FA 0%, #2563EB 55%, transparent 100%)", opacity: 0.75 }} />
                    <div style={{ position: "absolute", top: "20%", left: "38%", width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, #FB923C 0%, #EA580C 65%, transparent 100%)", opacity: 0.65 }} />
                    <div style={{ position: "absolute", bottom: 8, left: 14, fontFamily: "\"Space Grotesk\", sans-serif", fontSize: 72, fontWeight: 900, color: "rgba(255,255,255,0.05)", letterSpacing: -3, userSelect: "none", lineHeight: 1 }}>VOLT</div>
                  </div>
                  <div style={{ position: "relative", zIndex: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: 24 }}>
                    {glassVariants.map(g => (
                      <div key={g.label} style={{ borderRadius: 12, padding: 16, background: g.bg, backdropFilter: `blur(${g.blur}px)`, WebkitBackdropFilter: `blur(${g.blur}px)`, border: "1px solid rgba(255,255,255,0.15)" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: g.dark ? "#FFFFFF" : "var(--color-text-heading, #0A0A0A)", marginBottom: 4 }}>{g.label}</p>
                        <p style={{ fontSize: 12, color: g.dark ? "rgba(255,255,255,0.7)" : "var(--color-text-muted, #6B6B6B)" }}>{g.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </VoltCardContent>
            </VoltCard>
          </section>

          {/* ================================================================
             ACTIONS
             ================================================================ */}
          <Section id="buttons" title="VoltButton" description={de ? "Primaer-Aktion mit Ripple-Effekt, Shimmer-Sweep und Magnetic-Lift. 8 Varianten, 5 Groessen." : "Primary action with ripple, shimmer sweep and magnetic lift. 8 variants, 5 sizes."}>
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
              <VoltButton variant="outline" leftIcon={<Search className="w-4 h-4" />}>{de ? "Suchen" : "Search"}</VoltButton>
            </div>
            <CodeSnippet code={`<VoltButton variant="primary" size="md" leftIcon={<Search />}>Suchen</VoltButton>`} />
          </Section>

          <Section id="badges" title="VoltBadge" description={de ? "Status-Labels mit Kontrast-Garantie. Signal-Farben fuer semantische Zustaende." : "Status labels with contrast guarantee."}>
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
          </Section>

          <Section id="toggles" title="VoltToggle / VoltCheckbox / VoltRadioGroup" description={de ? "An/Aus-Schalter, Checkboxen und Radio-Buttons." : "Toggle switches, checkboxes and radio buttons."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VoltToggle checked={toggleOn} onChange={() => setToggleOn(!toggleOn)} />
                <span style={{ fontSize: 13 }}>{toggleOn ? (de ? "Aktiviert" : "Enabled") : (de ? "Deaktiviert" : "Disabled")}</span>
              </div>
              <VoltSeparator />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <VoltCheckbox label="Auto-Sync" description={de ? "Automatische Synchronisierung" : "Automatic synchronization"} checked={checkboxA} onChange={() => setCheckboxA(!checkboxA)} />
                <VoltCheckbox label="Dark Mode" checked={checkboxB} onChange={() => setCheckboxB(!checkboxB)} />
              </div>
              <VoltSeparator />
              <VoltRadioGroup name="demo-radio" value={radioValue} onValueChange={setRadioValue} options={[
                { value: "option1", label: "Anthropic Claude", description: "GPT-Alternative" },
                { value: "option2", label: "OpenAI GPT-4o", description: "Multimodal" },
                { value: "option3", label: "Google Gemini", description: "Large context" },
              ]} />
            </div>
          </Section>

          <Section id="toggle-group" title="VoltToggleGroup" description={de ? "Gruppierte Toggle-Buttons (single oder multiple Auswahl)." : "Grouped toggle buttons (single or multiple selection)."}>
            <VoltToggleGroup type="single" value={toggleGroupValue} onValueChange={v => typeof v === "string" && setToggleGroupValue(v)}>
              <VoltToggleGroupItem value="left">Links</VoltToggleGroupItem>
              <VoltToggleGroupItem value="center">Mitte</VoltToggleGroupItem>
              <VoltToggleGroupItem value="right">Rechts</VoltToggleGroupItem>
            </VoltToggleGroup>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginTop: 8 }}>{de ? "Ausgewaehlt" : "Selected"}: {toggleGroupValue}</span>
          </Section>

          {/* ================================================================ LAYOUT ================================================================ */}
          <Section id="cards" title="VoltCard" description={de ? "Container-Komponente mit 7 Varianten." : "Container component with 7 variants."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {(["default", "elevated", "interactive", "subtle", "outlined"] as const).map(v => (
                <VoltCard key={v} variant={v}>
                  <VoltCardHeader><VoltCardTitle>{v}</VoltCardTitle><VoltCardDescription>{de ? "Karten-Variante" : "Card variant"}</VoltCardDescription></VoltCardHeader>
                  <VoltCardContent><p className="text-sm text-muted-foreground">Content</p></VoltCardContent>
                </VoltCard>
              ))}
            </div>
          </Section>

          <Section id="accordion" title="VoltAccordion" description={de ? "Ausklappbare Inhaltsbereiche." : "Collapsible content sections."}>
            <VoltAccordion type="single" collapsible>
              <VoltAccordionItem value="item-1"><VoltAccordionTrigger>{de ? "Was ist SIS?" : "What is SIS?"}</VoltAccordionTrigger><VoltAccordionContent>{de ? "SIS ist ein Strategic Intelligence System." : "SIS is a Strategic Intelligence System."}</VoltAccordionContent></VoltAccordionItem>
              <VoltAccordionItem value="item-2"><VoltAccordionTrigger>{de ? "Welche Datenquellen?" : "Which data sources?"}</VoltAccordionTrigger><VoltAccordionContent>{de ? "News, Forschung, Finanzmaerkte, Geopolitik, Patente, Social Media." : "News, research, financial markets, geopolitics, patents, social media."}</VoltAccordionContent></VoltAccordionItem>
              <VoltAccordionItem value="item-3"><VoltAccordionTrigger>{de ? "Wie funktioniert der Canvas?" : "How does the Canvas work?"}</VoltAccordionTrigger><VoltAccordionContent>{de ? "Node-basierter Workspace fuer visuelle Analyse." : "Node-based workspace for visual analysis."}</VoltAccordionContent></VoltAccordionItem>
            </VoltAccordion>
          </Section>

          <Section id="separator" title="VoltSeparator" description={de ? "Visuelle Trennung -- horizontal und vertikal." : "Visual divider."}>
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
          </Section>

          <Section id="skeleton" title="VoltSkeleton" description={de ? "Lade-Platzhalter mit Puls-Animation." : "Loading placeholder."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VoltSkeleton className="h-10 w-10 rounded-full" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <VoltSkeleton className="h-4 w-3/4" />
                  <VoltSkeleton className="h-3 w-1/2" />
                </div>
              </div>
              <VoltSkeleton className="h-24 w-full rounded-lg" />
            </div>
          </Section>

          <Section id="spinner" title="VoltSpinner" description={de ? "Lade-Indikator als animierter SVG-Spinner." : "Loading indicator."}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <VoltSpinner className="w-5 h-5" />
              <VoltSpinner className="w-8 h-8" />
              <VoltSpinner className="w-12 h-12" />
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-muted)" }}>
                <VoltSpinner className="w-4 h-4" /> {de ? "Wird geladen..." : "Loading..."}
              </div>
            </div>
          </Section>

          <Section id="scroll-area" title="VoltScrollArea" description={de ? "Container mit gestylter Scrollbar." : "Container with styled scrollbar."}>
            <VoltScrollArea className="h-40 w-full rounded-lg border border-border p-4">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--color-border, #eee)" }}>
                    {`${de ? "Eintrag" : "Entry"} ${i + 1}`}
                  </div>
                ))}
              </div>
            </VoltScrollArea>
          </Section>

          <Section id="empty" title="VoltEmpty" description={de ? "Leerer-Zustand Anzeige." : "Empty state display."}>
            <VoltEmpty className="py-8">
              <VoltEmptyTitle>{de ? "Keine Ergebnisse" : "No results"}</VoltEmptyTitle>
              <VoltEmptyDescription>{de ? "Es wurden keine passenden Trends gefunden." : "No matching trends found."}</VoltEmptyDescription>
            </VoltEmpty>
          </Section>

          {/* ================================================================ FORM ================================================================ */}
          <Section id="inputs" title="VoltInput" description={de ? "Text-Eingabe mit 4 Varianten, Label, Fehler- und Hilfetexte." : "Text input with 4 variants, label, error and helper text."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              <VoltInput label={de ? "Suchbegriff" : "Search term"} placeholder={de ? "z.B. Kuenstliche Intelligenz" : "e.g. Artificial Intelligence"} value={inputValue} onChange={e => setInputValue(e.target.value)} />
              <VoltInput label="E-Mail" type="email" placeholder="name@example.com" hint={de ? "Wird nicht gespeichert." : "Will not be stored."} variant="boxed" />
              <VoltInput label="API Key" error={de ? "Ungueltiger API Key" : "Invalid API key"} value="sk-invalid..." onChange={() => {}} state="error" />
              <VoltInput label={de ? "Gefuellt" : "Filled"} placeholder="filled variant" variant="filled" />
            </div>
          </Section>

          <Section id="label" title="VoltLabel" description={de ? "Zugaengliches Formular-Label." : "Accessible form label."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
              <VoltLabel htmlFor="demo-input">{de ? "Projekt-Name" : "Project name"}</VoltLabel>
              <input id="demo-input" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-foreground transition-colors" placeholder={de ? "z.B. Trend-Radar Q2" : "e.g. Trend Radar Q2"} />
            </div>
          </Section>

          <Section id="field" title="VoltField" description={de ? "Formularfeld-Layout mit Label, Beschreibung und Fehlermeldung." : "Form field layout."}>
            <VoltFieldSet>
              <VoltField>
                <VoltFieldLabel>{de ? "Projektname" : "Project name"}</VoltFieldLabel>
                <VoltFieldDescription>{de ? "Ein eindeutiger Name fuer das Projekt." : "A unique name for the project."}</VoltFieldDescription>
                <input className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-foreground transition-colors" />
              </VoltField>
              <VoltField>
                <VoltFieldLabel>{de ? "E-Mail" : "Email"}</VoltFieldLabel>
                <input className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-foreground transition-colors border-destructive" />
                <VoltFieldError errors={[{ message: de ? "Ungueltige E-Mail-Adresse" : "Invalid email address" }]} />
              </VoltField>
            </VoltFieldSet>
          </Section>

          <Section id="input-group" title="VoltInputGroup" description={de ? "Input mit Prefix/Suffix-Addons." : "Input with prefix/suffix addons."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
              <VoltInputGroup>
                <VoltInputGroupAddon><Search className="w-4 h-4" /></VoltInputGroupAddon>
                <VoltInputGroupInput placeholder={de ? "Suchen..." : "Search..."} />
              </VoltInputGroup>
              <VoltInputGroup>
                <VoltInputGroupAddon><Mail className="w-4 h-4" /></VoltInputGroupAddon>
                <VoltInputGroupInput placeholder="name@example.com" />
                <VoltInputGroupAddon align="inline-end">
                  <button onClick={() => setShowPw(!showPw)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </VoltInputGroupAddon>
              </VoltInputGroup>
            </div>
          </Section>

          <Section id="dropdown-select" title="VoltDropdownSelect" description={de ? "Dropdown-Auswahl mit Kategorien." : "Dropdown select with categories."}>
            <div style={{ maxWidth: 300 }}>
              <VoltDropdownSelect value={selectValue} onValueChange={setSelectValue}>
                <VoltDropdownSelectTrigger placeholder={de ? "Framework waehlen..." : "Select framework..."} />
                <VoltDropdownSelectContent>
                  <VoltDropdownSelectLabel>{de ? "Analyse" : "Analysis"}</VoltDropdownSelectLabel>
                  <VoltDropdownSelectItem value="markt">Marktanalyse</VoltDropdownSelectItem>
                  <VoltDropdownSelectItem value="wargame">War-Gaming</VoltDropdownSelectItem>
                  <VoltDropdownSelectSeparator />
                  <VoltDropdownSelectLabel>Stakeholder</VoltDropdownSelectLabel>
                  <VoltDropdownSelectItem value="stakeholder">Stakeholder-Mapping</VoltDropdownSelectItem>
                  <VoltDropdownSelectItem value="deepdive">Trend Deep-Dive</VoltDropdownSelectItem>
                </VoltDropdownSelectContent>
              </VoltDropdownSelect>
              {selectValue && <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>{de ? "Gewaehlt" : "Selected"}: {selectValue}</p>}
            </div>
          </Section>

          {/* ================================================================ FEEDBACK ================================================================ */}
          <Section id="alerts" title="VoltAlert" description={de ? "Kontextuelle Benachrichtigungen: info, success, warning, error." : "Contextual notifications."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <VoltAlert variant="info" title="Info">{de ? "56 Quellen synchronisiert." : "56 sources synchronized."}</VoltAlert>
              <VoltAlert variant="success" title={de ? "Analyse abgeschlossen" : "Analysis complete"}>{de ? "3 Szenarien generiert." : "3 scenarios generated."}</VoltAlert>
              <VoltAlert variant="warning" title="Rate-Limit">{de ? "API-Kontingent bei 85%." : "API quota at 85%."}</VoltAlert>
              {alertVisible && <VoltAlert variant="error" title={de ? "Verbindungsfehler" : "Connection error"} dismissible onDismiss={() => setAlertVisible(false)}>{de ? "API nicht erreichbar." : "API unreachable."}</VoltAlert>}
              {!alertVisible && <button onClick={() => setAlertVisible(true)} style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer", background: "none", border: "none", textDecoration: "underline" }}>{de ? "Error-Alert wieder anzeigen" : "Show error alert again"}</button>}
            </div>
          </Section>

          <Section id="progress" title="VoltProgress" description={de ? "Fortschrittsanzeige mit Label und Varianten." : "Progress bar with label and variants."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
              <VoltProgress value={25} label={de ? "Datenquellen" : "Data sources"} showValue />
              <VoltProgress value={68} label={de ? "Analyse" : "Analysis"} variant="lime" showValue />
              <VoltProgress value={100} label={de ? "Abgeschlossen" : "Complete"} variant="positive" />
              <VoltProgress value={15} label={de ? "Kritisch" : "Critical"} variant="negative" size="lg" showValue />
            </div>
          </Section>

          <Section id="toast" title="VoltToast" description={de ? "Temporaere Benachrichtigungen. 4 Varianten." : "Temporary notifications. 4 variants."}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <VoltButton variant="primary" size="sm" onClick={() => fireToast("success")}>Success</VoltButton>
              <VoltButton variant="destructive" size="sm" onClick={() => fireToast("error")}>Error</VoltButton>
              <VoltButton variant="outline" size="sm" onClick={() => fireToast("info")}>Info</VoltButton>
              <VoltButton variant="secondary" size="sm" onClick={() => fireToast("warning")}>Warning</VoltButton>
            </div>
          </Section>

          {/* ================================================================ OVERLAY ================================================================ */}
          <Section id="dialog" title="VoltDialog" description={de ? "Modaler Dialog mit Header, Footer und Close-Button." : "Modal dialog."}>
            <VoltButton variant="outline" onClick={() => setDialogOpen(true)}>{de ? "Dialog oeffnen" : "Open Dialog"}</VoltButton>
            <VoltDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <VoltDialogContent>
                <VoltDialogHeader>
                  <VoltDialogTitle>{de ? "Projekt loeschen?" : "Delete project?"}</VoltDialogTitle>
                  <VoltDialogDescription>{de ? "Diese Aktion kann nicht rueckgaengig gemacht werden." : "This action cannot be undone."}</VoltDialogDescription>
                </VoltDialogHeader>
                <VoltDialogFooter>
                  <VoltButton variant="outline" onClick={() => setDialogOpen(false)}>{de ? "Abbrechen" : "Cancel"}</VoltButton>
                  <VoltButton variant="destructive" onClick={() => setDialogOpen(false)}>{de ? "Loeschen" : "Delete"}</VoltButton>
                </VoltDialogFooter>
              </VoltDialogContent>
            </VoltDialog>
          </Section>

          <Section id="modal" title="VoltModal" description={de ? "Einfacher Modal-Wrapper." : "Simple modal wrapper."}>
            <VoltButton variant="outline" onClick={() => setModalOpen(true)}>{de ? "Modal oeffnen" : "Open Modal"}</VoltButton>
            <VoltModal open={modalOpen} onClose={() => setModalOpen(false)} title={de ? "Einstellungen" : "Settings"} description={de ? "System-Konfiguration anpassen." : "Adjust system configuration."} footer={<VoltButton variant="primary" onClick={() => setModalOpen(false)}>{de ? "Speichern" : "Save"}</VoltButton>}>
              <div style={{ padding: "8px 0", fontSize: 13 }}>{de ? "Modal-Inhalt mit beliebigen Komponenten." : "Modal content with any components."}</div>
            </VoltModal>
          </Section>

          <Section id="sheet" title="VoltSheet" description={de ? "Seitliches Panel (Drawer)." : "Side panel (drawer)."}>
            <VoltButton variant="outline" onClick={() => setSheetOpen(true)}>{de ? "Sheet oeffnen" : "Open Sheet"}</VoltButton>
            <VoltSheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <VoltSheetContent side="right">
                <VoltSheetHeader><VoltSheetTitle>{de ? "Filter" : "Filters"}</VoltSheetTitle><VoltSheetDescription>{de ? "Ergebnisse eingrenzen." : "Narrow down results."}</VoltSheetDescription></VoltSheetHeader>
                <div style={{ padding: 16, fontSize: 13 }}>{de ? "Sheet-Inhalt." : "Sheet content."}</div>
              </VoltSheetContent>
            </VoltSheet>
          </Section>

          <Section id="popover" title="VoltPopover" description={de ? "Floating-Panel fuer zusaetzliche Inhalte." : "Floating panel."}>
            <VoltPopover>
              <VoltPopoverTrigger asChild><VoltButton variant="outline">{de ? "Popover oeffnen" : "Open Popover"}</VoltButton></VoltPopoverTrigger>
              <VoltPopoverContent align="start" className="w-72 p-4">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{de ? "Schnellinfo" : "Quick info"}</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{de ? "Popovers eignen sich fuer kontextuelle Informationen." : "Popovers are great for contextual information."}</span>
                </div>
              </VoltPopoverContent>
            </VoltPopover>
          </Section>

          <Section id="dropdown-menu" title="VoltDropdownMenu" description={de ? "Dropdown-Menue mit Items, Checkboxen, Labels und Shortcuts." : "Dropdown menu."}>
            <VoltDropdownMenu>
              <VoltDropdownMenuTrigger>{de ? "Aktionen" : "Actions"} <span style={{ fontSize: 10 }}>{"\u25BE"}</span></VoltDropdownMenuTrigger>
              <VoltDropdownMenuContent align="start">
                <VoltDropdownMenuLabel>{de ? "Optionen" : "Options"}</VoltDropdownMenuLabel>
                <VoltDropdownMenuItem><Settings className="w-4 h-4 mr-2" /> {de ? "Einstellungen" : "Settings"}<VoltDropdownMenuShortcut>{"\u2318S"}</VoltDropdownMenuShortcut></VoltDropdownMenuItem>
                <VoltDropdownMenuItem><Copy className="w-4 h-4 mr-2" /> {de ? "Kopieren" : "Copy"}<VoltDropdownMenuShortcut>{"\u2318C"}</VoltDropdownMenuShortcut></VoltDropdownMenuItem>
                <VoltDropdownMenuSeparator />
                <VoltDropdownMenuCheckboxItem checked={ddCheckA} onCheckedChange={setDdCheckA}>Auto-Save</VoltDropdownMenuCheckboxItem>
                <VoltDropdownMenuCheckboxItem checked={ddCheckB} onCheckedChange={setDdCheckB}>Notifications</VoltDropdownMenuCheckboxItem>
                <VoltDropdownMenuSeparator />
                <VoltDropdownMenuItem variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> {de ? "Loeschen" : "Delete"}</VoltDropdownMenuItem>
              </VoltDropdownMenuContent>
            </VoltDropdownMenu>
          </Section>

          {/* ================================================================ NAVIGATION ================================================================ */}
          <Section id="tabs" title="VoltTabs" description={de ? "Tab-Navigation mit 4 Varianten." : "Tab navigation with 4 variants."}>
            <VoltTabs tabs={[{ id: "tab1", label: de ? "Uebersicht" : "Overview" }, { id: "tab2", label: "Details" }, { id: "tab3", label: de ? "Einstellungen" : "Settings" }]} activeTab={activeTab} onTabChange={setActiveTab} />
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "var(--color-surface, #F7F7F7)", fontSize: 13 }}>
              {activeTab === "tab1" && (de ? "Zusammenfassung aller Metriken." : "Summary of all metrics.")}
              {activeTab === "tab2" && (de ? "Aufschluesselung nach Kategorien." : "Breakdown by categories.")}
              {activeTab === "tab3" && (de ? "Konfiguration und Praeferenzen." : "Configuration and preferences.")}
            </div>
          </Section>

          <Section id="breadcrumb" title="VoltBreadcrumb" description={de ? "Breadcrumb-Navigation mit Trennern." : "Breadcrumb navigation."}>
            <VoltBreadcrumb>
              <VoltBreadcrumbList>
                <VoltBreadcrumbItem><VoltBreadcrumbLink href="/">Home</VoltBreadcrumbLink></VoltBreadcrumbItem>
                <VoltBreadcrumbSeparator />
                <VoltBreadcrumbItem><VoltBreadcrumbLink href="/canvas">Canvas</VoltBreadcrumbLink></VoltBreadcrumbItem>
                <VoltBreadcrumbSeparator />
                <VoltBreadcrumbItem><VoltBreadcrumbPage>{de ? "Analyse" : "Analysis"}</VoltBreadcrumbPage></VoltBreadcrumbItem>
              </VoltBreadcrumbList>
            </VoltBreadcrumb>
          </Section>

          <Section id="pagination" title="Pagination" description={`${de ? "Interaktive Seitennummerierung. Aktuelle Seite" : "Interactive page numbering. Current page"}: ${paginationPage} / 7`}>
            <InlinePagination total={7} current={paginationPage} onChange={setPaginationPage} />
          </Section>

          <Section id="stepper" title="Stepper" description={`${de ? "Schritt" : "Step"} ${stepperStep + 1} / ${stepperSteps.length}. ${de ? "4 Schritte mit Navigation." : "4 steps with navigation."}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <InlineStepper current={stepperStep} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <VoltButton variant="outline" size="sm" disabled={stepperStep === 0} onClick={() => setStepperStep(s => Math.max(0, s - 1))} leftIcon={<ChevronLeft className="w-4 h-4" />}>{de ? "Zurueck" : "Back"}</VoltButton>
                <VoltButton variant="primary" size="sm" onClick={() => setStepperStep(s => Math.min(stepperSteps.length - 1, s + 1))} rightIcon={stepperStep < stepperSteps.length - 1 ? <ChevronRight className="w-4 h-4" /> : <Check className="w-4 h-4" />}>
                  {stepperStep === stepperSteps.length - 1 ? (de ? "Abschliessen" : "Complete") : (de ? "Weiter" : "Next")}
                </VoltButton>
              </div>
            </div>
          </Section>

          <Section id="command-bar" title="VoltCommandBar" description={de ? "AI-Eingabefeld mit Vorschlaegen." : "AI input field with suggestions."}>
            <div style={{ maxWidth: 600 }}>
              <VoltCommandBar placeholder={de ? "Frag mich etwas..." : "Ask me something..."} onSubmit={() => fireToast("info")} suggestions={[{ label: de ? "Trend-Analyse starten" : "Start trend analysis" }, { label: de ? "Quellen synchronisieren" : "Sync sources" }]} />
            </div>
          </Section>

          {/* ================================================================ DATA ================================================================ */}
          <Section id="stats" title="VoltStat" description={de ? "KPI-Anzeige mit Label, Wert und Trend." : "KPI display with label, value and trend."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <VoltStat label={de ? "Quellen" : "Sources"} value="56" />
              <VoltStat label="Trends" value="40" change={12} changeLabel="vs Q1" />
              <VoltStat label={de ? "Analysen" : "Analyses"} value="128" change={-3} />
              <VoltStat label="Confidence" value="87%" variant="lime" />
            </div>
          </Section>

          <Section id="table" title="VoltTable" description={de ? "Daten-Tabelle mit Sortierung und Striping." : "Data table with sorting and striping."}>
            <VoltTable columns={[
              { key: "name", header: "Trend" },
              { key: "category", header: de ? "Kategorie" : "Category" },
              { key: "confidence", header: "Confidence", align: "right" as const, render: (v: unknown) => <VoltBadge size="sm" variant={Number(v) > 70 ? "positive" : "neutral"}>{String(v)}%</VoltBadge> },
              { key: "signals", header: "Signals", align: "right" as const },
            ]} data={[
              { name: "AI Regulation", category: "MAKRO", confidence: 85, signals: 42 },
              { name: "Quantum Computing", category: "MEGA", confidence: 62, signals: 28 },
              { name: "Digital Euro", category: "MAKRO", confidence: 78, signals: 35 },
              { name: "Space Economy", category: "MEGA", confidence: 45, signals: 19 },
            ]} striped hoverable />
          </Section>

          <Section id="table-primitive" title="VoltTablePrimitive" description={de ? "Zusammensetzbare Tabellen-Bausteine." : "Composable table building blocks."}>
            <VoltTableRoot>
              <VoltTableHeader><VoltTableRow><VoltTableHead>ID</VoltTableHead><VoltTableHead>{de ? "Quelle" : "Source"}</VoltTableHead><VoltTableHead className="text-right">Status</VoltTableHead></VoltTableRow></VoltTableHeader>
              <VoltTableBody>
                <VoltTableRow><VoltTableCell>001</VoltTableCell><VoltTableCell>Reuters</VoltTableCell><VoltTableCell className="text-right"><VoltBadge variant="positive" size="sm">OK</VoltBadge></VoltTableCell></VoltTableRow>
                <VoltTableRow><VoltTableCell>002</VoltTableCell><VoltTableCell>PubMed</VoltTableCell><VoltTableCell className="text-right"><VoltBadge variant="positive" size="sm">OK</VoltBadge></VoltTableCell></VoltTableRow>
                <VoltTableRow><VoltTableCell>003</VoltTableCell><VoltTableCell>arXiv</VoltTableCell><VoltTableCell className="text-right"><VoltBadge variant="negative" size="sm">Error</VoltBadge></VoltTableCell></VoltTableRow>
              </VoltTableBody>
            </VoltTableRoot>
          </Section>

          <Section id="ranked-list" title="VoltRankedList" description={de ? "Sortierte Rangliste mit Kategorien." : "Sorted ranked list."}>
            <div style={{ maxWidth: 500 }}>
              <VoltRankedList title="Top Trends" subtitle="Q2 2026" showProgressBar maxValue={100} entries={[
                { id: "1", label: "AI Regulation", value: 92, category: "makro", trend: "up" as const },
                { id: "2", label: "Climate Tech", value: 78, category: "mega", trend: "up" as const },
                { id: "3", label: "Digital Euro", value: 65, category: "makro", trend: "neutral" as const },
                { id: "4", label: "Quantum", value: 43, category: "mega", trend: "down" as const },
              ]} />
            </div>
          </Section>

          <Section id="trend-card" title="VoltTrendCard" description={de ? "Trend-Karte mit Status-Dot und Richtung." : "Trend card with status dot and direction."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              <VoltTrendCard title="AI Regulation" status="adopt" direction="up" signals={42} confidence={85} category="MAKRO" />
              <VoltTrendCard title="Quantum Computing" status="assess" direction="stable" signals={28} confidence={62} category="MEGA" />
              <VoltTrendCard title="Digital Euro" status="trial" direction="up" signals={35} confidence={78} category="MAKRO" />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Sub-Components:</span>
              <VoltStatusDot label="Adopt" /><VoltStatusDot label="Assess" /><VoltStatusDot label="Trial" />
              <VoltTrendDirection direction="up" /><VoltTrendDirection direction="down" /><VoltTrendDirection direction="stable" />
              <VoltSignalBar direction="up" />
            </div>
          </Section>

          <Section id="avatar" title="VoltAvatar" description={de ? "Benutzer-Avatar mit Bild, Fallback und 4 Groessen." : "User avatar with image, fallback and 4 sizes."}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <VoltAvatar size="sm" name="JU" /><VoltAvatar size="md" name="SIS" /><VoltAvatar size="lg" name="Volt" ring /><VoltAvatar size="xl" name="AI" online />
            </div>
          </Section>

          {/* ================================================================
             CHARTS (enriched DataSection)
             ================================================================ */}
          <div id="chart-overview" style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 8 }}>{"10 \u2014 Data & Charts"}</div>
            <h2 style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-heading, #0A0A0A)", marginBottom: 8 }}>{"Daten & Visualisierung"}</h2>
            <p style={{ fontSize: 14, color: "var(--color-text-muted, #6B6B6B)", lineHeight: 1.5, maxWidth: 600, marginBottom: 16 }}>
              {"12 Graphen-Typen \u2013 jeder fuer einen spezifischen Informationsbedarf. Das Ziel ist nicht der schoenste Chart, sondern der "}
              <strong style={{ color: "var(--color-text-heading, #0A0A0A)" }}>richtige Chart fuer die richtige Frage</strong>.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[
                { icon: <CheckCircle2 style={{ width: 12, height: 12 }} />, text: "Klick auf einen Chart-Typ fuer Erklaerung" },
                { icon: <Info style={{ width: 12, height: 12 }} />, text: "Jeder Chart zeigt: Wann? Was lese ich ab?" },
              ].map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, color: "var(--color-text-muted, #6B6B6B)", background: "var(--color-surface, #F5F5F5)", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border, #E8E8E8)" }}>
                  <span style={{ color: "var(--color-text-heading, #0A0A0A)" }}>{h.icon}</span>{h.text}
                </div>
              ))}
            </div>
          </div>

          {/* Chart Type Overview */}
          <div style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Uebersicht" title="Welcher Chart fuer welche Frage?" description="Klicke auf einen Chart-Typ um zu sehen, wann er eingesetzt wird und was er kommuniziert." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {chartTypes.map(({ icon: Icon, label, color, when, reads }) => (
                <button key={label} onClick={() => setActiveChartType(activeChartType === label ? null : label)} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 16, border: `1px solid ${activeChartType === label ? color : "var(--color-border, #E8E8E8)"}`, background: activeChartType === label ? color + "10" : "transparent", textAlign: "left", cursor: "pointer", transition: "all 200ms" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: color + "20", flexShrink: 0 }}>
                      <Icon style={{ width: 16, height: 16, color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading, #0A0A0A)" }}>{label}</span>
                  </div>
                  {activeChartType === label ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div>
                        <span style={{ fontSize: 9, fontFamily: "var(--volt-font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted, #999)" }}>Wann nutzen?</span>
                        <p style={{ fontSize: 11, color: "var(--color-text-heading, #0A0A0A)", marginTop: 2 }}>{when}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 9, fontFamily: "var(--volt-font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted, #999)" }}>Was ablesen?</span>
                        <p style={{ fontSize: 11, color: "var(--color-text-heading, #0A0A0A)", marginTop: 2 }}>{reads}</p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 10, color: "var(--color-text-muted, #6B6B6B)", lineHeight: 1.4 }}>{when}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          <section id="charts-kpi" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Kennzahlen" title="KPI-Karten" description="Einzelne Metriken mit Trend-Indikator." insight="Trend-Pfeile zeigen Veraenderung relativ zur Vorperiode" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "Gesamtbesucher", value: "24.8k", change: 12.4, colorBg: "#0A0A0A", colorText: "#FFFFFF", insight: "Organisch getrieben", iconIdx: 0 },
                { label: "Konversionsrate", value: "3.2%", change: -0.8, colorBg: "#E4FF97", colorText: "#0A0A0A", insight: "Checkout optimieren", iconIdx: 1 },
                { label: "Komponenten", value: "16", change: 0, colorBg: "", colorText: "", insight: "Vollstaendige Bibliothek", iconIdx: 2 },
                { label: "Performance", value: "98 pts", change: 3, colorBg: "#1A9E5A", colorText: "#FFFFFF", insight: "Lighthouse Score", iconIdx: 3 },
              ].map((kpi) => {
                const icons = [<Users key="u" style={{ width: 16, height: 16 }} />, <Target key="t" style={{ width: 16, height: 16 }} />, <Layers key="l" style={{ width: 16, height: 16 }} />, <Zap key="z" style={{ width: 16, height: 16 }} />];
                return (
                  <div key={kpi.label} className="volt-texture" style={{ position: "relative", borderRadius: 16, padding: 20, overflow: "hidden", background: kpi.colorBg || "var(--volt-surface-raised, #fff)", color: kpi.colorText || "var(--color-text-heading, #0A0A0A)", border: !kpi.colorBg ? "1px solid var(--color-border, #E8E8E8)" : "none" }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 96, height: 96, borderRadius: "50%", pointerEvents: "none", background: kpi.colorBg ? "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)" : "radial-gradient(circle, rgba(228,255,151,0.06) 0%, transparent 70%)" }} />
                    <div style={{ position: "relative", zIndex: 10 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontSize: 9, fontFamily: "var(--volt-font-mono)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.6 }}>{kpi.label}</span>
                        <div style={{ width: 28, height: 28, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: kpi.colorBg ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }}>{icons[kpi.iconIdx]}</div>
                      </div>
                      <p style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", marginBottom: 6 }}>{kpi.value}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, color: !kpi.colorBg ? (kpi.change > 0 ? "#1A9E5A" : kpi.change < 0 ? "#E8402A" : "var(--color-text-muted)") : undefined, opacity: kpi.colorBg ? 0.8 : 1 }}>
                        {kpi.change !== 0 && <TrendingUp style={{ width: 12, height: 12, transform: kpi.change < 0 ? "rotate(180deg)" : "none" }} />}
                        <span style={{ fontSize: 10, fontWeight: 600 }}>{kpi.change > 0 ? "+" : ""}{kpi.change}%</span>
                      </div>
                      <p style={{ fontSize: 10, opacity: 0.5 }}>{kpi.insight}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Zeitreihen */}
          <section id="charts-timeseries" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Zeitreihen" title="Entwicklung ueber Zeit" description="Area Charts zeigen Volumen und Trend. Line Charts eignen sich fuer den Vergleich mehrerer Metriken." badge="Recharts" insight="Faustregel: Area fuer eine Metrik, Line fuer den Vergleich" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <VoltAreaChart data={monthlyData} dataKeys={["Besucher", "Konversionen"]} xKey="name" title="Besucher & Konversionen" subtitle="Area Chart - Jan bis Jul" height={260} />
              <VoltLineChart data={monthlyData} dataKeys={["Besucher", "Umsatz"]} xKey="name" title="Trend-Vergleich" subtitle="Line Chart - Besucher vs. Umsatz" height={260} />
            </div>
          </section>

          {/* Kategorien */}
          <section id="charts-categories" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Kategorien" title="Vergleiche zwischen Gruppen" description="Bar Charts vergleichen diskrete Kategorien. Horizontal eignet sich bei langen Labels." insight="Horizontal-Bars sind lesbarer bei mehr als 5 Kategorien" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <VoltBarChart data={weeklyData} dataKeys={["Design", "Code", "Review"]} xKey="name" title="Woechentliche Aktivitaet" subtitle="Bar Chart - Gruppenvergleich" height={300} />
              <VoltBarChart data={frameworkData} dataKeys={["Nutzung"]} xKey="name" title="Framework-Popularitaet" subtitle="Horizontales Bar Chart" horizontal height={300} />
            </div>
          </section>

          {/* Anteile */}
          <section id="charts-parts" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Anteile" title="Teile eines Ganzen" description="Donut- und Pie-Charts zeigen prozentuale Verteilung." insight="Nicht mehr als 6 Segmente" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <VoltDonutChart data={donutData} title="Komponenten-Nutzung" subtitle="Donut Chart" innerLabel="Gesamt" innerValue={100} height={280} />
              <VoltDonutChart data={donutData} title="Pie Chart (Vollkreis)" subtitle="Ohne Donut-Loch" donut={false} height={280} />
              <VoltStackedAreaChart data={stackedAreaData} dataKeys={["Mobile", "Desktop", "Tablet"]} xKey="name" title="Geraetenutzung" subtitle="Stacked Area" height={280} />
            </div>
          </section>

          {/* Vergleich */}
          <section id="charts-comparison" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Vergleich" title="Multi-dimensionale Analyse" description="Radar Charts fuer den Vergleich mehrerer Dimensionen. Scatter Charts zeigen Korrelationen." insight="Radar: max 8 Achsen - Scatter: min 20 Datenpunkte" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <VoltRadarChartRecharts data={radarData} dataKeys={["A", "B"]} angleKey="subject" title="Performance-Radar" subtitle="Radar Chart - Projekt A vs. B" height={300} />
              <VoltScatterChart data={scatterData} title="Korrelations-Analyse" subtitle="Scatter Chart - Reichweite vs. Engagement" xLabel="Reichweite" yLabel="Engagement" height={300} />
            </div>
          </section>

          {/* Pipeline */}
          <section id="charts-pipeline" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Pipeline" title="Prozesse und Fortschritt" description="Funnel Charts visualisieren Conversion-Prozesse. Radial Bar Charts zeigen Fortschritt je Kategorie." insight="Funnel: Verlust zwischen Stufen ist oft wichtiger als absolute Zahlen" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <VoltFunnelChart data={funnelData} title="Sales Funnel" subtitle="10.000 Besucher zu 620 Kunden (6.2%)" height={300} />
              <VoltRadialBarChart data={radialData} title="Fortschritt je Kategorie" subtitle="Radial Bar - Ringfoermig" height={300} />
              <VoltComposedChart data={composedData} barKeys={["Budget", "Ausgaben"]} lineKeys={["Effizienz"]} xKey="name" title="Budget vs. Effizienz" subtitle="Composed Chart - Bar + Line" height={300} />
            </div>
          </section>

          {/* Trends */}
          <section id="charts-trends" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Trends" title="Langzeit-Trends mit Zielwert" description="Trend Charts mit Referenzlinie zeigen sofort: Liegt die Metrik ueber oder unter dem Ziel?" insight="Referenzlinien machen Abweichungen sofort sichtbar" />
            <VoltTrendChart data={trendData} dataKeys={["v1", "v2", "v3"]} xKey="name" title="Multi-Trend Vergleich" subtitle="3 Metriken ueber 8 Wochen - Referenzlinie bei 500" showReferenceLine={500} height={280} />
          </section>

          {/* Stacked */}
          <section id="charts-stacked" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Gestapelt" title="Zusammensetzung je Kategorie" description="Stacked Charts zeigen sowohl den Gesamtwert als auch die Zusammensetzung." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <VoltStackedAreaChart data={stackedAreaData} dataKeys={["Mobile", "Desktop", "Tablet"]} xKey="name" title="Geraete ueber Zeit" subtitle="Stacked Area" height={260} />
              <VoltStackedBarChart data={weeklyData} dataKeys={["Design", "Code", "Review"]} xKey="name" title="Aufgaben-Verteilung" subtitle="Stacked Bar" height={260} />
            </div>
          </section>

          {/* Data Table */}
          <section id="charts-table" style={{ marginBottom: 40 }}>
            <SubSectionHeader number="Tabellen" title="Strukturierte Daten" description="Tabellen sind ideal wenn genaue Werte wichtig sind." insight="Chart fuer Trends, Tabelle fuer exakte Werte" />
            <VoltTable<{ name: string; version: string; status: string; downloads: string; updated: string }> columns={[
              { key: "name", header: "Komponente", render: (v) => <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 12, fontWeight: 600 }}>{String(v)}</span> },
              { key: "version", header: "Version", render: (v) => <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 12, color: "var(--color-text-muted)" }}>{String(v)}</span> },
              { key: "status", header: "Status", render: (v) => <VoltBadge variant={String(v) === "stable" ? "positive" : "neutral"} size="sm" dot>{String(v)}</VoltBadge> },
              { key: "downloads", header: "Downloads", align: "right", render: (v) => <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 12, fontWeight: 600 }}>{String(v)}</span> },
              { key: "updated", header: "Aktualisiert", align: "right", render: (v) => <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{String(v)}</span> },
            ]} data={[
              { name: "VoltButton", version: "2.0.0", status: "stable", downloads: "12.4k", updated: "heute" },
              { name: "VoltCard", version: "2.0.0", status: "stable", downloads: "9.8k", updated: "heute" },
              { name: "VoltInput", version: "2.0.0", status: "stable", downloads: "8.2k", updated: "heute" },
              { name: "VoltModal", version: "2.0.0", status: "stable", downloads: "6.5k", updated: "heute" },
              { name: "VoltChart", version: "2.0.0", status: "beta", downloads: "4.1k", updated: "heute" },
              { name: "VoltTable", version: "2.0.0", status: "stable", downloads: "3.7k", updated: "heute" },
            ]} hoverable striped caption="Volt UI Komponenten - Version 2.0.0" />
          </section>

          {/* ================================================================ VISUALISIERUNG (D3) ================================================================ */}
          <Section id="bubble-map" title="VoltBubbleMap" description={de ? "D3 Force-Layout Blasen-Visualisierung." : "D3 force-layout bubble visualization."}>
            <VoltBubbleMap title={de ? "Trend-Landschaft" : "Trend Landscape"} subtitle={de ? "Signalstaerke nach Themenfeld" : "Signal strength by topic"} height={360} nodes={[
              { id: "1", label: "AI Regulation", value: 85, category: "Tech" },
              { id: "2", label: "Quantum", value: 62, category: "Tech" },
              { id: "3", label: "Digital Euro", value: 48, category: "Finance" },
              { id: "4", label: "Climate Risk", value: 72, category: "Climate" },
              { id: "5", label: "Supply Chain", value: 55, category: "Geo" },
              { id: "6", label: "Cybersecurity", value: 68, category: "Tech" },
              { id: "7", label: "Energy Transition", value: 45, category: "Climate" },
              { id: "8", label: "Chip Wars", value: 58, category: "Geo" },
            ]} categories={["Tech", "Finance", "Climate", "Geo"]} accentThreshold={70} showStats />
          </Section>

          <Section id="radar-chart" title="VoltRadarChart" description={de ? "D3 Quadranten-Blasen-Radar." : "D3 quadrant bubble radar."}>
            <VoltRadarChart title={de ? "Technologie-Radar" : "Technology Radar"} subtitle={de ? "Bewertungsmatrix" : "Assessment Matrix"} height={400} quadrants={[
              de ? "Beobachten - Langfristig" : "Monitor - Long-term",
              de ? "Uebernehmen - Langfristig" : "Adopt - Long-term",
              de ? "Beobachten - Kurzfristig" : "Monitor - Short-term",
              de ? "Uebernehmen - Kurzfristig" : "Adopt - Short-term",
            ]} bubbles={[
              { id: "1", label: "LLM Agents", x: 0.3, y: 0.8, influence: 80, confidence: 0.9, horizon: "Kurz" },
              { id: "2", label: "Quantum ML", x: 0.85, y: 0.3, influence: 50, confidence: 0.4, horizon: "Lang" },
              { id: "3", label: "Edge AI", x: 0.2, y: 0.6, influence: 65, confidence: 0.7, horizon: "Kurz" },
              { id: "4", label: "Digital Twin", x: 0.6, y: 0.7, influence: 55, confidence: 0.65, horizon: "Mittel" },
              { id: "5", label: "Neuromorphic", x: 0.9, y: 0.2, influence: 35, confidence: 0.3, horizon: "Lang" },
              { id: "6", label: "AI Governance", x: 0.15, y: 0.9, influence: 70, confidence: 0.85, horizon: "Kurz" },
            ]} />
          </Section>

          {/* ================================================================ CANVAS ================================================================ */}
          <Section id="node-canvas" title="VoltNodeCanvas" description={de ? "Interaktiver Node-Canvas mit Drag & Drop, Zoom, Edges." : "Interactive node canvas with drag & drop, zoom, edges."}>
            <VoltNodeCanvas height={400} showGrid nodes={[
              { id: "n1", type: "trigger", x: 60, y: 60, label: "API Trigger", status: "success" },
              { id: "n2", type: "transform", x: 320, y: 40, label: "Parse Data", status: "idle" },
              { id: "n3", type: "generator", x: 300, y: 180, label: "Analyse", status: "running" },
              { id: "n4", type: "decision", x: 560, y: 100, label: "Filter", status: "idle" },
              { id: "n5", type: "output", x: 560, y: 260, label: "Report", status: "idle" },
            ]} edges={[
              { id: "e1", from: "n1", to: "n2", animated: true, style: "bezier" },
              { id: "e2", from: "n2", to: "n3", style: "bezier" },
              { id: "e3", from: "n2", to: "n4", style: "bezier" },
              { id: "e4", from: "n3", to: "n5", style: "bezier" },
              { id: "e5", from: "n4", to: "n5", animated: true, style: "bezier" },
            ]} />
          </Section>

          {/* ================================================================ DISPLAY ================================================================ */}
          <Section id="terminal" title="VoltTerminal" description={de ? "Terminal-Emulator mit macOS-Fenster-Buttons." : "Terminal emulator with macOS window buttons."}>
            <VoltTerminalStatic title="sis-monitor" variant="dark" size="md" lines={[
              { type: "command", text: "$ sis scan --sources all" },
              { type: "info", text: "Scanning 12 data sources..." },
              { type: "success", text: "ok 247 signals found" },
              { type: "warning", text: "warn 3 sources unreachable (timeout)" },
              { type: "output", text: "Top signal: AI Regulation EU -- Score 94/100" },
              { type: "command", text: "$ sis export --format json" },
              { type: "success", text: "ok Report exported" },
            ]} />
          </Section>

          <Section id="code-block" title="VoltCodeBlock" description={de ? "Code-Anzeige mit Copy-to-Clipboard." : "Code display with copy-to-clipboard."}>
            <VoltCodeBlock code={`import { VoltButton } from "@/components/volt";\n\n<VoltButton variant="primary" size="md">\n  Click me\n</VoltButton>`} language="tsx" label="VoltButton" />
          </Section>

          <Section id="sidebar" title="VoltSidebar" description={de ? "Navigation-Sidebar mit Sektionen und Badges." : "Navigation sidebar with sections and badges."}>
            <div style={{ maxWidth: 280, border: "1px solid var(--color-border, #E8E8E8)", borderRadius: 12, overflow: "hidden" }}>
              <VoltSidebar activeId="overview" sections={[
                { title: de ? "Analyse" : "Analysis", items: [
                  { id: "overview", label: de ? "Uebersicht" : "Overview", icon: <BarChart3 className="w-4 h-4" />, badge: "3" },
                  { id: "trends", label: "Trends", icon: <TrendingUp className="w-4 h-4" />, isNew: true },
                  { id: "signals", label: "Signals", icon: <Zap className="w-4 h-4" />, count: 47 },
                ]},
                { title: de ? "Quellen" : "Sources", items: [
                  { id: "global", label: "Global", icon: <Globe className="w-4 h-4" /> },
                  { id: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
                ]},
              ]} />
            </div>
          </Section>

          <Section id="cursor" title="VoltCursor" description={de ? "Terminal-Cursor mit blinkendem Balken. 6 Groessen, 4 Farben." : "Terminal cursor. 6 sizes, 4 colors."}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
              {(["xs", "sm", "md", "lg"] as const).map(s => (
                <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <VoltCursor size={s} color="black" />
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", marginTop: 20, padding: 16, borderRadius: 8, background: "#111" }}>
              <VoltCursor size="sm" color="lime" /><VoltCursor size="md" color="lime" /><VoltCursor size="lg" color="white" />
            </div>
          </Section>

          {/* ================================================================ MISC ================================================================ */}
          <Section id="kbd" title="VoltKbd" description={de ? "Tastatur-Kuerzel Anzeige." : "Keyboard shortcut display."}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><VoltKbd>{"\u2318"}</VoltKbd> + <VoltKbd>K</VoltKbd><span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>Command Bar</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><VoltKbd>Esc</VoltKbd><span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "Schliessen" : "Close"}</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><VoltKbd>{"\u2318"}</VoltKbd> + <VoltKbd>S</VoltKbd><span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "Speichern" : "Save"}</span></span>
            </div>
          </Section>

          <Section id="tooltip" title="VoltTooltip" description={de ? "Kontextueller Tooltip bei Hover." : "Contextual tooltip on hover."}>
            <div style={{ display: "flex", gap: 16 }}>
              <VoltTooltip content={de ? "Datenquellen aktualisieren" : "Refresh data sources"}><VoltButton variant="outline" size="sm">{de ? "Hover mich" : "Hover me"}</VoltButton></VoltTooltip>
              <VoltTooltip content={de ? "Neue Analyse starten" : "Start new analysis"} side="bottom"><VoltBadge variant="positive" dot>Active</VoltBadge></VoltTooltip>
            </div>
          </Section>

          <Section id="icons" title={de ? "Icon-Bibliothek" : "Icon Library"} description={de ? "89 SVG-Icons: Analyse-Methoden, Datenquellen und Skeuomorphic." : "89 SVG icons."}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--volt-font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 10 }}>{de ? "Analyse-Methoden" : "Analysis Methods"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {[
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/marktanalyse/marktanalyse-layout-grid.svg", label: "Marktanalyse" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/war-gaming/war-gaming-swords.svg", label: "War-Gaming" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/pre-mortem/pre-mortem-triangle-alert.svg", label: "Pre-Mortem" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/post-mortem/post-mortem-search.svg", label: "Post-Mortem" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/trend-deep-dive/trend-deep-dive-microscope.svg", label: "Deep-Dive" },
                  { src: "/icons/volt/quellen-methoden/analyse-methoden/stakeholder/stakeholder-users-round.svg", label: "Stakeholder" },
                ].map(icon => (
                  <div key={icon.src} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 8, border: "1px solid var(--color-border, #E8E8E8)", background: "var(--color-surface, #FAFAFA)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.src} alt={icon.label} width={24} height={24} style={{ opacity: 0.75 }} />
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.2 }}>{icon.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--volt-font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 10 }}>{de ? "Datenquellen (Auswahl)" : "Data Sources (selection)"}</div>
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
                  <div key={icon.src} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 8, border: "1px solid var(--color-border, #E8E8E8)", background: "var(--color-surface, #FAFAFA)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.src} alt={icon.label} width={24} height={24} style={{ opacity: 0.75 }} />
                    <span style={{ fontSize: 9, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.2 }}>{icon.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="skeuomorphic-icons" title="SkeuomorphicIcons" description={de ? "18 skeuomorphe 3D-Icons im macOS-Stil." : "18 skeuomorphic 3D icons."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 12 }}>
              {SKEU_ICONS.map(({ id, label, Component }) => (
                <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", borderRadius: 10, border: "1px solid var(--color-border, #E8E8E8)", background: "var(--color-surface, #FAFAFA)" }}>
                  <Component size={48} />
                  <span style={{ fontSize: 9, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
                </div>
              ))}
            </div>
          </Section>

        </main>
      </div>
      <VoltToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
