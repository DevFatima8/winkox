import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { getTheme } from "@/lib/theme";
import { ParticlesBackground } from "@/components/ParticlesBackground";
import { PromoPopups } from "@/components/PromoPopups";

export const metadata: Metadata = {
  title: "winkox — Khelo aur Kamao | winkox.shop",
  description: "winkox — Pakistan ka premium gaming & earning platform. Aviator, Chicken Dash, Plinko, Dragon Tiger aur bohot kuch. JazzCash & Easypaisa se instant deposit aur withdraw.",
  icons: { icon: "/brand/logo-mark.png", apple: "/brand/logo-mark.png" },
  metadataBase: new URL("https://winkox.shop"),
  openGraph: { title: "winkox — Khelo aur Kamao", description: "Games khel kar earning karein. JazzCash & Easypaisa se instant deposit & withdraw.", url: "https://winkox.shop", siteName: "winkox", images: ["/lobby/hero.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#050b0f" }, { media: "(prefers-color-scheme: light)", color: "#050b0f" }],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const theme = await getTheme();
  const ur = locale === "ur";
  return (
    <html lang={locale} dir={ur ? "rtl" : "ltr"} data-scroll-behavior="smooth" className={`${ur ? "lang-ur" : ""} ${theme === "light" ? "light" : ""}`.trim()} suppressHydrationWarning>
      <head>
        {ur && <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet" />}
      </head>
      <body className="wx-bg min-h-screen text-slate-100 antialiased">
        <ParticlesBackground />
        <div className="relative z-[1]">
          <I18nProvider locale={locale}>{children}<PromoPopups /></I18nProvider>
        </div>
      </body>
    </html>
  );
}
