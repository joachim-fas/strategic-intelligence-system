// Volt UI -- Component Library for SIS
// Imported from https://github.com/joachim-fas/VoltUI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Reference Components (exact copies from VoltUI)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export * from "./SkeuomorphicIcons";
export * from "./VoltAlert";
export * from "./VoltAvatar";
export * from "./VoltBadge";
export * from "./VoltBubbleMap";
export * from "./VoltButton";
export * from "./VoltCard";
// VoltChart: explicit re-exports to avoid VoltRadarChart conflict
// (VoltChart.tsx has a simple recharts wrapper, VoltRadarChart.tsx has the full D3 version)
export {
  VOLT_HEX, VOLT_NEON, VOLT_PASTEL, VOLT_CHART_COLORS,
  type VoltPalette, getPalette,
  ChartWrapper, LiveBadge,
  type VoltAreaChartProps, VoltAreaChart,
  type VoltBarChartProps, VoltBarChart,
  type VoltLineChartProps, VoltLineChart,
  type VoltDonutChartProps, VoltDonutChart,
  type VoltScatterChartProps, VoltScatterChart,
  type VoltComposedChartProps, VoltComposedChart,
  type VoltRadialBarChartProps, VoltRadialBarChart,
  type VoltFunnelChartProps, VoltFunnelChart,
  type VoltTrendChartProps, VoltTrendChart,
  VoltStackedAreaChart, VoltStackedBarChart,
} from "./VoltChart";
export * from "./VoltCodeBlock";
export * from "./VoltCommandBar";
export * from "./VoltCursor";
export * from "./VoltInput";
export * from "./VoltModal";
export * from "./VoltNavbar";
export * from "./VoltNodeCanvas";
export * from "./VoltProgress";
export * from "./VoltRadarChart";
export * from "./VoltRankedList";
export * from "./VoltSidebar";
export * from "./VoltStat";
export * from "./VoltTable";
export * from "./VoltTabs";
export * from "./VoltTerminal";
export * from "./VoltToast";
export * from "./VoltToggle";
export * from "./VoltTrendCard";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIS-only Components (additional, built for SIS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Layout & Structure
export * from "./VoltSeparator";
export * from "./VoltScrollArea";
export * from "./VoltSkeleton";
export * from "./VoltEmpty";

// Typography & Indicators
export * from "./VoltLabel";
export * from "./VoltKbd";
export * from "./VoltSpinner";

// Icons — zentraler Adapter fuer das Icon-Set. Call-Sites sollen kuenftig
// aus Volt importieren statt direkt aus lucide, damit ein spaeterer
// Set-Swap an einer Stelle passiert (siehe VoltIcon.tsx).
export * from "./VoltIcon";

// Navigation
export * from "./VoltBreadcrumb";

// Form & Input
export * from "./VoltField";
export * from "./VoltInputGroup";
export * from "./VoltDropdownSelect";
export * from "./VoltToggleGroup";

// Overlay & Dialog
export * from "./VoltDialog";
export * from "./VoltSheet";
export * from "./VoltPopover";
export * from "./VoltDropdownMenu";
export * from "./VoltAccordion";
export * from "./VoltConfirm";

// Primitive Table (composable sub-components)
export * from "./VoltTablePrimitive";
