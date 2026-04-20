import type { NextConfig } from "next";

// TODO: FE-16 — Environment variables use process.env.VAR! (non-null assertion).
// No runtime validation. Missing vars cause cryptic runtime errors.
// FIX: Use @t3-oss/env-nextjs or Zod schema for env validation.

// TODO: FE-17 — ESLint config is minimal (only base Next.js rules).
// Missing: @typescript-eslint/strict, import/order, no-console.
// FIX: Add strict ESLint + Prettier config.

// TODO: FE-18 — No E2E tests exist. Add Playwright with smoke tests for critical flows.

// TODO: PERF-17 — No @next/bundle-analyzer. Bundle regressions undetected.

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PERF-16: Enable gzip compression for all responses
  compress: true,
  // Exclude native modules from the webpack bundle so they load at runtime.
  // better-sqlite3 contains native C++ bindings that cannot be bundled.
  serverExternalPackages: ["better-sqlite3"],

  // Fix 2026-04-21: Der Next.js Dev-Indicator (kleine schwarze "N"-Bubble)
  // sitzt per Default unten-links und überdeckt im Canvas die Status-
  // Legende ("Status · Fertig · Läuft · Fehler · Offen"). Verschieben
  // nach bottom-right, wo der Canvas-Zoom-Control sitzt aber mehr Luft
  // vorhanden ist. Greift nur im Dev-Modus — Production zeigt den
  // Indicator gar nicht, also keine Prod-Auswirkung.
  devIndicators: {
    position: "bottom-right",
  },

  // SEC-15: Security headers for all responses
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
