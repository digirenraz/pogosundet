// Sentry initialisation for the Edge runtime (proxy.ts / middleware and any
// edge route handlers). Loaded from src/instrumentation.ts's register() hook.
//
// Same GDPR posture as the server config: no PII, EU-region DSN, error-only.
// No-ops when NEXT_PUBLIC_SENTRY_DSN is unset.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Error tracking only — no performance tracing.
  tracesSampleRate: 0,

  // Privacy: never collect IP / cookies / user PII without consent.
  sendDefaultPii: false,

  debug: false,
});
