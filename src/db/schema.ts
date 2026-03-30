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
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified"),
  name: text("name"),
  image: text("image"),
  role: text("role").default("member").notNull(), // admin | member
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
