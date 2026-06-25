-- =============================================================
-- PoGoSundet — staging/preview Supabase bootstrap
-- One-paste concatenation of supabase/migrations/001..021, in order.
-- Generated 2026-06-25 from the migration files. Re-generate with
-- the script in docs/plans/staging-supabase.md if migrations change.
--
-- NOTE: every 'alter publication supabase_realtime add table ...' is
-- wrapped in a duplicate_object guard, because raid_messages is added by
-- BOTH 003 and 005 — running them back-to-back in one script would abort
-- on the second add without this guard. (In prod the migrations were
-- applied separately, so the source files keep the raw statements.)
--
-- Apply this ONCE to a FRESH second Supabase project (SQL editor).
-- After this: create the 'raid-images' Storage bucket + its 2 RLS
-- policies, and optionally run supabase/seeds/001_gyms_frederikssund_collect_dk.sql.
-- See docs/plans/staging-supabase.md for the full runbook.
-- =============================================================


-- =============================================================
-- 001_create_profiles.sql
-- =============================================================
-- Slice 2: profiles table
-- Run this in the Supabase SQL editor before testing profile creation.

create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null unique,
  trainer_name text not null,
  friend_code  text not null,
  first_name   text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- All logged-in users can read all profiles (needed for community browser in Slice 4)
create policy "Anyone can read profiles"
  on public.profiles for select using (true);

-- Users can only insert their own profile row
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = user_id);

-- Users can only update their own profile row
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = user_id);


-- =============================================================
-- 002_create_raids.sql
-- =============================================================
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


-- =============================================================
-- 003_raid_chat.sql
-- =============================================================
-- Slice 8 prep: per-raid chat messages + extra-player count on attendees.
-- Run in Supabase SQL editor after 002_create_raids.sql.

-- Extra players a user is bringing to a raid
ALTER TABLE public.raid_attendees
  ADD COLUMN extra_count int NOT NULL DEFAULT 0;

-- Chat messages per raid
CREATE TABLE public.raid_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id    uuid NOT NULL REFERENCES public.raids(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message    text NOT NULL CHECK (length(trim(message)) > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.raid_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read raid messages"
  ON public.raid_messages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.raid_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- FK to profiles so Supabase can embed profiles(trainer_name) in message queries.
ALTER TABLE public.raid_messages
  ADD CONSTRAINT raid_messages_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Enable real-time replication so clients receive new messages without polling.
-- Requires Replication to be enabled for this table in Supabase dashboard.
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_messages; exception when duplicate_object then null; end $$;


-- =============================================================
-- 004_push_subscriptions.sql
-- =============================================================
-- Push notification subscriptions per user.
-- One row per user — re-subscribing upserts the row.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade unique,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own subscription"
  on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role (Edge Function) bypasses RLS to read all subscriptions.


-- =============================================================
-- 005_realtime.sql
-- =============================================================
-- Enable Supabase Realtime broadcasts on raid-related tables so the app can
-- subscribe to changes via the JS client (used by useRaidsRealtime hook).
-- Apply manually in the Supabase SQL editor.
do $$ begin alter publication supabase_realtime add table public.raids; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.raid_attendees; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.raid_messages; exception when duplicate_object then null; end $$;


-- =============================================================
-- 006_profile_team_level.sql
-- =============================================================
-- Slice 10A: add team affiliation + level to profiles.
-- Both nullable — "Valgfri" in the design. No backfill needed.
-- Run this in the Supabase SQL editor before testing the new profile screens.

alter table public.profiles
  add column team text check (team in ('mystic','valor','instinct')),
  add column level smallint check (level between 1 and 80);


-- =============================================================
-- 007_perf_indexes.sql
-- =============================================================
-- Performance indexes for hot-path queries.
-- Run in the Supabase SQL editor.
--
-- raids.created_at is used in WHERE/ORDER BY by getActiveRaids / getRecentRaids
-- on every visit to /raids. raid_messages(raid_id, created_at) is used to load
-- the chat in the raid detail page. profiles.team backs the directory filter chips.

create index if not exists raids_created_at_idx
  on public.raids (created_at desc);

create index if not exists raid_messages_raid_created_idx
  on public.raid_messages (raid_id, created_at);

create index if not exists profiles_team_idx
  on public.profiles (team)
  where team is not null;


-- =============================================================
-- 008_channel_messages.sql
-- =============================================================
-- Slice 11: community chat channels (#generelt, #app-feedback).
-- Run in Supabase SQL editor after 007_perf_indexes.sql.

-- Free-text community messages keyed by a hard-coded channel slug.
-- No DELETE policy by design (matches raid_messages) — users cannot delete
-- their own messages in Phase 1. Account deletion cascades via the
-- auth.users ON DELETE CASCADE on user_id. Messages are kept indefinitely.
CREATE TABLE public.channel_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel    text NOT NULL CHECK (channel IN ('generelt', 'feedback')),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read channel messages"
  ON public.channel_messages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.channel_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- FK to profiles so Supabase can embed profiles(trainer_name, …) in queries.
ALTER TABLE public.channel_messages
  ADD CONSTRAINT channel_messages_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Hot path: list latest N messages for a channel.
CREATE INDEX channel_messages_channel_created_idx
  ON public.channel_messages (channel, created_at DESC);

-- Enable real-time replication so clients receive new messages without polling.
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages; exception when duplicate_object then null; end $$;


-- =============================================================
-- 009_channel_reads.sql
-- =============================================================
-- Slice 12: per-user "last read" timestamps for the chat channels.
-- Drives the unread badges on the BottomNav and on the channel-list rows.
-- Run in Supabase SQL editor after 008_channel_messages.sql.

CREATE TABLE public.channel_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel      text NOT NULL CHECK (channel IN ('generelt', 'feedback')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

ALTER TABLE public.channel_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own reads"
  ON public.channel_reads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own reads"
  ON public.channel_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own reads"
  ON public.channel_reads FOR UPDATE USING (auth.uid() = user_id);

-- No realtime publication — clients listen to channel_messages INSERTs and
-- maintain unread counts locally. Account deletion cascades via user_id FK.


-- =============================================================
-- 010_chat_reactions_and_replies.sql
-- =============================================================
-- Slice 13: chat replies + emoji reactions.
-- Run in Supabase SQL editor after 009_channel_reads.sql.

-- Threaded replies on community channel messages. ON DELETE SET NULL means
-- deleting a referenced message (e.g. via account cascade) leaves the reply
-- intact but unthreaded.
ALTER TABLE public.channel_messages
  ADD COLUMN reply_to_id uuid REFERENCES public.channel_messages(id) ON DELETE SET NULL;

CREATE INDEX channel_messages_reply_to_idx
  ON public.channel_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Emoji reactions. PK enforces "one of each emoji per user per message" — a
-- toggle is either an INSERT (add) or DELETE (remove), no UPDATE path.
CREATE TABLE public.channel_message_reactions (
  message_id uuid NOT NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.channel_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
  ON public.channel_message_reactions FOR SELECT USING (true);

CREATE POLICY "Users add own reactions"
  ON public.channel_message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own reactions"
  ON public.channel_message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time replication so reaction toggles propagate to all clients.
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_message_reactions; exception when duplicate_object then null; end $$;


-- =============================================================
-- 011_friend_code_constraint.sql
-- =============================================================
-- Enforce friend_code format at the DB level: exactly 12 digits in groups of
-- four separated by single spaces (e.g. "1234 5678 9012"). Matches the regex
-- already enforced by validateProfile() in src/lib/profile/validation.ts.
-- Running this on an existing table will fail if any rows violate the format —
-- fix those rows first (profile edit → save) before applying.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_friend_code_format
  CHECK (friend_code ~ '^\d{4} \d{4} \d{4}$');


-- =============================================================
-- 012_last_seen_at.sql
-- =============================================================
-- Track when each player was last online. Written by use-presence.ts on every
-- authenticated page load that subscribes to the presence channel (fire-and-
-- forget, best-effort). Nullable so existing rows are unaffected and new users
-- simply show no badge until their first session. The existing RLS UPDATE
-- policy on profiles covers this column automatically.
ALTER TABLE public.profiles
  ADD COLUMN last_seen_at timestamptz;


-- =============================================================
-- 013_raid_chat_reactions_and_replies.sql
-- =============================================================
-- Slice 16: raid chat replies + emoji reactions.
-- Mirror of 010 but on raid_messages. Run in the Supabase SQL editor after 012.

-- Threaded replies on raid chat messages. ON DELETE SET NULL means
-- deleting a referenced message (e.g. via account cascade) leaves the reply
-- intact but unthreaded.
ALTER TABLE public.raid_messages
  ADD COLUMN reply_to_id uuid REFERENCES public.raid_messages(id) ON DELETE SET NULL;

CREATE INDEX raid_messages_reply_to_idx
  ON public.raid_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Emoji reactions. PK enforces "one of each emoji per user per message" — a
-- toggle is either an INSERT (add) or DELETE (remove), no UPDATE path.
CREATE TABLE public.raid_message_reactions (
  message_id uuid NOT NULL REFERENCES public.raid_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.raid_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read raid reactions"
  ON public.raid_message_reactions FOR SELECT USING (true);

CREATE POLICY "Users add own raid reactions"
  ON public.raid_message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own raid reactions"
  ON public.raid_message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time replication so reaction toggles propagate to all clients.
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_message_reactions; exception when duplicate_object then null; end $$;


-- =============================================================
-- 014_direct_messages.sql
-- =============================================================
-- Slice 17: 1:1 direct messages between two profiles.
-- Adds `direct_messages` (with threaded reply_to_id), `direct_message_reactions`,
-- and `dm_reads` (per-pair last-read timestamp for the unread badge).
-- Run in Supabase SQL editor after 013_raid_chat_reactions_and_replies.sql.

-- Direct messages between two profiles.
CREATE TABLE public.direct_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(trim(body)) > 0),
  reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

-- Pair-key index: every conversation lookup boils down to "all messages between
-- two specific users, newest first". `least`/`greatest` ensures both directions
-- of the pair share an index entry.
CREATE INDEX direct_messages_pair_idx
  ON public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at DESC);

CREATE INDEX direct_messages_reply_to_idx
  ON public.direct_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read own DMs" ON public.direct_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send DMs as themselves" ON public.direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- FK to profiles so embedded selects (sender:profiles(trainer_name,...)) work.
-- profiles.user_id is unique; same pattern as raid_attendees and channel_messages.
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_sender_profile_fk
  FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id);
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_recipient_profile_fk
  FOREIGN KEY (recipient_id) REFERENCES public.profiles(user_id);

-- Reactions — same shape as channel/raid reactions but locked down to
-- conversation participants only via an EXISTS subquery on direct_messages.
CREATE TABLE public.direct_message_reactions (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Only conversation participants can read reactions on a DM.
CREATE POLICY "Participants can read DM reactions" ON public.direct_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
    )
  );

-- Only participants can add reactions, and only as themselves.
CREATE POLICY "Participants can add DM reactions" ON public.direct_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
    )
  );

CREATE POLICY "Users remove own DM reactions" ON public.direct_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Read tracking — one row per (viewer, partner) pair. Mirrors channel_reads.
CREATE TABLE public.dm_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

ALTER TABLE public.dm_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dm_reads" ON public.dm_reads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own dm_reads" ON public.dm_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dm_reads" ON public.dm_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- Realtime publication so message + reaction inserts surface to subscribed clients.
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages; exception when duplicate_object then null; end $$;
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions; exception when duplicate_object then null; end $$;


-- =============================================================
-- 015_raid_completion_and_reactions.sql
-- =============================================================
-- Slice: raid completion + raid-level reactions. Run in the Supabase SQL editor.

-- 1. Completion flag. NULL = not completed; a timestamp = marked completed by
-- the poster. A completed raid is treated as "ended" client-side (drops into the
-- greyed section) regardless of its age.
ALTER TABLE public.raids ADD COLUMN completed_at timestamptz;

-- raids previously had no UPDATE policy at all. Allow only the poster to update
-- their own raid (this is what gates toggleRaidCompleted). Both USING and
-- WITH CHECK pin the row to the owner so they can't reassign it either.
CREATE POLICY "Users update own raids"
  ON public.raids FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Reactions to the raid itself (not a chat message). Stable codes live in the
-- DB; human labels live in i18n. PK enforces "one of each reaction per user per
-- raid" — a toggle is either an INSERT (add) or DELETE (remove), no UPDATE path.
-- The PK's leading raid_id also indexes the per-raid count reads.
CREATE TABLE public.raid_reactions (
  raid_id    uuid NOT NULL REFERENCES public.raids(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction   text NOT NULL CHECK (reaction IN ('tfr', 'shiny', 'hundo')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (raid_id, user_id, reaction)
);

ALTER TABLE public.raid_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read raid reactions"
  ON public.raid_reactions FOR SELECT USING (true);

CREATE POLICY "Users add own raid reactions"
  ON public.raid_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own raid reactions"
  ON public.raid_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time replication so reaction toggles propagate to all clients.
do $$ begin ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_reactions; exception when duplicate_object then null; end $$;


-- =============================================================
-- 016_block_join_completed_raid.sql
-- =============================================================
-- Block joining a raid once it has been marked completed.
-- The UI already hides the RSVP button on completed raids (RaidDetail), but
-- joinRaid() writes to raid_attendees directly via RLS, so a client that had
-- the raid open *before* it was completed could still insert. This tightens
-- the INSERT policy to also require the target raid is not completed.
--
-- Leaving a completed raid (DELETE) stays allowed — only new participation
-- is blocked.

drop policy if exists "Users can join raids" on public.raid_attendees;

create policy "Users can join raids"
  on public.raid_attendees for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.raids r
      where r.id = raid_id
        and r.completed_at is not null
    )
  );


-- =============================================================
-- 017_raid_reads.sql
-- =============================================================
-- Issue #104: raid chat unread tracking + push notifications.
-- Adds `raid_reads` (per-user-per-raid last-read timestamp), mirroring
-- `dm_reads`/`channel_reads` — drives the Raids tab badge, the per-card
-- unread count on /raids, and lets a raid's chat clear on open.
-- Run in Supabase SQL editor after 016_block_join_completed_raid.sql.

CREATE TABLE public.raid_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raid_id      uuid NOT NULL REFERENCES public.raids(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, raid_id)
);

ALTER TABLE public.raid_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own raid_reads" ON public.raid_reads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own raid_reads" ON public.raid_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own raid_reads" ON public.raid_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- No realtime publication — clients listen to raid_messages INSERTs and
-- maintain unread counts locally (mirrors channel_reads). Account deletion
-- cascades via the user_id FK; deleting a raid cascades via the raid_id FK.


-- =============================================================
-- 018_gyms.sql
-- =============================================================
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


-- =============================================================
-- 019_input_length_limits.sql
-- =============================================================
-- Migration 019: max-length CHECK constraints on free-text user fields.
-- Security review Finding 2 (input validation). The raid form and chat composer
-- already cap input client-side via `maxLength`, but a client can bypass the UI
-- and INSERT directly through the Supabase API (RLS allows a user to insert
-- their own rows). These constraints are the real, server-side enforcement that
-- stops a multi-megabyte note/message/name from bloating the DB or breaking
-- layouts. Limits mirror the shared constants in src/lib/raids/validation.ts
-- (RAID_*_MAX) and src/lib/chat/types.ts (CHAT_MESSAGE_MAX_LENGTH).
--
-- Run in the Supabase SQL editor after 018_gyms.sql.
--
-- NULL passes a CHECK (the expression is not FALSE), so the optional raid
-- fields are unaffected when left blank. If any ALTER fails because a legacy
-- row already exceeds the cap (unlikely — these limits are generous), trim that
-- row first, then re-run. The caps are deliberately well above normal use.

-- Raids: gym name matches the gyms.name cap (migration 018), boss name and note
-- get sensible bounds.
ALTER TABLE public.raids
  ADD CONSTRAINT raids_gym_name_max CHECK (char_length(gym_name) <= 120),
  ADD CONSTRAINT raids_boss_name_max CHECK (char_length(boss_name) <= 60),
  ADD CONSTRAINT raids_note_max CHECK (char_length(note) <= 500);

-- Chat message bodies (channel, raid, DM all share the composer / 2000 cap).
-- Note the raid-chat column is `message`; the others are `body`.
ALTER TABLE public.channel_messages
  ADD CONSTRAINT channel_messages_body_max CHECK (char_length(body) <= 2000);

ALTER TABLE public.raid_messages
  ADD CONSTRAINT raid_messages_message_max CHECK (char_length(message) <= 2000);

ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_body_max CHECK (char_length(body) <= 2000);


-- =============================================================
-- 020_hide_friend_code.sql
-- =============================================================
-- Migration 020: per-user "hide my friend code" toggle (issue #101).
-- When true, other users see a blurred placeholder instead of the friend code /
-- QR, and the value is redacted from the data they receive (see
-- redactHiddenFriendCodes in src/lib/profile/server-helpers.ts). The owner still
-- sees and edits their own code. Defaults to false (visible) for all existing
-- and new profiles — no behaviour change until a user opts out.
--
-- Apply-before-merge ordering (like 015/017/018): the profile form's UPDATE and
-- the directory redaction read this column against the shared preview/prod DB.
-- Run in the Supabase SQL editor after 019_input_length_limits.sql.

ALTER TABLE public.profiles
  ADD COLUMN hide_friend_code boolean NOT NULL DEFAULT false;


-- =============================================================
-- 021_friend_scan_status.sql
-- =============================================================
-- Migration 021: persist the desktop scan-session "added/skipped" marks.
-- On /players (desktop), working down the QR scan queue, the user taps
-- "Tilføjet → næste" or "Spring over" per player. Previously that lived only in
-- React state (lost on refresh/navigation). This table persists it so the user
-- can later see who they've already handled (a subtle "Allerede tilføjet" hint
-- on player cards + the queue seeds from here).
--
-- PRIVATE to the owner: each row is the SCANNER's own mark about a target
-- player. RLS restricts every operation to auth.uid() = user_id, so no one can
-- read or write another user's marks, and the target is never told.
--
-- `status` is self-reported — Pokémon GO has no API, so "added" only means the
-- user tapped the button, not that the in-game friend request went through.
--
-- Apply-before-merge ordering (like 015/017/018/020): /players queries this
-- table and the scan-session upserts into it against the shared preview/prod DB,
-- so it must exist before the PR merges. Run in the Supabase SQL editor after
-- 020_hide_friend_code.sql.

CREATE TABLE public.friend_scan_status (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('added', 'skipped')),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_user_id)
);

ALTER TABLE public.friend_scan_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scan status" ON public.friend_scan_status
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scan status" ON public.friend_scan_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scan status" ON public.friend_scan_status
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scan status" ON public.friend_scan_status
  FOR DELETE USING (auth.uid() = user_id);

-- No realtime publication: the marks are single-user and read at page load /
-- updated optimistically in the scan-session. Account deletion cascades via the
-- user_id FK; a deleted target cascades via target_user_id.

