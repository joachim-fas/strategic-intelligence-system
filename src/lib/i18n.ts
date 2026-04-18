/**
 * i18n — namespace-based dictionary + interpolation.
 *
 * 2026-04-18 audit A5-H9 rewrite. The previous flat dictionary had
 * only ~40 keys and was ignored by almost all call sites, which fell
 * back to 1453 inline `de ? ... : ...` ternaries across 61 files.
 *
 * New contract
 * ────────────
 * 1. Dictionary is nested by namespace: `common`, `nav`, `cockpit`,
 *    `admin`, `tenant`, `sessions`, `invite`, `monitor`, `errors`,
 *    `audit`. Add new namespaces here — do NOT sprinkle inline strings
 *    in components.
 * 2. Lookup is dot-path: `t('common.cancel')`, `t('admin.archiveTenantQ')`.
 * 3. Interpolation is `{{var}}`: `t('sessions.minutesAgo', { n: 5 })`.
 * 4. Missing keys fall back to EN, then to the key string — never crash.
 * 5. The React hook `useT()` (see `locale-context`) returns a bound
 *    `t()` so components don't thread `locale` manually.
 * 6. Date/number formatting helpers use `localeTag(locale)` so we
 *    stop peppering `de ? "de-DE" : "en-US"` everywhere.
 *
 * Migration recipe (for remaining files with `de ? ... : ...` ternaries)
 * ─────────────────────────────────────────────────────────────────────
 * 1. At the top of the component, swap
 *
 *      const { locale } = useLocale();
 *      const de = locale === "de";
 *
 *    for
 *
 *      const { t, locale } = useT();
 *
 *    If the component already takes `de: boolean` as a prop (some
 *    shared components do), keep the prop and derive a local translator
 *    like `SessionList.tsx`:
 *
 *      const locale: Locale = de ? "de" : "en";
 *      const tl = (k, vars) => translate(locale, k, vars);
 *
 * 2. Move each bilingual string pair into the dictionary under the
 *    right namespace. Group per file/page; prefer keys that describe
 *    the UI role (`tipRename`, `archiveTenantQ`) over the copy itself
 *    (`"Rename"`, `"Archive tenant?"`). Add the key to BOTH `en` and
 *    `de` (TypeScript enforces shape parity).
 *
 * 3. Replace inline ternaries:
 *      `de ? "Speichern" : "Save"`     →  `t("common.save")`
 *      `de ? "„X" löschen?" : "Delete "X"?"`
 *                                        →  `t("ns.key", { name: x })`
 *      `de.toLocaleDateString("de-DE") : "en-US"`
 *                                        →  `localeTag(locale)`
 *      `de ? "vor 5 Min" : "5 min ago"`  →  `formatRelativeTime(d, locale)`
 *
 * 4. For JSX-embedded interpolation where styling matters
 *    (`<strong>{name}</strong>`), split the sentence into translated
 *    fragments (`prefix`, `suffix`, etc.) — see `audit.*` keys and how
 *    `renderAuditDetail` uses them. Do NOT try to embed JSX in the
 *    dictionary — the dictionary holds strings, JSX composition stays
 *    in code.
 *
 * 5. Sub-components that receive `locale` as a prop (because they
 *    render outside React context, e.g. inside modals mounted from
 *    `voltConfirm`) should build a local `tl` via `translate()` — see
 *    `InviteModal` in `TenantDetailClient.tsx`.
 *
 * 6. Verify with `npx tsc --noEmit`. TypeScript enforces that every
 *    dot-path you pass to `t()` exists in the dictionary, and that the
 *    DE/EN shapes stay in sync.
 *
 * Status (at commit time)
 * ───────────────────────
 * Migrated (0 UI ternaries remaining):
 *   - components/radar/RadarChart.tsx
 *   - components/radar/TrendDetailPanel.tsx
 *   - components/sessions/SessionList.tsx (52 → 4 structural)
 *   - app/admin/tenants/TenantsClient.tsx (41 → 0)
 *   - app/admin/tenants/[id]/TenantDetailClient.tsx (70 → 0)
 *   - app/admin/audit/AuditClient.tsx (23 → 0)
 *   - app/settings/tenant/TenantSettingsClient.tsx (25 → 0)
 *
 * Remaining hotspots (highest ternary counts):
 *   - app/dokumentation/page.tsx (184), app/komponenten/page.tsx (141)
 *   - app/canvas/page.tsx (127), app/canvas/DetailPanel.tsx (108)
 *   - app/canvas/OrbitDerivationView.tsx (48), OrbitGraphView.tsx (24)
 *   - app/frameworks/* (45, 37, 25, 24, 24, 20, …)
 *   - app/cockpit/* + how-to/*, auth/signin/*, ~40 other files
 * Use the recipe above; keep commits ≤ 3 files each for reviewability.
 */

export type Locale = "de" | "en";

// ── Dictionary ─────────────────────────────────────────────────────
//
// Shape is `{ [namespace]: { [key]: string } }`. Namespaces keep the
// file tree-shakeable mentally; a component only needs to know its
// namespace, not the whole world.

const en = {
  common: {
    // Actions
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    archive: "Archive",
    restore: "Restore",
    edit: "Edit",
    create: "Create",
    close: "Close",
    back: "Back",
    next: "Next",
    loading: "Loading…",
    retry: "Retry",
    copy: "Copy",
    copied: "Copied",
    more: "More",
    showAll: "Show all",
    showLess: "Show less",
    yes: "Yes",
    no: "No",
    ok: "OK",
    confirm: "Confirm",
    remove: "Remove",
    refresh: "Refresh",
    reset: "Reset",
    search: "Search",

    // Generic labels
    active: "Active",
    archived: "Archived",
    total: "Total",
    status: "Status",
    role: "Role",
    name: "Name",
    email: "Email",
    actions: "Actions",
    description: "Description",
    created: "Created",
    updated: "Updated",
    never: "Never",

    // States
    empty: "Nothing here yet",
    error: "Something went wrong",
    timeout: "Request timed out.",
    actionFailed: "Action failed.",

    // Time
    justNow: "just now",
    minutesAgo: "{{n}} min ago",
    hoursAgo: "{{n}} h ago",
    daysAgo: "{{n}} d ago",

    // Misc
    language: "EN",
  },

  nav: {
    home: "Home",
    cockpit: "Cockpit",
    canvas: "Canvas",
    projects: "Projects",
    archive: "Archive",
    monitor: "Monitor",
    settings: "Settings",
    admin: "Admin",
    systemAdmin: "System admin",
    help: "Help",
    signOut: "Sign out",
  },

  cockpit: {
    technologyLandscape: "Technology landscape overview",
    trends: "Trends",
    rising: "Rising",
    adopt: "Adopt",
    demoData: "Demo Data",
    fetchLiveData: "Fetch Live Data",
    fetching: "Fetching…",
    searchTrends: "Search trends…",
    allHorizons: "All Horizons",
    shortTerm: "Short-term",
    midTerm: "Mid-term",
    longTerm: "Long-term",
    allRings: "All Rings",
    allCategories: "All Categories",
    minConfidence: "Min Confidence:",
    ringAdopt: "Adopt",
    ringTrial: "Trial",
    ringAssess: "Assess",
    ringHold: "Hold",
    horizon: "Horizon:",
    short: "Short",
    mid: "Mid",
    long: "Long",
    sizeIsImpact: "Size = Impact",
    opacityIsConfidence: "Opacity = Confidence",
    horizonShort: "0-12 months",
    horizonMid: "1-3 years",
    horizonLong: "3+ years",
    velocityRising: "Rising",
    velocityFalling: "Falling",
    stable: "Stable",
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
    tags: "Tags",
    manualOverride: "Manual override",
    pin: "Pin",
    scores: "Scores",
  },

  admin: {
    tenantsTitle: "Tenants",
    tenantsSubtitle:
      "All organizations in the system. Members, roles, and invites are managed per-tenant — see detail view.",
    editTenant: "Edit tenant",
    saving: "Saving…",
    newTenant: "New tenant",
    noTenants: "No tenants yet.",
    createFirst: "Create the first tenant to get started.",
    tenantName: "Tenant name",
    tenantNamePlaceholder: "e.g. Mercedes Strategy",
    tenantSlug: "Slug",
    tenantSlugHint: "URL-safe identifier. Auto-generated from name, editable.",
    ownerEmailLabel: "Owner email (optional)",
    ownerEmailHint:
      "If this user exists, they'll be made owner. Otherwise only you will be owner (invites in Phase 3).",
    plan: "Plan",
    projects: "Projects",
    membersShort: "Members",
    memberCount: "Members",
    radarCount: "Radars",
    scenarioCount: "Scenarios",
    auditTitle: "Audit log",
    auditEmpty: "No audit events yet.",
    archiveTenantQ: 'Archive tenant "{{name}}"?',
    archiveTenantBody:
      "Archived tenants disappear from the switcher but stay readable. No data loss.",
    restoreTenantQ: 'Restore tenant "{{name}}"?',
    restoreTenantBody:
      "The tenant becomes active again and reappears in the switcher.",
    deleteTenantQ: 'Permanently delete "{{name}}"?',
    deleteTenantBody:
      "All projects, scenarios and memberships of this tenant will be deleted irreversibly.\nThis action cannot be undone.",
    deletePermanent: "Delete permanently",
    archiveBeforeDelete: "Tenant must be archived before permanent deletion.",
    archiveFailed: "Archive failed.",
    deleteFailed: "Deletion failed.",
    createFailed: "Creation failed.",
    membersHeading: "Members",
    invitesHeading: "Pending invites",
    inviteSent: "Invite sent.",
    inviteFailed: "Invite failed.",
    resendInvite: "Resend invite",
    revokeInvite: "Revoke",
    invitedAs: "Invited as {{role}}",
    // Tenant detail page
    tenantLabel: "Tenant",
    exportJson: "Export (JSON)",
    exportJsonTip: "Full JSON export (GDPR)",
    restoreTenant: "Restore",
    scenarios: "Scenarios",
    ratings: "Ratings",
    membersSection: "Members",
    inviteMember: "Invite member",
    noMembers: "No members yet.",
    memberNameEmail: "Name / Email",
    roleColumn: "Role",
    memberSince: "Member since",
    pendingInvites: "Pending invitations",
    expiresColumn: "Expires",
    resendAction: "Resend",
    activitySection: "Activity",
    inviteCreatedShareLink: "Invite created — share this link:",
    removeMemberQ: 'Remove "{{email}}"?',
    removeMemberBody: "The user will lose access to this tenant. Projects they created remain.",
    revokeInviteQ: 'Revoke invite for "{{email}}"?',
    revokeInviteBody: "The invite link becomes invalid. You can re-send a fresh invite any time.",
    archiveHereQ: 'Archive "{{name}}"?',
    archiveHereBody: "Archived tenants become read-only and disappear from member switchers. Can be restored any time.",
    deleteHereQ: 'Permanently delete "{{name}}"?',
    deleteHereBody: "All tenant data is permanently removed. Download the JSON export first.",
    roleChangeFailed: "Could not change role.",
    removeFailed: "Remove failed.",
    restoreTenantFailed: "Restore failed.",
    resendFailed: "Resend failed.",
    inviteModalHint:
      "If the user exists, they'll be added immediately. Otherwise you'll get a shareable accept link.",
    inviteSending: "Sending…",
    inviteSubmit: "Invite",
    roleOwner: "Owner",
    roleAdmin: "Admin",
    roleMember: "Member",
    roleViewer: "Viewer",
  },

  tenant: {
    settingsTitle: "Tenant settings",
    settingsCaption: "Settings",
    settingsHeading: "Tenant",
    settingsSubtitle:
      "Settings for the currently active tenant. Changes apply to all members. Member + role management lives under the admin view of this tenant.",
    nonAdminHint:
      "Only owners and admins can change tenant settings. You can inspect the values below but can't save.",
    basicsSection: "Basics",
    slugOwnerOnlyHint:
      "URL-safe identifier. Only owners can change the slug.",
    slugOwnerOnly: "Only the owner can change the slug.",
    queryDefaultsSection: "Query defaults",
    queryDefaultsHint:
      "These values prefill the context profile for new queries (role, industry, region).",
    languageLabel: "Language",
    timezoneLabel: "Timezone",
    roleLabel: "Role",
    rolePlaceholder: "e.g. Strategy Lead",
    industryLabel: "Industry",
    industryPlaceholder: "e.g. Automotive",
    regionLabel: "Region",
    brandingSection: "Branding",
    brandingHint:
      "Header logo (PNG, JPEG, SVG or WebP, max 512 KB). Or link to a hosted URL.",
    logoPreview: "Logo preview",
    logoReplace: "Replace logo",
    logoUpload: "Upload logo",
    logoUploading: "Uploading…",
    logoRemove: "Remove",
    logoConstraints: "Max 512 KB. PNG / JPEG / SVG / WebP.",
    logoUrlFallback: "Or logo URL",
    savedNote: "✓ Saved",
    generalSection: "General",
    dangerZone: "Danger zone",
    archiveSelf: "Archive this tenant",
    archiveSelfWarn:
      "The tenant is hidden from all members until it is restored by a system admin.",
    archiveSelfConfirm: 'Archive "{{name}}"? This hides the tenant for all members.',
    switchTenant: "Switch tenant",
    currentTenant: "Current tenant",
    noMembership: "You are not a member of any tenant yet.",
  },

  sessions: {
    projects: "Projects",
    archive: "Archive",
    project: "Project",
    framework: "Framework",
    started: "Started",
    lastEdit: "Last edit",
    archived: "Archived",
    size: "Size",
    nodesLabel: "nodes",
    queriesLabel: "queries",
    emptyRow: "empty",
    untitled: "Untitled project",
    active: "Active",
    filter: "Filter",
    all: "All",
    noneInCategory: "No projects in this category.",
    sort: "Sort",
    sortMenuAria: "Change sort order",
    sortLastEdited: "Last edited",
    sortRecentlyCreated: "Recently created",
    sortNameAsc: "Name A → Z",
    sortNameDesc: "Name Z → A",
    sortMostNodes: "Most nodes",
    loadingProjects: "Loading projects…",
    loadFailed: "Data could not be loaded. Please try again.",
    emptyActiveTitle: "Start your first strategic thread",
    emptyActiveDesc: "Open a project from the home page — with a question or a framework.",
    emptyActiveCaption: "No projects yet",
    emptyArchivedTitle: "Archive is empty",
    emptyArchivedDesc: "When you finish a project, archive it here without deleting.",
    emptyArchivedCaption: "No archived projects",
    goHome: "Go to Home →",
    deleteProjectQ: "Permanently delete project?",
    deleteProjectBody:
      "All queries, notes and generated cards inside this project are lost.",
    deleteRowBody: '"{{name}}"\n\nThis action cannot be undone.',
    archiveFailed: "Archive failed.",
    restoreFailed: "Restore failed.",
    deleteFailed: "Delete failed.",
    renameFailed: "Rename failed.",
    frameworkTip: "Framework: {{label}}",
    tipRename: "Rename",
    tipArchive: "Move to archive",
    tipRestore: "Restore from archive",
    tipDelete: "Permanently delete",
    emptyState: "No projects yet. Start a new analysis on the home page.",
  },

  invite: {
    pageTitle: "You're invited",
    invitedTo: 'You were invited to "{{tenant}}" as {{role}}.',
    acceptCta: "Accept invite",
    signInToAccept: "Sign in to accept",
    alreadyMember: "You are already a member of this tenant.",
    expired: "This invite has expired.",
    invalidToken: "Invite token is invalid or already used.",
    // Accept landing page
    caption: "Invitation",
    checking: "Checking invitation…",
    invalidHeading: "Invitation not valid",
    notFoundBody: "This invitation does not exist or was revoked.",
    expiredBody:
      "This invitation has expired (14 days since issue). Please request a new one.",
    alreadyAcceptedBody: "This invitation has already been accepted.",
    goHomeLink: "Go home",
    invitedHeading: "You've been invited",
    invitedBodyPrefix: "Tenant",
    invitedBodyInvites: "invites",
    invitedBodyAsJoin: "to join as",
    rowTenant: "Tenant",
    rowEmail: "Email",
    rowRole: "Role",
    rowValidUntil: "Valid until",
    wrongAccountHeading: "Wrong account",
    acceptFailedHeading: "Accept failed",
    emailMismatchPrefix: "Please sign in as",
    emailMismatchSuffix: "and try again.",
    emailMismatchSignInCta: "Sign in →",
    acceptingCta: "One moment…",
    acceptInviteCta: "Accept invitation →",
    acceptHint:
      "You must be signed in with this email. If you aren't, you'll be redirected to sign-in.",
    acceptedHeading: "Welcome aboard",
    acceptedBody: "Redirecting you…",
    noTokenError: "No token in URL.",
    acceptFailedGeneric: "Accept failed.",
  },

  monitor: {
    title: "Signal monitor",
    sourcesHeading: "Data source health",
    missingRequired: "Missing required credentials",
    missingOptional: "Optional credentials missing (rate-limited tier)",
    silentSource: "Configured but no recent signals",
    allHealthy: "All sources healthy.",
    getKey: "Get key",
    checkPipeline: "Check pipeline",
  },

  sources: {
    heading: "Data Sources",
    researchSubtitleSuffix: "curated research and consulting sources",
    registeredLabel: "registered",
    activeLabel: "active",
    plannedLabel: "planned",
    all: "All",
    category: "Category",
    status: "Status",
    statusLive: "Live (active)",
    statusPlanned: "Planned (roadmap)",
    searchPlaceholder: "Search...",
    colSource: "Source",
    colCategory: "Category",
    colType: "Type",
    colStatus: "Status",
    highPriority: "High priority",
    noneFound: "No sources found",
    noResearchFound: "No research sources found",
  },

  summary: {
    caption: "Summary",
    projectFallback: "Project",
    loadingAnalyses: "Loading analyses…",
    noneInProject: "No analyses in this project yet.",
    analysisSingular: "analysis",
    analysisPlural: "analyses",
    chronological: "chronological",
    projectNotFound: "Project not found.",
    errorLabel: "Error",
    retry: "Retry",
    emptyLabel: "No analyses yet",
    emptyBody:
      "No analyses saved to this project yet. Run a query on the home page or in the node canvas — as soon as a briefing lands, it shows up here.",
    printTip: "Print (Cmd+P)",
    printAction: "Print",
    exportMdTip: "Export as Markdown",
    queryLabel: "Query",
    confidenceLabel: "Confidence",
    scenarioFallback: "Scenario",
    sectionSynthesis: "Synthesis",
    sectionKeyInsights: "Key Insights",
    sectionScenarios: "Scenarios",
    sectionInterpretation: "Interpretation",
    sectionDecisionFramework: "Decision Framework",
    sectionRegulatoryContext: "Regulatory Context",
    sectionFollowUps: "Follow-up Questions",
    sectionReferences: "References",
  },

  errors: {
    unknown: "Something went wrong.",
    network: "Network error. Check your connection.",
    forbidden: "You do not have permission for this action.",
    notFound: "Not found.",
    validation: "Please fix the highlighted fields.",
    lastOwner:
      "Can't remove the last owner. Promote another member to owner first.",
  },

  audit: {
    pageTitle: "Audit log",
    allTenantsLink: "All tenants",
    subtitle: "Every administrative action across all tenants. Filter by tenant, action, or actor.",
    filterAllTenants: "All tenants",
    filterAllActions: "All actions",
    actorPlaceholder: "Actor (email/name)…",
    emptyForFilters: "No entries for these filters.",
    loadMore: "Load more",
    // Action-specific fragments. Kept split so the JSX can wrap the
    // interpolated values in <strong> without hard-coding either locale.
    tenantCreatedPrefix: "Tenant",
    tenantCreatedSuffix: "created",
    tenantUpdated: "Tenant data updated",
    tenantArchived: "Tenant archived",
    tenantRestored: "Tenant restored",
    tenantDeleted: "Tenant permanently deleted",
    memberAddedSuffix: "added as {{role}}",
    memberRemovedRole: "Member removed (role: {{role}})",
    roleChangedPrefix: "Role changed:",
    roleChangedArrow: "→",
    inviteSentPrefix: "Invite sent to",
    inviteSentRole: "({{role}})",
    inviteRevokedPrefix: "Invite for",
    inviteRevokedSuffix: "revoked",
    inviteAccepted: "Invite accepted ({{role}})",
  },
} as const;

// German dictionary — same shape, different strings. TypeScript enforces
// that the shapes stay in sync (see `Dictionary` type below).
const de: Dictionary = {
  common: {
    cancel: "Abbrechen",
    save: "Speichern",
    delete: "Löschen",
    archive: "Archivieren",
    restore: "Wiederherstellen",
    edit: "Bearbeiten",
    create: "Erstellen",
    close: "Schließen",
    back: "Zurück",
    next: "Weiter",
    loading: "Lädt…",
    retry: "Erneut versuchen",
    copy: "Kopieren",
    copied: "Kopiert",
    more: "Mehr",
    showAll: "Alle anzeigen",
    showLess: "Weniger anzeigen",
    yes: "Ja",
    no: "Nein",
    ok: "OK",
    confirm: "Bestätigen",
    remove: "Entfernen",
    refresh: "Aktualisieren",
    reset: "Zurücksetzen",
    search: "Suchen",

    active: "Aktiv",
    archived: "Archiviert",
    total: "Gesamt",
    status: "Status",
    role: "Rolle",
    name: "Name",
    email: "E-Mail",
    actions: "Aktionen",
    description: "Beschreibung",
    created: "Erstellt",
    updated: "Aktualisiert",
    never: "Nie",

    empty: "Noch nichts vorhanden",
    error: "Etwas ist schiefgelaufen",
    timeout: "Zeitlimit überschritten.",
    actionFailed: "Aktion fehlgeschlagen.",

    justNow: "gerade eben",
    minutesAgo: "vor {{n}} Min",
    hoursAgo: "vor {{n}} Std",
    daysAgo: "vor {{n}} Tg",

    language: "DE",
  },

  nav: {
    home: "Start",
    cockpit: "Cockpit",
    canvas: "Canvas",
    projects: "Projekte",
    archive: "Archiv",
    monitor: "Monitor",
    settings: "Einstellungen",
    admin: "Admin",
    systemAdmin: "System-Admin",
    help: "Hilfe",
    signOut: "Abmelden",
  },

  cockpit: {
    technologyLandscape: "Technologie-Landschaft Überblick",
    trends: "Trends",
    rising: "Steigend",
    adopt: "Übernehmen",
    demoData: "Demodaten",
    fetchLiveData: "Live-Daten laden",
    fetching: "Laden…",
    searchTrends: "Trends suchen…",
    allHorizons: "Alle Zeithorizonte",
    shortTerm: "Kurzfristig",
    midTerm: "Mittelfristig",
    longTerm: "Langfristig",
    allRings: "Alle Ringe",
    allCategories: "Alle Kategorien",
    minConfidence: "Min. Vertrauen:",
    ringAdopt: "Übernehmen",
    ringTrial: "Testen",
    ringAssess: "Bewerten",
    ringHold: "Beobachten",
    horizon: "Horizont:",
    short: "Kurz",
    mid: "Mittel",
    long: "Lang",
    sizeIsImpact: "Größe = Einfluss",
    opacityIsConfidence: "Deckkraft = Vertrauen",
    horizonShort: "0-12 Monate",
    horizonMid: "1-3 Jahre",
    horizonLong: "3+ Jahre",
    velocityRising: "Steigend",
    velocityFalling: "Fallend",
    stable: "Stabil",
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
    tags: "Tags",
    manualOverride: "Manuell überschrieben",
    pin: "Anheften",
    scores: "Bewertungen",
  },

  admin: {
    tenantsTitle: "Mandanten",
    tenantsSubtitle:
      "Alle Organisationen im System. Mitglieder, Rollen und Einladungen werden pro Mandant verwaltet — siehe Detail-Ansicht.",
    editTenant: "Mandant bearbeiten",
    saving: "Speichere…",
    newTenant: "Neuer Mandant",
    noTenants: "Noch keine Mandanten.",
    createFirst: "Leg den ersten Mandanten an, um zu starten.",
    tenantName: "Mandanten-Name",
    tenantNamePlaceholder: "z.B. Mercedes Strategie",
    tenantSlug: "Slug",
    tenantSlugHint:
      "URL-sicherer Bezeichner. Auto-generiert aus Name, kann angepasst werden.",
    ownerEmailLabel: "Owner-Email (optional)",
    ownerEmailHint:
      "Wenn dieser User existiert, wird er Owner. Sonst bist nur du Owner (Einladen in Phase 3).",
    plan: "Plan",
    projects: "Projekte",
    membersShort: "Mitgl.",
    memberCount: "Mitglieder",
    radarCount: "Radare",
    scenarioCount: "Szenarien",
    auditTitle: "Audit-Log",
    auditEmpty: "Noch keine Audit-Ereignisse.",
    archiveTenantQ: "Mandant „{{name}}\" archivieren?",
    archiveTenantBody:
      "Archivierte Mandanten verschwinden aus dem Switcher, bleiben aber auslesbar. Kein Datenverlust.",
    restoreTenantQ: "Mandant „{{name}}\" wiederherstellen?",
    restoreTenantBody:
      "Der Mandant wird wieder als aktiv markiert und ist im Switcher sichtbar.",
    deleteTenantQ: "„{{name}}\" endgültig löschen?",
    deleteTenantBody:
      "Alle Projekte, Szenarien und Mitgliedschaften dieses Mandanten werden unwiderruflich entfernt.\nDiese Aktion kann nicht rückgängig gemacht werden.",
    deletePermanent: "Endgültig löschen",
    archiveBeforeDelete:
      "Mandant muss zuerst archiviert werden, bevor er dauerhaft gelöscht werden kann.",
    archiveFailed: "Archivieren fehlgeschlagen.",
    deleteFailed: "Löschen fehlgeschlagen.",
    createFailed: "Erstellen fehlgeschlagen.",
    membersHeading: "Mitglieder",
    invitesHeading: "Offene Einladungen",
    inviteSent: "Einladung verschickt.",
    inviteFailed: "Einladung fehlgeschlagen.",
    resendInvite: "Einladung erneut senden",
    revokeInvite: "Zurückziehen",
    invitedAs: "Eingeladen als {{role}}",
    // Mandant-Detail
    tenantLabel: "Mandant",
    exportJson: "Export (JSON)",
    exportJsonTip: "Kompletter JSON-Export (DSGVO)",
    restoreTenant: "Wiederherstellen",
    scenarios: "Szenarien",
    ratings: "Ratings",
    membersSection: "Mitglieder",
    inviteMember: "Mitglied einladen",
    noMembers: "Noch keine Mitglieder.",
    memberNameEmail: "Name / E-Mail",
    roleColumn: "Rolle",
    memberSince: "Mitglied seit",
    pendingInvites: "Ausstehende Einladungen",
    expiresColumn: "Läuft ab",
    resendAction: "Erneut senden",
    activitySection: "Aktivität",
    inviteCreatedShareLink: "Einladung erstellt — Link an den Eingeladenen senden:",
    removeMemberQ: "„{{email}}\" entfernen?",
    removeMemberBody: "Der Nutzer verliert den Zugriff auf diesen Mandanten. Seine erstellten Projekte bleiben erhalten.",
    revokeInviteQ: "Einladung für „{{email}}\" zurückziehen?",
    revokeInviteBody: "Der Einladungs-Link wird ungültig. Du kannst sie jederzeit neu versenden.",
    archiveHereQ: "„{{name}}\" archivieren?",
    archiveHereBody: "Archivierte Mandanten sind schreibgeschützt und erscheinen nicht mehr im Switcher der Mitglieder. Kann jederzeit wiederhergestellt werden.",
    deleteHereQ: "„{{name}}\" endgültig löschen?",
    deleteHereBody: "Alle Daten des Mandanten werden unwiderruflich entfernt. Lade vorher den JSON-Export herunter.",
    roleChangeFailed: "Rolle konnte nicht geändert werden.",
    removeFailed: "Entfernen fehlgeschlagen.",
    restoreTenantFailed: "Wiederherstellung fehlgeschlagen.",
    resendFailed: "Erneut senden fehlgeschlagen.",
    inviteModalHint:
      "Wenn der User existiert, wird er sofort Mitglied. Sonst bekommst du einen Accept-Link zum Teilen.",
    inviteSending: "Sende…",
    inviteSubmit: "Einladen",
    roleOwner: "Inhaber",
    roleAdmin: "Admin",
    roleMember: "Mitglied",
    roleViewer: "Leser",
  },

  tenant: {
    settingsTitle: "Mandanten-Einstellungen",
    settingsCaption: "Einstellungen",
    settingsHeading: "Mandant",
    settingsSubtitle:
      "Einstellungen für deinen aktiven Mandanten. Änderungen gelten für alle Mitglieder. Mitglieder- und Rollen-Verwaltung liegt unter der Admin-Ansicht des Mandanten.",
    nonAdminHint:
      "Nur Owner und Admins können Mandanten-Einstellungen ändern. Du kannst die Werte unten einsehen, aber nicht speichern.",
    basicsSection: "Stammdaten",
    slugOwnerOnlyHint:
      "URL-sicherer Bezeichner. Nur Owner können den Slug ändern.",
    slugOwnerOnly: "Nur der Owner kann den Slug ändern.",
    queryDefaultsSection: "Analyse-Defaults",
    queryDefaultsHint:
      "Diese Werte werden als Kontext-Profile bei neuen Queries vorausgefüllt (Rolle, Industrie, Region).",
    languageLabel: "Sprache",
    timezoneLabel: "Zeitzone",
    roleLabel: "Rolle",
    rolePlaceholder: "z.B. Strategy Lead",
    industryLabel: "Industrie",
    industryPlaceholder: "z.B. Automotive",
    regionLabel: "Region",
    brandingSection: "Branding",
    brandingHint:
      "Header-Logo (PNG, JPEG, SVG oder WebP, max. 512 KB). Alternativ URL einer gehosteten Datei.",
    logoPreview: "Logo-Vorschau",
    logoReplace: "Logo ersetzen",
    logoUpload: "Logo hochladen",
    logoUploading: "Lade hoch…",
    logoRemove: "Entfernen",
    logoConstraints: "Maximal 512 KB. PNG / JPEG / SVG / WebP.",
    logoUrlFallback: "Oder Logo-URL",
    savedNote: "✓ Gespeichert",
    generalSection: "Allgemein",
    dangerZone: "Gefahrenzone",
    archiveSelf: "Diesen Mandanten archivieren",
    archiveSelfWarn:
      "Der Mandant wird für alle Mitglieder ausgeblendet, bis ein System-Admin ihn wiederherstellt.",
    archiveSelfConfirm:
      "„{{name}}\" archivieren? Damit wird der Mandant für alle Mitglieder ausgeblendet.",
    switchTenant: "Mandant wechseln",
    currentTenant: "Aktueller Mandant",
    noMembership: "Du bist noch kein Mitglied eines Mandanten.",
  },

  sessions: {
    projects: "Projekte",
    archive: "Archiv",
    project: "Projekt",
    framework: "Framework",
    started: "Gestartet",
    lastEdit: "Zuletzt bearbeitet",
    archived: "Archiviert",
    size: "Umfang",
    nodesLabel: "Nodes",
    queriesLabel: "Fragen",
    emptyRow: "leer",
    untitled: "Unbenanntes Projekt",
    active: "Aktiv",
    filter: "Filter",
    all: "Alle",
    noneInCategory: "Keine Projekte in dieser Kategorie.",
    sort: "Sortierung",
    sortMenuAria: "Sortierung ändern",
    sortLastEdited: "Zuletzt bearbeitet",
    sortRecentlyCreated: "Zuletzt erstellt",
    sortNameAsc: "Name A → Z",
    sortNameDesc: "Name Z → A",
    sortMostNodes: "Meiste Nodes",
    loadingProjects: "Lade Projekte…",
    loadFailed: "Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
    emptyActiveTitle: "Starte deinen ersten strategischen Arbeitsstrang",
    emptyActiveDesc:
      "Eröffne ein Projekt direkt über die Startseite — mit einer Frage oder einem Framework.",
    emptyActiveCaption: "Keine Projekte vorhanden",
    emptyArchivedTitle: "Archiv ist leer",
    emptyArchivedDesc:
      "Wenn du ein Projekt abschließt, kannst du es hier ablegen, ohne es zu löschen.",
    emptyArchivedCaption: "Keine archivierten Projekte",
    goHome: "Zur Startseite →",
    deleteProjectQ: "Projekt dauerhaft löschen?",
    deleteProjectBody:
      "Alle Abfragen, Notizen und generierten Karten dieses Projekts gehen verloren.",
    deleteRowBody: "„{{name}}\"\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
    archiveFailed: "Archivieren fehlgeschlagen.",
    restoreFailed: "Wiederherstellen fehlgeschlagen.",
    deleteFailed: "Löschen fehlgeschlagen.",
    renameFailed: "Umbenennen fehlgeschlagen.",
    frameworkTip: "Framework: {{label}}",
    tipRename: "Umbenennen",
    tipArchive: "In Archiv verschieben",
    tipRestore: "Aus Archiv wiederherstellen",
    tipDelete: "Endgültig löschen",
    emptyState: "Noch keine Projekte. Starte eine neue Analyse auf der Startseite.",
  },

  invite: {
    pageTitle: "Du wurdest eingeladen",
    invitedTo: "Du wurdest zu „{{tenant}}\" als {{role}} eingeladen.",
    acceptCta: "Einladung annehmen",
    signInToAccept: "Zum Annehmen anmelden",
    alreadyMember: "Du bist bereits Mitglied dieses Mandanten.",
    expired: "Diese Einladung ist abgelaufen.",
    invalidToken: "Einladungs-Token ist ungültig oder schon verwendet.",
    // Accept-Landing
    caption: "Einladung",
    checking: "Prüfe Einladung…",
    invalidHeading: "Einladung nicht gültig",
    notFoundBody: "Diese Einladung existiert nicht oder wurde widerrufen.",
    expiredBody:
      "Diese Einladung ist abgelaufen (14 Tage ab Versand). Bitte eine neue Einladung anfordern.",
    alreadyAcceptedBody: "Diese Einladung wurde bereits angenommen.",
    goHomeLink: "Zur Startseite",
    invitedHeading: "Du wurdest eingeladen",
    invitedBodyPrefix: "Der Mandant",
    invitedBodyInvites: "lädt",
    invitedBodyAsJoin: "ein als",
    rowTenant: "Mandant",
    rowEmail: "E-Mail",
    rowRole: "Rolle",
    rowValidUntil: "Gültig bis",
    wrongAccountHeading: "Falsches Konto",
    acceptFailedHeading: "Annahme fehlgeschlagen",
    emailMismatchPrefix: "Bitte mit",
    emailMismatchSuffix: "anmelden und erneut versuchen.",
    emailMismatchSignInCta: "Zur Anmeldung →",
    acceptingCta: "Einen Moment…",
    acceptInviteCta: "Einladung annehmen →",
    acceptHint:
      "Du musst unter dieser E-Mail eingeloggt sein. Ist das nicht der Fall, wirst du zum Login weitergeleitet.",
    acceptedHeading: "Willkommen an Bord",
    acceptedBody: "Du wirst weitergeleitet…",
    noTokenError: "Kein Token in der URL.",
    acceptFailedGeneric: "Annahme fehlgeschlagen.",
  },

  monitor: {
    title: "Signal-Monitor",
    sourcesHeading: "Datenquellen-Gesundheit",
    missingRequired: "Erforderliche Zugangsdaten fehlen",
    missingOptional: "Optionale Zugangsdaten fehlen (Rate-Limit-Tier)",
    silentSource: "Konfiguriert, aber keine aktuellen Signale",
    allHealthy: "Alle Quellen gesund.",
    getKey: "Key holen",
    checkPipeline: "Pipeline prüfen",
  },

  sources: {
    heading: "Datenquellen",
    researchSubtitleSuffix: "kuratierte Forschungs- und Beratungsquellen",
    registeredLabel: "registriert",
    activeLabel: "aktiv",
    plannedLabel: "geplant",
    all: "Alle",
    category: "Kategorie",
    status: "Status",
    statusLive: "Live (aktiv)",
    statusPlanned: "Geplant (Roadmap)",
    searchPlaceholder: "Suchen...",
    colSource: "Quelle",
    colCategory: "Kategorie",
    colType: "Typ",
    colStatus: "Status",
    highPriority: "Hohe Priorität",
    noneFound: "Keine Quellen gefunden",
    noResearchFound: "Keine Forschungsquellen gefunden",
  },

  summary: {
    caption: "Zusammenfassung",
    projectFallback: "Projekt",
    loadingAnalyses: "Lade Analysen …",
    noneInProject: "Keine Analysen in diesem Projekt.",
    analysisSingular: "Analyse",
    analysisPlural: "Analysen",
    chronological: "chronologisch",
    projectNotFound: "Projekt nicht gefunden.",
    errorLabel: "Fehler",
    retry: "Erneut laden",
    emptyLabel: "Noch keine Analysen",
    emptyBody:
      "In diesem Projekt ist noch keine Analyse gespeichert. Starte eine Abfrage auf der Startseite oder im Node-Canvas — sobald ein Briefing erstellt wird, erscheint es hier.",
    printTip: "Drucken (Cmd+P)",
    printAction: "Drucken",
    exportMdTip: "Als Markdown exportieren",
    queryLabel: "Abfrage",
    confidenceLabel: "Konfidenz",
    scenarioFallback: "Szenario",
    sectionSynthesis: "Synthese",
    sectionKeyInsights: "Erkenntnisse",
    sectionScenarios: "Szenarien",
    sectionInterpretation: "Interpretation",
    sectionDecisionFramework: "Entscheidungsrahmen",
    sectionRegulatoryContext: "Regulatorischer Kontext",
    sectionFollowUps: "Folgefragen",
    sectionReferences: "Quellen",
  },

  errors: {
    unknown: "Etwas ist schiefgelaufen.",
    network: "Netzwerkfehler. Verbindung prüfen.",
    forbidden: "Du hast keine Berechtigung für diese Aktion.",
    notFound: "Nicht gefunden.",
    validation: "Bitte die markierten Felder korrigieren.",
    lastOwner:
      "Der letzte Owner kann nicht entfernt werden. Befördere vorher ein anderes Mitglied zum Owner.",
  },

  audit: {
    pageTitle: "Aktivitätsprotokoll",
    allTenantsLink: "Alle Mandanten",
    subtitle: "Jede administrative Aktion über alle Mandanten hinweg. Filter nach Mandant, Aktion oder Akteur.",
    filterAllTenants: "Alle Mandanten",
    filterAllActions: "Alle Aktionen",
    actorPlaceholder: "Akteur (E-Mail/Name)…",
    emptyForFilters: "Keine Einträge für diese Filter.",
    loadMore: "Mehr laden",
    tenantCreatedPrefix: "Mandant",
    tenantCreatedSuffix: "angelegt",
    tenantUpdated: "Stammdaten aktualisiert",
    tenantArchived: "Mandant archiviert",
    tenantRestored: "Mandant wiederhergestellt",
    tenantDeleted: "Mandant endgültig gelöscht",
    memberAddedSuffix: "als {{role}} hinzugefügt",
    memberRemovedRole: "Mitglied entfernt (Rolle: {{role}})",
    roleChangedPrefix: "Rolle geändert:",
    roleChangedArrow: "→",
    inviteSentPrefix: "Einladung an",
    inviteSentRole: "({{role}})",
    inviteRevokedPrefix: "Einladung für",
    inviteRevokedSuffix: "zurückgezogen",
    inviteAccepted: "Einladung angenommen ({{role}})",
  },
};

// ── Type machinery ─────────────────────────────────────────────────

/**
 * The English dictionary carries literal-string types (because of
 * `as const`), which is too strict to be the shape contract for other
 * locales. `Dictionary` widens values to `string` but preserves the
 * exact namespace/leaf key set, so the German dictionary is forced to
 * have the same keys without having to match the English wording.
 */
export type Dictionary = {
  [Namespace in keyof typeof en]: {
    [Leaf in keyof (typeof en)[Namespace]]: string;
  };
};

/**
 * All valid dot-paths into the dictionary, e.g. `"common.cancel"` or
 * `"admin.archiveTenantQ"`. Used as the first argument to `t()`.
 */
export type TranslationKey = {
  [Namespace in keyof Dictionary]: {
    [Leaf in keyof Dictionary[Namespace]]: `${Namespace & string}.${Leaf & string}`;
  }[keyof Dictionary[Namespace]];
}[keyof Dictionary];

// ── Lookup + interpolation ─────────────────────────────────────────

const DICTS: Record<Locale, Dictionary> = { en, de };

/**
 * Resolve a dot-path key in a given locale, falling back to EN and
 * then to the raw key. Returns the raw template string; pass
 * interpolation vars in `vars`.
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const [namespace, leaf] = key.split(".") as [
    keyof Dictionary,
    string,
  ];
  const ns = DICTS[locale]?.[namespace] as Record<string, string> | undefined;
  const enNs = DICTS.en[namespace] as Record<string, string>;
  const raw = ns?.[leaf] ?? enNs?.[leaf] ?? key;
  return vars ? interpolate(raw, vars) : raw;
}

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined || v === null ? `{{${name}}}` : String(v);
  });
}

// ── Formatting helpers ─────────────────────────────────────────────

/** BCP-47 tag for Intl APIs: "de-DE" / "en-US". */
export function localeTag(locale: Locale): string {
  return locale === "de" ? "de-DE" : "en-US";
}

/**
 * Relative time — "gerade eben" / "vor 5 Min" / "2 h ago" — uses the
 * common.*Ago keys so there's one canonical place to change the
 * wording. Input can be a Date, ISO string, or ms timestamp.
 */
export function formatRelativeTime(
  value: Date | string | number,
  locale: Locale,
): string {
  const d = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (mins < 1) return t(locale, "common.justNow");
  if (mins < 60) return t(locale, "common.minutesAgo", { n: mins });
  if (hrs < 24) return t(locale, "common.hoursAgo", { n: hrs });
  if (days < 30) return t(locale, "common.daysAgo", { n: days });
  return d.toLocaleDateString(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Legacy shim — kept so the current cockpit code that does
 * `getRingLabel(locale, "adopt")` keeps working while we migrate.
 * New call sites should use `t(locale, 'cockpit.ringAdopt')` directly.
 */
export function getRingLabel(locale: Locale, ring: string): string {
  const map: Record<string, TranslationKey> = {
    adopt: "cockpit.ringAdopt",
    trial: "cockpit.ringTrial",
    assess: "cockpit.ringAssess",
    hold: "cockpit.ringHold",
  };
  return t(locale, map[ring] ?? "cockpit.ringHold");
}
