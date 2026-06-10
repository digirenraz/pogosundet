-- Issue #93: community gyms database (name + exact location).
-- Adds `gyms` — replaces the dead OSM autocomplete source (the
-- leisure=pokemon_gym tag has 0 uses globally). Rows come from PM seeding
-- (docs/gyms-seeding.md) and from auto-learning: every gym name submitted
-- with a raid is inserted best-effort by the client.
-- Run in Supabase SQL editor after 017_raid_reads.sql.

CREATE TABLE public.gyms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(name) <= 120),
  -- lat/lng are nullable on purpose: community auto-learned gyms arrive
  -- name-only from the raid form; the PM backfills coordinates later via the
  -- SQL editor (future features — "nearby gyms" and "show in maps" — need them).
  lat        double precision,
  lng        double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive dedup at the DB level: the client's auto-learn is a plain
-- best-effort INSERT that ignores errors, so this index is what makes
-- concurrent or case-variant inserts of the same gym safely collapse into
-- one row (the duplicate insert just fails with 23505 and is discarded).
CREATE UNIQUE INDEX gyms_name_lower_idx ON public.gyms (lower(name));

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read gyms" ON public.gyms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users insert gyms" ON public.gyms
  FOR INSERT TO authenticated WITH CHECK (true);

-- No UPDATE/DELETE policies: corrections and coordinate backfills happen via
-- the SQL editor only (mirrors how the raid-boss list is maintained).
