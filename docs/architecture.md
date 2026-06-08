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
- `server-helpers.ts` — `getActiveRaids`, `getRecentRaids(userId)` (returns `{ active, expired }`; also computes each raid's `unread_count` — joined raids only — purely in JS from the embedded `raid_messages` + one batch `raid_reads` query, no per-raid round trips), `markRaidRead`, `getRaidById`
- `message-helpers.ts` — client: `sendMessage`, `getMessagesForRaid`
- `use-raids-realtime.ts` (client hook) — used by both `RaidList` and `RaidDetail`. Subscribes to Supabase Realtime on `raids` / `raid_attendees` / `raid_messages` and calls `router.refresh()` on changes, debounced 250ms — server stays the source of truth for embedded joins
- `use-raid-unread.ts` (client hook, issue #104) — Raids-tab badge subscriber, mirrors `use-dm-unread.ts`. Mount-fetches the true total scoped to JOINED raids (`raid_attendees` + `raid_reads`), then increments live off a single global `raid_messages` INSERT subscription — Realtime can't filter "raid_id IN (raids I've joined)" server-side, so membership per `raid_id` is resolved lazily on first sighting and cached
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

### `src/lib/dm/`
1:1 direct messages (Slice 17). Mirrors `src/lib/chat/` structurally; only the data layer differs.
- `helpers.ts` — client: `sendMessage`
- `server-helpers.ts` — fetch a conversation + the DM list for `/chat`
- `pair-key.ts` + `pair-key.test.ts` — `pairKey(a,b)` is the canonical sorted 2-user identifier (`pairKey(a,b) === pairKey(b,a)`), so both ends share one channel. `dmTypingTopic(a,b)` = `dm-typing:${pairKey(a,b)}` is a **stable broadcast-only** topic, separate from the random-suffixed message channel (broadcast needs a shared deterministic topic; the `Math.random()` rule applies only to postgres_changes)
- `read-helpers.ts` — `getUnreadCountsForUser` (server-only) + mark-read
- `reactions-helpers.ts` + `reactions-helpers.test.ts`
- `use-dm-realtime.ts` — one conversation's messages (postgres_changes, topic suffixed `Math.random()`) + typing (broadcast on `dmTypingTopic`)
- `use-dm-list-realtime.ts` — accumulates `unreadByPartner` (count++ per INSERT) for the `/chat` DM rows
- `use-dm-list-typing.ts` — per-partner typing previews on `/chat`
- `use-dm-reactions-realtime.ts` — INSERT/DELETE filtered client-side by live message-id set
- `use-dm-unread.ts` — BottomNav DM badge; mount-fetches the real per-partner total over RLS (client-side replica of `read-helpers.getUnreadCountsForUser`) then increments on live INSERTs

**Single-column realtime filter:** PostgREST realtime filters one column, so we filter `recipient_id=eq.{me}` server-side and apply the sender filter client-side.

### `src/lib/push/`
- `subscription-helpers.ts` — `getPushStatus`, `subscribeToPush`, `unsubscribeFromPush` (browser Push API + Supabase upsert)

### `src/lib/account/`
- `server-helpers.ts` — account deletion using admin client (service role key). The `profiles` row cascades automatically from the auth user delete.

### `src/i18n/`
- `routing.ts` and `request.ts` — next-intl config (locales, default locale `da`, `localePrefix: 'as-needed'`). Imported by `proxy.ts` and the App Router locale layout.

### `src/lib/hooks/`
- `use-mounted.ts` — `useSyncExternalStore`-based mount detector. Use instead of useState+useEffect for client-only gating (localStorage, navigator, matchMedia) — React 19's `react-hooks/set-state-in-effect` lint rule fires on the canonical did-mount pattern.

## Shared chat component stack (`src/components/chat/`)
The biggest cross-cutting pattern: **three different chat surfaces render through the same components.** `ChannelScreen` (community channels), `RaidDetail` (per-raid chat, in `src/components/`), and `DMScreen` (1:1 DMs) all feed the same `MessageGroup` / `Composer` / `MessageActionSheet` / `Reactions` / `ReplyQuote` components.

They unify on the `ChatMessage` type in `src/lib/chat/types.ts` (extracted there to avoid a circular import). Each surface maps its own row shape onto `ChatMessage` at the data boundary:
- channel: native fields
- raid: `raid_messages.message → body`
- DM: `sender_id → author_id`

So a change to message rendering, the action sheet, reactions, or replies lands in all three at once — and a new chat-like surface should reuse this stack rather than rebuild it. The data layers (`src/lib/chat/`, `src/lib/raids/`, `src/lib/dm/`) stay separate per surface; only the presentation components are shared.

## Tests
Vitest + jsdom + `@testing-library/jest-dom`. Setup file at `src/test/setup.ts`. `@` alias maps to `src/`.
