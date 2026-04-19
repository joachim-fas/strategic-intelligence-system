/**
 * Cluster snapshots — time-series history of topic clusters.
 *
 * Welle B Item 2 of the 4-app Deep-Dive (Perigon-inspired, SIS-augmented).
 *
 * Perigon's `/v1/stories/history` ships per-cluster snapshots with
 * `triggeredAt + summary + keyPoints + changelog + references[]`. That
 * lets an analyst see how a story's framing has evolved over time and
 * trace each claim back to the articles it was built from. SIS borrows
 * the shape (Welle B reference-implementation) and adds a
 * `foresight` slot that Perigon explicitly does not have — retrospective-
 * only is their deliberate position; forward-looking is SIS's.
 *
 * Data flow
 * ─────────
 * On each pipeline run:
 *   1. `groupSignalsByTopic()` buckets the fresh signals into topic
 *      clusters (existing behaviour; unchanged).
 *   2. For each cluster we upsert a `cluster_snapshots` row with the
 *      current state (signal count, signal IDs, summary text).
 *   3. A separate optional step (gated behind an env flag / Welle-C
 *      work) can fill `changelog` by calling an LLM with the previous
 *      snapshot's summary + the current one and asking for a one-line
 *      diff. Left null in this commit so the data layer ships without
 *      being coupled to prompt iteration.
 *
 * Read side
 * ─────────
 *   - `getClusterHistory(clusterId)` returns snapshots for a single
 *     cluster in reverse-chronological order. Used by a future
 *     `/api/v1/clusters/[id]/history` route (shipped in this commit)
 *     and by the Canvas derivation UI (follow-up).
 *   - `listClusters()` surfaces the full cluster catalog with metadata
 *     so the UI can paint a list without one query per cluster.
 *
 * Cluster identity
 * ────────────────
 * Clusters are identified by a deterministic slug derived from the
 * topic string (`aiRegulation` → `ai-regulation`). The slug is stable
 * across pipeline runs (same topic input always produces the same
 * slug) so snapshot rows reliably stack into one history series.
 */

import { getSqliteHandle } from "@/db";
import type { RawSignal } from "@/connectors/types";

export interface ClusterSnapshot {
  id: string;
  clusterId: string;
  topic: string;
  triggeredAt: string;
  signalCount: number;
  signalIds: string[];
  summary: string;
  changelog: string | null;
  foresight: unknown | null;
}

/**
 * Turn a topic string into a URL-safe cluster slug. Matches the
 * `slugify()` in scoring.ts but kept here too so we don't depend on
 * an internal helper from another module.
 */
export function clusterSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

/**
 * Build a short summary from a group of signals. Takes the top N
 * titles and joins them with " · " separators. This is intentionally
 * dumb — the point is to have SOMETHING human-readable in the
 * snapshot so the LLM-diff step has input to work with. A real
 * summary (via LLM) is a follow-up.
 */
function buildSimpleSummary(signals: RawSignal[], maxItems = 3): string {
  if (signals.length === 0) return "(empty)";
  const titles = signals
    .map((s) => (s.sourceTitle ?? "").trim())
    .filter((t) => t.length > 0)
    .slice(0, maxItems);
  if (titles.length === 0) {
    return `${signals.length} signal${signals.length === 1 ? "" : "s"} (no titles)`;
  }
  return titles.join(" · ");
}

/**
 * Generate a UUID in the format used elsewhere in the codebase. The
 * tenant module has its own; keeping a local copy avoids a circular
 * import into sqlite-helpers.
 */
function uuid(): string {
  // crypto.randomUUID() is available in Node 14.17+ / modern browsers
  // so no polyfill is needed.
  return crypto.randomUUID();
}

/**
 * Create a snapshot for one topic cluster. Idempotent only in the
 * sense that each call writes a new row — re-calling with identical
 * input WILL produce a second row. Callers should control call
 * cadence (typically once per pipeline run).
 *
 * Returns the written snapshot for convenience (some callers want to
 * chain the LLM-diff step on the same object).
 */
export function createClusterSnapshot(params: {
  topic: string;
  signals: RawSignal[];
  changelog?: string | null;
  foresight?: unknown | null;
  /** Override the stamp if the caller wants a specific point in
   *  time (e.g. retrospective backfill). Defaults to now. */
  triggeredAt?: string;
}): ClusterSnapshot {
  const db = getSqliteHandle();
  const id = uuid();
  const clusterId = clusterSlug(params.topic);
  const triggeredAt = params.triggeredAt ?? new Date().toISOString();
  const signalIds = params.signals
    .map((s) => (s as unknown as { id?: string }).id ?? (s as unknown as { signalId?: string }).signalId ?? "")
    .filter((id) => id.length > 0);
  const summary = buildSimpleSummary(params.signals);
  const changelog = params.changelog ?? null;
  const foresight = params.foresight ?? null;

  db.prepare(
    `INSERT INTO cluster_snapshots (
      id, cluster_id, topic, triggered_at, signal_count,
      signal_ids, summary, changelog, foresight
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    clusterId,
    params.topic,
    triggeredAt,
    params.signals.length,
    JSON.stringify(signalIds),
    summary,
    changelog,
    foresight != null ? JSON.stringify(foresight) : null,
  );

  return {
    id,
    clusterId,
    topic: params.topic,
    triggeredAt,
    signalCount: params.signals.length,
    signalIds,
    summary,
    changelog,
    foresight,
  };
}

/**
 * Read snapshots for a cluster, newest first. Empty array if the
 * cluster has no history yet. `limit` caps the result set so the API
 * doesn't dump multi-year history unless asked to; default is 50
 * which covers ~8 days at a 4h pipeline cadence.
 */
export function getClusterHistory(
  clusterId: string,
  limit = 50,
): ClusterSnapshot[] {
  const db = getSqliteHandle();
  const rows = db.prepare(
    `SELECT id, cluster_id, topic, triggered_at, signal_count,
            signal_ids, summary, changelog, foresight
       FROM cluster_snapshots
      WHERE cluster_id = ?
      ORDER BY triggered_at DESC
      LIMIT ?`,
  ).all(clusterId, limit) as Array<{
    id: string;
    cluster_id: string;
    topic: string;
    triggered_at: string;
    signal_count: number;
    signal_ids: string;
    summary: string;
    changelog: string | null;
    foresight: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    clusterId: r.cluster_id,
    topic: r.topic,
    triggeredAt: r.triggered_at,
    signalCount: r.signal_count,
    signalIds: safeJsonArray(r.signal_ids),
    summary: r.summary,
    changelog: r.changelog,
    foresight: r.foresight != null ? safeJsonParse(r.foresight) : null,
  }));
}

/**
 * List every cluster that has at least one snapshot, with metadata
 * the UI needs to paint a catalogue row: topic, latest snapshot
 * timestamp, total snapshot count, latest signal count.
 */
export function listClusters(): Array<{
  clusterId: string;
  topic: string;
  latestAt: string;
  snapshotCount: number;
  latestSignalCount: number;
}> {
  const db = getSqliteHandle();
  const rows = db.prepare(
    `SELECT
       cluster_id,
       -- Latest row wins for the display topic (in case the canonical
       -- form of a topic ever changes — the most recent read is the
       -- current source of truth).
       (SELECT topic FROM cluster_snapshots cs2
         WHERE cs2.cluster_id = cs.cluster_id
         ORDER BY triggered_at DESC LIMIT 1) AS topic,
       MAX(triggered_at) AS latest_at,
       COUNT(*) AS snapshot_count,
       (SELECT signal_count FROM cluster_snapshots cs2
         WHERE cs2.cluster_id = cs.cluster_id
         ORDER BY triggered_at DESC LIMIT 1) AS latest_signal_count
     FROM cluster_snapshots cs
     GROUP BY cluster_id
     ORDER BY latest_at DESC`,
  ).all() as Array<{
    cluster_id: string;
    topic: string;
    latest_at: string;
    snapshot_count: number;
    latest_signal_count: number;
  }>;

  return rows.map((r) => ({
    clusterId: r.cluster_id,
    topic: r.topic,
    latestAt: r.latest_at,
    snapshotCount: r.snapshot_count,
    latestSignalCount: r.latest_signal_count,
  }));
}

/**
 * Hook for future LLM-driven changelog generation. Takes the previous
 * and current snapshot and should return a one-line diff that names
 * the specific change (new signals, dropped signals, framing shift).
 *
 * Currently a stub that returns `null` — shipping the data layer
 * without coupling to prompt iteration. Wire up the Anthropic call
 * under an env flag in a follow-up (Welle C item 1 uses the same
 * LLM-router hook, so this will live there).
 *
 * The signature is stable: when the real implementation lands,
 * existing callers of `createClusterSnapshot` don't change.
 */
export async function generateClusterDiff(
  _previous: ClusterSnapshot | null,
  _current: { topic: string; summary: string; signalCount: number },
): Promise<string | null> {
  // Intentionally null — see the doc comment above for the rollout
  // plan. A real implementation would:
  //   1. Short-circuit if `previous == null` (first snapshot ever).
  //   2. Short-circuit if summaries are byte-identical (no change).
  //   3. Call the AI router with a prompt like:
  //        "Du analysierst die Entwicklung eines Trend-Clusters.
  //         Beschreibe in einem Satz (<=30 Wörter), was sich zwischen
  //         den beiden Snapshots unterschieden hat. Vermeide
  //         Umschreibungen; nenne konkrete Akteure, Zahlen oder neue
  //         Themen, falls vorhanden. Sprache: {locale}."
  //   4. Cap output length and strip whitespace.
  //   5. Return null on API failure so callers fall back to the
  //      stored raw summaries.
  return null;
}

// ─── Utility helpers ──────────────────────────────────────────────

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
