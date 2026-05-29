import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

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

// withSentryConfig wraps the build to capture server/edge errors and (when a
// SENTRY_AUTH_TOKEN is present) upload source maps so stack traces are readable.
// Order matters: keep withNextIntl innermost so its plugin still runs.
//
// Source-map upload only happens in CI/production where SENTRY_AUTH_TOKEN +
// org/project are set — locally and in PR builds without those, it is skipped
// and the build is unaffected. Telemetry to Sentry is disabled.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Don't upload source maps unless we have credentials for it.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // No usage telemetry from the build plugin.
  telemetry: false,

  // Keep build logs quiet.
  silent: !process.env.CI,
});
