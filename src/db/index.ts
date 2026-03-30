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

    _db = drizzle(sqlite, { schema: sqliteSchema });
  }

  return _db;
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
