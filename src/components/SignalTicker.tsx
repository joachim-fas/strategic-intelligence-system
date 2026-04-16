"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

/**
 * Routes that SHOULD show the live signal ticker. These are the
 * situational-awareness surfaces where an incoming signal pulse adds
 * value:
 *   - /cockpit : Knowledge Cockpit (trends / radar / signals)
 *   - /monitor : data source health, naturally wants live pulse
 *   - /projects: strategic projects list
 *
 * Explicitly NOT allowed:
 *   - /canvas  — the workspace is a focused editing surface; the
 *     scrolling marquee competes with the save-status indicator, the
 *     zoom/pan controls, and the toolbar. User asked for it gone.
 *   - / (home), /admin, /settings, /impressum, /dokumentation,
 *     /komponenten — either not signal-oriented or already have their
 *     own live sections. The ticker also collides with the fixed-
 *     position Footer at those routes.
 */
function shouldShowTicker(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/cockpit" || pathname.startsWith("/cockpit/")) return true;
  if (pathname === "/monitor" || pathname.startsWith("/monitor/")) return true;
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
  return false;
}

interface TickerSignal {
  id: string;
  source: string;
  title: string;
  url: string | null;
  topic: string | null;
  hoursAgo: number;
}

// Source → brand-ish dot color. Unlisted sources fall back to a neutral gray.
const SOURCE_DOT: Record<string, string> = {
  hackernews: "#FF6600",
  github: "#333333",
  reddit: "#FF5700",
  arxiv: "#B31B1B",
  gdelt: "#1A4A8A",
  polymarket: "#6366F1",
  guardian: "#052962",
  nyt: "#111111",
  newsdata: "#0EA5E9",
  rss: "#9333EA",
  twitter: "#1DA1F2",
  bloomberg: "#FF6B00",
  reuters: "#FF7A00",
  ft: "#FFF1E5",
  wsj: "#C8102E",
  noaa: "#1E88E5",
  worldbank: "#00A651",
  unctad: "#009EDB",
};

function ageLabel(h: number): string {
  if (h < 1) return "<1h";
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function sourceColor(src: string): string {
  return SOURCE_DOT[src?.toLowerCase?.() ?? ""] ?? "#999999";
}

export default function SignalTicker() {
  const pathname = usePathname();
  const [signals, setSignals] = useState<TickerSignal[]>([]);
  const [isIframe, setIsIframe] = useState(false);
  const [paused, setPaused] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const routeAllowsTicker = shouldShowTicker(pathname);

  // Detect iframe embed (hide ticker inside Workspace / Canvas iframes)
  useEffect(() => {
    try { setIsIframe(window.self !== window.top); } catch { setIsIframe(true); }
  }, []);

  // Initial fetch + auto-refresh every 2 minutes — only on routes that
  // actually render the ticker, so we don't keep a pointless 2-minute
  // interval running on /, /admin, /settings.
  useEffect(() => {
    if (!routeAllowsTicker) return;
    const load = () => {
      fetchWithTimeout("/api/v1/feed/ticker?limit=60&hours=48")
        .then(r => r.json())
        .then(json => {
          const data = json.data ?? json;
          const list = (data?.signals ?? []) as TickerSignal[];
          if (Array.isArray(list) && list.length > 0) setSignals(list);
        })
        .catch(() => {});
    };
    load();
    refreshTimer.current = setInterval(load, 120_000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [routeAllowsTicker]);

  if (!routeAllowsTicker || isIframe || signals.length === 0) return null;

  // The Footer component also renders at position:fixed; bottom:0.
  // Lift the ticker above the footer so both are visible — footer
  // height is roughly 38 px (12 px padding top/bottom + ~14 px content
  // line-height). /canvas is already excluded above so no exception
  // needed here.
  const bottomOffset = 40;

  // Duplicate the list so the CSS animation can loop seamlessly — the keyframe
  // translates by -50%, which lands the second copy exactly where the first
  // started.
  const loop = [...signals, ...signals];

  // Dynamic duration: slow enough to read, scaled with list length.
  const durationSec = Math.max(60, signals.length * 6);

  return (
    <div
      aria-label="Live signal ticker"
      style={{
        position: "fixed",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        zIndex: 30,
        background: "rgba(255,255,255,0.92)",
        borderTop: "1px solid var(--volt-border, #E8E8E8)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 -6px 20px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 34,
          width: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* LIVE label — fixed on the left, overlays the marquee */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 14px 0 16px",
            background: "linear-gradient(to right, rgba(255,255,255,0.98) 60%, rgba(255,255,255,0))",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--signal-positive, #1A9E5A)",
              boxShadow: "0 0 6px rgba(26,158,90,0.75)",
              animation: "sis-ticker-pulse 1.8s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--signal-positive, #1A9E5A)",
            }}
          >
            LIVE
          </span>
        </div>

        {/* Fade masks on both edges */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,1) 100%)",
            zIndex: 1,
          }}
        />

        {/* The actual marquee track */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            paddingLeft: 76, // clear the LIVE label
            whiteSpace: "nowrap",
            animation: `sis-ticker-scroll ${durationSec}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {loop.map((s, i) => {
            const dot = sourceColor(s.source);
            const content = (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: dot,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--volt-text-faint, #A8A8A8)",
                    minWidth: 24,
                    textAlign: "left",
                  }}
                >
                  {ageLabel(s.hoursAgo)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: dot,
                    minWidth: 52,
                  }}
                >
                  {s.source}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--volt-text, #1A1A1A)",
                    maxWidth: 520,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.title}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    background: "var(--volt-border, #D8D8D8)",
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                />
              </>
            );
            const key = `${s.id}-${i}`;
            if (s.url) {
              return (
                <a
                  key={key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                    flexShrink: 0,
                    transition: "opacity 120ms ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                >
                  {content}
                </a>
              );
            }
            return (
              <span
                key={key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {content}
              </span>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes sis-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes sis-ticker-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
