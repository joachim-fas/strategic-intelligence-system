/**
 * Signal Persistence & Retrieval (RAG Layer)
 *
 * Bridges connector output → SQLite → LLM prompt.
 * Enables SIS to answer with current, verifiable data
 * rather than relying solely on LLM training knowledge.
 */

import Database from "better-sqlite3";
import path from "path";

export interface LiveSignal {
  id: string;
  source: string;
  title: string;
  content: string | null;
  url: string | null;
  topic: string | null;
  tags: string | null;
  signal_type: string | null;
  strength: number | null;
  raw_data: string | null;
  fetched_at: string;
}

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  return d;
}

// ─── Store signals from a connector run ──────────────────────────────────────

export function storeSignals(
  source: string,
  signals: Array<{
    title: string;
    content?: string;
    url?: string;
    topic?: string;
    tags?: string[];
    signalType?: string;
    strength?: number;
    rawData?: Record<string, unknown>;
  }>
): void {
  const d = db();
  const insert = d.prepare(`
    INSERT INTO live_signals (id, source, title, content, url, topic, tags, signal_type, strength, raw_data, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = d.transaction((items: typeof signals) => {
    for (const s of items) {
      insert.run(
        crypto.randomUUID(),
        source,
        s.title,
        s.content ?? null,
        s.url ?? null,
        s.topic ?? null,
        s.tags ? JSON.stringify(s.tags) : null,
        s.signalType ?? null,
        s.strength ?? null,
        s.rawData ? JSON.stringify(s.rawData) : null
      );
    }
  });

  insertMany(signals);
  d.close();
}

// ─── Clear stale signals (older than N hours) ─────────────────────────────────

export function pruneOldSignals(maxAgeHours = 48): void {
  const d = db();
  d.prepare(`
    DELETE FROM live_signals WHERE fetched_at < datetime('now', '-${maxAgeHours} hours')
  `).run();
  d.close();
}

// ─── Get age of most recent signals ──────────────────────────────────────────

export function getSignalAge(): { count: number; oldestHours: number; newestHours: number } {
  const d = db();
  const row = d.prepare(`
    SELECT
      COUNT(*) as count,
      ROUND((julianday('now') - julianday(MIN(fetched_at))) * 24, 1) as oldest_hours,
      ROUND((julianday('now') - julianday(MAX(fetched_at))) * 24, 1) as newest_hours
    FROM live_signals
  `).get() as any;
  d.close();
  return {
    count: row?.count ?? 0,
    oldestHours: row?.oldest_hours ?? 999,
    newestHours: row?.newest_hours ?? 999,
  };
}

// ─── Retrieve relevant signals for a query ───────────────────────────────────

/**
 * Finds live signals relevant to a query using keyword matching.
 * Returns top N signals, ordered by strength DESC then recency.
 */
export function getRelevantSignals(query: string, limit = 12): LiveSignal[] {
  const d = db();

  // Extract meaningful keywords from query (skip short/common words)
  const stopWords = new Set([
    "wie", "was", "wo", "wer", "wann", "warum", "welche", "welcher", "welches",
    "ist", "sind", "hat", "haben", "wird", "werden", "kann", "können",
    "für", "von", "mit", "bei", "auf", "an", "in", "zu", "über", "unter",
    "the", "how", "what", "where", "when", "why", "which", "who",
    "is", "are", "has", "have", "will", "can", "for", "with", "from",
    "und", "oder", "aber", "und", "also", "noch", "schon", "sehr",
  ]);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 8); // Use up to 8 keywords

  if (keywords.length === 0) {
    // Fallback: return most recent high-strength signals
    const rows = d.prepare(`
      SELECT * FROM live_signals
      ORDER BY strength DESC, fetched_at DESC
      LIMIT ?
    `).all(limit) as LiveSignal[];
    d.close();
    return rows;
  }

  // Score each signal: +1 for each keyword found in title or topic
  // SQLite doesn't have FTS here, so we use a CASE-based scoring approach
  const scoreClauses = keywords.map(
    (kw) => `
    (CASE WHEN lower(title) LIKE '%${kw.replace(/'/g, "''")}%' THEN 2 ELSE 0 END) +
    (CASE WHEN lower(topic) LIKE '%${kw.replace(/'/g, "''")}%' THEN 2 ELSE 0 END) +
    (CASE WHEN lower(content) LIKE '%${kw.replace(/'/g, "''")}%' THEN 1 ELSE 0 END)
    `
  );

  const scoreExpr = scoreClauses.join(" + ");

  const rows = d.prepare(`
    SELECT *,
      (${scoreExpr}) as relevance_score
    FROM live_signals
    WHERE fetched_at > datetime('now', '-72 hours')
    ORDER BY relevance_score DESC, strength DESC, fetched_at DESC
    LIMIT ?
  `).all(limit) as (LiveSignal & { relevance_score: number })[];

  d.close();

  // Only return signals with at least some relevance (score > 0)
  const relevant = rows.filter((r) => r.relevance_score > 0);
  // If nothing matched keywords, fall back to all recent signals
  return relevant.length > 0 ? relevant : rows.slice(0, Math.min(6, rows.length));
}

// ─── Format signals for LLM prompt injection ─────────────────────────────────

export function formatSignalsForPrompt(signals: LiveSignal[]): string {
  if (signals.length === 0) return "";

  const lines = signals.map((s) => {
    const date = s.fetched_at.slice(0, 10);
    const strength = s.strength != null ? ` [Stärke: ${(s.strength * 100).toFixed(0)}%]` : "";
    const url = s.url ? ` → ${s.url}` : "";
    const content = s.content ? `\n    ${s.content.slice(0, 200)}` : "";
    return `• [${s.source.toUpperCase()}, ${date}]${strength} ${s.title}${url}${content}`;
  });

  return `AKTUELLE BELEGTE SIGNALE (letzte 72h, aus ${new Set(signals.map((s) => s.source)).size} Quellen):
${lines.join("\n")}`;
}
