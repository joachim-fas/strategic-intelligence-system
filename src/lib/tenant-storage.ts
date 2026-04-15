"use client";

/**
 * Tenant-scoped localStorage wrapper.
 *
 * Why it exists
 * ──────────────
 * Several client pages stash state in localStorage that is actually
 * tenant-specific — which canvas was last active, undo history,
 * navigation hand-offs:
 *   - `sis-active-canvas`
 *   - `sis-canvas-history-v2`
 *   - `sis-transfer-to-canvas`
 *   - `sis-canvas-project`
 *
 * Before multi-tenancy these were global per-browser. With multi-tenant
 * support the user may switch between e.g. "Mercedes Strategie" and
 * "VW Markt" and the "last active canvas" key must not cross over — if
 * the Mercedes canvas id leaked into the VW session, the client would
 * try to GET a canvas the user is no longer scoped to, the API would
 * 403, and the UI would show a confusing error.
 *
 * This helper prefixes every access with the current tenant id so each
 * tenant keeps its own view. The old pre-tenant keys are kept
 * untouched — a user that rolls back to a single-tenant deployment
 * does not lose state.
 *
 * Design notes:
 * - Reads return `null` when running on the server (SSR) or when the
 *   key is missing. Never throws.
 * - `removeLegacy()` is provided for callers that want to one-time
 *   migrate their old un-prefixed keys into the new scope.
 * - The tenant id must be passed in explicitly — the helper does not
 *   read the session itself, to stay framework-agnostic and free of
 *   circular deps with the auth layer.
 */

const PREFIX = "sis:tenant:";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function scopedKey(tenantId: string, key: string): string {
  return `${PREFIX}${tenantId}:${key}`;
}

export const tenantStorage = {
  get(tenantId: string, key: string): string | null {
    if (!isBrowser() || !tenantId) return null;
    try {
      return window.localStorage.getItem(scopedKey(tenantId, key));
    } catch {
      return null;
    }
  },

  set(tenantId: string, key: string, value: string): void {
    if (!isBrowser() || !tenantId) return;
    try {
      window.localStorage.setItem(scopedKey(tenantId, key), value);
    } catch {
      // Quota exceeded etc. — silent, same fail-behavior as raw
      // localStorage.setItem in the old code paths.
    }
  },

  remove(tenantId: string, key: string): void {
    if (!isBrowser() || !tenantId) return;
    try {
      window.localStorage.removeItem(scopedKey(tenantId, key));
    } catch {
      // ignore
    }
  },

  /**
   * Remove all keys for a given tenant. Useful on "archive tenant" or
   * "leave tenant" flows where we want the client to forget any residual
   * state for that org.
   */
  clearTenant(tenantId: string): void {
    if (!isBrowser() || !tenantId) return;
    try {
      const prefix = scopedKey(tenantId, "");
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignore
    }
  },

  /**
   * One-shot migration helper: if a legacy un-scoped key exists in
   * localStorage, move its value into the given tenant scope. Does
   * nothing if the scoped key is already populated (so a repeated
   * call is safe and user choices aren't overwritten).
   */
  migrateLegacy(tenantId: string, legacyKey: string, scopedKeyName: string = legacyKey): void {
    if (!isBrowser() || !tenantId) return;
    try {
      const existingScoped = window.localStorage.getItem(scopedKey(tenantId, scopedKeyName));
      if (existingScoped !== null) return; // already migrated or has its own value
      const legacyValue = window.localStorage.getItem(legacyKey);
      if (legacyValue === null) return;
      window.localStorage.setItem(scopedKey(tenantId, scopedKeyName), legacyValue);
    } catch {
      // ignore
    }
  },
};

/** Canonical key names used across the app. Kept in one place so we
 *  don't grep for string literals next time we add or rename one. */
export const TENANT_STORAGE_KEYS = {
  activeCanvas: "sis-active-canvas",
  canvasHistory: "sis-canvas-history-v2",
  transferToCanvas: "sis-transfer-to-canvas",
  canvasProject: "sis-canvas-project",
} as const;
