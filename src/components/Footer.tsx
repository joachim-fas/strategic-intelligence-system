"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { usePathname } from "next/navigation";

/**
 * Global footer — secondary navigation + legal.
 * Contains links moved from main nav (Monitor, Dokumentation)
 * plus Impressum and project disclaimer.
 */
export function Footer() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const de = locale === "de";

  // Hide footer on canvas page (full-screen workspace)
  if (pathname.startsWith("/canvas")) return null;

  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--color-text-muted, #6B6B6B)",
    textDecoration: "none",
    transition: "color 0.15s",
  };

  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: "1px solid var(--color-border, #E8E8E8)",
        padding: "32px 40px 28px",
        marginTop: "auto",
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      }}
    >
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 40,
        flexWrap: "wrap",
      }}>
        {/* Column 1: Product */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--color-text-muted, #6B6B6B)",
            marginBottom: 4,
          }}>
            {de ? "System" : "System"}
          </span>
          <Link href="/monitor" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >
            {de ? "Monitor" : "Monitor"}
          </Link>
          <Link href="/dokumentation" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >
            {de ? "Dokumentation" : "Documentation"}
          </Link>
        </div>

        {/* Column 2: Legal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--color-text-muted, #6B6B6B)",
            marginBottom: 4,
          }}>
            {de ? "Rechtliches" : "Legal"}
          </span>
          <Link href="/impressum" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >
            Impressum
          </Link>
        </div>

        {/* Column 3: Disclaimer */}
        <div style={{ maxWidth: 320 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--color-text-muted, #6B6B6B)",
            marginBottom: 8, display: "block",
          }}>
            Hinweis
          </span>
          <p style={{
            fontSize: 12, lineHeight: 1.5,
            color: "var(--color-text-muted, #6B6B6B)",
            margin: 0,
          }}>
            {de
              ? "SIS ist ein experimentelles Test-Projekt. Analysen und Szenarien dienen der strategischen Exploration und stellen keine Beratung dar."
              : "SIS is an experimental test project. Analyses and scenarios serve strategic exploration and do not constitute advice."}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        marginTop: 24, paddingTop: 16,
        borderTop: "1px solid var(--color-border, #E8E8E8)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, color: "var(--color-text-muted, #999)",
      }}>
        <span>SIS — Strategic Intelligence System</span>
        <span>Joachim Fasching · free-agents.io</span>
      </div>
    </footer>
  );
}
