# Slice 14: "Last seen" badge on players

Started: 2026-05-22. Resolves the open question deferred on 2026-05-12.

## Scope
- Show when a player was last online on the player directory cards and the player detail page.
- Humanized Danish values: "I går", "For en uge siden", etc.
- Don't show the badge while the user is currently online (green dot already communicates this).
- Don't show if `last_seen_at` is null (new users, no data yet).

## Data model — migration `012_last_seen_at.sql`
```sql
ALTER TABLE public.profiles
  ADD COLUMN last_seen_at timestamptz;
-- Nullable, no default. Existing RLS UPDATE policy covers it automatically.
```

## Write path — `src/lib/profile/use-presence.ts`
When `status === 'SUBSCRIBED'` in the subscribe callback, fire a background update:
```ts
supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', userId)
```
Fire-and-forget (no await, no error handling needed — it's best-effort). This runs on every authenticated page load that uses presence, so it stays reasonably fresh without hammering the DB.

## New helper — `src/lib/profile/time.ts`
```ts
export function lastSeenRelative(
  lastSeenAt: string | null | undefined,
  now: Date
): string | null
```
Returns null for null input. Humanized Danish:
- < 2 min → `"Lige nu"` (shouldn't normally show since they'd be online, but guard it)
- < 1 hour → `"For {n} min. siden"`
- 1–2 hours → `"For en time siden"`
- 2–24 hours → `"For {n} timer siden"`
- 1–2 days → `"I går"`
- 2–7 days → `"For {n} dage siden"`
- 7–14 days → `"For en uge siden"`
- 14–30 days → `"For {n} uger siden"`
- 30–60 days → `"For en måned siden"`
- > 60 days → `"For længe siden"`

## New tests — `src/lib/profile/time.test.ts`
Cover each bucket, null input, and edge cases (exactly 1 day, exactly 7 days).

## Profile type — `src/lib/profile/helpers.ts`
Add `last_seen_at?: string | null` to the `Profile` interface.
`getAllProfiles` uses `select('*')` so it picks the column up automatically.

## Display — `src/components/PlayerCard.tsx`
Below the trainer name, add a small muted text when the user is **not** online and `last_seen_at` is non-null:
```tsx
{!online && profile.last_seen_at && (
  <span className="text-[11px] text-muted-foreground">
    {lastSeenRelative(profile.last_seen_at, new Date())}
  </span>
)}
```
`PlayerCard` already receives `online: boolean` as a prop.

## Display — `src/components/PlayerDetailDeck.tsx`
Add the same line in the stats/info area of the profile deck. The component receives the full profile object and the `onlineIds` set. Show when `!onlineIds.has(profile.user_id) && profile.last_seen_at`.

## Translations — `messages/da.json` + `messages/en.json`
No translation keys needed — the time strings are computed in `lastSeenRelative()` and returned as pre-formatted Danish strings directly, following the same pattern as `daySeparator` / `relTime` in `src/lib/chat/time.ts`. The English file gets the same function returning English equivalents (keep in the same file, switch on locale parameter or just use Danish for now since the app is Danish-first and the English stub isn't shown to users).

## Files
New:
- `supabase/migrations/012_last_seen_at.sql`
- `src/lib/profile/time.ts`
- `src/lib/profile/time.test.ts`

Modified:
- `src/lib/profile/helpers.ts` — `last_seen_at` on `Profile`
- `src/lib/profile/use-presence.ts` — update `last_seen_at` on subscribe
- `src/components/PlayerCard.tsx` — show badge
- `src/components/PlayerDetailDeck.tsx` — show badge

## Verification
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test` (new time.test.ts must pass)
- Do NOT run `npm run test:e2e` or `npm run build`
