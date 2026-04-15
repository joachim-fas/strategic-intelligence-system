"use client";

/**
 * Client-Komponente fuer /admin/mandanten.
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
 */

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
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

export function MandantenClient() {
  const { locale } = useLocale();
  const de = locale === "de";
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const onArchive = async (t: Tenant) => {
    const archive = !t.archived_at;
    const ok = await voltConfirm({
      title: archive
        ? (de ? `Mandant „${t.name}" archivieren?` : `Archive tenant "${t.name}"?`)
        : (de ? `Mandant „${t.name}" wiederherstellen?` : `Restore tenant "${t.name}"?`),
      message: archive
        ? (de
          ? "Archivierte Mandanten verschwinden aus dem Switcher, bleiben aber auslesbar. Kein Datenverlust."
          : "Archived tenants disappear from the switcher but stay readable. No data loss.")
        : (de
          ? "Der Mandant wird wieder als aktiv markiert und ist im Switcher sichtbar."
          : "The tenant becomes active again and reappears in the switcher."),
      confirmLabel: archive ? (de ? "Archivieren" : "Archive") : (de ? "Wiederherstellen" : "Restore"),
      cancelLabel: de ? "Abbrechen" : "Cancel",
      variant: archive ? "destructive" : "default",
    });
    if (!ok) return;
    setBusyId(t.id);
    try {
      const res = await fetchWithTimeout(`/api/v1/admin/tenants/${t.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      alert(de ? "Aktion fehlgeschlagen." : "Action failed.");
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (t: Tenant) => {
    if (!t.archived_at) {
      alert(de
        ? "Mandant muss zuerst archiviert werden, bevor er dauerhaft geloescht werden kann."
        : "Tenant must be archived before permanent deletion.");
      return;
    }
    const ok = await voltConfirm({
      title: de ? `„${t.name}" endgueltig loeschen?` : `Permanently delete "${t.name}"?`,
      message: de
        ? `Alle Projekte, Szenarien und Mitgliedschaften dieses Mandanten werden unwiderruflich entfernt.\nDiese Aktion kann nicht rueckgaengig gemacht werden.`
        : `All projects, scenarios and memberships of this tenant will be deleted irreversibly.\nThis action cannot be undone.`,
      confirmLabel: de ? "Endgueltig loeschen" : "Delete permanently",
      cancelLabel: de ? "Abbrechen" : "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(t.id);
    try {
      const res = await fetchWithTimeout(`/api/v1/admin/tenants/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      alert(de ? "Loeschen fehlgeschlagen." : "Deletion failed.");
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const active = tenants.filter(t => !t.archived_at);
  const archived = tenants.filter(t => t.archived_at);

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Kopfzeile */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)", fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--volt-text-faint, #BBB)", marginBottom: 6 }}>
              {de ? "System-Admin" : "System admin"}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--volt-font-display)", color: "var(--color-text-heading)", margin: 0, letterSpacing: "-0.02em" }}>
              {de ? "Mandanten" : "Tenants"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 640 }}>
              {de
                ? "Alle Organisationen im System. Mitglieder, Rollen und Einladungen werden pro Mandant verwaltet — siehe Detail-Ansicht."
                : "All organizations in the system. Members, roles, and invites are managed per-tenant — see detail view."}
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
            + {de ? "Neuer Mandant" : "New tenant"}
          </button>
        </div>

        {/* Stat-Pills */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, fontFamily: "var(--volt-font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>
          <StatPill label={de ? "Aktiv" : "Active"} value={active.length} color="#0F6038" />
          <StatPill label={de ? "Archiviert" : "Archived"} value={archived.length} color="#9B9B9B" />
          <StatPill label={de ? "Gesamt" : "Total"} value={tenants.length} color="#1A4A8A" />
        </div>

        {loading && <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{de ? "Lade…" : "Loading…"}</div>}
        {error && <div style={{ color: "var(--signal-negative, #C0341D)", fontSize: 13 }}>{error}</div>}

        {!loading && tenants.length === 0 && (
          <div style={{
            padding: "32px 24px",
            border: "1px dashed var(--color-border)",
            borderRadius: 12,
            color: "var(--color-text-muted)",
            fontSize: 13,
            textAlign: "center",
          }}>
            {de ? "Noch keine Mandanten angelegt." : "No tenants yet."}
          </div>
        )}

        {/* Aktive Tenants */}
        {active.length > 0 && (
          <TenantsTable
            title={de ? "Aktiv" : "Active"}
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
              title={de ? "Archiviert" : "Archived"}
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
  onEdit: (t: Tenant) => void;
  onArchive: (t: Tenant) => void;
  onDelete: (t: Tenant) => void;
  locale: "de" | "en";
}) {
  const de = locale === "de";
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
          <span>{de ? "Name" : "Name"}</span>
          <span>Slug</span>
          <span style={{ textAlign: "right" }}>{de ? "Mitgl." : "Members"}</span>
          <span style={{ textAlign: "right" }}>{de ? "Projekte" : "Projects"}</span>
          <span>{de ? "Erstellt" : "Created"}</span>
          <span style={{ textAlign: "right" }}>{de ? "Aktionen" : "Actions"}</span>
        </div>
        {rows.map(t => (
          <div key={t.id} style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 2fr) 1fr 80px 80px 140px 180px",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
            alignItems: "center",
            fontSize: 13,
            color: "var(--color-text-primary)",
            opacity: t.archived_at ? 0.6 : 1,
          }}>
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span style={{ fontFamily: "var(--volt-font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{t.slug}</span>
            <span style={{ textAlign: "right", fontFamily: "var(--volt-font-mono)", fontSize: 12 }}>{t.member_count}</span>
            <span style={{ textAlign: "right", fontFamily: "var(--volt-font-mono)", fontSize: 12 }}>{t.radar_count}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {new Date(t.created_at).toLocaleDateString(de ? "de-DE" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
            </span>
            <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={() => onEdit(t)}
                disabled={busyId === t.id}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: busyId === t.id ? "wait" : "pointer",
                  fontFamily: "var(--volt-font-ui)",
                }}
              >
                {de ? "Bearbeiten" : "Edit"}
              </button>
              <button
                onClick={() => onArchive(t)}
                disabled={busyId === t.id}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: busyId === t.id ? "wait" : "pointer",
                  fontFamily: "var(--volt-font-ui)",
                }}
              >
                {t.archived_at
                  ? (de ? "Wiederherstellen" : "Restore")
                  : (de ? "Archivieren" : "Archive")}
              </button>
              {t.archived_at && (
                <button
                  onClick={() => onDelete(t)}
                  disabled={busyId === t.id}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--signal-negative-border, #F5BDB4)",
                    background: "var(--signal-negative-light, #FDEEE9)",
                    color: "var(--signal-negative-text, #C0341D)",
                    cursor: busyId === t.id ? "wait" : "pointer",
                    fontFamily: "var(--volt-font-ui)",
                  }}
                >
                  {de ? "Loeschen" : "Delete"}
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

function CreateTenantModal({ onClose, onCreated, locale }: { onClose: () => void; onCreated: () => void; locale: "de" | "en" }) {
  const de = locale === "de";
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
      title={de ? "Neuer Mandant" : "New tenant"}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            {de ? "Abbrechen" : "Cancel"}
          </button>
          <button onClick={onSubmit} disabled={saving || !name.trim()} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "#0A0A0A", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: !name.trim() ? 0.4 : 1 }}>
            {saving ? (de ? "Speichere…" : "Saving…") : (de ? "Erstellen" : "Create")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={de ? "Name" : "Name"}>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={de ? "z.B. Mercedes Strategie" : "e.g. Mercedes Strategy"}
            style={inputStyle} autoFocus
          />
        </Field>
        <Field label="Slug">
          <input
            type="text"
            value={slugEdited ? slug : effectiveSlug}
            onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
            placeholder="mercedes-strategie"
            style={{ ...inputStyle, fontFamily: "var(--volt-font-mono)" }}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
            {de ? "URL-sicherer Bezeichner. Auto-generiert aus Name, kann angepasst werden." : "URL-safe identifier. Auto-generated from name, editable."}
          </div>
        </Field>
        <Field label={de ? "Owner-Email (optional)" : "Owner email (optional)"}>
          <input
            type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
            placeholder="lead@example.com"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
            {de ? "Wenn dieser User existiert, wird er Owner. Sonst bist nur du Owner (Einladen in Phase 3)." : "If this user exists, they'll be made owner. Otherwise only you will be owner (invites in Phase 3)."}
          </div>
        </Field>
        {error && <div style={{ fontSize: 12, color: "var(--signal-negative, #C0341D)", padding: "6px 10px", borderRadius: 6, background: "var(--signal-negative-light)" }}>{error}</div>}
      </div>
    </VoltModal>
  );
}

function EditTenantModal({ tenant, onClose, onSaved, locale }: { tenant: Tenant; onClose: () => void; onSaved: () => void; locale: "de" | "en" }) {
  const de = locale === "de";
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
      title={de ? "Mandant bearbeiten" : "Edit tenant"}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            {de ? "Abbrechen" : "Cancel"}
          </button>
          <button onClick={onSubmit} disabled={saving} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "#0A0A0A", color: "#fff", cursor: saving ? "wait" : "pointer" }}>
            {saving ? (de ? "Speichere…" : "Saving…") : (de ? "Speichern" : "Save")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={de ? "Name" : "Name"}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoFocus />
        </Field>
        <Field label="Slug">
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
