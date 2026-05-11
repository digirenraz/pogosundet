import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";

// Inter loaded once here; the CSS variable is referenced in globals.css @theme.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PoGoSundet",
  description: "Find dit lokale Pokémon GO community i Frederikssund",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PoGoSundet",
  },
  icons: {
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#00b09f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Run server functions in Dublin — same AWS region as Supabase EU (eu-west-1).
// Cuts function↔Supabase round-trip from ~80ms (US East default) to ~5ms.
// Cascades to all child pages/layouts unless they override; route.ts handlers
// must declare their own (Next.js does not inherit preferredRegion into routes).
export const preferredRegion = "dub1";

// Root layout — provides the HTML shell, font variable, and PWA hooks.
// All locale-specific logic (NextIntlClientProvider) lives in
// src/app/[locale]/layout.tsx, which wraps every user-facing route.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className={inter.variable}>
      <body className="bg-background text-foreground antialiased">
        <ServiceWorkerRegistration />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
