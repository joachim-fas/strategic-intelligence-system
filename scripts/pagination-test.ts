#!/usr/bin/env tsx
/**
 * pagination-test — unit test for the shared pagination helper
 * (src/lib/pagination.ts, PERF-13).
 */

import {
  parsePaginationParams,
  buildPaginationEnvelope,
} from "../src/lib/pagination";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) { console.log(`\n▸ ${title}`); }

function url(query: string): URL {
  return new URL(`https://test.local/x?${query}`);
}

// ─── 1. Defaults when no params given ──────────────────────────
section("1. Missing params → defaults (0, 50)");
{
  const u = new URL("https://test.local/x");
  const p = parsePaginationParams(u);
  assert(p.offset === 0, `offset=0 (got ${p.offset})`);
  assert(p.limit === 50, `limit=50 (got ${p.limit})`);
}

// ─── 2. Custom default limit ───────────────────────────────────
section("2. defaultLimit override honoured when param missing");
{
  const u = new URL("https://test.local/x");
  const p = parsePaginationParams(u, { defaultLimit: 25 });
  assert(p.limit === 25, `limit=25 (got ${p.limit})`);
}

// ─── 3. Normal input parsed ────────────────────────────────────
section("3. offset=20&limit=10 parsed cleanly");
{
  const p = parsePaginationParams(url("offset=20&limit=10"));
  assert(p.offset === 20, "offset=20");
  assert(p.limit === 10, "limit=10");
}

// ─── 4. Upper clamp — limit capped at MAX_LIMIT (500) ──────────
section("4. Limit clamped at MAX_LIMIT (500)");
{
  const p = parsePaginationParams(url("limit=99999"));
  assert(p.limit === 500, `limit capped (got ${p.limit})`);
}

// ─── 5. Custom maxLimit override ───────────────────────────────
section("5. maxLimit override respected");
{
  const p = parsePaginationParams(url("limit=150"), { maxLimit: 100 });
  assert(p.limit === 100, `limit capped by custom max (got ${p.limit})`);
}

// ─── 6. Upper clamp — offset capped at MAX_OFFSET (10_000) ──────
section("6. Offset clamped at MAX_OFFSET (10_000)");
{
  const p = parsePaginationParams(url("offset=99999"));
  assert(p.offset === 10_000, `offset capped (got ${p.offset})`);
}

// ─── 7. Lower clamp — negative/zero → default behaviour ────────
section("7. Negative or zero values fall back to defaults");
{
  const p1 = parsePaginationParams(url("offset=-5&limit=-10"));
  assert(p1.offset === 0, `negative offset → 0 (got ${p1.offset})`);
  assert(p1.limit === 50, `negative limit → default (got ${p1.limit})`);

  const p2 = parsePaginationParams(url("limit=0"));
  assert(p2.limit === 50, `limit=0 → default (got ${p2.limit})`);
}

// ─── 8. Non-numeric → defaults ─────────────────────────────────
section("8. Non-numeric values fall back to defaults");
{
  const p = parsePaginationParams(url("offset=abc&limit=xyz"));
  assert(p.offset === 0, "non-numeric offset → 0");
  assert(p.limit === 50, "non-numeric limit → default");
}

// ─── 9. Floating point truncated ───────────────────────────────
section("9. Floating-point values floored to integers");
{
  const p = parsePaginationParams(url("offset=5.9&limit=10.7"));
  assert(p.offset === 5, `offset floored (got ${p.offset})`);
  assert(p.limit === 10, `limit floored (got ${p.limit})`);
}

// ─── 10. buildPaginationEnvelope ──────────────────────────────
section("10. buildPaginationEnvelope assembles correct shape");
{
  const env = buildPaginationEnvelope({ total: 100, offset: 0, limit: 10, returned: 10 });
  assert(env.total === 100, "total echoed");
  assert(env.offset === 0, "offset echoed");
  assert(env.limit === 10, "limit echoed");
  assert(env.returned === 10, "returned echoed");
  assert(env.hasMore === true, "hasMore=true when total > offset+returned");

  const env2 = buildPaginationEnvelope({ total: 10, offset: 0, limit: 10, returned: 10 });
  assert(env2.hasMore === false, "hasMore=false on last page");

  const env3 = buildPaginationEnvelope({ total: 25, offset: 20, limit: 10, returned: 5 });
  assert(env3.hasMore === false, "hasMore=false when (offset+returned) == total");

  const env4 = buildPaginationEnvelope({ total: 100, offset: 50, limit: 10, returned: 10 });
  assert(env4.hasMore === true, "hasMore=true mid-stream");
}

// ─── 11. Empty page ────────────────────────────────────────────
section("11. Empty page (no rows) still builds valid envelope");
{
  const env = buildPaginationEnvelope({ total: 0, offset: 0, limit: 10, returned: 0 });
  assert(env.total === 0, "total=0");
  assert(env.hasMore === false, "hasMore=false when total=0");
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
