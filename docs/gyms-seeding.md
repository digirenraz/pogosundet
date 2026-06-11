# Gyms database — seeding guide

How to fill the `gyms` table (migration 018) with local gym names and exact
coordinates. Written for the PM — no coding required, just the Supabase SQL
editor and Google Maps.

## ⚡ Ready-made seed: 152 gyms from collect.dk (2026-06-11)

[`supabase/seeds/001_gyms_frederikssund_collect_dk.sql`](../supabase/seeds/001_gyms_frederikssund_collect_dk.sql)
contains **152 gyms across Frederikssund municipality** (Frederikssund town,
Slangerup, Jægerspris, Skibby + villages) with in-game names and exact
coordinates, copied from [collect.dk](https://collect.dk) **with the operators'
permission** (granted via their Discord, 2026-06-11). To apply: open the file,
copy everything, paste into the Supabase SQL editor, Run. It's re-runnable and
never overwrites existing rows. After applying, the manual workflow below is
only needed for gyms collect.dk doesn't cover (new gyms, or gaps you notice).

## Why coordinates matter

The raid form's gym autocomplete only needs names, but two planned features
need each gym's **exact location** (lat/lng):

- **Nearby gyms** — suggest gyms close to the user when posting a raid
- **Show in maps** — open the gym's location from a raid card

Gyms that get auto-learned from posted raids arrive **name-only**, so the
coordinates have to come from manual seeding (or a later backfill).

## How to find gyms and their coordinates

1. Open the official map at [pokemongo.com/en/map](https://pokemongo.com/en/map)
   (log in) to see the local gym names. Reading it by hand like this is normal
   use of the site — do **not** automate or scrape it (against their ToS).
2. For each gym, find the same spot on [Google Maps](https://maps.google.com).
3. **Right-click the exact spot** — the first row of the menu shows the
   coordinates (e.g. `55.8406, 12.0654`). Clicking it copies them as
   `lat, lng`, ready to paste.

## Adding gyms — paste into the Supabase SQL editor

```sql
insert into public.gyms (name, lat, lng) values
  ('Fraktalskulptur Ved Station', 55.0000, 12.0000),
  ('<næste gym>', 0, 0)
on conflict (lower(name)) do nothing;
```

- Add as many rows as you like in one go — one `('name', lat, lng),` line per gym.
- `on conflict (lower(name)) do nothing` makes re-runs **safe**: if a gym is
  already in the table (any capitalisation), that row is simply skipped. You
  can keep one growing script and re-run the whole thing without duplicates.
- Auto-learned gyms (added by the app without coordinates) can be given
  coordinates later:

```sql
update public.gyms set lat = 55.0000, lng = 12.0000
where lower(name) = lower('Fraktalskulptur Ved Station');
```

## Seeding is incremental — not a launch blocker

The autocomplete works with however many rows exist (even zero — players can
always type a gym name manually, and the app learns it). Add gyms whenever you
have a few minutes; coordinates can always be backfilled later.
