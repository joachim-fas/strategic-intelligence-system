"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { megaTrends } from "@/lib/mega-trends";
import { TrendDot } from "@/types";
import dynamic from "next/dynamic";

const TrendDetailPanel = dynamic(() => import("@/components/radar/TrendDetailPanel"), { ssr: false });

export default function TrendDetailPage() {
  const { locale } = useLocale();
  const de = locale === "de";
  const params = useParams();
  const trendId = params.trendId as string;

  const [trend, setTrend] = useState<TrendDot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try API first, fallback to megaTrends
    fetch(`/api/v1/trends/${trendId}`)
      .then(r => r.json())
      .then(data => {
        if (data.trend) {
          setTrend(data.trend);
        } else {
          // Fallback: find in megaTrends by ID or slug
          const found = megaTrends.find(t => t.id === trendId || t.id === decodeURIComponent(trendId));
          setTrend(found ?? null);
        }
      })
      .catch(() => {
        const found = megaTrends.find(t => t.id === trendId || t.id === decodeURIComponent(trendId));
        setTrend(found ?? null);
      })
      .finally(() => setLoading(false));
  }, [trendId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "transparent" }}>
        <AppHeader />
        <main className="volt-container" style={{ padding: "32px 24px 80px", textAlign: "center" }}>
          <div style={{ padding: 60, color: "var(--color-text-muted)" }}>
            {de ? "Lade Trend-Details..." : "Loading trend details..."}
          </div>
        </main>
      </div>
    );
  }

  if (!trend) {
    return (
      <div style={{ minHeight: "100vh", background: "transparent" }}>
        <AppHeader />
        <main className="volt-container" style={{ padding: "32px 24px 80px", textAlign: "center" }}>
          <div style={{ padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 8 }}>
              {de ? "Trend nicht gefunden" : "Trend not found"}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
              ID: {trendId}
            </div>
            <a href="/verstehen?tab=list" style={{
              fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 10,
              background: "var(--volt-black, #0A0A0A)", color: "var(--volt-white, #fff)",
              textDecoration: "none", display: "inline-block",
            }}>
              {de ? "Alle Trends anzeigen" : "Show all trends"} →
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <AppHeader />

      <main style={{ display: "flex", maxWidth: 1200, margin: "0 auto" }}>
        {/* Back link + breadcrumb */}
        <div style={{ flex: 1, padding: "24px 24px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <a href="/verstehen?tab=list" style={{
              fontFamily: "var(--volt-font-ui)", fontSize: 13, color: "var(--color-text-muted)",
              textDecoration: "none",
            }}>
              ← {de ? "Verstehen" : "Understand"}
            </a>
            <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>·</span>
            <span style={{
              fontFamily: "var(--volt-font-mono)", fontSize: 10, letterSpacing: "0.08em",
              textTransform: "uppercase" as const, color: "var(--color-text-muted)",
            }}>
              {trend.category}
            </span>
          </div>

          {/* Full-page trend detail — reuse the existing TrendDetailPanel but rendered inline */}
          <div style={{ maxWidth: 520 }}>
            <TrendDetailPanel trend={trend} onClose={() => window.history.back()} />
          </div>
        </div>

        {/* Right: Quick actions */}
        <div style={{ width: 280, flexShrink: 0, padding: "24px 24px 80px", borderLeft: "1px solid var(--color-border)" }}>
          <div style={{
            fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.10em", textTransform: "uppercase" as const,
            color: "var(--volt-text-faint, #AAA)", marginBottom: 16,
          }}>
            {de ? "Aktionen" : "Actions"}
          </div>

          <a
            href={`/?q=${encodeURIComponent(trend.name)}`}
            className="volt-card"
            style={{
              display: "block", padding: "14px 16px", marginBottom: 8,
              textDecoration: "none", color: "inherit",
              transition: "transform 150ms ease",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div style={{ fontFamily: "var(--volt-font-ui)", fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 2 }}>
              {de ? "Frag mich dazu" : "Ask about this"} →
            </div>
            <div style={{ fontFamily: "var(--volt-font-ui)", fontSize: 11, color: "var(--color-text-muted)" }}>
              {de ? "Vollständige Intelligence-Analyse" : "Full intelligence analysis"}
            </div>
          </a>

          <a
            href={`/verstehen?tab=network`}
            className="volt-card"
            style={{
              display: "block", padding: "14px 16px", marginBottom: 8,
              textDecoration: "none", color: "inherit",
              transition: "transform 150ms ease",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div style={{ fontFamily: "var(--volt-font-ui)", fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 2 }}>
              {de ? "Im Netzwerk anzeigen" : "View in Network"} ⬡
            </div>
            <div style={{ fontFamily: "var(--volt-font-ui)", fontSize: 11, color: "var(--color-text-muted)" }}>
              {de ? "Kausale Verbindungen erkunden" : "Explore causal connections"}
            </div>
          </a>

          <a
            href={`/verstehen?tab=radar`}
            className="volt-card"
            style={{
              display: "block", padding: "14px 16px",
              textDecoration: "none", color: "inherit",
              transition: "transform 150ms ease",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div style={{ fontFamily: "var(--volt-font-ui)", fontSize: 13, fontWeight: 600, color: "var(--color-text-heading)", marginBottom: 2 }}>
              {de ? "Im Radar anzeigen" : "View in Radar"} ◎
            </div>
            <div style={{ fontFamily: "var(--volt-font-ui)", fontSize: 11, color: "var(--color-text-muted)" }}>
              {de ? "Position im Ring-Modell" : "Position in ring model"}
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
