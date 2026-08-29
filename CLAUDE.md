# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is read automatically at the start of every Claude Code session.
Do not delete it. Update it at the end of each session if any decisions changed.

For first-time environment setup (Supabase project, env vars, Google OAuth), see `docs/setup.md`. The required env vars are templated in `.env.local.example` — copy to `.env.local` and fill in. Pre-launch operational tasks (env vars, push debugging runbook, PWA icon replacement, etc.) live in [`docs/launch-checklist.md`](docs/launch-checklist.md). A standalone new-developer primer covering the same ground as this file (stack, repo layout, testing, CI/CD, git workflow) lives in [`docs/onboarding.md`](docs/onboarding.md) — this file (`CLAUDE.md`) is still the source of truth; keep the two in sync when either changes. Gym-data seeding instructions (non-technical, Supabase SQL editor only) live in [`docs/gyms-seeding.md`](docs/gyms-seeding.md).

---

## Commands

Commands are the standard `npm run <script>` for each entry in `package.json`'s `scripts` block. A few non-`npm run` invocations that aren't in that list: `npx vitest run <path>` (single unit test file), `npx playwright test <path>` (single e2e file), `npx supabase functions deploy <name>` (deploy an Edge Function) — see `docs/onboarding.md` (Local development / Testing strategy / CI/CD sections) for the full list.

`npm run typecheck` (`tsc --noEmit`) is the fast standalone type check; `npm run build` is the fuller gate (Next.js fails the build on TS errors AND catches build-time failures `tsc` misses — RSC boundaries, route config, bundling). **As of 2026-06-24 CI runs both** (Lint → Typecheck → Build → Vitest → Playwright), so the type gate is no longer build-only or CI-absent.

`npm run lint` is bare `eslint` (Next 16 dropped `next lint`). Don't expect `next lint`-flavored output or pass `--dir src` — the flat config in `eslint.config.mjs` already scopes the run.

A **Husky `pre-push` hook** (`.husky/pre-push`) runs `npm run lint && npm run typecheck` on every `git push` — a failed push means one of those failed (fix it, or bypass once with `git push --no-verify`). Node is pinned to **24** via `.nvmrc` + `package.json` `engines` (run `nvm use` locally to match CI/Vercel).

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
- Also wrapped in `withSentryConfig` (outermost) — captures server/edge errors and uploads source maps when `SENTRY_AUTH_TOKEN` is set (CI/prod only; skipped locally and in PR builds without it).

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
- Channel set (`#generelt`, `#app-feedback`, `#events`) is a hard-coded TypeScript constant + DB CHECK. Adding a channel requires a `channels.ts` edit AND a migration extending the CHECK on **both** `channel_messages.channel` and `channel_reads.channel` (see 023). The per-channel state in `use-channel-unread.ts` / `use-channel-list-typing.ts` now derives from `CHANNELS`, so it no longer needs a matching edit.
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
`public/sw.js` carries a cache version constant (`SHELL_CACHE` / `RUNTIME_CACHE`). Bump it on every change to SW behavior — push handlers, cache strategy, `notificationclick`, precache list. The bump evicts the stale cache on installed PWAs; `skipWaiting()` + `clients.claim()` activate the new SW on first visit (users still need one extra navigation per device before the old SW closes). Current: v17. History lives in the decisions archive. Note: the `pogosundet-share` cache (Web Share Target image hand-off) is intentionally **un**versioned and excluded from the `activate` cleanup allowlist, so a pending share survives a version bump.

### Unread state lives in `UnreadProvider`
`src/components/UnreadProvider.tsx` is mounted in `src/app/[locale]/layout.tsx` and owns `useChannelUnread` + `useDMUnread`. `BottomNav` and the app-icon badge (`src/lib/push/app-badge.ts`) read from it. Do **not** move the hooks back into `BottomNav` — that component remounts on every navigation, so the in-memory counts would reset. The Badging API mirror in `app-badge.ts` + IndexedDB lets `public/sw.js` increment the home-screen badge from a `push` handler while the app is closed.

### Supabase Storage
- Bucket `raid-images` — stores raid screenshots uploaded by users
- Requires two manually created RLS policies: INSERT for authenticated users, SELECT for public (not set automatically on bucket creation)

### Account deletion
`POST /api/account/delete` — verifies session, calls `deleteAccount()` using the admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### Database migrations
SQL migrations live in `supabase/migrations/` as reference files. No runner — paste the SQL into the Supabase SQL editor manually. The Supabase CLI is only used for deploying Edge Functions (`supabase functions deploy`).

**Apply-before-merge ordering (non-negotiable).** As of 2026-06-26 preview runs on a **separate** Supabase project (`pogosundet-preview`), so the two no longer share a DB — but there is still **no migration runner**, and merging a PR deploys it to **prod**. So any migration whose new columns/tables are referenced by a query that ships in the PR must be applied **manually to the prod project's SQL editor before the PR merges**, or prod errors for every user the moment the code deploys (also apply it to `pogosundet-preview` so Preview builds work). Migrations that only add constraints/indexes not referenced by a query (e.g. `019`) can be applied after. Precedent: `015`/`017`/`018`/`020` were all applied before their PR merged.

Migrations `001`–`024` exist in `supabase/migrations/` (filenames are self-describing — run `ls supabase/migrations/` for the full list). **Applied through `024`** (all migrations are applied — there is no pending one). Status of the recent ones:

| # | Applied? | Ordering | Note |
|---|----------|----------|------|
| `018_gyms` | ✅ 2026-06-10 | before PR #121 | apply-before-deploy |
| `019_input_length_limits` | ✅ 2026-06-12 | after PR #139 | CHECK constraints only (not query-referenced), security review Finding 2 |
| `020_hide_friend_code` | ✅ 2026-06-12 | before PR #141 | `profiles.hide_friend_code` (issue #101) |
| `021_friend_scan_status` | ✅ 2026-06-23 | before PR #164 | `friend_scan_status` (per-user, RLS); `/players` reads it + scan-session upserts into it |
| `022_friend_code_column_security` | ✅ 2026-06-27 | before PR #191 | `REVOKE SELECT (friend_code)` + `get_own_profile()` RPC (report #18, security review Finding 3) |
| `023_events_channel_and_feed_state` | ✅ 2026-08-17 | before PR #217 | `profiles.is_bot`, `'events'` added to both channel CHECKs, `pogo_feed_state` + `pogo_feed_posted_events`. Query-referenced (`getAllProfiles` filters `is_bot`; the poster inserts `channel = 'events'`) — apply first or prod errors on deploy |
| `024_moderation` | ✅ 2026-08-25 | before PR #216 | `profiles.is_admin`/`banned_at`/`banned_reason` (+ column-level GRANT lockdown), `is_admin()`/`is_banned()` RPCs, `message_reports` table, `report_message()`/`moderate_report()` RPCs, admin DELETE policies, ban enforcement on all user-content INSERT policies. Renumbered from `023` mid-review after `023_events_channel_and_feed_state` claimed that number first — see PR #216. Applied to both prod and `pogosundet-preview`; `is_admin` self-grant done and the report → admin-queue → delete flow verified end-to-end on preview with a second test account (2026-08-26) |

Edge Functions (`supabase/functions/`): `notify-raid`, `notify-dm`, `notify-raid-message`, `notify-raid-join`, `notify-report` — **all five deployed with their DB webhooks wired** (`notify-raid-join` verified on prod 2026-06-09; `notify-report` deployed + webhook wired + push verified on prod 2026-08-29 — the `x-webhook-secret` gate was confirmed both ways: a negative `curl` with a valid platform JWT but no header returned the in-function `401`, and a real report on prod delivered the push).

Because merging a PR deploys it to prod (no migration runner), any migration whose columns/tables are referenced by a shipping query **must be applied to the prod project before the PR merges**, or prod errors the moment the code deploys (see the apply-before-merge rule above).

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

Recent shipped work (see the Decisions log for detail): raid chat notifications + unread badges (#109, migration 017, SW v16), raid-join notifications (#111, `notify-raid-join`), desktop layouts for Raids/Chat/Profil (#99), a series of PWA/OAuth/raid-navigation fixes (#91, #96–#98, #100, #115, #117), the navigation/perceived-performance pass (#120), the **gyms database** (#121, migration 018, closes issue #93), the **user-facing changelog** (#124, closes issue #112), and **in-app bug reports → GitHub issues** (#127 + follow-up fixes #128/#129, closes issue #126, **prod-verified end-to-end** via test issue #130). As of 2026-06-11 the **gyms table is seeded and verified on prod** (152 gyms from collect.dk, with permission — `supabase/seeds/001_gyms_frederikssund_collect_dk.sql`; the raid-form autocomplete works with real data). The two coordinate-dependent follow-ups also shipped and were prod-verified 2026-06-11: **nearby/recent gym suggestions in the raid form** (#136) and **"Vis på kort" opening exact gym coordinates** (#135) — the gyms arc (issue #93) is complete. Next slice not yet picked.

### Do NOT build (in Raid MVP)
- Remote raid lobby code sharing
- Recurring raids or raids scheduled more than a few hours out
- Raid history, stats, or past-raid browsing
- Filters, search, sort options on the list
- Host/organiser roles

### Phase 2 — do not build yet
Trade requests, richer raid features (remote lobby codes, filters, recurring raids, history). DMs shipped early in Slice 17. **Moderation also shipped early** (2026-08-12, at the PM's explicit request): user reports on any message + an `/admin` queue with delete / ban / warn / dismiss. What is deliberately still NOT built: any other admin surface (no user management screen, no content browsing, no raid/profile editing by admins), moderation of anything other than chat messages (profiles, bios, avatars, raid text are not reportable), appeals workflow, and audit logging beyond the report row itself.

**If a feature would require significant refactoring to support Phase 2, flag it and ask. Otherwise, do not pre-build Phase 2 functionality.**

---

## Push notifications

Self-hosted web-push: PWA service worker + `push_subscriptions` table + `notify-raid` Edge Function (triggered on raid INSERT). **iOS 16.4+ requires Add-to-Home-Screen via Safari** — users who don't install the PWA get no push (the "Share to Messenger" button on each raid card is their fallback). iOS onboarding flow at `/onboarding/ios`.

**[`docs/notifications.md`](docs/notifications.md) is the authoritative list of exactly when we send notifications** (current triggers, deliberate exclusions, and the target state for message notifications). Keep it in sync whenever you change what we notify on.

The 6-step debugging runbook lives in [`docs/launch-checklist.md`](docs/launch-checklist.md). Go there first if push regresses.

**Edge Function caller auth — `WEBHOOK_SECRET` (live on prod).** All five `notify-*` functions verify an `x-webhook-secret` header (constant-time compare) and reject mismatches with `401`. The check is **fail-open**: if `WEBHOOK_SECRET` is unset in `Deno.env`, it returns `true` (no enforcement), so deploying the code can never break delivery. The secret is currently **set and enforced** on prod (the DB webhooks send the matching header). **Any new `notify-*` function must replicate this `isAuthorizedCaller()` gate**, and its DB webhook must carry the `x-webhook-secret` header. Rollback = `supabase secrets unset WEBHOOK_SECRET` + redeploy → instant fail-open. Never trust an auth change on the notify path without sending a real webhook (device push) through it AND a negative `curl` — a platform `verify_jwt` 401 does not prove the in-function gate.

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
- Scope: pure functions and Supabase helpers (validation, filters, server-helpers)
- Co-located with the code they test

**Browser verification — Playwright**
- When a change has any user-visible effect, verify it in a real browser via the Playwright MCP **and** capture the same steps as a spec in `e2e/` so the verification becomes a CI regression test.
- One spec file per user flow; specs run against the dev server.
- `playwright.config.ts` auto-starts `npm run dev` on port 3000 via its `webServer` block and reuses an existing server when one is already running locally — just run `npm run test:e2e`, don't start the dev server separately. In CI it always starts fresh.

**Verify on a Vercel deploy, not dev — realtime / push / poster-gated features.** Supabase Realtime cross-user delivery is unreliable under `npm run dev` (works fine on Vercel), so don't burn time debugging realtime locally. Push notifications and other device-only paths can't be verified from here at all. For poster-gated client components (e.g. raid host views), `RaidDetail` double-mounts in `npm run dev` — don't trust on-screen state; use the throwaway-preview-route trick (render the component with mock props in a temporary `src/app/[locale]/<name>/page.tsx`, screenshot, then delete) for a local visual check.

**Preview first, not prod — changed 2026-08-09.** The old rule here was "squash-merge to `main`, then verify on prod", justified by *"pre-launch there are no real users."* That justification is expiring: the plan is to invite the first players in from the two local Facebook groups (see `personal-projects/audience.md` in the Desktop context directory, §7.5 — the invite link is the main growth mechanic). Once real players are in, a broken prod is a broken app for someone else, not just for the PM. The infrastructure for the switch already exists: `pogosundet-preview` (separate Supabase project, EU) has been live since 2026-06-26 with Preview-scoped Vercel env vars, so a preview deploy is a genuine end-to-end environment.

So the workflow is now: push the branch → **verify on the preview deployment** (a second account for cross-user/realtime checks) → then merge. Two caveats that are not yet solved, so don't assume preview covers everything:

- **Push notifications still can't be verified on preview.** All five `notify-*` Edge Functions and their DB webhooks are still wired to the **prod** Supabase project (see the staging caveat in Known issues). Push delivery still needs a post-merge prod check until they're duplicated onto preview.
- **Preview auth has historically been flaky** (repeated login-redirect loops during the avatar-crop work). If login on preview eats more than a few minutes, say so and fall back to a prod check rather than burning the session on it — but flag it, don't silently switch.

**PR gate:** all tests must pass before opening a PR.

**CI:** `.github/workflows/ci.yml` runs `npm run lint` + Vitest + Playwright (chromium) on every PR and push to `main` (Node 24, Ubuntu). Supabase env vars come from repo secrets. The Playwright HTML report is uploaded as an artifact on failure (14-day retention).

---

## Git workflow

- `main` is always deployable. **Direct pushes to `main` are blocked** by a branch ruleset (`Protect main — require PR`, active 2026-06-20) — every change goes through a PR, even doc-only ones. The repo is **public** (made public 2026-06-20 to unlock free branch protection on the GitHub free tier; security review confirmed no secrets in code or history — all keys live in Vercel/Supabase env).
- **PR merge flow:** open a branch → push → open a non-draft PR → the **Claude PR Review** action posts a review (`.github/workflows/claude-review.yml`) → address valid findings (push back on false positives — don't blindly accept) → **Claude merges** once the review is addressed and CI is green (the PM delegated the merge click 2026-06-20). The ruleset requires a PR but **0 approvals**, so a self-merge is allowed; the Claude review is advisory, not a required status check. Squash-merge, then delete the branch.
- Each slice or chore gets its own short-lived branch **off `main`** (`slice/N-name`, `chore/short-name`). Delete the branch after its PR merges. Do not start a new slice until the current one is merged.
- Commit messages: short, imperative, in English (e.g. `Add Trainer Code display`).
- Slices 1–9 already implemented and merged; all migrations applied.
- **User-facing changelog (issue #112):** every merge to `main` that adds a feature or fixes a user-facing bug must prepend an entry to `src/lib/changelog/entries.ts` — 1–2 Danish sentences, no jargon, newest first. It powers the in-app "Nyheder" log behind the header hamburger menu. Doc-only, refactor, or invisible-infra merges don't get an entry.

---

## Next up

Pickable TODOs, in no particular order. Promote one to a branch and start a slice when picked.


- **Use `avatar_url` everywhere in the app** — partially done: `<Avatar>` already renders `avatar_url` on player cards, player detail, chat message bubbles, the online strip, and the raid attendee list. Remaining gaps to audit: the **BottomNav profile link** (no avatar today) and a few raid-chat paths that still pass `avatar_url: null`. Finish the sweep so any surface showing a player's identity uses the real photo with the initials fallback.
- **Showcase-stops map — a new in-app section (planned 2026-08-22, data pull not yet run).** Goal: a static map of the PokéStops that *usually* host showcases, so people can plan a route. Best done as **two slices** — (A) data capture + table + seed, (B) the map section — since A isn't blocked on the map-library decision in B.
  - **Data source: collect.dk, pull on a Tuesday afternoon** (that's when showcases are live locally). **The PM is asking their operators for permission** — the 2026-06-10 yes covered a one-off gym copy, this is a new and repeated use, so it needs its own ask before any pull.
  - **What to pull.** Showcases are *not* a durable attribute of a stop — there is no "this stop hosts showcases" flag in the game data. In the ReactMap/Golbat stack collect.dk runs, a showcase is a pokestop **incident with `display_type: 9`**, carrying `showcase_pokemon_id`, `showcase_expiry`, `showcase_rankings`; the `PoI.showcase` boolean in the submission-cell layer is just derived from `showcase_expiry` (`getSubmissions` in `server/src/models/Pokestop.js`), so it is equally a snapshot. So a pull returns **that Tuesday's** showcase stops — grab `id, name, lat, lon, showcase_expiry`. The recurring set has to be **derived by repeating the pull ~3–4 Tuesdays and counting frequency**; one Tuesday is enough to ship a v1 list, the repeats are what make "usually" true.
  - **How to pull.** Same technique as the gym sweep (see the 2026-06-11 archive entry): replay collect.dk's own GraphQL request **verbatim** with shifted bounding boxes — hand-rolled filter objects return empty, it needs their full ~20-key filter. Reuse the 18-tile sweep + Frederikssund-municipality bounding-box filter from that job. **Blocker for web sessions: collect.dk is blocked by the Claude-web egress proxy** (403 on CONNECT, verified 2026-08-22), so a session like this one cannot run the pull — it has to be a local Claude Code session or a script the PM runs.
  - **Schema (slice A).** New table `showcase_stops` — migration `024`, applied **before** its PR merges (query-referenced; see the apply-before-merge rule). Don't reuse `gyms`: different POI set, and `gyms` has nullable coords plus a client INSERT policy this table must not have. Columns: `name`, `lat`/`lng` **NOT NULL** (a stop with no coordinates is useless on a map), `times_seen int`, `last_seen_on date`, plus the usual `id`/`created_at`. Unique index on `lower(name)` like `gyms`. RLS: SELECT for `authenticated` only; **no INSERT/UPDATE/DELETE policies** — seeded and re-pulled via the SQL editor, exactly how the gym seed works. Seed file `supabase/seeds/002_showcase_stops_collect_dk.sql`, `on conflict do nothing`, re-runnable.
  - **Map library — a new dependency, so it needs PM sign-off** (the stack is locked, and the app has no map today; `Vis på kort` (#135) just hands coordinates to the native maps app). Recommendation: **Leaflet + react-leaflet with OSM raster tiles** — no API key, ~40KB gz, plenty for ~30 markers. Must be loaded client-only (`next/dynamic` with `ssr: false`) since Leaflet touches `window` at import. Caveat: OSM's tile-usage policy is aimed at low-volume use — fine at this community's size, but if it grows, move to a keyed free tier (MapTiler/Thunderforest). MapLibre GL is the alternative: nicer vector tiles, but a bigger bundle *and* a tile-provider key, so it costs more for no v1 benefit.
  - **UI (slice B).** New route under `src/app/[locale]/showcases/` with `export const preferredRegion = "dub1"`; entry point in `BottomNav` (that's a 5th tab — check whether it fits or something has to move, this is a layout decision worth a look before building). Markers → stop name + `Vis på kort` (reuse #135's external-maps handoff). Show a **"sidst opdateret <dato>"** line: showcase stops rotate over months, and a stale map that looks live is worse than a dated one. Strings in `messages/da.json` + `en.json` (informal *du*, game terms in English), and **credit collect.dk visibly** in the section, as with the gyms. Changelog entry required (user-facing feature).
  - **GDPR:** stop names/coordinates are public place data — no new personal data, no Privacy Policy change (same conclusion as the gyms seed). A "show my position" button would reuse the existing client-side geolocation pattern from the nearby-gyms work (#136): user-gesture gated, never sent to the server. Run `/gdpr-check` at build time to confirm rather than assuming.
  - **Testing:** a `mobile-chrome` Playwright spec for the section. Do **not** let CI depend on external tile fetches — assert on the markers/list, and stub or ignore tile requests.
- **Q&A bot — the second half of the event-bot brief (designed 2026-08-16, NOT built).** The `#events` poster shipped standalone; this is the part that answers member questions about Pokémon GO. Design as agreed: trigger on a `!pogo` prefix via a Database Webhook on `channel_messages` INSERT → Edge Function (the same "server reacts to a chat insert" pattern the five `notify-*` functions use — there is no command dispatch in chat today). Questions answerable from the feed ("hvad er raid-bossen nu") answer from the cached `pogo_feed_state` with **no LLM call**; open-ended ones need a small RAG index over an explicitly approved source list, refreshed daily — a separate store and cadence from the 20-min feed cache. **Three things to settle before building:** (1) the LLM provider was deliberately deferred — note the PM chose `CLAUDE_CODE_OAUTH_TOKEN` for the CI reviewer specifically to avoid Console billing, so this would be the project's first metered API credential; (2) **GDPR — sending member questions to an LLM is new third-party processing of user-generated content**, so it needs an EU-region or DPA-covered provider, a Privacy Policy update (`messages/da.json` → `Privacy`) and a `lastUpdated` bump, and a decision on whether it needs its own consent step; (3) the bot is currently **hidden** (`is_bot`), so it is not DM-able — answering privately rather than in-channel would need the "hidden but DM-able" variant instead. Per-user rate limiting will also be needed, not just the per-run cap the poster has. Runbook for the shipped half: [`docs/plans/pogo-event-bot.md`](docs/plans/pogo-event-bot.md).
- **Investigate account deletion issues** — user noticed problems with account deletion during the 2026-05-22 session but didn't have time to look into it. Reproduce and fix before launch.
- **Define push notification triggers** — new raid posts, **new DMs (shipped 2026-05-26, `notify-dm`)**, **new raid chat messages (shipped 2026-06-08, `notify-raid-message`, closes #104)**, and **new raid participants (shipped 2026-06-09, `notify-raid-join`, closes #103 — notifies host + other attendees when someone joins)** trigger a push. Decide which of the remaining events should notify users — reply to a raid/channel message you authored, new channel message, reactions to your message — without causing notification fatigue. See [`docs/notifications.md`](docs/notifications.md) for the prioritised list.
- **~~Add Sentry for error logging~~ — SHIPPED + LIVE** (code 2026-05-29 `slice/sentry-error-logging`; DSN set in Vercel 2026-05-29, **re-verified capturing on prod 2026-06-25** — client error → envelope POST `200` to `ingest.de.sentry.io`). EU project `pogosundet`, `sendDefaultPii: false`. **Two optional follow-ups remain:** (1) source-map vars (`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) for un-minified prod traces; (2) `@sentry/deno` to cover the five Deno Edge Functions (not captured by the Next.js SDK). Runbook: [`docs/plans/sentry-activation.md`](docs/plans/sentry-activation.md).
- **Duplicate the `notify-*` Edge Functions onto `pogosundet-preview` — closes the last gap in preview-first verification.** Added 2026-08-09 alongside the switch from prod-first to preview-first (see Decisions log). All five functions — `notify-raid`, `notify-dm`, `notify-raid-message`, `notify-raid-join`, `notify-report` — and their DB webhooks are still wired only to the **prod** Supabase project, so push delivery is the one thing a preview deploy cannot verify today; it still needs a post-merge prod check. Work: deploy the five with `npx supabase functions deploy <name>` against preview (ref `eqdzrkijenzcpgmuluvn`), recreate each DB webhook in the preview project, and set `WEBHOOK_SECRET` there so the `isAuthorizedCaller()` gate is actually enforced rather than silently fail-open — the gate returns `true` when the secret is unset, so a missing secret looks like it works. Verify with a real device push **and** a negative `curl` (a platform `verify_jwt` 401 does not prove the in-function gate — this is exactly how `notify-report`'s gate was verified on prod 2026-08-29). Runbook for the preview project: [`docs/plans/staging-supabase.md`](docs/plans/staging-supabase.md). Worth doing in the same pass as the outstanding `avatars` Storage bucket on preview (noted under the staging item below) — both are "finish the preview environment" chores, and until they're done preview is not a full stand-in for prod.
- **WCAG color-contrast follow-up** — the a11y spec (`e2e/accessibility.spec.ts`) disables the `color-contrast` axe rule because the brand palette (muted teal tones, e.g. `#2BBFAA` on white) falls below the WCAG 4.5:1 ratio on multiple surfaces. Needs a design pass to either boost the contrast ratios or switch problem surfaces to a higher-contrast alternative. Until fixed, the axe scan continues to suppress these violations and the full WCAG AA colour-contrast requirement is not met. Coordinate with the Claude Design system (see the design workflow section) before touching brand colours.
- **Amplitude product analytics — shipped, pending API key** (`slice/amplitude-analytics`). Opt-in consent banner gates everything; Amplitude inits only after the user accepts. EU `serverZone`, no autocapture, no IP, fully anonymous (no `user_id`/PII). Wired events: `page_view`, `account_created`, `profile_completed`, `raid_created`, `raid_joined`, `dm_sent`, `channel_message_sent`, `reaction_added`, `player_search` (no query string), `profile_viewed`, `channel_opened`. Privacy Policy §7/§9 updated + `lastUpdated` bump. Code no-ops with no key. **Remaining ops (PM):** create an EU-region Amplitude project at `app.eu.amplitude.com`, add `NEXT_PUBLIC_AMPLITUDE_API_KEY` to Vercel (Production + Preview — it's a public `NEXT_PUBLIC_` value), then verify on a preview deploy that Amplitude network requests fire ONLY after "Acceptér" (none after "Afvis").

### Professionalisation follow-ups (open items from [`docs/professionalisation-report.html`](docs/professionalisation-report.html))

The 2026-06-24 hardening pass closed report items #1 (type-check + build in CI), #4 (`test` as a required check), #5 (secret scanning + push protection), #7 (AI PR reviewer activated), and #8 (Dependabot). These remain open (report's priority in brackets):

- **~~[P0] Free staging Supabase project (report #2)~~ — DONE + verified 2026-06-26.** Preview project `pogosundet-preview` (EU, ref `eqdzrkijenzcpgmuluvn`) stood up; schema applied via `docs/staging-bootstrap.sql`; Vercel **Preview**-scoped env vars repointed at it (prod values untouched); confirm-email disabled for instant test signups. End-to-end verified: a test signup created an auth user + profile (`GalopingMadness`) in the preview DB while prod stayed at 3 profiles (no test data). Runbook: [`docs/plans/staging-supabase.md`](docs/plans/staging-supabase.md). **Small remaining config:** add the `avatars` Storage bucket on preview (profile-photo uploads fail without it — only `raid-images` was created initially). Unblocked #6, #9, #18.
- **~~[P0] Enable Sentry error monitoring (report #3)~~ — DONE** (was already live; the code-only report misread it as disabled because it can't see Vercel env). Re-verified on prod 2026-06-25. Only the two optional follow-ups above remain (source maps; Edge-Function coverage).
- **~~[P1] Migration-safety CI guard (report #6)~~ — DONE 2026-06-27.** New advisory workflow `.github/workflows/migration-guard.yml`: on a PR touching `supabase/migrations/**` it fails with an error annotation unless the PR description's **Migration** box (which carries a hidden `<!-- migration-applied -->` marker) is checked, making the apply-before-merge confirmation machine-checkable. Read-only (`gh api .../files` + the event body), re-runs on `edited` so ticking the box clears it without a push, and is **not** a required check (can't deadlock a merge). Pairs with the PR template (#13). Possible later upgrade once richer tooling is wanted: Supabase CLI `db push` against `pogosundet-preview`.
- **~~[P1] Logged-in e2e in CI (report #9)~~ — DONE 2026-06-28** (PR #194). `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` uncommented in `.github/workflows/ci.yml`; all 17 auth-gated Playwright specs now run in CI against `pogosundet-preview`. Required 9 CI runs to stabilise (accumulated DB state from prior runs caused strict-mode violations on reaction chip and reply-banner assertions; desktop sidebar link unreliable in CI). Fixes shipped: `.first()` on `👍\s*1` chip assertions (chat-reactions + DM), exact `/^👍$/` regex for action-sheet emoji button, `waitForTimeout(800) + reload` to clear optimistic IDs before opening action sheet, defensive skips for empty scan-session queue and desktop sidebar link not attached. **18 of 18 report items now done — professionalisation report complete.**
- **~~[P1] Mobile viewport Playwright project (report #10)~~ — DONE 2026-06-27** (PR #188). `mobile-chrome` (Pixel 7) is now the default project (`grepInvert: /@desktop/`); `desktop-chrome` runs only `@desktop`-tagged specs (`grep: /@desktop/`). All existing desktop specs (getting-started, desktop-players, scan-status) carry the `@desktop` tag.
- **~~[P2] Pre-push quality hook (report #11)~~ — DONE 2026-06-27.** Husky 9 (`prepare: "husky"`) with `.husky/pre-push` running `npm run lint && npm run typecheck` — fast local feedback mirroring the first two CI steps before code reaches CI. `&&` so either failure aborts; bypass with `git push --no-verify`. Heavier gates (build, Vitest, Playwright) stay CI-only. Note: web Claude sessions still don't run local git hooks (CI remains the backstop there) — the optional `SessionStart` companion hook was **not** built (a lint+typecheck on every session start is too noisy; revisit if useful).
- **~~[P2] Pin the Node version (report #12)~~ — DONE 2026-06-27.** `.nvmrc` = `24` + `package.json` `engines.node` = `>=24 <25`. CI already pins Node 24; Vercel reads `engines.node` to select the build Node, so local (`nvm use`) + CI + Vercel now agree. Advisory by default (npm warns, doesn't hard-fail) — no `engine-strict` so a contributor on a different Node isn't blocked from installing.
- **~~[P2] PR template with the invariant checklist (report #13)~~ — DONE 2026-06-27.** `.github/pull_request_template.md` — "What & why" + a checklist (migration-applied / changelog / SW-bump / `dub1` / i18n / Privacy / tests-green). The migration line carries the `<!-- migration-applied -->` marker the #6 guard parses, so it doubles as the machine-checkable signal.
- **~~[P2] Automated accessibility checks (report #14)~~ — DONE 2026-06-27** (PR #188). `@axe-core/playwright` scans 5 logged-out pages (`/`, `/login`, `/register`, `/privacy`, `/reset`); asserts no critical/serious violations under WCAG 2.x A/AA. **`color-contrast` rule is deliberately disabled** — the brand palette (muted teal tones) falls below the 4.5:1 ratio on multiple surfaces. Tracked as a follow-up: see the WCAG color-contrast TODO in Next up.
- **~~[P2] Lighthouse / web-vitals budget in CI (report #15)~~ — DONE 2026-06-27** (PR #189). `.lighthouserc.json` + `.github/workflows/lighthouse.yml` — `treosh/lighthouse-ci-action@v12`, report-only (all `"warn"`), builds the app and scans 4 URLs on desktop preset.
- **~~[P2] CodeQL security scanning (report #16)~~ — DONE 2026-06-27** (PM ops). Enabled via GitHub → Code security → CodeQL "Default" setup. Advisory, not a required check.
- **~~[P2] Coverage reporting (report #17)~~ — DONE 2026-06-27** (PR #190). `@vitest/coverage-v8` in `vitest.config.ts`, `src/lib/**` scope, `continue-on-error: true`, text+json-summary reporters in CI coverage step.
- **~~[P2] Close the friend-code column-RLS residual (report #18)~~ — DONE 2026-06-27** (PR #191, migration 022 applied to prod + preview). `REVOKE SELECT (friend_code)` on `anon`/`authenticated` + `SECURITY DEFINER` function `get_own_profile()`. Security-review Finding 3.

---

## Decisions log

Update this section at the end of each session. Entries older than ~4 weeks live in [`docs/decisions-archive.md`](docs/decisions-archive.md).

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-08-12 | **Content moderation shipped** (`claude/comment-moderation-hlxy7u`, migration 024 — renumbered from 023 after PR #217 claimed that number for the event-bot migration while this branch was open). Users can report any chat message (channel, raid chat, **and DMs**); the PM reviews reports at `/admin` and can delete the message, ban/unban the author, send a warning DM, or dismiss. PM chose the full scope on all four open questions (admin flag in DB / all three surfaces / all four actions / push + in-app badge). Key design decisions: **(1) reports are filed through a `report_message()` SECURITY DEFINER RPC, never a direct insert** — the client sends only a message id, and the function resolves the body + author server-side, so nobody can fabricate a quote and get an innocent user banned; it also enforces the DM participant check, which is what makes DM reporting privacy-safe (only the single reported message is ever exposed, never the thread). **(2) `message_reports` has no INSERT policy at all** — the RPC's SECURITY DEFINER context is the only write path, which is what guarantees the snapshot is genuine. **(3) `message_id` has no FK** (it's polymorphic across three tables), so a report survives its message being deleted — that snapshot *is* the audit trail. **(4) Deletes are hard deletes, not soft** — GDPR-wise the offending content should actually go, and the report keeps the record. **(5) Ban enforcement lives in RLS** (`NOT public.is_banned()` added to all four user-content INSERT policies, which meant DROP + CREATE since Postgres has no ALTER POLICY for WITH CHECK); the `/udelukket` middleware redirect is UX only, cached behind a deliberately short 5-minute cookie because a ban — unlike the profile-existence guard's 30-day cookie — can be applied or lifted at any moment. **(6) The notify-report push is content-free AND name-free** (stricter than notify-dm, which carries the sender's public trainer name) — a moderation alert on a lock screen must not accuse anyone. **(7) The `/admin` menu row self-loads on dropdown open** rather than threading `isAdmin` through the layout, so the 99% of sessions that will never see it pay nothing; `/admin` itself `notFound()`s for non-moderators so the route isn't discoverable by probing. **Three manual steps before/after merge:** apply migration 024 to prod + preview, run the one-line `is_admin = true` UPDATE for the PM's account, and deploy `notify-report` + wire its DB webhook. **All three done** — the last one (deploy + webhook) completed 2026-08-29, verified with a negative `curl` (401 from the in-function gate, not the platform) and a real push on prod. | The PM asked for moderation directly, which overrides the Phase-2 "do not build yet" note (recorded above). The security-sensitive parts were pushed into the database rather than app code on purpose: this is the first feature where a user can cause another user's content to be deleted or their account restricted, so the authorisation boundary needed to be somewhere a bug in a React component can't cross. Every privileged path is checked twice (route handler + RPC). DMs were included despite the privacy tension because harassment most often happens in private, and excluding them would have left the biggest gap unaddressed — the single-message snapshot is what makes that acceptable. |
| 2026-08-03 | **DM entry points added — closes issue #201** (PR #207, `slice/dm-entry-points`; also merged the pending doc fix from `chore/claude-md-doc-fixes`, PR #206). A user reported "no option to start a direct message." Investigation: not a code regression — since Slice 17 the only ways to start a *new* DM were tapping an avatar in the "Online nu" strip (online users only) or opening a channel's Members sheet. No entry point ever existed in the player directory or on the player detail page, and `/chat` itself had no dedicated "start fresh" affordance. In a small community, the person you want to message is usually offline, so this read as "I can only continue existing conversations." Added three entry points, all routing to the existing `/chat/dm/[partnerId]` route (no schema/backend change): (1) a "Send besked" button on `PlayerCard` (`user_id`-keyed, `stopPropagation` so it doesn't trigger the card's own `/players/[id]` link — `PlayerDirectory` already excludes the current user, so no self-check needed there); (2) the same button on the player-detail swipe deck, which required threading a new `currentUserId` prop through `PlayerDetailDeckWithPresence` → `PlayerDetailDeck` → the inner card, since that deck (unlike the directory) is *not* self-filtered; (3) a "Ny besked" button next to "Direkte beskeder" on `/chat` that reuses the existing `MembersSheet` component as-is (same one `ChannelScreen` already uses) rather than inventing a new picker. Updated the now-stale `dmSectionHint` copy to point at the new button. New i18n keys in both `da.json`/`en.json`; changelog entry added; 3 new `e2e/dm.spec.ts` specs (gated on `E2E_TEST_EMAIL`, defensive skips). CI caught two real issues before merge: the new "Send besked" button substring-matched `e2e/bug-report.spec.ts`'s unqualified `getByRole("button", { name: "Send" })` locator (fixed with `exact: true`), and the automated PR review flagged that the new-message-picker e2e test's online-row filter (`/Online$/`) could never match because `MembersSheet` renders online rows as "Online nu", not "Online" (fixed the regex). Both fixed in follow-up commits on the same PR before merge. | Closes a real usability gap even though nothing was technically broken — the fix is a small, additive UI change reusing existing routes/components, no new mechanism. Implemented via a forked background agent (per the standing "5+ files → subagent" preference) since the change touched 4+ components plus i18n/tests/changelog; the two CI failures it didn't catch (both introduced by the new UI colliding with pre-existing test locators) were caught by CI on the first push and fixed in the main session before merge — a good example of why the PR-gate + automated-review flow matters even for agent-authored changes. |
| 2026-08-09 | **Switched from prod-first to preview-first verification**, and wrote the PM's working preferences down across three files. The prod-first rule in Testing strategy carried its own expiry note ("Revisit this prod-first rule at launch") and its justification was explicitly *"pre-launch there are no real users"* — which is expiring now that the plan is to invite the first players in from the two local Facebook groups. New flow: push the branch → verify on the preview deployment → then merge. Two caveats recorded rather than papered over: (1) push notifications still can't be verified on preview, because the four `notify-*` Edge Functions and their DB webhooks remain wired to the prod Supabase project — push still needs a post-merge prod check until they're duplicated onto `pogosundet-preview`; (2) preview auth has a history of login-redirect loops, so the documented fallback is to flag it and check on prod rather than burn a session on it. Separately, the "How to work with me" section here was reduced to PoGoSundet-specific items and now points at a new cross-project section in `~/.claude/CLAUDE.md` (narrate as you go; fix small / flag structural; record decisions as they're made; write the state down when the PM runs out of time). Also corrected the description of the PM from "not a coder" to "a product manager who codes in his spare time" — the old wording was producing over-simplified explanations. | The switch is cheap because the infrastructure already exists: `pogosundet-preview` has been a separate EU Supabase project with Preview-scoped Vercel env vars since 2026-06-26, so a preview deploy is a real end-to-end environment. Doing it *before* the first invites go out rather than after means no real player is the one who finds a broken prod. The working-preferences write-up was split by scope deliberately — deploy habits are project-specific and shouldn't ride along into unrelated projects, while the interaction preferences are the same everywhere. |
| 2026-08-16 | **Event bot shipped — new `#events` channel, automated raid/event posts** (`slice/pogo-event-bot`, migration 023). Polls the [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) feed (LeekDuck data, republished with permission) every 20 min and posts new raid events + raid-boss rotation changes. Four decisions worth recording. **(1) Scheduler: GitHub Actions, not Vercel Cron.** Vercel's Hobby plan is hard-limited to one cron run per day — a `*/20` expression fails at deploy time — so the repo's first scheduled job is `.github/workflows/pogo-feed.yml` POSTing `/api/cron/pogo-feed`. Two caveats live in that file's header: Actions schedules run 5-15 min late (irrelevant here), and GitHub disables them after 60 days without a repo commit (check this first if the bot goes quiet). **(2) Bot identity: a hidden account.** `channel_messages.user_id` FKs to both `auth.users` and `profiles`, so a bot row is unavoidable; new `profiles.is_bot` filters it out of `getAllProfiles` + `getMemberCount`, which covers `/players`, the online strip, the members sheet, the DM picker and "X medlemmer". Follow-on: since that filter also strips it from the client profile snapshot, and Realtime INSERTs carry no join, `getBotProfiles()` is passed to `ChannelScreen` as `botProfiles` and merged into author-resolution *only* — without it live bot messages render `—` / `?`. **(3) The cron gate is fail-CLOSED**, deliberately diverging from the fail-open `isAuthorizedCaller()` in the notify-* functions: those are fail-open so a missing secret can't silence live push, but this endpoint writes to chat, where fail-open would let anyone trigger the bot. **(4) Shared renderer fixed:** the bubble in `MessageGroup.tsx` had no `whitespace-pre-wrap` (newlines collapsed) and no linkification, so a multi-line post with a link was unreadable. Both fixed in the shared component, landing in channel chat, raid chat and DMs at once. Scope notes: event types are deliberately **raids only** (`community-day` excluded, one constant to widen); the Q&A half of the brief was designed but **not built** — LLM provider deferred. | Verifying the feed against the live repo rather than the handoff caught four things that would each have been a bug: the documented URL was wrong (data is on a `data` branch, not `main/data/`), `raids.json` has no ID field (so the rotation is diffed by `(tier, name)` fingerprint), tier labels have already drifted from the wiki (`"Tier 3"` → `"3-Star Raids"`, hence unknown-sorts-last rather than parsing), and `start`/`end` mix naive local wall-clock with `Z`-suffixed global instants — a naive `new Date()` would have rendered every Danish summer event two hours early. Running the formatter against the real feed before finishing also caught two copy bugs the unit tests didn't: ranges mixing an absolute date with a relative weekday ("12. aug. 06:00 – tirsdag 22:00"), and already-running multi-day events leading with a start date from last week instead of "Slutter tirsdag 22:00". Anti-spam is concentrated in the pure `diff.ts` so it is directly testable — the load-bearing one is the silent cold-start seed, without which the first poll would dump ~40 events into chat at once. |
| 2026-08-29 | **Raid rotation post narrowed to 5-star/mega only, plus a LeekDuck raid-boss link** (PR #225). The rotation post previously announced every tier change (1-star, 3-star, shadow included) — noise, since those rotate too often to be "news" and aren't what people travel/group up for. `isPostableRaidTier()` (`POSTABLE_RAID_TIERS` in `types.ts`, mirroring the existing `POSTABLE_EVENT_TYPES` pattern) now filters bosses to 5-star + mega **before both** the fingerprint diff and the message — so a lower-tier-only change no longer triggers a post or appears in one. If the filter ever matches nothing (e.g. a future tier-label drift, same trap as `TIER_ORDER`), the run skips and logs `raids_filtered_empty` rather than posting an empty rotation. Every rotation post now also links to `https://leekduck.com/raid-bosses/`, alongside the existing LeekDuck/ScrapedDuck attribution. **Known one-time side effect:** the persisted `raid_lineup_fingerprint` was computed over all tiers; the first poll after this shipped read as "changed" against the new tier-filtered fingerprint and reposted once even though the 5-star/mega lineup itself hadn't moved — accepted deliberately (documented in a `run.ts` comment) rather than hand-editing prod state. Individual raid-day/raid-hour/elite-raid event announcements are unaffected — this only touches the rotation message. | The PM asked to cut the noise and add a way to see the full boss list. Filtering before the fingerprint (not just before formatting) was the important call — filtering only the display would still have posted on every lower-tier rotation, defeating "only when changed" for the tiers anyone actually cares about. |


---

## Open questions

- **Messenger vs Discord:** If "Share to Messenger" creates too much friction post-launch, evaluate migrating to Discord (webhook-based auto-posting is trivial). Decide after 2–4 weeks of real usage.
- **Raid boss list maintenance:** Currently manual. Consider a lightweight admin edit screen only if it becomes a real burden.
- ~~**`pushStatus` drift between DB and live browser subscription:**~~ **Resolved 2026-06-15** (`fix/push-prompt-live-status`, see decisions log) — `PushSubscribePrompt` now checks the live browser subscription (`getPushStatus()`) on the device instead of the server `push_subscriptions` row, which survives a PWA uninstall and suppressed the prompt after a reinstall (no iOS notifications). The server-side row read was removed from `raids/page.tsx`.
- ~~**No staging environment — preview and prod share the same Supabase project**~~ **RESOLVED 2026-06-26** (report #2): preview now runs on a **separate** Supabase project (`pogosundet-preview`, EU), wired via Vercel **Preview-scoped** env-var overrides; prod is isolated (verified — a preview signup landed only in preview, prod stayed at 3 profiles). Caveats that remain: **Edge Functions + push webhooks are still wired to the prod project** (push delivery still needs a prod check), and the preview project needs an `avatars` Storage bucket added (only `raid-images` was created). Both are now tracked as a pickable TODO in **Next up** ("Duplicate the `notify-*` Edge Functions onto `pogosundet-preview`"), and they are what stop preview from being a full stand-in for prod under the preview-first rule (2026-08-09). Runbook: [`docs/plans/staging-supabase.md`](docs/plans/staging-supabase.md).
- ~~**Auth-gated e2e specs never run in CI**~~ **RESOLVED 2026-06-28** (PR #194, report #9): `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` uncommented in CI; all 17 auth-gated Playwright specs now run in CI against `pogosundet-preview`. "CI green" now covers logged-in flows as well as logged-out + unit tests.
- **GitHub Actions scheduled trigger for `pogo-feed.yml` is degrading, not just "5-15 min late."** Noticed 2026-08-29 while checking why a raid-rotation code change hadn't posted yet: the `*/20 * * * *` schedule ran roughly every 40-60 min on 2026-08-26, but by 2026-08-27–29 gaps had grown to 3-12 hours between runs — well past the workflow file's documented caveat. GitHub is known to deprioritise scheduled triggers on public repos under platform load; this looks like that getting worse over time rather than a one-off blip. Not urgent — the feed content itself is low-frequency (raids rotate roughly daily), so hour-scale delay is currently tolerable — but worth checking again if the bot starts feeling meaningfully stale. If it needs fixing, options are a paid Vercel plan (unlocks sub-daily Vercel Cron) or an external scheduler (e.g. a free-tier cron ping service) instead of GitHub Actions.

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

The cross-project version of this lives in `~/.claude/CLAUDE.md` under "Working style →
How to work with me" (narrate as you go, fix small / flag structural, record decisions as
they're made, write the state down when I'm out of time). It applies here too. This section
is only what's specific to PoGoSundet.

- I am a product manager who codes in his spare time, not a professional developer. Explain
  technical decisions briefly — but don't strip the reasoning out entirely, I want to follow it.
- Before making an architectural choice not covered here, **ask first**.
- If a task is ambiguous, **ask one clarifying question** before proceeding.
- At the end of each session, **update the Decisions Log** above with anything resolved.
- Keep responses practical. Prefer working code over lengthy explanation.
- **Deploys are a flag, not a silent fix** (see the preview-first rule above). Same for
  migrations, RLS, and anything touching the notify path.
- Danish community copy follows the register in `personal-projects/audience.md`, **not**
  `~/.claude/voice.md` — informal *du*, game terms left in English, emoji normal. voice.md's
  no-emoji rule is about my own posts and does not apply to in-app copy.
