# Nearby-gym suggestions + recent gyms in the raid form (Next-up item, PM-picked 2026-06-11)

**Branch:** `slice/nearby-gym-suggestions`

## Goal

When posting a raid, the gym field should suggest gyms **before the user types**:
1. **Dine seneste** — the last 3 distinct gyms this user posted raids at
2. **I nærheden** — the nearest gyms by distance, using browser geolocation and the
   seeded coordinates in the `gyms` table

And while typing (≥2 chars, existing filter), matches are **sorted by distance** with
a distance label when the position is known.

GDPR constraints (CLAUDE.md): geolocation is requested only on explicit user action
(or used silently when the browser permission is already granted), used transiently
in the browser to sort gyms, **never stored and never sent to our servers**. Privacy
Policy gets a mention + `lastUpdated` bump.

## Architecture notes

- `src/app/[locale]/raids/new/page.tsx` is a **client component** — recent-gyms and
  gym-list fetches happen client-side with the browser Supabase client, matching the
  page's existing pattern (`createRaid`, `learnGym`).
- All ranking/grouping logic lives in a **pure module** (TDD) so the component stays
  thin and the logic is fully unit-tested.

## Files

1. **`src/lib/gyms/suggestions.ts`** + **`suggestions.test.ts`** (TDD FIRST) — pure:
   - `haversineMeters(a, b)` — `{lat,lng}` pairs → meters.
   - `formatDistance(meters)` — `< 1000` → `"350 m"` (rounded to 10s), else `"1,2 km"`
     (da decimal comma, one decimal).
   - `buildGymSuggestions({ gyms, recentNames, position, query })` → display model:
     - `query.trim().length < 2`: `{ recent: string[] (≤3, order preserved),
       nearby: Array<{ name, distanceLabel }> (≤5 nearest gyms with coords,
       excluding names already in recent, only when position ≠ null) }`
     - `query.trim().length ≥ 2`: `{ matches: Array<{ name, distanceLabel? }> }` —
       case-insensitive `includes` filter (existing behaviour); sorted by distance
       when position ≠ null (gyms without coords last, alphabetical), else
       alphabetical; `distanceLabel` only for gyms with coords and position ≠ null.
   - Tests: haversine against a known pair (~Frederikssund station → swimming hall),
     formatting both branches + comma, grouping/dedup (recent excluded from nearby),
     ≤5 cap, no-position → empty nearby, query filtering + distance sort + coordless-
     gyms-last.
2. **`src/lib/gyms/helpers.ts`** — `fetchGymNames` becomes `fetchGyms():
   Promise<Array<{ name: string; lat: number | null; lng: number | null }>>`
   (`select('name, lat, lng')`, same []-on-error contract). Update existing helpers
   tests accordingly. `isKnownGym`/`normalizeGymName`/`learnGym` unchanged
   (`isKnownGym` takes `string[]` — callers map `.name`).
3. **`src/lib/raids/helpers.ts`** — client `fetchRecentGymNames(userId, limit = 3)`:
   `from('raids').select('gym_name').eq('user_id', userId).not('gym_name', 'is', null)
   .order('created_at', { ascending: false }).limit(25)`, dedupe case-insensitively in
   JS preserving order, return first 3. [] on error.
4. **`src/lib/hooks/use-geolocation.ts`** — client hook:
   - state: `{ status: 'unsupported' | 'idle' | 'granted-pending' | 'located' |
     'denied', position: { lat, lng } | null }`
   - On mount: if no `navigator.geolocation` → `unsupported`. Else
     `navigator.permissions?.query({ name: 'geolocation' })`: if `granted` →
     `getCurrentPosition` silently (no prompt for returning users); `denied` →
     `denied`; otherwise `idle` (a visible button will trigger the prompt). Browsers
     without `navigator.permissions` stay `idle`.
   - `request()`: calls `getCurrentPosition`; success → `located` + position;
     error/deny → `denied`. `enableHighAccuracy: false, maximumAge: 60_000,
     timeout: 10_000`.
   - React 19 rules: async-callback setState is fine; guard against setState after
     unmount with a ref or cancelled flag.
5. **`src/components/GymSearch.tsx`** — extend:
   - Module cache now holds the `fetchGyms()` rows.
   - New prop `recentGyms: string[]` (default `[]`).
   - Use the geolocation hook. Dropdown now also opens on focus with an EMPTY query:
     - recent group (header `t('recentHeader')`, History icon, rows = names)
     - nearby group: if `located` → header `t('nearbyHeader')`, rows = name +
       muted distance label (MapPin icon); if `idle` → one button row
       `t('useLocation')` (LocateFixed icon) calling `request()`;
       if `denied`/`unsupported` → nothing.
     - If both groups are empty and status isn't `idle`, don't render the dropdown.
   - Typing ≥2 chars: render `matches` from `buildGymSuggestions` (replaces the
     inline filter), with optional muted distance label per row; keep the existing
     `emptyList`/`noMatch` states and select/clear behaviour unchanged.
6. **`src/app/[locale]/raids/new/page.tsx`** — on mount (where the page already gets
   the session/user id; it calls `getClaims` — reuse the existing pattern), fetch
   `fetchRecentGymNames(userId)` once and pass `recentGyms` to `<GymSearch>`.
7. **i18n** — `GymSearch` namespace additions (da + en): `recentHeader`
   ("Dine seneste gyms"), `nearbyHeader` ("I nærheden"), `useLocation`
   ("Vis gyms i nærheden"). NO hardcoded strings.
8. **Privacy Policy** — `messages/da.json` + `messages/en.json`: extend the section
   that lists what data we process (find the natural section — likely the one about
   collected data, or §7 processors if a better fit) with: nearby-gym suggestions use
   the device's location **only in the browser, only after the user grants the
   permission prompt**, to sort gym suggestions by distance; the location is never
   stored and never sent to our servers. Bump `Privacy.lastUpdated` → 2026-06-11
   (both files).
9. **`src/lib/changelog/entries.ts`** — prepend (2026-06-11):
   "Raid-formularen foreslår nu gyms i nærheden (hvis du deler din placering) og dine
   senest brugte gyms, før du overhovedet begynder at skrive."
10. **Component test** — `src/components/GymSearch.test.tsx`: NextIntlClientProvider +
    real da messages (see AppMenu.test.tsx pattern), mock the gyms fetch module +
    `navigator.geolocation`/`navigator.permissions` via `vi.stubGlobal`. Cover:
    recent group renders on focus with empty query; "Vis gyms i nærheden" button when
    permission state is prompt; nearby list with distance labels when granted
    (mock `getCurrentPosition` success); typed query → distance-sorted matches.
11. **e2e** — `e2e/nearby-gyms.spec.ts`, env-gated like the others, mobile viewport:
    `test.use({ geolocation: { latitude: 55.8396, longitude: 12.0689 }, permissions:
    ['geolocation'] })`; login → `/raids/new` → focus the gym field → expect the
    "I nærheden" header and ≥1 suggestion row (prod DB is seeded); type "sø" → expect
    filtered matches. No raid is posted (nothing submitted).
12. **CLAUDE.md** — decisions-log entry + remove the Next-up item (main session, not
    the implementation agent).

## Out of scope

- Watching the position (single `getCurrentPosition` per page view is enough).
- Re-asking after deny (browser UX handles re-grants via the URL-bar permission UI).
- Desktop-specific layout work (the form is the same component at all widths).

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, local e2e
baseline. Prod spot-check (PM, on the phone): open the raid form → tap the gym field
→ "Vis gyms i nærheden" → grant → nearest gyms with distances; post nothing.
