/**
 * Declarative Connector Framework
 *
 * Most SIS connectors share the same shape: fetch a public JSON endpoint,
 * walk an array of rows, map each row to a `RawSignal`, and filter out the
 * weak ones. Instead of writing that skeleton fresh for every new source
 * (150+ lines each), we declare the differences as a config object and let
 * `buildDeclarativeConnector()` construct a `SourceConnector` from it.
 *
 * A typical config is ~30 lines and looks like this:
 *
 *   export const coingeckoConnector = buildDeclarativeConnector<CoinGeckoCoin>({
 *     name: "coingecko",
 *     displayName: "CoinGecko (Crypto Markets)",
 *     endpoint: "https://api.coingecko.com/api/v3/coins/markets?...",
 *     defaultTopic: "Web3 & Decentralization",
 *     minStrength: 0.05,
 *     map: (coin) => ({
 *       sourceUrl: `https://www.coingecko.com/en/coins/${coin.id}`,
 *       sourceTitle: `${coin.name}: $${coin.current_price}`,
 *       rawStrength: Math.min(1, Math.abs(coin.price_change_24h ?? 0) / 20),
 *       detectedAt: new Date(coin.last_updated),
 *       rawData: { coinId: coin.id, priceUsd: coin.current_price },
 *     }),
 *   });
 *
 * The framework handles: HTTP fetch with timeout, JSON parsing, array path
 * extraction, per-row error isolation, strength filtering, and default field
 * population. It guarantees the connector NEVER throws from `fetchSignals()`
 * — transient failures return an empty array so one broken upstream doesn't
 * break the pipeline.
 */

import type { SourceConnector, RawSignal } from "./types";

// ── Config shape ────────────────────────────────────────────────────────────

export interface DeclarativeConnectorConfig<Row = unknown> {
  /** Stable slug. Must be unique across all connectors. */
  name: string;
  /** Human-readable name shown in the Quellen table. */
  displayName: string;
  /** Fully-qualified endpoint URL (with query string). */
  endpoint: string;
  /** HTTP method. Default: GET. */
  method?: "GET" | "POST";
  /** Extra headers. Accept: application/json is added automatically. */
  headers?: Record<string, string>;
  /** Optional body for POST requests (will be JSON.stringify'd if object). */
  body?: string | Record<string, unknown>;
  /**
   * Dot-path into the parsed JSON where the array of rows lives.
   *
   *   ""               → response itself is the array
   *   "results"        → response.results is the array
   *   "data.studies"   → response.data.studies is the array
   */
  rowsPath?: string;
  /** Hard cap on rows processed per fetch. Default: 100. */
  limit?: number;
  /** Fetch timeout in ms. Default: 15000. */
  timeoutMs?: number;
  /**
   * Row → RawSignal mapping. Return null to skip the row silently.
   * `sourceType` defaults to the connector `name`. `signalType` defaults to
   * `defaultSignalType`. `topic` defaults to `defaultTopic`. `detectedAt`
   * defaults to "now".
   */
  map: (row: Row) => Partial<RawSignal> | null;
  /** Drop rows whose normalized `rawStrength` is below this threshold. */
  minStrength?: number;
  /** Used when `map()` does not set `topic`. */
  defaultTopic?: string;
  /** Used when `map()` does not set `signalType`. Default: "mention". */
  defaultSignalType?: RawSignal["signalType"];
}

// ── Keyword-based topic matching ────────────────────────────────────────────
//
// Many connectors need to match row text against a list of SIS trend topics.
// This helper implements the "first keyword match wins" pattern used across
// the hand-written connectors.

export type TopicMapping = ReadonlyArray<readonly [readonly string[], string]>;

export function matchTopicByKeywords(
  text: string,
  mapping: TopicMapping,
  fallback: string | null = null,
): string | null {
  if (!text) return fallback;
  const lower = text.toLowerCase();
  for (const [keywords, topic] of mapping) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return fallback;
}

// ── Utilities ───────────────────────────────────────────────────────────────

function extractRows<Row>(data: unknown, path: string | undefined): Row[] {
  if (!path) {
    return Array.isArray(data) ? (data as Row[]) : [];
  }
  let cursor: unknown = data;
  for (const key of path.split(".")) {
    if (cursor == null || typeof cursor !== "object") return [];
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return Array.isArray(cursor) ? (cursor as Row[]) : [];
}

// Structural subset of the config that normalizeSignal actually reads.
// Using this instead of `DeclarativeConnectorConfig<Row>` avoids generic
// variance issues at the call site.
interface NormalizeContext {
  name: string;
  defaultTopic?: string;
  defaultSignalType?: RawSignal["signalType"];
}

function normalizeSignal(
  partial: Partial<RawSignal>,
  config: NormalizeContext,
): RawSignal | null {
  // Require the two fields that actually carry meaning.
  if (!partial.sourceTitle || typeof partial.sourceTitle !== "string") return null;
  if (partial.rawStrength == null || !Number.isFinite(partial.rawStrength)) return null;

  const topic = partial.topic ?? config.defaultTopic;
  if (!topic) return null;

  return {
    sourceType: partial.sourceType ?? config.name,
    sourceUrl: partial.sourceUrl ?? "",
    sourceTitle: partial.sourceTitle,
    signalType: partial.signalType ?? config.defaultSignalType ?? "mention",
    topic,
    rawStrength: Math.max(0, Math.min(1, partial.rawStrength)),
    rawData: partial.rawData ?? {},
    detectedAt: partial.detectedAt instanceof Date ? partial.detectedAt : new Date(),
  };
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildDeclarativeConnector<Row = unknown>(
  config: DeclarativeConnectorConfig<Row>,
): SourceConnector {
  return {
    name: config.name,
    displayName: config.displayName,

    async fetchSignals(): Promise<RawSignal[]> {
      const timeoutMs = config.timeoutMs ?? 15000;
      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
          ...(config.headers ?? {}),
        };

        const init: RequestInit = {
          method: config.method ?? "GET",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        };
        if (config.body != null) {
          init.body = typeof config.body === "string" ? config.body : JSON.stringify(config.body);
          headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
        }

        const res = await fetch(config.endpoint, init);
        if (!res.ok) {
          console.warn(`[${config.name}] HTTP ${res.status} ${res.statusText}`);
          return [];
        }

        const data = await res.json();
        const rows = extractRows<Row>(data, config.rowsPath);
        if (rows.length === 0) return [];

        const limit = config.limit ?? 100;
        const trimmed = rows.slice(0, limit);

        const signals: RawSignal[] = [];
        for (const row of trimmed) {
          let mapped: Partial<RawSignal> | null;
          try {
            mapped = config.map(row);
          } catch (err) {
            // Log once per bad row, keep processing the rest.
            console.warn(`[${config.name}] map() threw for a row:`, err);
            continue;
          }
          if (!mapped) continue;

          const signal = normalizeSignal(mapped, config);
          if (!signal) continue;
          if (config.minStrength != null && signal.rawStrength < config.minStrength) continue;

          signals.push(signal);
        }

        return signals;
      } catch (err) {
        // Timeouts, DNS failures, JSON parse errors — all swallowed so the
        // pipeline keeps running. The pipeline orchestrator already logs
        // per-connector status, so we don't double-log here.
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[${config.name}] fetchSignals failed: ${msg}`);
        return [];
      }
    },
  };
}
