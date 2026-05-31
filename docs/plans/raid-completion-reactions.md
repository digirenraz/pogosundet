# Raid completion, 2-week ended window, and raid reactions

Three related changes to the raid feature, decided with the PM 2026-05-31.

## 1. Keep ended raids in the list for 2 weeks (still greyed)

Today: `getRecentRaids` fetches `created_at >= 2 hours ago` and splits into
`active` (within 45 min of start) and `expired` (older). So ended raids vanish
after ~2h.

Change: in `src/lib/raids/server-helpers.ts`, widen `getRecentRaids`'s window
`2 hours → 14 days`. Active/expired split and the greyed "Sluttede raids"
section stay exactly as they are. `getActiveRaids` window unchanged (it only
returns active).

## 2. Poster can mark a raid completed → moves to ended early + "Gennemført" badge

- **DB** (migration 015): `ALTER TABLE raids ADD COLUMN completed_at timestamptz;`
  plus a new **owner-only UPDATE policy** (raids has none today — only
  select/insert/delete).
- **`isActive(raid)`** also returns false when `completed_at` is set → a completed
  raid always lands in the `expired` (greyed) bucket, even if <45 min old.
- **Mutation** `toggleRaidCompleted(raidId, completed)` in `helpers.ts` — sets
  `completed_at = now()` or `null` (toggle so a mis-tap is recoverable). RLS
  enforces owner.
- **UI**: on `RaidDetail`, poster-only button "Marker som gennemført" ⇄
  "Gennemført ✓". A "Gennemført" badge shows on both `RaidCard` and `RaidDetail`
  when set. (Greyed styling already comes from the `expired` bucket.)

## 3. Raid reactions: "TfR!", "I got a shiny!", "I got a hundo!"

Reactions to the **raid itself** (not a chat message), so a new table.

- **DB** (migration 015): `raid_reactions(raid_id, user_id, reaction, created_at,
  PRIMARY KEY(raid_id,user_id,reaction))`, `reaction` CHECK in
  `('tfr','shiny','hundo')` (stable codes; labels live in i18n). RLS mirrors
  `raid_message_reactions`: read-all, insert-own, delete-own. Added to
  `supabase_realtime` publication. PK's leading `raid_id` indexes the count reads.
- **Helpers** `src/lib/raids/raid-reaction-helpers.ts`: `REACTION_CODES`,
  `groupRaidReactions(rows) → { tfr:[], shiny:[], hundo:[] }` (user_ids per code,
  for counts + "did I react"), `toggleRaidReaction(raidId, userId, code, isOn)`.
- **Realtime** `use-raid-reaction-realtime.ts`: subscribe to `raid_reactions`
  INSERT/DELETE filtered `raid_id=eq.{id}`, topic suffixed with `Math.random()`
  (per the collision rule). Mirrors the message-reaction hook but on raid level.
- **UI**:
  - `RaidDetail`: three tappable buttons with counts; optimistic toggle + realtime
    reconcile. Available any time, including on ended/completed raids (the point of
    the 2-week window — post-raid "TfR").
  - `RaidCard`: read-only count summary (e.g. `TfR! 3  ✨ 2  💯 1`), shown only
    when there are reactions. No toggle on the card.
  - Anyone who can see the raid can react; the 3 codes toggle independently.

## Data plumbing
- `LIST_SELECT` and the single-raid select gain `completed_at` and
  `raid_reactions(user_id, reaction)`.
- Types: `RaidWithAttendees` / `RaidWithDetails` gain
  `completed_at: string | null` and `raid_reactions: { user_id; reaction }[]`.
- `messages/da.json`: `Raids.completed` = "Gennemført",
  `Raids.markCompleted` = "Marker som gennemført",
  `Raids.reactionTfr/Shiny/Hundo` = "TfR!" / "I got a shiny!" / "I got a hundo!".

## Files (~9 + migration)
`supabase/migrations/015_raid_completion_and_reactions.sql` (new),
`src/lib/raids/server-helpers.ts`, `src/lib/raids/helpers.ts`,
`src/lib/raids/raid-reaction-helpers.ts` (new),
`src/lib/raids/use-raid-reaction-realtime.ts` (new),
`src/components/RaidCard.tsx`, `src/components/RaidDetail.tsx`,
`messages/da.json` (+ `messages/en.json` stub), and the new-raid/detail/page
type flow as needed.

## Application + verification
- **Migration is manual** — paste `015_*.sql` into the Supabase SQL editor (no
  runner). The feature is inert until it's applied; flag this to the PM.
- `tsc` + `eslint` + `next build` green.
- Local (once migration applied + logged in): mark-completed moves a raid to the
  greyed section; tapping a reaction shows the count; card summary renders.
- Cross-user reaction realtime → verify on prod, not `npm run dev` (2026-05-19
  rule). The 2-week window needs ended raids in the data to see.
