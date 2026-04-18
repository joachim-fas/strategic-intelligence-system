"use client";

/**
 * DesktopOnlyGate — honest mobile / tablet fallback.
 *
 * Why this exists
 * ───────────────
 * SIS does not have a responsive layout yet. The canvas, cockpit,
 * monitor and admin surfaces render as fixed-pixel desktop columns;
 * on a phone they are unusable and on smaller tablets they feel
 * broken without explanation. The audit report (A5-H4) flagged this
 * as a dishonest state: the UI silently appears broken instead of
 * telling the user that they are on the wrong device class.
 *
 * Behaviour
 * ─────────
 * - Renders a full-viewport overlay when the window width drops
 *   below `MIN_WIDTH` (768 px — standard tablet-portrait breakpoint).
 * - Message explains the state in DE + EN, offers a "Trotzdem
 *   fortfahren"/"Continue anyway" button for users who want to
 *   accept the consequences. That choice is stored in localStorage
 *   so power users who clicked once are not re-prompted every reload.
 * - Listens to viewport resize (via matchMedia) so rotating a tablet
 *   from portrait to landscape dismisses the splash automatically.
 * - Hydration-safe: returns `null` until the component has confirmed
 *   the real viewport width on the client. Prevents a server-side
 *   flash of the splash on desktop users.
 *
 * This is a temporary state. The intent is to be replaced by a real
 * responsive layout once the canvas decomposition lands.
 */

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const MIN_WIDTH = 768;
const OVERRIDE_KEY = "sis:desktop-only:override";

export function DesktopOnlyGate() {
  const { locale } = useLocale();
  const de = locale === "de";

  // `narrow` stays null until the first client-side measurement so we
  // never render the overlay during hydration on a wide screen.
  const [narrow, setNarrow] = useState<boolean | null>(null);
  const [userOverride, setUserOverride] = useState(false);

  useEffect(() => {
    // Hydrate the override flag from localStorage. A previous "continue
    // anyway" click persists; clearing the key reshows the gate.
    try {
      if (window.localStorage.getItem(OVERRIDE_KEY) === "1") {
        setUserOverride(true);
      }
    } catch {
      // Private-mode / storage blocked — no big deal, just no persistence.
    }

    const mql = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`);
    const update = () => setNarrow(mql.matches);
    update();
    // Both APIs for compatibility: older Safari still uses addListener.
    if (mql.addEventListener) mql.addEventListener("change", update);
    else mql.addListener(update);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", update);
      else mql.removeListener(update);
    };
  }, []);

  // Not yet measured → render nothing (prevents flash).
  // Wide viewport → nothing to do.
  // User clicked "continue anyway" → respect that.
  if (narrow !== true || userOverride) return null;

  const dismiss = () => {
    setUserOverride(true);
    try {
      window.localStorage.setItem(OVERRIDE_KEY, "1");
    } catch {
      /* storage blocked — state is still dismissed for this session */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sis-desktop-only-title"
      aria-describedby="sis-desktop-only-desc"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 15, 20, 0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        padding: "24px",
        fontFamily: "var(--volt-font-ui, 'DM Sans', system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "var(--volt-surface-raised, #FFFFFF)",
          borderRadius: 18,
          padding: "28px 26px 24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--volt-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--color-text-muted, #6B6B6B)",
            marginBottom: 10,
          }}
        >
          {de ? "Hinweis" : "Notice"}
        </div>
        <h2
          id="sis-desktop-only-title"
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--volt-font-display, 'Space Grotesk', sans-serif)",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
            color: "var(--color-text-heading, #0A0A0A)",
          }}
        >
          {de ? "Beste Ansicht am Desktop" : "Best viewed on desktop"}
        </h2>
        <p
          id="sis-desktop-only-desc"
          style={{
            margin: "0 0 18px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-text-primary, #1A1A1A)",
          }}
        >
          {de
            ? "Der Canvas, das Cockpit und die Admin-Oberflächen sind aktuell noch nicht für mobile Geräte optimiert. Öffne SIS auf einem Laptop oder Desktop (ab 768 px Breite) für die volle Funktionalität."
            : "The canvas, cockpit, and admin surfaces are not yet optimised for mobile. Open SIS on a laptop or desktop (width ≥ 768 px) for the full experience."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={dismiss}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid var(--color-border, #E8E8E8)",
              background: "transparent",
              color: "var(--color-text-muted, #6B6B6B)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {de ? "Trotzdem fortfahren" : "Continue anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesktopOnlyGate;
