"use client";

/**
 * Client-Komponente fuer /admin/tenants.
 *
 * Zeigt eine Tabelle aller Tenants mit Stats (Mitglieder, Projekte,
 * Erstellungsdatum, Archiv-Status) + "+ Neuer Mandant"-Button.
 * Pro Zeile: Bearbeiten (Modal), Archivieren/Restore, Loeschen-hart
 * (nur wenn archiviert, mit VoltConfirm als destructive).
 *
 * Design: bewusst schlicht — gleiche Volt-Stil-Regeln wie /monitor
 * (Tabellen mit duennen Borders, Stat-Pills im Header), damit sich
 * die System-Admin-Sektion wie eine natuerliche Erweiterung
 * anfuehlt und nicht wie ein separates Admin-Panel-Produkt.
 *
 * 2026-04-18 audit A5-H9: migrated from `de ? ... : ...` ternaries to
 * `useT()` with the `admin.*` / `common.*` / `nav.*` namespaces.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { localeTag, t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { VoltModal, voltConfirm } from "@/components/volt";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  radar_count: number;
}

export function TenantsClient() {
  const { t, locale } = useT();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /*
    Notion-Plan HIGH-H10 (#18): Aktions-Fehler als Inline-Banner statt
    blockierende browser-alerts. Verhalten: verschwindet nach 6s oder
    bei nächster erfolgreicher Aktion.
  */
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/v1/admin/tenants");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = (json?.data?.tenants ?? json?.tenants ?? []) as Tenant[];
      setTenants(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const onArchive = async (tenant: Tenant) => {
    const archive = !tenant.archived_at;
    const titleKey: TranslationKey = archive ? "admin.archiveTenantQ" : "admin.restoreTenantQ";
    const bodyKey: TranslationKey = archive ? "admin.archiveTenantBody" : "admin.restoreTenantBody";
    const confirmKey: TranslationKey = archive ? "common.archive" : "common.restore";
    const ok = await voltConfirm({
      title: t(titleKey, { name: tenant.name }),
      message: t(bodyKey),
      confirmLabel: t(confirmKey),
      cancelLabel: t("common.cancel"),
      variant: archive ? "destructive" : "default",
    });
    if (!ok) return;
    setBusyId(tenant.id);
    try {
      const res = await fetchWithTimeout(`/api/v1/admin/tenants/${tenant.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setActionError(t("common.actionFailed"));
      setTimeout(() => setActionError(null), 6000);
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (tenant: Tenant) => {
    if (!tenant.archived_at) {
      setActionError(t("admin.archiveBeforeDelete"));
      setTimeout(() => setActionError(null), 6000);
      return;
    }
    const ok = await voltConfirm({
      title: t("admin.deleteTenantQ", { name: tenant.name }),
      message: t("admin.deleteTenantBody"),
      confirmLabel: t("admin.deletePermanent"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(tenant.id);
    try {
      const res = await fetchWithTimeout(`/api/v1/admin/tenants/${tenant.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setActionError(t("admin.deleteFailed"));
      setTimeout(() => setActionError(null), 6000);
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const active = tenants.filter(tn => !tn.archived_at);
  const archived = tenants.filter(tn => tn.archived_at);

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Kopfzeile */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--volt-text-faint, #BBB)", marginBottom: 6 }}>
              {t("nav.systemAdmin")}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--volt-font-display)", color: "var(--color-text-heading)", margin: 0, letterSpacing: "-0.02em" }}>
              {t("admin.tenantsTitle")}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 640 }}>
              {t("admin.tenantsSubtitle")}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 13, fontWeight: 600,
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--volt-lime, #E4FF97)",
              color: "var(--volt-text, #0A0A0A)",
              border: "1px solid rgba(0,0,0,0.08)",
              cursor: "pointer",
            }}
          >
            + {t("admin.newTenant")}
          </button>
        </div>

        {/* Stat-Pills */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, fontFamily: "var(--volt-font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>
          <StatPill label={t("common.active")} value={active.length} color="#0F6038" />
          <StatPill label={t("common.archived")} value={archived.length} color="#9B9B9B" />
          <StatPill label={t("common.total")} value={tenants.length} color="#1A4A8A" />
        </div>

        {loading && <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{t("common.loading")}</div>}
        {error && <div style={{ color: "var(--signal-negative, #C0341D)", fontSize: 13 }}>{error}</div>}
        {/* Notion-Plan HIGH-H10: Inline-Fehler für Aktions-Failures statt alert(). */}
        {actionError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              marginBottom: 12,
              borderRadius: 8,
              background: "var(--signal-negative-light, rgba(192, 52, 29, 0.1))",
              border: "1px solid var(--signal-negative-border, rgba(192, 52, 29, 0.35))",
              color: "var(--signal-negative, #C0341D)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              aria-label={t("common.close")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--signal-negative, #C0341D)",
                fontSize: 16,
                fontWeight: 700,
                padding: "0 6px",
              }}
            >
              ×
            </button>
          </div>
        )}

        {!loading && tenants.length === 0 && (
          <div style={{
            padding: "32px 24px",
            border: "1px dashed var(--color-border)",
            borderRadius: 12,
            color: "var(--color-text-muted)",
            fontSize: 13,
            textAlign: "center",
          }}>
            {t("admin.noTenants")}
          </div>
        )}

        {/* Aktive Tenants */}
        {active.length > 0 && (
          <TenantsTable
            title={t("common.active")}
            rows={active}
            busyId={busyId}
            onEdit={setEditing}
            onArchive={onArchive}
            onDelete={onDelete}
            locale={locale}
          />
        )}

        {/* Archivierte Tenants */}
        {archived.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <TenantsTable
              title={t("common.archived")}
              rows={archived}
              busyId={busyId}
              onEdit={setEditing}
              onArchive={onArchive}
              onDelete={onDelete}
              locale={locale}
            />
          </div>
        )}
      </main>

      {createOpen && (
        <CreateTenantModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => { setCreateOpen(false); await load(); }}
          locale={locale}
        />
      )}

      {editing && (
        <EditTenantModal
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
          locale={locale}
        />
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      border: "1px solid var(--color-border)",
      background: "var(--volt-surface-raised, #fff)",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{value}</span>
      <span style={{ color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>{label}</span>
    </span>
  );
}

function TenantsTable({ title, rows, busyId, onEdit, onArchive, onDelete, locale }: {
  title: string;
  rows: Tenant[];
  busyId: string | null;
  onEdit: (tn: Tenant) => void;
  onArchive: (tn: Tenant) => void;
  onDelete: (tn: Tenant) => void;
  locale: Locale;
}) {
  // Sub-component doesn't use the hook (to keep it a pure render fn
  // easy to reuse in Storybook later). It translates via the bare
  // `translate()` with the forwarded locale instead.
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  return (
    <section>
      <div style={{
        fontFamily: "var(--volt-font-mono)",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
        color: "var(--volt-text-faint, #BBB)",
        marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--volt-surface-raised, #fff)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 2fr) 1fr 80px 80px 140px 180px",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--color-border)",
          fontFamily: "var(--volt-font-mono)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--volt-text-faint, #BBB)",
        }}>
          <span>{tl("common.name")}</span>
          <span>{tl("admin.tenantSlug")}</span>
          <span style={{ textAlign: "right" }}>{tl("admin.membersShort")}</span>
          <span style={{ textAlign: "right" }}>{tl("admin.projects")}</span>
          <span>{tl("common.created")}</span>
          <span style={{ textAlign: "right" }}>{tl("common.actions")}</span>
        </div>
        {rows.map(tn => (
          <div key={tn.id} style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 2fr) 1fr 80px 80px 140px 180px",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
            alignItems: "center",
            fontSize: 13,
            color: "var(--color-text-primary)",
            opacity: tn.archived_at ? 0.6 : 1,
          }}>
            <Link
              href={`/admin/tenants/${tn.id}`}
              style={{
                fontWeight: 600,
                color: "var(--color-text-primary)",
                textDecoration: "none",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--volt-lime-dark, #5A8B1F)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)"; }}
            >
              {tn.name}
            </Link>
            <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{tn.slug}</span>
            <span style={{ textAlign: "right", fontFamily: "var(--volt-font-mono)", fontSize: 12 }}>{tn.member_count}</span>
            <span style={{ textAlign: "right", fontFamily: "var(--volt-font-mono)", fontSize: 12 }}>{tn.radar_count}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {new Date(tn.created_at).toLocaleDateString(localeTag(locale), { year: "numeric", month: "short", day: "numeric" })}
            </span>
            <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={() => onEdit(tn)}
                disabled={busyId === tn.id}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: busyId === tn.id ? "wait" : "pointer",
                  fontFamily: "var(--volt-font-ui)",
                }}
              >
                {tl("common.edit")}
              </button>
              <button
                onClick={() => onArchive(tn)}
                disabled={busyId === tn.id}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: busyId === tn.id ? "wait" : "pointer",
                  fontFamily: "var(--volt-font-ui)",
                }}
              >
                {tn.archived_at ? tl("common.restore") : tl("common.archive")}
              </button>
              {tn.archived_at && (
                <button
                  onClick={() => onDelete(tn)}
                  disabled={busyId === tn.id}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--signal-negative-border, #F5BDB4)",
                    background: "var(--signal-negative-light, #FDEEE9)",
                    color: "var(--signal-negative-text, #C0341D)",
                    cursor: busyId === tn.id ? "wait" : "pointer",
                    fontFamily: "var(--volt-font-ui)",
                  }}
                >
                  {tl("common.delete")}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function CreateTenantModal({ onClose, onCreated, locale }: { onClose: () => void; onCreated: () => void; locale: Locale }) {
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: (slug || slugify(name)).trim(),
          ownerEmail: ownerEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`);
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const effectiveSlug = slugEdited ? slug : slugify(name);

  return (
    <VoltModal
      open
      onClose={onClose}
      title={tl("admin.newTenant")}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            {tl("common.cancel")}
          </button>
          <button onClick={onSubmit} disabled={saving || !name.trim()} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "#0A0A0A", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: !name.trim() ? 0.4 : 1 }}>
            {saving ? tl("admin.saving") : tl("common.create")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={tl("common.name")}>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={tl("admin.tenantNamePlaceholder")}
            style={inputStyle} autoFocus
          />
        </Field>
        <Field label={tl("admin.tenantSlug")}>
          <input
            type="text"
            value={slugEdited ? slug : effectiveSlug}
            onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
            placeholder="mercedes-strategie"
            style={{ ...inputStyle, fontFamily: "var(--volt-font-mono)" }}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
            {tl("admin.tenantSlugHint")}
          </div>
        </Field>
        <Field label={tl("admin.ownerEmailLabel")}>
          <input
            type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
            placeholder="lead@example.com"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
            {tl("admin.ownerEmailHint")}
          </div>
        </Field>
        {error && <div style={{ fontSize: 12, color: "var(--signal-negative, #C0341D)", padding: "6px 10px", borderRadius: 6, background: "var(--signal-negative-light)" }}>{error}</div>}
      </div>
    </VoltModal>
  );
}

function EditTenantModal({ tenant, onClose, onSaved, locale }: { tenant: Tenant; onClose: () => void; onSaved: () => void; locale: Locale }) {
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/v1/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`);
      }
      onSaved();
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
      title={tl("admin.editTenant")}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            {tl("common.cancel")}
          </button>
          <button onClick={onSubmit} disabled={saving} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "#0A0A0A", color: "#fff", cursor: saving ? "wait" : "pointer" }}>
            {saving ? tl("admin.saving") : tl("common.save")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={tl("common.name")}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoFocus />
        </Field>
        <Field label={tl("admin.tenantSlug")}>
          <input type="text" value={slug} onChange={e => setSlug(e.target.value)} style={{ ...inputStyle, fontFamily: "var(--volt-font-mono)" }} />
        </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
