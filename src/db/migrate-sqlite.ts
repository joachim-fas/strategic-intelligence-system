/**
 * SQLite schema initialisation for local development.
 *
 * Run with: npx tsx src/db/migrate-sqlite.ts
 *
 * Creates all tables in local.db if they do not already exist.
 * This is the SQLite equivalent of `npm run db:push` for Postgres.
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "local.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

const statements = [
  // ─── Users ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    email_verified TEXT,
    name TEXT,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── NextAuth: Accounts ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT
  )`,

  // ─── NextAuth: Sessions ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TEXT NOT NULL
  )`,

  // ─── NextAuth: Verification Tokens ──────────────────
  `CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TEXT NOT NULL
  )`,

  // ─── Trends ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS trends (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    tags TEXT,
    status TEXT NOT NULL DEFAULT 'candidate',
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_signal_at TEXT,
    agg_relevance REAL,
    agg_confidence REAL,
    agg_impact REAL,
    time_horizon TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Trend Signals ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS trend_signals (
    id TEXT PRIMARY KEY,
    trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_url TEXT,
    source_title TEXT,
    signal_type TEXT NOT NULL,
    signal_strength REAL NOT NULL,
    raw_data TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Radars ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS radars (
    id TEXT PRIMARY KEY,
    owner_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    scope TEXT DEFAULT '{}',
    is_shared INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Radar Trends ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS radar_trends (
    id TEXT PRIMARY KEY,
    radar_id TEXT NOT NULL REFERENCES radars(id) ON DELETE CASCADE,
    trend_id TEXT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    relevance REAL NOT NULL,
    confidence REAL NOT NULL,
    impact REAL NOT NULL,
    time_horizon TEXT NOT NULL,
    ring TEXT NOT NULL,
    quadrant TEXT,
    user_override INTEGER DEFAULT 0,
    notes TEXT,
    pinned INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS radar_trend_unique ON radar_trends(radar_id, trend_id)`,

  // ─── Radar Configs ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS radar_configs (
    id TEXT PRIMARY KEY,
    radar_id TEXT NOT NULL UNIQUE REFERENCES radars(id) ON DELETE CASCADE,
    source_weights TEXT DEFAULT '${JSON.stringify({
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
    })}',
    dimension_weights TEXT DEFAULT '${JSON.stringify({
      relevance: 0.35,
      confidence: 0.25,
      impact: 0.25,
      recency: 0.15,
    })}',
    auto_include TEXT DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Score Log ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS score_log (
    id TEXT PRIMARY KEY,
    trend_id TEXT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    relevance REAL,
    confidence REAL,
    impact REAL,
    signal_count INTEGER,
    snapshot_date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Data Sources ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS data_sources (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    config TEXT DEFAULT '{}',
    last_run_at TEXT,
    last_status TEXT,
    run_interval TEXT DEFAULT '6h',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Live Signals (RAG layer) ────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS live_signals (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    topic TEXT,
    tags TEXT,
    signal_type TEXT,
    strength REAL,
    raw_data TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS live_signals_fetched_at ON live_signals(fetched_at DESC)`,
  `CREATE INDEX IF NOT EXISTS live_signals_topic ON live_signals(topic)`,

  // ─── Project Queries ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS project_queries (
    id TEXT PRIMARY KEY,
    radar_id TEXT NOT NULL REFERENCES radars(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    locale TEXT DEFAULT 'de',
    result_json TEXT,
    context_profile TEXT,
    pinned INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── BSC Ratings ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bsc_ratings (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL,
    perspective_id TEXT NOT NULL,
    rating TEXT NOT NULL CHECK(rating IN ('up', 'down')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(query_hash, perspective_id)
  )`,

  // ─── Project Notes ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS project_notes (
    id TEXT PRIMARY KEY,
    radar_id TEXT NOT NULL REFERENCES radars(id) ON DELETE CASCADE,
    query_id TEXT REFERENCES project_queries(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── Query Versions (versioned query results) ────────────────────────────
  `CREATE TABLE IF NOT EXISTS query_versions (
    id TEXT PRIMARY KEY,
    canvas_node_id TEXT NOT NULL,
    radar_id TEXT REFERENCES radars(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'de',
    version_number INTEGER NOT NULL DEFAULT 1,
    result_json TEXT NOT NULL,
    confidence REAL,
    matched_trend_count INTEGER,
    signal_count INTEGER,
    executed_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS qv_canvas_node ON query_versions(canvas_node_id, version_number DESC)`,
  `CREATE INDEX IF NOT EXISTS qv_radar ON query_versions(radar_id, executed_at DESC)`,

  // ─── Scenario Alerts (staleness detection) ───────────────────────────────
  `CREATE TABLE IF NOT EXISTS scenario_alerts (
    id TEXT PRIMARY KEY,
    canvas_node_id TEXT NOT NULL,
    radar_id TEXT REFERENCES radars(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    trigger_signal_id TEXT,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    dismissed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS sa_canvas_node ON scenario_alerts(canvas_node_id, dismissed_at)`,

  // ─── OG Image Cache ──────────────────────────────────────────────────────
  // Caches Open-Graph image URLs extracted from signal target pages so the
  // Signale-Tab card grid can render image previews without re-hitting the
  // target site on every mount. Entry per URL. `status` tracks whether the
  // lookup succeeded — "ok" (image found), "no-image" (page had no og:image
  // or twitter:image), or "error" (fetch failed / blocked). `expires_at`
  // drives TTL-based refresh: 7 days for successes, 1 day for failures.
  `CREATE TABLE IF NOT EXISTS og_image_cache (
    url TEXT PRIMARY KEY,
    image_url TEXT,
    status TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS og_image_cache_expires ON og_image_cache(expires_at)`,
];

console.log("Initialising SQLite database at:", dbPath);

for (const stmt of statements) {
  db.exec(stmt);
}

console.log("SQLite schema created successfully.");
db.close();
