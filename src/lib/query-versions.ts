/**
 * Query Version store — persists every query execution as a versioned snapshot.
 * Uses SQLite locally; designed to be swapped for Postgres in production.
 */
import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  // Idempotent — ensure tables exist
  d.exec(`CREATE TABLE IF NOT EXISTS query_versions (
    id TEXT PRIMARY KEY,
    canvas_node_id TEXT NOT NULL,
    radar_id TEXT,
    query_text TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'de',
    version_number INTEGER NOT NULL DEFAULT 1,
    result_json TEXT NOT NULL,
    confidence REAL,
    matched_trend_count INTEGER,
    signal_count INTEGER,
    executed_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  )`);
  d.exec(`CREATE INDEX IF NOT EXISTS qv_canvas_node ON query_versions(canvas_node_id, version_number DESC)`);
  d.exec(`CREATE INDEX IF NOT EXISTS qv_radar ON query_versions(radar_id, executed_at DESC)`);
  return d;
}

export interface QueryVersionMeta {
  id: string;
  canvasNodeId: string;
  radarId: string | null;
  queryText: string;
  locale: string;
  versionNumber: number;
  confidence: number | null;
  matchedTrendCount: number | null;
  signalCount: number | null;
  executedAt: string;
  notes: string | null;
}

export interface QueryVersion extends QueryVersionMeta {
  resultJson: unknown;
}

/** Save a new version. Returns the saved version's id. */
export function saveQueryVersion(opts: {
  canvasNodeId: string;
  radarId?: string | null;
  queryText: string;
  locale: string;
  result: unknown;
  confidence?: number | null;
  matchedTrendCount?: number | null;
  signalCount?: number | null;
}): string {
  const d = db();
  try {
    const prev = d
      .prepare(`SELECT MAX(version_number) as max_v FROM query_versions WHERE canvas_node_id = ?`)
      .get(opts.canvasNodeId) as { max_v: number | null };
    const versionNumber = (prev.max_v ?? 0) + 1;
    const id = randomUUID();
    d.prepare(`
      INSERT INTO query_versions
        (id, canvas_node_id, radar_id, query_text, locale, version_number, result_json, confidence, matched_trend_count, signal_count, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      opts.canvasNodeId,
      opts.radarId ?? null,
      opts.queryText,
      opts.locale,
      versionNumber,
      JSON.stringify(opts.result),
      opts.confidence ?? null,
      opts.matchedTrendCount ?? null,
      opts.signalCount ?? null,
    );
    // Keep at most 20 versions per node (prune oldest)
    d.prepare(`
      DELETE FROM query_versions
      WHERE canvas_node_id = ? AND id NOT IN (
        SELECT id FROM query_versions WHERE canvas_node_id = ?
        ORDER BY version_number DESC LIMIT 20
      )
    `).run(opts.canvasNodeId, opts.canvasNodeId);
    return id;
  } finally {
    d.close();
  }
}

/** Get all version metadata for a canvas node (no result_json — lightweight). */
export function getVersionsForNode(canvasNodeId: string): QueryVersionMeta[] {
  const d = db();
  try {
    const rows = d.prepare(`
      SELECT id, canvas_node_id, radar_id, query_text, locale, version_number,
             confidence, matched_trend_count, signal_count, executed_at, notes
      FROM query_versions WHERE canvas_node_id = ?
      ORDER BY version_number DESC
    `).all(canvasNodeId) as any[];
    return rows.map(mapMeta);
  } finally {
    d.close();
  }
}

/** Get a single version with its full result_json. */
export function getVersion(id: string): QueryVersion | null {
  const d = db();
  try {
    const row = d.prepare(`SELECT * FROM query_versions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return { ...mapMeta(row), resultJson: JSON.parse(row.result_json) };
  } finally {
    d.close();
  }
}

/** Count how many versions exist for a given canvas node. */
export function getVersionCount(canvasNodeId: string): number {
  const d = db();
  try {
    const row = d.prepare(`SELECT COUNT(*) as c FROM query_versions WHERE canvas_node_id = ?`).get(canvasNodeId) as { c: number };
    return row.c;
  } finally {
    d.close();
  }
}

/** Get version counts for multiple canvas node IDs (batch). */
export function getVersionCounts(canvasNodeIds: string[]): Record<string, number> {
  if (canvasNodeIds.length === 0) return {};
  const d = db();
  try {
    const placeholders = canvasNodeIds.map(() => "?").join(",");
    const rows = d.prepare(`
      SELECT canvas_node_id, COUNT(*) as c FROM query_versions
      WHERE canvas_node_id IN (${placeholders})
      GROUP BY canvas_node_id
    `).all(...canvasNodeIds) as Array<{ canvas_node_id: string; c: number }>;
    const result: Record<string, number> = {};
    for (const r of rows) result[r.canvas_node_id] = r.c;
    return result;
  } finally {
    d.close();
  }
}

function mapMeta(row: any): QueryVersionMeta {
  return {
    id: row.id,
    canvasNodeId: row.canvas_node_id,
    radarId: row.radar_id,
    queryText: row.query_text,
    locale: row.locale,
    versionNumber: row.version_number,
    confidence: row.confidence,
    matchedTrendCount: row.matched_trend_count,
    signalCount: row.signal_count,
    executedAt: row.executed_at,
    notes: row.notes,
  };
}
