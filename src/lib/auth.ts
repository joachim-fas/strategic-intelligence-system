/**
 * NextAuth v5 (Auth.js) — full configuration (Node.js runtime only).
 *
 * This file imports EmailProvider (nodemailer) and the DB adapter, so it
 * MUST NOT be imported by middleware.ts (Edge Runtime).
 * Middleware uses auth.config.ts instead.
 *
 * - Email magic-link authentication (no passwords)
 * - Email allowlist via ALLOWED_EMAILS env var
 * - Database sessions via Drizzle adapter
 * - Works with both PostgreSQL and SQLite
 */

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authConfig } from "./auth.config";

/** Build the Drizzle adapter lazily so we avoid top-level side-effects */
function buildAdapter() {
  // We need to dynamically resolve the adapter because the db driver
  // depends on runtime env vars.
  const url = process.env.DATABASE_URL ?? "";
  const isPg = url.startsWith("postgres");

  if (isPg) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/postgres-js");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const schema = require("@/db/schema");

    const client = postgres(url, { max: 1, idle_timeout: 20 });
    const db = drizzle(client, { schema });
    return DrizzleAdapter(db);
  } else {
    // SQLite for local dev — use a simplified adapter
    // DrizzleAdapter expects PG-style schema; for SQLite we provide a
    // custom minimal adapter that stores sessions in-memory for dev.
    return buildSqliteAdapter();
  }
}

/**
 * Minimal NextAuth adapter for SQLite local development.
 * Stores data in the SQLite database using raw queries.
 *
 * Multi-tenant awareness
 * ──────────────────────
 * - createUser also creates a tenant_memberships row (role=member) in the
 *   default tenant, and stamps users.last_active_tenant_id. So a brand-new
 *   user lands in a usable tenant on first login.
 * - getSession/getUser variants load the memberships list + the active
 *   tenant id, and return them on the user object. The session callback
 *   in auth.config.ts picks that up and exposes it as session.user.tenants
 *   and session.user.activeTenantId.
 */
function buildSqliteAdapter() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ensureMultiTenantSchema, ensureDefaultTenant, getDefaultTenantId } = require("@/db/sqlite-helpers");

  const dbPath = path.join(process.cwd(), "local.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  // Adapter is constructed once at module init — make sure the schema is
  // up to date before we start serving auth requests against it.
  try {
    ensureMultiTenantSchema(sqlite);
    ensureDefaultTenant(sqlite);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth] multi-tenant migration failed:", err);
  }

  /**
   * Adds membership + active-tenant pointer for a freshly-invited or
   * freshly-signed-up user. Called once per newly created user row.
   */
  function wireNewUserToDefaultTenant(userId: string): string {
    const tenantId: string = getDefaultTenantId(sqlite);
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO tenant_memberships (id, tenant_id, user_id, role, joined_at)
         VALUES (?, ?, ?, 'member', datetime('now'))`,
      )
      .run(crypto.randomUUID(), tenantId, userId);
    sqlite
      .prepare(`UPDATE users SET last_active_tenant_id = ? WHERE id = ? AND last_active_tenant_id IS NULL`)
      .run(tenantId, userId);
    return tenantId;
  }

  /**
   * Loads every membership the user has plus the tenant metadata. Used
   * to enrich the User object returned by getUser* calls.
   */
  function loadMemberships(userId: string): Array<{ id: string; name: string; slug: string; role: string }> {
    return sqlite
      .prepare(
        `SELECT t.id, t.name, t.slug, m.role
         FROM tenant_memberships m
         JOIN tenants t ON t.id = m.tenant_id
         WHERE m.user_id = ? AND t.archived_at IS NULL
         ORDER BY m.joined_at ASC`,
      )
      .all(userId) as Array<{ id: string; name: string; slug: string; role: string }>;
  }

  /** Wrap a raw users row into the shape NextAuth expects, with tenant extras. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enrichUser(row: any) {
    const base = mapUser(row);
    const tenants = loadMemberships(base.id);
    // Active tenant: use the user's remembered choice if they still have a
    // membership in it; otherwise fall back to the first membership (or the
    // default tenant as last resort). This keeps the session safe even when
    // a user was removed from the org they last used.
    let activeTenantId: string | null = (row.last_active_tenant_id as string | null) ?? null;
    if (activeTenantId && !tenants.some((t) => t.id === activeTenantId)) {
      activeTenantId = null;
    }
    if (!activeTenantId) {
      activeTenantId = tenants[0]?.id ?? getDefaultTenantId(sqlite);
    }
    return { ...base, tenants, activeTenantId };
  }

  return {
    createUser(data: { email: string; emailVerified?: Date | null; name?: string; image?: string }) {
      const id = crypto.randomUUID();
      sqlite
        .prepare(
          `INSERT INTO users (id, email, email_verified, name, image, role) VALUES (?, ?, ?, ?, ?, 'member')`
        )
        .run(id, data.email, data.emailVerified?.toISOString() ?? null, data.name ?? null, data.image ?? null);
      const activeTenantId = wireNewUserToDefaultTenant(id);
      return {
        id,
        ...data,
        role: "member",
        createdAt: new Date(),
        tenants: loadMemberships(id),
        activeTenantId,
      };
    },

    getUser(id: string) {
      const row = sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
      return row ? enrichUser(row) : null;
    },

    getUserByEmail(email: string) {
      const row = sqlite.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
      return row ? enrichUser(row) : null;
    },

    getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const row = sqlite
        .prepare(
          `SELECT u.* FROM users u JOIN accounts a ON u.id = a.user_id WHERE a.provider = ? AND a.provider_account_id = ?`
        )
        .get(provider, providerAccountId);
      return row ? enrichUser(row) : null;
    },

    updateUser(data: { id: string; name?: string; email?: string; emailVerified?: Date | null; image?: string }) {
      const fields: string[] = [];
      const values: unknown[] = [];
      if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
      if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
      if (data.emailVerified !== undefined) { fields.push("email_verified = ?"); values.push(data.emailVerified?.toISOString() ?? null); }
      if (data.image !== undefined) { fields.push("image = ?"); values.push(data.image); }
      if (fields.length > 0) {
        values.push(data.id);
        sqlite.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
      }
      return sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(data.id);
    },

    deleteUser(id: string) {
      sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    },

    linkAccount(data: Record<string, unknown>) {
      const id = crypto.randomUUID();
      sqlite
        .prepare(
          `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          data.userId,
          data.type,
          data.provider,
          data.providerAccountId,
          data.refresh_token ?? null,
          data.access_token ?? null,
          data.expires_at ?? null,
          data.token_type ?? null,
          data.scope ?? null,
          data.id_token ?? null,
          data.session_state ?? null
        );
      return { id, ...data };
    },

    unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      sqlite
        .prepare(`DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?`)
        .run(provider, providerAccountId);
    },

    createSession(data: { sessionToken: string; userId: string; expires: Date }) {
      const id = crypto.randomUUID();
      sqlite
        .prepare(`INSERT INTO sessions (id, session_token, user_id, expires) VALUES (?, ?, ?, ?)`)
        .run(id, data.sessionToken, data.userId, data.expires.toISOString());
      return { id, ...data };
    },

    getSessionAndUser(sessionToken: string) {
      const row = sqlite
        .prepare(
          `SELECT s.*, u.id as uid, u.email, u.name, u.image, u.role, u.email_verified, u.last_active_tenant_id
           FROM sessions s JOIN users u ON s.user_id = u.id
           WHERE s.session_token = ?`
        )
        .get(sessionToken) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        session: {
          sessionToken: row.session_token as string,
          userId: row.user_id as string,
          expires: new Date(row.expires as string),
        },
        // Use enrichUser so the session callback (auth.config.ts) sees
        // `user.tenants` + `user.activeTenantId` and can forward them
        // onto the session object clients receive.
        user: enrichUser(row),
      };
    },

    updateSession(data: { sessionToken: string; expires?: Date }) {
      if (data.expires) {
        sqlite
          .prepare(`UPDATE sessions SET expires = ? WHERE session_token = ?`)
          .run(data.expires.toISOString(), data.sessionToken);
      }
      return sqlite.prepare(`SELECT * FROM sessions WHERE session_token = ?`).get(data.sessionToken);
    },

    deleteSession(sessionToken: string) {
      sqlite.prepare(`DELETE FROM sessions WHERE session_token = ?`).run(sessionToken);
    },

    createVerificationToken(data: { identifier: string; token: string; expires: Date }) {
      sqlite
        .prepare(`INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)`)
        .run(data.identifier, data.token, data.expires.toISOString());
      return data;
    },

    useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      // SEC-17: Only accept tokens that have not expired (expires > now).
      // This prevents magic-link tokens from being used after their intended lifetime.
      const row = sqlite
        .prepare(
          `SELECT * FROM verification_tokens WHERE identifier = ? AND token = ? AND expires > datetime('now')`
        )
        .get(identifier, token) as Record<string, unknown> | undefined;
      if (!row) return null;
      sqlite
        .prepare(`DELETE FROM verification_tokens WHERE identifier = ? AND token = ?`)
        .run(identifier, token);
      return {
        identifier: row.identifier as string,
        token: row.token as string,
        expires: new Date(row.expires as string),
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(row: any) {
  return {
    id: row.uid ?? row.id,
    email: row.email,
    emailVerified: row.email_verified ? new Date(row.email_verified) : null,
    name: row.name,
    image: row.image,
    role: row.role ?? "member",
  };
}

// ---------------------------------------------------------------------------
// Full auth configuration (Node.js only — spreads edge-safe config)
// ---------------------------------------------------------------------------

const fullAuthConfig: NextAuthConfig = {
  ...authConfig,
  adapter: buildAdapter() as NextAuthConfig["adapter"],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST ?? "smtp.resend.com",
        port: Number(process.env.EMAIL_SERVER_PORT ?? "465"),
        auth: {
          user: process.env.EMAIL_SERVER_USER ?? "resend",
          pass: process.env.EMAIL_SERVER_PASSWORD ?? process.env.RESEND_API_KEY ?? "",
        },
      },
      from: process.env.EMAIL_FROM ?? "noreply@sis.app",
    }),
  ],
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(fullAuthConfig);
