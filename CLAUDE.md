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
`public/sw.js` carries a cache version constant (`SHELL_CACHE` / `RUNTIME_CACHE`). Bump it on every change to SW behavior — push handlers, cache strategy, `notificationclick`, precache list. The bump evicts the stale cache on installed PWAs; `skipWaiting()` + `clients.claim()` activate the new SW on first visit (users still need one extra navigation per device before the old SW closes). Current: v13. History lives in the decisions archive. Note: the `pogosundet-share` cache (Web Share Target image hand-off) is intentionally **un**versioned and excluded from the `activate` cleanup allowlist, so a pending share survives a version bump.

### Unread state lives in `UnreadProvider`
`src/components/UnreadProvider.tsx` is mounted in `src/app/[locale]/layout.tsx` and owns `useChannelUnread` + `useDMUnread`. `BottomNav` and the app-icon badge (`src/lib/push/app-badge.ts`) read from it. Do **not** move the hooks back into `BottomNav` — that component remounts on every navigation, so the in-memory counts would reset. The Badging API mirror in `app-badge.ts` + IndexedDB lets `public/sw.js` increment the home-screen badge from a `push` handler while the app is closed.

### Supabase Storage
- Bucket `raid-images` — stores raid screenshots uploaded by users
- Requires two manually created RLS policies: INSERT for authenticated users, SELECT for public (not set automatically on bucket creation)

### Account deletion
`POST /api/account/delete` — verifies session, calls `deleteAccount()` using the admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### Database migrations
SQL migrations live in `supabase/migrations/` as reference files. No runner — paste the SQL into the Supabase SQL editor manually. The Supabase CLI is only used for deploying Edge Functions (`supabase functions deploy`).

Current migrations: `001_create_profiles`, `002_create_raids`, `003_raid_chat`, `004_push_subscriptions`, `005_realtime`, `006_profile_team_level`, `007_perf_indexes`, `008_channel_messages`, `009_channel_reads`, `010_chat_reactions_and_replies`, `011_friend_code_constraint`, `012_last_seen_at`, `013_raid_chat_reactions_and_replies`, `014_direct_messages`. Current Edge Functions: `notify-raid`, `notify-dm` (in `supabase/functions/`). All migrations applied.

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

Nothing currently in flight as of 2026-05-26. Next slice not yet picked.

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

- **Use `avatar_url` everywhere in the app** — profile pictures are uploadable but only shown in a few places. Audit all surfaces that display a player's identity (player card, player detail, chat message bubbles, raid attendee list, raid chat, BottomNav profile link, etc.) and render `avatar_url` with the existing `<Avatar>` component where it makes sense.
- **Investigate account deletion issues** — user noticed problems with account deletion during the 2026-05-22 session but didn't have time to look into it. Reproduce and fix before launch.
- **Define push notification triggers** — new raid posts and **new DMs (shipped 2026-05-26, `notify-dm`)** trigger a push. Decide which of the remaining events should notify users — reply to a raid/channel message you authored, new message in a raid chat you joined, new channel message, reactions to your message — without causing notification fatigue. See [`docs/notifications.md`](docs/notifications.md) for the prioritised list.
- **Add Sentry for error logging** — code wired 2026-05-29 (`slice/sentry-error-logging`), but **disabled until the DSN is set**. Remaining ops (PM): create an EU-region Sentry Next.js project, add `NEXT_PUBLIC_SENTRY_DSN` to Vercel (+ optional `SENTRY_*` source-map vars), then trigger a test error to verify. Steps in [`docs/launch-checklist.md`](docs/launch-checklist.md). Supabase Edge Functions (Deno, `@sentry/deno`) not yet covered — separate follow-up if push-handler errors need capturing.
- **Amplitude product analytics — shipped, pending API key** (`slice/amplitude-analytics`). Opt-in consent banner gates everything; Amplitude inits only after the user accepts. EU `serverZone`, no autocapture, no IP, fully anonymous (no `user_id`/PII). Wired events: `page_view`, `account_created`, `profile_completed`, `raid_created`, `raid_joined`, `dm_sent`, `channel_message_sent`, `reaction_added`, `player_search` (no query string), `profile_viewed`, `channel_opened`. Privacy Policy §7/§9 updated + `lastUpdated` bump. Code no-ops with no key. **Remaining ops (PM):** create an EU-region Amplitude project at `app.eu.amplitude.com`, add `NEXT_PUBLIC_AMPLITUDE_API_KEY` to Vercel (Production + Preview — it's a public `NEXT_PUBLIC_` value), then verify on a preview deploy that Amplitude network requests fire ONLY after "Acceptér" (none after "Afvis").

---

## Decisions log

Update this section at the end of each session. Entries older than ~4 weeks live in [`docs/decisions-archive.md`](docs/decisions-archive.md).

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-05-31 | Decisions-log housekeeping: archived the 14 rows dated 2026-05-19 → 2026-05-28 (Slice 16 raid reactions, Slice 17 DMs + the DM/notification/badge fixes, late-May docs sweeps) to `docs/decisions-archive.md`, and merged the active log's stray duplicate table header back into one table. Active log now holds 2026-05-29 → 2026-05-31 only. | Recurring maintenance per the "~4 weeks / keep it scannable" convention — the project moves fast, so the practical cut is the previous shipped batch. The 2026-05-19 "verify Realtime on prod, not dev" rule moved too, but it also lives in session memory + is referenced from the architecture notes, so it stays discoverable. PRs #79/#80 from this session merged to `main` before the archival. |
| 2026-05-31 | Android Web Share Target (`feat/android-share-target`): share a Pokémon GO screenshot from the OS share sheet straight into PoGoSundet, landing on a pre-filled new-raid form. **Android only** — iOS Safari doesn't support `share_target` ([WebKit #194593](https://bugs.webkit.org/show_bug.cgi?id=194593), open in 2026); iOS keeps the existing gallery-pick flow (no regression). Requires the PWA installed. Mechanism: `public/manifest.json` gains a `share_target` (`POST` `multipart/form-data` to `/raids/share`, file param `image`); `public/sw.js` (v12→v13) intercepts that POST **before** the GET-only guard, stashes the file in a new un-versioned `pogosundet-share` cache (added to the `activate` allowlist so it survives bumps), and 303-redirects to `/raids/new?shared=1`; the new-raid form reads the cache on mount, rebuilds a `File`, pre-fills `imageFile`/`imagePreview`, then deletes the entry (one-shot). Cache name + key (`/__shared-raid-image`) are shared magic strings, commented on both sides. Plan: `docs/plans/android-share-target.md`. | PM-confirmed: the community shares raids by screenshotting Pokémon GO then posting into Messenger; this makes PoGoSundet a one-tap destination for that same screenshot on Android. Reuses the existing client upload-on-submit path untouched (the form still uploads to `raid-images` on post) — the SW just hands the form a `File`, so no new server route, no auth bridging, no storage changes. SW-cache hand-off (vs a server route) keeps the file client-side and fits the existing File-based form. **Verified locally**: injected a blob into `pogosundet-share` → `/raids/new` pre-filled the screenshot, then the entry was consumed/deleted (build + tsc + eslint green). The OS-share-sheet → SW-POST half is Android-device-only (same as push) — needs a spot-check on an installed Android PWA on prod. Accepted v1 limits: no boss/gym auto-detect; if unauthenticated when the share lands, submit→/login loses the pre-fill (rare for installed PWA). |
| 2026-05-31 | Raid screenshots: show the **whole** frame, never crop (`object-cover` → `object-contain`). The 2026-05-30 image-optimization pass switched the `RaidCard` thumbnail + `RaidDetail` hero to `next/image` with `fill` — but `fill` defaults to `object-cover`, which crops tall portrait Pokémon GO screenshots (9:19.5) down to a horizontal band, hiding CP/boss name/gym/timer. Fix: thumbnail now `object-contain` on the neutral `bg-input` (full frame, small, neutral letterbox bars). Detail hero grew `h-[190px]` → `h-[300px]` and renders **two** stacked `<Image>`s of the same src: a `object-cover scale-110 blur-2xl` backdrop (fills the side letterbox so it looks intentional) + a sharp `object-contain` foreground (the full screenshot). Gradient + boss/gym/timer overlays unchanged on top. **All the perf work is retained** — both still use `fill` + `sizes` so Vercel resizes/WebPs; only the crop changed. Also **removed the green relative-time pill** that overlaid both images (the `bg-primary` "Startede for X min siden" / "Om X min" badge in `RaidCard` bottom-left + `RaidDetail` hero bottom-right) — now that the full screenshot shows, the pill was clutter on top of it and (for past raids) not useful. Time info is retained off-image: the card keeps it in the metadata text row (`{timeLabel} · poster`), the detail keeps the `{timeString}` clock time in the meta bar. Dropped the now-dead `relativeLabel()` helper + `timeLabel` const in `RaidDetail`. | PM flagged the crop as a UX regression: users couldn't read the raid info off the screenshot on either surface. "Full image, can be scaled down" → `object-contain`. Blurred-backdrop treatment (PM-chosen over plain bars or a tap-to-expand lightbox) is the Messenger/iMessage pattern for portrait-in-landscape. Verified locally on the dev server (logged-in browser): card thumb + detail hero both show the entire screenshot, blurred side bars on detail, and no time pill. Rendering swap only, so no e2e spec (no deterministic image fixture, same call as the 2026-05-30 pass). |
| 2026-05-30 | Chat: one-time long-press hint (`slice/chat-longpress-hint`). New `src/components/chat/LongPressHint.tsx` — a dismissible pill ("Hold en besked nede for at svare, reagere eller kopiere") rendered above the input inside the shared `Composer` (so it covers channel/raid/DM), only when not replying. `useMounted`-gated localStorage flag `pogo-longpress-hint-dismissed` persists the dismissal so it shows until the user closes it, then never again. New `Chat.longPressHint` / `Chat.hintDismiss` keys (da + en). | The long-press change (prior row) has no on-screen affordance, so new users could miss it. A subtle, one-time, dismissible hint teaches the gesture without nagging. Placed in the shared `Composer` = one mount point for all three chat surfaces. localStorage + `useMounted` mirrors the consent-banner pattern (no hydration mismatch). Auto-hide-on-first-use was skipped to avoid cross-component plumbing — manual dismiss is enough. |  New `src/lib/hooks/use-long-press.ts` (pointer events, 450ms, cancels on >10px move so scrolling never fires it, suppresses native callout/right-click, guarded `navigator.vibrate(15)` on Android). `MessageGroup`'s `MessageBubble` spreads the hook; a plain tap is now a no-op. Keyboard a11y preserved — `onClick` still opens when `e.detail === 0` (Enter/Space). Added `select-none` + `-webkit-touch-callout:none` so long-pressing text doesn't select it. Lands on all three chat surfaces (channel/raid/DM) via the shared component. Unit test `use-long-press.test.ts` (5 cases). | Long-press is the universal messaging-app gesture for message actions; tap-to-open was unconventional and easy to trigger by accident. Shared `MessageGroup` means one change covers ChannelScreen/RaidDetail/DMScreen. Reaction-row `+` button stays a tap (only the bubble changed). No on-screen affordance hints the gesture yet — accepted; revisit if users miss it. Authenticated screen — needs a device spot-check (long-press opens, scroll doesn't, tap is quiet). |
| 2026-05-30 | Lazy-load `FriendCodeQR` (`slice/qr-lazy-load`), from the perf review. `PlayerDetailDeck` now imports it via `next/dynamic` with `ssr: false` + a fixed 224px placeholder, instead of a static import. Verified via build manifest: `qrcode` + the QR component are now an on-demand chunk (**24 KB raw**) **not in any route's first-load JS**. Note the deck renders one card *per profile in the whole directory* (`profiles.map`), so previously every member's QR was both bundled and serialized into the SSR HTML on mount; `ssr: false` removes the QR SVGs from that HTML too. | The QR is rendered inline in the detail view (not tap-gated as the review assumed), but lazy-loading still pulls `qrcode` off the player-detail route's initial bundle and shrinks the SSR HTML. Server-rendering the QR (option b) was rejected: the swipeable deck holds the full directory, so pre-rendering every QR server-side would bloat the payload. Placeholder reserves the box → no layout shift; QR renders a beat after hydration (acceptable for a below-the-identity element). Authenticated screen — needs a visual spot-check on preview/prod. |
| 2026-05-30 | Image optimization pass (`slice/image-optimization`), from the perf review. (1) `Avatar` dropped `unoptimized` + added `sizes={inner+"px"}` so Supabase avatars are resized/WebP'd by Vercel instead of served full-res into 56–104px circles. (2) `RaidCard` thumbnail + (3) `RaidDetail` hero: raw `<img>` → `next/image` with `fill` + `sizes` (`108px` / `100vw`); the detail hero sits in a fixed `h-[190px]` container so this also kills its CLS. (4) `Hero` (logged-out LCP) gained `sizes="100vw"`. No new deps; `*.supabase.co` already in `images.remotePatterns`. | Perf review flagged these as the most wasted mobile bytes: raid screenshots are 1–3 MB phone grabs and avatars are full-res uploads, all shipped unresized to small boxes on the highest-traffic screens (`/players`, `/raids`). `fill`+`sizes` lets the optimizer serve appropriately small WebP/AVIF. Note Vercel Hobby's 1,000 source-images/month optimization cap — fine at community scale; if approached, resize on upload instead. Authenticated screens (avatar grid, raid thumbs/hero) need a visual spot-check on preview — can't auth into the app from here. No e2e spec: no deterministic image test data and the change is a rendering swap, not a flow. |
| 2026-05-30 | Lazy-load the Amplitude SDK (`slice/amplitude-lazy-load`). `src/lib/analytics/amplitude.ts` now imports `@amplitude/analytics-browser` via a dynamic `import()` inside `initAnalytics()` (type-only static import retained for types) instead of a top-level `import * as amplitude`. Module-level `sdk` holds the resolved SDK; `loadPromise` dedupes concurrent init and lets `track()` calls fired in the same tick as consent flush once the chunk arrives; load failures are swallowed (analytics stays disabled, retry allowed). `AnalyticsProvider` calls `void initAnalytics()`. Verified via build manifest: Amplitude is now a single on-demand chunk (**216 KB raw / 57 KB gzipped**) **not referenced in any page's first-load JS** — previously it shipped in every route's initial bundle. | Surfaced by a performance review as the #1 win: the SDK was downloaded/parsed on first paint for 100% of users (including those who tap "Afvis"), even though it only *ran* after consent. Lazy-loading removes the largest single chunk from every page's cold-open and tightens the GDPR posture (third-party code no longer ships before consent). No behaviour change once consent is granted; no new dependency. Bundle composition is a build-time property, so no unit test guards it — proof is the manifest inspection. |
| 2026-05-30 | Foreground notification suppression in `public/sw.js` `push` handler (SW v11→v12). A push is suppressed **only when a visible window client's `url` pathname matches the push `data.url`** (i.e. you're on that exact DM/raid screen) — pushes for any other screen still notify even with the app open. The app-icon badge uses a coarser rule: the SW bumps it only when **no** client is visible, because the in-app realtime (`UnreadProvider`) owns the count whenever the app is foreground (prevents double-count). `docs/notifications.md` updated (new "Foreground suppression" section; "Suppress when actively viewing" cross-cutting item marked Implemented). | Notifying while the app is open and you're already reading that conversation is noise — other apps don't do it. Granular (exact-route) rather than blanket "app open → silent" so a DM from someone else while you read a channel still alerts you. Suppressing only against a *visible* target also avoids the iOS/Chrome silent-background-push penalty (the suppressed path is always foreground). Exact-pathname match is safe under Danish-only `localePrefix: 'as-needed'`; a future `/en/` prefix would just err toward notifying. Push behaviour verified on device/preview, not CI. |
| 2026-05-30 | Wired Amplitude product analytics behind an opt-in consent banner (`slice/amplitude-analytics`). `@amplitude/analytics-browser`; client-only `track()` no-ops until `initAnalytics()` runs, which only happens after the user taps "Acceptér" (consent persisted in `localStorage` via `src/lib/analytics/consent.ts`; `AnalyticsProvider` mounted in the `[locale]` layout). EU `serverZone`, `trackingOptions.ipAddress: false`, `autocapture: false`, **fully anonymous** — no `setUserId`, no email/trainer name/friend code/search terms/message bodies in any event. `normalizePath` strips UUID path segments from `page_view`. Events wired: `account_created` (register submit success), `profile_completed` (profile setup), `raid_created` (new-raid form, has_image/has_gym/has_boss flags), `raid_joined` (RaidList + RaidDetail, `surface`), `dm_sent` (DMScreen), `channel_message_sent` (ChannelScreen, channel slug only), `reaction_added` (channel/dm/raid, add-only, `surface`), `player_search` (debounced, NO query string), `profile_viewed` (player detail mount), `channel_opened` (ChannelScreen mount). Privacy Policy §9 rewritten to disclose opt-in Amplitude (EU, no IP/PII, how to withdraw) + Amplitude added to §7 Databehandlere; `Privacy.lastUpdated` → 2026-05-30 (da + en). GDPR checklist line "No third-party analytics or tracking" reworded. New unit tests (`consent.test.ts`, `amplitude.test.ts`) + e2e (`consent-banner.spec.ts`). Code no-ops with no `NEXT_PUBLIC_AMPLITUDE_API_KEY`. | PM-requested product analytics. Opt-in + anonymous + EU keeps it GDPR-compliant: nothing loads or sends until explicit consent, and Amplitude never receives identifying data. Disabled-by-default (no key) means it merges cleanly before the Amplitude account/key exists. Remaining PM ops: create EU project, add the key to Vercel, verify requests fire only after consent on a preview. |
| 2026-05-29 | Added Sentry + Amplitude to "Next up" as soon-to-add tooling (PM request): Sentry for error logging, Amplitude for product analytics. Flagged that Amplitude conflicts with the GDPR "No third-party analytics or tracking" guarantee and needs consent handling + Privacy Policy work before it can ship. | PM wants observability/analytics before launch. Amplitude is the heavier lift (consent/privacy), so it's queued behind Sentry. |
| 2026-05-29 | Wired Sentry error logging (`slice/sentry-error-logging`). `@sentry/nextjs` v10 manual setup (no wizard) for Next 16 + `src/` layout: `sentry.server.config.ts` / `sentry.edge.config.ts` (root), `src/instrumentation.ts` (runtime-split `register()` + `onRequestError`), `src/instrumentation-client.ts` (client init + `onRouterTransitionStart`), `src/app/global-error.tsx` (root boundary → `captureException`), `next.config.ts` wrapped with `withSentryConfig` (innermost stays `withNextIntl`). **Error tracking only**: `tracesSampleRate: 0`, no session replay, `sendDefaultPii: false` everywhere. DSN read from `NEXT_PUBLIC_SENTRY_DSN`; every `init` guarded by `enabled: Boolean(dsn)` so it **fully no-ops with no DSN** (clean local/CI build). Source-map upload only when `SENTRY_AUTH_TOKEN` present. Privacy Policy §7 (Databehandlere) extended to disclose Sentry as an EU-region processor (no IP/PII collected); `Privacy.lastUpdated` → 2026-05-29 (da + en). New `e2e/privacy.spec.ts` guards the disclosure. | PM-approved scope (error-only, no replay) keeps GDPR burden minimal — content-light, no consent gate needed, EU region mandated. Disabled-by-default means the code can merge before the Sentry account/DSN exists. Edge Functions (Deno) deliberately out of scope; `@sentry/deno` is a later follow-up. Build + lint + e2e green with no DSN. |
| 2026-05-29 | Sentry shipped + activated (PR #69 merged to `main`). EU-region project `pogosundet` created in the `private-c1n` org (DSN host `ingest.de.sentry.io` = EU ✅); `NEXT_PUBLIC_SENTRY_DSN` set in `.env.local` and in Vercel **Production + Preview** (non-sensitive — it's a public `NEXT_PUBLIC_` value). Verified end-to-end against the live project: a thrown route error was captured via the `onRequestError` mechanism with **0 users / no PII** attached (confirms `sendDefaultPii: false`), then resolved. Prod Sentry activates on this merge's prod build. | DSN is build-time inlined (`NEXT_PUBLIC_`), so production picks it up on the post-merge build — no manual redeploy. Still optional: `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` in Vercel for un-minified prod stack traces. |
| 2026-05-29 | CI fix: run the `test` job inside the Playwright Docker image (PR #70, merged to `main`). `.github/workflows/ci.yml` now sets `container: mcr.microsoft.com/playwright:v1.59.1-noble` (tag pinned to `@playwright/test`) and drops the runtime `npx playwright install` step. | `cdn.playwright.dev` was reliably stalling the Chromium download after 100%, hanging the job until the 15m cap killed it — red CI on `main` for days (PRs #64–#68). Retries/caching couldn't help (stalled every attempt on a cold cache). Pre-baked browsers from Microsoft's registry remove the dependency entirely; `test` now passes in ~2min. If the Playwright version is bumped, update the image tag to match. |

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
