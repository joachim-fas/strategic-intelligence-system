"use client";

/**
 * Tenant-Context (Client-Side).
 *
 * Warum es das gibt
 * ─────────────────
 * Zig Client-Komponenten muessen wissen, in welchem Mandanten der User
 * gerade arbeitet — der Canvas-Client fuer tenant-scoped localStorage,
 * der Switcher fuer die Anzeige, das TrendDetailPanel fuer die Primary-
 * Action, kuenftige Admin-UIs fuer Rollen-Gates. Anstatt jede Komponente
 * einzeln `getSession()` aufrufen zu lassen (Roundtrip pro Mount), wird
 * der Tenant einmal beim SSR vom Root-Layout aus der Session gelesen
 * und als Initial-Wert an diesen Provider gegeben. Der Provider stellt:
 *
 *   - `activeTenantId`: aktueller Scope
 *   - `memberships`: alle Tenants, in denen der User Mitglied ist
 *   - `role`: Rolle im aktiven Tenant
 *   - `switchTenant(id)`: wechselt aktiv, schreibt auf dem Server
 *     (`POST /api/v1/auth/switch-tenant`) und reloaded die Seite
 *
 * Alle Seiten, die den Tenant brauchen, nutzen `useTenant()`. Ausserhalb
 * des Providers liefert der Hook ein `null`-Tuple — Komponenten koennen
 * damit defensiv umgehen, ohne zu crashen.
 */

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { fetchWithTimeout } from "./fetch-with-timeout";

export type TenantRole = "owner" | "admin" | "member" | "viewer";

export interface TenantMembership {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
}

export interface TenantContextValue {
  activeTenantId: string | null;
  memberships: TenantMembership[];
  role: TenantRole | null;
  /** true wenn User System-Admin ist (users.role === "admin"). */
  isSystemAdmin: boolean;
  /** Wechselt den aktiven Tenant. Reloaded die Seite bei Erfolg. */
  switchTenant: (tenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export interface TenantProviderProps {
  activeTenantId: string | null;
  memberships: TenantMembership[];
  isSystemAdmin: boolean;
  children: React.ReactNode;
}

export function TenantProvider({
  activeTenantId,
  memberships,
  isSystemAdmin,
  children,
}: TenantProviderProps) {
  const role: TenantRole | null = useMemo(() => {
    if (!activeTenantId) return null;
    return memberships.find((m) => m.id === activeTenantId)?.role ?? null;
  }, [activeTenantId, memberships]);

  const switchTenant = useCallback(async (tenantId: string) => {
    // Abort if same tenant — no-op, no reload.
    if (tenantId === activeTenantId) return;
    // Verify membership client-side to avoid a server roundtrip for
    // obviously-bad inputs (UI bugs / stale links).
    const match = memberships.find((m) => m.id === tenantId);
    if (!match) return;
    try {
      const res = await fetchWithTimeout("/api/v1/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error("[tenant] switch failed:", res.status);
        return;
      }
      // Hard reload so every page + every localStorage lookup picks up
      // the new tenant on the next server render. Soft state swap is
      // not worth the fragility here.
      window.location.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[tenant] switch error:", err);
    }
  }, [activeTenantId, memberships]);

  const value: TenantContextValue = useMemo(
    () => ({ activeTenantId, memberships, role, isSystemAdmin, switchTenant }),
    [activeTenantId, memberships, role, isSystemAdmin, switchTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Read-only access to the tenant context. Returns a stub when used
 * outside the provider so pages that render pre-provider (e.g. auth/
 * error screens) don't crash — callers should check `activeTenantId`
 * against `null` before relying on it.
 */
export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx) return ctx;
  return {
    activeTenantId: null,
    memberships: [],
    role: null,
    isSystemAdmin: false,
    switchTenant: async () => {},
  };
}

/** Shortcut for the most common question: "in which tenant am I?" */
export function useActiveTenantId(): string | null {
  return useTenant().activeTenantId;
}
