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

/**
 * Get all version metadata for a canvas node (no result_json).
 *
 * SEC audit 2026-04: when `tenantId` is passed, the query joins
 * `radars` and drops rows whose radar belongs to another tenant.
 * Calls without `tenantId` retain the legacy global behaviour for
 * backwards compatibility (e.g. internal lib callers) — all HTTP
 * routes MUST pass one.
 *
 * Orphan versions where `radar_id IS NULL` stay readable by every
 * tenant; they're floating canvas nodes that were never bound to a
 * project and carry no tenant identity by design.
 */
export function getVersionsForNode(
  canvasNodeId: string,
  tenantId?: string,
): QueryVersionMeta[] {
  const d = db();
  try {
    const sql = tenantId
      ? `SELECT v.id, v.canvas_node_id, v.radar_id, v.query_text, v.locale,
               v.version_number, v.confidence, v.matched_trend_count,
               v.signal_count, v.executed_at, v.notes
          FROM query_versions v
          LEFT JOIN radars r ON r.id = v.radar_id
          WHERE v.canvas_node_id = ?
            AND (v.radar_id IS NULL OR r.tenant_id = ?)
          ORDER BY v.version_number DESC`
      : `SELECT id, canvas_node_id, radar_id, query_text, locale, version_number,
               confidence, matched_trend_count, signal_count, executed_at, notes
          FROM query_versions WHERE canvas_node_id = ?
          ORDER BY version_number DESC`;
    const rows = tenantId
      ? (d.prepare(sql).all(canvasNodeId, tenantId) as any[])
      : (d.prepare(sql).all(canvasNodeId) as any[]);
    return rows.map(mapMeta);
  } finally {
    d.close();
  }
}

/**
 * Get a single version with its full result_json.
 *
 * When `tenantId` is passed, the query enforces that the version's
 * radar (if any) belongs to that tenant. Without it, any caller who
 * knows a version id can read the full briefing JSON of any tenant.
 */
export function getVersion(id: string, tenantId?: string): QueryVersion | null {
  const d = db();
  try {
    const sql = tenantId
      ? `SELECT v.*
          FROM query_versions v
          LEFT JOIN radars r ON r.id = v.radar_id
          WHERE v.id = ?
            AND (v.radar_id IS NULL OR r.tenant_id = ?)`
      : `SELECT * FROM query_versions WHERE id = ?`;
    const row = tenantId
      ? (d.prepare(sql).get(id, tenantId) as any)
      : (d.prepare(sql).get(id) as any);
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

/**
 * Get recent query versions that mentioned a given trend ID in their
 * matched-trends output. Backlog-Task "Szenarien-History" (2026-04-22):
 * TrendDetailPanel zeigt damit eine Liste der letzten Analysen, die
 * diesen Trend berührt haben.
 *
 * Implementation note — SQLite-LIKE-Scan auf result_json. Funktioniert
 * ohne Schema-Migration und trifft den 99%-Fall (wir halten nur maximal
 * 20 Versionen pro Knoten, plus max ein paar Tausend Canvas-Knoten pro
 * Tenant). Ein Volltext- oder JSON-Index wäre fürwahr sauberer, aber
 * hier überdimensioniert. Wenn die Tabelle 100k+ Zeilen erreicht, auf
 * `json_each`-Query wechseln.
 *
 * Tenant-Guard: wie bei getVersionsForNode — wenn `tenantId` gesetzt
 * ist, werden nur Versionen mit passendem Radar-Tenant oder orphaned
 * Canvas-Nodes (radar_id IS NULL) zurückgegeben.
 */
export function getVersionsForTrend(
  trendId: string,
  tenantId?: string,
  limit = 10,
): QueryVersionMeta[] {
  if (!trendId || !/^[a-zA-Z0-9\-_]+$/.test(trendId)) return [];
  const d = db();
  try {
    const likePattern = `%"${trendId}"%`;
    const sql = tenantId
      ? `SELECT v.id, v.canvas_node_id, v.radar_id, v.query_text, v.locale,
               v.version_number, v.confidence, v.matched_trend_count,
               v.signal_count, v.executed_at, v.notes
          FROM query_versions v
          LEFT JOIN radars r ON r.id = v.radar_id
          WHERE v.result_json LIKE ?
            AND (v.radar_id IS NULL OR r.tenant_id = ?)
          ORDER BY v.executed_at DESC
          LIMIT ?`
      : `SELECT id, canvas_node_id, radar_id, query_text, locale, version_number,
               confidence, matched_trend_count, signal_count, executed_at, notes
          FROM query_versions
          WHERE result_json LIKE ?
          ORDER BY executed_at DESC
          LIMIT ?`;
    const rows = tenantId
      ? (d.prepare(sql).all(likePattern, tenantId, limit) as any[])
      : (d.prepare(sql).all(likePattern, limit) as any[]);
    return rows.map(mapMeta);
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
