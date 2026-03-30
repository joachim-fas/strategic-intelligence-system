"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { dummyTrends } from "@/lib/dummy-data";
import { classifyTrends } from "@/lib/classify";
import { TrendDot } from "@/types";

// ── Ring config ────────────────────────────────────────────────
const RING_COLOR: Record<string, string> = {
  adopt:  "var(--color-adopt)",
  trial:  "var(--color-trial)",
  assess: "var(--color-assess)",
  hold:   "var(--color-hold)",
};
const RING_GLOW: Record<string, string> = {
  adopt:  "#1A9E5A55",
  trial:  "#3b82f655",
  assess: "#f59e0b55",
  hold:   "#6b728055",
};
const RING_BG: Record<string, string> = {
  adopt:  "var(--color-adopt-bg, #F0FDF6)",
  trial:  "var(--color-trial-bg, #EFF6FF)",
  assess: "var(--color-assess-bg, #FFFBEB)",
  hold:   "var(--color-hold-bg, #F9FAFB)",
};

type GroupBy = "ring" | "category";
type SortBy  = "relevance" | "name" | "confidence";

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendDot[]>(dummyTrends);
  const [loading, setLoading]   = useState(true);
  const [locale, setLocale]     = useState<"de" | "en">("de");
  const [groupBy, setGroupBy]   = useState<GroupBy>("ring");
  const [sortBy, setSortBy]     = useState<SortBy>("relevance");
  const [search, setSearch]     = useState("");
  const de = locale === "de";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sis-locale");
      if (stored === "en") setLocale("en");
    } catch {}

    fetch("/api/v1/trends")
      .then(r => r.json())
      .then(data => {
        if (data.trends?.length > 0) {
          setTrends(classifyTrends(data.trends as TrendDot[]));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Filter + sort ──────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = trends.filter(t =>
    !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "relevance")  return b.relevance - a.relevance;
    if (sortBy === "confidence") return b.confidence - a.confidence;
    return a.name.localeCompare(b.name);
  });

  // ── Grouping ───────────────────────────────────────────────────
  const RING_ORDER = ["adopt", "trial", "assess", "hold"];
  const RING_LABEL: Record<string, { de: string; en: string }> = {
    adopt:  { de: "Adopt",  en: "Adopt"  },
    trial:  { de: "Trial",  en: "Trial"  },
    assess: { de: "Assess", en: "Assess" },
    hold:   { de: "Hold",   en: "Hold"   },
  };

  type Group = { key: string; label: string; items: TrendDot[] };
  let groups: Group[];

  if (groupBy === "ring") {
    groups = RING_ORDER.map(ring => ({
      key: ring,
      label: de ? RING_LABEL[ring].de : RING_LABEL[ring].en,
      items: sorted.filter(t => t.ring === ring),
    })).filter(g => g.items.length > 0);
  } else {
    const cats = [...new Set(sorted.map(t => t.category))].sort();
    groups = cats.map(cat => ({
      key: cat,
      label: cat,
      items: sorted.filter(t => t.category === cat),
    }));
  }

  // ── Stats ──────────────────────────────────────────────────────
  const adoptCount  = trends.filter(t => t.ring === "adopt").length;
  const trialCount  = trends.filter(t => t.ring === "trial").length;
  const assessCount = trends.filter(t => t.ring === "assess").length;
  const holdCount   = trends.filter(t => t.ring === "hold").length;
  const megaCount   = trends.filter(t => t.category === "Mega-Trend").length;
  const macroCount  = trends.filter(t => t.category === "Makro-Trend").length;
  const risingCount = trends.filter(t => t.velocity === "rising").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-surface)", color: "var(--color-text-primary)" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", gap: 16 }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "var(--radius-sm)",
              background: "#E4FF97", border: "1.5px solid rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.05em",
            }}>SIS</div>
            <Link href="/"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"}
            >
              ← {de ? "Zurück" : "Back"}
            </Link>
          </div>

          <span style={{ color: "var(--color-border-strong)", fontSize: 16 }}>|</span>

          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-heading)" }}>
            {de ? "Strategische Trends" : "Strategic Trends"}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {(["de", "en"] as const).map(l => (
              <button key={l} onClick={() => { setLocale(l); try { localStorage.setItem("sis-locale", l); } catch {} }}
                style={{
                  padding: "3px 10px", borderRadius: "var(--radius-full)",
                  border: `1px solid ${locale === l ? "rgba(0,0,0,0.12)" : "var(--color-border)"}`,
                  background: locale === l ? "var(--color-brand-light)" : "transparent",
                  color: locale === l ? "var(--color-brand)" : "var(--color-text-muted)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                }}
              >{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <StatPill color={RING_COLOR.adopt}  label="Adopt"  value={adoptCount} />
          <StatPill color={RING_COLOR.trial}  label="Trial"  value={trialCount} />
          <StatPill color={RING_COLOR.assess} label="Assess" value={assessCount} />
          <StatPill color={RING_COLOR.hold}   label="Hold"   value={holdCount} />
          <div style={{ width: 1, height: 16, background: "var(--color-border)" }} />
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-text-heading)", fontVariantNumeric: "tabular-nums" }}>{megaCount}</strong>
            {" "}{de ? "Mega-Trends" : "Mega-trends"}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-text-heading)", fontVariantNumeric: "tabular-nums" }}>{macroCount}</strong>
            {" "}{de ? "Makro-Trends" : "Macro-trends"}
          </span>
          <div style={{ width: 1, height: 16, background: "var(--color-border)" }} />
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "#1A9E5A", fontVariantNumeric: "tabular-nums" }}>{risingCount}</strong>
            {" "}↑ {de ? "Aufsteigend" : "Rising"}
          </span>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "var(--color-text-muted)", fontSize: 13, pointerEvents: "none",
            }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={de ? "Trend suchen…" : "Search trends…"}
              style={{
                width: "100%", paddingLeft: 28, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
                background: "var(--color-surface)", color: "var(--color-text-primary)",
                fontSize: 13, outline: "none", transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = "var(--color-brand-light)"}
              onBlur={e => (e.target as HTMLElement).style.borderColor = "var(--color-border)"}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            {/* Group by */}
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{de ? "Gruppe:" : "Group:"}</span>
            {(["ring", "category"] as GroupBy[]).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                style={{
                  padding: "4px 12px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 500,
                  border: `1px solid ${groupBy === g ? "rgba(0,0,0,0.12)" : "var(--color-border)"}`,
                  cursor: "pointer", transition: "all 0.15s",
                  background: groupBy === g ? "var(--color-brand-light)" : "transparent",
                  color: groupBy === g ? "var(--color-brand)" : "var(--color-text-secondary)",
                }}
              >
                {g === "ring"
                  ? (de ? "Ring" : "Ring")
                  : (de ? "Kategorie" : "Category")}
              </button>
            ))}

            <div style={{ width: 1, height: 16, background: "var(--color-border)", margin: "0 4px" }} />

            {/* Sort by */}
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{de ? "Sortierung:" : "Sort:"}</span>
            {(["relevance", "confidence", "name"] as SortBy[]).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{
                  padding: "4px 12px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 500,
                  border: `1px solid ${sortBy === s ? "rgba(0,0,0,0.12)" : "var(--color-border)"}`,
                  cursor: "pointer", transition: "all 0.15s",
                  background: sortBy === s ? "var(--color-brand-light)" : "transparent",
                  color: sortBy === s ? "var(--color-brand)" : "var(--color-text-secondary)",
                }}
              >
                {s === "relevance"  ? (de ? "Relevanz" : "Relevance")
                : s === "confidence" ? (de ? "Konfidenz" : "Confidence")
                : (de ? "Name A–Z" : "Name A–Z")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {loading ? (
          <div style={{ color: "var(--color-text-muted)", fontSize: 13, padding: "48px 0", textAlign: "center" }}>
            {de ? "Lade Trends…" : "Loading trends…"}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)", fontSize: 13, padding: "48px 0", textAlign: "center" }}>
            {de ? "Kein Trend gefunden für" : "No trend found for"} &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {groups.map(group => (
              <section key={group.key}>

                {/* Group heading */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  {groupBy === "ring" && (
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: RING_COLOR[group.key] ?? "var(--color-text-muted)",
                      boxShadow: `0 0 6px ${RING_GLOW[group.key] ?? "transparent"}`,
                    }} />
                  )}
                  <span className="section-label">{group.label}</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 400 }}>
                    ({group.items.length})
                  </span>
                </div>

                {/* Trend cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                  {group.items.map(t => (
                    <TrendCard key={t.id} trend={t} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── TrendCard ────────────────────────────────────────────────────
function TrendCard({ trend: t, locale }: { trend: TrendDot; locale: "de" | "en" }) {
  const de = locale === "de";

  const ringDot = (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: RING_COLOR[t.ring] ?? "var(--color-text-muted)",
      boxShadow: t.ring === "adopt" ? `0 0 5px ${RING_GLOW.adopt}` : "none",
    }} />
  );

  const ringBadge = (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "1px 8px",
      borderRadius: "var(--radius-full)",
      background: RING_BG[t.ring] ?? "transparent",
      color: RING_COLOR[t.ring] ?? "var(--color-text-muted)",
      border: `1px solid ${RING_COLOR[t.ring] ?? "var(--color-border)"}33`,
      textTransform: "capitalize",
      flexShrink: 0,
    }}>
      {t.ring}
    </span>
  );

  const velocityIcon = t.velocity === "rising" ? "↑" : t.velocity === "falling" ? "↓" : "—";
  const velocityColor = t.velocity === "rising" ? "#1A9E5A" : t.velocity === "falling" ? "#E8402A" : "var(--color-text-muted)";

  const confPct = Math.round(t.confidence * 100);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex", flexDirection: "column", gap: 8,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--color-border-strong)";
        el.style.boxShadow = "var(--shadow-sm)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--color-border)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {ringDot}
        <span style={{
          fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{t.name}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: velocityColor, flexShrink: 0 }}>{velocityIcon}</span>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{t.category}</span>
        <span style={{ color: "var(--color-border-strong)", fontSize: 11 }}>·</span>
        {ringBadge}
        {t.signalCount > 0 && (
          <>
            <span style={{ color: "var(--color-border-strong)", fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {t.signalCount.toLocaleString()} {de ? "Signale" : "signals"}
            </span>
          </>
        )}
      </div>

      {/* Description */}
      {t.description && (
        <p style={{
          fontSize: 11, color: "var(--color-text-muted)",
          lineHeight: 1.5, margin: 0,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {t.description}
        </p>
      )}

      {/* Confidence bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", flexShrink: 0 }}>
          {de ? "Konfidenz" : "Confidence"}
        </span>
        <div style={{
          flex: 1, height: 3, borderRadius: 99,
          background: "var(--color-border)",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${confPct}%`, height: "100%",
            background: RING_COLOR[t.ring] ?? "var(--color-brand)",
            borderRadius: 99, transition: "width 0.4s ease",
          }} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "var(--color-text-secondary)",
          flexShrink: 0, fontVariantNumeric: "tabular-nums",
        }}>{confPct}%</span>
      </div>
    </div>
  );
}

// ── StatPill ─────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
        <span style={{ color: "var(--color-text-heading)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {" "}{label}
      </span>
    </div>
  );
}
