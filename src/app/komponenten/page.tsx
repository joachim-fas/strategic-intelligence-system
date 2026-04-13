"use client";

import { useState, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { Search, Mail, Eye, EyeOff, Settings, Trash2, Copy, BarChart3, Globe, Zap, Users, TrendingUp } from "lucide-react";
import {
  VoltButton,
  VoltCard, VoltCardHeader, VoltCardTitle, VoltCardDescription, VoltCardContent, VoltCardFooter,
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
  VoltDialog, VoltDialogTrigger, VoltDialogContent, VoltDialogHeader, VoltDialogFooter, VoltDialogTitle, VoltDialogDescription,
  VoltDropdownMenu, VoltDropdownMenuTrigger, VoltDropdownMenuContent, VoltDropdownMenuItem, VoltDropdownMenuLabel, VoltDropdownMenuSeparator, VoltDropdownMenuShortcut, VoltDropdownMenuCheckboxItem,
  VoltDropdownSelect, VoltDropdownSelectTrigger, VoltDropdownSelectContent, VoltDropdownSelectItem, VoltDropdownSelectLabel, VoltDropdownSelectSeparator,
  VoltEmpty, VoltEmptyTitle, VoltEmptyDescription,
  VoltFieldSet, VoltField, VoltFieldLabel, VoltFieldDescription, VoltFieldError,
  VoltInputGroup, VoltInputGroupAddon, VoltInputGroupInput,
  VoltLabel,
  VoltPopover, VoltPopoverTrigger, VoltPopoverContent,
  VoltScrollArea,
  VoltSheet, VoltSheetTrigger, VoltSheetContent, VoltSheetHeader, VoltSheetTitle, VoltSheetDescription,
  VoltSkeleton,
  VoltSpinner,
  VoltToggleGroup, VoltToggleGroupItem,
  VoltCommandBar,
  // Charts (recharts)
  VoltAreaChart, VoltBarChart, VoltLineChart, VoltDonutChart,
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
import { VoltKbd } from "@/components/volt/VoltKbd";
import { VoltSeparator } from "@/components/volt/VoltSeparator";
import {
  VoltTableRoot, VoltTableHeader, VoltTableBody, VoltTableRow, VoltTableHead, VoltTableCell,
} from "@/components/volt/VoltTablePrimitive";

/* ── Showcase Section wrapper ── */
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

/* ── Inline code display ── */
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

/* ── Category label ── */
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

/* ── Table of contents nav ── */
const TOC = [
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
    { id: "dropdown-select", label: "DropdownSelect" },
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
    { id: "command-bar", label: "CommandBar" },
  ]},
  { cat: "Data", items: [
    { id: "stats", label: "Stat" },
    { id: "table", label: "Table" },
    { id: "table-primitive", label: "TablePrimitive" },
    { id: "ranked-list", label: "RankedList" },
    { id: "trend-card", label: "TrendCard" },
    { id: "avatar", label: "Avatar" },
  ]},
  { cat: "Charts", items: [
    { id: "charts", label: "Charts" },
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

export default function KomponentenPage() {
  const { locale } = useLocale();
  const de = locale === "de";

  /* ── State ── */
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

  const fireToast = useCallback((variant: "success" | "error" | "info" | "warning") => {
    const msgs: Record<string, { title: string; description: string }> = {
      success: { title: de ? "Gespeichert" : "Saved", description: de ? "Änderungen wurden übernommen." : "Changes have been applied." },
      error:   { title: "Error", description: de ? "Verbindung fehlgeschlagen." : "Connection failed." },
      info:    { title: "Info", description: de ? "Neue Daten verfügbar." : "New data available." },
      warning: { title: "Warning", description: de ? "API-Limit bei 90%." : "API limit at 90%." },
    };
    addToast({ variant, ...msgs[variant] });
  }, [de, addToast]);

  return (
    <>
      <AppHeader />
      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto", padding: "32px 32px 120px", gap: 40 }}>
        {/* ── Sidebar TOC ── */}
        <nav style={{ width: 180, flexShrink: 0, position: "sticky", top: 80, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 1, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
            textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 8,
          }}>Komponenten</div>
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

        {/* ── Main content ── */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Page header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: "rgba(228,255,151,0.3)", border: "1px solid rgba(228,255,151,0.5)", fontSize: 11, fontWeight: 600, color: "#5A6B20", marginBottom: 12, fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", letterSpacing: "0.05em" }}>
              VOLT UI · 44 COMPONENTS
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

          {/* ╔══════════════════════════════════════════╗
             ║  ACTIONS                                  ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="buttons" title="VoltButton" description={de ? "Primär-Aktion mit Ripple-Effekt, Shimmer-Sweep und Magnetic-Lift. 8 Varianten, 5 Größen." : "Primary action with ripple, shimmer sweep and magnetic lift. 8 variants, 5 sizes."}>
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
            <CodeSnippet code={`<VoltButton variant="primary" size="md" leftIcon={<Search />}>Suchen</VoltButton>
<VoltButton variant="destructive" loading>Loading...</VoltButton>`} />
          </Section>

          <Section id="badges" title="VoltBadge" description={de ? "Status-Labels mit Kontrast-Garantie. Signal-Farben für semantische Zustände." : "Status labels with contrast guarantee. Signal colors for semantic states."}>
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
            <CodeSnippet code={`<VoltBadge variant="positive" dot>Aktiv</VoltBadge>`} />
          </Section>

          <Section id="toggles" title="VoltToggle · VoltCheckbox · VoltRadioGroup" description={de ? "An/Aus-Schalter, Checkboxen und Radio-Buttons." : "Toggle switches, checkboxes and radio buttons."}>
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
              <VoltRadioGroup
                name="demo-radio"
                value={radioValue}
                onValueChange={setRadioValue}
                options={[
                  { value: "option1", label: "Anthropic Claude", description: "GPT-Alternative" },
                  { value: "option2", label: "OpenAI GPT-4o", description: "Multimodal" },
                  { value: "option3", label: "Google Gemini", description: "Large context" },
                ]}
              />
            </div>
            <CodeSnippet code={`<VoltToggle checked={on} onChange={() => setOn(!on)} />
<VoltCheckbox label="Auto-Sync" checked={checked} onChange={toggle} />
<VoltRadioGroup name="model" options={[...]} onValueChange={setValue} />`} />
          </Section>

          <Section id="toggle-group" title="VoltToggleGroup" description={de ? "Gruppierte Toggle-Buttons (single oder multiple Auswahl)." : "Grouped toggle buttons (single or multiple selection)."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <VoltToggleGroup type="single" value={toggleGroupValue} onValueChange={v => typeof v === "string" && setToggleGroupValue(v)}>
                <VoltToggleGroupItem value="left">Links</VoltToggleGroupItem>
                <VoltToggleGroupItem value="center">Mitte</VoltToggleGroupItem>
                <VoltToggleGroupItem value="right">Rechts</VoltToggleGroupItem>
              </VoltToggleGroup>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{de ? "Ausgewählt" : "Selected"}: {toggleGroupValue}</span>
            </div>
            <CodeSnippet code={`<VoltToggleGroup type="single" value={value} onValueChange={setValue}>
  <VoltToggleGroupItem value="left">Links</VoltToggleGroupItem>
  <VoltToggleGroupItem value="center">Mitte</VoltToggleGroupItem>
</VoltToggleGroup>`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  LAYOUT                                   ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="cards" title="VoltCard" description={de ? "Container-Komponente mit 7 Varianten. Tiefe durch Farbe und Borders." : "Container component with 7 variants. Depth through color and borders."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {(["default", "elevated", "interactive", "subtle", "outlined"] as const).map(v => (
                <VoltCard key={v} variant={v}>
                  <VoltCardHeader><VoltCardTitle>{v}</VoltCardTitle><VoltCardDescription>{de ? "Karten-Variante" : "Card variant"}</VoltCardDescription></VoltCardHeader>
                  <VoltCardContent><p className="text-sm text-muted-foreground">Content</p></VoltCardContent>
                </VoltCard>
              ))}
            </div>
            <CodeSnippet code={`<VoltCard variant="elevated">
  <VoltCardHeader>
    <VoltCardTitle>Titel</VoltCardTitle>
    <VoltCardDescription>Beschreibung</VoltCardDescription>
  </VoltCardHeader>
  <VoltCardContent>Inhalt</VoltCardContent>
  <VoltCardFooter>Footer</VoltCardFooter>
</VoltCard>`} />
          </Section>

          <Section id="accordion" title="VoltAccordion" description={de ? "Ausklappbare Inhaltsbereiche. Single- oder Multi-Mode." : "Collapsible content sections. Single or multi mode."}>
            <VoltAccordion type="single" collapsible>
              <VoltAccordionItem value="item-1">
                <VoltAccordionTrigger>{de ? "Was ist SIS?" : "What is SIS?"}</VoltAccordionTrigger>
                <VoltAccordionContent>{de ? "SIS ist ein Strategic Intelligence System für Trend-Analyse und Szenario-Planung." : "SIS is a Strategic Intelligence System for trend analysis and scenario planning."}</VoltAccordionContent>
              </VoltAccordionItem>
              <VoltAccordionItem value="item-2">
                <VoltAccordionTrigger>{de ? "Welche Datenquellen?" : "Which data sources?"}</VoltAccordionTrigger>
                <VoltAccordionContent>{de ? "News, Forschung, Finanzmärkte, Geopolitik, Patente, Social Media und mehr." : "News, research, financial markets, geopolitics, patents, social media and more."}</VoltAccordionContent>
              </VoltAccordionItem>
              <VoltAccordionItem value="item-3">
                <VoltAccordionTrigger>{de ? "Wie funktioniert der Canvas?" : "How does the Canvas work?"}</VoltAccordionTrigger>
                <VoltAccordionContent>{de ? "Der Canvas ist ein node-basierter Workspace für visuelle Analyse mit Query-Nodes und abgeleiteten Erkenntnissen." : "The Canvas is a node-based workspace for visual analysis with query nodes and derived insights."}</VoltAccordionContent>
              </VoltAccordionItem>
            </VoltAccordion>
            <CodeSnippet code={`<VoltAccordion type="single" collapsible>
  <VoltAccordionItem value="faq-1">
    <VoltAccordionTrigger>Frage?</VoltAccordionTrigger>
    <VoltAccordionContent>Antwort.</VoltAccordionContent>
  </VoltAccordionItem>
</VoltAccordion>`} />
          </Section>

          <Section id="separator" title="VoltSeparator" description={de ? "Visuelle Trennung — horizontal und vertikal." : "Visual divider — horizontal and vertical."}>
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

          <Section id="skeleton" title="VoltSkeleton" description={de ? "Lade-Platzhalter mit Puls-Animation." : "Loading placeholder with pulse animation."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VoltSkeleton className="h-10 w-10 rounded-full" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <VoltSkeleton className="h-4 w-3/4" />
                  <VoltSkeleton className="h-3 w-1/2" />
                </div>
              </div>
              <VoltSkeleton className="h-24 w-full rounded-lg" />
              <div style={{ display: "flex", gap: 8 }}>
                <VoltSkeleton className="h-8 w-20 rounded-md" />
                <VoltSkeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
            <CodeSnippet code={`<VoltSkeleton className="h-10 w-10 rounded-full" />
<VoltSkeleton className="h-4 w-3/4" />`} />
          </Section>

          <Section id="spinner" title="VoltSpinner" description={de ? "Lade-Indikator als animierter SVG-Spinner." : "Loading indicator as animated SVG spinner."}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <VoltSpinner className="w-5 h-5" />
              <VoltSpinner className="w-8 h-8" />
              <VoltSpinner className="w-12 h-12" />
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-muted)" }}>
                <VoltSpinner className="w-4 h-4" /> {de ? "Wird geladen..." : "Loading..."}
              </div>
            </div>
            <CodeSnippet code={`<VoltSpinner className="w-8 h-8" />`} />
          </Section>

          <Section id="scroll-area" title="VoltScrollArea" description={de ? "Container mit gestylter Scrollbar." : "Container with styled scrollbar."}>
            <VoltScrollArea className="h-40 w-full rounded-lg border border-border p-4">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--color-border, #eee)" }}>
                    {de ? `Eintrag ${i + 1} — Beispieldaten für Scroll-Demo` : `Entry ${i + 1} — Sample data for scroll demo`}
                  </div>
                ))}
              </div>
            </VoltScrollArea>
            <CodeSnippet code={`<VoltScrollArea className="h-40 w-full rounded-lg border p-4">
  {items.map(item => <div key={item.id}>{item.label}</div>)}
</VoltScrollArea>`} />
          </Section>

          <Section id="empty" title="VoltEmpty" description={de ? "Leerer-Zustand Anzeige mit Icon, Titel und Beschreibung." : "Empty state display with icon, title and description."}>
            <VoltEmpty className="py-8">
              <VoltEmptyTitle>{de ? "Keine Ergebnisse" : "No results"}</VoltEmptyTitle>
              <VoltEmptyDescription>{de ? "Es wurden keine passenden Trends gefunden. Versuche eine andere Suchanfrage." : "No matching trends found. Try a different search query."}</VoltEmptyDescription>
            </VoltEmpty>
            <CodeSnippet code={`<VoltEmpty>
  <VoltEmptyTitle>Keine Ergebnisse</VoltEmptyTitle>
  <VoltEmptyDescription>Andere Suche versuchen.</VoltEmptyDescription>
</VoltEmpty>`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  FORM                                     ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="inputs" title="VoltInput" description={de ? "Text-Eingabe mit 4 Varianten (default/filled/boxed/glass), Label, Fehler- und Hilfetexte." : "Text input with 4 variants, label, error and helper text."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              <VoltInput label={de ? "Suchbegriff" : "Search term"} placeholder={de ? "z.B. Künstliche Intelligenz" : "e.g. Artificial Intelligence"} value={inputValue} onChange={e => setInputValue(e.target.value)} />
              <VoltInput label="E-Mail" type="email" placeholder="name@example.com" hint={de ? "Wird nicht gespeichert." : "Will not be stored."} variant="boxed" />
              <VoltInput label="API Key" error={de ? "Ungültiger API Key" : "Invalid API key"} value="sk-invalid..." onChange={() => {}} state="error" />
              <VoltInput label={de ? "Gefüllt" : "Filled"} placeholder="filled variant" variant="filled" />
            </div>
            <CodeSnippet code={`<VoltInput label="E-Mail" variant="boxed" hint="Optional" />
<VoltInput label="API Key" error="Ungültig" state="error" />`} />
          </Section>

          <Section id="label" title="VoltLabel" description={de ? "Zugängliches Formular-Label." : "Accessible form label."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
              <VoltLabel htmlFor="demo-input">{de ? "Projekt-Name" : "Project name"}</VoltLabel>
              <input id="demo-input" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-foreground transition-colors" placeholder={de ? "z.B. Trend-Radar Q2" : "e.g. Trend Radar Q2"} />
            </div>
            <CodeSnippet code={`<VoltLabel htmlFor="name">Projekt-Name</VoltLabel>
<input id="name" ... />`} />
          </Section>

          <Section id="field" title="VoltField" description={de ? "Formularfeld-Layout mit Label, Beschreibung und Fehlermeldung." : "Form field layout with label, description and error message."}>
            <VoltFieldSet>
              <VoltField>
                <VoltFieldLabel>{de ? "Projektname" : "Project name"}</VoltFieldLabel>
                <VoltFieldDescription>{de ? "Ein eindeutiger Name für das Projekt." : "A unique name for the project."}</VoltFieldDescription>
                <input className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-foreground transition-colors" />
              </VoltField>
              <VoltField>
                <VoltFieldLabel>{de ? "E-Mail" : "Email"}</VoltFieldLabel>
                <input className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-foreground transition-colors border-destructive" />
                <VoltFieldError errors={[{ message: de ? "Ungültige E-Mail-Adresse" : "Invalid email address" }]} />
              </VoltField>
            </VoltFieldSet>
            <CodeSnippet code={`<VoltFieldSet>
  <VoltField>
    <VoltFieldLabel>Name</VoltFieldLabel>
    <VoltFieldDescription>Eindeutiger Name</VoltFieldDescription>
    <input ... />
    <VoltFieldError errors={errors} />
  </VoltField>
</VoltFieldSet>`} />
          </Section>

          <Section id="input-group" title="VoltInputGroup" description={de ? "Input mit Prefix/Suffix-Addons (Icons, Text)." : "Input with prefix/suffix addons (icons, text)."}>
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
            <CodeSnippet code={`<VoltInputGroup>
  <VoltInputGroupAddon><Search /></VoltInputGroupAddon>
  <VoltInputGroupInput placeholder="Suchen..." />
</VoltInputGroup>`} />
          </Section>

          <Section id="dropdown-select" title="VoltDropdownSelect" description={de ? "Dropdown-Auswahl mit Kategorien und Trennern." : "Dropdown select with categories and separators."}>
            <div style={{ maxWidth: 300 }}>
              <VoltDropdownSelect value={selectValue} onValueChange={setSelectValue}>
                <VoltDropdownSelectTrigger placeholder={de ? "Framework wählen..." : "Select framework..."} />
                <VoltDropdownSelectContent>
                  <VoltDropdownSelectLabel>{de ? "Analyse" : "Analysis"}</VoltDropdownSelectLabel>
                  <VoltDropdownSelectItem value="markt">Marktanalyse</VoltDropdownSelectItem>
                  <VoltDropdownSelectItem value="wargame">War-Gaming</VoltDropdownSelectItem>
                  <VoltDropdownSelectItem value="premortem">Pre-Mortem</VoltDropdownSelectItem>
                  <VoltDropdownSelectSeparator />
                  <VoltDropdownSelectLabel>{de ? "Stakeholder" : "Stakeholders"}</VoltDropdownSelectLabel>
                  <VoltDropdownSelectItem value="stakeholder">Stakeholder-Mapping</VoltDropdownSelectItem>
                  <VoltDropdownSelectItem value="deepdive">Trend Deep-Dive</VoltDropdownSelectItem>
                </VoltDropdownSelectContent>
              </VoltDropdownSelect>
              {selectValue && <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>{de ? "Gewählt" : "Selected"}: {selectValue}</p>}
            </div>
            <CodeSnippet code={`<VoltDropdownSelect value={value} onValueChange={setValue}>
  <VoltDropdownSelectTrigger placeholder="Wählen..." />
  <VoltDropdownSelectContent>
    <VoltDropdownSelectItem value="option">Label</VoltDropdownSelectItem>
  </VoltDropdownSelectContent>
</VoltDropdownSelect>`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  FEEDBACK                                 ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="alerts" title="VoltAlert" description={de ? "Kontextuelle Benachrichtigungen: info, success, warning, error." : "Contextual notifications: info, success, warning, error."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <VoltAlert variant="info" title="Info">{de ? "56 Quellen synchronisiert." : "56 sources synchronized."}</VoltAlert>
              <VoltAlert variant="success" title={de ? "Analyse abgeschlossen" : "Analysis complete"}>{de ? "3 Szenarien generiert." : "3 scenarios generated."}</VoltAlert>
              <VoltAlert variant="warning" title="Rate-Limit">{de ? "API-Kontingent bei 85%." : "API quota at 85%."}</VoltAlert>
              {alertVisible && (
                <VoltAlert variant="error" title={de ? "Verbindungsfehler" : "Connection error"} dismissible onDismiss={() => setAlertVisible(false)}>
                  {de ? "API nicht erreichbar." : "API unreachable."}
                </VoltAlert>
              )}
              {!alertVisible && (
                <button onClick={() => setAlertVisible(true)} style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer", background: "none", border: "none", textDecoration: "underline" }}>
                  {de ? "Error-Alert wieder anzeigen" : "Show error alert again"}
                </button>
              )}
            </div>
            <CodeSnippet code={`<VoltAlert variant="success" title="Fertig" dismissible onDismiss={fn}>
  Analyse abgeschlossen.
</VoltAlert>`} />
          </Section>

          <Section id="progress" title="VoltProgress" description={de ? "Fortschrittsanzeige mit Label, Varianten und optionalem Prozentwert." : "Progress bar with label, variants and optional percentage."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
              <VoltProgress value={25} label={de ? "Datenquellen" : "Data sources"} showValue />
              <VoltProgress value={68} label={de ? "Analyse" : "Analysis"} variant="lime" showValue />
              <VoltProgress value={100} label={de ? "Abgeschlossen" : "Complete"} variant="positive" />
              <VoltProgress value={15} label={de ? "Kritisch" : "Critical"} variant="negative" size="lg" showValue />
            </div>
            <CodeSnippet code={`<VoltProgress value={68} label="Analyse" variant="lime" showValue />`} />
          </Section>

          <Section id="toast" title="VoltToast" description={de ? "Temporäre Benachrichtigungen. 4 Varianten: success, error, info, warning." : "Temporary notifications. 4 variants: success, error, info, warning."}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <VoltButton variant="primary" size="sm" onClick={() => fireToast("success")}>Success Toast</VoltButton>
              <VoltButton variant="destructive" size="sm" onClick={() => fireToast("error")}>Error Toast</VoltButton>
              <VoltButton variant="outline" size="sm" onClick={() => fireToast("info")}>Info Toast</VoltButton>
              <VoltButton variant="secondary" size="sm" onClick={() => fireToast("warning")}>Warning Toast</VoltButton>
            </div>
            <CodeSnippet code={`const { toasts, addToast, dismissToast } = useVoltToast();
addToast({ variant: "success", title: "Gespeichert", description: "..." });
<VoltToastContainer toasts={toasts} onDismiss={dismissToast} />`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  OVERLAY                                  ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="dialog" title="VoltDialog" description={de ? "Modaler Dialog mit Trigger, Header, Footer und Close-Button." : "Modal dialog with trigger, header, footer and close button."}>
            <VoltButton variant="outline" onClick={() => setDialogOpen(true)}>{de ? "Dialog öffnen" : "Open Dialog"}</VoltButton>
            <VoltDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <VoltDialogContent>
                <VoltDialogHeader>
                  <VoltDialogTitle>{de ? "Projekt löschen?" : "Delete project?"}</VoltDialogTitle>
                  <VoltDialogDescription>{de ? "Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten werden dauerhaft entfernt." : "This action cannot be undone. All data will be permanently removed."}</VoltDialogDescription>
                </VoltDialogHeader>
                <VoltDialogFooter>
                  <VoltButton variant="outline" onClick={() => setDialogOpen(false)}>{de ? "Abbrechen" : "Cancel"}</VoltButton>
                  <VoltButton variant="destructive" onClick={() => setDialogOpen(false)}>{de ? "Löschen" : "Delete"}</VoltButton>
                </VoltDialogFooter>
              </VoltDialogContent>
            </VoltDialog>
            <CodeSnippet code={`<VoltDialog>
  <VoltDialogTrigger asChild><VoltButton>Öffnen</VoltButton></VoltDialogTrigger>
  <VoltDialogContent>
    <VoltDialogHeader><VoltDialogTitle>Titel</VoltDialogTitle></VoltDialogHeader>
    <VoltDialogFooter>Aktionen</VoltDialogFooter>
  </VoltDialogContent>
</VoltDialog>`} />
          </Section>

          <Section id="modal" title="VoltModal" description={de ? "Einfacher Modal-Wrapper mit Titel, Beschreibung und Footer." : "Simple modal wrapper with title, description and footer."}>
            <VoltButton variant="outline" onClick={() => setModalOpen(true)}>{de ? "Modal öffnen" : "Open Modal"}</VoltButton>
            <VoltModal open={modalOpen} onClose={() => setModalOpen(false)} title={de ? "Einstellungen" : "Settings"} description={de ? "System-Konfiguration anpassen." : "Adjust system configuration."} footer={<VoltButton variant="primary" onClick={() => setModalOpen(false)}>{de ? "Speichern" : "Save"}</VoltButton>}>
              <div style={{ padding: "8px 0", fontSize: 13, color: "var(--color-text-primary)" }}>
                {de ? "Modal-Inhalt mit beliebigen Komponenten." : "Modal content with any components."}
              </div>
            </VoltModal>
            <CodeSnippet code={`<VoltModal open={open} onClose={close} title="Einstellungen" footer={<VoltButton>OK</VoltButton>}>
  Inhalt
</VoltModal>`} />
          </Section>

          <Section id="sheet" title="VoltSheet" description={de ? "Seitliches Panel (Drawer) — top/right/bottom/left." : "Side panel (drawer) — top/right/bottom/left."}>
            <VoltButton variant="outline" onClick={() => setSheetOpen(true)}>{de ? "Sheet öffnen" : "Open Sheet"}</VoltButton>
            <VoltSheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <VoltSheetContent side="right">
                <VoltSheetHeader>
                  <VoltSheetTitle>{de ? "Filter" : "Filters"}</VoltSheetTitle>
                  <VoltSheetDescription>{de ? "Ergebnisse eingrenzen." : "Narrow down results."}</VoltSheetDescription>
                </VoltSheetHeader>
                <div style={{ padding: 16, fontSize: 13 }}>
                  {de ? "Sheet-Inhalt — ideal für Filter, Einstellungen oder Detail-Ansichten." : "Sheet content — ideal for filters, settings or detail views."}
                </div>
              </VoltSheetContent>
            </VoltSheet>
            <CodeSnippet code={`<VoltSheet>
  <VoltSheetTrigger asChild><VoltButton>Öffnen</VoltButton></VoltSheetTrigger>
  <VoltSheetContent side="right">
    <VoltSheetHeader><VoltSheetTitle>Filter</VoltSheetTitle></VoltSheetHeader>
    Inhalt
  </VoltSheetContent>
</VoltSheet>`} />
          </Section>

          <Section id="popover" title="VoltPopover" description={de ? "Floating-Panel für zusätzliche Inhalte." : "Floating panel for additional content."}>
            <VoltPopover>
              <VoltPopoverTrigger asChild>
                <VoltButton variant="outline">{de ? "Popover öffnen" : "Open Popover"}</VoltButton>
              </VoltPopoverTrigger>
              <VoltPopoverContent align="start" className="w-72 p-4">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{de ? "Schnellinfo" : "Quick info"}</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{de ? "Popovers eignen sich für kontextuelle Informationen und kleine Formulare." : "Popovers are great for contextual information and small forms."}</span>
                </div>
              </VoltPopoverContent>
            </VoltPopover>
            <CodeSnippet code={`<VoltPopover>
  <VoltPopoverTrigger asChild><VoltButton>Info</VoltButton></VoltPopoverTrigger>
  <VoltPopoverContent>Inhalt</VoltPopoverContent>
</VoltPopover>`} />
          </Section>

          <Section id="dropdown-menu" title="VoltDropdownMenu" description={de ? "Dropdown-Menü mit Items, Checkboxen, Labels und Shortcuts." : "Dropdown menu with items, checkboxes, labels and shortcuts."}>
            <VoltDropdownMenu>
              <VoltDropdownMenuTrigger>
                {de ? "Aktionen" : "Actions"} <span style={{ fontSize: 10 }}>▾</span>
              </VoltDropdownMenuTrigger>
              <VoltDropdownMenuContent align="start">
                <VoltDropdownMenuLabel>{de ? "Optionen" : "Options"}</VoltDropdownMenuLabel>
                <VoltDropdownMenuItem><Settings className="w-4 h-4 mr-2" /> {de ? "Einstellungen" : "Settings"}<VoltDropdownMenuShortcut>⌘S</VoltDropdownMenuShortcut></VoltDropdownMenuItem>
                <VoltDropdownMenuItem><Copy className="w-4 h-4 mr-2" /> {de ? "Kopieren" : "Copy"}<VoltDropdownMenuShortcut>⌘C</VoltDropdownMenuShortcut></VoltDropdownMenuItem>
                <VoltDropdownMenuSeparator />
                <VoltDropdownMenuCheckboxItem checked={ddCheckA} onCheckedChange={setDdCheckA}>Auto-Save</VoltDropdownMenuCheckboxItem>
                <VoltDropdownMenuCheckboxItem checked={ddCheckB} onCheckedChange={setDdCheckB}>Notifications</VoltDropdownMenuCheckboxItem>
                <VoltDropdownMenuSeparator />
                <VoltDropdownMenuItem variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> {de ? "Löschen" : "Delete"}</VoltDropdownMenuItem>
              </VoltDropdownMenuContent>
            </VoltDropdownMenu>
            <CodeSnippet code={`<VoltDropdownMenu>
  <VoltDropdownMenuTrigger asChild><VoltButton>Menü</VoltButton></VoltDropdownMenuTrigger>
  <VoltDropdownMenuContent>
    <VoltDropdownMenuItem>Aktion</VoltDropdownMenuItem>
    <VoltDropdownMenuCheckboxItem checked={on} onCheckedChange={set}>Toggle</VoltDropdownMenuCheckboxItem>
  </VoltDropdownMenuContent>
</VoltDropdownMenu>`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  NAVIGATION                               ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="tabs" title="VoltTabs" description={de ? "Tab-Navigation mit 4 Varianten: underline, pills, glass, boxed." : "Tab navigation with 4 variants: underline, pills, glass, boxed."}>
            <VoltTabs
              tabs={[
                { id: "tab1", label: de ? "Übersicht" : "Overview" },
                { id: "tab2", label: "Details" },
                { id: "tab3", label: de ? "Einstellungen" : "Settings" },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "var(--color-surface, #F7F7F7)", fontSize: 13 }}>
              {activeTab === "tab1" && (de ? "Zusammenfassung aller Metriken." : "Summary of all metrics.")}
              {activeTab === "tab2" && (de ? "Aufschlüsselung nach Kategorien." : "Breakdown by categories.")}
              {activeTab === "tab3" && (de ? "Konfiguration und Präferenzen." : "Configuration and preferences.")}
            </div>
            <CodeSnippet code={`<VoltTabs variant="pills"
  tabs={[{ id: "a", label: "Tab A" }, { id: "b", label: "Tab B" }]}
  activeTab={active} onTabChange={setActive}
/>`} />
          </Section>

          <Section id="breadcrumb" title="VoltBreadcrumb" description={de ? "Breadcrumb-Navigation mit Trennern." : "Breadcrumb navigation with separators."}>
            <VoltBreadcrumb>
              <VoltBreadcrumbList>
                <VoltBreadcrumbItem><VoltBreadcrumbLink href="/">Home</VoltBreadcrumbLink></VoltBreadcrumbItem>
                <VoltBreadcrumbSeparator />
                <VoltBreadcrumbItem><VoltBreadcrumbLink href="/canvas">Canvas</VoltBreadcrumbLink></VoltBreadcrumbItem>
                <VoltBreadcrumbSeparator />
                <VoltBreadcrumbItem><VoltBreadcrumbPage>{de ? "Analyse" : "Analysis"}</VoltBreadcrumbPage></VoltBreadcrumbItem>
              </VoltBreadcrumbList>
            </VoltBreadcrumb>
            <CodeSnippet code={`<VoltBreadcrumb>
  <VoltBreadcrumbList>
    <VoltBreadcrumbItem><VoltBreadcrumbLink href="/">Home</VoltBreadcrumbLink></VoltBreadcrumbItem>
    <VoltBreadcrumbSeparator />
    <VoltBreadcrumbItem><VoltBreadcrumbPage>Aktuell</VoltBreadcrumbPage></VoltBreadcrumbItem>
  </VoltBreadcrumbList>
</VoltBreadcrumb>`} />
          </Section>

          <Section id="command-bar" title="VoltCommandBar" description={de ? "AI-Eingabefeld mit Vorschlägen und Aktionen." : "AI input field with suggestions and actions."}>
            <div style={{ maxWidth: 600 }}>
              <VoltCommandBar
                placeholder={de ? "Frag mich etwas..." : "Ask me something..."}
                onSubmit={(v) => fireToast("info")}
                suggestions={[
                  { label: de ? "Trend-Analyse starten" : "Start trend analysis" },
                  { label: de ? "Quellen synchronisieren" : "Sync sources" },
                ]}
              />
            </div>
            <CodeSnippet code={`<VoltCommandBar
  placeholder="Frag mich..."
  onSubmit={handleSubmit}
  suggestions={[{ label: "Analyse starten", value: "analyze" }]}
/>`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  DATA                                     ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="stats" title="VoltStat" description={de ? "KPI-Anzeige mit Label, Wert, Trend und Varianten." : "KPI display with label, value, trend and variants."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <VoltStat label={de ? "Quellen" : "Sources"} value="56" />
              <VoltStat label="Trends" value="40" change={12} changeLabel="vs Q1" />
              <VoltStat label={de ? "Analysen" : "Analyses"} value="128" change={-3} />
              <VoltStat label="Confidence" value="87%" variant="lime" />
            </div>
            <CodeSnippet code={`<VoltStat label="Trends" value="40" change={12} changeLabel="vs Q1" variant="lime" />`} />
          </Section>

          <Section id="table" title="VoltTable" description={de ? "Daten-Tabelle mit Sortierung, Striping und Custom-Rendering." : "Data table with sorting, striping and custom rendering."}>
            <VoltTable
              columns={[
                { key: "name", header: "Trend" },
                { key: "category", header: de ? "Kategorie" : "Category" },
                { key: "confidence", header: "Confidence", align: "right" as const, render: (v: unknown) => <VoltBadge size="sm" variant={Number(v) > 70 ? "positive" : "neutral"}>{String(v)}%</VoltBadge> },
                { key: "signals", header: "Signals", align: "right" as const },
              ]}
              data={[
                { name: "AI Regulation", category: "MAKRO", confidence: 85, signals: 42 },
                { name: "Quantum Computing", category: "MEGA", confidence: 62, signals: 28 },
                { name: "Digital Euro", category: "MAKRO", confidence: 78, signals: 35 },
                { name: "Space Economy", category: "MEGA", confidence: 45, signals: 19 },
              ]}
              striped
              hoverable
            />
            <CodeSnippet code={`<VoltTable
  columns={[{ key: "name", header: "Name" }, { key: "value", header: "Wert", align: "right" }]}
  data={[{ name: "AI", value: 85 }]}
  striped hoverable
/>`} />
          </Section>

          <Section id="table-primitive" title="VoltTablePrimitive" description={de ? "Zusammensetzbare Tabellen-Bausteine für volle Kontrolle." : "Composable table building blocks for full control."}>
            <VoltTableRoot>
              <VoltTableHeader>
                <VoltTableRow>
                  <VoltTableHead>ID</VoltTableHead>
                  <VoltTableHead>{de ? "Quelle" : "Source"}</VoltTableHead>
                  <VoltTableHead className="text-right">Status</VoltTableHead>
                </VoltTableRow>
              </VoltTableHeader>
              <VoltTableBody>
                <VoltTableRow><VoltTableCell>001</VoltTableCell><VoltTableCell>Reuters</VoltTableCell><VoltTableCell className="text-right"><VoltBadge variant="positive" size="sm">OK</VoltBadge></VoltTableCell></VoltTableRow>
                <VoltTableRow><VoltTableCell>002</VoltTableCell><VoltTableCell>PubMed</VoltTableCell><VoltTableCell className="text-right"><VoltBadge variant="positive" size="sm">OK</VoltBadge></VoltTableCell></VoltTableRow>
                <VoltTableRow><VoltTableCell>003</VoltTableCell><VoltTableCell>arXiv</VoltTableCell><VoltTableCell className="text-right"><VoltBadge variant="negative" size="sm">Error</VoltBadge></VoltTableCell></VoltTableRow>
              </VoltTableBody>
            </VoltTableRoot>
            <CodeSnippet code={`<VoltTableRoot>
  <VoltTableHeader><VoltTableRow><VoltTableHead>ID</VoltTableHead></VoltTableRow></VoltTableHeader>
  <VoltTableBody><VoltTableRow><VoltTableCell>001</VoltTableCell></VoltTableRow></VoltTableBody>
</VoltTableRoot>`} />
          </Section>

          <Section id="ranked-list" title="VoltRankedList" description={de ? "Sortierte Rangliste mit Kategorien und Trend-Indikatoren." : "Sorted ranked list with categories and trend indicators."}>
            <div style={{ maxWidth: 500 }}>
              <VoltRankedList
                title={de ? "Top Trends" : "Top Trends"}
                subtitle="Q2 2026"
                showProgressBar
                maxValue={100}
                entries={[
                  { id: "1", label: "AI Regulation", value: 92, category: "makro", trend: "up" as const },
                  { id: "2", label: "Climate Tech", value: 78, category: "mega", trend: "up" as const },
                  { id: "3", label: "Digital Euro", value: 65, category: "makro", trend: "neutral" as const },
                  { id: "4", label: "Quantum", value: 43, category: "mega", trend: "down" as const },
                ]}
              />
            </div>
            <CodeSnippet code={`<VoltRankedList title="Top Trends" showProgressBar
  entries={[{ id: "1", label: "AI", value: 92, trend: "up" }]}
/>`} />
          </Section>

          <Section id="trend-card" title="VoltTrendCard" description={de ? "Trend-Karte mit Status-Dot, Richtung und Signal-Stärke." : "Trend card with status dot, direction and signal strength."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              <VoltTrendCard title="AI Regulation" status="adopt" direction="up" signals={42} confidence={85} category="MAKRO" />
              <VoltTrendCard title="Quantum Computing" status="assess" direction="stable" signals={28} confidence={62} category="MEGA" />
              <VoltTrendCard title="Digital Euro" status="trial" direction="up" signals={35} confidence={78} category="MAKRO" />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Sub-Components:</span>
              <VoltStatusDot label="Adopt" />
              <VoltStatusDot label="Assess" />
              <VoltStatusDot label="Trial" />
              <VoltTrendDirection direction="up" />
              <VoltTrendDirection direction="down" />
              <VoltTrendDirection direction="stable" />
              <VoltSignalBar direction="up" />
            </div>
            <CodeSnippet code={`<VoltTrendCard title="AI" status="adopt" direction="up" signals={42} confidence={85} />
<VoltStatusDot label="Adopt" />
<VoltTrendDirection direction="up" />`} />
          </Section>

          <Section id="avatar" title="VoltAvatar" description={de ? "Benutzer-Avatar mit Bild, Fallback und 4 Größen." : "User avatar with image, fallback and 4 sizes."}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <VoltAvatar size="sm" name="JU" />
              <VoltAvatar size="md" name="SIS" />
              <VoltAvatar size="lg" name="Volt" ring />
              <VoltAvatar size="xl" name="AI" online />
            </div>
            <CodeSnippet code={`<VoltAvatar src="/photo.jpg" alt="User" size="md" name="JU" ring online />`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  CHARTS                                   ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="charts" title="VoltChart" description={de ? "Recharts-basierte Diagramme: Area, Bar, Line, Donut — mit Volt-Styling, Animationen und Live-Badge." : "Recharts-based charts: Area, Bar, Line, Donut — with Volt styling, animations and live badge."}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <VoltAreaChart
                title={de ? "Besucher" : "Visitors"}
                subtitle={de ? "Letzte 7 Tage" : "Last 7 days"}
                data={[
                  { name: "Mon", desktop: 186, mobile: 80 },
                  { name: "Tue", desktop: 305, mobile: 200 },
                  { name: "Wed", desktop: 237, mobile: 120 },
                  { name: "Thu", desktop: 73, mobile: 190 },
                  { name: "Fri", desktop: 209, mobile: 130 },
                  { name: "Sat", desktop: 214, mobile: 140 },
                  { name: "Sun", desktop: 150, mobile: 100 },
                ]}
                dataKeys={["desktop", "mobile"]}
                height={220}
                gradient
              />
              <VoltBarChart
                title={de ? "Umsatz" : "Revenue"}
                subtitle="Q1–Q4"
                data={[
                  { name: "Q1", revenue: 4200, cost: 2400 },
                  { name: "Q2", revenue: 3800, cost: 2200 },
                  { name: "Q3", revenue: 5100, cost: 2800 },
                  { name: "Q4", revenue: 6300, cost: 3100 },
                ]}
                dataKeys={["revenue", "cost"]}
                height={220}
              />
              <VoltLineChart
                title={de ? "Signale" : "Signals"}
                subtitle={de ? "Pro Woche" : "Per week"}
                data={[
                  { name: "W1", ai: 42, geo: 28, fin: 15 },
                  { name: "W2", ai: 55, geo: 32, fin: 18 },
                  { name: "W3", ai: 48, geo: 45, fin: 22 },
                  { name: "W4", ai: 72, geo: 38, fin: 30 },
                  { name: "W5", ai: 65, geo: 42, fin: 25 },
                ]}
                dataKeys={["ai", "geo", "fin"]}
                height={220}
              />
              <VoltDonutChart
                title={de ? "Verteilung" : "Distribution"}
                subtitle={de ? "Nach Kategorie" : "By category"}
                data={[
                  { name: "Tech", value: 35 },
                  { name: "Geo", value: 25 },
                  { name: "Finance", value: 20 },
                  { name: "Social", value: 12 },
                  { name: "Climate", value: 8 },
                ]}
                innerLabel="Total"
                innerValue={100}
                height={220}
              />
            </div>
            <CodeSnippet code={`<VoltAreaChart title="Visitors" data={data} dataKeys={["desktop","mobile"]} gradient />
<VoltBarChart title="Revenue" data={data} dataKeys={["revenue","cost"]} />
<VoltLineChart title="Signals" data={data} dataKeys={["ai","geo","fin"]} />
<VoltDonutChart title="Distribution" data={data} dataKeys={["value"]} />`} />
          </Section>

          <Section id="bubble-map" title="VoltBubbleMap" description={de ? "D3 Force-Layout Blasen-Visualisierung. Größe = Wert, Farbe = Kategorie, Lime-Rand = Top-Performer." : "D3 force-layout bubble visualization. Size = value, color = category, lime border = top performer."}>
            <VoltBubbleMap
              title={de ? "Trend-Landschaft" : "Trend Landscape"}
              subtitle={de ? "Signalstärke nach Themenfeld" : "Signal strength by topic"}
              height={360}
              nodes={[
                { id: "1", label: "AI Regulation", value: 85, category: "Tech" },
                { id: "2", label: "Quantum", value: 62, category: "Tech" },
                { id: "3", label: "Digital Euro", value: 48, category: "Finance" },
                { id: "4", label: "Climate Risk", value: 72, category: "Climate" },
                { id: "5", label: "Supply Chain", value: 55, category: "Geo" },
                { id: "6", label: "Cybersecurity", value: 68, category: "Tech" },
                { id: "7", label: "Energy Transition", value: 45, category: "Climate" },
                { id: "8", label: "Chip Wars", value: 58, category: "Geo" },
              ]}
              categories={["Tech", "Finance", "Climate", "Geo"]}
              accentThreshold={70}
              showStats
            />
            <CodeSnippet code={`<VoltBubbleMap
  nodes={[{ id: "1", label: "AI", value: 85, category: "Tech" }]}
  categories={["Tech", "Finance"]}
  accentThreshold={70} showStats />`} />
          </Section>

          <Section id="radar-chart" title="VoltRadarChart" description={de ? "D3 Quadranten-Blasen-Radar. X = Zeithorizont, Y = Reifegrad, Größe = Einfluss, Deckkraft = Vertrauen." : "D3 quadrant bubble radar. X = time horizon, Y = maturity, size = influence, opacity = confidence."}>
            <VoltRadarChart
              title={de ? "Technologie-Radar" : "Technology Radar"}
              subtitle={de ? "Bewertungsmatrix" : "Assessment Matrix"}
              height={400}
              quadrants={[
                de ? "Beobachten · Langfristig" : "Monitor · Long-term",
                de ? "Übernehmen · Langfristig" : "Adopt · Long-term",
                de ? "Beobachten · Kurzfristig" : "Monitor · Short-term",
                de ? "Übernehmen · Kurzfristig" : "Adopt · Short-term",
              ]}
              bubbles={[
                { id: "1", label: "LLM Agents", x: 0.3, y: 0.8, influence: 80, confidence: 0.9, horizon: "Kurz" },
                { id: "2", label: "Quantum ML", x: 0.85, y: 0.3, influence: 50, confidence: 0.4, horizon: "Lang" },
                { id: "3", label: "Edge AI", x: 0.2, y: 0.6, influence: 65, confidence: 0.7, horizon: "Kurz" },
                { id: "4", label: "Digital Twin", x: 0.6, y: 0.7, influence: 55, confidence: 0.65, horizon: "Mittel" },
                { id: "5", label: "Neuromorphic", x: 0.9, y: 0.2, influence: 35, confidence: 0.3, horizon: "Lang" },
                { id: "6", label: "AI Governance", x: 0.15, y: 0.9, influence: 70, confidence: 0.85, horizon: "Kurz" },
              ]}
            />
            <CodeSnippet code={`<VoltRadarChart
  quadrants={["Monitor·Long", "Adopt·Long", "Monitor·Short", "Adopt·Short"]}
  bubbles={[{ id: "1", label: "LLM", x: 0.3, y: 0.8, influence: 80, confidence: 0.9 }]} />`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  CANVAS                                   ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="node-canvas" title="VoltNodeCanvas" description={de ? "Interaktiver Node-Canvas mit Drag & Drop, Zoom, Edges und 12 Node-Typen. Pan mit Mausrad, Zoom mit Ctrl+Scroll." : "Interactive node canvas with drag & drop, zoom, edges and 12 node types. Pan with mousewheel, zoom with Ctrl+scroll."}>
            <VoltNodeCanvas
              height={400}
              showGrid
              nodes={[
                { id: "n1", type: "trigger", x: 60, y: 60, label: "API Trigger", status: "success" },
                { id: "n2", type: "transform", x: 320, y: 40, label: "Parse Data", status: "idle" },
                { id: "n3", type: "generator", x: 300, y: 180, label: "Analyse", status: "running" },
                { id: "n4", type: "decision", x: 560, y: 100, label: "Filter", status: "idle" },
                { id: "n5", type: "output", x: 560, y: 260, label: "Report", status: "idle" },
              ]}
              edges={[
                { id: "e1", from: "n1", to: "n2", animated: true, style: "bezier" },
                { id: "e2", from: "n2", to: "n3", style: "bezier" },
                { id: "e3", from: "n2", to: "n4", style: "bezier" },
                { id: "e4", from: "n3", to: "n5", style: "bezier" },
                { id: "e5", from: "n4", to: "n5", animated: true, style: "bezier" },
              ]}
            />
            <CodeSnippet code={`<VoltNodeCanvas height={400} showGrid
  nodes={[
    { id: "n1", type: "trigger", x: 60, y: 60, label: "API", status: "success" },
    { id: "n2", type: "transform", x: 320, y: 40, label: "Parse" },
  ]}
  edges={[{ id: "e1", from: "n1", to: "n2", animated: true, style: "bezier" }]} />`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  DISPLAY                                  ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="terminal" title="VoltTerminal" description={de ? "Terminal-Emulator mit macOS-Fenster-Buttons, Typewriter-Effekt und Copy-Button. Static-Variante für Ausgabe-Darstellung." : "Terminal emulator with macOS window buttons, typewriter effect and copy button. Static variant for output display."}>
            <VoltTerminalStatic
              title="sis-monitor"
              variant="dark"
              size="md"
              lines={[
                { type: "command", text: "$ sis scan --sources all" },
                { type: "info", text: "Scanning 12 data sources..." },
                { type: "success", text: "✓ 247 signals found" },
                { type: "warning", text: "⚠ 3 sources unreachable (timeout)" },
                { type: "output", text: "Top signal: AI Regulation EU — Score 94/100" },
                { type: "output", text: "Top signal: Quantum Computing — Score 87/100" },
                { type: "command", text: "$ sis export --format json" },
                { type: "success", text: "✓ Report exported to /reports/scan-2026-04.json" },
              ]}
            />
            <CodeSnippet code={`<VoltTerminalStatic title="output" variant="dark" lines={[
  { type: "command", text: "$ npm run build" },
  { type: "success", text: "✓ Build complete" },
]} />`} />
          </Section>

          <Section id="code-block" title="VoltCodeBlock" description={de ? "Code-Anzeige mit Copy-to-Clipboard Button. Hover zeigt Kopier-Icon." : "Code display with copy-to-clipboard button. Hover reveals copy icon."}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <VoltCodeBlock
                code={`import { VoltButton } from "@/components/volt";

<VoltButton variant="primary" size="md">
  Click me
</VoltButton>`}
                language="tsx"
                label="VoltButton"
              />
              <VoltCodeBlock
                code={`.volt-surface { background: #FFFFFF; }
.dark .volt-surface { background: #111111; }`}
                language="css"
                label=".volt-surface"
              />
            </div>
            <CodeSnippet code={`<VoltCodeBlock code="const x = 42;" language="tsx" label="example.tsx" />`} />
          </Section>

          <Section id="sidebar" title="VoltSidebar" description={de ? "Navigation-Sidebar mit Sektionen, Badges, Icons und Dark-Mode Toggle." : "Navigation sidebar with sections, badges, icons and dark mode toggle."}>
            <div style={{ maxWidth: 280, border: "1px solid var(--color-border, #E8E8E8)", borderRadius: 12, overflow: "hidden" }}>
              <VoltSidebar
                activeId="overview"
                sections={[
                  {
                    title: de ? "Analyse" : "Analysis",
                    items: [
                      { id: "overview", label: de ? "Übersicht" : "Overview", icon: <BarChart3 className="w-4 h-4" />, badge: "3" },
                      { id: "trends", label: "Trends", icon: <TrendingUp className="w-4 h-4" />, isNew: true },
                      { id: "signals", label: "Signals", icon: <Zap className="w-4 h-4" />, count: 47 },
                    ],
                  },
                  {
                    title: de ? "Quellen" : "Sources",
                    items: [
                      { id: "global", label: "Global", icon: <Globe className="w-4 h-4" /> },
                      { id: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
                    ],
                  },
                ]}
              />
            </div>
            <CodeSnippet code={`<VoltSidebar activeId="overview"
  sections={[{ title: "Analysis", items: [
    { id: "overview", label: "Overview", icon: <BarChart3 />, badge: "3" },
  ]}]} />`} />
          </Section>

          <Section id="cursor" title="VoltCursor" description={de ? "Volt Brand-Element: Terminal-Cursor mit blinkendem Balken. 6 Größen, 4 Farben." : "Volt brand element: terminal cursor with blinking bar. 6 sizes, 4 colors."}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <VoltCursor size="xs" color="black" />
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>xs</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <VoltCursor size="sm" color="black" />
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>sm</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <VoltCursor size="md" color="black" />
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>md</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <VoltCursor size="lg" color="black" />
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>lg</span>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", marginTop: 20, padding: 16, borderRadius: 8, background: "#111" }}>
              <VoltCursor size="sm" color="lime" />
              <VoltCursor size="md" color="lime" />
              <VoltCursor size="lg" color="white" />
            </div>
            <CodeSnippet code={`<VoltCursor size="md" color="black" animated />
<VoltCursor size="lg" color="lime" showBar />`} />
          </Section>

          {/* ╔══════════════════════════════════════════╗
             ║  MISC                                     ║
             ╚══════════════════════════════════════════╝ */}

          <Section id="kbd" title="VoltKbd" description={de ? "Tastatur-Kürzel Anzeige." : "Keyboard shortcut display."}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <VoltKbd>⌘</VoltKbd> + <VoltKbd>K</VoltKbd>
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>Command Bar</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <VoltKbd>Esc</VoltKbd>
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "Schließen" : "Close"}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <VoltKbd>⌘</VoltKbd> + <VoltKbd>S</VoltKbd>
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>{de ? "Speichern" : "Save"}</span>
              </span>
            </div>
            <CodeSnippet code={`<VoltKbd>⌘</VoltKbd> + <VoltKbd>K</VoltKbd>`} />
          </Section>

          <Section id="tooltip" title="VoltTooltip" description={de ? "Kontextueller Tooltip bei Hover." : "Contextual tooltip on hover."}>
            <div style={{ display: "flex", gap: 16 }}>
              <VoltTooltip content={de ? "Datenquellen aktualisieren" : "Refresh data sources"}>
                <VoltButton variant="outline" size="sm">{de ? "Hover mich" : "Hover me"}</VoltButton>
              </VoltTooltip>
              <VoltTooltip content={de ? "Neue Analyse starten" : "Start new analysis"} side="bottom">
                <VoltBadge variant="positive" dot>Active</VoltBadge>
              </VoltTooltip>
            </div>
            <CodeSnippet code={`<VoltTooltip content="Hilfetext" side="top">
  <VoltButton>Hover</VoltButton>
</VoltTooltip>`} />
          </Section>

          <Section id="icons" title={de ? "Icon-Bibliothek" : "Icon Library"} description={de ? "89 SVG-Icons: Analyse-Methoden, Datenquellen und Skeuomorphic." : "89 SVG icons: analysis methods, data sources and skeuomorphic."}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--volt-font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 10 }}>
                {de ? "Analyse-Methoden" : "Analysis Methods"}
              </div>
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
              <div style={{ fontFamily: "var(--volt-font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--color-text-muted, #999)", marginBottom: 10 }}>
                {de ? "Datenquellen (Auswahl)" : "Data Sources (selection)"}
              </div>
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
            <CodeSnippet code={`// 89 Icons in 3 Kategorien:
// /icons/volt/quellen-methoden/datenquellen/  → 11 Quell-Kategorien
// /icons/volt/quellen-methoden/analyse-methoden/ → 6 Frameworks
// /icons/volt/skeuomorphic/ → 17 Dekorative Icons`} />
          </Section>

          <Section id="skeuomorphic-icons" title="SkeuomorphicIcons" description={de ? "18 skeuomorphe 3D-Icons im macOS-Stil. SVG-basiert, skalierbar." : "18 skeuomorphic 3D icons in macOS style. SVG-based, scalable."}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 12 }}>
              {SKEU_ICONS.map(({ id, label, Component }) => (
                <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", borderRadius: 10, border: "1px solid var(--color-border, #E8E8E8)", background: "var(--color-surface, #FAFAFA)" }}>
                  <Component size={48} />
                  <span style={{ fontSize: 9, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
                </div>
              ))}
            </div>
            <CodeSnippet code={`import { IconFinder, IconDocument, SKEU_ICONS } from "@/components/volt";

<IconFinder size={64} />
{SKEU_ICONS.map(({ Component, label }) => <Component key={label} size={48} />)}`} />
          </Section>
        </main>
      </div>

      {/* Toast Container */}
      <VoltToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
