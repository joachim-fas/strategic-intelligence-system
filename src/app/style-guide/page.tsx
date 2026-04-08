"use client";

// ─────────────────────────────────────────────────────────────────
// SIS DESIGN SYSTEM — VoltUI Style Guide
// >_ Design System · Black + Lime · Terminal Aesthetic
// Accessible at /style-guide during development
// ─────────────────────────────────────────────────────────────────

// ── Shared helper components ────────────────────────────────────

function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      style={{
        marginBottom: 72,
        paddingTop: 16,
        scrollMarginTop: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
          paddingBottom: 16,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: "var(--color-text-muted)",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </section>
  );
}

function TokenPill({ token }: { token: string }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
        fontSize: 10,
        background: "var(--pastel-orchid)",
        color: "var(--pastel-orchid-text)",
        border: "1px solid var(--pastel-orchid-border)",
        padding: "1px 6px",
        borderRadius: "var(--radius-xs)",
      }}
    >
      {token}
    </code>
  );
}

// ── Main page ────────────────────────────────────────────────────

export default function StyleGuide() {
  const navItems = [
    { label: ">_ Identity",          href: "#identity" },
    { label: "Colors",               href: "#colors" },
    { label: "Pastels",              href: "#pastels" },
    { label: "Signals",              href: "#signals" },
    { label: "Dark Mode",            href: "#dark-mode" },
    { label: "Typography",           href: "#typography" },
    { label: "Spacing & Radius",     href: "#spacing-radius" },
    { label: "Shadows",              href: "#shadows" },
    { label: "Buttons",              href: "#buttons" },
    { label: "Inputs",               href: "#inputs" },
    { label: "Badges & Chips",       href: "#badges-chips" },
    { label: "Cards",                href: "#cards" },
    { label: "Patterns",             href: "#patterns" },
    { label: ">_ Terminal",          href: "#terminal" },
    { label: "Animations",           href: "#animations" },
    { label: "Chart Colors",         href: "#chart-colors" },
    { label: "Principles",           href: "#principles" },
  ];

  return (
    <div
      style={{
        fontFamily: "var(--font-ui, 'DM Sans', system-ui)",
        background: "var(--color-page-bg)",
        minHeight: "100vh",
        color: "var(--color-text-primary)",
      }}
    >
      {/* ── STICKY HEADER ──────────────────────────────────────── */}
      <header
        style={{
          background: "#000000",
          color: "white",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: 56,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--color-lime)",
                letterSpacing: "-0.02em",
              }}
            >
              &gt;_
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "white",
                letterSpacing: "-0.01em",
              }}
            >
              Design System
            </span>
            <span
              className="badge badge-lime"
              style={{ fontSize: 10, letterSpacing: "0.08em" }}
            >
              VoltUI
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span
              style={{
                fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              v2.0
            </span>
            <a
              href="/"
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              ← Back to App
            </a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        {/* ── TABLE OF CONTENTS ────────────────────────────────── */}
        <nav
          style={{
            padding: "28px 0 32px",
            borderBottom: "1px solid var(--color-border)",
            marginBottom: 56,
          }}
        >
          <div
            className="section-label"
            style={{ marginBottom: 12 }}
          >
            Contents
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  fontFamily: item.label.startsWith(">_")
                    ? "var(--font-code, 'JetBrains Mono', monospace)"
                    : "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: item.label.startsWith(">_") ? "#000000" : "var(--color-text-secondary)",
                  textDecoration: "none",
                  padding: "4px 11px",
                  borderRadius: "var(--radius-full)",
                  border: item.label.startsWith(">_")
                    ? "1px solid var(--color-lime-deep)"
                    : "1px solid var(--color-border)",
                  background: item.label.startsWith(">_")
                    ? "var(--color-lime)"
                    : "var(--color-surface)",
                  letterSpacing: item.label.startsWith(">_") ? "0.02em" : "-0.01em",
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* ══════════════════════════════════════════════════════
            1. IDENTITY
        ══════════════════════════════════════════════════════ */}
        <Section id="identity" label="01 — Identity">
          {/* Hero >_ */}
          <div
            style={{
              background: "#000000",
              borderRadius: "var(--radius-2xl)",
              padding: "48px 48px 40px",
              marginBottom: 32,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle grid pattern */}
            <div
              className="pattern-grid"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.15,
                borderRadius: "var(--radius-2xl)",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: "clamp(64px, 12vw, 120px)",
                  fontWeight: 700,
                  color: "var(--color-lime)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.08em",
                }}
              >
                <span>&gt;_</span>
                <span
                  className="cursor-blink"
                  style={{
                    display: "inline-block",
                    width: "0.5em",
                    height: "0.85em",
                    background: "var(--color-lime)",
                    borderRadius: 2,
                    verticalAlign: "baseline",
                    opacity: 0.9,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading, 'Space Grotesk', system-ui)",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.03em",
                  marginBottom: 8,
                }}
              >
                VoltUI
              </div>
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  letterSpacing: "0.02em",
                }}
              >
                Terminal aesthetic · Black + Lime · Strategic Intelligence System
              </div>
            </div>
          </div>

          {/* Brand palette */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
            <div
              style={{
                background: "#000000",
                borderRadius: "var(--radius-xl)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 4,
                }}
              >
                Primary Brand
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading, 'Space Grotesk')",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "white",
                  letterSpacing: "-0.03em",
                }}
              >
                Black #000000
              </div>
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                var(--color-brand) · var(--color-text-heading)
              </div>
            </div>
            <div
              style={{
                background: "var(--color-lime)",
                borderRadius: "var(--radius-xl)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "rgba(0,0,0,0.4)",
                  marginBottom: 4,
                }}
              >
                Accent / Highlight
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading, 'Space Grotesk')",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#000000",
                  letterSpacing: "-0.03em",
                }}
              >
                Neon Lime #E4FF97
              </div>
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: 11,
                  color: "rgba(0,0,0,0.45)",
                }}
              >
                var(--color-lime) · var(--color-accent)
              </div>
            </div>
          </div>

          {/* Font stack */}
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
            }}
          >
            <div className="card-header">
              <span className="section-label" style={{ marginBottom: 0 }}>Font Stack</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                {
                  role: "Display / Headings",
                  fontVar: "var(--font-heading, 'Space Grotesk')",
                  name: "Space Grotesk",
                  sample: "Strategic Intelligence System",
                  sampleStyle: {
                    fontFamily: "var(--font-heading, 'Space Grotesk', system-ui)",
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "var(--color-text-heading)",
                    lineHeight: 1.1,
                  },
                  token: "--font-heading",
                  desc: "Used for all display text, heroes, page titles, card titles",
                },
                {
                  role: "UI / Body",
                  fontVar: "var(--font-ui, 'DM Sans')",
                  name: "DM Sans",
                  sample: "Clear, readable interface text for dashboards and data-dense views.",
                  sampleStyle: {
                    fontFamily: "var(--font-ui, 'DM Sans', system-ui)",
                    fontSize: 16,
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    color: "var(--color-text-primary)",
                    lineHeight: 1.65,
                  },
                  token: "--font-ui",
                  desc: "All body copy, UI labels, navigation, descriptions",
                },
                {
                  role: "Code / Data Labels",
                  fontVar: "var(--font-code, 'JetBrains Mono')",
                  name: "JetBrains Mono",
                  sample: ">_ query: AI-Regulierung · result: 847 signals · ring: ADOPT",
                  sampleStyle: {
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    color: "var(--color-text-primary)",
                    lineHeight: 1.5,
                  },
                  token: "--font-code",
                  desc: "Terminal prompts, section labels, metrics, data tables, code",
                },
              ].map((f) => (
                <div
                  key={f.role}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    gap: 24,
                    alignItems: "start",
                    paddingBottom: 24,
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: "var(--color-text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      {f.role}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--color-text-secondary)",
                        marginBottom: 6,
                      }}
                    >
                      {f.name}
                    </div>
                    <TokenPill token={f.token} />
                  </div>
                  <div>
                    <div style={f.sampleStyle as React.CSSProperties}>{f.sample}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        marginTop: 6,
                        fontFamily: "var(--font-ui)",
                      }}
                    >
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
              {/* Last item without bottom border */}
              <div style={{ marginTop: -24 }} />
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            2. COLORS
        ══════════════════════════════════════════════════════ */}
        <Section id="colors" label="02 — Colors">
          {/* Brand colors */}
          <div className="section-label" style={{ marginBottom: 16 }}>Brand Colors</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 32 }}>
            {[
              { token: "--color-brand",       hex: "#0A0A0A", name: "Brand Black",  textColor: "white"   },
              { token: "--color-lime",         hex: "#E4FF97", name: "Neon Lime",    textColor: "#000000" },
              { token: "--color-lime-hover",   hex: "#D4F080", name: "Lime Hover",   textColor: "#000000" },
              { token: "--color-lime-deep",    hex: "#C8F060", name: "Lime Deep",    textColor: "#000000" },
              { token: "--color-lime-light",   hex: "#F5FFE0", name: "Lime Light",   textColor: "#0A0A0A" },
            ].map((s) => (
              <div
                key={s.token}
                style={{
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    height: 72,
                    background: `var(${s.token})`,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "8px 10px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: s.textColor,
                      opacity: 0.7,
                    }}
                  >
                    {s.hex}
                  </span>
                </div>
                <div style={{ padding: "8px 10px", background: "var(--color-surface)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>{s.name}</div>
                  <TokenPill token={s.token} />
                </div>
              </div>
            ))}
          </div>

          {/* Text scale */}
          <div className="section-label" style={{ marginBottom: 16 }}>Text Scale</div>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              marginBottom: 32,
            }}
          >
            {[
              { token: "--color-text-heading",   hex: "#000000", label: "Heading",   sample: "Page Titles, Heroes" },
              { token: "--color-text-primary",    hex: "#0A0A0A", label: "Primary",   sample: "Body text, main content" },
              { token: "--color-text-secondary",  hex: "#3A3A3A", label: "Secondary", sample: "Supporting descriptions" },
              { token: "--color-text-subtle",     hex: "#6B6B6B", label: "Subtle",    sample: "Metadata, timestamps" },
              { token: "--color-text-muted",      hex: "#9B9B9B", label: "Muted",     sample: "Placeholders, disabled" },
            ].map((t, i) => (
              <div
                key={t.token}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 100px 1fr auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                  borderBottom: i < 4 ? "1px solid var(--color-border)" : undefined,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-sm)",
                    background: `var(${t.token})`,
                    border: "1px solid var(--color-border)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{t.label}</div>
                  <div style={{ fontFamily: "var(--font-code, monospace)", fontSize: 10, color: "var(--color-text-muted)" }}>{t.hex}</div>
                </div>
                <div style={{ fontSize: 15, color: `var(${t.token})`, fontWeight: 500 }}>{t.sample}</div>
                <TokenPill token={t.token} />
              </div>
            ))}
          </div>

          {/* Surface & Border scale */}
          <div className="section-label" style={{ marginBottom: 16 }}>Surface & Border Scale</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { token: "--color-surface",       hex: "#FFFFFF",  name: "Surface"       },
              { token: "--color-surface-2",      hex: "#F4F4F4",  name: "Surface 2"     },
              { token: "--color-page-bg",        hex: "#FFFFFF",  name: "Page BG"       },
              { token: "--color-border",         hex: "#E8E8E8",  name: "Border"        },
              { token: "--color-border-strong",  hex: "#CCCCCC",  name: "Border Strong" },
            ].map((s) => (
              <div
                key={s.token}
                style={{
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    height: 56,
                    background: `var(${s.token})`,
                    borderBottom: "1px solid var(--color-border)",
                  }}
                />
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontFamily: "var(--font-code, monospace)", fontSize: 10, color: "var(--color-text-muted)", marginBottom: 4 }}>{s.hex}</div>
                  <TokenPill token={s.token} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            3. PASTEL PALETTE
        ══════════════════════════════════════════════════════ */}
        <Section id="pastels" label="03 — Pastel Palette">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 24,
              fontFamily: "var(--font-ui)",
              lineHeight: 1.6,
            }}
          >
            8 atmospheric pastels — each with background, text, and border CSS variable tokens.
            Used for category badges, card accents, ring status indicators, and section highlights.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              {
                name: "Rose",
                bg: "--pastel-rose",
                text: "--pastel-rose-text",
                border: "--pastel-rose-border",
                hex: "#FFD6E0",
                desc: "Danger, negative attention",
              },
              {
                name: "Peach",
                bg: "--pastel-peach",
                text: "--pastel-peach-text",
                border: "--pastel-peach-border",
                hex: "#FFECD2",
                desc: "Warnings, heat signals",
              },
              {
                name: "Mint",
                bg: "--pastel-mint",
                text: "--pastel-mint-text",
                border: "--pastel-mint-border",
                hex: "#C3F4D3",
                desc: "Positive signals, Adopt ring",
              },
              {
                name: "Orchid",
                bg: "--pastel-orchid",
                text: "--pastel-orchid-text",
                border: "--pastel-orchid-border",
                hex: "#FDE2FF",
                desc: "Mega-Trends, Scenarios",
              },
              {
                name: "Blue",
                bg: "--pastel-blue",
                text: "--pastel-blue-text",
                border: "--pastel-blue-border",
                hex: "#D4E8FF",
                desc: "Macro-Trends, Trial ring",
              },
              {
                name: "Butter",
                bg: "--pastel-butter",
                text: "--pastel-butter-text",
                border: "--pastel-butter-border",
                hex: "#FFF5BA",
                desc: "Assess ring, caution",
              },
              {
                name: "Orange",
                bg: "--pastel-orange",
                text: "--pastel-orange-text",
                border: "--pastel-orange-border",
                hex: "#FFE0CC",
                desc: "Alerts, momentum signals",
              },
              {
                name: "Aqua",
                bg: "--pastel-aqua",
                text: "--pastel-aqua-text",
                border: "--pastel-aqua-border",
                hex: "#D6F5F5",
                desc: "Data, quantitative signals",
              },
            ].map((p) => (
              <div
                key={p.name}
                style={{
                  background: `var(${p.bg})`,
                  border: `1px solid var(${p.border})`,
                  borderRadius: "var(--radius-xl)",
                  padding: "20px 16px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: `var(${p.text})`,
                    marginBottom: 10,
                    fontFamily: "var(--font-heading, 'Space Grotesk')",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 9,
                    color: `var(${p.text})`,
                    opacity: 0.65,
                    marginBottom: 3,
                    lineHeight: 1.8,
                  }}
                >
                  <div>bg: {p.bg}</div>
                  <div>text: {p.text.replace("--pastel-", "--pastel-").replace("-text", "-text")}</div>
                  <div>border: {p.border}</div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: `var(${p.text})`,
                    opacity: 0.75,
                    marginBottom: 12,
                    marginTop: 6,
                  }}
                >
                  {p.desc}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span
                    className={`badge badge-${p.name.toLowerCase()}`}
                    style={{ fontSize: 10 }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 10,
                      fontFamily: "var(--font-code, monospace)",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "var(--radius-xs)",
                      background: `var(${p.bg})`,
                      color: `var(${p.text})`,
                      border: `1px solid var(${p.border})`,
                    }}
                  >
                    {p.hex}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            4. SIGNAL COLORS
        ══════════════════════════════════════════════════════ */}
        <Section id="signals" label="04 — Signal Colors">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            Semantic signal colors for data-driven contexts: positive (emerald), negative (coral), neutral (slate).
            Each signal has a light background, text color, and border token.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
            {[
              {
                name: "Positive",
                label: "Emerald",
                tokens: {
                  main: "--signal-positive",
                  light: "--signal-positive-light",
                  border: "--signal-positive-border",
                  text: "--signal-positive-text",
                },
                badgeClass: "badge-success",
                example: "↑ +12.4%",
                dot: "signal-positive-dot",
                badgeLabel: "signal-positive-badge",
              },
              {
                name: "Negative",
                label: "Coral",
                tokens: {
                  main: "--signal-negative",
                  light: "--signal-negative-light",
                  border: "--signal-negative-border",
                  text: "--signal-negative-text",
                },
                badgeClass: "badge-danger",
                example: "↓ −8.1%",
                dot: "signal-negative-dot",
                badgeLabel: "signal-negative-badge",
              },
              {
                name: "Neutral",
                label: "Slate",
                tokens: {
                  main: "--signal-neutral",
                  light: "--signal-neutral-light",
                  border: "--signal-neutral-border",
                  text: "--signal-neutral-text",
                },
                badgeClass: "badge-neutral",
                example: "→ Stable",
                dot: "signal-neutral-dot",
                badgeLabel: "signal-neutral-badge",
              },
            ].map((s) => (
              <div
                key={s.name}
                style={{
                  background: `var(${s.tokens.light})`,
                  border: `1px solid var(${s.tokens.border})`,
                  borderRadius: "var(--radius-xl)",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: `var(${s.tokens.main})`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: `var(${s.tokens.text})`,
                      fontFamily: "var(--font-heading, 'Space Grotesk')",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: `var(${s.tokens.text})`,
                      opacity: 0.6,
                    }}
                  >
                    ({s.label})
                  </span>
                </div>

                {/* Token list */}
                <div
                  style={{
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 9,
                    color: `var(${s.tokens.text})`,
                    opacity: 0.65,
                    lineHeight: 2,
                    marginBottom: 14,
                  }}
                >
                  {Object.values(s.tokens).map((t) => (
                    <div key={t}>{t}</div>
                  ))}
                </div>

                {/* Badge examples */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={`badge ${s.badgeClass}`}>{s.example}</span>
                  <span className={`badge ${s.badgeClass}`}>{s.name}</span>
                </div>

                {/* Mono example */}
                <div
                  style={{
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: `var(${s.tokens.text})`,
                    marginTop: 14,
                  }}
                >
                  {s.example}
                </div>
              </div>
            ))}
          </div>

          {/* Delta & value utilities */}
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xl)",
              padding: "20px 24px",
            }}
          >
            <div className="section-label" style={{ marginBottom: 16 }}>Delta & Value Utilities</div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", flex: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span className="delta-up">↑ +12.4%</span>
                  <TokenPill token=".delta-up" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span className="delta-down">↓ −8.1%</span>
                  <TokenPill token=".delta-down" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="delta-neutral">→ Stable</span>
                  <TokenPill token=".delta-neutral" />
                </div>
              </div>
              <div style={{ width: 1, height: 80, background: "var(--color-border)" }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span className="signal-positive-badge">↑ Positive Signal</span>
                  <TokenPill token=".signal-positive-badge" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span className="signal-negative-badge">↓ Negative Signal</span>
                  <TokenPill token=".signal-negative-badge" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="signal-neutral-badge">→ Neutral Signal</span>
                  <TokenPill token=".signal-neutral-badge" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            5. DARK MODE
        ══════════════════════════════════════════════════════ */}
        <Section id="dark-mode" label="05 — Dark Mode">
          <div
            style={{
              background: "#000000",
              borderRadius: "var(--radius-2xl)",
              padding: "32px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--color-lime)",
                marginBottom: 20,
              }}
            >
              .dark — Token Overrides
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
              }}
            >
              {[
                { label: "Background",  hex: "#000000", token: "--color-page-bg",    textColor: "#E4FF97" },
                { label: "Foreground",  hex: "#F5F5F5", token: "--color-text-primary", textColor: "#000000" },
                { label: "Card",        hex: "#111111", token: "--color-surface",     textColor: "#E4FF97" },
                { label: "Border",      hex: "#2A2A2A", token: "--color-border",      textColor: "#E4FF97" },
                { label: "Ring / Lime", hex: "#E4FF97", token: "--color-ring",        textColor: "#000000" },
              ].map((t) => (
                <div
                  key={t.token}
                  style={{
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      height: 60,
                      background: t.hex,
                      border: t.hex === "#000000" ? "1px solid rgba(255,255,255,0.1)" : undefined,
                      display: "flex",
                      alignItems: "flex-end",
                      padding: "6px 8px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 9,
                        fontWeight: 700,
                        color: t.textColor,
                        opacity: 0.75,
                      }}
                    >
                      {t.hex}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: "8px",
                      background: "#111111",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#F5F5F5",
                        marginBottom: 3,
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 9,
                        color: "rgba(228,255,151,0.5)",
                        lineHeight: 1.4,
                      }}
                    >
                      {t.token}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              background: "var(--pastel-butter)",
              border: "1px solid var(--pastel-butter-border)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
              fontSize: 13,
              color: "var(--pastel-butter-text)",
              fontFamily: "var(--font-ui)",
            }}
          >
            <strong>Activation:</strong> Dark mode is triggered by adding the <code style={{ fontFamily: "var(--font-code, monospace)", background: "rgba(0,0,0,0.1)", padding: "1px 4px", borderRadius: "var(--radius-xs)" }}>.dark</code> class to the{" "}
            <code style={{ fontFamily: "var(--font-code, monospace)", background: "rgba(0,0,0,0.1)", padding: "1px 4px", borderRadius: "var(--radius-xs)" }}>&lt;html&gt;</code> element.
            The VoltUI system uses CSS custom property overrides — no JS theming required.
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            6. TYPOGRAPHY
        ══════════════════════════════════════════════════════ */}
        <Section id="typography" label="06 — Typography">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 28,
              lineHeight: 1.65,
            }}
          >
            Three font roles, seven type sizes. Display and Heading use Space Grotesk with tight tracking.
            Body uses DM Sans. Labels and mono data use JetBrains Mono with uppercase tracking.
          </div>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
            }}
          >
            {[
              {
                cls: "text-display-xl",
                sample: "Display XL",
                font: "Space Grotesk",
                spec: "clamp(3rem→6rem) / 800 / −0.04em",
                usage: "Hero banner only",
              },
              {
                cls: "text-display-lg",
                sample: "Display Large — Strategic Intelligence",
                font: "Space Grotesk",
                spec: "clamp(2rem→3.5rem) / 700 / −0.03em",
                usage: "Page hero titles",
              },
              {
                cls: "text-display-md",
                sample: "Display Medium — Trend Analysis",
                font: "Space Grotesk",
                spec: "clamp(1.5rem→2.25rem) / 700 / −0.025em",
                usage: "Section heroes",
              },
              {
                cls: "text-heading-1",
                sample: "Heading 1 — AI & Automation",
                font: "Space Grotesk",
                spec: "24px / 700 / −0.03em",
                usage: "Page titles",
              },
              {
                cls: "text-heading-2",
                sample: "Heading 2 — Mega-Trends Overview",
                font: "Space Grotesk",
                spec: "18px / 700 / −0.02em",
                usage: "Section titles",
              },
              {
                cls: "text-heading-3",
                sample: "Heading 3 — Strategische Implikationen",
                font: "DM Sans",
                spec: "15px / 600 / −0.01em",
                usage: "Card titles",
              },
              {
                cls: "text-body-lg",
                sample: "Body Large — Die Trends zeigen eine klare strategische Richtung für 2025.",
                font: "DM Sans",
                spec: "16px / 400 / 1.65 lh",
                usage: "Lead paragraphs",
              },
              {
                cls: "text-body",
                sample: "Body — Weitere Analyse erforderlich um den vollständigen Kontext zu verstehen.",
                font: "DM Sans",
                spec: "15px / 400 / 1.65 lh",
                usage: "Primary reading text",
              },
              {
                cls: "text-body-sm",
                sample: "Body Small — Timestamp · Ring · Meta · Supporting text",
                font: "DM Sans",
                spec: "13px / 400 / 1.55 lh",
                usage: "Supporting metadata",
              },
              {
                cls: "text-label",
                sample: "SECTION LABEL — MONO CAPS",
                font: "JetBrains Mono",
                spec: "11px / 600 / 0.08em tracking / UPPERCASE",
                usage: "Section headers, field labels",
              },
              {
                cls: "text-caption",
                sample: "Caption — 12px muted helper text",
                font: "DM Sans",
                spec: "12px / 400 / muted color",
                usage: "Timestamps, micro-meta",
              },
              {
                cls: "text-mono",
                sample: ">_ query: signal_count = 847",
                font: "JetBrains Mono",
                spec: "13px / 400 / 1.5 lh",
                usage: "Code, terminal, data",
              },
            ].map((t, i) => (
              <div
                key={t.cls}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 180px",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  borderBottom: i < 11 ? "1px solid var(--color-border)" : undefined,
                }}
              >
                <div>
                  <span
                    className={t.cls}
                    style={{
                      color: "var(--color-text-heading)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {t.sample}
                  </span>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-ui)",
                      marginTop: 2,
                    }}
                  >
                    {t.usage}
                  </div>
                </div>
                <TokenPill token={`.${t.cls}`} />
                <div
                  style={{
                    fontFamily: "var(--font-code, monospace)",
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ color: "var(--color-text-subtle)", fontWeight: 600, marginBottom: 1 }}>{t.font}</div>
                  <div>{t.spec}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            7. SPACING & RADIUS
        ══════════════════════════════════════════════════════ */}
        <Section id="spacing-radius" label="07 — Spacing & Radius">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            {/* Spacing */}
            <div>
              <div className="section-label" style={{ marginBottom: 16 }}>Spacing Scale — 4px Base</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { n: 1,  px: 4  },
                  { n: 2,  px: 8  },
                  { n: 3,  px: 12 },
                  { n: 4,  px: 16 },
                  { n: 5,  px: 20 },
                  { n: 6,  px: 24 },
                  { n: 8,  px: 32 },
                  { n: 10, px: 40 },
                  { n: 12, px: 48 },
                ].map(({ n, px }) => (
                  <div
                    key={n}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: px,
                        height: 20,
                        background: "#000000",
                        borderRadius: 2,
                        flexShrink: 0,
                        minWidth: 2,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 12,
                        color: "var(--color-text-secondary)",
                        minWidth: 30,
                      }}
                    >
                      {px}px
                    </div>
                    <TokenPill token={`--space-${n}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Radius */}
            <div>
              <div className="section-label" style={{ marginBottom: 16 }}>Radius Scale</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { token: "--radius-xs",   px: "3px",    name: "xs",   usage: "Micro-badges, code tokens" },
                  { token: "--radius-sm",   px: "6px",    name: "sm",   usage: "Small badges, chips" },
                  { token: "--radius-md",   px: "8px",    name: "md",   usage: "Buttons, inputs" },
                  { token: "--radius-lg",   px: "12px",   name: "lg",   usage: "Cards, panels" },
                  { token: "--radius-xl",   px: "16px",   name: "xl",   usage: "Large panels, overlays" },
                  { token: "--radius-2xl",  px: "20px",   name: "2xl",  usage: "Hero cards, main cards" },
                  { token: "--radius-full", px: "9999px", name: "full", usage: "Pills, badges, tags" },
                ].map(({ token, px, name, usage }) => (
                  <div
                    key={token}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        background: "var(--color-lime)",
                        border: "1px solid var(--color-lime-deep)",
                        borderRadius: `var(${token})`,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                          marginBottom: 2,
                        }}
                      >
                        {px}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        {usage}
                      </div>
                      <TokenPill token={token} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            8. SHADOWS
        ══════════════════════════════════════════════════════ */}
        <Section id="shadows" label="08 — Shadows">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            VoltUI uses minimalist near-black shadows at low opacity — no blue-tinted box shadows.
            All four tokens use rgba(0,0,0) at 4–7% opacity for a warm, atmospheric depth.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {[
              { token: "--shadow-xs", name: "xs", usage: "Minimal lift", detail: "1px · 2px · 5%" },
              { token: "--shadow-sm", name: "sm", usage: "Cards at rest", detail: "1–3px · 7%" },
              { token: "--shadow-md", name: "md", usage: "Cards on hover", detail: "3–8px · 7%" },
              { token: "--shadow-lg", name: "lg", usage: "Modals, overlays", detail: "8–20px · 7%" },
            ].map(({ token, name, usage, detail }) => (
              <div
                key={token}
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-xl)",
                  boxShadow: `var(${token})`,
                  border: "1px solid var(--color-border)",
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-code, monospace)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: "var(--color-text-muted)",
                  }}
                >
                  shadow-{name}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {usage}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-code, monospace)",
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {detail}
                </div>
                <TokenPill token={token} />
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            9. BUTTONS
        ══════════════════════════════════════════════════════ */}
        <Section id="buttons" label="09 — Buttons">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            All button variants use the <code style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, background: "var(--pastel-orchid)", color: "var(--pastel-orchid-text)", padding: "1px 5px", borderRadius: "var(--radius-xs)" }}>.btn</code> base class
            with a modifier. The <code style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, background: "var(--pastel-mint)", color: "var(--pastel-mint-text)", padding: "1px 5px", borderRadius: "var(--radius-xs)" }}>&gt;_</code> prompt prefix
            reinforces terminal identity in primary actions.
          </div>

          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 180px 1fr",
                padding: "10px 20px",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
              }}
            >
              {["Variant", "Preview", "Class", "Usage"].map((h) => (
                <div
                  key={h}
                  className="section-label"
                  style={{ marginBottom: 0 }}
                >
                  {h}
                </div>
              ))}
            </div>
            {[
              {
                variant: "Primary",
                el: <button className="btn btn-primary">&gt;_ Analysieren</button>,
                cls: ".btn.btn-primary",
                usage: "Main CTA — black bg, white text",
              },
              {
                variant: "Lime",
                el: <button className="btn btn-lime">&gt;_ Run Analysis</button>,
                cls: ".btn.btn-lime",
                usage: "Positive action — lime bg, black text",
              },
              {
                variant: "Secondary",
                el: <button className="btn btn-secondary">+ Weitere</button>,
                cls: ".btn.btn-secondary",
                usage: "Alternative action — outline border",
              },
              {
                variant: "Ghost",
                el: <button className="btn btn-ghost">↻ Refresh</button>,
                cls: ".btn.btn-ghost",
                usage: "Subtle nav/toggle — transparent",
              },
            ].map(({ variant, el, cls, usage }, i) => (
              <div
                key={variant}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 180px 1fr",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  borderBottom: i < 3 ? "1px solid var(--color-border)" : undefined,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {variant}
                </div>
                <div>{el}</div>
                <TokenPill token={cls} />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{usage}</div>
              </div>
            ))}
          </div>

          {/* >_ prefix examples */}
          <div
            style={{
              background: "#000000",
              borderRadius: "var(--radius-xl)",
              padding: "24px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--color-lime)",
                marginBottom: 16,
              }}
            >
              &gt;_ Prefix Usage in Buttons
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-primary">&gt;_ Run Query</button>
              <button className="btn btn-lime">&gt;_ Analyze Signal</button>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 36,
                  padding: "0 16px",
                  borderRadius: "var(--radius-lg)",
                  background: "rgba(228,255,151,0.1)",
                  border: "1px solid rgba(228,255,151,0.25)",
                  color: "var(--color-lime)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-code, monospace)",
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                }}
              >
                &gt;_ Command
              </button>
              <div
                style={{
                  fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.3)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--color-lime)" }}>&gt;_</span>
                <span>Search signals...</span>
                <span
                  className="cursor-blink"
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 13,
                    background: "var(--color-lime)",
                    borderRadius: 1,
                    verticalAlign: "middle",
                  }}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            10. INPUTS
        ══════════════════════════════════════════════════════ */}
        <Section id="inputs" label="10 — Inputs">
          <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 560 }}>
            {/* Search bar — rest */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Search Bar — Rest State (.search-bar)</div>
              <div className="search-bar">
                <span
                  style={{
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--color-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  &gt;_
                </span>
                <span
                  style={{
                    flex: 1,
                    color: "var(--color-text-muted)",
                    fontSize: 15,
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  Frage stellen oder Stichwort eingeben…
                </span>
                <button className="btn btn-primary" style={{ height: 38, fontSize: 13 }}>
                  Analysieren
                </button>
              </div>
            </div>

            {/* Search bar — focus */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Search Bar — Focus State (lime glow ring)</div>
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid #000000",
                  borderRadius: "var(--radius-2xl)",
                  boxShadow: "0 0 0 3px rgba(228,255,151,0.55), var(--shadow-sm)",
                  height: 54,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 8px 0 16px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#000000",
                    flexShrink: 0,
                  }}
                >
                  &gt;_
                </span>
                <span
                  style={{
                    flex: 1,
                    color: "var(--color-text-primary)",
                    fontSize: 15,
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  KI-Regulierung Europa
                </span>
                <span
                  className="cursor-blink"
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 18,
                    background: "#000000",
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                <button className="btn btn-primary" style={{ height: 38, fontSize: 13 }}>
                  Analysieren
                </button>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  marginTop: 6,
                  fontFamily: "var(--font-code, monospace)",
                }}
              >
                border: #000 · box-shadow: 0 0 0 3px rgba(228,255,151,0.55)
              </p>
            </div>

            {/* Text input base */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Text Input (.input-base)</div>
              <input
                className="input-base"
                type="text"
                placeholder="Input placeholder text…"
                readOnly
              />
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            11. BADGES & CHIPS
        ══════════════════════════════════════════════════════ */}
        <Section id="badges-chips" label="11 — Badges & Chips">
          {/* Core badges */}
          <div className="section-label" style={{ marginBottom: 12 }}>Core Badges (.badge)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
            <span className="badge badge-lime">Lime</span>
            <span className="badge badge-brand">Brand</span>
            <span className="badge badge-success">Success</span>
            <span className="badge badge-warning">Warning</span>
            <span className="badge badge-danger">Danger</span>
            <span className="badge badge-neutral">Neutral</span>
          </div>

          {/* Pastel badges */}
          <div className="section-label" style={{ marginBottom: 12 }}>Pastel Badges</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
            <span className="badge badge-mint">Mint</span>
            <span className="badge badge-blue">Blue</span>
            <span className="badge badge-orchid">Orchid</span>
            <span className="badge badge-peach">Peach</span>
            <span className="badge badge-rose">Rose</span>
            <span className="badge badge-aqua">Aqua</span>
            <span className="badge" style={{ background: "var(--pastel-butter)", color: "var(--pastel-butter-text)", borderColor: "var(--pastel-butter-border)" }}>Butter</span>
            <span className="badge" style={{ background: "var(--pastel-orange)", color: "var(--pastel-orange-text)", borderColor: "var(--pastel-orange-border)" }}>Orange</span>
          </div>

          {/* Ring status badges */}
          <div className="section-label" style={{ marginBottom: 12 }}>Ring Status Badges (.ring-*)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
            <span className="badge ring-adopt">Adopt</span>
            <span className="badge ring-trial">Trial</span>
            <span className="badge ring-assess">Assess</span>
            <span className="badge ring-hold">Hold</span>
          </div>

          {/* Chips */}
          <div className="section-label" style={{ marginBottom: 12 }}>Chips (.chip)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="chip chip-brand">AI & Automation</span>
            <span className="chip chip-brand">Klimawandel</span>
            <span className="chip chip-neutral">Geopolitik</span>
            <span className="chip chip-neutral">Technologie</span>
            <span className="chip chip-neutral">Gesellschaft</span>
          </div>

          {/* Token reference table */}
          <div
            style={{
              marginTop: 24,
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 20px",
            }}
          >
            <div className="section-label" style={{ marginBottom: 12 }}>Class Reference</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                ".badge.badge-lime", ".badge.badge-brand", ".badge.badge-success",
                ".badge.badge-warning", ".badge.badge-danger", ".badge.badge-neutral",
                ".badge.badge-mint", ".badge.badge-blue", ".badge.badge-orchid",
                ".badge.badge-peach", ".badge.badge-rose", ".badge.badge-aqua",
                ".badge.ring-adopt", ".badge.ring-trial", ".badge.ring-assess",
                ".badge.ring-hold", ".chip.chip-brand", ".chip.chip-neutral",
              ].map((cls) => (
                <TokenPill key={cls} token={cls} />
              ))}
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            12. CARDS
        ══════════════════════════════════════════════════════ */}
        <Section id="cards" label="12 — Cards">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            {/* Standard card */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Standard (.card)</div>
              <div className="card">
                <div className="card-header">
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", letterSpacing: "-0.01em" }}>
                    AI-Regulierung EU
                  </span>
                  <span className="badge badge-mint" style={{ marginLeft: "auto" }}>Adopt</span>
                </div>
                <div className="card-body">
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.6,
                      marginBottom: 12,
                    }}
                  >
                    Regulatorische Anforderungen steigen. Compliance-Druck wächst branchenübergreifend.
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center" }}>
                    <span className="badge badge-blue">Makrotrend</span>
                    <span className="delta-up">↑ +18%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glass card */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Glass Variant (.glass)</div>
              <div
                style={{
                  background: "linear-gradient(135deg, var(--pastel-blue) 0%, var(--pastel-mint) 100%)",
                  borderRadius: "var(--radius-2xl)",
                  padding: 2,
                }}
              >
                <div
                  className="glass"
                  style={{
                    borderRadius: "var(--radius-xl)",
                    border: "1px solid rgba(255,255,255,0.6)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid rgba(255,255,255,0.4)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)" }}>
                      Glass Card
                    </span>
                    <span className="badge badge-orchid" style={{ marginLeft: "auto" }}>Featured</span>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-secondary)",
                        lineHeight: 1.6,
                        marginBottom: 12,
                      }}
                    >
                      Backdrop blur with 72% white opacity. Used for atmospheric overlays.
                    </div>
                    <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }}>
                      &gt;_ View
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dark card */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Dark / Brand Card</div>
              <div
                style={{
                  background: "#000000",
                  borderRadius: "var(--radius-2xl)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-code, monospace)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--color-lime)",
                    }}
                  >
                    &gt;_ Scenario
                  </span>
                  <span className="badge badge-lime" style={{ marginLeft: "auto", fontSize: 10 }}>Live</span>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.55)",
                      lineHeight: 1.6,
                      marginBottom: 14,
                    }}
                  >
                    Strategic scenario analysis using terminal aesthetic for premium context.
                  </div>
                  <button className="btn btn-lime" style={{ height: 32, fontSize: 12 }}>
                    &gt;_ Analyze
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            13. PATTERNS & BACKGROUNDS
        ══════════════════════════════════════════════════════ */}
        <Section id="patterns" label="13 — Patterns & Backgrounds">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { cls: "pattern-grid",  name: "Grid",       desc: "32px grid — used for hero sections" },
              { cls: "pattern-dots",  name: "Dots",       desc: "20px dot matrix — atmospheric fill" },
              { cls: "pattern-lines", name: "Lines (45°)", desc: "Diagonal hatching — textured backgrounds" },
              { cls: "pattern-cross", name: "Cross Grid",  desc: "16px fine grid — dense data areas" },
              { cls: "bg-grain-hero", name: "Grain Hero",  desc: "Lime base with radial overlays" },
              { cls: "bg-atmospheric", name: "Atmospheric", desc: "White + lime radial glow" },
            ].map(({ cls, name, desc }) => (
              <div
                key={cls}
                style={{
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  className={cls}
                  style={{
                    height: 100,
                    background: cls.startsWith("bg-") ? undefined : "var(--color-surface)",
                  }}
                />
                <div
                  style={{
                    padding: "10px 12px",
                    background: "var(--color-surface)",
                    borderTop: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 3 }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 5 }}>{desc}</div>
                  <TokenPill token={`.${cls}`} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            14. TERMINAL / >_ USAGE
        ══════════════════════════════════════════════════════ */}
        <Section id="terminal" label="14 — Terminal / >_ Identity">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 28,
              lineHeight: 1.65,
            }}
          >
            The <strong style={{ fontFamily: "var(--font-code, monospace)", color: "var(--color-text-primary)" }}>&gt;_</strong> prompt symbol is the core identity mark of VoltUI.
            It references the terminal cursor — signaling command, intelligence, and precision.
            It appears in search bars, section labels, button prefixes, and the system identity mark.
          </div>

          {/* Large identity display */}
          <div
            style={{
              background: "#000000",
              borderRadius: "var(--radius-2xl)",
              padding: "40px 40px 32px",
              marginBottom: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="pattern-cross"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.12,
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                {/* Search bar with >_ */}
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-code, monospace)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(228,255,151,0.4)",
                      marginBottom: 10,
                    }}
                  >
                    Search Bar Prefix
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "var(--radius-2xl)",
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "0 12px 0 16px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--color-lime)",
                      }}
                    >
                      &gt;_
                    </span>
                    <span style={{ flex: 1, color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "var(--font-ui)" }}>
                      Ask a strategic question…
                    </span>
                    <span
                      className="cursor-blink"
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 16,
                        background: "var(--color-lime)",
                        borderRadius: 1,
                      }}
                    />
                  </div>
                </div>

                {/* Section prompts */}
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-code, monospace)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(228,255,151,0.4)",
                      marginBottom: 10,
                    }}
                  >
                    Section Prompts
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {[
                      ">_ Trends — 12 active signals",
                      ">_ Scenarios — 4 strategic paths",
                      ">_ Radar — Adopt · Trial · Assess",
                    ].map((line) => (
                      <div
                        key={line}
                        style={{
                          fontFamily: "var(--font-code, monospace)",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ color: "var(--color-lime)" }}>&gt;_</span>
                        <span>{line.replace(">_ ", "")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Command palette style */}
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-code, monospace)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(228,255,151,0.4)",
                      marginBottom: 10,
                    }}
                  >
                    Command Palette Style
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "var(--radius-lg)",
                      overflow: "hidden",
                    }}
                  >
                    {[
                      { cmd: "analyze", desc: "Run signal analysis" },
                      { cmd: "radar --ring adopt", desc: "Filter Adopt ring" },
                      { cmd: "scenario --new", desc: "Create new scenario" },
                    ].map(({ cmd, desc }) => (
                      <div
                        key={cmd}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span style={{ color: "var(--color-lime)", fontFamily: "var(--font-code, monospace)", fontSize: 11, fontWeight: 700 }}>&gt;_</span>
                        <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{cmd}</span>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inline query display */}
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-code, monospace)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(228,255,151,0.4)",
                      marginBottom: 10,
                    }}
                  >
                    Inline Query Display
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        borderRadius: "var(--radius-lg)",
                        background: "rgba(228,255,151,0.08)",
                        border: "1px solid rgba(228,255,151,0.15)",
                        width: "fit-content",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, fontWeight: 700, color: "var(--color-lime)" }}>&gt;_</span>
                      <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>KI-Regulierung Europa</span>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        borderRadius: "var(--radius-lg)",
                        background: "rgba(228,255,151,0.08)",
                        border: "1px solid rgba(228,255,151,0.15)",
                        width: "fit-content",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, fontWeight: 700, color: "var(--color-lime)" }}>&gt;_</span>
                      <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>signal_count: 847 · ring: ADOPT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Light mode examples */}
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xl)",
              padding: "24px",
            }}
          >
            <div className="section-label" style={{ marginBottom: 16 }}>Light Mode Usage</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-code, monospace)",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--color-text-heading)",
                  letterSpacing: "-0.03em",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>&gt;_</span>
                <span
                  className="cursor-blink"
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 20,
                    background: "var(--color-text-heading)",
                    borderRadius: 1,
                    verticalAlign: "middle",
                  }}
                />
              </div>
              <div style={{ width: 1, height: 40, background: "var(--color-border)" }} />
              <button className="btn btn-primary">&gt;_ Analysieren</button>
              <button className="btn btn-lime">&gt;_ Run Query</button>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, fontWeight: 700, color: "var(--color-text-heading)" }}>&gt;_</span>
                <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, color: "var(--color-text-subtle)" }}>active query</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            15. ANIMATIONS
        ══════════════════════════════════════════════════════ */}
        <Section id="animations" label="15 — Animations">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            {/* breathe */}
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-xl)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div className="section-label" style={{ marginBottom: 0, alignSelf: "flex-start" }}>
                .animate-breathe
              </div>
              <div
                className="animate-breathe"
                style={{
                  width: 64,
                  height: 64,
                  background: "var(--color-lime)",
                  borderRadius: "var(--radius-xl)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-code, monospace)",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#000",
                }}
              >
                &gt;_
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
                Slow scale + translate loop. 8s ease-in-out infinite.
              </p>
            </div>

            {/* cursor-blink */}
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-xl)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div className="section-label" style={{ marginBottom: 0, alignSelf: "flex-start" }}>
                .cursor-blink
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-code, monospace)",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "var(--color-text-heading)",
                }}
              >
                <span>&gt;_</span>
                <span
                  className="cursor-blink"
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 28,
                    background: "var(--color-text-heading)",
                    borderRadius: 1,
                    verticalAlign: "middle",
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
                1s step-end infinite. Terminal cursor blink.
              </p>
            </div>

            {/* delay classes */}
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-xl)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div className="section-label" style={{ marginBottom: 0 }}>Delay Classes</div>
              {[
                { cls: ".delay-100", delay: "1s",  label: "1s delay" },
                { cls: ".delay-200", delay: "2s",  label: "2s delay" },
              ].map((d) => (
                <div key={d.cls} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    className="animate-breathe"
                    style={{
                      animationDelay: d.delay,
                      width: 32,
                      height: 32,
                      background: "var(--pastel-mint)",
                      border: "1px solid var(--pastel-mint-border)",
                      borderRadius: "var(--radius-md)",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <TokenPill token={d.cls} />
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>{d.label}</div>
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                Combine with .animate-breathe for staggered entrance effects.
              </p>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            16. CHART COLORS
        ══════════════════════════════════════════════════════ */}
        <Section id="chart-colors" label="16 — Chart Colors">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-subtle)",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            8 chart tokens map to the 8 pastels in light mode and to a neon palette in dark mode.
            Used for trend lines, ring segments, bar charts, and radar arcs.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Light mode */}
            <div>
              <div className="section-label" style={{ marginBottom: 14 }}>Light Mode — Pastel Mapping</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { n: 1, pastel: "--pastel-rose",   name: "Rose",   hex: "#FFD6E0" },
                  { n: 2, pastel: "--pastel-peach",  name: "Peach",  hex: "#FFECD2" },
                  { n: 3, pastel: "--pastel-mint",   name: "Mint",   hex: "#C3F4D3" },
                  { n: 4, pastel: "--pastel-orchid", name: "Orchid", hex: "#FDE2FF" },
                  { n: 5, pastel: "--pastel-blue",   name: "Blue",   hex: "#D4E8FF" },
                  { n: 6, pastel: "--pastel-butter", name: "Butter", hex: "#FFF5BA" },
                  { n: 7, pastel: "--pastel-orange", name: "Orange", hex: "#FFE0CC" },
                  { n: 8, pastel: "--pastel-aqua",   name: "Aqua",   hex: "#D6F5F5" },
                ].map(({ n, pastel, name, hex }) => (
                  <div
                    key={n}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 20,
                        background: `var(${pastel})`,
                        borderRadius: "var(--radius-xs)",
                        border: "1px solid var(--color-border)",
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        width: 60,
                      }}
                    >
                      --chart-{n}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{name}</div>
                    <div style={{ marginLeft: "auto" }}>
                      <TokenPill token={pastel} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dark mode */}
            <div>
              <div className="section-label" style={{ marginBottom: 14 }}>Dark Mode — Neon Palette</div>
              <div
                style={{
                  background: "#000000",
                  borderRadius: "var(--radius-xl)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {[
                  { n: 1, hex: "#E4FF97", name: "Neon Lime"   },
                  { n: 2, hex: "#80F0D0", name: "Neon Aqua"   },
                  { n: 3, hex: "#F090E0", name: "Neon Orchid" },
                  { n: 4, hex: "#80D0FF", name: "Neon Blue"   },
                  { n: 5, hex: "#FFD080", name: "Neon Butter" },
                  { n: 6, hex: "#FF9080", name: "Neon Coral"  },
                  { n: 7, hex: "#C0F0A0", name: "Neon Mint"   },
                  { n: 8, hex: "#F0D0FF", name: "Neon Lavender" },
                ].map(({ n, hex, name }) => (
                  <div
                    key={n}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 20,
                        background: hex,
                        borderRadius: "var(--radius-xs)",
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 10,
                        color: "rgba(228,255,151,0.5)",
                        width: 60,
                      }}
                    >
                      --chart-{n}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{name}</div>
                    <div
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-code, monospace)",
                        fontSize: 10,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {hex}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            17. DESIGN PRINCIPLES
        ══════════════════════════════════════════════════════ */}
        <Section id="principles" label="17 — Design Principles">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              {
                symbol: ">_",
                title: "Terminal Aesthetic",
                body: "The >_ prompt is the identity mark. Every interaction is a command. JetBrains Mono for data, labels, and prompts — precision over decoration.",
                accent: "var(--color-lime)",
                bg: "#000000",
                titleColor: "white",
                bodyColor: "rgba(255,255,255,0.55)",
                symbolColor: "var(--color-lime)",
              },
              {
                symbol: "◼",
                title: "Black + Lime Identity",
                body: "#000000 and #E4FF97 are the two primary brand colors. No other hues compete for primary brand expression. Pastels are atmospheric, not brand.",
                accent: "var(--color-lime)",
                bg: "var(--color-lime)",
                titleColor: "#000000",
                bodyColor: "rgba(0,0,0,0.6)",
                symbolColor: "#000000",
              },
              {
                symbol: "◎",
                title: "Atmospheric Pastels",
                body: "8 pastels create warmth without noise. They communicate category, status, and signal type — never used as primary UI chrome.",
                accent: "var(--pastel-orchid-border)",
                bg: "var(--pastel-orchid)",
                titleColor: "var(--pastel-orchid-text)",
                bodyColor: "var(--pastel-orchid-text)",
                symbolColor: "var(--pastel-orchid-text)",
              },
              {
                symbol: "⌗",
                title: "Mono for Data",
                body: "JetBrains Mono renders all numeric data, metrics, deltas, and query strings. Tabular figures for alignment. Never use DM Sans for numbers in dashboards.",
                accent: "var(--pastel-blue-border)",
                bg: "var(--pastel-blue)",
                titleColor: "var(--pastel-blue-text)",
                bodyColor: "var(--pastel-blue-text)",
                symbolColor: "var(--pastel-blue-text)",
              },
              {
                symbol: "↑",
                title: "Minimalist Shadows",
                body: "Four shadow tokens — all using near-black rgba(0,0,0) at 4–7%. No blue-tinted or colored shadows. Depth without theatrical drama.",
                accent: "var(--pastel-mint-border)",
                bg: "var(--pastel-mint)",
                titleColor: "var(--pastel-mint-text)",
                bodyColor: "var(--pastel-mint-text)",
                symbolColor: "var(--pastel-mint-text)",
              },
              {
                symbol: "§",
                title: "Quality Over Features",
                body: "Every token, component, and pattern earns its place. No arbitrary variants. The design system is a precision instrument — not a component library for its own sake.",
                accent: "var(--pastel-butter-border)",
                bg: "var(--pastel-butter)",
                titleColor: "var(--pastel-butter-text)",
                bodyColor: "var(--pastel-butter-text)",
                symbolColor: "var(--pastel-butter-text)",
              },
            ].map(({ symbol, title, body, bg, titleColor, bodyColor, symbolColor }) => (
              <div
                key={title}
                style={{
                  background: bg,
                  borderRadius: "var(--radius-2xl)",
                  padding: "24px 20px 20px",
                  border: bg === "#000000" ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                    fontSize: 24,
                    fontWeight: 700,
                    color: symbolColor,
                    lineHeight: 1,
                  }}
                >
                  {symbol}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-heading, 'Space Grotesk')",
                    fontSize: 15,
                    fontWeight: 700,
                    color: titleColor,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: bodyColor,
                    fontFamily: "var(--font-ui, 'DM Sans')",
                  }}
                >
                  {body}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: 32,
            paddingBottom: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-text-heading)",
              }}
            >
              &gt;_
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              VoltUI Design System
            </span>
            <span className="badge badge-lime" style={{ fontSize: 10 }}>v2.0</span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
              fontSize: 11,
              color: "var(--color-text-muted)",
            }}
          >
            Strategic Intelligence System · SIS
          </div>
        </div>
      </div>
    </div>
  );
}
