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
