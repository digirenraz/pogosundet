import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter loaded once here; the CSS variable is referenced in globals.css @theme.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PoGoSundet",
  description: "Find dit lokale Pokémon GO community i Frederikssund",
};

// Root layout — provides the HTML shell and font variable.
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
        {children}
      </body>
    </html>
  );
}
