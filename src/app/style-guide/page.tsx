"use client";

// ─────────────────────────────────────────────────────────────────
// SIS DESIGN SYSTEM — Style Guide
// Grain UI · Atmospheric Edition · v2
// Accessible at /style-guide during development
// ─────────────────────────────────────────────────────────────────

export default function StyleGuide() {
  return (
    <div style={{ fontFamily: "var(--font-ui, 'DM Sans', system-ui)", background: "#FAFAFA", minHeight: "100vh" }}>
      {/* Guide header */}
      <div style={{ background: "#000000", color: "white", padding: "16px 40px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>SIS</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Design System</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "#E4FF97", color: "#0A0A0A", fontWeight: 700, letterSpacing: "0.05em" }}>Grain UI</span>
          </div>
          <a href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>← Back to App</a>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 40px 80px" }}>

        {/* ── TABLE OF CONTENTS ───────────────────────────────── */}
        <nav style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", marginBottom: 8 }}>Contents</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {["Colors", "Pastels", "Signal Colors", "Typography", "Spacing & Radius", "Shadows", "Buttons", "Inputs", "Badges & Chips", "Cards", "Info Blocks", "Scenario Cards", "Feed Items", "Layout Grid"].map(name => (
              <a key={name} href={`#${name.toLowerCase().replace(/\s+&?\s*/g, "-")}`}
                style={{ fontSize: 12, color: "#0A0A0A", textDecoration: "none", padding: "4px 10px", borderRadius: 9999, border: "1px solid #D0D0D0", background: "#E4FF97", fontWeight: 500 }}>
                {name}
              </a>
            ))}
          </div>
        </nav>

        {/* ── 1. BRAND COLORS ────────────────────────────────── */}
        <Section id="colors" title="1. Brand Colors">
          <div style={{ marginBottom: 12, fontSize: 13, color: "#6B6B6B" }}>
            The Grain UI palette: <strong>Black #000000</strong> as primary brand, <strong>Neon Lime #E4FF97</strong> as accent, neutral grays for text/surface.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 24 }}>
            <ColorGroup label="Brand — Black & Lime" swatches={[
              { token: "--grain-black",   hex: "#000000", name: "Grain Black", textColor: "white" },
              { token: "--grain-lime",    hex: "#E4FF97", name: "Neon Lime" },
              { token: "--grain-lime-mid",hex: "#F0FFCA", name: "Lime Mid" },
            ]} />
            <ColorGroup label="Text — Grain Scale" swatches={[
              { token: "--text-heading",   hex: "#1A1A1A", name: "Heading" },
              { token: "--text-primary",   hex: "#3A3A3A", name: "Primary" },
              { token: "--text-secondary", hex: "#6B6B6B", name: "Secondary" },
              { token: "--text-muted",     hex: "#9B9B9B", name: "Muted" },
              { token: "--text-disabled",  hex: "#C0C0C0", name: "Disabled" },
            ]} />
            <ColorGroup label="Surface & Border" swatches={[
              { token: "--surface-white",  hex: "#FFFFFF", name: "White" },
              { token: "--surface-base",   hex: "#FAFAFA", name: "Base / Page BG" },
              { token: "--surface-subtle", hex: "#F5F5F5", name: "Subtle" },
              { token: "--border-default", hex: "#E8E8E8", name: "Border" },
              { token: "--border-strong",  hex: "#D0D0D0", name: "Border Strong" },
            ]} />
          </div>
        </Section>

        {/* ── 2. PASTEL PALETTE ──────────────────────────────── */}
        <Section id="pastels" title="2. Pastel Palette">
          <div style={{ marginBottom: 12, fontSize: 13, color: "#6B6B6B" }}>
            8 atmospheric pastels — used for category badges, section highlights, and card accents. Each has a background, text, and border variant.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { name: "Rose",   bg: "#FFD4D4", color: "#9B1C1C", border: "#F4A0A0",  desc: "Danger, negative signals" },
              { name: "Peach",  bg: "#FFE5CC", color: "#7A3510", border: "#F4B077",  desc: "Warnings, heat signals" },
              { name: "Mint",   bg: "#C3F4D3", color: "#0F6038", border: "#6FD99A",  desc: "Positive, Adopt ring" },
              { name: "Orchid", bg: "#FDE2FF", color: "#7C1A9E", border: "#D4A0F0",  desc: "Mega-Trends, Scenarios" },
              { name: "Blue",   bg: "#D4E8FF", color: "#1A4A8A", border: "#80B8F0",  desc: "Makro-Trends, Trial ring" },
              { name: "Butter", bg: "#FFF5BA", color: "#7A5C00", border: "#E0C840",  desc: "Assess ring, caution" },
              { name: "Orange", bg: "#FFE5B4", color: "#7A4010", border: "#F4C077",  desc: "Alerts, momentum" },
              { name: "Aqua",   bg: "#D4F4F4", color: "#0A6060", border: "#6FD9D9",  desc: "Data, quantitative" },
            ].map(({ name, bg, color, border, desc }) => (
              <div key={name} style={{ padding: 16, borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color, opacity: 0.8, marginBottom: 4 }}>bg: {bg}</div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color, opacity: 0.8, marginBottom: 8 }}>text: {color}</div>
                <div style={{ fontSize: 11, color, opacity: 0.7 }}>{desc}</div>
                <span style={{ display: "inline-block", marginTop: 8, padding: "2px 8px", borderRadius: 9999, background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 600 }}>
                  {name} Badge
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 3. SIGNAL COLORS ───────────────────────────────── */}
        <Section id="signal-colors" title="3. Signal Colors">
          <div style={{ marginBottom: 12, fontSize: 13, color: "#6B6B6B" }}>
            Semantic colors for positive/negative/neutral signals. Used in score bars, delta indicators, and status badges.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { name: "Smaragd (Positive)", bg: "#C3F4D3", color: "#1A9E5A", border: "#6FD99A", label: "--signal-positive", example: "+12%  ▲ Rising" },
              { name: "Koralle (Negative)", bg: "#FDEEE9", color: "#E8402A", border: "#F4A090", label: "--signal-negative", example: "−8%   ▼ Falling" },
              { name: "Slate (Neutral)",    bg: "#F0F2F7", color: "#6B7A9A", border: "#C0C8D8", label: "--signal-neutral",  example: "—     Stable" },
            ].map(({ name, bg, color, border, label, example }) => (
              <div key={name} style={{ padding: 20, borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color, opacity: 0.8, marginBottom: 12 }}>{label}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 9999, background: bg, border: `1px solid ${border}`, color, fontSize: 12, fontWeight: 600 }}>Badge</span>
                  <span style={{ padding: "4px 10px", borderRadius: 9999, background: "white", border: `1px solid ${border}`, color, fontSize: 12, fontWeight: 600 }}>Outlined</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, fontFamily: "monospace", color, fontWeight: 600 }}>{example}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 4. TYPOGRAPHY ──────────────────────────────────── */}
        <Section id="typography" title="4. Typography">
          <div style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 24 }}>
            <strong>4 font roles</strong>: <code style={{ background: "#F5F5F5", padding: "2px 6px", borderRadius: 4 }}>font-display</code> (Bricolage Grotesque — heroes, large titles) ·{" "}
            <code style={{ background: "#F5F5F5", padding: "2px 6px", borderRadius: 4 }}>font-ui</code> (DM Sans — all UI text) ·{" "}
            <code style={{ background: "#F5F5F5", padding: "2px 6px", borderRadius: 4 }}>font-body</code> (Lora — long-form editorial) ·{" "}
            <code style={{ background: "#F5F5F5", padding: "2px 6px", borderRadius: 4 }}>font-mono</code> (JetBrains Mono — code, labels, metrics)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { cls: "text-display-xl", sample: "Display XL — Strategic Intelligence", font: "Bricolage Grotesque", size: "48px / 700", usage: "Hero banner" },
              { cls: "text-display-lg", sample: "Display LG — Trend Analysis", font: "Bricolage Grotesque", size: "36px / 700", usage: "Page hero" },
              { cls: "text-display-md", sample: "Display MD — Scenario Overview", font: "Bricolage Grotesque", size: "28px / 600", usage: "Section hero" },
              { cls: "text-heading-1",  sample: "Heading 1 — AI & Automation",  font: "DM Sans", size: "24px / 700", usage: "Page titles" },
              { cls: "text-heading-2",  sample: "Heading 2 — Mega-Trends",       font: "DM Sans", size: "18px / 600", usage: "Section titles" },
              { cls: "text-heading-3",  sample: "Heading 3 — Strategische Implikationen", font: "DM Sans", size: "15px / 600", usage: "Card titles" },
              { cls: "text-body-lg",    sample: "Body Large — Die Trends zeigen eine klare Richtung.", font: "DM Sans", size: "16px / 400", usage: "Lead text" },
              { cls: "text-body",       sample: "Body — Weitere Analyse erforderlich um Kontext zu verstehen.", font: "DM Sans", size: "15px / 400", usage: "Primary reading" },
              { cls: "text-body-sm",    sample: "Body Small — Timestamp · Ring · Meta", font: "DM Sans", size: "13px / 400", usage: "Supporting text" },
              { cls: "text-label",      sample: "SECTION LABEL — MONO CAPS", font: "JetBrains Mono", size: "10px / 700", usage: "Section headers, field labels" },
              { cls: "text-caption",    sample: "Caption — 12px DM Sans", font: "DM Sans", size: "12px / 400", usage: "Timestamps, micro-meta" },
            ].map(({ cls, sample, font, size, usage }) => (
              <div key={cls} style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 160px", alignItems: "baseline", gap: 16, paddingBottom: 16, borderBottom: "1px solid #E8E8E8" }}>
                <span className={cls} style={{ color: "#1A1A1A" }}>{sample}</span>
                <code style={{ fontSize: 10, color: "#7C1A9E", background: "#FDE2FF", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>.{cls}</code>
                <span style={{ fontSize: 10, color: "#9B9B9B", fontFamily: "monospace" }}>{font}</span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>{usage} · {size}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 5. SPACING & RADIUS ────────────────────────────── */}
        <Section id="spacing-radius" title="5. Spacing & Radius">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 12 }}>Spacing Scale (4px base)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3,4,5,6,8,10,12].map(n => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: n * 4, height: 16, background: "#000000", borderRadius: 2, minWidth: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#6B6B6B" }}>{n * 4}px</span>
                    <code style={{ fontSize: 10, color: "#9B9B9B", fontFamily: "monospace" }}>--space-{n}</code>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 12 }}>Border Radius Scale</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { token: "--radius-xs",   px: "4px",    name: "xs — micro-badges, tags" },
                  { token: "--radius-sm",   px: "6px",    name: "sm — small badges, chips" },
                  { token: "--radius-md",   px: "10px",   name: "md — buttons, inputs" },
                  { token: "--radius-lg",   px: "14px",   name: "lg — cards (primary)" },
                  { token: "--radius-xl",   px: "20px",   name: "xl — panels, overlays" },
                  { token: "--radius-full", px: "9999px", name: "full — pills, tags" },
                ].map(({ token, px, name }) => (
                  <div key={token} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: "#E4FF97", border: "1px solid #D0D0D0", borderRadius: px, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: "#1A1A1A" }}>{px}</div>
                      <div style={{ fontSize: 11, color: "#6B6B6B" }}>{name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 6. SHADOWS ─────────────────────────────────────── */}
        <Section id="shadows" title="6. Shadows">
          <div style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 20 }}>
            Grain shadows use near-black (<code>#1A1A1A</code>) at low opacity for a warm, atmospheric depth — not blue-tinted.
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { token: "--shadow-xs", name: "xs", usage: "Minimal lift — badges, chips" },
              { token: "--shadow-sm", name: "sm", usage: "Cards at rest" },
              { token: "--shadow-md", name: "md", usage: "Cards on hover, panels" },
              { token: "--shadow-lg", name: "lg", usage: "Modals, overlays, flyouts" },
            ].map(({ token, name, usage }) => (
              <div key={token} style={{ width: 160, height: 100, background: "white", borderRadius: 14, boxShadow: `var(${token})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #F0F0F0" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>shadow-{name}</span>
                <span style={{ fontSize: 11, color: "#9B9B9B", marginTop: 4, textAlign: "center", padding: "0 12px" }}>{usage}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 7. BUTTONS ─────────────────────────────────────── */}
        <Section id="buttons" title="7. Buttons">
          <div style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 16 }}>
            Primary uses black + lime. Secondary uses transparent with black border. Ghost is minimal.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E8E8E8" }}>
                {["Variant", "Preview", "Class", "Usage"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9B9B9B", fontFamily: "monospace" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { variant: "Primary",   cls: ".btn.btn-primary",   el: <button className="btn btn-primary">Analysieren →</button>,   usage: "Main action (submit, confirm)" },
                { variant: "Secondary", cls: ".btn.btn-secondary",  el: <button className="btn btn-secondary">+ Weitere</button>,      usage: "Alternative, less emphasis" },
                { variant: "Ghost",     cls: ".btn.btn-ghost",      el: <button className="btn btn-ghost">↻ Refresh</button>,          usage: "Subtle action (nav, toggle)" },
              ].map(({ variant, cls, el, usage }) => (
                <tr key={variant} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "12px" }}>{variant}</td>
                  <td style={{ padding: "12px" }}>{el}</td>
                  <td style={{ padding: "12px" }}><code style={{ fontSize: 10, color: "#7C1A9E", background: "#FDE2FF", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{cls}</code></td>
                  <td style={{ padding: "12px", color: "#6B6B6B", fontSize: 12 }}>{usage}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Inline black button examples */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 12 }}>Inline Variants</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button style={{ padding: "8px 16px", borderRadius: 9999, background: "#000", color: "#E4FF97", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Black + Lime</button>
              <button style={{ padding: "8px 16px", borderRadius: 9999, background: "#E4FF97", color: "#000", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Lime + Black</button>
              <button style={{ padding: "6px 14px", borderRadius: 9999, background: "#FFF5BA", color: "#7A5C00", fontSize: 12, fontWeight: 600, border: "1px solid #E0C840", cursor: "pointer" }}>Butter</button>
              <button style={{ padding: "6px 14px", borderRadius: 9999, background: "#C3F4D3", color: "#0F6038", fontSize: 12, fontWeight: 600, border: "1px solid #6FD99A", cursor: "pointer" }}>Mint</button>
              <button style={{ padding: "6px 14px", borderRadius: 9999, background: "#FDE2FF", color: "#7C1A9E", fontSize: 12, fontWeight: 600, border: "1px solid #D4A0F0", cursor: "pointer" }}>Orchid</button>
              <button style={{ padding: "6px 14px", borderRadius: 9999, background: "#FDEEE9", color: "#C0341D", fontSize: 12, fontWeight: 600, border: "1px solid #F4A090", cursor: "pointer" }}>Coral</button>
            </div>
          </div>
        </Section>

        {/* ── 8. INPUTS ──────────────────────────────────────── */}
        <Section id="inputs" title="8. Inputs">
          <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 8 }}>Default — Rest State</div>
              <div style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow-sm)" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#9B9B9B", flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <span style={{ flex: 1, color: "#9B9B9B", fontSize: 15 }}>Frage stellen oder Stichwort eingeben…</span>
                <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>Analysieren →</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 8 }}>Focus State — Black border + lime glow</div>
              <div style={{ background: "white", border: "1px solid #000000", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 0 0 3px rgba(228,255,151,0.5), var(--shadow-sm)" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#000000", flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <span style={{ flex: 1, color: "#1A1A1A", fontSize: 15 }}>KI-Regulierung Europa</span>
                <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>Analysieren →</button>
              </div>
              <p style={{ fontSize: 12, color: "#9B9B9B", marginTop: 6 }}>
                Focus: black border + <code style={{ fontFamily: "monospace" }}>0 0 0 3px rgba(228,255,151,0.5)</code> lime glow ring.
              </p>
            </div>
          </div>
        </Section>

        {/* ── 9. BADGES & CHIPS ──────────────────────────────── */}
        <Section id="badges-chips" title="9. Badges & Chips">
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 10 }}>Signal Badges</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#C3F4D3", color: "#0F6038", fontSize: 12, fontWeight: 600 }}>▲ 85% · Rising</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#FFF5BA", color: "#7A5C00", fontSize: 12, fontWeight: 600 }}>— 62% · Stable</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#FDEEE9", color: "#C0341D", fontSize: 12, fontWeight: 600 }}>▼ 31% · Falling</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 10 }}>Ring Badges</div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#C3F4D3", color: "#0F6038", fontSize: 12, fontWeight: 600 }}>Adopt</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#D4E8FF", color: "#1A4A8A", fontSize: 12, fontWeight: 600 }}>Trial</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#FFF5BA", color: "#7A5C00", fontSize: 12, fontWeight: 600 }}>Assess</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#F0F2F7", color: "#3A4560", fontSize: 12, fontWeight: 600 }}>Hold</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 10 }}>Category Badges</div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#FDE2FF", color: "#7C1A9E", fontSize: 12, fontWeight: 600 }}>Mega-Trend</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#D4E8FF", color: "#1A4A8A", fontSize: 12, fontWeight: 600 }}>Makro-Trend</span>
                <span style={{ padding: "3px 10px", borderRadius: 9999, background: "#F0F2F7", color: "#3A4560", fontSize: 12, fontWeight: 600 }}>Mikro-Trend</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 10 }}>Chips — Interactive</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ padding: "5px 12px", borderRadius: 9999, background: "#E4FF97", color: "#0A0A0A", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>→ Folgefrage 1</button>
                <button style={{ padding: "5px 12px", borderRadius: 9999, background: "#F5F5F5", color: "#3A3A3A", fontSize: 12, border: "1px solid #E8E8E8", cursor: "pointer" }}>AI Regulierung</button>
                <button style={{ padding: "5px 12px", borderRadius: 9999, background: "#F5F5F5", color: "#3A3A3A", fontSize: 12, border: "1px solid #E8E8E8", cursor: "pointer" }}>Taiwan</button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 10. CARDS ──────────────────────────────────────── */}
        <Section id="cards" title="10. Cards">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 8 }}>Standard Card</div>
              <div style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>Iran Geopolitik</span>
                  <span style={{ padding: "2px 8px", borderRadius: 9999, background: "#C3F4D3", color: "#0F6038", fontSize: 11, fontWeight: 700 }}>84%</span>
                  <span style={{ fontSize: 12, color: "#9B9B9B" }}>13:22</span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <p style={{ fontSize: 14, color: "#3A3A3A", margin: "0 0 14px", lineHeight: 1.6 }}>
                    Iran befindet sich in einer komplexen geopolitischen Lage…
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ padding: "4px 10px", borderRadius: 9999, background: "#E4FF97", color: "#0A0A0A", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>→ Folgefrage 1</button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 8 }}>Glass Card</div>
              <div style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 14, padding: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 8 }}>Glass Surface</div>
                <p style={{ fontSize: 14, color: "#3A3A3A", lineHeight: 1.6, margin: 0 }}>
                  Semi-transparent with backdrop blur. Use for overlays and atmospheric panels.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 11. INFO BLOCKS ────────────────────────────────── */}
        <Section id="info-blocks" title="11. Info Blocks">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#F0F2F7", borderLeft: "3px solid #6B7A9A" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7A9A", fontFamily: "monospace", marginBottom: 6 }}>NEUTRAL / INFO</div>
              <p style={{ fontSize: 14, color: "#3A3A3A", margin: 0, lineHeight: 1.6 }}>Neutral context, background information or explanations.</p>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#C3F4D3", borderLeft: "3px solid #1A9E5A" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0F6038", fontFamily: "monospace", marginBottom: 6 }}>POSITIVE / SUCCESS</div>
              <p style={{ fontSize: 14, color: "#1A1A1A", margin: 0, lineHeight: 1.6 }}>Entscheidungshilfe: Cyber-Security stärken, Energie-Hedging aufbauen.</p>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#FFF5BA", borderLeft: "3px solid #E0C840" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7A5C00", fontFamily: "monospace", marginBottom: 6 }}>WARNING / CAUTION</div>
              <p style={{ fontSize: 14, color: "#1A1A1A", margin: 0, lineHeight: 1.6 }}>[HACKERNEWS, 27.03.2026] bestätigt aktiven Konflikt in der Region.</p>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#FDEEE9", borderLeft: "3px solid #E8402A" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C0341D", fontFamily: "monospace", marginBottom: 6 }}>DANGER / ALERT</div>
              <p style={{ fontSize: 14, color: "#1A1A1A", margin: 0, lineHeight: 1.6 }}>Kritisches Risiko erkannt — sofortige Maßnahmen empfohlen.</p>
            </div>
          </div>
        </Section>

        {/* ── 12. SCENARIO CARDS ─────────────────────────────── */}
        <Section id="scenario-cards" title="12. Scenario Cards">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 700 }}>
            {[
              { name: "Status Quo",   pct: 50, color: "#1A4A8A", bg: "#D4E8FF", border: "#80B8F0", desc: "Fortgesetzte Sanktionen, episodische Konfrontationen." },
              { name: "Optimistisch", pct: 25, color: "#0F6038", bg: "#C3F4D3", border: "#6FD99A", desc: "Interne Reformen führen zu schrittweiser Reintegration." },
              { name: "Eskalation",   pct: 25, color: "#C0341D", bg: "#FDEEE9", border: "#F4A090", desc: "Direkter militärischer Konflikt, massive Ölpreissteigerungen." },
            ].map(({ name, pct, color, bg, border, desc }) => (
              <div key={name} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{name}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.5)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
                </div>
                <p style={{ fontSize: 12, color, opacity: 0.8, margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#9B9B9B", marginTop: 12 }}>
            Pastel background cards with matching border. Probability as large number top-right.
          </p>
        </Section>

        {/* ── 13. FEED ITEMS ─────────────────────────────────── */}
        <Section id="feed-items" title="13. Intelligence Feed Items">
          <div style={{ maxWidth: 600, border: "1px solid #E8E8E8", borderRadius: 14, overflow: "hidden" }}>
            {[
              { type: "spike",   color: "#1A9E5A", dotBg: "#C3F4D3", icon: "▲", name: "AI Agents & Autonomous Systems",      meta: "adopt · 160 signals", value: "97%" },
              { type: "alert",   color: "#E8402A", dotBg: "#FDEEE9", icon: "●", name: "Generative AI & Foundation Models",    meta: "adopt · steigend",   value: "92%" },
              { type: "mention", color: "#6B7A9A", dotBg: "#F0F2F7", icon: "→", name: "Climate Change & Sustainability",      meta: "adopt · 450 signals", value: "80%" },
            ].map(({ type, color, dotBg, icon, name, meta, value }, i) => (
              <div key={type} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                borderBottom: i < 2 ? "1px solid #F0F0F0" : "none",
                background: "white"
              }}>
                <span style={{ fontSize: 11, width: 20, height: 20, borderRadius: 9999, background: dotBg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#9B9B9B" }}>{meta}</div>
                </div>
                <div style={{ width: 48, height: 4, background: "#F0F0F0", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ height: "100%", width: value, background: color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#9B9B9B", marginTop: 12 }}>
            White surface. Pastel dot signals signal type (green/coral/slate). Strength bar right-aligned.
          </p>
        </Section>

        {/* ── 14. LAYOUT GRID ────────────────────────────────── */}
        <Section id="layout-grid" title="14. Layout Grid & Breakpoints">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { bp: "Mobile",  px: "< 640px",    cols: "1", maxW: "100%",  pad: "px-4 (16px)" },
              { bp: "Tablet",  px: "640–1024px",  cols: "1", maxW: "100%", pad: "px-6 (24px)" },
              { bp: "Desktop", px: "> 1024px",    cols: "1", maxW: "720px", pad: "px-6 (24px), centered" },
            ].map(({ bp, px, cols, maxW, pad }) => (
              <div key={bp} style={{ display: "grid", gridTemplateColumns: "100px 140px 80px 100px 1fr", gap: 16, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #E8E8E8" }}>
                <strong style={{ fontSize: 13, color: "#1A1A1A" }}>{bp}</strong>
                <span style={{ fontSize: 12, color: "#6B6B6B" }}>{px}</span>
                <span style={{ fontSize: 12, color: "#3A3A3A" }}>{cols} col</span>
                <span style={{ fontSize: 12, color: "#3A3A3A" }}>{maxW}</span>
                <span style={{ fontSize: 12, color: "#6B6B6B" }}>{pad}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 12 }}>Design Principles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { p: "Atmosphere over sterility", d: "Use pastels, glass, grain textures. Avoid flat white + grey monotony." },
                { p: "Black as hero, Lime as spark", d: "Primary brand interaction = black. Accent moments = #E4FF97 neon lime." },
                { p: "Signal first", d: "Colors carry semantic meaning. Mint = positive, Coral = negative, Butter = caution." },
                { p: "Typographic hierarchy", d: "Bricolage for display, DM Sans for UI, JetBrains Mono for labels/metrics." },
                { p: "Honest data, honest UI", d: "No fake counts, no decorative loading states. Show real data or honest empty states." },
              ].map(({ p, d }) => (
                <div key={p} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F5F5F5" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 9999, background: "#E4FF97", flexShrink: 0, marginTop: 5, border: "1px solid #D0D0D0" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{p}</div>
                    <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 64 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 12, borderBottom: "2px solid #E8E8E8" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>{title}</h2>
        <a href={`#${id}`} style={{ fontSize: 12, color: "#9B9B9B", textDecoration: "none", fontFamily: "monospace" }}>#{id}</a>
      </div>
      {children}
    </section>
  );
}

function ColorGroup({ label, swatches }: { label: string; swatches: { token: string; hex: string; name: string; textColor?: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B9B9B", fontFamily: "monospace", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {swatches.map(({ token, hex, name, textColor }) => (
          <div key={token} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: hex, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {textColor && <span style={{ fontSize: 8, color: textColor, fontWeight: 700 }}>Aa</span>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#1A1A1A" }}>{name}</div>
              <div style={{ fontSize: 10, color: "#9B9B9B", fontFamily: "monospace" }}>{hex}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
