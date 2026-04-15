/**
 * /admin — system-admin landing.
 *
 * Tiny dashboard that aggregates the numbers that already live in the
 * admin sub-routes, plus direct deep-links into them. Intentionally not
 * a data-heavy view — it's a navigation hub + health snapshot:
 *
 *   - Active tenants count + most-recent tenant
 *   - Open invites (pending, not expired)
 *   - Audit-entries in the last 24h
 *   - Quick links: /admin/tenants, /admin/audit, /monitor
 *
 * Gatekeeper: users.role === "admin"; dev-mode open (consistent with
 * the other /admin/* pages).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { getSqliteHandle } from "@/db";

export const dynamic = "force-dynamic";

interface AdminStats {
  tenantCountTotal: number;
  tenantCountActive: number;
  membershipCount: number;
  openInvites: number;
  auditLast24h: number;
  recentTenant: { id: string; name: string; slug: string; created_at: string } | null;
}

function loadStats(): AdminStats {
  try {
    const d = getSqliteHandle();
    const tenantTotal = d.prepare("SELECT COUNT(*) AS n FROM tenants").get() as { n: number };
    const tenantActive = d.prepare("SELECT COUNT(*) AS n FROM tenants WHERE archived_at IS NULL").get() as { n: number };
    const memberships = d.prepare("SELECT COUNT(*) AS n FROM tenant_memberships").get() as { n: number };
    const invites = d.prepare(
      "SELECT COUNT(*) AS n FROM tenant_invites WHERE accepted_at IS NULL AND expires_at > datetime('now')",
    ).get() as { n: number };
    const audit = d.prepare(
      "SELECT COUNT(*) AS n FROM tenant_audit_log WHERE created_at > datetime('now', '-1 day')",
    ).get() as { n: number };
    const recent = d.prepare(
      "SELECT id, name, slug, created_at FROM tenants WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 1",
    ).get() as AdminStats["recentTenant"];
    return {
      tenantCountTotal: tenantTotal.n,
      tenantCountActive: tenantActive.n,
      membershipCount: memberships.n,
      openInvites: invites.n,
      auditLast24h: audit.n,
      recentTenant: recent ?? null,
    };
  } catch {
    return {
      tenantCountTotal: 0,
      tenantCountActive: 0,
      membershipCount: 0,
      openInvites: 0,
      auditLast24h: 0,
      recentTenant: null,
    };
  }
}

export default async function AdminLanding() {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();
    if (!session?.user) redirect("/auth/signin?callbackUrl=/admin");
    if ((session.user as { role?: string }).role !== "admin") redirect("/");
  }
  const stats = loadStats();

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--volt-text-faint, #BBB)",
            marginBottom: 6,
          }}>
            System admin
          </div>
          <h1 style={{
            fontSize: 30, fontWeight: 700,
            fontFamily: "var(--volt-font-display)",
            color: "var(--color-text-heading)",
            margin: 0, letterSpacing: "-0.02em",
          }}>
            Admin
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 560 }}>
            Uebersicht ueber Mandanten, Einladungen, Aktivitaet. Einstieg in die System-Admin-Tools.
          </p>
        </div>

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
          <Kpi label="Mandanten aktiv" value={stats.tenantCountActive} secondary={`${stats.tenantCountTotal} gesamt`} />
          <Kpi label="Mitgliedschaften" value={stats.membershipCount} />
          <Kpi label="Offene Einladungen" value={stats.openInvites} accent={stats.openInvites > 0 ? "#1A4A8A" : undefined} />
          <Kpi label="Aktivitaet (24h)" value={stats.auditLast24h} accent={stats.auditLast24h > 0 ? "#0F6038" : undefined} />
        </div>

        {/* Section grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <AdminCard
            href="/admin/tenants"
            title="Mandanten"
            body="Anlegen, umbenennen, archivieren. Mitglieder + Einladungen pro Mandant."
            cta="Liste oeffnen →"
          />
          <AdminCard
            href="/admin/audit"
            title="Aktivitaetsprotokoll"
            body="Jede administrative Aktion ueber alle Mandanten. Filter nach Mandant, Aktion oder Akteur."
            cta="Log oeffnen →"
          />
          <AdminCard
            href="/monitor"
            title="Monitor"
            body="Pipeline-Status, Datenquellen-Gesundheit, Aktivitaets-Log der Signal-Kette."
            cta="Monitor oeffnen →"
          />
        </div>

        {/* Recent tenant hint */}
        {stats.recentTenant && (
          <div style={{
            marginTop: 22, padding: "14px 16px",
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            fontSize: 12, color: "var(--color-text-muted)",
          }}>
            Zuletzt angelegt:{" "}
            <Link
              href={`/admin/tenants/${stats.recentTenant.id}`}
              style={{ color: "var(--color-text-primary)", fontWeight: 600, textDecoration: "none" }}
            >
              {stats.recentTenant.name}
            </Link>
            <span style={{ marginLeft: 8, fontFamily: "var(--volt-font-mono, monospace)", fontSize: 10, color: "var(--color-text-faint, #AAA)" }}>
              {stats.recentTenant.slug}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, secondary, accent }: { label: string; value: number; secondary?: string; accent?: string }) {
  return (
    <div style={{
      background: "var(--volt-surface-raised, #fff)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{
        fontFamily: "var(--volt-font-mono, monospace)", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase" as const,
        color: "var(--color-text-muted)",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700, marginTop: 4,
        color: accent ?? "var(--color-text-heading)",
        fontFamily: "var(--volt-font-display, sans-serif)",
      }}>
        {value}
      </div>
      {secondary && (
        <div style={{ fontSize: 11, color: "var(--color-text-faint, #AAA)", marginTop: 2 }}>{secondary}</div>
      )}
    </div>
  );
}

function AdminCard({ href, title, body, cta }: { href: string; title: string; body: string; cta: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "16px 18px",
        background: "var(--volt-surface-raised, #fff)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        textDecoration: "none",
        color: "var(--color-text-primary)",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.55, marginBottom: 10 }}>{body}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-heading)" }}>{cta}</div>
    </Link>
  );
}
