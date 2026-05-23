# Architecture details

Lives outside `CLAUDE.md` so the session-loaded file stays scannable. Pointed to from `CLAUDE.md` → Code architecture.

This file documents the contents of `src/lib/` in detail. Update it when a new helper file is added or an existing one significantly changes responsibility.

---

## `src/lib/` walkthrough

### `src/lib/profile/`
- `validation.ts` (pure) — `validateProfile()`, friend code format enforcement
- `helpers.ts` — client Supabase helpers
- `server-helpers.ts` — server Supabase helpers; `getAllProfiles()` uses `unstable_cache` (60s, tag `profiles`) and **must use the admin client** (server client calls `cookies()` which is unavailable inside `unstable_cache`)
- `filters.ts` — player search + filter logic for the directory
- `use-presence.ts` (client hook) — subscribes to the `players-online` Supabase Realtime presence channel, returns a `Set<user_id>`. Also fires a plain-`useEffect` best-effort `profiles.update({ last_seen_at })` (must NOT live inside the SUBSCRIBED callback — that path silently fails on mobile PWAs)
- `avatar-helpers.ts` — uploads to Supabase Storage bucket `avatars`, key `{userId}/avatar.png` (upsert)
- `time.ts` — `lastSeenRelative()` returns humanized Danish strings across 10 buckets
- Tests co-located as `.test.ts`

### `src/lib/raids/`
- `validation.ts` (pure)
- `helpers.ts` — client: `createRaid`, `joinRaid`, `leaveRaid`, `updateAttendeeExtra`
- `server-helpers.ts` — `getActiveRaids`, `getRecentRaids` (returns `{ active, expired }`), `getRaidById`
- `message-helpers.ts` — client: `sendMessage`, `getMessagesForRaid`
- `use-raids-realtime.ts` (client hook) — used by both `RaidList` and `RaidDetail`. Subscribes to Supabase Realtime on `raids` / `raid_attendees` / `raid_messages` and calls `router.refresh()` on changes, debounced 250ms — server stays the source of truth for embedded joins
- `bosses.ts` — quick-pick boss list
- `pokemon.ts` — ~600 Pokémon names for boss autocomplete

**FK gotcha:** `raid_attendees.user_id` and `raid_messages.user_id` both FK to `profiles.user_id` (unique), **not** `profiles.id`. Required for embedded Supabase queries `profiles(trainer_name)` to work.

### `src/lib/chat/`
- `channels.ts` — hard-coded channel set: `#generelt`, `#app-feedback`. Adding a third channel requires both a constant edit and a migration to extend the DB CHECK
- `helpers.ts` — client: `sendMessage`
- `server-helpers.ts` — `getMessagesForChannel`
- `read-helpers.ts` — mark-as-read UPSERT, unread counts
- `time.ts` + `time.test.ts` — relative-time formatter
- `use-channel-realtime.ts` — per-channel messages + typing broadcast
- `use-channel-unread.ts` — BottomNav badge subscriber across both channels
- `use-channel-list-typing.ts` — channel-list "X skriver…" preview
- `use-channel-reactions-realtime.ts` — INSERT/DELETE on `channel_message_reactions`; filters client-side by live `messageIdSet`

**Realtime topic-name collision:** when two components mount a Supabase Realtime hook on the same page (e.g. `BottomNav` + `ChannelListScreen`), they collide on a shared channel name and the second instance throws `cannot add postgres_changes callbacks after subscribe()`. Suffix each per-mount topic with `Math.random()` to disambiguate. `useId()` does NOT work — its `:r0:`-style ids break Supabase's colon-delimited topic parsing.

### `src/lib/push/`
- `subscription-helpers.ts` — `getPushStatus`, `subscribeToPush`, `unsubscribeFromPush` (browser Push API + Supabase upsert)

### `src/lib/account/`
- `server-helpers.ts` — account deletion using admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### `src/i18n/`
- `routing.ts` and `request.ts` — next-intl config (locales, default locale `da`, `localePrefix: 'as-needed'`). Imported by `proxy.ts` and the App Router locale layout.

### `src/lib/hooks/`
- `use-mounted.ts` — `useSyncExternalStore`-based mount detector. Use instead of useState+useEffect for client-only gating (localStorage, navigator, matchMedia) — React 19's `react-hooks/set-state-in-effect` lint rule fires on the canonical did-mount pattern.

### Tests
Vitest + jsdom + `@testing-library/jest-dom`. Setup file at `src/test/setup.ts`. `@` alias maps to `src/`.
