import {
  pgTable,
  uuid,
  text,
  real,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Users ───────────────────────────────────────────────
// `role` hier = System-Rolle (orthogonal zur Tenant-Rolle). Werte:
//   - "member" → normaler Nutzer (kann Mitglied in Tenants sein)
//   - "admin"  → System-Admin (darf Tenants anlegen / administrieren)
// Die tenant-spezifische Rolle steht in `tenant_memberships.role`.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified"),
  name: text("name"),
  image: text("image"),
  role: text("role").default("member").notNull(), // admin | member
  lastActiveTenantId: uuid("last_active_tenant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tenants (Mandanten / Organisationen) ──────────────────
// Ein Tenant = eine Kunden-Organisation. Alle User-Daten (radars, queries,
// notes, scenarios, bsc_ratings) sind pro Tenant isoliert. Stammdaten
// (trends, trend_signals, data_sources) bleiben global shared.
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  plan: text("plan").default("standard").notNull(),
  settings: jsonb("settings").default({}),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tenant Memberships ────────────────────────────────────
// N:N user↔tenant mit Rolle pro Membership.
export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(), // owner | admin | member | viewer
    invitedBy: uuid("invited_by").references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("tenant_membership_unique").on(table.tenantId, table.userId)],
);

// ─── Tenant Invites ───────────────────────────────────────
export const tenantInvites = pgTable("tenant_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").unique().notNull(),
  invitedBy: uuid("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tenant Audit Log ─────────────────────────────────────
export const tenantAuditLog = pgTable("tenant_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  target: jsonb("target").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── NextAuth: Accounts ──────────────────────────────────
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

// ─── NextAuth: Sessions ──────────────────────────────────
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").unique().notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expires: timestamp("expires").notNull(),
});

// ─── NextAuth: Verification Tokens ───────────────────────
export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

// ─── Trends (global, one per concept) ────────────────────
export const trends = pgTable("trends", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  tags: text("tags").array(),
  status: text("status").default("candidate").notNull(), // candidate | confirmed | archived
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSignalAt: timestamp("last_signal_at"),
  aggRelevance: real("agg_relevance"),
  aggConfidence: real("agg_confidence"),
  aggImpact: real("agg_impact"),
  timeHorizon: text("time_horizon"), // short | mid | long
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Trend Signals (evidence, append-only) ───────────────
export const trendSignals = pgTable("trend_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  trendId: uuid("trend_id").references(() => trends.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  signalType: text("signal_type").notNull(), // mention | spike | new_repo | paper | discussion
  signalStrength: real("signal_strength").notNull(),
  rawData: jsonb("raw_data"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Radars (user-curated lenses) ────────────────────────
export const radars = pgTable("radars", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  scope: jsonb("scope").default({}), // { categories: [], tags: [] }
  isShared: boolean("is_shared").default(false),
  canvasState: text("canvas_state"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Radar Trends (join + per-radar scores) ──────────────
export const radarTrends = pgTable(
  "radar_trends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    radarId: uuid("radar_id")
      .references(() => radars.id, { onDelete: "cascade" })
      .notNull(),
    trendId: uuid("trend_id")
      .references(() => trends.id, { onDelete: "cascade" })
      .notNull(),
    relevance: real("relevance").notNull(),
    confidence: real("confidence").notNull(),
    impact: real("impact").notNull(),
    timeHorizon: text("time_horizon").notNull(),
    ring: text("ring").notNull(), // adopt | trial | assess | hold
    quadrant: text("quadrant"),
    userOverride: boolean("user_override").default(false),
    notes: text("notes"),
    pinned: boolean("pinned").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("radar_trend_unique").on(table.radarId, table.trendId)]
);

// ─── Radar Configs (weighting preferences) ───────────────
export const radarConfigs = pgTable("radar_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  radarId: uuid("radar_id")
    .references(() => radars.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  sourceWeights: jsonb("source_weights").default({
    google_trends: 1.0,
    hackernews: 1.0,
    arxiv: 0.5,
    github: 1.0,
    news: 1.0,
    reddit: 0.8,
    stackoverflow: 0.7,
    npm_pypi: 0.6,
    producthunt: 0.5,
    wikipedia: 0.4,
  }),
  dimensionWeights: jsonb("dimension_weights").default({
    relevance: 0.35,
    confidence: 0.25,
    impact: 0.25,
    recency: 0.15,
  }),
  autoInclude: jsonb("auto_include").default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Score Log (daily snapshots for sparklines) ──────────
export const scoreLog = pgTable("score_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  trendId: uuid("trend_id")
    .references(() => trends.id, { onDelete: "cascade" })
    .notNull(),
  relevance: real("relevance"),
  confidence: real("confidence"),
  impact: real("impact"),
  signalCount: integer("signal_count"),
  snapshotDate: date("snapshot_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Data Sources (connector registry) ───────────────────
export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").default(true),
  config: jsonb("config").default({}),
  lastRunAt: timestamp("last_run_at"),
  lastStatus: text("last_status"),
  runInterval: text("run_interval").default("6h"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Project Queries (saved analyses per project) ───────
export const projectQueries = pgTable("project_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  radarId: uuid("radar_id")
    .references(() => radars.id, { onDelete: "cascade" })
    .notNull(),
  query: text("query").notNull(),
  locale: text("locale").default("de"),
  resultJson: jsonb("result_json"),
  contextProfile: jsonb("context_profile"),
  pinned: boolean("pinned").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Project Notes (annotations per project or query) ───
export const projectNotes = pgTable("project_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  radarId: uuid("radar_id")
    .references(() => radars.id, { onDelete: "cascade" })
    .notNull(),
  queryId: uuid("query_id")
    .references(() => projectQueries.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Query Versions (versioned query results) ─────────────
export const queryVersions = pgTable("query_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  canvasNodeId: text("canvas_node_id").notNull(),
  radarId: uuid("radar_id").references(() => radars.id, { onDelete: "cascade" }),
  queryText: text("query_text").notNull(),
  locale: text("locale").notNull().default("de"),
  versionNumber: integer("version_number").notNull().default(1),
  resultJson: jsonb("result_json").notNull(),
  confidence: real("confidence"),
  matchedTrendCount: integer("matched_trend_count"),
  signalCount: integer("signal_count"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  notes: text("notes"),
});

// ─── BSC Ratings ────────────────────────────────────────
export const bscRatings = pgTable("bsc_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryHash: text("query_hash").notNull(),
  perspectiveId: text("perspective_id").notNull(),
  rating: text("rating").notNull(), // 'up' | 'down'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("bsc_ratings_unique").on(table.queryHash, table.perspectiveId)]);

// ─── Scenarios ──────────────────────────────────────────
export const scenarios = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("custom"),
  probability: real("probability").default(0.5),
  timeframe: text("timeframe"),
  keyDrivers: text("key_drivers"),
  impacts: text("impacts"),
  source: text("source").default("user"),
  sourceQuery: text("source_query"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Scenario Alerts (staleness detection) ───────────────
export const scenarioAlerts = pgTable("scenario_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  canvasNodeId: text("canvas_node_id").notNull(),
  radarId: uuid("radar_id").references(() => radars.id, { onDelete: "cascade" }),
  queryText: text("query_text").notNull(),
  triggerSignalId: text("trigger_signal_id"),
  reason: text("reason").notNull(),
  severity: text("severity").notNull().default("medium"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dismissedAt: timestamp("dismissed_at"),
});
