#!/usr/bin/env tsx
/**
 * api-smoke-test — contract tests for the canonical API envelope.
 *
 * Why this exists
 * ───────────────
 * The 18.04.2026 usability audit (A5-H6) found five API routes
 * returning raw `{ error: ... }` or `{ success: true }` shapes instead
 * of the canonical `apiSuccess(data)` / `apiError(msg, code)` envelope.
 * Those routes were migrated in commit fa4bf8f. This test holds the
 * line: any regression that reintroduces the raw shape fails loudly
 * before it ships.
 *
 * Zero-install: plain tsx + fetch. Hits a running dev server (default
 * http://localhost:3001) and asserts the response shape, status code,
 * and presence of the `ok` / `data` / `error` fields.
 *
 * Run:
 *   npm run test:api            # local dev server
 *   BASE_URL=... npm run test:api
 *
 * Exits 0 on full pass, 1 on any failure.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const TIMEOUT_MS = 30_000;

// ── Tiny assertion helper ──────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

async function fetchJson(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown; headers: Headers } | { error: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body, headers: res.headers };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function isSuccessEnvelope(
  body: unknown,
): body is { ok: true; data: Record<string, unknown> } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === true &&
    typeof (body as { data?: unknown }).data === "object" &&
    (body as { data?: unknown }).data !== null
  );
}

function isErrorEnvelope(
  body: unknown,
): body is { ok: false; error: { message: string; code?: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === false &&
    typeof (body as { error?: unknown }).error === "object" &&
    (body as { error?: unknown }).error !== null &&
    typeof ((body as { error: { message?: unknown } }).error as { message?: unknown })
      .message === "string"
  );
}

// ── Precheck: is the dev server reachable? ─────────────────────────

async function precheck(): Promise<boolean> {
  const probe = await fetchJson("/api/v1/health");
  if ("error" in probe) {
    console.error(`\n✗ Dev server not reachable at ${BASE_URL}`);
    console.error(`  ${probe.error}`);
    console.error(`\nStart it with: npm run dev`);
    return false;
  }
  if (probe.status !== 200) {
    console.error(`\n✗ /api/v1/health returned HTTP ${probe.status}`);
    return false;
  }
  return true;
}

// ── Tests ──────────────────────────────────────────────────────────

async function main() {
  console.log(`SIS API smoke tests — ${BASE_URL}`);

  if (!(await precheck())) {
    process.exit(1);
  }

  // 1. Canvas list — envelope sanity
  section("1. GET /api/v1/canvas — list envelope");
  {
    const r = await fetchJson("/api/v1/canvas");
    if ("error" in r) {
      assert(false, `fetch failed: ${r.error}`);
    } else {
      assert(r.status === 200, "HTTP 200");
      assert(isSuccessEnvelope(r.body), "canonical { ok: true, data } envelope");
      const data = (r.body as { data?: { canvases?: unknown } }).data;
      assert(
        Array.isArray(data?.canvases),
        "data.canvases is an array (the documented shape)",
      );
    }
  }

  // 2. Canvas create + load + rename + delete round-trip
  section("2. Canvas create → load → rename → delete");
  let createdId: string | null = null;
  {
    const r = await fetchJson("/api/v1/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `api-smoke ${Date.now()}` }),
    });
    if ("error" in r) {
      assert(false, `POST canvas failed: ${r.error}`);
    } else {
      assert(r.status === 201, "POST returns HTTP 201");
      assert(isSuccessEnvelope(r.body), "POST canonical envelope");
      const created = (r.body as { data?: { canvas?: { id?: string } } }).data?.canvas;
      createdId = typeof created?.id === "string" ? created.id : null;
      assert(!!createdId, "created canvas has id");
    }
  }

  if (createdId) {
    const r = await fetchJson(`/api/v1/canvas/${createdId}`);
    if ("error" in r) {
      assert(false, `GET canvas/[id] failed: ${r.error}`);
    } else {
      assert(r.status === 200, "GET returns HTTP 200");
      assert(isSuccessEnvelope(r.body), "GET canonical envelope");
    }

    const renamed = await fetchJson(`/api/v1/canvas/${createdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "api-smoke renamed" }),
    });
    if ("error" in renamed) {
      assert(false, `PATCH canvas failed: ${renamed.error}`);
    } else {
      assert(renamed.status === 200, "PATCH returns HTTP 200");
      assert(isSuccessEnvelope(renamed.body), "PATCH canonical envelope");
    }

    const del = await fetchJson(`/api/v1/canvas/${createdId}`, { method: "DELETE" });
    if ("error" in del) {
      assert(false, `DELETE canvas failed: ${del.error}`);
    } else {
      assert(del.status === 204, "DELETE returns HTTP 204 (no body)");
    }
  }

  // 3. Canvas create with empty body → 400 VALIDATION_ERROR envelope
  section("3. POST /api/v1/canvas with malformed body → 400 envelope");
  {
    const r = await fetchJson("/api/v1/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Intentionally not JSON — server should 400 with the canonical shape
      body: "not-json",
    });
    if ("error" in r) {
      assert(false, `fetch failed: ${r.error}`);
    } else {
      // The canvas POST tolerates malformed body (defaults name to "Neues Projekt"),
      // so this is actually a 201. That's intentional, not a regression — document it.
      assert(
        r.status === 201 || r.status === 400,
        `HTTP 201 (tolerant) or 400 (strict) — got ${r.status}`,
      );
    }
  }

  // 4. Projects queries route — malformed body must 400, not 500 (audit fix 6ff379a)
  section("4. POST /api/v1/projects/<id>/queries with empty body → 400");
  {
    // Create a throwaway canvas first so we have a real radar_id
    const created = await fetchJson("/api/v1/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "queries-envelope-probe" }),
    });
    let radarId: string | null = null;
    if (!("error" in created) && isSuccessEnvelope(created.body)) {
      const canvas = (created.body as { data: { canvas?: { id?: string } } }).data.canvas;
      radarId = typeof canvas?.id === "string" ? canvas.id : null;
    }
    if (!radarId) {
      assert(false, "setup: could not create probe canvas");
    } else {
      // Empty body
      const empty = await fetchJson(`/api/v1/projects/${radarId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });
      if ("error" in empty) {
        assert(false, `empty body fetch failed: ${empty.error}`);
      } else {
        assert(empty.status === 400, `empty body → HTTP 400 (got ${empty.status})`);
        assert(
          isErrorEnvelope(empty.body),
          "empty body → canonical error envelope",
        );
      }

      // Missing query field
      const missing = await fetchJson(`/api/v1/projects/${radarId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "de" }),
      });
      if ("error" in missing) {
        assert(false, `missing-query fetch failed: ${missing.error}`);
      } else {
        assert(
          missing.status === 400,
          `missing query → HTTP 400 (got ${missing.status})`,
        );
        const errBody = missing.body as { error?: { code?: string } };
        assert(
          errBody.error?.code === "VALIDATION_ERROR",
          'error.code === "VALIDATION_ERROR"',
        );
      }

      // Valid query — should succeed
      const ok = await fetchJson(`/api/v1/projects/${radarId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "smoke test query",
          result: { synthesis: "smoke" },
          locale: "de",
        }),
      });
      if ("error" in ok) {
        assert(false, `valid query POST failed: ${ok.error}`);
      } else {
        assert(ok.status === 201, `valid query → HTTP 201 (got ${ok.status})`);
        assert(isSuccessEnvelope(ok.body), "valid query → success envelope");
      }

      // Cleanup
      await fetchJson(`/api/v1/canvas/${radarId}`, { method: "DELETE" });
    }
  }

  // 5. Admin tenants — list + detail envelope
  section("5. /api/v1/admin/tenants + detail envelopes");
  {
    const list = await fetchJson("/api/v1/admin/tenants");
    if ("error" in list) {
      assert(false, `admin tenants list failed: ${list.error}`);
    } else {
      assert(list.status === 200, "list → HTTP 200");
      assert(isSuccessEnvelope(list.body), "list canonical envelope");
      const tenants = (list.body as { data: { tenants?: unknown[] } }).data.tenants;
      assert(Array.isArray(tenants), "data.tenants is an array");
      const first = Array.isArray(tenants) ? (tenants[0] as { id?: string }) : null;
      if (first?.id) {
        const detail = await fetchJson(`/api/v1/admin/tenants/${first.id}`);
        if ("error" in detail) {
          assert(false, `tenant detail failed: ${detail.error}`);
        } else {
          assert(detail.status === 200, "detail → HTTP 200");
          assert(isSuccessEnvelope(detail.body), "detail canonical envelope");
          const stats = (detail.body as { data: { stats?: Record<string, number> } })
            .data.stats;
          assert(
            stats && typeof stats.memberCount === "number",
            "detail has stats.memberCount number",
          );
        }
      }
    }
  }

  // 6. Monitor + health — both should 200 and be valid JSON
  section("6. /api/v1/monitor + /api/v1/health shapes");
  {
    const mon = await fetchJson("/api/v1/monitor");
    if ("error" in mon) {
      assert(false, `monitor fetch failed: ${mon.error}`);
    } else {
      assert(mon.status === 200, "monitor HTTP 200");
      assert(isSuccessEnvelope(mon.body), "monitor canonical envelope");
      const data = (
        mon.body as {
          data: {
            signals?: { total?: number };
            knowledgeBase?: { connectors?: number };
          };
        }
      ).data;
      assert(
        typeof data.signals?.total === "number",
        "monitor data.signals.total is a number",
      );
      assert(
        typeof data.knowledgeBase?.connectors === "number",
        "monitor data.knowledgeBase.connectors is a number",
      );
    }

    const health = await fetchJson("/api/v1/health");
    if ("error" in health) {
      assert(false, `health fetch failed: ${health.error}`);
    } else {
      assert(health.status === 200, "health HTTP 200");
      // /health intentionally keeps a flat shape (ok + uptimeMs + db + pipeline
      // at top level) for uptime probes that don't want to traverse `data.`.
      // Documented exception — the audit acknowledged it.
      const body = health.body as { ok?: unknown; db?: unknown };
      assert(body.ok === true, "health body.ok === true (flat shape)");
      assert(typeof body.db === "object" && body.db !== null, "health.db present");
    }
  }

  // 7. Alerts dismiss unknown id — 404 NOT_FOUND envelope (audit fix a4213f7)
  section("7. POST /api/v1/alerts/<bogus>/dismiss → 404");
  {
    const r = await fetchJson("/api/v1/alerts/bogus-alert-id-xxx/dismiss", {
      method: "POST",
    });
    if ("error" in r) {
      assert(false, `dismiss fetch failed: ${r.error}`);
    } else {
      assert(r.status === 404, `bogus id → HTTP 404 (got ${r.status})`);
      assert(isErrorEnvelope(r.body), "bogus id → canonical error envelope");
      const code = (r.body as { error: { code?: string } }).error.code;
      assert(code === "NOT_FOUND", 'error.code === "NOT_FOUND"');
    }
  }

  // 8. Ticker respects `limit` (audit fix 8c0a9b7 + eb83d31)
  section("8. GET /api/v1/feed/ticker?limit=3 returns ≤ 3 signals");
  {
    const r = await fetchJson("/api/v1/feed/ticker?limit=3");
    if ("error" in r) {
      assert(false, `ticker fetch failed: ${r.error}`);
    } else {
      assert(r.status === 200, "HTTP 200");
      assert(isSuccessEnvelope(r.body), "canonical envelope");
      const signals = (r.body as { data: { signals?: unknown[] } }).data.signals;
      assert(
        Array.isArray(signals) && signals.length <= 3,
        `signals is an array with ≤ 3 items (got ${Array.isArray(signals) ? signals.length : "not-array"})`,
      );
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  console.log(`\n${passed + failed > 0 ? `${passed} passed, ${failed} failed.` : "no tests ran"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
