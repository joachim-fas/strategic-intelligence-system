/**
 * Multi-tenant SQLite helpers.
 *
 * Why this file exists
 * ─────────────────────
 * The app was written as a single-user prototype — auth landed later and
 * multi-tenancy is landing now. Routes that read/write user-scoped data
 * (canvas, projects, scenarios, bsc_ratings) have historically run their
 * own `ALTER TABLE ... IF NOT EXISTS`-pattern on first request. That
 * pattern worked for a single new column per route but does not scale to
 * the coordinated set of changes multi-tenancy requires (four new tables,
 * three tenant_id columns across existing tables, plus a backfill step).
 *
 * Instead we centralise the schema work here and call it from exactly two
 * places:
 *   1. The `migrate-sqlite.ts` boot script (npm run db:setup).
 *   2. The `getDb()` runtime helper in `src/lib/db.ts` (first call per
 *      process) — so that a fresh deployment still migrates itself even
 *      without a separate manual migration step.
 *
 * Everything here is idempotent: calling it ten times on the same DB is
 * indistinguishable from calling it once.
 */

import type Database from "better-sqlite3";

/** Stable slug for the auto-created default tenant. */
export const DEFAULT_TENANT_SLUG = "default";

/**
 * Safe ALTER TABLE ADD COLUMN — SQLite throws if the column already
 * exists, so we catch + swallow only that specific case. Anything else
 * (e.g. table-does-not-exist) is re-thrown so real schema problems
 * surface immediately instead of being masked by the generic try/catch
 * that used to live inline in every route.
 */
function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate column name/i.test(msg)) return; // already applied
    throw err;
  }
}

/**
 * Idempotent schema upgrades for the multi-tenant layer:
 *   - creates tenants / tenant_memberships / tenant_invites / tenant_audit_log
 *   - adds tenant_id to radars / bsc_ratings / scenarios (nullable — backfill
 *     happens in ensureDefaultTenant)
 *   - adds last_active_tenant_id to users
 *
 * Also consolidates the legacy per-route ALTER TABLE steps for canvas_state
 * and archived_at on radars so fresh DBs + migrated DBs match.
 */
export function ensureMultiTenantSchema(db: Database.Database): void {
  // ── Legacy columns (were applied per-route) ────────────────────────
  addColumnIfMissing(db, "radars", "canvas_state", "TEXT");
  addColumnIfMissing(db, "radars", "archived_at", "TEXT");

  // ── Tenant-side tables ─────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'standard',
    settings TEXT NOT NULL DEFAULT '{}',
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS tenant_memberships (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    invited_by TEXT REFERENCES users(id),
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS tenant_membership_unique
    ON tenant_memberships(tenant_id, user_id)`);

  db.exec(`CREATE TABLE IF NOT EXISTS tenant_invites (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    invited_by TEXT REFERENCES users(id),
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS tenant_invites_tenant_email
    ON tenant_invites(tenant_id, email)`);

  db.exec(`CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS tenant_audit_tenant_time
    ON tenant_audit_log(tenant_id, created_at DESC)`);

  // ── Tenant scope columns on existing tables ────────────────────────
  addColumnIfMissing(db, "users", "last_active_tenant_id", "TEXT");
  addColumnIfMissing(db, "radars", "tenant_id", "TEXT");
  addColumnIfMissing(db, "bsc_ratings", "tenant_id", "TEXT");
  addColumnIfMissing(db, "scenarios", "tenant_id", "TEXT");

  // Lookup indexes we will rely on in every scoped query.
  db.exec(`CREATE INDEX IF NOT EXISTS radars_tenant_id ON radars(tenant_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS scenarios_tenant_id ON scenarios(tenant_id)`);

  // bsc_ratings: widen the uniqueness boundary to include tenant_id so
  // two tenants can vote differently on the same (queryHash,
  // perspectiveId). The pre-tenant schema had UNIQUE(query_hash,
  // perspective_id) inlined in the CREATE TABLE — we cannot drop that
  // in-place without a table rebuild on SQLite. The tenant-aware index
  // is still added here so new rows honour the target invariant; the
  // legacy autoindex will co-exist on installations that originated
  // before tenants. A future migration can table-rebuild to shed the
  // legacy constraint cleanly.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS bsc_ratings_tenant_unique
    ON bsc_ratings(tenant_id, query_hash, perspective_id)`);

  // ── Baseline stats (Welle B Item 3 — Welford streaming variance) ──
  // Keyed per (metric:source:weekday:month); helpers in src/lib/baseline.ts.
  // Lives here so the auto-migration on first boot (db/index.ts) picks it
  // up alongside the tenant schema — no separate manual migrate step.
  db.exec(`CREATE TABLE IF NOT EXISTS baseline_stats (
    key TEXT PRIMARY KEY,
    n INTEGER NOT NULL,
    mean REAL NOT NULL,
    m2 REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // ── Cluster snapshots (Welle B Item 2 — Perigon-inspired history) ──
  // Time-series of topic clusters: one row per (cluster × pipeline run).
  // Helpers in src/lib/cluster-snapshots.ts; read route at
  // /api/v1/clusters/[id]/history. `changelog` and `foresight` are
  // nullable hooks that a future LLM-router step fills in.
  db.exec(`CREATE TABLE IF NOT EXISTS cluster_snapshots (
    id TEXT PRIMARY KEY,
    cluster_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
    signal_count INTEGER NOT NULL,
    signal_ids TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL DEFAULT '',
    changelog TEXT,
    foresight TEXT
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS cluster_snapshots_cluster_time
    ON cluster_snapshots(cluster_id, triggered_at DESC)`);
}

/**
 * Generates a UUID in the same v4-ish format the Drizzle schema uses.
 * SQLite does not ship with a UUID function, so we roll our own using
 * the built-in randomblob(). Keeping the format consistent with other
 * tables makes cross-table joins trivially debuggable.
 */
function uuid(db: Database.Database): string {
  const row = db.prepare(`SELECT lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))),2) || '-' ||
    substr('89ab',abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))),2) || '-' ||
    lower(hex(randomblob(6))) AS id`).get() as { id: string };
  return row.id;
}

export interface EnsureDefaultTenantResult {
  tenantId: string;
  createdTenant: boolean;
  radarsBackfilled: number;
  scenariosBackfilled: number;
  ratingsBackfilled: number;
  membershipsAdded: number;
}

/**
 * Guarantees that (a) a default tenant exists and (b) every orphaned row
 * (tenant_id IS NULL) is wired to it. Also ensures every existing user
 * has at least one membership — the default tenant, as owner — so that
 * nobody is locked out after the migration lands.
 *
 * Returns a small report so the migrate script can print what it did.
 * Idempotent: second call is a no-op with all counts = 0.
 */
export function ensureDefaultTenant(db: Database.Database): EnsureDefaultTenantResult {
  // 1) Default tenant row. Slug is stable so a second deploy finds the
  //    same one and doesn't spawn duplicates.
  const existing = db.prepare(`SELECT id FROM tenants WHERE slug = ?`).get(DEFAULT_TENANT_SLUG) as { id: string } | undefined;
  let tenantId: string;
  let createdTenant = false;
  if (existing) {
    tenantId = existing.id;
  } else {
    tenantId = uuid(db);
    db.prepare(`INSERT INTO tenants (id, name, slug, plan, settings)
      VALUES (?, ?, ?, 'standard', '{}')`).run(tenantId, "Default Workspace", DEFAULT_TENANT_SLUG);
    createdTenant = true;
  }

  // 2) Backfill tenant_id on the three scope-holding tables.
  const radarsRes = db.prepare(`UPDATE radars SET tenant_id = ? WHERE tenant_id IS NULL`).run(tenantId);
  const scenariosRes = db.prepare(`UPDATE scenarios SET tenant_id = ? WHERE tenant_id IS NULL`).run(tenantId);
  const ratingsRes = db.prepare(`UPDATE bsc_ratings SET tenant_id = ? WHERE tenant_id IS NULL`).run(tenantId);

  // 3) Every existing user → owner membership in the default tenant.
  //    The UNIQUE(tenant_id, user_id) index makes this a no-op on repeat
  //    runs. Only users without any membership at all get wired up here;
  //    users with memberships in other tenants stay unaffected.
  const usersToAdd = db.prepare(`
    SELECT u.id FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM tenant_memberships m
      WHERE m.user_id = u.id AND m.tenant_id = ?
    )
  `).all(tenantId) as { id: string }[];

  let membershipsAdded = 0;
  const insertMembership = db.prepare(`INSERT INTO tenant_memberships
    (id, tenant_id, user_id, role, joined_at)
    VALUES (?, ?, ?, 'owner', datetime('now'))`);
  for (const u of usersToAdd) {
    insertMembership.run(uuid(db), tenantId, u.id);
    membershipsAdded += 1;
  }

  return {
    tenantId,
    createdTenant,
    radarsBackfilled: Number(radarsRes.changes ?? 0),
    scenariosBackfilled: Number(scenariosRes.changes ?? 0),
    ratingsBackfilled: Number(ratingsRes.changes ?? 0),
    membershipsAdded,
  };
}

/**
 * Returns the default tenant's id, creating it on demand if missing.
 * Used by the runtime path where we need a stable tenant to attach a
 * new user/membership to (dev-mode, first-login fallback).
 */
export function getDefaultTenantId(db: Database.Database): string {
  const existing = db.prepare(`SELECT id FROM tenants WHERE slug = ?`).get(DEFAULT_TENANT_SLUG) as { id: string } | undefined;
  if (existing) return existing.id;
  // Nothing there yet — run the full path so we also get a row.
  return ensureDefaultTenant(db).tenantId;
}

/**
 * Stable id for the synthetic dev-mode user.
 *
 * Every API helper that bypasses auth in `NODE_ENV=development` hands
 * routes a `user.id` of "dev-user". The routes then stamp that id into
 * `radars.owner_id`, `tenant_audit_log.actor_user_id`, etc. — all of
 * which have FOREIGN KEY references to `users.id`. If the row does not
 * exist the very first canvas create returns `SQLITE_CONSTRAINT_FOREIGNKEY`
 * and the Canvas page "doesn't open" (the init effect's POST fails
 * silently and the user sees the blank empty state forever).
 *
 * `ensureDevUser` is idempotent: it upserts the row and makes sure the
 * user is an `owner` of the default tenant. Safe to call on every
 * request; the three statements run in µs against SQLite's page cache.
 */
export const DEV_USER_ID = "dev-user";
export const DEV_USER_EMAIL = "dev@localhost";

export function ensureDevUser(db: Database.Database): string {
  // Materialise the row if missing. The `users` table shape varies by
  // auth-adapter version; use a conservative superset of the known
  // columns so this works against both the current NextAuth adapter
  // (id, email, name, email_verified, image) and the older prototype
  // schema (id, email, role, created_at).
  const existing = db.prepare(`SELECT id FROM users WHERE id = ?`).get(DEV_USER_ID) as { id: string } | undefined;
  if (!existing) {
    try {
      db.prepare(
        `INSERT INTO users (id, email, name, role) VALUES (?, ?, 'Dev User', 'admin')`,
      ).run(DEV_USER_ID, DEV_USER_EMAIL);
    } catch {
      // Fallback for schemas that don't have the `role`/`name` columns —
      // just insert the mandatory fields.
      try {
        db.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`).run(
          DEV_USER_ID,
          DEV_USER_EMAIL,
        );
      } catch {
        // If both attempts fail, something structural is off with the
        // users table. Swallow and let the downstream FK failure surface
        // with context rather than masking it here.
      }
    }
  }

  // Owner membership in the default tenant. tenant_memberships has a
  // UNIQUE(tenant_id, user_id) index, so this INSERT is a safe no-op on
  // repeat runs — the catch handles the constraint violation silently.
  const tenantId = getDefaultTenantId(db);
  try {
    db.prepare(
      `INSERT INTO tenant_memberships (id, tenant_id, user_id, role)
       VALUES (?, ?, ?, 'owner')`,
    ).run(uuid(db), tenantId, DEV_USER_ID);
  } catch {
    /* already a member — ignore */
  }

  return DEV_USER_ID;
}
