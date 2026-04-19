"use client";

import Link from "next/link";
import { useT } from "@/lib/locale-context";
import { usePathname } from "next/navigation";

/**
 * Global footer — compact single-line with secondary nav + legal.
 */
export function Footer() {
  const { t } = useT();
  const pathname = usePathname();

  // Hide footer on canvas page (full-screen workspace)
  if (pathname.startsWith("/canvas")) return null;

  const linkStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--color-text-muted, #6B6B6B)",
    textDecoration: "none",
    transition: "color 0.15s",
  };

  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: "1px solid var(--color-border, #E8E8E8)",
        padding: "12px 40px",
        marginTop: "auto",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: "var(--volt-surface, #FFFFFF)",
        fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
      }}
    >
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}>
        {/* Left: Brand */}
        <span style={{ fontSize: 11, color: "var(--color-text-muted, #999)" }}>
          SIS — Strategic Intelligence System
        </span>

        {/* Center: Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/monitor" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >Monitor</Link>
          <Link href="/dokumentation" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >{t("footer.documentation")}</Link>
          <Link href="/komponenten" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >{t("footer.components")}</Link>
          <Link href="/impressum" style={linkStyle}
            onMouseEnter={e => { (e.currentTarget).style.color = "var(--color-text-heading, #0A0A0A)"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "var(--color-text-muted, #6B6B6B)"; }}
          >Impressum</Link>
        </nav>

        {/* Right: Author */}
        <span style={{ fontSize: 11, color: "var(--color-text-muted, #999)" }}>
          Joachim Unterberger · free-agents.io
        </span>
      </div>
    </footer>
  );
}
