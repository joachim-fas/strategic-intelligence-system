/**
 * SQLite-compatible schema for local development.
 *
 * Mirrors the PostgreSQL schema in ./schema.ts but uses SQLite column types.
 * SQLite does not support arrays or jsonb natively — we store them as TEXT
 * and JSON-parse on read.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Helper: generate a v4-style UUID as default
const uuidDefault = sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;
const nowDefault = sql`(datetime('now'))`;

// ─── Users ───────────────────────────────────────────────
// `role` hier = System-Rolle (orthogonal zur Tenant-Rolle). Werte:
//   - "member"  → normaler Nutzer (kann Mitglied in Tenants sein)
//   - "admin"   → System-Admin (sieht /admin/mandanten, darf Tenants anlegen)
// Die tenant-spezifische Rolle (owner/admin/member/viewer) steht in
// `tenant_memberships.role` und wird pro Orga gefuehrt.
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique().notNull(),
  emailVerified: text("email_verified"),
  name: text("name"),
  image: text("image"),
  role: text("role").default("member").notNull(),
  // Welcher Tenant war zuletzt aktiv — wird beim Login als Default geladen,
  // damit User nicht jedes Mal neu wechseln muss.
  lastActiveTenantId: text("last_active_tenant_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Tenants (Mandanten / Organisationen) ──────────────────
// Ein Tenant = eine Kunden-Organisation. Alle User-Daten (radars, queries,
// notes, scenarios, bsc_ratings) sind pro Tenant isoliert. Stammdaten
// (trends, trend_signals, data_sources) bleiben global shared.
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(), // URL-safe, z.B. "mercedes-strategie"
  plan: text("plan").default("standard").notNull(), // fuer spaetere Tiers
  settings: text("settings").default("{}"), // JSON: branding, timezone, defaults
  archivedAt: text("archived_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Tenant Memberships ────────────────────────────────────
// N:N zwischen users und tenants mit Rolle pro Membership. Ein User kann
// in mehreren Orgas Mitglied sein mit jeweils anderer Rolle.
export const tenantMemberships = sqliteTable(
  "tenant_memberships",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // 'owner' | 'admin' | 'member' | 'viewer'
    role: text("role").notNull(),
    invitedBy: text("invited_by").references(() => users.id),
    joinedAt: text("joined_at").default(sql`(datetime('now'))`).notNull(),
  },
  (table) => [
    // Kein User kann doppelt in derselben Orga sein.
    uniqueIndex("tenant_membership_unique").on(table.tenantId, table.userId),
  ],
);

// ─── Tenant Invites ───────────────────────────────────────
// Einladungen per Email fuer User, die noch kein Konto haben oder in der
// Ziel-Orga noch kein Mitglied sind. Token ist kryptografisch und wird via
// Magic-Link-Email versendet.
export const tenantInvites = sqliteTable("tenant_invites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").unique().notNull(),
  invitedBy: text("invited_by").references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Tenant Audit Log ─────────────────────────────────────
// Minimal-Audit-Trail fuer administrative Aktionen pro Tenant.
// Voller Log-Viewer ist erst fuer spaeter geplant — hier nur die
// Datenbasis + ein Preview im Tenant-Detail.
export const tenantAuditLog = sqliteTable("tenant_audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  actorUserId: text("actor_user_id").references(() => users.id),
  // Beispiele: 'member.added', 'member.removed', 'role.changed',
  // 'tenant.archived', 'invite.sent', 'invite.revoked', 'canvas.deleted'
  action: text("action").notNull(),
  target: text("target").default("{}"), // JSON mit kontextbezogenen Feldern
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── NextAuth tables ─────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
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

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text("session_token").unique().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expires: text("expires").notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: text("expires").notNull(),
});

// ─── Trends ──────────────────────────────────────────────
export const trends = sqliteTable("trends", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  tags: text("tags"), // JSON array stored as text
  status: text("status").default("candidate").notNull(),
  firstSeenAt: text("first_seen_at").default(sql`(datetime('now'))`).notNull(),
  lastSignalAt: text("last_signal_at"),
  aggRelevance: real("agg_relevance"),
  aggConfidence: real("agg_confidence"),
  aggImpact: real("agg_impact"),
  timeHorizon: text("time_horizon"),
  metadata: text("metadata").default("{}"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Trend Signals ───────────────────────────────────────
export const trendSignals = sqliteTable("trend_signals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  trendId: text("trend_id").references(() => trends.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  signalType: text("signal_type").notNull(),
  signalStrength: real("signal_strength").notNull(),
  rawData: text("raw_data"),
  detectedAt: text("detected_at").default(sql`(datetime('now'))`).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Radars ──────────────────────────────────────────────
// `tenant_id` ist die Zugriffs-Grenze (was "Mercedes" sieht vs. "VW").
// `owner_id` bleibt erhalten als "Ersteller" (historisch, fuer Attribution),
// hat aber KEINE Zugriffsbedeutung mehr — Zugriff kommt aus tenant_id +
// Rolle aus tenant_memberships. tenant_id ist technisch nullable, damit
// alte Rows nach dem Seed backfilled werden koennen; neue Rows sollen
// immer tenant_id setzen.
export const radars = sqliteTable("radars", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  scope: text("scope").default("{}"),
  isShared: integer("is_shared", { mode: "boolean" }).default(false),
  canvasState: text("canvas_state"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Radar Trends ────────────────────────────────────────
export const radarTrends = sqliteTable(
  "radar_trends",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    radarId: text("radar_id")
      .references(() => radars.id, { onDelete: "cascade" })
      .notNull(),
    trendId: text("trend_id")
      .references(() => trends.id, { onDelete: "cascade" })
      .notNull(),
    relevance: real("relevance").notNull(),
    confidence: real("confidence").notNull(),
    impact: real("impact").notNull(),
    timeHorizon: text("time_horizon").notNull(),
    ring: text("ring").notNull(),
    quadrant: text("quadrant"),
    userOverride: integer("user_override", { mode: "boolean" }).default(false),
    notes: text("notes"),
    pinned: integer("pinned", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
  },
  (table) => [uniqueIndex("radar_trend_unique").on(table.radarId, table.trendId)]
);

// ─── Radar Configs ───────────────────────────────────────
export const radarConfigs = sqliteTable("radar_configs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  radarId: text("radar_id")
    .references(() => radars.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  sourceWeights: text("source_weights").default(
    JSON.stringify({
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
    })
  ),
  dimensionWeights: text("dimension_weights").default(
    JSON.stringify({
      relevance: 0.35,
      confidence: 0.25,
      impact: 0.25,
      recency: 0.15,
    })
  ),
  autoInclude: text("auto_include").default("{}"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Score Log ───────────────────────────────────────────
export const scoreLog = sqliteTable("score_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  trendId: text("trend_id")
    .references(() => trends.id, { onDelete: "cascade" })
    .notNull(),
  relevance: real("relevance"),
  confidence: real("confidence"),
  impact: real("impact"),
  signalCount: integer("signal_count"),
  snapshotDate: text("snapshot_date").default(sql`(date('now'))`).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Project Queries (saved analyses per project) ───────
export const projectQueries = sqliteTable("project_queries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  radarId: text("radar_id")
    .references(() => radars.id, { onDelete: "cascade" })
    .notNull(),
  query: text("query").notNull(),
  locale: text("locale").default("de"),
  resultJson: text("result_json"),          // full LLM response as JSON
  contextProfile: text("context_profile"),  // role/industry/region as JSON
  pinned: integer("pinned", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Project Notes (annotations per project or query) ───
export const projectNotes = sqliteTable("project_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  radarId: text("radar_id")
    .references(() => radars.id, { onDelete: "cascade" })
    .notNull(),
  queryId: text("query_id")
    .references(() => projectQueries.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── BSC Ratings ────────────────────────────────────────
// Vorher global — jetzt tenant-scoped. `queryHash` ist weiterhin der
// stabile Identifier der Query, Ratings werden aber pro Tenant getrennt,
// damit zwei Orgas zur gleichen Query unterschiedliche Bewertungen fuehren
// koennen. Unique-Index erweitert um tenant_id.
export const bscRatings = sqliteTable("bsc_ratings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  queryHash: text("query_hash").notNull(),
  perspectiveId: text("perspective_id").notNull(),
  rating: text("rating").notNull(), // 'up' | 'down'
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
}, (table) => [uniqueIndex("bsc_ratings_unique").on(table.tenantId, table.queryHash, table.perspectiveId)]);

// ─── Scenarios ──────────────────────────────────────────
// Vorher global (TODO SEC-14 flagte das). Jetzt pro Tenant — jede Orga
// fuehrt ihre eigene Szenario-Bibliothek.
export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("custom"),
  probability: real("probability").default(0.5),
  timeframe: text("timeframe"),
  keyDrivers: text("key_drivers"),    // JSON array stored as text
  impacts: text("impacts"),           // JSON array stored as text
  source: text("source").default("user"),
  sourceQuery: text("source_query"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

// ─── Scenario Alerts ────────────────────────────────────
export const scenarioAlerts = sqliteTable("scenario_alerts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  canvasNodeId: text("canvas_node_id").notNull(),
  radarId: text("radar_id").references(() => radars.id, { onDelete: "cascade" }),
  queryText: text("query_text").notNull(),
  triggerSignalId: text("trigger_signal_id"),
  reason: text("reason").notNull(),
  severity: text("severity").default("medium").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  dismissedAt: text("dismissed_at"),
});

// ─── Query Versions ─────────────────────────────────────
export const queryVersions = sqliteTable("query_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  canvasNodeId: text("canvas_node_id").notNull(),
  radarId: text("radar_id").references(() => radars.id, { onDelete: "cascade" }),
  queryText: text("query_text").notNull(),
  locale: text("locale").default("de").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  resultJson: text("result_json").notNull(),
  confidence: real("confidence"),
  matchedTrendCount: integer("matched_trend_count"),
  signalCount: integer("signal_count"),
  executedAt: text("executed_at").default(sql`(datetime('now'))`).notNull(),
  notes: text("notes"),
});

// ─── Data Sources ────────────────────────────────────────
export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").unique().notNull(),
  displayName: text("display_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  config: text("config").default("{}"),
  lastRunAt: text("last_run_at"),
  lastStatus: text("last_status"),
  runInterval: text("run_interval").default("6h"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});
