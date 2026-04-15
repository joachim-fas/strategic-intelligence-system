/**
 * NextAuth v5 type augmentations.
 *
 * Extends the default session + user types so TypeScript sees the SIS-
 * specific fields we push through:
 *   - role (system-rolle: admin | member)
 *   - activeTenantId + tenants[]: multi-tenant context populated by the
 *     session callback in src/lib/auth.config.ts from the enriched user
 *     returned by the SQLite adapter in src/lib/auth.ts.
 */

import "next-auth";

/** Per-tenant role inside a given organisation. */
export type TenantRole = "owner" | "admin" | "member" | "viewer";

/** A single tenant membership surfaced on the session. */
export interface SessionTenant {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      /** System-rolle: admin | member (orthogonal zur Tenant-Rolle). */
      role: string;
      /**
       * Currently active tenant — source of truth is
       * users.last_active_tenant_id, written by the switch-tenant route.
       * Null only for users with zero memberships (should not happen
       * in practice since every new user is wired to the default tenant).
       */
      activeTenantId: string | null;
      /** All tenants the user is a member of, with their role. */
      tenants: SessionTenant[];
    };
  }

  interface User {
    role?: string;
    activeTenantId?: string | null;
    tenants?: SessionTenant[];
  }
}
