# Pre-launch checklist

Operational checklist for making PoGoSundet publicly available. Lives outside `CLAUDE.md` so the session-loaded file stays focused on architecture; pointed to from `CLAUDE.md`.

Update this file as items are completed or new ones surface. Keep `CLAUDE.md`'s pointer in sync if the file is renamed or split.

---

## From Phase 1

- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables (needed for account deletion)
- [x] Test Google OAuth with the production Supabase URL (not just local) — verified 2026-05-19
- [ ] Verify Supabase project is on EU/Ireland region (already confirmed, but double-check before launch)
- [ ] Decide on a real domain name and configure it in Vercel + Supabase allowed URLs
- [ ] Add the production domain to Supabase Auth → URL configuration (Site URL + Redirect URLs)

### Sentry error logging (wired 2026-05-29 — disabled until DSN is set)

The code is in place but Sentry stays completely inert until `NEXT_PUBLIC_SENTRY_DSN` is set. To turn it on:

- [ ] Create a Sentry project (platform: **Next.js**) in an **EU region** (DSN must contain `.de.`, e.g. `...ingest.de.sentry.io`) — required for GDPR.
- [ ] Add `NEXT_PUBLIC_SENTRY_DSN` to Vercel env vars (Production + Preview). This alone enables error capture.
- [ ] (Optional, for readable production stack traces) Add `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` to Vercel so the build uploads source maps. Without them the build still works; traces are just minified.
- [x] **GDPR — Privacy Policy updated 2026-05-29:** §7 (Databehandlere) now discloses Sentry as an EU-region error-logging processor; `Privacy.lastUpdated` bumped. (Sentry deliberately collects no IP/PII — `sendDefaultPii: false`.)
- [ ] Verify: with the DSN set, trigger a test error and confirm it lands in the Sentry dashboard (e.g. temporarily throw in a route, or use `Sentry.captureException(new Error("test"))`).

## From Raid MVP (Slices 6–8)

- [x] Test PWA install flow end-to-end on a real iPhone via Safari (not simulator) — verified 2026-05-19, push notifications arriving
- [x] Test PWA install flow on Android Chrome — verified 2026-05-19, push notifications arriving
- [x] Replace placeholder PWA icon (public/icon.svg) with real branded PNG icons (192×192, 512×512) — done 2026-05-19, glossy Pokéball on teal brand background (Claude Design handoff); manifest, layout.tsx apple-touch-icon, and sw.js precache + push notification icon all updated; SW cache bumped to v3
- [ ] Seed the raid boss quick-pick list with current raid bosses before launch
- [ ] **Verify the Android share target on a real installed PWA** (added 2026-05-31, `feat/android-share-target`). On an Android phone with PoGoSundet installed to the home screen: take/open a screenshot, tap Share, and confirm **PoGoSundet** appears in the share sheet; sharing into it should open the new-raid form with the screenshot already attached. iOS does **not** support this (expected — no need to test there). The in-app consuming half (cache → pre-filled form) is already verified locally; this checks only the OS-share-sheet → service-worker hand-off, which can't be tested off-device.
- [ ] **Verify mark-completed + raid reactions on prod** (added 2026-05-31, `slice/raid-completion-reactions` / PR #84). As the **poster** of a raid: open it → tap **"Marker som gennemført"** → confirm it gets a "Gennemført" badge and moves to the greyed "Sluttede raids" section. Couldn't be verified pre-merge (poster-only; tester was on a non-poster account). Also confirm **cross-user reaction realtime**: react (TfR! / shiny / hundo) on one device and confirm a second device sees the count update live — only provable on real prod, not `npm run dev` (the data layer + RLS are already DB-verified).

## Push notifications — runbook (keep for future regressions)

End-to-end working on iOS + Android as of 2026-05-10. The original investigation surfaced multiple silent failure modes, all in this same pipeline. If push regresses, run these checks in the Supabase dashboard in order — first miss is the culprit:

1. **`push_subscriptions` table** — are there fresh rows for the affected user_ids? If subscribe silently failed (RLS, network, stale permission state), the row is missing or stale.
2. **Database → Webhooks** — does `notify-raid-on-insert` exist on `public.raids` INSERT, pointing at `/functions/v1/notify-raid`, with `Authorization: Bearer <SERVICE_ROLE_KEY>` (NOT the literal placeholder)? Easy to lose after re-linking.
3. **Edge Functions → notify-raid → Logs / Invocations** — post a test raid. Zero invocations → webhook isn't firing (back to #2). 500 → check the function logs for the error (look for `[notify-raid] send failed` or missing-secret errors).
4. **VAPID secrets match** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel) and `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (Supabase Edge Function Secrets) must come from the same keypair. If any side was regenerated, every send returns 401/403 and all existing `push_subscriptions` rows are bound to the old key and must be deleted; users must clear browser site data and re-subscribe.
5. **Stale browser-level subscription** — a `push_subscriptions` DB row alone does not prove the device can receive. The browser caches a subscription bound to the VAPID public key it saw at subscribe time. If the keypair was rotated, the device must clear site data + re-grant notification permission to refresh the cached subscription. Toggling OS-level notification permission does NOT do this.
6. **Android OS-level mute** — Settings → Apps → \[PWA\] → Notifications. The OS can silently mute everything even when the in-app subscription succeeded.

_Resolved items (VAPID keys regenerated 2026-05-10, migrations 003/004/005 applied, Edge Function deployed with error logging, webhook configured with real service-role JWT, Privacy Policy section 11 added) removed for clarity — see git history if needed._
