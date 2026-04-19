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
import { completeText } from "./ai-text";
import { resolveEnv } from "./env";

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
 *
 * Exported so pipeline-phase-2d can preview the same summary that
 * will be persisted, feeding it into `generateClusterDiff` before
 * the snapshot row is written.
 */
export function buildSimpleSummary(signals: RawSignal[], maxItems = 3): string {
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
 * which covers ~8 days at a 4h pipeline cadence. `offset` supports
 * offset-based pagination (PERF-13).
 */
export function getClusterHistory(
  clusterId: string,
  limit = 50,
  offset = 0,
): ClusterSnapshot[] {
  const db = getSqliteHandle();
  const rows = db.prepare(
    `SELECT id, cluster_id, topic, triggered_at, signal_count,
            signal_ids, summary, changelog, foresight
       FROM cluster_snapshots
      WHERE cluster_id = ?
      ORDER BY triggered_at DESC
      LIMIT ? OFFSET ?`,
  ).all(clusterId, limit, Math.max(0, Math.floor(offset))) as Array<{
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
 * Count snapshots for a cluster — companion to getClusterHistory
 * for paginated endpoints.
 */
export function countClusterSnapshots(clusterId: string): number {
  const db = getSqliteHandle();
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM cluster_snapshots WHERE cluster_id = ?`,
  ).get(clusterId) as { n: number } | undefined;
  return row?.n ?? 0;
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
 * Generate a one-line LLM changelog comparing the previous snapshot
 * to the current one. Gated behind `CLUSTER_DIFF_LLM_ENABLED=true`
 * so the feature is opt-in — pipeline runs every 4 h in prod and
 * ~30 clusters per run would be ~180 LLM calls/day otherwise, which
 * is cost the operator should agree to explicitly.
 *
 * Behaviour:
 *   - Returns `null` if the flag isn't set, if no ANTHROPIC_API_KEY
 *     is configured, or the LLM call fails / times out. All failure
 *     modes are silent — snapshots still write with changelog=null
 *     and the feature just degrades to the base history view.
 *   - Short-circuits to `null` on the first snapshot (no prior
 *     state to diff against) and when summaries are byte-identical
 *     (no change worth describing).
 *
 * Prompt strategy: deliberately minimal + opinionated. Ask for a
 * single sentence, ≤30 words, name-concrete changes only. No
 * preamble, no bullet list, no quoted material. Locale-aware so
 * multilingual consumers don't need to translate client-side.
 */
export async function generateClusterDiff(
  previous: ClusterSnapshot | null,
  current: { topic: string; summary: string; signalCount: number },
  locale: "de" | "en" = "de",
): Promise<string | null> {
  if (resolveEnv("CLUSTER_DIFF_LLM_ENABLED") !== "true") return null;
  if (!previous) return null;
  if (previous.summary === current.summary) return null;

  const isDe = locale === "de";
  const system = isDe
    ? "Du vergleichst zwei Kurz-Zusammenfassungen desselben Trend-Clusters und beschreibst in EINEM Satz (<=30 Wörter), was sich verändert hat. Nenne konkrete Akteure, Zahlen oder neue Themen. Keine Anrede, keine Wiederholung des Input, keine Anführungszeichen."
    : "Compare two short summaries of the same trend cluster and describe the change in ONE sentence (<=30 words). Name concrete actors, numbers, or new topics. No preamble, no paraphrasing, no quoted material.";
  const user = isDe
    ? `Thema: ${current.topic}\nZuvor (Signalzahl ${previous.signalCount}): ${previous.summary}\nJetzt (Signalzahl ${current.signalCount}): ${current.summary}`
    : `Topic: ${current.topic}\nBefore (${previous.signalCount} signals): ${previous.summary}\nNow (${current.signalCount} signals): ${current.summary}`;

  return completeText({
    system,
    user,
    maxTokens: 100, // one sentence ≤ 30 words ≈ 60 tokens with headroom
  });
}

/**
 * Forward-looking scenario triplet — SIS's differentiator from
 * Perigon. Perigon's `/v1/stories/history` is deliberately
 * retrospective-only (their positioning); SIS adds a parallel
 * `foresight[]` slot with 2–3 short scenarios drawn from the
 * current cluster signals.
 */
export interface ClusterForesight {
  /** Short label, ≤ 5 words (e.g. "Regulation tightens", "Supply chain fragments"). */
  scenario: string;
  /** 0..1 — how plausible this scenario seems from the signals. */
  confidence: number;
  /** Up to 3 drivers pulled from the signals. Each ≤ 10 words. */
  drivers: string[];
}

/**
 * Generate 2–3 forward-looking scenarios from the current cluster
 * signals. Gated behind `CLUSTER_FORESIGHT_LLM_ENABLED=true` (a
 * separate flag from the changelog so each can be rolled out
 * independently) — cost is ~180 extra LLM calls/day in prod.
 *
 * Returns:
 *   - An array of 2–3 ClusterForesight objects on success.
 *   - `null` if flag unset, no API key, call failed, or the model
 *     output couldn't be parsed. All failure modes are silent —
 *     the snapshot still writes with foresight=null.
 *
 * Prompt strategy: structured-JSON output. We ask for a strict
 * shape, parse + validate, and drop malformed entries rather than
 * crashing on them. Temperature isn't adjustable in the
 * ai-text helper so we rely on the prompt to constrain output.
 */
export async function generateClusterForesight(
  current: { topic: string; summary: string; signalCount: number },
  locale: "de" | "en" = "de",
): Promise<ClusterForesight[] | null> {
  if (resolveEnv("CLUSTER_FORESIGHT_LLM_ENABLED") !== "true") return null;
  if (!current.topic || !current.summary || current.summary === "(empty)") return null;

  const isDe = locale === "de";
  const system = isDe
    ? [
        "Du bist ein Strategieanalyst. Gegeben ein Trend-Cluster mit einer Kurzzusammenfassung, formulierst du 2–3 mögliche Zukunftsszenarien der nächsten 12–24 Monate.",
        "Jedes Szenario hat: einen Titel (max 5 Wörter), eine Konfidenz (0–1 basiert auf Signalstärke), und bis zu 3 Treiber (je max 10 Wörter).",
        "Antworte AUSSCHLIESSLICH als JSON-Array mit genau dieser Struktur:",
        `[{"scenario":"…","confidence":0.XX,"drivers":["…","…"]}, …]`,
        "Keine Einleitung, kein Markdown, kein Text außerhalb des Arrays.",
      ].join(" ")
    : [
        "You are a strategy analyst. Given a trend cluster with a short summary, formulate 2–3 forward scenarios for the next 12–24 months.",
        "Each scenario has: a title (≤5 words), a confidence (0–1 based on signal strength), and up to 3 drivers (≤10 words each).",
        "Respond ONLY as a JSON array with exactly this shape:",
        `[{"scenario":"…","confidence":0.XX,"drivers":["…","…"]}, …]`,
        "No preamble, no markdown, no text outside the array.",
      ].join(" ");

  const user = isDe
    ? `Thema: ${current.topic}\nSignalzahl: ${current.signalCount}\nZusammenfassung: ${current.summary}`
    : `Topic: ${current.topic}\nSignal count: ${current.signalCount}\nSummary: ${current.summary}`;

  const raw = await completeText({
    system,
    user,
    maxTokens: 400, // 3 scenarios × ~120 tokens headroom
  });
  if (!raw) return null;

  // Extract the first JSON array in the response. Some models add
  // a preamble despite the instruction; be forgiving.
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;

    const valid: ClusterForesight[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const scenario = typeof entry.scenario === "string" ? entry.scenario.trim() : null;
      const confidence = typeof entry.confidence === "number" ? entry.confidence : null;
      const driversRaw = Array.isArray(entry.drivers) ? entry.drivers : [];
      const drivers = driversRaw
        .filter((d: unknown): d is string => typeof d === "string")
        .map((d: string) => d.trim())
        .filter((d: string) => d.length > 0)
        .slice(0, 3);
      if (!scenario || confidence == null || Number.isNaN(confidence)) continue;
      valid.push({
        scenario: scenario.slice(0, 80), // hard cap protects UI
        confidence: Math.min(1, Math.max(0, confidence)),
        drivers,
      });
    }

    return valid.length > 0 ? valid.slice(0, 3) : null;
  } catch {
    return null;
  }
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
