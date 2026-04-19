/**
 * pagination — shared offset+limit pagination for list endpoints (PERF-13).
 *
 * Before this module, every GET list endpoint either had no
 * pagination at all (most of them — returned up to 500 rows in a
 * single response) or had bespoke cursor logic (admin/audit uses a
 * `before` ISO timestamp with its own nextBefore envelope). Neither
 * pattern scales past a few hundred rows.
 *
 * This helper standardises the simpler case: **offset+limit with a
 * total count**. Used for list endpoints where:
 *   - Row order is stable enough that offsets don't skip items
 *     (e.g. ORDER BY updated_at DESC on a table that rarely
 *     has concurrent writes during a user's paging session).
 *   - The underlying data set is small enough that running a
 *     COUNT(*) alongside the paged SELECT is acceptable (low
 *     thousands of rows max).
 *
 * Cursor-based pagination (the admin/audit pattern) is the right
 * fit for high-volume time-series data. That pattern stays in
 * place for audit log; this helper doesn't replace it.
 *
 * Response envelope (added to existing response shape, non-breaking):
 *   {
 *     ...existing fields,
 *     pagination: {
 *       total: number,   // full row count (from COUNT(*))
 *       offset: number,  // echoed — this page's start
 *       limit: number,   // echoed — this page's size request
 *       returned: number,// actual items in this page
 *       hasMore: boolean,// true when total > offset + returned
 *     }
 *   }
 *
 * Existing consumers that only read the array field keep working —
 * they can adopt the pagination block whenever they're ready to
 * render a "load more" button.
 */

/** Tightest bounds that are still useful. Offset max is generous
 *  but not infinite; limit max mirrors the 500-row ceiling we had
 *  ambiently before. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MAX_OFFSET = 10_000;

export interface PaginationInput {
  offset: number;
  limit: number;
}

export interface PaginationEnvelope {
  total: number;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
}

/**
 * Parse `?offset=<int>&limit=<int>` from a URL. Both are clamped to
 * safe ranges with sensible defaults. Non-numeric or missing values
 * fall back to (0, 50). Upper limits protect the DB from
 * accidental full-table scans.
 */
export function parsePaginationParams(
  url: URL,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): PaginationInput {
  const defaultLimit = opts.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = Math.min(MAX_LIMIT, opts.maxLimit ?? MAX_LIMIT);

  const offsetRaw = url.searchParams.get("offset");
  const limitRaw = url.searchParams.get("limit");

  const offsetParsed = offsetRaw != null ? Number(offsetRaw) : 0;
  const limitParsed = limitRaw != null ? Number(limitRaw) : defaultLimit;

  const offset = Number.isFinite(offsetParsed) && offsetParsed > 0
    ? Math.min(MAX_OFFSET, Math.floor(offsetParsed))
    : 0;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0
    ? Math.min(maxLimit, Math.floor(limitParsed))
    : defaultLimit;

  return { offset, limit };
}

/**
 * Build the `pagination` envelope block. `total` is the full row
 * count (from a COUNT(*) query on the same WHERE clause); the
 * helper computes `hasMore` from it.
 */
export function buildPaginationEnvelope(params: {
  total: number;
  offset: number;
  limit: number;
  returned: number;
}): PaginationEnvelope {
  const { total, offset, limit, returned } = params;
  return {
    total,
    offset,
    limit,
    returned,
    hasMore: offset + returned < total,
  };
}
