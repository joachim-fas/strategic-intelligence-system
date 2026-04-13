"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/lib/locale-context";
import { usePathname } from "next/navigation";

// Main navigation — workflow-oriented, right-aligned next to actions.
// "Start" and "Canvas" removed (Start = Logo click, Canvas = via Projekte).
const NAV_ITEMS: Array<{
  href: string;
  labelDe: string;
  labelEn: string;
  matchAlso?: string[];
}> = [
  { href: "/sessions",      labelDe: "Projekte",           labelEn: "Projects"          },
  { href: "/verstehen",     labelDe: "Knowledge Cockpit", labelEn: "Knowledge Cockpit" },
  { href: "/monitor",       labelDe: "Monitor",            labelEn: "Monitor"            },
  { href: "/dokumentation", labelDe: "Dokumentation",      labelEn: "Documentation"      },
];

/**
 * Global navigation header — identical design to the Home page header.
 * Used by ALL pages. Logo + Title + Nav + Dark Mode + Locale.
 */
export function AppHeader() {
  const { locale, toggleLocale } = useLocale();
  const pathname = usePathname();
  const de = locale === "de";
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sis-theme");
    if (stored === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark", "volt-dark");
    }
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark", "volt-dark");
      localStorage.setItem("sis-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark", "volt-dark");
      localStorage.setItem("sis-theme", "light");
    }
  };

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href);

  return (
    <header
      role="banner"
      style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "var(--volt-surface-raised, rgba(255,255,255,0.6))",
        borderBottom: "1px solid transparent",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        transition: "all 0.3s",
      }}
    >
      <div style={{ position: "relative", width: "100%", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        {/* Logo — GrainUI: flex-shrink-0 flex items-center, gap-2 (8px) */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Link href="/" aria-label="SIS Startseite" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <Image src="/icons/volt-signet.svg" alt="SIS" width={28} height={18} priority />
            <span className="sis-title-long" style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-heading)" }}>Strategic Intelligence System</span>
          </Link>
        </div>

        {/* Hamburger — Mobile only (GrainUI: md:hidden w-9 h-9 rounded-lg) */}
        <button className="sis-nav-mobile"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={de ? "Hauptnavigation öffnen" : "Open main navigation"}
          aria-expanded={mobileMenuOpen}
          title={de ? "Menü" : "Menu"}
          style={{ display: "none", alignItems: "center", justifyContent: "center", marginLeft: "auto",
            width: 36, height: 36, border: "none",
            borderRadius: 8, background: "transparent",
            cursor: "pointer", fontSize: 20, color: "var(--color-text-muted, #6B6B6B)", flexShrink: 0 }}
        >&#x2261;</button>

        {/* Nav — Desktop: right-aligned with gap before actions */}
        <nav className="sis-nav-desktop" aria-label={de ? "Hauptnavigation" : "Main navigation"} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, flex: 1, marginRight: 16 }}>
          {NAV_ITEMS.map(({ href, labelDe, labelEn }) => {
            const label = de ? labelDe : labelEn;
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                aria-current={active ? "page" : undefined}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center",
                  fontSize: 14, fontWeight: active ? 700 : 600,
                  fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                  color: active ? "var(--color-text-heading, #0A0A0A)" : "var(--color-text-muted, #6B6B6B)",
                  textDecoration: "none", padding: "8px 14px",
                  borderRadius: 8, transition: "all 0.15s", whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-heading, #0A0A0A)"; el.style.background = "rgba(228,255,151,0.5)"; } }}
                onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted, #6B6B6B)"; el.style.background = "transparent"; } }}
              >
                {label}
                {/* GrainUI active indicator: absolute bottom-0 inset-x-3 h-[2px] rounded-full bg-foreground/70 */}
                {active && (
                  <span style={{
                    position: "absolute", bottom: 0, left: 12, right: 12,
                    height: 2, borderRadius: 9999,
                    background: "var(--color-text-heading, rgba(0,0,0,0.7))",
                  }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Activity Monitor toggle (Ctrl+M) */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("sis-toggle-activity-panel"))}
            aria-label={de ? "Activity Monitor öffnen" : "Open Activity Monitor"}
            title={de ? "Activity Monitor (Ctrl+M)" : "Activity Monitor (Ctrl+M)"}
            style={{ fontSize: 14, padding: "2px 8px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.15s", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-heading, #0A0A0A)"; el.style.background = "rgba(228,255,151,0.5)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.background = "transparent"; }}
          >{"\u25CE"}</button>
          <button onClick={toggleDark}
            aria-label={darkMode ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
            title={darkMode ? "Light Mode" : "Dark Mode"}
            style={{ fontSize: 14, padding: "2px 8px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.15s", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
          >{darkMode ? "\u2600" : "\u263E"}</button>
          <button onClick={toggleLocale}
            aria-label={locale === "de" ? "Sprache wechseln zu Englisch" : "Switch language to German"}
            title={locale === "de" ? "Sprache: DE / EN" : "Language: EN / DE"}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted, #6B6B6B)", background: "transparent", border: "none", padding: "4px 10px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-heading, #0A0A0A)"; el.style.background = "rgba(228,255,151,0.5)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted, #6B6B6B)"; el.style.background = "transparent"; }}
          >{locale.toUpperCase()}</button>
          {/* UX-13: Keyboard shortcuts help button */}
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            aria-label={de ? "Tastenkürzel anzeigen" : "Show keyboard shortcuts"}
            aria-expanded={showShortcuts}
            title={de ? "Tastenkürzel" : "Keyboard shortcuts"}
            style={{ fontSize: 11, fontWeight: 700, width: 24, height: 24, borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-heading, #0A0A0A)"; el.style.background = "rgba(228,255,151,0.5)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.background = "transparent"; }}
          >?</button>
        </div>
        {showShortcuts && (
          <div style={{
            position: "absolute", right: 32, top: 64,
            background: "var(--volt-surface-raised, #fff)",
            border: "1px solid var(--volt-border, #E8E8E8)",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 40, minWidth: 220,
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {de ? "Tastenkürzel" : "Keyboard Shortcuts"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
              <kbd>Ctrl+Z</kbd><span>{de ? "Rückgängig" : "Undo"}</span>
              <kbd>Ctrl+Y</kbd><span>{de ? "Wiederherstellen" : "Redo"}</span>
              <kbd>Del</kbd><span>{de ? "Node löschen" : "Delete node"}</span>
              <kbd>Esc</kbd><span>{de ? "Abbrechen" : "Cancel"}</span>
              <kbd>Ctrl+C</kbd><span>{de ? "Node kopieren" : "Copy node"}</span>
              <kbd>Ctrl+V</kbd><span>{de ? "Node einfügen" : "Paste node"}</span>
              <kbd>/</kbd><span>{de ? "Slash-Befehle" : "Slash commands"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "var(--volt-surface-raised, #fff)",
          borderBottom: "1px solid var(--volt-border, #E8E8E8)",
          padding: "8px 24px 16px",
          zIndex: 30,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: 15, fontWeight: isActive(item.href) ? 700 : 400,
                color: "var(--color-text-primary)",
                textDecoration: "none", padding: "10px 0",
                borderBottom: "1px solid var(--volt-border, #E8E8E8)",
              }}>
              {de ? item.labelDe : item.labelEn}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
