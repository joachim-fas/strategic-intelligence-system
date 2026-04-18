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
 *
 * 2026-04-18 audit A5-H9: migrated to `useT()` + `tenant.*` namespace.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";
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
  const { t, locale } = useT();
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
      const row = data.tenant as TenantRow;
      setTenant(row);
      setName(row.name);
      setSlug(row.slug);
      const parsed: TenantSettings = typeof row.settings === "string"
        ? (row.settings ? safeParse(row.settings) : {})
        : (row.settings ?? {});
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
            {t("tenant.settingsCaption")}
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700,
            fontFamily: "var(--volt-font-display)",
            color: "var(--color-text-heading)",
            margin: 0, letterSpacing: "-0.02em",
          }}>
            {t("tenant.settingsHeading")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: 600 }}>
            {t("tenant.settingsSubtitle")}
          </p>
        </div>

        {loading && <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{t("common.loading")}</div>}
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
                {t("tenant.nonAdminHint")}
              </div>
            )}

            {/* ── Stammdaten ────────────────────────────────────────── */}
            <SectionCard title={t("tenant.basicsSection")}>
              <Field label={t("common.name")}>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  disabled={!canEditSettings} style={inputStyle(!canEditSettings)}
                />
              </Field>
              <Field
                label={t("admin.tenantSlug")}
                hint={canEditSlug ? t("tenant.slugOwnerOnlyHint") : t("tenant.slugOwnerOnly")}
              >
                <input
                  type="text" value={slug} onChange={e => setSlug(e.target.value)}
                  disabled={!canEditSlug} style={{ ...inputStyle(!canEditSlug), fontFamily: "var(--volt-font-mono)" }}
                />
              </Field>
            </SectionCard>

            {/* ── Defaults fuer neue Queries ───────────────────────── */}
            <SectionCard
              title={t("tenant.queryDefaultsSection")}
              hint={t("tenant.queryDefaultsHint")}
            >
              <Field label={t("tenant.languageLabel")}>
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
              <Field label={t("tenant.timezoneLabel")}>
                <input
                  type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
                  disabled={!canEditSettings} placeholder="Europe/Berlin"
                  style={{ ...inputStyle(!canEditSettings), fontFamily: "var(--volt-font-mono)" }}
                />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Field label={t("tenant.roleLabel")}>
                  <input
                    type="text" value={role} onChange={e => setRole(e.target.value)}
                    disabled={!canEditSettings} placeholder={t("tenant.rolePlaceholder")}
                    style={inputStyle(!canEditSettings)}
                  />
                </Field>
                <Field label={t("tenant.industryLabel")}>
                  <input
                    type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                    disabled={!canEditSettings} placeholder={t("tenant.industryPlaceholder")}
                    style={inputStyle(!canEditSettings)}
                  />
                </Field>
                <Field label={t("tenant.regionLabel")}>
                  <input
                    type="text" value={region} onChange={e => setRegion(e.target.value)}
                    disabled={!canEditSettings} placeholder="DACH"
                    style={inputStyle(!canEditSettings)}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* ── Branding ─────────────────────────────────────────── */}
            <SectionCard title={t("tenant.brandingSection")} hint={t("tenant.brandingHint")}>
              <LogoUploadField
                logoUrl={logoUrl}
                onChange={setLogoUrl}
                canEdit={canEditSettings}
                locale={locale}
              />
            </SectionCard>

            {/* ── Save-Zeile ───────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 4 }}>
              {saved && (
                <span style={{ fontSize: 12, color: "var(--signal-positive, #1A9E5A)", fontFamily: "var(--volt-font-mono)" }}>
                  {t("tenant.savedNote")}
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
                {saving ? t("admin.saving") : t("common.save")}
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

/**
 * LogoUploadField — zwei Pfade in einem Control: direkter File-Upload
 * (POST /api/v1/tenant/settings/logo) oder manueller URL-Eintrag fuer
 * extern gehostete Logos. Preview direkt daneben (transparenter
 * Checkered-Hintergrund, damit Weissabgleich von PNG/SVG sichtbar ist).
 *
 * Der Upload schreibt direkt in tenants.settings.logoUrl; das
 * umschliessende Save-Formular uebernimmt den neuen Wert beim naechsten
 * PATCH automatisch, weil es aus denselben State liest.
 */
function LogoUploadField({
  logoUrl,
  onChange,
  canEdit,
  locale,
}: {
  logoUrl: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  locale: Locale;
}) {
  const tl = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // Audit A4-M7 (18.04.2026): was bare `fetch(…)` — a slow or
      // stalled upload would hang indefinitely. 60 s is generous
      // for a 512 KB file cap but finite.
      const res = await fetchWithTimeout(
        "/api/v1/tenant/settings/logo",
        { method: "POST", body: form },
        60_000,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      const url = json?.data?.url as string | undefined;
      if (url) onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tenant/settings/logo", { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }
      onChange("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Preview */}
        <div
          style={{
            flexShrink: 0,
            width: 72, height: 72, borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: logoUrl
              ? `#fff url("${logoUrl}") center / contain no-repeat`
              : "repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 50% / 12px 12px",
            overflow: "hidden",
          }}
          aria-label={tl("tenant.logoPreview")}
        />
        {/* Actions */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!canEdit || uploading}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: "6px 12px", borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: canEdit && !uploading ? "var(--volt-surface, #fff)" : "var(--color-surface-2, #F5F5F5)",
                color: "var(--color-text-primary)",
                cursor: canEdit && !uploading ? "pointer" : "not-allowed",
                fontFamily: "var(--volt-font-ui)",
              }}
            >
              {uploading
                ? tl("tenant.logoUploading")
                : (logoUrl ? tl("tenant.logoReplace") : tl("tenant.logoUpload"))}
            </button>
            {logoUrl && canEdit && (
              <button
                type="button"
                onClick={remove}
                disabled={uploading}
                style={{
                  fontSize: 12, fontWeight: 500,
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  color: "var(--signal-negative-text, #C0341D)",
                  cursor: uploading ? "wait" : "pointer",
                  fontFamily: "var(--volt-font-ui)",
                }}
              >
                {tl("tenant.logoRemove")}
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {tl("tenant.logoConstraints")}
          </div>
        </div>
      </div>
      {/* URL fallback — fuer gehostete Logos ohne Upload */}
      <Field label={tl("tenant.logoUrlFallback")}>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => onChange(e.target.value)}
          disabled={!canEdit}
          placeholder="https://…/logo.svg"
          style={inputStyle(!canEdit)}
        />
      </Field>
      {error && (
        <div style={{
          fontSize: 12, padding: "6px 10px", borderRadius: 6,
          background: "var(--signal-negative-light)", color: "var(--signal-negative-text)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
