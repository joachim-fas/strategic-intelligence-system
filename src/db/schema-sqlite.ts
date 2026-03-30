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
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique().notNull(),
  name: text("name"),
  role: text("role").default("member").notNull(),
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
export const radars = sqliteTable("radars", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  scope: text("scope").default("{}"),
  isShared: integer("is_shared", { mode: "boolean" }).default(false),
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
