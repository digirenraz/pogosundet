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
| Typecheck (manual) | `npx tsc --noEmit` |
| Deploy Edge Function | `npx supabase functions deploy notify-raid` |

No `npm` typecheck script — `npm run build` is the canonical type gate (Next.js fails the build on TS errors). Use `npx tsc --noEmit` for a fast standalone check without a full build.

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

Current migrations: `001_create_profiles`, `002_create_raids`, `003_raid_chat`, `004_push_subscriptions`, `005_realtime`, `006_profile_team_level`, `007_perf_indexes`, `008_channel_messages`, `009_channel_reads`, `010_chat_reactions_and_replies`, `011_friend_code_constraint`, `012_last_seen_at`, `013_raid_chat_reactions_and_replies`, `014_direct_messages`. Current Edge Functions: `notify-raid` (in `supabase/functions/`). All migrations applied.

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
- **Direct messages** (Slice 17, 2026-05-23): 1:1 DMs between any two profiles. New route `/chat/dm/[partnerId]`, DM section on `/chat`, entry points from the `OnlineStrip` avatars + `MembersSheet` rows, reuse of the channel-chat reactions + replies stack. Migration 014.

Nothing currently in flight as of 2026-05-23. Next slice not yet picked.

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

The 6-step debugging runbook lives in [`docs/launch-checklist.md`](docs/launch-checklist.md). Go there first if push regresses.

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

## Next up

Pickable TODOs, in no particular order. Promote one to a branch and start a slice when picked.

- **Slice 17 (DMs) — two post-merge prod spot-checks still outstanding.** PR #52 merged 2026-05-25 with check #3 (Privacy §13 Danish proofread) done and check #1 reviewed statically (migration 014 RLS policies are sound). These two were never run live and DMs are now in prod, so they're prod validations, not pre-merge gates: (1) **RLS live** — in the Supabase SQL editor as a third-party account, `select * from direct_messages where sender_id = ... or recipient_id = ...` for a conversation you're not part of must return 0 rows; same check on `direct_message_reactions` via its `EXISTS` policy. (2) **Cross-user realtime on prod** — two browsers/accounts, send + react + reply, confirm propagation within ~1s.
- **Use `avatar_url` everywhere in the app** — profile pictures are uploadable but only shown in a few places. Audit all surfaces that display a player's identity (player card, player detail, chat message bubbles, raid attendee list, raid chat, BottomNav profile link, etc.) and render `avatar_url` with the existing `<Avatar>` component where it makes sense.
- **Investigate account deletion issues** — user noticed problems with account deletion during the 2026-05-22 session but didn't have time to look into it. Reproduce and fix before launch.
- **Define push notification triggers** — currently only new raid posts trigger a push. Decide which other events should notify users (someone joins your raid, reply to a raid you're attending, new chat message in a channel, DM when implemented). Avoid notification fatigue.

---

## Decisions log

Update this section at the end of each session. Entries older than ~4 weeks live in [`docs/decisions-archive.md`](docs/decisions-archive.md).

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-05-19 | Supabase Realtime cross-user delivery is unreliable in `npm run dev` / Turbopack — verify on the Vercel preview instead | Burned hours debugging slice 12's badge "not firing" against a second account locally. Worked fine on prod. Future Realtime features: don't chase missing INSERT events locally if the code looks correct — push to preview and verify there. Single-user / own-optimistic paths DO work locally. |
| 2026-05-22 | Migration 011: DB-level CHECK constraint on `profiles.friend_code` enforcing `^\d{4} \d{4} \d{4}$` | App-layer validation already enforces this, but a direct DB insert could bypass it. The constraint makes the format impossible to violate at the storage layer. |
| 2026-05-22 | Slice 13: emoji reactions + threaded replies on community channel chat. Migration 010 adds `channel_messages.reply_to_id` and `channel_message_reactions` | Tap bubble → action sheet (6 quick-reactions + Svar + Kopiér). Optimistic local apply, realtime reconciles. Reactions realtime uses a separate hook on INSERT/DELETE filtered client-side by the live `messageIdSet` (no `channel` FK on the reactions table). |
| 2026-05-22 | Slice 14: "last seen" badge. Migration 012 adds `profiles.last_seen_at` | Write in `use-presence.ts` is a plain `useEffect` (must NOT be inside the Realtime SUBSCRIBED callback — silently fails on mobile PWAs). `lastSeenRelative()` in `src/lib/profile/time.ts` returns Danish strings across 10 buckets. Badge only when offline + non-null. `getAllProfiles()` (60s cache) returns stale `last_seen_at`; pages do a parallel uncached select and merge fresh values. |
| 2026-05-22 | Slice 15: PoGo screenshot avatar upload. Supabase Storage bucket `avatars`. `src/lib/profile/avatar-helpers.ts` uploads to `{userId}/avatar.png` (upsert) | `AvatarUploadSheet` lets the user drag + pinch-to-zoom inside a 280px circle before cropping. Auto-crop at fixed coordinates failed (PoGo positions the avatar differently across devices). `maxWidth: 'none'` required on the img to prevent global CSS distorting it during zoom. |
| 2026-05-22 | PWA `start_url` → `/players`; level field uses `<input type="text" inputMode="numeric" maxLength={2}>` (not `type="number"`); current user excluded from directory; team filter chips show team colour at 55% opacity when inactive | Players is the primary landing screen. `type="number"` ignores `maxLength` in all browsers. Self in directory is confusing. All-grey team chips were indistinguishable. |
| 2026-05-22 | iOS OAuth: keep `createClient()` (SSR, cookies) on login page + simple route handler (`exchangeCodeForSession` + redirect) | A `createOAuthClient` (plain `@supabase/supabase-js`, localStorage) variant was introduced to dodge iOS ITP purging the PKCE verifier cookie — but the server route reads cookies, so they never matched and prod login broke. iOS Safari OAuth on preview deploys remains broken due to ITP; prod works. Do not reintroduce the localStorage client. |
| 2026-05-23 | Slice 16: raid chat reactions + replies. Migration 013 adds `raid_messages.reply_to_id` and `raid_message_reactions`. `RaidDetail` chat section refactored to use the shared `MessageGroupView` / `Composer` / `MessageActionSheet` stack from channel chat. SW bumped v7→v8 | Reaches feature parity with Slice 13 (channel chat). `ChatMessage` extracted to `src/lib/chat/types.ts` so both `ChannelScreen` and `RaidDetail` feed the same components without a circular import. `raid_messages.message` column kept (not renamed to `body`) — the adapter in `RaidDetail.toChatMessage()` maps `message → body` at the boundary. New helpers: `src/lib/raids/reactions-helpers.ts` + `use-raid-reactions-realtime.ts` (topic suffixed with `Math.random()` per the 2026-05-19 collision rule). Raid chat keeps the existing local-state-driven message INSERT path via `useRaidsRealtime`; reactions live in a parallel hook. Realtime INSERTs don't carry the joined profile shape so avatar/team/level stay null until the next `router.refresh` — acceptable trade-off. |
| 2026-05-23 | Slice 17: 1:1 direct messages (built early at user's explicit request despite the Phase 2 designation). Migration 014 adds `direct_messages`, `direct_message_reactions`, `dm_reads`. New route `/chat/dm/[partnerId]`; new section on `/chat`; entry points from `OnlineStrip` avatars + `MembersSheet` rows. SW bumped v8→v9. Privacy Policy s13 added. Push notifications for new DMs explicitly out of scope — owned by the "Define push notification triggers" TODO. | RLS pattern: `direct_messages` policies use `auth.uid() IN (sender_id, recipient_id)`; `direct_message_reactions` SELECT/INSERT use an `EXISTS` subquery against the parent message so reactions are participants-only without a denormalised conversation column. Realtime topics use `dm:${pairKey(a,b)}:${Math.random()...}` where `pairKey(a,b) === pairKey(b,a)` is the canonical 2-user identifier — sorted-join so both ends share one channel. PostgREST realtime filters are single-column, so we filter `recipient_id=eq.{me}` server-side and apply the sender filter client-side. DM page mirrors channel chat structurally — reuses `MessageGroupView` / `Composer` / `MessageActionSheet`; only the data layer (`src/lib/dm/`) differs. Shared `ChatMessage` type works for DMs by mapping `sender_id → author_id` at the boundary (no parallel `DMMessage` type). `direct_messages.body` (not `message` like raid chat). DM page guards `partnerId !== currentUserId` and 404s otherwise. Account deletion cascades all DMs the user has sent or received plus their reactions plus their `dm_reads`. |
| 2026-05-25 | Slice 17 PR #52 merged to `main`. Privacy Policy proofread: §13 rewritten for tone consistency with §11/§12 (active voice, plain Danish replacing "Row Level Security", dropped redundant Supabase/EU mention since §7 owns it); §7 verb `handler` → `fungerer`. | Merged with verification check #3 done and #1 reviewed statically (RLS policies sound — third party gets 0 rows). Live RLS test and cross-user realtime were not run pre-merge; re-filed as post-merge prod spot-checks in Next up. No `lastUpdated` bump — wording-only, no new data field/service/retention change. |
| 2026-05-25 | DM typing indicator fix + chat-list parity (`fix/dm-typing-indicator`). DM typing was coded but never propagated: `useDMRealtime` broadcast typing on `dm:${pairKey}:${Math.random()}` — but Supabase **broadcast** only reaches clients on the *identical* topic string, so the two participants were on different topics. Split typing onto a stable broadcast-only topic `dmTypingTopic(a,b)` = `dm-typing:${pairKey(a,b)}` (new helper in `pair-key.ts`), separate from the random-suffixed message channel. Added `use-dm-list-typing.ts` (per-partner broadcast subscriptions, stable sorted-key effect) and wired `ChannelListScreen` so `/chat` DM rows show "skriver…" like channel rows (was hardcoded `typing={false}`). | The `Math.random()` collision rule applies to **postgres_changes** (replication-based, topic-name-agnostic — why messages worked anyway), NOT broadcast. Broadcast needs a shared, deterministic topic. Keeping it broadcast-only means it carries no postgres_changes callbacks and stays immune to the collision error even if double-mounted. Cross-user typing remains a Vercel-preview check (2026-05-19 rule) — not verifiable in `npm run dev`. No DB/migration/SW change. |
| 2026-05-25 | Fix DM list-row unread badge stuck at 1 (`fix/dm-unread-count`). The `/chat` DM row badge incremented by exactly 1 no matter how many messages arrived, while the BottomNav badge (`useDMUnread`, `setTotal(t=>t+1)` per INSERT) climbed correctly. | Root cause: `ChannelListScreen.liveDmEntries` computed `unread: baseUnread + 1` where `baseUnread` is the static SSR count and `latestByPartner` only holds the *newest* message (no count) — so it always resolved to `serverInitial + 1`. Fix: `useDMListRealtime` now accumulates `unreadByPartner` (count++ per INSERT, mirroring `useDMUnread`); the row uses `baseUnread + liveUnread`. `incomingNewer` retained only for the preview-text choice. Now the per-row badge and the BottomNav total track together. No DB/migration/SW change. |
| 2026-05-25 | Fix BottomNav DM badge clearing prematurely on navigation (`fix/dm-badge-clears`). Leaving `/chat` cleared the unread badge even though the DM was never opened. | `BottomNav` is rendered per-page (not a shared layout), so it remounts on every navigation. `useChannelUnread` re-fetches counts from the DB on mount; `useDMUnread` didn't — it started at `initialTotal=0` and only counted live INSERTs, so each remount reset DM unread to 0. Fix: `useDMUnread` now mount-fetches the real per-partner unread total over RLS (client-side replica of the server-only `getUnreadCountsForUser` in `read-helpers.ts`), seeds `perPartnerRef` + `total`, then live INSERTs increment on top. Only BottomNav consumes the hook. No DB/migration/SW change. |

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
