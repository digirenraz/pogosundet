-- Migration 023: the #events channel and the state the event bot polls into.
--
-- PoGoSundet posts nothing automatically today — every message in every channel
-- is written by a human, so the raid-boss rotation only reaches the community
-- when somebody remembers to check LeekDuck and paste it. This adds a bot that
-- polls the ScrapedDuck feed (LeekDuck's data, republished as JSON with
-- permission) every 20 minutes and posts raid events + rotation changes to a
-- dedicated channel.
--
-- Four things here:
--
-- 1. `profiles.is_bot` — the bot needs a real profiles row, because
--    channel_messages.user_id carries FKs to BOTH auth.users(id) and
--    profiles(user_id). Without a flag that row would show up as a player in
--    /players, the online strip, the members sheet and the "X medlemmer" count.
--    This column is the single source of truth for filtering it out; see
--    getAllProfiles in src/lib/profile/server-helpers.ts and getMemberCount in
--    src/lib/chat/server-helpers.ts.
--
-- 2. The channel CHECK constraints gain 'events'. A CHECK cannot be altered in
--    place, so both are dropped and recreated. The names below are the ones
--    Postgres auto-assigned to the inline column checks in 008/009
--    (<table>_<column>_check) — if a DROP errors, list the real name with:
--      SELECT conname FROM pg_constraint
--       WHERE conrelid = 'public.channel_messages'::regclass AND contype = 'c';
--    The channel set stays mirrored by the hard-coded TypeScript union in
--    src/lib/chat/channels.ts.
--
-- 3/4. `pogo_feed_state` and `pogo_feed_posted_events` — the bot's memory, so it
--    posts diffs instead of the whole feed on every poll. Public game data only;
--    no personal data, so nothing here changes the Privacy Policy.
--
-- Apply-before-merge ordering (like 015/017/018/020/021): getAllProfiles filters
-- on is_bot and the poster inserts channel = 'events', so both are referenced by
-- queries that ship in this PR — prod errors for every user the moment the code
-- deploys if this has not been applied first. Run in the Supabase SQL editor
-- (prod AND pogosundet-preview) after 022_friend_code_column_security.sql.

-- 1. Bot flag -----------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN is_bot boolean NOT NULL DEFAULT false;

-- Partial index: every member-facing profile query filters `is_bot = false`, and
-- the bot rows are a vanishing fraction of the table.
CREATE INDEX profiles_is_bot_idx ON public.profiles (is_bot) WHERE is_bot;

-- 2. Allow the 'events' channel -----------------------------------------------

ALTER TABLE public.channel_messages DROP CONSTRAINT channel_messages_channel_check;
ALTER TABLE public.channel_messages
  ADD CONSTRAINT channel_messages_channel_check
  CHECK (channel IN ('generelt', 'feedback', 'events'));

ALTER TABLE public.channel_reads DROP CONSTRAINT channel_reads_channel_check;
ALTER TABLE public.channel_reads
  ADD CONSTRAINT channel_reads_channel_check
  CHECK (channel IN ('generelt', 'feedback', 'events'));

-- 3. Feed state ---------------------------------------------------------------

-- Small key/value store for the poller: the raid-lineup fingerprint (so a
-- rotation only posts when it actually changes) and the cached ETags used for
-- conditional GETs against raw.githubusercontent.com.
CREATE TABLE public.pogo_feed_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Posted-event ledger ------------------------------------------------------

-- One row per ScrapedDuck eventID the bot has already announced. Written BEFORE
-- the message is posted, so a crash mid-run can never double-post (same class of
-- bug as the non-idempotent createProfile retry in the decisions archive).
CREATE TABLE public.pogo_feed_posted_events (
  event_id   text PRIMARY KEY,
  event_type text NOT NULL,
  posted_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pogo_feed_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pogo_feed_posted_events ENABLE ROW LEVEL SECURITY;

-- No policies on either table, deliberately: this is internal bot state that no
-- client ever reads. Only the cron route touches it, via the service-role client
-- (src/lib/supabase/admin.ts), which bypasses RLS. RLS is still enabled so that
-- anon/authenticated get no access by default rather than by omission.

-- No realtime publication on either table — the bot's own messages already
-- replicate through channel_messages, which is where clients are listening.
-- Neither table references a user, so account deletion does not touch them.
