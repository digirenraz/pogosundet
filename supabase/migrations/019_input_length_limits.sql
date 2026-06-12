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
