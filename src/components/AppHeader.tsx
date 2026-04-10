"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/lib/locale-context";
import { usePathname } from "next/navigation";

// Brutally minimal main navigation, ordered by mental model:
// — "Sessions" (first) is the strategic working area where work happens:
//   list of past canvases, each resolving to /canvas/[id].
// — "Knowledge Cockpit" (second) is the data/reference landscape: radar,
//   network, signals, sources, methodology.
//
// Frameworks are reached from the Home page (hero cards), Node Canvas is reached
// from within a Session — neither needs its own nav slot.
// Labels are English-only by user choice.
const NAV_ITEMS = [
  { href: "/sessions",  labelDe: "Sessions",          labelEn: "Sessions"          },
  { href: "/verstehen", labelDe: "Knowledge Cockpit", labelEn: "Knowledge Cockpit" },
];

/**
 * Global navigation header — identical design to the Home page header.
 * Used by ALL pages. Logo + Title + Nav + Dark Mode + Locale.
 */
export function AppHeader() {
  const { locale, toggleLocale } = useLocale();
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);

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

  return (
    <header
      role="banner"
      style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--volt-surface-raised, var(--color-surface))",
        borderBottom: "1px solid var(--volt-border, var(--color-border))",
        backdropFilter: "blur(12px) saturate(160%)",
        WebkitBackdropFilter: "blur(12px) saturate(160%)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Link href="/" aria-label="SIS Startseite" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Image src="/icons/volt-signet.svg" alt="SIS" width={28} height={18} priority />
            <span className="sis-title-long" style={{ fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-heading)" }}>Strategic Intelligence System</span>
          </Link>
        </div>

        {/* Hamburger — Mobile only */}
        <button className="sis-nav-mobile"
          aria-label={locale === "de" ? "Hauptnavigation öffnen" : "Open main navigation"}
          title={locale === "de" ? "Menü" : "Menu"}
          style={{ display: "none", alignItems: "center", justifyContent: "center", marginLeft: "auto",
            width: 36, height: 36, border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)", background: "transparent",
            cursor: "pointer", fontSize: 20, color: "var(--color-text-primary)", flexShrink: 0 }}
        >&#x2261;</button>

        {/* Nav — Desktop only */}
        <nav className="sis-nav-desktop" aria-label={locale === "de" ? "Hauptnavigation" : "Main navigation"} style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {NAV_ITEMS.map(({ href, labelDe, labelEn }) => {
            const label = locale === "de" ? labelDe : labelEn;
            // "Sessions" also owns /canvas routes — drilling into a session
            // from the list must keep the nav item highlighted.
            const isActive =
              pathname === href
              || (href !== "/" && pathname.startsWith(href))
              || (href === "/sessions" && pathname.startsWith("/canvas"));
            return (
              <Link key={href} href={href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-text-heading)" : "var(--color-text-subtle)",
                  textDecoration: "none", padding: "4px 10px",
                  borderRadius: "var(--radius-md)", transition: "all 0.15s", whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-surface-2)"; } }}
                onMouseLeave={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-subtle)"; el.style.background = "transparent"; } }}
              >{label}</Link>
            );
          })}
          <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} role="separator" aria-orientation="vertical" />
          <button onClick={toggleDark}
            aria-label={darkMode ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
            title={darkMode ? "Light Mode" : "Dark Mode"}
            style={{ fontSize: 14, padding: "2px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.15s", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
          >{darkMode ? "\u2600" : "\u263E"}</button>
          <button onClick={toggleLocale}
            aria-label={locale === "de" ? "Sprache wechseln zu Englisch" : "Switch language to German"}
            title={locale === "de" ? "Sprache: DE / EN" : "Language: EN / DE"}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-subtle)", background: "transparent", border: "none", padding: "4px 10px", borderRadius: "var(--radius-md)", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-surface-2)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-subtle)"; el.style.background = "transparent"; }}
          >{locale.toUpperCase()}</button>
          {/* UX-13: Keyboard shortcuts help button */}
          <button
            aria-label={locale === "de" ? "Tastenkürzel anzeigen" : "Show keyboard shortcuts"}
            title={"Ctrl+Z: Undo, Ctrl+Y: Redo, Del: Delete, Esc: Cancel"}
            style={{ fontSize: 11, fontWeight: 700, width: 24, height: 24, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 2, flexShrink: 0 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-primary)"; el.style.background = "var(--color-surface-2)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-muted)"; el.style.background = "transparent"; }}
          >?</button>
        </nav>
      </div>
    </header>
  );
}
