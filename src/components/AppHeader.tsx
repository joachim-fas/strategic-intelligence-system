"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/cockpit",    labelDe: "Cockpit",    labelEn: "Cockpit"   },
  { href: "/werkstatt",  labelDe: "Werkstatt",  labelEn: "Workshop"  },
  { href: "/archiv",     labelDe: "Archiv",     labelEn: "Archive"   },
];

/**
 * Shared navigation header — used by ALL pages including Canvas.
 * Three rooms: Cockpit (observe) | Werkstatt (build) | Archiv (verify)
 * Logo click returns to Home (/).
 */
export function AppHeader() {
  const { locale, toggleLocale } = useLocale();
  const de = locale === "de";
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sis-theme");
    if (stored === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("volt-dark");
    }
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("volt-dark");
      localStorage.setItem("sis-theme", "dark");
    } else {
      document.documentElement.classList.remove("volt-dark");
      localStorage.setItem("sis-theme", "light");
    }
  };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "var(--volt-surface-raised, rgba(255,255,255,0.92))",
      backdropFilter: "blur(12px) saturate(160%)",
      WebkitBackdropFilter: "blur(12px) saturate(160%)",
      borderBottom: "1px solid var(--color-border)",
      /* no box-shadow — Volt depth via border only */
    }}>
      <div className="volt-container" style={{
        height: 52,
        display: "flex", alignItems: "center", gap: 0,
      }}>

        {/* ── Logo → links to main SIS page ─────────────────── */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0, marginRight: 20 }}
          title="Strategic Intelligence System"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/volt-signet.svg" alt="SIS" style={{ width: 28, height: 18 }} />
        </a>

        {/* ── Primary nav ───────────────────────────────────── */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, flex: "1 1 auto", minWidth: 0 }}>
          {NAV_ITEMS.map(({ href, labelDe, labelEn }) => {
            const label = de ? labelDe : labelEn;
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <a key={href} href={href}
                className="volt-body-sm"
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--volt-text)" : undefined,
                  textDecoration: "none",
                  padding: "5px 11px",
                  borderRadius: "var(--radius-md, 8px)",
                  background: isActive ? "var(--color-surface-2, #F5F5F5)" : "transparent",
                  transition: "all 0.13s",
                  whiteSpace: "nowrap",
                  position: "relative",
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "var(--color-text-primary)";
                    el.style.background = "var(--color-surface-2, #F5F5F5)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "";
                    el.style.background = "transparent";
                  }
                }}
              >
                {label}
                {isActive && (
                  <span style={{
                    position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                    width: 16, height: 2, borderRadius: 99,
                    background: "var(--volt-lime, #E4FF97)",
                  }} />
                )}
              </a>
            );
          })}
        </nav>

        {/* ── Right side ────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 16 }}>
          {/* Dark mode toggle */}
          <button
            className="volt-btn volt-btn-ghost volt-btn-sm"
            onClick={toggleDark}
            title={darkMode ? "Light Mode" : "Dark Mode"}
            style={{
              width: 30, height: 28,
              padding: "4px 8px",
            }}
          >{darkMode ? "☀" : "☾"}</button>

          {/* Locale toggle */}
          {(["de", "en"] as const).map(l => (
            <button key={l}
              onClick={() => { if (l !== locale) toggleLocale(); }}
              className={`volt-btn ${locale === l ? "volt-btn-solid" : "volt-btn-ghost"} volt-btn-sm`}
              style={{
                padding: "3px 9px",
                borderRadius: 9999,
                border: `1px solid ${locale === l ? "var(--volt-lime-deep, #C8F060)" : "var(--volt-border)"}`,
                background: locale === l ? "var(--volt-lime)" : "transparent",
                color: locale === l ? "var(--volt-black)" : undefined,
              }}
            ><span className="volt-label" style={{ fontSize: 10, letterSpacing: "0.06em", color: "inherit" }}>{l.toUpperCase()}</span></button>
          ))}
        </div>
      </div>
    </header>
  );
}
