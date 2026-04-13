import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale-context";
import SignalTicker from "@/components/SignalTicker";
import { ActivityPanel } from "@/components/ActivityPanel";
import { Footer } from "@/components/Footer";

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


// TODO: UX-04 — No responsive/mobile layout. No breakpoints, no touch support.
// FIX: Add responsive breakpoints or show "Desktop only" notice on mobile.

export const metadata: Metadata = {
  title: { default: "SIS — Strategic Intelligence System", template: "%s | SIS" },
  description: "Strategic Intelligence System for trend analysis and signal monitoring",
  // UX-21: Favicon and PWA manifest
  icons: { icon: "/favicon.ico" },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${spaceGrotesk.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="stylesheet" href="/volt-ui.css" />
      </head>
      <body className="antialiased volt-root pattern-dots">
        <LocaleProvider>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            {children}
            <Footer />
          </div>
          <SignalTicker />
          <ActivityPanel />
        </LocaleProvider>
      </body>
    </html>
  );
}
