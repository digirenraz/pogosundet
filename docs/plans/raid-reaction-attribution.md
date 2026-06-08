# Raid reaction attribution (GitHub issue #95)

**Goal:** "Show what user added which reaction to a raid." Increase engagement by
letting people see *who* reacted to a raid and *how* (TfR! / shiny / hundo).

## Context
Raid-level reactions (migration 015, `raid_reactions`) already store
`(raid_id, user_id, reaction)`. `RaidDetail` renders tappable buttons with a
count; `RaidCard` shows a read-only count summary. The grouped state
(`raidReactions: { tfr: user_id[], shiny: [...], hundo: [...] }`) already holds
the per-reaction user_ids and updates live via `useRaidReactionRealtime`.
What's missing is surfacing the names.

Constraint: `raid_reactions.user_id` FKs `auth.users`, not `profiles`, so we
can't PostgREST-embed `profiles(trainer_name)` on it (and realtime payloads
carry only row columns anyway). So resolve names client-side from a profile map.

## Approach (no migration, no new deps)
1. **`raids/[id]/page.tsx`** — add `getAllProfiles()` (already cached, admin
   client) to the existing `Promise.all`, build `profileNames: Record<user_id,
   trainer_name>`, pass to `RaidDetail`. Covers attendees, non-attendee
   reactors, and realtime-added reactors (every user has a profile — middleware
   guard).
2. **`raid-reaction-helpers.ts`** — add pure `reactorName(userId, currentUserId,
   profileNames, youLabel, unknownLabel)`; unit-test it (+ existing
   `groupRaidReactions`) in a new `raid-reaction-helpers.test.ts`.
3. **`RaidDetail.tsx`** — accept `profileNames` prop; under the reaction buttons,
   render a "who reacted" breakdown: one row per non-empty reaction (label +
   each reactor as an initials chip + name, mirroring the existing attendees
   list style). Current user shows as "Dig". Updates live (reuses the existing
   `raidReactions` state).
4. **i18n** (`messages/da.json` + `messages/en.json`, `Raids` namespace) —
   `reactionYou` ("Dig"/"You"), `reactionUnknownUser` ("En træner"/"A trainer").

Keep the buttons (with counts) as-is; the breakdown is additive below them.

## Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run test` (new helper tests + existing
  152 green), `npm run build`.
- Authenticated realtime screen → flag a prod/preview spot-check (cross-user
  realtime per the 2026-05-19 rule; RaidDetail double-mounts in dev).
