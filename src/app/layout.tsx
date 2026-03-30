import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale-context";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
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

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500"],
  style: ["normal", "italic"],
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
    <html lang="de" className={`${bricolage.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${lora.variable}`}>
      <body className="antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
