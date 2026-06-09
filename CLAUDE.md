# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is read automatically at the start of every Claude Code session.
Do not delete it. Update it at the end of each session if any decisions changed.

For first-time environment setup (Supabase project, env vars, Google OAuth), see `docs/setup.md`. The required env vars are templated in `.env.local.example` — copy to `.env.local` and fill in. Pre-launch operational tasks (env vars, push debugging runbook, PWA icon replacement, etc.) live in [`docs/launch-checklist.md`](docs/launch-checklist.md).

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
| Typecheck (manual) | `npx tsc --noEmit` |
| Deploy Edge Function | `npx supabase functions deploy notify-raid` |

No `npm` typecheck script — `npm run build` is the canonical type gate (Next.js fails the build on TS errors). Use `npx tsc --noEmit` for a fast standalone check without a full build.

`npm run lint` is bare `eslint` (Next 16 dropped `next lint`). Don't expect `next lint`-flavored output or pass `--dir src` — the flat config in `eslint.config.mjs` already scopes the run.

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
See [`docs/architecture.md`](docs/architecture.md) for the full per-file walkthrough of `src/lib/`. Non-obvious invariants you must not violate:

- `raid_attendees.user_id` and `raid_messages.user_id` both FK to `profiles.user_id` (unique), **not** `profiles.id` — required for embedded Supabase queries `profiles(trainer_name)`.
- Realtime topic names that collide on the same page throw `cannot add postgres_changes callbacks after subscribe()`. Suffix each per-mount topic with `Math.random()`. `useId()` does NOT work — colons break Supabase's topic parsing.
- `last_seen_at` write in `use-presence.ts` must live in a plain `useEffect`, NOT inside a Realtime SUBSCRIBED callback (mobile PWAs silently fail that path).
- Channel set (`#generelt`, `#app-feedback`) is a hard-coded TypeScript constant + DB CHECK. Adding a third channel requires both a constant edit and a migration.
- Tests use Vitest + jsdom + `@testing-library/jest-dom`; setup file at `src/test/setup.ts`; `@` alias maps to `src/`.

### Caching — player directory
`getAllProfiles` in `src/lib/profile/server-helpers.ts` uses `unstable_cache` (60s TTL, tag `profiles`). **Must use the admin client** — the server client calls `cookies()` which is unavailable inside `unstable_cache` (runs outside request context). Account deletion calls `revalidateTag('profiles')` for an immediate bust.

### Page-level data fetching
Server page components parallelise independent Supabase queries with `Promise.all`. The pattern: await `getUser()` first, then fire all remaining queries in parallel once `user.id` is known.

### Realtime — chat vs. attendees
Chat messages (`raid_messages`) are appended to local React state via Realtime INSERT events — triggering `router.refresh()` per message caused full RSC page refetches. Attendee changes (`raid_attendees`) still use `router.refresh()` because they need the profile join. The `useRaidsRealtime` hook manages both.

### Shared chat component stack
Channel chat (`ChannelScreen`), raid chat (`RaidDetail`), and DMs (`DMScreen`) all render through the same `src/components/chat/` components (`MessageGroup`, `Composer`, `MessageActionSheet`, `Reactions`, `ReplyQuote`), unified on the `ChatMessage` type in `src/lib/chat/types.ts`. Each surface maps its row shape onto `ChatMessage` at the boundary (raid: `message → body`; DM: `sender_id → author_id`). Edit message rendering once; it lands in all three. Data layers stay separate (`src/lib/{chat,raids,dm}/`). See [`docs/architecture.md`](docs/architecture.md).

### React 19 patterns
- **Client-only gating** (localStorage, navigator, matchMedia): use `useMounted` from `src/lib/hooks/use-mounted.ts` instead of useState+useEffect. React 19's `react-hooks/set-state-in-effect` lint rule fires on the canonical "did mount" pattern. The hook uses `useSyncExternalStore` and returns `false` on the server, `true` post-hydration.
- **Ref writes during render**: move `ref.current = value` assignments into a `useEffect(() => { ref.current = value; }, [value])` — the `react-hooks/refs` rule disallows synchronous ref writes during render.

### Service worker versioning
`public/sw.js` carries a cache version constant (`SHELL_CACHE` / `RUNTIME_CACHE`). Bump it on every change to SW behavior — push handlers, cache strategy, `notificationclick`, precache list. The bump evicts the stale cache on installed PWAs; `skipWaiting()` + `clients.claim()` activate the new SW on first visit (users still need one extra navigation per device before the old SW closes). Current: v16. History lives in the decisions archive. Note: the `pogosundet-share` cache (Web Share Target image hand-off) is intentionally **un**versioned and excluded from the `activate` cleanup allowlist, so a pending share survives a version bump.

### Unread state lives in `UnreadProvider`
`src/components/UnreadProvider.tsx` is mounted in `src/app/[locale]/layout.tsx` and owns `useChannelUnread` + `useDMUnread`. `BottomNav` and the app-icon badge (`src/lib/push/app-badge.ts`) read from it. Do **not** move the hooks back into `BottomNav` — that component remounts on every navigation, so the in-memory counts would reset. The Badging API mirror in `app-badge.ts` + IndexedDB lets `public/sw.js` increment the home-screen badge from a `push` handler while the app is closed.

### Supabase Storage
- Bucket `raid-images` — stores raid screenshots uploaded by users
- Requires two manually created RLS policies: INSERT for authenticated users, SELECT for public (not set automatically on bucket creation)

### Account deletion
`POST /api/account/delete` — verifies session, calls `deleteAccount()` using the admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### Database migrations
SQL migrations live in `supabase/migrations/` as reference files. No runner — paste the SQL into the Supabase SQL editor manually. The Supabase CLI is only used for deploying Edge Functions (`supabase functions deploy`).

Current migrations: `001_create_profiles`, `002_create_raids`, `003_raid_chat`, `004_push_subscriptions`, `005_realtime`, `006_profile_team_level`, `007_perf_indexes`, `008_channel_messages`, `009_channel_reads`, `010_chat_reactions_and_replies`, `011_friend_code_constraint`, `012_last_seen_at`, `013_raid_chat_reactions_and_replies`, `014_direct_messages`, `015_raid_completion_and_reactions`, `016_block_join_completed_raid`, `017_raid_reads`. **All applied through `017`** (017 applied 2026-06-09 with PR #109). Current Edge Functions: `notify-raid`, `notify-dm`, `notify-raid-message`, `notify-raid-join` (in `supabase/functions/`). `notify-raid-join` (issue #103) is **not yet deployed/wired** — deploy it + add its `raid_attendees` INSERT webhook (see `docs/launch-checklist.md`); no migration or SW change needed. Reminder for future migrations: because preview and prod share one Supabase project, any migration whose columns/tables are referenced by a query must be applied **before** the PR merges, or the shared DB errors (the apply-before-deploy ordering used for `015`/`017`).

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

### Shipped
- **Auth + profiles + directory** (Slices 1–5): Google OAuth + email/password, profile creation/edit, browse and search community members, display Trainer Codes, GDPR compliance.
- **Raid MVP** (Slices 6–8, smoke test passed 2026-05-10): post a raid, see active raids, join/leave, per-raid chat, PWA installability, web push notifications. Feature bar: **faster than taking a screenshot and posting it in Messenger**.
- **Profile team/level + online presence + friend-code QR** (Slice 10, 2026-05-12).
- **Performance pass + auth hot-path** (2026-05-17 / 2026-05-18): SW stale-while-revalidate, segment skeletons, `optimizePackageImports`, hot-path indexes (migration 007), `getClaims()` over `getUser()`, centralised profile guard in middleware.
- **Community chat** (Slice 11, 2026-05-18): `/chat` + `/chat/[channelId]` with `#generelt` and `#app-feedback`. Migration 008.
- **Chat unread counts** (Slice 12, 2026-05-19): live BottomNav badge + per-row badges. Migration 009.
- **Branded PWA icon + cold-open splash** (2026-05-19 / 2026-05-20): real PNG icons, `LoadingScreen` (Sonar design) wrapped by `InitialSplash`.
- **Direct messages** (Slice 17, 2026-05-23): 1:1 DMs between any two profiles. New route `/chat/dm/[partnerId]`, DM section on `/chat`, entry points from the `OnlineStrip` avatars + `MembersSheet` rows, reuse of the channel-chat reactions + replies stack. Migration 014. Verified + follow-up fixes 2026-05-25 (typing indicator, unread-badge accuracy + persistence — PRs #53–#55).
- **App-icon unread badge + DM push** (2026-05-26): home-screen icon badge via the Badging API, driven (closed-app) by a new `notify-dm` Edge Function that web-pushes the DM recipient. `UnreadProvider` lifts the unread hooks into the `[locale]` layout (also fixed the BottomNav badge flicker). Content-free DM payload (sender name only) for GDPR. No migration.

Nothing currently in flight as of 2026-05-31. Next slice not yet picked.

### Do NOT build (in Raid MVP)
- Remote raid lobby code sharing
- Recurring raids or raids scheduled more than a few hours out
- Raid history, stats, or past-raid browsing
- Filters, search, sort options on the list
- Host/organiser roles

### Phase 2 — do not build yet
Trade requests, admin/moderation, richer raid features (remote lobby codes, filters, recurring raids, history). DMs shipped early in Slice 17.

**If a feature would require significant refactoring to support Phase 2, flag it and ask. Otherwise, do not pre-build Phase 2 functionality.**

---

## Push notifications

Self-hosted web-push: PWA service worker + `push_subscriptions` table + `notify-raid` Edge Function (triggered on raid INSERT). **iOS 16.4+ requires Add-to-Home-Screen via Safari** — users who don't install the PWA get no push (the "Share to Messenger" button on each raid card is their fallback). iOS onboarding flow at `/onboarding/ios`.

**[`docs/notifications.md`](docs/notifications.md) is the authoritative list of exactly when we send notifications** (current triggers, deliberate exclusions, and the target state for message notifications). Keep it in sync whenever you change what we notify on.

The 6-step debugging runbook lives in [`docs/launch-checklist.md`](docs/launch-checklist.md). Go there first if push regresses.

---

## GDPR requirements (non-negotiable)

Denmark is in the EU. All of the following are in place:

- [x] Privacy Policy page (Danish) at `/privacy`
- [x] Explicit consent checkbox at registration (not pre-ticked)
- [x] All user data in Supabase EU/Ireland region
- [x] Account deletion with full data cascade
- [x] Product analytics (Amplitude) is opt-in only, EU region, fully anonymous (no IP, no user_id, no PII) — never loads until the user accepts the consent banner

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

**CI:** `.github/workflows/ci.yml` runs `npm run lint` + Vitest + Playwright (chromium) on every PR and push to `main` (Node 24, Ubuntu). Supabase env vars come from repo secrets. The Playwright HTML report is uploaded as an artifact on failure (14-day retention).

---

## Git workflow

- `main` is always deployable. Do not commit directly to `main`.
- Each slice or chore gets its own short-lived branch **off `main`** (`slice/N-name`, `chore/short-name`). Delete the branch after its PR merges. Do not start a new slice until the current one is merged.
- Commit messages: short, imperative, in English (e.g. `Add Trainer Code display`).
- Slices 1–9 already implemented and merged; all migrations applied.

---

## Next up

Pickable TODOs, in no particular order. Promote one to a branch and start a slice when picked.

- **Desktop layouts for Raids / Chat / Profil** — the desktop player overview shipped 2026-06-07 (`slice/desktop-player-overview`), but only `/players` has a desktop layout. The design bundle (`desktop/PoGoSundet desktop.html`: `PageRaids.jsx`, `PageChat.jsx`, `PageProfil.jsx`) specs the other three. Build them inside the same `DesktopSidebar` shell, reusing existing real-data components (raids realtime, chat channel/DM stack). At `lg+` those routes currently still render the mobile layout.
- **Use `avatar_url` everywhere in the app** — profile pictures are uploadable but only shown in a few places. Audit all surfaces that display a player's identity (player card, player detail, chat message bubbles, raid attendee list, raid chat, BottomNav profile link, etc.) and render `avatar_url` with the existing `<Avatar>` component where it makes sense.
- **Investigate account deletion issues** — user noticed problems with account deletion during the 2026-05-22 session but didn't have time to look into it. Reproduce and fix before launch.
- **Define push notification triggers** — new raid posts, **new DMs (shipped 2026-05-26, `notify-dm`)**, **new raid chat messages (shipped 2026-06-08, `notify-raid-message`, closes #104)**, and **new raid participants (shipped 2026-06-09, `notify-raid-join`, closes #103 — notifies host + other attendees when someone joins)** trigger a push. Decide which of the remaining events should notify users — reply to a raid/channel message you authored, new channel message, reactions to your message — without causing notification fatigue. See [`docs/notifications.md`](docs/notifications.md) for the prioritised list.
- **Add Sentry for error logging** — code wired 2026-05-29 (`slice/sentry-error-logging`), but **disabled until the DSN is set**. Remaining ops (PM): create an EU-region Sentry Next.js project, add `NEXT_PUBLIC_SENTRY_DSN` to Vercel (+ optional `SENTRY_*` source-map vars), then trigger a test error to verify. Steps in [`docs/launch-checklist.md`](docs/launch-checklist.md). Supabase Edge Functions (Deno, `@sentry/deno`) not yet covered — separate follow-up if push-handler errors need capturing.
- **Amplitude product analytics — shipped, pending API key** (`slice/amplitude-analytics`). Opt-in consent banner gates everything; Amplitude inits only after the user accepts. EU `serverZone`, no autocapture, no IP, fully anonymous (no `user_id`/PII). Wired events: `page_view`, `account_created`, `profile_completed`, `raid_created`, `raid_joined`, `dm_sent`, `channel_message_sent`, `reaction_added`, `player_search` (no query string), `profile_viewed`, `channel_opened`. Privacy Policy §7/§9 updated + `lastUpdated` bump. Code no-ops with no key. **Remaining ops (PM):** create an EU-region Amplitude project at `app.eu.amplitude.com`, add `NEXT_PUBLIC_AMPLITUDE_API_KEY` to Vercel (Production + Preview — it's a public `NEXT_PUBLIC_` value), then verify on a preview deploy that Amplitude network requests fire ONLY after "Acceptér" (none after "Afvis").

---

## Decisions log

Update this section at the end of each session. Entries older than ~4 weeks live in [`docs/decisions-archive.md`](docs/decisions-archive.md).

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-06-09 | **Fixed: stale raids overview after returning from a raid** (`fix/raid-overview-stale`, closes issue #116). Going back to `/raids` from a raid detail often showed pre-visit info — a raid you'd just marked completed still looked active, or a raid whose chat you'd just read still showed an unread badge. Cause: `/raids` is a dynamic Server Component, but Next's **client Router Cache** serves the previously-rendered RSC payload on back-navigation, so it never re-runs `getRecentRaids` (which computes both `completed_at` styling and per-card `unread_count` from `raid_reads`). Neither the completion toggle (client mutation) nor `markRaidRead` (runs server-side on detail load) invalidated that cache. Fix (`src/components/RaidDetail.tsx`): (1) the back arrow now calls `router.refresh()` **before** `router.push('/raids')` — `refresh()` clears the client Router Cache so the push fetches `/raids` fresh (covers both completion and read-state, since `markRaidRead` already ran server-side on load); (2) `handleToggleCompleted` calls `router.refresh()` after the DB write so a completion change busts the cache regardless of how the user later navigates away (BottomNav / sidebar, not just the back arrow). | Issue #116. `router.refresh()` is the idiomatic App-Router cache-bust; doing it on the way out + after the completion mutation covers every exit path. Ordering is refresh-then-push so the overview never flashes the stale payload (refresh clears the whole client cache, then the push fetches fresh) rather than push-then-refresh (which can refetch the not-yet-left detail route). No new deps/migration/SW change. `tsc`/`eslint`/`build`/174 unit tests green. No e2e: a deterministic spec would need a poster-owned raid (completion is poster-only) or a seeded-unread raid, both of which pollute the shared preview/prod DB — **needs a preview/prod spot-check** (mark a raid completed → back → card shows "Gennemført"; open a raid with unread → back → badge cleared). |
| 2026-06-09 | **Fixed: stuck on raid detail when opened from a notification** (`fix/raid-detail-back-nav`, closes issue #114). The raid detail header's back arrow called `router.back()` — a no-op when the raid is opened from a push notification, because the service worker opens a **fresh window with no in-app history**, so tapping back did nothing and the only escape was closing the app. Fix: the arrow now `router.push('/raids')` (the page's logical parent), mirroring `DMHeader`'s existing `router.push('/chat')` — the same proven fix for the identical "detail screen reachable from a notification" case (DMs never had this bug for exactly that reason). One-line change in `src/components/RaidDetail.tsx`. New env-gated e2e `e2e/raid-detail-back.spec.ts` reproduces the no-history condition by navigating **directly** to a raid URL (like `clients.openWindow`) then asserting the back arrow reaches `/raids`. | Issue #114. `router.push('/raids')` always works regardless of history depth, and matches the established sibling pattern (`DMHeader`) rather than inventing a history-length heuristic — consistency for handoff. Minor tradeoff: arriving from the list now re-pushes `/raids` instead of popping (no scroll restore), already accepted on the DM screen. `tsc`/`eslint`/`build`/174 unit tests green. **Authenticated screen — the e2e is env-gated and the notification-open path is device-only**, so it needs a preview/prod spot-check (tap a raid push → back arrow returns to the list), same class as the rest of the push pipeline. |
| 2026-06-09 | **Raid-join notifications** (`slice/notify-raid-join`, **PR #111 squash-merged to `main`**, closes issue #103, **`notify-raid-join` Edge Function deployed + `raid_attendees` INSERT webhook created**, **verified working on prod**). New Edge Function `notify-raid-join` (`supabase/functions/notify-raid-join/index.ts`, mirrors `notify-raid-message`): fires on `raid_attendees` INSERT and web-pushes **every OTHER attendee** of the raid (`.neq('user_id', record.user_id)`) — the **host + all current participants**, never the player who just joined. The host is reached for free because they're auto-joined as an attendee at post time (`server-helpers.ts:47`), so no special-casing. Payload `type: 'raid-join'`, title `Ny deltager[: <boss/gym>]`, body `<trainer_name> er med i raidet` (fallback `En ny spiller er med i raidet`), taps to `/raids/<id>`. **No DB migration** (`raid_attendees` exists) and **no SW change/version bump**: the existing `public/sw.js` push handler already shows any type generically and bumps the icon badge only for `dm`/`raid-message`, so a `raid-join` (transient announcement, like `raid`) correctly shows with no badge and no Raids-tab unread bump; foreground suppression against `/raids/<id>` is already generic. The poster's own auto-join on raid creation yields zero recipients (they're the only attendee), so it never fires a spurious push. `docs/notifications.md` gained "Currently sent" entry #4 (+ Priority-3 item marked shipped, "leaving" reworded in NOT-sent); Privacy §11 reworded to cover the join notification (player's trainer name only — already public), `lastUpdated`→2026-06-09 (da+en); `docs/launch-checklist.md` gained the deploy-`notify-raid-join` + `raid_attendees` webhook + cross-account spot-check item. | Issue #103: let the host + participants know when someone signs up. Reuses the `notify-raid-message` pattern verbatim (group recipient = the raid's attendee list minus the actor), so it's the established shape, not a new mechanism. Notifying *all* attendees (not just the host, as the deferred Priority-3 note framed it) matches the issue text ("raid host and other participants"). Content is non-personal (trainer name + boss/gym are already public in-app), so no GDPR escalation beyond the §11 disclosure. `tsc`/`eslint`/`build`/174 unit tests green (edge function is Deno — outside the Vitest/tsc scope, no src/ deps, so no unit test, matching the `notify-raid-message` precedent). **Ops done 2026-06-09**: `notify-raid-join` deployed (`npx supabase functions deploy`, project `wagzhpnfupkiwozeqzex`), its **Database → Webhooks `raid_attendees` INSERT → function** webhook created (Supabase Edge Functions type, auto-filled auth, mirrors `notify-dm`). **Verified working on prod** (cross-account): joining a raid pushes `<trainer_name> er med i raidet` to the other attendees and taps through to the raid. (One gotcha hit during setup: the webhook's Edge Function dropdown was first pointed at `notify-raid-message` by mistake, which emitted its generic `Ny besked i raid-chatten` body on join — corrected to `notify-raid-join`.) |
| 2026-06-09 | **Raid chat notifications + unread badges** (`claude/raid-chat-notifications-5tgydz`, **PR #109 squash-merged to `main`** 2026-06-09, closes issue #104, **migration 017 applied**, **`notify-raid-message` Edge Function deployed + `raid_messages` INSERT webhook created**, SW **v15→v16**). Brings raid chat to parity with DM/channel chat: (1) **Push on new raid chat message** — new Edge Function `notify-raid-message` (mirrors `notify-dm`/`notify-raid`): notifies every OTHER attendee (poster included, since they're auto-joined), content-free payload (`type: 'raid-message'`, sender's `trainer_name` + `Ny besked i raidet: <boss/gym>` or generic fallback — never message content), taps through to `/raids/<id>` (existing `isViewingPushTarget` foreground suppression already covers this route generically, no changes needed). (2) **Raids-tab unread badge** — new `useRaidUnread` hook (`src/lib/raids/use-raid-unread.ts`, mirrors `use-dm-unread.ts`): mount-fetches the true total scoped to **joined raids only** (`raid_attendees` + new `raid_reads` table), then increments live off a **single global** `raid_messages` INSERT subscription with **lazy membership resolution** — Realtime can't filter "raid_id IN (raids I've joined)" server-side, so membership per `raid_id` is resolved once on first sighting and cached in a `Map`. `UnreadProvider`'s `total` is now split into `chatUnread` (channels+DMs) / `raidUnread` so `BottomNav`/`DesktopSidebar` can show the Raids badge without double-counting the Chat badge; `clearRaid(raidId)` wired into the existing pathname-match-clears-on-navigate effect (matches `/raids/<id>`, explicitly excludes `/raids/new`). (3) **Per-raid unread counts on `/raids`** — `getRecentRaids(userId)` now also queries `raid_reads` in one batch and computes each raid's `unread_count` purely in JS from the already-embedded `raid_messages` (no per-raid round trips, mirrors the existing `RaidWithDetails` embedding pattern); `RaidCard` renders it as a small pill badge next to the boss/gym name (joined raids only — others always show 0). New `markRaidRead(userId, raidId)` upserts `raid_reads`, called from the raid detail page alongside the existing `getRaidById`/`getMessagesForRaid` `Promise.all`. `docs/notifications.md` "Currently sent" gained entry #3 (raid chat message); Privacy Policy §11 reworded to cover raid-chat-message notifications, `lastUpdated` bumped (da+en). `docs/launch-checklist.md` gained the apply-017 + deploy-`notify-raid-message` + webhook + cross-account spot-check item. | Issue #104 explicitly asked for all three (push, nav badge, per-raid unread counts) — same shape as the DM pipeline shipped 2026-05-26 and the channel-unread work from Slice 12, so this mirrors those patterns rather than inventing new ones. Scoping unread to *joined* raids matches who actually receives the push (others have no reason to see a count). Computing `unread_count` in JS from one batch query (vs. N per-raid queries) follows the same perf discipline as `getAllProfiles`/`getRecentRaids`. **Deploy ordering handled this session** (same apply-before-deploy concern as `015`/`016`: `getRecentRaids`/`RaidDetail` reference `raid_reads`, which would error against the shared DB until the table exists): on 2026-06-09 the remote-session branch was pulled, **migration 017 applied** in the SQL editor (after 016), the **`notify-raid-message` Edge Function deployed** (`npx supabase functions deploy`, project `wagzhpnfupkiwozeqzex`), its **Database → Webhooks `raid_messages` INSERT → function** webhook created (Bearer service-role, mirrors `notify-dm`), and only then **PR #109 marked ready + squash-merged** (branch was left as a draft from the remote session). `tsc`/`eslint`/`build`/174 unit tests green (clean install — `node_modules` had to be restored in this session). **Authenticated/realtime/push feature — needs a prod spot-check** (cross-account: push arrives with sender name + boss/gym context, Raids-tab badge + per-card counts update live, opening a raid clears both — same class of device-only verification as the rest of the push pipeline, added to `docs/launch-checklist.md`). |
| 2026-06-08 | **Fixed DM push notifications silently swallowed on Android** (`fix/push-notification-suppression-focus`, closes issue #107, SW **v14→v15**). The foreground-suppression logic added 2026-05-30 (#73) suppressed a push when a `visibilityState === 'visible'` window client's URL matched the push target — but on Android Chrome a backgrounded installed PWA (screen lock, app switcher, Home) can keep reporting its window client as `visible` for a while before `visibilitychange` catches up. So a DM arriving for the conversation the user had open right before backgrounding was wrongly treated as "still on screen" and never shown — looked like notifications had stopped working. Fix: the suppression check now also requires `focused` (mirrors `document.hasFocus()`, which the browser flips synchronously on blur) — `public/sw.js` `push` handler, plus a new canonical/tested copy `isViewingPushTarget` in `src/lib/push/notification-suppression.ts` (a classic SW can't import ES modules, so the SW inlines an equivalent check with a cross-reference comment, mirroring the existing `app-badge.ts` IDB duplication pattern). New `notification-suppression.test.ts` (7 cases) — verified it fails against the pre-fix (visibility-only) logic, proving it catches the regression. `docs/notifications.md` "Foreground suppression" section updated. | Issue #107 ("Notifications about new chat messages not being sent... not received on iOS and Android" — narrowed to **Android-only DM push** per PM follow-up) explicitly asked to investigate, fix, and add regression tests. `focused` is the more conservative signal for a suppression decision specifically — a swallowed notification can't be recovered later, while showing one extra (a focused-but-stale-visible false negative) is harmless. `tsc`/`eslint`/171 unit tests green. **Push behaviour needs an Android-device spot-check** (can't be verified from here — same class of authenticated/device-only feature as the rest of the push pipeline). |
| 2026-06-08 | **Logout moved to the edit-profile page** (`slice/logout-in-edit-profile`, **PR #100 merged to `main`**). The player-overview header (`DirectoryHeader`) dropdown's only item was logout, so the menu (button + outside-click handling + state) is removed — it's now just the title bar. A **"Log ud"** button now lives on `/profile/edit` below the "Slet konto permanent" section, using the same `signOut()` → `/` → `router.refresh()` flow. New `ProfileEdit.logoutButton` key (da + en); `e2e/profile-edit.spec.ts` gains a logout test (env-gated). | PM request — declutter the directory header and group logout with the other account actions. `tsc`/`eslint`/`build`/159 tests green. Logout still reachable everywhere: mobile via BottomNav → Profil → Rediger profil; desktop via the sidebar user chip → /profile → Rediger profil. |
| 2026-06-08 | **Desktop layouts for Raids / Chat / Profil** (`slice/desktop-raids-chat-profile`, **PR #99 merged to `main`**) — the follow-up to the desktop player overview; the `DesktopSidebar` now frames all four nav destinations at `lg+` (consistent desktop app), mobile untouched below `lg`. `BottomNav` is now `lg:hidden` (the sidebar replaces it). **Raids + Chat** (realtime, can't be duplicated into mobile+desktop blocks or the channels re-subscribe — cf. the players `usePresence` fix) render their existing content **once** inside a new **`DesktopShell`**: at `lg+` it's a flex row (sidebar aside + content area) where the content area carries `transform: translateZ(0)`, which makes it the **containing block for the page's `position: fixed` chrome** (headers, chat composer/panels) so they scope beside the sidebar instead of overlapping — **zero edits to the chat/raid components**; below `lg` it's a transparent pass-through. **Profil** (no realtime) keeps its mobile layout under `lg:hidden` and adds a bespoke `hidden lg:flex` desktop block: `DesktopSidebar` + new **`DesktopProfile`** (2-column identity/bio card + friend-code QR card, mirroring the mock on real data, reusing `Avatar`/`TeamChip`/`LevelPill`/`FriendCodeQR`). `DesktopSidebar` `me` prop relaxed to a minimal `SidebarUser` shape (so chat's lighter profile rows fit) + `h-full` nav. New `ProfileTab` keys (`desktopSubtitle`/`onlineNow`/`qrHint`, da+en). Plan: `docs/plans/desktop-raids-chat-profile.md`. | Chat kept as a shell-frame (PM-chosen over a true 2-pane) — reuses the whole realtime stack with no rebuild. The `transform` containing-block trick is what lets the fixed-position mobile screens sit beside the sidebar without touching them or risking a second realtime subscription. `tsc`/`eslint`/`build`/159 tests green. **Authenticated screens — needs a preview/prod visual check at ≥1024px**, especially the chat transform area (header/scroll/composer; expect a ~70px bottom gap where the hidden BottomNav reserved space — accepted v1 cosmetic). |
| 2026-06-08 | **SW navigations → network-first; fixes post-deploy PWA crash** (`fix/pwa-sw-network-first-navigations`, **PR #98 merged to `main`**, SW **v13→v14**). After signing out (and generally after a deploy), the installed PWA intermittently showed the root error boundary ("Noget gik galt. Prøv igen om et øjeblik.", `global-error.tsx`) — a `ChunkLoadError`: the SW served HTML navigations **stale-while-revalidate**, so it handed back the *previous* build's cached shell, whose hashed `/_next/static` chunks the new deploy had already purged (404). The background revalidate then refreshed the cached shell, so it "worked after a few reopens" (matches the reported intermittency; `ChunkLoadError` under-reports to Sentry because the app reloads before the event flushes). Fix: navigations now use **network-first** (`networkFirst()` replaces `staleWhileRevalidate()`), so the served document always references the live build's chunks; cached shell / precached `/login` is the offline fallback. Static `/_next/static/*` stays cache-first (immutable). | Reverses the earlier SWR "instant reopen" optimization for navigations specifically — correctness (no post-deploy crash for installed-PWA users) outweighs a slightly slower cold reopen; offline still works via the cache fallback. The bump to v14 evicts stale v13 shells; `skipWaiting()`+`clients.claim()` already activate the new SW promptly (the *current* v13→v14 transition may still crash once on the very first reopen since the old SW is still in control — network-first prevents it from recurring on future deploys). `build`/`tsc`/`eslint`/159 tests green. **Needs an installed-Android-PWA spot-check on prod.** |
| 2026-06-08 | **Installed-PWA Google login fix** (`fix/pwa-oauth-login-redirect`, **PR #97 merged to `main`**). After the prod desktop OAuth fix (#91), Google login still "bounced" in the **installed Android PWA** (email + desktop Google both fine). Cause: a standalone PWA hands Google sign-in to a Chrome Custom Tab; the `/auth/callback` exchange + redirect to `/` complete *in that tab*, then control returns to the PWA, still showing the logged-out `/login` page — which only checked auth at mount and never reacts to the now-present (shared) session cookie. ("Sometimes logged in after reopening" confirmed the cookie IS set, just not picked up — a commit/timing race, not a flow failure.) Fix: new `AuthRedirectOnSignIn` client component mounted on `/login` + `/register` — listens via `supabase.auth.onAuthStateChange` AND re-checks `getSession()` on `visibilitychange`/`focus` (returning from the Custom Tab), then `router.replace('/players')` once a session exists. No-op in normal browsers (server redirect on `/` already handles it); does **not** touch the OAuth flow/callback (deliberately — prior iOS flow rewrites were reverted). | Lowest-risk fix that matches the standard PWA pattern: make the page react to the session instead of rewriting OAuth. `tsc`/`eslint`/`build`/159 unit tests green. **Can't be verified from here — needs an installed-Android-PWA spot-check on prod.** Residual risk: sessions where the cookie is genuinely never set (harder Custom Tab storage isolation) won't be helped by a listener; if bounces persist after this, narrow there next. |
| 2026-06-08 | **Raid reaction attribution** (`slice/raid-reaction-attribution`, **PR #96 merged to `main`**, closes GitHub issue #95). The raid-level reactions (TfR!/shiny/hundo, migration 015) showed only a count; now `RaidDetail` renders a "who reacted" breakdown under the buttons — one row per non-empty reaction listing each reactor as an initials chip + trainer name (current user shows as "Dig"). It reuses the existing live `raidReactions` user_id state, so it updates in realtime alongside the buttons. Names are resolved client-side from a `profileNames` (user_id → trainer_name) map the raid detail page builds from the cached `getAllProfiles()` and passes in — necessary because `raid_reactions.user_id` FKs `auth.users`, not `profiles`, so the name can't be PostgREST-embedded in the raid query (and realtime payloads carry only row columns). New pure `reactorName()` helper + `raid-reaction-helpers.test.ts` (7 tests). New i18n `Raids.reactionYou` / `reactionUnknownUser` (da + en). RaidCard kept as a count-only summary (detail is where you see who). No migration/deps. Plan: `docs/plans/raid-reaction-attribution.md`. | Issue #95: engagement — let people see who reacted and how. Resolving names via the cached directory map (vs. an FK migration to embed profiles) avoids a schema change and handles realtime-added reactors for free, since every user has a profile (middleware guard). `tsc`/`eslint`/`build`/159 unit tests green. **Authenticated realtime screen — needs a prod/preview spot-check** (cross-user realtime per the 2026-05-19 rule; RaidDetail double-mounts in dev). |
| 2026-06-08 | **Fixed prod Google login bounce + logout UX** (`fix/oauth-callback-forwarded-host`, **PR #91 merged to `main`**). On production, Google OAuth landed back on `/login` (no `?error`) while email/password login worked. Root cause: `auth/callback` + `auth/confirm` redirected to `${origin}` derived from `new URL(request.url)`, which **behind Vercel's proxy is the internal deployment host, not the public domain** — so the just-set session cookie wasn't present on the host the browser was redirected to → instant bounce. Email login never round-trips through this server redirect, so it was unaffected; confirmed by Google login working **locally** (no proxy → `origin` is correct). Fix: prefer `x-forwarded-host` / `x-forwarded-proto` in production, fall back to `origin` locally (standard Supabase Next.js App Router pattern) — applied to **both** routes (covers OAuth + email signup-confirm / password-recovery). Also bundled: (2) `queryParams: { prompt: 'select_account' }` on the Google sign-in (login + register) so logging out no longer silently re-auths into the same account via Google SSO — Google now shows the account chooser; (3) `suppressHydrationWarning` on `<body>` in `layout.tsx` to quiet the dev hydration warning from browser-extension attributes (e.g. ColorZilla's `cz-shortcut-listen`). | Prod-only auth regression, independent of the desktop work (touched zero auth files). The `getClaims()` JWT-verification path was ruled out because email login worked. `x-forwarded-host` is safe whether or not it's the exact cause (it only corrects the prod redirect host). No staging (preview shares the Supabase project, and preview URLs aren't in the OAuth allow-list), so the redirect fix is verified on prod after deploy. `tsc`/`eslint`/`build`/152 unit tests green; Google login verified locally. |
| 2026-06-07 | **Desktop player overview** (`slice/desktop-player-overview`, **PR #90 merged to `main`**) — first desktop layout, built from the Claude Design handoff bundle (`desktop/PoGoSundet desktop.html`). **Responsive on the same routes**: `/players` now renders the existing mobile directory + `BottomNav` below `lg` (`<1024px`, unchanged) and a **desktop sidebar + QR "Scan-session"** at `lg+`. Use case (from the design chat): sit at a desktop with Pokémon GO open on your phone and scan local players' friend-code QRs one at a time, without mis-scanning. New `src/components/desktop/DesktopSidebar.tsx` (labeled nav mirroring `BottomNav` routes + live Chat unread badge from `useUnread`, brand, user chip) and `src/components/desktop/DesktopPlayers.tsx` (left queue with progress + per-row status; right pane shows ONE big QR via the real `FriendCodeQR`, prev/next, copy, "Spring over" / "Tilføjet → næste" to advance). Reuses real data + components (`Avatar`, `FriendCodeQR`, `usePresence`); added a reusable `LevelPill` export to `Avatar.tsx`. New `DesktopPlayers` i18n namespace (da + en). New e2e `e2e/desktop-players.spec.ts` (env-gated login, desktop viewport). **Scope: player overview only** — Raids/Chat/Profil desktop layouts are a deliberate follow-up; at `lg+` those routes still show the mobile layout (sidebar links work). No DB/dep changes. | PM's stated top priority. Desktop is a real use case (phone-scanning sessions) the mobile single-column doesn't serve. Responsive same-routes (vs separate `/desktop` routes) keeps one URL set for a PWA where users switch devices. Used the real scannable `FriendCodeQR` over the mock's fake matrix. `tsc`/`eslint`/`build`/152 unit tests green. **Post-review fixes (same PR #90):** (a) lifted `usePresence` into a new `PlayersScreen` client wrapper — the responsive page mounts both the mobile directory and desktop scan-session simultaneously (CSS toggles visibility), so each calling `usePresence` opened two channels on the shared `players-online` presence topic → "cannot add presence callbacks after subscribe()". One subscription now feeds both layouts via an `onlineUserIds` prop (presence topics must be shared across users, so the `Math.random()`-suffix trick doesn't apply). (b) Added Arrow Up/Down keyboard nav to the queue (ignored in text fields, default scroll prevented; active row auto-scrolls into view). Verified locally at ≥1024px after login. |

---

## Open questions

- **Messenger vs Discord:** If "Share to Messenger" creates too much friction post-launch, evaluate migrating to Discord (webhook-based auto-posting is trivial). Decide after 2–4 weeks of real usage.
- **Raid boss list maintenance:** Currently manual. Consider a lightweight admin edit screen only if it becomes a real burden.
- **`pushStatus` drift between DB and live browser subscription:** `raids/page.tsx` reads `pushStatus` from the `push_subscriptions` row, not the live Push API state — they can disagree (e.g. user revoked permission in the browser without unsubscribing in-app). Acceptable for now; revisit if it causes support tickets.
- **No staging environment — preview and prod share the same Supabase project:** profiles, raids, chat messages created on a Vercel preview deploy are visible in prod (and vice-versa), so we can't safely test data-writing flows in isolation. Cheapest fix is probably a second Supabase project wired up via `vercel env` overrides on preview deploys; revisit before any change that risks corrupting prod data.

---

## Design workflow

**Design system project:** `https://claude.ai/design/p/f4dae200-a4eb-4523-9cc1-3e2c4b174958` — the source of truth for colours, typography, radii, shadows, and spacing. The full token set is available in `colors_and_type.css` inside any exported handoff bundle (the chat handoff at `/tmp/pogo-design/chat/project/colors_and_type.css` is the latest extracted copy). For small UI changes Claude Code can work directly from the existing code; a new handoff bundle is only needed for new full screens or complex layouts.

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
