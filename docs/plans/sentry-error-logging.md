# Plan: Sentry error logging

**Branch:** `slice/sentry-error-logging`
**Date:** 2026-05-29

## Decisions (from PM)
- **Scope:** error tracking only — server (Node) + Edge (proxy.ts) + client (browser/PWA). **No** session replay, **no** performance tracing for now.
- **GDPR:** `sendDefaultPii: false` everywhere; do not attach IP/cookies/user PII. EU-region Sentry project required.
- **DSN:** read from env var `NEXT_PUBLIC_SENTRY_DSN`; PM fills it into Vercel + `.env.local`. No DSN committed.
- **Edge Functions** (`notify-raid`, `notify-dm`, Deno) left out of scope for now — would use `@sentry/deno` in a follow-up.
- **No setup wizard** — manual wiring to fit Next 16 + `proxy.ts` + next-intl.

## Steps
1. `npm install @sentry/nextjs`.
2. `src/instrumentation.ts` — `register()` loads server/edge config by runtime; export `onRequestError = Sentry.captureRequestError`.
3. `src/instrumentation-client.ts` — client `Sentry.init`; export `onRouterTransitionStart`.
4. `sentry.server.config.ts` — Node init (root, not src — Sentry convention; referenced from instrumentation).
5. `sentry.edge.config.ts` — Edge init.
6. `src/app/global-error.tsx` — root error boundary, `Sentry.captureException`, own `<html>/<body>`.
7. Wrap `next.config.ts` export with `withSentryConfig` (after `withNextIntl`). Disable source-map upload unless `SENTRY_AUTH_TOKEN` present; keep telemetry off.
8. All `init` calls guarded so they no-op when `NEXT_PUBLIC_SENTRY_DSN` is unset (no errors in dev/CI without a DSN).
9. `.env.local.example` — add `NEXT_PUBLIC_SENTRY_DSN` (+ optional `SENTRY_AUTH_TOKEN`/org/project for source maps) with comments incl. EU-region note.
10. `.gitignore` — add `.sentryclirc` / `.env.sentry-build-plugin`.
11. Smoke test: `npm run build` passes with DSN unset; lint passes.
12. Docs: note in `docs/launch-checklist.md` (PM ops: create EU project, set env in Vercel) + Decisions log entry. GDPR Privacy Policy: error logging with PII scrubbing — assess whether a §/lastUpdated bump is needed.

## Verification
- Build green with no DSN (init no-ops).
- With a dummy DSN set, throw a test error and confirm `captureException` path compiles (manual browser check on dev once PM supplies a real DSN).
