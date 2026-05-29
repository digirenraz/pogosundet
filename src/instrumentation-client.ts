// Sentry initialisation for the browser (client-side React, PWA).
// Next.js 15.3+ loads this file automatically on the client — it replaces the
// old sentry.client.config.ts.
//
// GDPR posture: error tracking only. No session replay, no performance tracing,
// and sendDefaultPii: false so no IP / cookies are attached. The DSN is public
// by design (NEXT_PUBLIC_) — it only allows sending events in, not reading them.
// Must point at an EU-region Sentry project.
//
// No-ops when NEXT_PUBLIC_SENTRY_DSN is unset.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Error tracking only.
  tracesSampleRate: 0,

  // Privacy: no IP / cookies / user PII.
  sendDefaultPii: false,

  debug: false,
});

// Lets Sentry tie errors to the client-side route they happened on.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
