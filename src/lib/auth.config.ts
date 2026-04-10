/**
 * Edge-safe NextAuth v5 configuration.
 *
 * This file contains ONLY config that runs safely in the Edge Runtime
 * (used by middleware.ts). No Node.js-only imports (nodemailer, better-sqlite3).
 *
 * The full auth config (with EmailProvider + adapter) lives in auth.ts,
 * which is only imported by Node.js route handlers.
 */

import type { NextAuthConfig } from "next-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the comma-separated allowlist from env */
export function getAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  if (!raw) return new Set(); // empty = everyone allowed (dev mode)
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

// ---------------------------------------------------------------------------
// Edge-safe auth config (no providers, no adapter)
// ---------------------------------------------------------------------------

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }: { user: { email?: string | null } }) {
      const allowed = getAllowedEmails();
      if (allowed.size === 0) return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return allowed.has(email);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, user }: { session: any; user: any }) {
      if (session.user) {
        session.user.id = user.id;
        (session.user as any).role = (user as any).role ?? "member";
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts (Node.js runtime only)
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
