"use client";

/**
 * NavProgress — schmale Top-Bar-Progress-Anzeige für Seitenwechsel.
 *
 * **Warum:** Der User konnte nicht erkennen, ob eine Seite gerade lädt
 * oder nicht. Next.js macht client-side Navigation, aber der Browser zeigt
 * kein Lade-Feedback, weil kein neues Dokument geladen wird. Folge: Klick
 * → scheinbar nichts passiert für mehrere Sekunden → Frust.
 *
 * **Funktionsweise (zwei Quellen):**
 *  1. **Pre-click hint** — ein globaler Click-Listener auf `<a href=…>`
 *     (interne Links) und sichtbare `<button>`s mit `data-nav-progress`
 *     startet die Bar **sofort** beim Klick. Der User sieht Feedback
 *     in der gleichen Frame.
 *  2. **Post-navigation finish** — sobald `usePathname()` oder
 *     `useSearchParams()` sich ändern, füllt die Bar auf 100% und
 *     fadet aus. Das ist der autoritative „fertig"-Moment.
 *
 * Die Bar simuliert Fortschritt nicht linear — sie springt schnell auf
 * ~30%, kriecht dann auf ~85% und hält dort, bis die Navigation
 * tatsächlich fertig ist. Klassisches nprogress-Pattern, selbst gebaut
 * ohne externe Dependency.
 *
 * Kein visueller Noise bei reduced-motion: die Bar wird dann gar nicht
 * animiert, nur ein kurzer statischer Balken sichtbar gemacht.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[] | null>(null);
  const lastKeyRef = useRef<string>("");

  // Helper: Timer aufräumen, damit sich Sequenzen beim nächsten Klick
  // nicht übereinanderlegen.
  const clearTimers = () => {
    if (timersRef.current) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  };

  const start = () => {
    clearTimers();
    setVisible(true);
    setProgress(5);
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Sprint auf 30 %, dann 60 %, dann 85 % — danach warten wir auf die
    // pathname-Änderung als „fertig"-Signal.
    timers.push(setTimeout(() => setProgress(30), 60));
    timers.push(setTimeout(() => setProgress(60), 220));
    timers.push(setTimeout(() => setProgress(85), 600));
    // Safety net: wenn Navigation > 8s dauert, auf 95 % parken und
    // trotzdem etwas Feedback zeigen.
    timers.push(setTimeout(() => setProgress(95), 2500));
    timersRef.current = timers;
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setVisible(false), 180));
    timers.push(setTimeout(() => setProgress(0), 400));
    timersRef.current = timers;
  };

  // 1. Pre-click hint: globaler Click-Listener.
  //
  // Warum delegiert: Next.js-Link rendert ein normales `<a>`. Wir
  // fangen den Click auf Capture-Ebene ab und prüfen, ob es ein
  // interner Navigationslink ist (gleicher Origin, nicht `_blank`,
  // kein Modifier gedrückt). Externe Links lassen wir in Ruhe.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Modifier → neuer Tab, nicht unser Thema
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target === "_blank") return;
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      // Anker-Links im selben Dokument lösen keinen pathname-Change aus
      // → keine Bar.
      if (href.startsWith("#")) return;

      start();
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // 2. Finish-Trigger: pathname/searchParams ändern sich NACH der
  // Navigation. Der Effekt läuft dann und schließt die Bar ab.
  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (lastKeyRef.current === "") {
      // Initialer Mount — keine vorige Navigation, keine Bar.
      lastKeyRef.current = key;
      return;
    }
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Cleanup aller Timer bei Unmount
  useEffect(() => () => clearTimers(), []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #0A0A0A 0%, #0A0A0A 80%, #E4FF97 100%)",
          boxShadow: visible ? "0 0 8px rgba(228,255,151,0.6)" : "none",
          transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}
