# "Show in maps" with real coordinates (Next-up item, PM-picked 2026-06-11)

**Branch:** `slice/show-in-maps-coordinates`

## Current state ("partially implemented")

`RaidDetail` already has a "Vis på kort" button (`detail.showOnMap`, meta bar) whose
`handleOpenMap()` opens a Google Maps **text search** for
`"<gym_name> Frederikssund Danmark"` — a guess that can land on the wrong place or
nothing. The `gyms` table now has exact lat/lng for 152 seeded gyms.

## Scope

Make the existing detail-screen button open the gym's **exact coordinates** when the
gym is in the `gyms` table with lat/lng; keep the name search as the fallback for
gyms without coordinates (auto-learned name-only rows) or not in the table at all.

Deliberately NOT adding a separate maps button to the overview `RaidCard` rows — the
card's tap target opens the detail (one tap from the button), and nested interactive
elements inside the card complicate the tap/swipe surface. Trivial follow-up if the
PM wants it.

## Files

1. **`src/lib/gyms/maps.ts`** — pure `buildMapsUrl(gymName, location)` (TDD first in
   `maps.test.ts`):
   - `location` (`{ lat, lng }`) → `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`
   - `null` → `https://www.google.com/maps/search/?api=1&query=` + URL-encoded
     `"<gymName> Frederikssund Danmark"` (the current fallback behaviour, moved to the
     documented `api=1` URL form — this universal URL opens the native Google Maps app
     when installed on Android/iOS and the browser otherwise).
   Tests: coordinate URL, fallback URL + encoding of spaces/special chars (e.g. a
   name containing `'` and `æøå`), lat/lng formatting.
2. **`src/lib/gyms/server-helpers.ts`** — new server-side
   `getGymLocation(name): Promise<{ lat, lng } | null>`: server Supabase client,
   `from('gyms').select('lat,lng')` matched case-insensitively via `.ilike()` with
   `%`/`_`/`\` escaped in the name (ilike without wildcards = case-insensitive
   equality, mirroring the `lower(name)` unique index), `.maybeSingle()`. Returns
   null when no row OR lat/lng is null. (The existing `src/lib/gyms/helpers.ts` is
   client-side — don't mix; mirror the raids `server-helpers.ts` naming.)
3. **`src/app/[locale]/raids/[id]/page.tsx`** — after the existing `Promise.all`,
   `const gymLocation = raid?.gym_name ? await getGymLocation(raid.gym_name) : null;`
   (sequential because it depends on the raid row; one indexed query in dub1).
   Pass `gymLocation` to `<RaidDetail>`.
4. **`src/components/RaidDetail.tsx`** — new prop `gymLocation: { lat: number; lng: number } | null`;
   `handleOpenMap()` becomes `window.open(buildMapsUrl(raid.gym_name, gymLocation))`.
5. **`src/lib/changelog/entries.ts`** — prepend (2026-06-11):
   `"Vis på kort"-knappen på et raid åbner nu gym'ens præcise placering — før søgte den kun efter navnet.`
6. **CLAUDE.md** — decisions-log entry; remove the "Show in maps" item from Next up
   (handled by the main session, not the implementation agent).

## Not needed

- No migration, no new i18n keys (`detail.showOnMap` exists), no SW change.
- No GDPR surface: we open a URL; no geolocation is requested or stored.
- No e2e: the button opens an external window (hard to assert without flake) and the
  URL construction is fully unit-tested; the wiring is a one-line handler.

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`. Prod spot-check
(PM): open a raid at a seeded gym → "Vis på kort" should drop a pin on the exact gym;
a raid with a made-up gym name should still open the old name search.
