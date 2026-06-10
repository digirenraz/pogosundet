# Slice: gyms database (name + exact location)

**Branch:** `slice/gyms-database`
**Origin:** issue #93 investigation (2026-06-10) — the OSM-based gym autocomplete is dead (the `leisure=pokemon_gym` tag has 0 uses globally), and neither pogomap.info (no API/licence) nor the official map (ToS) can be used as an automated source. We build our own table instead.
**PM requirements:** each gym needs **name + exact location (lat/lng)** — two later features depend on coordinates: "suggest gyms near the user when posting" and "show the gym in maps from the raid card".

## In scope

1. **Migration `018_gyms.sql`** — new `gyms` table:
   - `id uuid pk default gen_random_uuid()`
   - `name text not null` (CHECK length ≤ 120), **unique index on `lower(name)`** (dedup is case-insensitive)
   - `lat double precision null`, `lng double precision null` — nullable because auto-learned gyms arrive without coordinates; the PM backfills
   - `created_at timestamptz default now()`
   - RLS: SELECT + INSERT for `authenticated`; no UPDATE/DELETE policies (corrections happen via the SQL editor, mirroring how the raid-boss list is maintained)
2. **`GymSearch` reads from our table** — replace the dead `fetchOsmGyms()` OSM fetch with a Supabase (browser client) query of `gyms.name`, keeping the existing module-level cache, filtering UX, and free-text fallback exactly as they are.
3. **Auto-learn on raid post** — after a successful raid insert with a non-empty `gym_name` that isn't in the table, upsert it (name only, `ignoreDuplicates`, case-insensitive via the unique index). The list grows itself; zero admin burden (same philosophy as the raid-boss list, per the Open Questions section).
4. **Seeding workflow for the PM** — `docs/gyms-seeding.md`: read the official map (normal human use), and for each gym add a row with name + coordinates (Google Maps right-click → copy coordinates). Includes a ready-to-paste `INSERT ... ON CONFLICT DO NOTHING` SQL template. Seeding is **not** a merge blocker: the autocomplete works with however many rows exist, and auto-learn fills name-only rows from day one.
5. **Unit tests** for the new gym helper (name normalisation / auto-learn guard). No new e2e: auto-learn writes to the shared preview/prod DB, and the autocomplete's read path is covered by the existing raids-new flow.

## Explicitly out (future tasks, schema-ready)

- **Nearby-gym suggestions when posting** (needs browser geolocation — separate slice, has GDPR surface)
- **"Show in maps" on the raid card** (joins raid `gym_name` → `gyms` coordinates; trivial once seeded)
- Admin edit screen for gyms
- Capturing the poster's phone location to auto-fill coordinates (clever but GDPR-sensitive — deliberately deferred)

## Relevant open questions / constraints (CLAUDE.md)

- **Shared Supabase project (no staging):** `GymSearch` will query `gyms` as soon as the code deploys → **migration 018 must be applied in the SQL editor BEFORE the PR merges** (same apply-before-deploy ordering as 015/017).
- **Raid boss list maintenance** open question: this slice adopts the same answer for gyms — manual SQL for corrections, community auto-learn for growth, no admin UI unless it becomes a real burden.

## GDPR

No personal data: gym names/locations are public place data; auto-learned names are not linked to the posting user. No Privacy Policy change needed.
