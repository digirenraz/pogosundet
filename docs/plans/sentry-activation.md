# Activate Sentry error monitoring (professionalisation report #3)

**Status: ✅ DONE — live on prod.** DSN set in Vercel (Production + Preview) on 2026-05-29 against the EU project `pogosundet`; **re-verified capturing 2026-06-25** (a triggered client error on the live site produced Sentry envelope POSTs to `…ingest.de.sentry.io/…/envelope/` returning `200`, SDK `sentry.javascript.nextjs/10.60.0`, `window.__SENTRY__` present). The 2026-06-24 professionalisation report listed this as "open" only because a code-only review can't see Vercel env vars.

**Remaining (both optional):** source-map vars (`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) for un-minified traces, and `@sentry/deno` for the Edge Functions (Steps 3 + "Known gap" below). The Step 1–2 setup below is kept as a record / for recreating the project if ever needed.

## Why

The workflow is "verify on prod" — but right now there's **no way to see when prod throws an error**. The Sentry SDK is already installed and configured; it does nothing because no DSN is set. Turning it on is the single biggest prod-visibility upgrade available, and it's already half-built.

## What's already done (no action needed)

- ✅ `@sentry/nextjs` installed and configured: `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts` (`register()` + `onRequestError`), `src/instrumentation-client.ts`, `src/app/global-error.tsx` (root boundary → `captureException`), and `next.config.ts` wrapped with `withSentryConfig`.
- ✅ **Error-tracking only, GDPR-safe**: `tracesSampleRate: 0`, no session replay, `sendDefaultPii: false` everywhere (no IP, cookies, or PII attached). Every `init` is guarded by `enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)`, so the code **fully no-ops with no DSN** (clean local/CI builds).
- ✅ **Privacy Policy** §7 (Databehandlere) already discloses Sentry as an EU-region processor; `Privacy.lastUpdated` bumped 2026-05-29.

Everything below is **PM ops** in the Sentry + Vercel dashboards — no code change. This mirrors the (unchecked) items in `docs/launch-checklist.md`.

---

## Runbook

### Step 1 — Create the Sentry project (PM, ~5 min)
- Sign in at **sentry.io** (free account is fine).
- **New project** → platform **Next.js**.
- **Region: EU** — this is mandatory for GDPR. The resulting DSN **must contain `.de.`** (e.g. `https://…@…ingest.de.sentry.io/…`). If the DSN shows `.us.` / no region marker, the project is in the wrong region — recreate it in EU.
- Copy the **DSN** (Settings → Projects → [project] → Client Keys (DSN)).

### Step 2 — Add the DSN to Vercel (PM, ~2 min)
Vercel → Project → Settings → Environment Variables → add:

| Variable | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | the EU DSN from Step 1 | Production **and** Preview |

This single variable enables error capture. It's a `NEXT_PUBLIC_` value (public by design — the DSN is safe to expose).

> The DSN is **build-time inlined**, so production picks it up on the **next build** — i.e. it activates on the next merge to `main` (or trigger a redeploy of the current prod deployment to activate immediately).

### Step 3 — (Optional) readable production stack traces (PM, ~5 min)
Without these, errors still arrive but stack traces are **minified**. To get source-mapped traces, add to Vercel (Production + Preview):

| Variable | Where to get it |
|---|---|
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | the project slug |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens (needs source-map upload scope) |

The build uploads source maps only when `SENTRY_AUTH_TOKEN` is present; without it the build still succeeds.

### Step 4 — Verify it works (PM, ~5 min)
After the DSN is live on a deploy:
- Trigger a test error — easiest is the browser console on the live site: open devtools and run something that throws in app code, **or** ask Claude to add a temporary throwaway route that throws (then remove it).
- Confirm the event lands in the **Sentry dashboard** within a minute.
- Confirm the event has **no IP / no user PII** attached (proves `sendDefaultPii: false`), then resolve it.

---

## Known gap to note

**The four Supabase Edge Functions (Deno: `notify-raid`, `notify-dm`, `notify-raid-message`, `notify-raid-join`) are NOT covered by this Sentry setup** — it's the Next.js app only. If push delivery silently fails inside a function, it won't show in Sentry. Options for later:
- Add `@sentry/deno` to the `notify-*` functions (separate follow-up), or
- At minimum, keep an eye on the **Supabase → Edge Functions → Logs** when debugging push.

## When done
- Tick the Sentry items in `docs/launch-checklist.md` and report **#3** in `docs/professionalisation-report.html` (done badge + note; update the scorecard "Observability" row).
- The CLAUDE.md "Add Sentry for error logging" TODO can then be marked shipped.
- Add a decisions-log entry.
