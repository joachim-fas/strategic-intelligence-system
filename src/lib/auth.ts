/**
 * NextAuth v5 (Auth.js) configuration.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the comma-separated allowlist from env */
function getAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  if (!raw) return new Set(); // empty = everyone allowed (dev mode)
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

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
 */
function buildSqliteAdapter() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  const dbPath = path.join(process.cwd(), "local.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  return {
    createUser(data: { email: string; emailVerified?: Date | null; name?: string; image?: string }) {
      const id = crypto.randomUUID();
      sqlite
        .prepare(
          `INSERT INTO users (id, email, email_verified, name, image, role) VALUES (?, ?, ?, ?, ?, 'member')`
        )
        .run(id, data.email, data.emailVerified?.toISOString() ?? null, data.name ?? null, data.image ?? null);
      return { id, ...data, role: "member", createdAt: new Date() };
    },

    getUser(id: string) {
      const row = sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
      return row ? mapUser(row) : null;
    },

    getUserByEmail(email: string) {
      const row = sqlite.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
      return row ? mapUser(row) : null;
    },

    getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const row = sqlite
        .prepare(
          `SELECT u.* FROM users u JOIN accounts a ON u.id = a.user_id WHERE a.provider = ? AND a.provider_account_id = ?`
        )
        .get(provider, providerAccountId);
      return row ? mapUser(row) : null;
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
          `SELECT s.*, u.id as uid, u.email, u.name, u.image, u.role, u.email_verified FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ?`
        )
        .get(sessionToken) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        session: {
          sessionToken: row.session_token as string,
          userId: row.user_id as string,
          expires: new Date(row.expires as string),
        },
        user: mapUser(row),
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
// Auth configuration
// ---------------------------------------------------------------------------

const authConfig: NextAuthConfig = {
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
  callbacks: {
    async signIn({ user }) {
      const allowed = getAllowedEmails();
      // If no allowlist configured, allow everyone (dev mode)
      if (allowed.size === 0) return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return allowed.has(email);
    },
    async session({ session, user }) {
      // Attach user id and role to session
      if (session.user) {
        session.user.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = (user as any).role ?? "member";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);
