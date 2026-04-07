import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale-context";
import SignalTicker from "@/components/SignalTicker";

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


export const metadata: Metadata = {
  title: "Strategic Intelligence System",
  description: "Multi-industry strategic intelligence platform",
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
          {children}
          <SignalTicker />
        </LocaleProvider>
      </body>
    </html>
  );
}
