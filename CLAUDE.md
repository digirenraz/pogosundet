# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is read automatically at the start of every Claude Code session.
Do not delete it. Update it at the end of each session if any decisions changed.

For first-time environment setup (Supabase project, env vars, Google OAuth), see `docs/setup.md`. VAPID keys and Edge Function deployment are covered in the Pre-launch checklist below.

---

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Run all unit tests | `npm run test` |
| Watch unit tests | `npm run test:watch` |
| Run single unit test file | `npx vitest run src/lib/profile/validation.test.ts` |
| Run all e2e tests | `npm run test:e2e` |
| Run e2e in UI mode | `npm run test:e2e:ui` |
| Run single e2e file | `npx playwright test e2e/smoke.spec.ts` |

---

## Code architecture

### Supabase clients — three distinct files, never mix them
- `src/lib/supabase/client.ts` — browser-side (Client Components only)
- `src/lib/supabase/server.ts` — server-side (Server Components, Route Handlers)
- `src/lib/supabase/admin.ts` — service role key, privileged ops only (e.g. account deletion). Never import in client components.

### Middleware (src/proxy.ts)
Next.js 16 renamed `middleware.ts` → `proxy.ts`. It chains two middlewares: Supabase session refresh (`updateSession`) then next-intl locale routing. Auth cookies are manually copied from the Supabase response onto the intl response to prevent loss.

### i18n routing
`localePrefix: 'as-needed'` — URLs are `/login`, `/players` (no `/da/` prefix). All pages live under `src/app/[locale]/`. Use `getTranslations()` in Server Components and `useTranslations()` in Client Components. All strings in `messages/da.json`.

### Auth flow
- Google OAuth + email/password via Supabase Auth
- OAuth callback: `src/app/auth/callback/route.ts`
- Email confirmation: `src/app/auth/confirm/route.ts`
- After login, redirect to `/players` (the main screen for logged-in users)
- Home page (`/`) is logged-out only

### Lib structure
- `src/lib/profile/` — `validation.ts` (pure), `helpers.ts` (client Supabase), `server-helpers.ts` (server Supabase), `filters.ts` (player search/filter logic), each with a co-located `.test.ts`
- `src/lib/raids/` — `validation.ts` (pure), `helpers.ts` (client: createRaid, joinRaid, leaveRaid, updateAttendeeExtra), `server-helpers.ts` (getActiveRaids, getRecentRaids → `{active, expired}`, getRaidById), `message-helpers.ts` (client: sendMessage, getMessagesForRaid), `use-raids-realtime.ts` (client hook used by both `RaidList` and `RaidDetail`: subscribes to Supabase Realtime on raids/raid_attendees/raid_messages and calls `router.refresh()` on changes, debounced 250ms — server stays the source of truth for embedded joins), `bosses.ts` (quick-pick list), `pokemon.ts` (~600 Pokémon names for boss autocomplete). Note: `raid_attendees.user_id` and `raid_messages.user_id` both FK to `profiles.user_id` (unique), **not** `profiles.id` — required for embedded Supabase queries `profiles(trainer_name)`.
- `src/lib/push/subscription-helpers.ts` — getPushStatus, subscribeToPush, unsubscribeFromPush (browser Push API + Supabase upsert)
- `src/lib/account/server-helpers.ts` — account deletion using admin client
- Tests use Vitest + jsdom + `@testing-library/jest-dom`; `@` alias maps to `src/`

### Supabase Storage
- Bucket `raid-images` — stores raid screenshots uploaded by users
- Requires two manually created RLS policies: INSERT for authenticated users, SELECT for public (not set automatically on bucket creation)

### Account deletion
`POST /api/account/delete` — verifies session, calls `deleteAccount()` using the admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### Database migrations
SQL migrations live in `supabase/migrations/` as reference files. No runner — paste the SQL into the Supabase SQL editor manually. The Supabase CLI is only used for deploying Edge Functions (`supabase functions deploy`).

Current migrations: `001_create_profiles`, `002_create_raids`, `003_raid_chat`, `004_push_subscriptions`, `005_realtime`. Current Edge Functions: `notify-raid` (in `supabase/functions/`).

⚠️ **`005_realtime.sql` is not yet applied in Supabase.** Until it is, the `useRaidsRealtime` hook will subscribe but receive no change events — the overview and detail screens won't auto-update. If you're debugging "live updates not working", apply this migration first.

---

## Project overview

**PoGoSundet** is a mobile-friendly web app for the local Pokémon GO community in
Frederikssund, Denmark. It lets players create profiles, find each other, share
Trainer Codes, coordinate raids, and — in Phase 2 — handle trades and richer
messaging.

The product owner is a non-technical product manager. Claude Code is the
primary implementation tool. Code must be clean, well-commented, and easy to
hand off to a future developer.

---

## Tech stack (locked — do not change without explicit instruction)

| Layer       | Choice                          | Notes                                      |
|-------------|----------------------------------|---------------------------------------------|
| Frontend    | Next.js (App Router)            | Single codebase, mobile-first               |
| Backend/DB  | Supabase                        | EU/Ireland region — required for GDPR       |
| Auth        | Supabase Auth                   | Google OAuth + email/password in Phase 1    |
| Hosting     | Vercel                          | Free tier adequate for initial scale        |
| i18n        | next-intl                       | Danish-first; architecture supports more    |
| PWA / Push  | Manual sw.js + web-push (self-hosted via Supabase Edge Functions) | Implemented in Slices 7–8; no next-pwa dependency needed |

**Do not suggest alternative frameworks, ORMs, or services** unless there is a
concrete blocker. When in doubt, ask before introducing a new dependency.

---

## Auth decisions (Phase 1)

- ✅ Google OAuth — implement in Phase 1
- ✅ Email/password — implement in Phase 1
- ❌ Facebook Login — deferred until after Phase 1 is stable (app review complexity)

---

## Phase plan

### Phase 1 — near complete
User profiles and community discovery:
- Registration and login (Google OAuth + email/password) ✅
- User profile: trainer name, friend code, first name, bio ✅
- Browse and search community members ✅
- Display Trainer Code (for use inside Pokémon GO — not an in-app social graph) ✅
- GDPR compliance (see below) ✅

### Raid MVP — launch blocker (Slices 6–8)
Without raid coordination, the community is unlikely to return to the app. These
slices must ship before public launch.

- Post a raid, see active raids, join/leave
- PWA installability (required for iOS push)
- Web push notifications when a raid is posted

See **Raid MVP scope** and **Push notifications approach** below.

### Phase 2 — do not build yet
- DMs (direct messages between players)
- Trade requests
- Admin roles and moderation tools
- Richer raid features: remote lobby codes, filters, recurring raids, history

**If a Raid MVP feature would require significant refactoring to support Phase 2,
flag it and ask. Otherwise, do not pre-build Phase 2 functionality.**

---

## Raid MVP scope (Slices 6–8)

Deliberately small. The community is ~20–200 people with a handful of raids per
day. The feature must be **faster than taking a screenshot and posting it in
Messenger** — which is what people do today.

### In scope (all implemented)
- **Post a raid:** screenshot upload (primary), boss autocomplete (BossSearch — full Pokémon list), gym search (GymSearch — OSM + freeform fallback), start time quick picks (Nu/+5/+10/+15 min), extra player count, optional note
- **List of active raids:** single screen, newest first, auto-hides ~45 min after start time; expired raids shown greyed out below
- **Raid card (Flow A):** thumbnail left, boss + gym + timer badge, message count, trainer count, RSVP strip with extra-player stepper and Share button
- **Raid detail screen** (`/raids/[id]`): hero image, attendee list with avatar initials, per-raid chat — live updates via Supabase Realtime (no polling)
- **Join / leave:** single button toggles state; poster auto-joined on submit
- **Push notifications:** web push on new raid insert (PWA only)

### Out of scope (do NOT build in the Raid MVP)
- Remote raid lobby code sharing
- Recurring raids or raids scheduled more than a few hours out
- Raid history, stats, or past-raid browsing
- Filters, search, sort options on the list
- Host/organiser roles

### Messenger bridge (launch fallback)
Not all users will install the PWA on day one. To avoid the feature dying on
launch, each raid card has a **"Share to Messenger"** button that opens
Messenger with the raid link and details pre-filled. The poster taps it
themselves — this is a manual step, not automated (see Decisions Log
2026-04-19).

---

## Push notifications approach (Slice 8)

**Why self-hosted web push, not OneSignal:** we're already on Supabase, a 20–200
user scale doesn't need a third-party push service, and keeping everything in
one stack is simpler to hand off later.

### Stack
- **Client:** PWA service worker registers a push subscription using the
  browser's Push API; subscription stored in a `push_subscriptions` Supabase
  table (user_id, endpoint, keys, created_at)
- **Server:** Supabase Edge Function triggered on `INSERT` into the `raids`
  table; sends web push to all active subscriptions using the `web-push` npm
  library and VAPID keys stored as Supabase secrets
- **Scope:** one notification type for now — "new raid posted". Tapping the
  notification opens the raid card

### Platform reality
- **Android (Chrome/Firefox/etc.):** works out of the box once PWA installed
- **iOS 16.4+:** works only if user adds the PWA to home screen **via Safari**
  (Chrome on iOS uses WebKit underneath but does not expose the PWA install
  flow that enables push). The iOS onboarding must tell users to open the app
  in Safari first.
- **Users who don't install the PWA:** get no push. The Messenger share button
  is their fallback.

### iOS onboarding
Designed in **Claude Design** — step-by-step visual guide covering:
1. Open the app in Safari (if currently in Chrome/another browser)
2. Tap Share → Add to Home Screen → Add
3. Open the app from the home screen icon
4. Allow notifications when prompted

---

## GDPR requirements (Phase 1 — non-negotiable)

Denmark is in the EU. All of the following are required before launch:

- [x] Privacy Policy page (Danish language) — implemented in Slice 5
- [x] Explicit consent checkbox at registration (not pre-ticked) — implemented in Slice 1
- [x] All user data stored in Supabase EU/Ireland region — configured at project creation
- [x] Account deletion: user can delete their own account and all associated data — implemented in Slice 5
- [x] No third-party analytics or tracking without consent — no analytics added

When building any feature that touches personal data, ask: *does this comply
with the GDPR checklist above?*

### Privacy Policy maintenance

The Privacy Policy lives at `src/app/[locale]/privacy/page.tsx` with content in `messages/da.json` (Privacy section).

**Update the Privacy Policy whenever:**
- A new personal data field is added to user profiles (e.g. location, team, level, phone number)
- A new third-party service is introduced (analytics, push notifications, maps, etc.)
- The data controller contact details change
- The data retention policy changes

The "last updated" date is in `messages/da.json` → `Privacy.lastUpdated`. Always bump it when content changes.

**Known upcoming updates:**
- None currently — Privacy Policy was updated in Slice 8 to disclose push subscription data.

---

## Location approach (Phase 1)

- **Manual text entry only** — user types their area (e.g. "Frederikssund centrum")
- No GPS, no geolocation API, no map integrations in Phase 1
- Store as a plain text field on the profile

---

## Language and i18n

- Default language: **Danish (da)**
- All UI strings must go through next-intl — no hardcoded Danish (or English) text
  in components
- Translation files live in `/messages/da.json` (and `/messages/en.json` as a
  stub for future use)
- Do not add a language switcher in Phase 1 — the architecture supports it,
  but the UI does not need it yet

---

## Coding standards

- Use **TypeScript** throughout — no plain `.js` files in `src/`
- Use **Tailwind CSS** for styling — no separate CSS files unless unavoidable
- Components go in `src/components/`, pages in `src/app/`
- Supabase client logic goes in `src/lib/supabase/`
- Keep components small and single-purpose
- Add a short comment at the top of any non-obvious function explaining *why*,
  not just *what*
- Prefer explicit over clever — this codebase may be read by a non-developer

---

## Testing strategy

Two layers, both run in CI:

**Unit / logic tests — Vitest**
- TDD: write the test first, confirm it fails, then implement
- Scope: pure functions and Supabase helpers (validation, filters, server-helpers)
- Co-located with the code they test (e.g. `src/lib/profile/validation.test.ts`)
- Run: `npm run test` (single) / `npm run test:watch`

**Browser verification — Playwright**
- When a change has any user-visible effect, verify it in a real browser via the Playwright MCP **and** capture the same steps as a Playwright test file so the verification becomes a CI regression test.
- One Playwright file per user flow (post a raid, join/leave, chat, install PWA prompt, etc.); spec files live in `e2e/` and run against the dev server.
- The "no UI tests / no e2e" rule from earlier slices is **superseded** by this — manual smoke testing alone is no longer enough.

**PR gate:** all tests must pass before opening a PR — treat a failing test as a broken build.

---

## Git workflow

- `main` branch is always deployable
- One feature branch per vertical slice: `slice/1-registration`, `slice/2-profile`, etc.
- Open a PR to `main` when a slice is complete
- Do not commit directly to `main`
- Commit messages: short, imperative, in English (e.g. `Add Trainer Code display`)

---

## Vertical slices

Slices 1–9 implemented and merged. Migration `005_realtime.sql` still pending manual application in the Supabase SQL editor. Each slice or chore gets its own short-lived branch **off `main`** (e.g. `slice/N-name`, `chore/short-name`), and the branch is deleted after its PR merges. Do not start a new slice until the current one is merged. See the Phase plan above for what's in/out of scope, and the Decisions log for resolved questions per slice.

---

## Scale and cost constraints

- Target: 20–200 users initially, Frederikssund only
- Supabase free tier is acceptable for Phase 1 + Raid MVP
- Vercel free tier is acceptable for Phase 1 + Raid MVP
- Do not add services, queues, caches, or background workers unless a concrete
  problem requires them

---

## Decisions log

Update this section at the end of each session. Entries older than ~4 weeks live in [`docs/decisions-archive.md`](docs/decisions-archive.md).

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-04-19 | Raid MVP added as Slices 6–8; launch blocker, not Phase 2 | Without raid coordination, community won't return to the app |
| 2026-05-07 | Playwright MCP for browser verification; verifications captured as Playwright spec files in `e2e/` and run in CI | Manual smoke checks regress silently; converting each verification into a test gives a regression suite for free. Supersedes the earlier "no UI tests / no e2e" rule. |
| 2026-05-07 | Each slice/chore branches off `main` and is deleted on merge | Earlier work piled onto `slice/1-registration` (PRs #1–#7 all opened from that one branch instead of fresh per-slice branches). Cleanup retired the misuse and `slice/9-realtime` + `chore/playwright-ci` were the first PRs done correctly. |
| 2026-05-07 | Client-only gating uses `useMounted` (`useSyncExternalStore`-based) instead of useState+useEffect | The React 19 `react-hooks/set-state-in-effect` lint rule fires on the canonical "did mount" pattern. The hook in `src/lib/hooks/use-mounted.ts` returns `false` on the server and `true` post-hydration without setState-in-effect, so `localStorage` / `matchMedia` / `navigator` checks can be guarded during render. Used by `PushSubscribePrompt` and the iOS onboarding page. |
| 2026-05-07 | CI workflow live on `main`: lint → vitest → Playwright on every PR and push | Three GitHub Actions secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) drive the e2e dev server. First green run: 2026-05-07 on `ad66f2c`. Failure annotation about Node 20 deprecation is non-blocking until June 2026. |
| 2026-04-19 | Raid list is intentionally minimal: one list, newest first, auto-hide ~45 min after start | Handful of raids/day; filters/search/sort add no value |
| 2026-04-19 | Raid MVP excludes chat, remote lobby codes, recurring raids, history, filters | Keep it faster than the Messenger screenshot workflow |
| 2026-04-19 | Push notifications via self-hosted web-push + Supabase Edge Function (not OneSignal) | Stays in existing stack; 20–200 users doesn't justify third-party service |
| 2026-04-19 | PWA required for push notifications (iOS 16.4+ only works when installed to home screen via Safari) | Platform constraint, not a choice |
| 2026-04-19 | iOS "Add to Home Screen" onboarding designed in Claude Design | Needs explanatory/instructional visuals, not standard UI screens |
| 2026-04-19 | iOS onboarding must instruct Chrome users to switch to Safari first | Chrome on iOS doesn't expose the PWA install flow that enables push |
| 2026-04-19 | Messenger cross-posting is a manual "Share to Messenger" button, not automated | Messenger has no public group-posting API; deep link + poster's tap is the realistic path |
| 2026-04-19 | Raid post form: screenshot is the primary input, all other fields optional | Matches existing community workflow — take screenshot, post with short note |
| 2026-04-19 | Share button uses Web Share API with clipboard copy fallback | Works natively on Android; on desktop falls back to copying text |
| 2026-04-19 | Active raid filter uses Supabase .or() with dynamic 45-min threshold | COALESCE(starts_at, created_at) not directly expressible in SDK; .or() handles both cases |
| 2026-04-19 | Slice 6 implemented on branch slice/6-raids | raids + raid_attendees tables; Supabase Storage bucket raid-images must be created manually |
| 2026-04-19 | Raid start time options: Nu / +5 min / +10 min / +15 min | Tighter range fits real raid coordination better than the original +30/+60 options |
| 2026-04-19 | Active raid filter uses client-side JS, not PostgREST .or() | PostgREST timestamp syntax in .or() failed silently; JS filter on server is reliable and testable |
| 2026-04-19 | FK added from raid_attendees.user_id to profiles.user_id | Required for Supabase embedded query profiles(trainer_name) to work; profiles.user_id is unique |
| 2026-04-19 | Supabase Storage bucket raid-images needs two manual policies | INSERT for authenticated users, SELECT for public — not set automatically on bucket creation |
| 2026-04-29 | Design tool switched from Banani to Claude Design (claude.ai/design) | All future screen designs come from Claude Design handoff bundles |
| 2026-04-29 | Chat added to Raid MVP (not Phase 2) | Claude Design handoff included per-raid chat; community needs it to replace Messenger |
| 2026-04-29 | Extra player count on RSVP (raid_attendees.extra_count) | Posters/joiners can say "Jeg er med + 2 ekstra"; total trainer count shown on card |
| 2026-04-29 | Raid detail screen at /raids/[id] — hero image, RSVP, attendees, chat | Tap card → detail; chat polls every 10s; Supabase realtime can replace polling later |
| 2026-04-29 | Boss field replaced with BossSearch autocomplete (full Pokémon list in pokemon.ts) | Dropdown was too rigid; search works for any boss including future rotations |
| 2026-04-29 | Gym field replaced with GymSearch (OSM Overpass API, cached, freeform fallback) | User confirmed OSM in design session; overpass-api.de, 25km radius around Frederikssund |
| 2026-04-29 | Poster is auto-joined to raid_attendees on submit (with extra_count) | Needed so poster's name appears in attendee list and totalTrainers count is accurate |
| 2026-04-29 | "Sluttede raids" section shows expired raids (45min–2h) greyed out inline | Cards go opacity-50 + grayscale; no RSVP strip; getRecentRaids returns both active+expired |
| 2026-04-29 | Migration 003 must be run manually in Supabase SQL editor | Adds extra_count to raid_attendees + creates raid_messages table with RLS |
| 2026-04-29 | Slice 8 implemented: push_subscriptions table, PushSubscribePrompt banner, Edge Function notify-raid | Web push via self-hosted VAPID; Edge Function deployed manually with `supabase functions deploy notify-raid` |
| 2026-04-29 | supabase/functions/ excluded from tsconfig.json | Deno Edge Function uses npm: specifiers unsupported by Next.js TypeScript checker |
| 2026-04-29 | Privacy Policy updated to section 11 disclosing push subscription data; lastUpdated bumped to maj 2026 | GDPR requirement — push endpoint + keys are personal data |
| 2026-04-29 | PushSubscribePrompt only shows in standalone PWA mode (display-mode: standalone) | Push only works reliably when PWA is installed; avoids misleading browser users |
| 2026-05-03 | Slice 7 PWA: manual sw.js (not next-pwa), manifest.json, icon.svg | next-pwa not needed for installability; sw.js extended in Slice 8 for push handler |
| 2026-05-03 | PWA icon is placeholder SVG (PG on teal) — replace before launch | Real branded PNG icons (192×192, 512×512) needed for home screen quality |
| 2026-05-03 | InstallPrompt component handles Android "Add to Home Screen" banner | iOS never fires beforeinstallprompt — iOS users use /onboarding/ios guide instead |
| 2026-05-03 | git user.email must be set to renraz@googlemail.com | Vercel blocks deployments from commits with unmatched email addresses |
| 2026-05-06 | Live updates via Supabase Realtime, not polling | Coordinating raids must feel as instant as Messenger; 10s polling is too slow. Hook `useRaidsRealtime` subscribes per screen and triggers `router.refresh()` (debounced 250ms) — server stays the source of truth for embedded joins. Migration 005 enables Replication on raids/raid_attendees/raid_messages. |

---

## Pre-launch checklist

Before making the app publicly available:

**From Phase 1:**
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables (needed for account deletion)
- [ ] Test Google OAuth with the production Supabase URL (not just local)
- [ ] Verify Supabase project is on EU/Ireland region (already confirmed, but double-check before launch)
- [ ] Decide on a real domain name and configure it in Vercel + Supabase allowed URLs
- [ ] Add the production domain to Supabase Auth → URL configuration (Site URL + Redirect URLs)

**From Raid MVP (Slices 6–8):**
- [ ] **Run migration 005_realtime.sql in Supabase SQL editor** — enables Replication on raids/raid_attendees/raid_messages so the `useRaidsRealtime` hook receives change events. Without this, the overview and detail screens won't auto-update.
- [ ] **Smoke-test Realtime end-to-end on both devices** — after migration 005 is applied: open raids overview on Android, post a raid / send a chat / RSVP from iOS (and vice-versa). Changes should appear on the other device within ~300ms. If nothing happens, check the browser console for channel subscription errors and verify Replication is on for all three tables.
- [ ] **Investigate: chat not visible on raid detail screen** — verify migration 003 applied (raid_messages table exists), check Vercel logs, check browser console on /raids/[id]
- [ ] Test PWA install flow end-to-end on a real iPhone via Safari (not simulator)
- [ ] Test PWA install flow on Android Chrome
- [ ] **Push notifications not firing on installed PWAs (iOS + Android) — investigate.** Both devices accepted the OS notification prompt but no notification arrives when a new raid is posted. Code path looks correct (`subscribeToPush` → `push_subscriptions` row → webhook → `notify-raid` Edge Function → `web-push` → `sw.js` push handler). Run these checks in the Supabase dashboard, in order — first miss is the culprit:
  1. **`push_subscriptions` table** — are there actually rows for both user_ids? If not, the OS prompt fired but the upsert silently failed (RLS, network, stale permission state).
  2. **Database → Webhooks** — is there a webhook on `public.raids` INSERT pointing at `https://<ref>.supabase.co/functions/v1/notify-raid` with `Authorization: Bearer <SERVICE_ROLE_KEY>` header? Easy to lose after re-linking the project.
  3. **Edge Functions → notify-raid → Logs** — post a test raid. Any invocations? What status code? No invocations → webhook isn't firing (back to #2).
  4. **VAPID key match** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel) and `VAPID_PUBLIC_KEY` (Supabase secret) must be from the same keypair. If regenerated on one side only, every send returns 403 and existing subscriptions are permanently invalid — users must unsubscribe + resubscribe.
- [ ] Replace placeholder PWA icon (public/icon.svg) with real branded PNG icons (192×192, 512×512)
- [ ] Seed the raid boss quick-pick list with current raid bosses before launch

_Resolved items (VAPID keys generated, migrations 003/004 applied, Edge Function deployed, webhook configured, Privacy Policy section 11 added) removed for clarity — see git history if needed._

---

## Open questions

- **Messenger vs Discord:** If the "Share to Messenger" manual step creates too
  much friction, or if community adoption of the PWA lags, evaluate migrating
  the community group to Discord (webhook-based auto-posting into a channel is
  trivial there). Decide after 2–4 weeks of real raid usage post-launch.
- **Raid boss list maintenance:** currently maintained manually. If it becomes a
  burden, consider a lightweight admin-only edit screen (but defer until it's
  actually a problem).

---

## Design workflow

Designs come from **Claude Design** (claude.ai/design). The user exports a handoff bundle directly from Claude Design and shares the URL here. The bundle is a gzip-compressed tar archive containing:
- `README.md` — full spec: screens, measurements, design tokens, interaction logic
- `*.html` — interactive prototype (read the source; do not screenshot)
- Component `.jsx` files and `colors_and_type.css`

To read a handoff bundle: fetch the URL, decompress with `gunzip`, extract files with `tar -x -O`, read the README first then the relevant HTML/JSX files.

Final decisions from each design session are recorded in the Decisions Log below.

---

## How to work with me

- I am a product manager, not a coder. Explain technical decisions briefly.
- Before making an architectural choice not covered here, **ask first**.
- If a task is ambiguous, **ask one clarifying question** before proceeding.
- At the end of each session, **update the Decisions Log** above with anything
  that was resolved.
- Keep responses practical. Prefer working code over lengthy explanation.
