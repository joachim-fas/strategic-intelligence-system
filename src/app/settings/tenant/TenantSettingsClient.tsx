"use client";

/**
 * Owner-/Admin-Settings fuer den aktiven Mandanten.
 *
 * Laedt GET /api/v1/tenant/settings (scope aus Session), zeigt:
 *   - Name + Slug (editierbar, nur Owner darf Slug aendern)
 *   - Default-Locale, Default-Zeitzone
 *   - Default-Context-Profile (Rolle/Industrie/Region fuer neue Queries)
 *
 * Settings-JSON schema (auf Server-Seite bewusst offen / generisch —
 * hier im Client halten wir eine typisierte Teilmenge und schreiben
 * nur die Felder, die wir kennen):
 *
 *   settings = {
 *     locale?: "de" | "en",
 *     timezone?: string,          // IANA, z.B. "Europe/Berlin"
 *     contextProfile?: {
 *       role?: string,
 *       industry?: string,
 *       region?: string,
 *     },
 *     logoUrl?: string | null,    // optional, noch kein Upload-Flow
 *   }
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { useTenant } from "@/lib/tenant-context";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface ContextProfile {
  role?: string;
  industry?: string;
  region?: string;
}

interface TenantSettings {
  locale?: "de" | "en";
  timezone?: string;
  contextProfile?: ContextProfile;
  logoUrl?: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: string | TenantSettings;
  archived_at: string | null;
}

export function TenantSettingsClient() {
  const { locale } = useLocale();
  const de = locale === "de";
  const tenantCtx = useTenant();

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Editable form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [settingsLocale, setSettingsLocale] = useState<"de" | "en">("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [role, setRole] = useState("");
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Role-Gates (Server enforced, Client spiegelt nur zur Anzeige)
  const canEditSettings = tenantCtx.role === "owner" || tenantCtx.role === "admin";
  const canEditSlug = tenantCtx.role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/v1/tenant/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json?.data ?? json;
      const t = data.tenant as TenantRow;
      setTenant(t);
      setName(t.name);
      setSlug(t.slug);
      const parsed: TenantSettings = typeof t.settings === "string"
        ? (t.settings ? safeParse(t.settings) : {})
        : (t.settings ?? {});
      setSettingsLocale((parsed.locale as "de" | "en") ?? "de");
      setTimezone(parsed.timezone ?? "Europe/Berlin");
      setRole(parsed.contextProfile?.role ?? "");
      setIndustry(parsed.contextProfile?.industry ?? "");
      setRegion(parsed.contextProfile?.region ?? "");
      setLogoUrl(parsed.logoUrl ?? "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const settingsDirty = useMemo(() => {
    if (!tenant) return false;
    const current: TenantSettings = typeof tenant.settings === "string"
      ? (tenant.settings ? safeParse(tenant.settings) : {})
      : (tenant.settings ?? {});
    return (
      name !== tenant.name
      || (canEditSlug && slug !== tenant.slug)
      || settingsLocale !== (current.locale ?? "de")
      || timezone !== (current.timezone ?? "Europe/Berlin")
      || role !== (current.contextProfile?.role ?? "")
      || industry !== (current.contextProfile?.industry ?? "")
      || region !== (current.contextProfile?.region ?? "")
      || (logoUrl || "") !== (current.logoUrl ?? "")
    );
  }, [tenant, name, slug, settingsLocale, timezone, role, industry, region, logoUrl, canEditSlug]);

  const save = async () => {
    if (!tenant || !canEditSettings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const settings: TenantSettings = {
        locale: settingsLocale,
        timezone: timezone.trim() || undefined,
        contextProfile: {
          role: role.trim() || undefined,
          industry: industry.trim() || undefined,
          region: region.trim() || undefined,
        },
        logoUrl: logoUrl.trim() || null,
      };
      const body: Record<string, unknown> = { settings };
      if (name.trim() && name.trim() !== tenant.name) body.name = name.trim();
      if (canEditSlug && slug.trim() && slug.trim() !== tenant.slug) body.slug = slug.trim();

      const res = await fetchWithTimeout("/api/v1/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)" }}>
      <AppHeader />
      <main style={{ maxWidth: 780, margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
            textTransform: "uppercase" as const,
            color: "var(--volt-text-faint, #BBB)",
            marginBottom: 6,
          }}>
            {de ? "Einstellungen" : "Settings"}
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700,
            fontFamily: "var(--volt-font-display)",
            color: "var(--color-text-heading)",
            margin: 0, letterSpacing: "-0.02em",
          }}>
            {de ? "Mandant" : "Tenant"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 600 }}>
            {de
              ? "Einstellungen fuer deinen aktiven Mandanten. Aenderungen gelten fuer alle Mitglieder. Mitglieder- und Rollen-Verwaltung liegt unter der Admin-Ansicht des Mandanten."
              : "Settings for the currently active tenant. Changes apply to all members. Member + role management lives under the admin view of this tenant."}
          </p>
        </div>

        {loading && <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{de ? "Lade…" : "Loading…"}</div>}
        {error && <div style={{
          fontSize: 12, color: "var(--signal-negative, #C0341D)",
          padding: "8px 12px", borderRadius: 8,
          background: "var(--signal-negative-light)", marginBottom: 14,
        }}>{error}</div>}

        {tenant && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 18,
          }}>
            {!canEditSettings && (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "var(--pastel-butter, #FFF5BA)",
                color: "var(--pastel-butter-text, #7A5C00)",
                fontSize: 12, lineHeight: 1.5,
              }}>
                {de
                  ? "Nur Owner und Admins koennen Mandanten-Einstellungen aendern. Du kannst die Werte unten einsehen, aber nicht speichern."
                  : "Only owners and admins can change tenant settings. You can inspect the values below but can't save."}
              </div>
            )}

            {/* ── Stammdaten ────────────────────────────────────────── */}
            <SectionCard title={de ? "Stammdaten" : "Basics"}>
              <Field label={de ? "Name" : "Name"}>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  disabled={!canEditSettings} style={inputStyle(!canEditSettings)}
                />
              </Field>
              <Field label={de ? "Slug" : "Slug"} hint={canEditSlug
                ? (de ? "URL-sicherer Bezeichner. Nur Owner koennen den Slug aendern." : "URL-safe identifier. Only owners can change the slug.")
                : (de ? "Nur der Owner kann den Slug aendern." : "Only the owner can change the slug.")}>
                <input
                  type="text" value={slug} onChange={e => setSlug(e.target.value)}
                  disabled={!canEditSlug} style={{ ...inputStyle(!canEditSlug), fontFamily: "var(--volt-font-mono)" }}
                />
              </Field>
            </SectionCard>

            {/* ── Defaults fuer neue Queries ───────────────────────── */}
            <SectionCard title={de ? "Analyse-Defaults" : "Query defaults"} hint={
              de
                ? "Diese Werte werden als Kontext-Profile bei neuen Queries vorausgefuellt (Rolle, Industrie, Region)."
                : "These values prefill the context profile for new queries (role, industry, region)."
            }>
              <Field label={de ? "Sprache" : "Language"}>
                <select
                  value={settingsLocale}
                  onChange={e => setSettingsLocale(e.target.value as "de" | "en")}
                  disabled={!canEditSettings}
                  style={inputStyle(!canEditSettings)}
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label={de ? "Zeitzone" : "Timezone"}>
                <input
                  type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
                  disabled={!canEditSettings} placeholder="Europe/Berlin"
                  style={{ ...inputStyle(!canEditSettings), fontFamily: "var(--volt-font-mono)" }}
                />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Field label={de ? "Rolle" : "Role"}>
                  <input
                    type="text" value={role} onChange={e => setRole(e.target.value)}
                    disabled={!canEditSettings} placeholder={de ? "z.B. Strategy Lead" : "e.g. Strategy Lead"}
                    style={inputStyle(!canEditSettings)}
                  />
                </Field>
                <Field label={de ? "Industrie" : "Industry"}>
                  <input
                    type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                    disabled={!canEditSettings} placeholder={de ? "z.B. Automotive" : "e.g. Automotive"}
                    style={inputStyle(!canEditSettings)}
                  />
                </Field>
                <Field label={de ? "Region" : "Region"}>
                  <input
                    type="text" value={region} onChange={e => setRegion(e.target.value)}
                    disabled={!canEditSettings} placeholder="DACH"
                    style={inputStyle(!canEditSettings)}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* ── Branding ─────────────────────────────────────────── */}
            <SectionCard title={de ? "Branding" : "Branding"} hint={
              de
                ? "Logo fuer den Header (optional, URL). Upload-Flow folgt, bis dahin bitte eine gehostete URL angeben."
                : "Header logo (optional, URL). Upload flow is pending — for now please provide a hosted URL."
            }>
              <Field label={de ? "Logo-URL" : "Logo URL"}>
                <input
                  type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  disabled={!canEditSettings}
                  placeholder="https://…/logo.svg"
                  style={inputStyle(!canEditSettings)}
                />
              </Field>
            </SectionCard>

            {/* ── Save-Zeile ───────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 4 }}>
              {saved && (
                <span style={{ fontSize: 12, color: "var(--signal-positive, #1A9E5A)", fontFamily: "var(--volt-font-mono)" }}>
                  {de ? "✓ Gespeichert" : "✓ Saved"}
                </span>
              )}
              <button
                onClick={save}
                disabled={saving || !canEditSettings || !settingsDirty}
                style={{
                  fontSize: 13, fontWeight: 600,
                  padding: "9px 18px", borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: !settingsDirty || !canEditSettings ? "var(--color-surface-2, #F5F5F5)" : "var(--volt-lime, #E4FF97)",
                  color: "var(--volt-text, #0A0A0A)",
                  cursor: saving ? "wait" : (!canEditSettings || !settingsDirty ? "not-allowed" : "pointer"),
                  fontFamily: "var(--volt-font-ui)",
                  opacity: !canEditSettings || !settingsDirty ? 0.55 : 1,
                }}
              >
                {saving ? (de ? "Speichere…" : "Saving…") : (de ? "Speichern" : "Save")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "var(--volt-surface-raised, #fff)",
      border: "1px solid var(--color-border)",
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-heading)", margin: 0 }}>
          {title}
        </h2>
        {hint && (
          <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0", lineHeight: 1.5 }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        color: "var(--color-text-muted)",
      }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{hint}</span>}
    </label>
  );
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "var(--volt-font-ui)",
    outline: "none",
    background: disabled ? "var(--color-surface-2, #F5F5F5)" : "var(--volt-surface, #fff)",
    color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
    cursor: disabled ? "not-allowed" : "text",
  };
}

function safeParse(s: string): TenantSettings {
  try { return JSON.parse(s) as TenantSettings; } catch { return {}; }
}
