"use client";

/**
 * Cross-tenant audit-log client.
 *
 * Layout-Zwillinge zu /monitor, damit System-Admin-Seiten sich
 * einheitlich anfuehlen: Hero mit Filter-Leiste + Liste mit Infinite-
 * Load. Farb-Logik der Action-Pills ist identisch zum Tenant-Detail-
 * Preview (gruen = additiv, rot = destruktiv, amber = aenderung,
 * blau = sent).
 *
 * Filter:
 *   - Tenant-Dropdown (alle aktiven Tenants; archivierte nicht, weil
 *     sie typischerweise uninteressant sind — System-Admin kann dafuer
 *     die Tenant-Detail-Seite nutzen).
 *   - Action-Dropdown (aus den tatsaechlich geschriebenen actions,
 *     nicht hardcoded — neue Actions erscheinen automatisch).
 *   - Actor-Email-Freitext (Client-Side Filter ueber den aktuellen
 *     Batch — wer den Actor kennt, tippt eh direkt).
 *
 * Kein Server-Side Actor-Filter via Email, weil Email in users sitzt
 * und eine ID-Resolution noetig waere — das spart auf dem Server
 * einen JOIN. Client-Side-Filter auf die geladene Seite reicht fuer
 * den typischen "ich suche meinen eigenen letzten Move"-Fall.
 *
 * 2026-04-18 audit A5-H9: migrated to `useT()` + `audit.*` namespace.
 * Action detail lines build JSX with translated fragments so the
 * <strong>-wrapped interpolations remain styled in both locales.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { t as translate, localeTag, type Locale, type TranslationKey } from "@/lib/i18n";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface AuditEntry {
  id: string;
  action: string;
  target: unknown;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
  actor: { id: string; name: string | null; email: string | null } | null;
}

interface Payload {
  entries: AuditEntry[];
  nextBefore: string | null;
  filters: {
    actions: string[];
    tenants: { id: string; name: string; slug: string }[];
  };
}

export function AuditClient() {
  const { t, locale } = useT();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filters, setFilters] = useState<Payload["filters"]>({ actions: [], tenants: [] });
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [actorQuery, setActorQuery] = useState<string>("");

  const load = useCallback(async (opts?: { before?: string | null; append?: boolean }) => {
    const isAppend = !!opts?.append;
    if (isAppend) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts?.before) params.set("before", opts.before);
      if (tenantFilter) params.set("tenantId", tenantFilter);
      if (actionFilter) params.set("action", actionFilter);
      // Actor-Email jetzt als Server-Side-Filter (LIKE auf users.email)
      // mit einem kleinen Debounce — sonst feuert jedes Tastaturzeichen
      // einen Roundtrip. Der Debounce sitzt im useEffect-Trigger weiter
      // unten; hier reicht das Forward.
      if (actorQuery.trim().length >= 2) params.set("actorEmail", actorQuery.trim());
      params.set("limit", "100");
      const res = await fetchWithTimeout(`/api/v1/admin/audit?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = (json?.data ?? json) as Payload;
      setEntries((prev) => isAppend ? [...prev, ...data.entries] : data.entries);
      setNextBefore(data.nextBefore);
      setFilters(data.filters);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantFilter, actionFilter, actorQuery]);

  // Reload on filter change (not on infinite-load). Actor-Email debounced
  // um 250ms so the user can tippen without triggering N requests.
  useEffect(() => {
    setNextBefore(null);
    const timer = window.setTimeout(() => { load(); }, actorQuery ? 250 : 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter, actionFilter, actorQuery]);

  // Client-Side-Filter entfaellt — Server filtert bereits. Pass-through.
  const visibleEntries = entries;

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Header + Back */}
        <Link href="/admin/tenants" style={{ fontSize: 12, color: "var(--color-text-muted)", textDecoration: "none", marginBottom: 12, display: "inline-block" }}>
          ← {t("audit.allTenantsLink")}
        </Link>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.10em", textTransform: "uppercase" as const,
            color: "var(--volt-text-faint, #BBB)", marginBottom: 6,
          }}>
            {t("nav.systemAdmin")}
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 700, fontFamily: "var(--volt-font-display)",
            color: "var(--color-text-heading)", margin: 0, letterSpacing: "-0.02em",
          }}>
            {t("audit.pageTitle")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 640 }}>
            {t("audit.subtitle")}
          </p>
        </div>

        {/* Filter bar */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
          padding: "10px 12px",
          background: "var(--volt-surface-raised)", border: "1px solid var(--color-border)",
          borderRadius: 12, marginBottom: 16,
        }}>
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            style={filterStyle}
          >
            <option value="">{t("audit.filterAllTenants")}</option>
            {filters.tenants.map((tn) => (
              <option key={tn.id} value={tn.id}>{tn.name}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={filterStyle}
          >
            <option value="">{t("audit.filterAllActions")}</option>
            {filters.actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input
            type="text"
            value={actorQuery}
            onChange={(e) => setActorQuery(e.target.value)}
            placeholder={t("audit.actorPlaceholder")}
            style={{ ...filterStyle, flex: "1 1 200px", minWidth: 160 }}
          />
          {(tenantFilter || actionFilter || actorQuery) && (
            <button
              onClick={() => { setTenantFilter(""); setActionFilter(""); setActorQuery(""); }}
              style={{ ...filterStyle, cursor: "pointer", color: "var(--color-text-muted)" }}
            >
              {t("common.reset")}
            </button>
          )}
        </div>

        {loading && entries.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{t("common.loading")}</div>
        )}
        {error && (
          <div style={{
            fontSize: 12, color: "var(--signal-negative, #C0341D)",
            padding: "8px 12px", borderRadius: 8,
            background: "var(--signal-negative-light)", marginBottom: 14,
          }}>{error}</div>
        )}

        {visibleEntries.length === 0 && !loading && (
          <div style={{
            padding: "24px", borderRadius: 12,
            border: "1px dashed var(--color-border)",
            color: "var(--color-text-muted)", fontSize: 13, textAlign: "center" as const,
          }}>
            {t("audit.emptyForFilters")}
          </div>
        )}

        {visibleEntries.length > 0 && (
          <div style={{
            border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden",
            background: "var(--volt-surface-raised, #fff)",
          }}>
            {visibleEntries.map((e, i) => (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "170px 1.2fr 1fr 170px",
                  gap: 14, padding: "10px 14px",
                  borderBottom: i < visibleEntries.length - 1 ? "1px solid var(--color-border)" : "none",
                  alignItems: "start", fontSize: 12,
                }}
              >
                <span style={{
                  fontFamily: "var(--volt-font-mono)", fontSize: 10,
                  fontWeight: 700, letterSpacing: "0.04em",
                  color: actionColor(e.action),
                  textTransform: "uppercase" as const,
                }}>
                  {e.action}
                </span>
                <span style={{ color: "var(--color-text-primary)", lineHeight: 1.5 }}>
                  {renderAuditDetail(e, locale)}
                </span>
                <Link
                  href={`/admin/tenants/${e.tenant.id}`}
                  style={{ color: "var(--color-text-primary)", textDecoration: "none", fontWeight: 500 }}
                >
                  {e.tenant.name}
                  <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--volt-font-mono)", fontSize: 10, marginLeft: 6 }}>
                    {e.tenant.slug}
                  </span>
                </Link>
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", textAlign: "right" as const, fontFamily: "var(--volt-font-mono)" }}>
                  {new Date(e.createdAt).toLocaleString(localeTag(locale), {
                    year: "2-digit", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                  {e.actor && (
                    <>
                      <br />
                      <span style={{ color: "var(--color-text-faint, #AAA)" }}>
                        {e.actor.name ?? e.actor.email}
                      </span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {nextBefore && (
          <div style={{ marginTop: 14, textAlign: "center" as const }}>
            <button
              onClick={() => load({ before: nextBefore, append: true })}
              disabled={loadingMore}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: "8px 18px", borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "transparent", color: "var(--color-text-primary)",
                cursor: loadingMore ? "wait" : "pointer",
                fontFamily: "var(--volt-font-ui)",
              }}
            >
              {loadingMore ? t("common.loading") : t("audit.loadMore")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

const filterStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "var(--volt-font-ui)",
  background: "var(--volt-surface, #fff)",
  color: "var(--color-text-primary)",
  outline: "none",
};

function actionColor(action: string): string {
  if (action.endsWith(".removed") || action.endsWith(".deleted") || action.endsWith(".revoked") || action.endsWith(".archived")) return "#C0341D";
  if (action.endsWith(".created") || action.endsWith(".added") || action.endsWith(".accepted") || action.endsWith(".restored")) return "#0F6038";
  if (action.endsWith(".sent")) return "#1A4A8A";
  if (action.endsWith(".changed") || action.endsWith(".updated")) return "#7A5C00";
  return "#6B6B6B";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderAuditDetail(entry: { action: string; target: any }, locale: Locale): React.ReactNode {
  const target = entry.target ?? {};
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  switch (entry.action) {
    case "tenant.created":
      return <>{tl("audit.tenantCreatedPrefix")} <strong>{target.name}</strong> {tl("audit.tenantCreatedSuffix")} ({target.slug})</>;
    case "tenant.updated":
      return <>{tl("audit.tenantUpdated")}</>;
    case "tenant.archived":
      return <>{tl("audit.tenantArchived")}</>;
    case "tenant.restored":
      return <>{tl("audit.tenantRestored")}</>;
    case "tenant.deleted":
      return <>{tl("audit.tenantDeleted")}</>;
    case "member.added":
      return <><strong>{target.email ?? target.userId}</strong> {tl("audit.memberAddedSuffix", { role: target.role })}</>;
    case "member.removed":
      return <>{tl("audit.memberRemovedRole", { role: target.role })}</>;
    case "role.changed":
      return <>{tl("audit.roleChangedPrefix")} {target.from} {tl("audit.roleChangedArrow")} <strong>{target.to}</strong></>;
    case "invite.sent":
      return <>{tl("audit.inviteSentPrefix")} <strong>{target.email}</strong> {tl("audit.inviteSentRole", { role: target.role })}</>;
    case "invite.revoked":
      return <>{tl("audit.inviteRevokedPrefix")} <strong>{target.email}</strong> {tl("audit.inviteRevokedSuffix")}</>;
    case "invite.accepted":
      return <>{tl("audit.inviteAccepted", { role: target.role })}</>;
    default:
      try {
        const preview = typeof entry.target === "object" && entry.target
          ? JSON.stringify(entry.target).slice(0, 120)
          : String(entry.target ?? "");
        return <span style={{ color: "var(--color-text-muted)" }}>{preview}</span>;
      } catch {
        return null;
      }
  }
}
