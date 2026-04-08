"use client";

/**
 * Sub-navigation for the Sessions area: Aktiv | Archiv.
 * Used on /sessions and /sessions/archiv.
 */

interface Props {
  active: "active" | "archive";
  de: boolean;
}

export function SessionsSubNav({ active, de }: Props) {
  const tabs: Array<{ key: "active" | "archive"; href: string; label: string }> = [
    { key: "active",  href: "/sessions",        label: de ? "Aktiv"  : "Active"  },
    { key: "archive", href: "/sessions/archiv", label: de ? "Archiv" : "Archive" },
  ];

  return (
    <nav
      aria-label={de ? "Session-Bereich" : "Sessions area"}
      style={{
        display: "flex",
        gap: 0,
        marginTop: 4,
        marginBottom: -1, // pull down onto the hero bottom border
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <a
            key={t.key}
            href={t.href}
            style={{
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-muted, #6B6B6B)",
              textDecoration: "none",
              padding: "12px 18px",
              borderBottom: isActive ? "2px solid var(--volt-text, #0A0A0A)" : "2px solid transparent",
              transition: "color 140ms ease, border-color 140ms ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              if (!isActive) el.style.color = "var(--volt-text, #0A0A0A)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              if (!isActive) el.style.color = "var(--volt-text-muted, #6B6B6B)";
            }}
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
