import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl plugin wires up getTranslations() / useTranslations() in Server Components.
// The path points to the request config that loads messages per locale.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Tree-shake lucide-react's barrel so we only ship the icons we actually use.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Allow next/image to optimize raid screenshots and avatars served from Supabase Storage.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default withNextIntl(nextConfig);
