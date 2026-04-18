"use client";

/**
 * Mandant-Detail mit Mitglieder- und Einladungsliste.
 *
 * Layout:
 *   - Kopf: Tenant-Name + Slug + Plan + Status-Badge + Archivierungs-Hinweis
 *   - Stats-Zeile: Mitglieder, Projekte, Szenarien, Ratings
 *   - Sektion "Mitglieder": Tabelle mit Rolle-Dropdown + Entfernen-Button
 *   - Sektion "Einladungen": Pending Invites + "+ Mitglied einladen"
 *
 * Rollen-Change laeuft ueber PATCH memberships/[id], Remove ueber DELETE.
 * Einladungen: POST /invites (mit Auto-Membership wenn User existiert),
 * DELETE /invites?inviteId=... revoked pending.
 *
 * 2026-04-18 audit A5-H9: migrated from `de ? ... : ...` ternaries to
 * the new namespaced dictionary via `useT()`. Audit detail lines keep
 * their JSX shape but use translated fragments.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { t as translate, localeTag, type Locale, type TranslationKey } from "@/lib/i18n";
import { VoltModal, voltConfirm } from "@/components/volt";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

type Role = "owner" | "admin" | "member" | "viewer";
const ROLES: Role[] = ["owner", "admin", "member", "viewer"];

const ROLE_COLOR: Record<Role, string> = {
  owner: "#0F6038",
  admin: "#1A4A8A",
  member: "#6B6B6B",
  viewer: "#9B9B9B",
};

const ROLE_KEY: Record<Role, TranslationKey> = {
  owner: "admin.roleOwner",
  admin: "admin.roleAdmin",
  member: "admin.roleMember",
  viewer: "admin.roleViewer",
};

function roleLabel(role: Role, locale: Locale): string {
  return translate(locale, ROLE_KEY[role]);
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  settings: string;
}

interface Stats {
  memberCount: number;
  radarCount: number;
  scenarioCount: number;
  ratingCount: number;
}

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: Role;
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  target: unknown;
  createdAt: string;
  actor: { id: string; name: string | null; email: string | null } | null;
}

export function TenantDetailClient({ tenantId }: { tenantId: string }) {
  const { t, locale } = useT();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [recentAcceptUrl, setRecentAcceptUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, mRes, aRes] = await Promise.all([
        fetchWithTimeout(`/api/v1/admin/tenants/${tenantId}`),
        fetchWithTimeout(`/api/v1/admin/tenants/${tenantId}/memberships`),
        fetchWithTimeout(`/api/v1/admin/tenants/${tenantId}/audit?limit=20`),
      ]);
      if (!tRes.ok) throw new Error(`tenant HTTP ${tRes.status}`);
      if (!mRes.ok) throw new Error(`memberships HTTP ${mRes.status}`);

      const tJson = await tRes.json();
      const mJson = await mRes.json();
      const tData = tJson?.data ?? tJson;
      const mData = mJson?.data ?? mJson;

      setTenant(tData.tenant);
      setStats(tData.stats);
      setMembers(mData.members as Member[]);
      setInvites(mData.invites as Invite[]);

      // Audit-Log ist nice-to-have — Fehler hier sollen die Hauptansicht
      // nicht kippen. Log-Panel zeigt dann einfach "unavailable".
      if (aRes.ok) {
        const aJson = await aRes.json().catch(() => null);
        const aData = aJson?.data ?? aJson ?? {};
        setAuditEntries((aData.entries ?? []) as AuditEntry[]);
      } else {
        setAuditEntries([]);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (m: Member, newRole: Role) => {
    if (m.role === newRole) return;
    setBusyId(m.id);
    try {
      const res = await fetchWithTimeout(
        `/api/v1/admin/tenants/${tenantId}/memberships/${m.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // Audit A4-H1 (18.04.2026): surface inline instead of alert().
        setError(j?.error?.message ?? t("admin.roleChangeFailed"));
        setTimeout(() => setError(null), 6000);
        return;
      }
      setError(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (m: Member) => {
    const ok = await voltConfirm({
      title: t("admin.removeMemberQ", { email: m.email }),
      message: t("admin.removeMemberBody"),
      confirmLabel: t("common.remove"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(m.id);
    try {
      const res = await fetchWithTimeout(
        `/api/v1/admin/tenants/${tenantId}/memberships/${m.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // Audit A4-H1 (18.04.2026): surface inline instead of alert().
        setError(j?.error?.message ?? t("admin.removeFailed"));
        setTimeout(() => setError(null), 6000);
        return;
      }
      setError(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const revokeInvite = async (inv: Invite) => {
    const ok = await voltConfirm({
      title: t("admin.revokeInviteQ", { email: inv.email }),
      message: t("admin.revokeInviteBody"),
      confirmLabel: t("admin.revokeInvite"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(inv.id);
    try {
      const res = await fetchWithTimeout(
        `/api/v1/admin/tenants/${tenantId}/invites?inviteId=${encodeURIComponent(inv.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        // Audit A4-H1 (18.04.2026): inline error instead of alert().
        setError(t("common.actionFailed"));
        setTimeout(() => setError(null), 6000);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 64px" }}>
        {/* Back */}
        <Link href="/admin/tenants" style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 12, color: "var(--color-text-muted)",
          textDecoration: "none",
          marginBottom: 14,
        }}>
          ← {t("audit.allTenantsLink")}
        </Link>

        {loading && !tenant && <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{t("common.loading")}</div>}
        {error && !tenant && <div style={{ color: "var(--signal-negative, #C0341D)", fontSize: 13 }}>{error}</div>}
        {/* Audit A4-H1 (18.04.2026): action errors (role change, member
             remove, invite revoke) now surface as a sticky banner here
             instead of as a native alert(). The banner auto-clears after
             6s or when the next action succeeds. */}
        {error && tenant && (
          <div
            role="alert"
            style={{
              margin: "8px 0 14px",
              padding: "9px 14px",
              borderRadius: 8,
              border: "1px solid var(--signal-negative, #C0341D)",
              background: "var(--signal-negative-light, #FDEDEA)",
              color: "var(--signal-negative, #C0341D)",
              fontSize: 13,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label={t("common.close")}
              style={{
                border: "none", background: "transparent",
                color: "inherit", cursor: "pointer",
                padding: "0 4px", lineHeight: 1,
              }}
            >✕</button>
          </div>
        )}

        {tenant && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase" as const,
                color: "var(--volt-text-faint, #BBB)",
                marginBottom: 6,
              }}>
                {t("admin.tenantLabel")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 style={{
                  fontSize: 26, fontWeight: 700,
                  fontFamily: "var(--volt-font-display)",
                  color: "var(--color-text-heading)",
                  margin: 0, letterSpacing: "-0.02em",
                }}>
                  {tenant.name}
                </h1>
                <span style={{
                  fontFamily: "var(--volt-font-mono)", fontSize: 12,
                  color: "var(--color-text-muted)",
                  padding: "3px 10px", borderRadius: 6,
                  background: "var(--color-surface-2, #F5F5F5)",
                }}>
                  {tenant.slug}
                </span>
                {tenant.archived_at && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: "3px 10px", borderRadius: 6,
                    background: "var(--pastel-butter, #FFF5BA)",
                    color: "var(--pastel-butter-text, #7A5C00)",
                  }}>
                    {t("common.archived")}
                  </span>
                )}
                {/* Data-Export: DSGVO-kompatibler JSON-Dump eines
                     Mandanten, oft gebraucht vor Archive oder Delete.
                     GET-Link triggert direkten Download (Content-
                     Disposition: attachment). Server schreibt
                     'tenant.exported' als Audit-Entry. */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Audit A4-M3 (18.04.2026): archive / restore /
                       delete controls were only reachable from the
                       list view; admins landing on the detail via
                       audit-log link had no path. */}
                  {!tenant.archived_at && (
                    <button
                      onClick={async () => {
                        const ok = await voltConfirm({
                          title: t("admin.archiveHereQ", { name: tenant.name }),
                          message: t("admin.archiveHereBody"),
                          confirmLabel: t("common.archive"),
                          cancelLabel: t("common.cancel"),
                          variant: "destructive",
                        });
                        if (!ok) return;
                        const res = await fetchWithTimeout(
                          `/api/v1/admin/tenants/${tenantId}/archive`,
                          { method: "POST" },
                        );
                        if (!res.ok) {
                          const j = await res.json().catch(() => null);
                          setError(j?.error?.message ?? t("admin.archiveFailed"));
                          setTimeout(() => setError(null), 6000);
                          return;
                        }
                        await load();
                      }}
                      style={{
                        fontSize: 12, fontWeight: 600,
                        padding: "5px 12px", borderRadius: 6,
                        border: "1px solid var(--color-border)",
                        background: "var(--volt-surface-raised, #fff)",
                        color: "var(--color-text-primary)",
                        cursor: "pointer",
                      }}
                    >{t("common.archive")}</button>
                  )}
                  {tenant.archived_at && (
                    <>
                      <button
                        onClick={async () => {
                          const res = await fetchWithTimeout(
                            `/api/v1/admin/tenants/${tenantId}/archive`,
                            { method: "DELETE" },
                          );
                          if (!res.ok) {
                            const j = await res.json().catch(() => null);
                            setError(j?.error?.message ?? t("admin.restoreTenantFailed"));
                            setTimeout(() => setError(null), 6000);
                            return;
                          }
                          await load();
                        }}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          padding: "5px 12px", borderRadius: 6,
                          border: "1px solid var(--color-border)",
                          background: "var(--volt-surface-raised, #fff)",
                          color: "var(--color-text-primary)",
                          cursor: "pointer",
                        }}
                      >{t("admin.restoreTenant")}</button>
                      <button
                        onClick={async () => {
                          const ok = await voltConfirm({
                            title: t("admin.deleteHereQ", { name: tenant.name }),
                            message: t("admin.deleteHereBody"),
                            confirmLabel: t("admin.deletePermanent"),
                            cancelLabel: t("common.cancel"),
                            variant: "destructive",
                          });
                          if (!ok) return;
                          const res = await fetchWithTimeout(
                            `/api/v1/admin/tenants/${tenantId}`,
                            { method: "DELETE" },
                          );
                          if (!res.ok) {
                            const j = await res.json().catch(() => null);
                            setError(j?.error?.message ?? t("admin.deleteFailed"));
                            setTimeout(() => setError(null), 6000);
                            return;
                          }
                          window.location.href = "/admin/tenants";
                        }}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          padding: "5px 12px", borderRadius: 6,
                          border: "1px solid var(--signal-negative, #C0341D)",
                          background: "var(--signal-negative-light, #FDEDEA)",
                          color: "var(--signal-negative, #C0341D)",
                          cursor: "pointer",
                        }}
                      >{t("common.delete")}</button>
                    </>
                  )}
                  <a
                    href={`/api/v1/admin/tenants/${tenantId}/export`}
                    style={{
                      fontSize: 12, fontWeight: 600,
                      padding: "5px 12px", borderRadius: 6,
                      border: "1px solid var(--color-border)",
                      background: "var(--volt-surface-raised, #fff)",
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                    }}
                    title={t("admin.exportJsonTip")}
                  >
                    ↓ {t("admin.exportJson")}
                  </a>
                </div>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
                <Stat label={t("admin.memberCount")} value={stats.memberCount} />
                <Stat label={t("admin.projects")} value={stats.radarCount} />
                <Stat label={t("admin.scenarios")} value={stats.scenarioCount} />
                <Stat label={t("admin.ratings")} value={stats.ratingCount} />
              </div>
            )}

            {/* Members section */}
            <section style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-heading)", margin: 0 }}>
                  {t("admin.membersSection")}
                </h2>
                <button
                  onClick={() => setInviteOpen(true)}
                  style={{
                    fontSize: 12, fontWeight: 600,
                    padding: "7px 14px", borderRadius: 8,
                    background: "var(--volt-lime, #E4FF97)",
                    color: "var(--volt-text, #0A0A0A)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    cursor: "pointer",
                    fontFamily: "var(--volt-font-ui)",
                  }}
                >
                  + {t("admin.inviteMember")}
                </button>
              </div>
              <div style={{
                border: "1px solid var(--color-border)",
                borderRadius: 12, overflow: "hidden",
                background: "var(--volt-surface-raised, #fff)",
              }}>
                <TableHeader cols={[
                  t("admin.memberNameEmail"),
                  t("admin.roleColumn"),
                  t("admin.memberSince"),
                  t("common.actions"),
                ]} />
                {members.map(m => (
                  <div key={m.id} style={rowStyle(false)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {m.name ?? m.email}
                      </span>
                      {m.name && (
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{m.email}</span>
                      )}
                    </div>
                    <select
                      value={m.role}
                      disabled={busyId === m.id}
                      onChange={e => changeRole(m, e.target.value as Role)}
                      style={{
                        fontSize: 12, fontWeight: 600,
                        padding: "4px 8px", borderRadius: 6,
                        border: "1px solid var(--color-border)",
                        background: "var(--volt-surface, #fff)",
                        color: ROLE_COLOR[m.role],
                        fontFamily: "var(--volt-font-ui)",
                        cursor: busyId === m.id ? "wait" : "pointer",
                        width: 120,
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r, locale)}</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      {new Date(m.joined_at).toLocaleDateString(localeTag(locale), { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                    <span style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => removeMember(m)}
                        disabled={busyId === m.id}
                        style={{
                          fontSize: 11, padding: "4px 10px", borderRadius: 6,
                          border: "1px solid var(--signal-negative-border, #F5BDB4)",
                          background: "var(--signal-negative-light, #FDEEE9)",
                          color: "var(--signal-negative-text, #C0341D)",
                          cursor: busyId === m.id ? "wait" : "pointer",
                          fontFamily: "var(--volt-font-ui)",
                        }}
                      >
                        {t("common.remove")}
                      </button>
                    </span>
                  </div>
                ))}
                {members.length === 0 && (
                  <div style={{ padding: "18px 16px", fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                    {t("admin.noMembers")}
                  </div>
                )}
              </div>
            </section>

            {/* Invites section */}
            {invites.length > 0 && (
              <section>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)", margin: "0 0 10px" }}>
                  {t("admin.pendingInvites")}
                </h2>
                <div style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 12, overflow: "hidden",
                  background: "var(--volt-surface-raised, #fff)",
                }}>
                  <TableHeader cols={[
                    t("common.email"),
                    t("admin.roleColumn"),
                    t("admin.expiresColumn"),
                    t("common.actions"),
                  ]} />
                  {invites.map(inv => (
                    <div key={inv.id} style={rowStyle(true)}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{inv.email}</span>
                      <span style={{ fontSize: 12, color: ROLE_COLOR[inv.role], fontWeight: 600 }}>
                        {roleLabel(inv.role, locale)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                        {new Date(inv.expires_at).toLocaleDateString(localeTag(locale), { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <span style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        {/* Audit A4-M4 (18.04.2026): Resend action.
                             Previously admins had to revoke + re-invite
                             to nudge an unresponsive invitee. Now we
                             POST a fresh invite with the same email /
                             role; the old invite row gets replaced. */}
                        <button
                          onClick={async () => {
                            setBusyId(inv.id);
                            try {
                              const res = await fetchWithTimeout(
                                `/api/v1/admin/tenants/${tenantId}/invites`,
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ email: inv.email, role: inv.role }),
                                },
                              );
                              if (!res.ok) {
                                const j = await res.json().catch(() => null);
                                setError(j?.error?.message ?? t("admin.resendFailed"));
                                setTimeout(() => setError(null), 6000);
                                return;
                              }
                              await load();
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === inv.id}
                          style={{
                            fontSize: 11, padding: "4px 10px", borderRadius: 6,
                            border: "1px solid var(--color-border)",
                            background: "transparent",
                            cursor: busyId === inv.id ? "wait" : "pointer",
                            fontFamily: "var(--volt-font-ui)",
                          }}
                        >
                          {t("admin.resendAction")}
                        </button>
                        <button
                          onClick={() => revokeInvite(inv)}
                          disabled={busyId === inv.id}
                          style={{
                            fontSize: 11, padding: "4px 10px", borderRadius: 6,
                            border: "1px solid var(--color-border)",
                            background: "transparent",
                            cursor: busyId === inv.id ? "wait" : "pointer",
                            fontFamily: "var(--volt-font-ui)",
                          }}
                        >
                          {t("admin.revokeInvite")}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Audit-Log: letzte 20 administrative Aktionen in diesem
                 Tenant (Tenant-Create, Member-Add/Remove, Rolle-Change,
                 Invite-Sent/Revoked/Accepted, Archive/Restore). Ein
                 voller Viewer mit Filtern + Pagination ist spaeter
                 geplant; hier reicht der Preview fuer die haeufigste
                 Admin-Frage "was hat wer wann in dieser Orga geaendert?". */}
            {auditEntries.length > 0 && (
              <section style={{ marginTop: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)", margin: "0 0 10px" }}>
                  {t("admin.activitySection")}
                </h2>
                <div style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 12, overflow: "hidden",
                  background: "var(--volt-surface-raised, #fff)",
                }}>
                  {auditEntries.map((entry, i) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "160px 1fr 160px",
                        gap: 14,
                        padding: "10px 14px",
                        borderBottom: i < auditEntries.length - 1 ? "1px solid var(--color-border)" : "none",
                        alignItems: "start",
                        fontSize: 12,
                      }}
                    >
                      <span style={{
                        fontFamily: "var(--volt-font-mono)", fontSize: 10,
                        fontWeight: 700, letterSpacing: "0.04em",
                        color: actionColor(entry.action),
                        textTransform: "uppercase" as const,
                      }}>
                        {entry.action}
                      </span>
                      <span style={{ color: "var(--color-text-primary)", lineHeight: 1.5 }}>
                        {renderAuditDetail(entry, locale)}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)", textAlign: "right" as const, fontFamily: "var(--volt-font-mono)" }}>
                        {new Date(entry.createdAt).toLocaleString(localeTag(locale), {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                        {entry.actor?.email && (
                          <>
                            <br />
                            <span style={{ color: "var(--color-text-faint, #AAA)" }}>
                              {entry.actor.name ?? entry.actor.email}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {recentAcceptUrl && (
              <div style={{
                marginTop: 18, padding: "12px 14px",
                background: "var(--pastel-sky, #D4E8FF)",
                border: "1px solid var(--pastel-sky-border, #9ABFEE)",
                borderRadius: 10,
                fontSize: 12, lineHeight: 1.5,
                color: "var(--pastel-sky-text, #1A4A8A)",
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {t("admin.inviteCreatedShareLink")}
                </div>
                <code style={{
                  display: "block", fontFamily: "var(--volt-font-mono)",
                  fontSize: 11, padding: "6px 8px",
                  background: "#fff", borderRadius: 6,
                  wordBreak: "break-all",
                }}>
                  {recentAcceptUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(recentAcceptUrl).catch(() => {});
                  }}
                  style={{
                    marginTop: 6, fontSize: 11, fontWeight: 600,
                    padding: "3px 10px", borderRadius: 6,
                    border: "1px solid var(--pastel-sky-border, #9ABFEE)",
                    background: "transparent",
                    color: "var(--pastel-sky-text)",
                    cursor: "pointer",
                  }}
                >
                  {t("common.copy")}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {inviteOpen && tenant && (
        <InviteModal
          tenantId={tenantId}
          onClose={() => setInviteOpen(false)}
          onDone={async (result) => {
            setInviteOpen(false);
            if (result.kind === "invite" && result.acceptPath) {
              setRecentAcceptUrl(`${window.location.origin}${result.acceptPath}`);
            } else {
              setRecentAcceptUrl(null);
            }
            await load();
          }}
          locale={locale}
        />
      )}
    </div>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 140px 140px 180px",
      gap: 12,
      padding: "10px 16px",
      borderBottom: "1px solid var(--color-border)",
      fontFamily: "var(--volt-font-mono)",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: "var(--volt-text-faint, #BBB)",
    }}>
      {cols.map((c, i) => (
        <span key={i} style={{ textAlign: i === cols.length - 1 ? "right" as const : "left" as const }}>{c}</span>
      ))}
    </div>
  );
}

function rowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "2fr 140px 140px 180px",
    gap: 12,
    padding: "12px 16px",
    borderBottom: isLast ? "none" : "1px solid var(--color-border)",
    alignItems: "center",
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 12px", borderRadius: 999,
      border: "1px solid var(--color-border)",
      background: "var(--volt-surface-raised, #fff)",
      fontFamily: "var(--volt-font-mono, monospace)", fontSize: 11,
    }}>
      <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{value}</span>
      <span style={{ color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>{label}</span>
    </span>
  );
}

interface InviteResult {
  kind: "direct" | "invite";
  acceptPath?: string;
}

function InviteModal({ tenantId, onClose, onDone, locale }: {
  tenantId: string;
  onClose: () => void;
  onDone: (r: InviteResult) => void;
  locale: Locale;
}) {
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/v1/admin/tenants/${tenantId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      onDone({
        kind: json.data?.kind ?? "direct",
        acceptPath: json.data?.acceptPath,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <VoltModal
      open
      onClose={onClose}
      title={tl("admin.inviteMember")}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={btnSecondary}>
            {tl("common.cancel")}
          </button>
          <button onClick={submit} disabled={saving || !email.trim()} style={btnPrimary(saving, email.trim().length === 0)}>
            {saving ? tl("admin.inviteSending") : tl("admin.inviteSubmit")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>{tl("common.email")}</span>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            style={inputStyle} autoFocus
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>{tl("admin.roleColumn")}</span>
          <select
            value={role}
            onChange={e => setRole(e.target.value as Role)}
            style={inputStyle}
          >
            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r, locale)}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {tl("admin.inviteModalHint")}
          </span>
        </label>
        {error && <div style={{ fontSize: 12, color: "var(--signal-negative, #C0341D)", padding: "6px 10px", borderRadius: 6, background: "var(--signal-negative-light)" }}>{error}</div>}
      </div>
    </VoltModal>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "var(--volt-font-ui)",
  outline: "none",
  background: "var(--volt-surface, #fff)",
  color: "var(--color-text-primary)",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "var(--color-text-muted)",
};

const btnSecondary: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, padding: "7px 16px",
  borderRadius: 8, border: "1px solid var(--color-border)",
  background: "transparent", color: "var(--color-text-primary)", cursor: "pointer",
};

function btnPrimary(saving: boolean, disabled: boolean): React.CSSProperties {
  return {
    fontSize: 13, fontWeight: 600, padding: "7px 16px",
    borderRadius: 8, border: "none",
    background: "#0A0A0A", color: "#fff",
    cursor: saving ? "wait" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

/**
 * Audit-Aktions-Farbe: destruktive Aktionen rot, neutrale grau,
 * create/accept gruen. Der Set der Aktionen ist klein genug, um die
 * Zuordnung fest zu halten (statt regex auf Suffixe).
 */
function actionColor(action: string): string {
  if (action.endsWith(".removed") || action.endsWith(".deleted") || action.endsWith(".revoked") || action.endsWith(".archived")) {
    return "#C0341D";
  }
  if (action.endsWith(".created") || action.endsWith(".added") || action.endsWith(".accepted") || action.endsWith(".restored")) {
    return "#0F6038";
  }
  if (action.endsWith(".sent")) return "#1A4A8A";
  if (action.endsWith(".changed") || action.endsWith(".updated")) return "#7A5C00";
  return "#6B6B6B";
}

/**
 * Rendert die Audit-Zeile in lesbarem Deutsch/Englisch. Die `target`-
 * Payload variiert je nach action; wir formatieren die bekannten Felder
 * inline und fallen bei unbekannten Actions auf JSON-Preview zurueck.
 *
 * 2026-04-18: shares wording with `/admin/audit`'s renderer via the
 * `audit.*` namespace so both views stay in sync automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderAuditDetail(entry: { action: string; target: any; actor: { name: string | null; email: string | null } | null }, locale: Locale): React.ReactNode {
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
      // Unbekannte Action: knapp JSON-Preview, damit wenigstens die
      // rohe Info sichtbar ist statt eine leere Zeile.
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
