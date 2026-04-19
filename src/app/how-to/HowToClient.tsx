"use client";

import Link from "next/link";
import { useT } from "@/lib/locale-context";
import { AppHeader } from "@/components/AppHeader";

export default function HowToClient() {
  const { t } = useT();

  const examples = [
    { input: t("howTo.example1Input"), hint: t("howTo.example1Hint") },
    { input: t("howTo.example2Input"), hint: t("howTo.example2Hint") },
    { input: t("howTo.example3Input"), hint: t("howTo.example3Hint") },
    { input: t("howTo.example4Input"), hint: t("howTo.example4Hint") },
    { input: t("howTo.example5Input"), hint: t("howTo.example5Hint") },
  ];

  const outputs = [
    { label: t("howTo.output1Label"), color: "var(--color-text-heading)", bg: "var(--color-lime)", desc: t("howTo.output1Desc") },
    { label: t("howTo.output2Label"), color: "var(--pastel-mint-text)", bg: "var(--pastel-mint)", desc: t("howTo.output2Desc") },
    { label: t("howTo.output3Label"), color: "var(--pastel-orchid-text)", bg: "var(--pastel-orchid)", desc: t("howTo.output3Desc") },
    { label: t("howTo.output4Label"), color: "var(--pastel-butter-text)", bg: "var(--pastel-butter)", desc: t("howTo.output4Desc") },
    { label: t("howTo.output5Label"), color: "var(--signal-negative-text)", bg: "var(--signal-negative-light)", desc: t("howTo.output5Desc") },
    { label: t("howTo.output6Label"), color: "var(--pastel-aqua-text)", bg: "var(--pastel-aqua)", desc: t("howTo.output6Desc") },
  ];

  const navItems = [
    { label: t("howTo.nav1Label"), desc: t("howTo.nav1Desc") },
    { label: t("howTo.nav2Label"), desc: t("howTo.nav2Desc") },
    { label: t("howTo.nav3Label"), desc: t("howTo.nav3Desc") },
    { label: t("howTo.nav4Label"), desc: t("howTo.nav4Desc") },
    { label: t("howTo.nav5Label"), desc: t("howTo.nav5Desc") },
  ];

  const foundations = [
    { title: t("howTo.foundation1Title"), desc: t("howTo.foundation1Desc") },
    { title: t("howTo.foundation2Title"), desc: t("howTo.foundation2Desc") },
    { title: t("howTo.foundation3Title"), desc: t("howTo.foundation3Desc") },
    { title: t("howTo.foundation4Title"), desc: t("howTo.foundation4Desc") },
  ];

  const limits = [
    t("howTo.limit1"),
    t("howTo.limit2"),
    t("howTo.limit3"),
    t("howTo.limit4"),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main className="volt-container" style={{ padding: "32px 24px 80px" }}>

        {/* Lead */}
        <div style={{ marginBottom: 48 }}>
          <h1 className="volt-display-md" style={{ margin: "0 0 16px" }}>
            {t("howTo.leadHeadline")}
          </h1>
          <p className="volt-body" style={{ margin: "0 0 12px" }}>
            {t("howTo.leadP1Prefix")}
            <strong>{t("howTo.leadP1Bold")}</strong>
            {t("howTo.leadP1Suffix")}
          </p>
          <p className="volt-body" style={{ margin: "0 0 16px" }}>
            {t("howTo.leadP2")}
          </p>
          <Link href="/beispiele" className="volt-btn volt-btn-solid" style={{
            textDecoration: "none",
            background: "var(--color-lime)", color: "var(--color-brand-text)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}>
            {t("howTo.leadCtaExamples")} →
          </Link>
        </div>

        <Section title={t("howTo.sectionQueryTitle")}>
          <p className="volt-body" style={{ marginBottom: 20 }}>
            {t("howTo.sectionQueryP")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            <div className="volt-label" style={{ marginBottom: 4 }}>
              {t("howTo.examplesHeading")}
            </div>
            {examples.map(({ input, hint }) => (
              <div key={input} className="volt-card" style={{
                padding: "10px 14px",
                display: "flex", alignItems: "baseline", gap: 12,
              }}>
                <span className="term-query" style={{ fontSize: 13 }}>{input}</span>
                <span className="volt-body-sm" style={{ color: "var(--color-text-muted)" }}>{hint}</span>
              </div>
            ))}
          </div>

          <div className="volt-card" style={{ background: "var(--color-lime)", border: "1px solid rgba(0,0,0,0.08)", padding: "12px 16px" }}>
            <p className="volt-body-sm" style={{ color: "var(--color-brand-text)", margin: 0 }}>
              <strong>{t("howTo.tipLabel")}</strong>{" "}
              {t("howTo.tipText")}
            </p>
          </div>
        </Section>

        <Section title={t("howTo.sectionReturnsTitle")}>
          {outputs.map(({ label, color, bg, desc }) => (
            <div key={label} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
              <div className="volt-badge" style={{ flexShrink: 0, background: bg, color, whiteSpace: "nowrap", marginTop: 2 }}>
                {label}
              </div>
              <p className="volt-body-sm" style={{ margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        <Section title={t("howTo.sectionNavTitle")}>
          {navItems.map(({ label, desc }) => (
            <div key={label} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
              <div className="volt-badge volt-badge-muted" style={{ flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}>
                {label}
              </div>
              <p className="volt-body-sm" style={{ margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        <Section title={t("howTo.sectionFoundationsTitle")}>
          <p className="volt-body" style={{ margin: "0 0 16px" }}>
            {t("howTo.foundationsIntro")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {foundations.map(({ title, desc }) => (
              <div key={title} className="volt-card" style={{ padding: "14px 16px" }}>
                <div className="volt-label" style={{ marginBottom: 6 }}>{title}</div>
                <p className="volt-body-sm" style={{ color: "var(--color-text-subtle)", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("howTo.sectionLimitsTitle")}>
          <p className="volt-body" style={{ margin: "0 0 12px" }}>
            {t("howTo.limitsIntro")}
          </p>
          <ul className="volt-body-sm" style={{ lineHeight: 1.9, margin: 0, paddingLeft: 20 }}>
            {limits.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </Section>

        {/* Canvas link */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--color-border)" }}>
          <Link href="/canvas" className="volt-btn volt-btn-outline" style={{ textDecoration: "none" }}>
            {t("howTo.openCanvas")}
          </Link>
        </div>

      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="volt-heading" style={{ margin: "0 0 16px" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
