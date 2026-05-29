// Sentry initialisation for the Node.js server runtime (Server Components,
// Route Handlers). Loaded from src/instrumentation.ts's register() hook.
//
// GDPR: sendDefaultPii is false — Sentry will NOT attach IP addresses,
// cookies, or request bodies. Keep it that way unless the Privacy Policy is
// updated and consent is handled. The DSN must point at an EU-region project.
//
// No-ops when NEXT_PUBLIC_SENTRY_DSN is unset (local dev / CI without a DSN),
// so nothing is sent and no init errors are thrown.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Error tracking only — no performance tracing or profiling for now.
  tracesSampleRate: 0,

  // Privacy: never collect IP / cookies / user PII without consent.
  sendDefaultPii: false,

  // Quieter logs; flip on temporarily when debugging the integration itself.
  debug: false,
});
