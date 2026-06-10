# Perf: navigation latency + perceived responsiveness

**Branch:** `perf/nav-latency-and-feedback`
**Symptoms (PM report):** app feels laggy on cold open after being closed a while; navigation sometimes feels like it isn't reacting.

## Diagnosis

Per-navigation hot path today:

1. **Middleware (`src/lib/supabase/middleware.ts`) runs TWO sequential network round trips on every request**: `supabase.auth.getUser()` (kept deliberately — it refreshes expired tokens) **plus** a `profiles` existence query for the profile-setup guard. The profile query result almost never changes (a profile is created once at setup and only removed by account deletion, which also signs the user out) — yet we pay for it on every single navigation, including every RSC prefetch.
2. **Four authenticated routes have no `loading.tsx`** — `players/[id]`, `chat/dm/[partnerId]`, `raids/new`, `profile/edit`. Tapping into them renders nothing until the full server response arrives. All four tab roots already have skeletons; these spokes don't.
3. **Nav tabs give no in-flight feedback.** When the client Router Cache is cold (exactly the "app idle for a while" case), tapping a BottomNav/sidebar tab does nothing visible until the RSC payload streams in. Next 16 ships `useLinkStatus` for precisely this.
4. Minor: `getDMConversations` (`src/lib/dm/server-helpers.ts`) awaits partner profiles and `dm_reads` sequentially though they're independent.

Deliberately NOT changed:
- `getUser()` in middleware (refreshes expired sessions; documented prior decision; auth hot path has burned us before).
- SW network-first navigations (fixes the post-deploy ChunkLoadError; correctness > cold-open speed).
- `getRecentRaids` embedded `raid_messages` payload (fine at community scale; noted as a future watch item).
- `InitialSplash` 1600ms minimum (design decision).

## Changes

### 1. Cookie-cache the middleware profile guard
`src/lib/supabase/middleware.ts`:
- New cookie `pogo-profile-ok` whose **value is the user id** (not `"1"`), so an account switch automatically invalidates it.
- In `updateSession`, when `user` is set and the path isn't skiplisted: if `request.cookies.get('pogo-profile-ok')?.value === user.id`, **skip the `profiles` query entirely**. Otherwise run the existing query; on success set the cookie on the response (`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `maxAge` 30 days); on missing profile keep the existing redirect to `/profile/setup` (no cookie set).
- Safety: deleted account → user is signed out → guard skipped (stale cookie harmless; a different re-registered user id won't match). Fresh setup → first nav after setup queries once, then sets the cookie.
- `src/proxy.ts` already copies all response cookies onto the intl response — no change needed there.

### 2. Add the four missing `loading.tsx` skeletons
Mirror the sibling skeletons' style (`raids/loading.tsx`, `chat/[channelId]/loading.tsx`) and each page's chrome (fixed header heights, padding, BottomNav where the page shows it):
- `src/app/[locale]/players/[id]/loading.tsx`
- `src/app/[locale]/chat/dm/[partnerId]/loading.tsx`
- `src/app/[locale]/raids/new/loading.tsx`
- `src/app/[locale]/profile/edit/loading.tsx`

### 3. Instant tap feedback on nav tabs
`src/components/BottomNav.tsx` + `src/components/desktop/DesktopSidebar.tsx`:
- Inner component using `useLinkStatus()` from `next/link` (must render *inside* the `<Link>`): while `pending`, style the target tab as active-ish (`text-primary`) and pulse the icon (`animate-pulse`). Tap → immediate visual response even when the route fetch is slow.

### 4. Parallelise independent queries in `getDMConversations`
`src/lib/dm/server-helpers.ts`: run the partner-profiles and `dm_reads` queries in one `Promise.all`.

## Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` all green.
- Browser check via Playwright: log in, navigate all four tabs + a player detail; confirm middleware change doesn't break the setup redirect (new-user path can't be safely tested against the shared prod DB — verified by code review + the existing env-gated e2e suite).
- Loading states are transient → no new e2e spec (consistent with existing skeletons, which have none).
