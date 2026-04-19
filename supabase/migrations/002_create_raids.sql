-- Raids and attendees tables for the Raid MVP (Slice 6).
-- Raids can have an optional screenshot, gym name, boss name, start time, and note.
-- A raid is "active" for ~45 minutes after COALESCE(starts_at, created_at).

create table public.raids (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  image_url   text,         -- screenshot from Pokémon GO (primary input)
  gym_name    text,         -- optional
  boss_name   text,         -- optional
  starts_at   timestamptz,  -- optional; auto-hide uses COALESCE(starts_at, created_at)
  note        text,         -- optional
  created_at  timestamptz default now()
);

create table public.raid_attendees (
  raid_id  uuid not null references public.raids(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  primary key (raid_id, user_id)
);

alter table public.raids enable row level security;
alter table public.raid_attendees enable row level security;

create policy "Anyone can read raids"
  on public.raids for select using (true);

create policy "Authenticated users can insert raids"
  on public.raids for insert with check (auth.uid() = user_id);

create policy "Users can delete own raids"
  on public.raids for delete using (auth.uid() = user_id);

create policy "Anyone can read attendees"
  on public.raid_attendees for select using (true);

create policy "Users can join raids"
  on public.raid_attendees for insert with check (auth.uid() = user_id);

create policy "Users can leave raids"
  on public.raid_attendees for delete using (auth.uid() = user_id);

-- FK to profiles so Supabase can embed profiles(trainer_name) in attendee queries.
-- profiles.user_id is unique, so it can be referenced as a FK target.
alter table public.raid_attendees
  add constraint raid_attendees_profile_fk
  foreign key (user_id) references public.profiles(user_id);
