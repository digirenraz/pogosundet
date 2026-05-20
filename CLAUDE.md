# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is read automatically at the start of every Claude Code session.
Do not delete it. Update it at the end of each session if any decisions changed.

For first-time environment setup (Supabase project, env vars, Google OAuth), see `docs/setup.md`. Pre-launch operational tasks (env vars, push debugging runbook, PWA icon replacement, etc.) live in [`docs/launch-checklist.md`](docs/launch-checklist.md).

---

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Production server (after build) | `npm start` |
| Lint | `npm run lint` |
| Run all unit tests | `npm run test` |
| Watch unit tests | `npm run test:watch` |
| Run single unit test file | `npx vitest run src/lib/profile/validation.test.ts` |
| Run all e2e tests | `npm run test:e2e` |
| Run e2e in UI mode | `npm run test:e2e:ui` |
| Run single e2e file | `npx playwright test e2e/smoke.spec.ts` |
| Deploy Edge Function | `npx supabase functions deploy notify-raid` |

No standalone typecheck script — `npm run build` is the type gate (Next.js fails the build on TS errors).

---

## Code architecture

### Supabase clients — three distinct files, never mix them
- `src/lib/supabase/client.ts` — browser-side (Client Components only)
- `src/lib/supabase/server.ts` — server-side (Server Components, Route Handlers)
- `src/lib/supabase/admin.ts` — service role key, privileged ops only (e.g. account deletion). Never import in client components.

### Vercel region — always `dub1`
Every server route and page component must export `export const preferredRegion = "dub1"` (Dublin). Supabase EU runs in AWS eu-west-1 (Ireland); the default US East region adds ~80ms per query. `proxy.ts` exports `regions: ["dub1"]`. Any new route handler or Server Component page that makes Supabase calls must include this export — it is not inherited automatically.

### `next.config.ts` — load-bearing knobs
- `experimental.optimizePackageImports: ['lucide-react']` — tree-shakes the icon barrel. Removing it ships every Lucide icon in every bundle that imports one.
- `images.remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }]` — required for `next/image` to optimise raid screenshots and avatars from Supabase Storage. Any new image origin must be added here or `next/image` will refuse the URL.
- Wrapped in `withNextIntl('./src/i18n/request.ts')` — do not unwrap; it's what loads locale messages for Server Components.

### Middleware (`src/proxy.ts`)
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
- `src/lib/profile/` — `validation.ts` (pure), `helpers.ts` (client Supabase), `server-helpers.ts` (server Supabase), `filters.ts` (player search/filter logic), each with a co-located `.test.ts`; plus `use-presence.ts` (client hook subscribing to the `players-online` Supabase Realtime presence channel, returns a `Set<user_id>` — no DB writes)
- `src/lib/raids/` — `validation.ts` (pure), `helpers.ts` (client: createRaid, joinRaid, leaveRaid, updateAttendeeExtra), `server-helpers.ts` (getActiveRaids, getRecentRaids → `{active, expired}`, getRaidById), `message-helpers.ts` (client: sendMessage, getMessagesForRaid), `use-raids-realtime.ts` (client hook used by both `RaidList` and `RaidDetail`: subscribes to Supabase Realtime on raids/raid_attendees/raid_messages and calls `router.refresh()` on changes, debounced 250ms — server stays the source of truth for embedded joins), `bosses.ts` (quick-pick list), `pokemon.ts` (~600 Pokémon names for boss autocomplete). Note: `raid_attendees.user_id` and `raid_messages.user_id` both FK to `profiles.user_id` (unique), **not** `profiles.id` — required for embedded Supabase queries `profiles(trainer_name)`.
- `src/lib/chat/` — `channels.ts` (hard-coded channel set: `#generelt`, `#app-feedback`), `helpers.ts` (client: sendMessage), `server-helpers.ts` (getMessagesForChannel), `read-helpers.ts` (mark-as-read UPSERT, unread counts), `time.ts` + `time.test.ts` (relative-time formatter), `use-channel-realtime.ts` (per-channel messages + typing broadcast), `use-channel-unread.ts` (BottomNav badge subscriber across both channels), `use-channel-list-typing.ts` (channel-list "X skriver…" preview)
- `src/lib/push/subscription-helpers.ts` — getPushStatus, subscribeToPush, unsubscribeFromPush (browser Push API + Supabase upsert)
- `src/lib/account/server-helpers.ts` — account deletion using admin client
- `src/i18n/routing.ts` and `src/i18n/request.ts` — next-intl config (locales, default locale `da`, `localePrefix: 'as-needed'`); imported by `proxy.ts` and the App Router locale layout
- Tests use Vitest + jsdom + `@testing-library/jest-dom`; setup file at `src/test/setup.ts`; `@` alias maps to `src/`

### Caching — player directory
`getAllProfiles` in `src/lib/profile/server-helpers.ts` uses `unstable_cache` (60s TTL, tag `profiles`). **Must use the admin client** — the server client calls `cookies()` which is unavailable inside `unstable_cache` (runs outside request context). Account deletion calls `revalidateTag('profiles')` for an immediate bust.

### Page-level data fetching
Server page components parallelise independent Supabase queries with `Promise.all`. The pattern: await `getUser()` first, then fire all remaining queries in parallel once `user.id` is known.

### Realtime — chat vs. attendees
Chat messages (`raid_messages`) are appended to local React state via Realtime INSERT events — triggering `router.refresh()` per message caused full RSC page refetches. Attendee changes (`raid_attendees`) still use `router.refresh()` because they need the profile join. The `useRaidsRealtime` hook manages both.

### React 19 patterns
- **Client-only gating** (localStorage, navigator, matchMedia): use `useMounted` from `src/lib/hooks/use-mounted.ts` instead of useState+useEffect. React 19's `react-hooks/set-state-in-effect` lint rule fires on the canonical "did mount" pattern. The hook uses `useSyncExternalStore` and returns `false` on the server, `true` post-hydration.
- **Ref writes during render**: move `ref.current = value` assignments into a `useEffect(() => { ref.current = value; }, [value])` — the `react-hooks/refs` rule disallows synchronous ref writes during render.

### Supabase Storage
- Bucket `raid-images` — stores raid screenshots uploaded by users
- Requires two manually created RLS policies: INSERT for authenticated users, SELECT for public (not set automatically on bucket creation)

### Account deletion
`POST /api/account/delete` — verifies session, calls `deleteAccount()` using the admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### Database migrations
SQL migrations live in `supabase/migrations/` as reference files. No runner — paste the SQL into the Supabase SQL editor manually. The Supabase CLI is only used for deploying Edge Functions (`supabase functions deploy`).

Current migrations: `001_create_profiles`, `002_create_raids`, `003_raid_chat`, `004_push_subscriptions`, `005_realtime`, `006_profile_team_level`, `007_perf_indexes`, `008_channel_messages`, `009_channel_reads`. Current Edge Functions: `notify-raid` (in `supabase/functions/`). All migrations applied.

---

## Project overview

**PoGoSundet** is a mobile-friendly web app for the local Pokémon GO community in Frederikssund, Denmark. Players create profiles, find each other, share Trainer Codes, and coordinate raids.

The product owner is a non-technical product manager. Claude Code is the primary implementation tool. Code must be clean, well-commented, and easy to hand off to a future developer.

---

## Tech stack (locked — do not change without explicit instruction)

| Layer       | Choice                          | Notes                                      |
|-------------|----------------------------------|---------------------------------------------|
| Frontend    | Next.js 16 (App Router)         | Single codebase, mobile-first               |
| Backend/DB  | Supabase                        | EU/Ireland region — required for GDPR       |
| Auth        | Supabase Auth                   | Google OAuth + email/password               |
| Hosting     | Vercel                          | Free tier adequate for initial scale        |
| i18n        | next-intl                       | Danish-first; architecture supports more    |
| PWA / Push  | Manual sw.js + web-push (self-hosted via Supabase Edge Functions) | No next-pwa dependency |

**Do not suggest alternative frameworks, ORMs, or services** unless there is a concrete blocker. When in doubt, ask before introducing a new dependency.

---

## Phase plan

### Phase 1 — complete
Registration and login (Google OAuth + email/password), user profiles, browse and search community members, display Trainer Codes, GDPR compliance.

### Raid MVP — shipped (Slices 6–8, smoke test passed 2026-05-10)
Post a raid, see active raids, join/leave, per-raid chat, PWA installability, web push notifications. The feature bar: **faster than taking a screenshot and posting it in Messenger**.

**Do NOT build:**
- Remote raid lobby code sharing
- Recurring raids or raids scheduled more than a few hours out
- Raid history, stats, or past-raid browsing
- Filters, search, sort options on the list
- Host/organiser roles

### Phase 2 — do not build yet
DMs, trade requests, admin/moderation, richer raid features (remote lobby codes, filters, recurring raids, history).

**If a feature would require significant refactoring to support Phase 2, flag it and ask. Otherwise, do not pre-build Phase 2 functionality.**

---

## Push notifications — platform reality

Self-hosted web-push: PWA service worker + `push_subscriptions` table + `notify-raid` Edge Function (triggered on raid INSERT). Debugging runbook lives in `docs/launch-checklist.md`.

- **Android (Chrome/Firefox/etc.):** works once PWA installed.
- **iOS 16.4+:** works **only** when added to home screen via Safari. iOS onboarding at `/onboarding/ios` walks users through the flow.
- **Users who don't install the PWA:** get no push. The "Share to Messenger" button on each raid card is their fallback.

Known limitation: `raids/page.tsx` derives `pushStatus` from the DB row, not the live browser subscription — they can drift. Acceptable for now; fix if it causes support issues.

---

## GDPR requirements (non-negotiable)

Denmark is in the EU. All of the following are in place:

- [x] Privacy Policy page (Danish) at `/privacy`
- [x] Explicit consent checkbox at registration (not pre-ticked)
- [x] All user data in Supabase EU/Ireland region
- [x] Account deletion with full data cascade
- [x] No third-party analytics or tracking

When building any feature that touches personal data, verify GDPR compliance.

**Update the Privacy Policy** (`src/app/[locale]/privacy/page.tsx`, content in `messages/da.json` → `Privacy`) and bump `Privacy.lastUpdated` whenever: a new personal data field is added, a new third-party service is introduced, or contact/retention details change.

---

## Language and i18n

- Default language: **Danish (da)**
- All UI strings must go through next-intl — no hardcoded text in components
- Translation files: `/messages/da.json` (primary), `/messages/en.json` (stub)
- No language switcher in Phase 1

---

## Testing strategy

**Unit / logic tests — Vitest**
- TDD: write the test first, confirm it fails, then implement
- Scope: pure functions and Supabase helpers (validation, filters, server-helpers)
- Co-located with the code they test

**Browser verification — Playwright**
- When a change has any user-visible effect, verify it in a real browser via the Playwright MCP **and** capture the same steps as a spec in `e2e/` so the verification becomes a CI regression test.
- One spec file per user flow; specs run against the dev server.
- `playwright.config.ts` auto-starts `npm run dev` on port 3000 via its `webServer` block and reuses an existing server when one is already running locally — just run `npm run test:e2e`, don't start the dev server separately. In CI it always starts fresh.

**PR gate:** all tests must pass before opening a PR.

---

## Git workflow

- `main` is always deployable. Do not commit directly to `main`.
- Each slice or chore gets its own short-lived branch **off `main`** (`slice/N-name`, `chore/short-name`). Delete the branch after its PR merges. Do not start a new slice until the current one is merged.
- Commit messages: short, imperative, in English (e.g. `Add Trainer Code display`).
- Slices 1–9 already implemented and merged; all migrations applied.

---

## Decisions log

Update this section at the end of each session. Entries older than ~4 weeks live in [`docs/decisions-archive.md`](docs/decisions-archive.md).

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-05-03 | git user.email must be renraz@googlemail.com | Vercel blocks deployments from commits with unmatched email |
| 2026-05-07 | `useMounted` hook for client-only gating | React 19 `react-hooks/set-state-in-effect` fires on useState+useEffect mount pattern |
| 2026-05-07 | CI: lint → vitest → Playwright on every PR/push | Three GitHub Actions secrets drive the e2e dev server |
| 2026-05-11 | All server routes/pages export `preferredRegion = "dub1"` | Co-locating with Supabase EU (Ireland) dropped FCP from 6.6s → 1.2s |
| 2026-05-11 | `unstable_cache` uses admin client, not server client | Server client calls `cookies()` which is unavailable outside request context |
| 2026-05-11 | Page components parallelise independent Supabase queries with `Promise.all` | Queries are independent once `user.id` is known — serial execution was pure waste |
| 2026-05-11 | Realtime chat messages appended to local state, not `router.refresh()` | Per-message refresh caused full RSC page refetches |
| 2026-05-11 | `ref.current` writes go in `useEffect`, not during render | React 19 `react-hooks/refs` rule disallows synchronous ref writes during render |
| 2026-05-12 | Tailwind v4 `@theme` tree-shakes CSS vars only referenced via inline `style={{ var(--x) }}` | The class scanner can't see JS strings, so `--color-team-*` vars (used by team-color rings in `Avatar` / chips) disappeared at runtime. Fix: declare them in a plain `:root {}` block outside `@theme` so they're emitted unconditionally. Applies to any future design tokens read from JS rather than via utility classes. |
| 2026-05-12 | Profile: added `team` + `level` columns (migration 006); BottomNav profile tab → `/profile` not `/profile/edit` | Slice 10A. `team` (mystic/valor/instinct) and `level` (1–80) are both nullable / "Valgfri". The new `/profile` is the "Min profil" view; `/profile/edit` is reached from there. Privacy Policy not bumped — team/level are voluntary public profile info, same category as bio. |
| 2026-05-12 | Online presence via Supabase Realtime presence channel `players-online` (no DB writes) | `src/lib/profile/use-presence.ts` returns a `Set<user_id>` of currently connected clients. Channel auto-cleans on disconnect. The directory shows `Online (n)` and avatars get a green dot. "Last seen" timestamps were deferred — would need a `last_active_at` column. |
| 2026-05-12 | Friend code QR uses `qrcode` lib, encodes the raw 12-digit string | PoGo's in-game friend QR is a proprietary format we can't replicate, so scanning this QR will NOT add the friend in PoGo. Generic QR readers do read it as the 12-digit code — useful for copy-paste / sharing elsewhere. Honest trade-off vs. a purely decorative QR. |
| 2026-05-17 | Service worker switched to stale-while-revalidate for HTML + cache-first for `/_next/static`; per-segment `loading.tsx` skeletons added; `optimizePackageImports: ['lucide-react']`; migration 007 adds hot-path indexes (`raids.created_at`, `raid_messages(raid_id, created_at)`, partial `profiles.team`) | Previous network-first SW made the installed PWA paint as slow as a normal tab on reopen — single biggest cause of "slow when opening the app after being away". Segment skeletons remove the cross-screen stall (no streaming UI before this). Follow-up branch `chore/perf-auth-hot-path` will replace per-page `getUser()` with `getClaims()` and drop the redundant profile-guard query. |
| 2026-05-18 | Server pages and `Header` switched from `supabase.auth.getUser()` to `getClaims()`; profile-existence guard centralised in `src/lib/supabase/middleware.ts` | `getClaims()` verifies the access-token JWT locally via Supabase's asymmetric signing keys — no network round-trip to Auth on every page render. The profile guard (`profiles.select('id').eq('user_id', …)`) now runs once in middleware with a locale-stripped skiplist (`/`, `/login`, `/register`, `/privacy`, `/profile/setup`, `/reset`, `/reset/confirm`, `/onboarding/ios`); pages no longer repeat the query. `proxy.ts` short-circuits on a 3xx from `updateSession`; refreshed auth cookies are copied onto the redirect response so the freshly-rotated token isn't dropped. Middleware itself keeps `getUser()` because that call is what actually refreshes the session token. `/api/account/delete` keeps `getUser()` (privileged op wants server-side validation). |
| 2026-05-18 | Slice 11: community chat — `/chat` + `/chat/[channelId]` with `#generelt` and `#app-feedback`. Migration 008 adds `channel_messages`. DMs deferred to Phase 2 | Channel set is a hard-coded TypeScript constant + DB CHECK; adding a third channel later means a migration + constant edit. `channel_messages` matches `raid_messages` policies (RLS `auth.uid() = user_id`, `length(trim(body)) > 0`, FK to `profiles(user_id)`, ON DELETE CASCADE on the auth user). Typing indicators ride the same Supabase channel as messages via `broadcast` event `typing`, throttled ≤ once/2s with a 3s idle decay — no DB writes. Message list uses `column-reverse` so newest pins to the bottom without an imperative `scrollIntoView` (replaces the pattern in `RaidDetail.tsx:98-101`). DM scaffolding (`DMRow`, `DMScreen`, `DMHeader`) from the Claude Design handoff was intentionally not ported — DMs remain Phase 2 per CLAUDE.md. Known one-time UX gotcha on the deploy that flips Chat live: the stale-while-revalidate service worker (from `chore/perf-quick-wins`) serves the previous `BottomNav` HTML once, causing a hydration mismatch flash; cleared on the next request. |
| 2026-05-19 | Slice 12: chat unread counts. Migration 009 adds `channel_reads (user_id, channel, last_read_at)`. Live BottomNav badge + per-row badges on `/chat` | Mark-as-read happens server-side on `/chat/[channelId]` page render (UPSERT `DO UPDATE`); the channel-list page seeds rows with `NOW()` via `DO NOTHING` so first-time visitors see 0 unread instead of "all history unread". `getUnreadCountsForUser` joins `channel_messages` to `channel_reads` (missing row → `-infinity`) and excludes own messages. Client hook `useChannelUnread` subscribes to INSERTs on both channels regardless of current page; path-aware suppression skips increments while viewing the matching channel. Subtle bug fixed: when two components mount the hook on the same page (BottomNav + ChannelListScreen) they collided on a shared Supabase channel name and the second instance threw `cannot add postgres_changes callbacks after subscribe()`. Use `Math.random()`-suffixed per-mount topic names to disambiguate. `useId()` did not work as a substitute — its `:r0:`-style ids appear to confuse Supabase's colon-delimited topic parsing. |
| 2026-05-19 | Supabase Realtime cross-user delivery is unreliable in `npm run dev` / Turbopack — verify on the Vercel preview instead | Burned hours debugging slice 12's badge "not firing" against a second account locally. Worked fine on prod once deployed. Probable cause: SW caching the WS, Turbopack HMR severing the connection, or RSC double-renders. Future Realtime features: don't chase missing INSERT events locally if the code looks correct — push to preview and verify there. Single-user / own-optimistic-message paths DO work locally. |
| 2026-05-19 | Channel-list "X skriver…" preview on `/chat` | Adds `useChannelListTyping` — subscribes to broadcast 'typing' on both `chat:generelt` and `chat:feedback` so channel rows can swap the last-message preview for a live typing indicator, matching the design. Reuses the 3s idle decay from `use-channel-realtime.ts`. |
| 2026-05-19 | PWA icon replaced: `public/icon.svg` placeholder → `icon-192.png` + `icon-512.png` (glossy Pokéball on teal brand background, Claude Design handoff) | Manifest updated to proper PNG sizes with `purpose: "any maskable"`; `layout.tsx` apple-touch-icon and `sw.js` precache/push icon/badge all point to PNGs; SW cache bumped v2→v3 to force refresh on existing installs. |
| 2026-05-19 | GitHub repo: auto-delete head branches enabled; branch protection + auto-merge skipped | `gh repo edit --delete-branch-on-merge` is on, so merged PR branches now clean up automatically. Branch protection (classic + Rulesets) and the "Allow auto-merge" toggle are both Pro-only for private repos on the Free plan — both API and UI return 403 / greyed out. Manual merge workflow stays. Revisit if the repo goes public or upgrades to Pro. |
| 2026-05-20 | Branded splash on cold open: `LoadingScreen` (Sonar design) wrapped by `InitialSplash` in `[locale]/layout.tsx` | Claude Design "Sonar over Sundet" handoff. Splash markup ships in SSR HTML so it paints before JS loads; `InitialSplash` (Client) unmounts it 250ms after `useMounted` flips. Locale layouts persist across client-side nav, so the splash only fires on a true cold open — per-segment `loading.tsx` skeletons keep handling in-app transitions. Strings live under `messages/*.json` → `LoadingScreen`. Reduced-motion fallback freezes the pulses to one static ring. Wordmark uses project Inter, not the design's Plus Jakarta Sans (consistent with the locked font decision from 2026-04-11). |

---

## Open questions

- **Messenger vs Discord:** If "Share to Messenger" creates too much friction post-launch, evaluate migrating to Discord (webhook-based auto-posting is trivial). Decide after 2–4 weeks of real usage.
- **Raid boss list maintenance:** Currently manual. Consider a lightweight admin edit screen only if it becomes a real burden.

---

## Design workflow

Designs come from **Claude Design** (claude.ai/design). The user exports a handoff bundle and shares the URL. The bundle is a gzip-compressed tar archive containing:
- `README.md` — full spec: screens, measurements, design tokens, interaction logic
- `*.html` — interactive prototype (read the source; do not screenshot)
- Component `.jsx` files and `colors_and_type.css`

To read: fetch the URL, decompress with `gunzip`, extract with `tar -x -O`, read README first then relevant HTML/JSX.

---

## How to work with me

- I am a product manager, not a coder. Explain technical decisions briefly.
- Before making an architectural choice not covered here, **ask first**.
- If a task is ambiguous, **ask one clarifying question** before proceeding.
- At the end of each session, **update the Decisions Log** above with anything resolved.
- Keep responses practical. Prefer working code over lengthy explanation.
