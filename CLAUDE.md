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

---

## Code architecture

### Supabase clients — three distinct files, never mix them
- `src/lib/supabase/client.ts` — browser-side (Client Components only)
- `src/lib/supabase/server.ts` — server-side (Server Components, Route Handlers)
- `src/lib/supabase/admin.ts` — service role key, privileged ops only (e.g. account deletion). Never import in client components.

### Vercel region — always `dub1`
Every server route and page component must export `export const preferredRegion = "dub1"` (Dublin). Supabase EU runs in AWS eu-west-1 (Ireland); the default US East region adds ~80ms per query. `proxy.ts` exports `regions: ["dub1"]`. Any new route handler or Server Component page that makes Supabase calls must include this export — it is not inherited automatically.

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
- `src/lib/profile/` — `validation.ts` (pure), `helpers.ts` (client Supabase), `server-helpers.ts` (server Supabase), `filters.ts` (player search/filter logic), each with a co-located `.test.ts`
- `src/lib/raids/` — `validation.ts` (pure), `helpers.ts` (client: createRaid, joinRaid, leaveRaid, updateAttendeeExtra), `server-helpers.ts` (getActiveRaids, getRecentRaids → `{active, expired}`, getRaidById), `message-helpers.ts` (client: sendMessage, getMessagesForRaid), `use-raids-realtime.ts` (client hook used by both `RaidList` and `RaidDetail`: subscribes to Supabase Realtime on raids/raid_attendees/raid_messages and calls `router.refresh()` on changes, debounced 250ms — server stays the source of truth for embedded joins), `bosses.ts` (quick-pick list), `pokemon.ts` (~600 Pokémon names for boss autocomplete). Note: `raid_attendees.user_id` and `raid_messages.user_id` both FK to `profiles.user_id` (unique), **not** `profiles.id` — required for embedded Supabase queries `profiles(trainer_name)`.
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

Current migrations: `001_create_profiles`, `002_create_raids`, `003_raid_chat`, `004_push_subscriptions`, `005_realtime`. Current Edge Functions: `notify-raid` (in `supabase/functions/`). All migrations applied.

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
| 2026-04-29 | Design tool: Claude Design (claude.ai/design) | Handoff bundles (gzip tar: README.md + HTML prototype + JSX) replace earlier Banani designs |
| 2026-04-29 | Chat added to Raid MVP | Claude Design handoff included per-raid chat; community needs it to replace Messenger |
| 2026-05-03 | PWA icon is placeholder SVG — replace before launch | Real branded PNG icons (192×192, 512×512) needed |
| 2026-05-03 | git user.email must be renraz@googlemail.com | Vercel blocks deployments from commits with unmatched email |
| 2026-05-07 | `useMounted` hook for client-only gating | React 19 `react-hooks/set-state-in-effect` fires on useState+useEffect mount pattern |
| 2026-05-07 | CI: lint → vitest → Playwright on every PR/push | Three GitHub Actions secrets drive the e2e dev server |
| 2026-05-11 | All server routes/pages export `preferredRegion = "dub1"` | Co-locating with Supabase EU (Ireland) dropped FCP from 6.6s → 1.2s |
| 2026-05-11 | `unstable_cache` uses admin client, not server client | Server client calls `cookies()` which is unavailable outside request context |
| 2026-05-11 | Page components parallelise independent Supabase queries with `Promise.all` | Queries are independent once `user.id` is known — serial execution was pure waste |
| 2026-05-11 | Realtime chat messages appended to local state, not `router.refresh()` | Per-message refresh caused full RSC page refetches |
| 2026-05-11 | `ref.current` writes go in `useEffect`, not during render | React 19 `react-hooks/refs` rule disallows synchronous ref writes during render |

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
