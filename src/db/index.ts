/**
 * Database connection layer with automatic driver selection.
 *
 * - If DATABASE_URL is set and starts with "postgres", uses postgres.js (Supabase).
 * - Otherwise falls back to a local SQLite file via better-sqlite3.
 *
 * Both drivers are wrapped behind the same Drizzle ORM interface so the rest
 * of the application never has to care which one is active.
 */

import * as pgSchema from "./schema";

// Re-export schema for convenience
export * from "./schema";

// ---------------------------------------------------------------------------
// Type representing either PG or SQLite drizzle instance.  We use `any` here
// deliberately because the two driver types are structurally incompatible but
// the query-builder surface we use (select / insert / update / delete) is
// identical.  Every call-site imports the *schema* tables which are typed, so
// safety is preserved where it matters.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _dialect: "pg" | "sqlite" = "pg";

function getDialect(): "pg" | "sqlite" {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres")) return "pg";
  return "sqlite";
}

/**
 * Lazy-initialised database singleton.
 * Calling code: `import { getDb } from "@/db"; const db = getDb();`
 */
export function getDb() {
  if (_db) return _db;

  _dialect = getDialect();

  if (_dialect === "pg") {
    // Dynamic import is fine — this path only runs on the server at runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/postgres-js");

    const connectionString = process.env.DATABASE_URL!;
    const client = postgres(connectionString, {
      // Serverless-friendly settings for Supabase / Neon
      max: 1, // single connection per serverless invocation
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(client, { schema: pgSchema });
  } else {
    // SQLite fallback for local dev without Supabase
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteSchema = require("./schema-sqlite");

    const path = require("path");
    const dbPath = path.join(process.cwd(), "local.db");
    const sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    sqlite.pragma("journal_mode = WAL");

    // Auto-migrate the multi-tenant layer on first boot of the process.
    // Idempotent — see src/db/sqlite-helpers.ts. Done here (not per route)
    // so that raw better-sqlite3 handles in individual route files
    // also see the new columns + tenants table without each file having
    // to re-run ALTER TABLE on its own.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ensureMultiTenantSchema, ensureDefaultTenant } = require("./sqlite-helpers");
      ensureMultiTenantSchema(sqlite);
      ensureDefaultTenant(sqlite);
    } catch (err) {
      // Migrations failing here would mean the app is unusable anyway;
      // log loudly so the dev sees it instead of getting mysterious
      // "no such column: tenant_id" errors from downstream routes.
      // eslint-disable-next-line no-console
      console.error("[db] multi-tenant migration failed:", err);
    }

    _db = drizzle(sqlite, { schema: sqliteSchema });
  }

  return _db;
}

/**
 * Returns a RAW better-sqlite3 handle, not the Drizzle wrapper.
 *
 * Most of the `/api/v1/*` routes in this codebase use better-sqlite3
 * directly (prepared statements + .run/.get/.all) instead of going
 * through Drizzle. This helper gives them a pre-migrated handle with
 * WAL mode enabled and the multi-tenant layer ready to use, so they
 * can stop constructing their own `new Database(...)` instances and
 * stop running ad-hoc ALTER TABLE statements at request time.
 *
 * Do NOT close the handle in the caller — it's reused across the
 * process lifetime. Open a new one with `new Database(...)` yourself
 * if you need short-lived writable + closeable access (e.g. one-off
 * maintenance scripts outside the request cycle).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _rawSqlite: any = null;
export function getSqliteHandle() {
  if (_rawSqlite) return _rawSqlite;
  if (getDialect() !== "sqlite") {
    throw new Error("getSqliteHandle() is only available in the SQLite dialect. Check DATABASE_URL.");
  }
  // Force-initialise the Drizzle wrapper first so the migration runs and
  // WAL mode is enabled; then open a second handle for route-level code.
  // Second handle shares the same file, so WAL applies here too.
  getDb();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const dbPath = path.join(process.cwd(), "local.db");
  _rawSqlite = new Database(dbPath);
  _rawSqlite.pragma("journal_mode = WAL");
  return _rawSqlite;
}

/** Which driver is active? Useful for conditional SQL. */
export function getDialectName(): "pg" | "sqlite" {
  if (!_db) getDb(); // ensure initialised
  return _dialect;
}

// Legacy export for existing call-sites that did `import { db } from "@/db"`
// This is a proxy that lazily initialises on first property access.
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return getDb()[prop];
  },
});

export type DB = ReturnType<typeof getDb>;
