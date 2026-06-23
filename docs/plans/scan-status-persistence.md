# Plan: persist desktop scan-session "added/skipped" status

## Goal
On the desktop player scan-session (`DesktopPlayers`), the "Tilføjet → næste" / "Spring over"
buttons currently only set in-memory React state — lost on refresh / navigation / other device.
Persist them **per-user, private to the owner**, and surface a subtle **"Allerede tilføjet"** hint on
player cards (and seed the scan-session queue) so the user can see who they've already handled.

Confirmed with PM: private to me only (no "X added you" to the other player); subtle hint on cards.

Note: "Tilføjet" only means the user tapped the button — Pokémon GO has no API, so it's a
self-reported "I've handled this person" marker.

## Data model — migration `021_friend_scan_status.sql`
```
friend_scan_status (
  user_id        uuid  -> auth.users(id)         -- the scanner (owner of the mark)
  target_user_id uuid  -> profiles.user_id        -- the player they marked
  status         text  check in ('added','skipped')
  updated_at     timestamptz default now()
  primary key (user_id, target_user_id)           -- one mark per (me, target); upsert target
)
RLS: SELECT/INSERT/UPDATE/DELETE only where auth.uid() = user_id  (private to owner).
```
Apply-before-merge (preview+prod share one DB; the page query + upsert reference the table).

## Files
- `supabase/migrations/021_friend_scan_status.sql` — table + RLS.
- `src/lib/players/scan-status.ts` — `ScanStatus` type, pure `buildScanStatusMap(rows)` (keyed by
  target_user_id), client `saveScanStatus(userId, targetUserId, status)` (best-effort upsert).
- `src/lib/players/scan-status.test.ts` — TDD for `buildScanStatusMap`.
- `src/app/[locale]/players/page.tsx` — fetch the user's rows (request-scoped server client, NOT cached)
  in the `Promise.all`; pass a `scanStatus` map to `PlayersScreen`.
- `src/components/PlayersScreen.tsx` — thread `scanStatus`: derive `addedUserIds` for the directory,
  pass the full map to seed `DesktopPlayers`.
- `src/components/PlayerDirectory.tsx` — accept `addedUserIds`, pass `added` to each `PlayerCard`.
- `src/components/PlayerCard.tsx` — subtle "Allerede tilføjet" line (UserCheck + teal) when added.
- `src/components/desktop/DesktopPlayers.tsx` — seed local `status` from the map (key by `user_id`,
  not `p.id`); persist each `mark()` via `saveScanStatus` (best-effort, non-blocking).
- `messages/da.json` + `en.json` — `PlayerDirectory.alreadyAdded`.
- `src/lib/changelog/entries.ts` — Danish entry.
- `e2e/scan-status.spec.ts` — env-gated (desktop): mark added → reload → check persisted + card hint.

## Verify
`tsc` + `eslint` + `build` + unit tests green. Visual check at lg+ (queue seed + card hint) via a
throwaway preview route; prod build authoritative for CSS. Apply migration 021 before merge.
