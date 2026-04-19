/**
 * Semantic Signal Search — Notion-Plan P1-1 Infrastructure (2026-04-20).
 *
 * Full-Rollout läuft in zwei Etappen, damit wir nicht mitten in der
 * Datenpipeline einen harten Rollout machen:
 *
 * **Etappe A (dieser Commit):** Zentrale Abstraktion ohne harte
 * Abhängigkeit auf sqlite-vec. Neue Signals-Queries laufen
 * semantisch-first, wenn die Infrastruktur verfügbar ist; sonst
 * fallen sie auf die bestehende Keyword-Suche zurück. Niemand
 * muss auf Etappe A warten: Keyword-Suche funktioniert weiter.
 *
 * **Etappe B (folgender Commit, wenn User bereit):**
 *   1. `npm install sqlite-vec`
 *   2. Schema-Migration: CREATE VIRTUAL TABLE signal_embeddings
 *   3. Backfill-Script für die bestehenden 3.279 Signals (einmaliger Run)
 *   4. Insert-Pfad in `pipeline.ts` embedded nachtriggern
 *   5. Feature-Flag SIS_SEMANTIC_SEARCH=true aktivieren
 *
 * Bis dahin: `isSemanticSearchAvailable()` gibt false zurück, jeder
 * Call auf `semanticSearch()` liefert null, der Legacy-Keyword-Pfad
 * in `signals.getRelevantSignals()` greift ungebremst.
 *
 * Kosten-Rahmen: OpenAI text-embedding-3-small kostet $0.02 pro Mio
 * Token (~3250 Chars = 1k Tokens). Backfill der 3.279 Signals ≈ 600k
 * Tokens ≈ $0.01. Pro Query zusätzlich ≈ $0.000002.
 */

import type { LiveSignal } from "./signals";

export interface SemanticSearchResult extends LiveSignal {
  /** Cosine-Distanz zum Query-Embedding. Niedriger = ähnlicher. */
  semanticDistance: number;
}

/**
 * Flag ob der semantische Pfad aktiv ist. Drei Bedingungen:
 *  1. Feature-Flag gesetzt
 *  2. Embedding-API-Key verfügbar (oder lokales Modell)
 *  3. sqlite-vec-Extension geladen + `signal_embeddings`-Tabelle existiert
 *
 * Etappe A: Alle drei false (bis User setup aktiviert). Die Funktion
 * ist trotzdem stubb-ready, damit Aufrufer sie schon integrieren können.
 */
export function isSemanticSearchAvailable(): boolean {
  if (process.env.SIS_SEMANTIC_SEARCH !== "true") return false;
  if (!process.env.OPENAI_API_KEY && !process.env.SIS_EMBEDDING_ENDPOINT) return false;
  // Etappe B: hier die Tabellen-Existenz prüfen via Database-Quick-Check.
  // Bis dahin: false.
  return false;
}

/**
 * Erzeugt ein Embedding für einen Text über OpenAI oder eine lokale
 * API. Lokale Option ist (wenn gesetzt) eine selbst-gehostete
 * `text-embedding-3-small`-kompatible Endpoint-URL in
 * `SIS_EMBEDDING_ENDPOINT` (z.B. sentence-transformers/all-MiniLM-L6-v2
 * hinter einem simplen HTTP-Server).
 *
 * Gibt null zurück wenn kein Provider verfügbar oder der Call
 * fehlschlägt — Aufrufer sollen dann auf Keyword-Search fallen.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 8000) return null;

  const endpoint = process.env.SIS_EMBEDDING_ENDPOINT;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed, model: "text-embedding-3-small" }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const emb = data?.data?.[0]?.embedding ?? data?.embedding;
      return Array.isArray(emb) ? emb : null;
    } catch {
      return null;
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({ input: trimmed, model: "text-embedding-3-small" }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data?.[0]?.embedding ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Semantische Signal-Suche. Gibt null zurück wenn:
 *   - Etappe A: immer (keine Infrastruktur)
 *   - Etappe B: wenn Embedding-Call fehlschlägt oder sqlite-vec-Query
 *     scheitert
 *
 * Der Caller erkennt null und fällt auf Keyword-Suche zurück.
 */
export async function semanticSearch(
  _query: string,
  _limit = 12,
): Promise<SemanticSearchResult[] | null> {
  if (!isSemanticSearchAvailable()) return null;

  // Etappe B: Hier kommt der sqlite-vec-Query rein. Pseudocode:
  //
  //   const queryEmb = await getEmbedding(_query);
  //   if (!queryEmb) return null;
  //   const rows = db.prepare(`
  //     SELECT s.*, vec_distance_cosine(e.embedding, ?) as semantic_distance
  //     FROM signal_embeddings e
  //     JOIN live_signals s ON s.id = e.signal_id
  //     WHERE s.fetched_at > datetime('now', '-336 hours')
  //     ORDER BY semantic_distance ASC
  //     LIMIT ?
  //   `).all(JSON.stringify(queryEmb), _limit);
  //   return rows.map((r) => ({ ...r, semanticDistance: r.semantic_distance }));
  //
  // Bis Etappe B: unreachable — `isSemanticSearchAvailable()` blockt hier.
  return null;
}

/**
 * Etappe-B-Hook: beim Insert eines neuen Signals wird dessen Embedding
 * generiert und gespeichert. Nur aufrufen wenn `isSemanticSearchAvailable`
 * — sonst teures No-Op.
 *
 * Aktuell leer-implementiert, damit der Caller es schon verdrahten
 * kann (pipeline.ts). Wenn Etappe B kommt, wird hier die echte Logik
 * aktiviert und niemand muss pipeline.ts mehr anfassen.
 */
export async function embedAndStore(_signal: LiveSignal): Promise<void> {
  if (!isSemanticSearchAvailable()) return;
  // Etappe B: getEmbedding(title+content) + INSERT INTO signal_embeddings
  return;
}
