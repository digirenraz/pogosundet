-- Fixes account deletion: five *_profile_fk constraints (added purely so
-- PostgREST can embed profiles(trainer_name) in queries — see 002/003/008/014)
-- were created without ON DELETE CASCADE, defaulting to NO ACTION. Each of
-- these tables also has a separate FK on the same column straight to
-- auth.users(id) ON DELETE CASCADE, so deleting an account triggers two
-- independent cascade paths off the same auth.users row. Postgres does not
-- guarantee those complete in a particular order — if the profiles row is
-- cascaded away before the sibling table's own auth.users cascade finishes,
-- the NO ACTION constraint here throws a foreign key violation and
-- auth.admin.deleteUser() fails. This only reproduces for a user who has
-- actually posted a raid, joined one, sent a channel message, or sent/received
-- a DM — an empty test account deletes cleanly, which is why this went
-- unnoticed. Migration 024's message_reports FKs already got this right;
-- this brings the four older tables in line with that pattern.

ALTER TABLE public.raid_attendees
  DROP CONSTRAINT IF EXISTS raid_attendees_profile_fk;
ALTER TABLE public.raid_attendees
  ADD CONSTRAINT raid_attendees_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.raid_messages
  DROP CONSTRAINT IF EXISTS raid_messages_profile_fk;
ALTER TABLE public.raid_messages
  ADD CONSTRAINT raid_messages_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.channel_messages
  DROP CONSTRAINT IF EXISTS channel_messages_profile_fk;
ALTER TABLE public.channel_messages
  ADD CONSTRAINT channel_messages_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_sender_profile_fk;
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_sender_profile_fk
  FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_recipient_profile_fk;
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_recipient_profile_fk
  FOREIGN KEY (recipient_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
