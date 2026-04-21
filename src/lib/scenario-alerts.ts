/**
 * Scenario alert system — detects when new signals might invalidate existing analyses.
 *
 * Backlog-Task „Trigger-System: Schwellwert-Logik" (2026-04-22): die
 * Keyword-Overlap- und Source-Tier-Helper aus `lib/signals` wiederverwenden,
 * damit die Alert-Relevanz dieselbe Topic-Fit-Metrik nutzt wie das
 * Briefing-UI. Vorher war's „Signal-Wort in Query-Text enthalten" — das
 * hat einen Bluesky-Personal-Post bei einer Wien-Bezirk-Analyse als
 * potenziellen Alert gewertet. Jetzt gelten dieselben per-Tier-
 * Schwellen wie im Retrieval: authoritative 0.25 gewichtete Overlap,
 * social 0.60, plus Anchor-Keyword-Match.
 */
import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";
import { classifySource, computeKeywordStats, extractQueryKeywords } from "./signals";
import type { SourceTier } from "@/types";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  d.exec(`CREATE TABLE IF NOT EXISTS scenario_alerts (
    id TEXT PRIMARY KEY,
    canvas_node_id TEXT NOT NULL,
    radar_id TEXT,
    query_text TEXT NOT NULL,
    trigger_signal_id TEXT,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    dismissed_at TEXT
  )`);
  d.exec(`CREATE INDEX IF NOT EXISTS sa_canvas_node ON scenario_alerts(canvas_node_id, dismissed_at)`);
  return d;
}

export interface ScenarioAlert {
  id: string;
  canvasNodeId: string;
  radarId: string | null;
  queryText: string;
  triggerSignalId: string | null;
  reason: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
  dismissedAt: string | null;
}

/** Get all unresolved alerts for a canvas node. */
export function getAlertsForNode(canvasNodeId: string): ScenarioAlert[] {
  const d = db();
  try {
    const rows = d.prepare(`
      SELECT * FROM scenario_alerts
      WHERE canvas_node_id = ? AND dismissed_at IS NULL
      ORDER BY created_at DESC
    `).all(canvasNodeId) as any[];
    return rows.map(mapAlert);
  } finally {
    d.close();
  }
}

/**
 * Get unresolved alert counts for multiple canvas nodes (batch).
 *
 * When `tenantId` is provided, the query joins `radars` and drops
 * counts for alerts whose radar lives in a different tenant. Calls
 * without `tenantId` retain the pre-tenant global behaviour; new
 * call-sites should always pass one so the count leak (node IDs from
 * other tenants being probeable) doesn't re-open.
 */
export function getAlertCounts(
  canvasNodeIds: string[],
  tenantId?: string,
): Record<string, number> {
  if (canvasNodeIds.length === 0) return {};
  const d = db();
  try {
    const placeholders = canvasNodeIds.map(() => "?").join(",");
    const sql = tenantId
      ? `SELECT a.canvas_node_id, COUNT(*) as c FROM scenario_alerts a
          LEFT JOIN radars r ON r.id = a.radar_id
          WHERE a.canvas_node_id IN (${placeholders})
            AND a.dismissed_at IS NULL
            AND (a.radar_id IS NULL OR r.tenant_id = ?)
          GROUP BY a.canvas_node_id`
      : `SELECT canvas_node_id, COUNT(*) as c FROM scenario_alerts
          WHERE canvas_node_id IN (${placeholders}) AND dismissed_at IS NULL
          GROUP BY canvas_node_id`;
    const args = tenantId ? [...canvasNodeIds, tenantId] : canvasNodeIds;
    const rows = d.prepare(sql).all(...args) as Array<{ canvas_node_id: string; c: number }>;
    const result: Record<string, number> = {};
    for (const r of rows) result[r.canvas_node_id] = r.c;
    return result;
  } finally {
    d.close();
  }
}

/**
 * Dismiss an alert.
 *
 * Returns `true` if a row was updated, `false` otherwise (unknown id or
 * cross-tenant). When `tenantId` is provided, the UPDATE joins radars
 * so a tenant-A member can't dismiss a tenant-B alert by guessing its
 * id. Alerts with a null radar_id stay globally-dismissable — they're
 * orphaned and nobody should be surfacing them anyway.
 */
export function dismissAlert(id: string, tenantId?: string): boolean {
  const d = db();
  try {
    const stmt = tenantId
      ? d.prepare(`
          UPDATE scenario_alerts
          SET dismissed_at = datetime('now')
          WHERE id = ?
            AND (
              radar_id IS NULL
              OR EXISTS (SELECT 1 FROM radars r WHERE r.id = scenario_alerts.radar_id AND r.tenant_id = ?)
            )`)
      : d.prepare(`UPDATE scenario_alerts SET dismissed_at = datetime('now') WHERE id = ?`);
    const result = tenantId ? stmt.run(id, tenantId) : stmt.run(id);
    return Number(result.changes ?? 0) > 0;
  } finally {
    d.close();
  }
}

/** Create a new alert. */
export function createAlert(opts: {
  canvasNodeId: string;
  radarId?: string | null;
  queryText: string;
  triggerSignalId?: string | null;
  reason: string;
  severity?: "low" | "medium" | "high";
}): string {
  const d = db();
  try {
    const id = randomUUID();
    d.prepare(`
      INSERT INTO scenario_alerts (id, canvas_node_id, radar_id, query_text, trigger_signal_id, reason, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, opts.canvasNodeId, opts.radarId ?? null, opts.queryText, opts.triggerSignalId ?? null, opts.reason, opts.severity ?? "medium");
    return id;
  } finally {
    d.close();
  }
}

/**
 * Minimum signal strength + minimum topic-fit per source tier for an
 * alert to fire. Mirrors the per-tier thresholds in getRelevantSignals
 * so the alert-system is as permissive (or strict) as the retrieval —
 * an alert about a Bluesky post that wouldn't even pass retrieval is
 * pure noise. Extracted as named constants so downstream test code
 * and ops dashboards can reference them.
 */
export const ALERT_MIN_STRENGTH = 0.65;
export const ALERT_HIGH_SEVERITY_STRENGTH = 0.85;
export const ALERT_TIER_MIN_TOPIC_FIT: Record<SourceTier, number> = {
  authoritative: 0.25,
  academic: 0.30,
  media: 0.30,
  proxy: 0.40,
  social: 0.60,
};

/**
 * After a signal refresh, scan existing query_versions for potentially stale analyses.
 * Compares new signal topics against query texts. Creates alerts for matches.
 *
 * This is called from the signals route after a successful refresh.
 *
 * Topic-fit rule (since 2026-04-22):
 *   - Signal-Text muss mindestens ein ≥5-Zeichen-Keyword der Query enthalten
 *     (Anchor-Match) — verhindert, dass generische Kurzwörter-Treffer zählen.
 *   - Gewichtete Keyword-Overlap (Wortlänge-weighted) muss die per-Tier-
 *     Schwelle reißen (ALERT_TIER_MIN_TOPIC_FIT).
 *   - Signal-Stärke muss über ALERT_MIN_STRENGTH liegen.
 */
export function checkForStaleness(
  newSignals: Array<{ id: string; title: string; topic?: string; strength?: number; source?: string }>
): void {
  if (newSignals.length === 0) return;
  const d = db();
  try {
    // Get all most-recent query versions (one per canvas_node_id), executed more than 12h ago
    const recentVersions = d.prepare(`
      SELECT canvas_node_id, query_text, radar_id, MAX(version_number) as max_v, executed_at
      FROM query_versions
      WHERE executed_at < datetime('now', '-12 hours')
      GROUP BY canvas_node_id
    `).all() as Array<{ canvas_node_id: string; query_text: string; radar_id: string | null; executed_at: string }>;

    if (recentVersions.length === 0) return;

    // High-strength signals only
    const strongSignals = newSignals.filter(s => (s.strength ?? 0) > ALERT_MIN_STRENGTH);
    if (strongSignals.length === 0) return;

    // For each version, check if any strong signal is topically relevant
    for (const version of recentVersions) {
      const queryKeywords = extractQueryKeywords(version.query_text);
      if (queryKeywords.length === 0) continue;

      for (const signal of strongSignals) {
        const signalText = `${signal.title} ${signal.topic ?? ""}`;
        const stats = computeKeywordStats(queryKeywords, signalText);
        if (!stats.anchorMatched) continue;

        const tier = signal.source ? classifySource(signal.source) : "media";
        const minTopicFit = ALERT_TIER_MIN_TOPIC_FIT[tier];
        if (stats.weightedOverlap < minTopicFit) continue;

        // Don't create duplicate alerts (same node + signal)
        const exists = d.prepare(`
          SELECT 1 FROM scenario_alerts
          WHERE canvas_node_id = ? AND trigger_signal_id = ? AND dismissed_at IS NULL
        `).get(version.canvas_node_id, signal.id);
        if (exists) continue;

        const severity: "low" | "medium" | "high" =
          (signal.strength ?? 0) > ALERT_HIGH_SEVERITY_STRENGTH ? "high" : "medium";
        d.prepare(`
          INSERT INTO scenario_alerts (id, canvas_node_id, radar_id, query_text, trigger_signal_id, reason, severity)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          version.canvas_node_id,
          version.radar_id,
          version.query_text,
          signal.id,
          `Neues Signal: "${signal.title.slice(0, 80)}" könnte diese Analyse beeinflussen.`,
          severity,
        );
        break; // one alert per node per refresh is enough
      }
    }
  } finally {
    d.close();
  }
}

function mapAlert(row: any): ScenarioAlert {
  return {
    id: row.id,
    canvasNodeId: row.canvas_node_id,
    radarId: row.radar_id,
    queryText: row.query_text,
    triggerSignalId: row.trigger_signal_id,
    reason: row.reason,
    severity: row.severity as "low" | "medium" | "high",
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at,
  };
}
