import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale-context";
import { TenantProvider, type TenantMembership } from "@/lib/tenant-context";
import SignalTicker from "@/components/SignalTicker";
import { ActivityPanel } from "@/components/ActivityPanel";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import { Footer } from "@/components/Footer";
import { auth } from "@/lib/auth";
import { getSqliteHandle } from "@/db";
import { getDefaultTenantId } from "@/db/sqlite-helpers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});


// Former TODO UX-04 — "Desktop only" notice on mobile is now handled
// by <DesktopOnlyGate/>. A proper responsive layout is still open as
// a follow-up ticket (Audit A5-H4).

export const metadata: Metadata = {
  title: { default: "SIS — Strategic Intelligence System", template: "%s | SIS" },
  description: "Strategic Intelligence System for trend analysis and signal monitoring",
  // UX-21: Favicon and PWA manifest
  icons: { icon: "/favicon.ico" },
  manifest: "/manifest.json",
};

/**
 * Server-side tenant hydration.
 *
 * The client-side TenantProvider needs the active tenant + the user's
 * memberships to render the switcher without waiting for an API call.
 * We read them here from the NextAuth session (where the SQLite
 * adapter's enrichUser already attached them) and pass them down as
 * props. In dev mode (no auth) we fall back to the default tenant with
 * a synthetic "owner" membership so the UI still has something to
 * render.
 */
async function loadTenantBootstrap(): Promise<{
  activeTenantId: string | null;
  memberships: TenantMembership[];
  isSystemAdmin: boolean;
}> {
  try {
    const session = await auth();
    if (session?.user) {
      const user = session.user as unknown as {
        role?: string;
        tenants?: TenantMembership[];
        activeTenantId?: string | null;
      };
      return {
        activeTenantId: user.activeTenantId ?? null,
        memberships: Array.isArray(user.tenants) ? user.tenants : [],
        isSystemAdmin: user.role === "admin",
      };
    }
  } catch {
    /* session lookup failed — fall through to dev-mode fallback */
  }

  // Dev-mode / unauthenticated fallback: synthesise a default tenant so
  // the UI doesn't crash and locally-run features keep working.
  if (process.env.NODE_ENV === "development") {
    try {
      const db = getSqliteHandle();
      const tenantId = getDefaultTenantId(db);
      const row = db.prepare("SELECT id, name, slug FROM tenants WHERE id = ?")
        .get(tenantId) as { id: string; name: string; slug: string } | undefined;
      if (row) {
        return {
          activeTenantId: row.id,
          memberships: [{ id: row.id, name: row.name, slug: row.slug, role: "owner" }],
          isSystemAdmin: true,
        };
      }
    } catch {
      /* DB not ready — render empty */
    }
  }

  return { activeTenantId: null, memberships: [], isSystemAdmin: false };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantBootstrap = await loadTenantBootstrap();
  return (
    <html lang="de" className={`${spaceGrotesk.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="stylesheet" href="/volt-ui.css" />
      </head>
      <body className="antialiased volt-root pattern-dots">
        <LocaleProvider>
          <TenantProvider
            activeTenantId={tenantBootstrap.activeTenantId}
            memberships={tenantBootstrap.memberships}
            isSystemAdmin={tenantBootstrap.isSystemAdmin}
          >
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
              {children}
              <Footer />
            </div>
            <SignalTicker />
            <ActivityPanel />
            {/* Honest-state overlay for < 768 px viewports until the
                 responsive-layout ticket lands (Audit A5-H4). */}
            <DesktopOnlyGate />
          </TenantProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
