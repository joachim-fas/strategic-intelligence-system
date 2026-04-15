"use client";

/**
 * Sub-navigation for the Projekte area: Aktiv | Archiv.
 * Used on /projects and /projects/archive.
 *
 * Active tab gets a solid bottom border + bolder weight + darker text.
 * Inactive tab has a subtle hover state with background tint.
 */

interface Props {
  active: "active" | "archive";
  de: boolean;
}

export function SessionsSubNav({ active, de }: Props) {
  const tabs: Array<{ key: "active" | "archive"; href: string; label: string }> = [
    { key: "active",  href: "/projects",         label: de ? "Aktiv"  : "Active"  },
    { key: "archive", href: "/projects/archive", label: de ? "Archiv" : "Archive" },
  ];

  return (
    <nav
      aria-label={de ? "Projekt-Bereich" : "Projects area"}
      style={{
        display: "flex",
        gap: 4,
        marginTop: 4,
        marginBottom: -1,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <a
            key={t.key}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            style={{
              position: "relative",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 14,
              fontWeight: isActive ? 700 : 600,
              color: isActive ? "var(--volt-text, #0A0A0A)" : "var(--volt-text-muted, #6B6B6B)",
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 8,
              background: "transparent",
              transition: "all 150ms ease",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              if (!isActive) {
                el.style.color = "var(--volt-text, #0A0A0A)";
                el.style.background = "rgba(228,255,151,0.5)";
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              if (!isActive) {
                el.style.color = "var(--volt-text-muted, #6B6B6B)";
                el.style.background = "transparent";
              }
            }}
          >
            {t.label}
            {/* Volt UI active indicator: absolute bottom-0 inset-x-3 h-[2px] rounded-full */}
            {isActive && (
              <span style={{
                position: "absolute", bottom: 0, left: 12, right: 12,
                height: 2, borderRadius: 9999,
                background: "var(--volt-text, #0A0A0A)",
              }} />
            )}
          </a>
        );
      })}
    </nav>
  );
}
