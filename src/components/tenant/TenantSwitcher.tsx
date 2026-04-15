"use client";

/**
 * TenantSwitcher — Header-Dropdown zum Wechseln des aktiven Mandanten.
 *
 * Liest alle Memberships + die aktuelle Rolle aus dem TenantContext
 * (`useTenant`) und rendert:
 *   - Einen kompakten Trigger (Tenant-Name + Rolle-Badge)
 *   - Ein Popover mit der Memberships-Liste
 *   - Fuer System-Admins zusaetzlich einen "Mandanten verwalten"-Link
 *
 * Der eigentliche Switch laeuft ueber `ctx.switchTenant(id)`, das ein
 * `POST /api/v1/auth/switch-tenant` macht und danach die Seite
 * hart-reloadet (damit alle tenant-gescopeten Reads frisch ziehen).
 *
 * Wenn der User nur einen Tenant hat und kein System-Admin ist, wird
 * nur ein statischer Anzeige-Chip ohne Dropdown gerendert — kein Noise
 * im Header fuer Single-Tenant-User.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTenant, type TenantMembership, type TenantRole } from "@/lib/tenant-context";
import { useLocale } from "@/lib/locale-context";

const ROLE_BADGE_COLOR: Record<TenantRole, string> = {
  owner: "#0F6038",
  admin: "#1A4A8A",
  member: "#6B6B6B",
  viewer: "#9B9B9B",
};

const footerLinkStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--volt-text, #0A0A0A)",
  textDecoration: "none",
  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
};

function roleLabel(role: TenantRole, de: boolean): string {
  if (de) {
    return role === "owner" ? "Inhaber" : role === "admin" ? "Admin" : role === "member" ? "Mitglied" : "Leser";
  }
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : "Viewer";
}

export function TenantSwitcher() {
  const { activeTenantId, memberships, role, isSystemAdmin, switchTenant } = useTenant();
  const { locale } = useLocale();
  const de = locale === "de";

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Schliesse das Popover bei Click-outside + Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const p = popoverRef.current;
      const t = triggerRef.current;
      if (!p || !t) return;
      if (!p.contains(e.target as Node) && !t.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Edge-case: kein aktives Tenant (z.B. frisch eingeloggter User ohne
  // Membership). Dann rendern wir nichts — stellt kein UI-Rauschen
  // auf der Admin-losen Landing-Seite dar.
  if (!activeTenantId) return null;

  const active: TenantMembership | undefined = memberships.find((m) => m.id === activeTenantId);
  const canManage = isSystemAdmin;
  const hasMultiple = memberships.length > 1 || canManage;

  // Einfacher Static-Chip fuer Single-Tenant-User ohne Admin-Rechte.
  if (!hasMultiple && active) {
    return (
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 8,
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 11, fontWeight: 600,
          color: "var(--color-text-muted, #6B6B6B)",
          background: "transparent",
          border: "1px solid var(--color-border, #E8E8E8)",
        }}
        title={de ? "Aktueller Mandant" : "Current tenant"}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: ROLE_BADGE_COLOR[role ?? "member"] }} />
        <span style={{ letterSpacing: "0.02em" }}>{active.name}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={de ? "Mandant wechseln" : "Switch tenant"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 10px", borderRadius: 8,
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 11, fontWeight: 600,
          color: open ? "var(--color-text-heading, #0A0A0A)" : "var(--color-text-muted, #6B6B6B)",
          background: open ? "rgba(228,255,151,0.5)" : "transparent",
          border: "1px solid var(--color-border, #E8E8E8)",
          cursor: "pointer",
          transition: "all 0.15s",
          maxWidth: 220,
        }}
        onMouseEnter={e => {
          if (open) return;
          const el = e.currentTarget as HTMLElement;
          el.style.color = "var(--color-text-heading, #0A0A0A)";
          el.style.background = "rgba(228,255,151,0.35)";
        }}
        onMouseLeave={e => {
          if (open) return;
          const el = e.currentTarget as HTMLElement;
          el.style.color = "var(--color-text-muted, #6B6B6B)";
          el.style.background = "transparent";
        }}
      >
        <span
          style={{ width: 5, height: 5, borderRadius: "50%", background: ROLE_BADGE_COLOR[role ?? "member"], flexShrink: 0 }}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
          {active?.name ?? (de ? "Mandant" : "Tenant")}
        </span>
        <span style={{ fontSize: 9, color: "var(--color-text-faint, #AAA)" }}>▾</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            minWidth: 260, maxWidth: 340,
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--color-border, #E8E8E8)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px 6px",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9, fontWeight: 700,
              letterSpacing: "0.10em",
              textTransform: "uppercase" as const,
              color: "var(--color-text-faint, #AAA)",
            }}
          >
            {de ? "Aktiver Mandant" : "Active tenant"}
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {memberships.map((m) => {
              const isActive = m.id === activeTenantId;
              return (
                <button
                  key={m.id}
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    if (isActive) {
                      setOpen(false);
                      return;
                    }
                    void switchTenant(m.id);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%",
                    padding: "9px 14px",
                    border: "none",
                    background: isActive ? "rgba(228,255,151,0.35)" : "transparent",
                    cursor: isActive ? "default" : "pointer",
                    textAlign: "left" as const,
                    fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => {
                    if (isActive) return;
                    (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2, #F5F5F5)";
                  }}
                  onMouseLeave={e => {
                    if (isActive) return;
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: ROLE_BADGE_COLOR[m.role],
                      flexShrink: 0,
                      boxShadow: isActive ? `0 0 0 2px ${ROLE_BADGE_COLOR[m.role]}25` : "none",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: "var(--volt-text, #0A0A0A)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {m.name}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 10, fontWeight: 500,
                      letterSpacing: "0.04em",
                      color: ROLE_BADGE_COLOR[m.role],
                      marginTop: 1,
                    }}>
                      {roleLabel(m.role, de)}
                    </div>
                  </div>
                  {isActive && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                        fontSize: 9, fontWeight: 700,
                        color: ROLE_BADGE_COLOR[m.role],
                      }}
                    >
                      ●
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Footer-Aktionen im Dropdown. "Einstellungen" ist fuer
               Owner/Admin des aktuellen Tenants sichtbar (eigene Orga
               konfigurieren); "Mandanten verwalten" nur fuer System-
               Admins (alle Orgas). */}
          {(role === "owner" || role === "admin" || canManage) && (
            <div style={{ height: 1, background: "var(--color-border, #E8E8E8)" }} />
          )}
          {(role === "owner" || role === "admin") && (
            <Link
              href="/settings/tenant"
              onClick={() => setOpen(false)}
              style={footerLinkStyle}
            >
              {de ? "Einstellungen" : "Settings"}
            </Link>
          )}
          {canManage && (
            <Link
              href="/admin/tenants"
              onClick={() => setOpen(false)}
              style={footerLinkStyle}
            >
              {de ? "Mandanten verwalten →" : "Manage tenants →"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
