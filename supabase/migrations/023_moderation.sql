-- Migration 023: content moderation — user reports, message deletion, user bans.
--
-- Run in the Supabase SQL editor after 022_friend_code_column_security.sql.
--
-- APPLY BEFORE MERGE. The chat surfaces call report_message() and the /admin
-- screen selects from message_reports on first load after the code deploys, so
-- this migration must be applied to the PROD project before the PR merges (and
-- to pogosundet-preview so Preview builds work).
--
-- AFTER APPLYING, grant yourself moderator rights — nobody is an admin by
-- default, so /admin 404s for everyone until you run this once:
--
--   UPDATE public.profiles SET is_admin = true WHERE trainer_name = '<your name>';
--
-- What this migration adds:
--   1. profiles.is_admin  — who may moderate
--      profiles.banned_at / banned_reason — who is blocked from posting
--   2. is_admin() / is_banned() SECURITY DEFINER helpers used by RLS policies
--   3. message_reports — one row per (message, reporter), with a snapshot of the
--      message body so the incident survives the message being deleted
--   4. report_message()  — the ONLY way a user files a report
--   5. moderate_report() — the ONLY way a moderator acts on one
--   6. Admin DELETE policies on the three message tables
--   7. Ban enforcement on every user-content INSERT policy

-- ---------------------------------------------------------------------------
-- 1. Profile columns
-- ---------------------------------------------------------------------------

-- Moderator flag. Set manually via SQL (see header) — deliberately NOT
-- editable from the app, so there is no in-app path to privilege escalation.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Ban state. banned_at IS NULL means "in good standing"; a timestamp means the
-- user cannot post new content anywhere. Reversible — moderate_report('unban')
-- sets it back to NULL. Existing messages are NOT removed by a ban; deleting
-- them is a separate, explicit moderator action.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_reason text CHECK (length(banned_reason) <= 500);

-- The reason text is written by the moderator and may quote what the user did,
-- so it is not public. Column-level REVOKE (same technique as migration 022's
-- friend_code): the banned user reads their own reason through the existing
-- get_own_profile() SECURITY DEFINER RPC, and the moderator reads it through
-- the service-role admin client. `banned_at` itself stays readable — it is a
-- plain state flag with no free text in it.
REVOKE SELECT (banned_reason) ON public.profiles FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helper functions
--
-- Both are SECURITY DEFINER so RLS policies on OTHER tables can consult
-- `profiles` without the caller needing to satisfy the profiles policies, and
-- so they can't be short-circuited by a column-level REVOKE (migration 022).
-- STABLE so Postgres can cache the result within a single statement.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.user_id = uid),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_banned(uid uuid DEFAULT auth.uid())
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = uid AND p.banned_at IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. message_reports
--
-- `message_id` intentionally has NO foreign key: it points at one of three
-- different tables depending on `surface`, and Postgres has no polymorphic FK.
-- Referential integrity is enforced in report_message(), which resolves the
-- message before inserting. A deleted message therefore leaves its report
-- intact — that is deliberate, it is the audit trail of the incident.
--
-- `message_body` is a SNAPSHOT taken server-side at report time. It is never
-- supplied by the client (a client-supplied body would let anyone fabricate
-- quotes and get an innocent user banned), and it is what the moderator reviews
-- after the original message is gone.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface          text NOT NULL CHECK (surface IN ('channel', 'raid', 'dm')),
  message_id       uuid NOT NULL,
  -- Where the message lives, for the moderator's "open in context" link.
  -- Channel slug for 'channel', raid id for 'raid', NULL for 'dm'.
  context_id       text,
  reporter_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason           text NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'inappropriate', 'other')),
  note             text CHECK (length(note) <= 500),
  message_body     text NOT NULL,
  message_sent_at  timestamptz,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  -- The last moderator action taken. NULL while pending.
  resolution       text CHECK (resolution IN ('deleted', 'banned', 'unbanned', 'warned', 'dismissed')),
  moderator_note   text CHECK (length(moderator_note) <= 1000),
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- One report per user per message: re-reporting is a no-op, not a duplicate.
  UNIQUE (surface, message_id, reporter_id)
);

-- FKs to profiles so the moderation screen can embed trainer names in one
-- query — same pattern as channel_messages / direct_messages. profiles.user_id
-- is unique, so it can be a FK target. Two FKs to the same table means embedded
-- selects must disambiguate by constraint name (see server-helpers.ts).
ALTER TABLE public.message_reports
  DROP CONSTRAINT IF EXISTS message_reports_reporter_profile_fk;
ALTER TABLE public.message_reports
  ADD CONSTRAINT message_reports_reporter_profile_fk
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.message_reports
  DROP CONSTRAINT IF EXISTS message_reports_reported_profile_fk;
ALTER TABLE public.message_reports
  ADD CONSTRAINT message_reports_reported_profile_fk
  FOREIGN KEY (reported_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Hot path: the moderation queue lists pending reports newest-first.
CREATE INDEX IF NOT EXISTS message_reports_status_created_idx
  ON public.message_reports (status, created_at DESC);

-- Used by moderate_report() to auto-resolve sibling reports of the same message.
CREATE INDEX IF NOT EXISTS message_reports_message_idx
  ON public.message_reports (surface, message_id);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- Only moderators can read reports. Deliberately NOT readable by the reporter:
-- a report contains the moderator's notes and the ban/deletion outcome, and
-- keeping it admin-only means a DM report never widens who can read that DM
-- beyond the two participants plus the moderator.
CREATE POLICY "Admins can read reports"
  ON public.message_reports FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update reports"
  ON public.message_reports FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No INSERT policy by design: rows are created ONLY through report_message(),
-- which runs SECURITY DEFINER and therefore bypasses RLS. This is what
-- guarantees message_body is a genuine server-side snapshot.

-- ---------------------------------------------------------------------------
-- 4. report_message() — the user-facing report entry point.
--
-- Resolves the message out of the correct table, verifies the caller is
-- allowed to see it (DMs: participants only), snapshots the body and author,
-- and inserts the report. Idempotent: reporting the same message twice returns
-- the existing report id rather than erroring.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_message(
  p_surface    text,
  p_message_id uuid,
  p_reason     text,
  p_note       text DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_reporter   uuid := auth.uid();
  v_author     uuid;
  v_body       text;
  v_sent_at    timestamptz;
  v_context    text;
  v_report_id  uuid;
BEGIN
  IF v_reporter IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_surface NOT IN ('channel', 'raid', 'dm') THEN
    RAISE EXCEPTION 'invalid_surface';
  END IF;

  IF p_reason NOT IN ('spam', 'harassment', 'hate', 'inappropriate', 'other') THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  -- Resolve the reported message. Each branch also enforces visibility: a user
  -- can only report something they are allowed to read in the first place.
  IF p_surface = 'channel' THEN
    SELECT m.user_id, m.body, m.created_at, m.channel
      INTO v_author, v_body, v_sent_at, v_context
      FROM public.channel_messages m
     WHERE m.id = p_message_id;

  ELSIF p_surface = 'raid' THEN
    SELECT m.user_id, m.message, m.created_at, m.raid_id::text
      INTO v_author, v_body, v_sent_at, v_context
      FROM public.raid_messages m
     WHERE m.id = p_message_id;

  ELSE -- 'dm'
    -- The participant check is the privacy boundary: a third party cannot file
    -- a report to pull someone else's DM into the moderation queue.
    SELECT m.sender_id, m.body, m.created_at, NULL::text
      INTO v_author, v_body, v_sent_at, v_context
      FROM public.direct_messages m
     WHERE m.id = p_message_id
       AND (m.sender_id = v_reporter OR m.recipient_id = v_reporter);
  END IF;

  IF v_author IS NULL THEN
    RAISE EXCEPTION 'message_not_found';
  END IF;

  IF v_author = v_reporter THEN
    RAISE EXCEPTION 'cannot_report_own_message';
  END IF;

  INSERT INTO public.message_reports (
    surface, message_id, context_id, reporter_id, reported_user_id,
    reason, note, message_body, message_sent_at
  )
  VALUES (
    p_surface, p_message_id, v_context, v_reporter, v_author,
    p_reason, NULLIF(btrim(COALESCE(p_note, '')), ''), v_body, v_sent_at
  )
  ON CONFLICT (surface, message_id, reporter_id) DO NOTHING
  RETURNING id INTO v_report_id;

  -- ON CONFLICT DO NOTHING returns no row — fetch the existing report so the
  -- caller always gets an id back and a double-tap reads as success.
  IF v_report_id IS NULL THEN
    SELECT r.id INTO v_report_id
      FROM public.message_reports r
     WHERE r.surface = p_surface
       AND r.message_id = p_message_id
       AND r.reporter_id = v_reporter;
  END IF;

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_message(text, uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. moderate_report() — the moderator action entry point.
--
-- Actions:
--   'delete'   remove the reported message everywhere, mark resolved
--   'ban'      block the reported user from posting, mark resolved
--   'unban'    lift the ban
--   'warn'     record that a warning DM was sent (the DM itself is inserted by
--              the API route as the moderator's own message, so the user can
--              reply to a real person)
--   'dismiss'  no action needed
--
-- Actions are independent and repeatable — deleting a message and then banning
-- its author are two calls on the same report. `resolution` records the most
-- recent one.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.moderate_report(
  p_report_id uuid,
  p_action    text,
  p_note      text DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_admin  uuid := auth.uid();
  v_report public.message_reports%ROWTYPE;
BEGIN
  IF NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_report FROM public.message_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_not_found';
  END IF;

  IF p_action = 'delete' THEN
    -- Hard delete: the offending content is actually removed, not hidden. The
    -- report's message_body snapshot preserves the audit trail.
    IF v_report.surface = 'channel' THEN
      DELETE FROM public.channel_messages WHERE id = v_report.message_id;
    ELSIF v_report.surface = 'raid' THEN
      DELETE FROM public.raid_messages WHERE id = v_report.message_id;
    ELSE
      DELETE FROM public.direct_messages WHERE id = v_report.message_id;
    END IF;

    -- Any other pending report about the SAME message is now handled too —
    -- resolve them so the queue doesn't show work that no longer exists.
    UPDATE public.message_reports
       SET status = 'resolved',
           resolution = 'deleted',
           reviewed_at = now(),
           reviewed_by = v_admin
     WHERE surface = v_report.surface
       AND message_id = v_report.message_id
       AND status = 'pending'
       AND id <> p_report_id;

  ELSIF p_action = 'ban' THEN
    UPDATE public.profiles
       SET banned_at = now(),
           banned_reason = NULLIF(btrim(COALESCE(p_note, '')), '')
     WHERE user_id = v_report.reported_user_id;

  ELSIF p_action = 'unban' THEN
    UPDATE public.profiles
       SET banned_at = NULL,
           banned_reason = NULL
     WHERE user_id = v_report.reported_user_id;

  ELSIF p_action NOT IN ('warn', 'dismiss') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  UPDATE public.message_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
         resolution = CASE p_action
                        WHEN 'delete'  THEN 'deleted'
                        WHEN 'ban'     THEN 'banned'
                        WHEN 'unban'   THEN 'unbanned'
                        WHEN 'warn'    THEN 'warned'
                        ELSE 'dismissed'
                      END,
         moderator_note = COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), moderator_note),
         reviewed_at = now(),
         reviewed_by = v_admin
   WHERE id = p_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_report(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Admin DELETE policies on the message tables.
--
-- moderate_report() runs SECURITY DEFINER and so doesn't strictly need these,
-- but they are the safety net that keeps "only a moderator may delete someone
-- else's message" true at the database layer for any other code path.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can delete channel messages" ON public.channel_messages;
CREATE POLICY "Admins can delete channel messages"
  ON public.channel_messages FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete raid messages" ON public.raid_messages;
CREATE POLICY "Admins can delete raid messages"
  ON public.raid_messages FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete direct messages" ON public.direct_messages;
CREATE POLICY "Admins can delete direct messages"
  ON public.direct_messages FOR DELETE
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Ban enforcement.
--
-- A ban blocks NEW content everywhere. Postgres has no ALTER POLICY for the
-- WITH CHECK expression, so each existing INSERT policy is dropped and
-- recreated with the extra `NOT public.is_banned()` condition. The auth.uid()
-- half of every condition is unchanged.
--
-- Reactions and raid joins are deliberately left alone: they carry no
-- free-text content, and keeping the blast radius small means a ban can't
-- break unrelated flows.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.channel_messages;
CREATE POLICY "Authenticated users can send messages"
  ON public.channel_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.raid_messages;
CREATE POLICY "Authenticated users can send messages"
  ON public.raid_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

DROP POLICY IF EXISTS "Users can send DMs as themselves" ON public.direct_messages;
CREATE POLICY "Users can send DMs as themselves"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND NOT public.is_banned());

DROP POLICY IF EXISTS "Authenticated users can insert raids" ON public.raids;
CREATE POLICY "Authenticated users can insert raids"
  ON public.raids FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

-- ---------------------------------------------------------------------------
-- 8. Realtime.
--
-- message_reports is added to the publication so the moderation screen's
-- pending badge updates live while the moderator has the app open.
--
-- The message tables are already published (migrations 003/008/014). DELETE
-- events carry only the primary key under the default REPLICA IDENTITY, which
-- is exactly what the clients need to drop a moderated message from view — and
-- means no message content is broadcast by a deletion.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
