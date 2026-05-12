-- Slice 10A: add team affiliation + level to profiles.
-- Both nullable — "Valgfri" in the design. No backfill needed.
-- Run this in the Supabase SQL editor before testing the new profile screens.

alter table public.profiles
  add column team text check (team in ('mystic','valor','instinct')),
  add column level smallint check (level between 1 and 80);
