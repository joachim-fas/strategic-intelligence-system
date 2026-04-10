// TODO: FE-07 / UX-19 — i18n MIGRATION NEEDED
// Currently only ~40 keys translated. 300+ inline ternaries (lang === "de" ? ... : ...) across codebase.
// FIX: Migrate all strings to this i18n system. Consider next-intl for proper i18n support.
// Files with most ternaries: canvas/page.tsx, QuellenTable.tsx, SessionList.tsx, page.tsx

export type Locale = "de" | "en";

const translations = {
  en: {
    // Header
    technologyLandscape: "Technology landscape overview",
    trends: "Trends",
    rising: "Rising",
    adopt: "Adopt",
    demoData: "Demo Data",
    fetchLiveData: "Fetch Live Data",
    fetching: "Fetching...",

    // Filter bar
    searchTrends: "Search trends...",
    allHorizons: "All Horizons",
    shortTerm: "Short-term",
    midTerm: "Mid-term",
    longTerm: "Long-term",
    allRings: "All Rings",
    allCategories: "All Categories",
    minConfidence: "Min Confidence:",
    reset: "Reset",

    // Rings
    ringAdopt: "Adopt",
    ringTrial: "Trial",
    ringAssess: "Assess",
    ringHold: "Hold",

    // Radar legend
    horizon: "Horizon:",
    short: "Short",
    mid: "Mid",
    long: "Long",
    sizeIsImpact: "Size = Impact",
    opacityIsConfidence: "Opacity = Confidence",

    // Detail panel
    back: "Back",
    edit: "Edit",
    pin: "Pin",
    scores: "Scores",
    relevance: "Relevance",
    confidence: "Confidence",
    impact: "Impact",
    timeHorizon: "Time Horizon",
    override: "Override",
    scoreHistory: "Score History (90 days)",
    sparklinePlaceholder: "Sparkline chart — coming with live data",
    evidence: "Evidence",
    signals: "signals",
    from: "from",
    sources: "sources",
    showAll: "Show all",
    tags: "Tags",
    manualOverride: "Manual override",
    stable: "Stable",

    // Time horizons
    horizonShort: "0-12 months",
    horizonMid: "1-3 years",
    horizonLong: "3+ years",

    // Velocity
    velocityRising: "Rising",
    velocityFalling: "Falling",

    // Misc
    language: "EN",
  },
  de: {
    // Header
    technologyLandscape: "Technologie-Landschaft Überblick",
    trends: "Trends",
    rising: "Steigend",
    adopt: "Übernehmen",
    demoData: "Demodaten",
    fetchLiveData: "Live-Daten laden",
    fetching: "Laden...",

    // Filter bar
    searchTrends: "Trends suchen...",
    allHorizons: "Alle Zeithorizonte",
    shortTerm: "Kurzfristig",
    midTerm: "Mittelfristig",
    longTerm: "Langfristig",
    allRings: "Alle Ringe",
    allCategories: "Alle Kategorien",
    minConfidence: "Min. Vertrauen:",
    reset: "Zurücksetzen",

    // Rings
    ringAdopt: "Übernehmen",
    ringTrial: "Testen",
    ringAssess: "Bewerten",
    ringHold: "Beobachten",

    // Radar legend
    horizon: "Horizont:",
    short: "Kurz",
    mid: "Mittel",
    long: "Lang",
    sizeIsImpact: "Größe = Einfluss",
    opacityIsConfidence: "Deckkraft = Vertrauen",

    // Detail panel
    back: "Zurück",
    edit: "Bearbeiten",
    pin: "Anheften",
    scores: "Bewertungen",
    relevance: "Relevanz",
    confidence: "Vertrauen",
    impact: "Einfluss",
    timeHorizon: "Zeithorizont",
    override: "Überschreiben",
    scoreHistory: "Score-Verlauf (90 Tage)",
    sparklinePlaceholder: "Sparkline-Diagramm — kommt mit Live-Daten",
    evidence: "Belege",
    signals: "Signale",
    from: "aus",
    sources: "Quellen",
    showAll: "Alle anzeigen",
    tags: "Tags",
    manualOverride: "Manuell überschrieben",
    stable: "Stabil",

    // Time horizons
    horizonShort: "0-12 Monate",
    horizonMid: "1-3 Jahre",
    horizonLong: "3+ Jahre",

    // Velocity
    velocityRising: "Steigend",
    velocityFalling: "Fallend",

    // Misc
    language: "DE",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] ?? translations.en[key] ?? key;
}

export function getRingLabel(locale: Locale, ring: string): string {
  const map: Record<string, TranslationKey> = {
    adopt: "ringAdopt",
    trial: "ringTrial",
    assess: "ringAssess",
    hold: "ringHold",
  };
  return t(locale, map[ring] || "ringHold");
}
